# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Python (primary engine)
```bash
# Install/update Python deps (uv is the package manager)
uv sync

# Run all Python tests
uv run python -m unittest discover -s . -p "*_test.py"
uv run python -m unittest discover -s . -p "test_*.py"

# Run a single test file/class/method
uv run python -m unittest acestep.training.test_lora_utils
uv run python -m unittest acestep.training.test_lora_utils.TestUnwrapDecoder
uv run python -m unittest acestep.training.test_lora_utils.TestUnwrapDecoder.test_returns_module_directly

# Run all tests in a directory
uv run python -m unittest discover -s acestep/training -p "*_test.py"

# Run the engine
uv run acestep                           # Gradio UI on :7860
uv run acestep-api                       # FastAPI REST server
uv run acestep-download                  # Download models
uv run python cli.py                     # CLI generation wizard

### Node.js (scaffolded — server/ and ui/ have no source code yet)
```bash
npm install                           # Root workspaces
# Server & UI are scaffolded but empty — no tsconfig or source exists yet.
```

## Architecture Overview

ACE-Step 1.5 is a **3-layer monorepo** for local AI music generation. The Python engine is the only functional layer; the Express server and React frontend are scaffolded placeholders.

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React Frontend │────▶│  Express Server  │────▶│  Python Engine   │
│   (ui/, empty)   │     │  (server/, empty)│     │  (acestep/, live)│
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                                       │
                                          ┌────────────┼────────────┐
                                          │ 5Hz LM     │ DiT        │ VAE
                                          │ (planner)  │ (diffusion)│ (encode/
                                          │            │            │  decode)
                                          └────────────┴────────────┘
```

### Python Engine (`acestep/`)

**Generation pipeline**: Text prompt → 5Hz LM encodes text into audio embeddings → DiT diffuses embeddings into mel spectrograms → VAE decodes to waveform.

Key modules:
- **`handler.py`** — `AceStepHandler` class, assembled from ~50 mixins in `core/generation/handler/`. Each mixin is single-responsibility (≤200 LOC).
- **`inference.py`** — `GenerationParams` dataclass, `generate_music()` orchestrator, `format_sample()` post-processing.
- **`gpu_config.py`** — Centralized GPU detection (CUDA/ROCm/XPU/MPS/MLX/CPU), VRAM tier → quantization + offloading decisions.
- **`llm_inference.py`** — LM text handling; backend is nano-vllm (CUDA), Transformers (fallback), or MLX (Apple Silicon).
- **`models/`** — DiT model architectures (base, turbo, xl_base, xl_turbo, xl_sft, sft, mlx variants).
- **`api/`** — FastAPI REST server with in-memory job queue, background worker loops, decomposed pipeline (analysis → setup → generation → result).
- **`training/`** (v1) — Lightning-based LoRA/LoKr training with Gradio UI.
- **`training_v2/`** — Side-Step training with continuous timesteps + CFG dropout, CLI-driven.
- **`text_tasks/`** — External LLM integration (OpenAI, Anthropic, Gemini, DeepSeek) for caption enrichment, lyric formatting.
- **`ui/gradio/`** — Gradio web UI components, event handlers, AST-based contract wiring generation, i18n (50+ languages).
- **`third_parts/nano-vllm/`** — Vendored lightweight vllm fork for optimized CUDA LLM inference.

### Models

| Model | Type | Params | Purpose |
|-------|------|--------|---------|
| `acestep-v15-xl-base` | DiT | 4B | Full-quality text→audio |
| `acestep-v15-turbo` | DiT | 2B | Fast generation |
| `acestep-5Hz-lm-1.7B` | LM | 1.7B | Text→audio embedding encoding |

Models download to `checkpoints/` (gitignored) on first run or via `uv run acestep-download`.

### Key Patterns

1. **Mixin decomposition**: Handler functionality is split across many small mixins in `core/generation/handler/`. Each file does one thing (model init, conditioning, VAE encode/decode, diffusion, LoRA, repaint, MLX). Keep new modules ≤200 LOC.

2. **Multi-platform GPU abstraction**: `gpu_config.py` auto-detects VRAM and assigns a tier. **Never alter non-target platform paths** — changes to CUDA code must not break MPS/CPU/MLX.

3. **Scope control**: One problem per task/PR. No drive-by refactors. No formatting sweeps. Preserve existing public interfaces.

4. **Testing**: `unittest`-style, files named `*_test.py` or `test_*.py`. Mock GPU/filesystem/network with `unittest.mock`. Include success path + edge case + non-target behavior check.

5. **Logging**: `from loguru import logger`. No `print()` except CLI output.

6. **Style**: PEP 8, 4-space indent, double quotes, 100-char line limit. `snake_case` for functions/vars/modules, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants. Type hints and docstrings on new/modified code.

7. **Feature gating**: Don't expose unfinished UI/API paths by default. Gate WIP behind feature flags.

8. **Multi-platform requirements** via environment markers in `pyproject.toml`.

### Repo Structure (functional parts)

```
acestep/                    # Python AI engine (~592 source files)
  core/generation/handler/  # ~50 mixin modules (≤200 LOC each)
  core/llm/                # LLM integration
  core/lora/               # LoRA introspection/registry
  core/scoring/            # DTW alignment, scoring
  core/audio/              # Audio utilities
  models/                  # DiT model definitions
  api/                     # FastAPI REST server
  training/               # LoRA/LoKr training v1
  training_v2/            # Side-Step training v2
  text_tasks/             # External LLM API integration
  ui/gradio/              # Gradio UI + i18n
  third_parts/nano-vllm/  # Vendored lightweight vllm
openrouter/                # OpenRouter API server
scripts/                   # GPU check, VRAM profile, data prep
examples/                  # 400 JSON generation configs
docs/                      # VitePress site (en/zh/ja/ko)
server/                    # Express scaffold (empty)
ui/                        # React scaffold (empty)
```
