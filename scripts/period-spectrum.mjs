// DAP2 grids include dotted names and repeated coordinate maps after each matrix.
export function parseDap2NumericArray(bodyText, variableName) {
  const dataText = bodyText.split(/^-{10,}\s*$/m).at(-1);
  const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const header = new RegExp(`(?:^|\\n)${escapedName}((?:\\[\\d+\\])+)\\s*\\n`);
  const match = header.exec(dataText);
  if (!match) {
    throw new Error(`CDIP response is missing ${variableName}.`);
  }
  const shape = [...match[1].matchAll(/\[(\d+)\]/g)].map((part) => Number(part[1]));
  const tail = dataText.slice(match.index + match[0].length);
  const nextHeader = /\n[A-Za-z]\w*(?:\.\w+)*(?:(?:\[\d+\])+\s*\n|\s*,)/;
  const next = nextHeader.exec(tail);
  const numericText = tail.slice(0, next?.index ?? tail.length)
    .replace(/^\s*(?:\[\d+\])+\s*,?\s*/gm, "");
  const values = numericText.split(/[\s,]+/).filter(Boolean).map(Number);
  if (values.length !== shape.reduce((count, size) => count * size, 1)
      || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`CDIP response has invalid dimensions or values for ${variableName}.`);
  }
  return { shape, values };
}

export function parseDap2Matrix(bodyText, variableName) {
  const { shape, values } = parseDap2NumericArray(bodyText, variableName);
  if (shape.length !== 2) {
    throw new Error(`${variableName} must have two dimensions.`);
  }
  return Array.from({ length: shape[0] }, (_, row) => (
    values.slice(row * shape[1], (row + 1) * shape[1])
  ));
}

export function buildPeriodBins(frequencyBounds, bandwidth) {
  if (!frequencyBounds?.length || bandwidth?.length !== frequencyBounds.length) {
    throw new Error("Frequency bounds and bandwidths are missing or inconsistent.");
  }
  frequencyBounds.forEach((bounds, index) => {
    if (bounds.length !== 2 || !bounds.every(Number.isFinite) || bounds[0] <= 0
        || bounds[1] <= bounds[0] || !Number.isFinite(bandwidth[index]) || bandwidth[index] <= 0) {
      throw new Error("Invalid source frequency band.");
    }
  });
  const coverageMin = 1 / Math.max(...frequencyBounds.map((bounds) => bounds[1]));
  const coverageMax = 1 / Math.min(...frequencyBounds.map((bounds) => bounds[0]));
  const first = Math.floor(coverageMin + 0.5);
  const last = Math.ceil(coverageMax - 0.5);
  if (first < 1 || last - first > 500) {
    throw new Error("Unsupported source period range.");
  }
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const period = first + index;
    const periodMin = period - 0.5;
    const periodMax = period + 0.5;
    const frequencyMin = 1 / periodMax;
    const frequencyMax = 1 / periodMin;
    return {
      period, periodMin, periodMax,
      partialCoverage: periodMin < coverageMin || periodMax > coverageMax,
      weights: frequencyBounds.map(([low, high], band) => (
        bandwidth[band] * Math.max(0, Math.min(high, frequencyMax) - Math.max(low, frequencyMin)) / (high - low)
      )),
    };
  });
}

export function discretizeAmplitudeSpectrum(density, bins) {
  if (!density?.length || density.length !== bins[0]?.weights.length
      || density.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Spectral energy is missing or invalid.");
  }
  const variance = bins.map((bin) => (
    bin.weights.reduce((sum, weight, band) => sum + density[band] * weight, 0)
  ));
  const totalVariance = variance.reduce((sum, value) => sum + value, 0);
  return {
    variance,
    amplitudes: variance.map((value) => Math.sqrt(2 * value)),
    reconstructedHs: 4 * Math.sqrt(totalVariance),
    totalVariance,
  };
}

export function buildForecastAmplitudeSpectra(dataset) {
  if (!dataset.waveEnergyDensity) {
    return { bins: [], frames: [], maxAmplitude: 0, unavailableReason: "Spectral data unavailable for this forecast." };
  }
  const bins = buildPeriodBins(dataset.waveFrequencyBounds, dataset.waveBandwidth);
  if (dataset.waveEnergyDensity.length !== dataset.waveTime.length) {
    throw new Error("Spectral timestep count does not match the forecast.");
  }
  const badFrequencyQc = dataset.waveFrequencyFlagPrimary?.some((flag) => flag !== 1);
  const frames = dataset.waveEnergyDensity.map((density, index) => {
    try {
      if (badFrequencyQc || (dataset.waveFlagPrimary && dataset.waveFlagPrimary[index] !== 1)) {
        throw new Error("Spectrum unavailable: CDIP quality check did not pass.");
      }
      const frame = discretizeAmplitudeSpectrum(density, bins);
      const sourceVariance = density.reduce((sum, value, band) => sum + value * dataset.waveBandwidth[band], 0);
      if (Math.abs(frame.totalVariance - sourceVariance) > Math.max(1e-12, sourceVariance * 1e-10)) {
        throw new Error("Spectral rebinning did not preserve variance.");
      }
      return frame;
    } catch (error) {
      return { amplitudes: null, unavailableReason: error.message };
    }
  });
  const maxAmplitude = frames.reduce((max, frame) => Math.max(max, ...(frame.amplitudes || [0])), 0);
  return { bins, frames, maxAmplitude };
}
