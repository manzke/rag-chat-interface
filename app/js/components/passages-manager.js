export class PassagesManager {
    constructor(responseElement, openDocument) {
        this.responseElement = responseElement;
        this.openDocument = openDocument;
        this.sourcesSection = responseElement.querySelector('.message-sources');
        this.sourcesContainer = responseElement.querySelector('.sources-content');
        this.template = document.getElementById('source-passage-template');
        this.showMoreTemplate = document.getElementById('show-more-sources-template');
        this.isExpanded = false; // Add state tracking
    }

    handlePassages(passagesData) {
        if (!passagesData.passages || passagesData.passages.length === 0) {
            this.sourcesSection.style.display = 'none';
            return;
        }

        this.sourcesSection.style.display = 'block';
        this.sourcesContainer.innerHTML = '';
        
        const allPassages = passagesData.passages;
        let filteredPassages = [...allPassages];
        let sortedPassages = this.sortPassages(filteredPassages, 'relevance');
        
        // Store expanded state before updating content
        const wasExpanded = this.sourcesContainer?.classList.contains('expanded');
        this.setupPassageDisplay(sortedPassages);
        // Restore expanded state if it was expanded
        if (wasExpanded) {
            this.sourcesContainer.classList.add('expanded');
            const toggleButton = this.responseElement.querySelector('.toggle-sources');
            toggleButton.querySelector('i').className = 'fas fa-chevron-up';
            toggleButton.querySelector('i').style.transform = 'rotate(180deg)';
        }
        this.setupEventListeners(allPassages);
    }

    sortPassages(passages, sortBy) {
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
    }

    filterPassages(passages, searchTerm, highRelevanceOnly) {
        return passages.filter(passage => {
            const text = passage.text.join(' ').toLowerCase();
            const title = (passage.metadata.title?.[0] || passage.metadata['file.name']?.[0] || '').toLowerCase();
            const matchesSearch = !searchTerm || 
                text.includes(searchTerm.toLowerCase()) || 
                title.includes(searchTerm.toLowerCase());
            const matchesRelevance = !highRelevanceOnly || (passage.score * 100) >= 80;
            return matchesSearch && matchesRelevance;
        });
    }

    setupPassageDisplay(sortedPassages) {
        const initialPassages = sortedPassages.slice(0, 3);
        const remainingPassages = sortedPassages.slice(3);
        
        initialPassages.forEach(passage => {
            const element = this.createPassageElement(passage);
            this.sourcesContainer.appendChild(element);
        });

        if (remainingPassages.length > 0) {
            this.addShowMoreButton(remainingPassages);
        }

        // Update source count
        const sourcesCount = this.responseElement.querySelector('.sources-count');
        sourcesCount.textContent = `${sortedPassages.length} sources`;

        // Setup toggle functionality
        this.setupSourcesToggle();
    }

    setupSourcesToggle() {
        const toggleButton = this.responseElement.querySelector('.toggle-sources');
        const sourcesExpanded = this.responseElement.querySelector('.sources-expanded');
        const sourcesHeader = this.responseElement.querySelector('.sources-header');

        const toggleSources = () => {
            this.isExpanded = !this.isExpanded;
            sourcesExpanded.style.display = this.isExpanded ? 'block' : 'none';
            toggleButton.querySelector('i').className = this.isExpanded ? 
                'fas fa-chevron-up' : 'fas fa-chevron-down';
            toggleButton.querySelector('i').style.transform = this.isExpanded ? 
                'rotate(180deg)' : 'rotate(0deg)';
        };

        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling to header
            toggleSources();
        });
        
        sourcesHeader.addEventListener('click', (e) => {
            if (!e.target.closest('.toggle-sources')) {
                toggleSources();
            }
        });

        // Initialize state
        sourcesExpanded.style.display = this.isExpanded ? 'block' : 'none';
    }

    setupEventListeners(allPassages) {
        const searchInput = this.responseElement.querySelector('.search-passages');
        const sortSelect = this.responseElement.querySelector('.sort-passages');
        const highRelevanceCheckbox = this.responseElement.querySelector('.high-relevance-only');
        const clickableLinksCheckbox = this.responseElement.querySelector('.clickable-links');
        
        let searchTimeout;
        const updateDisplay = () => {
            const wasExpanded = this.isExpanded; // Store current state
            const filtered = this.filterPassages(
                allPassages, 
                searchInput.value, 
                highRelevanceCheckbox.checked
            );
            const sorted = this.sortPassages(filtered, sortSelect.value);
            this.sourcesContainer.innerHTML = '';
            this.setupPassageDisplay(sorted);
            
            // Restore expanded state after updating
            const sourcesExpanded = this.responseElement.querySelector('.sources-expanded');
            const toggleButton = this.responseElement.querySelector('.toggle-sources');
            if (wasExpanded) {
                this.isExpanded = true;
                sourcesExpanded.style.display = 'block';
                toggleButton.querySelector('i').className = 'fas fa-chevron-up';
                toggleButton.querySelector('i').style.transform = 'rotate(180deg)';
            }
        };

        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(updateDisplay, 300);
        });
        
        sortSelect.addEventListener('change', updateDisplay);
        highRelevanceCheckbox.addEventListener('change', updateDisplay);
        clickableLinksCheckbox.addEventListener('change', updateDisplay);
    }

    createPassageElement(passage, searchTerm = '') {
        const element = this.template.content.cloneNode(true).querySelector('.source-passage');
        
        const title = passage.metadata.title?.[0] || passage.metadata['file.name']?.[0] || 'Unknown Source';
        element.querySelector('.passage-source').textContent = title;
        
        const score = Math.round(passage.score * 100);
        element.querySelector('.score-value').textContent = `${score}%`;
        if (score >= 80) {
            element.dataset.highRelevance = 'true';
        }
        
        const content = passage.text.join(' ');
        const contentElement = element.querySelector('.passage-content');
        contentElement.innerHTML = this.processContent(content, searchTerm);
        
        this.setupPassageMetadata(element, passage);
        
        return element;
    }

    processContent(content, searchTerm = '') {
        if (searchTerm) {
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            return content.replace(regex, '<span class="highlight">$1</span>');
        }
        return content;
    }

    setupPassageMetadata(element, passage) {
        const url = passage.metadata.url?.[0];
        const linkElement = element.querySelector('.passage-link');
        if (url) {
            linkElement.href = url;
        } else {
            linkElement.style.display = 'none';
        }
        
        const date = passage.metadata['accessInfo.lastModifiedDate']?.[0];
        const dateElement = element.querySelector('.date-value');
        if (date) {
            dateElement.textContent = new Date(date).toLocaleDateString();
        } else {
            dateElement.parentElement.style.display = 'none';
        }

        this.setupMetadataButton(element, passage);
    }

    setupMetadataButton(element, passage) {
        const metadataButton = element.querySelector('.show-metadata');
        const metadataSection = element.querySelector('.passage-metadata');
        const metadataContent = element.querySelector('.metadata-content');
        
        metadataButton.addEventListener('click', () => {
            if (!metadataContent.innerHTML) {
                metadataContent.innerHTML = this.formatMetadata(passage.metadata);
            }
            metadataSection.classList.toggle('show');
            metadataButton.querySelector('i').className = 
                metadataSection.classList.contains('show') ? 
                'fas fa-chevron-up' : 'fas fa-info-circle';
        });
    }

    formatMetadata(metadata) {
        const content = [];
        const urlFields = ['accessInfo.download.itemId', 'url'];
        
        for (const [key, value] of Object.entries(metadata)) {
            if (Array.isArray(value) && value.length > 0) {
                let formattedValue;
                
                if (key === 'links') {
                    formattedValue = value
                        .filter(link => link.url)
                        .map(link => this.openDocument(link.url, link.text, true))
                        .join('<br>');
                } else if (urlFields.includes(key)) {
                    formattedValue = value
                        .map(url => this.openDocument(
                            url, 
                            url.length > 50 ? url.substring(0, 47) + '...' : url
                        ))
                        .join('<br>');
                } else {
                    formattedValue = value.join(', ');
                }
                
                content.push(`<div><strong>${key}:</strong></div><div>${formattedValue}</div>`);
            }
        }
        return content.join('');
    }

    addShowMoreButton(remainingPassages) {
        const showMoreElement = this.showMoreTemplate.content.cloneNode(true);
        const showMoreButton = showMoreElement.querySelector('.show-more-button');
        showMoreButton.querySelector('.remaining-count').textContent = remainingPassages.length;
        
        showMoreButton.addEventListener('click', () => {
            if (showMoreButton.classList.contains('expanded')) {
                const passages = this.sourcesContainer.querySelectorAll('.source-passage');
                for (let i = 3; i < passages.length; i++) {
                    passages[i].remove();
                }
                showMoreButton.classList.remove('expanded');
                showMoreButton.innerHTML = `
                    <i class="fas fa-chevron-down"></i>
                    Show More Sources (${remainingPassages.length})
                `;
            } else {
                remainingPassages.forEach(passage => {
                    const element = this.createPassageElement(passage);
                    this.sourcesContainer.insertBefore(element, showMoreButton.parentElement);
                });
                showMoreButton.classList.add('expanded');
                showMoreButton.innerHTML = `
                    <i class="fas fa-chevron-up"></i>
                    Show Less
                `;
            }
        });
        
        this.sourcesContainer.appendChild(showMoreElement);
    }
}