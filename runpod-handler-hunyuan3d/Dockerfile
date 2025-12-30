# Hunyuan3D-2GP RunPod Serverless Handler
# High-quality 3D mesh generation with textures
# GPU: 6GB+ VRAM with profile 4-5, 16GB+ recommended for textures

FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV HF_HOME=/app/models

# CUDA environment for compilation
ENV CUDA_HOME=/usr/local/cuda
ENV PATH="${CUDA_HOME}/bin:${PATH}"
ENV LD_LIBRARY_PATH="${CUDA_HOME}/lib64:${LD_LIBRARY_PATH}"
ENV TORCH_CUDA_ARCH_LIST="7.0;7.5;8.0;8.6;8.9;9.0"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-dev \
    python3-pip \
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
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set python3.10 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.10 1
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1

# Create working directory
WORKDIR /app

# Install PyTorch with CUDA 12.4 support
RUN pip3 install --upgrade pip
RUN pip3 install torch==2.5.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# Clone Hunyuan3D-2GP (optimized low VRAM version)
RUN git clone https://github.com/deepbeepmeep/Hunyuan3D-2GP.git /app/hunyuan3d

# Install Hunyuan3D dependencies
WORKDIR /app/hunyuan3d

# Install diso from source (requires CUDA compilation)
RUN pip3 install --no-build-isolation --verbose git+https://github.com/SarahWeiii/diso.git

# Install remaining requirements (skip diso since it's already installed)
RUN pip3 install -r requirements.txt || pip3 install $(grep -v '^diso' requirements.txt | tr '\n' ' ')

# Build custom rasterizer for texture generation
RUN cd hy3dgen/texgen/custom_rasterizer && python3 setup.py install
RUN cd hy3dgen/texgen/differentiable_renderer && python3 setup.py install

# Install additional handler dependencies
RUN pip3 install --no-cache-dir \
    runpod \
    rembg[gpu] \
    huggingface-hub \
    trimesh \
    pygltflib

# Download Hunyuan3D-2 model weights (public model, no token needed)
RUN python3 -c "from huggingface_hub import snapshot_download; snapshot_download('tencent/Hunyuan3D-2', local_dir='/app/models/hunyuan3d-2')" || echo "Model download skipped - will download at runtime"

# Download rembg model for background removal
RUN python3 -c "from rembg import new_session; new_session('u2net')" || echo "rembg model download skipped"

# Copy handler
WORKDIR /app
COPY runpod-handler-hunyuan3d/handler.py /app/handler.py

# Set Python path to include Hunyuan3D
ENV PYTHONPATH="/app/hunyuan3d"

# Default memory profile (3 = balanced, 4-5 = low VRAM)
ENV HY3D_PROFILE=3

# Run handler
CMD ["python3", "-u", "/app/handler.py"]
