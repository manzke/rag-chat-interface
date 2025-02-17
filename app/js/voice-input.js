export class VoiceInput {
    constructor(options = {}) {
        this.onStart = options.onStart || (() => {});
        this.onResult = options.onResult || (() => {});
        this.onEnd = options.onEnd || (() => {});
        this.onError = options.onError || (() => {});
        
        this.isListening = false;
        this.recognition = null;
        this.initializeSpeechRecognition();
    }

    initializeSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.onStart();
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            this.onResult({
                interim: interimTranscript,
                final: finalTranscript
            });
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.onError(event);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.onEnd();
        };
    }

    start() {
        if (!this.recognition) {
            console.error('Speech recognition not initialized');
            return;
        }

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Error starting speech recognition:', error);
        }
    }

    stop() {
        if (!this.recognition) return;
        
        try {
            this.recognition.stop();
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
        }
    }

    toggle() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
    }
}

export function initializeVoiceInput(options = {}) {
    const {
        buttonId = 'voice-input-button',
        feedbackId = 'voice-feedback',
        inputId = 'user-input'
    } = options;

    const button = document.getElementById(buttonId);
    const feedback = document.getElementById(feedbackId);
    const input = document.getElementById(inputId);

    if (!button || !feedback || !input) {
        console.error('Required elements not found');
        return;
    }

    const voiceInput = new VoiceInput({
        onStart: () => {
            button.classList.add('active');
            feedback.classList.add('active');
            input.placeholder = 'Listening...';
        },
        onResult: (result) => {
            input.value = result.final + result.interim;
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        },
        onEnd: () => {
            button.classList.remove('active');
            feedback.classList.remove('active');
            input.placeholder = 'Type your message here...';
        },
        onError: (error) => {
            console.error('Voice input error:', error);
            button.classList.remove('active');
            feedback.classList.remove('active');
            input.placeholder = 'Voice input error. Please try again.';
        }
    });

    // Click handler
    button.addEventListener('click', () => {
        voiceInput.toggle();
    });

    // Keyboard shortcut (Ctrl+M)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
            e.preventDefault();
            voiceInput.toggle();
        }
    });

    return voiceInput;
}