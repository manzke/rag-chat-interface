import { processMarkdown, initializeCodeCopyButtons } from '../markdown.js';
import { PassagesManager } from './passages-manager.js';

export class ChatEventManager {
    constructor(responseElement, currentResponse, messagesContainer, progressIndicator) {
        this.responseElement = responseElement;
        this.currentResponse = currentResponse;
        this.messagesContainer = messagesContainer;
        this.progressIndicator = progressIndicator;
        this.contentDiv = responseElement.querySelector('.message-content');
        this.messageContent = document.createElement('div');
        this.messageContent.className = 'message-text';
        this.contentDiv.appendChild(this.progressIndicator.createElements());
        this.contentDiv.appendChild(this.messageContent);
        this.fullResponse = '';
        this.passagesManager = null;
        this.onRelatedQuestionClick = null;
        this.createDocumentLink = null;
        this.accumulatedTelemetry = {}; // Add a property to store accumulated telemetry data
        this.hasScrolledToAnswer = false;
        this.userHasScrolled = false;
    }

    setupEventHandlers(eventSource, createDocumentLink) {
        this.createDocumentLink = createDocumentLink;
        this.passagesManager = new PassagesManager(this.responseElement, createDocumentLink);

        this.setupTelemetryHandler(eventSource);
        this.setupAnswerHandler(eventSource);
        this.setupPassagesHandler(eventSource);
        this.setupRelatedQuestionsHandler(eventSource);
        
        // Track user scrolling to avoid interrupting their reading
        this.messagesContainer.addEventListener('scroll', () => {
            // If the user has scrolled down past the initial view, mark as user-scrolled
            const scrollPosition = this.messagesContainer.scrollTop;
            const containerHeight = this.messagesContainer.clientHeight;
            const initialViewThreshold = this.responseElement.offsetTop - containerHeight / 2;
            
            if (scrollPosition > initialViewThreshold) {
                this.userHasScrolled = true;
            }
        });

        // Only watch for DOM changes to check visibility
        const observer = new MutationObserver(() => {
            // Only scroll once when the answer section becomes visible
            // And only if user hasn't already scrolled down to read
            if (!this.hasScrolledToAnswer && this.messageContent.offsetHeight > 0 && !this.userHasScrolled) {
                this.scrollToAnswer();
                this.hasScrolledToAnswer = true;
            }
        });
        observer.observe(this.contentDiv, { childList: true, subtree: true });

        return observer;
    }

    scrollToAnswer() {
        const elementRect = this.responseElement.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.pageYOffset;
        const middle = absoluteElementTop - (window.innerHeight / 3);
        window.scrollTo({ top: middle, behavior: 'smooth' });
    }

    setupTelemetryHandler(eventSource) {
        eventSource.addEventListener('telemetry', (event) => {
            try {
                const telemetryData = JSON.parse(event.data);
                console.debug('Telemetry received:', telemetryData);
                
                // Initialize telemetry object if needed
                if (!this.currentResponse.telemetry) {
                    this.currentResponse.telemetry = {};
                }
                
                // Parse and get the actual telemetry object
                const newTelemetryData = JSON.parse(telemetryData.telemetry);
                
                // Deep merge the telemetry data
                this.currentResponse.telemetry = this.deepMerge(this.currentResponse.telemetry, newTelemetryData);
                
                // Update the progress indicator with the merged data
                this.progressIndicator.updateMetrics({
                    telemetry: this.currentResponse.telemetry,
                    completion: telemetryData.phase === 'final' ? 100 : 50
                });
                
                console.debug('Accumulated telemetry:', this.currentResponse.telemetry);
            } catch (error) {
                console.error('Error parsing telemetry:', error, event.data);
            }
        });
    }

    // Helper method for deep merging objects
    deepMerge(target, source) {
        const output = Object.assign({}, target);
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        
        return output;
    }

    isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }

    setupAnswerHandler(eventSource) {
        eventSource.addEventListener('answer', (event) => {
            const answer = JSON.parse(event.data).answer;
            this.fullResponse += answer;
            
            // Process and render markdown content
            const processedContent = processMarkdown(this.fullResponse.trim());
            this.messageContent.innerHTML = processedContent;
            this.messageContent.classList.add('markdown-content');

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
        initializeCodeCopyButtons(this.messageContent);

        // Fix table rendering
        this.messageContent.querySelectorAll('table').forEach(table => {
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