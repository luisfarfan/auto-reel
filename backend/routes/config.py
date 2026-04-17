import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.settings import settings

router = APIRouter(prefix="/config", tags=["config"])


def _read_config() -> dict:
    path = settings.config_path
    if not os.path.exists(path):
        raise HTTPException(404, f"config.json not found at {path}")
    with open(path, "r") as f:
        return json.load(f)


def _write_config(data: dict) -> None:
    with open(settings.config_path, "w") as f:
        json.dump(data, f, indent=2)


@router.get("")
async def get_config():
    cfg = _read_config()
    # Mask sensitive keys
    for key in ("fal_api_key", "nanobanana2_api_key", "assembly_ai_api_key"):
        if cfg.get(key):
            cfg[key] = "***"
    if cfg.get("email", {}).get("password"):
        cfg["email"]["password"] = "***"
    return cfg


@router.patch("")
async def update_config(updates: dict):
    cfg = _read_config()
    PROTECTED = {"fal_api_key", "nanobanana2_api_key", "assembly_ai_api_key"}
    for key, value in updates.items():
        if key in PROTECTED and value == "***":
            continue  # don't overwrite masked values
        cfg[key] = value
    _write_config(cfg)
    return {"updated": list(updates.keys())}
