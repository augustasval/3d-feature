# SAM3 Segmentation Panel - Technical Documentation

Complete technical documentation for the SAM3 After Effects CEP Panel (v2.5).

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [ExtendScript API (Host)](#extendscript-api-host)
5. [Client-Side JavaScript](#client-side-javascript)
6. [RunPod API Integration](#runpod-api-integration)
7. [Workflow](#workflow)
8. [Data Formats](#data-formats)
9. [Configuration](#configuration)
10. [Extension Points](#extension-points)

---

## Overview

SAM3 Segmentation Panel is a CEP (Common Extensibility Platform) extension for Adobe After Effects that enables AI-powered object segmentation using SAM 3 (Segment Anything Model 3) running on RunPod serverless GPU infrastructure.

### Key Features

- **Single Frame Segmentation**: Segment objects in current frame using text prompts
- **Video Segmentation**: Track objects across multiple frames with keyframed masks
- **Auto-precompose**: Automatically precomposes selected layer with correct settings
- **S3 Upload Support**: Large videos (>7MB) automatically upload via S3 to bypass API limits
- **Preview Mode**: Preview first frame before processing full video

### Supported After Effects Versions

- After Effects 2021 (18.0) and later
- Requires CSXS 9.0 runtime

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    After Effects Host                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              ExtendScript (JSX)                          │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │    │
│  │  │ layerUtils   │ │ frameExporter│ │ maskCreator      │ │    │
│  │  │ .jsx         │ │ .jsx         │ │ .jsx             │ │    │
│  │  └──────────────┘ └──────────────┘ └──────────────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↑ evalScript()                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              CEP Panel (Chromium)                        │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │    │
│  │  │ main.js  │ │ api.js   │ │settings.js│ │ ui.js      │  │    │
│  │  │ (SAM3    │ │ (RunPod  │ │ (local-  │ │ (UI        │  │    │
│  │  │  Panel)  │ │  Client) │ │  Storage)│ │  helpers)  │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RunPod Serverless                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  SAM3 Handler (GPU)                                      │    │
│  │  - Florence-2 (object detection)                         │    │
│  │  - SAM 2.1 (segmentation)                                │    │
│  │  - Object tracking                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
SAM3-Segmentation-Panel/
├── CSXS/
│   └── manifest.xml              # CEP extension manifest
├── client/
│   ├── index.html                # Main panel HTML
│   ├── CSInterface.js            # Adobe CEP library
│   ├── css/
│   │   ├── main.css              # Core styles
│   │   └── components.css        # Component styles
│   └── js/
│       ├── main.js               # Main panel logic (SAM3Panel class)
│       ├── api.js                # RunPod API client
│       ├── settings.js           # Settings manager
│       ├── ui.js                 # UI helper functions
│       └── utils.js              # Utility functions
├── host/
│   ├── main.jsx                  # ExtendScript entry point
│   └── modules/
│       ├── layerUtils.jsx        # Layer/comp operations
│       ├── frameExporter.jsx     # Frame/video export
│       ├── maskCreator.jsx       # Mask creation
│       └── errorHandler.jsx      # Error handling
├── install-mac.command           # Mac installer
├── uninstall-mac.command         # Mac uninstaller
└── tests/                        # Test files
```

---

## ExtendScript API (Host)

All ExtendScript functions return JSON strings. Parse with `JSON.parse()`.

### Layer Utilities (`layerUtils.jsx`)

#### `getCompLayers()`
Get all layers from the active composition.

**Returns:**
```json
{
  "success": true,
  "compName": "Main Comp",
  "compWidth": 1920,
  "compHeight": 1080,
  "frameRate": 30,
  "duration": 10.0,
  "layers": [
    {
      "index": 1,
      "name": "Layer 1",
      "enabled": true,
      "hasVideo": true,
      "canHaveMask": true,
      "locked": false,
      "shy": false,
      "solo": false
    }
  ]
}
```

#### `getActiveComp()`
Get active composition metadata.

**Returns:**
```json
{
  "success": true,
  "name": "Main Comp",
  "width": 1920,
  "height": 1080,
  "pixelAspect": 1.0,
  "frameRate": 30,
  "frameDuration": 0.0333,
  "duration": 10.0,
  "workAreaStart": 0,
  "workAreaDuration": 10.0,
  "currentTime": 2.5,
  "bgColor": [0, 0, 0]
}
```

#### `getSelectedLayer()`
Get the currently selected layer in the timeline.

**Returns:**
```json
{
  "success": true,
  "name": "My Layer",
  "index": 1,
  "width": 3840,
  "height": 2160,
  "hasVideo": true,
  "source": "footage.mp4"
}
```

**Errors:**
- `"No active composition"`
- `"No layer selected. Please select a layer in the timeline."`
- `"Multiple layers selected (N). Please select only one layer."`
- `"Selected layer cannot have masks (null, camera, or light layer)"`
- `"Selected layer is locked. Please unlock it first."`

#### `precomposeLayer(layerName)`
Precompose a layer with composition-matched settings.

**Parameters:**
- `layerName` (string): Name of the layer to precompose

**Behavior:**
- Creates precomp named `SAM3_{layerName}`
- Uses **composition** resolution (not footage)
- Duration = `min(comp.duration, layer.outPoint - layer.inPoint)`
- Scales footage to fit if larger than comp
- Fixes timing for trimmed layers (no blank frames)

**Returns:**
```json
{
  "success": true,
  "precompName": "SAM3_My Layer",
  "precompLayerName": "SAM3_My Layer",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": 5.0,
  "scaled": true,
  "scaleFactor": 50.0
}
```

#### `validateLayer(layerName)`
Validate that a layer exists and can receive masks.

**Parameters:**
- `layerName` (string): Name of the layer to validate

**Returns:**
```json
{
  "success": true,
  "valid": true,
  "layerName": "My Layer",
  "layerIndex": 1
}
```

---

### Frame Exporter (`frameExporter.jsx`)

#### `checkSetupStatus()`
Check if required output templates are available.

**Returns:**
```json
{
  "success": true,
  "setupComplete": true,
  "hasSAM3PNG": true,
  "hasPNGSequence": true,
  "hasH264": true,
  "message": "SAM3_PNG template found. Setup complete.",
  "availableTemplates": ["SAM3_PNG", "H.264", "PNG Sequence"]
}
```

#### `createSAM3PNGTemplate()`
Create the SAM3_PNG output module template automatically.

**Returns:**
```json
{
  "success": true,
  "message": "SAM3_PNG template created successfully"
}
```

#### `exportCurrentFrame()`
Export current frame from active composition to PNG file.

**Returns:**
```json
{
  "success": true,
  "pngFilePath": "/Users/.../SAM3_temp/ae_render_123456.png",
  "width": 1920,
  "height": 1080,
  "fileSize": 2048576,
  "exportMethod": "RenderQueue"
}
```

#### `exportAsVideo(startFrame, endFrame, rangeType)`
Export frame range as video file for video segmentation.

**Parameters:**
- `startFrame` (number): Start frame index (0-based)
- `endFrame` (number): End frame index (exclusive)
- `rangeType` (string): `"workarea"`, `"full"`, or `"custom"`

**Returns:**
```json
{
  "success": true,
  "videoFilePath": "/Users/.../SAM3_temp/ae_video_123456.mp4",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "startFrame": 0,
  "endFrame": 150,
  "frameCount": 150,
  "fileSize": 5242880,
  "exportMethod": "RenderQueue Video"
}
```

#### `getCompFrameRange()`
Get composition frame range info.

**Returns:**
```json
{
  "success": true,
  "fps": 30,
  "totalFrames": 300,
  "duration": 10.0,
  "workAreaStart": 30,
  "workAreaEnd": 270,
  "workAreaDuration": 240,
  "compName": "Main Comp",
  "width": 1920,
  "height": 1080
}
```

#### `convertFileToBase64(filePath)`
Convert a file to base64 string (fallback method).

**Parameters:**
- `filePath` (string): Path to the file

**Returns:**
```json
{
  "success": true,
  "imageBase64": "iVBORw0KGgo...",
  "fileSize": 2048576,
  "base64Length": 2731435
}
```

---

### Mask Creator (`maskCreator.jsx`)

#### `createMaskFromPolygon(layerName, polygonPoints, maskName)`
Create a mask from polygon points on a specified layer.

**Parameters:**
- `layerName` (string): Name of the target layer
- `polygonPoints` (array): Array of `[x, y]` coordinate pairs
- `maskName` (string): Name for the new mask

**Returns:**
```json
{
  "success": true,
  "maskIndex": 1,
  "maskName": "SAM3_Mask_1",
  "vertexCount": 150,
  "layerName": "My Layer"
}
```

#### `createKeyframedMask(layerName, framesDataJSON, objectId, fps, startFrame, maskNumber)`
Create a keyframed mask for video segmentation results.

**Parameters:**
- `layerName` (string): Name of the target layer
- `framesDataJSON` (string): JSON string with per-frame polygon data
- `objectId` (number): Object ID to create mask for
- `fps` (number): Composition frame rate
- `startFrame` (number): Starting frame index
- `maskNumber` (number): Sequential mask number (1, 2, 3...)

**Returns:**
```json
{
  "success": true,
  "maskName": "SAM3_Mask_1",
  "objectId": 0,
  "keyframeCount": 150,
  "firstFrame": 0,
  "lastFrame": 149,
  "layerName": "SAM3_My Layer"
}
```

#### `createAllKeyframedMasks(layerName, framesDataJSON, fps, startFrame)`
Create keyframed masks for all tracked objects at once.

**Parameters:**
- `layerName` (string): Name of the target layer
- `framesDataJSON` (string): JSON string with per-frame polygon data
- `fps` (number): Composition frame rate
- `startFrame` (number): Starting frame index

**Returns:**
```json
{
  "success": true,
  "totalObjects": 3,
  "successCount": 3,
  "totalTimeMs": 5234,
  "avgTimePerMaskMs": 1745,
  "results": [...]
}
```

#### `deleteMasksWithPattern(layerName, pattern)`
Delete all masks matching a name pattern from a layer.

**Parameters:**
- `layerName` (string): Name of the target layer
- `pattern` (string): Name pattern to match (e.g., `"SAM3_"`)

**Returns:**
```json
{
  "success": true,
  "deletedCount": 5,
  "pattern": "SAM3_",
  "layerName": "My Layer"
}
```

---

## Client-Side JavaScript

### SAM3Panel Class (`main.js`)

Main orchestrator class that manages the entire workflow.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `csInterface` | CSInterface | Adobe CEP interface |
| `settings` | SettingsManager | Settings persistence |
| `apiClient` | RunPodAPIClient | API communication |
| `currentMasks` | Array | Current segmentation results |
| `currentMode` | string | `'single'` or `'video'` |
| `videoSegmentationResult` | Object | Video segmentation data |
| `isProcessing` | boolean | Processing state |
| `currentTargetLayer` | string | Layer name for mask application |

#### Key Methods

```javascript
// Initialization
async init()
setupEventListeners()
restoreSettings(settings)
saveSettings()

// API
async testConnection()
async checkSetup()
async createOutputTemplate()

// Layer operations
async updateLayerList()

// Single frame segmentation
async runSegmentation()
displayResults(result)
async applyMask(mask, index)
async applyAllMasks()

// Video segmentation
setMode(mode)
async previewVideoSegmentation()
async runVideoSegmentation()
async cancelVideoSegmentation()
displayVideoResults(result)
async applyVideoMaskForObject(objectId, maskNumber)
async applyAllVideoMasks()

// File operations
async readFileAsBase64(filePath)
async readFileAsBinary(filePath)
cleanupTempFile(filePath)

// Progress UI
showVideoProgress(show)
startProgressTimer()
stopProgressTimer()
updateProgressStatus(status)

// ExtendScript communication
evalScript(script) → Promise
```

---

### RunPodAPIClient Class (`api.js`)

Handles all communication with RunPod serverless backend.

#### Constructor

```javascript
const client = new RunPodAPIClient(apiKey, endpointId);
```

#### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `apiKey` | string | - | RunPod API key |
| `endpointId` | string | - | RunPod endpoint ID |
| `baseURL` | string | - | Full API URL |
| `pollInterval` | number | 2000 | Poll interval (ms) |
| `maxPollAttempts` | number | 60 | Max attempts for images |
| `maxVideoPollAttempts` | number | 300 | Max attempts for videos |
| `currentJobId` | string | null | Current job ID |

#### Methods

```javascript
// Image segmentation
async segmentImage(imageBase64, prompt, options) → Promise<Object>

// Video segmentation
async segmentVideo(videoBase64, prompt, options, onProgress) → Promise<Object>
async previewVideo(videoBase64, prompt, options, onProgress) → Promise<Object>

// S3 upload flow (for large videos)
async requestUploadUrl() → Promise<Object>
async uploadToS3(uploadUrl, fileData, onProgress) → Promise<void>
async segmentVideoFromS3(videoKey, prompt, options, onProgress) → Promise<Object>

// Job management
async pollJobStatus(jobId) → Promise<Object>
async pollVideoJobStatus(jobId, onProgress) → Promise<Object>
async cancelJob(jobId) → Promise<boolean>
async cancelCurrentJob() → Promise<boolean>

// Connection test
async testConnection() → Promise<boolean>
```

#### Options Object

```javascript
{
  confidence_threshold: 0.5,  // 0.0 - 1.0
  max_masks: 10,              // Max masks to return
  polygon_quality: 100,       // Higher = more detail
  edge_snap_distance: 10,     // Snap to edges (px)
  max_frames: 300             // For video only
}
```

---

### SettingsManager Class (`settings.js`)

Handles localStorage persistence for user settings.

#### Default Settings

```javascript
{
  apiKey: '',
  endpointId: '2scmvr4oiaxhpa',
  defaultConfidence: 0.5,
  defaultMaxMasks: 10,
  defaultPolygonQuality: 50,
  defaultEdgeSnap: 10,
  autoApplyBestMask: false,
  maskNamePrefix: 'SAM3_Mask_',
  maxFileSizeMB: 100
}
```

#### Methods

```javascript
load() → Object           // Load settings
save(settings) → boolean  // Save settings
clear() → boolean         // Clear all settings
get(key) → any            // Get single setting
set(key, value) → boolean // Set single setting
validate() → Object       // Validate for API usage
```

---

## RunPod API Integration

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/run` | POST | Submit new job |
| `/status/{jobId}` | GET | Check job status |
| `/health` | GET | Health check |
| `/cancel/{jobId}` | POST | Cancel job |

### Request Format - Image Segmentation

```json
{
  "input": {
    "image": "<base64>",
    "prompt": "person",
    "confidence_threshold": 0.5,
    "max_masks": 10,
    "polygon_quality": 100,
    "edge_snap_distance": 10
  }
}
```

### Request Format - Video Segmentation

```json
{
  "input": {
    "video": "<base64>",
    "prompt": "person",
    "mode": "video",
    "confidence_threshold": 0.5,
    "max_frames": 300,
    "polygon_quality": 100,
    "edge_snap_distance": 10
  }
}
```

### Request Format - S3 Video

```json
{
  "input": {
    "video_key": "uploads/abc123.mp4",
    "prompt": "person",
    "mode": "video",
    ...
  }
}
```

### Request Format - Preview

```json
{
  "input": {
    "video": "<base64>",
    "prompt": "person",
    "mode": "preview",
    ...
  }
}
```

### Response Format - Image

```json
{
  "masks": [
    {
      "id": 0,
      "confidence": 0.95,
      "polygon": [[x1, y1], [x2, y2], ...],
      "bbox": [x, y, width, height],
      "area": 50000
    }
  ],
  "execution_time": 1.23
}
```

### Response Format - Video

```json
{
  "summary": {
    "total_frames": 150,
    "tracked_objects": 2,
    "object_ids": [0, 1]
  },
  "frames": {
    "0": [
      {
        "id": 0,
        "confidence": 0.95,
        "polygon": [[x1, y1], [x2, y2], ...]
      }
    ],
    "1": [...],
    ...
  }
}
```

### Response Format - Preview

```json
{
  "object_count": 2,
  "first_frame_masks": [
    {
      "id": 0,
      "confidence": 0.95,
      "polygon": [[x1, y1], ...]
    }
  ]
}
```

### Job Status Values

| Status | Description |
|--------|-------------|
| `IN_QUEUE` | Waiting for worker |
| `IN_PROGRESS` | Being processed |
| `COMPLETED` | Finished successfully |
| `FAILED` | Failed with error |
| `CANCELLED` | Cancelled by user |
| `TIMED_OUT` | Server timeout |

---

## Workflow

### Single Frame Segmentation Flow

```
1. User selects layer in AE timeline
2. User enters text prompt and clicks "Segment"
3. Panel calls getSelectedLayer() → validates selection
4. Panel calls precomposeLayer() → creates SAM3_* precomp
5. Panel calls exportCurrentFrame() → renders PNG to temp folder
6. Panel reads PNG and converts to base64
7. Panel sends to RunPod API for segmentation
8. RunPod returns masks with polygon coordinates
9. Panel displays results in UI
10. User clicks "Apply" → createMaskFromPolygon() creates AE mask
```

### Video Segmentation Flow

```
1. User selects layer in AE timeline
2. User enters text prompt and selects frame range
3. (Optional) User clicks "Preview" → processes first frame only
4. User clicks "Segment Full Video"
5. Panel calls getSelectedLayer() → validates selection
6. Panel calls precomposeLayer() → creates SAM3_* precomp
7. Panel calls exportAsVideo() → renders video to temp folder
8. If video > 7MB:
   a. Request presigned S3 URL
   b. Upload video directly to S3
   c. Submit job with video_key
9. Else:
   a. Convert video to base64
   b. Submit job with video base64
10. RunPod tracks objects across frames
11. RunPod returns per-frame polygon data
12. Panel displays tracked objects
13. User clicks "Apply All" → createAllKeyframedMasks() creates keyframed masks
```

### Precompose Flow (v2.5)

```
1. Get selected layer name and properties
2. Calculate duration = min(comp.duration, layer.outPoint - layer.inPoint)
3. Get composition settings (width, height, fps)
4. Call comp.layers.precompose(layerIndices, name, true)
5. Set precomp.width/height/fps/duration to comp settings
6. Get inner layer
7. Fix timing: innerLayer.startTime = 0 - innerLayer.inPoint
8. If footage > comp size:
   a. Calculate scale factor
   b. Apply scale to inner layer
   c. Center layer in precomp
9. Return precomp info
```

---

## Data Formats

### Polygon Format

Polygons are arrays of `[x, y]` coordinates in pixel space:

```javascript
[
  [100.5, 200.3],
  [150.2, 210.5],
  [180.0, 300.1],
  // ... more points
  [100.5, 200.3]  // Closed polygon (first point repeated)
]
```

### Frames Data Format (Video)

```javascript
{
  "0": [  // Frame index
    {
      "id": 0,           // Object ID (consistent across frames)
      "confidence": 0.95,
      "polygon": [[x, y], ...]
    },
    {
      "id": 1,
      "confidence": 0.88,
      "polygon": [[x, y], ...]
    }
  ],
  "1": [...],
  "2": [...],
  // ... more frames
}
```

### Mask Properties in After Effects

```javascript
{
  vertices: [[x, y], ...],      // Mask path vertices
  inTangents: [[0, 0], ...],    // In tangent handles (bezier)
  outTangents: [[0, 0], ...],   // Out tangent handles (bezier)
  closed: true                   // Closed path
}
```

---

## Configuration

### CEP Manifest (`CSXS/manifest.xml`)

```xml
<ExtensionManifest ExtensionBundleId="com.sam3.segmentation" Version="12.0">
  <ExtensionList>
    <Extension Id="com.sam3.segmentation.panel" Version="1.0.0"/>
  </ExtensionList>
  <ExecutionEnvironment>
    <HostList>
      <Host Name="AEFT" Version="[18.0,99.9]"/>  <!-- AE 2021+ -->
    </HostList>
    <RequiredRuntimeList>
      <RequiredRuntime Name="CSXS" Version="9.0"/>
    </RequiredRuntimeList>
  </ExecutionEnvironment>
  <DispatchInfoList>
    <Extension Id="com.sam3.segmentation.panel">
      <DispatchInfo>
        <Resources>
          <MainPath>./client/index.html</MainPath>
          <ScriptPath>./host/main.jsx</ScriptPath>
          <CEFCommandLine>
            <Parameter>--enable-nodejs</Parameter>
            <Parameter>--mixed-context</Parameter>
          </CEFCommandLine>
        </Resources>
        <UI>
          <Type>Panel</Type>
          <Menu>SAM 3 Segmentation</Menu>
          <Geometry>
            <Size><Height>600</Height><Width>400</Width></Size>
            <MinSize><Height>400</Height><Width>300</Width></MinSize>
            <MaxSize><Height>2000</Height><Width>800</Width></MaxSize>
          </Geometry>
        </UI>
      </DispatchInfo>
    </Extension>
  </DispatchInfoList>
</ExtensionManifest>
```

### Output Module Templates

The panel uses these templates in order of preference:

**PNG Export:**
1. `SAM3_PNG` (custom user template)
2. `PNG Sequence`
3. `PNG`
4. `JPEG Sequence` (fallback)
5. `TIFF Sequence` (fallback)

**Video Export:**
1. `H.264`
2. `H.264 - Match Render Settings - 15 Mbps`
3. `Apple ProRes 422`
4. `QuickTime`
5. `Lossless`

### Limits and Defaults

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Confidence | 0.5 | 0.0-1.0 | Detection threshold |
| Max Masks | 10 | 1-20 | Maximum masks per frame |
| Polygon Quality | 100 | 0-500 | Higher = more detail |
| Edge Snap | 10 | 0-50 | Snap to edges (pixels) |
| Max File Size | 100 MB | 50-200 | Video upload limit |
| Max Resolution | 8192x8192 | - | Composition limit |
| Max FPS | 120 | - | Frame rate limit |
| Max Video Poll | 10 min | - | Video processing timeout |
| S3 Threshold | 7 MB | - | Switch to S3 upload |

---

## Extension Points

### Adding New Segmentation Parameters

1. Add UI control in `index.html`
2. Add event listener in `main.js` `setupEventListeners()`
3. Pass parameter to API call in `runSegmentation()` or `runVideoSegmentation()`
4. Update `api.js` to include in request body

### Adding New Export Formats

1. Add template handling in `frameExporter.jsx`
2. Update `exportCurrentFrame()` or `exportAsVideo()` template lists
3. Handle new file extension in output search

### Adding New Mask Types

1. Add new function in `maskCreator.jsx`
2. Expose via ExtendScript (no `#include` needed if in main.jsx)
3. Call from `main.js` via `evalScript()`

### Integrating New AI Models

To add a new model (e.g., TripoSR for 3D):

1. Create new API method in `api.js`:
```javascript
async generate3DModel(imageBase64, options, onProgress) {
  // Similar pattern to segmentImage()
}
```

2. Add UI mode/button in `index.html`

3. Add workflow in `main.js`:
```javascript
async run3DGeneration() {
  // Export frame
  // Call API
  // Handle result (download 3D file, import to AE, etc.)
}
```

4. (Optional) Add ExtendScript functions for AE-specific operations

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "No active composition" | No comp open in AE | Open a composition |
| "No layer selected" | Nothing selected in timeline | Click on a layer |
| "Multiple layers selected" | More than one layer selected | Select only one layer |
| "Layer is locked" | Layer locked in timeline | Unlock the layer |
| "Layer cannot have masks" | Null/camera/light layer | Select footage or solid |
| "Job failed" | Server-side error | Check prompt, retry |
| "Job timed out" | Processing too long | Reduce frame count |
| "File size exceeds limit" | Video too large | Increase limit or reduce frames |

### Debug Logging

Enable debug logging by setting `DEBUG = true` in `main.js`:

```javascript
const DEBUG = true;
```

ExtendScript logs to the After Effects console (accessible via `$.writeln()`).

---

## Version History

### v2.5 (Current)
- Auto-select layer from timeline
- Auto-precompose with correct settings
- Duration matches shorter of comp/clip
- Resolution matches composition
- Scales footage to fit comp
- Fixes trimmed layer timing
- Sequential mask numbering (1, 2, 3)
- Elapsed time display instead of progress bar

### v2.0
- Video segmentation with object tracking
- S3 upload for large videos
- Preview mode for first frame
- Polygon quality control
- Edge snap feature

### v1.0
- Initial release
- Single frame segmentation
- Basic mask creation

---

## License

Internal use only. All rights reserved.
