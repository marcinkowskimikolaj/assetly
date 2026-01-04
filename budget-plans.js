/**
 * Assetly - Budget Plans
 * Tab: Plany budżetowe
 */

let plansViewYear = new Date().getFullYear();
let plansViewMonth = new Date().getMonth() + 1;

function renderBudgetPlans() {
    const container = document.getElementById('tab-plans');
    if (!container) return;
    
    const srednie = getSrednieMiesieczne(6);
    const planMies = getPlanNaMiesiac(plansViewYear, plansViewMonth);
    const p = getPodsumowanieMiesiaca(plansViewYear, plansViewMonth);
    
    // Oblicz podział 50/30/20
    const rule503020 = calculate503020(srednie.dochody);
    
    container.innerHTML = `
        <div class="plans-container">
            
            <!-- Header -->
            <div class="plans-header">
                <div class="month-selector">
                    <button class="btn btn-icon" onclick="changePlansMonth(-1)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
                    </button>
                    <span class="month-label">${formatMiesiac(plansViewYear, plansViewMonth)}</span>
                    <button class="btn btn-icon" onclick="changePlansMonth(1)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,6 15,12 9,18"/></svg>
                    </button>
                </div>
                <button class="btn btn-primary" onclick="openCreatePlanModal()">
                    ${BUDGET_ICONS['plus']} Stwórz plan
                </button>
            </div>
            
            <!-- Metodyka 50/30/20 -->
            <div class="card plans-rule-card">
                <h3>Metodyka 50/30/20</h3>
                <p class="rule-description">Rekomendowany podział dochodów: 50% na potrzeby, 30% na zachcianki, 20% na oszczędności</p>
                
                <div class="rule-based-on">
                    Bazując na średnim dochodzie: <strong>${formatMoney(srednie.dochody)}</strong>/mies
                </div>
                
                <div class="rule-breakdown">
                    <div class="rule-category needs">
                        <div class="rule-header">
                            <span class="rule-percent">50%</span>
                            <span class="rule-name">Potrzeby (must)</span>
                        </div>
                        <div class="rule-amount">${formatMoney(rule503020.needs)}</div>
                        <div class="rule-examples">Czynsz, rachunki, jedzenie, transport</div>
                    </div>
                    
                    <div class="rule-category wants">
                        <div class="rule-header">
                            <span class="rule-percent">30%</span>
                            <span class="rule-name">Zachcianki (should)</span>
                        </div>
                        <div class="rule-amount">${formatMoney(rule503020.wants)}</div>
                        <div class="rule-examples">Rozrywka, hobby, restauracje</div>
                    </div>
                    
                    <div class="rule-category savings">
                        <div class="rule-header">
                            <span class="rule-percent">20%</span>
                            <span class="rule-name">Oszczędności (nice)</span>
                        </div>
                        <div class="rule-amount">${formatMoney(rule503020.savings)}</div>
                        <div class="rule-examples">Inwestycje, fundusz awaryjny</div>
                    </div>
                </div>
                
                <button class="btn btn-secondary" onclick="applyRule503020()">
                    Zastosuj do planu →
                </button>
            </div>
            
            <!-- Integracja z planem inwestycji -->
            ${planInwestycyjny ? `
            <div class="card plans-investment-card">
                <h3>${BUDGET_ICONS['trending-up']} Plan inwestycji (z kalkulatora)</h3>
                <div class="investment-plan-info">
                    <div class="investment-stat">
                        <span class="stat-label">Wynagrodzenie bazowe</span>
                        <span class="stat-value">${formatMoney(planInwestycyjny.wynagrodzenie)}</span>
                    </div>
                    <div class="investment-stat">
                        <span class="stat-label">Stopa inwestycji</span>
                        <span class="stat-value">${planInwestycyjny.stopaProcentowa}%</span>
                    </div>
                    <div class="investment-stat highlight">
                        <span class="stat-label">Do inwestycji miesięcznie</span>
                        <span class="stat-value">${formatMoney(planInwestycyjny.kwotaMiesieczna)}</span>
                    </div>
                </div>
            </div>
            ` : `
            <div class="card plans-investment-card empty">
                <h3>${BUDGET_ICONS['trending-up']} Plan inwestycji</h3>
                <p>Nie skonfigurowano planu inwestycji w kalkulatorze.</p>
                <a href="investments.html" class="btn btn-secondary">Przejdź do kalkulatora →</a>
            </div>
            `}
            
            <!-- Aktualny plan na miesiąc -->
            <div class="card plans-current-card">
                <h3>Plan na ${formatMiesiac(plansViewYear, plansViewMonth)}</h3>
                
                ${planMies.length > 0 ? `
                    <div class="plan-list">
                        ${renderPlanList(planMies, p)}
                    </div>
                    
                    <div class="plan-summary">
                        <div class="plan-summary-row">
                            <span>Suma limitów:</span>
                            <span>${formatMoney(planMies.reduce((s, pl) => s + pl.limit, 0))}</span>
                        </div>
                        <div class="plan-summary-row">
                            <span>Faktyczne wydatki:</span>
                            <span>${formatMoney(p.wydatki)}</span>
                        </div>
                        <div class="plan-summary-row ${p.wydatki <= planMies.reduce((s, pl) => s + pl.limit, 0) ? 'positive' : 'negative'}">
                            <span>Różnica:</span>
                            <span>${formatMoney(planMies.reduce((s, pl) => s + pl.limit, 0) - p.wydatki)}</span>
                        </div>
                    </div>
                ` : `
                    <div class="no-plan-message">
                        <p>Nie utworzono jeszcze planu na ten miesiąc.</p>
                        <button class="btn btn-primary" onclick="openCreatePlanModal()">
                            ${BUDGET_ICONS['plus']} Utwórz plan
                        </button>
                    </div>
                `}
            </div>
            
            <!-- Analiza historyczna -->
            <div class="card plans-history-card">
                <h3>Średnie wydatki per kategoria (6 mies.)</h3>
                <p class="text-muted">Użyj tych danych jako punktu wyjścia do planowania</p>
                
                <div class="category-averages">
                    ${renderCategoryAverages()}
                </div>
            </div>
            
        </div>
    `;
}

function calculate503020(dochod) {
    return {
        needs: dochod * 0.5,
        wants: dochod * 0.3,
        savings: dochod * 0.2
    };
}

function renderPlanList(planMies, p) {
    const perPriorytet = {
        must: planMies.filter(pl => pl.priorytet === 'must'),
        should: planMies.filter(pl => pl.priorytet === 'should'),
        nice: planMies.filter(pl => pl.priorytet === 'nice')
    };
    
    let html = '';
    
    Object.entries(perPriorytet).forEach(([priorytet, items]) => {
        if (items.length === 0) return;
        
        const priorInfo = PRIORYTETY_WYDATKOW[priorytet];
        
        html += `
            <div class="plan-priority-group">
                <h4 style="color: ${priorInfo.color}">${priorInfo.icon} ${priorInfo.label}</h4>
                ${items.map(pl => {
                    const faktyczne = p.wydatkiPerKategoria[pl.kategoria]?.suma || 0;
                    const procent = pl.limit > 0 ? (faktyczne / pl.limit) * 100 : 0;
                    const status = procent <= 100 ? 'ok' : 'over';
                    
                    return `
                        <div class="plan-item ${status}">
                            <div class="plan-item-header">
                                <span class="plan-category" style="color: ${getKategoriaColor(pl.kategoria)}">
                                    ${getKategoriaIcon(pl.kategoria)} ${pl.kategoria}
                                </span>
                                <span class="plan-limit">Limit: ${formatMoney(pl.limit)}</span>
                            </div>
                            <div class="plan-progress">
                                <div class="plan-progress-bar">
                                    <div class="plan-progress-fill ${status}" style="width: ${Math.min(100, procent)}%"></div>
                                </div>
                                <span class="plan-progress-text">
                                    ${formatMoney(faktyczne)} / ${formatMoney(pl.limit)}
                                    (${procent.toFixed(0)}%)
                                </span>
                            </div>
                            <div class="plan-item-actions">
                                <button class="btn btn-icon btn-sm btn-danger" onclick="deletePlan('${pl.id}')" title="Usuń">
                                    ${BUDGET_ICONS['trash']}
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    });
    
    return html;
}

function renderCategoryAverages() {
    const kategorie = Object.keys(KATEGORIE_WYDATKOW).filter(k => 
        !KATEGORIE_WYDATKOW[k].isTransfer && !KATEGORIE_WYDATKOW[k].isInvestment
    );
    
    const srednie = kategorie.map(k => ({
        kategoria: k,
        srednia: getSrednieKategorii(k, 6)
    })).filter(k => k.srednia > 0).sort((a, b) => b.srednia - a.srednia);
    
    if (srednie.length === 0) {
        return '<p class="text-muted">Brak danych historycznych</p>';
    }
    
    return srednie.map(k => `
        <div class="category-avg-row">
            <span class="category-name" style="color: ${getKategoriaColor(k.kategoria)}">
                ${getKategoriaIcon(k.kategoria)} ${k.kategoria}
            </span>
            <span class="category-avg">${formatMoney(k.srednia)}/mies</span>
            <button class="btn btn-link btn-sm" onclick="addToPlan('${k.kategoria}', ${k.srednia})">
                + Dodaj do planu
            </button>
        </div>
    `).join('');
}

function changePlansMonth(delta) {
    if (delta < 0) {
        const prev = getPoprzedniMiesiac(plansViewYear, plansViewMonth);
        plansViewYear = prev.rok;
        plansViewMonth = prev.miesiac;
    } else {
        const next = getNastepnyMiesiac(plansViewYear, plansViewMonth);
        plansViewYear = next.rok;
        plansViewMonth = next.miesiac;
    }
    renderBudgetPlans();
}

function openCreatePlanModal() {
    const srednie = getSrednieMiesieczne(6);
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'createPlanModal';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h3>Utwórz plan na ${formatMiesiac(plansViewYear, plansViewMonth)}</h3>
                <button class="modal-close" onclick="closeCreatePlanModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="plan-creator">
                    <div class="plan-budget-info">
                        <span>Średni dochód: <strong>${formatMoney(srednie.dochody)}</strong></span>
                        <span>|</span>
                        <span>Do dyspozycji (80%): <strong>${formatMoney(srednie.dochody * 0.8)}</strong></span>
                    </div>
                    
                    <div id="planItemsList" class="plan-items-creator"></div>
                    
                    <button type="button" class="btn btn-secondary" onclick="addPlanItem()">
                        ${BUDGET_ICONS['plus']} Dodaj kategorię
                    </button>
                    
                    <div class="plan-totals">
                        <div class="plan-total-row">
                            <span>Suma limitów:</span>
                            <span id="planTotalLimits">0,00 PLN</span>
                        </div>
                        <div class="plan-total-row">
                            <span>Pozostaje na oszczędności:</span>
                            <span id="planRemaining">${formatMoney(srednie.dochody)}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeCreatePlanModal()">Anuluj</button>
                <button type="button" class="btn btn-primary" onclick="savePlan()">Zapisz plan</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.planItems = [];
    renderPlanItems();
}

function closeCreatePlanModal() {
    document.getElementById('createPlanModal')?.remove();
}

window.planItems = [];

function renderPlanItems() {
    const container = document.getElementById('planItemsList');
    if (!container) return;
    
    container.innerHTML = window.planItems.map((item, i) => `
        <div class="plan-item-row">
            <select class="form-select" onchange="updatePlanItem(${i}, 'kategoria', this.value)">
                <option value="">Wybierz kategorię...</option>
                ${Object.keys(KATEGORIE_WYDATKOW).filter(k => !KATEGORIE_WYDATKOW[k].isTransfer).map(k => 
                    `<option value="${k}" ${item.kategoria === k ? 'selected' : ''}>${k}</option>`
                ).join('')}
            </select>
            <input type="number" class="form-input" placeholder="Limit" 
                   value="${item.limit || ''}"
                   onchange="updatePlanItem(${i}, 'limit', parseFloat(this.value) || 0)">
            <select class="form-select" onchange="updatePlanItem(${i}, 'priorytet', this.value)">
                ${Object.entries(PRIORYTETY_WYDATKOW).map(([k, v]) => 
                    `<option value="${k}" ${item.priorytet === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
                ).join('')}
            </select>
            <button type="button" class="btn btn-icon btn-danger" onclick="removePlanItem(${i})">
                ${BUDGET_ICONS['trash']}
            </button>
        </div>
    `).join('');
    
    updatePlanTotals();
}

function addPlanItem() {
    window.planItems.push({ kategoria: '', limit: 0, priorytet: 'should' });
    renderPlanItems();
}

function removePlanItem(index) {
    window.planItems.splice(index, 1);
    renderPlanItems();
}

function updatePlanItem(index, field, value) {
    window.planItems[index][field] = value;
    updatePlanTotals();
}

function updatePlanTotals() {
    const suma = window.planItems.reduce((s, item) => s + (item.limit || 0), 0);
    const srednie = getSrednieMiesieczne(6);
    const pozostaje = srednie.dochody - suma;
    
    const totalEl = document.getElementById('planTotalLimits');
    const remainEl = document.getElementById('planRemaining');
    if (totalEl) totalEl.textContent = formatMoney(suma);
    if (remainEl) {
        remainEl.textContent = formatMoney(pozostaje);
        remainEl.className = pozostaje >= 0 ? 'positive' : 'negative';
    }
}

function addToPlan(kategoria, kwota) {
    if (!document.getElementById('createPlanModal')) {
        openCreatePlanModal();
    }
    window.planItems.push({ kategoria, limit: Math.round(kwota), priorytet: 'should' });
    renderPlanItems();
}

function applyRule503020() {
    const srednie = getSrednieMiesieczne(6);
    const rule = calculate503020(srednie.dochody);
    
    openCreatePlanModal();
    
    const mustKategorie = ['Płatności', 'Codzienne wydatki', 'Auto i transport', 'Dom'];
    const shouldKategorie = ['Rozrywka', 'Osobiste'];
    
    window.planItems = [];
    
    const mustSrednie = mustKategorie.map(k => ({ kategoria: k, srednia: getSrednieKategorii(k, 6) }))
        .filter(k => k.srednia > 0);
    const mustTotal = mustSrednie.reduce((s, k) => s + k.srednia, 0);
    
    mustSrednie.forEach(k => {
        const proporcja = mustTotal > 0 ? k.srednia / mustTotal : 1 / mustSrednie.length;
        window.planItems.push({
            kategoria: k.kategoria,
            limit: Math.round(rule.needs * proporcja),
            priorytet: 'must'
        });
    });
    
    const shouldSrednie = shouldKategorie.map(k => ({ kategoria: k, srednia: getSrednieKategorii(k, 6) }))
        .filter(k => k.srednia > 0);
    const shouldTotal = shouldSrednie.reduce((s, k) => s + k.srednia, 0);
    
    shouldSrednie.forEach(k => {
        const proporcja = shouldTotal > 0 ? k.srednia / shouldTotal : 1 / shouldSrednie.length;
        window.planItems.push({
            kategoria: k.kategoria,
            limit: Math.round(rule.wants * proporcja),
            priorytet: 'should'
        });
    });
    
    window.planItems.push({
        kategoria: 'Oszczędności i inw.',
        limit: Math.round(rule.savings),
        priorytet: 'nice'
    });
    
    renderPlanItems();
}

async function savePlan() {
    const validItems = window.planItems.filter(item => item.kategoria && item.limit > 0);
    
    if (validItems.length === 0) {
        showToast('Dodaj przynajmniej jedną kategorię z limitem', 'warning');
        return;
    }
    
    try {
        showBudgetLoading(true);
        
        for (const item of validItems) {
            await BudgetSheets.savePlan({
                rok: plansViewYear,
                miesiac: plansViewMonth,
                kategoria: item.kategoria,
                limit: item.limit,
                priorytet: item.priorytet
            });
        }
        
        await refreshBudgetData();
        closeCreatePlanModal();
        showToast('Plan zapisany!', 'success');
        
    } catch (error) {
        console.error('Błąd zapisu planu:', error);
        showToast('Nie udało się zapisać planu', 'error');
    } finally {
        showBudgetLoading(false);
    }
}

async function deletePlan(id) {
    if (!confirm('Czy na pewno chcesz usunąć ten limit?')) return;
    
    try {
        showBudgetLoading(true);
        await BudgetSheets.deletePlan(id);
        await refreshBudgetData();
        showToast('Limit usunięty', 'success');
    } catch (error) {
        console.error('Błąd usuwania:', error);
        showToast('Nie udało się usunąć', 'error');
    } finally {
        showBudgetLoading(false);
    }
}
