/**
 * Assetly - Budget AI (v3)
 * Przebudowany moduł AI z rotacją providerów, cache i inteligentnym routingiem
 * 
 * ZMIANY v3:
 * - Przekazywanie oryginalnego pytania do kapsuły faktów
 * - Weryfikacja spójności wyników obliczeń z planem
 * - Warunkowa naprawa planu przy wykryciu niespójności
 * - Lepsze logowanie dla debugowania
 * - Walidacja kategorii w wynikach
 */

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// KONFIGURACJA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const BUDGET_QUICK_PROMPTS = [
    {
        id: 'summary',
        label: 'Podsumowanie',
        icon: 'ðŸ“Š',
        prompt: 'Podsumuj moje finanse z ostatniego zamkniętego miesiąca. Podaj: bilans, wykonanie planu, 3 najważniejsze obserwacje.'
    },
    {
        id: 'top',
        label: 'Top wydatki',
        icon: 'ðŸ“ˆ',
        prompt: 'Pokaż top 10 kategorii wydatków w całej historii. Które pochłaniają najwięcej pieniędzy?'
    },
    {
        id: 'savings',
        label: 'Gdzie oszczędzić',
        icon: 'ðŸ’°',
        prompt: 'Zidentyfikuj 3 kategorie gdzie wydaję więcej niż średnia historyczna. Dla każdej podaj konkretną kwotę potencjalnej oszczędności.'
    },
    {
        id: 'trends',
        label: 'Trendy',
        icon: 'ðŸ“‰',
        prompt: 'Jak zmieniały się moje wydatki i dochody przez ostatnie 6 miesięcy? Czy widzisz niepokojące trendy?'
    },
    {
        id: 'compare',
        label: 'Porównanie m/m',
        icon: 'ðŸ“…',
        prompt: 'Porównaj moje finanse z ostatniego miesiąca z poprzednim miesiącem. Co się zmieniło?'
    },
    {
        id: '503020',
        label: 'Analiza 50/30/20',
        icon: 'ðŸŽ¯',
        prompt: 'Przeanalizuj moje wydatki według metodyki 50/30/20. Czy trzymam się zdrowych proporcji?'
    }
];

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STAN
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let budgetChatHistory = [];
let budgetAiInitialized = false;
let budgetAiProcessing = false;
let lastUsedProvider = null;

// Stan ostatniego zapytania (do czyszczenia)
let _lastQueryState = {
    routing: null,
    computeResults: null,
    factsCapsule: null
};

/**
 * Czyści stan poprzedniego zapytania - zapobiega "wyciekowi" danych
 */
function clearPreviousQueryState() {
    _lastQueryState = {
        routing: null,
        computeResults: null,
        factsCapsule: null
    };
    
    // Reset stanu w routerze jeśli istnieje
    if (typeof BudgetAIRouter !== 'undefined' && BudgetAIRouter._lastRouting) {
        BudgetAIRouter._lastRouting = null;
    }
    
    // Reset stanu w compute jeśli istnieje
    if (typeof BudgetAICompute !== 'undefined' && BudgetAICompute._lastResults) {
        BudgetAICompute._lastResults = null;
    }
    
    console.log('BudgetAI: Cleared previous query state');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// INICJALIZACJA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function initBudgetAI() {
    if (budgetAiInitialized) return;
    
    try {
        // Załaduj klucze API
        await AIProviders.loadApiKeys();
        
        // Aktualizuj AI cache jeśli potrzeba
        await BudgetAICache.updateIfNeeded();
        
        // Załaduj historię czatu
        loadBudgetChatHistory();
        
        budgetAiInitialized = true;
        
    } catch (error) {
        console.error('BudgetAI: Błąd inicjalizacji:', error);
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RENDEROWANIE TAB AI
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function renderBudgetAITab() {
    const container = document.getElementById('budget-ai');
    if (!container) return;
    
    // Inicjalizuj jeśli jeszcze nie
    await initBudgetAI();
    
    // Sprawdź konfigurację
    const config = AIProviders.getConfigurationStatus();
    
    container.innerHTML = `
        <div class="ai-container">
            <!-- Status i ustawienia -->
            <div class="card ai-config-card">
                <div class="card-header card-header-ai">
                    <div class="ai-header-left">
                        <h3 class="card-title">ðŸ¤– Asystent budżetowy</h3>
                        <span class="ai-config-badge ${config.level}">${config.ready ? 'âœ“ Gotowy' : 'âš ï¸ Konfiguracja wymagana'}</span>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-ghost btn-sm" onclick="clearBudgetChatHistory()" title="Wyczyść historię">
                            ðŸ—‘ï¸
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="BudgetAISettings.show()" title="Ustawienia AI">
                            âš™ï¸
                        </button>
                    </div>
                </div>
                
                ${!config.ready ? `
                    <div class="ai-config-warning">
                        <p>${config.message}</p>
                        <button class="btn btn-primary btn-sm" onclick="BudgetAISettings.show()">
                            âš™ï¸ Skonfiguruj AI
                        </button>
                    </div>
                ` : ''}
                
                <!-- Szybkie prompty -->
                ${config.ready ? `
                    <div class="quick-prompts">
                        ${BUDGET_QUICK_PROMPTS.map(p => `
                            <button class="quick-prompt-btn" onclick="runBudgetQuickPrompt('${p.id}')" ${budgetAiProcessing ? 'disabled' : ''}>
                                <span class="quick-prompt-icon">${p.icon}</span>
                                <span class="quick-prompt-label">${p.label}</span>
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <!-- Chat -->
            <div class="card chat-card">
                <div id="budgetChatMessages" class="chat-messages">
                    ${budgetChatHistory.length === 0 ? `
                        <div class="chat-welcome">
                            <p>ðŸ‘‹ Cześć! Jestem Twoim asystentem budżetowym.</p>
                            <p>Mogę pomóc Ci przeanalizować wydatki, znaleźć oszczędności, porównać trendy i odpowiedzieć na pytania o Twój budżet.</p>
                            ${config.ready ? `
                                <p>Wybierz jedną z szybkich analiz powyżej lub zadaj własne pytanie.</p>
                            ` : `
                                <p>âš ï¸ Najpierw skonfiguruj klucze API w ustawieniach.</p>
                            `}
                        </div>
                    ` : ''}
                </div>
                
                <div class="chat-input-container">
                    <input type="text" 
                           id="budgetChatInput" 
                           class="chat-input" 
                           placeholder="${config.ready ? 'Zadaj pytanie o swój budżet...' : 'Najpierw skonfiguruj AI w ustawieniach...'}"
                           ${!config.ready || budgetAiProcessing ? 'disabled' : ''}
                           onkeypress="if(event.key==='Enter' && !event.shiftKey) sendBudgetMessage()">
                    <button class="btn btn-primary" 
                            onclick="sendBudgetMessage()" 
                            ${!config.ready || budgetAiProcessing ? 'disabled' : ''}>
                        ${budgetAiProcessing ? 'â³' : 'Wyślij'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Odtwórz historię czatu w UI
    if (budgetChatHistory.length > 0) {
        const messagesContainer = document.getElementById('budgetChatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            budgetChatHistory.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    addBudgetChatMessageToUI(msg.role, msg.content, msg.provider);
                }
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    // Proaktywne Insight (raz na sesję)
    if (config.ready) {
        checkAndRunProactiveInsights();
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WYSYÅANIE WIADOMOÅšCI (NOWY FLOW v3)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function sendBudgetMessage(customMessage = null) {
    const input = document.getElementById('budgetChatInput');
    const message = customMessage || input?.value.trim();
    
    if (!message) return;
    if (budgetAiProcessing) return;
    
    // Sprawdź konfigurację
    if (!AIProviders.isReady()) {
        addBudgetChatMessage('assistant', 'âš ï¸ Brak skonfigurowanych providerów AI. Kliknij âš™ï¸ aby skonfigurować.');
        return;
    }
    
    // Wyczyść input
    if (input) input.value = '';
    
    // === CZYSZCZENIE STANU POPRZEDNIEGO ZAPYTANIA ===
    clearPreviousQueryState();
    
    // Dodaj wiadomość użytkownika
    addBudgetChatMessage('user', message);
    
    // Pokaż loading
    budgetAiProcessing = true;
    updateChatUIState();
    const loadingId = addBudgetChatMessageToUI('assistant', 'â³ Analizuję...', null, true);
    
    try {
        // KROK 1: Pobierz cache
        const cache = await BudgetAICache.getCache();
        
        // Debug info
        const debugInfo = {
            timestamp: new Date().toISOString(),
            routerSource: null,
            route: null,
            questionShape: null,
            category: null,
            subcategory: null,
            operations: [],
            computeSuccess: null,
            generatorProvider: null,
            error: null,
            planRepaired: false
        };
        
        // KROK 2: Router - klasyfikacja intencji (z walidacją spójności)
        const routing = await BudgetAIRouter.classifyIntent(message, cache);
        
        // Zapisz debug info
        debugInfo.routerSource = routing.source || 'unknown';
        debugInfo.route = routing.route;
        debugInfo.questionShape = routing.question_shape;
        debugInfo.category = routing.canonical_category;
        debugInfo.subcategory = routing.canonical_subcategory;
        debugInfo.intentSummary = routing.intent_summary;
        debugInfo.operations = (routing.operations || []).map(op => op.function);
        debugInfo.planRepaired = routing.source === 'llm7_repaired';
        
        console.log('BudgetAI: Routing:', {
            route: routing.route,
            questionShape: routing.question_shape,
            category: routing.canonical_category,
            subcategory: routing.canonical_subcategory,
            source: routing.source
        });
        
        // KROK 3: Obsłuż routing
        let response;
        
        if (routing.route === 'clarify') {
            response = {
                success: true,
                content: `ðŸ¤” Nie jestem pewien co dokładnie chcesz sprawdzić. Czy możesz doprecyzować?\n\nMogę pomóc z:\n- Sumami wydatków dla kategorii (np. "suma wydatków na paliwo")\n- Porównaniami miesięcy\n- Analizą trendów\n- Top wydatkami\n- Pytaniami typu "W którym miesiącu wydałem najwięcej na X?"`,
                provider: 'system'
            };
            debugInfo.generatorProvider = 'system';
        } else if (routing.route === 'general') {
            // Ogólne pytanie
            const capsule = BudgetAIRouter.buildFactsCapsule(routing, [], cache, message);
            response = await AIProviders.generateResponse(
                BudgetAIRouter.getGeneratorSystemPrompt(),
                capsule
            );
            debugInfo.generatorProvider = response.provider;
        } else {
            // KROK 4: Wykonaj obliczenia
            const computeResults = await BudgetAICompute.executeOperations(routing.operations, cache);
            
            debugInfo.computeSuccess = computeResults.every(r => r.success);
            debugInfo.computeResults = computeResults.map(r => ({
                operation: r.operation,
                success: r.success,
                hasData: r._meta?.hasData,
                error: r.error || null
            }));
            
            console.log('BudgetAI: Compute results:', computeResults.map(r => ({
                op: r.operation,
                success: r.success,
                hasData: r._meta?.hasData
            })));
            
            // KROK 4b: Weryfikacja spójności wyników
            const consistencyIssues = _verifyResultsConsistency(routing, computeResults);
            if (consistencyIssues.length > 0) {
                console.warn('BudgetAI: Result consistency issues:', consistencyIssues);
                debugInfo.consistencyIssues = consistencyIssues;
            }
            
            // KROK 5: Zbuduj kapsułę faktów (z oryginalnym pytaniem!)
            const capsule = BudgetAIRouter.buildFactsCapsule(routing, computeResults, cache, message);
            
            console.log('BudgetAI: Facts capsule:', {
                question_shape: capsule.question_shape,
                hasData: capsule.derived?.hasData,
                answer: capsule.derived?.answer
            });
            
            // KROK 6: Wygeneruj odpowiedź
            response = await AIProviders.generateResponse(
                BudgetAIRouter.getGeneratorSystemPrompt(),
                capsule
            );
            debugInfo.generatorProvider = response.provider;
        }
        
        // Usuń loading
        removeBudgetChatMessageFromUI(loadingId);
        
        if (response.success) {
            lastUsedProvider = response.provider;
            addBudgetChatMessage('assistant', response.content, response.provider, debugInfo);
            
            // Zapisz do historii
            saveBudgetChatHistory();
        } else {
            debugInfo.error = response.error;
            addBudgetChatMessage('assistant', `âŒ Błąd: ${response.error}`, 'error', debugInfo);
        }
        
    } catch (error) {
        console.error('BudgetAI: Błąd:', error);
        removeBudgetChatMessageFromUI(loadingId);
        addBudgetChatMessage('assistant', `âŒ Błąd: ${error.message}`, 'error', { error: error.message });
    } finally {
        budgetAiProcessing = false;
        updateChatUIState();
    }
}

/**
 * Weryfikuje spójność wyników obliczeń z planem
 * @returns {Array} Lista wykrytych problemów
 */
function _verifyResultsConsistency(routing, computeResults) {
    const issues = [];
    
    for (const result of computeResults) {
        if (!result.success) continue;
        
        const meta = result._meta || {};
        
        // Problem 1: Brak danych mimo rozpoznanej kategorii
        if (routing.canonical_subcategory && !meta.hasData) {
            issues.push({
                type: 'NO_DATA_FOR_CATEGORY',
                message: `Brak danych dla rozpoznanej podkategorii "${routing.canonical_subcategory}"`,
                operation: result.operation
            });
        }
        
        // Problem 2: Kategoria w wyniku nie zgadza się z planem
        if (meta.resultCategory && routing.canonical_category && 
            meta.resultCategory !== routing.canonical_category) {
            issues.push({
                type: 'CATEGORY_MISMATCH',
                message: `Wynik dotyczy kategorii "${meta.resultCategory}" zamiast "${routing.canonical_category}"`,
                operation: result.operation
            });
        }
        
        // Problem 3: monthlyBreakdown z pustym breakdown
        if (result.operation === 'monthlyBreakdown' && 
            result.data?.breakdown?.length === 0 && 
            !result.data?.notFound) {
            issues.push({
                type: 'EMPTY_BREAKDOWN',
                message: 'Pusty breakdown bez flagi notFound',
                operation: result.operation
            });
        }
    }
    
    return issues;
}

function runBudgetQuickPrompt(promptId) {
    const prompt = BUDGET_QUICK_PROMPTS.find(p => p.id === promptId);
    if (prompt) {
        sendBudgetMessage(prompt.prompt);
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UI CZATU
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let budgetMessageCounter = 0;

function addBudgetChatMessage(role, content, provider = null, debugInfo = null) {
    // Dodaj do historii
    budgetChatHistory.push({ 
        role, 
        content, 
        provider,
        timestamp: new Date().toISOString() 
    });
    
    // Ogranicz historię
    if (budgetChatHistory.length > 50) {
        budgetChatHistory = budgetChatHistory.slice(-50);
    }
    
    // Dodaj do UI
    return addBudgetChatMessageToUI(role, content, provider, false, debugInfo);
}

function addBudgetChatMessageToUI(role, content, provider = null, isLoading = false, debugInfo = null) {
    const container = document.getElementById('budgetChatMessages');
    if (!container) return null;
    
    // Usuń welcome message
    const welcome = container.querySelector('.chat-welcome');
    if (welcome) welcome.remove();
    
    const id = `budget-msg-${++budgetMessageCounter}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = `chat-message ${role}${isLoading ? ' loading' : ''}`;
    
    // Formatuj treść - bezpieczne renderowanie
    const formattedContent = role === 'assistant' && !isLoading
        ? formatBudgetRichResponse(content)
        : escapeHtml(content).replace(/\n/g, '<br>');
    
    // Badge providera
    const providerBadge = provider && !isLoading && role === 'assistant' && provider !== 'system' && provider !== 'error'
        ? `<span class="provider-badge provider-${provider.toLowerCase()}">${getProviderIcon(provider)}</span>`
        : '';
    
    // Debug panel
    let debugPanel = '';
    if (debugInfo && role === 'assistant' && !isLoading) {
        debugPanel = renderDebugPanel(debugInfo);
    }
    
    div.innerHTML = `
        <div class="message-avatar">${role === 'user' ? 'ðŸ‘¤' : 'ðŸ¤–'}</div>
        <div class="message-content">
            ${formattedContent}
            ${providerBadge}
            ${debugPanel}
        </div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    
    return id;
}

/**
 * Renderuje panel debug z informacjami o procesie przetwarzania
 */
function renderDebugPanel(debugInfo) {
    if (!debugInfo) return '';
    
    // Określ status ogólny
    let statusIcon = 'âœ…';
    let statusText = 'Sukces';
    let statusClass = 'success';
    
    if (debugInfo.error) {
        statusIcon = 'âŒ';
        statusText = 'Błąd';
        statusClass = 'error';
    } else if (debugInfo.routerSource === 'fallback') {
        statusIcon = 'âš ï¸';
        statusText = 'Fallback (bez AI)';
        statusClass = 'warning';
    } else if (debugInfo.planRepaired) {
        statusIcon = 'ðŸ”§';
        statusText = 'Plan naprawiony';
        statusClass = 'warning';
    } else if (debugInfo.computeSuccess === false) {
        statusIcon = 'âš ï¸';
        statusText = 'Błąd obliczeń';
        statusClass = 'warning';
    }
    
    // Router info
    const routerInfo = debugInfo.routerSource === 'llm7' ? 'ðŸ¤– LLM7' :
                       debugInfo.routerSource === 'llm7_repaired' ? 'ðŸ”§ LLM7 (naprawiony)' :
                       debugInfo.routerSource === 'fallback' ? 'ðŸ“‹ Regex/Fallback' :
                       debugInfo.routerSource || '?';
    
    // Generator info
    const generatorInfo = debugInfo.generatorProvider ? 
        `${getProviderIcon(debugInfo.generatorProvider)} ${debugInfo.generatorProvider}` : 
        'â€”';
    
    // Kategoria/podkategoria
    const categoryInfo = debugInfo.category ? 
        (debugInfo.subcategory ? `${debugInfo.category} â†’ ${debugInfo.subcategory}` : debugInfo.category) :
        '(nie wykryto)';
    
    // Operacje
    const operationsInfo = debugInfo.operations?.length > 0 ?
        debugInfo.operations.join(', ') : '(brak)';
    
    // Question shape
    const shapeInfo = debugInfo.questionShape || 'â€”';
    
    return `
        <div class="debug-panel">
            <div class="debug-header" onclick="this.parentElement.classList.toggle('expanded')">
                <span class="debug-status ${statusClass}">${statusIcon} ${statusText}</span>
                <span class="debug-toggle">â–¼</span>
            </div>
            <div class="debug-content">
                <div class="debug-row">
                    <span class="debug-label">Router:</span>
                    <span class="debug-value">${routerInfo}</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Intencja:</span>
                    <span class="debug-value">${debugInfo.route || '?'}</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Typ pytania:</span>
                    <span class="debug-value">${shapeInfo}</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Kategoria:</span>
                    <span class="debug-value ${debugInfo.subcategory ? 'has-subcategory' : ''}">${categoryInfo}</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Operacje:</span>
                    <span class="debug-value">${operationsInfo}</span>
                </div>
                <div class="debug-row">
                    <span class="debug-label">Generator:</span>
                    <span class="debug-value">${generatorInfo}</span>
                </div>
                ${debugInfo.intentSummary ? `
                <div class="debug-row">
                    <span class="debug-label">Opis:</span>
                    <span class="debug-value debug-summary">${escapeHtml(debugInfo.intentSummary)}</span>
                </div>
                ` : ''}
                ${debugInfo.consistencyIssues?.length > 0 ? `
                <div class="debug-row debug-warning">
                    <span class="debug-label">Uwagi:</span>
                    <span class="debug-value">${debugInfo.consistencyIssues.map(i => i.type).join(', ')}</span>
                </div>
                ` : ''}
                ${debugInfo.error ? `
                <div class="debug-row debug-error">
                    <span class="debug-label">Błąd:</span>
                    <span class="debug-value">${escapeHtml(debugInfo.error)}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function removeBudgetChatMessageFromUI(id) {
    const msg = document.getElementById(id);
    if (msg) msg.remove();
}

function getProviderIcon(provider) {
    switch (provider) {
        case 'GEMINI': return 'âœ¨';
        case 'OPENAI': return 'ðŸ¤–';
        case 'LLM7': return 'ðŸ”€';
        default: return '';
    }
}

/**
 * Formatuje odpowiedź z bezpiecznym renderowaniem (bez surowego HTML)
 */
function formatBudgetRichResponse(text) {
    if (!text) return '';
    
    // Escape HTML first - zapobiega XSS
    let html = escapeHtml(text);
    
    // Markdown formatting (bezpieczne - już escaped)
    html = html
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    
    // Emoji highlights dla liczb
    html = html.replace(/(\d[\d\s]*(?:,\d{2})?\s*(?:zł|PLN))/g, '<span class="amount-highlight">$1</span>');
    
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function updateChatUIState() {
    const input = document.getElementById('budgetChatInput');
    const sendBtn = document.querySelector('.chat-input-container .btn-primary');
    const quickBtns = document.querySelectorAll('.quick-prompt-btn');
    
    if (input) input.disabled = budgetAiProcessing;
    if (sendBtn) {
        sendBtn.disabled = budgetAiProcessing;
        sendBtn.textContent = budgetAiProcessing ? 'â³' : 'Wyślij';
    }
    quickBtns.forEach(btn => btn.disabled = budgetAiProcessing);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HISTORIA I PERSISTENCE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function saveBudgetChatHistory() {
    try {
        localStorage.setItem('budget_chat_history_v2', JSON.stringify(budgetChatHistory));
    } catch (e) {
        console.warn('Nie udało się zapisać historii czatu:', e);
    }
}

function loadBudgetChatHistory() {
    try {
        let saved = localStorage.getItem('budget_chat_history_v2');
        
        // Fallback do starej wersji
        if (!saved) {
            saved = localStorage.getItem('budget_chat_history');
            if (saved) {
                localStorage.setItem('budget_chat_history_v2', saved);
                localStorage.removeItem('budget_chat_history');
            }
        }
        
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                budgetChatHistory = parsed;
            }
        }
    } catch (e) {
        console.error('Błąd odczytu historii czatu:', e);
        budgetChatHistory = [];
    }
}

function clearBudgetChatHistory() {
    budgetChatHistory = [];
    localStorage.removeItem('budget_chat_history_v2');
    localStorage.removeItem('budget_chat_history');
    renderBudgetAITab();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PROACTIVE INSIGHTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function checkAndRunProactiveInsights() {
    if (sessionStorage.getItem('budget_proactive_insight_shown_v2')) {
        return;
    }
    
    if (!AIProviders.isReady()) {
        return;
    }
    
    const container = document.getElementById('budget-ai')?.querySelector('.ai-container');
    if (!container) return;
    
    const insightId = 'proactive-insight-banner';
    if (document.getElementById(insightId)) return;
    
    const placeholder = document.createElement('div');
    placeholder.id = insightId;
    placeholder.className = 'proactive-insight';
    placeholder.style.display = 'none';
    container.insertBefore(placeholder, container.firstChild);
    
    try {
        const cache = await BudgetAICache.getCache();
        
        if (!cache.availablePeriods || cache.availablePeriods.length === 0) {
            placeholder.remove();
            return;
        }
        
        const capsule = {
            query_intent: 'Wygeneruj jeden krótki insight finansowy na start dnia',
            lastMonth: cache.monthlyTotals[Object.keys(cache.monthlyTotals).sort().pop()],
            trends: cache.trends,
            topAnomalies: (cache.anomalies || []).slice(0, 2)
        };
        
        const systemPrompt = `Wygeneruj jeden, krótki (max 2 zdania) "Financial Insight" dla użytkownika na start dnia.
Odpowiedz TYLKO poprawnym JSON: { "type": "info|warning|success", "title": "...", "message": "..." }
Skup się na najważniejszej zmianie lub obserwacji. Nie pytaj o nic, tylko stwierdzaj fakt.`;
        
        const response = await AIProviders.generateResponse(systemPrompt, capsule, { maxTokens: 200 });
        
        if (response.success) {
            try {
                let cleanContent = response.content.trim();
                cleanContent = cleanContent.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
                
                const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('Nie znaleziono JSON w odpowiedzi');
                }
                cleanContent = jsonMatch[0];
                
                cleanContent = cleanContent
                    .replace(/[\r\n]+/g, ' ')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                
                const insight = JSON.parse(cleanContent);
                
                if (insight.type && insight.title && insight.message) {
                    renderProactiveInsight(insight);
                    sessionStorage.setItem('budget_proactive_insight_shown_v2', 'true');
                } else {
                    throw new Error('Niepełna struktura insight');
                }
            } catch (e) {
                console.warn('Proactive insight: błąd parsowania JSON:', e.message);
                placeholder.remove();
            }
        } else {
            placeholder.remove();
        }
    } catch (e) {
        console.warn('Proactive insight failed:', e);
        placeholder.remove();
    }
}

function renderProactiveInsight(insight) {
    const banner = document.getElementById('proactive-insight-banner');
    if (!banner) return;
    
    const icon = insight.type === 'warning' ? 'âš ï¸' : insight.type === 'success' ? 'ðŸ“ˆ' : 'ðŸ’¡';
    
    banner.innerHTML = `
        <div class="insight-icon-container">
            ${icon}
        </div>
        <div class="insight-content">
            <h4 class="insight-title">${escapeHtml(insight.title)}</h4>
            <p class="insight-body">${escapeHtml(insight.message)}</p>
        </div>
        <button class="insight-close" onclick="this.parentElement.remove()">
            âœ•
        </button>
    `;
    
    banner.style.display = 'flex';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DODATKOWE STYLE DLA NOWEGO UI
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

(function injectBudgetAIStyles() {
    if (document.getElementById('budget-ai-v3-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'budget-ai-v3-styles';
    styles.textContent = `
        .ai-config-card .card-header-ai {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .ai-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .ai-config-badge {
            font-size: 0.75rem;
            padding: 4px 8px;
            border-radius: var(--radius-sm);
            background: var(--bg-hover);
        }
        
        .ai-config-badge.success {
            background: rgba(16, 185, 129, 0.1);
            color: #10b981;
        }
        
        .ai-config-badge.error {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
        }
        
        .ai-config-warning {
            padding: 16px;
            background: rgba(245, 158, 11, 0.1);
            border-radius: var(--radius-md);
            margin: 16px;
            text-align: center;
        }
        
        .quick-prompts {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding-top: 16px;
        }
        
        .quick-prompt-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            border: 1px solid var(--border);
            background: var(--bg-hover);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
            font-size: 0.875rem;
        }
        
        .quick-prompt-btn:hover:not(:disabled) {
            background: var(--bg-card);
            border-color: var(--primary);
        }
        
        .quick-prompt-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .quick-prompt-icon {
            font-size: 1rem;
        }
        
        .quick-prompt-label {
            color: var(--text-primary);
        }
        
        .chat-card {
            display: flex;
            flex-direction: column;
            min-height: 500px;
        }
        
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        .chat-welcome {
            text-align: center;
            color: var(--text-secondary);
            padding: 32px;
        }
        
        .chat-welcome p {
            margin: 8px 0;
        }
        
        .chat-message {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            max-width: 85%;
        }
        
        .chat-message.user {
            align-self: flex-end;
            flex-direction: row-reverse;
        }
        
        .chat-message.assistant {
            align-self: flex-start;
        }
        
        .chat-message.loading .message-content {
            opacity: 0.7;
        }
        
        .message-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--bg-hover);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 1rem;
        }
        
        .message-content {
            padding: 12px 16px;
            border-radius: var(--radius-md);
            background: var(--bg-hover);
            line-height: 1.5;
            position: relative;
        }
        
        .chat-message.user .message-content {
            background: var(--primary);
            color: white;
        }
        
        .message-content code {
            background: rgba(0, 0, 0, 0.1);
            padding: 2px 6px;
            border-radius: var(--radius-sm);
            font-size: 0.875em;
        }
        
        .amount-highlight {
            font-weight: 600;
            color: var(--primary);
        }
        
        .chat-message.user .amount-highlight {
            color: inherit;
            text-decoration: underline;
        }
        
        .provider-badge {
            position: absolute;
            bottom: -6px;
            right: -6px;
            font-size: 0.75rem;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .chat-input-container {
            display: flex;
            gap: 8px;
            padding: 16px;
            border-top: 1px solid var(--border);
        }
        
        .chat-input {
            flex: 1;
            padding: 12px 16px;
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            background: var(--bg-hover);
            color: var(--text-primary);
            font-size: 0.875rem;
            font-family: inherit;
        }
        
        .chat-input:focus {
            outline: none;
            border-color: var(--primary);
        }
        
        .chat-input:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .proactive-insight {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            background: linear-gradient(135deg, var(--bg-card) 0%, rgba(16, 185, 129, 0.05) 100%);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            margin-bottom: 16px;
        }
        
        .insight-icon-container {
            font-size: 1.5rem;
            flex-shrink: 0;
        }
        
        .insight-content {
            flex: 1;
        }
        
        .insight-title {
            margin: 0 0 4px 0;
            font-size: 0.875rem;
            font-weight: 600;
        }
        
        .insight-body {
            margin: 0;
            font-size: 0.875rem;
            color: var(--text-secondary);
        }
        
        .insight-close {
            background: none;
            border: none;
            cursor: pointer;
            color: var(--text-muted);
            font-size: 1rem;
            padding: 4px;
        }
        
        .insight-close:hover {
            color: var(--text-primary);
        }
        
        /* Debug Panel Styles */
        .debug-panel {
            margin-top: 12px;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            font-size: 0.75rem;
            background: rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .debug-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            cursor: pointer;
            user-select: none;
            background: rgba(0, 0, 0, 0.05);
        }
        
        .debug-header:hover {
            background: rgba(0, 0, 0, 0.1);
        }
        
        .debug-status {
            display: flex;
            align-items: center;
            gap: 4px;
            font-weight: 500;
        }
        
        .debug-status.success {
            color: #22c55e;
        }
        
        .debug-status.warning {
            color: #f59e0b;
        }
        
        .debug-status.error {
            color: #ef4444;
        }
        
        .debug-toggle {
            color: var(--text-muted);
            font-size: 0.625rem;
            transition: transform 0.2s;
        }
        
        .debug-panel.expanded .debug-toggle {
            transform: rotate(180deg);
        }
        
        .debug-content {
            display: none;
            padding: 8px 10px;
            border-top: 1px solid var(--border);
        }
        
        .debug-panel.expanded .debug-content {
            display: block;
        }
        
        .debug-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
        }
        
        .debug-row:last-child {
            border-bottom: none;
        }
        
        .debug-label {
            color: var(--text-muted);
            flex-shrink: 0;
        }
        
        .debug-value {
            color: var(--text-secondary);
            text-align: right;
            word-break: break-word;
        }
        
        .debug-value.has-subcategory {
            color: #22c55e;
            font-weight: 500;
        }
        
        .debug-summary {
            font-style: italic;
            max-width: 200px;
        }
        
        .debug-row.debug-error .debug-value {
            color: #ef4444;
        }
        
        .debug-row.debug-warning .debug-value {
            color: #f59e0b;
        }
    `;
    
    document.head.appendChild(styles);
})();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// KOMPATYBILNOÅšÄ† WSTECZNA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function showBudgetApiKeyModal() {
    BudgetAISettings.show();
}

async function checkBudgetApiKey() {
    await AIProviders.loadApiKeys();
}
