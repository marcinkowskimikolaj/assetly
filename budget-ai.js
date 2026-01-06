/**
 * Assetly - Budget AI (v2.1 Refined)
 * Zaktualizowana orkiestracja z obsługą nowego Routera i Second-Pass
 */

// ═══════════════════════════════════════════════════════════
// KONFIGURACJA UI
// ═══════════════════════════════════════════════════════════

const BUDGET_QUICK_PROMPTS = [
    { id: 'summary', label: 'Podsumowanie', icon: '📊', prompt: 'Podsumuj ostatni miesiąc finansowy.' },
    { id: 'top', label: 'Top wydatki', icon: '📈', prompt: 'Na co wydaję najwięcej pieniędzy w tym roku?' },
    { id: 'savings', label: 'Gdzie oszczędzić', icon: '💰', prompt: 'Znajdź 3 kategorie gdzie wydatki rosną.' },
    { id: 'trends', label: 'Trendy', icon: '📉', prompt: 'Jaki jest trend moich wydatków przez ostatnie 6 miesięcy?' },
    { id: 'compare', label: 'Porównanie m/m', icon: '📅', prompt: 'Porównaj ostatni miesiąc z poprzednim.' },
    { id: '503020', label: 'Zasada 50/30/20', icon: '🎯', prompt: 'Sprawdź czy mój budżet spełnia zasadę 50/30/20.' }
];

let budgetChatHistory = [];
let budgetAiInitialized = false;
let budgetAiProcessing = false;

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

async function initBudgetAI() {
    if (budgetAiInitialized) return;
    try {
        await AIProviders.loadApiKeys();
        // Upewnij się, że cache jest świeży
        if (typeof BudgetAICache !== 'undefined') {
            await BudgetAICache.updateIfNeeded();
        }
        loadBudgetChatHistory();
        budgetAiInitialized = true;
    } catch (error) {
        console.error('BudgetAI Init Error:', error);
    }
}

// ═══════════════════════════════════════════════════════════
// RENDER UI
// ═══════════════════════════════════════════════════════════

async function renderBudgetAITab() {
    const container = document.getElementById('budget-ai');
    if (!container) return;
    
    await initBudgetAI();
    const config = AIProviders.getConfigurationStatus();
    
    container.innerHTML = `
        <div class="ai-container">
            <div class="card ai-config-card">
                <div class="card-header card-header-ai">
                    <div class="ai-header-left">
                        <h3 class="card-title">🤖 Asystent Finansowy</h3>
                        <span class="ai-config-badge ${config.level}">${config.ready ? 'Gotowy' : 'Konfiguracja'}</span>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-ghost btn-sm" onclick="clearBudgetChatHistory()">🗑️</button>
                        <button class="btn btn-ghost btn-sm" onclick="BudgetAISettings.show()">⚙️</button>
                    </div>
                </div>
                ${!config.ready ? `<div class="ai-config-warning"><p>${config.message}</p></div>` : ''}
                ${config.ready ? `
                    <div class="quick-prompts">
                        ${BUDGET_QUICK_PROMPTS.map(p => `
                            <button class="quick-prompt-btn" onclick="runBudgetQuickPrompt('${p.id}')" ${budgetAiProcessing ? 'disabled' : ''}>
                                <span class="quick-prompt-icon">${p.icon}</span> ${p.label}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <div class="card chat-card">
                <div id="budgetChatMessages" class="chat-messages">
                    ${budgetChatHistory.length === 0 ? `<div class="chat-welcome"><p>W czym mogę pomóc?</p></div>` : ''}
                </div>
                <div class="chat-input-container">
                    <input type="text" id="budgetChatInput" class="chat-input" placeholder="Zadaj pytanie..." 
                           onkeypress="if(event.key==='Enter' && !event.shiftKey) sendBudgetMessage()">
                    <button class="btn btn-primary" onclick="sendBudgetMessage()" id="sendMsgBtn">Wyślij</button>
                </div>
            </div>
        </div>
    `;
    
    // Restore history
    if (budgetChatHistory.length > 0) {
        budgetChatHistory.forEach(msg => addBudgetChatMessageToUI(msg.role, msg.content, msg.provider, false, msg.debugInfo));
    }
}

// ═══════════════════════════════════════════════════════════
// LOGIKA WIADOMOŚCI (ORCHESTRATION)
// ═══════════════════════════════════════════════════════════

async function sendBudgetMessage(customMessage = null) {
    const input = document.getElementById('budgetChatInput');
    const message = customMessage || input?.value.trim();
    if (!message || budgetAiProcessing) return;

    if (!AIProviders.isReady()) {
        addBudgetChatMessage('assistant', '⚠️ Skonfiguruj klucze API w ustawieniach.');
        return;
    }

    if (input) input.value = '';
    
    // UI Update
    addBudgetChatMessage('user', message);
    budgetAiProcessing = true;
    updateChatUIState();
    const loadingId = addBudgetChatMessageToUI('assistant', '⏳ Myślę...', null, true);

    try {
        const cache = await BudgetAICache.getCache();
        
        // 1. ROUTING (LLM7 + Validation + Repair)
        const routing = await BudgetAIRouter.classifyIntent(message, cache);
        
        // Debug Data Collection
        const debugInfo = {
            router: {
                intent: routing.intent_summary,
                shape: routing.question_shape,
                confidence: routing.confidence,
                route: routing.route,
                category: routing.canonical_category,
                subcategory: routing.canonical_subcategory
            },
            compute: [],
            generator: null
        };

        let responseContent = '';
        let providerName = 'System';

        if (routing.route === 'clarify' || routing.route === 'general') {
             // Skip compute, go straight to LLM
             const capsule = BudgetAIRouter.buildFactsCapsule(message, routing, [], cache);
             const genRes = await AIProviders.generateResponse(BudgetAIRouter.getGeneratorSystemPrompt(), capsule);
             responseContent = genRes.content;
             providerName = genRes.provider;
        } else {
             // 2. COMPUTE
             const computeResults = await BudgetAICompute.executeOperations(routing.operations, cache);
             debugInfo.compute = computeResults.map(r => ({ op: r.operation, ok: r.success }));

             // 3. FACTS & GENERATION
             const capsule = BudgetAIRouter.buildFactsCapsule(message, routing, computeResults, cache);
             const genRes = await AIProviders.generateResponse(BudgetAIRouter.getGeneratorSystemPrompt(), capsule);
             
             if (genRes.success) {
                 responseContent = genRes.content;
                 providerName = genRes.provider;
             } else {
                 responseContent = `Przepraszam, wystąpił błąd generatora: ${genRes.error}`;
                 providerName = 'Error';
             }
        }

        removeBudgetChatMessageFromUI(loadingId);
        addBudgetChatMessage('assistant', responseContent, providerName, debugInfo);

    } catch (e) {
        console.error(e);
        removeBudgetChatMessageFromUI(loadingId);
        addBudgetChatMessage('assistant', `Błąd krytyczny: ${e.message}`, 'Error');
    } finally {
        budgetAiProcessing = false;
        updateChatUIState();
    }
}

// ═══════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════

function addBudgetChatMessage(role, content, provider = null, debugInfo = null) {
    budgetChatHistory.push({ role, content, provider, debugInfo, timestamp: Date.now() });
    if (budgetChatHistory.length > 30) budgetChatHistory.shift();
    saveBudgetChatHistory();
    addBudgetChatMessageToUI(role, content, provider, false, debugInfo);
}

function addBudgetChatMessageToUI(role, content, provider, isLoading, debugInfo) {
    const container = document.getElementById('budgetChatMessages');
    if (!container) return;
    
    // Remove welcome
    const w = container.querySelector('.chat-welcome');
    if (w) w.remove();

    const div = document.createElement('div');
    div.className = `chat-message ${role} ${isLoading ? 'loading' : ''}`;
    div.id = `msg-${Date.now()}`;
    
    let html = `
        <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-content">
            ${formatMessageContent(content)}
            ${provider ? `<div class="provider-badge">${getProviderIcon(provider)}</div>` : ''}
            ${debugInfo ? renderDebugInfo(debugInfo) : ''}
        </div>
    `;
    
    div.innerHTML = html;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div.id;
}

function renderDebugInfo(info) {
    if (!info || !info.router) return '';
    return `
        <div class="debug-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">
            🔍 Debug: ${info.router.shape} (${(info.router.confidence*100).toFixed(0)}%)
        </div>
        <div class="debug-details hidden">
            <div>Intent: ${info.router.intent}</div>
            <div>Route: ${info.router.route}</div>
            <div>Cat: ${info.router.category || '-'} / ${info.router.subcategory || '-'}</div>
            <div>Ops: ${info.compute.length} executed</div>
        </div>
    `;
}

function formatMessageContent(text) {
    return text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
}

function removeBudgetChatMessageFromUI(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function updateChatUIState() {
    const btn = document.getElementById('sendMsgBtn');
    if (btn) {
        btn.disabled = budgetAiProcessing;
        btn.innerText = budgetAiProcessing ? '...' : 'Wyślij';
    }
}

function runBudgetQuickPrompt(id) {
    const p = BUDGET_QUICK_PROMPTS.find(x => x.id === id);
    if (p) sendBudgetMessage(p.prompt);
}

function loadBudgetChatHistory() {
    const s = localStorage.getItem('assetly_budget_chat');
    if (s) budgetChatHistory = JSON.parse(s);
}

function saveBudgetChatHistory() {
    localStorage.setItem('assetly_budget_chat', JSON.stringify(budgetChatHistory));
}

function clearBudgetChatHistory() {
    budgetChatHistory = [];
    saveBudgetChatHistory();
    renderBudgetAITab();
}

function getProviderIcon(p) {
    if (p.includes('Gemini')) return '✨';
    if (p.includes('OpenAI')) return '🧠';
    if (p.includes('LLM7')) return '🔀';
    return '⚙️';
}
