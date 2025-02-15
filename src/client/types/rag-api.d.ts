// Type definitions for RAG API

export type FeedbackType = 'thumbs_up' | 'thumbs_down';

export type SearchMode = 'multiword' | 'semantic' | 'hybrid';

export interface FilterItem {
    key: string;
    values: string[];
}

export interface QuestionOptions {
    searchMode?: SearchMode;
    searchDistance?: string;
    profileId?: string;
    filter?: FilterItem[];
}

export interface TelemetryData {
    detected_question_language?: string;
    model?: string;
    processing_time?: number;
    tokens_used?: number;
}

export interface RelatedQuestions {
    questions: string[];
}

export interface RAGEventMap {
    'answer': CustomEvent<string>;
    'telemetry': CustomEvent<TelemetryData>;
    'related': CustomEvent<RelatedQuestions>;
    'complete': CustomEvent<void>;
    'error': CustomEvent<string>;
}

export interface RAGEventSource extends EventSource {
    addEventListener<K extends keyof RAGEventMap>(
        type: K,
        listener: (event: RAGEventMap[K]) => void
    ): void;
}

export interface RAGError extends Error {
    code?: string;
    details?: unknown;
}

export interface RAGAPIBase {
    registerClient(uuid: string): Promise<RAGEventSource>;
    stopClient(uuid: string): Promise<void>;
    submitFeedback(uuid: string, feedback: FeedbackType): Promise<void>;
    askQuestion(uuid: string, question: string, options?: QuestionOptions): Promise<void>;
}