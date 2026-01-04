/**
 * Assetly - Budget Modals
 * Modale do wprowadzania danych budżetowych
 */

// ═══════════════════════════════════════════════════════════
// STAN MODALU
// ═══════════════════════════════════════════════════════════

let editingMonth = null; // { rok, miesiac } gdy edytujemy istniejący
let monthFormData = {
    income: [],
    fixedExpenses: [],
    variableExpenses: [],
    transfers: []
};

// ═══════════════════════════════════════════════════════════
// MODAL: DODAJ/EDYTUJ MIESIĄC
// ═══════════════════════════════════════════════════════════

function showAddMonthModal(rok = null, miesiac = null) {
    editingMonth = (rok && miesiac) ? { rok, miesiac } : null;
    
    const modal = document.getElementById('addMonthModal');
    const content = document.getElementById('addMonthContent');
    
    // Domyślne wartości - poprzedni miesiąc
    const now = new Date();
    const defaultMonth = miesiac || (now.getMonth() === 0 ? 12 : now.getMonth());
    const defaultYear = rok || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
    
    // Resetuj dane formularza
    monthFormData = {
        income: [],
        fixedExpenses: [],
        variableExpenses: [],
        transfers: []
    };
    
    // Załaduj istniejące dane jeśli edytujemy
    if (editingMonth) {
        loadExistingMonthData(editingMonth.rok, editingMonth.miesiac);
    } else {
        // Załaduj szablony wydatków stałych
        loadRecurringTemplates(defaultMonth);
    }
    
    content.innerHTML = renderAddMonthContent(defaultYear, defaultMonth);
    modal.classList.add('active');
    
    // Inicjalizuj eventy
    initMonthFormEvents();
}

function closeAddMonthModal() {
    document.getElementById('addMonthModal').classList.remove('active');
    editingMonth = null;
}

function loadExistingMonthData(rok, miesiac) {
    // Załaduj dochody
    monthFormData.income = allIncome
        .filter(i => i.rok === rok && i.miesiac === miesiac)
        .map(i => ({
            id: i.id,
            zrodlo: i.zrodlo,
            pracodawca: i.pracodawca,
            kwotaNetto: i.kwotaNetto,
            waluta: i.waluta
        }));
    
    // Załaduj wydatki
    const expenses = allExpenses.filter(e => e.rok === rok && e.miesiac === miesiac);
    
    monthFormData.fixedExpenses = expenses
        .filter(e => e.jestStaly && !e.jestTransfer)
        .map(e => ({
            id: e.id,
            kategoria: e.kategoria,
            podkategoria: e.podkategoria,
            kwota: e.kwota,
            waluta: e.waluta,
            nazwa: findRecurringName(e.kategoria, e.podkategoria)
        }));
    
    monthFormData.variableExpenses = expenses
        .filter(e => !e.jestStaly && !e.jestTransfer)
        .map(e => ({
            id: e.id,
            kategoria: e.kategoria,
            podkategoria: e.podkategoria,
            kwota: e.kwota,
            waluta: e.waluta
        }));
    
    monthFormData.transfers = expenses
        .filter(e => e.jestTransfer)
        .map(e => ({
            id: e.id,
            kategoria: e.kategoria,
            podkategoria: e.podkategoria,
            kwota: e.kwota,
            waluta: e.waluta,
            nazwa: e.podkategoria || e.kategoria
        }));
}

function loadRecurringTemplates(miesiac) {
    // Wydatki stałe miesięczne
    const monthly = allRecurring.filter(r => r.czestotliwosc === 'monthly' && r.aktywny);
    monthFormData.fixedExpenses = monthly.map(r => ({
        recurringId: r.id,
        nazwa: r.nazwa,
        kategoria: r.kategoria,
        podkategoria: r.podkategoria,
        kwota: r.kwotaTypowa,
        waluta: r.waluta,
        isTemplate: true
    }));
    
    // Wydatki roczne dla tego miesiąca
    const yearly = allRecurring.filter(r => 
        r.czestotliwosc === 'yearly' && 
        r.aktywny && 
        r.miesiacPlatnosci === miesiac
    );
    yearly.forEach(r => {
        monthFormData.fixedExpenses.push({
            recurringId: r.id,
            nazwa: r.nazwa,
            kategoria: r.kategoria,
            podkategoria: r.podkategoria,
            kwota: r.kwotaTypowa,
            waluta: r.waluta,
            isTemplate: true,
            isYearly: true
        });
    });
    
    // Transfery stałe (np. przelew na firmę)
    const transfers = allRecurring.filter(r => 
        r.czestotliwosc === 'monthly' && 
        r.aktywny &&
        BudgetCategories.isTransferCategory(r.kategoria, r.podkategoria)
    );
    monthFormData.transfers = transfers.map(r => ({
        recurringId: r.id,
        nazwa: r.nazwa,
        kategoria: r.kategoria,
        podkategoria: r.podkategoria,
        kwota: r.kwotaTypowa,
        waluta: r.waluta,
        isTemplate: true
    }));
    
    // Usuń transfery z fixedExpenses (żeby nie duplikować)
    monthFormData.fixedExpenses = monthFormData.fixedExpenses.filter(e => 
        !BudgetCategories.isTransferCategory(e.kategoria, e.podkategoria)
    );
}

function findRecurringName(kategoria, podkategoria) {
    const recurring = allRecurring.find(r => 
        r.kategoria === kategoria && 
        r.podkategoria === podkategoria
    );
    return recurring?.nazwa || podkategoria || kategoria;
}

function renderAddMonthContent(year, month) {
    const monthOptions = BudgetCategories.MONTH_NAMES.map((name, i) => 
        `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${name}</option>`
    ).join('');
    
    const yearOptions = [year - 1, year, year + 1].map(y => 
        `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
    ).join('');
    
    // Pobierz dane z poprzedniego miesiąca dla podpowiedzi
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevData = getMonthlyData(prevYear, prevMonth);
    
    return `
        <div class="month-form">
            <!-- Nagłówek z wyborem miesiąca -->
            <div class="month-form-header">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Miesiąc</label>
                        <select id="monthSelect" class="form-select" onchange="onMonthChanged()">
                            ${monthOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Rok</label>
                        <select id="yearSelect" class="form-select">
                            ${yearOptions}
                        </select>
                    </div>
                </div>
                ${!editingMonth ? `
                    <button type="button" class="btn btn-ghost btn-sm" onclick="copyFromPreviousMonth()">
                        📋 Skopiuj z ${BudgetCategories.getMonthName(prevMonth)}
                    </button>
                ` : ''}
            </div>
            
            <!-- KROK 1: Dochody -->
            <div class="month-form-section">
                <div class="section-header">
                    <h4>1. Dochody</h4>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="addIncomeRow()">+ Dodaj</button>
                </div>
                <div id="incomeRows" class="form-rows">
                    ${renderIncomeRows()}
                </div>
                <div class="section-summary">
                    Suma dochodów: <strong id="totalIncome">${formatMoney(calculateTotalIncome())}</strong>
                </div>
            </div>
            
            <!-- KROK 2: Wydatki stałe -->
            <div class="month-form-section">
                <div class="section-header">
                    <h4>2. Wydatki stałe</h4>
                    <a href="#" class="link-sm" onclick="event.preventDefault(); closeAddMonthModal(); switchBudgetTab('plans');">Edytuj szablon →</a>
                </div>
                <div id="fixedExpenseRows" class="form-rows">
                    ${renderFixedExpenseRows()}
                </div>
                <div class="section-summary">
                    Suma stałych: <strong id="totalFixed">${formatMoney(calculateTotalFixed())}</strong>
                </div>
            </div>
            
            <!-- KROK 3: Wydatki zmienne -->
            <div class="month-form-section">
                <div class="section-header">
                    <h4>3. Wydatki zmienne</h4>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="addVariableExpenseRow()">+ Dodaj</button>
                </div>
                ${prevData.expenses.total > 0 ? `
                    <div class="section-hint">
                        💡 W ${BudgetCategories.getMonthName(prevMonth)}: 
                        ${Object.entries(prevData.expenses.byCategory)
                            .filter(([cat]) => !BudgetCategories.isFixedCategory(cat))
                            .slice(0, 3)
                            .map(([cat, data]) => `${cat}: ${formatMoney(data.total)}`)
                            .join(', ')}
                    </div>
                ` : ''}
                <div id="variableExpenseRows" class="form-rows">
                    ${renderVariableExpenseRows()}
                </div>
                <div class="section-summary">
                    Suma zmiennych: <strong id="totalVariable">${formatMoney(calculateTotalVariable())}</strong>
                </div>
            </div>
            
            <!-- KROK 4: Transfery -->
            <div class="month-form-section">
                <div class="section-header">
                    <h4>4. Transfery (opcjonalne)</h4>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="addTransferRow()">+ Dodaj</button>
                </div>
                <p class="section-note">Transfery to przesunięcia środków (np. na firmę), nie są liczone jako wydatki konsumpcyjne.</p>
                <div id="transferRows" class="form-rows">
                    ${renderTransferRows()}
                </div>
                <div class="section-summary">
                    Suma transferów: <strong id="totalTransfers">${formatMoney(calculateTotalTransfers())}</strong>
                </div>
            </div>
            
            <!-- Podsumowanie -->
            <div class="month-form-summary">
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="summary-label">Dochody:</span>
                        <span class="summary-value" id="summaryIncome">${formatMoney(calculateTotalIncome())}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Wydatki stałe:</span>
                        <span class="summary-value" id="summaryFixed">${formatMoney(calculateTotalFixed())}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Wydatki zmienne:</span>
                        <span class="summary-value" id="summaryVariable">${formatMoney(calculateTotalVariable())}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Transfery:</span>
                        <span class="summary-value" id="summaryTransfers">${formatMoney(calculateTotalTransfers())}</span>
                    </div>
                    <div class="summary-divider"></div>
                    <div class="summary-item summary-balance">
                        <span class="summary-label">BILANS:</span>
                        <span class="summary-value" id="summaryBalance">${formatMoney(calculateBalance())}</span>
                    </div>
                    ${getInvestmentPlanFromCalculator() > 0 ? `
                        <div class="summary-item summary-small">
                            <span class="summary-label">Plan inwestycji:</span>
                            <span class="summary-value">${formatMoney(getInvestmentPlanFromCalculator())}</span>
                        </div>
                        <div class="summary-item summary-small">
                            <span class="summary-label">Pozostaje:</span>
                            <span class="summary-value" id="summaryRemaining">${formatMoney(calculateBalance() - getInvestmentPlanFromCalculator())}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Przyciski -->
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeAddMonthModal()">Anuluj</button>
                <button type="button" class="btn btn-primary" onclick="saveMonthData()">
                    ${editingMonth ? 'Zapisz zmiany' : 'Zapisz miesiąc'}
                </button>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// RENDEROWANIE WIERSZY
// ═══════════════════════════════════════════════════════════

function renderIncomeRows() {
    if (monthFormData.income.length === 0) {
        // Dodaj domyślny wiersz
        monthFormData.income.push({
            zrodlo: 'Wynagrodzenie',
            pracodawca: '',
            kwotaNetto: '',
            waluta: 'PLN'
        });
    }
    
    return monthFormData.income.map((inc, i) => `
        <div class="form-row-item" data-index="${i}">
            <select class="form-select form-select-sm" onchange="updateIncomeField(${i}, 'zrodlo', this.value)">
                ${Object.keys(BudgetCategories.INCOME_SOURCES).map(src => 
                    `<option value="${src}" ${inc.zrodlo === src ? 'selected' : ''}>${src}</option>`
                ).join('')}
            </select>
            <input type="text" class="form-input form-input-sm" placeholder="Pracodawca/opis" 
                value="${inc.pracodawca || ''}"
                onchange="updateIncomeField(${i}, 'pracodawca', this.value)">
            <input type="number" class="form-input form-input-sm input-amount" placeholder="Kwota netto"
                value="${inc.kwotaNetto || ''}"
                onchange="updateIncomeField(${i}, 'kwotaNetto', parseFloat(this.value) || 0)">
            <select class="form-select form-select-sm select-currency" onchange="updateIncomeField(${i}, 'waluta', this.value)">
                ${['PLN', 'EUR', 'USD', 'GBP'].map(c => 
                    `<option value="${c}" ${inc.waluta === c ? 'selected' : ''}>${c}</option>`
                ).join('')}
            </select>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="removeIncomeRow(${i})">×</button>
        </div>
    `).join('');
}

function renderFixedExpenseRows() {
    if (monthFormData.fixedExpenses.length === 0) {
        return '<p class="no-data">Brak szablonów wydatków stałych. <a href="#" onclick="event.preventDefault(); closeAddMonthModal(); showAddRecurringModal();">Dodaj →</a></p>';
    }
    
    return monthFormData.fixedExpenses.map((exp, i) => `
        <div class="form-row-item ${exp.isTemplate ? 'template-row' : ''} ${exp.skipped ? 'skipped' : ''}" data-index="${i}">
            <span class="fixed-name">${exp.nazwa || exp.podkategoria || exp.kategoria}</span>
            <span class="fixed-category">${exp.kategoria}</span>
            <input type="number" class="form-input form-input-sm input-amount" 
                placeholder="${exp.isTemplate ? exp.kwota : 'Kwota'}"
                value="${exp.skipped ? '' : (exp.kwota || '')}"
                ${exp.skipped ? 'disabled' : ''}
                onchange="updateFixedExpenseField(${i}, 'kwota', parseFloat(this.value) || 0)">
            <span class="fixed-currency">${exp.waluta}</span>
            ${exp.isTemplate ? `
                <button type="button" class="btn btn-ghost btn-icon btn-sm" 
                    onclick="toggleSkipFixedExpense(${i})" 
                    title="${exp.skipped ? 'Przywróć' : 'Pomiń ten miesiąc'}">
                    ${exp.skipped ? '↩' : '⊘'}
                </button>
            ` : `
                <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="removeFixedExpenseRow(${i})">×</button>
            `}
        </div>
    `).join('');
}

function renderVariableExpenseRows() {
    if (monthFormData.variableExpenses.length === 0) {
        // Dodaj domyślny wiersz
        monthFormData.variableExpenses.push({
            kategoria: 'Codzienne wydatki',
            podkategoria: 'Żywność i chemia domowa',
            kwota: '',
            waluta: 'PLN'
        });
    }
    
    return monthFormData.variableExpenses.map((exp, i) => `
        <div class="form-row-item" data-index="${i}">
            <select class="form-select form-select-sm" onchange="updateVariableExpenseCategory(${i}, this.value)">
                ${BudgetCategories.getAllCategories().map(cat => 
                    `<option value="${cat}" ${exp.kategoria === cat ? 'selected' : ''}>${BudgetCategories.getCategoryIcon(cat)} ${cat}</option>`
                ).join('')}
            </select>
            <select class="form-select form-select-sm" id="varSubcat${i}" onchange="updateVariableExpenseField(${i}, 'podkategoria', this.value)">
                ${renderSubcategoryOptions(exp.kategoria, exp.podkategoria)}
            </select>
            <input type="number" class="form-input form-input-sm input-amount" placeholder="Kwota"
                value="${exp.kwota || ''}"
                onchange="updateVariableExpenseField(${i}, 'kwota', parseFloat(this.value) || 0)">
            <select class="form-select form-select-sm select-currency" onchange="updateVariableExpenseField(${i}, 'waluta', this.value)">
                ${['PLN', 'EUR', 'USD', 'GBP'].map(c => 
                    `<option value="${c}" ${exp.waluta === c ? 'selected' : ''}>${c}</option>`
                ).join('')}
            </select>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="removeVariableExpenseRow(${i})">×</button>
        </div>
    `).join('');
}

function renderTransferRows() {
    if (monthFormData.transfers.length === 0) {
        return '<p class="no-data-small">Brak transferów</p>';
    }
    
    return monthFormData.transfers.map((tr, i) => `
        <div class="form-row-item ${tr.isTemplate ? 'template-row' : ''}" data-index="${i}">
            <input type="text" class="form-input form-input-sm" placeholder="Nazwa"
                value="${tr.nazwa || ''}"
                onchange="updateTransferField(${i}, 'nazwa', this.value)">
            <input type="number" class="form-input form-input-sm input-amount" placeholder="Kwota"
                value="${tr.kwota || ''}"
                onchange="updateTransferField(${i}, 'kwota', parseFloat(this.value) || 0)">
            <span class="fixed-currency">${tr.waluta || 'PLN'}</span>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="removeTransferRow(${i})">×</button>
        </div>
    `).join('');
}

function renderSubcategoryOptions(category, selected) {
    const subs = BudgetCategories.getSubcategories(category);
    if (subs.length === 0) {
        return '<option value="">(brak podkategorii)</option>';
    }
    return `
        <option value="">-- wybierz --</option>
        ${subs.map(sub => `<option value="${sub}" ${sub === selected ? 'selected' : ''}>${sub}</option>`).join('')}
    `;
}

// ═══════════════════════════════════════════════════════════
// AKTUALIZACJE PÓL
// ═══════════════════════════════════════════════════════════

function updateIncomeField(index, field, value) {
    monthFormData.income[index][field] = value;
    updateSummary();
}

function updateFixedExpenseField(index, field, value) {
    monthFormData.fixedExpenses[index][field] = value;
    if (field === 'kwota' && value > 0) {
        monthFormData.fixedExpenses[index].skipped = false;
    }
    updateSummary();
}

function updateVariableExpenseField(index, field, value) {
    monthFormData.variableExpenses[index][field] = value;
    updateSummary();
}

function updateVariableExpenseCategory(index, category) {
    monthFormData.variableExpenses[index].kategoria = category;
    monthFormData.variableExpenses[index].podkategoria = '';
    
    // Aktualizuj opcje podkategorii
    const subcatSelect = document.getElementById(`varSubcat${index}`);
    if (subcatSelect) {
        subcatSelect.innerHTML = renderSubcategoryOptions(category, '');
    }
    updateSummary();
}

function updateTransferField(index, field, value) {
    monthFormData.transfers[index][field] = value;
    updateSummary();
}

// ═══════════════════════════════════════════════════════════
// DODAWANIE/USUWANIE WIERSZY
// ═══════════════════════════════════════════════════════════

function addIncomeRow() {
    monthFormData.income.push({
        zrodlo: 'Wynagrodzenie',
        pracodawca: '',
        kwotaNetto: '',
        waluta: 'PLN'
    });
    document.getElementById('incomeRows').innerHTML = renderIncomeRows();
    updateSummary();
}

function removeIncomeRow(index) {
    monthFormData.income.splice(index, 1);
    document.getElementById('incomeRows').innerHTML = renderIncomeRows();
    updateSummary();
}

function addVariableExpenseRow() {
    monthFormData.variableExpenses.push({
        kategoria: 'Codzienne wydatki',
        podkategoria: '',
        kwota: '',
        waluta: 'PLN'
    });
    document.getElementById('variableExpenseRows').innerHTML = renderVariableExpenseRows();
    updateSummary();
}

function removeVariableExpenseRow(index) {
    monthFormData.variableExpenses.splice(index, 1);
    if (monthFormData.variableExpenses.length === 0) {
        monthFormData.variableExpenses.push({
            kategoria: 'Codzienne wydatki',
            podkategoria: '',
            kwota: '',
            waluta: 'PLN'
        });
    }
    document.getElementById('variableExpenseRows').innerHTML = renderVariableExpenseRows();
    updateSummary();
}

function removeFixedExpenseRow(index) {
    monthFormData.fixedExpenses.splice(index, 1);
    document.getElementById('fixedExpenseRows').innerHTML = renderFixedExpenseRows();
    updateSummary();
}

function toggleSkipFixedExpense(index) {
    monthFormData.fixedExpenses[index].skipped = !monthFormData.fixedExpenses[index].skipped;
    if (monthFormData.fixedExpenses[index].skipped) {
        monthFormData.fixedExpenses[index].kwota = 0;
    }
    document.getElementById('fixedExpenseRows').innerHTML = renderFixedExpenseRows();
    updateSummary();
}

function addTransferRow() {
    monthFormData.transfers.push({
        nazwa: '',
        kategoria: 'Firmowe',
        podkategoria: 'Przelew na rach. firmowy',
        kwota: '',
        waluta: 'PLN'
    });
    document.getElementById('transferRows').innerHTML = renderTransferRows();
    updateSummary();
}

function removeTransferRow(index) {
    monthFormData.transfers.splice(index, 1);
    document.getElementById('transferRows').innerHTML = renderTransferRows();
    updateSummary();
}

// ═══════════════════════════════════════════════════════════
// OBLICZENIA
// ═══════════════════════════════════════════════════════════

function calculateTotalIncome() {
    return monthFormData.income.reduce((sum, inc) => {
        const amount = parseFloat(inc.kwotaNetto) || 0;
        const rate = inc.waluta === 'PLN' ? 1 : (currencyRates[inc.waluta] || 1);
        return sum + (amount * rate);
    }, 0);
}

function calculateTotalFixed() {
    return monthFormData.fixedExpenses
        .filter(exp => !exp.skipped)
        .reduce((sum, exp) => {
            const amount = parseFloat(exp.kwota) || 0;
            const rate = exp.waluta === 'PLN' ? 1 : (currencyRates[exp.waluta] || 1);
            return sum + (amount * rate);
        }, 0);
}

function calculateTotalVariable() {
    return monthFormData.variableExpenses.reduce((sum, exp) => {
        const amount = parseFloat(exp.kwota) || 0;
        const rate = exp.waluta === 'PLN' ? 1 : (currencyRates[exp.waluta] || 1);
        return sum + (amount * rate);
    }, 0);
}

function calculateTotalTransfers() {
    return monthFormData.transfers.reduce((sum, tr) => {
        const amount = parseFloat(tr.kwota) || 0;
        const rate = tr.waluta === 'PLN' ? 1 : (currencyRates[tr.waluta] || 1);
        return sum + (amount * rate);
    }, 0);
}

function calculateBalance() {
    return calculateTotalIncome() - calculateTotalFixed() - calculateTotalVariable();
}

function updateSummary() {
    const totalIncome = calculateTotalIncome();
    const totalFixed = calculateTotalFixed();
    const totalVariable = calculateTotalVariable();
    const totalTransfers = calculateTotalTransfers();
    const balance = totalIncome - totalFixed - totalVariable;
    const investmentPlan = getInvestmentPlanFromCalculator();
    
    // Aktualizuj sekcje
    const el = (id) => document.getElementById(id);
    
    if (el('totalIncome')) el('totalIncome').textContent = formatMoney(totalIncome);
    if (el('totalFixed')) el('totalFixed').textContent = formatMoney(totalFixed);
    if (el('totalVariable')) el('totalVariable').textContent = formatMoney(totalVariable);
    if (el('totalTransfers')) el('totalTransfers').textContent = formatMoney(totalTransfers);
    
    // Aktualizuj podsumowanie
    if (el('summaryIncome')) el('summaryIncome').textContent = formatMoney(totalIncome);
    if (el('summaryFixed')) el('summaryFixed').textContent = formatMoney(totalFixed);
    if (el('summaryVariable')) el('summaryVariable').textContent = formatMoney(totalVariable);
    if (el('summaryTransfers')) el('summaryTransfers').textContent = formatMoney(totalTransfers);
    
    const balanceEl = el('summaryBalance');
    if (balanceEl) {
        balanceEl.textContent = formatMoney(balance);
        balanceEl.className = `summary-value ${balance >= 0 ? 'positive' : 'negative'}`;
    }
    
    const remainingEl = el('summaryRemaining');
    if (remainingEl) {
        const remaining = balance - investmentPlan;
        remainingEl.textContent = formatMoney(remaining);
        remainingEl.className = `summary-value ${remaining >= 0 ? 'positive' : 'negative'}`;
    }
}

// ═══════════════════════════════════════════════════════════
// KOPIOWANIE Z POPRZEDNIEGO MIESIĄCA
// ═══════════════════════════════════════════════════════════

function copyFromPreviousMonth() {
    const year = parseInt(document.getElementById('yearSelect').value);
    const month = parseInt(document.getElementById('monthSelect').value);
    
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    
    const prevData = getMonthlyData(prevYear, prevMonth);
    
    if (prevData.income.total === 0 && prevData.expenses.total === 0) {
        showToast(`Brak danych za ${BudgetCategories.formatPeriod(prevYear, prevMonth)}`, 'warning');
        return;
    }
    
    // Kopiuj dochody
    monthFormData.income = prevData.income.items.map(i => ({
        zrodlo: i.zrodlo,
        pracodawca: i.pracodawca,
        kwotaNetto: i.kwotaNetto,
        waluta: i.waluta
    }));
    
    // Kopiuj wydatki zmienne (tylko strukturę, bez kwot)
    monthFormData.variableExpenses = prevData.expenses.items
        .filter(e => !e.jestStaly && !e.jestTransfer)
        .map(e => ({
            kategoria: e.kategoria,
            podkategoria: e.podkategoria,
            kwota: '', // Puste - do uzupełnienia
            waluta: e.waluta
        }));
    
    if (monthFormData.variableExpenses.length === 0) {
        monthFormData.variableExpenses.push({
            kategoria: 'Codzienne wydatki',
            podkategoria: 'Żywność i chemia domowa',
            kwota: '',
            waluta: 'PLN'
        });
    }
    
    // Odśwież
    document.getElementById('incomeRows').innerHTML = renderIncomeRows();
    document.getElementById('variableExpenseRows').innerHTML = renderVariableExpenseRows();
    updateSummary();
    
    showToast(`Skopiowano strukturę z ${BudgetCategories.formatPeriod(prevYear, prevMonth)}`, 'success');
}

function onMonthChanged() {
    const month = parseInt(document.getElementById('monthSelect').value);
    
    // Przeładuj szablony dla nowego miesiąca (wydatki roczne mogą się zmienić)
    if (!editingMonth) {
        loadRecurringTemplates(month);
        document.getElementById('fixedExpenseRows').innerHTML = renderFixedExpenseRows();
        document.getElementById('transferRows').innerHTML = renderTransferRows();
        updateSummary();
    }
}

// ═══════════════════════════════════════════════════════════
// ZAPIS DANYCH
// ═══════════════════════════════════════════════════════════

async function saveMonthData() {
    const year = parseInt(document.getElementById('yearSelect').value);
    const month = parseInt(document.getElementById('monthSelect').value);
    
    // Walidacja
    const totalIncome = calculateTotalIncome();
    const totalExpenses = calculateTotalFixed() + calculateTotalVariable();
    
    if (totalIncome === 0 && totalExpenses === 0) {
        showToast('Wprowadź przynajmniej jeden dochód lub wydatek', 'warning');
        return;
    }
    
    showBudgetLoading(true);
    
    try {
        // Jeśli edytujemy, usuń stare dane
        if (editingMonth) {
            await BudgetSheets.deleteExpensesByMonth(editingMonth.rok, editingMonth.miesiac);
            // Usuń też dochody
            const oldIncome = await BudgetSheets.getIncomeByMonth(editingMonth.rok, editingMonth.miesiac);
            for (const inc of oldIncome) {
                await BudgetSheets.deleteIncome(inc.id);
            }
        }
        
        // Zapisz dochody
        const incomeToSave = monthFormData.income
            .filter(inc => inc.kwotaNetto > 0)
            .map(inc => ({
                rok: year,
                miesiac: month,
                zrodlo: inc.zrodlo,
                pracodawca: inc.pracodawca || '',
                kwotaBrutto: 0,
                kwotaNetto: inc.kwotaNetto,
                waluta: inc.waluta
            }));
        
        if (incomeToSave.length > 0) {
            await BudgetSheets.addIncomeBulk(incomeToSave);
        }
        
        // Zapisz wydatki stałe
        const fixedToSave = monthFormData.fixedExpenses
            .filter(exp => !exp.skipped && exp.kwota > 0)
            .map(exp => ({
                rok: year,
                miesiac: month,
                kategoria: exp.kategoria,
                podkategoria: exp.podkategoria || '',
                kwota: exp.kwota,
                waluta: exp.waluta,
                jestStaly: true,
                jestTransfer: false
            }));
        
        // Zapisz wydatki zmienne
        const variableToSave = monthFormData.variableExpenses
            .filter(exp => exp.kwota > 0)
            .map(exp => ({
                rok: year,
                miesiac: month,
                kategoria: exp.kategoria,
                podkategoria: exp.podkategoria || '',
                kwota: exp.kwota,
                waluta: exp.waluta,
                jestStaly: false,
                jestTransfer: BudgetCategories.isTransferCategory(exp.kategoria, exp.podkategoria)
            }));
        
        // Zapisz transfery
        const transfersToSave = monthFormData.transfers
            .filter(tr => tr.kwota > 0)
            .map(tr => ({
                rok: year,
                miesiac: month,
                kategoria: tr.kategoria || 'Firmowe',
                podkategoria: tr.podkategoria || tr.nazwa || 'Przelew',
                kwota: tr.kwota,
                waluta: tr.waluta || 'PLN',
                jestStaly: false,
                jestTransfer: true
            }));
        
        const allExpensesToSave = [...fixedToSave, ...variableToSave, ...transfersToSave];
        if (allExpensesToSave.length > 0) {
            await BudgetSheets.addExpensesBulk(allExpensesToSave);
        }
        
        // Przeładuj dane
        await loadBudgetData();
        
        // Ustaw wybrany miesiąc
        selectedYear = year;
        selectedMonth = month;
        
        // Zamknij modal i odśwież
        closeAddMonthModal();
        switchBudgetTab(currentBudgetTab);
        
        showToast(`Zapisano dane za ${BudgetCategories.formatPeriod(year, month)}`, 'success');
        
    } catch (error) {
        console.error('Błąd zapisu:', error);
        showToast('Błąd zapisu danych', 'error');
    } finally {
        showBudgetLoading(false);
    }
}

// ═══════════════════════════════════════════════════════════
// EDYCJA/USUWANIE MIESIĄCA
// ═══════════════════════════════════════════════════════════

function editMonth(rok, miesiac) {
    showAddMonthModal(rok, miesiac);
}

async function deleteMonth(rok, miesiac) {
    if (!confirm(`Czy na pewno chcesz usunąć wszystkie dane za ${BudgetCategories.formatPeriod(rok, miesiac)}?`)) {
        return;
    }
    
    showBudgetLoading(true);
    
    try {
        // Usuń wydatki
        await BudgetSheets.deleteExpensesByMonth(rok, miesiac);
        
        // Usuń dochody
        const incomes = await BudgetSheets.getIncomeByMonth(rok, miesiac);
        for (const inc of incomes) {
            await BudgetSheets.deleteIncome(inc.id);
        }
        
        // Przeładuj dane
        await loadBudgetData();
        switchBudgetTab(currentBudgetTab);
        
        showToast(`Usunięto dane za ${BudgetCategories.formatPeriod(rok, miesiac)}`, 'success');
        
    } catch (error) {
        console.error('Błąd usuwania:', error);
        showToast('Błąd usuwania danych', 'error');
    } finally {
        showBudgetLoading(false);
    }
}

// ═══════════════════════════════════════════════════════════
// MODAL: WYDATKI STAŁE (SZABLONY)
// ═══════════════════════════════════════════════════════════

function showAddRecurringModal() {
    const modal = document.getElementById('addRecurringModal');
    
    // Wypełnij opcje kategorii
    const categorySelect = document.getElementById('recurringCategory');
    categorySelect.innerHTML = `
        <option value="">-- wybierz --</option>
        ${BudgetCategories.getAllCategories().map(cat => 
            `<option value="${cat}">${BudgetCategories.getCategoryIcon(cat)} ${cat}</option>`
        ).join('')}
    `;
    
    // Reset formularza
    document.getElementById('recurringName').value = '';
    document.getElementById('recurringAmount').value = '';
    document.getElementById('recurringFrequency').value = 'monthly';
    document.getElementById('recurringMonth').value = '0';
    document.getElementById('recurringNote').value = '';
    document.getElementById('recurringMonthGroup').style.display = 'none';
    
    updateRecurringSubcategories();
    
    modal.classList.add('active');
}

function closeAddRecurringModal() {
    document.getElementById('addRecurringModal').classList.remove('active');
}

function updateRecurringSubcategories() {
    const category = document.getElementById('recurringCategory').value;
    const subcatSelect = document.getElementById('recurringSubcategory');
    
    subcatSelect.innerHTML = renderSubcategoryOptions(category, '');
}

function toggleRecurringMonth() {
    const frequency = document.getElementById('recurringFrequency').value;
    document.getElementById('recurringMonthGroup').style.display = 
        frequency === 'yearly' ? 'block' : 'none';
}

async function handleAddRecurring(event) {
    event.preventDefault();
    
    const data = {
        nazwa: document.getElementById('recurringName').value.trim(),
        kategoria: document.getElementById('recurringCategory').value,
        podkategoria: document.getElementById('recurringSubcategory').value,
        kwotaTypowa: parseFloat(document.getElementById('recurringAmount').value) || 0,
        waluta: 'PLN',
        czestotliwosc: document.getElementById('recurringFrequency').value,
        miesiacPlatnosci: parseInt(document.getElementById('recurringMonth').value) || 0,
        aktywny: true,
        notatka: document.getElementById('recurringNote').value.trim()
    };
    
    if (!data.nazwa || !data.kategoria || data.kwotaTypowa <= 0) {
        showToast('Wypełnij wymagane pola', 'warning');
        return;
    }
    
    showBudgetLoading(true);
    
    try {
        await BudgetSheets.addRecurringExpense(data);
        await loadBudgetData();
        
        closeAddRecurringModal();
        switchBudgetTab('plans');
        
        showToast('Dodano wydatek stały', 'success');
        
    } catch (error) {
        console.error('Błąd dodawania:', error);
        showToast('Błąd dodawania wydatku stałego', 'error');
    } finally {
        showBudgetLoading(false);
    }
}

async function deleteRecurring(id) {
    if (!confirm('Czy na pewno chcesz usunąć ten wydatek stały?')) {
        return;
    }
    
    showBudgetLoading(true);
    
    try {
        await BudgetSheets.deleteRecurringExpense(id);
        await loadBudgetData();
        switchBudgetTab('plans');
        
        showToast('Usunięto wydatek stały', 'success');
        
    } catch (error) {
        console.error('Błąd usuwania:', error);
        showToast('Błąd usuwania', 'error');
    } finally {
        showBudgetLoading(false);
    }
}

// ═══════════════════════════════════════════════════════════
// INICJALIZACJA
// ═══════════════════════════════════════════════════════════

function initMonthFormEvents() {
    // Obsługa klawiatury Enter w inputach
    document.querySelectorAll('#addMonthContent input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Przejdź do następnego inputa
                const inputs = Array.from(document.querySelectorAll('#addMonthContent input:not([disabled])'));
                const index = inputs.indexOf(e.target);
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            }
        });
    });
}
