/**
 * Utility Functions for TripoSR 3D Panel
 */

/**
 * Format elapsed time as MM:SS
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted time string
 */
function formatElapsedTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format execution time with unit
 * @param {number} seconds - Execution time in seconds
 * @returns {string} Formatted time string
 */
function formatExecutionTime(seconds) {
    if (seconds < 1) {
        return `${Math.round(seconds * 1000)}ms`;
    }
    return `${seconds.toFixed(2)}s`;
}

/**
 * Format file size to human readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get filename from path
 * @param {string} path - Full file path
 * @returns {string} Filename
 */
function getFilename(path) {
    return path.split('/').pop().split('\\').pop();
}

/**
 * Get directory from path
 * @param {string} path - Full file path
 * @returns {string} Directory path
 */
function getDirectory(path) {
    const parts = path.replace(/\\/g, '/').split('/');
    parts.pop();
    return parts.join('/');
}

/**
 * Join path segments
 * @param {...string} parts - Path segments
 * @returns {string} Joined path
 */
function joinPath(...parts) {
    return parts
        .map(part => part.replace(/^\/+|\/+$/g, ''))
        .filter(part => part.length > 0)
        .join('/');
}

/**
 * Check if string is valid base64
 * @param {string} str - String to check
 * @returns {boolean} True if valid base64
 */
function isValidBase64(str) {
    if (!str || typeof str !== 'string') return false;
    try {
        return btoa(atob(str)) === str;
    } catch (e) {
        return false;
    }
}

/**
 * Sanitize filename for file system
 * @param {string} name - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

/**
 * Generate timestamp string for unique filenames
 * @returns {string} Timestamp string
 */
function generateTimestamp() {
    const now = new Date();
    return now.getFullYear().toString() +
           (now.getMonth() + 1).toString().padStart(2, '0') +
           now.getDate().toString().padStart(2, '0') +
           '_' +
           now.getHours().toString().padStart(2, '0') +
           now.getMinutes().toString().padStart(2, '0') +
           now.getSeconds().toString().padStart(2, '0');
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

console.log('utils.js loaded');
