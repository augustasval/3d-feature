/**
 * Error Handler Module
 * Centralized error handling for ExtendScript operations
 */

/**
 * Handle and format errors
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @returns {string} JSON string with error info
 */
function handleError(error, context) {
    var message = context + ": " + error.toString();
    $.writeln("[Error] " + message);
    return JSON.stringify({
        error: message
    });
}

/**
 * Log debug message
 * @param {string} module - Module name
 * @param {string} message - Message to log
 */
function debugLog(module, message) {
    $.writeln("[" + module + "] " + message);
}

$.writeln("errorHandler.jsx loaded successfully");
