// Theme management
class ThemeManager {
    constructor() {
        this.defaultTheme = {
            name: 'light',
            colors: {
                primary: '#007bff',
                background: '#ffffff',
                text: '#212529',
                messageBackground: '#f8f9fa',
                messageText: '#495057',
                userMessageBackground: '#007bff',
                userMessageText: '#ffffff',
                borderColor: '#dee2e6'
            },
            font: {
                family: 'system-ui',
                size: '14px'
            },
            messageStyle: 'bubble'
        };

        this.darkTheme = {
            name: 'dark',
            colors: {
                primary: '#0d6efd',
                background: '#212529',
                text: '#f8f9fa',
                messageBackground: '#343a40',
                messageText: '#e9ecef',
                userMessageBackground: '#0d6efd',
                userMessageText: '#ffffff',
                borderColor: '#495057'
            },
            font: {
                family: 'system-ui',
                size: '14px'
            },
            messageStyle: 'bubble'
        };

        this.currentTheme = this.loadTheme() || this.defaultTheme;
        this.initializeThemeControls();
    }

    initializeThemeControls() {
        // Theme toggle button
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.addEventListener('click', () => {
            const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            this.setTheme(newTheme === 'dark' ? this.darkTheme : this.defaultTheme);
            this.updateThemeIcon(newTheme);
        });

        // Theme customization dialog
        const themeCustomize = document.getElementById('theme-customize');
        const themeDialog = document.getElementById('theme-dialog');
        const closeDialog = document.getElementById('close-theme-dialog');

        themeCustomize.addEventListener('click', () => {
            themeDialog.style.display = 'flex';
            this.populateThemeControls();
        });

        closeDialog.addEventListener('click', () => {
            themeDialog.style.display = 'none';
        });

        // Theme presets
        const themePresets = document.querySelectorAll('.theme-preset');
        themePresets.forEach(preset => {
            preset.addEventListener('click', () => {
                const themeName = preset.dataset.theme;
                if (themeName === 'system') {
                    this.setSystemTheme();
                } else {
                    this.setTheme(themeName === 'dark' ? this.darkTheme : this.defaultTheme);
                }
            });
        });

        // Color pickers
        const colorInputs = document.querySelectorAll('.color-picker-group input[type="color"]');
        colorInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateCustomColors();
            });
        });

        // Font controls
        const fontSelect = document.getElementById('font-family');
        const fontSizeInput = document.getElementById('font-size');
        const fontSizeValue = document.querySelector('.font-size-value');

        fontSelect.addEventListener('change', () => {
            this.updateFont();
        });

        fontSizeInput.addEventListener('input', () => {
            fontSizeValue.textContent = `${fontSizeInput.value}px`;
            this.updateFont();
        });

        // Message style
        const messageStyles = document.querySelectorAll('input[name="message-style"]');
        messageStyles.forEach(style => {
            style.addEventListener('change', () => {
                this.updateMessageStyle();
            });
        });

        // Apply and reset buttons
        document.querySelector('.apply-theme').addEventListener('click', () => {
            this.applyCustomTheme();
            themeDialog.style.display = 'none';
        });

        document.querySelector('.reset-theme').addEventListener('click', () => {
            this.resetTheme();
        });

        // Initial theme application
        this.applyTheme(this.currentTheme);
        this.updateThemeIcon(this.currentTheme.name);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);
        this.saveTheme(theme);
    }

    setSystemTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.setTheme(prefersDark ? this.darkTheme : this.defaultTheme);
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            this.setTheme(e.matches ? this.darkTheme : this.defaultTheme);
        });
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme.name);
        
        // Apply colors
        Object.entries(theme.colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--color-${key}`, value);
        });

        // Apply font
        document.documentElement.style.setProperty('--font-family', theme.font.family);
        document.documentElement.style.setProperty('--font-size', theme.font.size);

        // Apply message style
        document.documentElement.setAttribute('data-message-style', theme.messageStyle);
    }

    updateThemeIcon(theme) {
        const icon = document.querySelector('#theme-toggle i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    populateThemeControls() {
        // Set color picker values
        document.getElementById('primary-color').value = this.currentTheme.colors.primary;
        document.getElementById('background-color').value = this.currentTheme.colors.background;
        document.getElementById('text-color').value = this.currentTheme.colors.text;

        // Set font values
        document.getElementById('font-family').value = this.currentTheme.font.family;
        const fontSize = parseInt(this.currentTheme.font.size);
        document.getElementById('font-size').value = fontSize;
        document.querySelector('.font-size-value').textContent = `${fontSize}px`;

        // Set message style
        const messageStyle = document.querySelector(`input[name="message-style"][value="${this.currentTheme.messageStyle}"]`);
        if (messageStyle) messageStyle.checked = true;
    }

    updateCustomColors() {
        const colors = {
            primary: document.getElementById('primary-color').value,
            background: document.getElementById('background-color').value,
            text: document.getElementById('text-color').value
        };

        // Update preview
        Object.entries(colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--color-${key}`, value);
        });
    }

    updateFont() {
        const family = document.getElementById('font-family').value;
        const size = `${document.getElementById('font-size').value}px`;

        document.documentElement.style.setProperty('--font-family', family);
        document.documentElement.style.setProperty('--font-size', size);
    }

    updateMessageStyle() {
        const style = document.querySelector('input[name="message-style"]:checked').value;
        document.documentElement.setAttribute('data-message-style', style);
    }

    applyCustomTheme() {
        const customTheme = {
            name: this.currentTheme.name,
            colors: {
                primary: document.getElementById('primary-color').value,
                background: document.getElementById('background-color').value,
                text: document.getElementById('text-color').value,
                messageBackground: this.currentTheme.colors.messageBackground,
                messageText: this.currentTheme.colors.messageText,
                userMessageBackground: document.getElementById('primary-color').value,
                userMessageText: '#ffffff',
                borderColor: this.currentTheme.colors.borderColor
            },
            font: {
                family: document.getElementById('font-family').value,
                size: `${document.getElementById('font-size').value}px`
            },
            messageStyle: document.querySelector('input[name="message-style"]:checked').value
        };

        this.setTheme(customTheme);
    }

    resetTheme() {
        this.setTheme(this.currentTheme.name === 'dark' ? this.darkTheme : this.defaultTheme);
        this.populateThemeControls();
    }

    saveTheme(theme) {
        localStorage.setItem('chatTheme', JSON.stringify(theme));
    }

    loadTheme() {
        const saved = localStorage.getItem('chatTheme');
        return saved ? JSON.parse(saved) : null;
    }
}

// Initialize theme manager
const themeManager = new ThemeManager();