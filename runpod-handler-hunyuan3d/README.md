# Hunyuan3D-2 RunPod Serverless Handler

Self-hosted 2D-to-3D generation for the TripoSR 3D Panel (After Effects CEP extension).

## Overview

### What We're Building
A serverless API endpoint that converts 2D images to textured 3D models (GLB format) using Tencent's Hunyuan3D-2 model, deployed on RunPod's GPU cloud infrastructure.

### Why Self-Host?

| Approach | Cost per Model | Monthly (1,000 models) |
|----------|---------------|------------------------|
| Replicate API | ~$0.02 | $20 |
| RunPod Self-Hosted | ~$0.002-0.004 | $2-4 |

**10x cost savings at scale.**

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              After Effects CEP Panel                         │
│         (TripoSR-3D-Panel/client/js/api.js)                 │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS (RunPod API)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   RunPod Serverless                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Docker Container                        │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │           handler.py (this repo)             │    │    │
│  │  │  - Receives base64 image                     │    │    │
│  │  │  - Runs Hunyuan3D-2 inference               │    │    │
│  │  │  - Returns base64 GLB model                 │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                      │                               │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │         Hunyuan3D-2GP (6GB VRAM)            │    │    │
│  │  │  - Shape generation (DiT flow matching)     │    │    │
│  │  │  - Texture generation (paint pipeline)      │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│        Auto-scales 0 → N workers based on demand             │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Model: Hunyuan3D-2GP
- **Source:** [deepbeepmeep/Hunyuan3D-2GP](https://github.com/deepbeepmeep/Hunyuan3D-2GP)
- **Base:** [Tencent/Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2)
- **Why GP version:** Optimized for low VRAM (6GB minimum vs 16GB+ standard)
- **Output:** Textured GLB meshes with PBR materials
- **Quality:** 85-90% accuracy (comparable to commercial APIs)

### Infrastructure: RunPod Serverless
- **Website:** [runpod.io](https://runpod.io)
- **Features:**
  - Per-second billing (no idle costs)
  - FlashBoot (500ms-2s cold starts)
  - Auto-scaling 0→1000+ workers
  - Network volumes for model caching
- **GPU Options:**
  - RTX 4090 (24GB): ~$0.34/hr
  - A40 (48GB): ~$0.44/hr
  - A100 (80GB): ~$2.72/hr

### Background Removal: rembg
- **Package:** [rembg](https://github.com/danielgatis/rembg)
- **Model:** U2-Net
- **Purpose:** Isolate subject from background before 3D generation

## Files

```
runpod-handler-hunyuan3d/
├── handler.py      # RunPod serverless handler
├── Dockerfile      # Container build instructions
└── README.md       # This file
```

## API Specification

### Input
```json
{
  "input": {
    "image": "<base64-encoded-png-or-jpg>",
    "generate_texture": true,
    "remove_background": true,
    "profile": 3
  }
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `image` | string | required | Base64 encoded image |
| `generate_texture` | bool | true | Generate PBR textures |
| `remove_background` | bool | true | Auto-remove background |
| `profile` | int (1-5) | 3 | Memory profile (higher = less VRAM, slower) |

### Memory Profiles
| Profile | VRAM Required | Speed |
|---------|---------------|-------|
| 1 | 24GB+ | Fastest |
| 2 | 16GB+ | Fast |
| 3 | 12GB+ | Balanced |
| 4 | 8GB+ | Slower |
| 5 | 6GB+ | Slowest |

### Output
```json
{
  "model_base64": "<base64-encoded-glb>",
  "file_size": 1234567,
  "format": "glb",
  "textured": true,
  "execution_time": 45.2
}
```

## Deployment

### Option 1: RunPod GitHub Build (Recommended for CI/CD)
1. Push to GitHub
2. RunPod → Serverless → New Endpoint → GitHub Repo
3. Set Dockerfile path: `runpod-handler-hunyuan3d/Dockerfile`
4. Select GPU (A40 recommended)
5. Enable FlashBoot

**Note:** RunPod has 30min build timeout. Models download at runtime.

### Option 2: Local Build + Docker Hub
```bash
cd /Users/augustas/Documents/GitHub/3d-feature

# Build with models pre-downloaded (slower build, faster first run)
docker build --platform linux/amd64 \
  --build-arg DOWNLOAD_MODELS=true \
  -t augval/hunyuan3d-handler:latest \
  -f runpod-handler-hunyuan3d/Dockerfile .

# Push to Docker Hub
docker login
docker push augval/hunyuan3d-handler:latest
```

Then on RunPod: Use Docker Hub image `augval/hunyuan3d-handler:latest`

### Option 3: Pre-download Models Locally
```bash
# Download models first (can resume if interrupted)
pip install huggingface_hub
python3 -c "from huggingface_hub import snapshot_download; \
  snapshot_download('tencent/Hunyuan3D-2', local_dir='./models/hunyuan3d-2')"

# Then build with COPY instead of download
```

## Configuration

### RunPod Endpoint Settings
| Setting | Recommended Value |
|---------|-------------------|
| GPU | A40 (48GB) or RTX 4090 (24GB) |
| Active Workers | 0 (scale to zero) or 1 (no cold start) |
| Max Workers | 5-10 (based on expected load) |
| FlashBoot | Enabled |
| Idle Timeout | 5 seconds |

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `HY3D_PROFILE` | 3 | Default memory profile |
| `HF_HOME` | /app/models | Hugging Face cache directory |

## Panel Integration

The After Effects panel connects via `TripoSR-3D-Panel/client/js/api.js`:

```javascript
const client = new RunPodAPIClient(apiKey, endpointId);
const result = await client.generate3D(imageBase64, {
  generateTexture: true,
  removeBackground: true,
  profile: 3
});
// result.model_base64 contains the GLB
```

## Cost Estimation

### Per-Request Cost
```
GPU time: ~30-60 seconds
A40 rate: $0.44/hr = $0.00012/sec
Cost per model: 30-60 sec × $0.00012 = $0.0036-0.0072
```

### Monthly Projections
| Volume | Estimated Cost |
|--------|---------------|
| 100 models | $0.36-0.72 |
| 1,000 models | $3.60-7.20 |
| 10,000 models | $36-72 |

### Active Worker Cost (Optional)
If you want zero cold starts:
- 1 Active Worker (A40): ~$0.35/hr × 720hr/month = ~$252/month
- Only worth it at high volume (5,000+ models/month)

## Troubleshooting

### Build Timeout on RunPod
- RunPod has 30min build limit
- Solution: Don't download models during build (default)
- Models download on first run (~5min), then cached

### CUDA Compilation Errors
- Ensure `TORCH_CUDA_ARCH_LIST` matches target GPUs
- Current setting: `7.0;7.5;8.0;8.6;8.9;9.0`

### Out of Memory
- Increase `profile` parameter (4 or 5 for low VRAM)
- Or use larger GPU (A40/A100 instead of 4090)

### Model Download Fails
- Check HuggingFace is accessible
- Try manual download and network volume mount

## Research & Alternatives

### Why Hunyuan3D-2?
| Model | VRAM | Quality | Deployment |
|-------|------|---------|------------|
| InstantMesh | 80GB | 95% | Complex |
| TRELLIS | 24GB+ | 95% | Complex |
| **Hunyuan3D-2GP** | **6GB** | **90%** | **Simple** |
| TripoSR/SF3D | 6-12GB | 70-85% | Simple |

Hunyuan3D-2GP offers the best balance of quality, VRAM efficiency, and deployment simplicity.

### How It Works Internally
```
Input Image → Background Removal (rembg/U2Net)
            → Shape Generation (DiT flow matching)
            → Mesh Extraction (marching cubes)
            → Texture Generation (paint pipeline)
            → GLB Export
```

## Links

- [Hunyuan3D-2GP](https://github.com/deepbeepmeep/Hunyuan3D-2GP) - Low VRAM fork
- [Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) - Original model
- [RunPod Docs](https://docs.runpod.io/serverless) - Serverless deployment
- [RunPod Pricing](https://www.runpod.io/pricing) - GPU costs
