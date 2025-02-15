import { jest } from '@jest/globals';
import { HTTPRAGApi, WebSocketRAGApi, createRAGApi } from '../rag-api.js';

describe('RAG API Tests', () => {
    let api;
    const mockUuid = 'client-123456789';
    const baseUrl = 'http://localhost:53708';

    beforeEach(() => {
        // Create a new API instance before each test
        api = new HTTPRAGApi(baseUrl);
        
        // Mock fetch
        global.fetch = jest.fn();
        
        // Mock EventSource
        global.EventSource = jest.fn().mockImplementation(() => ({
            addEventListener: jest.fn()
        }));
    });

    afterEach(() => {
        // Clean up after each test
        jest.clearAllMocks();
    });

    describe('HTTP Implementation', () => {
        test('registerClient creates EventSource with correct URL', async () => {
            await api.registerClient(mockUuid);
            
            expect(EventSource).toHaveBeenCalledWith(
                `${baseUrl}/api/v2/rag/register-client?uuid=${mockUuid}`
            );
        });

        test('stopClient sends request to correct endpoint', async () => {
            global.fetch.mockResolvedValueOnce({ ok: true });
            
            await api.stopClient(mockUuid);
            
            expect(fetch).toHaveBeenCalledWith(
                `${baseUrl}/api/v2/rag/stop?uuid=${mockUuid}`
            );
        });

        test('submitFeedback sends correct payload', async () => {
            global.fetch.mockResolvedValueOnce({ ok: true });
            const feedback = 'thumbs_up';
            
            await api.submitFeedback(mockUuid, feedback);
            
            expect(fetch).toHaveBeenCalledWith(
                `${baseUrl}/api/v2/rag/feedback?uuid=${mockUuid}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ feedback })
                }
            );
        });

        test('askQuestion sends correct payload with options', async () => {
            global.fetch.mockResolvedValueOnce({ ok: true });
            const question = 'What is RAG?';
            const options = {
                searchMode: 'semantic',
                profileId: 'base64-profile',
                filter: [{ key: 'id.keyword', values: ['doc1'] }]
            };
            
            await api.askQuestion(mockUuid, question, options);
            
            expect(fetch).toHaveBeenCalledWith(
                `${baseUrl}/api/v2/rag/ask?uuid=${mockUuid}&sSearchMode=semantic&sSearchDistance=`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question,
                        profileId: options.profileId,
                        filter: options.filter
                    })
                }
            );
        });

        test('handles error responses correctly', async () => {
            const errorMessage = 'Invalid UUID format';
            global.fetch.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ error: errorMessage })
            });
            
            await expect(api.stopClient(mockUuid)).rejects.toThrow(errorMessage);
        });
    });

    describe('Factory Function', () => {
        test('creates HTTP implementation', () => {
            const api = createRAGApi('http', baseUrl);
            expect(api).toBeInstanceOf(HTTPRAGApi);
        });

        test('creates WebSocket implementation', () => {
            const api = createRAGApi('ws', 'ws://localhost:53708');
            expect(api).toBeInstanceOf(WebSocketRAGApi);
        });

        test('throws error for unsupported protocol', () => {
            expect(() => createRAGApi('ftp', baseUrl)).toThrow('Unsupported protocol');
        });
    });

    describe('Middleware', () => {
        test('validates UUID format', async () => {
            await expect(api.registerClient('invalid-uuid')).rejects.toThrow('Invalid UUID format');
        });

        test('validates feedback value', async () => {
            await expect(api.submitFeedback(mockUuid, 'invalid')).rejects.toThrow('Invalid feedback value');
        });

        test('validates question presence', async () => {
            await expect(api.askQuestion(mockUuid, '')).rejects.toThrow('Question is required');
        });

        test('retries on network errors', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'))
                       .mockResolvedValueOnce({ ok: true });
            
            await api.stopClient(mockUuid);
            
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        test('logs request information', async () => {
            const consoleSpy = jest.spyOn(console, 'info');
            global.fetch.mockResolvedValueOnce({ ok: true });
            
            await api.stopClient(mockUuid);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                '[stopClient] Request started',
                expect.any(Object)
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                '[stopClient] Request completed',
                expect.any(Object)
            );
        });
    });
});