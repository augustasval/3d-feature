# TripoSR RunPod Serverless Handler
# GPU: A100 recommended, RTX 4090 works, minimum 6GB VRAM

FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    git \
    wget \
    cmake \
    ninja-build \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Install PyTorch with CUDA support
RUN pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# Clone TripoSR repository
RUN git clone https://github.com/VAST-AI-Research/TripoSR.git /app/triposr

# Install TripoSR dependencies (handle xatlas metadata issue)
WORKDIR /app/triposr
RUN pip3 install --no-cache-dir \
    omegaconf==2.3.0 \
    Pillow>=10.0.0 \
    einops==0.7.0 \
    transformers>=4.35.0 \
    trimesh>=4.0.0 \
    rembg \
    huggingface-hub \
    imageio[ffmpeg] \
    && pip3 install --no-cache-dir xatlas \
    && pip3 install --no-cache-dir git+https://github.com/tatsy/torchmcubes.git

# Install additional dependencies for handler
RUN pip3 install --no-cache-dir \
    runpod \
    boto3 \
    numpy \
    "pyglet<2" \
    onnxruntime-gpu

# Download model weights on build (speeds up cold starts)
RUN python3 -c "from tsr.system import TSR; TSR.from_pretrained('stabilityai/TripoSR', config_name='config.yaml', weight_name='model.ckpt')"

# Copy handler
WORKDIR /app
COPY handler.py /app/handler.py

# Set Python path
ENV PYTHONPATH="/app/triposr"

# Run handler
CMD ["python3", "-u", "/app/handler.py"]
