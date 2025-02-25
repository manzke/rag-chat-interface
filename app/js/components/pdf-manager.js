import { createPDFViewer } from '../pdf-viewer.js';

export class PDFManager {
    constructor() {
        this.setupGlobalHandler();
        this.setupDragAndDrop();
        this.blobUrls = new Set();
    }

    setupGlobalHandler() {
        window.handlePDFLink = (url) => {
            const viewer = createPDFViewer(url);
            document.body.appendChild(viewer);
        };
    }

    setupDragAndDrop() {
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const files = Array.from(e.dataTransfer.files);
            const pdfFiles = files.filter(file => 
                file.type === 'application/pdf' || 
                file.name.toLowerCase().endsWith('.pdf')
            );

            pdfFiles.forEach(file => {
                const url = URL.createObjectURL(file);
                this.blobUrls.add(url);
                const viewer = createPDFViewer(url);
                viewer.addEventListener('closed', () => {
                    URL.revokeObjectURL(url);
                    this.blobUrls.delete(url);
                });
                document.body.appendChild(viewer);
            });
        });
    }

    createDocumentLink(url, title, isPDF = false) {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes("doc.do")) {
            isPDF = true;
            url = "/" + url;
        }

        if (isPDF) {
            return `<a href="javascript:void(0)" 
                        onclick="handlePDFLink('${url}')" 
                        class="document-link">
                        ${title || 'View document'}
                        <i class="fas fa-external-link-alt"></i>
                    </a>`;
        } else {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">
                    ${title || 'Open document'}
                    <i class="fas fa-external-link-alt"></i>
                </a>`;
        }
    }

    cleanup() {
        // Revoke all blob URLs
        this.blobUrls.forEach(url => {
            URL.revokeObjectURL(url);
        });
        this.blobUrls.clear();

        // Remove PDF viewers from DOM
        const viewers = document.querySelectorAll('.pdf-viewer');
        viewers.forEach(viewer => viewer.remove());
    }
}