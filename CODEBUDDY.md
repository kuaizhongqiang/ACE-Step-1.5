# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## Commands

```bash
# Python dependency management (uv is the package manager)
uv sync                                          # Install/update all Python dependencies

# Run the engine
uv run acestep                                   # Gradio UI on :7860
uv run acestep-api                               # FastAPI REST server
uv run acestep-download                          # Download models to checkpoints/
uv run python cli.py                             # Interactive CLI generation wizard
uv run python cli.py -c config.toml              # Run with a saved TOML config

# Run all tests (unittest-based)
uv run python -m unittest discover -s . -p "*_test.py"
uv run python -m unittest discover -s . -p "test_*.py"

# Run a single test file / class / method
uv run python -m unittest acestep.training.test_lora_utils
uv run python -m unittest acestep.training.test_lora_utils.TestUnwrapDecoder
uv run python -m unittest acestep.training.test_lora_utils.TestUnwrapDecoder.test_returns_module_directly

# Run all tests in a directory
uv run python -m unittest discover -s acestep/training -p "*_test.py"

# Node.js layer (Express + React scaffolds; server/ and ui/ have no source yet)
npm install                                       # Root workspaces
cd server && npx tsc --noEmit                     # Backend type check
cd ui && npx tsc --noEmit                         # Frontend type check
```

## Architecture Overview

ACE-Step 1.5 is a **3-layer monorepo** for local AI music generation: a Python engine (the only functional layer) + Express middleware (scaffold) + React frontend (scaffold). It is a fork of the upstream [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) focused on monorepo integration, CLI management, and Chinese-first UX.

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

### Generation Pipeline

**Text prompt → 5Hz LM encodes text into audio embeddings → DiT diffuses embeddings into mel spectrograms → VAE decodes to waveform.**

- **5Hz LM** (1.7B params): a language model that translates structured text prompts (caption + lyrics + metadata) into discrete audio code tokens. Backends: nano-vllm for CUDA, HuggingFace Transformers as fallback, MLX for Apple Silicon.
- **DiT** (Diffusion Transformer, 2B turbo / 4B xl-base): denoises audio embeddings into mel spectrograms via a diffusion process. Base models support CFG (classifier-free guidance) and ADG (Adaptive Dual Guidance). Turbo models use fewer inference steps.
- **VAE**: encodes reference audio to latents and decodes final latents back to waveform. Supports chunked processing for long audio.

Models auto-download to `checkpoints/` (gitignored) on first run or via `acestep-download`.

### Python Engine (`acestep/`, ~590 source files)

**Handler layer** — `handler.py` defines `AceStepHandler`, assembled via multiple inheritance from ~80 single-responsibility mixins in `core/generation/handler/`. Each mixin targets ≤200 LOC and handles one concern: model init, conditioning text/embed/masks, VAE encode/decode, diffusion execution, LoRA management, repaint, MLX, audio I/O, progress tracking, etc. New handler functionality must follow this mixin decomposition.

**Inference orchestration** — `inference.py` declares `GenerationParams` (all generation knobs: caption, lyrics, BPM, keyscale, duration, guidance scale, timesteps, CoT flags, etc.) and `GenerationConfig` (batch_size, seeds, audio format). `generate_music()` is the top-level orchestrator that wires handler + LM + params → audio output.

**GPU abstraction** — `gpu_config.py` auto-detects GPU type (CUDA/ROCm/XPU/MPS/MLX) and VRAM, assigns a tier (e.g., <8GB, 8-12GB, 12-16GB, ≥16GB), and from that tier derives quantization level, CPU offloading decisions, max duration, and max batch size. **Never alter non-target platform paths** — a CUDA change must not break MPS/CPU/MLX paths. Use `is_mps_platform()` for Apple Silicon checks; MLX backend auto-selects on macOS.

**DiT models** — `models/` contains model definition files for each variant: `base`, `turbo`, `xl_base`, `xl_turbo`, `xl_sft`, `sft`, plus MLX-native versions. The configuration auto-selects a model based on task type: base-only tasks (lego, extract, complete) force base models; otherwise turbo is preferred.

**FastAPI REST server** — `api/` provides a production HTTP API with an in-memory job queue, background worker loops, and a decomposed 4-phase pipeline: analysis → setup → generation → result. Subdirectories: `http/` (36 route modules) and `jobs/` (9 job modules). The server also exposes training dataset management and LoRA/LoKr training initiation endpoints.

**Training** — Two training systems coexist: `training/` (v1, Lightning-based LoRA/LoKr fine-tuning with Gradio UI) and `training_v2/` (Side-Step training with continuous timesteps, CFG dropout, CLI-driven). Do not mix concerns between them.

**Text tasks** — `text_tasks/` integrates external LLMs (OpenAI, Anthropic, Gemini, DeepSeek) for caption enrichment, lyric formatting, and metadata generation. Uses the CoT (Chain-of-Thought) pattern: the LM is prompted to "think" about musical structure before generating audio codes.

**Gradio UI** — `ui/gradio/` provides a full web interface with event handlers, AST-based contract wiring (code generation from UI state diagrams), and i18n supporting 50+ languages.

**Vendored dependencies** — `third_parts/nano-vllm/` is a vendored lightweight vllm fork optimized for CUDA LLM inference. It is a local path dependency in `pyproject.toml`.

### Key Patterns and Rules

1. **Scope control** (from AGENTS.md): One problem per task/PR. Minimal edits — touch only files required for the change. No drive-by refactors, formatting sweeps, or opportunistic cleanups. Preserve existing public interfaces.

2. **Mixin decomposition** (from AGENTS.md): Handler functionality lives in many small modules under `core/generation/handler/`. New modules ≤200 LOC (≤150 target). If a module would exceed 200 LOC, split by responsibility before merging or justify in PR notes with a follow-up plan. Keep orchestrator/facade modules thin.

3. **Testing** (from AGENTS.md): `unittest`-style, files named `*_test.py` or `test_*.py`. Mock GPU, filesystem, and network with `unittest.mock`. Every behavior change needs: a success-path test, an edge-case test, and a non-target behavior check. If mocking requires mocking most of the system to test one unit, that indicates a decomposition problem — refactor boundaries first.

4. **Code style** (from AGENTS.md): Python 3.11-3.12, 4-space indent, double quotes, 100-char line limit. `snake_case` for functions/variables/modules, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants. Type hints on new/modified code. Docstrings mandatory on all modules, classes, and public functions.

5. **Logging**: Use `from loguru import logger`. No `print()` except CLI output. Keep logs actionable.

6. **Feature gating** (from AGENTS.md): Do not expose unfinished or non-functional user-facing flows by default. Gate WIP/unstable UI/API paths behind explicit feature/release flags.

7. **Multi-platform**: `pyproject.toml` uses environment markers to select the right PyTorch build per platform (CUDA 12.8 for Windows/Linux x86_64, CUDA 13.0 for Linux aarch64/Jetson, CPU/MPS for macOS arm64).

8. **Node.js layer roadmap** (`docs/MIGRATION_PLAN.md`): The Express server and React frontend are being migrated from a separate `ace-step-ui` repo. The server will proxy Gradio HTTP, integrate DeepSeek API for text enhancement, and manage a SQLite song library. The React frontend will provide music generation UI, audio player, and song library. Currently both `server/` and `ui/` are empty scaffolds.

### Task Types

The engine supports six task types, selected via `--task_type`:
- **text2music**: Generate music from text/lyrics (default)
- **cover**: Transform existing audio into a new style
- **repaint**: Regenerate a specific time segment of audio
- **lego**: Generate a single instrument track in context (base model required)
- **extract**: Isolate a specific instrument track from a mix (base model required)
- **complete**: Complete/extend partial tracks with new instruments (base model required)

### Configuration

Environment variables are loaded from `.env` (or `.env.example` as fallback). Key variables: `ACESTEP_CONFIG_PATH` (DiT model), `ACESTEP_LM_MODEL_PATH` (5Hz LM), `DEEPSEEK_API_KEY`, `JWT_SECRET`. The CLI wizard (`cli.py`) can save interactive settings as a TOML config for reuse.
