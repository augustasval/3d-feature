/**
 * TripoSR 3D Panel - Main Controller
 * Orchestrates the 2D to 3D generation workflow
 */

class TripoPanel {
    constructor() {
        this.csInterface = new CSInterface();
        this.settings = new SettingsManager();
        this.apiClient = null;
        this.isProcessing = false;
        this.progressTimer = null;
        this.progressStartTime = null;
        this.outputFolder = null;
        this.lastResult = null;
    }

    /**
     * Initialize the panel
     */
    async init() {
        console.log('TripoPanel initializing...');

        // Restore settings
        const settings = this.settings.load();
        this.restoreSettings(settings);

        // Initialize API client if credentials available
        if (settings.apiKey && settings.endpointId) {
            this.apiClient = new RunPodAPIClient(settings.apiKey, settings.endpointId);
        }

        // Get default output folder
        await this.initOutputFolder();

        // Setup event listeners
        this.setupEventListeners();

        // Update layer list
        await this.updateLayerList();

        console.log('TripoPanel initialized');
        showStatus('Ready', 'info');
    }

    /**
     * Restore settings to UI
     * @param {Object} settings - Settings object
     */
    restoreSettings(settings) {
        const apiKeyInput = document.getElementById('api-key');
        const endpointIdInput = document.getElementById('endpoint-id');
        const foregroundSlider = document.getElementById('foreground-ratio');
        const foregroundValue = document.getElementById('foreground-value');
        const memoryProfileSelect = document.getElementById('memory-profile');
        const generateTextureCheckbox = document.getElementById('generate-texture');
        const removeBackgroundCheckbox = document.getElementById('remove-background');

        if (apiKeyInput) apiKeyInput.value = settings.apiKey || '';
        if (endpointIdInput) endpointIdInput.value = settings.endpointId || '';
        if (foregroundSlider) {
            foregroundSlider.value = settings.defaultForegroundRatio || 0.85;
            if (foregroundValue) foregroundValue.textContent = foregroundSlider.value;
        }
        if (memoryProfileSelect) {
            memoryProfileSelect.value = settings.defaultMemoryProfile || 3;
        }
        if (generateTextureCheckbox) {
            generateTextureCheckbox.checked = settings.generateTexture !== false;
        }
        if (removeBackgroundCheckbox) {
            removeBackgroundCheckbox.checked = settings.removeBackground !== false;
        }
    }

    /**
     * Save current settings
     */
    saveSettings() {
        const apiKey = document.getElementById('api-key')?.value || '';
        const endpointId = document.getElementById('endpoint-id')?.value || '';
        const foregroundRatio = parseFloat(document.getElementById('foreground-ratio')?.value) || 0.85;
        const memoryProfile = parseInt(document.getElementById('memory-profile')?.value) || 3;
        const generateTexture = document.getElementById('generate-texture')?.checked !== false;
        const removeBackground = document.getElementById('remove-background')?.checked !== false;

        const saved = this.settings.save({
            apiKey,
            endpointId,
            defaultForegroundRatio: foregroundRatio,
            defaultMemoryProfile: memoryProfile,
            generateTexture,
            removeBackground,
            outputFolder: this.outputFolder
        });

        // Update API client
        if (apiKey && endpointId) {
            if (this.apiClient) {
                this.apiClient.updateCredentials(apiKey, endpointId);
            } else {
                this.apiClient = new RunPodAPIClient(apiKey, endpointId);
            }
        }

        if (saved) {
            showSuccess('Settings saved', 2000);
        } else {
            showError('Failed to save settings');
        }
    }

    /**
     * Initialize output folder via ExtendScript
     */
    async initOutputFolder() {
        try {
            const result = await this.evalScript('getDefaultOutputFolder()');
            const data = JSON.parse(result);
            if (data.success) {
                this.outputFolder = data.path;
                const folderInput = document.getElementById('output-folder');
                if (folderInput) folderInput.value = data.path;
            }
        } catch (error) {
            console.error('Failed to init output folder:', error);
            this.outputFolder = '~/Desktop/TripoSR_Output';
        }
    }

    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        // API Key visibility toggle
        document.getElementById('toggle-key-visibility')?.addEventListener('click', () => {
            const input = document.getElementById('api-key');
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
            }
        });

        // Test connection button
        document.getElementById('test-connection-btn')?.addEventListener('click', () => {
            this.testConnection();
        });

        // Save settings button
        document.getElementById('save-settings-btn')?.addEventListener('click', () => {
            this.saveSettings();
        });

        // Refresh layers button
        document.getElementById('refresh-layers')?.addEventListener('click', () => {
            this.updateLayerList();
        });

        // Foreground ratio slider
        document.getElementById('foreground-ratio')?.addEventListener('input', (e) => {
            const display = document.getElementById('foreground-value');
            if (display) display.textContent = e.target.value;
        });

        // Browse folder button
        document.getElementById('browse-folder')?.addEventListener('click', () => {
            this.browseOutputFolder();
        });

        // Generate button
        document.getElementById('generate-btn')?.addEventListener('click', () => {
            this.generate3DModel();
        });

        // Cancel button
        document.getElementById('cancel-btn')?.addEventListener('click', () => {
            this.cancelGeneration();
        });

        // Open folder button
        document.getElementById('open-folder-btn')?.addEventListener('click', () => {
            this.openOutputFolder();
        });

        // Copy path button
        document.getElementById('copy-path-btn')?.addEventListener('click', () => {
            this.copyPathToClipboard();
        });

        // Generate another button
        document.getElementById('generate-another-btn')?.addEventListener('click', () => {
            this.resetForNewGeneration();
        });
    }

    /**
     * Test API connection
     */
    async testConnection() {
        const apiKey = document.getElementById('api-key')?.value;
        const endpointId = document.getElementById('endpoint-id')?.value;

        if (!apiKey || !endpointId) {
            showError('Please enter API key and endpoint ID');
            updateConnectionStatus(false, 'Missing credentials');
            return;
        }

        showProgress('Testing connection...');
        updateConnectionStatus(null, 'Testing...');

        const client = new RunPodAPIClient(apiKey, endpointId);
        const result = await client.testConnection();

        if (result.success) {
            updateConnectionStatus(true, 'Connected');
            showSuccess('Connection successful', 2000);
        } else {
            updateConnectionStatus(false, result.error);
            showError(result.error);
        }
    }

    /**
     * Update layer list from After Effects
     */
    async updateLayerList() {
        try {
            console.log('[TripoPanel] Calling getCompLayers...');
            const result = await this.evalScript('getCompLayers()');
            console.log('[TripoPanel] getCompLayers result:', result);

            if (!result || result === 'undefined') {
                console.error('[TripoPanel] ExtendScript returned undefined - host scripts may not be loaded');
                showError('ExtendScript not loaded. Please restart After Effects.');
                populateLayerDropdown([]);
                return;
            }

            const data = JSON.parse(result);
            console.log('[TripoPanel] Parsed data:', data);

            if (data.error) {
                console.log('[TripoPanel] Error from ExtendScript:', data.error);
                showStatus(data.error, 'info');
                populateLayerDropdown([]);
                return;
            }

            console.log('[TripoPanel] Found layers:', data.layers?.length || 0);

            if (!data.layers || data.layers.length === 0) {
                showStatus('No layers in composition', 'info');
            } else {
                // Count eligible layers
                const eligibleLayers = data.layers.filter(l => l.canHaveMask && !l.locked);
                console.log('[TripoPanel] Eligible layers:', eligibleLayers.length);
                if (eligibleLayers.length === 0 && data.layers.length > 0) {
                    showStatus('No eligible layers (only footage/solid layers)', 'info');
                }
            }

            populateLayerDropdown(data.layers || []);
        } catch (error) {
            console.error('[TripoPanel] Failed to update layer list:', error);
            showError('Failed to get layers: ' + error.message);
            populateLayerDropdown([]);
        }
    }

    /**
     * Browse for output folder
     */
    async browseOutputFolder() {
        try {
            const result = await this.evalScript('browseForFolder()');
            const data = JSON.parse(result);
            if (data.success && data.path) {
                this.outputFolder = data.path;
                const folderInput = document.getElementById('output-folder');
                if (folderInput) folderInput.value = data.path;
            }
        } catch (error) {
            console.error('Browse folder failed:', error);
        }
    }

    /**
     * Main workflow: Generate 3D model from selected layer
     */
    async generate3DModel() {
        if (this.isProcessing) return;

        // Validate settings
        const validation = this.settings.validate();
        if (!validation.isValid) {
            showError(validation.message);
            // Expand settings panel
            const settingsPanel = document.getElementById('settings-panel');
            if (settingsPanel?.classList.contains('collapsed')) {
                toggleSection('settings-panel');
            }
            return;
        }

        // Get selected layer
        const layerSelect = document.getElementById('layer-select');
        const layerName = layerSelect?.value;

        if (!layerName) {
            showError('Please select a layer');
            return;
        }

        // Get generation options for Hunyuan3D
        const options = {
            removeBackground: document.getElementById('remove-background')?.checked !== false,
            generateTexture: document.getElementById('generate-texture')?.checked !== false,
            profile: parseInt(document.getElementById('memory-profile')?.value) || 3
        };

        // Start processing
        this.isProcessing = true;
        setGenerateButtonState(false, true);
        setPanelVisibility({ generation: false, progress: true, results: false });
        this.startProgressTimer();

        try {
            // Step 1: Export current frame
            this.updateProgressStatus('Exporting frame...');
            const exportResult = await this.evalScript('exportCurrentFrame()');
            const exportData = JSON.parse(exportResult);

            if (exportData.error) {
                throw new Error(exportData.error);
            }

            // Step 2: Read frame as base64
            this.updateProgressStatus('Reading image...');
            const imageBase64 = await this.readFileAsBase64(exportData.pngFilePath);

            // Step 3: Send to API
            this.updateProgressStatus('Generating 3D model...');
            const result = await this.apiClient.generate3D(imageBase64, options, (progress) => {
                this.updateProgressStatus(`Processing (${progress.status})...`);
            });

            if (!result.success) {
                throw new Error(result.error || 'Generation failed');
            }

            // Step 4: Save result (Hunyuan3D outputs GLB format)
            this.updateProgressStatus('Saving model...');
            const savedPath = await this.saveGeneratedModel(result, layerName, 'glb');

            // Step 5: Cleanup temp file
            this.cleanupTempFile(exportData.pngFilePath);

            // Show result
            this.lastResult = {
                ...result,
                path: savedPath,
                filename: getFilename(savedPath)
            };

            displayResult(this.lastResult);
            setPanelVisibility({ generation: false, progress: false, results: true });
            showSuccess('3D model generated successfully!', 3000);

        } catch (error) {
            console.error('Generation failed:', error);
            showError(error.message || 'Generation failed');
            setPanelVisibility({ generation: true, progress: false, results: false });
        } finally {
            this.isProcessing = false;
            this.stopProgressTimer();
            setGenerateButtonState(true, false);
        }
    }

    /**
     * Save generated model to output folder
     * Uses Node.js fs module directly to avoid evalScript size limits
     * @param {Object} result - API result
     * @param {string} layerName - Source layer name
     * @param {string} format - Output format
     * @returns {Promise<string>} Saved file path
     */
    async saveGeneratedModel(result, layerName, format) {
        // Generate unique filename
        const timestamp = generateTimestamp();
        const sanitizedName = sanitizeFilename(layerName);
        const filename = `${sanitizedName}_${timestamp}.${format}`;
        const outputPath = `${this.outputFolder}/${filename}`;

        // Use Node.js fs module directly (evalScript can't handle large base64 strings)
        const fs = require('fs');
        const path = require('path');

        // Ensure output folder exists
        if (!fs.existsSync(this.outputFolder)) {
            fs.mkdirSync(this.outputFolder, { recursive: true });
        }

        if (result.model_base64) {
            // Decode base64 and save directly using Node.js
            const buffer = Buffer.from(result.model_base64, 'base64');
            fs.writeFileSync(outputPath, buffer);
            console.log(`[TripoPanel] Saved ${buffer.length} bytes to ${outputPath}`);
            return outputPath;
        } else if (result.model_url) {
            // Download from URL and save
            const arrayBuffer = await this.apiClient.downloadFile(result.model_url);
            const buffer = Buffer.from(arrayBuffer);
            fs.writeFileSync(outputPath, buffer);
            console.log(`[TripoPanel] Downloaded and saved ${buffer.length} bytes to ${outputPath}`);
            return outputPath;
        } else {
            throw new Error('No model data in response');
        }
    }

    /**
     * Cancel ongoing generation
     */
    async cancelGeneration() {
        if (!this.isProcessing) return;

        showProgress('Cancelling...');

        if (this.apiClient) {
            await this.apiClient.cancelCurrentJob();
        }

        this.isProcessing = false;
        this.stopProgressTimer();
        setGenerateButtonState(true, false);
        setPanelVisibility({ generation: true, progress: false, results: false });
        showStatus('Cancelled', 'info', 2000);
    }

    /**
     * Open output folder in system file browser
     */
    async openOutputFolder() {
        if (!this.lastResult?.path) return;

        const folderPath = getDirectory(this.lastResult.path);
        await this.evalScript(`openFolderInExplorer('${folderPath.replace(/'/g, "\\'")}')`);
    }

    /**
     * Copy output path to clipboard
     */
    async copyPathToClipboard() {
        if (!this.lastResult?.path) return;

        const success = await copyToClipboard(this.lastResult.path);
        if (success) {
            showSuccess('Path copied to clipboard', 2000);
        } else {
            showError('Failed to copy path');
        }
    }

    /**
     * Reset UI for new generation
     */
    resetForNewGeneration() {
        this.lastResult = null;
        setPanelVisibility({ generation: true, progress: false, results: false });
        clearStatus();
    }

    /**
     * Read file as base64 using Node.js fs module
     * @param {string} filePath - File path
     * @returns {Promise<string>} Base64 encoded content
     */
    async readFileAsBase64(filePath) {
        return new Promise((resolve, reject) => {
            try {
                // Use Node.js fs module (available in CEP with --enable-nodejs)
                const fs = require('fs');
                const data = fs.readFileSync(filePath);
                const base64 = data.toString('base64');
                resolve(base64);
            } catch (error) {
                // Fallback to ExtendScript
                this.evalScript(`convertFileToBase64('${filePath.replace(/'/g, "\\'")}')`)
                    .then(result => {
                        const data = JSON.parse(result);
                        if (data.error) {
                            reject(new Error(data.error));
                        } else {
                            resolve(data.imageBase64);
                        }
                    })
                    .catch(reject);
            }
        });
    }

    /**
     * Convert ArrayBuffer to base64
     * @param {ArrayBuffer} buffer - Array buffer
     * @returns {string} Base64 string
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Cleanup temporary file
     * @param {string} filePath - File path to delete
     */
    cleanupTempFile(filePath) {
        try {
            const fs = require('fs');
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.warn('Cleanup failed:', error);
        }
    }

    /**
     * Start progress timer
     */
    startProgressTimer() {
        this.progressStartTime = Date.now();
        this.progressTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.progressStartTime) / 1000);
            const timeDisplay = document.getElementById('progress-time');
            if (timeDisplay) {
                timeDisplay.textContent = formatElapsedTime(elapsed);
            }
        }, 1000);
    }

    /**
     * Stop progress timer
     */
    stopProgressTimer() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    }

    /**
     * Update progress status text
     * @param {string} status - Status message
     */
    updateProgressStatus(status) {
        const statusEl = document.getElementById('progress-status');
        if (statusEl) {
            statusEl.textContent = status;
        }
    }

    /**
     * Execute ExtendScript and return promise
     * @param {string} script - ExtendScript to execute
     * @returns {Promise<string>} Script result
     */
    evalScript(script) {
        return new Promise((resolve, reject) => {
            this.csInterface.evalScript(script, (result) => {
                if (result === 'EvalScript error.') {
                    reject(new Error('ExtendScript evaluation error'));
                } else {
                    resolve(result);
                }
            });
        });
    }
}

// Initialize panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.tripoPanel = new TripoPanel();
    window.tripoPanel.init();
});

console.log('main.js loaded');
