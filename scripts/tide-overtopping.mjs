const HALF_HOUR_MS = 30 * 60 * 1000;

export function buildOvertoppingWindows(results = []) {
  const windows = results
    .filter((result) => Number.isFinite(result.timeMs) && result.category?.rank > 0)
    .map((result) => ({
      start: result.timeMs - HALF_HOUR_MS,
      end: result.timeMs + HALF_HOUR_MS,
      rank: result.category.rank >= 2 ? 2 : 1,
    }));
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
