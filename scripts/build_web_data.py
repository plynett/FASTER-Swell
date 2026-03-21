import json
from pathlib import Path

import xarray as xr


ROOT = Path(__file__).resolve().parents[2]
PYTHON_DIR = ROOT / "Faster_python"
DATA_DIR = ROOT / "web" / "data"
FORECAST_DIR = DATA_DIR / "forecasts"


GENERIC_DEFAULTS = {
    "profileMode": "dune",
    "averageBeachSlope": 0.05,
    "beachElevationBase": 3.5,
    "bermWidth": 0.0,
    "duneCrestElevation": 4.0,
    "duneWidth": 30.0,
    "tideSurgeLevel": 0.0,
    "waveTotalOffset": 0.5,
}


DEMO_MANIFEST = {
    "OC400": {
        "displayName": "Newport Beach Demo",
        "forecastFile": "OC400_forecast.json",
        "preferredTideStation": "9410660",
        "defaults": {
            "profileMode": "dune",
            "averageBeachSlope": 0.05,
            "beachElevationBase": 3.5,
            "bermWidth": 0.0,
            "duneCrestElevation": 4.0,
            "duneWidth": 30.0,
            "tideSurgeLevel": 0.0,
            "waveTotalOffset": 0.5,
        },
    },
    "SC134": {
        "displayName": "Santa Cruz Structure Demo",
        "forecastFile": "SC134_forecast.json",
        "preferredTideStation": "9413450",
        "defaults": {
            "profileMode": "structure",
            "averageBeachSlope": 0.05,
            "beachElevationBase": 2.5,
            "bermWidth": 40.0,
            "duneCrestElevation": 4.0,
            "duneWidth": 3.0,
            "tideSurgeLevel": 0.0,
            "waveTotalOffset": 0.5,
        },
    },
}


def build_transects():
    source = PYTHON_DIR / "CA_v1.1_transect_definitions.txt"
    lines = source.read_text(encoding="utf-8", errors="replace").splitlines()

    transects = []
    for line in lines:
        parts = line.split("\t")
        if len(parts) < 9 or not parts[0].isdigit():
            continue

        transects.append(
            {
                "sequence": int(parts[0]),
                "label": parts[1],
                "backbeachLon": float(parts[2]),
                "backbeachLat": float(parts[3]),
                "predictionLon": float(parts[4]),
                "predictionLat": float(parts[5]),
                "waterDepth": abs(float(parts[6])),
                "shoreNormal": float(parts[7]),
                "shoreType": int(parts[8]),
            }
        )

    return {
        "source": str(source.relative_to(ROOT)).replace("\\", "/"),
        "count": len(transects),
        "genericDefaults": GENERIC_DEFAULTS,
        "transects": transects,
    }


def export_single_site_dataset(nc_name):
    dataset_path = PYTHON_DIR / nc_name
    ds = xr.open_dataset(dataset_path)

    label = str(ds["metaSiteLabel"].values.item())
    payload = {
        "label": label,
        "sourceFile": nc_name,
        "waveTime": [str(v) for v in ds["waveTime"].values],
        "waveHs": [float(v) for v in ds["waveHs"].values],
        "waveTp": [float(v) for v in ds["waveTp"].values],
        "waveDp": [float(v) for v in ds["waveDp"].values],
        "metaWaterDepth": float(ds["metaWaterDepth"].values.item()),
        "metaShoreNormal": float(ds["metaShoreNormal"].values.item()),
    }

    output_name = dataset_path.with_suffix(".json").name
    (FORECAST_DIR / output_name).write_text(
        json.dumps(payload, separators=(",", ":")),
        encoding="utf-8",
    )


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    FORECAST_DIR.mkdir(parents=True, exist_ok=True)

    transects_payload = build_transects()
    (DATA_DIR / "transects.json").write_text(
        json.dumps(transects_payload, separators=(",", ":")),
        encoding="utf-8",
    )

    for nc_name in ("OC400_forecast.nc", "SC134_forecast.nc"):
        export_single_site_dataset(nc_name)

    manifest_payload = {
        "genericDefaults": GENERIC_DEFAULTS,
        "datasets": DEMO_MANIFEST,
    }
    (DATA_DIR / "forecast-manifest.json").write_text(
        json.dumps(manifest_payload, separators=(",", ":")),
        encoding="utf-8",
    )

    print("Built web data assets in", DATA_DIR)


if __name__ == "__main__":
    main()
