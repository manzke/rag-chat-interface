// Import polyfills first
import './polyfills.js';

// Import CSS
import '../css/index.css';
import '../css/chat.css';
import '../css/mobile.css';
import '../css/processing-insights.css';

// Import modules
import { client } from './rag-client.js';
import { initializeMobileMenu } from './mobile-menu.js';
import { initializeVoiceInput } from './voice-input.js';
import i18n from './i18n.js';
import { ExpertMode } from './components/expert-mode.js';
import { MessageManager } from './components/message-manager.js';
import { InputManager } from './components/input-manager.js';
import { StatusManager } from './components/status-manager.js';
import { ChatController } from './components/chat-controller.js';
import { PDFManager } from './components/pdf-manager.js';

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

    // Initialize UI elements
    const messagesContainer = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');

    // Initialize managers
    const messageManager = new MessageManager(messagesContainer, i18n);
    const inputManager = new InputManager(userInput, sendButton, stopButton);
    const statusManager = new StatusManager(statusIndicator, statusText, i18n);
    const pdfManager = new PDFManager();

    // Initialize expert mode
    const urlParams = new URLSearchParams(window.location.search);
    const expertMode = new ExpertMode({
        docIds: urlParams.get('docIds') ?? activeAssistant.defaultConfig.docIds?.join(','),
        profileName: urlParams.get('profileName') ?? activeAssistant.defaultConfig.profileName,
        query: urlParams.get('query') ?? activeAssistant.defaultConfig.query,
        filters: urlParams.get('filters') ?? JSON.stringify(activeAssistant.defaultConfig.filters || [])
    });

    // Initialize chat controller
    const chatController = new ChatController(
        client, 
        messageManager,
        statusManager,
        inputManager
    );
    chatController.setExpertMode(expertMode);
    chatController.setPDFManager(pdfManager);

    // Setup message action handler
    messageManager.onMessageAction = (action, payload) => {
        chatController.handleMessageAction(action, payload);
    };

    // Set up handlers
    setupAssistantName();
    setupBackButton();
    setupWelcomeMessage();
    setupInputHandlers();
    setupExportButton();
    setupResetButton();

    function setupAssistantName() {
        const currentLang = i18n.getCurrentLanguage();
        const assistantName = typeof activeAssistant.name === 'string' 
            ? activeAssistant.name 
            : activeAssistant.defaultConfig.name[currentLang] || activeAssistant.defaultConfig.name.en;
        document.getElementById('assistant-name').textContent = assistantName;
    }

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
            const currentLang = i18n.getCurrentLanguage();
            const welcomeMessage = typeof activeAssistant.defaultConfig.welcomeMessage === 'string'
                ? activeAssistant.defaultConfig.welcomeMessage
                : activeAssistant.defaultConfig.welcomeMessage[currentLang] || 
                  activeAssistant.defaultConfig.welcomeMessage.en;
            
            const messageElement = messageManager.createMessage(welcomeMessage, false, true);
            messagesContainer.appendChild(messageElement);
        }
    }

    function setupInputHandlers() {
        inputManager.onEnter(() => chatController.sendMessage());
        inputManager.onClick(() => chatController.sendMessage());
        inputManager.onStop(() => chatController.stop());

        window.addEventListener('beforeunload', () => {
            if (chatController.currentRequestUuid && chatController.eventSource) {
                client.stopClient(chatController.currentRequestUuid).catch(console.error);
            }
            pdfManager.cleanup();
        });
    }

    function setupExportButton() {
        document.getElementById('export-button').addEventListener('click', () => {
            const exportData = chatController.exportHistory(activeAssistant.name);
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
                chatController.clearHistory();
                setupWelcomeMessage();
            }
        });
    }

    // Initialize status
    statusManager.setReady();
});