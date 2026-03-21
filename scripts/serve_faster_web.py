from __future__ import annotations

import argparse
import json
import os
import tempfile
import threading
import time
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np
import requests
import xarray as xr


ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT
TRANSECTS_PATH = STATIC_DIR / "data" / "transects.json"
UPSTREAM_BASE_URL = "https://thredds.cdip.ucsd.edu/thredds/fileServer/cdip/model/MOP_alongshore/"
CACHE_TTL_SECONDS = 15 * 60
REQUEST_TIMEOUT_SECONDS = 90

_CACHE_LOCK = threading.Lock()
_FORECAST_CACHE: dict[str, dict[str, object]] = {}


class ForecastProxyError(Exception):
    def __init__(self, message: str, status_code: int = HTTPStatus.BAD_GATEWAY):
        super().__init__(message)
        self.status_code = int(status_code)
        self.message = message


def load_known_transects() -> set[str]:
    payload = json.loads(TRANSECTS_PATH.read_text(encoding="utf-8"))
    return {str(transect["label"]).strip().upper() for transect in payload.get("transects", [])}


KNOWN_TRANSECTS = load_known_transects()


def normalize_label(raw_value: object, fallback: str) -> str:
    if raw_value is None:
        return fallback
    value = raw_value.item() if hasattr(raw_value, "item") else raw_value
    if isinstance(value, bytes):
        text = value.decode("utf-8", errors="replace")
    else:
        text = str(value)
    text = text.strip()
    if text.startswith("b'") and text.endswith("'"):
        text = text[2:-1]
    return text or fallback


def scalar_float(values: object) -> float:
    array = np.asarray(values).reshape(-1)
    return float(array[0])


def wave_time_strings(values: object) -> list[str]:
    return [np.datetime_as_string(value, unit="ms") for value in np.asarray(values).reshape(-1)]


def array_floats(values: object) -> list[float]:
    return np.asarray(values, dtype=float).reshape(-1).tolist()


def get_cached_forecast(transect: str) -> dict[str, object] | None:
    now = time.time()
    with _CACHE_LOCK:
        entry = _FORECAST_CACHE.get(transect)
        if not entry:
            return None
        if float(entry["expires_at"]) <= now:
            _FORECAST_CACHE.pop(transect, None)
            return None
        payload = dict(entry["payload"])
        payload["cacheHit"] = True
        payload["cacheAgeSeconds"] = max(0, int(now - float(entry["fetched_at_epoch"])))
        return payload


def set_cached_forecast(transect: str, payload: dict[str, object]) -> None:
    now = time.time()
    with _CACHE_LOCK:
        _FORECAST_CACHE[transect] = {
            "payload": dict(payload),
            "fetched_at_epoch": now,
            "expires_at": now + CACHE_TTL_SECONDS,
        }


def fetch_live_forecast_payload(transect: str) -> dict[str, object]:
    upstream_url = f"{UPSTREAM_BASE_URL}{transect}_forecast.nc"
    print(f"[FASTER MOP Proxy] Fetching {upstream_url}", flush=True)

    try:
        response = requests.get(upstream_url, timeout=REQUEST_TIMEOUT_SECONDS)
    except requests.RequestException as error:
        raise ForecastProxyError(f"CDIP request failed: {error}") from error

    if response.status_code == HTTPStatus.NOT_FOUND:
        raise ForecastProxyError(f"No live forecast file found for {transect}.", HTTPStatus.NOT_FOUND)
    if response.status_code != HTTPStatus.OK:
        raise ForecastProxyError(
            f"CDIP request returned HTTP {response.status_code} for {transect}.",
            response.status_code,
        )

    temp_path = None
    dataset = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".nc") as temp_file:
            temp_file.write(response.content)
            temp_path = Path(temp_file.name)

        dataset = xr.open_dataset(temp_path)
        payload = {
            "label": normalize_label(dataset["metaSiteLabel"].values, transect) if "metaSiteLabel" in dataset else transect,
            "sourceFile": f"{transect}_forecast.nc",
            "sourceKind": "live",
            "sourceUrl": upstream_url,
            "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "upstreamLastModified": response.headers.get("Last-Modified"),
            "waveTime": wave_time_strings(dataset["waveTime"].values),
            "waveHs": array_floats(dataset["waveHs"].values),
            "waveTp": array_floats(dataset["waveTp"].values),
            "waveDp": array_floats(dataset["waveDp"].values),
            "metaWaterDepth": scalar_float(dataset["metaWaterDepth"].values),
            "metaShoreNormal": scalar_float(dataset["metaShoreNormal"].values),
            "cacheHit": False,
            "cacheAgeSeconds": 0,
        }
    except ForecastProxyError:
        raise
    except Exception as error:
        raise ForecastProxyError(f"Failed to parse live MOP forecast for {transect}: {error}") from error
    finally:
        if dataset is not None:
            dataset.close()
        if temp_path and temp_path.exists():
            os.remove(temp_path)

    set_cached_forecast(transect, payload)
    print(
        f"[FASTER MOP Proxy] Served live forecast for {transect} with {len(payload['waveTime'])} time steps",
        flush=True,
    )
    return payload


def json_bytes(payload: dict[str, object]) -> bytes:
    return json.dumps(payload, separators=(",", ":")).encode("utf-8")


class FasterWebRequestHandler(SimpleHTTPRequestHandler):
    server_version = "FASTERMOPProxy/0.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/api/health":
            self.send_json(
                HTTPStatus.OK,
                {
                    "status": "ok",
                    "cacheEntries": len(_FORECAST_CACHE),
                    "knownTransects": len(KNOWN_TRANSECTS),
                },
            )
            return

        if parsed.path == "/api/mop-forecast":
            self.handle_mop_forecast(parsed)
            return

        self.path = parsed.path
        super().do_GET()

    def handle_mop_forecast(self, parsed) -> None:
        params = parse_qs(parsed.query)
        transect = params.get("transect", [""])[0].strip().upper()

        if not transect:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Missing required query parameter: transect"})
            return

        if KNOWN_TRANSECTS and transect not in KNOWN_TRANSECTS:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": f"Unknown transect label: {transect}"})
            return

        cached_payload = get_cached_forecast(transect)
        if cached_payload:
            self.send_json(HTTPStatus.OK, cached_payload)
            return

        try:
            payload = fetch_live_forecast_payload(transect)
        except ForecastProxyError as error:
            self.send_json(error.status_code, {"error": error.message, "transect": transect})
            return
        except Exception as error:
            self.send_json(
                HTTPStatus.BAD_GATEWAY,
                {"error": f"Unexpected proxy failure for {transect}: {error}", "transect": transect},
            )
            return

        self.send_json(HTTPStatus.OK, payload)

    def send_json(self, status_code: int, payload: dict[str, object]) -> None:
        body = json_bytes(payload)
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


def make_server(host: str, port: int) -> ThreadingHTTPServer:
    handler = partial(FasterWebRequestHandler)
    return ThreadingHTTPServer((host, port), handler)


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the FASTER web app with a live CDIP MOP proxy.")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind.")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on.")
    args = parser.parse_args()

    server = make_server(args.host, args.port)
    print(f"[FASTER MOP Proxy] Serving http://{args.host}:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[FASTER MOP Proxy] Shutting down.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
