export class ExpertMode {
    constructor(initialValues = {}) {
        this.elements = {
            filters: document.getElementById('expert-filters'),
            docIds: document.getElementById('expert-docIds'),
            query: document.getElementById('expert-query'),
            profileName: document.getElementById('expert-profileName'),
            profileId: document.getElementById('expert-profileId')
        };

        this.savedValues = {
            docIds: initialValues.docIds || '',
            query: initialValues.query || '',
            profileName: initialValues.profileName || '',
            profileId: initialValues.profileId || '',
            filters: initialValues.filters || '[]'
        };

        this.initializeValues();
        this.setupEventListeners();
        this.setupProfileSync();
        
        // Hide error message by default
        document.querySelector('#expert-panel .error-message').style.display = 'none';
    }

    initializeValues() {
        Object.entries(this.savedValues).forEach(([key, value]) => {
            if (this.elements[key]) {
                this.elements[key].value = value;
            }
        });
    }

    setupEventListeners() {
        const panel = document.getElementById('expert-panel');
        const expertCancel = document.getElementById('expert-cancel');
        const expertSave = document.getElementById('expert-save');
        const expertToggleMobile = document.querySelector('.expert-mode-toggle-mobile');
        const expertToggleDesktop = document.getElementById('expert-mode-toggle');

        // Add JSON validation while typing and on blur
        const filtersTextarea = this.elements.filters;
        const errorMessage = document.querySelector('#expert-panel .error-message');
        
        // Add debounce function to avoid too many validations while typing
        let debounceTimeout;
        const validateJson = () => {
            try {
                if (filtersTextarea.value && filtersTextarea.value.trim() !== '') {
                    JSON.parse(filtersTextarea.value);
                    errorMessage.style.display = 'none';
                    filtersTextarea.classList.remove('invalid-json');
                }
            } catch (e) {
                errorMessage.style.display = 'block';
                filtersTextarea.classList.add('invalid-json');
            }
        };
        
        filtersTextarea.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(validateJson, 500); // Validate after 500ms of no typing
        });
        
        filtersTextarea.addEventListener('blur', validateJson);

        const toggleExpertMode = () => {
            panel.classList.toggle('show');
        };

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
            this.restoreValues();
            panel.classList.remove('show');
            errorMessage.style.display = 'none';
            filtersTextarea.classList.remove('invalid-json');
        });

        expertSave.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.validateAndSaveValues()) {
                panel.classList.remove('show');
                errorMessage.style.display = 'none';
                filtersTextarea.classList.remove('invalid-json');
            } else {
                errorMessage.style.display = 'block';
                filtersTextarea.classList.add('invalid-json');
            }
        });

        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            panel.classList.remove('show');
        });
    }
    
    /**
     * Setup bidirectional synchronization between profileName and profileId
     */
    setupProfileSync() {
        const profileNameInput = this.elements.profileName;
        const profileIdInput = this.elements.profileId;
        
        // When profileName changes, update profileId with base64 encoding
        profileNameInput.addEventListener('input', () => {
            if (profileNameInput.value.trim()) {
                try {
                    // Only update if this is a change initiated by user input, not our script
                    if (document.activeElement === profileNameInput) {
                        profileIdInput.value = btoa(profileNameInput.value);
                    }
                } catch (e) {
                    console.warn('Failed to encode profile name to base64', e);
                }
            }
        });
        
        // When profileId changes, try to decode and update profileName
        profileIdInput.addEventListener('input', () => {
            if (profileIdInput.value.trim()) {
                try {
                    // Only update if this is a change initiated by user input, not our script
                    if (document.activeElement === profileIdInput) {
                        const decoded = atob(profileIdInput.value);
                        profileNameInput.value = decoded;
                    }
                } catch (e) {
                    // Not a valid base64 string, don't update profileName
                    console.warn('Failed to decode profileId as base64', e);
                }
            }
        });
        
        // Initial sync if we have a profileName but no profileId
        if (profileNameInput.value && !profileIdInput.value) {
            try {
                profileIdInput.value = btoa(profileNameInput.value);
            } catch (e) {
                console.warn('Failed to encode initial profile name to base64', e);
            }
        }
        
        // Initial sync if we have a profileId but no profileName
        if (profileIdInput.value && !profileNameInput.value) {
            try {
                const decoded = atob(profileIdInput.value);
                profileNameInput.value = decoded;
            } catch (e) {
                console.warn('Failed to decode initial profileId as base64', e);
            }
        }
    }

    restoreValues() {
        Object.entries(this.savedValues).forEach(([key, value]) => {
            if (this.elements[key]) {
                this.elements[key].value = value;
            }
        });
    }

    validateAndSaveValues() {
        try {
            if (this.elements.filters.value) {
                JSON.parse(this.elements.filters.value);
            }

            Object.entries(this.elements).forEach(([key, element]) => {
                this.savedValues[key] = element.value;
            });

            document.querySelector('#expert-panel .error-message').style.display = 'none';
            return true;
        } catch (e) {
            document.querySelector('#expert-panel .error-message').style.display = 'block';
            return false;
        }
    }

    getSettings() {
        // Get the current settings from input elements
        const settings = {
            docIds: this.elements.docIds.value,
            query: this.elements.query.value,
            profileName: this.elements.profileName.value,
            profileId: this.elements.profileId.value,
            filters: this.elements.filters.value
        };
        
        // If profileName exists but profileId is empty, generate it
        if (settings.profileName && !settings.profileId) {
            try {
                settings.profileId = btoa(settings.profileName);
            } catch (e) {
                console.warn('Failed to encode profile name to base64', e);
            }
        }
        
        return settings;
    }

    parseFilters() {
        let parsedFilters = [];
        try {
            if (this.elements.filters.value) {
                parsedFilters = JSON.parse(this.elements.filters.value);
            }

            // Add docIds filter if present
            if (this.elements.docIds.value) {
                const docIds = this.elements.docIds.value.split(',').map(id => id.trim()).filter(id => id);
                if (docIds.length > 0) {
                    parsedFilters.push({
                        key: 'id.keyword',
                        values: docIds
                    });
                }
            }

            // Add query filter if present
            if (this.elements.query.value) {
                parsedFilters.push({
                    key: 'query',
                    values: [this.elements.query.value],
                    isNegated: false
                });
            }
        } catch (e) {
            console.warn('Invalid filters JSON:', e);
        }

        return parsedFilters;
    }
}