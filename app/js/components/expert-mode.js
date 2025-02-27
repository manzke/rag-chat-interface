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
        return {
            docIds: this.elements.docIds.value,
            query: this.elements.query.value,
            profileName: this.elements.profileName.value,
            profileId: this.elements.profileId.value,
            filters: this.elements.filters.value
        };
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