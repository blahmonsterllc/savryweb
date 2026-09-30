import json
import os

import requests
from fastapi import FastAPI, Header, HTTPException

from recipe_schema import GenerateEnvelope, Recipe


app = FastAPI(title="Savry Recipe Model", version="1.0.0")
TGI_URL = os.getenv("TGI_URL", "http://127.0.0.1:8080").rstrip("/")
SERVICE_KEY = os.getenv("SAVRY_MODEL_API_KEY")


def build_prompt(envelope: GenerateEnvelope) -> str:
    request_json = envelope.input.model_dump_json(exclude_none=True)
    schema_json = json.dumps(Recipe.model_json_schema(), separators=(",", ":"))
    return (
        "You are Savry Chef, a recipe-development model. Create a practical original recipe from the "
        "request. Respect dietary restrictions and give food-safe, internally consistent instructions. "
        "Return JSON only.\nREQUEST:\n"
        f"{request_json}\nSCHEMA:\n{schema_json}"
    )


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model": os.getenv("SAVRY_MODEL_ID", "savry-recipe-v1")}


@app.post("/v1/recipes/generate")
def generate_recipe(envelope: GenerateEnvelope, authorization: str | None = Header(default=None)) -> dict:
    if SERVICE_KEY and authorization != f"Bearer {SERVICE_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    if envelope.task != "recipe.generate":
        raise HTTPException(status_code=400, detail="Unsupported task")
    if not envelope.input.request and not envelope.input.ingredients:
        raise HTTPException(status_code=400, detail="A request or ingredients are required")

    payload = {
        "inputs": build_prompt(envelope),
        "parameters": {
            "max_new_tokens": 1800,
            "temperature": 0.65,
            "top_p": 0.9,
            "repetition_penalty": 1.08,
            "return_full_text": False,
            "grammar": {"type": "json", "value": Recipe.model_json_schema()},
        },
    }
    try:
        response = requests.post(f"{TGI_URL}/generate", json=payload, timeout=55)
        response.raise_for_status()
        generated = response.json().get("generated_text", "")
        recipe = Recipe.model_validate_json(generated)
    except (requests.RequestException, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Model inference failed") from exc

    return {"recipe": recipe.model_dump(exclude_none=True), "model": envelope.model, "provider": "savry"}

