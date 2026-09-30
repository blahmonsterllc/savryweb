# Savry Recipe Model

Savry Chef is designed as a Savry-owned recipe model, not a ChatGPT wrapper. The website and iOS app call one stable endpoint; the model behind it can be trained, evaluated, and upgraded without changing either client.

## Architecture

- Base model: `Qwen/Qwen3-4B-Instruct-2507` (Apache 2.0)
- Adaptation: QLoRA supervised fine-tuning on recipe requests and validated recipe outputs
- Output: constrained JSON matching `recipe_schema.py`
- Serving: Text Generation Inference (TGI) behind the small FastAPI adapter in `service.py`
- Product endpoint: `POST /v1/recipes/generate`

The Next.js application reads the model URL from `SAVRY_MODEL_URL`. There is intentionally no fallback to OpenAI or ChatGPT.

## Training data

Each JSONL row contains a `messages` array with:

1. the fixed Savry cooking and food-safety system message;
2. a structured user request (ingredients, time, servings, diet, equipment, and intent); and
3. one validated recipe JSON object.

Start with recipes Savry has the right to use. Community recipes should enter the training set only when the contributor has consented. Accepted tweaks and successful “Made It” signals are especially useful preference data, but private recipes must never be exported by default.

The included `data/example.jsonl` is a format example, not a production dataset.

## Train an adapter

Use a CUDA machine with enough VRAM for a 4-bit 4B model. From this directory:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-train.txt
python train.py --data data/train.jsonl --output output/savry-recipe-v1
```

Evaluate the adapter on a held-out set before deployment. Minimum checks should cover valid JSON, ingredient/step consistency, realistic timing, dietary constraint adherence, allergen handling, and food-safe temperatures.

## Serve the model

Run TGI with the merged model or adapter-supported deployment, then start the Savry adapter service:

```bash
pip install -r requirements-service.txt
export TGI_URL=http://127.0.0.1:8080
uvicorn service:app --host 0.0.0.0 --port 8090
```

Configure the website deployment:

```text
SAVRY_MODEL_URL=https://your-model-host.example/v1/recipes/generate
SAVRY_MODEL_API_KEY=...
SAVRY_MODEL_ID=savry-recipe-v1
```

The service requires structured JSON from TGI and validates every recipe again before returning it to Savry.

