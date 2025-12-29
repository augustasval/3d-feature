/**
 * RunPod API Client for TripoSR 3D Generation
 */

class TripoSRAPIClient {
    constructor(apiKey, endpointId) {
        this.apiKey = apiKey;
        this.endpointId = endpointId;
        this.baseURL = `https://api.runpod.ai/v2/${endpointId}`;
        this.pollInterval = 2000; // 2 seconds
        this.maxPollAttempts = 120; // 4 minutes max (120 * 2s)
        this.currentJobId = null;
    }

    /**
     * Update API credentials
     * @param {string} apiKey - RunPod API key
     * @param {string} endpointId - TripoSR endpoint ID
     */
    updateCredentials(apiKey, endpointId) {
        this.apiKey = apiKey;
        this.endpointId = endpointId;
        this.baseURL = `https://api.runpod.ai/v2/${endpointId}`;
    }

    /**
     * Test connection to the RunPod endpoint
     * @returns {Promise<Object>} Connection test result
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    status: data.status || 'healthy',
                    workers: data.workers || {}
                };
            } else if (response.status === 401) {
                return {
                    success: false,
                    error: 'Invalid API key'
                };
            } else if (response.status === 404) {
                return {
                    success: false,
                    error: 'Endpoint not found. Check your endpoint ID.'
                };
            } else {
                return {
                    success: false,
                    error: `Server error: ${response.status}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `Connection failed: ${error.message}`
            };
        }
    }

    /**
     * Generate 3D model from image
     * @param {string} imageBase64 - Base64 encoded image
     * @param {Object} options - Generation options
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} Generation result
     */
    async generate3D(imageBase64, options = {}, onProgress = null) {
        const {
            foreground_ratio = 0.85,
            mc_resolution = 256,
            output_format = 'glb'
        } = options;

        // Submit job
        const submitResponse = await this.submitJob({
            image: imageBase64,
            foreground_ratio,
            mc_resolution,
            output_format
        });

        if (!submitResponse.success) {
            throw new Error(submitResponse.error || 'Failed to submit job');
        }

        this.currentJobId = submitResponse.id;

        // Poll for completion
        const result = await this.pollJobStatus(submitResponse.id, onProgress);
        this.currentJobId = null;

        return result;
    }

    /**
     * Submit a job to RunPod
     * @param {Object} input - Job input data
     * @returns {Promise<Object>} Job submission result
     */
    async submitJob(input) {
        try {
            const response = await fetch(`${this.baseURL}/run`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ input })
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${errorText}`
                };
            }

            const data = await response.json();
            return {
                success: true,
                id: data.id,
                status: data.status
            };
        } catch (error) {
            return {
                success: false,
                error: `Submit failed: ${error.message}`
            };
        }
    }

    /**
     * Poll job status until completion
     * @param {string} jobId - Job ID to poll
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} Final job result
     */
    async pollJobStatus(jobId, onProgress = null) {
        let attempts = 0;

        while (attempts < this.maxPollAttempts) {
            await this.sleep(this.pollInterval);
            attempts++;

            try {
                const response = await fetch(`${this.baseURL}/status/${jobId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                // Call progress callback
                if (onProgress) {
                    onProgress({
                        status: data.status,
                        attempts,
                        maxAttempts: this.maxPollAttempts
                    });
                }

                // Check status
                switch (data.status) {
                    case 'COMPLETED':
                        return {
                            success: true,
                            ...data.output
                        };

                    case 'FAILED':
                        return {
                            success: false,
                            error: data.error || 'Job failed'
                        };

                    case 'CANCELLED':
                        return {
                            success: false,
                            error: 'Job was cancelled'
                        };

                    case 'TIMED_OUT':
                        return {
                            success: false,
                            error: 'Job timed out on server'
                        };

                    case 'IN_QUEUE':
                    case 'IN_PROGRESS':
                        // Continue polling
                        break;

                    default:
                        console.log('Unknown status:', data.status);
                }
            } catch (error) {
                console.error('Poll error:', error);
                // Continue polling on transient errors
            }
        }

        // Max attempts reached
        return {
            success: false,
            error: 'Polling timeout - job took too long'
        };
    }

    /**
     * Cancel current job
     * @returns {Promise<boolean>} Cancellation success
     */
    async cancelCurrentJob() {
        if (!this.currentJobId) {
            return false;
        }
        return this.cancelJob(this.currentJobId);
    }

    /**
     * Cancel a specific job
     * @param {string} jobId - Job ID to cancel
     * @returns {Promise<boolean>} Cancellation success
     */
    async cancelJob(jobId) {
        try {
            const response = await fetch(`${this.baseURL}/cancel/${jobId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            return response.ok;
        } catch (error) {
            console.error('Cancel failed:', error);
            return false;
        }
    }

    /**
     * Download file from URL
     * @param {string} url - URL to download from
     * @returns {Promise<ArrayBuffer>} Downloaded data
     */
    async downloadFile(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }
        return response.arrayBuffer();
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Promise that resolves after delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

console.log('api.js loaded');
