export function generateResponse(question, baseUrl) {
    return `# Answer to: ${question}

Here's a sample PDF document that you can view directly in our PDF viewer:

📄 [Sample PDF Document](${baseUrl}/api/v2/pdf/sample.pdf)

## Example Table

| Feature       | Status    | Description                           |
|--------------|-----------|---------------------------------------|
| PDF Viewer   | ✅ Active  | View and interact with PDF documents  |
| Text Search  | ✅ Active  | Search within PDF content            |
| Annotations  | ✅ Active  | Add notes and highlights             |
| Dark Mode    | ✅ Active  | Toggle between light and dark themes |
| Mobile View  | ✅ Active  | Responsive design for mobile devices |

## System Information

| Component    | Version   | Status    |
|-------------|-----------|-----------|
| PDF.js      | 3.11.174  | Connected |
| Marked      | Latest    | Active    |
| Highlight.js| 11.9.0    | Active    |
| KaTeX       | 0.16.9    | Ready     |

## Code Examples

\`\`\`python
def process_pdf(file_path: str) -> dict:
    """Process a PDF file and extract its content."""
    return {
        "pages": 5,
        "text": "Example content...",
        "metadata": {
            "title": "Sample Document",
            "author": "OpenHands AI"
        }
    }
\`\`\`

## Math Example

The PDF viewer supports mathematical formulas:

Inline math: $f(x) = x^2 + 2x + 1$

Display math:
$$
\\begin{aligned}
\\frac{\\partial}{\\partial t} \\rho + \\nabla \\cdot (\\rho \\vec{v}) &= 0 \\\\
\\frac{\\partial}{\\partial t} (\\rho \\vec{v}) + \\nabla \\cdot (\\rho \\vec{v} \\otimes \\vec{v}) &= -\\nabla p + \\nabla \\cdot \\mathbf{T} + \\rho \\vec{g}
\\end{aligned}
$$

## Features List

1. **PDF Viewing**
   - Page navigation
   - Zoom controls
   - Rotation support
   - Fullscreen mode

2. **Text Interaction**
   - Text selection
   - Copy to clipboard
   - Search functionality
   - Text highlighting

3. **Annotations**
   - Freehand drawing
   - Text highlighting
   - Sticky notes
   - Shape tools

4. **Mobile Support**
   - Touch gestures
   - Responsive layout
   - Swipe navigation
   - Pinch zoom

> **Note**: All features are available in both light and dark themes.

This example demonstrates various markdown features including tables, code blocks, math expressions, and lists.`;
}