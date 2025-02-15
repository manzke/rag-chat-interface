# RAG Chat Interface

A modern chat interface for Retrieval-Augmented Generation (RAG) systems, featuring an advanced client library, middleware system, and extensible architecture.

## Project Structure

```
src/
├── client/              # Client-side code
│   ├── js/             # JavaScript files
│   │   ├── rag-api.js  # Core API implementation
│   │   ├── rag-client.js # Client implementation
│   │   └── script.js   # Main application code
│   ├── css/            # Stylesheets
│   ├── types/          # TypeScript definitions
│   ├── middleware/     # Client middleware
│   ├── transformers/   # Response transformers
│   └── metrics/        # Metrics collectors
├── server/             # Server-side code
│   ├── server.js       # Express server
│   └── rag_backend.js  # Backend implementation
├── static/             # Static files
│   ├── chat.html      # Chat interface
│   └── welcome.html   # Welcome page
├── tests/             # Test suite
└── docs/              # Documentation
    └── FEATURES-SPEC.md # Feature specifications
```

## Features

- Advanced chat interface with expert mode
- Middleware system for request/response processing
- Response transformers for enhanced output
- Metrics collection and monitoring
- TypeScript support
- Comprehensive test suite

## Getting Started

### Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open in browser:
```
http://localhost:53708
```

### Production Build

1. Build the client:
```bash
# Clean previous builds
npm run clean

# Build for production
npm run build
```

The build output will be in the `dist` directory, containing:
- Minified JavaScript bundles
- Processed CSS files
- Optimized HTML files
- Static assets

2. Deploy the contents of the `dist` directory to your web server.

### Build Features

- JavaScript bundling and minification
- CSS processing and optimization
- HTML minification
- Asset optimization
- Cache busting with content hashes
- Code splitting
- Vendor chunk separation
- Source maps for debugging
```

## Development

### Client Development

The client code uses a modular architecture with:
- RAG API base implementation
- HTTP and WebSocket protocol support
- Middleware system for request processing
- Response transformers
- Metrics collection

To add new features:
1. Add TypeScript definitions in `client/types/`
2. Implement middleware in `client/middleware/`
3. Add transformers in `client/transformers/`
4. Update metrics in `client/metrics/`

### Server Development

The server provides:
- SSE (Server-Sent Events) for streaming
- RESTful API endpoints
- Backend RAG implementation
- Session management

To extend the server:
1. Add new endpoints in `server/server.py`
2. Implement backend logic in `server/rag_backend.py`

### Testing

Run the test suite:
```bash
npm test
```

Add new tests in `tests/` directory.

## API Documentation

### Client API

```javascript
const api = createRAGApi('http', 'http://localhost:53708');

// Register client
const eventSource = await api.registerClient('client-123');

// Ask question
await api.askQuestion('client-123', 'What is RAG?', {
    searchMode: 'semantic',
    filter: [{ key: 'id.keyword', values: ['doc1'] }]
});

// Submit feedback
await api.submitFeedback('client-123', 'thumbs_up');
```

### Server API

```
GET /api/v2/rag/register-client?uuid={uuid}
POST /api/v2/rag/ask?uuid={uuid}
GET /api/v2/rag/stop?uuid={uuid}
POST /api/v2/rag/feedback?uuid={uuid}
```

## Configuration

Server configuration in `config.json`:
```json
{
    "port": 53708,
    "host": "0.0.0.0",
    "cors": true,
    "rate_limit": {
        "enabled": true,
        "rate": 10
    }
}
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request