// Import polyfills first
import './polyfills.js';

// Import CSS
import '../css/index.css';
import '../css/chat.css';
import '../css/mobile.css';
import '../css/progress-indicator.css';

// Import modules
import { client } from './rag-client.js';
import { createPDFViewer } from './pdf-viewer.js';
import { initializeMobileMenu } from './mobile-menu.js';
import { initializeVoiceInput } from './voice-input.js';
import i18n from './i18n.js';
import { getRelativeTime, getAbsoluteTime, isDifferentDay, getDateSeparatorText } from './utils/time.js';
import { ProgressIndicator } from './components/progress-indicator.js';
import { ExpertMode } from './components/expert-mode.js';
import { ChatEventManager } from './components/chat-event-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n and features
    await i18n.init();
    i18n.translatePage();
    initializeMobileMenu();
    initializeVoiceInput();

    // Load active assistant
    const activeAssistant = JSON.parse(localStorage.getItem('activeAssistant'));
    if (!activeAssistant) {
        window.location.href = '/';
        return;
    }

    // Parse URL parameters and initialize expert mode
    const urlParams = new URLSearchParams(window.location.search);
    const expertMode = new ExpertMode({
        docIds: urlParams.get('docIds') ?? activeAssistant.defaultConfig.docIds?.join(','),
        profileName: urlParams.get('profileName') ?? activeAssistant.defaultConfig.profileName,
        query: urlParams.get('query') ?? activeAssistant.defaultConfig.query,
        filters: urlParams.get('filters') ?? JSON.stringify(activeAssistant.defaultConfig.filters || [])
    });

    // Set assistant name
    const currentLang = i18n.getCurrentLanguage();
    const assistantName = typeof activeAssistant.name === 'string' 
        ? activeAssistant.name 
        : activeAssistant.defaultConfig.name[currentLang] || activeAssistant.defaultConfig.name.en;
    document.getElementById('assistant-name').textContent = assistantName;

    // Initialize UI elements
    const messagesContainer = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    let chatHistory = [];
    let eventSource = null;
    let currentRequestUuid = null;
    let isWaitingForResponse = false;

    // Set up handlers
    setupBackButton();
    setupWelcomeMessage();
    setupInputHandlers();
    setupExportButton();
    setupResetButton();

    // Make PDF handler globally available
    window.handlePDFLink = (url) => {
        const viewer = createPDFViewer(url);
        document.body.appendChild(viewer);
    };

    function setupBackButton() {
        document.getElementById('back-button').addEventListener('click', () => {
            const currentParams = new URLSearchParams(window.location.search);
            const mode = currentParams.get('mode');
            
            if (mode === 'widget') {
                window.parent.postMessage({ 
                    type: 'navigate',
                    url: `index.html?${currentParams.toString()}`
                }, '*');
            } else {
                window.location.href = `index.html?${currentParams.toString()}`;
            }
        });
    }

    function setupWelcomeMessage() {
        const isNewChat = urlParams.get('newChat') === 'true';
        if (isNewChat && activeAssistant?.defaultConfig?.welcomeMessage) {
            const welcomeMessage = typeof activeAssistant.defaultConfig.welcomeMessage === 'string'
                ? activeAssistant.defaultConfig.welcomeMessage
                : activeAssistant.defaultConfig.welcomeMessage[currentLang] || 
                  activeAssistant.defaultConfig.welcomeMessage.en;
            
            const messageElement = createMessageElement(welcomeMessage, false, true);
            messagesContainer.appendChild(messageElement);
        }
    }

    function setupInputHandlers() {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendButton.addEventListener('click', () => sendMessage());
        stopButton.addEventListener('click', () => stop());

        window.addEventListener('beforeunload', () => {
            if (currentRequestUuid && eventSource) {
                client.stopClient(currentRequestUuid).catch(console.error);
            }
        });
    }

    function setupExportButton() {
        document.getElementById('export-button').addEventListener('click', () => {
            const exportData = {
                assistant: activeAssistant.name,
                timestamp: new Date().toISOString(),
                history: chatHistory
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-export-${new Date().toISOString()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    function setupResetButton() {
        document.getElementById('reset-button').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the chat?')) {
                messagesContainer.innerHTML = '';
                chatHistory = [];
                if (urlParams.get('newChat') === 'true' && activeAssistant?.defaultConfig?.welcomeMessage) {
                    const messageElement = createMessageElement(activeAssistant.defaultConfig.welcomeMessage, false);
                    messagesContainer.appendChild(messageElement);
                }
            }
        });
    }

    function updateStatus(status, messageKey) {
        statusIndicator.className = 'status-indicator ' + status;
        statusText.textContent = i18n.t(`chat.status.${messageKey}`);
    }

    function openDocument(url, title, isPDF) {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes("doc.do")) {
            isPDF = true;
            url = "/" + url;
        }
        if (isPDF) {
            return `<a href="javascript:void(0)" 
                        onclick="handlePDFLink('${url}')" 
                        class="document-link">
                        ${title || 'View document'}
                        <i class="fas fa-external-link-alt"></i>
                    </a>`;
        } else {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">
                    ${title || 'Open document'}
                    <i class="fas fa-external-link-alt"></i>
                </a>`;
        }
    }

    function showCopyNotification() {
        const notification = document.createElement('div');
        notification.className = 'copy-success';
        notification.textContent = i18n.t('chat.feedback.copied');
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }

    function createMessageElement(text, isUser = false, isWelcome = false) {
        const template = document.getElementById('message-template');
        const messageElement = template.content.cloneNode(true).querySelector('.message');
        
        messageElement.classList.add(isUser ? 'user-message' : 'assistant-message');
        const contentDiv = messageElement.querySelector('.message-content');
        contentDiv.textContent = text;

        addTimestamp(messageElement);
        setupMessageButtons(messageElement, text, isUser);
        
        if (isUser || isWelcome) {
            messageElement.querySelector('.message-sources').style.display = 'none';
        }

        return messageElement;
    }

    function addTimestamp(messageElement) {
        const now = new Date();
        const timestamp = messageElement.querySelector('.message-timestamp time');
        timestamp.setAttribute('datetime', now.toISOString());
        timestamp.textContent = getRelativeTime(now);
        timestamp.parentElement.setAttribute('title', getAbsoluteTime(now));

        const lastMessage = messagesContainer.lastElementChild;
        if (lastMessage) {
            const lastTimestamp = lastMessage.querySelector('time')?.getAttribute('datetime');
            if (lastTimestamp && isDifferentDay(lastTimestamp, now)) {
                addDateSeparator(now);
            }
        } else {
            addDateSeparator(now);
        }

        setInterval(() => {
            timestamp.textContent = getRelativeTime(timestamp.getAttribute('datetime'));
        }, 60000);
    }

    function addDateSeparator(date) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        separator.innerHTML = `<span>${getDateSeparatorText(date)}</span>`;
        messagesContainer.appendChild(separator);
    }

    function setupMessageButtons(messageElement, text, isUser) {
        const copyButton = messageElement.querySelector('.copy-button');
        const editButton = messageElement.querySelector('.edit-button');
        const rerunButton = messageElement.querySelector('.rerun-button');
        const feedbackButtons = messageElement.querySelector('.message-footer');
        
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => showCopyNotification());
        });

        if (isUser) {
            feedbackButtons.style.display = 'none';
            setupUserMessageButtons(messageElement, text, editButton, rerunButton);
        } else {
            editButton.style.display = 'none';
            rerunButton.style.display = 'none';
            setupFeedbackButtons(messageElement);
        }
    }

    function setupUserMessageButtons(messageElement, text, editButton, rerunButton) {
        const startEditing = () => {
            messageElement.classList.add('editing');
            const contentDiv = messageElement.querySelector('.message-content');
            const editContainer = document.createElement('div');
            editContainer.innerHTML = `
                <textarea class="edit-textarea">${text}</textarea>
                <div class="edit-actions">
                    <button class="cancel-edit"><i class="fas fa-times"></i></button>
                    <button class="save-edit"><i class="fas fa-paper-plane"></i></button>
                </div>
            `;
            contentDiv.innerHTML = '';
            contentDiv.appendChild(editContainer);

            const textarea = editContainer.querySelector('textarea');
            textarea.focus();
            textarea.setSelectionRange(text.length, text.length);

            const finishEditing = () => {
                messageElement.classList.remove('editing');
                contentDiv.textContent = text;
            };

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const newText = textarea.value.trim();
                    if (newText && newText !== text) {
                        sendMessage(newText);
                    }
                    finishEditing();
                }
            });

            editContainer.querySelector('.save-edit').addEventListener('click', () => {
                const newText = textarea.value.trim();
                if (newText && newText !== text) {
                    sendMessage(newText);
                }
                finishEditing();
            });

            editContainer.querySelector('.cancel-edit').addEventListener('click', finishEditing);
        };

        editButton.addEventListener('click', startEditing);
        rerunButton.addEventListener('click', () => sendMessage(text));
    }

    function setupFeedbackButtons(messageElement) {
        const thumbsUp = messageElement.querySelector('.thumbs-up');
        const thumbsDown = messageElement.querySelector('.thumbs-down');
        const messageUuid = `ifs-ai-assistant-answer-${crypto.randomUUID()}`;
        messageElement.dataset.uuid = messageUuid;

        const sendFeedback = async (feedback) => {
            try {
                await client.submitFeedback(messageUuid, feedback);
                const lastResponse = chatHistory.findLast(entry => entry.type === 'response');
                if (lastResponse) {
                    lastResponse.feedback = feedback;
                }
            } catch (error) {
                console.error('Error sending feedback:', error);
                showError('Failed to send feedback');
            }
        };

        thumbsUp.addEventListener('click', () => {
            if (!thumbsUp.classList.contains('selected')) {
                thumbsUp.classList.add('selected');
                thumbsDown.classList.remove('selected');
                sendFeedback('thumbs_up');
            }
        });

        thumbsDown.addEventListener('click', () => {
            if (!thumbsDown.classList.contains('selected')) {
                thumbsDown.classList.add('selected');
                thumbsUp.classList.remove('selected');
                sendFeedback('thumbs_down');
            }
        });
    }

    function showError(message) {
        updateStatus('error', message);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant-message';
        errorDiv.textContent = `Error: ${message}`;
        messagesContainer.appendChild(errorDiv);
    }

    function disableInput(disabled) {
        userInput.disabled = disabled;
        sendButton.disabled = disabled;
        sendButton.style.display = disabled ? 'none' : 'flex';
        stopButton.disabled = !disabled;
        stopButton.style.display = disabled ? 'flex' : 'none';
    }

    async function stop() {
        updateStatus('', 'stopping');
        isWaitingForResponse = false;
        disableInput(false);
            
        if (eventSource) {
            eventSource = null;
            await client.stopClient(currentRequestUuid);
            updateStatus('', 'ready');
        }
    }

    async function sendMessage(message = null) {
        if (isWaitingForResponse) return;
        
        const question = message || userInput.value.trim();
        if (!question) return;
        
        try {
            isWaitingForResponse = true;
            disableInput(true);
            
            // Create message elements
            const messageElement = createMessageElement(question, true);
            const responseElement = createMessageElement('', false);
            messagesContainer.appendChild(messageElement);
            messagesContainer.appendChild(responseElement);
            
            // Setup progress indicator
            const progressIndicator = new ProgressIndicator();
            const contentDiv = responseElement.querySelector('.message-content');
            contentDiv.innerHTML = '';
            contentDiv.appendChild(progressIndicator.createElements());
            
            // Initialize request
            const requestUuid = `ifs-ai-assistant-answer-${crypto.randomUUID()}`;
            currentRequestUuid = requestUuid;
            updateStatus('connecting', 'connecting');
            
            // Register client and clear input
            eventSource = await client.registerClient(requestUuid);
            if (!message) {
                userInput.value = '';
            }

            // Setup response tracking
            const currentResponse = {
                timestamp: new Date().toISOString(),
                type: 'response',
                content: '',
                relatedQuestions: [],
                feedback: null
            };
            chatHistory.push(currentResponse);

            // Setup event handlers
            const eventManager = new ChatEventManager(
                responseElement,
                currentResponse,
                messagesContainer,
                progressIndicator
            );
            eventManager.setupEventHandlers(eventSource, openDocument);
            eventManager.setRelatedQuestionCallback(sendMessage);

            // Setup error handler
            eventSource.addEventListener('error', async () => {
                if (isWaitingForResponse && eventSource) {
                    updateStatus('error', 'Connection error');
                    isWaitingForResponse = false;
                    disableInput(false);
                    showError('Failed to get response');
                    await client.stopClient(requestUuid);
                }
            });

            // Setup completion handler
            eventSource.addEventListener('complete', async () => {
                if (eventSource) {
                    eventSource.close();
                    eventSource = null;
                }
                await client.stopClient(requestUuid);
                updateStatus('', 'ready');
                isWaitingForResponse = false;
                disableInput(false);
            });

            // Send the question
            await client.askQuestion(requestUuid, question, {
                searchMode: 'multiword',
                filter: expertMode.parseFilters(),
                profileId: expertMode.getSettings().profileId || 
                         (expertMode.getSettings().profileName ? 
                            btoa(expertMode.getSettings().profileName) : undefined)
            });

        } catch (error) {
            console.error('Error sending message:', error);
            showError(error.message);
            isWaitingForResponse = false;
            disableInput(false);
        }
    }

    // Initialize status
    updateStatus('', 'ready');
});