// Hasselmann JONSWAP fetch relations: BOEM 2018-057, Eq. 5-13 / Table 5-3.
// U10 is in m/s, fetch in m, S(f) in m^2/Hz. No depth/duration correction.
export function estimateFetchLimitedChopMeters(windSpeedKmh, fetchMeters, cutoffPeriodSeconds = 4) {
  if (!Number.isFinite(windSpeedKmh) || windSpeedKmh < 0
    || !Number.isFinite(fetchMeters) || fetchMeters <= 0
    || !Number.isFinite(cutoffPeriodSeconds) || cutoffPeriodSeconds <= 0) return null;
  if (windSpeedKmh === 0) return 0;
  const g = 9.81;
  const u10 = windSpeedKmh / 3.6;
  const dimensionlessFetch = g * fetchMeters / u10 ** 2;
  const alpha = 0.076 * dimensionlessFetch ** -0.22;
  const fp = 3.5 * g / u10 * dimensionlessFetch ** -0.33;

  // Substitute r = fp/f: integrates the entire high-frequency tail to infinity,
  // without choosing an arbitrary upper frequency or missing a narrow peak.
  // At r >= 8, exp(-1.25*r^4) is numerically zero.
  const upper = Math.min(fp * cutoffPeriodSeconds, 8);
  const count = 2048;
  const step = upper / count;
  const integrand = r => {
    if (r === 0) return 0;
    const sigma = r >= 1 ? 0.07 : 0.09;
    const peak = Math.exp(-((1 / r - 1) ** 2) / (2 * sigma ** 2));
    return r ** 3 * Math.exp(-1.25 * r ** 4) * 3.3 ** peak;
  };
  let integral = integrand(upper);
  for (let i = 1; i < count; i++) integral += (i % 2 ? 4 : 2) * integrand(i * step);
  const variance = alpha * g ** 2 / ((2 * Math.PI) ** 4 * fp ** 4) * integral * step / 3;
  return 4 * Math.sqrt(Math.max(variance, 0));
}
