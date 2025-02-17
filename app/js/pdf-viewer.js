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
        this.annotations = new Map();
        this.isDrawing = false;
        this.isHighlighting = false;
        this.drawingContext = null;
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
                <div class="pdf-annotation-controls">
                    <button class="pdf-toggle-draw" title="Draw">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="pdf-toggle-highlight" title="Highlight">
                        <i class="fas fa-highlighter"></i>
                    </button>
                    <button class="pdf-add-note" title="Add Note">
                        <i class="fas fa-sticky-note"></i>
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
        const textLayer = container.querySelector('.pdf-text-layer');
        if (!textLayer) return;

        // Clear previous content
        textLayer.innerHTML = '';

        // Get text content
        const textContent = await page.getTextContent();

        // Set text layer viewport and position
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        textLayer.style.transform = `scale(${this.zoom})`;

        // Render text layer
        pdfjsLib.renderTextLayer({
            textContent: textContent,
            container: textLayer,
            viewport: viewport,
            textDivs: []
        });
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
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');

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

        // Annotation tools
        this.initializeAnnotationTools(container, canvas, annotationLayer);
    }

    initializeAnnotationTools(container, canvas, annotationLayer) {
        const drawButton = container.querySelector('.pdf-toggle-draw');
        const highlightButton = container.querySelector('.pdf-toggle-highlight');
        const noteButton = container.querySelector('.pdf-add-note');

        // Drawing
        drawButton.addEventListener('click', () => {
            this.isDrawing = !this.isDrawing;
            this.isHighlighting = false;
            drawButton.classList.toggle('active');
            highlightButton.classList.remove('active');
            annotationLayer.style.pointerEvents = this.isDrawing ? 'auto' : 'none';
        });

        // Highlighting
        highlightButton.addEventListener('click', () => {
            this.isHighlighting = !this.isHighlighting;
            this.isDrawing = false;
            highlightButton.classList.toggle('active');
            drawButton.classList.remove('active');
            annotationLayer.style.pointerEvents = this.isHighlighting ? 'auto' : 'none';
        });

        // Notes
        noteButton.addEventListener('click', () => {
            const note = prompt('Enter your note:');
            if (note) {
                this.addNote(note, annotationLayer);
            }
        });

        // Drawing events
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;

        annotationLayer.addEventListener('mousedown', (e) => {
            if (!this.isDrawing && !this.isHighlighting) return;

            isDrawing = true;
            const rect = annotationLayer.getBoundingClientRect();
            lastX = e.clientX - rect.left;
            lastY = e.clientY - rect.top;
        });

        annotationLayer.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;

            const rect = annotationLayer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (this.isDrawing) {
                this.drawLine(annotationLayer, lastX, lastY, x, y);
            } else if (this.isHighlighting) {
                this.highlight(annotationLayer, lastX, lastY, x, y);
            }

            lastX = x;
            lastY = y;
        });

        annotationLayer.addEventListener('mouseup', () => {
            isDrawing = false;
        });

        annotationLayer.addEventListener('mouseleave', () => {
            isDrawing = false;
        });
    }

    drawLine(layer, x1, y1, x2, y2) {
        if (!this.drawingContext) {
            this.drawingContext = layer.getContext('2d');
            this.drawingContext.strokeStyle = '#000000';
            this.drawingContext.lineWidth = 2;
            this.drawingContext.lineCap = 'round';
        }

        this.drawingContext.beginPath();
        this.drawingContext.moveTo(x1, y1);
        this.drawingContext.lineTo(x2, y2);
        this.drawingContext.stroke();
    }

    highlight(layer, x1, y1, x2, y2) {
        if (!this.drawingContext) {
            this.drawingContext = layer.getContext('2d');
            this.drawingContext.fillStyle = 'rgba(255, 255, 0, 0.3)';
        }

        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);

        this.drawingContext.fillRect(x, y, width, height);
    }

    addNote(text, layer) {
        const note = document.createElement('div');
        note.className = 'pdf-note';
        note.innerHTML = `
            <div class="note-header">
                <i class="fas fa-sticky-note"></i>
                <button class="close-note">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="note-content">${text}</div>
        `;

        note.style.left = '50%';
        note.style.top = '50%';
        layer.appendChild(note);

        // Make note draggable
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        note.querySelector('.note-header').addEventListener('mousedown', (e) => {
            isDragging = true;
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                note.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        note.querySelector('.close-note').addEventListener('click', () => {
            note.remove();
        });
    }
}

export function createPDFViewer(url) {
    const viewer = new PDFViewer();
    return viewer.createViewer(url);
}