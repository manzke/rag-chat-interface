import {
    ErrorMiddleware,
    LoggingMiddleware,
    ValidationMiddleware,
    RetryMiddleware,
    createMiddlewareChain
} from './middleware/rag-middleware.js';
import { RateLimitMiddleware } from './middleware/rate-limiter.js';
import { CacheMiddleware } from './middleware/cache.js';
import { MetricsMiddleware, ResponseMetricsMiddleware } from './middleware/metrics.js';
import {
    AnswerTransformer,
    TelemetryTransformer,
    RelatedQuestionsTransformer,
    TransformerChain
} from './transformers/response.js';

/**
 * Base class for RAG API implementations
 */
class RAGAPIBase {
    constructor(options = {}) {
        const {
            // Middleware options
            rateLimiter = {},
            cache = {},
            metrics = {},
            retry = {},
            
            // Response transformer options
            transformers = {
                answer: true,
                telemetry: true,
                relatedQuestions: true
            }
        } = options;

        // Create response transformer chain
        this.transformerChain = new TransformerChain([
            ...(transformers.answer ? [new AnswerTransformer()] : []),
            ...(transformers.telemetry ? [new TelemetryTransformer()] : []),
            ...(transformers.relatedQuestions ? [new RelatedQuestionsTransformer()] : [])
        ]);

        // Create middleware chain
        this.middleware = createMiddlewareChain(
            new ErrorMiddleware(),
            new MetricsMiddleware(metrics),
            new RateLimitMiddleware(rateLimiter),
            new CacheMiddleware(cache),
            new LoggingMiddleware(),
            new ValidationMiddleware(),
            new RetryMiddleware(retry),
            new ResponseMetricsMiddleware(metrics)
        );
    }

    async _executeWithMiddleware(method, uuid, params = {}) {
        const context = {
            method,
            uuid,
            params,
            execute: async () => {
                return await this._execute(method, uuid, params);
            }
        };

        return await this.middleware.handle(context);
    }

    async _execute(method, uuid, params) {
        throw new Error('Not implemented');
    }

    async registerClient(uuid) {
        return await this._executeWithMiddleware('registerClient', uuid);
    }

    async stopClient(uuid) {
        return await this._executeWithMiddleware('stopClient', uuid);
    }

    async submitFeedback(uuid, feedback) {
        return await this._executeWithMiddleware('submitFeedback', uuid, { feedback });
    }

    async askQuestion(uuid, question, options = {}) {
        return await this._executeWithMiddleware('askQuestion', uuid, { question, ...options });
    }
}

/**
 * HTTP implementation of the RAG API
 */
class HTTPRAGApi extends RAGAPIBase {
    constructor(baseUrl = '', options = {}) {
        super(options);
        this.baseUrl = baseUrl;
    }

    /**
     * Execute the API request with middleware
     */
    async _execute(method, uuid, params) {
        switch (method) {
            case 'registerClient':
                return await this._registerClient(uuid);
            case 'stopClient':
                return await this._stopClient(uuid);
            case 'submitFeedback':
                return await this._submitFeedback(uuid, params.feedback);
            case 'askQuestion':
                return await this._askQuestion(uuid, params.question, params);
            default:
                throw new Error(`Unknown method: ${method}`);
        }
    }

    /**
     * Register a new client for streaming responses
     */
    async _registerClient(uuid) {
        const url = new URL(`${this.baseUrl}/api/v2/rag/register-client`);
        url.searchParams.set('uuid', uuid);
        
        return new Promise((resolve, reject) => {
            try {
                const eventSource = new EventSource(url);
                
                eventSource.onerror = (event) => {
                    eventSource.close();
                    const error = new Error('Failed to establish SSE connection');
                    error.event = event;
                    reject(error);
                };

                eventSource.onopen = () => {
                    resolve(eventSource);
                };

                // Set a timeout in case the connection hangs
                const timeout = setTimeout(() => {
                    eventSource.close();
                    const error = new Error('SSE connection timeout');
                    reject(error);
                }, 5000);

                // Clear timeout if connection succeeds
                eventSource.addEventListener('open', () => clearTimeout(timeout));
            } catch (error) {
                reject(new Error('Failed to create EventSource: ' + error.message));
            }
        });
    }

    /**
     * Stop and unregister a client
     */
    async _stopClient(uuid) {
        const url = new URL(`${this.baseUrl}/api/v2/rag/stop`);
        url.searchParams.set('uuid', uuid);

        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to stop client');
        }
    }

    /**
     * Submit feedback for a response
     */
    async _submitFeedback(uuid, feedback) {
        const url = new URL(`${this.baseUrl}/api/v2/rag/feedback`);
        url.searchParams.set('uuid', uuid);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ feedback })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to submit feedback');
        }
    }

    /**
     * Ask a question
     */
    async _askQuestion(uuid, question, options = {}) {
        const {
            searchMode = 'multiword',
            searchDistance = '',
            profileId,
            filter = []
        } = options;

        const url = new URL(`${this.baseUrl}/api/v2/rag/ask`);
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
    }
}

/**
 * WebSocket implementation of the RAG API (example)
 */
class WebSocketRAGApi extends RAGAPIBase {
    constructor(wsUrl = '', options = {}) {
        super(options);
        this.wsUrl = wsUrl;
        this.ws = null;
        this.eventHandlers = new Map();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.onopen = () => resolve();
            this.ws.onerror = (error) => reject(error);
            
            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                const handler = this.eventHandlers.get(message.uuid);
                if (handler) {
                    handler(message);
                }
            };
        });
    }

    async registerClient(uuid) {
        if (!this.ws) await this.connect();
        
        const eventSource = new EventTarget();
        this.eventHandlers.set(uuid, (message) => {
            const event = new CustomEvent(message.event, {
                detail: message.data
            });
            eventSource.dispatchEvent(event);
        });

        this.ws.send(JSON.stringify({
            type: 'register',
            uuid
        }));

        return eventSource;
    }

    async stopClient(uuid) {
        if (!this.ws) throw new Error('Not connected');
        
        this.ws.send(JSON.stringify({
            type: 'stop',
            uuid
        }));
        this.eventHandlers.delete(uuid);
    }

    async submitFeedback(uuid, feedback) {
        if (!this.ws) throw new Error('Not connected');
        
        this.ws.send(JSON.stringify({
            type: 'feedback',
            uuid,
            feedback
        }));
    }

    async askQuestion(uuid, question, options = {}) {
        if (!this.ws) throw new Error('Not connected');
        
        this.ws.send(JSON.stringify({
            type: 'ask',
            uuid,
            question,
            ...options
        }));
    }
}

/**
 * Factory function to create a RAG API instance
 * @param {string} protocol - Protocol to use ('http' or 'ws')
 * @param {string} baseUrl - Base URL for the API
 * @returns {RAGAPIBase} RAG API instance
 */
function createRAGApi(protocol, baseUrl, options = {}) {
    switch (protocol.toLowerCase()) {
        case 'http':
            return new HTTPRAGApi(baseUrl, options);
        case 'ws':
            return new WebSocketRAGApi(baseUrl, options);
        default:
            throw new Error(`Unsupported protocol: ${protocol}`);
    }
}

// Export the API
export {
    RAGAPIBase,
    HTTPRAGApi,
    WebSocketRAGApi,
    createRAGApi
};