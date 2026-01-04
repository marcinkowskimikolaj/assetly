/**
 * Assetly - Budget Expenses
 * Tab: Wydatki
 */

let expensesViewYear = new Date().getFullYear();
let expandedExpenseMonths = new Set();
let selectedExpenseCategory = null;

function renderBudgetExpenses() {
    const container = document.getElementById('tab-expenses');
    if (!container) return;
    
    const miesiace = getMiesiaceZDanych().filter(m => m.rok === expensesViewYear);
    const kategorieStats = getKategorieStats(expensesViewYear);
    
    container.innerHTML = `
        <div class="expenses-container">
            
            <!-- Header z wyborem roku -->
            <div class="expenses-header">
                <div class="year-selector">
                    <button class="btn btn-icon" onclick="changeExpensesYear(-1)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
                    </button>
                    <span class="year-label">${expensesViewYear}</span>
                    <button class="btn btn-icon" onclick="changeExpensesYear(1)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,6 15,12 9,18"/></svg>
                    </button>
                </div>
                <button class="btn btn-primary" onclick="openAddMonthModal()">
                    ${BUDGET_ICONS['plus']} Dodaj wydatki
                </button>
            </div>
            
            <!-- Podsumowanie roku -->
            <div class="card expenses-year-summary">
                <div class="year-summary-stats">
                    <div class="year-stat">
                        <span class="year-stat-label">Suma wydatków ${expensesViewYear}</span>
                        <span class="year-stat-value">${formatMoney(kategorieStats.suma)}</span>
                    </div>
                    <div class="year-stat">
                        <span class="year-stat-label">Średnia miesięczna</span>
                        <span class="year-stat-value">${formatMoney(kategorieStats.srednia)}</span>
                    </div>
                    <div class="year-stat">
                        <span class="year-stat-label">Miesięcy z danymi</span>
                        <span class="year-stat-value">${miesiace.length}</span>
                    </div>
                </div>
            </div>
            
            <!-- Lista miesięcy -->
            <div class="expenses-months-list">
                ${miesiace.length > 0 ? miesiace.map(m => renderExpenseMonth(m.rok, m.miesiac)).join('') : `
                    <div class="no-data-card">
                        <p>Brak danych za ${expensesViewYear}.</p>
                        <button class="btn btn-primary" onclick="openAddMonthModal(${expensesViewYear}, 1)">
                            ${BUDGET_ICONS['plus']} Dodaj pierwszy miesiąc
                        </button>
                    </div>
                `}
            </div>
            
            <!-- Analiza kategorii -->
            ${kategorieStats.kategorie.length > 0 ? `
            <div class="card expenses-categories-analysis">
                <h3>Analiza kategorii w ${expensesViewYear}</h3>
                <div class="categories-chart">
                    ${renderCategoriesChart(kategorieStats)}
                </div>
                <div class="categories-list">
                    ${kategorieStats.kategorie.map(k => `
                        <div class="category-analysis-row" onclick="selectExpenseCategory('${k.kategoria}')">
                            <div class="category-color" style="background: ${getKategoriaColor(k.kategoria)}"></div>
                            <div class="category-info">
                                <span class="category-name">${k.kategoria}</span>
                                <span class="category-amount">${formatMoney(k.suma)}</span>
                            </div>
                            <div class="category-bar">
                                <div class="category-bar-fill" style="width: ${k.udzial}%; background: ${getKategoriaColor(k.kategoria)}"></div>
                            </div>
                            <span class="category-percent">${k.udzial.toFixed(1)}%</span>
                            <span class="category-avg">śr. ${formatMoney(k.sredniaMies)}/mies</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
        </div>
    `;
}

function renderExpenseMonth(rok, miesiac) {
    const p = getPodsumowanieMiesiaca(rok, miesiac);
    const isExpanded = expandedExpenseMonths.has(`${rok}-${miesiac}`);
    const plany = getPlanNaMiesiac(rok, miesiac);
    
    // Oblicz różnicę od planu
    const planTotal = plany.reduce((sum, pl) => sum + pl.limit, 0);
    const diffFromPlan = planTotal > 0 ? p.wydatki - planTotal : 0;
    const planStatus = planTotal > 0 ? (diffFromPlan <= 0 ? 'under' : 'over') : 'no-plan';
    
    return `
        <div class="expense-month-card card ${isExpanded ? 'expanded' : ''}">
            <div class="expense-month-header" onclick="toggleExpenseMonth(${rok}, ${miesiac})">
                <div class="expense-month-name">
                    <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
                    ${NAZWY_MIESIECY[miesiac]}
                </div>
                <div class="expense-month-amount">${formatMoney(p.wydatki)}</div>
                <div class="expense-month-bar">
                    <div class="expense-month-bar-fill" style="width: ${Math.min(100, (p.wydatki / (p.dochody || p.wydatki)) * 100)}%"></div>
                </div>
                ${planTotal > 0 ? `
                    <div class="expense-month-plan ${planStatus}">
                        vs plan: ${diffFromPlan >= 0 ? '+' : ''}${formatMoney(diffFromPlan)}
                        ${planStatus === 'under' ? '✓' : '⚠'}
                    </div>
                ` : ''}
                <div class="expense-month-actions">
                    <button class="btn btn-icon btn-sm" onclick="event.stopPropagation(); editExpenseMonth(${rok}, ${miesiac})" title="Edytuj">
                        ${BUDGET_ICONS['edit']}
                    </button>
                </div>
            </div>
            
            ${isExpanded ? `
                <div class="expense-month-details">
                    <div class="expense-categories-breakdown">
                        ${Object.entries(p.wydatkiPerKategoria)
                            .sort((a, b) => b[1].suma - a[1].suma)
                            .map(([kat, data]) => `
                                <div class="expense-category-row">
                                    <div class="expense-category-icon" style="color: ${getKategoriaColor(kat)}">
                                        ${getKategoriaIcon(kat)}
                                    </div>
                                    <span class="expense-category-name">${kat}</span>
                                    <span class="expense-category-amount">${formatMoney(data.suma)}</span>
                                    <span class="expense-category-percent">(${((data.suma / p.wydatki) * 100).toFixed(0)}%)</span>
                                </div>
                            `).join('')}
                    </div>
                    
                    <div class="expense-month-footer">
                        <span class="expense-count">${p.liczbaWydatkow} pozycji</span>
                        <button class="btn btn-link btn-sm" onclick="showExpenseDetails(${rok}, ${miesiac})">
                            Zobacz szczegóły →
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function renderCategoriesChart(stats) {
    if (stats.kategorie.length === 0) return '';
    
    // Prosty wykres słupkowy
    const maxValue = Math.max(...stats.kategorie.map(k => k.suma));
    
    return `
        <div class="horizontal-bar-chart">
            ${stats.kategorie.slice(0, 8).map(k => `
                <div class="bar-row">
                    <span class="bar-label">${k.kategoria}</span>
                    <div class="bar-container">
                        <div class="bar" style="width: ${(k.suma / maxValue) * 100}%; background: ${getKategoriaColor(k.kategoria)}"></div>
                    </div>
                    <span class="bar-value">${formatMoneyShort(k.suma)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function getKategorieStats(rok) {
    const wydatkiRoku = wydatki.filter(w => w.rok === rok && !w.jestTransfer);
    
    const perKategoria = {};
    let suma = 0;
    
    wydatkiRoku.forEach(w => {
        if (!perKategoria[w.kategoria]) {
            perKategoria[w.kategoria] = { suma: 0, count: 0, miesiace: new Set() };
        }
        perKategoria[w.kategoria].suma += w.kwotaPLN;
        perKategoria[w.kategoria].count++;
        perKategoria[w.kategoria].miesiace.add(w.miesiac);
        suma += w.kwotaPLN;
    });
    
    const miesiaceCount = new Set(wydatkiRoku.map(w => w.miesiac)).size;
    
    const kategorie = Object.entries(perKategoria)
        .map(([kategoria, data]) => ({
            kategoria,
            suma: data.suma,
            count: data.count,
            udzial: suma > 0 ? (data.suma / suma) * 100 : 0,
            sredniaMies: data.miesiace.size > 0 ? data.suma / data.miesiace.size : 0
        }))
        .sort((a, b) => b.suma - a.suma);
    
    return {
        suma,
        srednia: miesiaceCount > 0 ? suma / miesiaceCount : 0,
        kategorie
    };
}

function getPlanNaMiesiac(rok, miesiac) {
    return plany.filter(p => p.rok === rok && (p.miesiac === miesiac || p.miesiac === 0));
}

function toggleExpenseMonth(rok, miesiac) {
    const key = `${rok}-${miesiac}`;
    if (expandedExpenseMonths.has(key)) {
        expandedExpenseMonths.delete(key);
    } else {
        expandedExpenseMonths.add(key);
    }
    renderBudgetExpenses();
}

function changeExpensesYear(delta) {
    expensesViewYear += delta;
    expandedExpenseMonths.clear();
    renderBudgetExpenses();
}

function editExpenseMonth(rok, miesiac) {
    // TODO: Otwórz modal edycji miesiąca
    openAddMonthModal(rok, miesiac);
}

function showExpenseDetails(rok, miesiac) {
    const wydatkiMies = wydatki.filter(w => w.rok === rok && w.miesiac === miesiac);
    
    // Utwórz modal ze szczegółami
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'expenseDetailsModal';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h3>Szczegóły wydatków - ${formatMiesiac(rok, miesiac)}</h3>
                <button class="modal-close" onclick="closeExpenseDetailsModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Kategoria</th>
                            <th>Podkategoria</th>
                            <th>Kwota</th>
                            <th>Typ</th>
                            <th>Notatka</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${wydatkiMies.map(w => `
                            <tr>
                                <td>
                                    <span class="category-dot" style="background: ${getKategoriaColor(w.kategoria)}"></span>
                                    ${w.kategoria}
                                </td>
                                <td>${w.podkategoria || '-'}</td>
                                <td class="amount">${formatMoney(w.kwotaPLN)}</td>
                                <td>
                                    ${w.jestStaly ? '<span class="badge">Stały</span>' : ''}
                                    ${w.jestTransfer ? '<span class="badge transfer">Transfer</span>' : ''}
                                </td>
                                <td>${w.notatka || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>SUMA</strong></td>
                            <td class="amount"><strong>${formatMoney(wydatkiMies.reduce((s, w) => s + w.kwotaPLN, 0))}</strong></td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeExpenseDetailsModal()">Zamknij</button>
                <button class="btn btn-primary" onclick="editExpenseMonth(${rok}, ${miesiac}); closeExpenseDetailsModal();">
                    ${BUDGET_ICONS['edit']} Edytuj
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeExpenseDetailsModal() {
    document.getElementById('expenseDetailsModal')?.remove();
}

function selectExpenseCategory(kategoria) {
    selectedExpenseCategory = kategoria;
    showCategoryHistory(kategoria);
}

function showCategoryHistory(kategoria) {
    const wydatkiKat = wydatki.filter(w => w.kategoria === kategoria && !w.jestTransfer);
    
    // Grupuj po miesiącach
    const perMiesiac = {};
    wydatkiKat.forEach(w => {
        const key = `${w.rok}-${String(w.miesiac).padStart(2, '0')}`;
        if (!perMiesiac[key]) {
            perMiesiac[key] = { suma: 0, count: 0 };
        }
        perMiesiac[key].suma += w.kwotaPLN;
        perMiesiac[key].count++;
    });
    
    const historia = Object.entries(perMiesiac)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12);
    
    const srednia = historia.length > 0 ? 
        historia.reduce((s, [_, d]) => s + d.suma, 0) / historia.length : 0;
    
    // Trend
    let trend = 0;
    if (historia.length >= 3) {
        const ostatnie3 = historia.slice(0, 3).reduce((s, [_, d]) => s + d.suma, 0) / 3;
        const wczesniejsze3 = historia.slice(3, 6).reduce((s, [_, d]) => s + d.suma, 0) / Math.min(3, historia.length - 3);
        if (wczesniejsze3 > 0) {
            trend = ((ostatnie3 - wczesniejsze3) / wczesniejsze3) * 100;
        }
    }
    
    // Modal z historią
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'categoryHistoryModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 style="color: ${getKategoriaColor(kategoria)}">
                    ${getKategoriaIcon(kategoria)} ${kategoria} - historia
                </h3>
                <button class="modal-close" onclick="closeCategoryHistoryModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="category-history-stats">
                    <div class="stat">
                        <span class="stat-label">Średnia miesięczna</span>
                        <span class="stat-value">${formatMoney(srednia)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Trend</span>
                        <span class="stat-value ${trend >= 0 ? 'negative' : 'positive'}">
                            ${formatPercent(trend)}/mies
                        </span>
                    </div>
                </div>
                
                <div class="category-history-chart">
                    ${historia.map(([okres, data]) => {
                        const [rok, mies] = okres.split('-').map(Number);
                        const heightPercent = srednia > 0 ? Math.min(100, (data.suma / srednia) * 50) : 0;
                        return `
                            <div class="chart-bar">
                                <div class="bar-fill" style="height: ${heightPercent}%; background: ${getKategoriaColor(kategoria)}"></div>
                                <span class="bar-label">${NAZWY_MIESIECY_SHORT[mies]}</span>
                                <span class="bar-value">${formatMoneyShort(data.suma)}</span>
                            </div>
                        `;
                    }).reverse().join('')}
                </div>
                
                <div class="category-history-projection">
                    <span>Projekcja następny miesiąc:</span>
                    <strong>${formatMoney(srednia * (1 + trend/100))}</strong>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeCategoryHistoryModal()">Zamknij</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeCategoryHistoryModal() {
    document.getElementById('categoryHistoryModal')?.remove();
}
