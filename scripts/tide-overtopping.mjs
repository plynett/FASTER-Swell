const DEFAULT_HALF_WIDTH_MS = 30 * 60 * 1000;
const EXTENDED_HALF_WIDTH_MS = 90 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function tideAtTime(tideSeries, targetMs) {
  const times = tideSeries?.timeMs;
  const levels = tideSeries?.level;
  if (!times?.length || !levels || targetMs < times[0] || targetMs > times.at(-1)) return null;
  let low = 0;
  let high = times.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (times[middle] < targetMs) low = middle + 1;
    else high = middle;
  }
  if (times[low] === targetMs) return Number.isFinite(levels[low]) ? levels[low] : null;
  const before = low - 1;
  const gap = times[low] - times[before];
  // Interpolate hourly NOAA predictions, never extrapolate or bridge missing hours.
  if (!(gap > 0 && gap <= HOUR_MS) || !Number.isFinite(levels[before]) || !Number.isFinite(levels[low])) return null;
  return levels[before] + (levels[low] - levels[before]) * (targetMs - times[before]) / gap;
}

export function buildOvertoppingWindows(results = [], tideSeries = null) {
  const windows = results
    .filter((result) => Number.isFinite(result.timeMs) && result.category?.rank > 0)
    .map((result) => {
      const current = tideAtTime(tideSeries, result.timeMs);
      const before = tideAtTime(tideSeries, result.timeMs - DEFAULT_HALF_WIDTH_MS);
      const after = tideAtTime(tideSeries, result.timeMs + DEFAULT_HALF_WIDTH_MS);
      const extendBefore = current !== null && before !== null && before > current;
      const extendAfter = current !== null && after !== null && after > current;
      return {
        start: result.timeMs - (extendBefore ? EXTENDED_HALF_WIDTH_MS : DEFAULT_HALF_WIDTH_MS),
        end: result.timeMs + (extendAfter ? EXTENDED_HALF_WIDTH_MS : DEFAULT_HALF_WIDTH_MS),
        rank: result.category.rank >= 2 ? 2 : 1,
      };
    });
  const times = [...new Set(windows.flatMap((window) => [window.start, window.end]))].sort((a, b) => a - b);
  const bands = [];
  for (let index = 0; index < times.length - 1; index++) {
    const start = times[index];
    const end = times[index + 1];
    const midpoint = (start + end) / 2;
    const rank = windows.reduce((severity, window) =>
      midpoint >= window.start && midpoint < window.end ? Math.max(severity, window.rank) : severity, 0);
    if (!rank) continue;
    const previous = bands.at(-1);
    if (previous?.end === start && previous.rank === rank) previous.end = end;
    else bands.push({ start, end, rank });
  }
  return bands;
}

export const overtoppingBackgroundPlugin = {
  id: "overtoppingBackground",
  beforeDatasetsDraw(chart, args, options) {
    if (!chart.chartArea || !chart.scales.x || !options?.windows?.length) return;
    const { left, right, top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();
    for (const window of options.windows) {
      const start = Math.max(left, chart.scales.x.getPixelForValue(window.start));
      const end = Math.min(right, chart.scales.x.getPixelForValue(window.end));
      if (end <= start) continue;
      ctx.fillStyle = window.rank >= 2 ? "rgba(204,75,55,0.22)" : "rgba(243,194,55,0.30)";
      ctx.fillRect(start, top, end - start, bottom - top);
    }
    ctx.restore();
  },
};
