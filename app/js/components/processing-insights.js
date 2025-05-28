export class ProcessingInsights {
    constructor() {
        this.metrics = null;
        this.elements = null;
    }

    createElements() {
        const container = document.createElement('div');
        container.className = 'processing-insights';
        
        // Create metrics container
        const metrics = document.createElement('div');
        metrics.className = 'metrics-container';

        // Create metrics details container first
        const metricsDetails = document.createElement('div');
        metricsDetails.className = 'metrics-details';

        // Create metrics toggle button
        const metricsToggle = document.createElement('button');
        metricsToggle.className = 'metrics-toggle';
        metricsToggle.innerHTML = '<i class="fas fa-chevron-down"></i> Show processing details';
        metricsToggle.style.display = 'none'; // Hidden until we have metrics
        metricsToggle.addEventListener('click', () => {
            metricsToggle.classList.toggle('expanded');
            metricsDetails.classList.toggle('expanded');
            metricsToggle.innerHTML = metricsToggle.classList.contains('expanded') 
                ? '<i class="fas fa-chevron-down"></i> Hide processing details'
                : '<i class="fas fa-chevron-down"></i> Show processing details';
        });
        
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

    updateMetrics(metrics) {
        if (!metrics) return;

        console.debug('Updating metrics with:', metrics);

        this.metrics = metrics;
        if (this.elements?.metricsDetails) {
            this.elements.metricsDetails.innerHTML = this.formatMetrics(metrics.telemetry);
            
            // Show the toggle button but keep the details collapsed by default
            this.elements.metricsToggle.style.display = 'flex';
            this.elements.metricsDetails.classList.remove('expanded');
            this.elements.metricsToggle.classList.remove('expanded');
            
            // If we have complete metrics, update any background color transitions
            if (metrics.completion === 100) {
                this.elements.container.classList.add('complete');
            }
        }
    }

    formatMetrics(metrics) {
        if (!metrics?.telemetry) return '';

        const telemetry = metrics.telemetry;
        let html = '';

        // Debug output to verify what we're getting
        console.debug('Formatting metrics:', JSON.stringify(telemetry, null, 2));
        
        // Query information
        if (telemetry.retrieval_query_generation_result_text) {
            try {
                const queryText = telemetry.retrieval_query_generation_result_text;
                
                // Extract semantic queries
                const semanticMatches = queryText.match(/semanticQueries=\[(.*?)\]/);
                const semanticQueries = semanticMatches ? 
                    semanticMatches[1].split(',').map(q => q.trim()).filter(q => q) : [];
                
                // Extract keyword queries
                const keywordMatches = queryText.match(/keywordQueries=\[(.*?)\]/);
                const keywordQueries = keywordMatches ? 
                    keywordMatches[1].split(',').map(q => q.trim()).filter(q => q) : [];
                
                if (semanticQueries.length > 0) {
                    html += `
                        <div class="query-info">
                            <div class="metric">
                                <i class="fas fa-brain"></i>
                                <div class="metric-info">
                                    <span class="metric-label">Semantic queries</span>
                                    <pre>${semanticQueries.join('\n')}</pre>
                                </div>
                            </div>
                            ${keywordQueries.length > 0 ? `
                                <div class="metric">
                                    <i class="fas fa-key"></i>
                                    <div class="metric-info">
                                        <span class="metric-label">Keyword queries</span>
                                        <pre>${keywordQueries.join('\n')}</pre>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }
            } catch (error) {
                console.debug('Could not parse query data:', error);
            }
        }
        
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

        if (telemetry.retrieval_query_generation_duration) {
            html += `
                <div class="metric">
                    <i class="fas fa-clock"></i>
                    <div class="metric-info">
                        <span class="metric-label">Query generation time:</span>
                        <span class="metric-value">${telemetry.retrieval_query_generation_duration.toFixed(2)}s</span>
                    </div>
                </div>
            `;
        }

        if (telemetry.retrieval_query_execution_duration) {
            html += `
                <div class="metric">
                    <i class="fas fa-clock"></i>
                    <div class="metric-info">
                        <span class="metric-label">Query execution time:</span>
                        <span class="metric-value">${telemetry.retrieval_query_execution_duration.toFixed(2)}s</span>
                    </div>
                </div>
            `;
        }

        if (telemetry.abstract_generation_duration) {
            html += `
                <div class="metric">
                    <i class="fas fa-clock"></i>
                    <div class="metric-info">
                        <span class="metric-label">Answer generation time:</span>
                        <span class="metric-value">${telemetry.abstract_generation_duration.toFixed(2)}s</span>
                    </div>
                </div>
            `;
        }

        return html;
    }

    complete() {
        // Only add completion state if we have complete metrics
        if (this.metrics?.telemetry?.overall_duration) {
            this.elements.container.classList.add('complete');
        }
    }
}