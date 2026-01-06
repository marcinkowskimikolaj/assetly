/**
 * Assetly - Budget AI Settings Modal
 * Modal konfiguracji providerów AI
 */

const BudgetAISettings = {
    
    _isOpen: false,
    _testingProvider: null,
    
    // ═══════════════════════════════════════════════════════════
    // RENDEROWANIE MODALA
    // ═══════════════════════════════════════════════════════════
    
    async show() {
        if (this._isOpen) return;
        this._isOpen = true;
        
        // Załaduj aktualne klucze
        await AIProviders.loadApiKeys();
        
        // Utwórz modal
        this._createModal();
        
        // Wypełnij pola
        this._populateFields();
        
        // Pokaż modal
        const modal = document.getElementById('aiSettingsModal');
        if (modal) {
            modal.classList.add('active');
        }
    },
    
    hide() {
        const modal = document.getElementById('aiSettingsModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                this._isOpen = false;
            }, 300);
        }
    },
    
    _createModal() {
        // Usuń istniejący modal jeśli jest
        const existing = document.getElementById('aiSettingsModal');
        if (existing) existing.remove();
        
        const modalHtml = `
            <div id="aiSettingsModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 class="modal-title">⚙️ Ustawienia AI</h3>
                        <button class="modal-close" onclick="BudgetAISettings.hide()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="ai-settings-content">
                        <!-- Status konfiguracji -->
                        <div id="aiSettingsStatus" class="ai-settings-status">
                            <!-- Wypełniane dynamicznie -->
                        </div>
                        
                        <!-- Providery -->
                        <div class="ai-settings-providers">
                            
                            <!-- LLM7 -->
                            <div class="ai-provider-card" id="providerCard_LLM7">
                                <div class="ai-provider-header">
                                    <div class="ai-provider-info">
                                        <span class="ai-provider-name">🔀 LLM7</span>
                                        <span class="ai-provider-role">Router zapytań</span>
                                    </div>
                                    <div class="ai-provider-status" id="providerStatus_LLM7">
                                        <span class="status-dot"></span>
                                        <span class="status-text">Nieskonfigurowany</span>
                                    </div>
                                </div>
                                <div class="ai-provider-body">
                                    <div class="form-group">
                                        <label class="form-label">Klucz API</label>
                                        <div class="api-key-input-wrapper">
                                            <input type="password" 
                                                   id="apiKey_LLM7" 
                                                   class="form-input" 
                                                   placeholder="Wklej klucz API LLM7..."
                                                   autocomplete="off">
                                            <button type="button" 
                                                    class="btn btn-ghost btn-icon" 
                                                    onclick="BudgetAISettings.toggleKeyVisibility('LLM7')"
                                                    title="Pokaż/ukryj">
                                                👁️
                                            </button>
                                        </div>
                                        <p class="form-hint">Opcjonalny. Używany do inteligentnego routingu zapytań.</p>
                                    </div>
                                    <div class="ai-provider-actions">
                                        <button type="button" 
                                                class="btn btn-ghost btn-sm" 
                                                onclick="BudgetAISettings.testConnection('LLM7')"
                                                id="testBtn_LLM7">
                                            🔌 Testuj połączenie
                                        </button>
                                        <button type="button" 
                                                class="btn btn-ghost btn-sm" 
                                                onclick="BudgetAISettings.clearKey('LLM7')">
                                            🗑️ Usuń
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Gemini -->
                            <div class="ai-provider-card" id="providerCard_GEMINI">
                                <div class="ai-provider-header">
                                    <div class="ai-provider-info">
                                        <span class="ai-provider-name">✨ Gemini</span>
                                        <span class="ai-provider-role">Generator odpowiedzi (główny)</span>
                                    </div>
                                    <div class="ai-provider-status" id="providerStatus_GEMINI">
                                        <span class="status-dot"></span>
                                        <span class="status-text">Nieskonfigurowany</span>
                                    </div>
                                </div>
                                <div class="ai-provider-body">
                                    <div class="form-group">
                                        <label class="form-label">Klucz API</label>
                                        <div class="api-key-input-wrapper">
                                            <input type="password" 
                                                   id="apiKey_GEMINI" 
                                                   class="form-input" 
                                                   placeholder="Wklej klucz API Gemini..."
                                                   autocomplete="off">
                                            <button type="button" 
                                                    class="btn btn-ghost btn-icon" 
                                                    onclick="BudgetAISettings.toggleKeyVisibility('GEMINI')"
                                                    title="Pokaż/ukryj">
                                                👁️
                                            </button>
                                        </div>
                                        <p class="form-hint">Zalecany. Model gemini-2.5-flash do generowania odpowiedzi.</p>
                                    </div>
                                    <div class="ai-provider-actions">
                                        <button type="button" 
                                                class="btn btn-ghost btn-sm" 
                                                onclick="BudgetAISettings.testConnection('GEMINI')"
                                                id="testBtn_GEMINI">
                                            🔌 Testuj połączenie
                                        </button>
                                        <button type="button" 
                                                class="btn btn-ghost btn-sm" 
                                                onclick="BudgetAISettings.clearKey('GEMINI')">
                                            🗑️ Usuń
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- OpenAI -->
                            <div class="ai-provider-card" id="providerCard_OPENAI">
                                <div class="ai-provider-header">
                                    <div class="ai-provider-info">
                                        <span class="ai-provider-name">🤖 OpenAI</span>
                                        <span class="ai-provider-role">Backup (fallback)</span>
                                    </div>
                                    <div class="ai-provider-status" id="providerStatus_OPENAI">
                                        <span class="status-dot"></span>
                                        <span class="status-text">Nieskonfigurowany</span>
                                    </div>
                                </div>
                                <div class="ai-provider-body">
                                    <div class="form-group">
                                        <label class="form-label">Klucz API</label>
                                        <div class="api-key-input-wrapper">
                                            <input type="password" 
                                                   id="apiKey_OPENAI" 
                                                   class="form-input" 
                                                   placeholder="Wklej klucz API OpenAI (sk-...)..."
                                                   autocomplete="off">
                                            <button type="button" 
                                                    class="btn btn-ghost btn-icon" 
                                                    onclick="BudgetAISettings.toggleKeyVisibility('OPENAI')"
                                                    title="Pokaż/ukryj">
                                                👁️
                                            </button>
                                        </div>
                                        <p class="form-hint">Model gpt-4o-mini jako backup gdy Gemini zawiedzie.</p>
                                    </div>
                                    <div class="ai-provider-actions">
                                        <button type="button" 
                                                class="btn btn-ghost btn-sm" 
                                                onclick="BudgetAISettings.testConnection('OPENAI')"
                                                id="testBtn_OPENAI">
                                            🔌 Testuj połączenie
                                        </button>
                                        <button type="button" 
                                                class="btn btn-ghost btn-sm" 
                                                onclick="BudgetAISettings.clearKey('OPENAI')">
                                            🗑️ Usuń
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Informacje -->
                        <div class="ai-settings-info">
                            <h4>ℹ️ Jak to działa</h4>
                            <ul>
                                <li><strong>LLM7</strong> - analizuje Twoje pytanie i wybiera najlepszą metodę obliczeń</li>
                                <li><strong>Gemini</strong> - generuje odpowiedź na podstawie obliczonych danych</li>
                                <li><strong>OpenAI</strong> - backup gdy Gemini nie odpowiada</li>
                            </ul>
                            <p class="ai-settings-note">
                                💡 <strong>Minimalnie:</strong> Skonfiguruj Gemini lub OpenAI.<br>
                                🚀 <strong>Optymalnie:</strong> Skonfiguruj wszystkie trzy dla najlepszych wyników.
                            </p>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="BudgetAISettings.hide()">
                            Anuluj
                        </button>
                        <button type="button" class="btn btn-primary" onclick="BudgetAISettings.save()">
                            💾 Zapisz ustawienia
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Dodaj style jeśli nie istnieją
        this._ensureStyles();
    },
    
    _populateFields() {
        ['LLM7', 'GEMINI', 'OPENAI'].forEach(provider => {
            const input = document.getElementById(`apiKey_${provider}`);
            const hasKey = AIProviders.hasApiKey(provider);
            
            if (input) {
                if (hasKey) {
                    input.value = ''; // Nie pokazuj klucza
                    input.placeholder = `Zapisany (${AIProviders.getMaskedKey(provider)})`;
                } else {
                    input.placeholder = this._getPlaceholder(provider);
                }
            }
            
            this._updateProviderStatus(provider, hasKey ? 'configured' : 'unconfigured');
        });
        
        this._updateGlobalStatus();
    },
    
    _getPlaceholder(provider) {
        switch (provider) {
            case 'LLM7': return 'Wklej klucz API LLM7...';
            case 'GEMINI': return 'Wklej klucz API Gemini...';
            case 'OPENAI': return 'Wklej klucz API OpenAI (sk-...)...';
            default: return 'Wklej klucz API...';
        }
    },
    
    _updateProviderStatus(provider, status, message = null) {
        const statusEl = document.getElementById(`providerStatus_${provider}`);
        const cardEl = document.getElementById(`providerCard_${provider}`);
        
        if (!statusEl) return;
        
        const dot = statusEl.querySelector('.status-dot');
        const text = statusEl.querySelector('.status-text');
        
        // Usuń poprzednie klasy
        statusEl.classList.remove('status-configured', 'status-unconfigured', 'status-testing', 'status-error', 'status-success');
        if (cardEl) cardEl.classList.remove('card-configured', 'card-error');
        
        switch (status) {
            case 'configured':
                statusEl.classList.add('status-configured');
                if (cardEl) cardEl.classList.add('card-configured');
                text.textContent = message || 'Skonfigurowany';
                break;
            case 'unconfigured':
                statusEl.classList.add('status-unconfigured');
                text.textContent = message || 'Nieskonfigurowany';
                break;
            case 'testing':
                statusEl.classList.add('status-testing');
                text.textContent = message || 'Testowanie...';
                break;
            case 'error':
                statusEl.classList.add('status-error');
                if (cardEl) cardEl.classList.add('card-error');
                text.textContent = message || 'Błąd';
                break;
            case 'success':
                statusEl.classList.add('status-success');
                if (cardEl) cardEl.classList.add('card-configured');
                text.textContent = message || 'Połączono ✓';
                break;
        }
    },
    
    _updateGlobalStatus() {
        const statusEl = document.getElementById('aiSettingsStatus');
        if (!statusEl) return;
        
        const config = AIProviders.getConfigurationStatus();
        
        let iconClass = '';
        let bgClass = '';
        
        switch (config.level) {
            case 'success':
                iconClass = '✅';
                bgClass = 'status-success';
                break;
            case 'warning':
                iconClass = '⚠️';
                bgClass = 'status-warning';
                break;
            case 'error':
                iconClass = '❌';
                bgClass = 'status-error';
                break;
        }
        
        statusEl.className = `ai-settings-status ${bgClass}`;
        statusEl.innerHTML = `${iconClass} ${config.message}`;
    },
    
    // ═══════════════════════════════════════════════════════════
    // AKCJE
    // ═══════════════════════════════════════════════════════════
    
    toggleKeyVisibility(provider) {
        const input = document.getElementById(`apiKey_${provider}`);
        if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
        }
    },
    
    async testConnection(provider) {
        if (this._testingProvider) return;
        this._testingProvider = provider;
        
        const input = document.getElementById(`apiKey_${provider}`);
        const btn = document.getElementById(`testBtn_${provider}`);
        
        // Użyj nowego klucza jeśli wpisany, inaczej zapisanego
        let key = input?.value.trim();
        if (!key) {
            key = AIProviders.getApiKey(provider);
        }
        
        if (!key) {
            this._updateProviderStatus(provider, 'error', 'Brak klucza');
            this._testingProvider = null;
            return;
        }
        
        // Pokaż loading
        this._updateProviderStatus(provider, 'testing');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Testuję...';
        }
        
        try {
            // Tymczasowo ustaw klucz do testu
            const originalKey = AIProviders.getApiKey(provider);
            AIProviders._apiKeys[provider] = key;
            
            const result = await AIProviders.testConnection(provider);
            
            // Przywróć oryginalny klucz jeśli test był z nowym
            if (key !== originalKey) {
                AIProviders._apiKeys[provider] = originalKey;
            }
            
            if (result.success) {
                this._updateProviderStatus(provider, 'success', 'Połączono ✓');
                showToast(`${provider}: Połączenie OK`, 'success');
            } else {
                this._updateProviderStatus(provider, 'error', result.error);
                showToast(`${provider}: ${result.error}`, 'error');
            }
            
        } catch (error) {
            this._updateProviderStatus(provider, 'error', error.message);
            showToast(`${provider}: ${error.message}`, 'error');
        } finally {
            this._testingProvider = null;
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔌 Testuj połączenie';
            }
        }
    },
    
    async clearKey(provider) {
        const input = document.getElementById(`apiKey_${provider}`);
        
        if (input) {
            input.value = '';
            input.placeholder = this._getPlaceholder(provider);
        }
        
        await AIProviders.removeApiKey(provider);
        this._updateProviderStatus(provider, 'unconfigured');
        this._updateGlobalStatus();
        
        showToast(`${provider}: Klucz usunięty`, 'info');
    },
    
    async save() {
        const saveBtn = document.querySelector('.modal-footer .btn-primary');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Zapisuję...';
        }
        
        try {
            const providers = ['LLM7', 'GEMINI', 'OPENAI'];
            let savedCount = 0;
            
            for (const provider of providers) {
                const input = document.getElementById(`apiKey_${provider}`);
                const newKey = input?.value.trim();
                
                if (newKey) {
                    await AIProviders.saveApiKey(provider, newKey);
                    savedCount++;
                    this._updateProviderStatus(provider, 'configured');
                }
            }
            
            this._updateGlobalStatus();
            
            if (savedCount > 0) {
                showToast(`Zapisano ${savedCount} klucz(e) API`, 'success');
            } else {
                showToast('Brak zmian do zapisania', 'info');
            }
            
            // Zamknij modal po chwili
            setTimeout(() => this.hide(), 500);
            
        } catch (error) {
            console.error('BudgetAISettings: Błąd zapisu:', error);
            showToast(`Błąd zapisu: ${error.message}`, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Zapisz ustawienia';
            }
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // STYLE
    // ═══════════════════════════════════════════════════════════
    
    _ensureStyles() {
        if (document.getElementById('ai-settings-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'ai-settings-styles';
        styles.textContent = `
            .ai-settings-content {
                padding: 20px;
            }
            
            .ai-settings-status {
                padding: 12px 16px;
                border-radius: var(--radius-md);
                margin-bottom: 20px;
                font-weight: 500;
            }
            
            .ai-settings-status.status-success {
                background: rgba(34, 197, 94, 0.1);
                color: #22c55e;
            }
            
            .ai-settings-status.status-warning {
                background: rgba(245, 158, 11, 0.1);
                color: #f59e0b;
            }
            
            .ai-settings-status.status-error {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
            }
            
            .ai-settings-providers {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .ai-provider-card {
                background: var(--bg-hover);
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                overflow: hidden;
                transition: border-color 0.2s;
            }
            
            .ai-provider-card.card-configured {
                border-color: #22c55e;
            }
            
            .ai-provider-card.card-error {
                border-color: #ef4444;
            }
            
            .ai-provider-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: var(--bg-card);
                border-bottom: 1px solid var(--border);
            }
            
            .ai-provider-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .ai-provider-name {
                font-weight: 600;
                font-size: 1rem;
            }
            
            .ai-provider-role {
                font-size: 0.75rem;
                color: var(--text-secondary);
            }
            
            .ai-provider-status {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.75rem;
            }
            
            .ai-provider-status .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--text-muted);
            }
            
            .ai-provider-status.status-configured .status-dot,
            .ai-provider-status.status-success .status-dot {
                background: #22c55e;
            }
            
            .ai-provider-status.status-unconfigured .status-dot {
                background: var(--text-muted);
            }
            
            .ai-provider-status.status-testing .status-dot {
                background: #f59e0b;
                animation: pulse 1s infinite;
            }
            
            .ai-provider-status.status-error .status-dot {
                background: #ef4444;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .ai-provider-body {
                padding: 16px;
            }
            
            .api-key-input-wrapper {
                display: flex;
                gap: 8px;
            }
            
            .api-key-input-wrapper .form-input {
                flex: 1;
            }
            
            .api-key-input-wrapper .btn-icon {
                flex-shrink: 0;
            }
            
            .form-hint {
                margin-top: 6px;
                font-size: 0.75rem;
                color: var(--text-muted);
            }
            
            .ai-provider-actions {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }
            
            .ai-settings-info {
                margin-top: 24px;
                padding: 16px;
                background: var(--bg-hover);
                border-radius: var(--radius-md);
            }
            
            .ai-settings-info h4 {
                margin: 0 0 12px 0;
                font-size: 0.875rem;
            }
            
            .ai-settings-info ul {
                margin: 0 0 12px 0;
                padding-left: 20px;
            }
            
            .ai-settings-info li {
                font-size: 0.875rem;
                color: var(--text-secondary);
                margin-bottom: 4px;
            }
            
            .ai-settings-note {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin: 0;
                line-height: 1.6;
            }
        `;
        
        document.head.appendChild(styles);
    }
};
