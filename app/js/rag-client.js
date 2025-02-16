import { createRAGApi } from './rag-api.js';
import { InMemoryMetricsCollector } from './metrics/collector.js';

// Create metrics collector
const metricsCollector = new InMemoryMetricsCollector();

// Configure API with features
const api = createRAGApi('http', window.location.origin, {
    rateLimiter: {
        askQuestionRate: 2,    // 2 questions per second
        feedbackRate: 5,       // 5 feedbacks per second
        defaultRate: 10        // 10 other operations per second
    },
    cache: {
        ttl: 300,              // 5 minutes cache TTL
        methods: ['askQuestion']  // Cache question responses
    },
    metrics: {
        collector: metricsCollector
    },
    retry: {
        maxRetries: 3,         // Increased from 1 to handle transient failures
        delay: 1000
    },
    transformers: {
        answer: true,          // Combine words into sentences
        telemetry: true,       // Add client-side metrics
        relatedQuestions: true // Add question metadata
    }
});

/**
 * RAG Client that wraps the API to handle event sources and provide a clean interface
 */
class RAGClient {
    constructor(api, metricsCollector) {
        this.api = api;
        this.metrics = metricsCollector;
        this.eventSources = new Map();
        this.eventHandlers = new Map();
    }

    /**
     * Register a new client and set up SSE connection
     */
    async registerClient(uuid) {
        try {
            // Use the API to get the event source
            const eventSource = await this.api.registerClient(uuid);

            // Set up event handlers
            this.setupEventHandlers(uuid, eventSource);

            // Store the event source
            this.eventSources.set(uuid, eventSource);

            return eventSource;
        } catch (error) {
            console.error('Error registering client:', error);
            throw error;
        }
    }

    /**
     * Set up event handlers for the event source
     */
    setupEventHandlers(uuid, eventSource) {
        // Error handler
        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            this.cleanupClient(uuid);
            
            // Notify any registered error handlers
            const handlers = this.eventHandlers.get(uuid) || {};
            if (handlers.error) {
                handlers.error(error);
            }
        };

        // Close handler
        eventSource.onclose = () => {
            this.cleanupClient(uuid);
        };

        // Default event handlers
        const defaultHandlers = {
            answer: (event) => console.debug('Answer received:', event.data),
            telemetry: (event) => console.debug('Telemetry received:', event.data),
            related: (event) => console.debug('Related questions received:', event.data),
            complete: () => console.debug('Response complete')
        };

        // Set up default handlers that can be overridden
        this.eventHandlers.set(uuid, defaultHandlers);
    }

    /**
     * Register event handlers for a client
     */
    on(uuid, event, handler) {
        const handlers = this.eventHandlers.get(uuid) || {};
        handlers[event] = handler;
        this.eventHandlers.set(uuid, handlers);

        // Add handler to existing event source
        const eventSource = this.eventSources.get(uuid);
        if (eventSource) {
            eventSource.addEventListener(event, handler);
        }
    }

    /**
     * Clean up client resources
     */
    cleanupClient(uuid) {
        const eventSource = this.eventSources.get(uuid);
        if (eventSource) {
            eventSource.close();
            this.eventSources.delete(uuid);
        }
        this.eventHandlers.delete(uuid);
    }

    /**
     * Stop a client and clean up resources
     */
    async stopClient(uuid) {
        try {
            // Use the API to stop the client
            await this.api.stopClient(uuid);
            this.cleanupClient(uuid);
        } catch (error) {
            console.error('Error stopping client:', error);
            throw error;
        }
    }

    /**
     * Submit feedback for a response
     */
    async submitFeedback(uuid, feedback) {
        try {
            // Use the API to submit feedback
            await this.api.submitFeedback(uuid, feedback);
        } catch (error) {
            console.error('Error submitting feedback:', error);
            throw error;
        }
    }

    /**
     * Ask a question and handle the streaming response
     */
    async askQuestion(uuid, question, options = {}) {
        try {
            // Use the API to ask the question
            await this.api.askQuestion(uuid, question, options);
        } catch (error) {
            console.error('Error asking question:', error);
            throw error;
        }
    }

    /**
     * Get collected metrics
     */
    getMetrics() {
        return this.metrics.getMetrics();
    }
}

// Create and export the client instance
const client = new RAGClient(api, metricsCollector);

export { client };