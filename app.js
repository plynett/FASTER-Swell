const DEMO_LABEL = "OC400";
const TRANSECT_QUERY_PARAM = "transect";
const START_DATE_QUERY_PARAM = "start_date";
const TRANSECT_ZOOM_THRESHOLD = 9;
const MAX_RENDERED_TRANSECTS = 1400;
const NOAA_STATIONS_CSV_URL = "./data/noaa_ca_tide_stations.csv";
const KNOWN_TRANSECTS_CSV_URL = "./data/known_transects.csv";
const PIER_TRANSECTS_BASE_URL = "./data/pier_transects";
const NOAA_STATIONS_URL = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions";
const NOAA_PREDICTIONS_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const NOAA_VERTICAL_DATUM = "NAVD";
const DISPLAY_VERTICAL_DATUM = "NAVD88";
const NWS_POINTS_BASE_URL = "https://api.weather.gov/points";
const OPEN_METEO_HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive";
const CDIP_DAP2_ASCII_BASE_URL = "https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore";
const CDIP_DAP2_ASCII_QUERY = "waveTime,waveHs,waveTp,waveDp,metaWaterDepth,metaShoreNormal";
// Optional fallback API route provided by web/scripts/serve_faster_web.py when that proxy is running.
const LIVE_MOP_API_PATH = "./api/mop-forecast";
const NOAA_APPLICATION_ID = "FASTER_Swell_Web";
const TRANSECT_HIT_WEIGHT_MULTIPLIER = 3.2;
const MIN_TRANSECT_HIT_WEIGHT = 9;
const DEFAULT_TIDE_PREVIEW_HOURS = 240;
const FEET_PER_METER = 3.28084;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MPS_PER_KMH = 1 / 3.6;
const SEA_LEVEL_ANOMALY_LOOKBACK_DAYS = 3;
const SEA_LEVEL_ANOMALY_END_LAG_MINUTES = 60;
const SEA_LEVEL_ANOMALY_INTERVAL_MINUTES = 6;
const SEA_LEVEL_ANOMALY_MIN_PAIR_COUNT = 24;
const SEA_LEVEL_ANOMALY_CACHE_TTL_MS = 15 * MS_PER_MINUTE;
const SEA_LEVEL_ANOMALY_PAIR_TOLERANCE_MS = (SEA_LEVEL_ANOMALY_INTERVAL_MINUTES / 2) * MS_PER_MINUTE;
const NWS_WIND_CACHE_TTL_MS = 30 * MS_PER_MINUTE;
const MPH_PER_KMH = 0.621371;
const GRAVITY_MPS2 = 9.81;
const CHOP_PROXY_MAX_PERIOD_SECONDS = 4;
const PM_CHOP_HEIGHT_COEFFICIENT = 0.241;
const PM_PEAK_FREQUENCY_COEFFICIENT = 0.13;
const PM_SHAPE_COEFFICIENT = 1.25;
const MIN_AVERAGE_BEACH_SLOPE = 0.005;
const MAX_AVERAGE_BEACH_SLOPE = 0.3;
const DEFAULT_AVERAGE_BEACH_SLOPE = 0.05;
const MOP_TO_SWASH_SLOPE_MULTIPLIER = 2;
const MAX_WAVE_RATIO = 1.3;
const CREST_RATIO = 0.55;
const HINDCAST_WINDOW_DAYS = 5;
const HINDCAST_END_SAFETY_LAG_HOURS = 6;
const CDIP_HINDCAST_START_MS = Date.UTC(2000, 0, 1, 0, 0, 0);
const CDIP_HINDCAST_END_MS = Date.UTC(2025, 2, 31, 23, 0, 0);
const CDIP_NOWCAST_START_MS = Date.UTC(2025, 3, 1, 0, 0, 0);

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
  pierDeck: "#5b3a1e",
  sand: "#f4b066",
  sandEdge: "#d88a39",
  water: "#9ed8ea",
  waterEdge: "#1e64d0",
};

const state = {
  manifest: null,
  transects: [],
  genericDefaults: null,
  knownTransectProfiles: new Map(),
  hindcastWindow: null,
  selectedTransect: null,
  selectedDatasetMeta: null,
  selectedForecast: null,
  selectedTideStation: null,
  selectedTideSeries: null,
  selectedWindSeries: null,
  selectedPierTransect: null,
  currentTideWindow: null,
  tideStationsPromise: null,
  tideCache: new Map(),
  seaLevelAnomalyCache: new Map(),
  windCache: new Map(),
  pierTransectCache: new Map(),
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
  windChart: null,
  lockedTopRowHeight: null,
  topRowHeightFrame: null,
  displayUnits: "english",
  timeMode: "local",
  selectionRequestId: 0,
};

const dom = {
  appStatus: document.getElementById("appStatus"),
  mapPanel: document.querySelector(".map-panel"),
  transectPanel: document.querySelector(".transect-panel"),
  selectedTransectLabel: document.getElementById("selectedTransectLabel"),
  selectionTitle: document.getElementById("selectionTitle"),
  dataAvailabilityPill: document.getElementById("dataAvailabilityPill"),
  geometryPreview: document.getElementById("geometryPreview"),
  geometryHelperText: document.getElementById("geometryHelperText"),
  unitModeControl: document.getElementById("unitModeControl"),
  timeModeControl: document.getElementById("timeModeControl"),
  resetDefaultsButton: document.getElementById("resetDefaultsButton"),
  runStatusPill: document.getElementById("runStatusPill"),
  forecastEmptyState: document.getElementById("forecastEmptyState"),
  forecastContent: document.getElementById("forecastContent"),
  runupEmptyState: document.getElementById("runupEmptyState"),
  runupContent: document.getElementById("runupContent"),
  waveCanvas: document.getElementById("waveChartCanvas"),
  tideCanvas: document.getElementById("tideChartCanvas"),
  windCanvas: document.getElementById("windChartCanvas"),
  waveChartTitle: document.getElementById("waveChartTitle"),
  tideChartTitle: document.getElementById("tideChartTitle"),
  windChartTitle: document.getElementById("windChartTitle"),
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

  const [manifest, transectPayload, knownTransectsCsv] = await Promise.all([
    fetchJSON("./data/forecast-manifest.json"),
    fetchJSON("./data/transects.json"),
    fetchOptionalText(KNOWN_TRANSECTS_CSV_URL),
  ]);

  state.manifest = manifest;
  state.transects = transectPayload.transects;
  state.genericDefaults = manifest.genericDefaults || transectPayload.genericDefaults;
  state.knownTransectProfiles = parseKnownTransectProfiles(knownTransectsCsv);
  state.hindcastWindow = getHindcastWindowFromLocation();
  state.tideStationsPromise = fetchCaliforniaTideStations();

  initMap();
  bindControls();

  const demoTransect = state.transects.find((transect) => transect.label === DEMO_LABEL) || state.transects[0];
  const requestedTransectLabel = getRequestedTransectLabelFromLocation();
  const requestedTransect = findTransectByLabel(requestedTransectLabel);
  if (requestedTransectLabel && !requestedTransect) {
    console.warn("[FASTER Explorer] Requested transect was not found.", {
      requestedTransectLabel,
    });
  }

  await selectTransect(requestedTransect || demoTransect, { flyTo: Boolean(requestedTransect) });
  scheduleTopRowHeightCapture();

  setAppStatus(
    state.hindcastWindow
      ? `Hindcast ready for ${state.hindcastWindow.label}. Zoom in and click a transect to explore.`
      : "Prototype ready. Zoom in and click a transect to explore."
  );
}

function scheduleTopRowHeightCapture() {
  if (state.topRowHeightFrame) {
    window.cancelAnimationFrame(state.topRowHeightFrame);
  }
  state.topRowHeightFrame = window.requestAnimationFrame(() => {
    state.topRowHeightFrame = null;
    captureTopRowHeight();
  });
}

function captureTopRowHeight() {
  if (!dom.mapPanel || !dom.transectPanel) {
    return;
  }

  const previousMapHeight = dom.mapPanel.style.height;
  const previousTransectHeight = dom.transectPanel.style.height;
  dom.mapPanel.style.height = "";
  dom.transectPanel.style.height = "";

  const nextHeight = Math.ceil(
    Math.max(dom.mapPanel.getBoundingClientRect().height, dom.transectPanel.getBoundingClientRect().height)
  );

  dom.mapPanel.style.height = previousMapHeight;
  dom.transectPanel.style.height = previousTransectHeight;

  if (nextHeight > 0) {
    state.lockedTopRowHeight = nextHeight;
    applyTopRowHeightLock();
  }
}

function applyTopRowHeightLock() {
  if (!state.lockedTopRowHeight || !dom.mapPanel || !dom.transectPanel) {
    return;
  }
  const heightPx = `${state.lockedTopRowHeight}px`;
  dom.mapPanel.style.height = heightPx;
  dom.transectPanel.style.height = heightPx;
  state.map?.invalidateSize(false);
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
    scheduleTopRowHeightCapture();
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
    applyModelParams(getDefaultsForTransect(state.selectedTransect));
    syncAverageBeachSlopeInputTitle(state.selectedTransect);
    if (state.selectedForecast && state.selectedTideSeries) {
      refreshComputedResults();
    }
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
    renderCharts(state.selectedForecast, state.selectedTideSeries, state.selectedWindSeries);
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

  const selectionRequestId = state.selectionRequestId + 1;
  state.selectionRequestId = selectionRequestId;
  stopPlayback();
  state.selectedTransect = transect;
  state.selectedDatasetMeta = state.manifest.datasets[transect.label] || null;
  state.results = null;
  state.selectedForecast = null;
  state.currentIndex = 0;
  state.selectedTideSeries = null;
  state.selectedWindSeries = null;
  state.selectedPierTransect = null;
  state.currentTideWindow = null;
  state.resultsDirty = false;
  destroyForecastCharts();

  dom.selectedTransectLabel.textContent = transect.label;
  dom.selectionTitle.textContent = `Transect ${transect.label}`;
  dom.waveChartTitle.textContent = `MOP Wave Forecast - Transect ${transect.label}`;
  dom.tideChartTitle.textContent = "NOAA Tide Prediction";
  dom.windChartTitle.textContent = "NWS Wind Forecast";
  dom.dataAvailabilityPill.textContent = state.hindcastWindow
    ? "CDIP hindcast ready"
    : state.selectedDatasetMeta
      ? "Live MOP + fallback"
      : "Live MOP ready";
  dom.runStatusPill.textContent = "Loading forecast...";
  dom.forecastEmptyState.classList.remove("hidden");
  dom.forecastContent.classList.add("hidden");
  dom.timelineControls.classList.remove("hidden");
  dom.metricGrid.classList.remove("hidden");
  dom.runupEmptyState.classList.remove("hidden");
  dom.runupContent.classList.add("hidden");
  dom.forecastEmptyState.querySelector("h3").textContent = `Loading ${transect.label} forecast...`;
  dom.forecastEmptyState.querySelector("p").textContent =
    state.hindcastWindow
      ? formatHindcastLoadingMessage(state.hindcastWindow)
      : "The app is requesting live MOP forecast data first and falling back to local forecast files where available.";
  dom.runupEmptyState.querySelector("h3").textContent = "Preparing runup analysis...";
  dom.runupEmptyState.querySelector("p").textContent =
    "The selected transect updates automatically, and geometry edits will refresh the overtopping analysis.";
  dom.metricGrid.innerHTML = "";
  dom.runupProfile.innerHTML = "";
  dom.categoryPill.textContent = "--";
  dom.categoryPill.style.background = "rgba(243, 194, 107, 0.18)";
  dom.categoryPill.style.color = "#7a5413";
  syncSelectedTransectUrl(transect.label);

  const defaults = getDefaultsForTransect(transect);
  applyModelParams(defaults);
  syncAverageBeachSlopeInputTitle(transect);
  updateGeometryPreview();
  applyTopRowHeightLock();
  syncVisibleTransects();

  if (options.flyTo) {
    state.map.flyTo([transect.predictionLat, transect.predictionLon], Math.max(state.map.getZoom(), 10.5), {
      duration: 0.7,
    });
  }

  const tideStation = await resolveTideStation(transect);
  if (isSelectionRequestStale(selectionRequestId, transect.label)) {
    return;
  }
  state.selectedTideStation = tideStation;
  dom.tideChartTitle.textContent = formatTideChartTitle(tideStation);
  await runModel({
    selectionRequestId,
    tideStation,
  });
}

function getRequestedTransectLabelFromLocation() {
  const url = new URL(window.location.href);
  const queryTransect = normalizeTransectLabel(url.searchParams.get(TRANSECT_QUERY_PARAM));
  if (queryTransect) {
    return queryTransect;
  }

  const rawHash = window.location.hash.replace(/^#/, "").trim();
  if (!rawHash) {
    return null;
  }

  if (rawHash.includes("=")) {
    const hashParams = new URLSearchParams(rawHash.startsWith("?") ? rawHash.slice(1) : rawHash);
    return normalizeTransectLabel(hashParams.get(TRANSECT_QUERY_PARAM));
  }

  return normalizeTransectLabel(rawHash);
}

function getHindcastWindowFromLocation() {
  const url = new URL(window.location.href);
  const rawStartDate = getQueryOrHashParam(url, START_DATE_QUERY_PARAM);
  if (!rawStartDate) {
    return null;
  }

  const startMs = parseMmddyyyyUtc(rawStartDate);
  if (!Number.isFinite(startMs)) {
    console.warn("[FASTER Hindcast] Ignoring invalid start_date query parameter.", {
      startDate: rawStartDate,
      expectedFormat: "MMDDYYYY",
    });
    return null;
  }

  const requestedEndMs = startMs + HINDCAST_WINDOW_DAYS * MS_PER_DAY;
  const endMs = getHistoricalOnlyHindcastEndMs(startMs);
  if (endMs <= startMs) {
    console.warn("[FASTER Hindcast] Ignoring start_date because it has no complete historical window yet.", {
      startDate: rawStartDate,
      start: new Date(startMs).toISOString(),
      latestHistoricalEnd: new Date(endMs).toISOString(),
    });
    return null;
  }

  return {
    rawStartDate,
    startMs,
    requestedEndMs,
    endMs,
    isClippedToHistoricalNow: endMs < requestedEndMs,
    label: formatHindcastWindowLabel(startMs, endMs),
  };
}

function getHistoricalOnlyHindcastEndMs(startMs) {
  const requestedEndMs = startMs + HINDCAST_WINDOW_DAYS * MS_PER_DAY;
  const latestHistoricalHourMs =
    floorUtcTimeToHour(Date.now()) - HINDCAST_END_SAFETY_LAG_HOURS * MS_PER_HOUR;
  return Math.min(requestedEndMs, latestHistoricalHourMs);
}

function formatHindcastWindowLabel(startMs, endMs) {
  return `${formatIsoDate(startMs)} to ${formatIsoDate(endMs)}`;
}

function formatHindcastLoadingMessage(hindcastWindow) {
  const windowText =
    `${formatShortUtcDateTime(hindcastWindow.startMs)} to ` +
    `${formatShortUtcDateTime(hindcastWindow.endMs)} UTC`;
  if (hindcastWindow.isClippedToHistoricalNow) {
    return `The app is requesting a CDIP MOP hindcast/nowcast window from ${windowText}, clipped before the current time.`;
  }
  return `The app is requesting a ${HINDCAST_WINDOW_DAYS}-day CDIP MOP hindcast/nowcast window from ${windowText}.`;
}

function getQueryOrHashParam(url, paramName) {
  const directValue = url.searchParams.get(paramName);
  if (directValue) {
    return directValue;
  }

  const rawHash = url.hash.replace(/^#/, "").trim();
  if (!rawHash || !rawHash.includes("=")) {
    return null;
  }

  const hashParams = new URLSearchParams(rawHash.startsWith("?") ? rawHash.slice(1) : rawHash);
  return hashParams.get(paramName);
}

function parseMmddyyyyUtc(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!match) {
    return NaN;
  }

  const [, monthText, dayText, yearText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);
  const dateMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  const date = new Date(dateMs);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return NaN;
  }
  return dateMs;
}

function normalizeTransectLabel(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue.toUpperCase() : null;
}

function findTransectByLabel(label) {
  const normalizedLabel = normalizeTransectLabel(label);
  if (!normalizedLabel) {
    return null;
  }
  return state.transects.find((transect) => normalizeTransectLabel(transect.label) === normalizedLabel) || null;
}

function syncSelectedTransectUrl(transectLabel) {
  if (!transectLabel || !window.history?.replaceState) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set(TRANSECT_QUERY_PARAM, transectLabel);
  url.hash = "";
  window.history.replaceState({ transect: transectLabel }, "", url.toString());
}

function isSelectionRequestStale(selectionRequestId, transectLabel) {
  return selectionRequestId !== state.selectionRequestId || state.selectedTransect?.label !== transectLabel;
}

async function runModel(options = {}) {
  if (!state.selectedTransect) {
    return;
  }

  const selectionRequestId = options.selectionRequestId ?? state.selectionRequestId;
  const transectLabel = state.selectedTransect.label;
  let params = sanitizeParams(readModelParamsFromInputs());
  applyModelParams(params);
  state.selectedForecast = null;
  state.results = null;

  dom.dataAvailabilityPill.textContent = state.hindcastWindow ? "Loading CDIP hindcast..." : "Loading live MOP...";
  dom.runStatusPill.textContent = "Loading forecast data...";
  setGeometryHelper("Preparing wave, tide, and runup data for the selected transect.");

  const forecastDataset = await loadForecastDataset(transectLabel);
  if (isSelectionRequestStale(selectionRequestId, transectLabel)) {
    return;
  }

  const tideStation = options.tideStation || state.selectedTideStation || (await resolveTideStation(state.selectedTransect));
  if (isSelectionRequestStale(selectionRequestId, transectLabel)) {
    return;
  }
  state.selectedTideStation = tideStation;

  const tideWindow = forecastDataset
    ? { startMs: forecastDataset.waveTimeMs[0], endMs: forecastDataset.waveTimeMs.at(-1) }
    : getDefaultTidePreviewWindow();
  state.currentTideWindow = tideWindow;

  dom.runStatusPill.textContent = "Estimating sea-level anomaly...";
  dom.tideSurgeLevelInput.title =
    state.hindcastWindow
      ? `Auto-estimating historical NOAA observed minus predicted water level residual in ${DISPLAY_VERTICAL_DATUM}.`
      : `Auto-estimating recent NOAA observed minus predicted water level residual in ${DISPLAY_VERTICAL_DATUM}.`;
  try {
    const anomalyEstimate = await loadSeaLevelAnomalyEstimate(
      tideStation.id,
      state.hindcastWindow ? tideWindow : null
    );
    if (isSelectionRequestStale(selectionRequestId, transectLabel)) {
      return;
    }
    params = sanitizeParams({
      ...params,
      tideSurgeLevel: anomalyEstimate.anomaly,
    });
    applyModelParams(params);
    dom.tideSurgeLevelInput.title =
      `Auto-estimated from ${anomalyEstimate.pairCount} NOAA observed-minus-predicted ` +
      `${DISPLAY_VERTICAL_DATUM} water-level pairs at station ${tideStation.id}, ${formatNoaaDate(anomalyEstimate.startMs)} ` +
      `to ${formatNoaaDate(anomalyEstimate.endMs)} UTC.`;
    console.info("[FASTER NOAA] Auto-estimated sea-level anomaly.", {
      stationId: tideStation.id,
      stationName: tideStation.name,
      anomalyMeters: anomalyEstimate.anomaly,
      pairCount: anomalyEstimate.pairCount,
      start: formatNoaaDate(anomalyEstimate.startMs),
      end: formatNoaaDate(anomalyEstimate.endMs),
    });
  } catch (error) {
    if (isSelectionRequestStale(selectionRequestId, transectLabel)) {
      return;
    }
    dom.tideSurgeLevelInput.title = "Sea-level anomaly auto-estimate unavailable; using the current input value.";
    console.warn("[FASTER NOAA] Sea-level anomaly estimate failed; using current input value.", {
      stationId: tideStation.id,
      stationName: tideStation.name,
      error,
    });
  }

  dom.runStatusPill.textContent = forecastDataset
    ? state.hindcastWindow
      ? "Loading NOAA tides and historical winds..."
      : "Loading NOAA tides and winds..."
    : "Loading NOAA tides...";
  const windSeriesPromise = forecastDataset
    ? state.hindcastWindow
      ? loadHistoricalWindSeries(state.selectedTransect, tideWindow.startMs, tideWindow.endMs)
      .then((windSeries) => ({ windSeries }))
      .catch((error) => ({ error }))
      : loadWindForecastSeries(state.selectedTransect, tideWindow.startMs, tideWindow.endMs)
      .then((windSeries) => ({ windSeries }))
      .catch((error) => ({ error }))
    : Promise.resolve({ windSeries: null });
  let tideSeries;
  let windSeries = null;
  try {
    tideSeries = await loadTideSeries(tideStation.id, tideWindow.startMs, tideWindow.endMs);
    if (isSelectionRequestStale(selectionRequestId, transectLabel)) {
      return;
    }
    state.selectedTideSeries = tideSeries;
    const windOutcome = await windSeriesPromise;
    if (isSelectionRequestStale(selectionRequestId, transectLabel)) {
      return;
    }
    if (windOutcome.error) {
      windSeries = state.hindcastWindow
        ? createHistoricalWindUnavailableSeries(tideWindow, "Historical wind request failed; hindcast chop is set to 0.")
        : null;
      state.selectedWindSeries = windSeries;
      console.warn("[FASTER Wind] Wind data load failed; wind subplot will be empty.", {
        transect: transectLabel,
        source: state.hindcastWindow ? "historical" : "forecast",
        startMs: tideWindow.startMs,
        endMs: tideWindow.endMs,
        error: windOutcome.error,
      });
    } else {
      windSeries = windOutcome.windSeries;
      state.selectedWindSeries = windSeries;
    }
  } catch (error) {
    if (isSelectionRequestStale(selectionRequestId, transectLabel)) {
      return;
    }
    console.error("[FASTER NOAA] Tide download failed.", {
      transect: transectLabel,
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
      transect: transectLabel,
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
    scheduleTopRowHeightCapture();
    return;
  }

  dom.dataAvailabilityPill.textContent =
    forecastDataset.sourceKind === "live"
      ? "Live forecast loaded"
      : forecastDataset.sourceKind === "nowcast"
        ? "CDIP nowcast loaded"
        : forecastDataset.sourceKind === "hindcast"
          ? "CDIP hindcast loaded"
          : "Local fallback forecast";
  state.selectedForecast = forecastDataset;
  state.selectedPierTransect = await loadPierTransect(transectLabel);
  if (isSelectionRequestStale(selectionRequestId, transectLabel)) {
    return;
  }
  renderCharts(forecastDataset, tideSeries, windSeries);
  refreshComputedResults(sanitizeParams(readModelParamsFromInputs()));
  scheduleTopRowHeightCapture();
}

function handleParameterInput() {
  const params = sanitizeParams(readModelParamsFromInputs());
  state.modelParams = params;
  updateGeometryPreview();

  if (state.selectedForecast && state.selectedTideSeries) {
    refreshComputedResults(params);
  }
}

function refreshComputedResults(params = state.modelParams || sanitizeParams(readModelParamsFromInputs())) {
  if (!state.selectedTransect || !state.selectedForecast || !state.selectedTideSeries) {
    return;
  }

  state.modelParams = { ...params };
  state.results = computeRunupResults({
    forecastDataset: state.selectedForecast,
    tideSeries: state.selectedTideSeries,
    windSeries: state.selectedWindSeries,
    params: state.modelParams,
    transect: state.selectedTransect,
  });
  state.resultsDirty = false;
  dom.forecastEmptyState.classList.add("hidden");
  dom.forecastContent.classList.remove("hidden");
  dom.timelineControls.classList.remove("hidden");
  dom.metricGrid.classList.remove("hidden");
  dom.runupEmptyState.classList.add("hidden");
  dom.runupContent.classList.remove("hidden");
  dom.runStatusPill.textContent = "Forecast ready";

  const playbackStartIndex = getPlaybackStartIndex(state.results);
  dom.timeSlider.min = String(playbackStartIndex);
  dom.timeSlider.max = String(Math.max(state.results.length - 1, 0));
  state.currentIndex = Math.max(playbackStartIndex, Math.min(state.currentIndex, state.results.length - 1));
  dom.timeSlider.value = String(state.currentIndex);
  updatePlaybackUI();
}

function computeRunupResults({ forecastDataset, tideSeries, windSeries, params, transect }) {
  return forecastDataset.waveTimeMs.map((timeMs, index) => {
    const tideLevel = findNearestTideLevel(tideSeries, timeMs) + params.tideSurgeLevel;
    const localChopHeight = findIntervalValueAtTime(windSeries?.chopIntervals, timeMs, 0);
    return computeRunupAtTime({
      timeMs,
      index,
      waveHeightSwell: forecastDataset.waveHs[index],
      localChopHeight,
      waveHeightTotal: forecastDataset.waveHs[index] + localChopHeight,
      peakWavePeriod: forecastDataset.waveTp[index],
      waveDirection: forecastDataset.waveDp[index],
      tideLevel,
      waterDepthPrediction: forecastDataset.metaWaterDepth,
      shorelineNormal: forecastDataset.metaShoreNormal ?? transect.shoreNormal,
      params,
    });
  });
}

function applyModelParams(params) {
  state.modelParams = { ...params };
  dom.averageBeachSlopeInput.value = params.averageBeachSlope.toFixed(3);
  dom.beachElevationBaseInput.value = formatDisplayInputValue(params.beachElevationBase, 1);
  dom.bermWidthInput.value = formatDisplayInputValue(params.bermWidth, 1);
  dom.duneCrestElevationInput.value = formatDisplayInputValue(params.duneCrestElevation, 1);
  dom.toeToCrestDistanceInput.value = formatDisplayInputValue(params.toeToCrestDistance, 1);
  dom.tideSurgeLevelInput.value = formatDisplayInputValue(params.tideSurgeLevel, 2);
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
  };
}

function sanitizeParams(rawParams) {
  const averageBeachSlope = clampNumber(
    rawParams.averageBeachSlope,
    MIN_AVERAGE_BEACH_SLOPE,
    MAX_AVERAGE_BEACH_SLOPE,
    DEFAULT_AVERAGE_BEACH_SLOPE
  );
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

  return {
    profileMode: rawParams.profileMode === "structure" ? "structure" : "dune",
    averageBeachSlope,
    beachElevationBase,
    bermWidth,
    duneCrestElevation,
    toeToCrestDistance,
    duneWidth,
    tideSurgeLevel,
  };
}

function getDefaultsForTransect(transectOrLabel) {
  const label = typeof transectOrLabel === "string" ? transectOrLabel : transectOrLabel?.label;
  const demoDefaults = state.manifest.datasets?.[label]?.defaults;
  const defaults = { ...(demoDefaults || state.genericDefaults) };
  const duneWidth = Number(defaults.duneWidth);
  const slopeEstimate = typeof transectOrLabel === "string"
    ? null
    : estimateAverageBeachSlopeFromTransect(transectOrLabel);
  const knownProfile = getKnownTransectProfile(label);
  return {
    ...defaults,
    averageBeachSlope: slopeEstimate?.slope ?? defaults.averageBeachSlope,
    toeToCrestDistance: Number.isFinite(duneWidth) ? duneWidth / 2 : 15,
    ...knownProfile,
  };
}

function getKnownTransectProfile(transectOrLabel) {
  const label = typeof transectOrLabel === "string" ? transectOrLabel : transectOrLabel?.label;
  return state.knownTransectProfiles.get(normalizeTransectLabel(label)) || null;
}

function estimateAverageBeachSlopeFromTransect(transect) {
  const waterDepthMeters = Math.abs(Number(transect?.waterDepth));
  const distanceKm = haversineKm(
    Number(transect?.backbeachLat),
    Number(transect?.backbeachLon),
    Number(transect?.predictionLat),
    Number(transect?.predictionLon)
  );
  const distanceMeters = distanceKm * 1000;
  if (!Number.isFinite(waterDepthMeters) || waterDepthMeters <= 0 || !Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return null;
  }

  const mopAverageSlope = waterDepthMeters / distanceMeters;
  const swashSlopeProxy = MOP_TO_SWASH_SLOPE_MULTIPLIER * mopAverageSlope;
  if (!Number.isFinite(swashSlopeProxy) || swashSlopeProxy <= 0) {
    return null;
  }

  return {
    slope: clamp(swashSlopeProxy, MIN_AVERAGE_BEACH_SLOPE, MAX_AVERAGE_BEACH_SLOPE),
    mopAverageSlope,
    swashSlopeProxy,
    waterDepthMeters,
    distanceMeters,
  };
}

function syncAverageBeachSlopeInputTitle(transect) {
  const knownProfile = getKnownTransectProfile(transect);
  if (Number.isFinite(knownProfile?.averageBeachSlope)) {
    dom.averageBeachSlopeInput.title =
      `Loaded from ${KNOWN_TRANSECTS_CSV_URL} for transect ${normalizeTransectLabel(transect?.label)}; edit if updated surveyed profile data are available.`;
    return;
  }

  const estimate = estimateAverageBeachSlopeFromTransect(transect);
  if (!estimate) {
    dom.averageBeachSlopeInput.title = "Average beach-face slope over the swash zone; edit if surveyed profile data are available.";
    return;
  }

  const clampedNote = Math.abs(estimate.slope - estimate.swashSlopeProxy) > 1e-6
    ? ` Doubled proxy ${estimate.swashSlopeProxy.toFixed(3)} was limited to the model range.`
    : "";
  dom.averageBeachSlopeInput.title =
    `Auto-estimated as 2 x MOP average slope: 2 x (${estimate.waterDepthMeters.toFixed(1)} m ` +
    `prediction depth / ${estimate.distanceMeters.toFixed(0)} m backbeach-to-prediction distance) = ` +
    `${estimate.swashSlopeProxy.toFixed(3)}.` +
    `${clampedNote} Edit if surveyed beach slope is available.`;
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
  pierDeck = null,
  waterLevel = 0,
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
  const shorelineProfileX = findProfileXAtElevation(profile, 0);
  const pierDeckProfilePoints = (pierDeck?.points || [])
    .map((point) => ({
      x: shorelineProfileX - point.offshoreDistance,
      y: point.elevation,
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const displayPierDeckPoints = pierDeckProfilePoints.map((point) => ({
    x: convertDistanceForDisplay(point.x),
    y: convertElevationForDisplay(point.y),
  }));
  const displayYMin = convertElevationForDisplay(yMin);
  const displayYMax = convertElevationForDisplay(yMax);
  const displayXMin = Math.min(0, ...displayPierDeckPoints.map((point) => point.x));
  const displayXMax = Math.max(displayProfile.xEnd, ...displayPierDeckPoints.map((point) => point.x));
  const displayXSpan = Math.max(displayXMax - displayXMin, 1);

  const xScale = (value) => padding.left + ((value - displayXMin) / displayXSpan) * chartWidth;
  const yScale = (value) => padding.top + ((displayYMax - value) / (displayYMax - displayYMin)) * chartHeight;
  const gradientId = `water-gradient-${Math.random().toString(36).slice(2, 10)}`;

  const beachPath = displayProfile.x
    .map((xValue, index) => `${index === 0 ? "M" : "L"} ${xScale(xValue).toFixed(2)} ${yScale(displayProfile.y[index]).toFixed(2)}`)
    .join(" ");
  const filledBeachPath = `${beachPath} L ${xScale(displayProfile.x.at(-1)).toFixed(2)} ${yScale(displayYMin).toFixed(2)} L ${xScale(displayProfile.x[0]).toFixed(2)} ${yScale(displayYMin).toFixed(2)} Z`;

  const waterEndProfileX = findProfileXAtElevation(profile, waterLevel);
  const xWaterEnd = convertDistanceForDisplay(clamp(waterEndProfileX, 0, profile.xEnd));
  const displayWaterLevel = convertElevationForDisplay(waterLevel);
  const gridX = Array.from({ length: 5 }, (_, index) => displayXMin + (displayXSpan * index) / 4);
  const gridY = Array.from({ length: 6 }, (_, index) => displayYMin + ((displayYMax - displayYMin) * index) / 5);

  const overlayMarkup = overlays
    .map((overlay) => {
      const extent = computeOverlayExtent(profile, overlay.value, overlay.mode);
      const displayStart = overlay.extendLeftToAxis ? displayXMin : convertDistanceForDisplay(extent.start);
      const displayEnd = convertDistanceForDisplay(extent.end);
      const displayValue = convertElevationForDisplay(overlay.value);
      return `<line x1="${xScale(displayStart).toFixed(2)}" y1="${yScale(displayValue).toFixed(2)}" x2="${xScale(displayEnd).toFixed(2)}" y2="${yScale(displayValue).toFixed(2)}" stroke="${overlay.color}" stroke-width="${overlay.strokeWidth || 4}" ${overlay.dash ? `stroke-dasharray="${overlay.dash}"` : ""} />`;
    })
    .join("");
  const pierDeckMarkup = displayPierDeckPoints.length >= 2
    ? `<polyline points="${displayPierDeckPoints.map((point) => `${xScale(point.x).toFixed(2)},${yScale(point.y).toFixed(2)}`).join(" ")}" fill="none" stroke="${COLORS.pierDeck}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><title>${escapeHtml(pierDeck.label)} pier deck</title></polyline>`
    : "";
  const footerMarkup = footerLines
    .slice(0, 2)
    .map((line, index) => {
      const x = index === 0 ? padding.left : width - padding.right;
      const anchor = index === 0 ? "start" : "end";
      return `<text x="${x}" y="${height - 26}" fill="#60748a" font-size="11" font-weight="700" text-anchor="${anchor}">${escapeHtml(line)}</text>`;
    })
    .join("");
  const legendItems = showLegend
    ? [
      ...overlays,
      ...(pierDeckMarkup ? [{ label: "Pier Deck", color: COLORS.pierDeck, dash: "", strokeWidth: 5 }] : []),
    ]
    : [];
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
            <line x1="12" y1="${y - 4}" x2="42" y2="${y - 4}" stroke="${overlay.color}" stroke-width="${overlay.strokeWidth || 3}" ${overlay.dash ? `stroke-dasharray="${overlay.dash}"` : ""} />
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
      <rect x="${xScale(displayXMin)}" y="${yScale(displayWaterLevel)}" width="${Math.max(xScale(xWaterEnd) - xScale(displayXMin), 0)}" height="${Math.max(yScale(displayYMin) - yScale(displayWaterLevel), 0)}" fill="${COLORS.water}" opacity="0.82" />
      <path d="${filledBeachPath}" fill="${COLORS.sand}" opacity="0.95" />
      <path d="${beachPath}" fill="none" stroke="${COLORS.sandEdge}" stroke-width="3" />
      ${pierDeckMarkup}
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

function findProfileXAtElevation(profile, elevation) {
  if (!profile?.x?.length || !profile?.y?.length) {
    return 0;
  }
  const finiteElevations = profile.y.filter(Number.isFinite);
  if (!finiteElevations.length) {
    return profile.x[0] || 0;
  }
  if (elevation <= Math.min(...finiteElevations)) {
    return profile.x[0] || 0;
  }

  for (let index = 1; index < profile.x.length; index += 1) {
    const previousY = profile.y[index - 1];
    const currentY = profile.y[index];
    const crossesElevation =
      (previousY <= elevation && currentY >= elevation) ||
      (previousY >= elevation && currentY <= elevation);
    if (crossesElevation) {
      const yDelta = currentY - previousY;
      if (Math.abs(yDelta) < 1e-9) {
        return profile.x[index];
      }
      const fraction = (elevation - previousY) / yDelta;
      return profile.x[index - 1] + fraction * (profile.x[index] - profile.x[index - 1]);
    }
  }
  return profile.x.at(-1) || 0;
}

async function loadForecastDataset(label) {
  const cacheKey = state.hindcastWindow
    ? `${label}:hindcast:${state.hindcastWindow.startMs}:${state.hindcastWindow.endMs}`
    : `${label}:forecast`;
  if (state.datasetCache.has(cacheKey)) {
    return state.datasetCache.get(cacheKey);
  }

  if (state.hindcastWindow) {
    const historicalDataset = await fetchHistoricalMopDataset(label, state.hindcastWindow);
    state.datasetCache.set(cacheKey, historicalDataset);
    return historicalDataset;
  }

  try {
    const liveDataset = await fetchLiveForecastDataset(label);
    state.datasetCache.set(cacheKey, liveDataset);
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
  state.datasetCache.set(cacheKey, forecastDataset);
  return forecastDataset;
}

async function fetchHistoricalMopDataset(label, hindcastWindow) {
  const source = selectHistoricalMopSource(hindcastWindow);
  const startIndex = Math.round((hindcastWindow.startMs - source.startMs) / MS_PER_HOUR);
  const endIndex = Math.round((hindcastWindow.endMs - source.startMs) / MS_PER_HOUR);
  const requestUrl = buildThreddsAsciiMopWindowUrl(label, source.fileSuffix, startIndex, endIndex);

  console.info("[FASTER MOP] Requesting CDIP historical MOP window.", {
    transect: label,
    sourceKind: source.sourceKind,
    start: new Date(hindcastWindow.startMs).toISOString(),
    end: new Date(hindcastWindow.endMs).toISOString(),
    startIndex,
    endIndex,
    requestUrl,
  });

  const response = await fetch(requestUrl);
  const bodyText = await response.text();
  if (!response.ok) {
    const detail = extractThreddsErrorDetail(bodyText);
    throw new Error(`CDIP ${source.sourceKind} request failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const forecastDataset = parseDap2AsciiForecast(bodyText, {
    label,
    requestUrl,
    sourceKind: source.sourceKind,
    sourceLabel: `${label} ${source.sourceKind}`,
  });
  console.info("[FASTER MOP] CDIP historical MOP window loaded.", {
    transect: label,
    sourceKind: source.sourceKind,
    points: forecastDataset.waveTimeMs.length,
    first: forecastDataset.waveTime[0],
    last: forecastDataset.waveTime.at(-1),
  });
  return forecastDataset;
}

function selectHistoricalMopSource(hindcastWindow) {
  if (hindcastWindow.startMs >= CDIP_NOWCAST_START_MS) {
    return {
      sourceKind: "nowcast",
      fileSuffix: "nowcast",
      startMs: CDIP_NOWCAST_START_MS,
    };
  }

  if (hindcastWindow.startMs < CDIP_HINDCAST_START_MS || hindcastWindow.endMs > CDIP_HINDCAST_END_MS) {
    throw new Error(
      `Requested start_date ${hindcastWindow.rawStartDate} is outside the supported CDIP hindcast/nowcast range. ` +
      `Use dates from ${formatIsoDate(CDIP_HINDCAST_START_MS)} through the current CDIP nowcast period.`
    );
  }

  return {
    sourceKind: "hindcast",
    fileSuffix: "hindcast",
    startMs: CDIP_HINDCAST_START_MS,
  };
}

async function loadPierTransect(label) {
  const normalizedLabel = normalizeTransectLabel(label);
  if (!normalizedLabel) {
    return null;
  }
  if (state.pierTransectCache.has(normalizedLabel)) {
    return state.pierTransectCache.get(normalizedLabel);
  }

  const url = `${PIER_TRANSECTS_BASE_URL}/${normalizedLabel.toLowerCase()}.csv`;
  const csvText = await fetchOptionalText(url, { suppressMissingWarning: true });
  const points = parsePierTransectPoints(csvText);
  const pierTransect = points.length >= 2
    ? {
      label: normalizedLabel,
      sourceUrl: url,
      points,
    }
    : null;

  state.pierTransectCache.set(normalizedLabel, pierTransect);
  if (pierTransect) {
    console.info("[FASTER Explorer] Loaded pier transect overlay.", {
      transect: normalizedLabel,
      points: points.length,
      source: url,
    });
  }
  return pierTransect;
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

function buildThreddsAsciiMopWindowUrl(label, fileSuffix, startIndex, endIndex) {
  const encodedLabel = encodeURIComponent(label);
  const encodedSuffix = encodeURIComponent(fileSuffix);
  const query = [
    `waveTime[${startIndex}:1:${endIndex}]`,
    `waveHs[${startIndex}:1:${endIndex}]`,
    `waveTp[${startIndex}:1:${endIndex}]`,
    `waveDp[${startIndex}:1:${endIndex}]`,
    "metaWaterDepth",
    "metaShoreNormal",
  ].join(",");
  return `${CDIP_DAP2_ASCII_BASE_URL}/${encodedLabel}_${encodedSuffix}.nc.ascii?${query}`;
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
      sourceKind: metadata.sourceKind || "live",
      sourceLabel: metadata.sourceLabel || metadata.label,
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
  const cacheKey = `${stationId}:${NOAA_VERTICAL_DATUM}:${startMs}:${endMs}`;
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
    datum: NOAA_VERTICAL_DATUM,
    interval: "h",
    units: "metric",
    time_zone: "gmt",
    format: "json",
    application: NOAA_APPLICATION_ID,
  });

  const requestUrl = `${NOAA_PREDICTIONS_URL}?${params.toString()}`;
  console.info("[FASTER NOAA] Requesting hourly tide predictions.", {
    stationId,
    datum: NOAA_VERTICAL_DATUM,
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
    datum: NOAA_VERTICAL_DATUM,
    points: tideSeries.timeMs.length,
    first: payload.predictions[0]?.t || null,
    last: payload.predictions.at(-1)?.t || null,
  });
  state.tideCache.set(cacheKey, tideSeries);
  return tideSeries;
}

async function loadWindForecastSeries(transect, startMs, endMs) {
  const lat = Number(transect?.predictionLat);
  const lon = Number(transect?.predictionLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Selected transect does not include a valid NWS wind forecast point.");
  }

  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}:${startMs}:${endMs}`;
  const cached = state.windCache.get(cacheKey);
  const nowMs = Date.now();
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.series;
  }

  const pointUrl = `${NWS_POINTS_BASE_URL}/${lat.toFixed(4)},${lon.toFixed(4)}`;
  const pointPayload = await fetchNwsJson(pointUrl);
  const pointProperties = pointPayload.properties || {};
  const gridUrl = pointProperties.forecastGridData;
  if (!gridUrl) {
    throw new Error("NWS point metadata did not include forecastGridData.");
  }

  const gridPayload = await fetchNwsJson(gridUrl);
  const gridProperties = gridPayload.properties || {};
  const windSpeedUnitCode = gridProperties.windSpeed?.uom || "";
  const speedIntervals = parseNwsGridLayerIntervals(gridProperties.windSpeed, startMs, endMs)
    .map((point) => ({
      ...point,
      value: normalizeNwsWindSpeedKmh(point.value, windSpeedUnitCode),
    }))
    .filter((point) => Number.isFinite(point.value));
  const chopIntervals = speedIntervals.map((point) => ({
    ...point,
    value: estimateChopHeightMeters(point.value),
  }));

  const series = {
    pointUrl,
    gridUrl,
    gridId: pointProperties.gridId || null,
    gridX: pointProperties.gridX ?? null,
    gridY: pointProperties.gridY ?? null,
    forecastZone: pointProperties.forecastZone || null,
    pointType: pointProperties.type || null,
    updateTime: gridProperties.updateTime || null,
    validTimes: gridProperties.validTimes || null,
    chopIntervals,
    speedPoints: buildIntervalStepPoints(speedIntervals),
    chopPoints: buildIntervalStepPoints(chopIntervals),
    speedIntervalCount: speedIntervals.length,
    chopIntervalCount: chopIntervals.length,
  };

  console.info("[FASTER NWS] Loaded wind forecast grid data.", {
    transect: transect.label,
    grid: series.gridId ? `${series.gridId}/${series.gridX},${series.gridY}` : null,
    pointType: series.pointType,
    speedIntervals: series.speedIntervalCount,
    chopIntervals: series.chopIntervalCount,
    updateTime: series.updateTime,
  });

  state.windCache.set(cacheKey, {
    series,
    expiresAtMs: nowMs + NWS_WIND_CACHE_TTL_MS,
  });
  return series;
}

async function loadHistoricalWindSeries(transect, startMs, endMs) {
  const lat = Number(transect?.predictionLat);
  const lon = Number(transect?.predictionLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Selected transect does not include a valid historical wind point.");
  }

  const cacheKey = `historical:${lat.toFixed(4)},${lon.toFixed(4)}:${startMs}:${endMs}`;
  const cached = state.windCache.get(cacheKey);
  const nowMs = Date.now();
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.series;
  }

  const requestUrl = buildOpenMeteoHistoricalWindUrl(lat, lon, startMs, endMs);
  const payload = await fetchOpenMeteoJson(requestUrl);
  const hourly = payload.hourly || {};
  const speedIntervals = parseOpenMeteoHourlyWindIntervals(hourly, startMs, endMs);
  if (!speedIntervals.length) {
    throw new Error("Open-Meteo historical wind response did not include any usable hourly wind speeds.");
  }

  const chopIntervals = speedIntervals.map((point) => ({
    ...point,
    value: estimateChopHeightMeters(point.value),
  }));

  const series = {
    sourceKind: "historical-open-meteo",
    sourceLabel: "Open-Meteo historical reanalysis",
    requestUrl,
    latitude: payload.latitude ?? lat,
    longitude: payload.longitude ?? lon,
    elevation: payload.elevation ?? null,
    generationTimeMs: payload.generationtime_ms ?? null,
    timezone: payload.timezone || "GMT",
    startMs,
    endMs,
    chopIntervals,
    speedPoints: buildIntervalStepPoints(speedIntervals),
    chopPoints: buildIntervalStepPoints(chopIntervals),
    speedIntervalCount: speedIntervals.length,
    chopIntervalCount: chopIntervals.length,
  };

  console.info("[FASTER Open-Meteo] Loaded historical wind data.", {
    transect: transect.label,
    latitude: series.latitude,
    longitude: series.longitude,
    speedIntervals: series.speedIntervalCount,
    chopIntervals: series.chopIntervalCount,
  });

  state.windCache.set(cacheKey, {
    series,
    expiresAtMs: nowMs + NWS_WIND_CACHE_TTL_MS,
  });
  return series;
}

function buildOpenMeteoHistoricalWindUrl(lat, lon, startMs, endMs) {
  const endDateMs = Math.max(startMs, endMs - 1);
  const params = new URLSearchParams({
    latitude: lat.toFixed(5),
    longitude: lon.toFixed(5),
    start_date: formatIsoDate(startMs),
    end_date: formatIsoDate(endDateMs),
    hourly: "wind_speed_10m,wind_direction_10m",
    wind_speed_unit: "kmh",
    timezone: "GMT",
    cell_selection: "sea",
  });
  return `${OPEN_METEO_HISTORICAL_URL}?${params.toString()}`;
}

async function fetchOpenMeteoJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = payload?.reason || payload?.error || `status ${response.status}`;
    throw new Error(`Open-Meteo historical wind request failed: ${reason}`);
  }
  return payload;
}

function parseOpenMeteoHourlyWindIntervals(hourly, windowStartMs, windowEndMs) {
  const times = hourly?.time || [];
  const speeds = hourly?.wind_speed_10m || [];
  return times
    .map((timeText, index) => {
      const startMs = Date.parse(`${timeText}Z`);
      const value = Number(speeds[index]);
      if (!Number.isFinite(startMs) || !Number.isFinite(value)) {
        return null;
      }
      const endMs = startMs + MS_PER_HOUR;
      if (endMs <= windowStartMs || startMs >= windowEndMs) {
        return null;
      }
      return {
        startMs: Math.max(startMs, windowStartMs),
        endMs: Math.min(endMs, windowEndMs),
        value,
      };
    })
    .filter(Boolean)
    .filter((interval) => interval.endMs > interval.startMs);
}

function createHistoricalWindUnavailableSeries(tideWindow, message = "Historical wind data are unavailable; hindcast chop is set to 0.") {
  return {
    historicalUnavailable: true,
    emptyMessage: message,
    startMs: tideWindow.startMs,
    endMs: tideWindow.endMs,
    chopIntervals: [],
    speedPoints: [],
    chopPoints: [],
    speedIntervalCount: 0,
    chopIntervalCount: 0,
  };
}

async function fetchNwsJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json",
    },
  });
  if (!response.ok) {
    throw new Error(`NWS request failed for ${url} with status ${response.status}`);
  }
  return response.json();
}

function parseNwsGridLayerIntervals(layer, windowStartMs, windowEndMs) {
  return (layer?.values || [])
    .map((row) => {
      const interval = parseNwsValidTimeInterval(row.validTime);
      const value = Number(row.value);
      if (!interval || !Number.isFinite(value)) {
        return null;
      }
      const start = Math.max(interval.startMs, windowStartMs);
      const end = Math.min(interval.endMs, windowEndMs);
      if (end < windowStartMs || start > windowEndMs || end <= start) {
        return null;
      }
      return { startMs: start, endMs: end, value };
    })
    .filter(Boolean)
    .sort((left, right) => left.startMs - right.startMs);
}

function parseNwsValidTimeInterval(validTime) {
  if (typeof validTime !== "string") {
    return null;
  }

  const [startText, durationText] = validTime.split("/");
  const startMs = Date.parse(startText);
  const durationMs = parseIsoDurationMs(durationText);
  if (!Number.isFinite(startMs) || !Number.isFinite(durationMs)) {
    return null;
  }

  return {
    startMs,
    endMs: startMs + durationMs,
  };
}

function parseIsoDurationMs(durationText) {
  if (typeof durationText !== "string") {
    return NaN;
  }

  const match = durationText.match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  );
  if (!match) {
    return NaN;
  }

  const [, days = 0, hours = 0, minutes = 0, seconds = 0] = match;
  return (
    Number(days) * MS_PER_DAY +
    Number(hours) * 60 * MS_PER_MINUTE +
    Number(minutes) * MS_PER_MINUTE +
    Number(seconds) * 1000
  );
}

function normalizeNwsWindSpeedKmh(value, unitCode) {
  if (!Number.isFinite(value)) {
    return NaN;
  }
  if (unitCode.includes("km_h-1")) {
    return value;
  }
  if (unitCode.includes("mi_h-1")) {
    return value / MPH_PER_KMH;
  }
  if (unitCode.includes("m_s-1")) {
    return value * 3.6;
  }
  if (unitCode.includes("kt")) {
    return value * 1.852;
  }
  return value;
}

function estimateChopHeightMeters(windSpeedKmh) {
  const windSpeedMps = Math.max(0, windSpeedKmh * MPS_PER_KMH);
  if (windSpeedMps <= 0) {
    return 0;
  }

  // Four-second Pierson-Moskowitz high-frequency-tail proxy from Chop Height Proxy Model.pdf.
  const cutoffRatio = (PM_PEAK_FREQUENCY_COEFFICIENT * GRAVITY_MPS2 * CHOP_PROXY_MAX_PERIOD_SECONDS) / windSpeedMps;
  const shortPeriodFraction = 1 - Math.exp(-PM_SHAPE_COEFFICIENT * cutoffRatio ** 4);
  return PM_CHOP_HEIGHT_COEFFICIENT * (windSpeedMps ** 2 / GRAVITY_MPS2) * Math.sqrt(Math.max(shortPeriodFraction, 0));
}

function buildIntervalStepPoints(intervals) {
  const points = [];
  intervals.forEach((interval) => {
    points.push({ x: interval.startMs, y: interval.value });
    points.push({ x: interval.endMs, y: interval.value });
  });
  return points;
}

function findIntervalValueAtTime(intervals, targetMs, fallbackValue = null) {
  if (!intervals?.length || !Number.isFinite(targetMs)) {
    return fallbackValue;
  }

  const containingInterval = intervals.find((interval) => targetMs >= interval.startMs && targetMs <= interval.endMs);
  return containingInterval ? containingInterval.value : fallbackValue;
}

async function loadSeaLevelAnomalyEstimate(stationId, window = null) {
  const cacheKey = window
    ? `${stationId}:${NOAA_VERTICAL_DATUM}:${window.startMs}:${window.endMs}`
    : `${stationId}:${NOAA_VERTICAL_DATUM}`;
  const cached = state.seaLevelAnomalyCache.get(cacheKey);
  const nowMs = Date.now();
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.estimate;
  }

  const endMs = window
    ? floorUtcTimeToMinuteInterval(window.endMs, SEA_LEVEL_ANOMALY_INTERVAL_MINUTES)
    : floorUtcTimeToMinuteInterval(
      nowMs - SEA_LEVEL_ANOMALY_END_LAG_MINUTES * MS_PER_MINUTE,
      SEA_LEVEL_ANOMALY_INTERVAL_MINUTES
    );
  const startMs = window
    ? floorUtcTimeToMinuteInterval(window.startMs, SEA_LEVEL_ANOMALY_INTERVAL_MINUTES)
    : endMs - SEA_LEVEL_ANOMALY_LOOKBACK_DAYS * MS_PER_DAY;

  const [observedSeries, predictedSeries] = await Promise.all([
    loadNoaaWaterLevelSeries({
      stationId,
      product: "water_level",
      startMs,
      endMs,
    }),
    loadNoaaWaterLevelSeries({
      stationId,
      product: "predictions",
      interval: String(SEA_LEVEL_ANOMALY_INTERVAL_MINUTES),
      startMs,
      endMs,
    }),
  ]);

  const residuals = pairObservedAndPredictedResiduals(observedSeries, predictedSeries);
  if (residuals.length < SEA_LEVEL_ANOMALY_MIN_PAIR_COUNT) {
    throw new Error(`Only ${residuals.length} paired water-level residuals were available.`);
  }

  const estimate = {
    stationId,
    startMs,
    endMs,
    anomaly: mean(residuals),
    pairCount: residuals.length,
    observedCount: observedSeries.length,
    predictedCount: predictedSeries.length,
    isHistoricalWindow: Boolean(window),
  };
  state.seaLevelAnomalyCache.set(cacheKey, {
    estimate,
    expiresAtMs: nowMs + SEA_LEVEL_ANOMALY_CACHE_TTL_MS,
  });
  return estimate;
}

async function loadNoaaWaterLevelSeries({ stationId, product, interval, startMs, endMs }) {
  const params = new URLSearchParams({
    begin_date: formatNoaaDate(startMs),
    end_date: formatNoaaDate(endMs),
    station: stationId,
    product,
    datum: NOAA_VERTICAL_DATUM,
    units: "metric",
    time_zone: "gmt",
    format: "json",
    application: NOAA_APPLICATION_ID,
  });
  if (interval) {
    params.set("interval", interval);
  }

  const requestUrl = `${NOAA_PREDICTIONS_URL}?${params.toString()}`;
  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`NOAA ${product} request failed with ${response.status}`);
  }

  const payload = await response.json();
  const rows = product === "predictions" ? payload.predictions : payload.data;
  if (!rows) {
    throw new Error(payload.error?.message || `NOAA ${product} payload did not include data.`);
  }

  return rows
    .map((row) => ({
      timeMs: Date.parse(`${row.t}Z`),
      level: Number(row.v),
    }))
    .filter((point) => Number.isFinite(point.timeMs) && Number.isFinite(point.level))
    .sort((left, right) => left.timeMs - right.timeMs);
}

function pairObservedAndPredictedResiduals(observedSeries, predictedSeries) {
  const predictedByTime = new Map(predictedSeries.map((point) => [point.timeMs, point.level]));
  const residuals = [];

  observedSeries.forEach((observedPoint) => {
    const exactPrediction = predictedByTime.get(observedPoint.timeMs);
    const predictedLevel = Number.isFinite(exactPrediction)
      ? exactPrediction
      : findNearestLevelWithin(predictedSeries, observedPoint.timeMs, SEA_LEVEL_ANOMALY_PAIR_TOLERANCE_MS);
    if (Number.isFinite(predictedLevel)) {
      residuals.push(observedPoint.level - predictedLevel);
    }
  });

  return residuals;
}

function findNearestLevelWithin(series, targetMs, toleranceMs) {
  let bestLevel = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  series.forEach((point) => {
    const delta = Math.abs(point.timeMs - targetMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestLevel = point.level;
    }
  });

  return bestDelta <= toleranceMs ? bestLevel : null;
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

  const maxCrest = input.tideLevel + breakingSummary.breakingWaveHeight * MAX_WAVE_RATIO * CREST_RATIO;
  const maxWaveSplashUp =
    input.tideLevel + 2.0 * breakingSummary.breakingWaveHeight * MAX_WAVE_RATIO * CREST_RATIO;

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
  const longPeriodSwellUncertaintyFactor = getLongPeriodSwellUncertaintyFactor(peakPeriod);
  const expectedRunup = meanRunup;
  const conservativeRunup = meanRunup + longPeriodSwellUncertaintyFactor * stdDevRunup;
  const upperBoundRunup = conservativeRunup + waveHeightVariability;
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
    localChopHeight: input.localChopHeight,
    waveHeightTotal: input.waveHeightTotal,
    peakWavePeriod: input.peakWavePeriod,
    waveDirection: input.waveDirection,
    relativeAngleDeg: shallowRelativeAngleDeg,
    deepWaterWaveHeight: Ho,
    maxCrest,
    maxWaveSplashUp,
    breakingDepth: breakingSummary.breakingDepth,
    breakingWaveHeight: breakingSummary.breakingWaveHeight,
    expectedRunup,
    conservativeRunup,
    upperBoundRunup,
    stdDevRunup,
    longPeriodSwellUncertaintyFactor,
    waveHeightVariability,
    category,
  };
}

function getLongPeriodSwellUncertaintyFactor(peakPeriodSeconds) {
  const period = Number(peakPeriodSeconds);
  if (!Number.isFinite(period)) {
    return 1;
  }
  return (Math.max(period, 0) / 18) ** 4;
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
  if (state.windChart) {
    state.windChart.destroy();
    state.windChart = null;
  }
}

function renderTideOnlyPreview(tideSeries, tideWindow) {
  const tidePoints = tideSeries.timeMs.map((timeMs, index) => ({ x: timeMs, y: convertElevationForDisplay(tideSeries.level[index]) }));
  const timeMin = getPlaybackStartTime(tideSeries.timeMs, tideWindow.startMs);
  const timeMax = tideWindow.endMs;

  dom.waveChartTitle.textContent = `MOP Wave Forecast - Transect ${state.selectedTransect.label}`;
  dom.tideChartTitle.textContent = formatTideChartTitle(state.selectedTideStation || { id: tideSeries.stationId });
  dom.windChartTitle.textContent = "NWS Wind Forecast";

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
            text: ["Tide Level", getVerticalDatumUnitLabel()],
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

  state.windChart = new Chart(dom.windCanvas, {
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
          message: "Wind forecast will load with a MOP forecast window.",
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
        ySpeed: {
          min: 0,
          display: false,
          grid: { display: false },
          border: { display: false },
        },
        yChop: {
          position: "right",
          min: 0,
          display: false,
          grid: { display: false },
          border: { display: false },
        },
      },
    },
  });

  dom.forecastWindowLabel.textContent = `${formatShortDateTime(timeMin)} to ${formatShortDateTime(timeMax)} ${getTimeModeLabel()}`;
}

function renderCharts(forecastDataset, tideSeries, windSeries = null) {
  const wavePoints = forecastDataset.waveTimeMs.map((timeMs, index) => ({ x: timeMs, y: convertElevationForDisplay(forecastDataset.waveHs[index]) }));
  const periodPoints = forecastDataset.waveTimeMs.map((timeMs, index) => ({ x: timeMs, y: forecastDataset.waveTp[index] }));
  const tidePoints = tideSeries.timeMs.map((timeMs, index) => ({ x: timeMs, y: convertElevationForDisplay(tideSeries.level[index]) }));
  const windSpeedPoints = (windSeries?.speedPoints || []).map((point) => ({ x: point.x, y: convertWindSpeedForDisplay(point.y) }));
  const chopPoints = (windSeries?.chopPoints || []).map((point) => ({ x: point.x, y: convertLengthForDisplay(point.y) }));
  const hasWindData = Boolean(windSpeedPoints.length || chopPoints.length);
  const timeMin = getPlaybackStartTime(forecastDataset.waveTimeMs, forecastDataset.waveTimeMs[0]);
  const timeMax = forecastDataset.waveTimeMs.at(-1);

  dom.waveChartTitle.textContent = `MOP Wave Forecast - Transect ${state.selectedTransect.label}`;
  dom.tideChartTitle.textContent = formatTideChartTitle(state.selectedTideStation || { id: tideSeries.stationId });
  dom.windChartTitle.textContent = formatWindChartTitle(windSeries);

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
            text: ["Tide Level", getVerticalDatumUnitLabel()],
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

  state.windChart = new Chart(dom.windCanvas, {
    type: "line",
    data: {
      datasets: hasWindData
        ? [
          {
            label: `Wind Speed (${getWindSpeedUnitLabel()})`,
            data: windSpeedPoints,
            borderColor: COLORS.goldDeep,
            backgroundColor: "rgba(215,167,79,0.14)",
            borderWidth: 2.5,
            pointRadius: 0,
            stepped: true,
            yAxisID: "ySpeed",
          },
          {
            label: `Chop Height (${state.displayUnits === "english" ? "ft" : "m"})`,
            data: chopPoints,
            borderColor: COLORS.navy,
            borderDash: [6, 5],
            borderWidth: 2.3,
            pointRadius: 0,
            stepped: true,
            yAxisID: "yChop",
          },
        ]
        : [],
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
        emptyStateMessage: {
          message: windSeries?.emptyMessage || "Wind data were unavailable for this playback window.",
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
        ySpeed: {
          position: "left",
          beginAtZero: true,
          title: {
            display: true,
            text: ["Wind Speed", `(${getWindSpeedUnitLabel()})`],
            color: COLORS.goldDeep,
          },
          ticks: { color: COLORS.goldDeep },
          border: { color: COLORS.goldDeep },
          grid: { color: "rgba(17,49,76,0.08)" },
          afterFit(axis) {
            axis.width = FIXED_AXIS_WIDTH;
          },
        },
        yChop: {
          position: "right",
          min: 0,
          title: {
            display: true,
            text: ["Chop Height", state.displayUnits === "english" ? "(ft)" : "(m)"],
            color: COLORS.navy,
          },
          ticks: {
            color: COLORS.navy,
          },
          border: { color: COLORS.navy },
          grid: { drawOnChartArea: false },
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

  const playbackStartIndex = getPlaybackStartIndex(state.results);
  if (state.currentIndex < playbackStartIndex) {
    state.currentIndex = playbackStartIndex;
  }

  const current = state.results[state.currentIndex];
  const forecastResults = getForecastResultsWindow(state.results);
  const worstCategory = getWorstOvertoppingCategory(forecastResults) || current.category;
  dom.timeSlider.value = String(state.currentIndex);
  dom.sliderTimeLabel.textContent = formatShortDateTime(current.timeMs);
  dom.sliderIndexLabel.textContent = `${state.currentIndex - playbackStartIndex + 1} / ${state.results.length - playbackStartIndex}`;
  dom.currentTimeLabel.textContent = `${formatShortDateTime(current.timeMs)} ${getTimeModeLabel()}`;

  dom.metricGrid.innerHTML = [
    makeMetricCard("Wave Hs", formatDisplayLength(current.waveHeightSwell, 2)),
    makeMetricCard("Local Chop", formatDisplayLength(current.localChopHeight, 2)),
    makeMetricCard("Peak Period", `${current.peakWavePeriod.toFixed(1)} s`),
    makeMetricCard("Tide + Anomaly", formatDisplayLength(current.tideLevel, 2)),
    makeMetricCard("Max Crest", formatDisplayLength(current.maxCrest, 2)),
    makeMetricCard("Expected 2%", formatDisplayLength(current.expectedRunup, 2)),
    makeMetricCard("Conservative", formatDisplayLength(current.conservativeRunup, 2)),
    makeMetricCard("Upper Bound", formatDisplayLength(current.upperBoundRunup, 2)),
  ].join("");

  const profile = buildBeachProfile(state.modelParams);
  const figureAspectRatio = getContainerAspectRatio(dom.runupProfile, DEFAULT_FIGURE_RATIO);
  const pierDeckMaxElevation = getPierDeckMaxElevation(state.selectedPierTransect);
  const hasPierDeck = Boolean(state.selectedPierTransect);
  const runupOverlays = [
    { label: "Still Water", value: current.tideLevel, color: COLORS.waterEdge, dash: "", mode: "water", extendLeftToAxis: true },
    { label: "Max Crest", value: current.maxCrest, color: COLORS.black, dash: "10 6", mode: "crest", extendLeftToAxis: true },
    ...(hasPierDeck
      ? [{
        label: "Max Wave Splash-up",
        value: current.maxWaveSplashUp,
        color: "#8a8f98",
        dash: "6 7",
        mode: "crest",
        strokeWidth: 2,
        extendLeftToAxis: true,
      }]
      : []),
    { label: "Expected Runup", value: current.expectedRunup, color: COLORS.green, dash: "12 8", mode: "runup" },
    { label: "Conservative Runup", value: current.conservativeRunup, color: COLORS.yellow, dash: "12 8", mode: "runup" },
    { label: "Upper Bound Runup", value: current.upperBoundRunup, color: COLORS.coral, dash: "12 8", mode: "runup" },
  ];
  dom.runupProfile.innerHTML = renderProfileSvg({
    profile,
    overlays: runupOverlays,
    pierDeck: state.selectedPierTransect,
    waterLevel: current.tideLevel,
    yMin: -5,
    yMax: Math.max(
      state.modelParams.duneCrestElevation + 1.2,
      current.upperBoundRunup + 1.2,
      current.maxCrest + 1.2,
      (hasPierDeck ? current.maxWaveSplashUp + 0.8 : Number.NEGATIVE_INFINITY),
      pierDeckMaxElevation + 0.8
    ),
    title: `Runup profile at ${formatShortDateTime(current.timeMs)} ${getTimeModeLabel()} - ${current.category.figureLabel}`,
    figureAspectRatio,
    footerLines: [],
    showLegend: true,
  });

  dom.categoryPill.textContent = formatForecastOvertoppingLabel(worstCategory, forecastResults);
  dom.categoryPill.style.background = worstCategory.background;
  dom.categoryPill.style.color = worstCategory.color;
  dom.playPauseButton.textContent = state.isPlaying ? "Pause" : "Play";

  if (state.waveChart) {
    state.waveChart.options.plugins.currentTimeLine.value = current.timeMs;
    state.waveChart.update("none");
  }
  if (state.tideChart) {
    state.tideChart.options.plugins.currentTimeLine.value = current.timeMs;
    state.tideChart.update("none");
  }
  if (state.windChart) {
    state.windChart.options.plugins.currentTimeLine.value = current.timeMs;
    state.windChart.update("none");
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

  const playbackStartIndex = getPlaybackStartIndex(state.results);
  if (state.currentIndex < playbackStartIndex) {
    state.currentIndex = playbackStartIndex;
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

function parseKnownTransectProfiles(csvText) {
  const profiles = new Map();
  parseCsv(csvText || "").forEach((row) => {
    const label = normalizeTransectLabel(row.Transect || row.transect || row.Label || row.label);
    if (!label) {
      return;
    }

    const profile = removeUndefinedValues({
      averageBeachSlope: parseFiniteCsvNumber(row["Face Slope"]),
      beachElevationBase: parseFiniteCsvNumber(row["Toe Elevation"]),
      bermWidth: parseFiniteCsvNumber(row["Toe Distance"]),
      duneCrestElevation: parseFiniteCsvNumber(row["Crest Elevation"]),
      toeToCrestDistance: parseFiniteCsvNumber(row["Crest Distance"]),
    });
    if (Object.keys(profile).length) {
      profiles.set(label, profile);
    }
  });

  console.info("[FASTER Explorer] Loaded known transect beach profiles.", {
    count: profiles.size,
    source: KNOWN_TRANSECTS_CSV_URL,
  });
  return profiles;
}

function parsePierTransectPoints(csvText) {
  return parseCsv(csvText || "")
    .map((row) => ({
      offshoreDistance: parseFiniteCsvNumber(row.x ?? row.X),
      elevation: parseFiniteCsvNumber(row.z ?? row.Z),
    }))
    .filter((point) => Number.isFinite(point.offshoreDistance) && Number.isFinite(point.elevation));
}

function parseFiniteCsvNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function removeUndefinedValues(rawObject) {
  return Object.entries(rawObject).reduce((cleanObject, [key, value]) => {
    if (value !== undefined) {
      cleanObject[key] = value;
    }
    return cleanObject;
  }, {});
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
      rank: 3,
      label: "Significant overtopping probable",
      forecastLabel: "Significant Overtopping probable",
      figureLabel: "Significant Overtopping Probable",
      background: "rgba(229, 103, 82, 0.18)",
      color: "#9b2f1d",
    };
  }
  if (conservativeRunup > duneCrestElevation) {
    return {
      rank: 2,
      label: "Moderate overtopping possible",
      forecastLabel: "Moderate Overtopping possible",
      figureLabel: "Moderate Overtopping Possible",
      background: "rgba(243, 194, 107, 0.22)",
      color: "#8a5d0a",
    };
  }
  if (upperBoundRunup > duneCrestElevation) {
    return {
      rank: 1,
      label: "Minor overtopping possible",
      forecastLabel: "Minor Overtopping possible",
      figureLabel: "Minor Overtopping Possible",
      background: "rgba(34, 183, 167, 0.18)",
      color: "#0d6b61",
    };
  }
  return {
    rank: 0,
    label: "Overtopping not expected",
    forecastLabel: "Overtopping not expected",
    figureLabel: "Overtopping Not Expected",
    background: "rgba(17, 49, 76, 0.12)",
    color: "#11314c",
  };
}

function getWorstOvertoppingCategory(results) {
  if (!results?.length) {
    return null;
  }

  return results.reduce((worstCategory, result) => {
    if (!worstCategory || result.category.rank > worstCategory.rank) {
      return result.category;
    }
    return worstCategory;
  }, null);
}

function getForecastResultsWindow(results) {
  if (!results?.length) {
    return [];
  }

  const playbackStartIndex = getPlaybackStartIndex(results);
  return results.slice(playbackStartIndex);
}

function getPlaybackStartIndex(results) {
  if (!results?.length) {
    return 0;
  }
  if (state.hindcastWindow) {
    return 0;
  }

  const nowMs = Date.now();
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index].timeMs <= nowMs) {
      return index;
    }
  }
  return 0;
}

function getPlaybackStartTime(timeValues, fallbackTime) {
  if (!timeValues?.length) {
    return fallbackTime;
  }
  if (state.hindcastWindow) {
    return timeValues[0] ?? fallbackTime;
  }

  const nowMs = Date.now();
  for (let index = timeValues.length - 1; index >= 0; index -= 1) {
    if (timeValues[index] <= nowMs) {
      return timeValues[index];
    }
  }
  return timeValues[0] ?? fallbackTime;
}

function formatForecastOvertoppingLabel(category, results) {
  if (!category) {
    return "--";
  }

  const startMs = results?.[0]?.timeMs;
  const endMs = results?.at(-1)?.timeMs;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return category.forecastLabel;
  }

  const dayCount = Math.max(1, Math.ceil((endMs - startMs) / MS_PER_DAY));
  if (state.hindcastWindow) {
    return `${category.forecastLabel} over selected ${dayCount} day${dayCount === 1 ? "" : "s"}`;
  }
  return `${category.forecastLabel} over next ${dayCount} day${dayCount === 1 ? "" : "s"}`;
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

function floorUtcTimeToMinuteInterval(timeMs, intervalMinutes) {
  const date = new Date(timeMs);
  const minutes = date.getUTCMinutes();
  date.setUTCMinutes(minutes - (minutes % intervalMinutes), 0, 0);
  return date.getTime();
}

function floorUtcTimeToHour(timeMs) {
  const date = new Date(timeMs);
  date.setUTCMinutes(0, 0, 0);
  return date.getTime();
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

function convertWindSpeedForDisplay(valueKmh) {
  return state.displayUnits === "english" ? valueKmh * MPH_PER_KMH : valueKmh;
}

function getWindSpeedUnitLabel() {
  return state.displayUnits === "english" ? "mph" : "km/h";
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

function getPierDeckMaxElevation(pierDeck) {
  if (!pierDeck?.points?.length) {
    return Number.NEGATIVE_INFINITY;
  }
  return Math.max(...pierDeck.points.map((point) => point.elevation).filter(Number.isFinite));
}

function formatWindChartTitle(windSeries) {
  if (windSeries?.historicalUnavailable) {
    return "Historical Wind/Chop Unavailable";
  }
  if (windSeries?.sourceKind === "historical-open-meteo") {
    return "Open-Meteo Historical Wind - Reanalysis";
  }
  if (windSeries?.gridId && windSeries.gridX !== null && windSeries.gridY !== null) {
    return `NWS Wind Forecast - ${windSeries.gridId}/${windSeries.gridX},${windSeries.gridY}`;
  }
  return "NWS Wind Forecast";
}

function getDistanceAxisLabel() {
  return `Cross-shore distance (${state.displayUnits === "english" ? "ft" : "m"})`;
}

function getElevationAxisLabel() {
  return `Elevation ${getVerticalDatumUnitLabel()}`;
}

function getVerticalDatumUnitLabel() {
  return state.displayUnits === "english"
    ? `(ft, ${DISPLAY_VERTICAL_DATUM})`
    : `(m, ${DISPLAY_VERTICAL_DATUM})`;
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

function formatIsoDate(timeMs) {
  if (!Number.isFinite(timeMs)) {
    return "";
  }
  return new Date(timeMs).toISOString().slice(0, 10);
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

function formatShortUtcDateTime(timeMs) {
  if (!Number.isFinite(timeMs)) {
    return "";
  }
  return new Date(timeMs).toLocaleString("en-US", {
    timeZone: "UTC",
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

function fetchOptionalText(url, options = {}) {
  return fetch(url)
    .then((response) => {
      if (response.status === 404) {
        return "";
      }
      if (!response.ok) {
        throw new Error(`Request failed for ${url} with status ${response.status}`);
      }
      return response.text();
    })
    .catch((error) => {
      if (!options.suppressMissingWarning) {
        console.warn(`[FASTER Explorer] Optional file unavailable: ${url}`, error);
      }
      return "";
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
