/**
 * Assetly - AI Providers Layer
 * Abstrakcja dla wielu providerów AI z rotacją i fallbackiem
 */

const AIProviders = {

    // ═══════════════════════════════════════════════════════════
    // KONFIGURACJA PROVIDERÓW
    // ═══════════════════════════════════════════════════════════

    PROVIDERS: {
        LLM7: {
            name: 'LLM7',
            endpoint: 'https://api.llm7.io/v1/chat/completions',
            model: 'llm7-chat', // sprawdzony działający model
            role: 'router', // używany do klasyfikacji
            timeout: 25000,
            maxTokens: 1500,
            requiresKey: false // LLM7 działa z kluczem lub 'unused'
        },
        GEMINI: {
            name: 'Gemini',
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            model: 'gemini-2.0-flash',
            role: 'generator', // główny generator odpowiedzi
            timeout: 45000,
            maxTokens: 4096
        },
        OPENAI: {
            name: 'OpenAI',
            endpoint: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-4o-mini',
            role: 'fallback', // backup
            timeout: 45000,
            maxTokens: 4096
        }
    },

    // Klucze API (ładowane z arkusza)
    _apiKeys: {
        LLM7: null,
        GEMINI: null,
        OPENAI: null
    },

    // Cache statusu providerów
    _providerStatus: {
        LLM7: { available: null, lastCheck: null, lastError: null },
        GEMINI: { available: null, lastCheck: null, lastError: null },
        OPENAI: { available: null, lastCheck: null, lastError: null }
    },

    // ═══════════════════════════════════════════════════════════
    // ZARZĄDZANIE KLUCZAMI API
    // ═══════════════════════════════════════════════════════════

    async loadApiKeys() {
        try {
            const settings = await BudgetSheets.getSettings();

            this._apiKeys.LLM7 = settings['LLM7_API_Key'] || null;
            this._apiKeys.GEMINI = settings['Gemini_API_Key'] || null;
            this._apiKeys.OPENAI = settings['OpenAI_API_Key'] || settings['openai_api_key'] || null;

            // Zapisz też do localStorage jako backup
            if (this._apiKeys.OPENAI) {
                localStorage.setItem('openai_api_key', this._apiKeys.OPENAI);
            }

            return {
                LLM7: !!this._apiKeys.LLM7,
                GEMINI: !!this._apiKeys.GEMINI,
                OPENAI: !!this._apiKeys.OPENAI
            };
        } catch (error) {
            console.warn('AIProviders: Błąd ładowania kluczy API:', error);

            // Fallback do localStorage
            this._apiKeys.OPENAI = localStorage.getItem('openai_api_key');

            return {
                LLM7: false,
                GEMINI: false,
                OPENAI: !!this._apiKeys.OPENAI
            };
        }
    },

    async saveApiKey(provider, key) {
        const keyNames = {
            LLM7: 'LLM7_API_Key',
            GEMINI: 'Gemini_API_Key',
            OPENAI: 'OpenAI_API_Key'
        };

        const keyName = keyNames[provider];
        if (!keyName) {
            throw new Error(`Nieznany provider: ${provider}`);
        }

        await BudgetSheets.setSetting(keyName, key);
        this._apiKeys[provider] = key;

        // Resetuj status
        this._providerStatus[provider] = { available: null, lastCheck: null, lastError: null };

        if (provider === 'OPENAI') {
            localStorage.setItem('openai_api_key', key);
        }
    },

    async removeApiKey(provider) {
        await this.saveApiKey(provider, '');
        this._apiKeys[provider] = null;

        if (provider === 'OPENAI') {
            localStorage.removeItem('openai_api_key');
        }
    },

    getApiKey(provider) {
        return this._apiKeys[provider];
    },

    hasApiKey(provider) {
        return !!this._apiKeys[provider];
    },

    getMaskedKey(provider) {
        const key = this._apiKeys[provider];
        if (!key) return null;
        if (key.length <= 8) return '****';
        return key.substring(0, 4) + '...' + key.substring(key.length - 4);
    },

    // ═══════════════════════════════════════════════════════════
    // WALIDACJA I TEST POŁĄCZENIA
    // ═══════════════════════════════════════════════════════════

    async testConnection(provider) {
        const key = this._apiKeys[provider];

        // LLM7 może działać bez klucza
        if (!key && provider !== 'LLM7') {
            return { success: false, error: 'Brak klucza API' };
        }

        try {
            let result;

            switch (provider) {
                case 'LLM7':
                    result = await this._testLLM7(key);
                    break;
                case 'GEMINI':
                    result = await this._testGemini(key);
                    break;
                case 'OPENAI':
                    result = await this._testOpenAI(key);
                    break;
                default:
                    return { success: false, error: 'Nieznany provider' };
            }

            this._providerStatus[provider] = {
                available: result.success,
                lastCheck: new Date().toISOString(),
                lastError: result.error || null
            };

            return result;

        } catch (error) {
            const errorMsg = error.message || 'Nieznany błąd';

            this._providerStatus[provider] = {
                available: false,
                lastCheck: new Date().toISOString(),
                lastError: errorMsg
            };

            return { success: false, error: errorMsg };
        }
    },

    async _testLLM7(key) {
        // LLM7 może działać bez klucza - używamy "unused" jeśli brak
        const apiKey = key || 'unused';

        const response = await this._fetchWithTimeout(
            this.PROVIDERS.LLM7.endpoint,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: this.PROVIDERS.LLM7.model,
                    messages: [{ role: 'user', content: 'Test' }],
                    max_tokens: 5
                })
            },
            5000
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error?.message || `HTTP ${response.status}`);
        }

        return { success: true };
    },

    async _testGemini(key) {
        const url = `${this.PROVIDERS.GEMINI.endpoint}?key=${key}`;

        const response = await this._fetchWithTimeout(
            url,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Test' }] }],
                    generationConfig: { maxOutputTokens: 5 }
                })
            },
            5000
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error?.message || `HTTP ${response.status}`);
        }

        return { success: true };
    },

    async _testOpenAI(key) {
        const response = await this._fetchWithTimeout(
            'https://api.openai.com/v1/models',
            {
                headers: { 'Authorization': `Bearer ${key}` }
            },
            5000
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error?.message || `HTTP ${response.status}`);
        }

        return { success: true };
    },

    // ═══════════════════════════════════════════════════════════
    // WYWOŁANIA API
    // ═══════════════════════════════════════════════════════════

    /**
     * Wywołanie LLM7 do klasyfikacji/routingu
     * LLM7 działa bez klucza API dla niskiego wolumenu (używa "unused")
     */
    async callRouter(systemPrompt, userMessage) {
        // LLM7 może działać bez klucza - używamy "unused" jeśli brak
        const key = this._apiKeys.LLM7 || 'unused';

        try {
            const response = await this._fetchWithTimeout(
                this.PROVIDERS.LLM7.endpoint,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: this.PROVIDERS.LLM7.model,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userMessage }
                        ],
                        temperature: 0.1,
                        max_tokens: this.PROVIDERS.LLM7.maxTokens
                    })
                },
                this.PROVIDERS.LLM7.timeout
            );

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('Pusta odpowiedź');
            }

            return {
                success: true,
                content: content,
                provider: 'LLM7'
            };

        } catch (error) {
            console.warn('AIProviders: LLM7 error:', error.message);

            return {
                success: false,
                error: error.message,
                fallbackNeeded: true
            };
        }
    },

    /**
     * Generowanie odpowiedzi z Gemini (primary) lub OpenAI (fallback)
     */
    async generateResponse(systemPrompt, factsCapsule, options = {}) {
        const capsuleJson = JSON.stringify(factsCapsule, null, 2);
        const userMessage = `Dane do analizy:\n\`\`\`json\n${capsuleJson}\n\`\`\`\n\nPrzygotuj odpowiedź na podstawie powyższych danych.`;

        // Próba 1: Gemini
        if (this._apiKeys.GEMINI) {
            const geminiResult = await this._callGemini(systemPrompt, userMessage, options);

            if (geminiResult.success) {
                return geminiResult;
            }

            console.warn('AIProviders: Gemini failed, falling back to OpenAI:', geminiResult.error);
        }

        // Fallback: OpenAI
        if (this._apiKeys.OPENAI) {
            const openaiResult = await this._callOpenAI(systemPrompt, userMessage, options);

            if (openaiResult.success) {
                return { ...openaiResult, wasFallback: true };
            }

            return openaiResult;
        }

        return {
            success: false,
            error: 'Brak skonfigurowanych providerów AI (Gemini lub OpenAI)',
            provider: null
        };
    },

    async _callGemini(systemPrompt, userMessage, options = {}) {
        const key = this._apiKeys.GEMINI;

        try {
            const url = `${this.PROVIDERS.GEMINI.endpoint}?key=${key}`;

            const response = await this._fetchWithTimeout(
                url,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMessage }] }
                        ],
                        generationConfig: {
                            maxOutputTokens: options.maxTokens || this.PROVIDERS.GEMINI.maxTokens,
                            temperature: options.temperature || 0.3
                        }
                    })
                },
                this.PROVIDERS.GEMINI.timeout
            );

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const finishReason = data.candidates?.[0]?.finishReason;

            if (!content) {
                throw new Error('Pusta odpowiedź Gemini');
            }

            // Sprawdź czy odpowiedź nie została ucięta
            if (finishReason === 'MAX_TOKENS') {
                console.warn('AIProviders: Gemini response was truncated (MAX_TOKENS)');
            }

            return {
                success: true,
                content: content,
                provider: 'GEMINI',
                truncated: finishReason === 'MAX_TOKENS'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                provider: 'GEMINI'
            };
        }
    },

    async _callOpenAI(systemPrompt, userMessage, options = {}) {
        const key = this._apiKeys.OPENAI;

        try {
            const response = await this._fetchWithTimeout(
                this.PROVIDERS.OPENAI.endpoint,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: this.PROVIDERS.OPENAI.model,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userMessage }
                        ],
                        temperature: options.temperature || 0.3,
                        max_tokens: options.maxTokens || this.PROVIDERS.OPENAI.maxTokens
                    })
                },
                this.PROVIDERS.OPENAI.timeout
            );

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('Pusta odpowiedź OpenAI');
            }

            return {
                success: true,
                content: content,
                provider: 'OPENAI'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                provider: 'OPENAI'
            };
        }
    },

    // ═══════════════════════════════════════════════════════════
    // HELPERY
    // ═══════════════════════════════════════════════════════════

    async _fetchWithTimeout(url, options, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Timeout połączenia');
            }
            throw error;
        }
    },

    getProviderStatus() {
        return {
            LLM7: {
                configured: true, // LLM7 działa bez klucza (free tier)
                hasCustomKey: !!this._apiKeys.LLM7,
                ...this._providerStatus.LLM7
            },
            GEMINI: {
                configured: !!this._apiKeys.GEMINI,
                ...this._providerStatus.GEMINI
            },
            OPENAI: {
                configured: !!this._apiKeys.OPENAI,
                ...this._providerStatus.OPENAI
            }
        };
    },

    isReady() {
        // Musi być przynajmniej jeden generator (Gemini lub OpenAI)
        return !!(this._apiKeys.GEMINI || this._apiKeys.OPENAI);
    },

    getConfigurationStatus() {
        const hasGenerator = !!(this._apiKeys.GEMINI || this._apiKeys.OPENAI);
        const hasLLM7Key = !!this._apiKeys.LLM7;

        if (!hasGenerator) {
            return {
                ready: false,
                message: 'Skonfiguruj przynajmniej jeden provider AI (Gemini lub OpenAI)',
                level: 'error'
            };
        }

        // LLM7 działa bez klucza, więc nie jest to błąd
        if (!hasLLM7Key) {
            return {
                ready: true,
                message: 'AI działa. LLM7 używa darmowego limitu (40 req/min).',
                level: 'success'
            };
        }

        return {
            ready: true,
            message: 'Wszystkie providery skonfigurowane',
            level: 'success'
        };
    }
};
