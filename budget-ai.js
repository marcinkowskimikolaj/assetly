/**
 * Assetly - Budget AI Assistant
 * Profesjonalny moduł AI z obsługą wielu providerów (OpenAI + LLM7)
 * Automatyczny fallback i inteligentny routing zapytań
 */

// ═══════════════════════════════════════════════════════════
// KONFIGURACJA PROVIDERÓW
// ═══════════════════════════════════════════════════════════

const AI_PROVIDERS = {
    openai: {
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        models: [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini (tańszy)', maxTokens: 16000, contextLimit: 128000 },
            { id: 'gpt-4o', name: 'GPT-4o (mocniejszy)', maxTokens: 4096, contextLimit: 128000 },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (najszybszy)', maxTokens: 4096, contextLimit: 16000 }
        ],
        defaultModel: 'gpt-4o-mini',
        keyPrefix: 'sk-',
        icon: '🟢',
        color: '#10a37f'
    },
    llm7: {
        name: 'LLM7.io',
        endpoint: 'https://api.llm7.io/v1/chat/completions',
        models: [
            { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano (szybki)', maxTokens: 32000, contextLimit: 1000000 },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini (zbalansowany)', maxTokens: 32000, contextLimit: 1000000 },
            { id: 'o4-mini', name: 'O4 Mini (reasoning)', maxTokens: 100000, contextLimit: 200000 }
        ],
        defaultModel: 'gpt-4.1-nano',
        keyPrefix: '',
        icon: '🔵',
        color: '#3b82f6'
    }
};

const AI_MODES = {
    openai: { name: 'Tylko OpenAI', description: 'Używa wyłącznie OpenAI' },
    llm7: { name: 'Tylko LLM7', description: 'Używa wyłącznie LLM7.io' },
    auto: { name: 'Automatyczny', description: 'Inteligentnie wybiera provider - długie zapytania → LLM7, krótkie → OpenAI' }
};

// Progi dla trybu automatycznego
const AUTO_MODE_CONFIG = {
    longQueryThreshold: 500,      // znaki - powyżej tego używaj LLM7
    largeContextThreshold: 50000, // znaki JSON - powyżej tego używaj LLM7
    enableFallback: true          // automatyczny fallback przy błędzie
};

const BUDGET_QUICK_PROMPTS = [
    { id: 'summary', label: 'Podsumowanie', icon: '📊', prompt: 'Podaj kompletne podsumowanie moich finansów: łączne dochody, wydatki, bilans, stopa oszczędności. Uwzględnij podział na kategorie.' },
    { id: 'top-expenses', label: 'Top wydatki', icon: '💸', prompt: 'Podaj TOP 10 kategorii/podkategorii na które wydaję najwięcej. Dla każdej podaj sumę, średnią miesięczną i % całości wydatków.' },
    { id: 'savings-potential', label: 'Potencjał oszczędności', icon: '💰', prompt: 'Zidentyfikuj kategorie gdzie wydaję ponadprzeciętnie dużo. Oblicz ile mógłbym zaoszczędzić gdybym zredukował je do średniej. Podaj konkretne kwoty.' },
    { id: 'trends', label: 'Trendy', icon: '📈', prompt: 'Przeanalizuj trendy moich finansów miesiąc po miesiącu. Czy wydatki rosną czy maleją? Które kategorie rosną najszybciej?' },
    { id: 'income-analysis', label: 'Analiza dochodów', icon: '💵', prompt: 'Przeanalizuj moje dochody: źródła, zmiany w czasie, podwyżki. Podaj średni dochód i jego trend.' },
    { id: '503020', label: '50/30/20', icon: '🎯', prompt: 'Przeanalizuj moje wydatki według metodyki 50/30/20 (potrzeby/zachcianki/oszczędności). Czy trzymam się zdrowych proporcji? Co powinienem zmienić?' },
    { id: 'monthly-compare', label: 'Porównanie miesięcy', icon: '📅', prompt: 'Porównaj moje finanse z ostatnich 3 miesięcy. Pokaż różnice w dochodach, wydatkach i bilansie. Który miesiąc był najlepszy/najgorszy?' },
    { id: 'category-deep', label: 'Analiza kategorii', icon: '🔍', prompt: 'Podaj szczegółową analizę KAŻDEJ kategorii wydatków: suma, średnia, min, max, trend. Posortuj od największej do najmniejszej.' }
];

// ═══════════════════════════════════════════════════════════
// STAN MODUŁU AI
// ═══════════════════════════════════════════════════════════

let aiState = {
    // Klucze API
    keys: {
        openai: null,
        llm7: null
    },
    // Wybrany tryb: 'openai', 'llm7', 'auto'
    mode: 'auto',
    // Wybrany model dla każdego providera
    models: {
        openai: 'gpt-4o-mini',
        llm7: 'gpt-4.1-nano'
    },
    // Status połączeń
    status: {
        openai: { tested: false, working: false, error: null, lastTest: null },
        llm7: { tested: false, working: false, error: null, lastTest: null }
    },
    // Który provider ostatnio użyty
    lastUsedProvider: null,
    // Statystyki
    stats: {
        openaiCalls: 0,
        llm7Calls: 0,
        fallbacks: 0
    }
};

let budgetChatHistory = [];
let lastPreparedData = null;
let settingsModalOpen = false;

// ═══════════════════════════════════════════════════════════
// INICJALIZACJA I PERSYSTENCJA
// ═══════════════════════════════════════════════════════════

function loadAiSettings() {
    try {
        // Załaduj z localStorage
        const saved = localStorage.getItem('assetly_ai_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            aiState.keys = parsed.keys || aiState.keys;
            aiState.mode = parsed.mode || aiState.mode;
            aiState.models = parsed.models || aiState.models;
            aiState.stats = parsed.stats || aiState.stats;
        }
        
        // Migracja starego klucza OpenAI
        const oldKey = localStorage.getItem('openai_api_key');
        if (oldKey && !aiState.keys.openai) {
            aiState.keys.openai = oldKey;
            saveAiSettings();
        }
    } catch (e) {
        console.warn('Błąd ładowania ustawień AI:', e);
    }
}

function saveAiSettings() {
    try {
        localStorage.setItem('assetly_ai_settings', JSON.stringify({
            keys: aiState.keys,
            mode: aiState.mode,
            models: aiState.models,
            stats: aiState.stats
        }));
    } catch (e) {
        console.warn('Błąd zapisywania ustawień AI:', e);
    }
}

// ═══════════════════════════════════════════════════════════
// WYBÓR PROVIDERA (INTELIGENTNY ROUTING)
// ═══════════════════════════════════════════════════════════

function selectProvider(messageLength, contextLength) {
    const mode = aiState.mode;
    
    // Tryb manualny
    if (mode === 'openai') {
        if (!aiState.keys.openai) return { provider: null, reason: 'Brak klucza OpenAI' };
        return { provider: 'openai', reason: 'Wybrany tryb: OpenAI' };
    }
    
    if (mode === 'llm7') {
        if (!aiState.keys.llm7) return { provider: null, reason: 'Brak klucza LLM7' };
        return { provider: 'llm7', reason: 'Wybrany tryb: LLM7' };
    }
    
    // Tryb automatyczny
    const hasOpenAI = !!aiState.keys.openai;
    const hasLLM7 = !!aiState.keys.llm7;
    
    if (!hasOpenAI && !hasLLM7) {
        return { provider: null, reason: 'Brak skonfigurowanych kluczy API' };
    }
    
    // Tylko jeden provider dostępny
    if (hasOpenAI && !hasLLM7) {
        return { provider: 'openai', reason: 'Jedyny dostępny provider' };
    }
    if (hasLLM7 && !hasOpenAI) {
        return { provider: 'llm7', reason: 'Jedyny dostępny provider' };
    }
    
    // Oba dostępne - inteligentny wybór
    const isLongQuery = messageLength > AUTO_MODE_CONFIG.longQueryThreshold;
    const isLargeContext = contextLength > AUTO_MODE_CONFIG.largeContextThreshold;
    
    if (isLongQuery || isLargeContext) {
        return { 
            provider: 'llm7', 
            reason: isLongQuery 
                ? `Długie zapytanie (${messageLength} znaków) → LLM7` 
                : `Duży kontekst (${Math.round(contextLength/1000)}k znaków) → LLM7`
        };
    }
    
    // Sprawdź czy OpenAI ostatnio działał
    if (aiState.status.openai.tested && !aiState.status.openai.working) {
        return { provider: 'llm7', reason: 'OpenAI niedostępny → LLM7' };
    }
    
    return { provider: 'openai', reason: 'Standardowe zapytanie → OpenAI' };
}

function getFallbackProvider(currentProvider) {
    if (!AUTO_MODE_CONFIG.enableFallback) return null;
    
    const other = currentProvider === 'openai' ? 'llm7' : 'openai';
    if (aiState.keys[other]) {
        return other;
    }
    return null;
}

// ═══════════════════════════════════════════════════════════
// KOMUNIKACJA Z API
// ═══════════════════════════════════════════════════════════

async function callAiProvider(provider, messages, options = {}) {
    const config = AI_PROVIDERS[provider];
    const apiKey = aiState.keys[provider];
    const modelId = aiState.models[provider];
    
    if (!apiKey) {
        throw new Error(`Brak klucza API dla ${config.name}`);
    }
    
    const model = config.models.find(m => m.id === modelId) || config.models[0];
    
    const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model.id,
            messages: messages,
            temperature: options.temperature || 0.3,
            max_tokens: options.maxTokens || Math.min(2000, model.maxTokens)
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
        
        // Aktualizuj status
        aiState.status[provider] = {
            tested: true,
            working: false,
            error: errorMsg,
            lastTest: new Date().toISOString()
        };
        
        throw new Error(errorMsg);
    }
    
    const data = await response.json();
    
    // Aktualizuj status
    aiState.status[provider] = {
        tested: true,
        working: true,
        error: null,
        lastTest: new Date().toISOString()
    };
    aiState.stats[provider === 'openai' ? 'openaiCalls' : 'llm7Calls']++;
    saveAiSettings();
    
    return data.choices[0].message.content;
}

async function testConnection(provider) {
    try {
        const result = await callAiProvider(provider, [
            { role: 'user', content: 'Odpowiedz jednym słowem: OK' }
        ], { maxTokens: 10 });
        
        return { success: true, message: 'Połączenie działa poprawnie' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// ═══════════════════════════════════════════════════════════
// GŁÓWNA FUNKCJA WYSYŁANIA WIADOMOŚCI
// ═══════════════════════════════════════════════════════════

async function sendBudgetMessage(customMessage = null) {
    const input = document.getElementById('budgetChatInput');
    const message = customMessage || (input ? input.value.trim() : '');
    
    if (!message) return;
    if (input) input.value = '';
    
    // Dodaj wiadomość użytkownika
    addBudgetChatMessage('user', message);
    
    // Przygotuj dane
    const budgetData = prepareBudgetDataForAI();
    if (budgetData.error) {
        addBudgetChatMessage('assistant', `⚠️ ${budgetData.error}`);
        return;
    }
    
    const dataContext = JSON.stringify(budgetData, null, 2);
    
    // Wybierz provider
    const selection = selectProvider(message.length, dataContext.length);
    
    if (!selection.provider) {
        addBudgetChatMessage('assistant', `⚠️ ${selection.reason}\n\nKliknij ⚙️ aby skonfigurować klucze API.`);
        return;
    }
    
    // Pokaż loading z informacją o providerze
    const providerInfo = AI_PROVIDERS[selection.provider];
    const loadingId = addBudgetChatMessage('assistant', 
        `${providerInfo.icon} Analizuję dane przez ${providerInfo.name}...\n<small style="opacity:0.7">${selection.reason}</small>`
    );
    
    // Przygotuj wiadomości
    const systemPrompt = getBudgetSystemPrompt();
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `## DANE FINANSOWE UŻYTKOWNIKA\n\`\`\`json\n${dataContext}\n\`\`\`` },
        ...budgetChatHistory.slice(-10),
        { role: 'user', content: message }
    ];
    
    let usedProvider = selection.provider;
    let response = null;
    
    try {
        response = await callAiProvider(selection.provider, messages);
    } catch (error) {
        console.warn(`Błąd ${selection.provider}:`, error.message);
        
        // Spróbuj fallback
        const fallback = getFallbackProvider(selection.provider);
        if (fallback) {
            removeBudgetChatMessage(loadingId);
            const fallbackInfo = AI_PROVIDERS[fallback];
            const fallbackLoadingId = addBudgetChatMessage('assistant',
                `⚠️ ${AI_PROVIDERS[selection.provider].name} niedostępny. Przełączam na ${fallbackInfo.icon} ${fallbackInfo.name}...`
            );
            
            try {
                response = await callAiProvider(fallback, messages);
                usedProvider = fallback;
                aiState.stats.fallbacks++;
                saveAiSettings();
                removeBudgetChatMessage(fallbackLoadingId);
            } catch (fallbackError) {
                removeBudgetChatMessage(fallbackLoadingId);
                addBudgetChatMessage('assistant', 
                    `❌ Nie udało się uzyskać odpowiedzi.\n\n**${AI_PROVIDERS[selection.provider].name}:** ${error.message}\n**${fallbackInfo.name}:** ${fallbackError.message}\n\nSprawdź konfigurację w ⚙️ Ustawieniach.`
                );
                return;
            }
        } else {
            removeBudgetChatMessage(loadingId);
            addBudgetChatMessage('assistant', `❌ Błąd: ${error.message}\n\nSprawdź konfigurację w ⚙️ Ustawieniach.`);
            return;
        }
    }
    
    // Usuń loading i dodaj odpowiedź
    removeBudgetChatMessage(loadingId);
    
    // Zapisz do historii
    budgetChatHistory.push({ role: 'user', content: message });
    budgetChatHistory.push({ role: 'assistant', content: response });
    
    // Dodaj odpowiedź z badge providera
    aiState.lastUsedProvider = usedProvider;
    addBudgetChatMessage('assistant', response, usedProvider);
}

function runBudgetQuickPrompt(promptId) {
    const prompt = BUDGET_QUICK_PROMPTS.find(p => p.id === promptId);
    if (prompt) {
        sendBudgetMessage(prompt.prompt);
    }
}

// ═══════════════════════════════════════════════════════════
// PRZYGOTOWANIE DANYCH DLA AI
// ═══════════════════════════════════════════════════════════

function prepareBudgetDataForAI() {
    if (typeof allExpenses === 'undefined' || typeof allIncome === 'undefined') {
        return { error: 'Dane budżetowe nie zostały załadowane.' };
    }
    
    if (allExpenses.length === 0 && allIncome.length === 0) {
        return { error: 'Brak danych budżetowych. Dodaj najpierw wydatki lub dochody.' };
    }

    const data = {
        metadata: prepareMetadata(),
        expenses: prepareExpensesData(),
        income: prepareIncomeData(),
        monthly: prepareMonthlyBreakdown(),
        analytics: prepareAnalytics()
    };

    lastPreparedData = data;
    return data;
}

function prepareMetadata() {
    const allPeriods = new Set();
    allExpenses.forEach(e => allPeriods.add(`${e.rok}-${String(e.miesiac).padStart(2, '0')}`));
    allIncome.forEach(i => allPeriods.add(`${i.rok}-${String(i.miesiac).padStart(2, '0')}`));
    
    const sortedPeriods = [...allPeriods].sort();
    
    return {
        dataRange: {
            firstPeriod: sortedPeriods[0] || null,
            lastPeriod: sortedPeriods[sortedPeriods.length - 1] || null,
            totalMonths: sortedPeriods.length
        },
        totals: {
            expensesCount: allExpenses.length,
            incomeCount: allIncome.length,
            totalExpenses: allExpenses.reduce((s, e) => s + e.kwotaPLN, 0),
            totalIncome: allIncome.reduce((s, i) => s + i.kwotaPLN, 0),
            totalBalance: allIncome.reduce((s, i) => s + i.kwotaPLN, 0) - allExpenses.reduce((s, e) => s + e.kwotaPLN, 0)
        },
        categories: typeof BudgetCategories !== 'undefined' ? BudgetCategories.getAllCategories() : [],
        incomeSources: typeof BudgetCategories !== 'undefined' ? Object.keys(BudgetCategories.INCOME_SOURCES) : []
    };
}

function prepareExpensesData() {
    const byCategory = {};
    allExpenses.forEach(e => {
        if (!byCategory[e.kategoria]) {
            byCategory[e.kategoria] = { total: 0, count: 0, subcategories: {} };
        }
        byCategory[e.kategoria].total += e.kwotaPLN;
        byCategory[e.kategoria].count++;
        
        const subcat = e.podkategoria || '(brak)';
        if (!byCategory[e.kategoria].subcategories[subcat]) {
            byCategory[e.kategoria].subcategories[subcat] = { total: 0, count: 0, periods: {} };
        }
        byCategory[e.kategoria].subcategories[subcat].total += e.kwotaPLN;
        byCategory[e.kategoria].subcategories[subcat].count++;
        
        const period = `${e.rok}-${String(e.miesiac).padStart(2, '0')}`;
        if (!byCategory[e.kategoria].subcategories[subcat].periods[period]) {
            byCategory[e.kategoria].subcategories[subcat].periods[period] = 0;
        }
        byCategory[e.kategoria].subcategories[subcat].periods[period] += e.kwotaPLN;
    });

    const totalExpenses = allExpenses.reduce((s, e) => s + e.kwotaPLN, 0);
    const periods = new Set(allExpenses.map(e => `${e.rok}-${e.miesiac}`));
    const monthCount = periods.size || 1;

    Object.keys(byCategory).forEach(cat => {
        const catData = byCategory[cat];
        catData.monthlyAverage = catData.total / monthCount;
        catData.percentOfTotal = totalExpenses > 0 ? (catData.total / totalExpenses * 100) : 0;
        
        Object.keys(catData.subcategories).forEach(sub => {
            const subData = catData.subcategories[sub];
            subData.monthlyAverage = subData.total / monthCount;
            subData.percentOfCategory = catData.total > 0 ? (subData.total / catData.total * 100) : 0;
            subData.percentOfTotal = totalExpenses > 0 ? (subData.total / totalExpenses * 100) : 0;
        });
    });

    const allSubcategories = [];
    Object.entries(byCategory).forEach(([cat, catData]) => {
        Object.entries(catData.subcategories).forEach(([sub, subData]) => {
            allSubcategories.push({
                category: cat, subcategory: sub, total: subData.total,
                count: subData.count, monthlyAverage: subData.monthlyAverage, percentOfTotal: subData.percentOfTotal
            });
        });
    });
    allSubcategories.sort((a, b) => b.total - a.total);

    const fixed = allExpenses.filter(e => e.jestStaly);
    const variable = allExpenses.filter(e => !e.jestStaly && !e.jestTransfer);
    const transfers = allExpenses.filter(e => e.jestTransfer);

    return {
        byCategory,
        topSubcategories: allSubcategories.slice(0, 20),
        breakdown: {
            fixed: { total: fixed.reduce((s, e) => s + e.kwotaPLN, 0), count: fixed.length },
            variable: { total: variable.reduce((s, e) => s + e.kwotaPLN, 0), count: variable.length },
            transfers: { total: transfers.reduce((s, e) => s + e.kwotaPLN, 0), count: transfers.length }
        },
        rawData: allExpenses.map(e => ({
            period: `${e.rok}-${String(e.miesiac).padStart(2, '0')}`,
            category: e.kategoria, subcategory: e.podkategoria || null,
            amount: e.kwotaPLN, isFixed: e.jestStaly, isTransfer: e.jestTransfer
        }))
    };
}

function prepareIncomeData() {
    const bySource = {};
    allIncome.forEach(i => {
        if (!bySource[i.zrodlo]) {
            bySource[i.zrodlo] = { total: 0, count: 0, employers: {}, periods: {} };
        }
        bySource[i.zrodlo].total += i.kwotaPLN;
        bySource[i.zrodlo].count++;
        
        const emp = i.pracodawca || '(nieokreślony)';
        if (!bySource[i.zrodlo].employers[emp]) {
            bySource[i.zrodlo].employers[emp] = { total: 0, count: 0 };
        }
        bySource[i.zrodlo].employers[emp].total += i.kwotaPLN;
        bySource[i.zrodlo].employers[emp].count++;
        
        const period = `${i.rok}-${String(i.miesiac).padStart(2, '0')}`;
        if (!bySource[i.zrodlo].periods[period]) {
            bySource[i.zrodlo].periods[period] = 0;
        }
        bySource[i.zrodlo].periods[period] += i.kwotaPLN;
    });

    const totalIncome = allIncome.reduce((s, i) => s + i.kwotaPLN, 0);
    const periods = new Set(allIncome.map(i => `${i.rok}-${i.miesiac}`));
    const monthCount = periods.size || 1;

    Object.keys(bySource).forEach(src => {
        bySource[src].monthlyAverage = bySource[src].total / monthCount;
        bySource[src].percentOfTotal = totalIncome > 0 ? (bySource[src].total / totalIncome * 100) : 0;
    });

    const salaryHistory = [];
    const employers = [...new Set(allIncome.filter(i => i.pracodawca && i.zrodlo === 'Wynagrodzenie').map(i => i.pracodawca))];
    
    employers.forEach(emp => {
        const empIncome = allIncome
            .filter(i => i.pracodawca === emp && i.zrodlo === 'Wynagrodzenie')
            .sort((a, b) => a.rok !== b.rok ? a.rok - b.rok : a.miesiac - b.miesiac);
        
        if (empIncome.length > 0) {
            const history = empIncome.map((inc, idx) => {
                const prev = idx > 0 ? empIncome[idx - 1] : null;
                return {
                    period: `${inc.rok}-${String(inc.miesiac).padStart(2, '0')}`,
                    amount: inc.kwotaPLN,
                    change: prev ? inc.kwotaPLN - prev.kwotaPLN : 0,
                    changePercent: prev && prev.kwotaPLN > 0 ? ((inc.kwotaPLN - prev.kwotaPLN) / prev.kwotaPLN * 100) : 0
                };
            });
            
            salaryHistory.push({
                employer: emp, history,
                summary: {
                    firstSalary: empIncome[0].kwotaPLN,
                    currentSalary: empIncome[empIncome.length - 1].kwotaPLN,
                    totalGrowth: empIncome[0].kwotaPLN > 0 ? ((empIncome[empIncome.length - 1].kwotaPLN - empIncome[0].kwotaPLN) / empIncome[0].kwotaPLN * 100) : 0,
                    monthsEmployed: empIncome.length
                }
            });
        }
    });

    return {
        bySource, salaryHistory,
        rawData: allIncome.map(i => ({
            period: `${i.rok}-${String(i.miesiac).padStart(2, '0')}`,
            source: i.zrodlo, employer: i.pracodawca || null, amount: i.kwotaPLN
        }))
    };
}

function prepareMonthlyBreakdown() {
    const months = {};
    
    allExpenses.forEach(e => {
        const period = `${e.rok}-${String(e.miesiac).padStart(2, '0')}`;
        if (!months[period]) {
            months[period] = { period, income: 0, expenses: 0, fixed: 0, variable: 0, transfers: 0, expensesByCategory: {}, incomeBySource: {} };
        }
        months[period].expenses += e.kwotaPLN;
        if (e.jestStaly) months[period].fixed += e.kwotaPLN;
        else if (e.jestTransfer) months[period].transfers += e.kwotaPLN;
        else months[period].variable += e.kwotaPLN;
        
        if (!months[period].expensesByCategory[e.kategoria]) months[period].expensesByCategory[e.kategoria] = 0;
        months[period].expensesByCategory[e.kategoria] += e.kwotaPLN;
    });
    
    allIncome.forEach(i => {
        const period = `${i.rok}-${String(i.miesiac).padStart(2, '0')}`;
        if (!months[period]) {
            months[period] = { period, income: 0, expenses: 0, fixed: 0, variable: 0, transfers: 0, expensesByCategory: {}, incomeBySource: {} };
        }
        months[period].income += i.kwotaPLN;
        if (!months[period].incomeBySource[i.zrodlo]) months[period].incomeBySource[i.zrodlo] = 0;
        months[period].incomeBySource[i.zrodlo] += i.kwotaPLN;
    });
    
    Object.values(months).forEach(m => {
        m.balance = m.income - m.expenses + m.transfers;
        m.savingsRate = m.income > 0 ? (m.balance / m.income * 100) : 0;
    });
    
    return Object.values(months).sort((a, b) => a.period.localeCompare(b.period));
}

function prepareAnalytics() {
    const monthly = prepareMonthlyBreakdown();
    if (monthly.length === 0) return {};
    
    const avgIncome = monthly.reduce((s, m) => s + m.income, 0) / monthly.length;
    const avgExpenses = monthly.reduce((s, m) => s + m.expenses, 0) / monthly.length;
    const avgBalance = monthly.reduce((s, m) => s + m.balance, 0) / monthly.length;
    
    const maxExpMonth = monthly.reduce((max, m) => m.expenses > max.expenses ? m : max, monthly[0]);
    const minExpMonth = monthly.reduce((min, m) => m.expenses < min.expenses ? m : min, monthly[0]);
    
    const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
    const needs = allExpenses.filter(e => typeof BudgetCategories !== 'undefined' && BudgetCategories.getMethodology(e.kategoria) === 'needs' && !e.jestTransfer).reduce((s, e) => s + e.kwotaPLN, 0);
    const wants = allExpenses.filter(e => typeof BudgetCategories !== 'undefined' && BudgetCategories.getMethodology(e.kategoria) === 'wants' && !e.jestTransfer).reduce((s, e) => s + e.kwotaPLN, 0);
    
    return {
        averages: { income: avgIncome, expenses: avgExpenses, balance: avgBalance },
        extremes: { maxExpenses: { period: maxExpMonth.period, amount: maxExpMonth.expenses }, minExpenses: { period: minExpMonth.period, amount: minExpMonth.expenses } },
        methodology503020: {
            needs: { amount: needs, percent: totalIncome > 0 ? (needs / totalIncome * 100) : 0 },
            wants: { amount: wants, percent: totalIncome > 0 ? (wants / totalIncome * 100) : 0 },
            savings: { amount: totalIncome - needs - wants, percent: totalIncome > 0 ? ((totalIncome - needs - wants) / totalIncome * 100) : 0 }
        }
    };
}

// ═══════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════

function getBudgetSystemPrompt() {
    return `Jesteś EKSPERTEM od finansów osobistych. Analizujesz dane budżetowe użytkownika.

## ZASADY
1. Używaj WYŁĄCZNIE danych z kontekstu - nie wymyślaj
2. Podawaj DOKŁADNE kwoty (format: "X XXX zł")
3. Procenty z 1 miejscem po przecinku
4. **ZAWSZE używaj tabel markdown** dla rankingów i porównań
5. Odpowiadaj po polsku, konkretnie i rzeczowo

## STRUKTURA DANYCH
- expenses.byCategory[X].subcategories[Y] - wydatki po kategoriach
- expenses.topSubcategories - TOP 20 podkategorii
- income.bySource - dochody po źródłach
- income.salaryHistory - historia wynagrodzeń
- monthly[] - dane miesięczne
- analytics - średnie, ekstrema, 50/30/20

## FORMAT TABEL
| Kategoria | Suma | Średnia | % |
|-----------|------|---------|---|
| Żywność | 3 500 zł | 875 zł | 25% |

## PAMIĘTAJ
- TRANSFERY to nie wydatki konsumpcyjne
- Wydatki STAŁE vs ZMIENNE to różne kategorie
- Dawaj konkretne wnioski i rekomendacje`;
}

// ═══════════════════════════════════════════════════════════
// UI - RENDEROWANIE GŁÓWNE
// ═══════════════════════════════════════════════════════════

function renderBudgetAITab() {
    const container = document.getElementById('budget-ai');
    if (!container) return;
    
    loadAiSettings();
    
    const expCount = typeof allExpenses !== 'undefined' ? allExpenses.length : 0;
    const incCount = typeof allIncome !== 'undefined' ? allIncome.length : 0;
    
    // Status providerów
    const hasOpenAI = !!aiState.keys.openai;
    const hasLLM7 = !!aiState.keys.llm7;
    const currentMode = AI_MODES[aiState.mode];
    
    container.innerHTML = `
        <div class="ai-container">
            <!-- Status bar -->
            <div class="ai-status-bar">
                <div class="ai-data-info">
                    <span class="data-badge">📊 ${expCount} wydatków</span>
                    <span class="data-badge">💵 ${incCount} dochodów</span>
                    <span class="data-badge">📅 ${getMonthCount()} miesięcy</span>
                </div>
                <div class="ai-provider-status">
                    <span class="provider-badge ${hasOpenAI ? 'active' : 'inactive'}" title="OpenAI ${hasOpenAI ? 'skonfigurowany' : 'brak klucza'}">
                        ${AI_PROVIDERS.openai.icon} OpenAI
                    </span>
                    <span class="provider-badge ${hasLLM7 ? 'active' : 'inactive'}" title="LLM7 ${hasLLM7 ? 'skonfigurowany' : 'brak klucza'}">
                        ${AI_PROVIDERS.llm7.icon} LLM7
                    </span>
                    <span class="mode-badge" title="${currentMode.description}">
                        ⚡ ${currentMode.name}
                    </span>
                </div>
            </div>
            
            <!-- Szybkie analizy -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">🤖 Asystent budżetowy AI</h3>
                    <button class="btn btn-ghost btn-sm" onclick="openAiSettingsModal()" title="Ustawienia AI">
                        ⚙️ Ustawienia
                    </button>
                </div>
                
                <div class="quick-prompts">
                    ${BUDGET_QUICK_PROMPTS.map(p => `
                        <button class="quick-prompt-btn" onclick="runBudgetQuickPrompt('${p.id}')" title="${p.prompt}">
                            <span class="quick-prompt-icon">${p.icon}</span>
                            <span class="quick-prompt-label">${p.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <!-- Chat -->
            <div class="card chat-card">
                <div id="budgetChatMessages" class="chat-messages">
                    <div class="chat-welcome">
                        <h4>👋 Witaj w Asystencie Budżetowym!</h4>
                        <p>Mam dostęp do wszystkich Twoich danych finansowych. Mogę odpowiedzieć na pytania typu:</p>
                        <ul>
                            <li>💸 "Ile wydałem na paliwo?"</li>
                            <li>📊 "Pokaż TOP 10 kategorii wydatków"</li>
                            <li>📈 "Jak zmieniało się wynagrodzenie?"</li>
                            <li>⚖️ "Porównaj wydatki grudzień vs listopad"</li>
                        </ul>
                        ${!hasOpenAI && !hasLLM7 ? `
                            <div class="chat-warning">
                                ⚠️ <strong>Brak skonfigurowanych kluczy API.</strong><br>
                                Kliknij "⚙️ Ustawienia" aby dodać klucz OpenAI lub LLM7.
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="chat-input-container">
                    <input type="text" id="budgetChatInput" class="chat-input" 
                        placeholder="Zadaj pytanie o swój budżet..."
                        onkeypress="if(event.key==='Enter') sendBudgetMessage()"
                        ${!hasOpenAI && !hasLLM7 ? 'disabled' : ''}>
                    <button class="btn btn-primary" onclick="sendBudgetMessage()" ${!hasOpenAI && !hasLLM7 ? 'disabled' : ''}>
                        Wyślij
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Modal ustawień -->
        <div id="aiSettingsModal" class="ai-settings-modal ${settingsModalOpen ? 'active' : ''}">
            <div class="ai-settings-content">
                ${renderSettingsContent()}
            </div>
        </div>
    `;
}

function renderSettingsContent() {
    const openaiStatus = aiState.status.openai;
    const llm7Status = aiState.status.llm7;
    
    return `
        <div class="settings-header">
            <h3>⚙️ Ustawienia Asystenta AI</h3>
            <button class="btn btn-ghost btn-icon" onclick="closeAiSettingsModal()">✕</button>
        </div>
        
        <div class="settings-body">
            <!-- Tryb działania -->
            <div class="settings-section">
                <h4>Tryb działania</h4>
                <p class="settings-hint">Wybierz jak asystent ma wybierać dostawcę AI</p>
                
                <div class="mode-selector">
                    ${Object.entries(AI_MODES).map(([key, mode]) => `
                        <label class="mode-option ${aiState.mode === key ? 'selected' : ''}">
                            <input type="radio" name="aiMode" value="${key}" 
                                ${aiState.mode === key ? 'checked' : ''} 
                                onchange="setAiMode('${key}')">
                            <div class="mode-option-content">
                                <span class="mode-option-name">${mode.name}</span>
                                <span class="mode-option-desc">${mode.description}</span>
                            </div>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <!-- OpenAI -->
            <div class="settings-section provider-section">
                <div class="provider-header">
                    <h4>${AI_PROVIDERS.openai.icon} OpenAI</h4>
                    <span class="provider-status ${openaiStatus.working ? 'ok' : openaiStatus.tested ? 'error' : 'unknown'}">
                        ${openaiStatus.working ? '✓ Działa' : openaiStatus.tested ? '✗ Błąd' : '? Nie testowany'}
                    </span>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Klucz API</label>
                    <div class="input-with-action">
                        <input type="password" id="openaiKeyInput" class="form-input" 
                            value="${aiState.keys.openai || ''}" 
                            placeholder="sk-..."
                            onchange="updateApiKey('openai', this.value)">
                        <button class="btn btn-ghost btn-sm" onclick="toggleKeyVisibility('openaiKeyInput')" title="Pokaż/ukryj">👁️</button>
                    </div>
                    <small class="form-hint">Pobierz na <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a></small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Model</label>
                    <select class="form-select" onchange="setModel('openai', this.value)">
                        ${AI_PROVIDERS.openai.models.map(m => `
                            <option value="${m.id}" ${aiState.models.openai === m.id ? 'selected' : ''}>${m.name}</option>
                        `).join('')}
                    </select>
                </div>
                
                <button class="btn btn-secondary btn-sm" onclick="testProviderConnection('openai')" ${!aiState.keys.openai ? 'disabled' : ''}>
                    🔌 Testuj połączenie
                </button>
                
                ${openaiStatus.error ? `<div class="provider-error">❌ ${openaiStatus.error}</div>` : ''}
            </div>
            
            <!-- LLM7 -->
            <div class="settings-section provider-section">
                <div class="provider-header">
                    <h4>${AI_PROVIDERS.llm7.icon} LLM7.io</h4>
                    <span class="provider-status ${llm7Status.working ? 'ok' : llm7Status.tested ? 'error' : 'unknown'}">
                        ${llm7Status.working ? '✓ Działa' : llm7Status.tested ? '✗ Błąd' : '? Nie testowany'}
                    </span>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Klucz API</label>
                    <div class="input-with-action">
                        <input type="password" id="llm7KeyInput" class="form-input" 
                            value="${aiState.keys.llm7 || ''}" 
                            placeholder="Twój klucz LLM7..."
                            onchange="updateApiKey('llm7', this.value)">
                        <button class="btn btn-ghost btn-sm" onclick="toggleKeyVisibility('llm7KeyInput')" title="Pokaż/ukryj">👁️</button>
                    </div>
                    <small class="form-hint">Pobierz na <a href="https://llm7.io" target="_blank">llm7.io</a> - obsługuje duże konteksty</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Model</label>
                    <select class="form-select" onchange="setModel('llm7', this.value)">
                        ${AI_PROVIDERS.llm7.models.map(m => `
                            <option value="${m.id}" ${aiState.models.llm7 === m.id ? 'selected' : ''}>${m.name}</option>
                        `).join('')}
                    </select>
                </div>
                
                <button class="btn btn-secondary btn-sm" onclick="testProviderConnection('llm7')" ${!aiState.keys.llm7 ? 'disabled' : ''}>
                    🔌 Testuj połączenie
                </button>
                
                ${llm7Status.error ? `<div class="provider-error">❌ ${llm7Status.error}</div>` : ''}
            </div>
            
            <!-- Statystyki -->
            <div class="settings-section">
                <h4>📈 Statystyki użycia</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-value">${aiState.stats.openaiCalls}</span>
                        <span class="stat-label">Zapytań OpenAI</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${aiState.stats.llm7Calls}</span>
                        <span class="stat-label">Zapytań LLM7</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${aiState.stats.fallbacks}</span>
                        <span class="stat-label">Przełączeń awaryjnych</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="settings-footer">
            <button class="btn btn-secondary" onclick="closeAiSettingsModal()">Zamknij</button>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// UI - FUNKCJE POMOCNICZE
// ═══════════════════════════════════════════════════════════

function openAiSettingsModal() {
    settingsModalOpen = true;
    const modal = document.getElementById('aiSettingsModal');
    if (modal) {
        modal.classList.add('active');
        modal.querySelector('.ai-settings-content').innerHTML = renderSettingsContent();
    }
}

function closeAiSettingsModal() {
    settingsModalOpen = false;
    const modal = document.getElementById('aiSettingsModal');
    if (modal) {
        modal.classList.remove('active');
    }
    // Odśwież główny widok
    renderBudgetAITab();
}

function updateApiKey(provider, value) {
    aiState.keys[provider] = value.trim() || null;
    aiState.status[provider] = { tested: false, working: false, error: null, lastTest: null };
    saveAiSettings();
}

function setAiMode(mode) {
    aiState.mode = mode;
    saveAiSettings();
    // Odśwież modal
    const content = document.querySelector('.ai-settings-content');
    if (content) content.innerHTML = renderSettingsContent();
}

function setModel(provider, modelId) {
    aiState.models[provider] = modelId;
    saveAiSettings();
}

function toggleKeyVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

async function testProviderConnection(provider) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '⏳ Testuję...';
    btn.disabled = true;
    
    const result = await testConnection(provider);
    
    btn.textContent = originalText;
    btn.disabled = false;
    
    // Odśwież modal
    const content = document.querySelector('.ai-settings-content');
    if (content) content.innerHTML = renderSettingsContent();
    
    if (result.success) {
        showToast(`${AI_PROVIDERS[provider].name}: Połączenie OK!`, 'success');
    } else {
        showToast(`${AI_PROVIDERS[provider].name}: ${result.message}`, 'error');
    }
}

function getMonthCount() {
    const periods = new Set();
    if (typeof allExpenses !== 'undefined') allExpenses.forEach(e => periods.add(`${e.rok}-${e.miesiac}`));
    if (typeof allIncome !== 'undefined') allIncome.forEach(i => periods.add(`${i.rok}-${i.miesiac}`));
    return periods.size;
}

// ═══════════════════════════════════════════════════════════
// UI - CHAT MESSAGES
// ═══════════════════════════════════════════════════════════

let budgetMessageCounter = 0;

function addBudgetChatMessage(role, content, provider = null) {
    const container = document.getElementById('budgetChatMessages');
    if (!container) return null;
    
    const welcome = container.querySelector('.chat-welcome');
    if (welcome) welcome.remove();
    
    const id = `budget-msg-${++budgetMessageCounter}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = `chat-message ${role}`;
    
    const formattedContent = formatMarkdownToHtml(content);
    const providerBadge = provider && role === 'assistant' 
        ? `<span class="message-provider" style="background:${AI_PROVIDERS[provider].color}">${AI_PROVIDERS[provider].icon} ${AI_PROVIDERS[provider].name}</span>` 
        : '';
    
    div.innerHTML = `
        <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-bubble">
            ${providerBadge}
            <div class="message-content">${formattedContent}</div>
        </div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    
    return id;
}

function removeBudgetChatMessage(id) {
    const msg = document.getElementById(id);
    if (msg) msg.remove();
}

function formatMarkdownToHtml(text) {
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    text = text.replace(/(\|.+\|[\r\n]+)+/g, (tableMatch) => {
        const rows = tableMatch.trim().split('\n').filter(row => row.trim());
        let html = '<table class="ai-table">';
        
        rows.forEach((row, idx) => {
            if (row.match(/^\|[\s\-:]+\|$/)) return;
            const cells = row.split('|').filter(c => c.trim() !== '');
            const tag = idx === 0 ? 'th' : 'td';
            html += '<tr>' + cells.map(cell => `<${tag}>${cell.trim()}</${tag}>`).join('') + '</tr>';
        });
        
        return html + '</table>';
    });
    
    text = text.replace(/^(\s*[-*]\s+.+(\n|$))+/gm, (listMatch) => {
        const items = listMatch.trim().split('\n')
            .filter(item => item.trim())
            .map(item => `<li>${item.replace(/^\s*[-*]\s+/, '')}</li>`)
            .join('');
        return `<ul>${items}</ul>`;
    });
    
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/^#### (.+)$/gm, '<h5>$1</h5>');
    text = text.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    text = text.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/\n/g, '<br>');
    text = text.replace(/<\/(table|ul|ol|pre|h[1-5])><br>/g, '</$1>');
    text = text.replace(/<br><(table|ul|ol|pre|h[1-5])/g, '<$1');
    
    return text;
}

// ═══════════════════════════════════════════════════════════
// STYLE
// ═══════════════════════════════════════════════════════════

if (!document.getElementById('budgetAiStyles')) {
    const styles = document.createElement('style');
    styles.id = 'budgetAiStyles';
    styles.textContent = `
        /* Container */
        .ai-container { display: flex; flex-direction: column; gap: 20px; }
        
        /* Status Bar */
        .ai-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        .ai-data-info { display: flex; gap: 8px; flex-wrap: wrap; }
        .data-badge {
            background: var(--bg-hover);
            padding: 6px 12px;
            border-radius: var(--radius-md);
            font-size: 0.8rem;
            color: var(--text-secondary);
        }
        .ai-provider-status { display: flex; gap: 8px; align-items: center; }
        .provider-badge {
            padding: 4px 10px;
            border-radius: var(--radius-md);
            font-size: 0.75rem;
            font-weight: 500;
        }
        .provider-badge.active { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .provider-badge.inactive { background: var(--bg-hover); color: var(--text-muted); }
        .mode-badge {
            background: var(--primary);
            color: white;
            padding: 4px 10px;
            border-radius: var(--radius-md);
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        /* Quick Prompts */
        .quick-prompts {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 10px;
        }
        .quick-prompt-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 14px 10px;
            background: var(--bg-hover);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.2s;
        }
        .quick-prompt-btn:hover {
            background: var(--bg-card);
            border-color: var(--primary);
            transform: translateY(-2px);
        }
        .quick-prompt-icon { font-size: 1.4rem; }
        .quick-prompt-label { font-size: 0.75rem; color: var(--text-primary); text-align: center; }
        
        /* Chat */
        .chat-card { display: flex; flex-direction: column; min-height: 450px; }
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            max-height: 500px;
        }
        .chat-welcome {
            padding: 20px;
            background: var(--bg-hover);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
        }
        .chat-welcome h4 { margin: 0 0 12px 0; color: var(--text-primary); }
        .chat-welcome ul { margin: 12px 0; padding-left: 20px; }
        .chat-welcome li { margin: 6px 0; }
        .chat-warning {
            margin-top: 16px;
            padding: 12px;
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: var(--radius-md);
            color: #f59e0b;
        }
        
        .chat-message { display: flex; gap: 12px; max-width: 90%; }
        .chat-message.user { align-self: flex-end; flex-direction: row-reverse; }
        .message-avatar {
            width: 36px; height: 36px;
            border-radius: 50%;
            background: var(--bg-hover);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            font-size: 1rem;
        }
        .message-bubble { display: flex; flex-direction: column; gap: 4px; }
        .message-provider {
            align-self: flex-start;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.65rem;
            color: white;
            font-weight: 500;
        }
        .message-content {
            padding: 12px 16px;
            border-radius: var(--radius-md);
            background: var(--bg-card);
            border: 1px solid var(--border);
            line-height: 1.6;
            font-size: 0.9rem;
        }
        .chat-message.user .message-content {
            background: var(--primary);
            color: white;
            border: none;
        }
        
        .message-content h3, .message-content h4, .message-content h5 { margin: 12px 0 6px 0; }
        .message-content h3:first-child, .message-content h4:first-child { margin-top: 0; }
        .message-content code { background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
        .message-content pre { background: var(--bg-hover); padding: 12px; border-radius: var(--radius-md); overflow-x: auto; margin: 8px 0; }
        .message-content pre code { background: none; padding: 0; }
        .message-content ul, .message-content ol { margin: 8px 0; padding-left: 20px; }
        .message-content li { margin: 4px 0; }
        
        .message-content table, .message-content .ai-table {
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 0.8rem;
            width: 100%;
            display: block;
            overflow-x: auto;
        }
        .message-content th, .message-content td {
            border: 1px solid var(--border);
            padding: 8px 10px;
            text-align: left;
        }
        .message-content th { background: var(--primary); color: white; font-weight: 600; }
        .message-content tr:nth-child(even) td { background: var(--bg-hover); }
        
        .chat-input-container {
            display: flex;
            gap: 12px;
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
            font-size: 0.9rem;
        }
        .chat-input:focus { outline: none; border-color: var(--primary); }
        .chat-input:disabled { opacity: 0.5; cursor: not-allowed; }
        
        /* Settings Modal */
        .ai-settings-modal {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s;
        }
        .ai-settings-modal.active { opacity: 1; visibility: visible; }
        .ai-settings-content {
            background: var(--bg-card);
            border-radius: var(--radius-lg);
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
        }
        .settings-header h3 { margin: 0; font-size: 1.25rem; }
        
        .settings-body { padding: 24px; }
        .settings-section {
            margin-bottom: 28px;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--border);
        }
        .settings-section:last-child { margin-bottom: 0; border-bottom: none; }
        .settings-section h4 { margin: 0 0 8px 0; font-size: 1rem; }
        .settings-hint { margin: 0 0 16px 0; font-size: 0.85rem; color: var(--text-muted); }
        
        /* Mode Selector */
        .mode-selector { display: flex; flex-direction: column; gap: 8px; }
        .mode-option {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border: 2px solid var(--border);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.2s;
        }
        .mode-option:hover { border-color: var(--primary); }
        .mode-option.selected { border-color: var(--primary); background: rgba(139, 92, 246, 0.1); }
        .mode-option input { display: none; }
        .mode-option-content { display: flex; flex-direction: column; }
        .mode-option-name { font-weight: 600; font-size: 0.95rem; }
        .mode-option-desc { font-size: 0.8rem; color: var(--text-muted); }
        
        /* Provider Section */
        .provider-section { background: var(--bg-hover); padding: 20px; border-radius: var(--radius-md); }
        .provider-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .provider-header h4 { margin: 0; }
        .provider-status {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        .provider-status.ok { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .provider-status.error { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
        .provider-status.unknown { background: var(--bg-card); color: var(--text-muted); }
        .provider-error {
            margin-top: 12px;
            padding: 10px;
            background: rgba(239, 68, 68, 0.1);
            border-radius: var(--radius-md);
            font-size: 0.8rem;
            color: #ef4444;
        }
        
        .input-with-action { display: flex; gap: 8px; }
        .input-with-action .form-input { flex: 1; }
        
        .form-hint {
            display: block;
            margin-top: 6px;
            font-size: 0.75rem;
            color: var(--text-muted);
        }
        .form-hint a { color: var(--primary); }
        
        /* Stats Grid */
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .stat-item { text-align: center; padding: 16px; background: var(--bg-hover); border-radius: var(--radius-md); }
        .stat-value { display: block; font-size: 1.5rem; font-weight: 700; color: var(--primary); }
        .stat-label { font-size: 0.75rem; color: var(--text-muted); }
        
        .settings-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            text-align: right;
        }
        
        @media (max-width: 768px) {
            .ai-status-bar { flex-direction: column; align-items: flex-start; }
            .quick-prompts { grid-template-columns: repeat(2, 1fr); }
            .stats-grid { grid-template-columns: 1fr; }
            .chat-message { max-width: 95%; }
        }
    `;
    document.head.appendChild(styles);
}

// Inicjalizacja przy załadowaniu
loadAiSettings();
