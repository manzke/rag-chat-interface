import '../css/index.css';
import '../css/chat.css';
import '../css/mobile.css';

document.addEventListener('DOMContentLoaded', async () => {
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
                <h2>Error Loading Configuration</h2>
                <p>Please try refreshing the page. If the problem persists, contact support.</p>
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

        // Set text
        card.querySelector('.assistant-name').textContent = assistant.name;
        card.querySelector('.assistant-description').textContent = assistant.description;

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
        localStorage.setItem('activeAssistant', JSON.stringify(assistant));

        // Update UI
        document.querySelectorAll('.assistant-card').forEach(card => {
            card.classList.toggle('active', card.dataset.assistantId === assistant.id);
        });
        
        window.location.href = `chat.html?newChat=${!isSameAssistant}`;
    }
});