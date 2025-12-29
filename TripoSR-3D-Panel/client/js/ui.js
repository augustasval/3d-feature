/**
 * UI Helper Functions for TripoSR 3D Panel
 */

/**
 * Toggle section collapse state
 * @param {string} sectionId - Section element ID
 */
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.toggle('collapsed');
    }
}

/**
 * Show status message
 * @param {string} message - Message to display
 * @param {string} type - Message type: 'info', 'success', 'error', 'progress'
 * @param {number} duration - Auto-clear duration in ms (0 for persistent)
 */
function showStatus(message, type = 'info', duration = 0) {
    const statusBar = document.getElementById('status-bar');
    const statusMessage = document.getElementById('status-message');

    if (!statusBar || !statusMessage) return;

    // Clear existing classes
    statusBar.classList.remove('success', 'error', 'progress');

    // Set message
    statusMessage.textContent = message;

    // Add type class
    if (type === 'success' || type === 'error' || type === 'progress') {
        statusBar.classList.add(type);
    }

    // Auto-clear if duration specified
    if (duration > 0) {
        setTimeout(() => {
            clearStatus();
        }, duration);
    }
}

/**
 * Show success status
 * @param {string} message - Success message
 * @param {number} duration - Auto-clear duration in ms
 */
function showSuccess(message, duration = 3000) {
    showStatus(message, 'success', duration);
}

/**
 * Show error status
 * @param {string} message - Error message
 * @param {number} duration - Auto-clear duration in ms
 */
function showError(message, duration = 5000) {
    showStatus(message, 'error', duration);
}

/**
 * Show progress status
 * @param {string} message - Progress message
 */
function showProgress(message) {
    showStatus(message, 'progress', 0);
}

/**
 * Clear status message
 */
function clearStatus() {
    const statusBar = document.getElementById('status-bar');
    const statusMessage = document.getElementById('status-message');

    if (!statusBar || !statusMessage) return;

    statusBar.classList.remove('success', 'error', 'progress');
    statusMessage.textContent = 'Ready';
}

/**
 * Set generate button state
 * @param {boolean} enabled - Enable/disable button
 * @param {boolean} loading - Show loading state
 */
function setGenerateButtonState(enabled, loading = false) {
    const btn = document.getElementById('generate-btn');
    const btnText = btn?.querySelector('.btn-text');
    const btnLoader = btn?.querySelector('.btn-loader');

    if (!btn) return;

    btn.disabled = !enabled;

    if (btnText) {
        btnText.style.display = loading ? 'none' : 'inline';
    }
    if (btnLoader) {
        btnLoader.style.display = loading ? 'inline-block' : 'none';
    }
}

/**
 * Populate layer dropdown
 * @param {Array} layers - Array of layer objects
 * @param {string} selectedName - Name of layer to select
 */
function populateLayerDropdown(layers, selectedName = null) {
    const select = document.getElementById('layer-select');
    if (!select) return;

    // Clear existing options (except first)
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Add layer options
    layers.forEach(layer => {
        if (layer.canHaveMask && !layer.locked) {
            const option = document.createElement('option');
            option.value = layer.name;
            option.textContent = `${layer.index}. ${layer.name}`;
            if (layer.name === selectedName) {
                option.selected = true;
            }
            select.appendChild(option);
        }
    });
}

/**
 * Update connection status indicator
 * @param {boolean} connected - Connection status
 * @param {string} message - Status message
 */
function updateConnectionStatus(connected, message = null) {
    const indicator = document.getElementById('connection-status');
    const statusText = indicator?.querySelector('.status-text');

    if (!indicator) return;

    indicator.classList.remove('connected', 'error');

    if (connected) {
        indicator.classList.add('connected');
        if (statusText) statusText.textContent = message || 'Connected';
    } else if (connected === false) {
        indicator.classList.add('error');
        if (statusText) statusText.textContent = message || 'Not connected';
    } else {
        if (statusText) statusText.textContent = message || 'Not connected';
    }
}

/**
 * Show/hide panels
 * @param {Object} visibility - Panel visibility settings
 */
function setPanelVisibility(visibility) {
    const panels = {
        'generation-panel': visibility.generation !== false,
        'progress-panel': visibility.progress === true,
        'results-panel': visibility.results === true
    };

    Object.entries(panels).forEach(([id, visible]) => {
        const panel = document.getElementById(id);
        if (panel) {
            panel.style.display = visible ? 'block' : 'none';
        }
    });
}

/**
 * Update slider display value
 * @param {string} sliderId - Slider element ID
 * @param {string} displayId - Display element ID
 */
function updateSliderDisplay(sliderId, displayId) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);

    if (slider && display) {
        display.textContent = slider.value;
    }
}

/**
 * Display generation result
 * @param {Object} result - Generation result object
 */
function displayResult(result) {
    const filename = document.getElementById('result-filename');
    const filesize = document.getElementById('result-filesize');
    const vertices = document.getElementById('result-vertices');
    const faces = document.getElementById('result-faces');
    const path = document.getElementById('result-path');

    if (filename) filename.textContent = result.filename || 'model.glb';
    if (filesize) filesize.textContent = formatFileSize(result.file_size || 0);
    if (vertices) vertices.textContent = result.vertices?.toLocaleString() || '-';
    if (faces) faces.textContent = result.faces?.toLocaleString() || '-';
    if (path) path.textContent = result.path || '-';
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            return true;
        } catch (e) {
            return false;
        } finally {
            document.body.removeChild(textarea);
        }
    }
}

console.log('ui.js loaded');
