// Import PDF.js
import pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/+esm';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js';

class PDFViewer {
    constructor() {
        this.currentPDF = null;
        this.currentPage = 1;
        this.zoom = 1.0;
        this.rotation = 0;
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
            <div class="pdf-zoom-controls">
                <button class="pdf-zoom-out" title="Zoom Out">
                    <i class="fas fa-search-minus"></i>
                </button>
                <span class="pdf-zoom-level">100%</span>
                <button class="pdf-zoom-in" title="Zoom In">
                    <i class="fas fa-search-plus"></i>
                </button>
            </div>
            <div class="pdf-rotate-controls">
                <button class="pdf-rotate" title="Rotate">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
            <div class="pdf-download">
                <a href="${url}" download title="Download PDF">
                    <i class="fas fa-download"></i>
                </a>
            </div>
        `;

        // Create canvas container
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'pdf-canvas-container';
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);

        // Add elements to container
        container.appendChild(toolbar);
        container.appendChild(canvasContainer);

        // Add event listeners
        this.addEventListeners(container, canvas);

        // Load PDF
        this.loadPDF(url, canvas, container);

        return container;
    }

    async loadPDF(url, canvas, container) {
        try {
            // Load the PDF
            const pdf = await pdfjsLib.getDocument(url).promise;
            this.currentPDF = pdf;
            
            // Update total pages
            container.querySelector('.pdf-total-pages').textContent = pdf.numPages;
            
            // Render first page
            this.renderPage(canvas, container);
        } catch (error) {
            console.error('Error loading PDF:', error);
            container.innerHTML = `
                <div class="pdf-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error loading PDF. Please try again later.</p>
                </div>
            `;
        }
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
        } catch (error) {
            console.error('Error rendering page:', error);
        }
    }

    addEventListeners(container, canvas) {
        // Page navigation
        container.querySelector('.pdf-prev').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderPage(canvas, container);
            }
        });

        container.querySelector('.pdf-next').addEventListener('click', () => {
            if (this.currentPDF && this.currentPage < this.currentPDF.numPages) {
                this.currentPage++;
                this.renderPage(canvas, container);
            }
        });

        // Zoom controls
        container.querySelector('.pdf-zoom-in').addEventListener('click', () => {
            this.zoom = Math.min(this.zoom + 0.25, 3.0);
            this.renderPage(canvas, container);
        });

        container.querySelector('.pdf-zoom-out').addEventListener('click', () => {
            this.zoom = Math.max(this.zoom - 0.25, 0.25);
            this.renderPage(canvas, container);
        });

        // Rotation
        container.querySelector('.pdf-rotate').addEventListener('click', () => {
            this.rotation = (this.rotation + 90) % 360;
            this.renderPage(canvas, container);
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (container.contains(document.activeElement)) {
                if (e.key === 'ArrowLeft' && this.currentPage > 1) {
                    this.currentPage--;
                    this.renderPage(canvas, container);
                } else if (e.key === 'ArrowRight' && this.currentPDF && this.currentPage < this.currentPDF.numPages) {
                    this.currentPage++;
                    this.renderPage(canvas, container);
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

        canvas.addEventListener('touchend', (e) => {
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
                        this.renderPage(canvas, container);
                    } else if (deltaX < 0 && this.currentPDF && this.currentPage < this.currentPDF.numPages) {
                        // Swipe left - next page
                        this.currentPage++;
                        this.renderPage(canvas, container);
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