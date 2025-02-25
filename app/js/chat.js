// Import polyfills first
import './polyfills.js';

// Import CSS
import '../css/index.css';
import '../css/chat.css';
import '../css/mobile.css';

// Import modules
import { client } from './rag-client.js';
import { processMarkdown, initializeCodeCopyButtons } from './markdown.js';
import { createPDFViewer } from './pdf-viewer.js';
import { initializeMobileMenu } from './mobile-menu.js';
import { initializeVoiceInput } from './voice-input.js';
import i18n from './i18n.js';
import { getRelativeTime, getAbsoluteTime, isDifferentDay, getDateSeparatorText } from './utils/time.js';
import { ProgressIndicator } from './components/progress-indicator.js';

// Import additional CSS
import '../css/progress-indicator.css';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n
    await i18n.init();
    i18n.translatePage();

    // Initialize mobile menu
    initializeMobileMenu();
    
    // Initialize voice input
    initializeVoiceInput();
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
    let filters = urlParams.get('filters') ?? JSON.stringify(activeAssistant.defaultConfig.filters || []);

    const isNewChat = urlParams.get('newChat') === 'true';

    // Set expert mode fields with URL parameters if they exist
    if (docIds) {
        document.getElementById('expert-docIds').value = docIds;
    }
    if (query) {
        document.getElementById('expert-query').value = query;
    }
    if (profileName) {
        document.getElementById('expert-profileName').value = profileName;
    }
    if (filters) {
        document.getElementById('expert-filters').value = filters;
    }

    // Set assistant name with translation
    const currentLang = i18n.getCurrentLanguage();
    let assistantName;
    if (typeof activeAssistant.name === 'string') {
        // Handle case where message is already a string (old format)
        assistantName = activeAssistant.name;
    } else {
        // Handle new i18n format
        assistantName = activeAssistant.defaultConfig.name[currentLang] || 
                       activeAssistant.defaultConfig.name.en;
    }
    document.getElementById('assistant-name').textContent = assistantName;

    // Add back button handler
    document.getElementById('back-button').addEventListener('click', () => {
        // Keep all current query parameters when going back
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

    // Chat history storage
    let chatHistory = [];
    const messagesContainer = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    const appName = 'ifs-ai-assistant-answer';
    
    function generateUuid() {
        return `${appName}-${crypto.randomUUID()}`;
    }

    // Show welcome message if this is a new chat
    console.log('Checking welcome message conditions:', {
        isNewChat,
        activeAssistant,
        welcomeMessage: activeAssistant?.defaultConfig?.welcomeMessage
    });
    
    if (isNewChat && activeAssistant?.defaultConfig?.welcomeMessage) {
        const currentLang = i18n.getCurrentLanguage();
        console.log('Welcome message language:', {
            currentLang,
            availableMessages: activeAssistant.defaultConfig.welcomeMessage
        });
        
        let welcomeMessage;
        if (typeof activeAssistant.defaultConfig.welcomeMessage === 'string') {
            // Handle case where message is already a string (old format)
            welcomeMessage = activeAssistant.defaultConfig.welcomeMessage;
        } else {
            // Handle new i18n format
            welcomeMessage = activeAssistant.defaultConfig.welcomeMessage[currentLang] || 
                           activeAssistant.defaultConfig.welcomeMessage.en;
        }
        
        console.log('Final welcome message:', welcomeMessage);
        const messageElement = createMessageElement(welcomeMessage, false, true);
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

    function updateStatus(status, messageKey) {
        statusIndicator.className = 'status-indicator ' + status;
        statusText.textContent = i18n.t(`chat.status.${messageKey}`);
    }

    // Make PDF handler globally available
    window.handlePDFLink = function(url) {
        const viewer = createPDFViewer(url);
        document.body.appendChild(viewer);
    }

    function openDocument(url, title, isPDF) {
        const lowerUrl = url.toLowerCase();
        console.log(`Opening document: ${lowerUrl} isPDF: ${isPDF}`);
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
                            </a>`
        } else {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">
                        ${title || 'Open document'}
                        <i class="fas fa-external-link-alt"></i>
                    </a>`
        }
    };

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

        // Add timestamp
        const now = new Date();
        const timestamp = messageElement.querySelector('.message-timestamp time');
        timestamp.setAttribute('datetime', now.toISOString());
        timestamp.textContent = getRelativeTime(now);
        timestamp.parentElement.setAttribute('title', getAbsoluteTime(now));

        // Check if we need to add a date separator
        const lastMessage = messagesContainer.lastElementChild;
        if (lastMessage) {
            const lastTimestamp = lastMessage.querySelector('time')?.getAttribute('datetime');
            if (lastTimestamp && isDifferentDay(lastTimestamp, now)) {
                const separator = document.createElement('div');
                separator.className = 'date-separator';
                separator.innerHTML = `<span>${getDateSeparatorText(now)}</span>`;
                messagesContainer.appendChild(separator);
            }
        } else if (!isWelcome) {
            // First message (not welcome message), add today's separator
            const separator = document.createElement('div');
            separator.className = 'date-separator';
            separator.innerHTML = `<span>${getDateSeparatorText(now)}</span>`;
            messagesContainer.appendChild(separator);
        }

        // Update timestamps periodically
        const updateTimestamp = () => {
            timestamp.textContent = getRelativeTime(timestamp.getAttribute('datetime'));
        };
        setInterval(updateTimestamp, 60000); // Update every minute
        
        // Hide sources section for welcome messages and user messages
        if (isUser || isWelcome) {
            const sourcesSection = messageElement.querySelector('.message-sources');
            sourcesSection.style.display = 'none';
        }

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
        sendButton.style.display = disabled ? 'none' : 'flex';
        stopButton.disabled = !disabled;
        stopButton.style.display = disabled ? 'flex' : 'none';
    }

    let isWaitingForResponse = false;

    async function stop() {
        updateStatus('', 'stopping');
        isWaitingForResponse = false;
        disableInput(false);
            
        // Stop the current request and clean up
        if (eventSource) {
            eventSource = null;
            await client.stopClient(currentRequestUuid);

            updateStatus('', 'ready');
            return;
        }
    }

    async function sendMessage(message = null) {
        if (isWaitingForResponse) return;
        
        const question = message || userInput.value.trim();
        if (!question) return;
        
        try {
            isWaitingForResponse = true;
            disableInput(true);
            
            // Create user message element
            const messageElement = createMessageElement(question, true);
            messagesContainer.appendChild(messageElement);
            const responseElement = createMessageElement('', false);
            messagesContainer.appendChild(responseElement);
            const contentDiv = responseElement.querySelector('.message-content');
            
            // Create progress indicator
            const progressIndicator = new ProgressIndicator();
            const progressContainer = progressIndicator.createElements();
            contentDiv.innerHTML = '';
            contentDiv.appendChild(progressContainer);
            
            const requestUuid = generateUuid();
            currentRequestUuid = requestUuid;  // Store for cleanup
            updateStatus('connecting', 'connecting');

            // Get current expert mode settings
            const expertSettings = {
                docIds: expertElements.docIds.value,
                query: expertElements.query.value,
                profileName: expertElements.profileName.value,
                profileId: expertElements.profileId.value,
                filters: expertElements.filters.value
            };

            // Parse filters JSON and merge with docIds and query
            let parsedFilters = [];
            try {
                if (expertSettings.filters) {
                    parsedFilters = JSON.parse(expertSettings.filters);
                }
                
                // Add docIds filter if present
                if (expertSettings.docIds) {
                    const docIds = expertSettings.docIds.split(',').map(id => id.trim()).filter(id => id);
                    if (docIds.length > 0) {
                        parsedFilters.push({
                            key: 'id.keyword',
                            values: docIds
                        });
                    }
                }

                // Add query filter if present
                if (expertSettings.query) {
                    parsedFilters.push({
                        key: 'query',
                        values: [expertSettings.query],
                        isNegated: false
                    });
                }
            } catch (e) {
                console.warn('Invalid filters JSON:', e);
            }
            
            // Register client and get event source
            eventSource = await client.registerClient(requestUuid);

            // Clear input after successful send
            if (!message) {
                userInput.value = '';
            }

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
            
            eventSource.addEventListener('telemetry', (event) => {
                const telemetryData = JSON.parse(event.data);
                progressIndicator.updateMetrics(telemetryData);
            });

            eventSource.addEventListener('answer', (event) => {
                updateStatus('receiving-answer', 'receiving');
                console.log('Received answer event:', event);
                const answer = JSON.parse(event.data).answer;
                fullResponse += answer;
                // Process and render markdown content
                const processedContent = processMarkdown(fullResponse.trim());
                contentDiv.innerHTML = processedContent;
                contentDiv.classList.add('markdown-content');

                // Initialize code copy buttons
                initializeCodeCopyButtons(contentDiv);

                // Fix table rendering
                contentDiv.querySelectorAll('table').forEach(table => {
                    if (!table.parentElement.classList.contains('table-container')) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'table-container';
                        table.parentNode.insertBefore(wrapper, table);
                        wrapper.appendChild(table);
                        table.classList.add('markdown-table');
                    }
                });
                currentResponse.content = fullResponse.trim();
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });

            // Handle passages event
            eventSource.addEventListener('passages', (event) => {
                updateStatus('receiving-passages', 'Passages...');
                console.log('Received passages event:', event);
                try {
                    const passagesData = JSON.parse(event.data);
                    const sourcesSection = responseElement.querySelector('.message-sources');
                    const sourcesContainer = responseElement.querySelector('.sources-content');
                    
                    // Only show sources section if we have passages
                    if (passagesData.passages && passagesData.passages.length > 0) {
                        sourcesSection.style.display = 'block';
                    } else {
                        sourcesSection.style.display = 'none';
                        return;
                    }
                    
                    // Store in chat history
                    currentResponse.passages = passagesData.passages;
                    
                    // Clear any existing passages
                    sourcesContainer.innerHTML = '';
                    
                    // Add new passages
                    const template = document.getElementById('source-passage-template');
                    const showMoreTemplate = document.getElementById('show-more-sources-template');
                    
                    // Store all passages for filtering/sorting
                    const allPassages = passagesData.passages;
                    let filteredPassages = [...allPassages];
                    let sortedPassages = filteredPassages.sort((a, b) => b.score - a.score);
                    
                    // Initially show only first 3 passages
                    let initialPassages = sortedPassages.slice(0, 3);
                    let remainingPassages = sortedPassages.slice(3);
                    
                    // Function to highlight text
                    const highlightText = (text, searchTerm, isRelevant = false) => {
                        if (!searchTerm) return text;
                        const regex = new RegExp(`(${searchTerm})`, 'gi');
                        return text.replace(regex, `<span class="${isRelevant ? 'highlight-relevant' : 'highlight'}">$1</span>`);
                    };
                    
                    // Function to sort passages
                    const sortPassages = (passages, sortBy) => {
                        switch (sortBy) {
                            case 'relevance':
                                return passages.sort((a, b) => b.score - a.score);
                            case 'date':
                                return passages.sort((a, b) => {
                                    const dateA = a.metadata['accessInfo.lastModifiedDate']?.[0] || '';
                                    const dateB = b.metadata['accessInfo.lastModifiedDate']?.[0] || '';
                                    return dateB.localeCompare(dateA);
                                });
                            case 'title':
                                return passages.sort((a, b) => {
                                    const titleA = a.metadata.title?.[0] || a.metadata['file.name']?.[0] || '';
                                    const titleB = b.metadata.title?.[0] || b.metadata['file.name']?.[0] || '';
                                    return titleA.localeCompare(titleB);
                                });
                            default:
                                return passages;
                        }
                    };
                    
                    // Function to filter passages
                    const filterPassages = (passages, searchTerm, highRelevanceOnly) => {
                        return passages.filter(passage => {
                            const text = passage.text.join(' ').toLowerCase();
                            const title = (passage.metadata.title?.[0] || passage.metadata['file.name']?.[0] || '').toLowerCase();
                            const matchesSearch = !searchTerm || 
                                text.includes(searchTerm.toLowerCase()) || 
                                title.includes(searchTerm.toLowerCase());
                            const matchesRelevance = !highRelevanceOnly || (passage.score * 100) >= 80;
                            return matchesSearch && matchesRelevance;
                        });
                    };
                    
                    // Function to create passage element
                    const createPassageElement = (passage, searchTerm = '', enableLinks = false) => {
                        const element = template.content.cloneNode(true).querySelector('.source-passage');
                        
                        // Set title (use first title or filename if no title)
                        const title = passage.metadata.title?.[0] || passage.metadata['file.name']?.[0] || 'Unknown Source';
                        element.querySelector('.passage-source').textContent = title;
                        
                        // Set score and high relevance badge
                        const score = Math.round(passage.score * 100);
                        element.querySelector('.score-value').textContent = `${score}%`;
                        if (score >= 80) {
                            element.dataset.highRelevance = 'true';
                        }
                        
                        // Set content with highlighting and links
                        const content = passage.text.join(' ');
                        const contentElement = element.querySelector('.passage-content');
                        
                        let processedContent = content;
                        
                        // Convert links if enabled
                        if (enableLinks) {
                            processedContent = convertLinks(processedContent);
                        }
                        
                        // Highlight search term if present
                        if (searchTerm) {
                            // If links are enabled, we need to be careful not to break the HTML
                            if (enableLinks) {
                                // Split by HTML tags and only highlight text content
                                const parts = processedContent.split(/(<[^>]*>)/);
                                processedContent = parts.map(part => {
                                    return part.startsWith('<') ? part : highlightText(part, searchTerm);
                                }).join('');
                            } else {
                                processedContent = highlightText(processedContent, searchTerm);
                            }
                        } else {
                            // Highlight relevant phrases if no search term
                            const keyTerms = passage.metadata['keyTerms'] || [];
                            if (keyTerms.length > 0 && !enableLinks) {
                                keyTerms.forEach(term => {
                                    processedContent = highlightText(processedContent, term, true);
                                });
                            }
                        }
                        
                        contentElement.innerHTML = processedContent;
                        
                        // Set link if available
                        const url = passage.metadata.url?.[0];
                        const linkElement = element.querySelector('.passage-link');
                        if (url) {
                            linkElement.href = url;
                        } else {
                            linkElement.style.display = 'none';
                        }
                        
                        // Set date if available
                        const date = passage.metadata['accessInfo.lastModifiedDate']?.[0];
                        const dateElement = element.querySelector('.date-value');
                        if (date) {
                            dateElement.textContent = new Date(date).toLocaleDateString();
                        } else {
                            dateElement.parentElement.style.display = 'none';
                        }
                        
                        // Add copy button handler
                        element.querySelector('.copy-passage').addEventListener('click', () => {
                            navigator.clipboard.writeText(content).then(() => {
                                showCopyNotification('Passage copied!');
                            });
                        });
                        
                        // Add metadata button handler
                        const metadataButton = element.querySelector('.show-metadata');
                        const metadataSection = element.querySelector('.passage-metadata');
                        const metadataContent = element.querySelector('.metadata-content');
                        
                        // Format metadata with clickable links
                        const formatMetadata = (metadata) => {
                            const content = [];
                            const urlFields = ['accessInfo.download.itemId', 'url'];
                            
                            for (const [key, value] of Object.entries(metadata)) {
                                if (Array.isArray(value) && value.length > 0) {
                                    let formattedValue;
                                    
                                    if (key === 'links') {
                                        // Handle links array specially
                                        formattedValue = value.map(link => {
                                            if (link.url) {
                                                return openDocument(link.url, link.text, true);
                                                // return `<a href="${link.url}" target="_blank" rel="noopener noreferrer">
                                                //     ${link.type || 'Link'} ${link.listPosition !== undefined ? (link.listPosition + 1) : ''}
                                                //     <i class="fas fa-external-link-alt"></i>
                                                // </a>`;
                                            }
                                            return '';
                                        }).filter(Boolean).join('<br>');
                                    } else if (urlFields.includes(key)) {
                                        // Handle URL fields
                                        formattedValue = value.map(url => 
                                            openDocument(url, url.length > 50 ? url.substring(0, 47) + '...' : url)
                                            // `<a href="${url}" target="_blank" rel="noopener noreferrer">
                                            //     ${url.length > 50 ? url.substring(0, 47) + '...' : url}
                                            //     <i class="fas fa-external-link-alt"></i>
                                            // </a>`
                                        ).join('<br>');
                                    } else {
                                        // Handle regular fields
                                        formattedValue = value.join(', ');
                                    }
                                    
                                    content.push(`<div><strong>${key}:</strong></div><div>${formattedValue}</div>`);
                                }
                            }
                            return content.join('');
                        };
                        
                        metadataButton.addEventListener('click', () => {
                            if (!metadataContent.innerHTML) {
                                metadataContent.innerHTML = formatMetadata(passage.metadata);
                            }
                            metadataSection.classList.toggle('show');
                            metadataButton.querySelector('i').className = 
                                metadataSection.classList.contains('show') ? 
                                'fas fa-chevron-up' : 'fas fa-info-circle';
                        });
                        
                        return element;
                    };
                    
                    // Function to detect and convert links in text
                    const convertLinks = (text) => {
                        // Regular expressions for different types of links
                        const patterns = {
                            url: /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
                            email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
                            doc: /doc\.do\?[^\s<]+[^<.,:;"')\]\s]/g
                        };

                        let html = text;
                        
                        // Convert URLs
                        html = html.replace(patterns.url, (url) => 
                            openDocument(url, url.length > 50 ? url.substring(0, 47) + '...' : url)
                            // `<a href="${url}" target="_blank" rel="noopener noreferrer">
                            //     ${url.length > 50 ? url.substring(0, 47) + '...' : url}
                            //     <i class="fas fa-external-link-alt"></i>
                            // </a>`
                        );
                        
                        // Convert email addresses
                        html = html.replace(patterns.email, (email) => 
                            `<a href="mailto:${email}">${email}</a>`
                        );
                        
                        // Convert doc.do links
                        html = html.replace(patterns.doc, (docUrl) => {
                            // Extract any ID parameter if present
                            const idMatch = docUrl.match(/id=([^&\s]+)/);
                            const displayText = idMatch ? `Document ${idMatch[1].substring(0, 8)}...` : docUrl;
                            return openDocument(docUrl, displayText, true);
                            // `<a href="${docUrl}" target="_blank" rel="noopener noreferrer">
                            //     ${displayText}
                            //     <i class="fas fa-external-link-alt"></i>
                            // </a>`;
                        });
                        
                        return html;
                    };

                    // Function to update passage display
                    const updatePassageDisplay = (searchTerm = '', sortBy = 'relevance', highRelevanceOnly = false, enableLinks = false) => {
                        // Filter and sort passages
                        filteredPassages = filterPassages(allPassages, searchTerm, highRelevanceOnly);
                        sortedPassages = sortPassages(filteredPassages, sortBy);
                        
                        // Update display
                        sourcesContainer.innerHTML = '';
                        const noResults = responseElement.querySelector('.no-results');
                        
                        if (filteredPassages.length === 0) {
                            noResults.style.display = 'block';
                            return;
                        }
                        
                        noResults.style.display = 'none';
                        initialPassages = sortedPassages.slice(0, 3);
                        remainingPassages = sortedPassages.slice(3);
                        
                        // Create passage elements with highlighted text
                        initialPassages.forEach(passage => {
                            const element = createPassageElement(passage, searchTerm, enableLinks);
                            sourcesContainer.appendChild(element);
                        });
                        
                        // Remove any existing "Show More" button
                        const existingShowMore = sourcesContainer.querySelector('.show-more-sources');
                        if (existingShowMore) {
                            existingShowMore.remove();
                        }

                        // Add "Show More" button if needed
                        if (remainingPassages.length > 0) {
                            const showMoreElement = showMoreTemplate.content.cloneNode(true);
                            const showMoreButton = showMoreElement.querySelector('.show-more-button');
                            showMoreButton.querySelector('.remaining-count').textContent = remainingPassages.length;
                            
                            showMoreButton.addEventListener('click', () => {
                                if (showMoreButton.classList.contains('expanded')) {
                                    // Hide additional passages
                                    const passages = sourcesContainer.querySelectorAll('.source-passage');
                                    for (let i = 3; i < passages.length; i++) {
                                        passages[i].remove();
                                    }
                                    showMoreButton.classList.remove('expanded');
                                    showMoreButton.innerHTML = `
                                        <i class="fas fa-chevron-down"></i>
                                        Show More Sources (${remainingPassages.length})
                                    `;
                                } else {
                                    // Show remaining passages
                                    remainingPassages.forEach(passage => {
                                        const element = createPassageElement(passage, searchTerm, enableLinks);
                                        sourcesContainer.insertBefore(element, showMoreButton.parentElement);
                                    });
                                    showMoreButton.classList.add('expanded');
                                    showMoreButton.innerHTML = `
                                        <i class="fas fa-chevron-up"></i>
                                        Show Less
                                    `;
                                }
                            });
                            
                            sourcesContainer.appendChild(showMoreElement);
                        }
                    };
                    
                    // Set up search, sort, and filter handlers
                    const searchInput = responseElement.querySelector('.search-passages');
                    const sortSelect = responseElement.querySelector('.sort-passages');
                    const highRelevanceCheckbox = responseElement.querySelector('.high-relevance-only');
                    const clickableLinksCheckbox = responseElement.querySelector('.clickable-links');
                    
                    let searchTimeout;
                    searchInput.addEventListener('input', () => {
                        clearTimeout(searchTimeout);
                        searchTimeout = setTimeout(() => {
                            updatePassageDisplay(
                                searchInput.value,
                                sortSelect.value,
                                highRelevanceCheckbox.checked,
                                clickableLinksCheckbox.checked
                            );
                        }, 300);
                    });
                    
                    sortSelect.addEventListener('change', () => {
                        updatePassageDisplay(
                            searchInput.value,
                            sortSelect.value,
                            highRelevanceCheckbox.checked,
                            clickableLinksCheckbox.checked
                        );
                    });
                    
                    highRelevanceCheckbox.addEventListener('change', () => {
                        updatePassageDisplay(
                            searchInput.value,
                            sortSelect.value,
                            highRelevanceCheckbox.checked,
                            clickableLinksCheckbox.checked
                        );
                    });
                    
                    clickableLinksCheckbox.addEventListener('change', () => {
                        updatePassageDisplay(
                            searchInput.value,
                            sortSelect.value,
                            highRelevanceCheckbox.checked,
                            clickableLinksCheckbox.checked
                        );
                    });
                    
                    // Initial display
                    updatePassageDisplay(
                        searchInput.value,
                        sortSelect.value,
                        highRelevanceCheckbox.checked,
                        clickableLinksCheckbox.checked
                    );

                    // Update source count
                    const sourcesCount = responseElement.querySelector('.sources-count');
                    sourcesCount.textContent = `${allPassages.length} sources`;

                    // Add click handler to toggle sources visibility
                    const toggleButton = responseElement.querySelector('.toggle-sources');
                    const sourcesExpanded = responseElement.querySelector('.sources-expanded');
                    const sourcesHeader = responseElement.querySelector('.sources-header');

                    const toggleSources = () => {
                        const isExpanded = sourcesExpanded.style.display !== 'none';
                        sourcesExpanded.style.display = isExpanded ? 'none' : 'block';
                        toggleButton.querySelector('i').className = isExpanded ? 
                            'fas fa-chevron-down' : 'fas fa-chevron-up';
                        toggleButton.querySelector('i').style.transform = isExpanded ? 
                            'rotate(0deg)' : 'rotate(180deg)';
                    };

                    toggleButton.addEventListener('click', toggleSources);
                    sourcesHeader.addEventListener('click', (e) => {
                        // Only toggle if click wasn't on the button itself
                        if (!e.target.closest('.toggle-sources')) {
                            toggleSources();
                        }
                    });
                    
                    // Initially hide expanded content
                    sourcesExpanded.style.display = 'none';
                } catch (error) {
                    console.error('Error parsing passages:', error);
                }
            });

            eventSource.addEventListener('related', (event) => {
                updateStatus('receiving-related-questions', 'Receiving Related Questions...');
                console.log('Received related event:', event);
                try {
                    const relatedData = JSON.parse(event.data);
                    const relatedContainer = responseElement.querySelector('.related-questions');
                    
                    // Store in chat history
                    currentResponse.relatedQuestions = relatedData.questions.related_questions;
                    
                    // Clear any existing related questions
                    relatedContainer.innerHTML = '';
                    
                    // Add new related questions
                    const template = document.getElementById('related-question-template');
                    currentResponse.relatedQuestions.forEach(question => {
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
                if (eventSource) {
                    eventSource.close();
                    eventSource = null;
                }
                await client.stopClient(requestUuid);
                updateStatus('', 'ready');
                isWaitingForResponse = false;
                disableInput(false);

                // Log metrics
                console.log('Request metrics:', client.getMetrics());
            });

            eventSource.addEventListener('error', async (event) => {
                console.error('SSE connection error:', event);
                // Only call stopClient if we're not already stopping
                if (isWaitingForResponse && eventSource) {
                    updateStatus('error', 'Connection error');
                    isWaitingForResponse = false;
                    disableInput(false);
                    showError('Failed to get response');
                    await client.stopClient(requestUuid);
                }
            });

            // Send the question with properly merged filters
            await client.askQuestion(requestUuid, question, {
                searchMode: 'multiword',
                filter: parsedFilters,
                profileId: expertSettings.profileId || (expertSettings.profileName ? btoa(expertSettings.profileName) : undefined)
            });

        } catch (error) {
            console.error('Error sending message:', error);
            showError(error.message);
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

    sendButton.addEventListener('click', () => sendMessage());
    stopButton.addEventListener('click', () => stop());

    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (currentRequestUuid && eventSource) {
            client.stopClient(currentRequestUuid).catch(console.error);
        }
    });

    // Expert mode panel functionality
    const expertPanel = document.getElementById('expert-panel');
    const expertCancel = document.getElementById('expert-cancel');
    const expertSave = document.getElementById('expert-save');
    
    // Get expert mode input elements once
    let expertElements = {
        filters: document.getElementById('expert-filters'),
        docIds: document.getElementById('expert-docIds'),
        query: document.getElementById('expert-query'),
        profileName: document.getElementById('expert-profileName'),
        profileId: document.getElementById('expert-profileId')
    };

    // Initialize expert mode values
    expertElements.docIds.value = docIds || '';
    expertElements.query.value = query || '';
    expertElements.profileName.value = profileName || '';
    expertElements.profileId.value = profileId || '';
    expertElements.filters.value = filters || '[]';

    let savedExpertValues = {
        docIds: expertElements.docIds.value,
        query: expertElements.query.value,
        profileName: expertElements.profileName.value,
        profileId: expertElements.profileId.value,
        filters: expertElements.filters.value
    };

    function toggleExpertMode() {
        const panel = document.getElementById('expert-panel');
        panel.classList.toggle('show');
    }

    // Add click handlers for both expert mode toggles
    const expertToggleMobile = document.querySelector('.expert-mode-toggle-mobile');
    const expertToggleDesktop = document.getElementById('expert-mode-toggle');

    if (expertToggleMobile) {
        expertToggleMobile.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleExpertMode();
        });
    }

    if (expertToggleDesktop) {
        expertToggleDesktop.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleExpertMode();
        });
    }

    expertCancel.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Restore saved values
        expertElements.docIds.value = savedExpertValues.docIds;
        expertElements.query.value = savedExpertValues.query;
        expertElements.profileName.value = savedExpertValues.profileName;
        expertElements.profileId.value = savedExpertValues.profileId;
        expertElements.filters.value = savedExpertValues.filters;
        // Close the panel
        document.getElementById('expert-panel').classList.remove('show');
        
        expertPanel.classList.remove('show');
    });

    expertSave.addEventListener('click', (e) => {
        e.stopPropagation();  // Prevent the click from bubbling up
        // Validate filters JSON
        try {
            if (expertElements.filters.value) {
                JSON.parse(expertElements.filters.value);
            }
            // Save values
            savedExpertValues = {
                docIds: expertElements.docIds.value,
                query: expertElements.query.value,
                profileName: expertElements.profileName.value,
                profileId: expertElements.profileId.value,
                filters: expertElements.filters.value
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
    updateStatus('', 'ready');
});