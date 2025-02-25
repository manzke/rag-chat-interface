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
        });

        expertSave.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.validateAndSaveValues()) {
                panel.classList.remove('show');
                panel.querySelector('.error-message').style.display = 'none';
            } else {
                panel.querySelector('.error-message').style.display = 'block';
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

            return true;
        } catch (e) {
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