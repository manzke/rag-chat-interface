# RAG API Client Library

A robust client library for interacting with RAG (Retrieval-Augmented Generation) APIs, supporting both HTTP and WebSocket protocols with features like rate limiting, caching, and metrics collection.

## Features

- 🔄 Protocol independence (HTTP/SSE and WebSocket support)
- 🚦 Rate limiting with token bucket algorithm
- 💾 Caching with pluggable storage backends
- 📊 Metrics collection and monitoring
- 🔄 Automatic retries with backoff
- 🔍 Request validation
- 📝 Response transformation
- 📋 TypeScript definitions

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/rag-api-client.git
cd rag-api-client
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Basic Usage

```javascript
import { createRAGApi } from './rag-api.js';

// Create an HTTP API instance
const api = createRAGApi('http', 'http://localhost:53708');

// Register a client
const eventSource = await api.registerClient('client-123');

// Set up event handlers
eventSource.addEventListener('answer', (event) => {
    console.log('Answer:', event.data);
});

// Ask a question
await api.askQuestion('client-123', 'What is RAG?');

// Submit feedback
await api.submitFeedback('client-123', 'thumbs_up');

// Stop the client
await api.stopClient('client-123');
```

### Advanced Usage with Features

```javascript
import { createRAGApi } from './rag-api.js';
import { InMemoryMetricsCollector } from './metrics/collector.js';
import { RedisCache } from './middleware/cache.js';

// Create collectors and storage
const metricsCollector = new InMemoryMetricsCollector();
const redisCache = new RedisCache(redisClient);

// Configure API with all features
const api = createRAGApi('http', 'http://localhost:53708', {
    rateLimiter: {
        askQuestionRate: 2,    // 2 questions per second
        feedbackRate: 5,       // 5 feedbacks per second
        defaultRate: 10        // 10 other operations per second
    },
    cache: {
        storage: redisCache,
        ttl: 300,              // 5 minutes cache TTL
        methods: ['askQuestion']
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

// Use the API with enhanced features
const eventSource = await api.registerClient('client-123');

eventSource.addEventListener('answer', (event) => {
    console.log('Complete sentences:', event.data);
    console.log('Partial sentence:', event.partial);
});

eventSource.addEventListener('telemetry', (event) => {
    const telemetry = JSON.parse(event.data);
    console.log('Enhanced telemetry:', telemetry);
});

// Get collected metrics
console.log('Metrics:', metricsCollector.getMetrics());
```

## Project Structure

```
rag-api-client/
├── types/                 # TypeScript definitions
│   └── rag-api.d.ts
├── middleware/           # Middleware implementations
│   ├── rag-middleware.js
│   ├── rate-limiter.js
│   ├── cache.js
│   └── metrics.js
├── transformers/        # Response transformers
│   └── response.js
├── metrics/            # Metrics collection
│   └── collector.js
├── rag-api.js         # Main API implementation
├── example-usage.js   # Usage examples
└── tests/             # Test suite
    └── rag-api.test.js
```

## Development

### Running Tests

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Building

```bash
# Install dependencies
npm install

# Build TypeScript definitions
npm run build:types

# Build for production
npm run build
```

## API Documentation

### RAGAPIBase

Base class for all API implementations.

#### Methods

- `registerClient(uuid: string): Promise<RAGEventSource>`
- `stopClient(uuid: string): Promise<void>`
- `submitFeedback(uuid: string, feedback: FeedbackType): Promise<void>`
- `askQuestion(uuid: string, question: string, options?: QuestionOptions): Promise<void>`

### Events

The API emits the following events through EventSource:

- `answer`: Streaming answer responses
- `telemetry`: Performance metrics
- `related`: Related questions
- `complete`: Response completion
- `error`: Error information

### Configuration Options

```typescript
interface APIOptions {
    rateLimiter?: {
        askQuestionRate?: number;
        feedbackRate?: number;
        defaultRate?: number;
    };
    cache?: {
        storage?: CacheStorage;
        ttl?: number;
        methods?: string[];
    };
    metrics?: {
        collector?: MetricsCollector;
    };
    retry?: {
        maxRetries?: number;
        delay?: number;
    };
    transformers?: {
        answer?: boolean;
        telemetry?: boolean;
        relatedQuestions?: boolean;
    };
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.