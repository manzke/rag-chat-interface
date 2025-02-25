export class ProgressIndicator {
    constructor() {
        this.metrics = null;
    }

    createElements() {
        const container = document.createElement('div');
        container.className = 'progress-container';
        
        // Create metrics container
        const metrics = document.createElement('div');
        metrics.className = 'progress-metrics';

        // Create metrics toggle button
        const metricsToggle = document.createElement('button');
        metricsToggle.className = 'metrics-toggle';
        metricsToggle.innerHTML = '<i class="fas fa-chevron-down"></i> Show processing details';
        metricsToggle.addEventListener('click', () => {
            metricsToggle.classList.toggle('expanded');
            metricsDetails.classList.toggle('expanded');
            metricsToggle.innerHTML = metricsToggle.classList.contains('expanded') 
                ? '<i class="fas fa-chevron-down"></i> Hide processing details'
                : '<i class="fas fa-chevron-down"></i> Show processing details';
        });

        // Create metrics details container
        const metricsDetails = document.createElement('div');
        metricsDetails.className = 'metrics-details';
        
        metrics.appendChild(metricsToggle);
        metrics.appendChild(metricsDetails);
        container.appendChild(metrics);
        
        this.elements = {
            container,
            metrics,
            metricsToggle,
            metricsDetails
        };
        
        return container;
    }

    updateMetrics(telemetry) {
        this.metrics = telemetry;
        if (this.elements?.metricsDetails) {
            this.elements.metricsDetails.innerHTML = this.formatMetrics(telemetry);
            this.elements.metricsToggle.style.display = 'flex';
        }
    }

    formatMetrics(metrics) {
        if (!metrics) return '';

        const telemetry = typeof metrics.telemetry === 'string' 
            ? JSON.parse(metrics.telemetry).telemetry 
            : metrics.telemetry;

        let html = '<div class="metrics-details">';
        
        // Search metrics
        if (telemetry.retrieval_number_of_candidate_documents) {
            html += `
                <div class="metric">
                    <i class="fas fa-search"></i>
                    <div class="metric-info">
                        <span class="metric-label">Documents searched:</span>
                        <span class="metric-value">${telemetry.retrieval_number_of_candidate_documents}</span>
                    </div>
                </div>
                <div class="metric">
                    <i class="fas fa-file-alt"></i>
                    <div class="metric-info">
                        <span class="metric-label">Relevant passages:</span>
                        <span class="metric-value">${telemetry.retrieval_final_number_of_retrieved_passages}</span>
                    </div>
                </div>
            `;
        }

        // Model information
        if (telemetry.model) {
            html += `
                <div class="metric">
                    <i class="fas fa-robot"></i>
                    <div class="metric-info">
                        <span class="metric-label">Model:</span>
                        <span class="metric-value">${telemetry.model.split('/').pop()}</span>
                    </div>
                </div>
            `;
        }

        // Token usage
        if (telemetry.usage) {
            html += `
                <div class="metric">
                    <i class="fas fa-calculator"></i>
                    <div class="metric-info">
                        <span class="metric-label">Tokens used:</span>
                        <span class="metric-value">${telemetry.usage.total_tokens}</span>
                    </div>
                </div>
            `;
        }

        // Language detection
        if (telemetry.detected_question_language) {
            html += `
                <div class="metric">
                    <i class="fas fa-language"></i>
                    <div class="metric-info">
                        <span class="metric-label">Detected language:</span>
                        <span class="metric-value">${telemetry.detected_question_language}</span>
                    </div>
                </div>
            `;
        }

        // Performance metrics
        if (telemetry.overall_duration) {
            html += `
                <div class="metric">
                    <i class="fas fa-clock"></i>
                    <div class="metric-info">
                        <span class="metric-label">Total processing time:</span>
                        <span class="metric-value">${telemetry.overall_duration.toFixed(1)}s</span>
                    </div>
                </div>
            `;
        }

        // Detailed timing metrics (collapsible)
        if (telemetry.retrieval_query_generation_duration || 
            telemetry.retrieval_query_execution_duration || 
            telemetry.abstract_generation_duration) {
            html += `
                <div class="metric-group">
                    <details>
                        <summary>Detailed timings</summary>
                        ${telemetry.retrieval_query_generation_duration ? `
                            <div class="metric sub-metric">
                                <div class="metric-info">
                                    <span class="metric-label">Query generation:</span>
                                    <span class="metric-value">${telemetry.retrieval_query_generation_duration.toFixed(2)}s</span>
                                </div>
                            </div>
                        ` : ''}
                        ${telemetry.retrieval_query_execution_duration ? `
                            <div class="metric sub-metric">
                                <div class="metric-info">
                                    <span class="metric-label">Query execution:</span>
                                    <span class="metric-value">${telemetry.retrieval_query_execution_duration.toFixed(2)}s</span>
                                </div>
                            </div>
                        ` : ''}
                        ${telemetry.abstract_generation_duration ? `
                            <div class="metric sub-metric">
                                <div class="metric-info">
                                    <span class="metric-label">Answer generation:</span>
                                    <span class="metric-value">${telemetry.abstract_generation_duration.toFixed(2)}s</span>
                                </div>
                            </div>
                        ` : ''}
                    </details>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    complete() {
        setTimeout(() => {
            this.elements.container.classList.add('fade-out');
            setTimeout(() => {
                this.elements.container.remove();
            }, 500);
        }, 1000);
    }
}