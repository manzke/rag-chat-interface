import '../css/markdown.css';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';
import hljs from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/highlight.min.js';

// Import additional languages for highlight.js
import python from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/python.min.js';
import javascript from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/javascript.min.js';
import typescript from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/typescript.min.js';
import bash from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/bash.min.js';
import sql from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/sql.min.js';
import json from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/json.min.js';
import xml from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/xml.min.js';
import yaml from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/yaml.min.js';
import css from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/css.min.js';

// Register languages
hljs.registerLanguage('python', python);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('css', css);

// Configure marked options
marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert line breaks to <br>
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (e) {
                console.error('Highlight error:', e);
            }
        }
        return code; // Use code as is if language not found
    }
});

// Custom renderer to add copy buttons to code blocks
const renderer = new marked.Renderer();
const originalCodeRenderer = renderer.code.bind(renderer);

renderer.code = (code, language) => {
    const html = originalCodeRenderer(code, language);
    return `
        <div class="code-block">
            <div class="code-header">
                ${language ? `<span class="code-language">${language}</span>` : ''}
                <button class="copy-code" title="Copy code">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            ${html}
        </div>
    `;
};

// Handle links including PDFs and other document types
renderer.link = (link, title, text) => {
    const href = link.href;
    // Function to check if URL points to a document
    const isDocument = (url) => {
        const docExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
        const lowerUrl = url.toLowerCase();
        return docExtensions.some(ext => lowerUrl.endsWith(ext)) ||
               lowerUrl.includes('doc.do') ||
               lowerUrl.includes('document') ||
               lowerUrl.includes('download');
    };

    // Function to get icon based on file type
    const getFileIcon = (url) => {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.endsWith('.pdf')) return 'fa-file-pdf';
        if (lowerUrl.match(/\.(doc|docx)$/)) return 'fa-file-word';
        if (lowerUrl.match(/\.(xls|xlsx)$/)) return 'fa-file-excel';
        if (lowerUrl.match(/\.(ppt|pptx)$/)) return 'fa-file-powerpoint';
        return 'fa-file';
    };

    if (isDocument(href)) {
        const icon = getFileIcon(href);
        return `
            <a href="javascript:void(0)" 
               onclick="handlePDFLink('${href}')" 
               title="${link.text || 'View document'}"
               class="document-link">
                <i class="fas ${icon}"></i>
                ${link.text}
            </a>`;
    } else if (href.startsWith('http')) {
        return `
            <a href="${href}" 
               title="${link.text || ''}" 
               target="_blank" 
               rel="noopener noreferrer">
                ${link.text}
                <i class="fas fa-external-link-alt"></i>
            </a>`;
    }
    return `<a href="${href}" title="${link.text || ''}">${link.text}</a>`;
};

// Add custom classes to tables
renderer.table = (header, body) => {
    return `
        <div class="table-container">
            <table class="markdown-table">
                <thead>${header}</thead>
                <tbody>${body}</tbody>
            </table>
        </div>
    `;
};

marked.use({ renderer });

// Function to process markdown
export function processMarkdown(text) {
    try {
        return marked(text);
    } catch (e) {
        console.error('Markdown processing error:', e);
        return text;
    }
}

// Function to add copy button functionality
export function initializeCodeCopyButtons(container) {
    container.querySelectorAll('.copy-code').forEach(button => {
        button.addEventListener('click', () => {
            const codeBlock = button.closest('.code-block');
            const code = codeBlock.querySelector('code').textContent;
            
            navigator.clipboard.writeText(code).then(() => {
                // Show success feedback
                const icon = button.querySelector('i');
                icon.className = 'fas fa-check';
                setTimeout(() => {
                    icon.className = 'fas fa-copy';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy code:', err);
                // Show error feedback
                const icon = button.querySelector('i');
                icon.className = 'fas fa-times';
                setTimeout(() => {
                    icon.className = 'fas fa-copy';
                }, 2000);
            });
        });
    });
}