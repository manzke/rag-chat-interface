// Import PDF.js (using CDN for both library and worker)
const pdfjsLib = window.pdfjsLib;

class PDFViewer {
    constructor() {
        this.pdfDoc = null;
        this.pageNum = 1;
        this.pageRendering = false;
        this.pageNumPending = null;
        this.scale = 1.0;
        this.rotation = 0;
        this.searchResults = [];
        this.currentSearchIndex = -1;
        this.passages = [];
    }

    createViewer(url, passages = []) {
        this.passages = passages;

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'pdf-overlay';
        
        // Create viewer container
        const container = document.createElement('div');
        container.className = 'pdf-container';

        // Create sidebar for thumbnails
        const sidebar = document.createElement('div');
        sidebar.className = 'pdf-sidebar';
        sidebar.innerHTML = `
            <div class="pdf-thumbnails">
                <div class="thumbnails-header">Thumbnails</div>
                <div class="thumbnails-container"></div>
            </div>
            ${this.passages.length > 0 ? `
                <div class="pdf-passages">
                    <div class="passages-header">Passages</div>
                    <div class="passages-container">
                        ${this.passages.map((passage, index) => `
                            <div class="passage-item" data-text="${passage.text}">
                                <div class="passage-number">${index + 1}</div>
                                <div class="passage-preview">${passage.text.substring(0, 100)}...</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        // Create main content
        const content = document.createElement('div');
        content.className = 'pdf-content';

        // Create header with controls
        const header = document.createElement('div');
        header.className = 'pdf-header';
        header.innerHTML = `
            <div class="pdf-controls">
                <div class="pdf-nav-controls">
                    <button class="pdf-prev" title="Previous Page">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span>Page <span class="page-num">1</span> of <span class="page-count">--</span></span>
                    <button class="pdf-next" title="Next Page">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                <div class="pdf-view-controls">
                    <button class="pdf-rotate-left" title="Rotate Left">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button class="pdf-rotate-right" title="Rotate Right">
                        <i class="fas fa-redo"></i>
                    </button>
                    <button class="pdf-zoomout" title="Zoom Out">
                        <i class="fas fa-search-minus"></i>
                    </button>
                    <button class="pdf-zoomin" title="Zoom In">
                        <i class="fas fa-search-plus"></i>
                    </button>
                </div>
                <div class="pdf-search-controls">
                    <div class="search-input">
                        <input type="text" class="pdf-search-input" placeholder="Search in document...">
                        <button class="pdf-search-prev" title="Previous Match" disabled>
                            <i class="fas fa-chevron-up"></i>
                        </button>
                        <button class="pdf-search-next" title="Next Match" disabled>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                    <span class="pdf-search-results" style="display: none">
                        Match <span class="current-match">0</span> of <span class="total-matches">0</span>
                    </span>
                </div>
            </div>
            <button class="pdf-close" title="Close (Esc)">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Create viewer
        const viewer = document.createElement('div');
        viewer.className = 'pdf-viewer';
        const canvas = document.createElement('canvas');
        viewer.appendChild(canvas);

        // Assemble the components
        content.appendChild(header);
        content.appendChild(viewer);
        container.appendChild(sidebar);
        container.appendChild(content);
        overlay.appendChild(container);

        this.container = container;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Event listeners for navigation
        header.querySelector('.pdf-prev').addEventListener('click', () => this.prevPage());
        header.querySelector('.pdf-next').addEventListener('click', () => this.nextPage());
        header.querySelector('.pdf-zoomin').addEventListener('click', () => this.zoomIn());
        header.querySelector('.pdf-zoomout').addEventListener('click', () => this.zoomOut());
        header.querySelector('.pdf-rotate-left').addEventListener('click', () => this.rotate(-90));
        header.querySelector('.pdf-rotate-right').addEventListener('click', () => this.rotate(90));

        // Search functionality
        const searchInput = header.querySelector('.pdf-search-input');
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (searchInput.value.length >= 3) {
                    this.search(searchInput.value);
                }
            }, 300);
        });

        header.querySelector('.pdf-search-prev').addEventListener('click', () => this.prevSearchResult());
        header.querySelector('.pdf-search-next').addEventListener('click', () => this.nextSearchResult());

        // Passage click handlers
        if (this.passages.length > 0) {
            container.querySelectorAll('.passage-item').forEach(item => {
                item.addEventListener('click', () => {
                    const text = item.dataset.text;
                    searchInput.value = text;
                    this.search(text);
                });
            });
        }

        // Close button handler
        const closeViewer = () => {
            // Clean up resources
            if (this.pdfDoc) {
                this.pdfDoc.destroy();
                this.pdfDoc = null;
            }
            
            // Remove event listeners
            document.removeEventListener('keydown', handleEsc);
            
            // Remove the viewer from DOM
            overlay.remove();
            
            // Restore body scroll
            document.body.style.overflow = '';
        };
        
        header.querySelector('.pdf-close').addEventListener('click', closeViewer);
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeViewer();
            }
        });
        
        // ESC key handler
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeViewer();
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (container.contains(document.activeElement)) {
                if (e.key === 'ArrowLeft' && !e.ctrlKey) {
                    this.prevPage();
                } else if (e.key === 'ArrowRight' && !e.ctrlKey) {
                    this.nextPage();
                } else if (e.key === 'ArrowUp' && e.ctrlKey) {
                    this.prevSearchResult();
                } else if (e.key === 'ArrowDown' && e.ctrlKey) {
                    this.nextSearchResult();
                }
            }
        });
        
        // Prevent body scrolling when viewer is open
        document.body.style.overflow = 'hidden';

        // Load PDF
        this.loadPDF(url);

        return overlay;
    }

    async loadPDF(url) {
        try {
            this.pdfDoc = await pdfjsLib.getDocument(url).promise;
            this.container.querySelector('.page-count').textContent = this.pdfDoc.numPages;
            
            // Generate thumbnails
            await this.generateThumbnails();
            
            // Render first page
            await this.renderPage(this.pageNum);
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.container.innerHTML = `
                <div class="pdf-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error loading PDF. Please try again later.</p>
                </div>
            `;
        }
    }

    async generateThumbnails() {
        const container = this.container.querySelector('.thumbnails-container');
        container.innerHTML = '';

        for (let i = 1; i <= this.pdfDoc.numPages; i++) {
            const page = await this.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const wrapper = document.createElement('div');
            wrapper.className = 'thumbnail-wrapper';
            wrapper.dataset.page = i;
            if (i === this.pageNum) wrapper.classList.add('active');

            wrapper.appendChild(canvas);
            container.appendChild(wrapper);

            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            wrapper.addEventListener('click', () => {
                this.pageNum = i;
                this.renderPage(i);
                container.querySelectorAll('.thumbnail-wrapper').forEach(w => {
                    w.classList.toggle('active', w.dataset.page === String(i));
                });
            });
        }
    }

    async renderPage(num) {
        if (this.pageRendering) {
            this.pageNumPending = num;
            return;
        }

        this.pageRendering = true;
        const page = await this.pdfDoc.getPage(num);

        const viewport = page.getViewport({ 
            scale: this.scale,
            rotation: this.rotation
        });

        this.canvas.height = viewport.height;
        this.canvas.width = viewport.width;

        try {
            await page.render({
                canvasContext: this.ctx,
                viewport: viewport
            }).promise;

            // Update text layer
            await this.updateTextLayer(page, viewport);

            this.pageRendering = false;
            this.container.querySelector('.page-num').textContent = num;

            // Update thumbnail selection
            this.container.querySelectorAll('.thumbnail-wrapper').forEach(wrapper => {
                wrapper.classList.toggle('active', wrapper.dataset.page === String(num));
            });

            if (this.pageNumPending !== null) {
                this.renderPage(this.pageNumPending);
                this.pageNumPending = null;
            }
        } catch (error) {
            console.error('Error rendering page:', error);
            this.pageRendering = false;
        }
    }

    async updateTextLayer(page, viewport) {
        let textLayer = this.container.querySelector('.pdf-text-layer');
        
        if (textLayer) {
            textLayer.remove();
        }

        textLayer = document.createElement('div');
        textLayer.className = 'pdf-text-layer';
        
        const canvas = this.canvas;
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        
        canvas.parentNode.appendChild(textLayer);
        canvas.parentNode.style.setProperty('--scale-factor', viewport.scale);

        try {
            const textContent = await page.getTextContent();
            await pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayer,
                viewport: viewport,
                textDivs: []
            }).promise;
        } catch (error) {
            console.error('Error rendering text layer:', error);
            textLayer.remove();
        }
    }

    async search(query) {
        this.searchResults = [];
        this.currentSearchIndex = -1;

        for (let i = 1; i <= this.pdfDoc.numPages; i++) {
            const page = await this.pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');

            if (text.toLowerCase().includes(query.toLowerCase())) {
                this.searchResults.push({
                    page: i,
                    text: text
                });
            }
        }

        const searchResults = this.container.querySelector('.pdf-search-results');
        const totalMatches = this.container.querySelector('.total-matches');
        const prevButton = this.container.querySelector('.pdf-search-prev');
        const nextButton = this.container.querySelector('.pdf-search-next');

        if (this.searchResults.length > 0) {
            searchResults.style.display = 'inline';
            totalMatches.textContent = this.searchResults.length;
            prevButton.disabled = false;
            nextButton.disabled = false;
            this.nextSearchResult();
        } else {
            searchResults.style.display = 'none';
            prevButton.disabled = true;
            nextButton.disabled = true;
        }
    }

    async nextSearchResult() {
        if (this.searchResults.length === 0) return;

        this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResults.length;
        const result = this.searchResults[this.currentSearchIndex];

        if (result.page !== this.pageNum) {
            this.pageNum = result.page;
            await this.renderPage(result.page);
        }

        this.container.querySelector('.current-match').textContent = this.currentSearchIndex + 1;
    }

    async prevSearchResult() {
        if (this.searchResults.length === 0) return;

        this.currentSearchIndex = (this.currentSearchIndex - 1 + this.searchResults.length) % this.searchResults.length;
        const result = this.searchResults[this.currentSearchIndex];

        if (result.page !== this.pageNum) {
            this.pageNum = result.page;
            await this.renderPage(result.page);
        }

        this.container.querySelector('.current-match').textContent = this.currentSearchIndex + 1;
    }

    prevPage() {
        if (this.pageNum <= 1) return;
        this.pageNum--;
        this.renderPage(this.pageNum);
    }

    nextPage() {
        if (this.pageNum >= this.pdfDoc.numPages) return;
        this.pageNum++;
        this.renderPage(this.pageNum);
    }

    zoomIn() {
        this.scale = Math.min(this.scale * 1.25, 3.0);
        this.renderPage(this.pageNum);
    }

    zoomOut() {
        this.scale = Math.max(this.scale * 0.8, 0.25);
        this.renderPage(this.pageNum);
    }

    rotate(angle) {
        this.rotation = (this.rotation + angle + 360) % 360;
        this.renderPage(this.pageNum);
    }
}

export function createPDFViewer(url, passages = []) {
    const viewer = new PDFViewer();
    return viewer.createViewer(url, passages);
}