/**
 * RAG Backend implementation
 */
export class RAGBackend {
    constructor() {
        this.activeClients = new Map();
    }

    /**
     * Register a new client
     * @param {string} uuid Client UUID
     * @returns {Object} Client data or null if invalid
     */
    registerClient(uuid) {
        if (!this.isValidUuid(uuid)) {
            return null;
        }

        const client = {
            messages: [],
            lastActivity: new Date()
        };

        this.activeClients.set(uuid, client);
        return client;
    }

    /**
     * Stop and remove a client
     * @param {string} uuid Client UUID
     * @returns {boolean} Success status
     */
    stopClient(uuid) {
        this.activeClients.delete(uuid);
        return true;
    }

    /**
     * Process a question
     * @param {string} uuid Client UUID
     * @param {Object} data Question data
     * @returns {Object} Processing result
     */
    async processQuestion(uuid, data) {
        const client = this.activeClients.get(uuid);
        if (!client) {
            return { error: 'Client not found' };
        }

        if (!data.question) {
            return { error: 'Question is required' };
        }

        // Update last activity
        client.lastActivity = new Date();

        // Process filters
        const docIds = [];
        let query = null;
        for (const filter of data.filter || []) {
            if (filter.key === 'id.keyword') {
                docIds.push(...filter.values);
            } else if (filter.key === 'query') {
                query = filter.values[0];
            }
        }

        // Generate sample passages based on the question
        const passages = this.generateSamplePassages(data.question, docIds);

        return {
            success: true,
            context: {
                docIds,
                query,
                profileId: data.profileId
            },
            passages
        };
    }

    /**
     * Generate sample passages for demonstration
     * @param {string} question The user's question
     * @param {string[]} docIds Optional document IDs from filters
     * @returns {Array} Array of passage objects
     */
    generateSamplePassages(question, docIds = []) {
        const baseUrl = 'https://www.bmwk.de/Redaktion/DE/Artikel';
        const now = new Date();
        
        // Generate 3-5 passages
        const numPassages = 3 + Math.floor(Math.random() * 3);
        const passages = [];

        for (let i = 0; i < numPassages; i++) {
            const score = 0.9 - (i * 0.15) + (Math.random() * 0.1); // Decreasing scores with some randomness
            const docId = docIds[i] || crypto.randomUUID();
            const path = ['Innovation', 'Digitale-Welt', 'Energie', 'Europa'][i % 4];
            const filename = `document-${i + 1}.html`;
            
            passages.push({
                id: docId,
                text: [
                    `This is a sample passage ${i + 1} related to "${question}". `,
                    `It contains multiple sentences to demonstrate the content. `,
                    `You can find more information in our documentation.`
                ],
                score,
                metadata: {
                    'accessInfo.source': ['bmwk'],
                    'accessInfo.download.itemType': ['webpage'],
                    'application': ['HTML'],
                    'sourceType': ['Web'],
                    'file.name': [filename],
                    'file.extension': ['html'],
                    'accessInfo.lastModifiedDate': [now.toISOString()],
                    'title': [`BMWK - Sample Document ${i + 1}`, 'Opens in new window'],
                    'accessInfo.download.itemId': [`${baseUrl}/${path}/${filename}`],
                    'url': [`${baseUrl}/${path}/${filename}`],
                    'links': [
                        {
                            url: `doc.do?action=fetchdocument&id=${crypto.randomUUID()}`,
                            type: 'ACCESS',
                            listPosition: 0
                        }
                    ]
                }
            });
        }

        return passages;
    }

    /**
     * Process feedback
     * @param {string} uuid Client UUID
     * @param {string} feedback Feedback value
     * @returns {Object} Processing result
     */
    processFeedback(uuid, feedback) {
        if (!['thumbs_up', 'thumbs_down'].includes(feedback)) {
            return { error: 'Invalid feedback value' };
        }

        const client = this.activeClients.get(uuid);
        if (!client) {
            return { error: 'Client not found' };
        }

        // Update last activity
        client.lastActivity = new Date();

        // Store feedback (in a real system, this would be persisted)
        console.log(`Storing feedback for ${uuid}: ${feedback}`);

        return { success: true };
    }

    /**
     * Clean up inactive clients
     */
    cleanupInactiveClients() {
        const now = new Date();
        for (const [uuid, client] of this.activeClients.entries()) {
            if (now - client.lastActivity > 5 * 60 * 1000) { // 5 minutes
                this.activeClients.delete(uuid);
                console.log(`Removed inactive client: ${uuid}`);
            }
        }
    }

    /**
     * Validate UUID format
     * @param {string} uuid UUID to validate
     * @returns {boolean} Validation result
     */
    isValidUuid(uuid) {
        return Boolean(uuid && /^[\w-]+-[\w-]+$/.test(uuid));
    }
}

// Start cleanup interval
setInterval(() => {
    const backend = new RAGBackend();
    backend.cleanupInactiveClients();
}, 60 * 1000); // Check every minute