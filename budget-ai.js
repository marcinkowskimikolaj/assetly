/**
 * Assetly - Budget AI Assistant v2.0
 * Architektura: Hybrid Router + Smart Cache + Kaskadowy Provider
 * Gemini (darmowy) → LLM7 (tani) → OpenAI (rezerwowy)
 */

// ═══════════════════════════════════════════════════════════
// KONFIGURACJA PROVIDERÓW
// ═══════════════════════════════════════════════════════════

const AI_PROVIDERS = {
    gemini: {
        name: 'Google Gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        models: [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (szybki)', maxTokens: 8192 },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (mocniejszy)', maxTokens: 8192 }
        ],
        defaultModel: 'gemini-1.5-flash',
        icon: '🟣',
        color: '#8b5cf6',
        priority: 1
    },
    llm7: {
        name: 'LLM7.io',
        endpoint: 'https://api.llm7.io/v1/chat/completions',
        models: [
            { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano (szybki)', maxTokens: 32000 },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini (zbalansowany)', maxTokens: 32000 },
            { id: 'o4-mini', name: 'O4 Mini (reasoning)', maxTokens: 100000 }
        ],
        defaultModel: 'gpt-4.1-mini',
        icon: '🔵',
        color: '#3b82f6',
        priority: 2
    },
    openai: {
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        models: [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', maxTokens: 4096 },
            { id: 'gpt-4o', name: 'GPT-4o', maxTokens: 4096 }
        ],
        defaultModel: 'gpt-4o-mini',
        icon: '🟢',
        color: '#10a37f',
        priority: 3
    }
};

const AI_MODES = {
    auto: { name: 'Automatyczny (zalecany)', description: 'Kaskada: Gemini → LLM7 → OpenAI' },
    gemini: { name: 'Tylko Gemini', description: 'Google Gemini (darmowy)' },
    llm7: { name: 'Tylko LLM7', description: 'LLM7.io (duży kontekst)' },
    openai: { name: 'Tylko OpenAI', description: 'OpenAI (rezerwowy)' }
};

const PROVIDER_TIMEOUT = 12000; // 12 sekund
const MAX_RETRIES = 1;

const BUDGET_QUICK_PROMPTS = [
    { id: 'summary', label: 'Podsumowanie', icon: '📊', prompt: 'Podaj kompletne podsumowanie moich finansów.' },
    { id: 'top-expenses', label: 'Top wydatki', icon: '💸', prompt: 'Podaj TOP 10 kategorii/podkategorii na które wydaję najwięcej.' },
    { id: 'savings-potential', label: 'Gdzie oszczędzić', icon: '💰', prompt: 'Gdzie mogę zaoszczędzić? Podaj konkretne kwoty.' },
    { id: 'trends', label: 'Trendy', icon: '📈', prompt: 'Jak zmieniają się moje wydatki i dochody?' },
    { id: 'income-analysis', label: 'Dochody', icon: '💵', prompt: 'Przeanalizuj moje dochody i historię wynagrodzeń.' },
    { id: '503020', label: '50/30/20', icon: '🎯', prompt: 'Analiza według metodyki 50/30/20.' },
    { id: 'monthly-compare', label: 'Porównanie', icon: '📅', prompt: 'Porównaj ostatnie miesiące.' },
    { id: 'category-deep', label: 'Kategorie', icon: '🔍', prompt: 'Szczegółowa analiza wszystkich kategorii.' }
];

// ═══════════════════════════════════════════════════════════
// STAN MODUŁU
// ═══════════════════════════════════════════════════════════

let aiState = {
    keys: { gemini: null, llm7: null, openai: null },
    mode: 'auto',
    models: { gemini: 'gemini-1.5-flash', llm7: 'gpt-4.1-mini', openai: 'gpt-4o-mini' },
    status: {
        gemini: { tested: false, working: false, error: null },
        llm7: { tested: false, working: false, error: null },
        openai: { tested: false, working: false, error: null }
    },
    stats: { geminiCalls: 0, llm7Calls: 0, openaiCalls: 0, fallbacks: 0, cacheHits: 0 },
    lastProvider: null,
    cacheReady: false
};

let budgetChatHistory = [];
let settingsOpen = false;

// ═══════════════════════════════════════════════════════════
// PERSYSTENCJA
// ═══════════════════════════════════════════════════════════

function loadAiSettings() {
    try {
        const saved = localStorage.getItem('assetly_ai_settings_v2');
        if (saved) {
            const parsed = JSON.parse(saved);
            aiState.keys = { ...aiState.keys, ...parsed.keys };
            aiState.mode = parsed.mode || 'auto';
            aiState.models = { ...aiState.models, ...parsed.models };
            aiState.stats = { ...aiState.stats, ...parsed.stats };
        }
        // Migracja starych kluczy
        const oldOpenAI = localStorage.getItem('openai_api_key');
        if (oldOpenAI && !aiState.keys.openai) aiState.keys.openai = oldOpenAI;
    } catch (e) { console.warn('Błąd ładowania ustawień:', e); }
}

function saveAiSettings() {
    try {
        localStorage.setItem('assetly_ai_settings_v2', JSON.stringify({
            keys: aiState.keys,
            mode: aiState.mode,
            models: aiState.models,
            stats: aiState.stats
        }));
    } catch (e) { console.warn('Błąd zapisu ustawień:', e); }
}

// ═══════════════════════════════════════════════════════════
// WYWOŁANIA API
// ═══════════════════════════════════════════════════════════

async function callProvider(provider, messages, options = {}) {
    const config = AI_PROVIDERS[provider];
    const apiKey = aiState.keys[provider];
    const modelId = aiState.models[provider];
    
    if (!apiKey) throw new Error(`Brak klucza API dla ${config.name}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT);
    
    try {
        let response;
        
        if (provider === 'gemini') {
            response = await callGemini(apiKey, modelId, messages, controller.signal);
        } else {
            response = await callOpenAICompatible(config.endpoint, apiKey, modelId, messages, controller.signal);
        }
        
        clearTimeout(timeoutId);
        
        // Aktualizuj status
        aiState.status[provider] = { tested: true, working: true, error: null };
        aiState.stats[`${provider}Calls`]++;
        saveAiSettings();
        
        return response;
        
    } catch (error) {
        clearTimeout(timeoutId);
        
        const errorMsg = error.name === 'AbortError' ? 'Timeout (12s)' : error.message;
        aiState.status[provider] = { tested: true, working: false, error: errorMsg };
        
        throw new Error(`${config.name}: ${errorMsg}`);
    }
}

async function callGemini(apiKey, model, messages, signal) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Konwertuj format OpenAI → Gemini
    const contents = [];
    let systemInstruction = '';
    
    messages.forEach(msg => {
        if (msg.role === 'system') {
            systemInstruction += msg.content + '\n\n';
        } else {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }
    });
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
            contents,
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048
            }
        })
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error('Brak odpowiedzi od Gemini');
    }
    
    return data.candidates[0].content.parts[0].text;
}

async function callOpenAICompatible(endpoint, apiKey, model, messages, signal) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        signal,
        body: JSON.stringify({
            model,
            messages,
            temperature: 0.3,
            max_tokens: 2048
        })
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0]?.message?.content) {
        throw new Error('Brak odpowiedzi');
    }
    
    return data.choices[0].message.content;
}

// ═══════════════════════════════════════════════════════════
// KASKADOWY FALLBACK
// ═══════════════════════════════════════════════════════════

function getProviderOrder() {
    const mode = aiState.mode;
    
    if (mode === 'gemini') return ['gemini'];
    if (mode === 'llm7') return ['llm7'];
    if (mode === 'openai') return ['openai'];
    
    // Auto: kaskada według priorytetu
    return ['gemini', 'llm7', 'openai'].filter(p => aiState.keys[p]);
}

async function callWithFallback(messages, onStatusUpdate) {
    const providers = getProviderOrder();
    
    if (providers.length === 0) {
        throw new Error('Brak skonfigurowanych providerów AI. Dodaj klucz API w ustawieniach.');
    }
    
    const errors = [];
    
    for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        const config = AI_PROVIDERS[provider];
        const isLast = i === providers.length - 1;
        
        onStatusUpdate?.(`${config.icon} ${config.name}...`);
        
        try {
            const response = await callProvider(provider, messages);
            aiState.lastProvider = provider;
            return { response, provider };
        } catch (error) {
            errors.push({ provider, error: error.message });
            console.warn(`Błąd ${provider}:`, error.message);
            
            if (!isLast) {
                aiState.stats.fallbacks++;
                saveAiSettings();
                onStatusUpdate?.(`⚠️ ${config.name} niedostępny, przełączam...`);
                await sleep(500);
            }
        }
    }
    
    // Wszystkie zawiodły
    const errorSummary = errors.map(e => `${AI_PROVIDERS[e.provider].name}: ${e.error}`).join('\n');
    throw new Error(`Wszystkie providery zawiodły:\n${errorSummary}`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════

function getSystemPrompt() {
    return `Jesteś ekspertem od finansów osobistych. Analizujesz dane budżetowe użytkownika.

## BEZWZGLĘDNE ZASADY
1. Odpowiadaj TYLKO po polsku
2. Używaj TYLKO danych z kontekstu - NIE wymyślaj
3. Podawaj DOKŁADNE kwoty (format: "1 234,56 zł")
4. Procenty z 1 miejscem po przecinku (np. "23,5%")
5. Dla rankingów i porównań ZAWSZE używaj tabel markdown

## FORMAT TABEL
| Kolumna1 | Kolumna2 | Kolumna3 |
|----------|----------|----------|
| wartość1 | wartość2 | wartość3 |

## STRUKTURA DANYCH
Dane są w formacie: SEKCJA → nagłówki → wiersze
- SUMMARY: metryki ogólne (dochody, wydatki, bilans)
- TOP_CATEGORIES: ranking kategorii
- TOP_SUBCATEGORIES: ranking podkategorii  
- MONTHLY: dane miesięczne (dochód, wydatki, bilans)
- SALARY_HISTORY: historia wynagrodzeń
- METHODOLOGY: analiza 50/30/20
- TRENDS: trendy (rosnący/malejący/stabilny)

## STYL ODPOWIEDZI
- Bądź konkretny i zwięzły
- Dawaj wnioski i rekomendacje
- Używaj emoji dla czytelności: 📈📉💰✅⚠️
- NIE przepraszaj, NIE tłumacz się - po prostu odpowiadaj`;
}

// ═══════════════════════════════════════════════════════════
// GŁÓWNA LOGIKA WYSYŁANIA
// ═══════════════════════════════════════════════════════════

async function sendBudgetMessage(customMessage = null) {
    const input = document.getElementById('budgetChatInput');
    const message = customMessage || (input?.value.trim() || '');
    
    if (!message) return;
    if (input) input.value = '';
    
    // Dodaj wiadomość użytkownika
    addChatMessage('user', message);
    
    // Upewnij się że cache istnieje
    if (typeof BudgetAICache !== 'undefined' && !aiState.cacheReady) {
        await BudgetAICache.ensureCacheExists();
        await BudgetAICache.refreshCache();
        aiState.cacheReady = true;
    }
    
    // Router - określ intencję i potrzebne dane
    let routingResult;
    if (typeof BudgetAIRouter !== 'undefined') {
        routingResult = await BudgetAIRouter.routeQuestion(message, aiState);
        console.log('🎯 Routing:', routingResult);
    } else {
        routingResult = { intent: 'unknown', requiredData: ['SUMMARY', 'TOP_CATEGORIES', 'MONTHLY'], filters: {} };
    }
    
    // Pobierz dane z cache
    let contextData = '';
    if (typeof BudgetAICache !== 'undefined') {
        try {
            const cacheData = await BudgetAICache.getDataForIntent(routingResult.intent, routingResult.filters);
            contextData = BudgetAICache.formatCacheForAI(cacheData);
            aiState.stats.cacheHits++;
            console.log('📦 Kontekst z cache:', contextData.length, 'znaków');
        } catch (e) {
            console.warn('Błąd pobierania cache:', e);
        }
    }
    
    // Fallback na stare dane jeśli cache pusty
    if (!contextData && typeof allExpenses !== 'undefined') {
        contextData = buildLegacyContext();
    }
    
    if (!contextData) {
        addChatMessage('assistant', '⚠️ Brak danych do analizy. Dodaj najpierw wydatki lub dochody.');
        return;
    }
    
    // Loading
    const loadingId = addChatMessage('assistant', '⏳ Analizuję...');
    
    // Przygotuj wiadomości
    const messages = [
        { role: 'system', content: getSystemPrompt() },
        { role: 'system', content: `## DANE FINANSOWE\n${contextData}` },
        ...budgetChatHistory.slice(-6),
        { role: 'user', content: message }
    ];
    
    try {
        const { response, provider } = await callWithFallback(messages, (status) => {
            updateChatMessage(loadingId, `⏳ ${status}`);
        });
        
        // Zapisz historię
        budgetChatHistory.push({ role: 'user', content: message });
        budgetChatHistory.push({ role: 'assistant', content: response });
        
        // Wyświetl odpowiedź
        removeChatMessage(loadingId);
        addChatMessage('assistant', response, provider);
        
    } catch (error) {
        removeChatMessage(loadingId);
        addChatMessage('assistant', `❌ ${error.message}\n\nKliknij ⚙️ aby sprawdzić ustawienia.`);
    }
}

function runQuickPrompt(promptId) {
    const prompt = BUDGET_QUICK_PROMPTS.find(p => p.id === promptId);
    if (prompt) sendBudgetMessage(prompt.prompt);
}

function buildLegacyContext() {
    // Fallback gdy cache niedostępny - stara metoda
    if (!allExpenses?.length && !allIncome?.length) return '';
    
    const summary = {
        totalExpenses: allExpenses.reduce((s, e) => s + e.kwotaPLN, 0),
        totalIncome: allIncome.reduce((s, i) => s + i.kwotaPLN, 0),
        expenseCount: allExpenses.length,
        incomeCount: allIncome.length
    };
    summary.balance = summary.totalIncome - summary.totalExpenses;
    
    return `### PODSUMOWANIE (legacy)
Wydatki: ${summary.totalExpenses.toFixed(2)} PLN
Dochody: ${summary.totalIncome.toFixed(2)} PLN
Bilans: ${summary.balance.toFixed(2)} PLN
Liczba wydatków: ${summary.expenseCount}
Liczba dochodów: ${summary.incomeCount}`;
}

// ═══════════════════════════════════════════════════════════
// UI - CHAT
// ═══════════════════════════════════════════════════════════

let msgCounter = 0;

function addChatMessage(role, content, provider = null) {
    const container = document.getElementById('budgetChatMessages');
    if (!container) return null;
    
    container.querySelector('.chat-welcome')?.remove();
    
    const id = `msg-${++msgCounter}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = `chat-message ${role}`;
    
    const providerBadge = provider && role === 'assistant' 
        ? `<span class="provider-badge" style="background:${AI_PROVIDERS[provider].color}">${AI_PROVIDERS[provider].icon} ${AI_PROVIDERS[provider].name}</span>` 
        : '';
    
    div.innerHTML = `
        <div class="msg-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="msg-bubble">
            ${providerBadge}
            <div class="msg-content">${formatMarkdown(content)}</div>
        </div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function updateChatMessage(id, content) {
    const msg = document.getElementById(id);
    if (msg) {
        const contentEl = msg.querySelector('.msg-content');
        if (contentEl) contentEl.innerHTML = formatMarkdown(content);
    }
}

function removeChatMessage(id) {
    document.getElementById(id)?.remove();
}

function formatMarkdown(text) {
    // Code blocks
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    // Tables
    text = text.replace(/(\|.+\|[\r\n]+)+/g, (match) => {
        const rows = match.trim().split(/[\r\n]+/).filter(r => r.trim());
        let html = '<table>';
        rows.forEach((row, i) => {
            if (row.match(/^\|[\s\-:]+\|$/)) return;
            const cells = row.split('|').filter(c => c !== '');
            const tag = i === 0 ? 'th' : 'td';
            html += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
        });
        return html + '</table>';
    });
    
    // Lists
    text = text.replace(/^[\t ]*[-*]\s+(.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    // Formatting
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    text = text.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    
    // Newlines
    text = text.replace(/\n/g, '<br>');
    text = text.replace(/<\/(table|ul|pre|h[34])><br>/g, '</$1>');
    text = text.replace(/<br><(table|ul|pre|h[34])/g, '<$1');
    
    return text;
}

// ═══════════════════════════════════════════════════════════
// UI - GŁÓWNY RENDER
// ═══════════════════════════════════════════════════════════

function renderBudgetAITab() {
    const container = document.getElementById('budget-ai');
    if (!container) return;
    
    loadAiSettings();
    
    const expCount = typeof allExpenses !== 'undefined' ? allExpenses.length : 0;
    const incCount = typeof allIncome !== 'undefined' ? allIncome.length : 0;
    const hasAnyKey = Object.values(aiState.keys).some(k => k);
    
    // Status providerów
    const providerStatuses = Object.entries(AI_PROVIDERS).map(([id, cfg]) => {
        const hasKey = !!aiState.keys[id];
        return `<span class="prov-badge ${hasKey ? 'active' : ''}" title="${cfg.name}">${cfg.icon}</span>`;
    }).join('');
    
    container.innerHTML = `
        <div class="ai-container">
            <div class="ai-status-bar">
                <div class="data-badges">
                    <span class="badge">📊 ${expCount} wydatków</span>
                    <span class="badge">💵 ${incCount} dochodów</span>
                </div>
                <div class="provider-statuses">
                    ${providerStatuses}
                    <span class="mode-badge">${AI_MODES[aiState.mode].name}</span>
                    <button class="btn-icon" onclick="openAiSettings()" title="Ustawienia">⚙️</button>
                </div>
            </div>
            
            <div class="card">
                <h3 class="card-title">🤖 Asystent AI</h3>
                <div class="quick-prompts">
                    ${BUDGET_QUICK_PROMPTS.map(p => `
                        <button class="qp-btn" onclick="runQuickPrompt('${p.id}')" title="${p.prompt}">
                            <span class="qp-icon">${p.icon}</span>
                            <span class="qp-label">${p.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div class="card chat-card">
                <div id="budgetChatMessages" class="chat-messages">
                    <div class="chat-welcome">
                        <h4>👋 Witaj!</h4>
                        <p>Zadaj pytanie o swoje finanse lub wybierz szybką analizę.</p>
                        ${!hasAnyKey ? '<p class="warning">⚠️ Skonfiguruj klucz API w ⚙️ Ustawieniach</p>' : ''}
                    </div>
                </div>
                <div class="chat-input-row">
                    <input type="text" id="budgetChatInput" class="chat-input" 
                        placeholder="Zadaj pytanie..." 
                        onkeypress="if(event.key==='Enter')sendBudgetMessage()"
                        ${!hasAnyKey ? 'disabled' : ''}>
                    <button class="btn-send" onclick="sendBudgetMessage()" ${!hasAnyKey ? 'disabled' : ''}>➤</button>
                </div>
            </div>
        </div>
        
        <div id="aiSettingsModal" class="modal ${settingsOpen ? 'open' : ''}">
            <div class="modal-content">
                ${renderSettings()}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// UI - USTAWIENIA
// ═══════════════════════════════════════════════════════════

function renderSettings() {
    return `
        <div class="modal-header">
            <h3>⚙️ Ustawienia AI</h3>
            <button class="btn-close" onclick="closeAiSettings()">✕</button>
        </div>
        <div class="modal-body">
            <section class="settings-section">
                <h4>Tryb działania</h4>
                <div class="mode-options">
                    ${Object.entries(AI_MODES).map(([id, mode]) => `
                        <label class="mode-option ${aiState.mode === id ? 'selected' : ''}">
                            <input type="radio" name="mode" value="${id}" ${aiState.mode === id ? 'checked' : ''} onchange="setMode('${id}')">
                            <span class="mode-name">${mode.name}</span>
                            <span class="mode-desc">${mode.description}</span>
                        </label>
                    `).join('')}
                </div>
            </section>
            
            ${Object.entries(AI_PROVIDERS).map(([id, cfg]) => `
                <section class="settings-section provider-section">
                    <div class="provider-header">
                        <h4>${cfg.icon} ${cfg.name}</h4>
                        <span class="status ${aiState.status[id].working ? 'ok' : aiState.status[id].tested ? 'error' : ''}">
                            ${aiState.status[id].working ? '✓ OK' : aiState.status[id].tested ? '✗ Błąd' : '—'}
                        </span>
                    </div>
                    <div class="form-row">
                        <input type="password" id="key-${id}" class="form-input" 
                            value="${aiState.keys[id] || ''}" 
                            placeholder="${id === 'gemini' ? 'AIza...' : 'sk-...'}"
                            onchange="setKey('${id}', this.value)">
                        <button class="btn-sm" onclick="toggleVis('key-${id}')">👁️</button>
                        <button class="btn-sm" onclick="testProvider('${id}')" ${!aiState.keys[id] ? 'disabled' : ''}>Test</button>
                    </div>
                    <select class="form-select" onchange="setModel('${id}', this.value)">
                        ${cfg.models.map(m => `<option value="${m.id}" ${aiState.models[id] === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
                    </select>
                    ${aiState.status[id].error ? `<p class="error-msg">${aiState.status[id].error}</p>` : ''}
                </section>
            `).join('')}
            
            <section class="settings-section">
                <h4>📈 Statystyki</h4>
                <div class="stats-row">
                    <div class="stat"><span class="stat-val">${aiState.stats.geminiCalls}</span><span class="stat-lbl">Gemini</span></div>
                    <div class="stat"><span class="stat-val">${aiState.stats.llm7Calls}</span><span class="stat-lbl">LLM7</span></div>
                    <div class="stat"><span class="stat-val">${aiState.stats.openaiCalls}</span><span class="stat-lbl">OpenAI</span></div>
                    <div class="stat"><span class="stat-val">${aiState.stats.fallbacks}</span><span class="stat-lbl">Fallback</span></div>
                </div>
            </section>
        </div>
    `;
}

function openAiSettings() {
    settingsOpen = true;
    const modal = document.getElementById('aiSettingsModal');
    if (modal) {
        modal.classList.add('open');
        modal.querySelector('.modal-content').innerHTML = renderSettings();
    }
}

function closeAiSettings() {
    settingsOpen = false;
    document.getElementById('aiSettingsModal')?.classList.remove('open');
    renderBudgetAITab();
}

function setMode(mode) {
    aiState.mode = mode;
    saveAiSettings();
    document.querySelector('.modal-content').innerHTML = renderSettings();
}

function setKey(provider, value) {
    aiState.keys[provider] = value.trim() || null;
    aiState.status[provider] = { tested: false, working: false, error: null };
    saveAiSettings();
}

function setModel(provider, model) {
    aiState.models[provider] = model;
    saveAiSettings();
}

function toggleVis(inputId) {
    const input = document.getElementById(inputId);
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

async function testProvider(provider) {
    const btn = event.target;
    btn.textContent = '...';
    btn.disabled = true;
    
    try {
        await callProvider(provider, [{ role: 'user', content: 'Odpowiedz: OK' }]);
        showToast?.(`${AI_PROVIDERS[provider].name}: OK!`, 'success');
    } catch (e) {
        showToast?.(`${AI_PROVIDERS[provider].name}: ${e.message}`, 'error');
    }
    
    btn.textContent = 'Test';
    btn.disabled = false;
    document.querySelector('.modal-content').innerHTML = renderSettings();
}

// ═══════════════════════════════════════════════════════════
// STYLE
// ═══════════════════════════════════════════════════════════

if (!document.getElementById('budgetAiStyles2')) {
    const style = document.createElement('style');
    style.id = 'budgetAiStyles2';
    style.textContent = `
.ai-container{display:flex;flex-direction:column;gap:16px}
.ai-status-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.data-badges,.provider-statuses{display:flex;gap:6px;align-items:center}
.badge{background:var(--bg-hover);padding:4px 10px;border-radius:6px;font-size:.75rem}
.prov-badge{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bg-hover);font-size:.9rem;opacity:.4}
.prov-badge.active{opacity:1;background:rgba(139,92,246,.15)}
.mode-badge{background:var(--primary);color:#fff;padding:3px 8px;border-radius:4px;font-size:.7rem}
.btn-icon{background:none;border:none;font-size:1.1rem;cursor:pointer;padding:4px}
.quick-prompts{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}
.qp-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;background:var(--bg-hover);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:.2s}
.qp-btn:hover{border-color:var(--primary);transform:translateY(-2px)}
.qp-icon{font-size:1.3rem}
.qp-label{font-size:.7rem;text-align:center}
.chat-card{display:flex;flex-direction:column;min-height:400px}
.chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;max-height:450px}
.chat-welcome{padding:16px;background:var(--bg-hover);border-radius:8px}
.chat-welcome h4{margin:0 0 8px}
.chat-welcome .warning{color:#f59e0b;margin-top:12px}
.chat-message{display:flex;gap:10px;max-width:90%}
.chat-message.user{align-self:flex-end;flex-direction:row-reverse}
.msg-avatar{width:32px;height:32px;border-radius:50%;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0}
.msg-bubble{display:flex;flex-direction:column;gap:4px}
.provider-badge{align-self:flex-start;padding:2px 6px;border-radius:8px;font-size:.6rem;color:#fff}
.msg-content{padding:10px 14px;border-radius:10px;background:var(--bg-card);border:1px solid var(--border);font-size:.85rem;line-height:1.5}
.chat-message.user .msg-content{background:var(--primary);color:#fff;border:none}
.msg-content h3,.msg-content h4{margin:10px 0 6px}
.msg-content h3:first-child,.msg-content h4:first-child{margin-top:0}
.msg-content table{border-collapse:collapse;margin:10px 0;font-size:.8rem;width:100%;display:block;overflow-x:auto}
.msg-content th,.msg-content td{border:1px solid var(--border);padding:6px 10px;text-align:left}
.msg-content th{background:var(--primary);color:#fff}
.msg-content tr:nth-child(even) td{background:var(--bg-hover)}
.msg-content ul{margin:8px 0;padding-left:20px}
.msg-content code{background:var(--bg-hover);padding:1px 4px;border-radius:3px;font-size:.8em}
.msg-content pre{background:var(--bg-hover);padding:10px;border-radius:6px;overflow-x:auto}
.chat-input-row{display:flex;gap:8px;padding:12px;border-top:1px solid var(--border)}
.chat-input{flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-hover);color:var(--text-primary)}
.chat-input:focus{outline:none;border-color:var(--primary)}
.btn-send{width:40px;height:40px;border:none;border-radius:8px;background:var(--primary);color:#fff;font-size:1.1rem;cursor:pointer}
.btn-send:disabled{opacity:.5;cursor:not-allowed}

.modal{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;visibility:hidden;transition:.2s}
.modal.open{opacity:1;visibility:visible}
.modal-content{background:var(--bg-card);border-radius:12px;width:90%;max-width:500px;max-height:85vh;overflow-y:auto}
.modal-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)}
.modal-header h3{margin:0}
.btn-close{background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-secondary)}
.modal-body{padding:20px}
.settings-section{margin-bottom:24px}
.settings-section h4{margin:0 0 12px;font-size:.95rem}
.mode-options{display:flex;flex-direction:column;gap:8px}
.mode-option{display:flex;flex-direction:column;padding:12px;border:2px solid var(--border);border-radius:8px;cursor:pointer}
.mode-option.selected{border-color:var(--primary);background:rgba(139,92,246,.1)}
.mode-option input{display:none}
.mode-name{font-weight:600;font-size:.9rem}
.mode-desc{font-size:.75rem;color:var(--text-muted)}
.provider-section{background:var(--bg-hover);padding:16px;border-radius:8px}
.provider-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.provider-header h4{margin:0}
.status{font-size:.75rem;padding:2px 8px;border-radius:10px}
.status.ok{background:rgba(16,185,129,.15);color:#10b981}
.status.error{background:rgba(239,68,68,.15);color:#ef4444}
.form-row{display:flex;gap:6px;margin-bottom:8px}
.form-input{flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text-primary)}
.form-select{width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text-primary)}
.btn-sm{padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);cursor:pointer;font-size:.8rem}
.btn-sm:disabled{opacity:.5;cursor:not-allowed}
.error-msg{color:#ef4444;font-size:.75rem;margin:8px 0 0}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.stat{text-align:center;padding:12px;background:var(--bg-card);border-radius:8px}
.stat-val{display:block;font-size:1.4rem;font-weight:700;color:var(--primary)}
.stat-lbl{font-size:.7rem;color:var(--text-muted)}
@media(max-width:600px){.quick-prompts{grid-template-columns:repeat(2,1fr)}.stats-row{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
}

// Inicjalizacja
loadAiSettings();
