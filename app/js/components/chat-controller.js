import { ProgressIndicator } from './progress-indicator.js';
import { ChatEventManager } from './chat-event-manager.js';

export class ChatController {
    constructor(client, messageManager, statusManager, inputManager) {
        this.client = client;
        this.messageManager = messageManager;
        this.statusManager = statusManager;
        this.inputManager = inputManager;
        this.chatHistory = [];
        this.eventSource = null;
        this.currentRequestUuid = null;
        this.isWaitingForResponse = false;
    }

    async sendMessage(message = null) {
        if (this.isWaitingForResponse) return;
        
        const question = message || this.inputManager.getValue();
        if (!question) return;
        
        try {
            this.isWaitingForResponse = true;
            this.inputManager.setDisabled(true);
            
            // Create and append message elements
            const [messageElement, responseElement] = [
                this.messageManager.createMessage(question, true),
                this.messageManager.createMessage('', false)
            ];
            this.messageManager.appendMessages([messageElement, responseElement]);
            
            // Setup progress indicator
            const progressIndicator = new ProgressIndicator();
            const contentDiv = responseElement.querySelector('.message-content');
            contentDiv.innerHTML = '';
            contentDiv.appendChild(progressIndicator.createElements());
            
            // Initialize request
            this.currentRequestUuid = `ifs-ai-assistant-answer-${crypto.randomUUID()}`;
            this.statusManager.setConnecting();
            
            // Register client and clear input
            this.eventSource = await this.client.registerClient(this.currentRequestUuid);
            if (!message) {
                this.inputManager.clear();
            }

            // Setup response tracking
            const currentResponse = {
                timestamp: new Date().toISOString(),
                type: 'response',
                content: '',
                relatedQuestions: [],
                feedback: null
            };
            this.chatHistory.push(currentResponse);

            // Setup event handlers
            const eventManager = new ChatEventManager(
                responseElement,
                currentResponse,
                this.messageManager.container,
                progressIndicator
            );
            const observer = eventManager.setupEventHandlers(this.eventSource, this.openDocument);
            eventManager.setRelatedQuestionCallback((text) => this.sendMessage(text));

            this.setupErrorHandler(eventManager, observer);
            this.setupCompletionHandler(eventManager, observer, progressIndicator);

            // Send the question
            await this.client.askQuestion(this.currentRequestUuid, question, this.getQuestionOptions());

        } catch (error) {
            console.error('Error sending message:', error);
            this.messageManager.showError(error.message);
            this.resetState();
        }
    }

    setupErrorHandler(eventManager, observer) {
        this.eventSource.addEventListener('error', async () => {
            if (this.isWaitingForResponse && this.eventSource) {
                this.statusManager.setError('connection_error');
                this.messageManager.showError('Failed to get response');
                await this.cleanup(eventManager, observer);
            }
        });
    }

    setupCompletionHandler(eventManager, observer, progressIndicator) {
        this.eventSource.addEventListener('complete', async () => {
            if (this.eventSource) {
                await this.cleanup(eventManager, observer);
                progressIndicator.complete();
            }
        });
    }

    async cleanup(eventManager, observer) {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            await this.client.stopClient(this.currentRequestUuid);
        }
        this.resetState();
        eventManager?.cleanup(observer);
    }

    resetState() {
        this.isWaitingForResponse = false;
        this.inputManager.setDisabled(false);
        this.statusManager.setReady();
    }

    async stop() {
        this.statusManager.setStopping();
        
        const currentProgressIndicator = document.querySelector('.progress-container');
        if (currentProgressIndicator) {
            currentProgressIndicator.remove();
        }
            
        if (this.eventSource) {
            const oldEventSource = this.eventSource;
            this.eventSource = null;
            oldEventSource.close();
            await this.client.stopClient(this.currentRequestUuid);
        }

        this.resetState();
    }

    async handleFeedback({ uuid, type }) {
        try {
            await this.client.submitFeedback(uuid, type);
            const lastResponse = this.chatHistory.findLast(entry => entry.type === 'response');
            if (lastResponse) {
                lastResponse.feedback = type;
            }
        } catch (error) {
            console.error('Error sending feedback:', error);
            this.messageManager.showError('Failed to send feedback');
        }
    }

    handleMessageAction(action, payload) {
        switch (action) {
            case 'send':
                this.sendMessage(payload);
                break;
            case 'feedback':
                this.handleFeedback(payload);
                break;
        }
    }

    getQuestionOptions() {
        return {
            searchMode: 'multiword',
            filter: this.expertMode?.parseFilters() || [],
            profileId: this.expertMode?.getSettings().profileId || 
                     (this.expertMode?.getSettings().profileName ? 
                        btoa(this.expertMode.getSettings().profileName) : undefined)
        };
    }

    setExpertMode(expertMode) {
        this.expertMode = expertMode;
    }

    setPDFManager(pdfManager) {
        this.pdfManager = pdfManager;
        // Update the document link creation function for use in responses
        this.openDocument = this.pdfManager.createDocumentLink.bind(this.pdfManager);
    }

    clearHistory() {
        this.chatHistory = [];
        this.messageManager.clearMessages();
    }

    exportHistory(assistantName) {
        return {
            assistant: assistantName,
            timestamp: new Date().toISOString(),
            history: this.chatHistory
        };
    }
}