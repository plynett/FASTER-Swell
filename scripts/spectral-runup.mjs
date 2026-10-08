// Return runup height only. The caller adds still water to obtain plot elevation.
export function computeSpectralWeightedRunup({ spectra, index, input, predictRunup }) {
  const frame = spectra?.frames?.[index];
  if (!frame?.amplitudes) {
    return { runupAboveStillWater: null, components: [], unavailableReason: frame?.unavailableReason || "Spectral data unavailable." };
  }
  const bins = spectra.bins;
  const amplitudes = frame.amplitudes;
  if (!bins?.length || bins.length !== amplitudes.length || !Number.isFinite(input.tideLevel)) {
    return { runupAboveStillWater: null, components: [], unavailableReason: "Invalid spectral runup inputs." };
  }

  const components = [];
  for (let band = 0; band < bins.length; band += 1) {
    const amplitude = amplitudes[band];
    const period = bins[band].period;
    if (!Number.isFinite(amplitude) || amplitude < 0 || !Number.isFinite(period) || period <= 0) {
      return { runupAboveStillWater: null, components: [], unavailableReason: "Invalid spectral runup component." };
    }
    const waveHeight = 2 * amplitude;
    // Empty bins must not activate the existing model's minimum-height safeguards.
    const rise = amplitude === 0 ? 0 : predictRunup({
      ...input,
      waveHeightSwell: waveHeight,
      waveHeightTotal: waveHeight,
      localChopHeight: 0,
      peakWavePeriod: period,
    });
    if (!Number.isFinite(rise)) {
      return { runupAboveStillWater: null, components: [], unavailableReason: "Per-period expected runup is invalid." };
    }
    components.push({
      period,
      amplitude,
      waveHeight,
      rise,
    });
  }
  const runupAboveStillWater = Math.hypot(...components.map((component) => component.rise));
  return {
    runupAboveStillWater,
    components,
    unavailableReason: null,
  };
}
