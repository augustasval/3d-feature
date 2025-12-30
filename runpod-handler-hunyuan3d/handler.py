"""
Hunyuan3D-2 RunPod Serverless Handler
High-quality 3D mesh generation with textures using Hunyuan3D-2GP (low VRAM version)

Input:
    - image: base64 encoded image (PNG/JPG)
    - generate_texture: bool (default True) - Generate textured mesh
    - remove_background: bool (default True) - Auto remove background
    - profile: int (1-5, default 3) - Memory profile (higher = less VRAM)

Output:
    - model_base64: base64 encoded GLB file
    - file_size: int (bytes)
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

# Global model instances (loaded once per worker)
shape_pipeline = None
paint_pipeline = None
rembg_session = None

def lazy_import():
    """Import GPU-dependent modules only when needed"""
    global remove, new_session
    try:
        from rembg import remove as _remove, new_session as _new_session
        remove = _remove
        new_session = _new_session
    except ImportError:
        remove = None
        new_session = None
        print("[Handler] rembg not available, background removal disabled")


def load_models(generate_texture=True, profile=3):
    """Load Hunyuan3D-2 models (cached globally for performance)"""
    global shape_pipeline, paint_pipeline

    if shape_pipeline is None:
        import torch
        print("[Handler] Loading Hunyuan3D-2 shape generation pipeline...")
        start = time.time()

        # Set memory profile via environment variable
        os.environ['HY3D_PROFILE'] = str(profile)

        from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

        shape_pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            'tencent/Hunyuan3D-2',
            torch_dtype=torch.float16
        )
        shape_pipeline.to("cuda")
        print(f"[Handler] Shape pipeline loaded in {time.time() - start:.2f}s")

    if generate_texture and paint_pipeline is None:
        import torch
        print("[Handler] Loading Hunyuan3D-2 texture pipeline...")
        start = time.time()

        from hy3dgen.texgen import Hunyuan3DPaintPipeline

        paint_pipeline = Hunyuan3DPaintPipeline.from_pretrained(
            'tencent/Hunyuan3D-2',
            torch_dtype=torch.float16
        )
        paint_pipeline.to("cuda")
        print(f"[Handler] Texture pipeline loaded in {time.time() - start:.2f}s")

    return shape_pipeline, paint_pipeline


def remove_background(image):
    """Remove background from image using rembg"""
    global rembg_session, remove, new_session
    lazy_import()

    if remove is None:
        return image

    if rembg_session is None:
        rembg_session = new_session("u2net")

    return remove(image, session=rembg_session)


def handler(event):
    """
    RunPod serverless handler for Hunyuan3D-2

    Args:
        event: Dict with 'input' key containing:
            - image: base64 encoded image
            - generate_texture: bool (default True)
            - remove_background: bool (default True)
            - profile: int (1-5, default 3)

    Returns:
        Dict with model data or error
    """
    try:
        start_time = time.time()

        # Extract input parameters
        input_data = event.get("input", {})

        image_b64 = input_data.get("image")
        generate_texture = input_data.get("generate_texture", True)
        do_remove_bg = input_data.get("remove_background", True)
        profile = int(input_data.get("profile", 3))

        # Validate inputs
        if not image_b64:
            return {"error": "No image provided. Include 'image' key with base64 encoded image."}

        # Clamp profile
        profile = max(1, min(5, profile))

        print(f"[Handler] Parameters: generate_texture={generate_texture}, remove_bg={do_remove_bg}, profile={profile}")

        # Decode image
        print("[Handler] Decoding image...")
        try:
            image_data = base64.b64decode(image_b64)
            image = Image.open(io.BytesIO(image_data)).convert("RGBA")
            print(f"[Handler] Image size: {image.size}, mode: {image.mode}")
        except Exception as e:
            return {"error": f"Failed to decode image: {str(e)}"}

        # Remove background if requested
        if do_remove_bg:
            print("[Handler] Removing background...")
            image = remove_background(image)

        # Save image to temp file (pipeline expects file path)
        fd, temp_image_path = tempfile.mkstemp(suffix='.png')
        os.close(fd)
        image.save(temp_image_path)

        # Load models
        print("[Handler] Loading models...")
        shape_pipe, paint_pipe = load_models(generate_texture, profile)

        # Generate mesh
        import torch
        print("[Handler] Generating 3D mesh...")
        with torch.no_grad():
            mesh = shape_pipe(image=temp_image_path)[0]

        print("[Handler] Mesh generated successfully")

        # Apply textures if requested
        if generate_texture and paint_pipe is not None:
            print("[Handler] Applying textures...")
            with torch.no_grad():
                mesh = paint_pipe(mesh, image=temp_image_path)
            print("[Handler] Textures applied")

        # Export mesh to GLB
        fd, output_path = tempfile.mkstemp(suffix='.glb')
        os.close(fd)

        print("[Handler] Exporting mesh to GLB...")
        mesh.export(output_path)

        # Read output file
        with open(output_path, "rb") as f:
            mesh_data = f.read()

        file_size = len(mesh_data)
        print(f"[Handler] Output file size: {file_size} bytes")

        # Clean up temp files
        os.remove(temp_image_path)
        os.remove(output_path)

        execution_time = time.time() - start_time
        print(f"[Handler] Total execution time: {execution_time:.2f}s")

        # Return result
        model_b64 = base64.b64encode(mesh_data).decode('utf-8')
        return {
            "model_base64": model_b64,
            "file_size": file_size,
            "format": "glb",
            "textured": generate_texture,
            "execution_time": round(execution_time, 2)
        }

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Handler] Error: {str(e)}")
        print(error_trace)
        if "out of memory" in str(e).lower():
            return {"error": "GPU out of memory. Try increasing the memory profile (3-5)."}
        return {"error": f"Generation failed: {str(e)}"}


# Start RunPod serverless
if __name__ == "__main__":
    print("[Handler] Starting Hunyuan3D-2 RunPod handler...")
    runpod.serverless.start({"handler": handler})
