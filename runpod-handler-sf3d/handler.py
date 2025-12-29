"""
SF3D (Stable Fast 3D) RunPod Serverless Handler
High-quality 3D mesh generation with UV-unwrapped textures

Input:
    - image: base64 encoded image (PNG/JPG)
    - foreground_ratio: float (0.5-1.0, default 0.85)
    - texture_resolution: int (512, 1024, 2048, default 1024)
    - remesh_option: str ('none', 'triangle', 'quad', default 'none')

Output:
    - model_base64: base64 encoded GLB file
    - file_size: int (bytes)
    - texture_resolution: int
    - execution_time: float (seconds)
"""

import runpod
import base64
import tempfile
import os
import time
import io
import sys
from PIL import Image

# Global model instance (loaded once per worker)
model = None
rembg_session = None
SF3D = None
remove = None
new_session = None


def lazy_import():
    """Import GPU-dependent modules only when needed (not at startup)"""
    global SF3D, remove, new_session
    if SF3D is None:
        print("[Handler] Importing SF3D and dependencies...")
        # Debug: show what's in the sf3d directory
        import os
        sf3d_path = '/app/sf3d'
        if os.path.exists(sf3d_path):
            print(f"[Handler] Contents of {sf3d_path}: {os.listdir(sf3d_path)}")
            sf3d_pkg = os.path.join(sf3d_path, 'sf3d')
            if os.path.exists(sf3d_pkg):
                print(f"[Handler] Contents of {sf3d_pkg}: {os.listdir(sf3d_pkg)}")

        # Try different import approaches
        try:
            from sf3d.system import SF3D as _SF3D
        except ImportError as e:
            print(f"[Handler] Direct import failed: {e}")
            # Try adding to path explicitly
            if sf3d_path not in sys.path:
                sys.path.insert(0, sf3d_path)
            from sf3d.system import SF3D as _SF3D

        from rembg import remove as _remove, new_session as _new_session
        SF3D = _SF3D
        remove = _remove
        new_session = _new_session
        print("[Handler] Imports complete")


def load_model():
    """Load SF3D model (cached globally for performance)"""
    global model, rembg_session, SF3D, new_session
    lazy_import()
    if model is None:
        import torch
        print("[Handler] Loading SF3D model...")
        start = time.time()
        model = SF3D.from_pretrained(
            "stabilityai/stable-fast-3d",
            config_name="config.yaml",
            weight_name="model.safetensors",
        )
        model.to("cuda")
        model.eval()
        print(f"[Handler] SF3D model loaded in {time.time() - start:.2f}s")

        # Initialize rembg session
        print("[Handler] Loading background removal model...")
        rembg_session = new_session("u2net")
        print("[Handler] Background removal model loaded")
    return model


def remove_background(image):
    """Remove background from image using rembg"""
    global rembg_session, remove, new_session
    lazy_import()
    if rembg_session is None:
        rembg_session = new_session("u2net")
    return remove(image, session=rembg_session)


def resize_foreground(image, ratio=0.85):
    """
    Center and resize foreground to fit within frame
    Similar to SF3D's built-in preprocessing
    """
    # Get alpha channel for bounding box
    if image.mode == 'RGBA':
        alpha = image.split()[-1]
        bbox = alpha.getbbox()
        if bbox:
            image = image.crop(bbox)

    # Calculate new size with padding
    old_size = image.size
    new_size = int(max(old_size) / ratio)

    # Create new image with transparent background
    new_image = Image.new("RGBA", (new_size, new_size), (255, 255, 255, 0))

    # Paste centered
    paste_pos = ((new_size - old_size[0]) // 2, (new_size - old_size[1]) // 2)
    new_image.paste(image, paste_pos)

    return new_image


def handler(event):
    """
    RunPod serverless handler for SF3D

    Args:
        event: Dict with 'input' key containing:
            - image: base64 encoded image
            - foreground_ratio: float (default 0.85)
            - texture_resolution: int (default 1024)
            - remesh_option: str (default 'none')

    Returns:
        Dict with model data or error
    """
    try:
        start_time = time.time()

        # Extract input parameters
        input_data = event.get("input", {})

        image_b64 = input_data.get("image")
        foreground_ratio = float(input_data.get("foreground_ratio", 0.85))
        texture_resolution = int(input_data.get("texture_resolution", 1024))
        remesh_option = input_data.get("remesh_option", "none").lower()

        # Validate inputs
        if not image_b64:
            return {"error": "No image provided. Include 'image' key with base64 encoded image."}

        # Clamp foreground ratio
        if foreground_ratio < 0.5 or foreground_ratio > 1.0:
            foreground_ratio = 0.85

        # Clamp texture resolution
        texture_resolution = max(512, min(2048, texture_resolution))

        # Validate remesh option
        if remesh_option not in ['none', 'triangle', 'quad']:
            remesh_option = 'none'

        print(f"[Handler] Parameters: foreground_ratio={foreground_ratio}, texture_resolution={texture_resolution}, remesh={remesh_option}")

        # Decode image
        print("[Handler] Decoding image...")
        try:
            image_data = base64.b64decode(image_b64)
            image = Image.open(io.BytesIO(image_data)).convert("RGBA")
            print(f"[Handler] Image size: {image.size}, mode: {image.mode}")
        except Exception as e:
            return {"error": f"Failed to decode image: {str(e)}"}

        # Preprocess image
        print("[Handler] Preprocessing image...")
        image = remove_background(image)
        image = resize_foreground(image, foreground_ratio)

        # Load model
        sf3d = load_model()
        device = "cuda"

        # Generate mesh with automatic mixed precision
        import torch
        print(f"[Handler] Generating mesh at texture resolution {texture_resolution}...")
        with torch.no_grad():
            with torch.autocast(device_type=device, dtype=torch.bfloat16):
                mesh, glob_dict = sf3d.run_image(
                    image,
                    bake_resolution=texture_resolution,
                    remesh=remesh_option if remesh_option != "none" else None,
                )

        print("[Handler] Mesh generated successfully")

        # Export mesh to GLB
        fd, output_path = tempfile.mkstemp(suffix='.glb')
        os.close(fd)

        print("[Handler] Exporting mesh to GLB...")
        mesh.export(output_path, include_normals=True)

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
        model_b64 = base64.b64encode(mesh_data).decode('utf-8')
        return {
            "model_base64": model_b64,
            "file_size": file_size,
            "format": "glb",
            "texture_resolution": texture_resolution,
            "execution_time": round(execution_time, 2)
        }

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Handler] Error: {str(e)}")
        print(error_trace)
        if "out of memory" in str(e).lower():
            return {"error": "GPU out of memory. Try a lower texture_resolution (512 or 1024)."}
        return {"error": f"Generation failed: {str(e)}"}


# Start RunPod serverless
if __name__ == "__main__":
    print("[Handler] Starting SF3D RunPod handler...")
    runpod.serverless.start({"handler": handler})
