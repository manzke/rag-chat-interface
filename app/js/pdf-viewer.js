// Import PDF.js (using CDN for both library and worker)
const pdfjsLib = window.pdfjsLib;

class PDFViewer {
    constructor() {
        this.pdfDoc = null;
        this.pageNum = 1;
        this.pageRendering = false;
        this.pageNumPending = null;
        this.scale = 1.0;
    }

    createViewer(url) {
        const container = document.createElement('div');
        container.className = 'pdf-container';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'pdf-toolbar';
        toolbar.innerHTML = `
            <div class="pdf-controls">
                <button class="pdf-prev" title="Previous">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span>Page: <span class="page-num">1</span> / <span class="page-count">--</span></span>
                <button class="pdf-next" title="Next">
                    <i class="fas fa-chevron-right"></i>
                </button>
                <button class="pdf-zoomin" title="Zoom In">
                    <i class="fas fa-search-plus"></i>
                </button>
                <button class="pdf-zoomout" title="Zoom Out">
                    <i class="fas fa-search-minus"></i>
                </button>
            </div>
        `;

        // Viewer element
        const viewer = document.createElement('div');
        viewer.className = 'pdf-viewer';
        const canvas = document.createElement('canvas');
        viewer.appendChild(canvas);

        container.appendChild(toolbar);
        container.appendChild(viewer);

        this.container = container;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Event listeners
        toolbar.querySelector('.pdf-prev').addEventListener('click', () => this.prevPage());
        toolbar.querySelector('.pdf-next').addEventListener('click', () => this.nextPage());
        toolbar.querySelector('.pdf-zoomin').addEventListener('click', () => this.zoomIn());
        toolbar.querySelector('.pdf-zoomout').addEventListener('click', () => this.zoomOut());

        // Load PDF
        this.loadPDF(url);

        return container;
    }

    async loadPDF(url) {
        try {
            this.pdfDoc = await pdfjsLib.getDocument(url).promise;
            this.container.querySelector('.page-count').textContent = this.pdfDoc.numPages;
            this.renderPage(this.pageNum);
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

    async renderPage(num) {
        if (this.pageRendering) {
            this.pageNumPending = num;
            return;
        }

        this.pageRendering = true;
        const page = await this.pdfDoc.getPage(num);

        // Scale viewport for the canvas
        const viewport = page.getViewport({ scale: this.scale });
        this.canvas.height = viewport.height;
        this.canvas.width = viewport.width;

        try {
            // Render PDF page
            await page.render({
                canvasContext: this.ctx,
                viewport: viewport
            }).promise;

            // Create text layer
            const textContent = await page.getTextContent();
            const textLayer = this.container.querySelector('.pdf-text-layer') || document.createElement('div');
            textLayer.className = 'pdf-text-layer';
            textLayer.style.width = `${viewport.width}px`;
            textLayer.style.height = `${viewport.height}px`;

            // Position text layer over canvas
            if (!textLayer.parentNode) {
                this.canvas.parentNode.appendChild(textLayer);
            }

            // Render text layer
            pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayer,
                viewport: viewport,
                textDivs: []
            });

            this.pageRendering = false;
            this.container.querySelector('.page-num').textContent = num;

            if (this.pageNumPending !== null) {
                this.renderPage(this.pageNumPending);
                this.pageNumPending = null;
            }
        } catch (error) {
            console.error('Error rendering page:', error);
            this.pageRendering = false;
        }
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
}

export function createPDFViewer(url) {
    const viewer = new PDFViewer();
    return viewer.createViewer(url);
}
