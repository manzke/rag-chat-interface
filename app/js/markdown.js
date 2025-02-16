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

// Register languages
hljs.registerLanguage('python', python);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

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

// Add target="_blank" to external links
renderer.link = (href, title, text) => {
    if (href.startsWith('http')) {
        return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
    return `<a href="${href}" title="${title || ''}">${text}</a>`;
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

// Function to process math expressions (optional)
export function processMathExpressions(container) {
    if (typeof katex !== 'undefined') {
        container.querySelectorAll('.math-inline, .math-display').forEach(el => {
            try {
                const math = el.textContent;
                const isDisplay = el.classList.contains('math-display');
                katex.render(math, el, { 
                    displayMode: isDisplay,
                    throwOnError: false
                });
            } catch (e) {
                console.error('Math processing error:', e);
            }
        });
    }
}