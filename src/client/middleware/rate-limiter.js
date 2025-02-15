import { RAGMiddleware } from './rag-middleware.js';

/**
 * Token bucket rate limiter
 */
class TokenBucket {
    constructor(capacity, refillRate) {
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    refill() {
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(
            this.capacity,
            this.tokens + timePassed * this.refillRate
        );
        this.lastRefill = now;
    }

    tryConsume(tokens = 1) {
        this.refill();
        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }
        return false;
    }

    async waitForTokens(tokens = 1) {
        while (!this.tryConsume(tokens)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

/**
 * Rate limiting middleware with different strategies per method
 */
export class RateLimitMiddleware extends RAGMiddleware {
    constructor(options = {}) {
        super();
        const {
            askQuestionRate = 2,    // 2 questions per second
            feedbackRate = 5,       // 5 feedbacks per second
            defaultRate = 10        // 10 other operations per second
        } = options;

        // Create rate limiters for different operations
        this.rateLimiters = {
            askQuestion: new TokenBucket(askQuestionRate, askQuestionRate),
            submitFeedback: new TokenBucket(feedbackRate, feedbackRate),
            default: new TokenBucket(defaultRate, defaultRate)
        };
    }

    async handle(context) {
        const limiter = this.rateLimiters[context.method] || this.rateLimiters.default;
        
        try {
            await limiter.waitForTokens(1);
            return await super.handle(context);
        } catch (error) {
            if (error.code === 'RATE_LIMIT_EXCEEDED') {
                // Wait and retry once more
                await new Promise(resolve => setTimeout(resolve, 1000));
                await limiter.waitForTokens(1);
                return await super.handle(context);
            }
            throw error;
        }
    }
}