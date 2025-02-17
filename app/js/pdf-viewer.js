// Import PDF.js (using CDN for both library and worker)
const pdfjsLib = window.pdfjsLib;

class PDFViewer {
    constructor() {
        this.currentPDF = null;
        this.currentPage = 1;
        this.zoom = 1.0;
        this.rotation = 0;
        this.searchResults = [];
        this.currentSearchIndex = -1;
    }

    createViewer(url) {
        // Create viewer container
        const container = document.createElement('div');
        container.className = 'pdf-viewer-container';
        
        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'pdf-toolbar';
        toolbar.innerHTML = `
            <div class="pdf-nav-controls">
                <button class="pdf-prev" title="Previous Page">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span class="pdf-page-info">
                    Page <span class="pdf-current-page">1</span> of <span class="pdf-total-pages">1</span>
                </span>
                <button class="pdf-next" title="Next Page">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="pdf-search">
                <div class="search-input">
                    <input type="text" placeholder="Search PDF..." class="pdf-search-input">
                    <button class="pdf-search-prev" title="Previous Match" disabled>
                        <i class="fas fa-angle-up"></i>
                    </button>
                    <button class="pdf-search-next" title="Next Match" disabled>
                        <i class="fas fa-angle-down"></i>
                    </button>
                </div>
                <span class="pdf-search-results" style="display: none">
                    Match <span class="current-match">0</span> of <span class="total-matches">0</span>
                </span>
            </div>
            <div class="pdf-tools">
                <div class="pdf-zoom-controls">
                    <button class="pdf-zoom-out" title="Zoom Out">
                        <i class="fas fa-search-minus"></i>
                    </button>
                    <span class="pdf-zoom-level">100%</span>
                    <button class="pdf-zoom-in" title="Zoom In">
                        <i class="fas fa-search-plus"></i>
                    </button>
                </div>
                <div class="pdf-view-controls">
                    <button class="pdf-rotate" title="Rotate">
                        <i class="fas fa-redo"></i>
                    </button>
                    <button class="pdf-toggle-thumbnails" title="Toggle Thumbnails">
                        <i class="fas fa-th-large"></i>
                    </button>
                    <button class="pdf-fullscreen" title="Fullscreen">
                        <i class="fas fa-expand"></i>
                    </button>
                </div>
                <div class="pdf-download">
                    <a href="${url}" download title="Download PDF">
                        <i class="fas fa-download"></i>
                    </a>
                </div>
            </div>
        `;

        // Create main viewer area
        const viewerArea = document.createElement('div');
        viewerArea.className = 'pdf-viewer-area';
        
        // Create thumbnails sidebar
        const thumbnailsSidebar = document.createElement('div');
        thumbnailsSidebar.className = 'pdf-thumbnails';
        thumbnailsSidebar.innerHTML = `
            <div class="thumbnails-header">
                <h4>Pages</h4>
                <button class="close-thumbnails">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="thumbnails-container"></div>
        `;
        viewerArea.appendChild(thumbnailsSidebar);

        // Create canvas container
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'pdf-canvas-container';
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);
        
        // Create annotation layer
        const annotationLayer = document.createElement('div');
        annotationLayer.className = 'pdf-annotation-layer';
        canvasContainer.appendChild(annotationLayer);

        viewerArea.appendChild(canvasContainer);
        
        // Add elements to container
        container.appendChild(toolbar);
        container.appendChild(viewerArea);

        // Initialize event handlers
        this.initializeEventHandlers(container, canvas, annotationLayer);
        
        // Load PDF
        this.loadPDF(url, canvas, container);

        return container;
    }

    async renderPage(canvas, container) {
        if (!this.currentPDF) return;

        try {
            const page = await this.currentPDF.getPage(this.currentPage);
            const context = canvas.getContext('2d');

            // Calculate viewport with zoom and rotation
            const viewport = page.getViewport({ 
                scale: this.zoom,
                rotation: this.rotation 
            });

            // Set canvas dimensions
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Render PDF page
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Update page number
            container.querySelector('.pdf-current-page').textContent = this.currentPage;
            
            // Update zoom level
            container.querySelector('.pdf-zoom-level').textContent = `${Math.round(this.zoom * 100)}%`;

            // Enable/disable navigation buttons
            container.querySelector('.pdf-prev').disabled = this.currentPage <= 1;
            container.querySelector('.pdf-next').disabled = this.currentPage >= this.currentPDF.numPages;

            // Update thumbnails
            container.querySelectorAll('.pdf-thumbnail').forEach(thumb => {
                thumb.classList.toggle('active', thumb.dataset.page === String(this.currentPage));
            });

            // Update text layer
            await this.updateTextLayer(page, viewport, container);
        } catch (error) {
            console.error('Error rendering page:', error);
            throw error;
        }
    }

    async updateTextLayer(page, viewport, container) {
        let textLayer = container.querySelector('.pdf-text-layer');
        
        // Remove existing text layer if it exists
        if (textLayer) {
            textLayer.remove();
        }

        // Create new text layer
        textLayer = document.createElement('div');
        textLayer.className = 'pdf-text-layer';
        
        // Create a wrapper div to maintain alignment with canvas
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-layer-wrapper';
        wrapper.style.width = `${viewport.width}px`;
        wrapper.style.height = `${viewport.height}px`;
        
        // Add text layer to wrapper
        wrapper.appendChild(textLayer);
        
        // Position wrapper exactly over canvas
        const canvas = container.querySelector('canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        wrapper.style.position = 'absolute';
        wrapper.style.left = `${canvas.offsetLeft}px`;
        wrapper.style.top = `${canvas.offsetTop}px`;

        // Set the scale factor CSS variable
        wrapper.style.setProperty('--scale-factor', viewport.scale);

        // Add wrapper after canvas
        canvas.parentNode.appendChild(wrapper);

        try {
            // Get text content
            const textContentSource = await page.getTextContent();

            // Render text layer with textContentSource
            await pdfjsLib.renderTextLayer({
                textContentSource: textContentSource,
                container: textLayer,
                viewport: viewport,
                textDivs: [],
                enhanceTextSelection: true
            }).promise;
        } catch (error) {
            console.error('Error rendering text layer:', error);
            // Remove text layer on error to prevent visual artifacts
            textLayer.remove();
            throw error;
        }
    }

    async loadPDF(url, canvas, container) {
        try {
            // Load the PDF
            const pdf = await pdfjsLib.getDocument(url).promise;
            this.currentPDF = pdf;
            
            // Update total pages
            container.querySelector('.pdf-total-pages').textContent = pdf.numPages;
            
            // Generate thumbnails
            await this.generateThumbnails(container);
            
            // Render first page
            await this.renderPage(canvas, container);
            
            // Initialize text layer for search
            await this.initializeTextLayer(canvas, container);
        } catch (error) {
            console.error('Error loading PDF:', error);
            container.innerHTML = `
                <div class="pdf-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error loading PDF. Please try again later.</p>
                </div>
            `;
            throw error;
        }
    }

    async generateThumbnails(container) {
        const thumbnailsContainer = container.querySelector('.thumbnails-container');
        thumbnailsContainer.innerHTML = '';

        for (let i = 1; i <= this.currentPDF.numPages; i++) {
            const thumbnailCanvas = document.createElement('canvas');
            const page = await this.currentPDF.getPage(i);
            const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnails

            thumbnailCanvas.width = viewport.width;
            thumbnailCanvas.height = viewport.height;

            await page.render({
                canvasContext: thumbnailCanvas.getContext('2d'),
                viewport: viewport
            }).promise;

            const thumbnailWrapper = document.createElement('div');
            thumbnailWrapper.className = 'pdf-thumbnail';
            thumbnailWrapper.dataset.page = i;
            thumbnailWrapper.appendChild(thumbnailCanvas);

            if (i === this.currentPage) {
                thumbnailWrapper.classList.add('active');
            }

            thumbnailWrapper.addEventListener('click', () => {
                this.currentPage = i;
                this.renderPage(container.querySelector('canvas'), container);
                container.querySelectorAll('.pdf-thumbnail').forEach(thumb => {
                    thumb.classList.toggle('active', thumb.dataset.page === String(i));
                });
            });

            thumbnailsContainer.appendChild(thumbnailWrapper);
        }
    }

    async initializeTextLayer(canvas, container) {
        // Create text layer if it doesn't exist
        let textLayer = container.querySelector('.pdf-text-layer');
        if (!textLayer) {
            textLayer = document.createElement('div');
            textLayer.className = 'pdf-text-layer';
            canvas.parentElement.appendChild(textLayer);
        }

        // Initial text layer setup
        const page = await this.currentPDF.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: this.zoom });
        await this.updateTextLayer(page, viewport, container);
    }

    async searchPDF(searchTerm, container) {
        this.searchResults = [];
        this.currentSearchIndex = -1;

        for (let i = 1; i <= this.currentPDF.numPages; i++) {
            const page = await this.currentPDF.getPage(i);
            const textContentSource = await page.getTextContent();
            const text = textContentSource.items.map(item => item.str).join(' ');

            if (text.toLowerCase().includes(searchTerm.toLowerCase())) {
                this.searchResults.push({
                    page: i,
                    text: text
                });
            }
        }

        const searchResults = container.querySelector('.pdf-search-results');
        const totalMatches = container.querySelector('.total-matches');
        const prevButton = container.querySelector('.pdf-search-prev');
        const nextButton = container.querySelector('.pdf-search-next');

        if (this.searchResults.length > 0) {
            searchResults.style.display = 'inline';
            totalMatches.textContent = this.searchResults.length;
            prevButton.disabled = false;
            nextButton.disabled = false;
            this.goToNextSearchResult(container);
        } else {
            searchResults.style.display = 'none';
            prevButton.disabled = true;
            nextButton.disabled = true;
        }
    }

    async goToNextSearchResult(container) {
        if (this.searchResults.length === 0) return;

        this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResults.length;
        const result = this.searchResults[this.currentSearchIndex];

        if (result.page !== this.currentPage) {
            this.currentPage = result.page;
            await this.renderPage(container.querySelector('canvas'), container);
        }

        container.querySelector('.current-match').textContent = this.currentSearchIndex + 1;
        this.highlightSearchResult(container, result);
    }

    async goToPrevSearchResult(container) {
        if (this.searchResults.length === 0) return;

        this.currentSearchIndex = (this.currentSearchIndex - 1 + this.searchResults.length) % this.searchResults.length;
        const result = this.searchResults[this.currentSearchIndex];

        if (result.page !== this.currentPage) {
            this.currentPage = result.page;
            await this.renderPage(container.querySelector('canvas'), container);
        }

        container.querySelector('.current-match').textContent = this.currentSearchIndex + 1;
        this.highlightSearchResult(container, result);
    }

    highlightSearchResult(container, result) {
        const textLayer = container.querySelector('.pdf-text-layer');
        if (!textLayer) return;

        // Remove previous highlights
        textLayer.querySelectorAll('.search-highlight').forEach(el => {
            el.classList.remove('search-highlight');
        });

        // Add new highlight
        const searchTerm = container.querySelector('.pdf-search-input').value;
        const textDivs = textLayer.querySelectorAll('span');
        textDivs.forEach(div => {
            if (div.textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
                div.classList.add('search-highlight');
            }
        });
    }

    initializeEventHandlers(container, canvas, annotationLayer) {
        // Page navigation
        container.querySelector('.pdf-prev').addEventListener('click', async () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                await this.renderPage(canvas, container);
            }
        });

        container.querySelector('.pdf-next').addEventListener('click', async () => {
            if (this.currentPDF && this.currentPage < this.currentPDF.numPages) {
                this.currentPage++;
                await this.renderPage(canvas, container);
            }
        });

        // Zoom controls
        container.querySelector('.pdf-zoom-in').addEventListener('click', async () => {
            this.zoom = Math.min(this.zoom + 0.25, 3.0);
            await this.renderPage(canvas, container);
        });

        container.querySelector('.pdf-zoom-out').addEventListener('click', async () => {
            this.zoom = Math.max(this.zoom - 0.25, 0.25);
            await this.renderPage(canvas, container);
        });

        // Rotation
        container.querySelector('.pdf-rotate').addEventListener('click', async () => {
            this.rotation = (this.rotation + 90) % 360;
            await this.renderPage(canvas, container);
        });

        // Search functionality
        const searchInput = container.querySelector('.pdf-search-input');
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (searchInput.value.length >= 3) {
                    this.searchPDF(searchInput.value, container);
                }
            }, 300);
        });

        container.querySelector('.pdf-search-next').addEventListener('click', () => {
            this.goToNextSearchResult(container);
        });

        container.querySelector('.pdf-search-prev').addEventListener('click', () => {
            this.goToPrevSearchResult(container);
        });

        // Thumbnails toggle
        container.querySelector('.pdf-toggle-thumbnails').addEventListener('click', () => {
            container.querySelector('.pdf-thumbnails').classList.toggle('show');
        });

        container.querySelector('.close-thumbnails').addEventListener('click', () => {
            container.querySelector('.pdf-thumbnails').classList.remove('show');
        });

        // Fullscreen
        container.querySelector('.pdf-fullscreen').addEventListener('click', () => {
            if (!document.fullscreenElement) {
                container.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', async (e) => {
            if (container.contains(document.activeElement)) {
                if (e.key === 'ArrowLeft' && this.currentPage > 1) {
                    this.currentPage--;
                    await this.renderPage(canvas, container);
                } else if (e.key === 'ArrowRight' && this.currentPDF && this.currentPage < this.currentPDF.numPages) {
                    this.currentPage++;
                    await this.renderPage(canvas, container);
                }
            }
        });

        // Touch gestures
        let touchStartX = 0;
        let touchStartY = 0;
        let initialPinchDistance = 0;

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Pinch gesture start
                initialPinchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            } else if (e.touches.length === 1) {
                // Swipe gesture start
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        });

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                // Pinch gesture for zoom
                e.preventDefault();
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = currentDistance - initialPinchDistance;
                if (Math.abs(delta) > 10) {
                    this.zoom = Math.max(0.25, Math.min(3.0, this.zoom + (delta > 0 ? 0.1 : -0.1)));
                    this.renderPage(canvas, container);
                    initialPinchDistance = currentDistance;
                }
            }
        });

        canvas.addEventListener('touchend', async (e) => {
            if (e.touches.length === 0 && touchStartX !== 0) {
                // Swipe gesture end
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;

                // Only handle horizontal swipes
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                    if (deltaX > 0 && this.currentPage > 1) {
                        // Swipe right - previous page
                        this.currentPage--;
                        await this.renderPage(canvas, container);
                    } else if (deltaX < 0 && this.currentPDF && this.currentPage < this.currentPDF.numPages) {
                        // Swipe left - next page
                        this.currentPage++;
                        await this.renderPage(canvas, container);
                    }
                }
            }
            touchStartX = 0;
            touchStartY = 0;
            initialPinchDistance = 0;
        });
    }
}

export function createPDFViewer(url) {
    const viewer = new PDFViewer();
    return viewer.createViewer(url);
}