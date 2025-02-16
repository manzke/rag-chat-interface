import { client } from './rag-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Load active assistant
    const activeAssistant = JSON.parse(localStorage.getItem('activeAssistant'));
    if (!activeAssistant) {
        window.location.href = '/';
        return;
    }

    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    let docIds = urlParams.get('docIds') ?? activeAssistant.defaultConfig.docIds?.join(',');
    let profileName = urlParams.get('profileName') ?? activeAssistant.defaultConfig.profileName;
    let query = urlParams.get('query') ?? activeAssistant.defaultConfig.query;

    const isNewChat = urlParams.get('newChat') === 'true';

    // Set assistant name
    document.getElementById('assistant-name').textContent = activeAssistant.name;

    // Add back button handler
    document.getElementById('back-button').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Chat history storage
    let chatHistory = [];
    const messagesContainer = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    const appName = 'ifs-ai-assistant-answer';
    
    function generateUuid() {
        return `${appName}-${crypto.randomUUID()}`;
    }

    // Show welcome message if this is a new chat
    if (isNewChat && activeAssistant?.defaultConfig?.welcomeMessage) {
        const messageElement = createMessageElement(activeAssistant.defaultConfig.welcomeMessage, false);
        messagesContainer.appendChild(messageElement);
    }
    
    // Validate and encode profileId
    let profileId;
    try {
        profileId = urlParams.get('profileId');
        if (profileId) {
            // Validate that profileId is valid base64
            atob(profileId);
        } else if (profileName) {
            profileId = btoa(profileName);
        }
    } catch (e) {
        console.error('Invalid base64 profileId:', e);
        showError('Invalid profileId format');
    }

    let eventSource = null;
    let currentRequestUuid = null;

    function updateStatus(status, message) {
        statusIndicator.className = 'status-indicator ' + status;
        statusText.textContent = message;
    }

    function showCopyNotification() {
        const notification = document.createElement('div');
        notification.className = 'copy-success';
        notification.textContent = 'Copied to clipboard!';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }

    function createMessageElement(text, isUser = false) {
        const template = document.getElementById('message-template');
        const messageElement = template.content.cloneNode(true).querySelector('.message');
        
        messageElement.classList.add(isUser ? 'user-message' : 'assistant-message');
        const contentDiv = messageElement.querySelector('.message-content');
        contentDiv.textContent = text;

        // Show/hide appropriate buttons based on message type
        const editButton = messageElement.querySelector('.edit-button');
        const rerunButton = messageElement.querySelector('.rerun-button');
        const feedbackButtons = messageElement.querySelector('.message-footer');
        
        if (isUser) {
            feedbackButtons.style.display = 'none';
        } else {
            editButton.style.display = 'none';
            rerunButton.style.display = 'none';
        }

        // Add event listeners for buttons
        messageElement.querySelector('.copy-button').addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => showCopyNotification());
        });

        if (isUser) {
            editButton.addEventListener('click', () => {
                startEditing(messageElement, text);
            });

            rerunButton.addEventListener('click', () => {
                sendMessage(text);
            });
        } else {
            // Add feedback button listeners
            const thumbsUp = messageElement.querySelector('.thumbs-up');
            const thumbsDown = messageElement.querySelector('.thumbs-down');

            const messageUuid = generateUuid();
            messageElement.dataset.uuid = messageUuid;

            thumbsUp.addEventListener('click', () => {
                if (!thumbsUp.classList.contains('selected')) {
                    thumbsUp.classList.add('selected');
                    thumbsDown.classList.remove('selected');
                    sendFeedback('thumbs_up', messageUuid);
                }
            });

            thumbsDown.addEventListener('click', () => {
                if (!thumbsDown.classList.contains('selected')) {
                    thumbsDown.classList.add('selected');
                    thumbsUp.classList.remove('selected');
                    sendFeedback('thumbs_down', messageUuid);
                }
            });
        }

        return messageElement;
    }

    function startEditing(messageElement, text) {
        const contentDiv = messageElement.querySelector('.message-content');
        messageElement.classList.add('editing');

        // Create edit interface
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

        // Handle enter key
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const newText = textarea.value.trim();
                if (newText && newText !== text) {
                    sendMessage(newText);
                }
                finishEditing(messageElement, text);
            }
        });

        // Add event listeners
        editContainer.querySelector('.save-edit').addEventListener('click', () => {
            const newText = textarea.value.trim();
            if (newText && newText !== text) {
                sendMessage(newText);
            }
            finishEditing(messageElement, text);
        });

        editContainer.querySelector('.cancel-edit').addEventListener('click', () => {
            finishEditing(messageElement, text);
        });
    }

    function finishEditing(messageElement, originalText) {
        const contentDiv = messageElement.querySelector('.message-content');
        messageElement.classList.remove('editing');
        contentDiv.textContent = originalText;
    }

    async function sendFeedback(feedback, uuid) {
        try {
            await client.submitFeedback(uuid, feedback);

            // Update feedback in chat history
            const lastResponse = chatHistory.findLast(entry => entry.type === 'response');
            if (lastResponse) {
                lastResponse.feedback = feedback;
            }
        } catch (error) {
            console.error('Error sending feedback:', error);
            showError('Failed to send feedback');
        }
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
    }

    let isWaitingForResponse = false;

    async function sendMessage(message = null) {
        // If we're in stopping mode, stop the current request
        if (isWaitingForResponse) {
            updateStatus('', 'Stopping...');
            
            // Stop the current request and clean up
            if (eventSource) {
                await client.stopClient(currentRequestUuid);
                eventSource = null;
            }
            
            sendButton.classList.remove('stopping');
            sendButton.disabled = false;
            isWaitingForResponse = false;
            disableInput(false);
            updateStatus('', 'Ready');
            return;
        }

        const messageText = message || userInput.value.trim();
        if (!messageText) return;

        if (!message) {
            userInput.value = '';
        }

        const messageElement = createMessageElement(messageText, true);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Generate new UUID for this request
        const requestUuid = generateUuid();
        currentRequestUuid = requestUuid;
        
        // Update button to show stop state
        sendButton.classList.add('stopping');
        sendButton.disabled = false;
        isWaitingForResponse = true;

        if (eventSource) {
            await client.stopClient(currentRequestUuid);
        }

        // Get expert mode elements
        const expertDocIds = document.getElementById('expert-docIds');
        const expertQuery = document.getElementById('expert-query');
        const expertProfileName = document.getElementById('expert-profileName');
        const expertProfileId = document.getElementById('expert-profileId');
        const expertFilters = document.getElementById('expert-filters');

        // Get parameters from expert mode
        let currentDocIds = expertDocIds?.value || docIds;
        let currentQuery = expertQuery?.value || query;
        let currentProfileName = expertProfileName?.value || profileName;
        let currentProfileId = expertProfileId?.value || profileId;
        
        if (currentProfileName && !currentProfileId) {
            currentProfileId = btoa(currentProfileName);
        }

        // Parse filters from expert mode or create default ones
        let filter;
        try {
            filter = JSON.parse(expertFilters?.value || '[]');
        } catch (e) {
            console.error('Invalid filters JSON:', e);
            filter = [];
            
            if (currentDocIds) {
                const docIds = currentDocIds.split(',').map(d => d.trim()).filter(d => d);
                if (docIds.length > 0) {
                    filter.push({
                        key: 'id.keyword',
                        values: docIds,
                        isNegated: false
                    });
                }
            }
            if (currentQuery) {
                filter.push({
                    key: 'query',
                    values: [currentQuery],
                    isNegated: false
                });
            }
        }

        // Add to chat history
        const historyEntry = {
            timestamp: new Date().toISOString(),
            type: 'question',
            content: messageText,
            parameters: {
                docIds: currentDocIds,
                query: currentQuery,
                profileName: currentProfileName,
                profileId: currentProfileId,
                filters: filter
            }
        };
        chatHistory.push(historyEntry);

        try {
            updateStatus('connecting', 'Connecting...');
            disableInput(true);

            // Create message element for response
            const responseElement = createMessageElement('', false);
            messagesContainer.appendChild(responseElement);
            const contentDiv = responseElement.querySelector('.message-content');

            // Register client and get event source
            eventSource = await client.registerClient(requestUuid);

            let currentResponse = {
                timestamp: new Date().toISOString(),
                type: 'response',
                content: '',
                relatedQuestions: [],
                feedback: null
            };
            chatHistory.push(currentResponse);

            // Set up event handlers
            let fullResponse = '';
            
            eventSource.addEventListener('answer', (event) => {
                console.log('Received answer event:', event);
                fullResponse += event.data + ' ';
                contentDiv.textContent = fullResponse.trim();
                currentResponse.content = fullResponse.trim();
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });

            eventSource.addEventListener('related', (event) => {
                console.log('Received related event:', event);
                try {
                    const relatedData = JSON.parse(event.data);
                    const relatedContainer = responseElement.querySelector('.related-questions');
                    
                    // Store in chat history
                    currentResponse.relatedQuestions = relatedData.questions;
                    
                    // Clear any existing related questions
                    relatedContainer.innerHTML = '';
                    
                    // Add new related questions
                    const template = document.getElementById('related-question-template');
                    relatedData.questions.forEach(question => {
                        const element = template.content.cloneNode(true).querySelector('.related-question');
                        element.querySelector('.question-text').textContent = question;
                        element.addEventListener('click', () => sendMessage(question));
                        relatedContainer.appendChild(element);
                    });
                } catch (error) {
                    console.error('Error parsing related questions:', error);
                }
            });

            eventSource.addEventListener('complete', async () => {
                console.log('Received complete event');
                await client.stopClient(requestUuid);
                if (eventSource) {
                    eventSource.close();
                    eventSource = null;
                }
                updateStatus('', 'Ready');
                sendButton.classList.remove('stopping');
                isWaitingForResponse = false;
                disableInput(false);

                // Log metrics
                console.log('Request metrics:', client.getMetrics());
            });

            eventSource.addEventListener('error', async (event) => {
                console.error('SSE connection error:', event);
                // Only call stopClient if we're not already stopping
                if (isWaitingForResponse) {
                    await client.stopClient(requestUuid);
                    updateStatus('error', 'Connection error');
                    sendButton.classList.remove('stopping');
                    isWaitingForResponse = false;
                    disableInput(false);
                    showError('Failed to get response');
                }
            });

            // Send the question
            await client.askQuestion(requestUuid, messageText, {
                searchMode: 'multiword',
                filter,
                profileId: currentProfileId
            });

        } catch (error) {
            console.error('Error sending message:', error);
            showError(error.message);
            sendButton.classList.remove('stopping');
            isWaitingForResponse = false;
            disableInput(false);
        }
    }

    // Set up input handlers
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendButton.addEventListener('click', () => {
        sendMessage();
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (currentRequestUuid) {
            client.stopClient(currentRequestUuid).catch(console.error);
        }
    });

    // Expert mode panel functionality
    const expertModeToggle = document.getElementById('expert-mode-toggle');
    const expertPanel = document.getElementById('expert-panel');
    const expertCancel = document.getElementById('expert-cancel');
    const expertSave = document.getElementById('expert-save');
    const expertFilters = document.getElementById('expert-filters');
    const expertDocIds = document.getElementById('expert-docIds');
    const expertQuery = document.getElementById('expert-query');
    const expertProfileName = document.getElementById('expert-profileName');
    const expertProfileId = document.getElementById('expert-profileId');

    // Initialize expert mode values
    expertDocIds.value = docIds || '';
    expertQuery.value = query || '';
    expertProfileName.value = profileName || '';
    expertProfileId.value = profileId || '';

    let savedExpertValues = {
        docIds: expertDocIds.value,
        query: expertQuery.value,
        profileName: expertProfileName.value,
        profileId: expertProfileId.value,
        filters: expertFilters.value
    };

    expertModeToggle.addEventListener('click', (e) => {
        e.stopPropagation();  // Prevent the click from bubbling up
        expertPanel.classList.toggle('show');
    });

    expertCancel.addEventListener('click', (e) => {
        e.stopPropagation();  // Prevent the click from bubbling up
        // Restore saved values
        expertDocIds.value = savedExpertValues.docIds;
        expertQuery.value = savedExpertValues.query;
        expertProfileName.value = savedExpertValues.profileName;
        expertProfileId.value = savedExpertValues.profileId;
        expertFilters.value = savedExpertValues.filters;
        
        expertPanel.classList.remove('show');
    });

    expertSave.addEventListener('click', (e) => {
        e.stopPropagation();  // Prevent the click from bubbling up
        // Validate filters JSON
        try {
            if (expertFilters.value) {
                JSON.parse(expertFilters.value);
            }
            // Save values
            savedExpertValues = {
                docIds: expertDocIds.value,
                query: expertQuery.value,
                profileName: expertProfileName.value,
                profileId: expertProfileId.value,
                filters: expertFilters.value
            };
            expertPanel.classList.remove('show');
            expertPanel.querySelector('.error-message').style.display = 'none';
        } catch (e) {
            expertPanel.querySelector('.error-message').style.display = 'block';
        }
    });

    // Prevent clicks inside the panel from closing it
    expertPanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Handle clicks outside the panel to close it
    document.addEventListener('click', () => {
        expertPanel.classList.remove('show');
    });

    // Reset button functionality
    const resetButton = document.getElementById('reset-button');
    resetButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the chat?')) {
            messagesContainer.innerHTML = '';
            chatHistory = [];
            if (isNewChat && activeAssistant?.defaultConfig?.welcomeMessage) {
                const messageElement = createMessageElement(activeAssistant.defaultConfig.welcomeMessage, false);
                messagesContainer.appendChild(messageElement);
            }
        }
    });

    // Export button functionality
    const exportButton = document.getElementById('export-button');
    exportButton.addEventListener('click', () => {
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

    // Initialize status
    updateStatus('', 'Ready');
});