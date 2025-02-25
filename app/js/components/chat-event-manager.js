import { processMarkdown, initializeCodeCopyButtons } from '../markdown.js';
import { PassagesManager } from './passages-manager.js';

export class ChatEventManager {
    constructor(responseElement, currentResponse, messagesContainer, progressIndicator) {
        this.responseElement = responseElement;
        this.currentResponse = currentResponse;
        this.messagesContainer = messagesContainer;
        this.progressIndicator = progressIndicator;
        this.contentDiv = responseElement.querySelector('.message-content');
        this.fullResponse = '';
        this.passagesManager = null;
        this.onRelatedQuestionClick = null;
        this.createDocumentLink = null;
    }

    setupEventHandlers(eventSource, createDocumentLink) {
        this.createDocumentLink = createDocumentLink;
        this.passagesManager = new PassagesManager(this.responseElement, createDocumentLink);

        this.setupTelemetryHandler(eventSource);
        this.setupAnswerHandler(eventSource);
        this.setupPassagesHandler(eventSource);
        this.setupRelatedQuestionsHandler(eventSource);

        // Add observer to scroll to bottom when content changes
        const observer = new MutationObserver(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        });
        observer.observe(this.contentDiv, { childList: true, subtree: true });

        return observer;  // Return for cleanup if needed
    }

    setupTelemetryHandler(eventSource) {
        eventSource.addEventListener('telemetry', (event) => {
            const telemetryData = JSON.parse(event.data);
            this.progressIndicator.updateMetrics(telemetryData);
        });
    }

    setupAnswerHandler(eventSource) {
        eventSource.addEventListener('answer', (event) => {
            const answer = JSON.parse(event.data).answer;
            this.fullResponse += answer;
            
            // Process and render markdown content
            const processedContent = processMarkdown(this.fullResponse.trim());
            this.contentDiv.innerHTML = processedContent;
            this.contentDiv.classList.add('markdown-content');

            // Initialize code copy buttons and fix table rendering
            this.initializeContentFormatting();

            this.currentResponse.content = this.fullResponse.trim();
        });
    }

    setupPassagesHandler(eventSource) {
        eventSource.addEventListener('passages', (event) => {
            try {
                const passagesData = JSON.parse(event.data);
                this.currentResponse.passages = passagesData.passages;
                this.passagesManager.handlePassages(passagesData);
            } catch (error) {
                console.error('Error handling passages:', error);
            }
        });
    }

    setupRelatedQuestionsHandler(eventSource) {
        eventSource.addEventListener('related', (event) => {
            try {
                const relatedData = JSON.parse(event.data);
                this.currentResponse.relatedQuestions = relatedData.questions.related_questions;
                
                const relatedContainer = this.responseElement.querySelector('.related-questions');
                relatedContainer.innerHTML = '';
                
                const template = document.getElementById('related-question-template');
                this.currentResponse.relatedQuestions.forEach(question => {
                    const element = template.content.cloneNode(true).querySelector('.related-question');
                    element.querySelector('.question-text').textContent = question;
                    element.addEventListener('click', () => this.onRelatedQuestionClick?.(question));
                    relatedContainer.appendChild(element);
                });
            } catch (error) {
                console.error('Error handling related questions:', error);
            }
        });
    }

    initializeContentFormatting() {
        // Initialize code copy buttons
        initializeCodeCopyButtons(this.contentDiv);

        // Fix table rendering
        this.contentDiv.querySelectorAll('table').forEach(table => {
            if (!table.parentElement.classList.contains('table-container')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-container';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
                table.classList.add('markdown-table');
            }
        });
    }

    setRelatedQuestionCallback(callback) {
        this.onRelatedQuestionClick = callback;
    }

    cleanup(observer) {
        if (observer) {
            observer.disconnect();
        }
    }
}