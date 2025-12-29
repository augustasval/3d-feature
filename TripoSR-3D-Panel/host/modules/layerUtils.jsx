/**
 * Layer Utilities Module for TripoSR 3D Panel
 * Functions for querying composition and layer information
 */

/**
 * Get all layers from the active composition
 * @returns {string} JSON string with layers array and comp info
 */
function getCompLayers() {
    try {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return JSON.stringify({
                error: "No active composition",
                layers: []
            });
        }

        var layers = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);

            // Check if layer can be used as source
            var canHaveMask = (
                layer instanceof AVLayer &&
                !layer.nullLayer &&
                layer.source !== null &&
                !(layer instanceof CameraLayer) &&
                !(layer instanceof LightLayer)
            );

            layers.push({
                index: i,
                name: layer.name,
                enabled: layer.enabled,
                hasVideo: layer.hasVideo,
                canHaveMask: canHaveMask,
                locked: layer.locked,
                shy: layer.shy,
                solo: layer.solo
            });
        }

        return JSON.stringify({
            success: true,
            compName: comp.name,
            compWidth: comp.width,
            compHeight: comp.height,
            frameRate: comp.frameRate,
            duration: comp.duration,
            layers: layers
        });

    } catch (error) {
        return JSON.stringify({
            error: "Failed to get layers: " + error.toString(),
            layers: []
        });
    }
}

/**
 * Get active composition metadata
 * @returns {string} JSON string with composition info
 */
function getActiveComp() {
    try {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return JSON.stringify({
                error: "No active composition"
            });
        }

        return JSON.stringify({
            success: true,
            name: comp.name,
            width: comp.width,
            height: comp.height,
            pixelAspect: comp.pixelAspect,
            frameRate: comp.frameRate,
            frameDuration: comp.frameDuration,
            duration: comp.duration,
            workAreaStart: comp.workAreaStart,
            workAreaDuration: comp.workAreaDuration,
            currentTime: comp.time,
            bgColor: comp.bgColor
        });

    } catch (error) {
        return JSON.stringify({
            error: "Failed to get composition: " + error.toString()
        });
    }
}

/**
 * Get the currently selected layer in the timeline
 * Returns error if no layer selected or multiple layers selected
 * @returns {string} JSON string with selected layer info or error
 */
function getSelectedLayer() {
    try {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return JSON.stringify({ error: "No active composition" });
        }

        var selectedLayers = comp.selectedLayers;

        if (selectedLayers.length === 0) {
            return JSON.stringify({ error: "No layer selected. Please select a layer in the timeline." });
        }

        if (selectedLayers.length > 1) {
            return JSON.stringify({ error: "Multiple layers selected (" + selectedLayers.length + "). Please select only one layer." });
        }

        var layer = selectedLayers[0];

        // Validate layer can be used as source
        var isValidSource = (
            layer instanceof AVLayer &&
            !layer.nullLayer &&
            layer.source !== null &&
            !(layer instanceof CameraLayer) &&
            !(layer instanceof LightLayer)
        );

        if (!isValidSource) {
            return JSON.stringify({ error: "Selected layer cannot be used as source (null, camera, or light layer)" });
        }

        if (layer.locked) {
            return JSON.stringify({ error: "Selected layer is locked. Please unlock it first." });
        }

        return JSON.stringify({
            success: true,
            name: layer.name,
            index: layer.index,
            width: layer.width,
            height: layer.height,
            hasVideo: layer.hasVideo,
            source: layer.source ? layer.source.name : null
        });

    } catch (error) {
        return JSON.stringify({ error: "Failed to get selected layer: " + error.toString() });
    }
}

/**
 * Validate that a layer exists and can be used as source
 * @param {string} layerName - Name of the layer to validate
 * @returns {string} JSON string with validation result
 */
function validateLayer(layerName) {
    try {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return JSON.stringify({
                error: "No active composition",
                valid: false
            });
        }

        var layer = comp.layer(layerName);
        if (!layer) {
            return JSON.stringify({
                error: "Layer not found: " + layerName,
                valid: false
            });
        }

        if (layer.locked) {
            return JSON.stringify({
                error: "Layer is locked",
                valid: false
            });
        }

        // Check if layer can be used as source
        var isValidSource = (
            layer instanceof AVLayer &&
            !layer.nullLayer &&
            layer.source !== null
        );

        if (!isValidSource) {
            return JSON.stringify({
                error: "Layer cannot be used as source (must be footage or solid layer)",
                valid: false
            });
        }

        return JSON.stringify({
            success: true,
            valid: true,
            layerName: layer.name,
            layerIndex: layer.index
        });

    } catch (error) {
        return JSON.stringify({
            error: "Layer validation failed: " + error.toString(),
            valid: false
        });
    }
}

$.writeln("layerUtils.jsx loaded successfully");
