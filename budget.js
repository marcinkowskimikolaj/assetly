/**
 * Assetly - Budget Module
 * Główna logika modułu budżetu
 */

// ═══════════════════════════════════════════════════════════
// STAN MODUŁU
// ═══════════════════════════════════════════════════════════

let budgetInitialized = false;
let currentBudgetTab = 'overview';

// Dane
let allExpenses = [];
let allIncome = [];
let allRecurring = [];
let allPlans = [];
let budgetSettings = {};
let monthlyDataCache = new Map();

// Wybrany miesiąc do podglądu
let selectedMonth = null;
let selectedYear = null;

// ═══════════════════════════════════════════════════════════
// INICJALIZACJA
// ═══════════════════════════════════════════════════════════



// ===========================================================
// AUTO-INIT BUDGET PAGE (fix: blank page when budget.html no longer starts the module)
// ===========================================================

function isBudgetPage() {
    return Boolean(
        document.getElementById('budget-overview') ||
        document.getElementById('budget-expenses') ||
        document.querySelector('.budget-tabs-nav')
    );
}

/**
 * Unified Budget page bootstrap (same pattern as investments/analytics).
 * - Works with "new" budget.html (no inline onGapiLoaded)
 * - Still safe with legacy budget.html (which might call initBudgetModule() itself)
 */
async function initBudget() {
    if (!isBudgetPage()) return;

    // Require auth if helper exists
    try {
        if (typeof requireAuth === 'function') {
            if (!requireAuth()) return;
        }
    } catch (e) {
        console.warn('Budget: requireAuth failed/skipped', e);
    }

    try {
        // Shared auth bootstrap (if present)
        if (typeof initAuth === 'function') await initAuth();
        if (typeof ensureValidToken === 'function') await ensureValidToken();

        // Logout wiring (prefer shared handler)
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn && !logoutBtn.__budgetBound) {
            logoutBtn.__budgetBound = true;
            if (typeof handleGoogleLogout === 'function') {
                logoutBtn.addEventListener('click', handleGoogleLogout);
            } else {
                logoutBtn.addEventListener('click', () => {
                    try { localStorage.removeItem('google_access_token'); } catch (e) {}
                    window.location.href = 'index.html';
                });
            }
        }

        await initBudgetModule();
    } catch (error) {
        console.error('Budget: page init failed', error);
        try {
            if (typeof showToast === 'function') showToast('Blad inicjalizacji strony Budzet', 'error');
        } catch (e) {}
    }
}

// Expose for legacy inline scripts (if any)
if (typeof window !== 'undefined') {
    window.initBudget = initBudget;
}

// Auto-start after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Some setups may also call initBudgetModule() from window.onload - budgetInitialized protects us.
    initBudget();
});

async function initBudgetModule() {
    if (budgetInitialized) {
        switchBudgetTab(currentBudgetTab);
        return;
    }
    
    showBudgetLoading(true);
    
    try {
        // Upewnij się że arkusze istnieją
        await BudgetSheets.ensureSheetsExist();
        
        // Pobierz kursy walut
        if (typeof fetchCurrencyRates === 'function') {
            await fetchCurrencyRates();
        }
        
        // Załaduj dane
        await loadBudgetData();
        
        // Ustaw domyślny miesiąc na ostatni z danymi
        setDefaultSelectedMonth();
        
        // Inicjalizuj taby
        initBudgetTabs();
        
        // Renderuj pierwszy tab
        switchBudgetTab('overview');
        
        budgetInitialized = true;
        
    } catch (error) {
        console.error('Błąd inicjalizacji modułu Budżet:', error);
        try {
            if (typeof showToast === 'function') showToast('Błąd ładowania modułu Budżet', 'error');
        } catch (e) {}
    } finally {
        showBudgetLoading(false);
    }
}

async function loadBudgetData() {
    const [expenses, income, recurring, plans, settings] = await Promise.all([
        BudgetSheets.getExpenses(),
        BudgetSheets.getIncome(),
        BudgetSheets.getRecurringExpenses(),
        BudgetSheets.getPlans(),
        BudgetSheets.getSettings()
    ]);
    
    allExpenses = expenses;
    allIncome = income;
    allRecurring = recurring;
    allPlans = plans;
    budgetSettings = settings;
    
    // Wyczyść cache
    monthlyDataCache.clear();
}

function setDefaultSelectedMonth() {
    const availableMonths = getAvailableMonthsFromData();
    if (availableMonths.length > 0) {
        selectedYear = availableMonths[0].rok;
        selectedMonth = availableMonths[0].miesiac;
    } else {
        const now = new Date();
        selectedYear = now.getFullYear();
        selectedMonth = now.getMonth() + 1;
    }
}

function getAvailableMonthsFromData() {
    const months = new Map();
    
    [...allExpenses, ...allIncome].forEach(item => {
        const key = `${item.rok}-${String(item.miesiac).padStart(2, '0')}`;
        if (!months.has(key)) {
            months.set(key, { rok: item.rok, miesiac: item.miesiac });
        }
    });
    
    return Array.from(months.values())
        .sort((a, b) => {
            if (a.rok !== b.rok) return b.rok - a.rok;
            return b.miesiac - a.miesiac;
        });
}

// ═══════════════════════════════════════════════════════════
// NAWIGACJA TABÓW
// ═══════════════════════════════════════════════════════════

function initBudgetTabs() {
    document.querySelectorAll('.budget-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchBudgetTab(btn.dataset.tab);
        });
    });
}

function switchBudgetTab(tabName) {
    currentBudgetTab = tabName;
    
    // Aktualizuj przyciski
    document.querySelectorAll('.budget-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Aktualizuj zawartość
    document.querySelectorAll('.budget-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `budget-${tabName}`);
    });
    
    // Renderuj zawartość
    switch (tabName) {
        case 'overview':
            renderOverviewTab();
            break;
        case 'expenses':
            renderExpensesTab();
            break;
        case 'income':
            renderIncomeTab();
            break;
        case 'plans':
            renderPlansTab();
            break;
        case 'trends':
            renderTrendsTab();
            break;
        case 'ai':
            renderBudgetAITab();
            break;
    }
}

// ═══════════════════════════════════════════════════════════
// TAB: PRZEGLĄD
// ═══════════════════════════════════════════════════════════

function renderOverviewTab() {
    const container = document.getElementById('budget-overview');
    if (!container) return;
    
    const availableMonths = getAvailableMonthsFromData();
    const completeness = getDataCompleteness();
    
    // Pobierz dane wybranego miesiąca
    const currentMonthData = getMonthlyData(selectedYear, selectedMonth);
    const previousMonthData = getPreviousMonthData(selectedYear, selectedMonth);
    const sameMonthLastYear = getMonthlyData(selectedYear - 1, selectedMonth);
    
    // Statystyki z ostatnich 12 miesięcy
    const last12Months = getLast12MonthsData();
    const stats = BudgetMetrics.calculatePeriodStats(last12Months);
    const categoryAverages = BudgetMetrics.aggregateByCategory(last12Months);
    
    // Porównania
    const vsPrevMonth = BudgetMetrics.compareMonths(currentMonthData, previousMonthData);
    const vsLastYear = BudgetMetrics.compareMonths(currentMonthData, sameMonthLastYear);
    const vsAverage = BudgetMetrics.compareWithAverage(currentMonthData, stats.average);
    
    // Anomalie
    const anomalies = BudgetMetrics.findAnomalies(currentMonthData, categoryAverages);
    
    // Top kategorie
    const topCategories = BudgetMetrics.getTopCategories(currentMonthData, 5);
    
    // Plan inwestycji (z kalkulatora inwestycji)
    const investmentPlan = getInvestmentPlanFromCalculator();
    
    container.innerHTML = `
        <!-- Status wprowadzania danych -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Status wprowadzania danych</h3>
                <button class="btn btn-primary btn-sm" onclick="showAddMonthModal()">
                    + Dodaj miesiąc
                </button>
            </div>
            <div class="data-completeness">
                ${renderDataCompleteness(completeness)}
            </div>
        </div>
        
        <!-- Wybrany miesiąc -->
        <div class="card overview-selected-month">
            <div class="card-header">
                <h3 class="card-title">
                    <select class="month-selector" onchange="changeSelectedMonth(this.value)">
                        ${availableMonths.map(m => `
                            <option value="${m.rok}-${m.miesiac}" 
                                ${m.rok === selectedYear && m.miesiac === selectedMonth ? 'selected' : ''}>
                                ${BudgetCategories.formatPeriod(m.rok, m.miesiac)}
                            </option>
                        `).join('')}
                    </select>
                </h3>
                <button class="btn btn-ghost btn-sm" onclick="editMonth(${selectedYear}, ${selectedMonth})">
                    Edytuj
                </button>
            </div>
            
            <div class="overview-summary">
                <div class="summary-row">
                    <span class="summary-label">Dochody:</span>
                    <span class="summary-value">${formatMoney(currentMonthData.income.total)}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Wydatki:</span>
                    <span class="summary-value">${formatMoney(currentMonthData.expenses.total)}</span>
                </div>
                <div class="summary-row summary-divider"></div>
                <div class="summary-row summary-balance">
                    <span class="summary-label">Bilans:</span>
                    <span class="summary-value ${currentMonthData.balance >= 0 ? 'positive' : 'negative'}">
                        ${currentMonthData.balance >= 0 ? '+' : ''}${formatMoney(currentMonthData.balance)}
                    </span>
                    <span class="summary-percent">(${currentMonthData.savingsRate.toFixed(1)}% stopa oszcz.)</span>
                </div>
                
                ${currentMonthData.expenses.transfers > 0 ? `
                    <div class="summary-row summary-small">
                        <span class="summary-label">W tym transfery:</span>
                        <span class="summary-value">${formatMoney(currentMonthData.expenses.transfers)}</span>
                    </div>
                ` : ''}
                
                ${investmentPlan > 0 ? `
                    <div class="summary-row summary-small">
                        <span class="summary-label">Plan inwestycji:</span>
                        <span class="summary-value">${formatMoney(investmentPlan)}</span>
                        <span class="summary-status ${currentMonthData.balance >= investmentPlan ? 'ok' : 'warning'}">
                            ${currentMonthData.balance >= investmentPlan ? '✓' : '⚠️'}
                        </span>
                    </div>
                    <div class="summary-row summary-small">
                        <span class="summary-label">Pozostaje:</span>
                        <span class="summary-value">${formatMoney(currentMonthData.balance - investmentPlan)}</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="overview-breakdown">
                <div class="breakdown-item">
                    <span class="breakdown-label">Wydatki stałe:</span>
                    <span class="breakdown-value">${formatMoney(currentMonthData.expenses.fixed)}</span>
                    <span class="breakdown-percent">${currentMonthData.expenses.total > 0 
                        ? ((currentMonthData.expenses.fixed / currentMonthData.expenses.total) * 100).toFixed(0) 
                        : 0}%</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-label">Wydatki zmienne:</span>
                    <span class="breakdown-value">${formatMoney(currentMonthData.expenses.variable)}</span>
                    <span class="breakdown-percent">${currentMonthData.expenses.total > 0 
                        ? ((currentMonthData.expenses.variable / currentMonthData.expenses.total) * 100).toFixed(0) 
                        : 0}%</span>
                </div>
            </div>
        </div>
        
        <!-- Porównania -->
        <div class="overview-comparisons">
            <div class="card comparison-card">
                <h4>vs ${previousMonthData ? BudgetCategories.formatPeriod(
                    selectedMonth === 1 ? selectedYear - 1 : selectedYear,
                    selectedMonth === 1 ? 12 : selectedMonth - 1
                ) : 'poprzedni'}</h4>
                ${vsPrevMonth.hasPrevious ? `
                    <div class="comparison-item">
                        <span>Dochody:</span>
                        <span class="${vsPrevMonth.income.diff >= 0 ? 'positive' : 'negative'}">
                            ${vsPrevMonth.income.diff >= 0 ? '+' : ''}${formatMoney(vsPrevMonth.income.diff)}
                            (${vsPrevMonth.income.percent >= 0 ? '+' : ''}${vsPrevMonth.income.percent.toFixed(1)}%)
                        </span>
                    </div>
                    <div class="comparison-item">
                        <span>Wydatki:</span>
                        <span class="${vsPrevMonth.expenses.diff <= 0 ? 'positive' : 'negative'}">
                            ${vsPrevMonth.expenses.diff >= 0 ? '+' : ''}${formatMoney(vsPrevMonth.expenses.diff)}
                            (${vsPrevMonth.expenses.percent >= 0 ? '+' : ''}${vsPrevMonth.expenses.percent.toFixed(1)}%)
                        </span>
                    </div>
                    <div class="comparison-item comparison-balance">
                        <span>Bilans:</span>
                        <span class="${vsPrevMonth.balance.diff >= 0 ? 'positive' : 'negative'}">
                            ${vsPrevMonth.balance.diff >= 0 ? '+' : ''}${formatMoney(vsPrevMonth.balance.diff)}
                        </span>
                    </div>
                ` : '<p class="no-data">Brak danych</p>'}
            </div>
            
            <div class="card comparison-card">
                <h4>vs ${BudgetCategories.formatPeriod(selectedYear - 1, selectedMonth)}</h4>
                ${vsLastYear.hasPrevious ? `
                    <div class="comparison-item">
                        <span>Dochody:</span>
                        <span class="${vsLastYear.income.diff >= 0 ? 'positive' : 'negative'}">
                            ${vsLastYear.income.diff >= 0 ? '+' : ''}${formatMoney(vsLastYear.income.diff)}
                            (${vsLastYear.income.percent >= 0 ? '+' : ''}${vsLastYear.income.percent.toFixed(1)}%)
                        </span>
                    </div>
                    <div class="comparison-item">
                        <span>Wydatki:</span>
                        <span class="${vsLastYear.expenses.diff <= 0 ? 'positive' : 'negative'}">
                            ${vsLastYear.expenses.diff >= 0 ? '+' : ''}${formatMoney(vsLastYear.expenses.diff)}
                            (${vsLastYear.expenses.percent >= 0 ? '+' : ''}${vsLastYear.expenses.percent.toFixed(1)}%)
                        </span>
                    </div>
                    <div class="comparison-item comparison-balance">
                        <span>Bilans:</span>
                        <span class="${vsLastYear.balance.diff >= 0 ? 'positive' : 'negative'}">
                            ${vsLastYear.balance.diff >= 0 ? '+' : ''}${formatMoney(vsLastYear.balance.diff)}
                        </span>
                    </div>
                ` : '<p class="no-data">Brak danych</p>'}
            </div>
        </div>
        
        <!-- Kluczowe metryki -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Kluczowe metryki (ostatnie 12 mies.)</h3>
            </div>
            <div class="metrics-grid">
                <div class="metric-item">
                    <span class="metric-label">Śr. dochód</span>
                    <span class="metric-value">${formatMoney(stats.average.income)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Śr. wydatki</span>
                    <span class="metric-value">${formatMoney(stats.average.expenses)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Śr. oszczędności</span>
                    <span class="metric-value positive">${formatMoney(stats.average.balance)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Stopa oszczędności</span>
                    <span class="metric-value">${stats.savingsRate.toFixed(1)}%</span>
                </div>
            </div>
        </div>
        
        <!-- Top kategorie -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Top 5 kategorii (${BudgetCategories.formatPeriod(selectedYear, selectedMonth)})</h3>
            </div>
            <div class="top-categories">
                ${topCategories.map((cat, i) => `
                    <div class="category-row">
                        <span class="category-rank">${i + 1}.</span>
                        <span class="category-icon">${cat.icon}</span>
                        <span class="category-name">${cat.kategoria}</span>
                        <span class="category-amount">${formatMoney(cat.kwota)}</span>
                        <div class="category-bar">
                            <div class="category-bar-fill" style="width: ${cat.procent}%"></div>
                        </div>
                        <span class="category-percent">${cat.procent.toFixed(0)}%</span>
                        ${renderCategoryTrend(cat.kategoria, categoryAverages)}
                    </div>
                `).join('')}
            </div>
        </div>
        
        <!-- Obserwacje i alerty -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Obserwacje i alerty</h3>
            </div>
            <div class="alerts-list">
                ${renderAlerts(anomalies, currentMonthData, stats, investmentPlan)}
            </div>
        </div>
    `;
}

function renderDataCompleteness(completeness) {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1];
    
    return years.map(year => {
        const yearData = completeness.filter(c => c.rok === year);
        
        return `
            <div class="completeness-year">
                <span class="completeness-year-label">${year}:</span>
                <div class="completeness-months">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                        const monthData = yearData.find(c => c.miesiac === m);
                        const status = monthData?.status || 'empty';
                        const statusClass = status === 'complete' ? 'complete' : 
                                          status === 'partial' ? 'partial' : 'empty';
                        return `
                            <span class="completeness-month ${statusClass}" 
                                  title="${BudgetCategories.getMonthName(m)}: ${
                                      status === 'complete' ? 'dane kompletne' :
                                      status === 'partial' ? 'częściowe dane' : 'brak danych'
                                  }">
                                ${BudgetCategories.MONTH_NAMES_SHORT[m-1]}
                            </span>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderCategoryTrend(category, categoryAverages) {
    const avg = categoryAverages[category]?.average || 0;
    const currentMonthData = getMonthlyData(selectedYear, selectedMonth);
    const current = currentMonthData.expenses.byCategory[category]?.total || 0;
    
    if (avg === 0) return '';
    
    const diff = ((current - avg) / avg * 100);
    if (Math.abs(diff) < 5) return '<span class="trend-indicator stable">≈</span>';
    
    return diff > 0 
        ? `<span class="trend-indicator up">↑ ${diff.toFixed(0)}%</span>`
        : `<span class="trend-indicator down">↓ ${Math.abs(diff).toFixed(0)}%</span>`;
}

function renderAlerts(anomalies, currentMonth, stats, investmentPlan) {
    const alerts = [];
    
    // Anomalie kategorii
    anomalies.slice(0, 3).forEach(a => {
        alerts.push({
            type: a.severity === 'high' ? 'warning' : 'info',
            icon: '⚠️',
            message: `"${a.kategoria}" +${a.percent.toFixed(0)}% vs średnia (${formatMoney(a.current)} vs ${formatMoney(a.average)})`
        });
    });
    
    // Plan inwestycji
    if (investmentPlan > 0) {
        if (currentMonth.balance >= investmentPlan) {
            alerts.push({
                type: 'success',
                icon: '✅',
                message: `Plan inwestycji (${formatMoney(investmentPlan)}) zrealizowany`
            });
        } else {
            alerts.push({
                type: 'warning',
                icon: '⚠️',
                message: `Bilans (${formatMoney(currentMonth.balance)}) poniżej planu inwestycji (${formatMoney(investmentPlan)})`
            });
        }
    }
    
    // Stopa oszczędności
    if (currentMonth.savingsRate > stats.savingsRate + 5) {
        alerts.push({
            type: 'success',
            icon: '📈',
            message: `Stopa oszczędności (${currentMonth.savingsRate.toFixed(1)}%) powyżej średniej (${stats.savingsRate.toFixed(1)}%)`
        });
    }
    
    // Brak alertów
    if (alerts.length === 0) {
        alerts.push({
            type: 'info',
            icon: '💡',
            message: 'Brak istotnych obserwacji dla tego miesiąca'
        });
    }
    
    return alerts.map(a => `
        <div class="alert-item ${a.type}">
            <span class="alert-icon">${a.icon}</span>
            <span class="alert-message">${a.message}</span>
        </div>
    `).join('');
}

// ═══════════════════════════════════════════════════════════
// TAB: WYDATKI
// ═══════════════════════════════════════════════════════════

function renderExpensesTab() {
    const container = document.getElementById('budget-expenses');
    if (!container) return;
    
    const availableMonths = getAvailableMonthsFromData();
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Historia wydatków</h3>
                <div class="header-actions">
                    <button class="btn btn-ghost btn-sm" onclick="showAddExpenseModal()">
                        + Dodaj wydatek
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="showAddMonthModal()">
                        + Dodaj miesiąc
                    </button>
                </div>
            </div>
            
            <div class="expenses-list">
                ${availableMonths.length === 0 ? `
                    <div class="empty-state">
                        <p>Brak danych o wydatkach</p>
                        <button class="btn btn-primary" onclick="showAddMonthModal()">Dodaj pierwszy miesiąc</button>
                    </div>
                ` : availableMonths.map(m => renderExpenseMonthRow(m)).join('')}
            </div>
        </div>
    `;
}

function renderExpenseMonthRow(monthInfo) {
    const data = getMonthlyData(monthInfo.rok, monthInfo.miesiac);
    const last12 = getLast12MonthsData();
    const stats = BudgetMetrics.calculatePeriodStats(last12);
    const vsAvg = data.expenses.total - stats.average.expenses;
    const vsAvgPercent = stats.average.expenses > 0 ? (vsAvg / stats.average.expenses * 100) : 0;
    
    return `
        <div class="expense-month-row" onclick="toggleExpenseDetails('${monthInfo.rok}-${monthInfo.miesiac}')">
            <div class="expense-month-header">
                <span class="expense-month-name">${BudgetCategories.formatPeriod(monthInfo.rok, monthInfo.miesiac)}</span>
                <span class="expense-month-total">${formatMoney(data.expenses.total)}</span>
                <span class="expense-month-vs-avg ${vsAvg <= 0 ? 'positive' : 'negative'}">
                    ${vsAvg > 0 ? '+' : ''}${formatMoney(vsAvg)} vs śr.
                </span>
                <span class="expense-month-toggle">▼</span>
            </div>
            <div id="expense-details-${monthInfo.rok}-${monthInfo.miesiac}" class="expense-month-details hidden">
                ${Object.entries(data.expenses.byCategory)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([cat, catData]) => `
                        <div class="expense-category-row">
                            <span class="expense-category-icon">${BudgetCategories.getCategoryIcon(cat)}</span>
                            <span class="expense-category-name">${cat}</span>
                            <span class="expense-category-amount">${formatMoney(catData.total)}</span>
                        </div>
                    `).join('')}
                <div class="expense-month-actions">
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); editMonth(${monthInfo.rok}, ${monthInfo.miesiac})">
                        Edytuj
                    </button>
                    <button class="btn btn-ghost btn-sm text-danger" onclick="event.stopPropagation(); deleteMonth(${monthInfo.rok}, ${monthInfo.miesiac})">
                        Usuń
                    </button>
                </div>
            </div>
        </div>
    `;
}

function toggleExpenseDetails(key) {
    const details = document.getElementById(`expense-details-${key}`);
    if (details) {
        details.classList.toggle('hidden');
    }
}

// ═══════════════════════════════════════════════════════════
// TAB: DOCHODY
// ═══════════════════════════════════════════════════════════

function renderIncomeTab() {
    const container = document.getElementById('budget-income');
    if (!container) return;
    
    // Historia wynagrodzeń po pracodawcach
    const employers = [...new Set(allIncome.filter(i => i.pracodawca).map(i => i.pracodawca))];
    const salaryHistories = employers.map(emp => ({
        pracodawca: emp,
        ...BudgetMetrics.getSalaryHistory(allIncome, emp)
    }));
    
    // Agregacja po źródłach
    const last12 = getLast12MonthsData();
    const incomeBySource = BudgetMetrics.aggregateIncomeBySource(last12);
    
    // Grupuj dochody po miesiącach
    const incomeByMonth = {};
    allIncome.forEach(i => {
        const key = `${i.rok}-${String(i.miesiac).padStart(2, '0')}`;
        if (!incomeByMonth[key]) {
            incomeByMonth[key] = { rok: i.rok, miesiac: i.miesiac, items: [], total: 0 };
        }
        incomeByMonth[key].items.push(i);
        incomeByMonth[key].total += i.kwotaPLN;
    });
    
    const sortedMonths = Object.keys(incomeByMonth).sort().reverse();
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Podsumowanie dochodów (12 mies.)</h3>
                <button class="btn btn-primary btn-sm" onclick="showAddIncomeModal()">
                    + Dodaj dochód
                </button>
            </div>
            <div class="income-sources">
                ${Object.entries(incomeBySource).length > 0 ? 
                    Object.entries(incomeBySource)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([src, data]) => `
                            <div class="income-source-row">
                                <span class="income-source-icon">${BudgetCategories.getIncomeIcon(src)}</span>
                                <span class="income-source-name">${src}</span>
                                <span class="income-source-total">${formatMoney(data.total)}</span>
                                <span class="income-source-avg">śr. ${formatMoney(data.average)}/mies.</span>
                            </div>
                        `).join('') 
                    : '<p class="no-data">Brak danych o dochodach</p>'
                }
            </div>
        </div>
        
        ${salaryHistories.length > 0 ? `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Historia wynagrodzenia</h3>
                </div>
                ${salaryHistories.map(sh => renderSalaryHistory(sh)).join('')}
            </div>
        ` : ''}
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Lista dochodów</h3>
            </div>
            <div class="income-list">
                ${sortedMonths.length > 0 ? sortedMonths.map(key => {
                    const monthData = incomeByMonth[key];
                    return `
                        <div class="income-month-group">
                            <div class="income-month-header" onclick="toggleIncomeMonth('${key}')">
                                <span class="income-month-name">${BudgetCategories.formatPeriod(monthData.rok, monthData.miesiac)}</span>
                                <span class="income-month-total">${formatMoney(monthData.total)}</span>
                                <span class="income-month-count">${monthData.items.length} wpis${monthData.items.length > 1 ? 'ów' : ''}</span>
                                <span class="income-month-toggle">▼</span>
                            </div>
                            <div id="income-details-${key}" class="income-month-details hidden">
                                ${monthData.items.map(i => `
                                    <div class="income-row-item">
                                        <span class="income-row-icon">${BudgetCategories.getIncomeIcon(i.zrodlo)}</span>
                                        <span class="income-row-source">${i.zrodlo}</span>
                                        <span class="income-row-employer">${i.pracodawca || '-'}</span>
                                        <span class="income-row-amount">${formatMoney(i.kwotaPLN)}</span>
                                        <div class="income-row-actions">
                                            <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation(); editIncome('${i.id}')" title="Edytuj">✏️</button>
                                            <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation(); deleteIncome('${i.id}')" title="Usuń">🗑️</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }).join('') : `
                    <div class="empty-state">
                        <p>Brak zapisanych dochodów</p>
                        <button class="btn btn-primary" onclick="showAddIncomeModal()">Dodaj pierwszy dochód</button>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderSalaryHistory(sh) {
    if (!sh.history || sh.history.length === 0) return '';
    
    // Przygotuj dane z porównaniami do poprzedniego miesiąca
    const historyWithComparison = sh.history.map((item, index) => {
        const prev = index > 0 ? sh.history[index - 1] : null;
        const diff = prev ? item.kwotaPLN - prev.kwotaPLN : 0;
        const percentChange = prev && prev.kwotaPLN !== 0 
            ? (diff / prev.kwotaPLN * 100) 
            : 0;
        
        return {
            ...item,
            diff,
            percentChange,
            isRaise: diff > 0,
            isDecrease: diff < 0,
            isFirst: index === 0
        };
    });
    
    // Odwróć kolejność - najnowsze na górze
    const reversedHistory = [...historyWithComparison].reverse();
    
    return `
        <div class="salary-history">
            <div class="salary-history-header">
                <h4>${sh.pracodawca}</h4>
                <div class="salary-stats">
                    <div class="salary-stat">
                        <span class="stat-label">Zatrudnienie:</span>
                        <span class="stat-value">${sh.employmentMonths} mies.</span>
                    </div>
                    <div class="salary-stat">
                        <span class="stat-label">Pierwsza:</span>
                        <span class="stat-value">${formatMoney(sh.firstSalary)}</span>
                    </div>
                    <div class="salary-stat">
                        <span class="stat-label">Aktualna:</span>
                        <span class="stat-value">${formatMoney(sh.currentSalary)}</span>
                    </div>
                    <div class="salary-stat">
                        <span class="stat-label">Wzrost łączny:</span>
                        <span class="stat-value ${sh.totalGrowth >= 0 ? 'positive' : 'negative'}">
                            ${sh.totalGrowth >= 0 ? '+' : ''}${sh.totalGrowth.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="salary-history-table">
                <div class="salary-table-header">
                    <span class="salary-col-period">Okres</span>
                    <span class="salary-col-amount">Kwota netto</span>
                    <span class="salary-col-change">Zmiana</span>
                    <span class="salary-col-percent">%</span>
                </div>
                <div class="salary-table-body">
                    ${reversedHistory.map(item => `
                        <div class="salary-table-row ${item.isRaise ? 'row-raise' : ''} ${item.isDecrease ? 'row-decrease' : ''}">
                            <span class="salary-col-period">${BudgetCategories.formatPeriod(item.rok, item.miesiac)}</span>
                            <span class="salary-col-amount">${formatMoney(item.kwotaPLN)}</span>
                            <span class="salary-col-change ${item.diff > 0 ? 'positive' : item.diff < 0 ? 'negative' : ''}">
                                ${item.isFirst ? '—' : (item.diff > 0 ? '+' : '') + formatMoney(item.diff)}
                            </span>
                            <span class="salary-col-percent ${item.percentChange > 0 ? 'positive' : item.percentChange < 0 ? 'negative' : ''}">
                                ${item.isFirst ? '—' : (item.percentChange > 0 ? '+' : '') + item.percentChange.toFixed(1) + '%'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            ${sh.raises.length > 0 ? `
                <div class="salary-raises-summary">
                    <span class="raises-label">Liczba podwyżek:</span>
                    <span class="raises-count">${sh.raises.length}</span>
                    <span class="raises-total">
                        (łącznie +${formatMoney(sh.raises.reduce((sum, r) => sum + (r.roznica > 0 ? r.roznica : 0), 0))})
                    </span>
                </div>
            ` : ''}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// TAB: PLANY
// ═══════════════════════════════════════════════════════════

function renderPlansTab() {
    const container = document.getElementById('budget-plans');
    if (!container) return;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Wydatki stałe (szablon)</h3>
                <button class="btn btn-primary btn-sm" onclick="showAddRecurringModal()">
                    + Dodaj
                </button>
            </div>
            ${renderRecurringExpenses()}
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Analiza 50/30/20</h3>
            </div>
            ${render503020Analysis()}
        </div>
    `;
}

function renderRecurringExpenses() {
    const monthly = allRecurring.filter(r => r.czestotliwosc === 'monthly' && r.aktywny);
    const quarterly = allRecurring.filter(r => r.czestotliwosc === 'quarterly' && r.aktywny);
    const yearly = allRecurring.filter(r => r.czestotliwosc === 'yearly' && r.aktywny);
    
    const monthlyTotal = monthly.reduce((a, r) => a + r.kwotaTypowa, 0);
    const yearlyTotal = yearly.reduce((a, r) => a + r.kwotaTypowa, 0);
    const yearlyMonthly = yearlyTotal / 12;
    
    return `
        <div class="recurring-section">
            <h4>Miesięczne <span class="recurring-total">${formatMoney(monthlyTotal)}/mies.</span></h4>
            ${monthly.length === 0 ? '<p class="no-data">Brak wydatków stałych miesięcznych</p>' : `
                <div class="recurring-list">
                    ${monthly.map(r => `
                        <div class="recurring-row">
                            <span class="recurring-name">${r.nazwa}</span>
                            <span class="recurring-category">${r.kategoria}</span>
                            <span class="recurring-amount">${formatMoney(r.kwotaTypowa)}</span>
                            <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteRecurring('${r.id}')">×</button>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
        
        ${yearly.length > 0 ? `
            <div class="recurring-section">
                <h4>Roczne <span class="recurring-total">${formatMoney(yearlyTotal)}/rok (${formatMoney(yearlyMonthly)}/mies.)</span></h4>
                <div class="recurring-list">
                    ${yearly.map(r => `
                        <div class="recurring-row">
                            <span class="recurring-name">${r.nazwa}</span>
                            <span class="recurring-month">${r.miesiacPlatnosci > 0 ? BudgetCategories.getMonthName(r.miesiacPlatnosci) : ''}</span>
                            <span class="recurring-amount">${formatMoney(r.kwotaTypowa)}</span>
                            <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteRecurring('${r.id}')">×</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;
}

function render503020Analysis() {
    const currentMonthData = getMonthlyData(selectedYear, selectedMonth);
    if (currentMonthData.income.total === 0) {
        return '<p class="no-data">Brak danych o dochodach dla wybranego miesiąca</p>';
    }
    
    const analysis = BudgetMetrics.analyze503020(currentMonthData);
    
    return `
        <div class="analysis-503020">
            <div class="analysis-row ${analysis.needs.status}">
                <div class="analysis-label">
                    <span class="analysis-name">Potrzeby (50%)</span>
                    <span class="analysis-limit">limit: ${formatMoney(analysis.needs.limit)}</span>
                </div>
                <div class="analysis-bar">
                    <div class="analysis-bar-fill" style="width: ${Math.min(analysis.needs.percent * 2, 100)}%"></div>
                </div>
                <div class="analysis-values">
                    <span class="analysis-actual">${formatMoney(analysis.needs.actual)}</span>
                    <span class="analysis-percent">${analysis.needs.percent.toFixed(1)}%</span>
                    <span class="analysis-status">${analysis.needs.status === 'ok' ? '✓' : '⚠️'}</span>
                </div>
            </div>
            
            <div class="analysis-row ${analysis.wants.status}">
                <div class="analysis-label">
                    <span class="analysis-name">Zachcianki (30%)</span>
                    <span class="analysis-limit">limit: ${formatMoney(analysis.wants.limit)}</span>
                </div>
                <div class="analysis-bar">
                    <div class="analysis-bar-fill" style="width: ${Math.min(analysis.wants.percent * (100/30), 100)}%"></div>
                </div>
                <div class="analysis-values">
                    <span class="analysis-actual">${formatMoney(analysis.wants.actual)}</span>
                    <span class="analysis-percent">${analysis.wants.percent.toFixed(1)}%</span>
                    <span class="analysis-status">${analysis.wants.status === 'ok' ? '✓' : '⚠️'}</span>
                </div>
            </div>
            
            <div class="analysis-row ${analysis.savings.status}">
                <div class="analysis-label">
                    <span class="analysis-name">Oszczędności (20%)</span>
                    <span class="analysis-limit">cel: ${formatMoney(analysis.savings.limit)}</span>
                </div>
                <div class="analysis-bar">
                    <div class="analysis-bar-fill" style="width: ${Math.min(analysis.savings.percent * 5, 100)}%"></div>
                </div>
                <div class="analysis-values">
                    <span class="analysis-actual">${formatMoney(analysis.savings.actual)}</span>
                    <span class="analysis-percent">${analysis.savings.percent.toFixed(1)}%</span>
                    <span class="analysis-status">${analysis.savings.status === 'ok' ? '✓' : '⚠️'}</span>
                </div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// TAB: TRENDY
// ═══════════════════════════════════════════════════════════

function renderTrendsTab() {
    const container = document.getElementById('budget-trends');
    if (!container) return;
    
    const last12 = getLast12MonthsData();
    const stats = BudgetMetrics.calculatePeriodStats(last12);
    const incomeTrend = BudgetMetrics.calculateTrend(last12, 'income');
    const expensesTrend = BudgetMetrics.calculateTrend(last12, 'expenses');
    const balanceTrend = BudgetMetrics.calculateTrend(last12, 'balance');
    
    // Sezonowość
    const seasonality = BudgetMetrics.calculateSeasonality(last12);
    const extremes = BudgetMetrics.findSeasonalExtremes(seasonality);
    
    // Projekcja
    const projection = BudgetMetrics.projectNextMonth(last12, seasonality);
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Dochody vs Wydatki (12 mies.)</h3>
            </div>
            <div class="chart-container">
                <canvas id="budgetTrendChart"></canvas>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Kierunki trendów</h3>
            </div>
            <div class="trends-summary">
                <div class="trend-item">
                    <span class="trend-label">Dochody:</span>
                    <span class="trend-direction ${incomeTrend.direction}">${getTrendArrow(incomeTrend.direction)}</span>
                    <span class="trend-value">${incomeTrend.percentChange >= 0 ? '+' : ''}${incomeTrend.percentChange.toFixed(1)}%/mies.</span>
                </div>
                <div class="trend-item">
                    <span class="trend-label">Wydatki:</span>
                    <span class="trend-direction ${expensesTrend.direction}">${getTrendArrow(expensesTrend.direction)}</span>
                    <span class="trend-value">${expensesTrend.percentChange >= 0 ? '+' : ''}${expensesTrend.percentChange.toFixed(1)}%/mies.</span>
                </div>
                <div class="trend-item">
                    <span class="trend-label">Oszczędności:</span>
                    <span class="trend-direction ${balanceTrend.direction}">${getTrendArrow(balanceTrend.direction)}</span>
                    <span class="trend-value">${balanceTrend.percentChange >= 0 ? '+' : ''}${balanceTrend.percentChange.toFixed(1)}%/mies.</span>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Sezonowość wydatków</h3>
            </div>
            <div class="seasonality-info">
                ${extremes.highest ? `
                    <p>📈 Najdroższy miesiąc: <strong>${extremes.highest.nazwa}</strong> 
                       (śr. ${formatMoney(extremes.highest.avgExpenses)}, +${extremes.highest.varianceFromAvg.toFixed(0)}% vs średnia)</p>
                ` : ''}
                ${extremes.lowest ? `
                    <p>📉 Najtańszy miesiąc: <strong>${extremes.lowest.nazwa}</strong> 
                       (śr. ${formatMoney(extremes.lowest.avgExpenses)}, ${extremes.lowest.varianceFromAvg.toFixed(0)}% vs średnia)</p>
                ` : ''}
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Projekcja na następny miesiąc</h3>
            </div>
            <div class="projection-info">
                <div class="projection-row">
                    <span>Przewidywane dochody:</span>
                    <span>${formatMoney(projection.income)}</span>
                </div>
                <div class="projection-row">
                    <span>Przewidywane wydatki:</span>
                    <span>${formatMoney(projection.expenses)}</span>
                </div>
                <div class="projection-row projection-balance">
                    <span>Przewidywany bilans:</span>
                    <span class="${projection.balance >= 0 ? 'positive' : 'negative'}">${formatMoney(projection.balance)}</span>
                </div>
                <p class="projection-note">Na podstawie średniej z ostatnich ${projection.basedOnMonths} miesięcy z uwzględnieniem sezonowości</p>
            </div>
        </div>
    `;
    
    // Renderuj wykres
    renderBudgetTrendChart(last12);
}

function getTrendArrow(direction) {
    switch (direction) {
        case 'up': return '↑';
        case 'down': return '↓';
        default: return '→';
    }
}

function renderBudgetTrendChart(monthlyData) {
    const ctx = document.getElementById('budgetTrendChart');
    if (!ctx) return;
    
    const labels = monthlyData.map(m => BudgetCategories.MONTH_NAMES_SHORT[m.miesiac - 1] + ' ' + m.rok);
    const incomeData = monthlyData.map(m => m.income.total);
    const expensesData = monthlyData.map(m => m.expenses.total);
    const balanceData = monthlyData.map(m => m.balance);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Dochody',
                    data: incomeData,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.3
                },
                {
                    label: 'Wydatki',
                    data: expensesData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.3
                },
                {
                    label: 'Bilans',
                    data: balanceData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatMoney(value)
                    }
                }
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════
// TAB: AI ASYSTENT (placeholder)
// ═══════════════════════════════════════════════════════════

// Funkcja renderBudgetAITab jest w budget-ai.js

// ═══════════════════════════════════════════════════════════
// TOGGLE INCOME DETAILS
// ═══════════════════════════════════════════════════════════

function toggleIncomeMonth(key) {
    const details = document.getElementById(`income-details-${key}`);
    if (details) {
        details.classList.toggle('hidden');
    }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function getMonthlyData(rok, miesiac) {
    const key = `${rok}-${miesiac}`;
    
    if (monthlyDataCache.has(key)) {
        return monthlyDataCache.get(key);
    }
    
    const expenses = allExpenses.filter(e => e.rok === rok && e.miesiac === miesiac);
    const income = allIncome.filter(i => i.rok === rok && i.miesiac === miesiac);
    
    // Wydatki per kategoria
    const expensesByCategory = {};
    let totalExpenses = 0;
    let totalFixed = 0;
    let totalVariable = 0;
    let totalTransfers = 0;
    
    expenses.forEach(e => {
        if (!expensesByCategory[e.kategoria]) {
            expensesByCategory[e.kategoria] = { total: 0, items: [] };
        }
        expensesByCategory[e.kategoria].total += e.kwotaPLN;
        expensesByCategory[e.kategoria].items.push(e);
        
        if (e.jestTransfer || BudgetCategories.isTransferCategory(e.kategoria, e.podkategoria)) {
            totalTransfers += e.kwotaPLN;
        } else {
            totalExpenses += e.kwotaPLN;
            if (e.jestStaly) {
                totalFixed += e.kwotaPLN;
            } else {
                totalVariable += e.kwotaPLN;
            }
        }
    });
    
    // Dochody per źródło
    const incomeBySource = {};
    let totalIncome = 0;
    
    income.forEach(i => {
        if (!incomeBySource[i.zrodlo]) {
            incomeBySource[i.zrodlo] = { total: 0, items: [] };
        }
        incomeBySource[i.zrodlo].total += i.kwotaPLN;
        incomeBySource[i.zrodlo].items.push(i);
        totalIncome += i.kwotaPLN;
    });
    
    const data = {
        rok,
        miesiac,
        income: {
            total: totalIncome,
            bySource: incomeBySource,
            items: income
        },
        expenses: {
            total: totalExpenses,
            fixed: totalFixed,
            variable: totalVariable,
            transfers: totalTransfers,
            byCategory: expensesByCategory,
            items: expenses
        },
        balance: totalIncome - totalExpenses,
        netBalance: totalIncome - totalExpenses - totalTransfers,
        savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0
    };
    
    monthlyDataCache.set(key, data);
    return data;
}

function getPreviousMonthData(rok, miesiac) {
    const prevMonth = miesiac === 1 ? 12 : miesiac - 1;
    const prevYear = miesiac === 1 ? rok - 1 : rok;
    return getMonthlyData(prevYear, prevMonth);
}

function getLast12MonthsData() {
    const now = new Date();
    const result = [];
    
    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const data = getMonthlyData(date.getFullYear(), date.getMonth() + 1);
        
        // Tylko miesiące z danymi
        if (data.income.total > 0 || data.expenses.total > 0) {
            result.push(data);
        }
    }
    
    return result.reverse();
}

function getDataCompleteness() {
    const result = [];
    const now = new Date();
    
    for (let i = 0; i < 24; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const rok = date.getFullYear();
        const miesiac = date.getMonth() + 1;
        
        const hasExpenses = allExpenses.some(e => e.rok === rok && e.miesiac === miesiac);
        const hasIncome = allIncome.some(i => i.rok === rok && i.miesiac === miesiac);
        
        result.push({
            rok,
            miesiac,
            hasExpenses,
            hasIncome,
            status: hasExpenses && hasIncome ? 'complete' : 
                    hasExpenses || hasIncome ? 'partial' : 'empty'
        });
    }
    
    return result;
}

function getInvestmentPlanFromCalculator() {
    // Próbuj pobrać plan inwestycji z localStorage lub z modułu inwestycji
    try {
        const savedPlan = localStorage.getItem('assetly_investment_plan');
        if (savedPlan) {
            const plan = JSON.parse(savedPlan);
            return plan.monthlyAmount || 0;
        }
    } catch (e) {}
    return 0;
}

function changeSelectedMonth(value) {
    const [rok, miesiac] = value.split('-').map(Number);
    selectedYear = rok;
    selectedMonth = miesiac;
    renderOverviewTab();
}

function showBudgetLoading(show) {
    const loader = document.getElementById('budgetLoader');
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

function formatMoney(amount) {
    return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Funkcje modali są w budget-modals.js


// Legacy export
if (typeof window !== 'undefined') {
    window.initBudgetModule = initBudgetModule;
}
