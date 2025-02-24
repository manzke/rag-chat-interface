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
        // Execute the context at the end of the chain
        return await context.execute();
    }
}

/**
 * Error handling middleware
 */
class ErrorMiddleware extends RAGMiddleware {
    async handle(context) {
        try {
            const result = await super.handle(context);
            
            // If we got an EventSource, wrap its error handler
            if (result instanceof EventSource) {
                const originalOnerror = result.onerror;
                result.onerror = (event) => {
                    // Create enhanced error
                    const error = new Error('EventSource error');
                    error.code = 'SSE_ERROR';
                    error.details = event;
                    error.context = {
                        method: context.method,
                        uuid: context.uuid,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Call original handler if it exists
                    if (originalOnerror) {
                        originalOnerror.call(result, error);
                    }
                };
            }
            
            return result;
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
            
            // If we got an EventSource, log its events
            if (result instanceof EventSource) {
                this.logger.info(`[${context.method}] EventSource connected`, {
                    uuid: context.uuid,
                    duration,
                    timestamp: new Date().toISOString()
                });
                
                // Log events
                const originalAddEventListener = result.addEventListener.bind(result);
                result.addEventListener = (type, listener, options) => {
                    const wrappedListener = (event) => {
                        this.logger.debug(`[${context.method}] Event: ${type}`, {
                            uuid: context.uuid,
                            timestamp: new Date().toISOString()
                        });
                        listener(event);
                    };
                    originalAddEventListener(type, wrappedListener, options);
                };
                
                // Log errors
                const originalOnerror = result.onerror;
                result.onerror = (event) => {
                    this.logger.error(`[${context.method}] EventSource error`, {
                        uuid: context.uuid,
                        timestamp: new Date().toISOString()
                    });
                    if (originalOnerror) {
                        originalOnerror.call(result, event);
                    }
                };
            } else {
                this.logger.info(`[${context.method}] Request completed`, {
                    uuid: context.uuid,
                    duration,
                    timestamp: new Date().toISOString()
                });
            }

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
        // Ensure we have valid numbers
        this.maxRetries = typeof maxRetries === 'number' ? maxRetries : 3;
        this.delay = typeof delay === 'number' ? delay : 1000;
    }

    async handle(context) {
        let lastError;
        
        console.debug(`RetryMiddleware: Starting with maxRetries=${this.maxRetries}, delay=${this.delay}`);
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.debug(`RetryMiddleware: Attempt ${attempt}/${this.maxRetries} for ${context.method}`);
                return await super.handle(context);
            } catch (error) {
                lastError = error;
                console.debug(`RetryMiddleware: Attempt ${attempt} failed:`, error);
                
                // Don't retry on validation errors or if it's the last attempt
                if (error.code === 'VALIDATION_ERROR' || attempt === this.maxRetries) {
                    console.debug(`RetryMiddleware: Not retrying. Reason: ${error.code === 'VALIDATION_ERROR' ? 'Validation error' : 'Max retries reached'}`);
                    throw error;
                }

                // Wait before retrying
                const waitTime = this.delay * attempt;
                console.debug(`RetryMiddleware: Waiting ${waitTime}ms before retry`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        console.debug(`RetryMiddleware: All retries failed. Last error:`, lastError);
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
    //ErrorMiddleware,
    //LoggingMiddleware,
    //ValidationMiddleware,
    //RetryMiddleware,
    createMiddlewareChain
};