export function generateTelemetry(question, stage = 'initial', actualTimings = {}) {
  const isGerman = /[äöüßÄÖÜ]/.test(question);
  
  if (stage === 'initial') {
    return {
      telemetry: {
        retrieval_query_generation_result_text: `GeneratedQueries[semanticQueries=[${question}], keywordQueries=[${question.split(' ').slice(0, 3).join(' ')}]]`,
        usage: {
          prompt_tokens: 889,
          total_tokens: 915,
          completion_tokens: 26
        },
        retrieval_query_execution_number_of_passages_in_query_result: 20,
        retrieval_final_number_of_retrieved_passages: 8,
        retrieval_query_generation_duration: actualTimings.retrieval_query_generation_duration || 1.743,
        retrieval_query_execution_duration: actualTimings.retrieval_query_execution_duration || 0.14,
        retrieval_passage_processing_duration: actualTimings.retrieval_passage_processing_duration || 0.007,
        detected_question_language: isGerman ? "German" : "English",
        language_detection_duration: 0.001,
        model: "hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4",
        retrieval_threshold_passage_retrieval: 0.9212912,
        retrieval_duration: actualTimings.retrieval_duration || 0.257,
        retrieval_number_of_candidate_documents: 16
      }
    };
  } else {
    return {
      telemetry: {
        abstract_generation_first_chunk_duration: actualTimings.abstract_generation_first_chunk_duration || 2.391,
        usage: {
          prompt_tokens: 1719,
          total_tokens: 1773,
          completion_tokens: 54
        },
        related_questions_total_generation_duration: actualTimings.related_questions_total_generation_duration || 3.326,
        detected_question_language: isGerman ? "German" : "English",
        language_detection_duration: 0.001,
        model: "hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4",
        abstract_generation_duration: actualTimings.abstract_generation_duration || 15.651,
        overall_duration: actualTimings.overall_duration || 20.995
      }
    };
  }
}

export function generateResponse(question) {
  return `# Answer to: ${question}

Here's a sample PDF document that you can view directly in our PDF viewer:

## Example Table

| Feature       | Status    | Description                           |
|--------------|-----------|---------------------------------------|
| PDF Viewer   | ✅ Active  | View and interact with PDF documents  |
| Text Search  | ✅ Active  | Search within PDF content             |
| Annotations  | ✅ Active  | Add notes and highlights              |
| Dark Mode    | ✅ Active  | Toggle between light and dark themes  |
| Mobile View  | ✅ Active  | Responsive design for mobile devices  |

## System Information

| Component    | Version   | Status    |
|-------------|-----------|-----------|
| PDF.js      | 3.11.174  | Connected |
| Marked      | Latest    | Active    |
| Highlight.js| 11.9.0    | Active    |
| KaTeX       | 0.16.9    | Ready     |

[Sample PDF Document](/api/v2/pdf/sample.pdf)
`;
}