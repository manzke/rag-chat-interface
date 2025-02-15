import { RAGMiddleware } from './rag-middleware.js';

/**
 * Cache storage interface
 */
class CacheStorage {
    async get(key) {
        throw new Error('Not implemented');
    }

    async set(key, value, ttl) {
        throw new Error('Not implemented');
    }

    async delete(key) {
        throw new Error('Not implemented');
    }
}

/**
 * In-memory cache implementation
 */
class InMemoryCache extends CacheStorage {
    constructor() {
        super();
        this.cache = new Map();
    }

    async get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (item.expiry && Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    async set(key, value, ttl = 0) {
        const expiry = ttl > 0 ? Date.now() + ttl * 1000 : null;
        this.cache.set(key, { value, expiry });
    }

    async delete(key) {
        this.cache.delete(key);
    }
}

/**
 * Cache middleware with support for different storage backends
 */
export class CacheMiddleware extends RAGMiddleware {
    constructor(options = {}) {
        super();
        const {
            storage = new InMemoryCache(),
            ttl = 300,  // 5 minutes default TTL
            methods = ['askQuestion']  // Methods to cache
        } = options;

        this.storage = storage;
        this.ttl = ttl;
        this.methods = new Set(methods);
    }

    generateCacheKey(context) {
        const { method, uuid, params } = context;
        return `${method}:${uuid}:${JSON.stringify(params)}`;
    }

    shouldCache(context) {
        return this.methods.has(context.method);
    }

    async handle(context) {
        if (!this.shouldCache(context)) {
            return await super.handle(context);
        }

        const cacheKey = this.generateCacheKey(context);
        
        // Try to get from cache
        const cached = await this.storage.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Execute and cache result
        const result = await super.handle(context);
        await this.storage.set(cacheKey, result, this.ttl);
        return result;
    }
}

/**
 * Redis cache implementation example
 */
export class RedisCache extends CacheStorage {
    constructor(redisClient) {
        super();
        this.client = redisClient;
    }

    async get(key) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }

    async set(key, value, ttl = 0) {
        const serialized = JSON.stringify(value);
        if (ttl > 0) {
            await this.client.setex(key, ttl, serialized);
        } else {
            await this.client.set(key, serialized);
        }
    }

    async delete(key) {
        await this.client.del(key);
    }
}