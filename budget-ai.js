/**
 * Assetly - Budget AI Assistant
 * Profesjonalny moduł AI z pełnym dostępem do danych budżetowych
 */

// ═══════════════════════════════════════════════════════════
// KONFIGURACJA
// ═══════════════════════════════════════════════════════════

const BUDGET_AI_CONFIG = {
    // Primary provider (OpenAI)
    openaiModel: 'gpt-4o-mini',

    // Backup provider (LLM7.io) - OpenAI-compatible models: "default" / "fast" / "pro"
    llm7Model: 'default',

    // Generation params
    maxTokens: 2000,
    temperature: 0.3 // Niższa temperatura = bardziej precyzyjne odpowiedzi
};

// Provider routing configuration (OpenAI primary + LLM7 backup)
const BUDGET_AI_PROVIDERS = {
    openai: { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
    llm7: { id: 'llm7', label: 'LLM7.io', baseUrl: 'https://api.llm7.io/v1' }
};

const BUDGET_AI_ROUTER = {
    // Heurystyka tokenów: ok. 4 znaki ≈ 1 token (w praktyce zależy od języka/tekstu)
    approxCharsPerToken: 4,

    // Jeśli CAŁY kontekst (system + dane + historia + user) przekroczy próg → kieruj do back-up
    largeInputCharsThreshold: 50000,
    largeInputTokensThreshold: 12000,

    // Timeout requestu do LLM
    requestTimeoutMs: 90000,

    // Ile wiadomości historii utrzymywać w kontekście LLM
    maxHistoryMessages: 10,

    // Jeśli same dane budżetowe przekroczą ten limit, zostaną inteligentnie odchudzone
    maxDataContextChars: 160000
};

const BUDGET_AI_STORAGE_KEYS = {
    openaiKey: 'openai_api_key',
    llm7Key: 'llm7_api_key',
    providerMode: 'budget_ai_provider_mode', // 'auto' | 'openai' | 'llm7'
    openaiModel: 'budget_ai_openai_model',
    llm7Model: 'budget_ai_llm7_model',
    routingChars: 'budget_ai_routing_chars_threshold',
    routingTokens: 'budget_ai_routing_tokens_threshold'
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
let budgetAiKeys = { openai: null, llm7: null };
let budgetAiProviderMode = 'auto'; // 'auto' | 'openai' | 'llm7'
let budgetAiModels = { openai: BUDGET_AI_CONFIG.openaiModel, llm7: BUDGET_AI_CONFIG.llm7Model };
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
- **ZAWSZE używaj tabel markdown** dla rankingów, porównań i list z liczbami
- Tabele: używaj | Kolumna1 | Kolumna2 | z nagłówkami
- Używaj emoji dla czytelności: 📈📉💰⚠️✅❌
- Listy punktowane tylko dla krótkich wniosków/obserwacji
- Unikaj bardzo długich akapitów - dziel na sekcje z nagłówkami ###

### Przykład tabeli:
| Kategoria | Suma | Średnia | % |
|-----------|------|---------|---|
| Żywność | 3 500 zł | 875 zł | 25% |

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
// ═══════════════════════════════════════════════════════════
// ROUTING: OpenAI (primary) + LLM7.io (backup)
// ═══════════════════════════════════════════════════════════

function normalizeProviderMode(mode) {
    const v = String(mode || '').toLowerCase().trim();
    if (v === 'openai' || v === 'llm7' || v === 'auto') return v;
    return 'auto';
}

function estimateTokensFromText(text) {
    const chars = (text || '').length;
    const approx = Math.ceil(chars / (BUDGET_AI_ROUTER.approxCharsPerToken || 4));
    return Math.max(1, approx);
}

function getRouterThresholds() {
    const chars = Number(localStorage.getItem(BUDGET_AI_STORAGE_KEYS.routingChars));
    const toks = Number(localStorage.getItem(BUDGET_AI_STORAGE_KEYS.routingTokens));

    return {
        chars: Number.isFinite(chars) && chars > 1000 ? chars : BUDGET_AI_ROUTER.largeInputCharsThreshold,
        tokens: Number.isFinite(toks) && toks > 500 ? toks : BUDGET_AI_ROUTER.largeInputTokensThreshold
    };
}

function getOtherProvider(providerId) {
    return providerId === 'openai' ? 'llm7' : 'openai';
}

function getProviderConfig(providerId) {
    const cfg = BUDGET_AI_PROVIDERS[providerId];
    if (!cfg) throw new Error(`Nieznany provider: ${providerId}`);
    return cfg;
}

function getProviderKey(providerId) {
    return providerId === 'openai' ? budgetAiKeys.openai : budgetAiKeys.llm7;
}

function getProviderModel(providerId) {
    return providerId === 'openai' ? (budgetAiModels.openai || BUDGET_AI_CONFIG.openaiModel) : (budgetAiModels.llm7 || BUDGET_AI_CONFIG.llm7Model);
}

function buildAuthHeader(providerId) {
    if (providerId === 'openai') {
        if (!budgetAiKeys.openai) throw new Error('Brak klucza OpenAI (sk-...). Ustaw go w ⚙️.');
        return `Bearer ${budgetAiKeys.openai}`;
    }

    // LLM7 może działać bez tokena, ale z tokenem ma wyższe limity
    return `Bearer ${budgetAiKeys.llm7 || 'none'}`;
}

function stringifyBudgetDataForLLM(budgetData) {
    // Zasada: najpierw compact JSON (bez wcięć), żeby oszczędzić tokeny.
    // Jeśli nadal jest ogromny, ucinamy rawData (zostawiając agregaty + liczniki).
    const maxChars = BUDGET_AI_ROUTER.maxDataContextChars || 160000;

    try {
        let json = JSON.stringify(budgetData);
        if (json.length <= maxChars) return { json, truncated: false };

        const slim = JSON.parse(JSON.stringify(budgetData));

        if (slim?.expenses?.rawData && Array.isArray(slim.expenses.rawData)) {
            slim.expenses.rawData = {
                omitted: true,
                count: budgetData.expenses.rawData.length,
                note: 'rawData zostało pominięte z powodu limitu długości. Zadawaj pytania o agregaty / zakresy, albo zawęź okres.'
            };
        }
        if (slim?.income?.rawData && Array.isArray(slim.income.rawData)) {
            slim.income.rawData = {
                omitted: true,
                count: budgetData.income.rawData.length,
                note: 'rawData zostało pominięte z powodu limitu długości. Zadawaj pytania o agregaty / zakresy, albo zawęź okres.'
            };
        }

        json = JSON.stringify(slim);
        if (json.length <= maxChars) return { json, truncated: true };

        // Ostateczne przycięcie (najgorszy case)
        return { json: json.slice(0, maxChars) + '\n...TRUNCATED...', truncated: true };
    } catch (e) {
        return { json: JSON.stringify({ error: 'Nie udało się przygotować danych dla AI.' }), truncated: true };
    }
}

function pickInitialProvider(totalChars, estTokens) {
    const mode = normalizeProviderMode(budgetAiProviderMode);
    const thresholds = getRouterThresholds();

    // Jeśli user wymusił provider — respektuj, ale fallback dalej działa w razie błędu.
    if (mode === 'openai') return 'openai';
    if (mode === 'llm7') return 'llm7';

    // AUTO:
    // 1) jeśli nie ma klucza OpenAI → LLM7
    if (!budgetAiKeys.openai) return 'llm7';

    // 2) jeśli kontekst duży → LLM7
    if (totalChars >= thresholds.chars || estTokens >= thresholds.tokens) return 'llm7';

    // 3) w pozostałych przypadkach → OpenAI
    return 'openai';
}

async function postChatCompletions(providerId, payload) {
    const { baseUrl } = getProviderConfig(providerId);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), BUDGET_AI_ROUTER.requestTimeoutMs || 90000);

    try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': buildAuthHeader(providerId)
            },
            body: JSON.stringify({ ...payload, model: getProviderModel(providerId) }),
            signal: controller.signal
        });

        if (!res.ok) {
            let errorText = '';
            try {
                const errJson = await res.json();
                errorText = errJson?.error?.message || errJson?.message || JSON.stringify(errJson);
            } catch {
                errorText = await res.text().catch(() => '');
            }
            const status = res.status;
            const err = new Error(errorText || `HTTP ${status}`);
            err.status = status;
            err.providerId = providerId;
            throw err;
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            const err = new Error('Brak treści w odpowiedzi modelu.');
            err.status = 500;
            err.providerId = providerId;
            throw err;
        }

        return { data, content };
    } finally {
        clearTimeout(t);
    }
}

async function requestChatWithFailover(initialProviderId, payload) {
    const order = [initialProviderId, getOtherProvider(initialProviderId)];
    let lastError = null;

    for (const providerId of order) {
        try {
            const result = await postChatCompletions(providerId, payload);
            return { providerId, ...result };
        } catch (e) {
            lastError = e;

            // Jeśli pierwszy provider poleciał, spróbuj drugiego
            // (wymóg: backup odpala się zawsze w przypadku błędu)
            continue;
        }
    }

    throw lastError || new Error('Nieznany błąd AI.');
}

function updateBudgetAiProviderBadges() {
    const modeEl = document.getElementById('budgetAiModeBadge');
    const openaiEl = document.getElementById('budgetAiOpenaiBadge');
    const llm7El = document.getElementById('budgetAiLlm7Badge');

    const mode = normalizeProviderMode(budgetAiProviderMode);

    if (modeEl) {
        modeEl.textContent = `Tryb: ${mode.toUpperCase()}`;
    }
    if (openaiEl) {
        openaiEl.textContent = budgetAiKeys.openai ? 'OpenAI: OK' : 'OpenAI: brak klucza';
    }
    if (llm7El) {
        llm7El.textContent = budgetAiKeys.llm7 ? 'LLM7: token' : 'LLM7: free';
    }
}

// KOMUNIKACJA Z API
// ═══════════════════════════════════════════════════════════

async function sendBudgetMessage(customMessage = null) {
    const input = document.getElementById('budgetChatInput');
    const message = customMessage || (input ? input.value.trim() : '');

    if (!message) return;
    if (input) input.value = '';

    // Upewnij się, że ustawienia/klucze są wczytane (async)
    await checkBudgetApiKey();
    updateBudgetAiProviderBadges();

    // Dodaj wiadomość użytkownika do UI
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
        const systemPrompt = getBudgetSystemPrompt();
        const { json: dataJson, truncated } = stringifyBudgetDataForLLM(budgetData);

        // Zbuduj kontekst wiadomości
        const history = budgetChatHistory.slice(-BUDGET_AI_ROUTER.maxHistoryMessages);

        const messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'system',
                content:
                    `DANE FINANSOWE UŻYTKOWNIKA (JSON):
${dataJson}` +
                    (truncated ? `

(Uwaga: część surowych danych mogła zostać pominięta z powodu limitu długości.)` : '')
            },
            ...history,
            { role: 'user', content: message }
        ];

        const totalChars = messages.reduce((s, m) => s + (m.content ? m.content.length : 0), 0);
        const estTokens = Math.ceil(totalChars / (BUDGET_AI_ROUTER.approxCharsPerToken || 4));

        // Routing: wybierz provider startowy
        const initialProvider = pickInitialProvider(totalChars, estTokens);

        // Jeśli user wymusił OpenAI, a nie ma klucza — nie marnuj czasu.
        if (normalizeProviderMode(budgetAiProviderMode) === 'openai' && !budgetAiKeys.openai) {
            throw new Error('Tryb OPENAI wymaga klucza (sk-...). Ustaw go w ⚙️ albo przełącz tryb na AUTO / LLM7.');
        }

        // Payload bez twardo ustawionego modelu (model dobieramy per-provider)
        const payload = {
            messages,
            temperature: BUDGET_AI_CONFIG.temperature,
            max_tokens: BUDGET_AI_CONFIG.maxTokens
        };

        const result = await requestChatWithFailover(initialProvider, payload);

        const assistantMessage = result.content;

        // Zapisz do historii (na potrzeby kolejnych odpowiedzi)
        budgetChatHistory.push({ role: 'user', content: message });
        budgetChatHistory.push({ role: 'assistant', content: assistantMessage });

        // Usuń loading i dodaj odpowiedź
        removeBudgetChatMessage(loadingId);

        const providerLabel = BUDGET_AI_PROVIDERS[result.providerId]?.label || result.providerId;
        const usedFallback = result.providerId !== initialProvider;

        addBudgetChatMessage('assistant', assistantMessage, {
            provider: providerLabel,
            fallback: usedFallback,
            tokens: estTokens,
            chars: totalChars
        });

    } catch (error) {
        console.error('Błąd AI:', error);
        removeBudgetChatMessage(loadingId);

        const hint =
            error?.status === 401
                ? '401 Unauthorized — klucz/token jest nieprawidłowy lub wygasł.'
                : error?.status === 429
                ? '429 Rate limit — limit zapytań został przekroczony.'
                : error?.status
                ? `HTTP ${error.status}`
                : '';

        addBudgetChatMessage(
            'assistant',
            `❌ Błąd: ${error.message}${hint ? `
${hint}` : ''}

` +
                `Spróbuj ponownie albo przełącz tryb w ⚙️ (AUTO / OpenAI / LLM7).`
        );
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

<div class="ai-provider-status" id="budgetAiProviderStatus">
    <span class="ai-provider-pill mode" id="budgetAiModeBadge">Tryb: ...</span>
    <span class="ai-provider-pill openai" id="budgetAiOpenaiBadge">OpenAI: ...</span>
    <span class="ai-provider-pill llm7" id="budgetAiLlm7Badge">LLM7: ...</span>
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
    // Sprawdź klucze/tryb providerów
    checkBudgetApiKey().finally(updateBudgetAiProviderBadges);
}

function getMonthCount() {
    const periods = new Set();
    allExpenses?.forEach(e => periods.add(`${e.rok}-${e.miesiac}`));
    allIncome?.forEach(i => periods.add(`${i.rok}-${i.miesiac}`));
    return periods.size;
}

function addBudgetChatMessage(role, content, meta = null) {
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

    // Meta info (np. z jakiego providera przyszła odpowiedź)
    let metaHtml = '';
    if (meta && role === 'assistant') {
        const provider = meta.provider ? String(meta.provider) : '';
        const details = [];
        if (meta.fallback) details.push('fallback');
        if (meta.tokens) details.push(`~${meta.tokens} tok`);
        if (meta.chars) details.push(`${meta.chars} znaków`);
        const detailsText = details.length ? details.join(' • ') : '';

        metaHtml = `
            <div class="message-meta">
                <span class="ai-provider-pill inline">${provider || 'AI'}</span>
                ${detailsText ? `<span class="ai-meta-details">${detailsText}</span>` : ''}
            </div>
        `;
    }

    div.innerHTML = `
        <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-content">${formattedContent}${metaHtml}</div>
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
    // Najpierw obsłuż bloki kodu
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    // Obsłuż tabele markdown
    text = text.replace(/(\|.+\|[\r\n]+)+/g, (tableMatch) => {
        const rows = tableMatch.trim().split('\n').filter(row => row.trim());
        let html = '<table class="ai-table">';
        
        rows.forEach((row, idx) => {
            // Pomiń wiersz separatora (|---|---|)
            if (row.match(/^\|[\s\-:]+\|$/)) return;
            
            const cells = row.split('|').filter(c => c.trim() !== '');
            const tag = idx === 0 ? 'th' : 'td';
            
            html += '<tr>';
            cells.forEach(cell => {
                html += `<${tag}>${cell.trim()}</${tag}>`;
            });
            html += '</tr>';
        });
        
        html += '</table>';
        return html;
    });
    
    // Obsłuż listy (wieloliniowe)
    text = text.replace(/^(\s*[-*]\s+.+(\n|$))+/gm, (listMatch) => {
        const items = listMatch.trim().split('\n')
            .filter(item => item.trim())
            .map(item => `<li>${item.replace(/^\s*[-*]\s+/, '')}</li>`)
            .join('');
        return `<ul>${items}</ul>`;
    });
    
    // Obsłuż listy numerowane
    text = text.replace(/^(\s*\d+\.\s+.+(\n|$))+/gm, (listMatch) => {
        const items = listMatch.trim().split('\n')
            .filter(item => item.trim())
            .map(item => `<li>${item.replace(/^\s*\d+\.\s+/, '')}</li>`)
            .join('');
        return `<ol>${items}</ol>`;
    });
    
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Headers
    text = text.replace(/^#### (.+)$/gm, '<h5>$1</h5>');
    text = text.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    text = text.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    
    // Horizontal rule
    text = text.replace(/^---$/gm, '<hr>');
    
    // Newlines (ale nie wewnątrz tagów HTML)
    text = text.replace(/\n/g, '<br>');
    
    // Usuń nadmiarowe <br> po blokowych elementach
    text = text.replace(/<\/(table|ul|ol|pre|h[1-5]|hr)><br>/g, '</$1>');
    text = text.replace(/<br><(table|ul|ol|pre|h[1-5]|hr)/g, '<$1');
    
    return text;
}

// ═══════════════════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════

async function checkBudgetApiKey() {
    try {
        // Mode / modele
        budgetAiProviderMode = normalizeProviderMode(localStorage.getItem(BUDGET_AI_STORAGE_KEYS.providerMode) || budgetAiProviderMode);

        const storedOpenaiModel = localStorage.getItem(BUDGET_AI_STORAGE_KEYS.openaiModel);
        const storedLlm7Model = localStorage.getItem(BUDGET_AI_STORAGE_KEYS.llm7Model);

        if (storedOpenaiModel) budgetAiModels.openai = storedOpenaiModel;
        if (storedLlm7Model) budgetAiModels.llm7 = storedLlm7Model;

        // Klucze z localStorage
        const openaiKey = localStorage.getItem(BUDGET_AI_STORAGE_KEYS.openaiKey);
        const llm7Key = localStorage.getItem(BUDGET_AI_STORAGE_KEYS.llm7Key);

        if (openaiKey) budgetAiKeys.openai = openaiKey;
        if (llm7Key) budgetAiKeys.llm7 = llm7Key;

        // Opcjonalnie: ustawienia w arkuszu (jeśli moduł BudgetSheets je udostępnia)
        if (typeof BudgetSheets !== 'undefined' && typeof BudgetSheets.getSettings === 'function') {
            const settings = await BudgetSheets.getSettings().catch(() => null);
            if (settings) {
                if (!budgetAiKeys.openai && settings.openai_api_key) {
                    budgetAiKeys.openai = settings.openai_api_key;
                    localStorage.setItem(BUDGET_AI_STORAGE_KEYS.openaiKey, budgetAiKeys.openai);
                }

                const sheetLlm7 = settings.llm7_api_key || settings.llm7_token || settings.llm7_apiKey;
                if (!budgetAiKeys.llm7 && sheetLlm7) {
                    budgetAiKeys.llm7 = sheetLlm7;
                    localStorage.setItem(BUDGET_AI_STORAGE_KEYS.llm7Key, budgetAiKeys.llm7);
                }

                const sheetMode = settings.budget_ai_provider_mode || settings.ai_provider_mode;
                if (sheetMode) {
                    budgetAiProviderMode = normalizeProviderMode(sheetMode);
                    localStorage.setItem(BUDGET_AI_STORAGE_KEYS.providerMode, budgetAiProviderMode);
                }

                const sheetOpenaiModel = settings.budget_ai_openai_model;
                const sheetLlm7Model = settings.budget_ai_llm7_model;
                if (sheetOpenaiModel && !storedOpenaiModel) {
                    budgetAiModels.openai = sheetOpenaiModel;
                    localStorage.setItem(BUDGET_AI_STORAGE_KEYS.openaiModel, sheetOpenaiModel);
                }
                if (sheetLlm7Model && !storedLlm7Model) {
                    budgetAiModels.llm7 = sheetLlm7Model;
                    localStorage.setItem(BUDGET_AI_STORAGE_KEYS.llm7Model, sheetLlm7Model);
                }
            }
        }
    } catch (error) {
        console.warn('Nie można wczytać ustawień AI:', error);
    } finally {
        updateBudgetAiProviderBadges();
    }
}

function showBudgetApiKeyModal() {
    // 1) Tryb routingu (AUTO / OpenAI / LLM7)
    const currentMode = normalizeProviderMode(budgetAiProviderMode);
    const modeInput = prompt(
        `Ustawienia AI — tryb routingu\n\n` +
        `Wpisz: auto / openai / llm7\n` +
        `- auto: małe zapytania → OpenAI, duże → LLM7; a w razie błędu fallback\n` +
        `- openai: zawsze OpenAI (fallback na LLM7 w razie błędu)\n` +
        `- llm7: zawsze LLM7 (fallback na OpenAI jeśli masz klucz)\n\n` +
        `Aktualnie: ${currentMode}`,
        currentMode
    );
    if (modeInput === null) return;
    budgetAiProviderMode = normalizeProviderMode(modeInput);
    localStorage.setItem(BUDGET_AI_STORAGE_KEYS.providerMode, budgetAiProviderMode);

    // 2) Klucz OpenAI
    const openaiMasked = budgetAiKeys.openai ? `••••••••${budgetAiKeys.openai.slice(-4)}` : '(brak)';
    const openaiInput = prompt(
        `OpenAI API key (wymagany dla trybu openai / jako primary w auto)\n\n` +
        `Aktualny: ${openaiMasked}\n\n` +
        `Wklej nowy klucz (zaczyna się od "sk-")\n` +
        `albo wpisz REMOVE aby usunąć\n` +
        `albo zostaw puste aby nie zmieniać.`,
        ''
    );
    if (openaiInput === null) return;

    const openaiTrim = openaiInput.trim();
    if (openaiTrim.toUpperCase() === 'REMOVE') {
        budgetAiKeys.openai = null;
        localStorage.removeItem(BUDGET_AI_STORAGE_KEYS.openaiKey);
    } else if (openaiTrim !== '') {
        if (openaiTrim.startsWith('sk-')) {
            budgetAiKeys.openai = openaiTrim;
            localStorage.setItem(BUDGET_AI_STORAGE_KEYS.openaiKey, openaiTrim);
        } else {
            if (typeof showToast === 'function') showToast('Nieprawidłowy format klucza OpenAI (powinien zaczynać się od "sk-")', 'error');
        }
    }

    // 3) Token LLM7 (opcjonalny)
    const llm7Masked = budgetAiKeys.llm7 ? `••••••••${budgetAiKeys.llm7.slice(-4)}` : '(brak — tryb free)';
    const llm7Input = prompt(
        `LLM7 token (opcjonalny, podnosi limity)\n\n` +
        `Aktualny: ${llm7Masked}\n\n` +
        `Wklej token z token.llm7.io\n` +
        `albo wpisz REMOVE aby usunąć\n` +
        `albo zostaw puste aby nie zmieniać.`,
        ''
    );
    if (llm7Input === null) return;

    const llm7Trim = llm7Input.trim();
    if (llm7Trim.toUpperCase() === 'REMOVE') {
        budgetAiKeys.llm7 = null;
        localStorage.removeItem(BUDGET_AI_STORAGE_KEYS.llm7Key);
    } else if (llm7Trim !== '') {
        budgetAiKeys.llm7 = llm7Trim;
        localStorage.setItem(BUDGET_AI_STORAGE_KEYS.llm7Key, llm7Trim);
    }

    // 4) Modele
    const openaiModelInput = prompt(
        `Model OpenAI (np. gpt-4o-mini)\n\nAktualnie: ${budgetAiModels.openai}`,
        budgetAiModels.openai
    );
    if (openaiModelInput !== null && openaiModelInput.trim() !== '') {
        budgetAiModels.openai = openaiModelInput.trim();
        localStorage.setItem(BUDGET_AI_STORAGE_KEYS.openaiModel, budgetAiModels.openai);
    }

    const llm7ModelInput = prompt(
        `Model LLM7 (default / fast / pro)\n\nAktualnie: ${budgetAiModels.llm7}`,
        budgetAiModels.llm7
    );
    if (llm7ModelInput !== null && llm7ModelInput.trim() !== '') {
        budgetAiModels.llm7 = llm7ModelInput.trim();
        localStorage.setItem(BUDGET_AI_STORAGE_KEYS.llm7Model, budgetAiModels.llm7);
    }

    if (typeof showToast === 'function') showToast('Zapisano ustawienia AI', 'success');
    updateBudgetAiProviderBadges();
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
        
.ai-provider-status {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 10px;
}

.ai-provider-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--bg-hover);
    border: 1px solid var(--border);
    font-size: 0.8rem;
    color: var(--text-secondary);
}

.ai-provider-pill.inline {
    padding: 4px 8px;
    font-size: 0.75rem;
}

.message-meta {
    margin-top: 8px;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    opacity: 0.85;
}

.ai-meta-details {
    font-size: 0.75rem;
    color: var(--text-secondary);
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
        
        .message-content table,
        .message-content .ai-table {
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 0.85em;
            width: 100%;
            display: block;
            overflow-x: auto;
        }
        
        .message-content th, .message-content td {
            border: 1px solid var(--border);
            padding: 8px 12px;
            text-align: left;
            white-space: nowrap;
        }
        
        .message-content th {
            background: var(--primary);
            color: white;
            font-weight: 600;
        }
        
        .message-content tr:nth-child(even) td {
            background: var(--bg-hover);
        }
        
        .message-content tr:hover td {
            background: rgba(139, 92, 246, 0.1);
        }
        
        .message-content ul,
        .message-content ol {
            margin: 8px 0;
            padding-left: 24px;
        }
        
        .message-content hr {
            border: none;
            border-top: 1px solid var(--border);
            margin: 16px 0;
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
