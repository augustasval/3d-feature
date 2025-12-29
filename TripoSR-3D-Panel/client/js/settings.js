/**
 * Settings Manager for TripoSR 3D Panel
 * Handles localStorage persistence for user settings
 */

class SettingsManager {
    constructor() {
        this.storageKey = 'tripo3d-panel-settings';
        this.defaults = {
            apiKey: '',
            endpointId: '',
            defaultForegroundRatio: 0.85,
            defaultMeshResolution: 256,
            defaultOutputFormat: 'glb',
            outputFolder: ''
        };
    }

    /**
     * Load settings from localStorage
     * @returns {Object} Settings object
     */
    load() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...this.defaults, ...parsed };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
        return { ...this.defaults };
    }

    /**
     * Save settings to localStorage
     * @param {Object} settings - Settings to save
     * @returns {boolean} Success status
     */
    save(settings) {
        try {
            const toSave = { ...this.defaults, ...settings };
            localStorage.setItem(this.storageKey, JSON.stringify(toSave));
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Clear all settings
     * @returns {boolean} Success status
     */
    clear() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('Failed to clear settings:', error);
            return false;
        }
    }

    /**
     * Get a single setting value
     * @param {string} key - Setting key
     * @returns {*} Setting value
     */
    get(key) {
        const settings = this.load();
        return settings[key];
    }

    /**
     * Set a single setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     * @returns {boolean} Success status
     */
    set(key, value) {
        const settings = this.load();
        settings[key] = value;
        return this.save(settings);
    }

    /**
     * Validate settings for API usage
     * @returns {Object} Validation result with isValid and message
     */
    validate() {
        const settings = this.load();

        if (!settings.apiKey || settings.apiKey.trim() === '') {
            return {
                isValid: false,
                message: 'API key is required. Please enter your RunPod API key.'
            };
        }

        if (!settings.endpointId || settings.endpointId.trim() === '') {
            return {
                isValid: false,
                message: 'Endpoint ID is required. Please enter your TripoSR endpoint ID.'
            };
        }

        return {
            isValid: true,
            message: 'Settings are valid',
            apiKey: settings.apiKey,
            endpointId: settings.endpointId
        };
    }

    /**
     * Get default output folder path
     * @returns {string} Default output folder path
     */
    getDefaultOutputFolder() {
        // This will be set by ExtendScript on init
        const settings = this.load();
        return settings.outputFolder || '~/Desktop/TripoSR_Output';
    }
}

console.log('settings.js loaded');
