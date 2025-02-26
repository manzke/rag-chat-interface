import { getRelativeTime, getAbsoluteTime, isDifferentDay, getDateSeparatorText } from '../utils/time.js';

export class MessageManager {
    constructor(container, i18n, onMessageAction) {
        this.container = container;
        this.i18n = i18n;
        this.onMessageAction = onMessageAction;
        this.messageTemplate = document.getElementById('message-template');
    }

    createMessage(text, isUser = false, isWelcome = false) {
        const messageElement = this.messageTemplate.content.cloneNode(true).querySelector('.message');
        messageElement.classList.add(isUser ? 'user-message' : 'assistant-message');
        
        const contentDiv = messageElement.querySelector('.message-content');
        contentDiv.textContent = text;

        this.addTimestamp(messageElement);
        this.setupMessageButtons(messageElement, text, isUser);
        
        if (isUser || isWelcome) {
            messageElement.querySelector('.message-sources').style.display = 'none';
        }

        return messageElement;
    }

    addTimestamp(messageElement) {
        const now = new Date();
        const timestamp = messageElement.querySelector('.message-timestamp time');
        timestamp.setAttribute('datetime', now.toISOString());
        timestamp.textContent = getRelativeTime(now);
        timestamp.parentElement.setAttribute('title', getAbsoluteTime(now));

        const lastMessage = this.container.lastElementChild;
        if (lastMessage) {
            const lastTimestamp = lastMessage.querySelector('time')?.getAttribute('datetime');
            if (lastTimestamp && isDifferentDay(lastTimestamp, now)) {
                this.addDateSeparator(now);
            }
        } else {
            this.addDateSeparator(now);
        }

        setInterval(() => {
            timestamp.textContent = getRelativeTime(timestamp.getAttribute('datetime'));
        }, 60000);
    }

    addDateSeparator(date) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        separator.innerHTML = `<span>${getDateSeparatorText(date)}</span>`;
        this.container.appendChild(separator);
    }

    setupMessageButtons(messageElement, text, isUser) {
        const copyButton = messageElement.querySelector('.copy-button');
        const editButton = messageElement.querySelector('.edit-button');
        const rerunButton = messageElement.querySelector('.rerun-button');
        const feedbackButtons = messageElement.querySelector('.message-footer');
        
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => this.showCopyNotification());
        });

        if (isUser) {
            feedbackButtons.style.display = 'none';
            this.setupUserMessageButtons(messageElement, text, editButton, rerunButton);
        } else {
            editButton.style.display = 'none';
            rerunButton.style.display = 'none';
            this.setupFeedbackButtons(messageElement);
        }
    }

    setupUserMessageButtons(messageElement, text, editButton, rerunButton) {
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

            const handleSave = () => {
                const newText = textarea.value.trim();
                if (newText && newText !== text) {
                    this.onMessageAction('send', newText);
                }
                finishEditing();
            };

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSave();
                }
            });

            editContainer.querySelector('.save-edit').addEventListener('click', handleSave);
            editContainer.querySelector('.cancel-edit').addEventListener('click', finishEditing);
        };

        editButton.addEventListener('click', startEditing);
        rerunButton.addEventListener('click', () => this.onMessageAction('send', text));
    }

    setupFeedbackButtons(messageElement) {
        const thumbsUp = messageElement.querySelector('.thumbs-up');
        const thumbsDown = messageElement.querySelector('.thumbs-down');
        const messageUuid = `ifs-ai-assistant-answer-${crypto.randomUUID()}`;
        messageElement.dataset.uuid = messageUuid;

        thumbsUp.addEventListener('click', () => {
            if (!thumbsUp.classList.contains('selected')) {
                thumbsUp.classList.add('selected');
                thumbsDown.classList.remove('selected');
                this.onMessageAction('feedback', { uuid: messageUuid, type: 'thumbs_up' });
            }
        });

        thumbsDown.addEventListener('click', () => {
            if (!thumbsDown.classList.contains('selected')) {
                thumbsDown.classList.add('selected');
                thumbsUp.classList.remove('selected');
                this.onMessageAction('feedback', { uuid: messageUuid, type: 'thumbs_down' });
            }
        });
    }

    showCopyNotification() {
        const notification = document.createElement('div');
        notification.className = 'copy-success';
        notification.textContent = this.i18n.t('chat.feedback.copied');
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant-message';
        errorDiv.textContent = `Error: ${message}`;
        this.container.appendChild(errorDiv);
    }

    clearMessages() {
        this.container.innerHTML = '';
    }

    appendMessages(messages) {
        messages.forEach(message => this.container.appendChild(message));
        
        // Scroll to the most recent message that was added
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            this.scrollToMessage(lastMessage);
        }
    }
    
    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }
    
    // Updated to scroll within the container, not the window
    scrollToMessage(messageElement) {
        if (!messageElement) return;
        
        // This scrolls within the chat container itself
        const containerRect = this.container.getBoundingClientRect();
        const elementRect = messageElement.getBoundingClientRect();
        
        // Calculate the element's position relative to the container
        const relativeTop = elementRect.top - containerRect.top;
        const targetScrollPosition = this.container.scrollTop + relativeTop - (containerRect.height / 3);
        
        this.container.scrollTo({
            top: targetScrollPosition,
            behavior: 'smooth'
        });
    }
}