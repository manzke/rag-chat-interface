import '../css/index.css';
import '../css/chat.css';
import '../css/mobile.css';

import i18n from './i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n and translate page
    await i18n.init();
    i18n.translatePage();
    let config;
    let activeAssistantId = localStorage.getItem('activeAssistantId');

    try {
        const response = await fetch('../configs/config.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        config = await response.json();
        
        // Validate config structure
        if (!config.assistants || !Array.isArray(config.assistants)) {
            throw new Error('Invalid configuration format');
        }
    } catch (error) {
        console.error('Error loading configuration:', error);
        document.querySelector('.welcome-container').innerHTML = `
            <div class="error-message">
                <h2>${i18n.t('errors.loading.title')}</h2>
                <p>${i18n.t('errors.loading.message')}</p>
            </div>
        `;
        return;
    }

    const assistantsGrid = document.getElementById('assistants-grid');
    const template = document.getElementById('assistant-card-template');

    config.assistants.forEach(assistant => {
        const card = template.content.cloneNode(true).querySelector('.assistant-card');
        
        // Set card data
        card.dataset.assistantId = assistant.id;
        if (assistant.id === activeAssistantId) {
            card.classList.add('active');
        }

        // Set icon
        const icon = card.querySelector('.assistant-icon i');
        icon.className = assistant.icon;

        // Set text with translations
        const currentLang = i18n.getCurrentLanguage();
        card.querySelector('.assistant-name').textContent = assistant.name[currentLang] || assistant.name.en;
        card.querySelector('.assistant-description').textContent = assistant.description[currentLang] || assistant.description.en;

        // Add click handler
        card.addEventListener('click', () => {
            selectAssistant(assistant);
        });

        assistantsGrid.appendChild(card);
    });

    function selectAssistant(assistant) {
        const isSameAssistant = assistant.id === activeAssistantId;
        
        // Store the selection
        localStorage.setItem('activeAssistantId', assistant.id);
        
        // Create a version of the assistant with current language's translations
        const currentLang = i18n.getCurrentLanguage();
        const localizedAssistant = {
            ...assistant,
            name: assistant.name[currentLang] || assistant.name.en,
            description: assistant.description[currentLang] || assistant.description.en,
            defaultConfig: {
                ...assistant.defaultConfig,
                welcomeMessage: assistant.defaultConfig.welcomeMessage[currentLang] || assistant.defaultConfig.welcomeMessage.en
            }
        };
        localStorage.setItem('activeAssistant', JSON.stringify(localizedAssistant));

        // Update UI
        document.querySelectorAll('.assistant-card').forEach(card => {
            card.classList.toggle('active', card.dataset.assistantId === assistant.id);
        });
        
        // Get current URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        
        // Set newChat parameter - force to string 'true' or 'false'
        urlParams.set('newChat', (!isSameAssistant ? 'true' : 'false'));
        
        // Keep widget mode if present
        if (mode === 'widget') {
            urlParams.set('mode', 'widget');
            
            // In widget mode, notify parent to navigate
            window.parent.postMessage({ 
                type: 'navigate',
                url: `/chat.html?${urlParams.toString()}`
            }, '*');
        } else {
            // Regular navigation
            window.location.href = `chat.html?${urlParams.toString()}`;
        }
    }
});