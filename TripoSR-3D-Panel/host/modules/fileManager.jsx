/**
 * File Manager Module for TripoSR 3D Panel
 * Handles GLB file saving and folder operations
 */

/**
 * Get default output folder for 3D models
 * Creates folder if it doesn't exist
 * @returns {string} JSON with folder path
 */
function getDefaultOutputFolder() {
    try {
        var outputFolder = Folder.desktop.fullName + "/TripoSR_Output";
        var folder = new Folder(outputFolder);
        if (!folder.exists) {
            folder.create();
        }
        return JSON.stringify({
            success: true,
            path: folder.fsName
        });
    } catch (error) {
        return JSON.stringify({ error: error.toString() });
    }
}

/**
 * Browse for folder using system dialog
 * @returns {string} JSON with selected folder path
 */
function browseForFolder() {
    try {
        var folder = Folder.selectDialog("Select Output Folder");
        if (folder) {
            return JSON.stringify({
                success: true,
                path: folder.fsName
            });
        }
        return JSON.stringify({
            success: false,
            message: "No folder selected"
        });
    } catch (error) {
        return JSON.stringify({ error: error.toString() });
    }
}

/**
 * Save base64 data to file
 * @param {string} filePath - Destination path
 * @param {string} base64Data - Base64 encoded file data
 * @returns {string} JSON with result
 */
function saveBase64ToFile(filePath, base64Data) {
    try {
        $.writeln("[FileManager] Saving to: " + filePath);
        $.writeln("[FileManager] Base64 length: " + base64Data.length);

        // Ensure parent folder exists
        var file = new File(filePath);
        var parentFolder = file.parent;
        if (!parentFolder.exists) {
            parentFolder.create();
        }

        // Decode base64 to binary
        var binary = base64ToBinary(base64Data);
        $.writeln("[FileManager] Binary length: " + binary.length);

        // Write binary data
        file.encoding = "BINARY";
        file.open("w");
        file.write(binary);
        file.close();

        // Verify file was created
        if (!file.exists) {
            return JSON.stringify({ error: "File was not created" });
        }

        // Get actual file size
        file.open("r");
        file.encoding = "BINARY";
        var verifyData = file.read();
        file.close();

        $.writeln("[FileManager] File saved successfully: " + verifyData.length + " bytes");

        return JSON.stringify({
            success: true,
            path: file.fsName,
            fileSize: verifyData.length
        });
    } catch (error) {
        $.writeln("[FileManager] Error: " + error.toString());
        return JSON.stringify({ error: error.toString() });
    }
}

/**
 * Convert base64 string to binary data
 * @param {string} base64 - Base64 encoded string
 * @returns {string} Binary data string
 */
function base64ToBinary(base64) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var result = [];

    // Remove padding (use RegExp constructor to avoid ExtendScript parsing issues)
    base64 = base64.replace(new RegExp("=", "g"), '');

    var buffer = 0;
    var bits = 0;

    for (var i = 0; i < base64.length; i++) {
        var charIndex = chars.indexOf(base64[i]);
        if (charIndex === -1) continue; // Skip invalid characters

        buffer = (buffer << 6) | charIndex;
        bits += 6;

        while (bits >= 8) {
            bits -= 8;
            result.push(String.fromCharCode((buffer >> bits) & 0xFF));
        }
    }

    return result.join('');
}

/**
 * Open folder in system file browser
 * @param {string} folderPath - Path to folder
 * @returns {string} JSON with result
 */
function openFolderInExplorer(folderPath) {
    try {
        var folder = new Folder(folderPath);
        if (folder.exists) {
            folder.execute();
            return JSON.stringify({ success: true });
        }
        return JSON.stringify({ error: "Folder not found: " + folderPath });
    } catch (error) {
        return JSON.stringify({ error: error.toString() });
    }
}

/**
 * Open file in default application
 * @param {string} filePath - Path to file
 * @returns {string} JSON with result
 */
function openFile(filePath) {
    try {
        var file = new File(filePath);
        if (file.exists) {
            file.execute();
            return JSON.stringify({ success: true });
        }
        return JSON.stringify({ error: "File not found: " + filePath });
    } catch (error) {
        return JSON.stringify({ error: error.toString() });
    }
}

/**
 * Check if file exists
 * @param {string} filePath - Path to check
 * @returns {string} JSON with exists status
 */
function fileExists(filePath) {
    try {
        var file = new File(filePath);
        return JSON.stringify({
            exists: file.exists,
            path: filePath
        });
    } catch (error) {
        return JSON.stringify({ error: error.toString() });
    }
}

/**
 * Delete file
 * @param {string} filePath - Path to file to delete
 * @returns {string} JSON with result
 */
function deleteFile(filePath) {
    try {
        var file = new File(filePath);
        if (file.exists) {
            var removed = file.remove();
            return JSON.stringify({
                success: removed,
                path: filePath
            });
        }
        return JSON.stringify({
            success: true,
            message: "File did not exist"
        });
    } catch (error) {
        return JSON.stringify({ error: error.toString() });
    }
}

/**
 * Generate unique filename for output
 * @param {string} folderPath - Output folder
 * @param {string} baseName - Base name (e.g., layer name)
 * @param {string} extension - File extension (glb, obj)
 * @returns {string} JSON with unique file path
 */
function generateUniqueFilename(folderPath, baseName, extension) {
    try {
        // Sanitize base name
        baseName = baseName.replace(new RegExp("[^a-zA-Z0-9_\\-]", "g"), '_');

        var timestamp = Date.now();
        var fileName = baseName + "_" + timestamp + "." + extension;
        var filePath = folderPath + "/" + fileName;

        return JSON.stringify({
            success: true,
            path: filePath,
            fileName: fileName
        });
    } catch (error) {
        return JSON.stringify({ error: error.toString() });
    }
}

$.writeln("fileManager.jsx loaded successfully");
