/**
 * Middleware interface for RAG API
 */
class RAGMiddleware {
    constructor() {
        this.next = null;
    }

    setNext(middleware) {
        this.next = middleware;
        return middleware;
    }

    async handle(context) {
        if (this.next) {
            return await this.next.handle(context);
        }
        return context;
    }
}

/**
 * Error handling middleware
 */
class ErrorMiddleware extends RAGMiddleware {
    async handle(context) {
        try {
            return await super.handle(context);
        } catch (caught) {
            // Ensure we have a proper Error object
            const error = caught instanceof Error ? caught : new Error(String(caught));
            
            // Enhance error with additional information
            const ragError = new Error(error.message || 'Unknown error occurred');
            ragError.code = error.code || 'UNKNOWN_ERROR';
            ragError.details = error.details || error;
            ragError.originalError = error;
            
            // Add request context to error
            ragError.context = {
                method: context.method,
                uuid: context.uuid,
                timestamp: new Date().toISOString()
            };

            throw ragError;
        }
    }
}

/**
 * Logging middleware
 */
class LoggingMiddleware extends RAGMiddleware {
    constructor(logger = console) {
        super();
        this.logger = logger;
    }

    async handle(context) {
        const startTime = Date.now();
        this.logger.info(`[${context.method}] Request started`, {
            uuid: context.uuid,
            timestamp: new Date().toISOString()
        });

        try {
            const result = await super.handle(context);
            
            const duration = Date.now() - startTime;
            this.logger.info(`[${context.method}] Request completed`, {
                uuid: context.uuid,
                duration,
                timestamp: new Date().toISOString()
            });

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`[${context.method}] Request failed`, {
                uuid: context.uuid,
                error: error.message,
                duration,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }
}

/**
 * Validation middleware
 */
class ValidationMiddleware extends RAGMiddleware {
    async handle(context) {
        // Validate UUID
        if (!context.uuid || !/^[\w-]+-[\w-]+$/.test(context.uuid)) {
            const error = new Error('Invalid UUID format');
            error.code = 'VALIDATION_ERROR';
            throw error;
        }

        // Method-specific validation
        switch (context.method) {
            case 'askQuestion':
                if (!context.params.question) {
                    const error = new Error('Question is required');
                    error.code = 'VALIDATION_ERROR';
                    throw error;
                }
                break;

            case 'submitFeedback':
                if (!context.params.feedback || !['thumbs_up', 'thumbs_down'].includes(context.params.feedback)) {
                    const error = new Error('Invalid feedback value');
                    error.code = 'VALIDATION_ERROR';
                    throw error;
                }
                break;
        }

        return await super.handle(context);
    }
}

/**
 * Retry middleware
 */
class RetryMiddleware extends RAGMiddleware {
    constructor(maxRetries = 3, delay = 1000) {
        super();
        this.maxRetries = maxRetries;
        this.delay = delay;
    }

    async handle(context) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await super.handle(context);
            } catch (error) {
                lastError = error;
                
                // Don't retry on validation errors or if it's the last attempt
                if (error.code === 'VALIDATION_ERROR' || attempt === this.maxRetries) {
                    throw error;
                }

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, this.delay * attempt));
            }
        }

        throw lastError;
    }
}

/**
 * Create a middleware chain
 */
function createMiddlewareChain(...middlewares) {
    const head = middlewares[0];
    middlewares.reduce((prev, curr) => prev.setNext(curr));
    return head;
}

export {
    RAGMiddleware,
    ErrorMiddleware,
    LoggingMiddleware,
    ValidationMiddleware,
    RetryMiddleware,
    createMiddlewareChain
};