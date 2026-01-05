/**
 * Assetly - Budget AI Assistant
 * Profesjonalny moduł AI z pełnym dostępem do danych budżetowych
 */

// ═══════════════════════════════════════════════════════════
// KONFIGURACJA
// ═══════════════════════════════════════════════════════════

const BUDGET_AI_CONFIG = {
    model: 'gpt-4o',
    maxTokens: 2000,
    temperature: 0.3 // Niższa temperatura = bardziej precyzyjne odpowiedzi
};

const BUDGET_QUICK_PROMPTS = [
    {
        id: 'summary',
        label: 'Podsumowanie',
        icon: '📊',
        prompt: 'Podaj kompletne podsumowanie moich finansów: łączne dochody, wydatki, bilans, stopa oszczędności. Uwzględnij podział na kategorie.'
    },
    {
        id: 'top-expenses',
        label: 'Top wydatki',
        icon: '💸',
        prompt: 'Podaj TOP 10 kategorii/podkategorii na które wydaję najwięcej. Dla każdej podaj sumę, średnią miesięczną i % całości wydatków.'
    },
    {
        id: 'savings-potential',
        label: 'Potencjał oszczędności',
        icon: '💰',
        prompt: 'Zidentyfikuj kategorie gdzie wydaję ponadprzeciętnie dużo. Oblicz ile mógłbym zaoszczędzić gdybym zredukował je do średniej. Podaj konkretne kwoty.'
    },
    {
        id: 'trends',
        label: 'Trendy',
        icon: '📈',
        prompt: 'Przeanalizuj trendy moich finansów miesiąc po miesiącu. Czy wydatki rosną czy maleją? Które kategorie rosną najszybciej?'
    },
    {
        id: 'income-analysis',
        label: 'Analiza dochodów',
        icon: '💵',
        prompt: 'Przeanalizuj moje dochody: źródła, zmiany w czasie, podwyżki. Podaj średni dochód i jego trend.'
    },
    {
        id: '503020',
        label: '50/30/20',
        icon: '🎯',
        prompt: 'Przeanalizuj moje wydatki według metodyki 50/30/20 (potrzeby/zachcianki/oszczędności). Czy trzymam się zdrowych proporcji? Co powinienem zmienić?'
    },
    {
        id: 'monthly-compare',
        label: 'Porównanie miesięcy',
        icon: '📅',
        prompt: 'Porównaj moje finanse z ostatnich 3 miesięcy. Pokaż różnice w dochodach, wydatkach i bilansie. Który miesiąc był najlepszy/najgorszy?'
    },
    {
        id: 'category-deep',
        label: 'Analiza kategorii',
        icon: '🔍',
        prompt: 'Podaj szczegółową analizę KAŻDEJ kategorii wydatków: suma, średnia, min, max, trend. Posortuj od największej do najmniejszej.'
    }
];

// ═══════════════════════════════════════════════════════════
// STAN
// ═══════════════════════════════════════════════════════════

let budgetChatHistory = [];
let budgetAiApiKey = null;
let lastPreparedData = null;

// ═══════════════════════════════════════════════════════════
// PRZYGOTOWANIE DANYCH - KOMPLETNE I SZCZEGÓŁOWE
// ═══════════════════════════════════════════════════════════

function prepareBudgetDataForAI() {
    // Sprawdź czy mamy dane
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
        categories: BudgetCategories.getAllCategories(),
        incomeSources: Object.keys(BudgetCategories.INCOME_SOURCES)
    };
}

function prepareExpensesData() {
    // Agregacja po kategorii
    const byCategory = {};
    allExpenses.forEach(e => {
        if (!byCategory[e.kategoria]) {
            byCategory[e.kategoria] = {
                total: 0,
                count: 0,
                items: [],
                subcategories: {}
            };
        }
        byCategory[e.kategoria].total += e.kwotaPLN;
        byCategory[e.kategoria].count++;
        
        // Agregacja po podkategorii
        const subcat = e.podkategoria || '(brak)';
        if (!byCategory[e.kategoria].subcategories[subcat]) {
            byCategory[e.kategoria].subcategories[subcat] = {
                total: 0,
                count: 0,
                periods: {}
            };
        }
        byCategory[e.kategoria].subcategories[subcat].total += e.kwotaPLN;
        byCategory[e.kategoria].subcategories[subcat].count++;
        
        // Agregacja po okresie dla podkategorii
        const period = `${e.rok}-${String(e.miesiac).padStart(2, '0')}`;
        if (!byCategory[e.kategoria].subcategories[subcat].periods[period]) {
            byCategory[e.kategoria].subcategories[subcat].periods[period] = 0;
        }
        byCategory[e.kategoria].subcategories[subcat].periods[period] += e.kwotaPLN;
    });

    // Oblicz średnie i statystyki
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

    // TOP podkategorie
    const allSubcategories = [];
    Object.entries(byCategory).forEach(([cat, catData]) => {
        Object.entries(catData.subcategories).forEach(([sub, subData]) => {
            allSubcategories.push({
                category: cat,
                subcategory: sub,
                total: subData.total,
                count: subData.count,
                monthlyAverage: subData.monthlyAverage,
                percentOfTotal: subData.percentOfTotal
            });
        });
    });
    allSubcategories.sort((a, b) => b.total - a.total);

    // Podział stałe vs zmienne
    const fixed = allExpenses.filter(e => e.jestStaly);
    const variable = allExpenses.filter(e => !e.jestStaly && !e.jestTransfer);
    const transfers = allExpenses.filter(e => e.jestTransfer);

    return {
        byCategory,
        topSubcategories: allSubcategories.slice(0, 20),
        breakdown: {
            fixed: {
                total: fixed.reduce((s, e) => s + e.kwotaPLN, 0),
                count: fixed.length,
                monthlyAverage: fixed.reduce((s, e) => s + e.kwotaPLN, 0) / monthCount
            },
            variable: {
                total: variable.reduce((s, e) => s + e.kwotaPLN, 0),
                count: variable.length,
                monthlyAverage: variable.reduce((s, e) => s + e.kwotaPLN, 0) / monthCount
            },
            transfers: {
                total: transfers.reduce((s, e) => s + e.kwotaPLN, 0),
                count: transfers.length,
                note: 'Transfery nie są liczone jako wydatki konsumpcyjne'
            }
        },
        // Pełna lista dla szczegółowych zapytań
        rawData: allExpenses.map(e => ({
            period: `${e.rok}-${String(e.miesiac).padStart(2, '0')}`,
            category: e.kategoria,
            subcategory: e.podkategoria || null,
            amount: e.kwotaPLN,
            currency: e.waluta,
            isFixed: e.jestStaly,
            isTransfer: e.jestTransfer
        }))
    };
}

function prepareIncomeData() {
    // Agregacja po źródle
    const bySource = {};
    allIncome.forEach(i => {
        if (!bySource[i.zrodlo]) {
            bySource[i.zrodlo] = {
                total: 0,
                count: 0,
                employers: {},
                periods: {}
            };
        }
        bySource[i.zrodlo].total += i.kwotaPLN;
        bySource[i.zrodlo].count++;
        
        // Po pracodawcy
        const emp = i.pracodawca || '(nieokreślony)';
        if (!bySource[i.zrodlo].employers[emp]) {
            bySource[i.zrodlo].employers[emp] = { total: 0, count: 0 };
        }
        bySource[i.zrodlo].employers[emp].total += i.kwotaPLN;
        bySource[i.zrodlo].employers[emp].count++;
        
        // Po okresie
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

    // Historia wynagrodzeń
    const salaryHistory = [];
    const employers = [...new Set(allIncome.filter(i => i.pracodawca && i.zrodlo === 'Wynagrodzenie').map(i => i.pracodawca))];
    
    employers.forEach(emp => {
        const empIncome = allIncome
            .filter(i => i.pracodawca === emp && i.zrodlo === 'Wynagrodzenie')
            .sort((a, b) => {
                if (a.rok !== b.rok) return a.rok - b.rok;
                return a.miesiac - b.miesiac;
            });
        
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
            
            const raises = history.filter(h => h.change > 0);
            
            salaryHistory.push({
                employer: emp,
                history,
                summary: {
                    firstSalary: empIncome[0].kwotaPLN,
                    currentSalary: empIncome[empIncome.length - 1].kwotaPLN,
                    totalGrowth: empIncome[0].kwotaPLN > 0 
                        ? ((empIncome[empIncome.length - 1].kwotaPLN - empIncome[0].kwotaPLN) / empIncome[0].kwotaPLN * 100) 
                        : 0,
                    monthsEmployed: empIncome.length,
                    raisesCount: raises.length,
                    totalRaisesAmount: raises.reduce((s, r) => s + r.change, 0)
                }
            });
        }
    });

    return {
        bySource,
        salaryHistory,
        rawData: allIncome.map(i => ({
            period: `${i.rok}-${String(i.miesiac).padStart(2, '0')}`,
            source: i.zrodlo,
            employer: i.pracodawca || null,
            amount: i.kwotaPLN,
            currency: i.waluta
        }))
    };
}

function prepareMonthlyBreakdown() {
    const months = {};
    
    // Zbierz wszystkie okresy
    allExpenses.forEach(e => {
        const period = `${e.rok}-${String(e.miesiac).padStart(2, '0')}`;
        if (!months[period]) {
            months[period] = { 
                period, 
                rok: e.rok, 
                miesiac: e.miesiac,
                income: 0, 
                expenses: 0, 
                fixed: 0, 
                variable: 0, 
                transfers: 0,
                balance: 0,
                savingsRate: 0,
                expensesByCategory: {},
                incomeBySource: {}
            };
        }
        months[period].expenses += e.kwotaPLN;
        if (e.jestStaly) months[period].fixed += e.kwotaPLN;
        else if (e.jestTransfer) months[period].transfers += e.kwotaPLN;
        else months[period].variable += e.kwotaPLN;
        
        if (!months[period].expensesByCategory[e.kategoria]) {
            months[period].expensesByCategory[e.kategoria] = 0;
        }
        months[period].expensesByCategory[e.kategoria] += e.kwotaPLN;
    });
    
    allIncome.forEach(i => {
        const period = `${i.rok}-${String(i.miesiac).padStart(2, '0')}`;
        if (!months[period]) {
            months[period] = { 
                period, 
                rok: i.rok, 
                miesiac: i.miesiac,
                income: 0, 
                expenses: 0, 
                fixed: 0, 
                variable: 0, 
                transfers: 0,
                balance: 0,
                savingsRate: 0,
                expensesByCategory: {},
                incomeBySource: {}
            };
        }
        months[period].income += i.kwotaPLN;
        
        if (!months[period].incomeBySource[i.zrodlo]) {
            months[period].incomeBySource[i.zrodlo] = 0;
        }
        months[period].incomeBySource[i.zrodlo] += i.kwotaPLN;
    });
    
    // Oblicz bilans i stopę oszczędności
    Object.values(months).forEach(m => {
        m.balance = m.income - m.expenses + m.transfers; // Transfery nie są wydatkami
        m.savingsRate = m.income > 0 ? (m.balance / m.income * 100) : 0;
    });
    
    // Posortuj chronologicznie
    const sortedMonths = Object.values(months).sort((a, b) => a.period.localeCompare(b.period));
    
    return sortedMonths;
}

function prepareAnalytics() {
    const monthly = prepareMonthlyBreakdown();
    if (monthly.length === 0) return {};
    
    // Średnie
    const avgIncome = monthly.reduce((s, m) => s + m.income, 0) / monthly.length;
    const avgExpenses = monthly.reduce((s, m) => s + m.expenses, 0) / monthly.length;
    const avgBalance = monthly.reduce((s, m) => s + m.balance, 0) / monthly.length;
    const avgSavingsRate = monthly.reduce((s, m) => s + m.savingsRate, 0) / monthly.length;
    
    // Min/Max
    const maxIncomeMonth = monthly.reduce((max, m) => m.income > max.income ? m : max, monthly[0]);
    const minIncomeMonth = monthly.reduce((min, m) => m.income < min.income ? m : min, monthly[0]);
    const maxExpensesMonth = monthly.reduce((max, m) => m.expenses > max.expenses ? m : max, monthly[0]);
    const minExpensesMonth = monthly.reduce((min, m) => m.expenses < min.expenses ? m : min, monthly[0]);
    
    // Trend (porównanie pierwszej i drugiej połowy danych)
    const mid = Math.floor(monthly.length / 2);
    const firstHalf = monthly.slice(0, mid);
    const secondHalf = monthly.slice(mid);
    
    const firstHalfAvgExpenses = firstHalf.length > 0 ? firstHalf.reduce((s, m) => s + m.expenses, 0) / firstHalf.length : 0;
    const secondHalfAvgExpenses = secondHalf.length > 0 ? secondHalf.reduce((s, m) => s + m.expenses, 0) / secondHalf.length : 0;
    const expensesTrend = firstHalfAvgExpenses > 0 ? ((secondHalfAvgExpenses - firstHalfAvgExpenses) / firstHalfAvgExpenses * 100) : 0;
    
    const firstHalfAvgIncome = firstHalf.length > 0 ? firstHalf.reduce((s, m) => s + m.income, 0) / firstHalf.length : 0;
    const secondHalfAvgIncome = secondHalf.length > 0 ? secondHalf.reduce((s, m) => s + m.income, 0) / secondHalf.length : 0;
    const incomeTrend = firstHalfAvgIncome > 0 ? ((secondHalfAvgIncome - firstHalfAvgIncome) / firstHalfAvgIncome * 100) : 0;
    
    // Analiza 50/30/20
    const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
    const needs = allExpenses
        .filter(e => BudgetCategories.getMethodology(e.kategoria) === 'needs' && !e.jestTransfer)
        .reduce((s, e) => s + e.kwotaPLN, 0);
    const wants = allExpenses
        .filter(e => BudgetCategories.getMethodology(e.kategoria) === 'wants' && !e.jestTransfer)
        .reduce((s, e) => s + e.kwotaPLN, 0);
    const savings = totalIncome - needs - wants;
    
    return {
        averages: {
            income: avgIncome,
            expenses: avgExpenses,
            balance: avgBalance,
            savingsRate: avgSavingsRate
        },
        extremes: {
            maxIncome: { period: maxIncomeMonth.period, amount: maxIncomeMonth.income },
            minIncome: { period: minIncomeMonth.period, amount: minIncomeMonth.income },
            maxExpenses: { period: maxExpensesMonth.period, amount: maxExpensesMonth.expenses },
            minExpenses: { period: minExpensesMonth.period, amount: minExpensesMonth.expenses }
        },
        trends: {
            expenses: {
                direction: expensesTrend > 5 ? 'rosnący' : expensesTrend < -5 ? 'malejący' : 'stabilny',
                percentChange: expensesTrend
            },
            income: {
                direction: incomeTrend > 5 ? 'rosnący' : incomeTrend < -5 ? 'malejący' : 'stabilny',
                percentChange: incomeTrend
            }
        },
        methodology503020: {
            needs: { amount: needs, percent: totalIncome > 0 ? (needs / totalIncome * 100) : 0, target: 50 },
            wants: { amount: wants, percent: totalIncome > 0 ? (wants / totalIncome * 100) : 0, target: 30 },
            savings: { amount: savings, percent: totalIncome > 0 ? (savings / totalIncome * 100) : 0, target: 20 }
        }
    };
}

// ═══════════════════════════════════════════════════════════
// SYSTEM PROMPT - PROFESJONALNY I SZCZEGÓŁOWY
// ═══════════════════════════════════════════════════════════

function getBudgetSystemPrompt() {
    return `Jesteś EKSPERTEM od finansów osobistych i analityki budżetowej. Twoja rola to precyzyjna analiza danych finansowych użytkownika.

## TWOJE MOŻLIWOŚCI
Masz dostęp do KOMPLETNYCH danych finansowych użytkownika:
- Wszystkie wydatki z podziałem na kategorie i podkategorie
- Wszystkie dochody z podziałem na źródła i pracodawców
- Dane miesięczne (bilanse, trendy, porównania)
- Obliczone statystyki i agregaty

## ZASADY ODPOWIEDZI

### 1. DOKŁADNOŚĆ
- Używaj WYŁĄCZNIE danych dostarczonych w kontekście
- Podawaj DOKŁADNE kwoty z danych (nie zaokrąglaj bez potrzeby)
- Jeśli pytanie dotyczy danych których nie ma - powiedz wprost

### 2. OBLICZENIA
Gdy użytkownik pyta o sumę/średnią/porównanie:
- Wykonaj obliczenia na podstawie rawData lub agregatów
- Pokaż jak doszedłeś do wyniku
- Dla sum po podkategorii - przeszukaj expenses.byCategory[kategoria].subcategories[podkategoria]

### 3. FORMAT ODPOWIEDZI
- Kwoty: formatuj jako "X XXX zł" (ze spacją tysięcy)
- Procenty: 1 miejsce po przecinku
- Używaj tabel markdown dla porównań
- Używaj emoji dla czytelności: 📈📉💰⚠️✅❌

### 4. STRUKTURA DANYCH

**Wydatki:**
- expenses.byCategory - agregaty po kategoriach
- expenses.byCategory[X].subcategories[Y] - agregaty po podkategoriach
- expenses.topSubcategories - TOP 20 podkategorii
- expenses.rawData - lista wszystkich wydatków

**Dochody:**
- income.bySource - agregaty po źródłach
- income.salaryHistory - historia wynagrodzeń z podwyżkami
- income.rawData - lista wszystkich dochodów

**Miesięcznie:**
- monthly[] - tablica z danymi każdego miesiąca

**Analityka:**
- analytics.averages - średnie miesięczne
- analytics.extremes - min/max
- analytics.trends - kierunki zmian
- analytics.methodology503020 - analiza 50/30/20

### 5. PRZYKŁADY ODPOWIEDZI

Pytanie: "Ile wydałem na paliwo?"
Odpowiedź: Sprawdzam expenses.byCategory["Auto i transport"].subcategories["Paliwo"]:
- Suma: 4 532 zł
- Liczba transakcji: 24
- Średnio miesięcznie: 378 zł

Pytanie: "Porównaj wydatki grudzień vs listopad"
Odpowiedź: [Tabela z danymi z monthly[] dla obu okresów]

### 6. KLUCZOWE ROZRÓŻNIENIA
- TRANSFERY (jestTransfer=true) to NIE są wydatki konsumpcyjne - to przesunięcia środków
- WYDATKI STAŁE (jestStaly=true) - powtarzalne, trudne do ograniczenia
- WYDATKI ZMIENNE - potencjał optymalizacji

### 7. STYL
- Bądź konkretny i rzeczowy
- Nie zgaduj - jeśli czegoś nie wiesz, powiedz
- Odpowiadaj po polsku
- Dawaj actionable insights, nie tylko suche liczby`;
}

// ═══════════════════════════════════════════════════════════
// KOMUNIKACJA Z API
// ═══════════════════════════════════════════════════════════

async function sendBudgetMessage(customMessage = null) {
    const input = document.getElementById('budgetChatInput');
    const message = customMessage || (input ? input.value.trim() : '');
    
    if (!message) return;
    if (input) input.value = '';
    
    // Sprawdź klucz API
    if (!budgetAiApiKey) {
        addBudgetChatMessage('assistant', '⚠️ Brak klucza API OpenAI. Kliknij ⚙️ aby skonfigurować.');
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
    const loadingId = addBudgetChatMessage('assistant', '⏳ Analizuję dane...');
    
    try {
        // Przygotuj kontekst danych (może być duży)
        const dataContext = JSON.stringify(budgetData, null, 2);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${budgetAiApiKey}`
            },
            body: JSON.stringify({
                model: BUDGET_AI_CONFIG.model,
                messages: [
                    { role: 'system', content: getBudgetSystemPrompt() },
                    { role: 'system', content: `## DANE FINANSOWE UŻYTKOWNIKA\n\`\`\`json\n${dataContext}\n\`\`\`` },
                    ...budgetChatHistory.slice(-10), // Ostatnie 10 wiadomości
                    { role: 'user', content: message }
                ],
                temperature: BUDGET_AI_CONFIG.temperature,
                max_tokens: BUDGET_AI_CONFIG.maxTokens
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const assistantMessage = data.choices[0].message.content;
        
        // Zapisz do historii
        budgetChatHistory.push({ role: 'user', content: message });
        budgetChatHistory.push({ role: 'assistant', content: assistantMessage });
        
        // Usuń loading i dodaj odpowiedź
        removeBudgetChatMessage(loadingId);
        addBudgetChatMessage('assistant', assistantMessage);
        
    } catch (error) {
        console.error('Błąd API:', error);
        removeBudgetChatMessage(loadingId);
        addBudgetChatMessage('assistant', `❌ Błąd: ${error.message}\n\nSprawdź czy klucz API jest poprawny i czy masz środki na koncie OpenAI.`);
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

function renderBudgetAITab() {
    const container = document.getElementById('budget-ai');
    if (!container) return;
    
    // Policz dane
    const expCount = allExpenses?.length || 0;
    const incCount = allIncome?.length || 0;
    
    container.innerHTML = `
        <div class="ai-container">
            <!-- Info o danych -->
            <div class="ai-data-info">
                <span class="data-badge">📊 ${expCount} wydatków</span>
                <span class="data-badge">💵 ${incCount} dochodów</span>
                <span class="data-badge">📅 ${getMonthCount()} miesięcy</span>
            </div>
            
            <!-- Szybkie analizy -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">🤖 Asystent budżetowy AI</h3>
                    <button class="btn btn-ghost btn-sm" onclick="showBudgetApiKeyModal()" title="Ustawienia API">
                        ⚙️
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
                        <p>Mam dostęp do <strong>wszystkich</strong> Twoich danych finansowych i mogę odpowiedzieć na szczegółowe pytania:</p>
                        <ul>
                            <li>💸 "Ile wydałem na paliwo od początku roku?"</li>
                            <li>📊 "Pokaż wydatki na rozrywkę w każdym miesiącu"</li>
                            <li>📈 "Jak zmieniało się moje wynagrodzenie?"</li>
                            <li>🔍 "Które podkategorie kosztują mnie najwięcej?"</li>
                            <li>⚖️ "Porównaj wydatki grudzień vs listopad"</li>
                        </ul>
                        <p>Wybierz szybką analizę powyżej lub zadaj własne pytanie.</p>
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
    
    // Sprawdź klucz API
    checkBudgetApiKey();
}

function getMonthCount() {
    const periods = new Set();
    allExpenses?.forEach(e => periods.add(`${e.rok}-${e.miesiac}`));
    allIncome?.forEach(i => periods.add(`${i.rok}-${i.miesiac}`));
    return periods.size;
}

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
    const formattedContent = formatMarkdownToHtml(content);
    
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

function formatMarkdownToHtml(text) {
    return text
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Headers
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        // Lists
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        // Tables (basic)
        .replace(/\|(.+)\|/g, (match) => {
            const cells = match.split('|').filter(c => c.trim());
            if (cells.every(c => c.trim().match(/^[-:]+$/))) {
                return ''; // Skip separator row
            }
            const tag = 'td';
            return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
        })
        // Newlines
        .replace(/\n/g, '<br>');
}

// ═══════════════════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════

async function checkBudgetApiKey() {
    try {
        const localKey = localStorage.getItem('openai_api_key');
        if (localKey) {
            budgetAiApiKey = localKey;
            return;
        }
        
        // Sprawdź ustawienia w arkuszu
        if (typeof BudgetSheets !== 'undefined' && BudgetSheets.getSettings) {
            const settings = await BudgetSheets.getSettings();
            if (settings.openai_api_key) {
                budgetAiApiKey = settings.openai_api_key;
                localStorage.setItem('openai_api_key', budgetAiApiKey);
            }
        }
    } catch (error) {
        console.warn('Nie można pobrać klucza API:', error);
    }
}

function showBudgetApiKeyModal() {
    const currentKey = budgetAiApiKey ? '••••••••' + budgetAiApiKey.slice(-4) : '';
    const newKey = prompt(
        `Klucz API OpenAI\n\n` +
        `Aktualny: ${currentKey || '(brak)'}\n\n` +
        `Wklej nowy klucz (zaczyna się od "sk-"):\n` +
        `Możesz go uzyskać na: platform.openai.com/api-keys`
    );
    
    if (newKey === null) return; // Anulowano
    
    if (newKey === '') {
        // Usuń klucz
        budgetAiApiKey = null;
        localStorage.removeItem('openai_api_key');
        showToast('Usunięto klucz API', 'info');
        return;
    }
    
    if (newKey.startsWith('sk-')) {
        budgetAiApiKey = newKey;
        localStorage.setItem('openai_api_key', newKey);
        showToast('Zapisano klucz API', 'success');
    } else {
        showToast('Nieprawidłowy format klucza (powinien zaczynać się od "sk-")', 'error');
    }
}

// ═══════════════════════════════════════════════════════════
// STYLE
// ═══════════════════════════════════════════════════════════

if (!document.getElementById('budgetAiStyles')) {
    const styles = document.createElement('style');
    styles.id = 'budgetAiStyles';
    styles.textContent = `
        .ai-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .ai-data-info {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }
        
        .data-badge {
            background: var(--bg-hover);
            padding: 6px 12px;
            border-radius: var(--radius-md);
            font-size: 0.875rem;
            color: var(--text-secondary);
        }
        
        .quick-prompts {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
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
            text-align: center;
        }
        
        .quick-prompt-btn:hover {
            background: var(--bg-card);
            border-color: var(--primary);
            transform: translateY(-2px);
        }
        
        .quick-prompt-icon {
            font-size: 1.5rem;
        }
        
        .quick-prompt-label {
            font-size: 0.8rem;
            color: var(--text-primary);
            line-height: 1.2;
        }
        
        .chat-card {
            display: flex;
            flex-direction: column;
            min-height: 500px;
        }
        
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            max-height: 600px;
        }
        
        .chat-welcome {
            color: var(--text-secondary);
            padding: 20px;
            background: var(--bg-hover);
            border-radius: var(--radius-md);
        }
        
        .chat-welcome h4 {
            margin: 0 0 12px 0;
            color: var(--text-primary);
        }
        
        .chat-welcome ul {
            margin: 12px 0;
            padding-left: 20px;
        }
        
        .chat-welcome li {
            margin: 6px 0;
        }
        
        .chat-message {
            display: flex;
            gap: 12px;
            max-width: 90%;
        }
        
        .chat-message.user {
            align-self: flex-end;
            flex-direction: row-reverse;
        }
        
        .message-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--bg-hover);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 1.1rem;
        }
        
        .message-content {
            padding: 12px 16px;
            border-radius: var(--radius-md);
            background: var(--bg-hover);
            line-height: 1.6;
            font-size: 0.9rem;
        }
        
        .message-content h3, .message-content h4 {
            margin: 16px 0 8px 0;
        }
        
        .message-content h3:first-child, .message-content h4:first-child {
            margin-top: 0;
        }
        
        .message-content code {
            background: var(--bg-card);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.85em;
        }
        
        .message-content pre {
            background: var(--bg-card);
            padding: 12px;
            border-radius: var(--radius-md);
            overflow-x: auto;
            margin: 8px 0;
        }
        
        .message-content pre code {
            background: none;
            padding: 0;
        }
        
        .message-content li {
            margin: 4px 0;
        }
        
        .message-content table {
            border-collapse: collapse;
            margin: 8px 0;
            font-size: 0.85em;
        }
        
        .message-content th, .message-content td {
            border: 1px solid var(--border);
            padding: 6px 10px;
            text-align: left;
        }
        
        .message-content th {
            background: var(--bg-card);
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
            font-size: 0.9rem;
        }
        
        .chat-input:focus {
            outline: none;
            border-color: var(--primary);
        }
        
        @media (max-width: 768px) {
            .quick-prompts {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .chat-message {
                max-width: 95%;
            }
        }
    `;
    document.head.appendChild(styles);
}
