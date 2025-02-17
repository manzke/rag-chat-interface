/**
 * EventSource polyfill for iOS/Chrome
 */
export class EventSourcePolyfill {
    constructor(url, options = {}) {
        this.url = url;
        this.options = options;
        this.readyState = 0;
        this.eventListeners = new Map();
        this.reconnectTime = 1000;
        this.maxReconnectTime = 30000;
        this.controller = null;
        
        this.connect();
    }

    connect() {
        // Abort any existing connection
        if (this.controller) {
            this.controller.abort();
        }

        this.controller = new AbortController();
        
        fetch(this.url, {
            signal: this.controller.signal,
            headers: {
                'Accept': 'text/event-stream'
            }
        }).then(async response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            if (!response.body) {
                throw new Error('ReadableStream not supported');
            }

            this.readyState = 1;
            this.dispatchEvent('open', null);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split(/\\r\\n|\\r|\\n/);
                    
                    // Keep the last partial line in the buffer
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            this.dispatchEvent('message', {
                                data: data,
                                lastEventId: '',
                                origin: this.url
                            });
                        } else if (line.startsWith('event: ')) {
                            const eventName = line.slice(7);
                            const dataLine = lines[lines.indexOf(line) + 1];
                            if (dataLine?.startsWith('data: ')) {
                                const data = dataLine.slice(6);
                                this.dispatchEvent(eventName, {
                                    data: data,
                                    lastEventId: '',
                                    origin: this.url
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError') return;
                this.handleError(error);
            }
        }).catch(error => {
            this.handleError(error);
        });
    }

    handleError(error) {
        this.readyState = 2;
        this.dispatchEvent('error', error);
        
        // Attempt to reconnect with exponential backoff
        setTimeout(() => {
            this.reconnectTime = Math.min(this.reconnectTime * 1.5, this.maxReconnectTime);
            this.connect();
        }, this.reconnectTime);
    }

    addEventListener(type, callback) {
        if (!this.eventListeners.has(type)) {
            this.eventListeners.set(type, new Set());
        }
        this.eventListeners.get(type).add(callback);
    }

    removeEventListener(type, callback) {
        const listeners = this.eventListeners.get(type);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    dispatchEvent(type, data) {
        const listeners = this.eventListeners.get(type);
        if (listeners) {
            const event = new CustomEvent(type, { detail: data });
            event.data = data?.data;
            listeners.forEach(callback => callback(event));
        }
    }

    close() {
        if (this.controller) {
            this.controller.abort();
        }
        this.readyState = 2;
        this.eventListeners.clear();
    }
}

/**
 * Check if native EventSource is supported and working correctly
 */
export function checkEventSourceSupport() {
    // Check if EventSource is natively supported
    if (!window.EventSource) {
        return false;
    }

    // Additional checks for iOS/Chrome issues
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isChrome = /CriOS/.test(navigator.userAgent);
    
    // Return false for iOS Chrome which has known SSE issues
    if (isIOS && isChrome) {
        return false;
    }

    return true;
}

/**
 * Create an appropriate EventSource instance
 */
export function createEventSource(url, options = {}) {
    if (checkEventSourceSupport()) {
        return new EventSource(url, options);
    }
    return new EventSourcePolyfill(url, options);
}