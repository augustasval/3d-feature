/**
 * Frame Exporter Module for TripoSR 3D Panel
 * Uses RenderQueue for reliable PNG export
 */

/**
 * Export current frame from active composition to PNG file
 * Uses RenderQueue for reliable PNG output
 * @returns {string} JSON string with PNG file path
 */
function exportCurrentFrame() {
    try {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return JSON.stringify({
                error: "No active composition"
            });
        }

        $.writeln("[FrameExport] Starting export...");
        $.writeln("[FrameExport] Composition: " + comp.name + " (" + comp.width + "x" + comp.height + ")");
        $.writeln("[FrameExport] Current time: " + comp.time + "s");

        // Use Desktop subfolder
        var outputFolder = Folder.desktop.fullName + "/TripoSR_temp";
        var folder = new Folder(outputFolder);
        if (!folder.exists) {
            folder.create();
        }

        var timestamp = Date.now();
        var baseName = "tripo_render_" + timestamp;
        var outputPath = outputFolder + "/" + baseName + ".png";
        var tempFile = new File(outputPath);

        $.writeln("[FrameExport] Output folder: " + outputFolder);
        $.writeln("[FrameExport] Base name: " + baseName);

        // Create render queue item
        var rqItem = app.project.renderQueue.items.add(comp);
        rqItem.timeSpanStart = comp.time;
        rqItem.timeSpanDuration = comp.frameDuration;

        // Configure output module for PNG
        var outputModule = rqItem.outputModule(1);

        // Try PNG templates
        var templateApplied = false;
        var pngTemplates = ["PNG Sequence", "PNG sequence", "PNG", "Photoshop"];

        for (var t = 0; t < pngTemplates.length && !templateApplied; t++) {
            try {
                outputModule.applyTemplate(pngTemplates[t]);
                $.writeln("[FrameExport] Applied template: " + pngTemplates[t]);
                templateApplied = true;
            } catch (e) {
                $.writeln("[FrameExport] Template '" + pngTemplates[t] + "' not available");
            }
        }

        // Fallback to JPEG/TIFF if no PNG template found
        if (!templateApplied) {
            var fallbackTemplates = ["JPEG Sequence", "JPEG", "TIFF Sequence", "TIFF"];
            for (var j = 0; j < fallbackTemplates.length && !templateApplied; j++) {
                try {
                    outputModule.applyTemplate(fallbackTemplates[j]);
                    $.writeln("[FrameExport] Applied fallback template: " + fallbackTemplates[j]);
                    templateApplied = true;

                    // Update extension
                    if (fallbackTemplates[j].toLowerCase().indexOf("jpeg") !== -1) {
                        outputPath = outputFolder + "/" + baseName + ".jpg";
                        tempFile = new File(outputPath);
                    } else if (fallbackTemplates[j].toLowerCase().indexOf("tiff") !== -1) {
                        outputPath = outputFolder + "/" + baseName + ".tif";
                        tempFile = new File(outputPath);
                    }
                } catch (e) {
                    $.writeln("[FrameExport] Template '" + fallbackTemplates[j] + "' not available");
                }
            }
        }

        outputModule.file = tempFile;

        // Render
        $.writeln("[FrameExport] Rendering...");
        app.project.renderQueue.render();
        $.writeln("[FrameExport] Render complete");

        // Find the actual output file
        var imageExtensions = ["png", "jpg", "jpeg", "tif", "tiff"];
        var searchPatterns = [];

        for (var e = 0; e < imageExtensions.length; e++) {
            var ext = imageExtensions[e];
            searchPatterns.push(baseName + "." + ext + "*");
            searchPatterns.push(baseName + "_*." + ext);
            searchPatterns.push(baseName + "[*]." + ext);
        }
        searchPatterns.push(baseName + "*");

        var actualFile = null;
        for (var p = 0; p < searchPatterns.length && !actualFile; p++) {
            var files = folder.getFiles(searchPatterns[p]);

            for (var i = 0; i < files.length; i++) {
                if (files[i] instanceof File && files[i].length > 0) {
                    var fileName = files[i].name.toLowerCase();
                    var isVideo = (fileName.indexOf(".mov") !== -1) || (fileName.indexOf(".avi") !== -1) || (fileName.indexOf(".mp4") !== -1);
                    if (!isVideo) {
                        actualFile = files[i];
                        $.writeln("[FrameExport] Found image: " + actualFile.name + " (" + actualFile.length + " bytes)");
                        break;
                    }
                }
            }
        }

        // Clean up render queue item
        rqItem.remove();

        if (!actualFile) {
            $.writeln("[FrameExport] ERROR: No output file found");
            return JSON.stringify({ error: "Render completed but no output file found" });
        }

        // Get file size
        actualFile.open("r");
        actualFile.encoding = "BINARY";
        var data = actualFile.read();
        actualFile.close();

        var fileSize = data.length;
        $.writeln("[FrameExport] File size: " + fileSize + " bytes");

        if (fileSize === 0) {
            actualFile.remove();
            return JSON.stringify({ error: "Render produced empty file" });
        }

        return JSON.stringify({
            success: true,
            pngFilePath: actualFile.fsName,
            width: comp.width,
            height: comp.height,
            fileSize: fileSize,
            exportMethod: "RenderQueue"
        });

    } catch (error) {
        $.writeln("[FrameExport] Error: " + error.toString());
        return JSON.stringify({ error: "Export failed: " + error.toString() });
    }
}

/**
 * Convert a file to base64 string using ExtendScript
 * Fallback method when JavaScript methods fail
 * @param {string} filePath - Path to file
 * @returns {string} JSON string with base64 data
 */
function convertFileToBase64(filePath) {
    try {
        var file = new File(filePath);

        if (!file.exists) {
            return JSON.stringify({
                error: "File not found: " + filePath
            });
        }

        $.writeln("[Base64] Reading file: " + filePath);

        // Read file as binary
        file.open("r");
        file.encoding = "BINARY";
        var binaryData = file.read();
        file.close();

        var fileSize = binaryData.length;
        $.writeln("[Base64] File size: " + fileSize + " bytes");

        if (fileSize === 0) {
            return JSON.stringify({
                error: "File is empty"
            });
        }

        // Convert to base64
        $.writeln("[Base64] Converting to base64...");
        var base64 = binaryToBase64(binaryData);
        $.writeln("[Base64] Base64 length: " + base64.length + " chars");

        return JSON.stringify({
            success: true,
            imageBase64: base64,
            fileSize: fileSize,
            base64Length: base64.length
        });

    } catch (error) {
        $.writeln("[Base64] Error: " + error.toString());
        return JSON.stringify({
            error: "Base64 conversion failed: " + error.toString()
        });
    }
}

/**
 * Convert binary data to base64 string
 * Optimized using array.join() for performance
 * @param {string} binary - Binary data string
 * @returns {string} Base64 encoded string
 */
function binaryToBase64(binary) {
    var base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var result = [];
    var padding = "";

    var length = binary.length;
    var remainder = length % 3;
    var mainLength = length - remainder;

    // Process 3 bytes at a time
    for (var i = 0; i < mainLength; i += 3) {
        var chunk = (binary.charCodeAt(i) << 16) |
                    (binary.charCodeAt(i + 1) << 8) |
                    binary.charCodeAt(i + 2);

        result.push(base64Chars[(chunk >> 18) & 63]);
        result.push(base64Chars[(chunk >> 12) & 63]);
        result.push(base64Chars[(chunk >> 6) & 63]);
        result.push(base64Chars[chunk & 63]);
    }

    // Handle remaining bytes
    if (remainder === 1) {
        var chunk = binary.charCodeAt(mainLength);
        result.push(base64Chars[(chunk >> 2) & 63]);
        result.push(base64Chars[(chunk << 4) & 63]);
        padding = "==";
    } else if (remainder === 2) {
        var chunk = (binary.charCodeAt(mainLength) << 8) |
                    binary.charCodeAt(mainLength + 1);
        result.push(base64Chars[(chunk >> 10) & 63]);
        result.push(base64Chars[(chunk >> 4) & 63]);
        result.push(base64Chars[(chunk << 2) & 63]);
        padding = "=";
    }

    return result.join('') + padding;
}

$.writeln("frameExporter.jsx loaded successfully");
