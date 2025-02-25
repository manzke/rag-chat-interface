import express from 'express';
import cors from 'cors';
import { RAGBackend } from './rag_backend.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createReadStream, statSync } from 'fs';
import { generateResponse, generateTelemetry } from './response-template.js';
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
app.use('/css', express.static(join(__dirname, '../dist/css'), {
    setHeaders: (res) => {
        res.setHeader('Content-Type', 'text/css');
    }
}));

app.use('/js', express.static(join(__dirname, '../dist/js'), {
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
app.use(express.static(join(__dirname, '../dist')));

// SSE client map
const clients = new Map();

// Helper function to send SSE
function sendSSE(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(join(__dirname, '../dist/chat.html'));
});

// Serve PDF files
app.get('/api/v2/pdf/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = join(__dirname, filename);
    
    try {
        // Get file stats
        const stat = statSync(filePath);
        
        // Set headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Accept-Ranges', 'bytes');
        
        // Handle range requests for partial content
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
            res.setHeader('Content-Length', end - start + 1);
            res.status(206); // Partial Content
            
            createReadStream(filePath, { start, end }).pipe(res);
        } else {
            // Send entire file
            createReadStream(filePath).pipe(res);
        }
    } catch (error) {
        console.error('Error serving PDF:', error);
        res.status(404).json({ error: 'PDF file not found' });
    }
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

    // Send initial telemetry with search metrics
    const initialTelemetry = generateTelemetry(question, 'initial');
    sendSSE(client.response, 'telemetry', initialTelemetry);

    // Process context and passages from backend result
    const { context, passages } = result;
    
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
            sendSSE(client.response, 'answer', `{"answer":"${word} ","eventType":"answer"}`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Send simulated response with markdown and code examples
    const response = generateResponse(question);
    // sendSSE(client.response, 'answer', `{"answer":"${response} ","eventType":"answer"}`);
    for (const line of response.split(/\n+/)) {
        sendSSE(client.response, 'answer', `{"answer":"${line}\\n","eventType":"answer"}`);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    //     sendSSE(client.response, 'answer', `{"answer":"${word} ","eventType":"answer"}`);
    //     await new Promise(resolve => setTimeout(resolve, 100));
    // }

    // Send related questions
    sendSSE(client.response, 'related', {
        questions: {
            related_questions: [
                "What are the main features?",
                "Can you explain more about this?",
                "How does this work?"
            ]
        }
    });

    const finalTelemetry = generateTelemetry(question, 'final');
    sendSSE(client.response, 'telemetry', finalTelemetry);

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