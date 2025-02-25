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
    }

    setupEventHandlers(eventSource, openDocument) {
        this.passagesManager = new PassagesManager(this.responseElement, openDocument);
        
        eventSource.addEventListener('telemetry', (event) => {
            const telemetryData = JSON.parse(event.data);
            this.progressIndicator.updateMetrics(telemetryData);
        });

        eventSource.addEventListener('answer', (event) => {
            const answer = JSON.parse(event.data).answer;
            this.fullResponse += answer;
            
            // Process and render markdown content
            const processedContent = processMarkdown(this.fullResponse.trim());
            this.contentDiv.innerHTML = processedContent;
            this.contentDiv.classList.add('markdown-content');

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

            this.currentResponse.content = this.fullResponse.trim();
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        });

        eventSource.addEventListener('passages', (event) => {
            const passagesData = JSON.parse(event.data);
            this.currentResponse.passages = passagesData.passages;
            this.passagesManager.handlePassages(passagesData);
        });

        eventSource.addEventListener('related', (event) => {
            const relatedData = JSON.parse(event.data);
            this.currentResponse.relatedQuestions = relatedData.questions.related_questions;
            
            const relatedContainer = this.responseElement.querySelector('.related-questions');
            relatedContainer.innerHTML = '';
            
            const template = document.getElementById('related-question-template');
            this.currentResponse.relatedQuestions.forEach(question => {
                const element = template.content.cloneNode(true).querySelector('.related-question');
                element.querySelector('.question-text').textContent = question;
                element.addEventListener('click', () => {
                    // We'll inject the sendMessage function through a callback
                    this.onRelatedQuestionClick?.(question);
                });
                relatedContainer.appendChild(element);
            });
        });
    }

    setRelatedQuestionCallback(callback) {
        this.onRelatedQuestionClick = callback;
    }
}