/**
 * Assetly - Budget AI Assistant
 * Integracja OpenAI dla modułu budżetu
 */

// ═══════════════════════════════════════════════════════════
// KONFIGURACJA
// ═══════════════════════════════════════════════════════════

const BUDGET_AI_MODEL = 'gpt-4o-mini';

const BUDGET_QUICK_PROMPTS = [
    {
        id: 'summary',
        label: 'Podsumowanie miesiąca',
        icon: '📊',
        prompt: 'Podsumuj moje finanse z ostatniego zamkniętego miesiąca. Podaj: bilans, wykonanie planu, 3 najważniejsze obserwacje.'
    },
    {
        id: 'savings',
        label: 'Gdzie oszczędzić',
        icon: '💰',
        prompt: 'Zidentyfikuj 3 kategorie gdzie wydaję więcej niż średnia historyczna. Dla każdej podaj konkretną kwotę potencjalnej oszczędności i jak to wpłynie na moje cele.'
    },
    {
        id: 'projection',
        label: 'Projekcja',
        icon: '🔮',
        prompt: 'Na podstawie trendów, jaki będzie mój bilans za następny miesiąc? Uwzględnij sezonowość i plan inwestycji.'
    },
    {
        id: 'trends',
        label: 'Analiza trendów',
        icon: '📈',
        prompt: 'Jak zmieniały się moje wydatki i dochody przez ostatnie 6 miesięcy? Czy widzisz niepokojące trendy?'
    },
    {
        id: 'compare',
        label: 'Porównanie r/r',
        icon: '📅',
        prompt: 'Porównaj moje finanse z ostatniego miesiąca z tym samym miesiącem rok temu. Co się zmieniło?'
    },
    {
        id: '503020',
        label: 'Analiza 50/30/20',
        icon: '🎯',
        prompt: 'Przeanalizuj moje wydatki według metodyki 50/30/20. Czy trzymam się zdrowych proporcji?'
    }
];

// ═══════════════════════════════════════════════════════════
// STAN
// ═══════════════════════════════════════════════════════════

let budgetChatHistory = [];
let budgetAiApiKey = null;

// ═══════════════════════════════════════════════════════════
// RENDEROWANIE TAB AI
// ═══════════════════════════════════════════════════════════

function renderBudgetAITab() {
    const container = document.getElementById('budget-ai');
    if (!container) return;
    
    container.innerHTML = `
        <div class="ai-container">
            <!-- Sekcja szybkich analiz -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">🤖 Asystent budżetowy</h3>
                    <button class="btn btn-ghost btn-sm" onclick="showBudgetApiKeyModal()" title="Ustawienia API">
                        ⚙️
                    </button>
                </div>
                
                <div class="quick-prompts">
                    ${BUDGET_QUICK_PROMPTS.map(p => `
                        <button class="quick-prompt-btn" onclick="runBudgetQuickPrompt('${p.id}')">
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
                        <p>👋 Cześć! Jestem Twoim asystentem budżetowym.</p>
                        <p>Mogę pomóc Ci przeanalizować wydatki, znaleźć oszczędności, porównać trendy i odpowiedzieć na pytania o Twój budżet.</p>
                        <p>Wybierz jedną z szybkich analiz powyżej lub zadaj własne pytanie.</p>
                    </div>
                </div>
                
                <div class="chat-input-container">
                    <input type="text" id="budgetChatInput" class="chat-input" 
                        placeholder="Zadaj pytanie o swój budżet..."
                        onkeypress="if(event.key==='Enter') sendBudgetMessage()">
                    <button class="btn btn-primary" onclick="sendBudgetMessage()">
                        Wyślij
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Sprawdź czy mamy klucz API
    checkBudgetApiKey();
}

// ═══════════════════════════════════════════════════════════
// PRZYGOTOWANIE DANYCH DLA AI
// ═══════════════════════════════════════════════════════════

function prepareBudgetDataForAI() {
    const availableMonths = getAvailableMonthsFromData();
    if (availableMonths.length === 0) {
        return { error: 'Brak danych budżetowych' };
    }
    
    // Ostatni zamknięty miesiąc
    const lastMonth = availableMonths[0];
    const currentMonthData = getMonthlyData(lastMonth.rok, lastMonth.miesiac);
    
    // Poprzedni miesiąc
    const prevMonthIdx = lastMonth.miesiac === 1 ? 12 : lastMonth.miesiac - 1;
    const prevYearIdx = lastMonth.miesiac === 1 ? lastMonth.rok - 1 : lastMonth.rok;
    const previousMonthData = getMonthlyData(prevYearIdx, prevMonthIdx);
    
    // Ten sam miesiąc rok temu
    const sameMonthLastYear = getMonthlyData(lastMonth.rok - 1, lastMonth.miesiac);
    
    // Ostatnie 12 miesięcy
    const last12Months = getLast12MonthsData();
    const stats = BudgetMetrics.calculatePeriodStats(last12Months);
    const categoryAverages = BudgetMetrics.aggregateByCategory(last12Months);
    
    // Trendy
    const incomeTrend = BudgetMetrics.calculateTrend(last12Months, 'income');
    const expensesTrend = BudgetMetrics.calculateTrend(last12Months, 'expenses');
    const balanceTrend = BudgetMetrics.calculateTrend(last12Months, 'balance');
    
    // Anomalie
    const anomalies = BudgetMetrics.findAnomalies(currentMonthData, categoryAverages);
    
    // Sezonowość
    const seasonality = BudgetMetrics.calculateSeasonality(last12Months);
    
    // 50/30/20
    const analysis503020 = BudgetMetrics.analyze503020(currentMonthData);
    
    // Historia wynagrodzeń
    const employers = [...new Set(allIncome.filter(i => i.pracodawca).map(i => i.pracodawca))];
    const salaryHistories = employers.map(emp => ({
        pracodawca: emp,
        ...BudgetMetrics.getSalaryHistory(allIncome, emp)
    }));
    
    // Plan inwestycji
    const investmentPlan = getInvestmentPlanFromCalculator();
    
    // Wydatki stałe
    const recurringMonthly = allRecurring
        .filter(r => r.czestotliwosc === 'monthly' && r.aktywny)
        .reduce((sum, r) => sum + r.kwotaTypowa, 0);
    
    return {
        // Metadane
        dataRange: {
            from: availableMonths[availableMonths.length - 1],
            to: availableMonths[0],
            monthsCount: availableMonths.length
        },
        
        // Ostatni miesiąc
        currentMonth: {
            period: BudgetCategories.formatPeriod(lastMonth.rok, lastMonth.miesiac),
            rok: lastMonth.rok,
            miesiac: lastMonth.miesiac,
            income: currentMonthData.income.total,
            expenses: currentMonthData.expenses.total,
            fixed: currentMonthData.expenses.fixed,
            variable: currentMonthData.expenses.variable,
            transfers: currentMonthData.expenses.transfers,
            balance: currentMonthData.balance,
            savingsRate: currentMonthData.savingsRate,
            topCategories: BudgetMetrics.getTopCategories(currentMonthData, 5).map(c => ({
                kategoria: c.kategoria,
                kwota: c.kwota,
                procent: c.procent
            })),
            incomeBySource: Object.entries(currentMonthData.income.bySource).map(([src, data]) => ({
                zrodlo: src,
                kwota: data.total
            }))
        },
        
        // Porównania
        comparisons: {
            vsPreviousMonth: previousMonthData ? {
                income: currentMonthData.income.total - previousMonthData.income.total,
                expenses: currentMonthData.expenses.total - previousMonthData.expenses.total,
                balance: currentMonthData.balance - previousMonthData.balance
            } : null,
            vsLastYear: sameMonthLastYear.income.total > 0 ? {
                income: currentMonthData.income.total - sameMonthLastYear.income.total,
                expenses: currentMonthData.expenses.total - sameMonthLastYear.expenses.total,
                balance: currentMonthData.balance - sameMonthLastYear.balance
            } : null
        },
        
        // Średnie i statystyki
        averages: {
            income: stats.average.income,
            expenses: stats.average.expenses,
            fixed: stats.average.fixed,
            variable: stats.average.variable,
            balance: stats.average.balance,
            savingsRate: stats.savingsRate
        },
        
        // Trendy
        trends: {
            income: {
                direction: incomeTrend.direction,
                percentChange: incomeTrend.percentChange
            },
            expenses: {
                direction: expensesTrend.direction,
                percentChange: expensesTrend.percentChange
            },
            balance: {
                direction: balanceTrend.direction,
                percentChange: balanceTrend.percentChange
            }
        },
        
        // Anomalie
        anomalies: anomalies.slice(0, 5).map(a => ({
            kategoria: a.kategoria,
            current: a.current,
            average: a.average,
            percentAbove: a.percent
        })),
        
        // Analiza 50/30/20
        methodology503020: {
            needs: {
                actual: analysis503020.needs.actual,
                limit: analysis503020.needs.limit,
                percent: analysis503020.needs.percent,
                status: analysis503020.needs.status
            },
            wants: {
                actual: analysis503020.wants.actual,
                limit: analysis503020.wants.limit,
                percent: analysis503020.wants.percent,
                status: analysis503020.wants.status
            },
            savings: {
                actual: analysis503020.savings.actual,
                limit: analysis503020.savings.limit,
                percent: analysis503020.savings.percent,
                status: analysis503020.savings.status
            }
        },
        
        // Kategorie - średnie historyczne
        categoryAverages: Object.entries(categoryAverages)
            .sort((a, b) => b[1].average - a[1].average)
            .slice(0, 10)
            .map(([cat, data]) => ({
                kategoria: cat,
                average: data.average,
                total: data.total
            })),
        
        // Historia wynagrodzeń
        salaryHistory: salaryHistories.length > 0 ? salaryHistories.map(sh => ({
            pracodawca: sh.pracodawca,
            currentSalary: sh.currentSalary,
            totalGrowth: sh.totalGrowth,
            employmentMonths: sh.employmentMonths,
            lastRaise: sh.raises.length > 0 ? sh.raises[sh.raises.length - 1] : null
        })) : null,
        
        // Plan inwestycji
        investmentPlan: investmentPlan > 0 ? {
            monthlyTarget: investmentPlan,
            canAfford: currentMonthData.balance >= investmentPlan,
            surplus: currentMonthData.balance - investmentPlan
        } : null,
        
        // Wydatki stałe
        recurringExpenses: {
            monthlyTotal: recurringMonthly,
            percentOfIncome: currentMonthData.income.total > 0 
                ? (recurringMonthly / currentMonthData.income.total * 100) 
                : 0
        }
    };
}

// ═══════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════

function getBudgetSystemPrompt() {
    return `Jesteś ekspertem od budżetów osobistych i planowania finansowego. Pomagasz użytkownikowi zarządzać wydatkami i optymalizować oszczędności.

KONTEKST:
- Użytkownik wprowadza dane RETROSPEKTYWNIE (koniec miesiąca), nie na bieżąco
- Skupiaj się na AGREGATACH i TRENDACH, nie pojedynczych transakcjach
- Wszystkie kwoty są w PLN

ZASADY ODPOWIEDZI:
1. Używaj DOKŁADNYCH liczb z dostarczonych danych - nigdy nie zgaduj
2. Zawsze porównuj z: poprzednim miesiącem, średnią historyczną, tym samym miesiącem rok temu
3. Identyfikuj ANOMALIE (odchylenia >15% od średniej)
4. Dawaj KONKRETNE, LICZBOWE rekomendacje
5. Bądź zwięzły - max 3-4 akapity

KLUCZOWE ROZRÓŻNIENIA:
- WYDATKI STAŁE: czynsz, abonamenty - trudne do ograniczenia
- WYDATKI ZMIENNE: jedzenie, rozrywka - potencjał optymalizacji
- TRANSFERY: przesunięcia środków (np. na firmę) - to NIE są wydatki konsumpcyjne

METODYKI:
- 50/30/20: potrzeby (50%) / zachcianki (30%) / oszczędności (20%)
- Stopa oszczędności = (Dochody - Wydatki) / Dochody
- Bufor awaryjny = 6 miesięcy wydatków

FORMAT:
- Kwoty: formatuj z "zł" (np. "1 234 zł")
- Procenty: jedno miejsce po przecinku
- Używaj emoji dla czytelności (📈📉💰⚠️✅)
- Pisz po polsku

Odpowiadaj na podstawie dostarczonych danych. Jeśli czegoś nie ma w danych, powiedz wprost.`;
}

// ═══════════════════════════════════════════════════════════
// KOMUNIKACJA Z API
// ═══════════════════════════════════════════════════════════

async function sendBudgetMessage(customMessage = null) {
    const input = document.getElementById('budgetChatInput');
    const message = customMessage || input.value.trim();
    
    if (!message) return;
    if (!input) return;
    
    input.value = '';
    
    // Sprawdź klucz API
    if (!budgetAiApiKey) {
        addBudgetChatMessage('assistant', '⚠️ Brak klucza API. Kliknij ⚙️ aby skonfigurować.');
        return;
    }
    
    // Dodaj wiadomość użytkownika
    addBudgetChatMessage('user', message);
    
    // Przygotuj dane
    const budgetData = prepareBudgetDataForAI();
    if (budgetData.error) {
        addBudgetChatMessage('assistant', `⚠️ ${budgetData.error}`);
        return;
    }
    
    // Pokaż loading
    const loadingId = addBudgetChatMessage('assistant', '⏳ Analizuję...');
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${budgetAiApiKey}`
            },
            body: JSON.stringify({
                model: BUDGET_AI_MODEL,
                messages: [
                    { role: 'system', content: getBudgetSystemPrompt() },
                    { role: 'system', content: `DANE BUDŻETOWE UŻYTKOWNIKA:\n${JSON.stringify(budgetData, null, 2)}` },
                    ...budgetChatHistory,
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const assistantMessage = data.choices[0].message.content;
        
        // Zapisz do historii
        budgetChatHistory.push({ role: 'user', content: message });
        budgetChatHistory.push({ role: 'assistant', content: assistantMessage });
        
        // Ogranicz historię do ostatnich 10 wiadomości
        if (budgetChatHistory.length > 20) {
            budgetChatHistory = budgetChatHistory.slice(-20);
        }
        
        // Usuń loading i dodaj odpowiedź
        removeBudgetChatMessage(loadingId);
        addBudgetChatMessage('assistant', assistantMessage);
        
    } catch (error) {
        console.error('Błąd API:', error);
        removeBudgetChatMessage(loadingId);
        addBudgetChatMessage('assistant', `❌ Błąd: ${error.message}`);
    }
}

function runBudgetQuickPrompt(promptId) {
    const prompt = BUDGET_QUICK_PROMPTS.find(p => p.id === promptId);
    if (prompt) {
        sendBudgetMessage(prompt.prompt);
    }
}

// ═══════════════════════════════════════════════════════════
// UI CHAT
// ═══════════════════════════════════════════════════════════

let budgetMessageCounter = 0;

function addBudgetChatMessage(role, content) {
    const container = document.getElementById('budgetChatMessages');
    if (!container) return null;
    
    // Usuń welcome message
    const welcome = container.querySelector('.chat-welcome');
    if (welcome) welcome.remove();
    
    const id = `budget-msg-${++budgetMessageCounter}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = `chat-message ${role}`;
    
    // Formatuj markdown
    const formattedContent = formatBudgetMarkdown(content);
    
    div.innerHTML = `
        <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-content">${formattedContent}</div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    
    return id;
}

function removeBudgetChatMessage(id) {
    const msg = document.getElementById(id);
    if (msg) msg.remove();
}

function formatBudgetMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
}

// ═══════════════════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════

async function checkBudgetApiKey() {
    try {
        // Najpierw sprawdź localStorage
        const localKey = localStorage.getItem('openai_api_key');
        if (localKey) {
            budgetAiApiKey = localKey;
            return;
        }
        
        // Potem sprawdź ustawienia w arkuszu
        const settings = await BudgetSheets.getSettings();
        if (settings.openai_api_key) {
            budgetAiApiKey = settings.openai_api_key;
            localStorage.setItem('openai_api_key', budgetAiApiKey);
        }
    } catch (error) {
        console.warn('Nie można pobrać klucza API:', error);
    }
}

function showBudgetApiKeyModal() {
    // Użyj istniejącego modalu z analytics lub stwórz prosty prompt
    const currentKey = budgetAiApiKey ? '********' + budgetAiApiKey.slice(-4) : '';
    const newKey = prompt(`Podaj klucz API OpenAI:\n\nAktualny: ${currentKey || '(brak)'}\n\nMożesz go uzyskać na platform.openai.com`);
    
    if (newKey && newKey.startsWith('sk-')) {
        budgetAiApiKey = newKey;
        localStorage.setItem('openai_api_key', newKey);
        showToast('Zapisano klucz API', 'success');
    } else if (newKey) {
        showToast('Nieprawidłowy format klucza API', 'error');
    }
}

// ═══════════════════════════════════════════════════════════
// DODATKOWE STYLE DLA CHAT
// ═══════════════════════════════════════════════════════════

// Dodaj style jeśli nie istnieją
if (!document.getElementById('budgetAiStyles')) {
    const styles = document.createElement('style');
    styles.id = 'budgetAiStyles';
    styles.textContent = `
        .ai-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .quick-prompts {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
        }
        
        .quick-prompt-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 16px;
            background: var(--bg-hover);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .quick-prompt-btn:hover {
            background: var(--bg-card);
            border-color: var(--primary);
        }
        
        .quick-prompt-icon {
            font-size: 1.5rem;
        }
        
        .quick-prompt-label {
            font-size: 0.875rem;
            text-align: center;
            color: var(--text-primary);
        }
        
        .chat-card {
            display: flex;
            flex-direction: column;
            min-height: 400px;
        }
        
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        .chat-welcome {
            text-align: center;
            color: var(--text-secondary);
            padding: 40px 20px;
        }
        
        .chat-welcome p {
            margin: 8px 0;
        }
        
        .chat-message {
            display: flex;
            gap: 12px;
            max-width: 85%;
        }
        
        .chat-message.user {
            align-self: flex-end;
            flex-direction: row-reverse;
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
        }
        
        .message-content {
            padding: 12px 16px;
            border-radius: var(--radius-md);
            background: var(--bg-hover);
            line-height: 1.5;
        }
        
        .chat-message.user .message-content {
            background: var(--primary);
            color: white;
        }
        
        .chat-message.assistant .message-content {
            background: var(--bg-card);
            border: 1px solid var(--border);
        }
        
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
            font-size: 0.875rem;
        }
        
        .chat-input:focus {
            outline: none;
            border-color: var(--primary);
        }
    `;
    document.head.appendChild(styles);
}
