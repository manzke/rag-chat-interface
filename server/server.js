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
app.use(express.static(join(__dirname, '../static')));

// SSE client map
const clients = new Map();

// Helper function to send SSE
function sendSSE(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, '../static/welcome.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(join(__dirname, '../static/chat.html'));
});

// RAG API endpoints
app.get('/api/v2/rag/register-client', (req, res) => {
    const { uuid } = req.query;
    
    if (!uuid || !/^[\w-]+-[\w-]+$/.test(uuid)) {
        res.status(400).json({ error: 'Invalid UUID format' });
        return;
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Store client
    clients.set(uuid, {
        response: res,
        messages: [],
        lastActivity: new Date()
    });

    // Handle client disconnect
    req.on('close', () => {
        clients.delete(uuid);
    });
});

app.post('/api/v2/rag/ask', async (req, res) => {
    const { uuid } = req.query;
    const { question, profileId, filter = [] } = req.body;
    const client = clients.get(uuid);

    if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
    }

    if (!question) {
        res.status(400).json({ error: 'Question is required' });
        return;
    }

    // Send initial telemetry
    sendSSE(client.response, 'telemetry', {
        telemetry: {
            detected_question_language: 'English',
            model: 'gpt-3.5-turbo'
        }
    });

    // Process context
    const contextParts = [];
    if (filter) {
        const docIds = filter.find(f => f.key === 'id.keyword')?.values;
        const query = filter.find(f => f.key === 'query')?.values?.[0];

        if (docIds?.length) {
            contextParts.push(`Documents: ${docIds.join(', ')}`);
        }
        if (query) {
            contextParts.push(`Search Query: ${query}`);
        }
    }
    if (profileId) {
        try {
            const decodedProfile = Buffer.from(profileId, 'base64').toString('utf-8');
            contextParts.push(`Profile: ${decodedProfile}`);
        } catch {
            contextParts.push(`Profile ID: ${profileId}`);
        }
    }

    // Send context
    if (contextParts.length) {
        const context = "Context:\n" + contextParts.join("\n");
        for (const word of context.split(/\s+/)) {
            sendSSE(client.response, 'answer', word);
        }
    }

    // Send simulated response
    const response = `Answer to: ${question}\nThis is a simulated streaming response for the question.`;
    for (const word of response.split(/\s+/)) {
        sendSSE(client.response, 'answer', word);
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate streaming
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
    const client = clients.get(uuid);

    if (client) {
        client.response.end();
        clients.delete(uuid);
    }

    res.json({ status: 'stopped' });
});

app.post('/api/v2/rag/feedback', (req, res) => {
    const { uuid } = req.query;
    const { feedback } = req.body;

    if (!feedback || !['thumbs_up', 'thumbs_down'].includes(feedback)) {
        res.status(400).json({ error: 'Invalid feedback value' });
        return;
    }

    // Store feedback (in a real system)
    console.log(`Received feedback for ${uuid}: ${feedback}`);
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