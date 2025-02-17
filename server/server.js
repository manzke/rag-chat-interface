import express from 'express';
import cors from 'cors';
import { RAGBackend } from './rag_backend.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const backend = new RAGBackend();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files with proper MIME types
app.use('/css', express.static(join(__dirname, '../app/css'), {
    setHeaders: (res) => {
        res.setHeader('Content-Type', 'text/css');
    }
}));

app.use('/js', express.static(join(__dirname, '../app/js'), {
    setHeaders: (res) => {
        res.setHeader('Content-Type', 'application/javascript');
    }
}));

app.use('/configs', express.static(join(__dirname, '../app/configs'), {
    setHeaders: (res) => {
        res.setHeader('Content-Type', 'application/json');
    }
}));

// Serve other static files
app.use(express.static(join(__dirname, '../app')));

// SSE client map
const clients = new Map();

// Helper function to send SSE
function sendSSE(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, '../app/index.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(join(__dirname, '../app/chat.html'));
});

// RAG API endpoints
app.get('/api/v2/rag/register-client', (req, res) => {
    const { uuid } = req.query;
    
    // Register client with backend
    const client = backend.registerClient(uuid);
    if (!client) {
        res.status(400).json({ error: 'Invalid UUID format' });
        return;
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Store SSE response
    clients.set(uuid, {
        response: res,
        messages: [],
        lastActivity: new Date()
    });

    // Handle client disconnect
    req.on('close', () => {
        backend.stopClient(uuid);
        clients.delete(uuid);
    });
});

app.post('/api/v2/rag/ask', async (req, res) => {
    const { uuid } = req.query;
    const { question, profileId, filter = [] } = req.body;

    // Process question with backend
    const result = await backend.processQuestion(uuid, { question, profileId, filter });
    if (result.error) {
        res.status(400).json({ error: result.error });
        return;
    }

    const client = clients.get(uuid);
    if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
    }

    // Send initial telemetry
    sendSSE(client.response, 'telemetry', {
        telemetry: {
            detected_question_language: 'English',
            model: 'gpt-3.5-turbo'
        }
    });

    // Process context and passages from backend result
    const { context, passages } = result;
    
    // Send initial telemetry with passage info
    sendSSE(client.response, 'telemetry', {
        telemetry: JSON.stringify({
            telemetry: {
                retrieval_query_generation_result_text: `GeneratedQueries[semanticQueries=[${question}], keywordQueries=[${context.query || ''}]]`,
                usage: {
                    prompt_tokens: 889,
                    total_tokens: 915,
                    completion_tokens: 26
                },
                retrieval_query_execution_number_of_passages_in_query_result: passages.length,
                retrieval_final_number_of_retrieved_passages: passages.length,
                retrieval_query_generation_duration: 1.743,
                retrieval_query_execution_duration: 0.14,
                retrieval_passage_processing_duration: 0.007,
                detected_question_language: "German",
                language_detection_duration: 0.0,
                model: "hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4",
                retrieval_threshold_passage_retrieval: 0.9212912,
                retrieval_duration: 0.257,
                retrieval_number_of_candidate_documents: passages.length + 2
            }
        }),
        eventType: "telemetry"
    });

    // Send passages event
    sendSSE(client.response, 'passages', { passages });

    // Send context as part of the answer
    const contextParts = [];
    if (context.docIds?.length) {
        contextParts.push(`Documents: ${context.docIds.join(', ')}`);
    }
    if (context.query) {
        contextParts.push(`Search Query: ${context.query}`);
    }
    if (context.profileId) {
        try {
            const decodedProfile = Buffer.from(context.profileId, 'base64').toString('utf-8');
            contextParts.push(`Profile: ${decodedProfile}`);
        } catch {
            contextParts.push(`Profile ID: ${context.profileId}`);
        }
    }

    // Send context
    if (contextParts.length) {
        const contextText = "Context:\n" + contextParts.join("\n");
        for (const word of contextText.split(/\s+/)) {
            sendSSE(client.response, 'answer', word);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Send simulated response with markdown and code examples
    const response = `# Answer to: ${question}

Here's a comprehensive example showcasing various markdown and code features:

## Text Formatting

You can use **bold**, *italic*, or ***both***. You can also use ~~strikethrough~~ text.

## Lists

### Unordered List
- Item 1
- Item 2
  - Nested item 2.1
  - Nested item 2.2
- Item 3

### Ordered List
1. First item
2. Second item
   1. Nested item 2.1
   2. Nested item 2.2
3. Third item

## Task List
- [x] Completed task
- [ ] Pending task
- [ ] Future task

## Links and Images
- [OpenHands AI](https://openhands.ai)
- ![Sample Image](https://picsum.photos/200/100)

## Blockquotes
> This is a blockquote
> It can span multiple lines
>> And can be nested

## Tables
| Language | Type | Usage |
|----------|------|-------|
| Python   | Dynamic | General Purpose |
| JavaScript | Dynamic | Web Development |
| Rust     | Static | Systems Programming |

## Code Examples

### Python
\`\`\`python
def fibonacci(n: int) -> int:
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Example usage
print(fibonacci(10))
\`\`\`

### JavaScript/TypeScript
\`\`\`typescript
interface User {
    id: number;
    name: string;
    email?: string;
}

function greetUser(user: User): string {
    return \`Hello, \${user.name}!\`;
}

// Example usage
const user: User = {
    id: 1,
    name: "Alice"
};
console.log(greetUser(user));
\`\`\`

### SQL
\`\`\`sql
SELECT 
    users.name,
    COUNT(orders.id) as order_count
FROM users
LEFT JOIN orders ON users.id = orders.user_id
WHERE users.status = 'active'
GROUP BY users.id
HAVING order_count > 5
ORDER BY order_count DESC;
\`\`\`

### JSON
\`\`\`json
{
    "name": "OpenHands AI",
    "version": "1.0.0",
    "features": [
        "Markdown Support",
        "Code Highlighting",
        "Math Expressions"
    ],
    "settings": {
        "theme": "dark",
        "language": "en"
    }
}
\`\`\`

## Math Expressions

### Inline Math
The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

### Display Math
$$
\\begin{aligned}
\\nabla \\times \\vec{\\mathbf{B}} -\\, \\frac{1}{c} \\frac{\\partial\\vec{\\mathbf{E}}}{\\partial t} & = \\frac{4\\pi}{c}\\vec{\\mathbf{j}} \\\\
\\nabla \\cdot \\vec{\\mathbf{E}} & = 4 \\pi \\rho \\\\
\\nabla \\times \\vec{\\mathbf{E}}\\, +\\, \\frac{1}{c} \\frac{\\partial\\vec{\\mathbf{B}}}{\\partial t} & = \\vec{\\mathbf{0}} \\\\
\\nabla \\cdot \\vec{\\mathbf{B}} & = 0
\\end{aligned}
$$

## Diagrams (Mermaid)
\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
\`\`\`

This example demonstrates various markdown features including text formatting, lists, tables, code blocks with syntax highlighting, and mathematical expressions.`;
    for (const word of response.split(/\s+/)) {
        sendSSE(client.response, 'answer', word);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send related questions
    sendSSE(client.response, 'related', {
        questions: [
            "What are the main features?",
            "Can you explain more about this?",
            "How does this work?"
        ]
    });

    // Send final telemetry
    sendSSE(client.response, 'telemetry', {
        telemetry: {
            processing_time: 1.234,
            tokens_used: 156
        }
    });

    // Send completion
    sendSSE(client.response, 'complete', '');

    res.json({ status: 'processing' });
});

app.get('/api/v2/rag/stop', (req, res) => {
    const { uuid } = req.query;
    
    // Stop client in backend
    const success = backend.stopClient(uuid);
    
    // Close SSE connection
    const client = clients.get(uuid);
    if (client) {
        client.response.end();
        clients.delete(uuid);
    }
    console.log(`Trying to stop client for uuid: ${uuid} success: ${success}`);

    res.json({ status: success ? 'stopped' : 'client_not_found' });
});

app.post('/api/v2/rag/feedback', (req, res) => {
    const { uuid } = req.query;
    const { feedback } = req.body;

    // Process feedback with backend
    const result = backend.processFeedback(uuid, feedback);
    if (result.error) {
        res.status(400).json({ error: result.error });
        return;
    }

    res.json({ status: 'success' });
});

// Cleanup inactive clients
setInterval(() => {
    const now = new Date();
    for (const [uuid, client] of clients.entries()) {
        if (now - client.lastActivity > 5 * 60 * 1000) { // 5 minutes
            client.response.end();
            clients.delete(uuid);
            console.log(`Removed inactive client: ${uuid}`);
        }
    }
}, 60 * 1000); // Check every minute

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 53708;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});