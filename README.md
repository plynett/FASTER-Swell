# FASTER-Swell Web Prototype

## What this is

This folder contains a static HTML/CSS/JS prototype of a web-based FASTER-Swell interface.

It includes:

- a statewide California transect map,
- click-to-select MOP transects,
- an editable beach/backshore geometry panel,
- NOAA tide lookup in the browser,
- a JavaScript port of the FASTER runup calculations,
- a time slider and play/pause forecast playback,
- and bundled demo forecast data for `OC400` and `SC134`.

## How to run it

For normal use with live NOAA tides and live CDIP MOP forecast fetches, a regular static server now works because the browser can request the CDIP THREDDS ASCII endpoint directly:

```powershell
cd E:\Dropbox\projects\CGS_24-26\CODEX_access\Faster_swell\web
http-server
```

Then open:

```text
http://localhost:8080/
```

If you want the optional local proxy fallback as well, run:

Examples:

```powershell
cd E:\Dropbox\projects\CGS_24-26\CODEX_access\Faster_swell\web
python scripts\serve_faster_web.py --port 8000
```

Then open:

```text
http://localhost:8000/
```

In a static-only setup, the app now tries direct CDIP THREDDS access first and only falls back to `/api/mop-forecast` if the browser-side path fails. Bundled demo forecasts and NOAA tide-only mode still remain as lower-priority fallbacks.

## Current prototype scope

The UI is still framework-free on the front end, and the primary live MOP path now uses direct browser fetches against the CDIP THREDDS DAP2 ASCII endpoint. A tiny local Python proxy is still available as an optional fallback.

The app now supports:

- live NOAA tide data from the browser,
- live CDIP MOP forecast fetches directly from the browser,
- live CDIP MOP forecast fallback through `scripts/serve_faster_web.py`,
- bundled local forecast exports as fallback for demo transects,
- and tide-only preview mode when a live or bundled MOP forecast is not available for a transect.

## Data files

- `web/data/transects.json`
  - compact export of the statewide transect definition text file.
- `web/data/forecast-manifest.json`
  - local demo-data manifest and default geometry presets.
- `web/data/forecasts/*.json`
  - web-friendly forecast exports generated from the local NetCDF files.

## Rebuilding the bundled web data

If the local demo NetCDF files or transect definitions change, rebuild the web data assets with:

```powershell
python web\scripts\build_web_data.py
```

## Next step for full live operation

The next useful upgrade would be adding client-side caching or a deployable proxy cache layer, so repeated transect requests can avoid re-downloading the same CDIP forecast within a session.
