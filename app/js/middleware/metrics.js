import { RAGMiddleware } from './rag-middleware.js';
import { RAGMetrics, InMemoryMetricsCollector } from '../metrics/collector.js';

/**
 * Middleware for collecting metrics
 */
export class MetricsMiddleware extends RAGMiddleware {
    constructor(options = {}) {
        super();
        const {
            collector = new InMemoryMetricsCollector()
        } = options;

        this.metrics = new RAGMetrics(collector);
    }

    async handle(context) {
        const startTime = Date.now();

        try {
            const result = await super.handle(context);

            // Record successful request
            const duration = Date.now() - startTime;
            this.metrics.recordRequest(context.method, duration, true);

            // Record method-specific metrics
            switch (context.method) {
                case 'askQuestion':
                    if (context.params.question) {
                        this.metrics.recordQuestionTokens(
                            context.params.question.split(/\s+/).length
                        );
                    }
                    break;

                case 'submitFeedback':
                    if (context.params.feedback) {
                        this.metrics.recordFeedback(context.params.feedback);
                    }
                    break;
            }

            return result;
        } catch (error) {
            // Record failed request
            const duration = Date.now() - startTime;
            this.metrics.recordRequest(context.method, duration, false);
            this.metrics.recordError(context.method, error.code || 'UNKNOWN_ERROR');

            throw error;
        }
    }
}

/**
 * Middleware for collecting response metrics
 */
export class ResponseMetricsMiddleware extends RAGMiddleware {
    constructor(options = {}) {
        super();
        const {
            collector = new InMemoryMetricsCollector()
        } = options;

        this.metrics = new RAGMetrics(collector);
    }

    async handle(context) {
        const result = await super.handle(context);

        // Handle streaming response metrics
        if (result instanceof EventSource) {
            // Clone the EventSource to add metrics without modifying the original
            const originalAddEventListener = result.addEventListener.bind(result);
            result.addEventListener = (type, listener, options) => {
                if (type === 'answer' || type === 'telemetry') {
                    const wrappedListener = (event) => {
                        this.handleMetric(type, event);
                        listener(event);
                    };
                    originalAddEventListener(type, wrappedListener, options);
                } else {
                    originalAddEventListener(type, listener, options);
                }
            };
        }

        return result;
    }

    handleMetric(type, event) {
        switch (type) {
            case 'answer':
                if (event.data) {
                    const tokens = event.data.split(/\s+/).length;
                    this.metrics.recordAnswerTokens(tokens);
                }
                break;

            case 'telemetry':
                try {
                    const telemetry = JSON.parse(event.data);
                    if (telemetry.processing_time) {
                        this.metrics.recordProcessingTime(telemetry.processing_time);
                    }
                } catch (error) {
                    // Ignore telemetry parsing errors
                }
                break;
        }
    }
}