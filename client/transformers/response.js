/**
 * Base transformer class
 */
class ResponseTransformer {
    transform(response) {
        throw new Error('Not implemented');
    }
}

/**
 * Transforms answer responses by combining words into sentences
 */
export class AnswerTransformer extends ResponseTransformer {
    constructor() {
        super();
        this.buffer = '';
        this.sentences = [];
    }

    transform(response) {
        if (response.event !== 'answer') {
            return response;
        }

        // Add word to buffer
        this.buffer += response.data + ' ';

        // Check for sentence endings
        if (/[.!?]\s*$/.test(this.buffer)) {
            this.sentences.push(this.buffer.trim());
            this.buffer = '';
        }

        return {
            event: 'answer',
            data: this.sentences.join(' '),
            partial: this.buffer
        };
    }
}

/**
 * Enhances telemetry data with additional metrics
 */
export class TelemetryTransformer extends ResponseTransformer {
    transform(response) {
        if (response.event !== 'telemetry') {
            return response;
        }

        const telemetry = JSON.parse(response.data);
        return {
            event: 'telemetry',
            data: JSON.stringify({
                ...telemetry,
                client_timestamp: Date.now(),
                client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            })
        };
    }
}

/**
 * Transforms related questions with additional metadata
 */
export class RelatedQuestionsTransformer extends ResponseTransformer {
    transform(response) {
        if (response.event !== 'related') {
            return response;
        }

        const related = JSON.parse(response.data);
        const enhanced = {
            questions: related.questions.map(question => ({
                text: question,
                timestamp: Date.now(),
                hash: this.hashString(question)
            }))
        };

        return {
            event: 'related',
            data: JSON.stringify(enhanced)
        };
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
}

/**
 * Chain multiple transformers together
 */
export class TransformerChain extends ResponseTransformer {
    constructor(transformers = []) {
        super();
        this.transformers = transformers;
    }

    transform(response) {
        return this.transformers.reduce(
            (result, transformer) => transformer.transform(result),
            response
        );
    }
}