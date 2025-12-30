/**
 * RunPod API Client for Hunyuan3D-2 3D Generation
 * Self-hosted on RunPod Serverless for 10x cost savings
 */

class RunPodAPIClient {
    constructor(apiKey, endpointId) {
        this.apiKey = apiKey;
        this.endpointId = endpointId;
        this.baseURL = 'https://api.runpod.ai/v2';
        this.pollInterval = 2000; // 2 seconds
        this.maxPollAttempts = 90; // 3 minutes max (90 * 2s)
        this.currentJobId = null;
    }

    /**
     * Update API credentials
     * @param {string} apiKey - RunPod API key
     * @param {string} endpointId - RunPod endpoint ID
     */
    updateCredentials(apiKey, endpointId) {
        this.apiKey = apiKey;
        this.endpointId = endpointId;
    }

    /**
     * Test connection to RunPod API
     * @returns {Promise<Object>} Connection test result
     */
    async testConnection() {
        try {
            if (!this.apiKey || !this.endpointId) {
                return {
                    success: false,
                    error: 'Missing API key or endpoint ID'
                };
            }

            // Test by checking endpoint health
            const response = await fetch(`${this.baseURL}/${this.endpointId}/health`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    status: 'Connected',
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
     * Generate 3D model from image using Hunyuan3D-2
     * @param {string} imageBase64 - Base64 encoded image
     * @param {Object} options - Generation options
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} Generation result
     */
    async generate3D(imageBase64, options = {}, onProgress = null) {
        const {
            generateTexture = true,
            removeBackground = true,
            profile = 3
        } = options;

        // Create job
        const createResponse = await this.createJob({
            image: imageBase64,
            generate_texture: generateTexture,
            remove_background: removeBackground,
            profile: profile
        });

        if (!createResponse.success) {
            throw new Error(createResponse.error || 'Failed to create job');
        }

        this.currentJobId = createResponse.id;

        // Poll for completion
        const result = await this.pollJob(createResponse.id, onProgress);
        this.currentJobId = null;

        return result;
    }

    /**
     * Create a job on RunPod
     * @param {Object} input - Job input parameters
     * @returns {Promise<Object>} Job creation result
     */
    async createJob(input) {
        try {
            const response = await fetch(`${this.baseURL}/${this.endpointId}/run`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ input })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: errorData.error || `HTTP ${response.status}`
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
                error: `Request failed: ${error.message}`
            };
        }
    }

    /**
     * Poll job status until completion
     * @param {string} jobId - Job ID to poll
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} Final job result
     */
    async pollJob(jobId, onProgress = null) {
        let attempts = 0;

        while (attempts < this.maxPollAttempts) {
            await this.sleep(this.pollInterval);
            attempts++;

            try {
                const response = await fetch(
                    `${this.baseURL}/${this.endpointId}/status/${jobId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`
                        }
                    }
                );

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
                        const output = data.output || {};
                        if (output.error) {
                            return {
                                success: false,
                                error: output.error
                            };
                        }
                        return {
                            success: true,
                            model_base64: output.model_base64,
                            file_size: output.file_size,
                            format: output.format || 'glb',
                            textured: output.textured,
                            execution_time: output.execution_time
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
            error: 'Timeout - job took too long'
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
            const response = await fetch(
                `${this.baseURL}/${this.endpointId}/cancel/${jobId}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            return response.ok;
        } catch (error) {
            console.error('Cancel failed:', error);
            return false;
        }
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

// Alias for compatibility with existing code
const ReplicateAPIClient = RunPodAPIClient;
const TripoSRAPIClient = RunPodAPIClient;

console.log('api.js loaded (RunPod/Hunyuan3D-2)');
