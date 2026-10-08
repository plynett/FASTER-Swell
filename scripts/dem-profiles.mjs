export const DEM_TRANSECTS_BASE_URL = "./DEMTransects";
export const DEM_IMAGES_BASE_URL = "https://celeris.usc.edu/FASTER-Swell/DEMImages";

function isDemImageUrl(url) {
  const prefix = `${DEM_IMAGES_BASE_URL}/`;
  return typeof url === "string" && url.startsWith(prefix)
    && /^[A-Za-z0-9_-]+\.(?:jpg|jpeg|png)(?:\?v=[A-Za-z0-9_-]+)?$/.test(url.slice(prefix.length));
}

const limits = {
  averageBeachSlope: [0.005, 0.3],
  beachElevationBase: [-1, 12],
  bermWidth: [0, 250],
  duneCrestElevation: [-1, 20],
  toeToCrestDistance: [0.25, 125],
};

export function parseDemProfile(text) {
  const data = JSON.parse(text);
  const params = {};
  for (const [key, [minimum, maximum]] of Object.entries(limits)) {
    const value = data?.[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
      throw new Error(`Invalid DEM profile parameter: ${key}`);
    }
    params[key] = value;
  }
  if (params.duneCrestElevation < params.beachElevationBase) {
    throw new Error("DEM crest is below its toe.");
  }
  return params;
}

export function preferredProfileSource(surveyedProfile, demProfile) {
  return surveyedProfile ? "surveyed" : demProfile ? "dem" : "default";
}

export function createDemProfileLoader(fetcher = fetch, loadCatalog = async () => ({})) {
  const cache = new Map();
  return function loadDemProfile(label) {
    if (!/^[A-Z0-9_-]{1,40}$/.test(label)) return Promise.resolve(null);
    if (!cache.has(label)) {
      const textUrl = `${DEM_TRANSECTS_BASE_URL}/${label}.txt`;
      const promise = (async () => {
        const response = await fetcher(textUrl, { cache: "no-cache" });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`DEM profile request failed: ${response.status}`);
        const params = parseDemProfile(await response.text());
        const metadata = (await loadCatalog())[label] || {};
        return { ...metadata, params, textUrl,
          imageUrl: metadata.imageUrl || `${DEM_IMAGES_BASE_URL}/${label}.jpg` };
      })().catch((error) => {
        cache.delete(label);
        console.warn(`[FASTER Geometry] DEM profile unavailable for ${label}.`, error);
        return null;
      });
      cache.set(label, promise);
    }
    return cache.get(label);
  };
}

export function createDemCatalogLoader(fetcher = fetch) {
  let promise;
  return function loadCatalog() {
    if (!promise) promise = (async () => {
      const response = await fetcher(`${DEM_TRANSECTS_BASE_URL}/profiles.json`, { cache: "no-cache" });
      if (response.status === 404) return {};
      if (!response.ok) throw new Error(`DEM catalog request failed: ${response.status}`);
      const data = await response.json();
      if (data.version !== 1 || !data.profiles) throw new Error("Invalid DEM profile catalog");
      const profiles = {};
      for (const [label, entry] of Object.entries(data.profiles)) {
        try {
          if (!/^[A-Z0-9_-]{1,40}$/.test(label)) continue;
          if (!isDemImageUrl(entry.imageUrl)) continue;
          profiles[label] = { ...entry, params: parseDemProfile(JSON.stringify(entry.params)) };
        } catch { /* Invalid entries must not advertise an applicable profile. */ }
      }
      return profiles;
    })().catch(error => {
      promise = null;
      console.warn("[FASTER Geometry] DEM catalog unavailable.", error);
      return {};
    });
    return promise;
  };
}

export const TRANSECT_SOURCE_COLORS = { default: "#22b7a7", dem: "#ad65f5", surveyed: "#ff00ff" };

export function transectAvailabilitySource(label, surveyedProfiles, demProfiles) {
  return surveyedProfiles.has(label) ? "surveyed" : demProfiles[label] ? "dem" : "default";
}

// Terrain inspection is deliberately independent of valid/applicable geometry.
export function createDemImageLoader(fetcher = fetch) {
  let manifestPromise;
  return async function loadDemImages(label) {
    if (!/^[A-Z0-9_-]{1,40}$/.test(label)) return [];
    if (!manifestPromise) {
      manifestPromise = (async () => {
        const response = await fetcher(`${DEM_TRANSECTS_BASE_URL}/images.json`, { cache: "no-cache" });
        if (response.status === 404) return { transects: {} };
        if (!response.ok) throw new Error(`DEM image index request failed: ${response.status}`);
        const manifest = await response.json();
        if (manifest.version !== 1 || !manifest.transects) throw new Error("Invalid DEM image index");
        return manifest;
      })().catch(error => {
        manifestPromise = null;
        console.warn("[FASTER Geometry] DEM inspection images unavailable.", error);
        return { transects: {} };
      });
    }
    const manifest = await manifestPromise;
    const entries = manifest.transects[label];
    return (Array.isArray(entries) ? entries : []).filter(entry =>
      entry && isDemImageUrl(entry.imageUrl));
  };
}
