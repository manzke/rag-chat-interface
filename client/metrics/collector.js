/**
 * Base metrics collector
 */
class MetricsCollector {
    recordMetric(name, value, tags = {}) {
        throw new Error('Not implemented');
    }

    recordHistogram(name, value, tags = {}) {
        throw new Error('Not implemented');
    }

    recordCounter(name, value = 1, tags = {}) {
        throw new Error('Not implemented');
    }

    flush() {
        throw new Error('Not implemented');
    }
}

/**
 * In-memory metrics collector
 */
export class InMemoryMetricsCollector extends MetricsCollector {
    constructor() {
        super();
        this.metrics = new Map();
        this.histograms = new Map();
        this.counters = new Map();
    }

    generateKey(name, tags) {
        const tagString = Object.entries(tags)
            .sort(([k1], [k2]) => k1.localeCompare(k2))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${name}${tagString ? `:${tagString}` : ''}`;
    }

    recordMetric(name, value, tags = {}) {
        const key = this.generateKey(name, tags);
        this.metrics.set(key, value);
    }

    recordHistogram(name, value, tags = {}) {
        const key = this.generateKey(name, tags);
        if (!this.histograms.has(key)) {
            this.histograms.set(key, []);
        }
        this.histograms.get(key).push(value);
    }

    recordCounter(name, value = 1, tags = {}) {
        const key = this.generateKey(name, tags);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + value);
    }

    getMetrics() {
        return {
            metrics: Object.fromEntries(this.metrics),
            histograms: Object.fromEntries(this.histograms),
            counters: Object.fromEntries(this.counters)
        };
    }

    flush() {
        this.metrics.clear();
        this.histograms.clear();
        this.counters.clear();
    }
}

/**
 * Prometheus metrics collector example
 */
export class PrometheusMetricsCollector extends MetricsCollector {
    constructor(registry) {
        super();
        this.registry = registry;
        this.metrics = new Map();
    }

    getOrCreateMetric(name, type, tags = {}) {
        const key = `${type}:${name}`;
        if (!this.metrics.has(key)) {
            const metric = new this.registry[type]({
                name,
                help: `${name} metric`,
                labelNames: Object.keys(tags)
            });
            this.metrics.set(key, metric);
        }
        return this.metrics.get(key);
    }

    recordMetric(name, value, tags = {}) {
        const gauge = this.getOrCreateMetric(name, 'Gauge', tags);
        gauge.set(tags, value);
    }

    recordHistogram(name, value, tags = {}) {
        const histogram = this.getOrCreateMetric(name, 'Histogram', tags);
        histogram.observe(tags, value);
    }

    recordCounter(name, value = 1, tags = {}) {
        const counter = this.getOrCreateMetric(name, 'Counter', tags);
        counter.inc(tags, value);
    }

    flush() {
        // Prometheus metrics are automatically exposed via HTTP
    }
}

/**
 * RAG API metrics
 */
export class RAGMetrics {
    constructor(collector) {
        this.collector = collector;
    }

    recordRequest(method, duration, success = true) {
        this.collector.recordHistogram('rag_request_duration', duration, {
            method,
            success: success.toString()
        });
        
        this.collector.recordCounter('rag_requests_total', 1, {
            method,
            success: success.toString()
        });
    }

    recordQuestionTokens(tokens) {
        this.collector.recordHistogram('rag_question_tokens', tokens);
    }

    recordAnswerTokens(tokens) {
        this.collector.recordHistogram('rag_answer_tokens', tokens);
    }

    recordProcessingTime(duration) {
        this.collector.recordHistogram('rag_processing_time', duration);
    }

    recordFeedback(type) {
        this.collector.recordCounter('rag_feedback_total', 1, { type });
    }

    recordError(method, errorCode) {
        this.collector.recordCounter('rag_errors_total', 1, {
            method,
            error_code: errorCode
        });
    }

    recordCacheHit(method) {
        this.collector.recordCounter('rag_cache_hits_total', 1, { method });
    }

    recordCacheMiss(method) {
        this.collector.recordCounter('rag_cache_misses_total', 1, { method });
    }

    recordRateLimit(method) {
        this.collector.recordCounter('rag_rate_limits_total', 1, { method });
    }
}