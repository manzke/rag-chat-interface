export function generateResponse(question, baseUrl) {
    return `# Answer to: ${question}

Here's a sample PDF document that you can view directly in our PDF viewer:

📄 [Sample PDF Document](/api/v2/pdf/sample.pdf)

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

`;
}