"""
TripoSR RunPod Serverless Handler
Converts 2D images to 3D GLB models using TripoSR

Input:
    - image: base64 encoded image (PNG/JPG)
    - foreground_ratio: float (0.5-1.0, default 0.85)
    - mc_resolution: int (128, 256, 512, default 256)
    - output_format: str ('glb' or 'obj', default 'glb')

Output:
    - model_base64: base64 encoded GLB/OBJ file (for small files <5MB)
    - model_url: S3 presigned URL (for large files >5MB)
    - file_size: int (bytes)
    - vertices: int
    - faces: int
    - execution_time: float (seconds)
"""

import runpod
import torch
import base64
import tempfile
import os
import time
import io
import sys
from PIL import Image

# Add TripoSR to path
sys.path.insert(0, '/app/triposr')

from tsr.system import TSR
from tsr.utils import remove_background, resize_foreground

# Global model instance (loaded once per worker)
model = None


def load_model():
    """Load TripoSR model (cached globally for performance)"""
    global model
    if model is None:
        print("[Handler] Loading TripoSR model...")
        start = time.time()
        model = TSR.from_pretrained(
            "stabilityai/TripoSR",
            config_name="config.yaml",
            weight_name="model.ckpt"
        )
        model.renderer.set_chunk_size(8192)
        model.to("cuda")
        print(f"[Handler] Model loaded in {time.time() - start:.2f}s")
    return model


def preprocess_image(image, foreground_ratio=0.85):
    """
    Preprocess image for TripoSR:
    1. Remove background
    2. Resize to fit foreground ratio
    3. Convert to RGB on white background
    """
    print("[Handler] Preprocessing image...")

    # Remove background
    image = remove_background(image)

    # Resize with foreground ratio
    image = resize_foreground(image, foreground_ratio)

    # Convert RGBA to RGB with white background
    if image.mode == 'RGBA':
        background = Image.new('RGB', image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[3])
        image = background
    elif image.mode != 'RGB':
        image = image.convert('RGB')

    return image


def generate_mesh(image, mc_resolution=256):
    """Generate 3D mesh from preprocessed image"""
    print(f"[Handler] Generating mesh at resolution {mc_resolution}...")

    tsr = load_model()

    with torch.no_grad():
        # Run the model
        scene_codes = tsr([image], device="cuda")

        # Extract mesh (second arg is has_vertex_color - must be positional)
        meshes = tsr.extract_mesh(
            scene_codes,
            True,  # has_vertex_color (positional, not keyword!)
            resolution=mc_resolution
        )

        return meshes[0]


def export_mesh(mesh, output_format='glb', output_path=None):
    """Export mesh to file format"""
    if output_path is None:
        suffix = '.glb' if output_format == 'glb' else '.obj'
        fd, output_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)

    print(f"[Handler] Exporting mesh to {output_format.upper()}...")

    if output_format == 'glb':
        mesh.export(output_path, file_type='glb')
    else:
        mesh.export(output_path, file_type='obj')

    return output_path


def handler(event):
    """
    RunPod serverless handler for TripoSR

    Args:
        event: Dict with 'input' key containing:
            - image: base64 encoded image
            - foreground_ratio: float (default 0.85)
            - mc_resolution: int (default 256)
            - output_format: str (default 'glb')

    Returns:
        Dict with model data or error
    """
    try:
        start_time = time.time()

        # Extract input parameters
        input_data = event.get("input", {})

        image_b64 = input_data.get("image")
        foreground_ratio = float(input_data.get("foreground_ratio", 0.85))
        mc_resolution = int(input_data.get("mc_resolution", 256))
        output_format = input_data.get("output_format", "glb").lower()

        # Validate inputs
        if not image_b64:
            return {"error": "No image provided. Include 'image' key with base64 encoded image."}

        if foreground_ratio < 0.5 or foreground_ratio > 1.0:
            foreground_ratio = 0.85

        if mc_resolution not in [128, 256, 512]:
            mc_resolution = 256

        if output_format not in ['glb', 'obj']:
            output_format = 'glb'

        print(f"[Handler] Parameters: foreground_ratio={foreground_ratio}, mc_resolution={mc_resolution}, output_format={output_format}")

        # Decode image
        print("[Handler] Decoding image...")
        try:
            image_data = base64.b64decode(image_b64)
            image = Image.open(io.BytesIO(image_data))
            print(f"[Handler] Image size: {image.size}, mode: {image.mode}")
        except Exception as e:
            return {"error": f"Failed to decode image: {str(e)}"}

        # Preprocess image
        processed_image = preprocess_image(image, foreground_ratio)

        # Generate mesh
        mesh = generate_mesh(processed_image, mc_resolution)

        # Get mesh statistics
        vertices = len(mesh.vertices)
        faces = len(mesh.faces)
        print(f"[Handler] Mesh generated: {vertices} vertices, {faces} faces")

        # Export mesh
        output_path = export_mesh(mesh, output_format)

        # Read output file
        with open(output_path, "rb") as f:
            mesh_data = f.read()

        file_size = len(mesh_data)
        print(f"[Handler] Output file size: {file_size} bytes")

        # Clean up temp file
        os.remove(output_path)

        execution_time = time.time() - start_time
        print(f"[Handler] Total execution time: {execution_time:.2f}s")

        # Return result
        # For files under 5MB, return base64 directly
        # For larger files, would need S3 upload (not implemented yet)
        if file_size < 5 * 1024 * 1024:
            model_b64 = base64.b64encode(mesh_data).decode('utf-8')
            return {
                "model_base64": model_b64,
                "file_size": file_size,
                "vertices": vertices,
                "faces": faces,
                "format": output_format,
                "execution_time": round(execution_time, 2)
            }
        else:
            # TODO: Implement S3 upload for large files
            # For now, return base64 anyway (may cause issues with very large models)
            model_b64 = base64.b64encode(mesh_data).decode('utf-8')
            return {
                "model_base64": model_b64,
                "file_size": file_size,
                "vertices": vertices,
                "faces": faces,
                "format": output_format,
                "execution_time": round(execution_time, 2),
                "warning": "Large file returned as base64. Consider using S3 for production."
            }

    except torch.cuda.OutOfMemoryError:
        return {"error": "GPU out of memory. Try a lower resolution (128 or 256)."}

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Handler] Error: {str(e)}")
        print(error_trace)
        return {"error": f"Generation failed: {str(e)}"}


# Start RunPod serverless
if __name__ == "__main__":
    print("[Handler] Starting TripoSR RunPod handler...")
    runpod.serverless.start({"handler": handler})
