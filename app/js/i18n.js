class I18nService {
    constructor() {
        this.translations = new Map();
        this.currentLanguage = null;
        this.fallbackLanguage = 'en';
        this.languageChangeCallbacks = new Set();
    }

    onLanguageChange(callback) {
        this.languageChangeCallbacks.add(callback);
        return () => this.languageChangeCallbacks.delete(callback);
    }

    async init() {
        // Get language from URL parameter or browser
        const urlParams = new URLSearchParams(window.location.search);
        const paramLang = urlParams.get('lang');
        const browserLang = navigator.language.split('-')[0];
        
        // Try to load the language in this order: URL param -> browser language -> fallback
        const languagesToTry = [
            paramLang,
            browserLang,
            this.fallbackLanguage
        ].filter(Boolean);

        for (const lang of languagesToTry) {
            try {
                await this.loadLanguage(lang);
                this.currentLanguage = lang;
                document.documentElement.lang = lang;
                break;
            } catch (error) {
                console.warn(`Failed to load language ${lang}:`, error);
            }
        }

        if (!this.currentLanguage) {
            throw new Error('Failed to load any language');
        }
    }

    async loadLanguage(lang) {
        if (this.translations.has(lang)) {
            return;
        }

        try {
            const module = await import(`../i18n/${lang}.js`);
            this.translations.set(lang, module.default);
        } catch (error) {
            console.error(`Failed to load language ${lang}:`, error);
            throw error;
        }
    }

    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations.get(this.currentLanguage);

        for (const k of keys) {
            if (!value || typeof value !== 'object') {
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
            value = value[k];
        }

        if (typeof value !== 'string') {
            console.warn(`Translation key not found: ${key}`);
            return key;
        }

        // Replace parameters
        return value.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getSupportedLanguages() {
        return ['en', 'de'];
    }

    translatePage() {
        // Translate text content
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });

        // Translate titles
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('title');
            element.setAttribute('title', this.t(key));
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.setAttribute('placeholder', this.t(key));
        });

        // Translate select options
        document.querySelectorAll('option[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });
    }
}

// Create and export singleton instance
const i18n = new I18nService();
export default i18n;