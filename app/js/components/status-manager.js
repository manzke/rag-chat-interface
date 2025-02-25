export class StatusManager {
    constructor(statusIndicator, statusText, i18n) {
        this.statusIndicator = statusIndicator;
        this.statusText = statusText;
        this.i18n = i18n;
    }

    update(status, messageKey) {
        this.statusIndicator.className = 'status-indicator ' + status;
        this.statusText.textContent = this.i18n.t(`chat.status.${messageKey}`);
    }

    setConnecting() {
        this.update('connecting', 'connecting');
    }

    setProcessing() {
        this.update('', 'processing');
    }

    setReady() {
        this.update('', 'ready');
    }

    setError(messageKey = 'error') {
        this.update('error', messageKey);
    }

    setStopping() {
        this.update('', 'stopping');
    }
}