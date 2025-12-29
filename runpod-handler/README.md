# TripoSR RunPod Handler

RunPod serverless handler for converting 2D images to 3D GLB models using TripoSR.

## Features

- Single image to 3D mesh conversion
- Background removal and preprocessing
- Configurable mesh resolution (128, 256, 512)
- GLB and OBJ output formats
- GPU-accelerated inference

## Deployment Steps

### 1. Build Docker Image

```bash
cd runpod-handler
docker build -t triposr-handler .
```

### 2. Push to Docker Hub

```bash
docker tag triposr-handler YOUR_DOCKERHUB_USERNAME/triposr-handler:latest
docker push YOUR_DOCKERHUB_USERNAME/triposr-handler:latest
```

### 3. Create RunPod Serverless Endpoint

1. Go to [RunPod Console](https://www.runpod.io/console/serverless)
2. Click "New Endpoint"
3. Configure:
   - **Container Image**: `YOUR_DOCKERHUB_USERNAME/triposr-handler:latest`
   - **GPU Type**: A100 (recommended) or RTX 4090/3090
   - **Min Workers**: 0 (scale to zero)
   - **Max Workers**: Based on expected load
   - **Idle Timeout**: 30 seconds
   - **Flash Boot**: Enabled (faster cold starts)
4. Create endpoint and copy the Endpoint ID

### 4. Configure Panel

Enter the Endpoint ID in the TripoSR 3D Panel settings in After Effects.

## API Reference

### Request

```json
{
  "input": {
    "image": "<base64 encoded PNG/JPG>",
    "foreground_ratio": 0.85,
    "mc_resolution": 256,
    "output_format": "glb"
  }
}
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `image` | string | required | Base64 encoded input image |
| `foreground_ratio` | float | 0.85 | Ratio of foreground in output (0.5-1.0) |
| `mc_resolution` | int | 256 | Mesh resolution: 128, 256, or 512 |
| `output_format` | string | "glb" | Output format: "glb" or "obj" |

### Response

```json
{
  "model_base64": "<base64 encoded GLB file>",
  "file_size": 2457600,
  "vertices": 45000,
  "faces": 90000,
  "format": "glb",
  "execution_time": 2.34
}
```

## Performance

| Resolution | Time (A100) | VRAM | Vertices |
|------------|-------------|------|----------|
| 128 | ~1s | ~4GB | ~10k |
| 256 | ~2s | ~6GB | ~45k |
| 512 | ~5s | ~10GB | ~180k |

## Troubleshooting

### GPU Out of Memory
- Use lower resolution (128 or 256)
- Ensure adequate GPU memory (6GB+ recommended)

### Cold Start Times
- Enable Flash Boot in RunPod
- Model weights are downloaded during Docker build
- First request may take 10-30s for model loading

### Invalid Output
- Ensure input image has clear subject
- Use images with good contrast
- Avoid complex backgrounds (handled by rembg)

## License

TripoSR is released under MIT license by Stability AI and Tripo AI.
