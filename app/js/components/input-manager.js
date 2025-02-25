export class InputManager {
    constructor(inputElement, sendButton, stopButton) {
        this.inputElement = inputElement;
        this.sendButton = sendButton;
        this.stopButton = stopButton;
    }

    getValue() {
        return this.inputElement.value.trim();
    }

    clear() {
        this.inputElement.value = '';
    }

    setDisabled(disabled) {
        this.inputElement.disabled = disabled;
        this.sendButton.disabled = disabled;
        this.sendButton.style.display = disabled ? 'none' : 'flex';
        this.stopButton.disabled = !disabled;
        this.stopButton.style.display = disabled ? 'flex' : 'none';
    }

    onEnter(callback) {
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                callback();
            }
        });
    }

    onClick(callback) {
        this.sendButton.addEventListener('click', callback);
    }

    onStop(callback) {
        this.stopButton.addEventListener('click', callback);
    }
}