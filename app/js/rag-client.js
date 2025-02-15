import { createRAGApi } from './rag-api.js';
import { InMemoryMetricsCollector } from '../metrics/collector.js';

// Create metrics collector
const metricsCollector = new InMemoryMetricsCollector();

// Configure API with features
const api = createRAGApi('http', '', {
    rateLimiter: {
        askQuestionRate: 2,    // 2 questions per second
        feedbackRate: 5,       // 5 feedbacks per second
        defaultRate: 10        // 10 other operations per second
    },
    cache: {
        ttl: 300,              // 5 minutes cache TTL
        methods: []
    },
    metrics: {
        collector: metricsCollector
    },
    retry: {
        maxRetries: 3,
        delay: 1000
    },
    transformers: {
        answer: true,          // Combine words into sentences
        telemetry: true,       // Add client-side metrics
        relatedQuestions: true // Add question metadata
    }
});

// Wrap the API to ensure proper event source handling
class RAGClient {
    constructor(api, metricsCollector) {
        this.api = api;
        this.metrics = metricsCollector;
        this.eventSources = new Map();
    }

    async registerClient(uuid) {
        try {
            const eventSource = new EventSource(`/api/v2/rag/register-client?uuid=${uuid}`, {
                withCredentials: true
            });

            return new Promise((resolve, reject) => {
                eventSource.onerror = (error) => {
                    eventSource.close();
                    reject(new Error('Failed to establish SSE connection'));
                };

                // Wait a short time to ensure connection is established
                setTimeout(() => {
                    this.eventSources.set(uuid, eventSource);
                    resolve(eventSource);
                }, 200);
            });
        } catch (error) {
            console.error('Error registering client:', error);
            throw error;
        }
    }

    async stopClient(uuid) {
        try {
            // First send the stop request to the server
            await fetch(`/api/v2/rag/stop?uuid=${uuid}`);
            
            // Then close the event source
            const eventSource = this.eventSources.get(uuid);
            if (eventSource) {
                eventSource.close();
                this.eventSources.delete(uuid);
            }
        } catch (error) {
            console.error('Error stopping client:', error);
            throw error;
        }
    }

    async submitFeedback(uuid, feedback) {
        try {
            const response = await fetch(`/api/v2/rag/feedback?uuid=${uuid}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ feedback })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            throw error;
        }
    }

    async askQuestion(uuid, question, options = {}) {
        try {
            const {
                searchMode = 'multiword',
                searchDistance = '',
                profileId,
                filter = []
            } = options;

            const url = new URL('/api/v2/rag/ask', window.location.origin);
            url.searchParams.set('uuid', uuid);
            url.searchParams.set('sSearchMode', searchMode);
            url.searchParams.set('sSearchDistance', searchDistance);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question,
                    profileId,
                    filter
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to process question');
            }
        } catch (error) {
            console.error('Error asking question:', error);
            throw error;
        }
    }

    getMetrics() {
        return this.metrics.getMetrics();
    }
}

// Create and export the client instance
const client = new RAGClient(api, metricsCollector);

export { client };