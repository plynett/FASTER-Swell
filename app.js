const DEMO_LABEL = "OC400";
const TRANSECT_ZOOM_THRESHOLD = 9;
const MAX_RENDERED_TRANSECTS = 1400;
const NOAA_STATIONS_CSV_URL = "./data/noaa_ca_tide_stations.csv";
const NOAA_STATIONS_URL = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions";
const NOAA_PREDICTIONS_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const CDIP_DAP2_ASCII_BASE_URL = "https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore";
const CDIP_DAP2_ASCII_QUERY = "waveTime,waveHs,waveTp,waveDp,metaWaterDepth,metaShoreNormal";
// Optional fallback API route provided by web/scripts/serve_faster_web.py when that proxy is running.
const LIVE_MOP_API_PATH = "./api/mop-forecast";
const NOAA_APPLICATION_ID = "FASTER_Swell_Web";
const TRANSECT_HIT_WEIGHT_MULTIPLIER = 3.2;
const MIN_TRANSECT_HIT_WEIGHT = 9;
const DEFAULT_TIDE_PREVIEW_HOURS = 240;
const FEET_PER_METER = 3.28084;

const COLORS = {
  navy: "#11314c",
  aqua: "#22b7a7",
  gold: "#f3c26b",
  goldDeep: "#d7a74f",
  coral: "#e56752",
  blue: "#2563eb",
  green: "#159f91",
  red: "#cc4b37",
  yellow: "#c6a023",
  black: "#1f2937",
  sand: "#f4b066",
  sandEdge: "#d88a39",
  water: "#9ed8ea",
  waterEdge: "#1e64d0",
};

const state = {
  manifest: null,
  transects: [],
  genericDefaults: null,
  selectedTransect: null,
  selectedDatasetMeta: null,
  selectedForecast: null,
  selectedTideStation: null,
  selectedTideSeries: null,
  currentTideWindow: null,
  tideStationsPromise: null,
  tideCache: new Map(),
  datasetCache: new Map(),
  modelParams: null,
  results: null,
  currentIndex: 0,
  isPlaying: false,
  playTimer: null,
  resultsDirty: false,
  map: null,
  transectLayerGroup: null,
  visibleLayerMap: new Map(),
  hoveredTransectLabel: null,
  canvasRenderer: null,
  waveChart: null,
  tideChart: null,
  displayUnits: "metric",
  timeMode: "utc",
};

const dom = {
  appStatus: document.getElementById("appStatus"),
  selectedTransectLabel: document.getElementById("selectedTransectLabel"),
  selectionTitle: document.getElementById("selectionTitle"),
  dataAvailabilityPill: document.getElementById("dataAvailabilityPill"),
  geometryPreview: document.getElementById("geometryPreview"),
  geometryHelperText: document.getElementById("geometryHelperText"),
  unitModeControl: document.getElementById("unitModeControl"),
  timeModeControl: document.getElementById("timeModeControl"),
  runModelButton: document.getElementById("runModelButton"),
  resetDefaultsButton: document.getElementById("resetDefaultsButton"),
  runStatusPill: document.getElementById("runStatusPill"),
  forecastEmptyState: document.getElementById("forecastEmptyState"),
  forecastContent: document.getElementById("forecastContent"),
  runupEmptyState: document.getElementById("runupEmptyState"),
  runupContent: document.getElementById("runupContent"),
  waveCanvas: document.getElementById("waveChartCanvas"),
  tideCanvas: document.getElementById("tideChartCanvas"),
  waveChartTitle: document.getElementById("waveChartTitle"),
  tideChartTitle: document.getElementById("tideChartTitle"),
  timeSlider: document.getElementById("timeSlider"),
  playPauseButton: document.getElementById("playPauseButton"),
  forecastWindowLabel: document.getElementById("forecastWindowLabel"),
  currentTimeLabel: document.getElementById("currentTimeLabel"),
  sliderTimeLabel: document.getElementById("sliderTimeLabel"),
  sliderIndexLabel: document.getElementById("sliderIndexLabel"),
  timelineControls: document.getElementById("timelineControls"),
  metricGrid: document.getElementById("metricGrid"),
  runupProfile: document.getElementById("runupProfile"),
  categoryPill: document.getElementById("categoryPill"),
  mapOverlayCard: document.getElementById("mapOverlayCard"),
  profileModeControl: document.getElementById("profileModeControl"),
  tideSurgeLevelInput: document.getElementById("tideSurgeLevelInput"),
  waveTotalOffsetInput: document.getElementById("waveTotalOffsetInput"),
  averageBeachSlopeInput: document.getElementById("averageBeachSlopeInput"),
  beachElevationBaseInput: document.getElementById("beachElevationBaseInput"),
  bermWidthInput: document.getElementById("bermWidthInput"),
  duneCrestElevationInput: document.getElementById("duneCrestElevationInput"),
  toeToCrestDistanceInput: document.getElementById("toeToCrestDistanceInput"),
};

const profileModeButtons = [...dom.profileModeControl.querySelectorAll("[data-mode]")];
const unitModeButtons = [...dom.unitModeControl.querySelectorAll("[data-units]")];
const timeModeButtons = [...dom.timeModeControl.querySelectorAll("[data-time-mode]")];
const unitAwareLabelElements = [...document.querySelectorAll("[data-label-metric][data-label-english]")];
const numericInputIds = [
  "averageBeachSlopeInput",
  "beachElevationBaseInput",
  "bermWidthInput",
  "duneCrestElevationInput",
  "toeToCrestDistanceInput",
  "tideSurgeLevelInput",
  "waveTotalOffsetInput",
];

const currentTimeLinePlugin = {
  id: "currentTimeLine",
  afterDatasetsDraw(chart, args, options) {
    const value = options?.value;
    if (!value || !chart.scales?.x) {
      return;
    }

    const xScale = chart.scales.x;
    const top = chart.chartArea.top;
    const bottom = chart.chartArea.bottom;
    const x = xScale.getPixelForValue(value);
    if (!Number.isFinite(x)) {
      return;
    }

    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 2;
    ctx.strokeStyle = options.color || "#22b7a7";
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.restore();
  },
};

const emptyStateMessagePlugin = {
  id: "emptyStateMessage",
  afterDraw(chart, args, options) {
    const message = options?.message;
    if (!message || !chart.chartArea) {
      return;
    }

    const datasets = chart.data?.datasets || [];
    const hasPlottedData = datasets.some((dataset) => (
      (dataset.data || []).some((point) => {
        if (point == null) {
          return false;
        }
        if (typeof point === "number") {
          return Number.isFinite(point);
        }
        if (typeof point === "object" && "y" in point) {
          return Number.isFinite(point.y);
        }
        return false;
      })
    ));

    if (hasPlottedData) {
      return;
    }

    const { left, right, top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = options.color || "#60748a";
    ctx.font = options.font || "600 13px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, (left + right) / 2, (top + bottom) / 2);
    ctx.restore();
  },
};

Chart.register(currentTimeLinePlugin, emptyStateMessagePlugin);

const DEFAULT_FIGURE_RATIO = 940 / 350;
const FIXED_AXIS_WIDTH = 66;

init().catch((error) => {
  console.error(error);
  setAppStatus("Failed to initialize the prototype.");
  dom.runStatusPill.textContent = "Initialization failed";
});

async function init() {
  setAppStatus("Loading transects, manifests, and NOAA station metadata...");

  const [manifest, transectPayload] = await Promise.all([
    fetchJSON("./data/forecast-manifest.json"),
    fetchJSON("./data/transects.json"),
  ]);

  state.manifest = manifest;
  state.transects = transectPayload.transects;
  state.genericDefaults = manifest.genericDefaults || transectPayload.genericDefaults;
  state.tideStationsPromise = fetchCaliforniaTideStations();

  initMap();
  bindControls();

  const demoTransect = state.transects.find((transect) => transect.label === DEMO_LABEL) || state.transects[0];
  await selectTransect(demoTransect, { flyTo: false });
  await runModel();

  setAppStatus("Prototype ready. Zoom in and click a transect to explore.");
}

function initMap() {
  state.canvasRenderer = L.canvas({ padding: 0.3 });
  state.map = L.map("map", {
    zoomControl: true,
    preferCanvas: true,
    zoomSnap: 1,
    minZoom: 5,
    maxZoom: 18,
  }).setView([36.7, -120.2], 6);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Imagery © Esri",
      maxZoom: 19,
    }
  ).addTo(state.map);

  L.tileLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Labels © Esri",
      maxZoom: 19,
      opacity: 0.9,
    }
  ).addTo(state.map);

  state.transectLayerGroup = L.layerGroup().addTo(state.map);
  state.map.on("zoomend moveend", syncVisibleTransects);
  window.addEventListener("resize", () => {
    state.map.invalidateSize(false);
    syncVisibleTransects();
    updateGeometryPreview();
    if (state.results) {
      updatePlaybackUI();
    }
  });
  window.setTimeout(() => {
    state.map.invalidateSize(false);
    syncVisibleTransects();
  }, 250);
  syncVisibleTransects();
}

function bindControls() {
  for (const id of numericInputIds) {
    dom[id].addEventListener("input", handleParameterInput);
  }

  profileModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      profileModeButtons.forEach((candidate) => candidate.classList.toggle("active", candidate === button));
      handleParameterInput();
    });
  });

  unitModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setDisplayUnits(button.dataset.units);
    });
  });

  timeModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setTimeMode(button.dataset.timeMode);
    });
  });

  dom.resetDefaultsButton.addEventListener("click", () => {
    if (!state.selectedTransect) {
      return;
    }
    applyModelParams(getDefaultsForTransect(state.selectedTransect.label));
    setGeometryHelper("Defaults restored. Run the model to refresh the lower forecast panels.");
  });

  dom.runModelButton.addEventListener("click", () => {
    runModel().catch((error) => {
      console.error(error);
      if (!dom.runStatusPill.textContent.toLowerCase().includes("failed")) {
        dom.runStatusPill.textContent = "Run failed";
      }
      if (dom.geometryHelperText && !dom.geometryHelperText.textContent.toLowerCase().includes("failed")) {
        setGeometryHelper("The model run failed. Check the browser console for details.");
      }
    });
  });

  dom.timeSlider.addEventListener("input", () => {
    if (!state.results) {
      return;
    }
    state.currentIndex = Number(dom.timeSlider.value);
    updatePlaybackUI();
  });

  dom.playPauseButton.addEventListener("click", () => {
    if (!state.results) {
      return;
    }
    togglePlayback();
  });

  updateUnitAwareLabels();
  syncDisplayModeControls();
}

function setDisplayUnits(nextUnits) {
  const normalized = nextUnits === "english" ? "english" : "metric";
  if (state.displayUnits === normalized) {
    return;
  }
  state.displayUnits = normalized;
  syncDisplayModeControls();
  updateUnitAwareLabels();
  refreshDisplayPresentation();
}

function setTimeMode(nextMode) {
  const normalized = nextMode === "local" ? "local" : "utc";
  if (state.timeMode === normalized) {
    return;
  }
  state.timeMode = normalized;
  syncDisplayModeControls();
  refreshDisplayPresentation();
}

function syncDisplayModeControls() {
  unitModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.units === state.displayUnits);
  });
  timeModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.timeMode === state.timeMode);
  });
}

function updateUnitAwareLabels() {
  unitAwareLabelElements.forEach((element) => {
    const nextLabel = state.displayUnits === "english"
      ? element.dataset.labelEnglish
      : element.dataset.labelMetric;
    element.textContent = nextLabel;
  });
}

function refreshDisplayPresentation() {
  updateUnitAwareLabels();
  if (state.modelParams) {
    applyModelParams(state.modelParams);
  } else {
    updateGeometryPreview();
  }

  if (state.selectedForecast && state.selectedTideSeries) {
    renderCharts(state.selectedForecast, state.selectedTideSeries);
    updatePlaybackUI();
    return;
  }

  if (state.selectedTideSeries && state.currentTideWindow) {
    renderTideOnlyPreview(state.selectedTideSeries, state.currentTideWindow);
  }
}

async function selectTransect(transect, options = {}) {
  if (!transect) {
    return;
  }

  stopPlayback();
  state.selectedTransect = transect;
  state.selectedDatasetMeta = state.manifest.datasets[transect.label] || null;
  state.results = null;
  state.selectedForecast = null;
  state.currentIndex = 0;
  state.selectedTideSeries = null;
  state.currentTideWindow = null;
  state.resultsDirty = false;
  destroyForecastCharts();

  dom.selectedTransectLabel.textContent = transect.label;
  dom.selectionTitle.textContent = `Transect ${transect.label}`;
  dom.waveChartTitle.textContent = `MOP Wave Forecast - Transect ${transect.label}`;
  dom.tideChartTitle.textContent = "NOAA Tide Prediction";
  dom.dataAvailabilityPill.textContent = state.selectedDatasetMeta
    ? "Live MOP on run + local fallback"
    : "Live MOP on run";
  dom.runStatusPill.textContent = "Awaiting run";
  dom.forecastEmptyState.classList.remove("hidden");
  dom.forecastContent.classList.add("hidden");
  dom.timelineControls.classList.remove("hidden");
  dom.metricGrid.classList.remove("hidden");
  dom.runupEmptyState.classList.remove("hidden");
  dom.runupContent.classList.add("hidden");
  dom.forecastEmptyState.querySelector("h3").textContent = "No forecast has been run yet";
  dom.forecastEmptyState.querySelector("p").textContent =
    "Select a transect, tune the geometry, and run the model. The app will try live MOP forecast data first and fall back to local forecast files where available.";
  dom.metricGrid.innerHTML = "";
  dom.runupProfile.innerHTML = "";
  dom.categoryPill.textContent = "--";
  dom.categoryPill.style.background = "rgba(243, 194, 107, 0.18)";
  dom.categoryPill.style.color = "#7a5413";

  const defaults = getDefaultsForTransect(transect.label);
  applyModelParams(defaults);
  updateGeometryPreview();
  syncVisibleTransects();

  if (options.flyTo) {
    state.map.flyTo([transect.predictionLat, transect.predictionLon], Math.max(state.map.getZoom(), 10.5), {
      duration: 0.7,
    });
  }

  const tideStation = await resolveTideStation(transect);
  state.selectedTideStation = tideStation;
  dom.tideChartTitle.textContent = formatTideChartTitle(tideStation);
}

async function runModel() {
  if (!state.selectedTransect) {
    return;
  }

  stopPlayback();
  const params = sanitizeParams(readModelParamsFromInputs());
  applyModelParams(params);
  state.selectedForecast = null;
  state.results = null;

  dom.dataAvailabilityPill.textContent = "Loading live MOP...";
  dom.runStatusPill.textContent = "Loading forecast data...";
  setGeometryHelper("Preparing wave, tide, and runup data for the selected transect.");

  const forecastDataset = await loadForecastDataset(state.selectedTransect.label);
  const tideStation = state.selectedTideStation || (await resolveTideStation(state.selectedTransect));
  state.selectedTideStation = tideStation;
  const tideWindow = forecastDataset
    ? { startMs: forecastDataset.waveTimeMs[0], endMs: forecastDataset.waveTimeMs.at(-1) }
    : getDefaultTidePreviewWindow();
  state.currentTideWindow = tideWindow;

  dom.runStatusPill.textContent = "Loading NOAA tides...";
  let tideSeries;
  try {
    tideSeries = await loadTideSeries(tideStation.id, tideWindow.startMs, tideWindow.endMs);
    state.selectedTideSeries = tideSeries;
  } catch (error) {
    console.error("[FASTER NOAA] Tide download failed.", {
      transect: state.selectedTransect.label,
      stationId: tideStation.id,
      stationName: tideStation.name,
      startMs: tideWindow.startMs,
      endMs: tideWindow.endMs,
      error,
    });
    dom.runStatusPill.textContent = "NOAA tide load failed";
    setGeometryHelper("NOAA tide download failed. Check the browser console for request details.");
    throw error;
  }

  if (!forecastDataset) {
    console.info("[FASTER NOAA] Tide-only preview mode active because no live or local wave forecast was available.", {
      transect: state.selectedTransect.label,
      stationId: tideStation.id,
      stationName: tideStation.name,
    });
    state.resultsDirty = false;
    dom.forecastEmptyState.classList.add("hidden");
    dom.forecastContent.classList.remove("hidden");
    dom.timelineControls.classList.add("hidden");
    dom.metricGrid.classList.add("hidden");
    dom.metricGrid.innerHTML = "";
    dom.runupEmptyState.classList.remove("hidden");
    dom.runupContent.classList.add("hidden");
    dom.runupProfile.innerHTML = "";
    dom.currentTimeLabel.textContent = "NOAA hourly preview";
    dom.sliderTimeLabel.textContent = "--";
    dom.sliderIndexLabel.textContent = "--";
    dom.timeSlider.min = "0";
    dom.timeSlider.max = "0";
    dom.timeSlider.value = "0";
    renderTideOnlyPreview(tideSeries, tideWindow);
    dom.dataAvailabilityPill.textContent = "NOAA tide only";
    dom.runStatusPill.textContent = "NOAA tide preview ready";
    setGeometryHelper("Nearest NOAA tide predictions loaded. Add local wave forecast data for full runup playback.");
    return;
  }

  dom.dataAvailabilityPill.textContent = forecastDataset.sourceKind === "live"
    ? "Live forecast loaded"
    : "Local fallback forecast";
  dom.runStatusPill.textContent = "Computing runup...";
  state.selectedForecast = forecastDataset;
  state.results = forecastDataset.waveTimeMs.map((timeMs, index) => {
    const tideLevel = findNearestTideLevel(tideSeries, timeMs) + params.tideSurgeLevel;
    return computeRunupAtTime({
      timeMs,
      index,
      waveHeightSwell: forecastDataset.waveHs[index],
      waveHeightTotal: forecastDataset.waveHs[index] + params.waveTotalOffset,
      peakWavePeriod: forecastDataset.waveTp[index],
      waveDirection: forecastDataset.waveDp[index],
      tideLevel,
      waterDepthPrediction: forecastDataset.metaWaterDepth,
      shorelineNormal: forecastDataset.metaShoreNormal ?? state.selectedTransect.shoreNormal,
      params,
    });
  });

  state.resultsDirty = false;
  dom.forecastEmptyState.classList.add("hidden");
  dom.forecastContent.classList.remove("hidden");
  dom.timelineControls.classList.remove("hidden");
  dom.metricGrid.classList.remove("hidden");
  dom.runupEmptyState.classList.add("hidden");
  dom.runupContent.classList.remove("hidden");
  dom.runStatusPill.textContent = "Forecast ready";

  dom.timeSlider.max = String(Math.max(state.results.length - 1, 0));
  state.currentIndex = Math.min(state.currentIndex, state.results.length - 1);
  dom.timeSlider.value = String(state.currentIndex);

  renderCharts(forecastDataset, tideSeries);
  updatePlaybackUI();
}

function handleParameterInput() {
  const params = sanitizeParams(readModelParamsFromInputs());
  state.modelParams = params;
  updateGeometryPreview();

  if (state.results) {
    state.resultsDirty = true;
    dom.runStatusPill.textContent = "Parameters changed";
  }
}

function applyModelParams(params) {
  state.modelParams = { ...params };
  dom.averageBeachSlopeInput.value = params.averageBeachSlope.toFixed(3);
  dom.beachElevationBaseInput.value = formatDisplayInputValue(params.beachElevationBase, 1);
  dom.bermWidthInput.value = formatDisplayInputValue(params.bermWidth, 1);
  dom.duneCrestElevationInput.value = formatDisplayInputValue(params.duneCrestElevation, 1);
  dom.toeToCrestDistanceInput.value = formatDisplayInputValue(params.toeToCrestDistance, 1);
  dom.tideSurgeLevelInput.value = formatDisplayInputValue(params.tideSurgeLevel, 2);
  dom.waveTotalOffsetInput.value = formatDisplayInputValue(params.waveTotalOffset, 2);
  profileModeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === params.profileMode));
  syncDisplayModeControls();
  updateUnitAwareLabels();
  updateGeometryPreview();
}

function readModelParamsFromInputs() {
  const activeMode = profileModeButtons.find((button) => button.classList.contains("active"))?.dataset.mode || "dune";
  return {
    profileMode: activeMode,
    averageBeachSlope: Number(dom.averageBeachSlopeInput.value),
    beachElevationBase: parseDisplayInputLength(dom.beachElevationBaseInput.value),
    bermWidth: parseDisplayInputLength(dom.bermWidthInput.value),
    duneCrestElevation: parseDisplayInputLength(dom.duneCrestElevationInput.value),
    toeToCrestDistance: parseDisplayInputLength(dom.toeToCrestDistanceInput.value),
    tideSurgeLevel: parseDisplayInputLength(dom.tideSurgeLevelInput.value),
    waveTotalOffset: parseDisplayInputLength(dom.waveTotalOffsetInput.value),
  };
}

function sanitizeParams(rawParams) {
  const averageBeachSlope = clampNumber(rawParams.averageBeachSlope, 0.005, 0.3, 0.05);
  const beachElevationBase = clampNumber(rawParams.beachElevationBase, -1, 12, 3.5);
  const bermWidth = clampNumber(rawParams.bermWidth, 0, 250, 0);
  const fallbackToeToCrestDistance = Number.isFinite(rawParams.duneWidth)
    ? Number(rawParams.duneWidth) / 2
    : 15;
  const toeToCrestDistance = clampNumber(rawParams.toeToCrestDistance, 0.25, 125, fallbackToeToCrestDistance);
  const duneWidth = toeToCrestDistance * 2;
  const minCrest = beachElevationBase + 0.1;
  const duneCrestElevation = clampNumber(rawParams.duneCrestElevation, minCrest, 20, minCrest);
  const tideSurgeLevel = clampNumber(rawParams.tideSurgeLevel, -2, 4, 0);
  const waveTotalOffset = clampNumber(rawParams.waveTotalOffset, 0, 4, 0.5);

  return {
    profileMode: rawParams.profileMode === "structure" ? "structure" : "dune",
    averageBeachSlope,
    beachElevationBase,
    bermWidth,
    duneCrestElevation,
    toeToCrestDistance,
    duneWidth,
    tideSurgeLevel,
    waveTotalOffset,
  };
}

function getDefaultsForTransect(label) {
  const demoDefaults = state.manifest.datasets[label]?.defaults;
  const defaults = { ...(demoDefaults || state.genericDefaults) };
  const duneWidth = Number(defaults.duneWidth);
  return {
    ...defaults,
    toeToCrestDistance: Number.isFinite(duneWidth) ? duneWidth / 2 : 15,
  };
}

function updateGeometryPreview() {
  if (!state.modelParams) {
    return;
  }
  const profile = buildBeachProfile(state.modelParams);
  const figureAspectRatio = getContainerAspectRatio(dom.geometryPreview, DEFAULT_FIGURE_RATIO);
  const svg = renderProfileSvg({
    profile,
    overlays: [
      {
        label: "Still Water Reference",
        value: 0,
        color: COLORS.waterEdge,
        dash: "",
        mode: "water",
      },
    ],
    yMin: -5,
    yMax: Math.max(state.modelParams.duneCrestElevation + 1.2, 4.5),
    title: "",
    figureAspectRatio,
    minFigureHeight: 160,
    footerLines: [],
  });
  dom.geometryPreview.innerHTML = svg;
}

function buildBeachProfile(params) {
  const minElevation = -5;
  const xLinearEnd = (params.beachElevationBase - minElevation) / params.averageBeachSlope;
  const xFlat = xLinearEnd + params.bermWidth;
  const xBermEnd = xFlat + params.duneWidth;
  const xCenter = xFlat + params.duneWidth / 2;
  const amplitude = params.duneCrestElevation - params.beachElevationBase;
  const sigma = params.duneWidth / 6;
  const xEnd = xBermEnd + params.duneWidth;

  const x1 = linspace(0, xLinearEnd, 110);
  const y1 = x1.map((x) => minElevation + params.averageBeachSlope * x);

  const x2 = linspace(xLinearEnd, xFlat, Math.max(12, Math.round(params.bermWidth * 2) || 12));
  const y2 = x2.map(() => params.beachElevationBase);

  let x3;
  let y3;
  let x4;
  let y4;

  if (params.profileMode === "structure") {
    x3 = linspace(xFlat, xCenter, 80);
    y3 = x3.map((x) => params.beachElevationBase + amplitude * Math.exp(-((x - xCenter) ** 2) / (2 * sigma ** 2)));
    x4 = linspace(xCenter, xEnd, 60);
    y4 = x4.map(() => params.beachElevationBase + amplitude);
  } else {
    x3 = linspace(xFlat, xBermEnd, 100);
    y3 = x3.map((x) => params.beachElevationBase + amplitude * Math.exp(-((x - xCenter) ** 2) / (2 * sigma ** 2)));
    x4 = linspace(xBermEnd, xEnd, 60);
    y4 = x4.map(() => params.beachElevationBase);
  }

  return {
    x: [...x1, ...x2, ...x3, ...x4],
    y: [...y1, ...y2, ...y3, ...y4],
    xEnd,
  };
}

function renderProfileSvg({
  profile,
  overlays,
  yMin,
  yMax,
  title,
  figureAspectRatio = DEFAULT_FIGURE_RATIO,
  minFigureHeight = 320,
  footerLines = [],
  preserveAspectRatio = "xMidYMid meet",
  showLegend = false,
}) {
  const width = 940;
  const height = Math.max(minFigureHeight, Math.round(width / Math.max(figureAspectRatio, 1)));
  const hasTitle = Boolean(title && title.trim());
  const hasFooterLines = footerLines.length > 0;
  const padding = {
    top: hasTitle ? 24 : 12,
    right: 20,
    bottom: hasFooterLines ? 64 : 40,
    left: 54,
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const displayProfile = {
    x: profile.x.map((value) => convertDistanceForDisplay(value)),
    y: profile.y.map((value) => convertElevationForDisplay(value)),
    xEnd: convertDistanceForDisplay(profile.xEnd),
  };
  const displayYMin = convertElevationForDisplay(yMin);
  const displayYMax = convertElevationForDisplay(yMax);

  const xScale = (value) => padding.left + (value / displayProfile.xEnd) * chartWidth;
  const yScale = (value) => padding.top + ((displayYMax - value) / (displayYMax - displayYMin)) * chartHeight;
  const gradientId = `water-gradient-${Math.random().toString(36).slice(2, 10)}`;

  const beachPath = displayProfile.x
    .map((xValue, index) => `${index === 0 ? "M" : "L"} ${xScale(xValue).toFixed(2)} ${yScale(displayProfile.y[index]).toFixed(2)}`)
    .join(" ");
  const filledBeachPath = `${beachPath} L ${xScale(displayProfile.x.at(-1)).toFixed(2)} ${yScale(displayYMin).toFixed(2)} L ${xScale(displayProfile.x[0]).toFixed(2)} ${yScale(displayYMin).toFixed(2)} Z`;

  const xWaterEnd = convertDistanceForDisplay(clamp((0 - yMin) / (state.modelParams.averageBeachSlope || 0.05), 0, profile.xEnd));
  const gridX = Array.from({ length: 5 }, (_, index) => (displayProfile.xEnd * index) / 4);
  const gridY = Array.from({ length: 6 }, (_, index) => displayYMin + ((displayYMax - displayYMin) * index) / 5);

  const overlayMarkup = overlays
    .map((overlay) => {
      const extent = computeOverlayExtent(profile, overlay.value, overlay.mode);
      const displayStart = convertDistanceForDisplay(extent.start);
      const displayEnd = convertDistanceForDisplay(extent.end);
      const displayValue = convertElevationForDisplay(overlay.value);
      return `<line x1="${xScale(displayStart).toFixed(2)}" y1="${yScale(displayValue).toFixed(2)}" x2="${xScale(displayEnd).toFixed(2)}" y2="${yScale(displayValue).toFixed(2)}" stroke="${overlay.color}" stroke-width="4" ${overlay.dash ? `stroke-dasharray="${overlay.dash}"` : ""} />`;
    })
    .join("");
  const footerMarkup = footerLines
    .slice(0, 2)
    .map((line, index) => {
      const x = index === 0 ? padding.left : width - padding.right;
      const anchor = index === 0 ? "start" : "end";
      return `<text x="${x}" y="${height - 26}" fill="#60748a" font-size="11" font-weight="700" text-anchor="${anchor}">${escapeHtml(line)}</text>`;
    })
    .join("");
  const legendItems = showLegend ? overlays.slice(0, 5) : [];
  const legendWidth = 176;
  const legendPadding = 12;
  const legendItemGap = 18;
  const legendHeight = legendItems.length ? legendPadding * 2 + legendItems.length * legendItemGap : 0;
  const legendX = padding.left + chartWidth - legendWidth - 8;
  const legendY = padding.top + chartHeight - legendHeight - 8;
  const legendMarkup = legendItems.length
    ? `
      <g transform="translate(${legendX}, ${legendY})">
        <rect x="0" y="0" width="${legendWidth}" height="${legendHeight}" rx="14" fill="rgba(255,255,255,0.9)" stroke="rgba(17,49,76,0.14)" />
        ${legendItems.map((overlay, index) => {
          const y = legendPadding + 14 + index * legendItemGap;
          return `
            <line x1="12" y1="${y - 4}" x2="42" y2="${y - 4}" stroke="${overlay.color}" stroke-width="3" ${overlay.dash ? `stroke-dasharray="${overlay.dash}"` : ""} />
            <text x="50" y="${y}" fill="#102338" font-size="11" font-weight="700">${escapeHtml(overlay.label)}</text>
          `;
        }).join("")}
      </g>
    `
    : "";

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="${preserveAspectRatio}" role="img" aria-label="${escapeHtml(title || "Profile preview")}">
      <defs>
        <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${COLORS.water}" stop-opacity="0.92" />
          <stop offset="100%" stop-color="#6fb9d2" stop-opacity="0.78" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
      ${gridX.map((value) => `<line x1="${xScale(value)}" y1="${padding.top}" x2="${xScale(value)}" y2="${padding.top + chartHeight}" stroke="rgba(17,49,76,0.08)" stroke-width="1" />`).join("")}
      ${gridY.map((value) => `<line x1="${padding.left}" y1="${yScale(value)}" x2="${padding.left + chartWidth}" y2="${yScale(value)}" stroke="rgba(17,49,76,0.08)" stroke-width="1" />`).join("")}
      <rect x="${xScale(0)}" y="${yScale(convertElevationForDisplay(0))}" width="${Math.max(xScale(xWaterEnd) - xScale(0), 0)}" height="${Math.max(yScale(displayYMin) - yScale(convertElevationForDisplay(0)), 0)}" fill="url(#${gradientId})" />
      <path d="${filledBeachPath}" fill="${COLORS.sand}" opacity="0.95" />
      <path d="${beachPath}" fill="none" stroke="${COLORS.sandEdge}" stroke-width="3" />
      ${overlayMarkup}
      ${legendMarkup}
      ${hasTitle ? `<text x="${padding.left}" y="16" fill="#102338" font-size="16" font-weight="800">${escapeHtml(title)}</text>` : ""}
      ${footerMarkup}
      <text x="${width / 2}" y="${height - 10}" fill="#60748a" font-size="12" text-anchor="middle">${escapeHtml(getDistanceAxisLabel())}</text>
      <text x="18" y="${height / 2}" fill="#60748a" font-size="12" text-anchor="middle" transform="rotate(-90, 18, ${height / 2})">${escapeHtml(getElevationAxisLabel())}</text>
      ${gridY.map((value) => `<text x="${padding.left - 10}" y="${yScale(value) + 4}" fill="#60748a" font-size="12" text-anchor="end">${value.toFixed(1)}</text>`).join("")}
    </svg>
  `;
}

function computeOverlayExtent(profile, elevation, mode = "runup") {
  if (mode === "water") {
    const waterEnd = clamp((elevation - (-5)) / (state.modelParams.averageBeachSlope || 0.05), 0, profile.xEnd);
    return { start: 0, end: waterEnd };
  }

  if (mode === "crest") {
    const firstBlockingIndex = profile.y.findIndex((value) => value >= elevation);
    const endIndex = firstBlockingIndex >= 0 ? firstBlockingIndex : profile.x.length - 1;
    return {
      start: 0,
      end: profile.x[endIndex],
    };
  }

  const shorelineIndex = profile.y.findIndex((value) => value >= 0);
  const startIndex = shorelineIndex >= 0 ? shorelineIndex : 0;
  const firstBlockingIndex = profile.y.findIndex((value, index) => index > startIndex && value >= elevation);
  const endIndex = firstBlockingIndex >= 0 ? firstBlockingIndex : profile.x.length - 1;
  return {
    start: profile.x[startIndex],
    end: profile.x[endIndex],
  };
}

async function loadForecastDataset(label) {
  if (state.datasetCache.has(label)) {
    return state.datasetCache.get(label);
  }

  try {
    const liveDataset = await fetchLiveForecastDataset(label);
    state.datasetCache.set(label, liveDataset);
    return liveDataset;
  } catch (error) {
    console.warn("[FASTER MOP] Live forecast fetch failed.", {
      transect: label,
      error,
    });
  }

  const datasetMeta = state.manifest.datasets[label];
  if (!datasetMeta?.forecastFile) {
    return null;
  }

  const raw = await fetchJSON(`./data/forecasts/${datasetMeta.forecastFile}`);
  const forecastDataset = normalizeForecastDataset(raw, {
    sourceKind: "bundled",
    sourceLabel: datasetMeta.displayName || label,
  });
  console.info("[FASTER MOP] Using bundled forecast fallback.", {
    transect: label,
    forecastFile: datasetMeta.forecastFile,
  });
  state.datasetCache.set(label, forecastDataset);
  return forecastDataset;
}

async function fetchLiveForecastDataset(label) {
  let directError = null;
  try {
    return await fetchThreddsAsciiForecastDataset(label);
  } catch (error) {
    directError = error;
    console.warn("[FASTER MOP] Direct CDIP THREDDS forecast fetch failed.", {
      transect: label,
      error,
    });
  }

  try {
    return await fetchProxyForecastDataset(label);
  } catch (proxyError) {
    if (directError) {
      proxyError.message = `${proxyError.message} Browser THREDDS fetch also failed: ${directError.message}`;
    }
    throw proxyError;
  }
}

async function fetchThreddsAsciiForecastDataset(label) {
  const requestUrl = buildThreddsAsciiForecastUrl(label);
  console.info("[FASTER MOP] Requesting live forecast directly from CDIP THREDDS.", {
    transect: label,
    requestUrl,
  });

  const response = await fetch(requestUrl);
  const bodyText = await response.text();
  if (!response.ok) {
    const detail = extractThreddsErrorDetail(bodyText);
    throw new Error(`Direct CDIP THREDDS request failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const forecastDataset = parseDap2AsciiForecast(bodyText, {
    label,
    requestUrl,
  });
  console.info("[FASTER MOP] Direct CDIP THREDDS forecast loaded.", {
    transect: label,
    points: forecastDataset.waveTimeMs.length,
    sourceUrl: requestUrl,
  });
  return forecastDataset;
}

async function fetchProxyForecastDataset(label) {
  const requestUrl = `${LIVE_MOP_API_PATH}?transect=${encodeURIComponent(label)}`;
  console.info("[FASTER MOP] Requesting live forecast from optional local proxy fallback.", {
    transect: label,
    requestUrl,
  });

  const response = await fetch(requestUrl);
  if (!response.ok) {
    let detail = "";
    try {
      const errorPayload = await response.json();
      detail = errorPayload.error || "";
    } catch (error) {
      detail = "";
    }
    if (response.status === 404) {
      throw new Error(
        `Optional local proxy route not found at ${requestUrl}. ` +
        `The browser will normally use direct CDIP THREDDS access first, so this only matters if you intentionally want the proxy fallback. ` +
        `To enable it from the web root, run: python scripts\\serve_faster_web.py --port 8000.${detail ? ` Detail: ${detail}` : ""}`
      );
    }
    throw new Error(`Live MOP request failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const payload = await response.json();
  const forecastDataset = normalizeForecastDataset(payload, {
    sourceKind: payload.sourceKind || "live",
    sourceLabel: payload.label || label,
  });
  console.info("[FASTER MOP] Live forecast loaded.", {
    transect: label,
    points: forecastDataset.waveTimeMs.length,
    sourceUrl: payload.sourceUrl || null,
    cacheHit: Boolean(payload.cacheHit),
  });
  return forecastDataset;
}

function buildThreddsAsciiForecastUrl(label) {
  return `${CDIP_DAP2_ASCII_BASE_URL}/${encodeURIComponent(label)}_forecast.nc.ascii?${CDIP_DAP2_ASCII_QUERY}`;
}

function extractThreddsErrorDetail(bodyText) {
  if (!bodyText) {
    return "";
  }

  const quotedMessageMatch = bodyText.match(/message\s*=\s*"([^"]+)"/i);
  if (quotedMessageMatch) {
    return quotedMessageMatch[1];
  }

  const compact = bodyText.replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 220) : "";
}

function parseDap2AsciiForecast(bodyText, metadata) {
  const waveTimeSeconds = parseDap2AsciiArray(bodyText, "waveTime");
  const waveHs = parseDap2AsciiArray(bodyText, "waveHs");
  const waveTp = parseDap2AsciiArray(bodyText, "waveTp");
  const waveDp = parseDap2AsciiArray(bodyText, "waveDp");
  const metaWaterDepth = parseDap2AsciiScalar(bodyText, "metaWaterDepth");
  const metaShoreNormal = parseDap2AsciiScalar(bodyText, "metaShoreNormal");

  const pointCount = waveTimeSeconds.length;
  if (!pointCount) {
    throw new Error("CDIP THREDDS response did not include any forecast time steps.");
  }

  const expectedArrayLengths = [waveHs.length, waveTp.length, waveDp.length];
  if (expectedArrayLengths.some((length) => length !== pointCount)) {
    throw new Error(
      `CDIP THREDDS response returned mismatched array lengths ` +
      `(waveTime=${pointCount}, waveHs=${waveHs.length}, waveTp=${waveTp.length}, waveDp=${waveDp.length}).`
    );
  }

  return normalizeForecastDataset(
    {
      label: metadata.label,
      sourceKind: "live",
      sourceUrl: metadata.requestUrl,
      fetchedAt: new Date().toISOString(),
      waveTime: waveTimeSeconds.map((epochSeconds) => new Date(epochSeconds * 1000).toISOString()),
      waveHs,
      waveTp,
      waveDp,
      metaWaterDepth,
      metaShoreNormal,
    },
    {
      sourceKind: "live",
      sourceLabel: metadata.label,
    }
  );
}

function parseDap2AsciiArray(bodyText, variableName) {
  const pattern = new RegExp(
    `(?:^|\\n)${escapeRegex(variableName)}\\[[^\\]]+\\]\\s*([\\s\\S]*?)(?=\\n[A-Za-z][\\w]*\\[[^\\]]+\\]\\s*|\\n[A-Za-z][\\w]*\\s*,|$)`,
    "m"
  );
  const match = bodyText.match(pattern);
  if (!match) {
    throw new Error(`CDIP THREDDS response did not include array data for ${variableName}.`);
  }

  const values = match[1]
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => Number(token));

  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`CDIP THREDDS response included non-numeric values for ${variableName}.`);
  }

  return values;
}

function parseDap2AsciiScalar(bodyText, variableName) {
  const pattern = new RegExp(`(?:^|\\n)${escapeRegex(variableName)}\\s*,\\s*([^\\r\\n]+)`, "m");
  const match = bodyText.match(pattern);
  if (!match) {
    throw new Error(`CDIP THREDDS response did not include scalar data for ${variableName}.`);
  }

  const value = Number(match[1].trim());
  if (!Number.isFinite(value)) {
    throw new Error(`CDIP THREDDS response included an invalid scalar for ${variableName}.`);
  }

  return value;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForecastDataset(raw, metadata = {}) {
  return {
    ...raw,
    ...metadata,
    waveTimeMs: raw.waveTime.map((value) => Date.parse(value.endsWith("Z") ? value : `${value}Z`)),
  };
}

async function loadTideSeries(stationId, startMs, endMs) {
  const cacheKey = `${stationId}:${startMs}:${endMs}`;
  if (state.tideCache.has(cacheKey)) {
    console.info("[FASTER NOAA] Using cached hourly tide predictions.", {
      stationId,
      start: formatNoaaDate(startMs),
      end: formatNoaaDate(endMs),
    });
    return state.tideCache.get(cacheKey);
  }

  const params = new URLSearchParams({
    begin_date: formatNoaaDate(startMs),
    end_date: formatNoaaDate(endMs),
    station: stationId,
    product: "predictions",
    datum: "MLLW",
    interval: "h",
    units: "metric",
    time_zone: "gmt",
    format: "json",
    application: NOAA_APPLICATION_ID,
  });

  const requestUrl = `${NOAA_PREDICTIONS_URL}?${params.toString()}`;
  console.info("[FASTER NOAA] Requesting hourly tide predictions.", {
    stationId,
    start: formatNoaaDate(startMs),
    end: formatNoaaDate(endMs),
    requestUrl,
  });

  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`NOAA tide request failed with ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.predictions) {
    throw new Error(payload.error?.message || "NOAA tide payload did not include predictions.");
  }

  const tideSeries = {
    stationId,
    timeMs: payload.predictions.map((row) => Date.parse(`${row.t}Z`)),
    level: payload.predictions.map((row) => Number(row.v)),
  };
  console.info("[FASTER NOAA] Loaded hourly tide predictions.", {
    stationId,
    points: tideSeries.timeMs.length,
    first: payload.predictions[0]?.t || null,
    last: payload.predictions.at(-1)?.t || null,
  });
  state.tideCache.set(cacheKey, tideSeries);
  return tideSeries;
}

function findNearestTideLevel(tideSeries, targetMs) {
  if (!tideSeries.timeMs.length) {
    return 0;
  }

  let bestIndex = 0;
  let bestDelta = Math.abs(tideSeries.timeMs[0] - targetMs);
  for (let index = 1; index < tideSeries.timeMs.length; index += 1) {
    const delta = Math.abs(tideSeries.timeMs[index] - targetMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }
  return tideSeries.level[bestIndex];
}

function computeRunupAtTime(input) {
  const g = 9.81;
  const slope = input.params.averageBeachSlope;
  const peakPeriod = Math.max(input.peakWavePeriod, 0.1);
  const depth = Math.max(input.waterDepthPrediction, 0.1);
  const Ls = (g * peakPeriod ** 2) / (2 * Math.PI) * Math.sqrt(Math.tanh((4 * Math.PI ** 2 * depth) / (peakPeriod ** 2 * g)));
  const Lo = (g * peakPeriod ** 2) / (2 * Math.PI);
  const k = (2 * Math.PI) / Ls;
  const kd = k * depth;
  const nS = 0.5 * (1 + (2 * kd) / Math.sinh(2 * kd));

  // The original Python forecast/hindcast/structure scripts all hard-code
  // mean_wave_direction = 0.0 before entering runup_calcs, so the baseline
  // model behavior is effectively non-directional.
  const shallowRelativeAngleDeg = 0;
  const angSRad = 0;
  const angDRad = Math.asin(clamp((Lo / Ls) * Math.sin(angSRad), -1, 1));

  const Ks = Math.sqrt(Math.max((nS * Ls) / (0.5 * Lo), 0));
  const Kr = Math.sqrt(Math.max(Math.cos(angSRad), 0.01));
  const Ho = Ks * Kr * input.waveHeightSwell;
  const safeHo = Math.max(Ho, 0.05);
  const safeLo = Math.max(Lo, 0.05);

  const aCoefficient = 43.75 * (1 - Math.exp(-19 * slope));
  const bCoefficient = 1.56 / (1 + Math.exp(-19.5 * slope));

  const breakingSummary = solveBreakingDepth({
    Ho,
    Lo,
    peakPeriod,
    waveHeightSwell: input.waveHeightSwell,
    angDRad,
    aCoefficient,
    bCoefficient,
  });

  const maxCrest = input.tideLevel + breakingSummary.breakingWaveHeight * 1.3 * 0.55;

  const setupStockdon = 1.1 * 0.35 * slope * Math.sqrt(Lo * Ho);
  const waveRunupStockdon = 1.1 * 0.5 * Math.sqrt(Ho * Lo * (0.563 * slope ** 2 + 0.0004));
  const stockdonTotal = input.tideLevel + setupStockdon + waveRunupStockdon;

  const bermCoefficientMean = 0.8 - 0.4 * Math.tanh((2 * input.params.bermWidth) / Lo);
  const bermCoefficientSigma = 1 - 0.5 * Math.tanh((2 * input.params.bermWidth) / Lo);
  const betaF = Math.atan(slope);
  const betaD = Math.atan((input.params.duneCrestElevation - input.params.beachElevationBase) / (0.5 * input.params.duneWidth));
  const alpha = clamp(((input.tideLevel - input.params.beachElevationBase) + 0.7 * safeHo) / (1.4 * safeHo), 0, 1);
  const betaT = (1 - alpha) * betaF + alpha * betaD;
  const shapeRatio = (input.tideLevel - input.params.beachElevationBase) / safeHo;
  const betaUsed = shapeRatio < -0.7 ? betaF : shapeRatio > 0.7 ? betaD : betaT;
  const iribarren = Math.tan(betaUsed) / Math.sqrt(safeHo / safeLo);

  const parkTotalMean = input.tideLevel + 1.35 * bermCoefficientMean * safeHo * iribarren ** 0.65;
  const parkTotalSigma = input.tideLevel + 1.35 * bermCoefficientSigma * safeHo * iribarren ** 0.65;

  const setupModified = 1.1 * bermCoefficientMean * 0.35 * Math.tan(betaUsed) * Math.sqrt(safeLo * safeHo);
  const waveRunupModified = 1.1 * 0.5 * bermCoefficientMean * Math.sqrt(safeHo * safeLo * (0.563 * Math.tanh(betaUsed) ** 2 + 0.0004));
  const modifiedTotal = input.tideLevel + setupModified + waveRunupModified;

  const setupModifiedSigma = 1.1 * bermCoefficientSigma * 0.35 * Math.tan(betaUsed) * Math.sqrt(safeLo * safeHo);
  const waveRunupModifiedSigma = 1.1 * 0.5 * bermCoefficientSigma * Math.sqrt(safeHo * safeLo * (0.563 * Math.tanh(betaUsed) ** 2 + 0.0004));
  const modifiedTotalSigma = input.tideLevel + setupModifiedSigma + waveRunupModifiedSigma;

  const meanRunup = mean([stockdonTotal, parkTotalMean, modifiedTotal]);
  const runupPredictions = [stockdonTotal, parkTotalMean, parkTotalSigma, modifiedTotal, modifiedTotalSigma];
  const stdDevRunup = sampleStandardDeviation(runupPredictions);
  const waveHeightVariability = Math.max((input.waveHeightTotal - input.waveHeightSwell) / 2, 0);
  const expectedRunup = meanRunup;
  const conservativeRunup = meanRunup + stdDevRunup;
  const upperBoundRunup = meanRunup + stdDevRunup + waveHeightVariability;
  const category = classifyOvertopping({
    expectedRunup,
    conservativeRunup,
    upperBoundRunup,
    duneCrestElevation: input.params.duneCrestElevation,
  });

  return {
    timeMs: input.timeMs,
    tideLevel: input.tideLevel,
    waveHeightSwell: input.waveHeightSwell,
    waveHeightTotal: input.waveHeightTotal,
    peakWavePeriod: input.peakWavePeriod,
    waveDirection: input.waveDirection,
    relativeAngleDeg: shallowRelativeAngleDeg,
    deepWaterWaveHeight: Ho,
    maxCrest,
    breakingDepth: breakingSummary.breakingDepth,
    breakingWaveHeight: breakingSummary.breakingWaveHeight,
    expectedRunup,
    conservativeRunup,
    upperBoundRunup,
    stdDevRunup,
    waveHeightVariability,
    category,
  };
}

function solveBreakingDepth({ Ho, Lo, peakPeriod, waveHeightSwell, angDRad, aCoefficient, bCoefficient }) {
  const evaluate = (depth) => {
    const g = 9.81;
    const LBreak = (g * peakPeriod ** 2) / (2 * Math.PI) * Math.sqrt(Math.abs(Math.tanh((4 * Math.PI ** 2 * depth) / (peakPeriod ** 2 * g))));
    const ksBreak = Math.sqrt(Lo / LBreak);
    const angBreak = Math.asin(clamp((Lo / LBreak) * Math.sin(angDRad), -1, 1));
    const krBreak = Math.sqrt(Math.max(Math.cos(angDRad), 0.01) / Math.max(Math.cos(angBreak), 0.01));
    const hb = Ho * krBreak * ksBreak;
    return {
      residual: hb / (bCoefficient - (aCoefficient * hb) / (peakPeriod ** 2)) - depth,
      breakingWaveHeight: hb,
    };
  };

  const minDepth = Math.max(0.3, 0.25 * waveHeightSwell);
  const maxDepth = Math.max(24, 4 * waveHeightSwell, 2 * Ho);
  const samples = 64;
  let lower = null;
  let upper = null;
  let previousDepth = minDepth;
  let previousValue = evaluate(previousDepth).residual;

  for (let index = 1; index <= samples; index += 1) {
    const trialDepth = minDepth + ((maxDepth - minDepth) * index) / samples;
    const trialValue = evaluate(trialDepth).residual;
    if (Math.sign(previousValue) !== Math.sign(trialValue)) {
      lower = previousDepth;
      upper = trialDepth;
      break;
    }
    previousDepth = trialDepth;
    previousValue = trialValue;
  }

  if (lower === null || upper === null) {
    return {
      breakingDepth: waveHeightSwell,
      breakingWaveHeight: waveHeightSwell,
    };
  }

  let left = lower;
  let right = upper;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const mid = 0.5 * (left + right);
    const leftResidual = evaluate(left).residual;
    const midResidual = evaluate(mid).residual;
    if (Math.sign(leftResidual) === Math.sign(midResidual)) {
      left = mid;
    } else {
      right = mid;
    }
  }

  const breakingDepth = 0.5 * (left + right);
  const summary = evaluate(breakingDepth);
  return {
    breakingDepth,
    breakingWaveHeight: summary.breakingWaveHeight,
  };
}

function getDefaultTidePreviewWindow() {
  const start = new Date();
  start.setUTCMinutes(0, 0, 0);
  const startMs = start.getTime();
  const endMs = startMs + DEFAULT_TIDE_PREVIEW_HOURS * 60 * 60 * 1000;
  return { startMs, endMs };
}

function destroyForecastCharts() {
  if (state.waveChart) {
    state.waveChart.destroy();
    state.waveChart = null;
  }
  if (state.tideChart) {
    state.tideChart.destroy();
    state.tideChart = null;
  }
}

function renderTideOnlyPreview(tideSeries, tideWindow) {
  const tidePoints = tideSeries.timeMs.map((timeMs, index) => ({ x: timeMs, y: convertElevationForDisplay(tideSeries.level[index]) }));
  const timeMin = tideWindow.startMs;
  const timeMax = tideWindow.endMs;

  dom.waveChartTitle.textContent = `MOP Wave Forecast - Transect ${state.selectedTransect.label}`;
  dom.tideChartTitle.textContent = formatTideChartTitle(state.selectedTideStation || { id: tideSeries.stationId });

  destroyForecastCharts();

  state.waveChart = new Chart(dom.waveCanvas, {
    type: "line",
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 0, right: 4, bottom: 0, left: 2 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        emptyStateMessage: {
          message: "No live MOP forecast was available for this transect.",
        },
      },
      scales: {
        x: {
          type: "time",
          min: timeMin,
          max: timeMax,
          time: { unit: "day" },
          ticks: { callback: (value) => formatAxisDate(Number(value)) },
          grid: { color: "rgba(17,49,76,0.08)" },
        },
        y: {
          min: 0,
          max: 1,
          display: false,
          grid: { display: false },
          border: { display: false },
        },
      },
    },
  });

  state.tideChart = new Chart(dom.tideCanvas, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Tide Level",
          data: tidePoints,
          borderColor: COLORS.green,
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 0, right: 4, bottom: 0, left: 2 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: tooltipTimeTitle } },
      },
      scales: {
        x: {
          type: "time",
          min: timeMin,
          max: timeMax,
          time: { unit: "day" },
          ticks: { callback: (value) => formatAxisDate(Number(value)) },
          grid: { color: "rgba(17,49,76,0.08)" },
        },
        y: {
          title: {
            display: true,
            text: ["Tide Level", state.displayUnits === "english" ? "(ft, MLLW)" : "(m, MLLW)"],
            color: COLORS.green,
          },
          ticks: { color: COLORS.green },
          border: { color: COLORS.green },
          grid: { color: "rgba(17,49,76,0.08)" },
          afterFit(axis) {
            axis.width = FIXED_AXIS_WIDTH;
          },
        },
        ySpacer: {
          position: "right",
          min: 0,
          max: 1,
          ticks: { display: false },
          border: { display: false },
          title: { display: true, text: [" ", " "] },
          grid: {
            drawOnChartArea: false,
            display: false,
          },
          afterFit(axis) {
            axis.width = FIXED_AXIS_WIDTH;
          },
        },
      },
    },
  });

  dom.forecastWindowLabel.textContent = `${formatShortDateTime(timeMin)} to ${formatShortDateTime(timeMax)} ${getTimeModeLabel()}`;
}

function renderCharts(forecastDataset, tideSeries) {
  const wavePoints = forecastDataset.waveTimeMs.map((timeMs, index) => ({ x: timeMs, y: convertElevationForDisplay(forecastDataset.waveHs[index]) }));
  const periodPoints = forecastDataset.waveTimeMs.map((timeMs, index) => ({ x: timeMs, y: forecastDataset.waveTp[index] }));
  const tidePoints = tideSeries.timeMs.map((timeMs, index) => ({ x: timeMs, y: convertElevationForDisplay(tideSeries.level[index]) }));
  const timeMin = forecastDataset.waveTimeMs[0];
  const timeMax = forecastDataset.waveTimeMs.at(-1);

  dom.waveChartTitle.textContent = `MOP Wave Forecast - Transect ${state.selectedTransect.label}`;
  dom.tideChartTitle.textContent = formatTideChartTitle(state.selectedTideStation || { id: tideSeries.stationId });

  destroyForecastCharts();

  state.waveChart = new Chart(dom.waveCanvas, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Wave Height (Hs)",
          data: wavePoints,
          borderColor: COLORS.blue,
          backgroundColor: "rgba(37,99,235,0.12)",
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.25,
          yAxisID: "yWave",
        },
        {
          label: "Peak Wave Period (Tp)",
          data: periodPoints,
          borderColor: COLORS.red,
          borderDash: [6, 5],
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.15,
          yAxisID: "yPeriod",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 0, right: 4, bottom: 0, left: 2 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: tooltipTimeTitle } },
        currentTimeLine: { value: state.results?.[state.currentIndex]?.timeMs, color: COLORS.aqua },
      },
      scales: {
        x: {
          type: "time",
          min: timeMin,
          max: timeMax,
          time: { unit: "day" },
          ticks: { callback: (value) => formatAxisDate(Number(value)) },
          grid: { color: "rgba(17,49,76,0.08)" },
        },
        yWave: {
          position: "left",
          title: {
            display: true,
            text: ["Wave Height", state.displayUnits === "english" ? "(ft)" : "(m)"],
            color: COLORS.blue,
          },
          ticks: { color: COLORS.blue },
          border: { color: COLORS.blue },
          grid: { color: "rgba(17,49,76,0.08)" },
          afterFit(axis) {
            axis.width = FIXED_AXIS_WIDTH;
          },
        },
        yPeriod: {
          position: "right",
          title: { display: true, text: ["Peak Period", "(s)"], color: COLORS.red },
          ticks: { color: COLORS.red },
          border: { color: COLORS.red },
          grid: { drawOnChartArea: false },
          afterFit(axis) {
            axis.width = FIXED_AXIS_WIDTH;
          },
        },
      },
    },
  });

  state.tideChart = new Chart(dom.tideCanvas, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Tide Level",
          data: tidePoints,
          borderColor: COLORS.green,
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 0, right: 4, bottom: 0, left: 2 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: tooltipTimeTitle } },
        currentTimeLine: { value: state.results?.[state.currentIndex]?.timeMs, color: COLORS.aqua },
      },
      scales: {
        x: {
          type: "time",
          min: timeMin,
          max: timeMax,
          time: { unit: "day" },
          ticks: { callback: (value) => formatAxisDate(Number(value)) },
          grid: { color: "rgba(17,49,76,0.08)" },
        },
        y: {
          title: {
            display: true,
            text: ["Tide Level", state.displayUnits === "english" ? "(ft, MLLW)" : "(m, MLLW)"],
            color: COLORS.green,
          },
          ticks: { color: COLORS.green },
          border: { color: COLORS.green },
          grid: { color: "rgba(17,49,76,0.08)" },
          afterFit(axis) {
            axis.width = FIXED_AXIS_WIDTH;
          },
        },
        ySpacer: {
          position: "right",
          min: 0,
          max: 1,
          ticks: { display: false },
          border: { display: false },
          title: { display: true, text: [" ", " "] },
          grid: {
            drawOnChartArea: false,
            display: false,
          },
          afterFit(axis) {
            axis.width = FIXED_AXIS_WIDTH;
          },
        },
      },
    },
  });

  dom.forecastWindowLabel.textContent = `${formatShortDateTime(forecastDataset.waveTimeMs[0])} to ${formatShortDateTime(forecastDataset.waveTimeMs.at(-1))} ${getTimeModeLabel()}`;
}

function updatePlaybackUI() {
  if (!state.results || !state.selectedForecast) {
    return;
  }

  const current = state.results[state.currentIndex];
  dom.timeSlider.value = String(state.currentIndex);
  dom.sliderTimeLabel.textContent = formatShortDateTime(current.timeMs);
  dom.sliderIndexLabel.textContent = `${state.currentIndex + 1} / ${state.results.length}`;
  dom.currentTimeLabel.textContent = `${formatShortDateTime(current.timeMs)} ${getTimeModeLabel()}`;

  dom.metricGrid.innerHTML = [
    makeMetricCard("Wave Hs", formatDisplayLength(current.waveHeightSwell, 2)),
    makeMetricCard("Peak Period", `${current.peakWavePeriod.toFixed(1)} s`),
    makeMetricCard("Tide + Anomaly", formatDisplayLength(current.tideLevel, 2)),
    makeMetricCard("Max Crest", formatDisplayLength(current.maxCrest, 2)),
    makeMetricCard("Expected 2%", formatDisplayLength(current.expectedRunup, 2)),
    makeMetricCard("Conservative", formatDisplayLength(current.conservativeRunup, 2)),
    makeMetricCard("Upper Bound", formatDisplayLength(current.upperBoundRunup, 2)),
  ].join("");

  const profile = buildBeachProfile(state.modelParams);
  const figureAspectRatio = getContainerAspectRatio(dom.runupProfile, DEFAULT_FIGURE_RATIO);
  dom.runupProfile.innerHTML = renderProfileSvg({
    profile,
    overlays: [
      { label: "Still Water", value: current.tideLevel, color: COLORS.waterEdge, dash: "", mode: "water" },
      { label: "Max Crest", value: current.maxCrest, color: COLORS.black, dash: "10 6", mode: "crest" },
      { label: "Expected Runup", value: current.expectedRunup, color: COLORS.green, dash: "12 8", mode: "runup" },
      { label: "Conservative Runup", value: current.conservativeRunup, color: COLORS.yellow, dash: "12 8", mode: "runup" },
      { label: "Upper Bound Runup", value: current.upperBoundRunup, color: COLORS.coral, dash: "12 8", mode: "runup" },
    ],
    yMin: -5,
    yMax: Math.max(state.modelParams.duneCrestElevation + 1.2, current.upperBoundRunup + 1.2, current.maxCrest + 1.2),
    title: `Runup profile at ${formatShortDateTime(current.timeMs)} ${getTimeModeLabel()}`,
    figureAspectRatio,
    footerLines: [],
    showLegend: true,
  });

  dom.categoryPill.textContent = current.category.label;
  dom.categoryPill.style.background = current.category.background;
  dom.categoryPill.style.color = current.category.color;
  dom.playPauseButton.textContent = state.isPlaying ? "Pause" : "Play";

  if (state.waveChart && state.tideChart) {
    state.waveChart.options.plugins.currentTimeLine.value = current.timeMs;
    state.tideChart.options.plugins.currentTimeLine.value = current.timeMs;
    state.waveChart.update("none");
    state.tideChart.update("none");
  }
}

function getContainerAspectRatio(element, fallbackRatio = DEFAULT_FIGURE_RATIO) {
  if (!element) {
    return fallbackRatio;
  }
  const width = element.clientWidth;
  const height = element.clientHeight;
  if (!width || !height) {
    return fallbackRatio;
  }
  return width / height;
}

function togglePlayback() {
  if (state.isPlaying) {
    stopPlayback();
    updatePlaybackUI();
    return;
  }

  state.isPlaying = true;
  dom.playPauseButton.textContent = "Pause";
  state.playTimer = window.setInterval(() => {
    if (!state.results) {
      stopPlayback();
      return;
    }
    if (state.currentIndex >= state.results.length - 1) {
      stopPlayback();
      updatePlaybackUI();
      return;
    }
    state.currentIndex += 1;
    updatePlaybackUI();
  }, 850);
}

function stopPlayback() {
  state.isPlaying = false;
  if (state.playTimer) {
    window.clearInterval(state.playTimer);
    state.playTimer = null;
  }
  dom.playPauseButton.textContent = "Play";
}

function syncVisibleTransects() {
  if (!state.map || !state.transects.length) {
    return;
  }

  const zoom = state.map.getZoom();
  const bounds = state.map.getBounds().pad(0.35);
  state.hoveredTransectLabel = null;
  state.transectLayerGroup.clearLayers();
  state.visibleLayerMap.clear();

  if (zoom < TRANSECT_ZOOM_THRESHOLD) {
    dom.mapOverlayCard.classList.remove("hidden");
    return;
  }

  dom.mapOverlayCard.classList.add("hidden");
  const center = state.map.getCenter();

  let visibleTransects = state.transects.filter((transect) => (
    bounds.contains([transect.backbeachLat, transect.backbeachLon]) ||
    bounds.contains([transect.predictionLat, transect.predictionLon])
  ));

  if (visibleTransects.length > MAX_RENDERED_TRANSECTS) {
    visibleTransects = visibleTransects
      .sort((left, right) => distanceToCenter(left, center) - distanceToCenter(right, center))
      .slice(0, MAX_RENDERED_TRANSECTS);
  }

  const selectedLabel = state.selectedTransect?.label;
  if (selectedLabel && !visibleTransects.some((transect) => transect.label === selectedLabel)) {
    visibleTransects.unshift(state.selectedTransect);
  }

  visibleTransects.forEach((transect) => {
    const isSelected = transect.label === selectedLabel;
    const coordinates = [
      [transect.backbeachLat, transect.backbeachLon],
      [transect.predictionLat, transect.predictionLon],
    ];
    const displayLayer = L.polyline(
      coordinates,
      {
        renderer: state.canvasRenderer,
        interactive: false,
        ...getTransectDisplayStyle({ isSelected, isHovered: false }),
      }
    );
    const hitLayer = L.polyline(
      coordinates,
      {
        renderer: state.canvasRenderer,
        bubblingMouseEvents: false,
        ...getTransectHitStyle(displayLayer.options.weight),
      }
    );

    hitLayer.on("mouseover", () => {
      setHoveredTransect(transect.label);
    });
    hitLayer.on("mouseout", () => {
      if (state.hoveredTransectLabel === transect.label) {
        setHoveredTransect(null);
      }
    });
    hitLayer.on("click", () => {
      selectTransect(transect, { flyTo: false }).catch((error) => console.error(error));
    });
    hitLayer.bindTooltip(transect.label, {
      sticky: true,
      direction: "top",
      className: "transect-tooltip",
      opacity: 1,
    });

    state.transectLayerGroup.addLayer(displayLayer);
    state.transectLayerGroup.addLayer(hitLayer);
    state.visibleLayerMap.set(transect.label, { displayLayer, hitLayer });

    if (isSelected) {
      displayLayer.bringToFront();
      hitLayer.bringToFront();
    }
  });

}

async function fetchCaliforniaTideStations() {
  try {
    const csvText = await fetchText(NOAA_STATIONS_CSV_URL);
    const stations = parseCaliforniaTideStations(csvText);
    if (stations.length) {
      console.info("[FASTER NOAA] Loaded California tide stations from local CSV.", {
        count: stations.length,
      });
      return stations;
    }
  } catch (error) {
    console.warn("Falling back to NOAA metadata API for tide stations.", error);
  }

  const payload = await fetchJSON(NOAA_STATIONS_URL);
  return payload.stations
    .filter((station) => station.state === "CA")
    .map((station) => normalizeTideStation({
      id: station.id,
      name: station.name,
      lat: station.lat,
      lng: station.lng,
    }))
    .filter(Boolean);
}

async function resolveTideStation(transect) {
  const stations = await state.tideStationsPromise;
  if (!stations.length) {
    throw new Error("No NOAA tide stations were available.");
  }
  const station = findNearestStation(transect, stations);
  console.info("[FASTER NOAA] Resolved nearest tide station.", {
    transect: transect.label,
    stationId: station.id,
    stationName: station.name,
  });
  return station;
}

function findNearestStation(transect, stations) {
  let bestStation = stations[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  stations.forEach((station) => {
    const distance = haversineKm(transect.predictionLat, transect.predictionLon, station.lat, station.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestStation = station;
    }
  });

  return bestStation;
}

function getTransectDisplayStyle({ isSelected, isHovered }) {
  if (isSelected) {
    return {
      color: COLORS.blue,
      weight: isHovered ? 5.4 : 4.5,
      opacity: 0.98,
    };
  }

  return {
    color: isHovered ? "#71ddcf" : COLORS.aqua,
    weight: isHovered ? 3.4 : 2.1,
    opacity: isHovered ? 0.92 : 0.68,
  };
}

function getTransectHitStyle(displayWeight) {
  return {
    color: "#ffffff",
    opacity: 0.001,
    weight: Math.max(displayWeight * TRANSECT_HIT_WEIGHT_MULTIPLIER, MIN_TRANSECT_HIT_WEIGHT),
    lineCap: "round",
    lineJoin: "round",
  };
}

function setHoveredTransect(label) {
  const nextLabel = label || null;
  if (state.hoveredTransectLabel === nextLabel) {
    return;
  }

  const previousLabel = state.hoveredTransectLabel;
  state.hoveredTransectLabel = nextLabel;

  if (previousLabel) {
    refreshVisibleTransectStyle(previousLabel);
  }
  if (nextLabel) {
    refreshVisibleTransectStyle(nextLabel);
  }
}

function refreshVisibleTransectStyle(label) {
  const entry = state.visibleLayerMap.get(label);
  if (!entry) {
    return;
  }

  const isSelected = label === state.selectedTransect?.label;
  const isHovered = label === state.hoveredTransectLabel;
  entry.displayLayer.setStyle(getTransectDisplayStyle({
    isSelected,
    isHovered,
  }));

  if (isSelected || isHovered) {
    entry.displayLayer.bringToFront();
    entry.hitLayer.bringToFront();
  }
}

function parseCaliforniaTideStations(csvText) {
  return parseCsv(csvText)
    .map((row) => normalizeTideStation({
      id: row["Station Number"],
      name: row["Station Name"],
      lat: row["Station Latitude"],
      lng: row["Station Longitude"],
    }))
    .filter(Boolean);
}

function normalizeTideStation(rawStation) {
  const id = String(rawStation.id ?? "").trim();
  const name = String(rawStation.name ?? "").trim();
  const lat = Number(rawStation.lat);
  const lng = Number(rawStation.lng);
  if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { id, name, lat, lng };
}

function classifyOvertopping({ expectedRunup, conservativeRunup, upperBoundRunup, duneCrestElevation }) {
  if (expectedRunup > duneCrestElevation) {
    return {
      label: "Significant overtopping probable",
      background: "rgba(229, 103, 82, 0.18)",
      color: "#9b2f1d",
    };
  }
  if (conservativeRunup > duneCrestElevation) {
    return {
      label: "Moderate overtopping possible",
      background: "rgba(243, 194, 107, 0.22)",
      color: "#8a5d0a",
    };
  }
  if (upperBoundRunup > duneCrestElevation) {
    return {
      label: "Minor overtopping possible",
      background: "rgba(34, 183, 167, 0.18)",
      color: "#0d6b61",
    };
  }
  return {
    label: "Overtopping not expected",
    background: "rgba(17, 49, 76, 0.12)",
    color: "#11314c",
  };
}

function distanceToCenter(transect, center) {
  const latDelta = transect.predictionLat - center.lat;
  const lonDelta = transect.predictionLon - center.lng;
  return latDelta ** 2 + lonDelta ** 2;
}

function makeMetricCard(label, value) {
  return `<article class="metric-card"><span class="metric-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function tooltipTimeTitle(items) {
  if (!items.length) {
    return "";
  }
  return `${formatShortDateTime(items[0].parsed.x)} ${getTimeModeLabel()}`;
}

function setAppStatus(message) {
  if (dom.appStatus) {
    dom.appStatus.textContent = message;
  }
}

function setGeometryHelper(message) {
  if (dom.geometryHelperText) {
    dom.geometryHelperText.textContent = message;
  }
}

function formatTideChartTitle(station) {
  if (!station?.id) {
    return "NOAA Tide Prediction";
  }
  return station.name
    ? `NOAA Tide Prediction - Station ${station.id}, ${station.name}`
    : `NOAA Tide Prediction - Station ${station.id}`;
}

function formatNoaaDate(timeMs) {
  const date = new Date(timeMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function convertLengthForDisplay(valueMeters) {
  return state.displayUnits === "english" ? valueMeters * FEET_PER_METER : valueMeters;
}

function convertDistanceForDisplay(valueMeters) {
  return convertLengthForDisplay(valueMeters);
}

function convertElevationForDisplay(valueMeters) {
  return convertLengthForDisplay(valueMeters);
}

function parseDisplayInputLength(rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return value;
  }
  return state.displayUnits === "english" ? value / FEET_PER_METER : value;
}

function formatDisplayInputValue(valueMeters, digits = 1) {
  const displayValue = convertLengthForDisplay(valueMeters);
  return Number.isFinite(displayValue) ? displayValue.toFixed(digits) : "";
}

function formatDisplayLength(valueMeters, digits = 2) {
  return `${convertLengthForDisplay(valueMeters).toFixed(digits)} ${state.displayUnits === "english" ? "ft" : "m"}`;
}

function getDistanceAxisLabel() {
  return `Cross-shore distance (${state.displayUnits === "english" ? "ft" : "m"})`;
}

function getElevationAxisLabel() {
  return state.displayUnits === "english" ? "Elevation (ft, MLLW)" : "Elevation (m, MLLW)";
}

function getTimeModeLabel() {
  return state.timeMode === "local" ? "Local" : "UTC";
}

function getDisplayTimeZone() {
  return state.timeMode === "utc" ? "UTC" : undefined;
}

function formatAxisDate(timeMs) {
  if (!Number.isFinite(timeMs)) {
    return "";
  }
  return new Date(timeMs).toLocaleDateString("en-US", {
    timeZone: getDisplayTimeZone(),
    month: "short",
    day: "numeric",
  });
}

function formatShortDateTime(timeMs) {
  if (!Number.isFinite(timeMs)) {
    return "";
  }
  return new Date(timeMs).toLocaleString("en-US", {
    timeZone: getDisplayTimeZone(),
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
}

function fetchJSON(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Request failed for ${url} with status ${response.status}`);
    }
    return response.json();
  });
}

function fetchText(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Request failed for ${url} with status ${response.status}`);
    }
    return response.text();
  });
}

function parseCsv(text) {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return [];
  }

  const lines = trimmedText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function parseCsvLine(line) {
  const values = [];
  let currentValue = "";
  let isInsideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === "\"") {
      if (isInsideQuotes && nextCharacter === "\"") {
        currentValue += "\"";
        index += 1;
      } else {
        isInsideQuotes = !isInsideQuotes;
      }
      continue;
    }

    if (character === "," && !isInsideQuotes) {
      values.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue.trim());
  return values;
}

function linspace(start, end, count) {
  if (count <= 1) {
    return [start];
  }
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values) {
  if (values.length <= 1) {
    return 0;
  }
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function normalizeRelativeAngle(value) {
  let normalized = value % 360;
  if (normalized > 180) {
    normalized -= 360;
  }
  if (normalized < -180) {
    normalized += 360;
  }
  return normalized;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return clamp(value, min, max);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
