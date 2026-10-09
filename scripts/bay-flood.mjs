export const BAY_STEP_MS = 6 * 60 * 1000;
export const BAY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_BAY_UNCERTAINTY_METERS = 0.0762; // 0.25 ft
export const BAY_MAJOR_EXCEEDANCE_METERS = 0.1524; // 0.5 ft above ground/structure

function category(rank, label) {
  return { rank, label, figureLabel: label, forecastLabel: label,
    background: rank === 3 ? "rgba(153,15,30,0.24)" : rank === 2 ? "rgba(204,75,55,0.18)" : rank === 1 ? "rgba(243,194,55,0.24)" : "rgba(17,49,76,0.12)",
    color: rank === 3 ? "#780b17" : rank === 2 ? "#9b2f1d" : rank === 1 ? "#80600c" : "#11314c" };
}

export function classifyBayFlooding(waterLevel, uncertaintyElevation, chopElevation, groundElevation) {
  if (!Number.isFinite(groundElevation) || !Number.isFinite(waterLevel)) return category(null, "Water level + anomaly unavailable");
  if (waterLevel > groundElevation + BAY_MAJOR_EXCEEDANCE_METERS) return category(3, "Major flooding expected");
  if (waterLevel > groundElevation) return category(2, "Moderate flooding expected");
  if (!Number.isFinite(uncertaintyElevation)) return category(null, "Water-level uncertainty unavailable");
  if (uncertaintyElevation > groundElevation) return category(2, "Moderate flooding expected");
  if (!Number.isFinite(chopElevation)) return category(null, "Chop unavailable; water + uncertainty below ground");
  if (chopElevation > groundElevation) return category(1, "Minor flooding expected");
  return category(0, "Flooding not expected");
}

export function computeBayResults({ tideSeries, windSeries, anomaly, groundElevation, uncertainty = DEFAULT_BAY_UNCERTAINTY_METERS, startMs, endMs }) {
  return (tideSeries?.timeMs || []).flatMap((timeMs, index) => {
    const predictedTide = tideSeries.level[index];
    if (!Number.isFinite(timeMs) || timeMs < startMs || timeMs > endMs || !Number.isFinite(predictedTide)) return [];
    const interval = windSeries?.chopIntervals?.find(row => timeMs >= row.startMs && timeMs < row.endMs);
    const chopHeight = Number.isFinite(interval?.value) && interval.value >= 0 ? interval.value : null;
    const waterLevel = Number.isFinite(anomaly) ? predictedTide + anomaly : null;
    const uncertaintyElevation = waterLevel !== null && Number.isFinite(uncertainty) && uncertainty >= 0 ? waterLevel + uncertainty : null;
    const chopElevation = uncertaintyElevation !== null && chopHeight !== null ? uncertaintyElevation + chopHeight : null;
    return [{ timeMs, predictedTide, waterLevel, uncertainty, uncertaintyElevation, chopHeight, chopElevation,
      category: classifyBayFlooding(waterLevel, uncertaintyElevation, chopElevation, groundElevation) }];
  });
}

export function summarizeBayResults(results) {
  const assessed = results.filter(row => row.category.rank !== null);
  const worst = assessed.reduce((selected, row) => !selected || row.category.rank > selected.rank ? row.category : selected, null);
  return { category: worst || category(null, "Flooding assessment unavailable"),
    hasGaps: assessed.length !== results.length || results.some((row, i) => i && row.timeMs - results[i - 1].timeMs > BAY_STEP_MS),
  };
}

export function buildBayFloodWindows(results) {
  const bands = [];
  for (const row of results) {
    if (!(row.category.rank > 0)) continue;
    const band = { start: row.timeMs - BAY_STEP_MS / 2, end: row.timeMs + BAY_STEP_MS / 2, rank: row.category.rank };
    const previous = bands.at(-1);
    if (previous?.end === band.start && previous.rank === band.rank) previous.end = band.end;
    else bands.push(band);
  }
  return bands;
}

export function nearestEntranceIndex(dataset, timeMs) {
  const times = dataset?.waveTimeMs || [];
  if (!times.length || timeMs < times[0] || timeMs > times.at(-1)) return -1;
  return times.reduce((nearest, value, index) => Math.abs(value - timeMs) < Math.abs(times[nearest] - timeMs) ? index : nearest, 0);
}

// Calculate once per forecast/geometry change, never from the current playback row.
export function getBayPlotLimits(results, groundElevation) {
  const values = [groundElevation, 0, ...results.flatMap(row => [row.waterLevel, row.uncertaintyElevation, row.chopElevation])].filter(Number.isFinite);
  return { yMin: Math.min(-5, ...values.map(value => value - 1.2)),
    yMax: Math.max(4.5, ...values.map(value => value + 1.2)) };
}

export function buildBayWallProfile(groundElevation, yMin) {
  // Horizontal position is schematic; the vertical face is not a beach slope.
  return { x: [0, 64, 64, 100], y: [yMin, yMin, groundElevation, groundElevation], xEnd: 100 };
}
