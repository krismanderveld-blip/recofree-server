# GemmaSignalEngine Research — llama.rn + Gemma 3 GGUF

## llama.rn (react-native-llama)

**Package:** `llama.rn` v0.12.4 (npm, actively maintained)
**GitHub:** https://github.com/mybigday/llama.rn
**What it is:** React Native binding for llama.cpp — native on-device LLM inference for iOS and Android.

### API Summary

```typescript
import { initLlama } from 'llama.rn';

// Load model (async, may take seconds)
const context = await initLlama({
  model: modelPath,        // path to .gguf file on device
  use_mlock: true,
  n_ctx: 2048,             // context window
  n_gpu_layers: 99,        // Metal (iOS) / OpenCL (Android)
});

// Chat completion (structured messages)
const result = await context.completion({
  messages: [
    { role: 'system', content: '...' },
    { role: 'user', content: '...' },
  ],
  n_predict: 100,
  stop: ['</s>'],
  temperature: 0.1,
});

// result.text = generated text
// result.timings = { predicted_per_token_ms, ... }

// Release when done
await context.release();
```

### Key Features
- JSI-first bridge (fast native calls)
- Metal GPU acceleration on iOS
- OpenCL on Android
- Supports GGUF format exclusively
- Chat template support (Gemma compatible)
- Multimodal support (vision, audio) for compatible models
- Streaming via callback

## Gemma 3 GGUF Variants for Mobile

### Recommended: Gemma 3 1B Instruction-Tuned

| Variant | Size | RAM Needed | Source |
|---------|------|-----------|--------|
| `gemma-3-1b-it-Q4_K_M.gguf` | **806 MB** | ~1.2 GB | ggml-org/gemma-3-1b-it-GGUF |
| `gemma-3-1b-it-Q4_0.gguf` (QAT) | ~700 MB | ~1.0 GB | google/gemma-3-1b-it-qat-q4_0-gguf |
| `gemma-3-1b-it-Q8_0.gguf` | ~1.5 GB | ~2.0 GB | ggml-org/gemma-3-1b-it-GGUF |

### Why 1B?
- 4B model = ~2.5 GB GGUF → too large for most phones
- 1B model Q4_K_M = 806 MB → fits comfortably on modern phones (4GB+ RAM)
- QAT variant (Google official) = even smaller, trained with quantization awareness

### Model Format
- **GGUF** (GGML Universal Format) — binary format for fast loading
- Contains model weights, tokenizer, metadata in single file
- No external tokenizer files needed
- llama.rn ONLY supports GGUF

### Model Location on Device
- Download to app's document directory at first launch
- Path: `${FileSystem.documentDirectory}/models/gemma-3-1b-it-Q4_K_M.gguf`
- Can be bundled with app (increases app size by ~800MB) or downloaded on-demand

### Gemma 3 1B Capabilities
- Text-only (no vision for 1B)
- 128K context window (but we'll use 2048 for speed)
- Multilingual: 140+ languages including Dutch
- Instruction-following: good at structured JSON output
- Architecture: gemma3

### Performance Expectations (1B Q4_K_M)
- iPhone 15: ~30-50 tokens/sec
- iPhone 12: ~15-25 tokens/sec
- Android Snapdragon 8 Gen 2: ~20-40 tokens/sec
- Android mid-range: ~10-15 tokens/sec
- First token latency: 200-500ms
- Model load time: 2-5 seconds

## Implementation Plan

1. `initLlama({ model: path, n_ctx: 2048, n_gpu_layers: 99 })`
2. For `detectSignals()`: structured prompt → JSON parse
3. For `scoreRelevance()`: structured prompt → parse 4 float values
4. For `summarizeContext()`: structured prompt → parse theme/urgency/focus
5. All calls use `temperature: 0.1` for deterministic output
6. `n_predict: 200` max (keep responses short)
7. JSON mode: use stop tokens + structured prompts to force JSON output
