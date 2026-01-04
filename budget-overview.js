/**
 * Assetly - Budget Overview
 * Tab: Przegląd budżetu (retrospektywny)
 */

let selectedOverviewMonth = null;

function renderBudgetOverview() {
    const container = document.getElementById('tab-overview');
    if (!container) return;
    
    // Pobierz ostatni zamknięty miesiąc z danych
    const ostatni = getOstatniZamknietyMiesiacZDanych();
    if (!selectedOverviewMonth) {
        selectedOverviewMonth = ostatni;
    }
    
    const p = getPodsumowanieMiesiaca(selectedOverviewMonth.rok, selectedOverviewMonth.miesiac);
    const statusDanych = getStatusDanych();
    const srednie = getSrednieMiesieczne(12);
    const bufor = getBuforAwaryjny();
    
    // Porównania
    const poprzedni = getPoprzedniMiesiac(selectedOverviewMonth.rok, selectedOverviewMonth.miesiac);
    const rokTemu = getRokTemu(selectedOverviewMonth.rok, selectedOverviewMonth.miesiac);
    const porownaniePop = porownajMiesiace(poprzedni.rok, poprzedni.miesiac, selectedOverviewMonth.rok, selectedOverviewMonth.miesiac);
    const porownanieRok = porownajMiesiace(rokTemu.rok, rokTemu.miesiac, selectedOverviewMonth.rok, selectedOverviewMonth.miesiac);
    
    // Top kategorie
    const topKategorie = getTopKategorie(selectedOverviewMonth.rok, selectedOverviewMonth.miesiac, 5);
    
    // Anomalie
    const anomalie = getAnomalieKategorii(selectedOverviewMonth.rok, selectedOverviewMonth.miesiac);
    
    container.innerHTML = `
        <div class="overview-container">
            
            <!-- Status wprowadzania danych -->
            <div class="card overview-status-card">
                <div class="card-header">
                    <h3>Status wprowadzania danych</h3>
                    <button class="btn btn-primary btn-sm" onclick="openAddMonthModal()">
                        ${BUDGET_ICONS['plus']} Dodaj miesiąc
                    </button>
                </div>
                <div class="data-status-grid">
                    ${renderDataStatus(statusDanych)}
                </div>
            </div>
            
            <!-- Wybrany miesiąc -->
            <div class="card overview-hero-card">
                <div class="overview-hero-header">
                    <h2>OSTATNI ZAMKNIĘTY MIESIĄC</h2>
                    <div class="month-selector">
                        <button class="btn btn-icon" onclick="changeOverviewMonth(-1)" title="Poprzedni">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
                        </button>
                        <span class="selected-month">${formatMiesiac(selectedOverviewMonth.rok, selectedOverviewMonth.miesiac)}</span>
                        <button class="btn btn-icon" onclick="changeOverviewMonth(1)" title="Następny">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,6 15,12 9,18"/></svg>
                        </button>
                    </div>
                </div>
                
                ${p.maDane ? renderMonthSummary(p) : renderNoDataMessage(selectedOverviewMonth)}
            </div>
            
            ${p.maDane ? `
            <!-- Porównania -->
            <div class="overview-comparisons">
                <div class="card comparison-card">
                    <h4>vs ${formatMiesiacShort(poprzedni.rok, poprzedni.miesiac)}</h4>
                    ${renderComparison(porownaniePop)}
                </div>
                <div class="card comparison-card">
                    <h4>vs ${formatMiesiacShort(rokTemu.rok, rokTemu.miesiac)} (rok temu)</h4>
                    ${porownanieRok.okres1.maDane ? renderComparison(porownanieRok) : '<p class="text-muted">Brak danych</p>'}
                </div>
            </div>
            
            <!-- Kluczowe metryki -->
            <div class="card overview-metrics-card">
                <h3>Kluczowe metryki (ostatnie 12 mies.)</h3>
                <div class="metrics-grid">
                    <div class="metric-box">
                        <span class="metric-label">Śr. dochód</span>
                        <span class="metric-value">${formatMoney(srednie.dochody)}</span>
                    </div>
                    <div class="metric-box">
                        <span class="metric-label">Śr. wydatki</span>
                        <span class="metric-value">${formatMoney(srednie.wydatki)}</span>
                    </div>
                    <div class="metric-box">
                        <span class="metric-label">Śr. oszczędności</span>
                        <span class="metric-value">${formatMoney(srednie.oszczednosci)}</span>
                    </div>
                </div>
                <div class="metrics-row">
                    <div class="metric-inline">
                        <span>Stopa oszczędności:</span>
                        <span class="metric-badge ${srednie.stopaOszczednosci >= (ustawienia.celOszczednosciProcent || 20) ? 'success' : 'warning'}">
                            ${srednie.stopaOszczednosci.toFixed(1)}% (cel: ${ustawienia.celOszczednosciProcent || 20}%)
                            ${srednie.stopaOszczednosci >= (ustawienia.celOszczednosciProcent || 20) ? '✓' : ''}
                        </span>
                    </div>
                    <div class="metric-inline">
                        <span>Bufor awaryjny:</span>
                        <span class="metric-badge ${bufor.obecneMiesiace >= bufor.celMiesiecy ? 'success' : 'warning'}">
                            ${bufor.obecneMiesiace.toFixed(1)} mies. wydatków (cel: ${bufor.celMiesiecy} mies.)
                            ${bufor.obecneMiesiace >= bufor.celMiesiecy ? '✓' : bufor.miesiacyDoCelu ? ` - za ${bufor.miesiacyDoCelu} mies.` : ''}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Top 5 kategorii -->
            <div class="card overview-categories-card">
                <h3>Top 5 kategorii (${formatMiesiacShort(selectedOverviewMonth.rok, selectedOverviewMonth.miesiac)})</h3>
                <div class="top-categories-list">
                    ${topKategorie.map((kat, i) => `
                        <div class="top-category-item">
                            <div class="top-category-rank">${i + 1}</div>
                            <div class="top-category-icon" style="color: ${getKategoriaColor(kat.kategoria)}">
                                ${getKategoriaIcon(kat.kategoria)}
                            </div>
                            <div class="top-category-info">
                                <span class="top-category-name">${kat.kategoria}</span>
                                <span class="top-category-amount">${formatMoney(kat.suma)}</span>
                            </div>
                            <div class="top-category-bar">
                                <div class="top-category-bar-fill" style="width: ${kat.udzial}%; background: ${getKategoriaColor(kat.kategoria)}"></div>
                            </div>
                            <div class="top-category-percent">${kat.udzial.toFixed(0)}%</div>
                            <div class="top-category-trend ${kat.trend}">
                                ${kat.trend === 'up' ? '↑' : kat.trend === 'down' ? '↓' : '≈'}
                                ${kat.trend !== 'stable' ? Math.abs(kat.odchylenie).toFixed(0) + '%' : 'średnia'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Obserwacje i alerty -->
            <div class="card overview-alerts-card">
                <h3>Obserwacje i alerty</h3>
                <div class="alerts-list">
                    ${renderAlerts(p, anomalie, bufor)}
                </div>
            </div>
            ` : ''}
            
        </div>
    `;
}

function renderDataStatus(statusDanych) {
    let html = '';
    
    Object.keys(statusDanych).sort().reverse().forEach(rok => {
        html += `
            <div class="data-status-row">
                <span class="data-status-year">${rok}:</span>
                <div class="data-status-months">
                    ${statusDanych[rok].map(m => `
                        <span class="data-status-dot ${m.status}" 
                              title="${NAZWY_MIESIECY[m.miesiac]} ${rok}: ${m.status === 'kompletne' ? 'Dane kompletne' : m.status === 'czesciowe' ? 'Dane częściowe' : 'Brak danych'}"
                              onclick="selectOverviewMonth(${rok}, ${m.miesiac})">
                            ${NAZWY_MIESIECY_SHORT[m.miesiac]}
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    html += `
        <div class="data-status-legend">
            <span class="legend-item"><span class="data-status-dot kompletne"></span> Kompletne</span>
            <span class="legend-item"><span class="data-status-dot czesciowe"></span> Częściowe</span>
            <span class="legend-item"><span class="data-status-dot brak"></span> Brak</span>
        </div>
    `;
    
    return html;
}

function renderMonthSummary(p) {
    const planRealizowany = p.planInwestycji > 0 && p.bilans >= p.planInwestycji;
    
    return `
        <div class="overview-hero-content">
            <div class="hero-main-stats">
                <div class="hero-stat">
                    <span class="hero-stat-label">Dochody</span>
                    <span class="hero-stat-value income">${formatMoney(p.dochody)}</span>
                </div>
                <div class="hero-stat">
                    <span class="hero-stat-label">Wydatki</span>
                    <span class="hero-stat-value expense">${formatMoney(p.wydatki)}</span>
                </div>
                <div class="hero-stat-divider"></div>
                <div class="hero-stat">
                    <span class="hero-stat-label">Bilans</span>
                    <span class="hero-stat-value ${p.bilans >= 0 ? 'positive' : 'negative'}">
                        ${p.bilans >= 0 ? '+' : ''}${formatMoney(p.bilans)}
                    </span>
                    <span class="hero-stat-sub">(${p.stopaOszczednosci.toFixed(1)}% stopa oszcz.)</span>
                </div>
            </div>
            
            <div class="hero-breakdown">
                <div class="breakdown-item">
                    <span class="breakdown-icon">${BUDGET_ICONS['credit-card']}</span>
                    <span class="breakdown-label">Plan inwestycji:</span>
                    <span class="breakdown-value">${formatMoney(p.planInwestycji)}</span>
                    <span class="breakdown-status ${planRealizowany ? 'success' : 'warning'}">
                        ${planRealizowany ? '✓ zrealizowany' : '⚠ niedofinansowany'}
                    </span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-icon">${BUDGET_ICONS['home']}</span>
                    <span class="breakdown-label">Wydatki stałe:</span>
                    <span class="breakdown-value">${formatMoney(p.wydatkiStale)}</span>
                    <span class="breakdown-sub">(${p.wydatki > 0 ? ((p.wydatkiStale / p.wydatki) * 100).toFixed(0) : 0}% wydatków)</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-icon">${BUDGET_ICONS['shopping-cart']}</span>
                    <span class="breakdown-label">Wydatki zmienne:</span>
                    <span class="breakdown-value">${formatMoney(p.wydatkiZmienne)}</span>
                    <span class="breakdown-sub">(${p.wydatki > 0 ? ((p.wydatkiZmienne / p.wydatki) * 100).toFixed(0) : 0}% wydatków)</span>
                </div>
                ${p.transfery > 0 ? `
                <div class="breakdown-item transfer">
                    <span class="breakdown-icon">${BUDGET_ICONS['briefcase']}</span>
                    <span class="breakdown-label">Transfery (firma):</span>
                    <span class="breakdown-value">${formatMoney(p.transfery)}</span>
                    <span class="breakdown-sub">(nie wliczone w wydatki)</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderNoDataMessage(month) {
    return `
        <div class="no-data-message">
            <div class="no-data-icon">${BUDGET_ICONS['calendar']}</div>
            <h3>Brak danych za ${formatMiesiac(month.rok, month.miesiac)}</h3>
            <p>Nie wprowadzono jeszcze wydatków ani dochodów za ten miesiąc.</p>
            <button class="btn btn-primary" onclick="openAddMonthModal(${month.rok}, ${month.miesiac})">
                ${BUDGET_ICONS['plus']} Wprowadź dane
            </button>
        </div>
    `;
}

function renderComparison(comparison) {
    const z = comparison.zmiana;
    
    return `
        <div class="comparison-stats">
            <div class="comparison-stat">
                <span class="comparison-label">Dochody:</span>
                <span class="comparison-value ${z.dochody >= 0 ? 'positive' : 'negative'}">
                    ${z.dochody >= 0 ? '+' : ''}${formatMoney(z.dochody)}
                </span>
                <span class="comparison-percent">(${formatPercent(z.dochodyProcent)})</span>
            </div>
            <div class="comparison-stat">
                <span class="comparison-label">Wydatki:</span>
                <span class="comparison-value ${z.wydatki <= 0 ? 'positive' : 'negative'}">
                    ${z.wydatki >= 0 ? '+' : ''}${formatMoney(z.wydatki)}
                </span>
                <span class="comparison-percent">(${formatPercent(z.wydatkiProcent)})</span>
            </div>
            <div class="comparison-stat">
                <span class="comparison-label">Bilans:</span>
                <span class="comparison-value ${z.bilans >= 0 ? 'positive' : 'negative'}">
                    ${z.bilans >= 0 ? '+' : ''}${formatMoney(z.bilans)}
                </span>
                <span class="comparison-trend">
                    ${z.bilans > 0 ? '↑ lepiej' : z.bilans < 0 ? '↓ gorzej' : '= bez zmian'}
                </span>
            </div>
        </div>
    `;
}

function renderAlerts(p, anomalie, bufor) {
    const alerts = [];
    
    // Sezonowość (styczeń tańszy po grudniu)
    if (p.miesiac === 1) {
        alerts.push({
            type: 'info',
            icon: BUDGET_ICONS['info'],
            message: 'Styczeń był tańszy niż średnio - typowe po grudniowych wydatkach świątecznych'
        });
    }
    
    // Anomalie kategorii
    anomalie.forEach(a => {
        if (a.typ === 'wzrost') {
            alerts.push({
                type: 'warning',
                icon: BUDGET_ICONS['alert-circle'],
                message: `"${a.kategoria}" ${formatPercent(a.odchylenie)} vs średnia 6 mies. (${formatMoney(a.kwota)} vs ${formatMoney(a.srednia)})`
            });
        }
    });
    
    // Plan inwestycji
    if (p.planInwestycji > 0) {
        if (p.bilans >= p.planInwestycji) {
            // Sprawdź ile miesięcy z rzędu
            let miesieceZRzedu = 1;
            let checkMonth = getPoprzedniMiesiac(p.rok, p.miesiac);
            for (let i = 0; i < 5; i++) {
                const checkP = getPodsumowanieMiesiaca(checkMonth.rok, checkMonth.miesiac);
                if (checkP.maDane && checkP.bilans >= checkP.planInwestycji) {
                    miesieceZRzedu++;
                    checkMonth = getPoprzedniMiesiac(checkMonth.rok, checkMonth.miesiac);
                } else {
                    break;
                }
            }
            
            alerts.push({
                type: 'success',
                icon: BUDGET_ICONS['check-circle'],
                message: `Plan inwestycji zrealizowany${miesieceZRzedu > 1 ? ` ${miesieceZRzedu}. miesiąc z rzędu` : ''}`
            });
        } else {
            alerts.push({
                type: 'warning',
                icon: BUDGET_ICONS['alert-circle'],
                message: `Plan inwestycji niedofinansowany o ${formatMoney(p.planInwestycji - p.bilans)}`
            });
        }
    }
    
    // Bufor awaryjny
    if (bufor.obecneMiesiace < bufor.celMiesiecy && bufor.miesiacyDoCelu) {
        alerts.push({
            type: 'info',
            icon: BUDGET_ICONS['info'],
            message: `Bufor awaryjny (${bufor.celMiesiecy} mies.) za ${bufor.miesiacyDoCelu} mies. przy obecnym tempie`
        });
    }
    
    // Historia wynagrodzeń
    const historiaWyn = getHistoriaWynagrodzen();
    const glownyPracodawca = Object.entries(historiaWyn)
        .sort((a, b) => b[1].liczbaMiesiecy - a[1].liczbaMiesiecy)[0];
    
    if (glownyPracodawca) {
        const [pracodawca, dane] = glownyPracodawca;
        if (dane.ostatniaPodwyzka) {
            const dataOstatniej = dane.ostatniaPodwyzka.data;
            const [rok, mies] = dataOstatniej.split('-').map(Number);
            alerts.push({
                type: 'info',
                icon: BUDGET_ICONS['trending-up'],
                message: `Wynagrodzenie stabilne od ${formatMiesiacShort(rok, mies)} (ostatnia podwyżka: +${formatMoney(dane.ostatniaPodwyzka.zmiana)})`
            });
        }
    }
    
    if (alerts.length === 0) {
        alerts.push({
            type: 'info',
            icon: BUDGET_ICONS['check-circle'],
            message: 'Wszystko wygląda dobrze!'
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
// NAWIGACJA
// ═══════════════════════════════════════════════════════════

function selectOverviewMonth(rok, miesiac) {
    selectedOverviewMonth = { rok, miesiac };
    renderBudgetOverview();
}

function changeOverviewMonth(delta) {
    if (delta < 0) {
        selectedOverviewMonth = getPoprzedniMiesiac(selectedOverviewMonth.rok, selectedOverviewMonth.miesiac);
    } else {
        selectedOverviewMonth = getNastepnyMiesiac(selectedOverviewMonth.rok, selectedOverviewMonth.miesiac);
    }
    renderBudgetOverview();
}

// ═══════════════════════════════════════════════════════════
// MODAL: DODAJ MIESIĄC
// ═══════════════════════════════════════════════════════════

function openAddMonthModal(rok = null, miesiac = null) {
    // Jeśli nie podano, użyj ostatniego miesiąca bez danych
    if (rok === null) {
        const ostatni = getOstatnioZamknietyMiesiac();
        rok = ostatni.rok;
        miesiac = ostatni.miesiac;
    }
    
    const modal = document.getElementById('addMonthModal');
    if (!modal) {
        // Utwórz modal dynamicznie
        createAddMonthModal();
    }
    
    document.getElementById('addMonthYear').value = rok;
    document.getElementById('addMonthMonth').value = miesiac;
    
    // Załaduj szablon wydatków stałych
    loadRecurringExpenses(rok, miesiac);
    
    // Załaduj poprzedni miesiąc jako podpowiedź
    loadPreviousMonthHints(rok, miesiac);
    
    document.getElementById('addMonthModal').classList.add('active');
}

function closeAddMonthModal() {
    document.getElementById('addMonthModal')?.classList.remove('active');
}

function createAddMonthModal() {
    const modalHtml = `
        <div id="addMonthModal" class="modal">
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>Wprowadź dane za miesiąc</h3>
                    <button class="modal-close" onclick="closeAddMonthModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                
                <form id="addMonthForm" onsubmit="handleAddMonthSubmit(event)">
                    <div class="modal-body">
                        <!-- Wybór miesiąca -->
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Miesiąc</label>
                                <select id="addMonthMonth" class="form-select" onchange="onMonthChange()">
                                    ${NAZWY_MIESIECY.slice(1).map((n, i) => 
                                        `<option value="${i+1}">${n}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Rok</label>
                                <select id="addMonthYear" class="form-select" onchange="onMonthChange()">
                                    ${[2026, 2025, 2024, 2023].map(r => 
                                        `<option value="${r}">${r}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                        
                        <!-- Krok 1: Dochody -->
                        <div class="add-month-section">
                            <h4>Krok 1: Dochody</h4>
                            <div id="addMonthIncomeList" class="dynamic-list">
                                <!-- Generowane dynamicznie -->
                            </div>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="addIncomeRow()">
                                ${BUDGET_ICONS['plus']} Dodaj dochód
                            </button>
                            <div class="section-total">
                                Suma dochodów: <span id="addMonthIncomeTotal">0,00 PLN</span>
                            </div>
                        </div>
                        
                        <!-- Krok 2: Wydatki stałe -->
                        <div class="add-month-section">
                            <h4>Krok 2: Wydatki stałe (z szablonu)
                                <button type="button" class="btn btn-link btn-sm" onclick="openRecurringSettings()">
                                    ${BUDGET_ICONS['settings']} Edytuj szablon
                                </button>
                            </h4>
                            <div id="addMonthRecurringList" class="recurring-list">
                                <!-- Generowane dynamicznie -->
                            </div>
                            <div class="section-total">
                                Suma stałych: <span id="addMonthRecurringTotal">0,00 PLN</span>
                            </div>
                        </div>
                        
                        <!-- Krok 3: Wydatki zmienne -->
                        <div class="add-month-section">
                            <h4>Krok 3: Wydatki zmienne</h4>
                            <div id="addMonthExpenseList" class="dynamic-list">
                                <!-- Generowane dynamicznie -->
                            </div>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="addExpenseRow()">
                                ${BUDGET_ICONS['plus']} Dodaj wydatek
                            </button>
                            <div class="section-total">
                                Suma zmiennych: <span id="addMonthExpenseTotal">0,00 PLN</span>
                            </div>
                        </div>
                        
                        <!-- Krok 4: Transfery -->
                        <div class="add-month-section">
                            <h4>Krok 4: Transfery (opcjonalne)</h4>
                            <div id="addMonthTransferList" class="dynamic-list">
                                <!-- Generowane dynamicznie -->
                            </div>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="addTransferRow()">
                                ${BUDGET_ICONS['plus']} Dodaj transfer
                            </button>
                        </div>
                        
                        <!-- Podsumowanie -->
                        <div class="add-month-summary">
                            <h4>Podsumowanie miesiąca</h4>
                            <div class="summary-grid">
                                <div class="summary-row">
                                    <span>Dochody:</span>
                                    <span id="summaryIncome">0,00 PLN</span>
                                </div>
                                <div class="summary-row">
                                    <span>Wydatki stałe:</span>
                                    <span id="summaryRecurring">0,00 PLN</span>
                                </div>
                                <div class="summary-row">
                                    <span>Wydatki zmienne:</span>
                                    <span id="summaryVariable">0,00 PLN</span>
                                </div>
                                <div class="summary-row">
                                    <span>Transfery:</span>
                                    <span id="summaryTransfers">0,00 PLN</span>
                                </div>
                                <div class="summary-divider"></div>
                                <div class="summary-row total">
                                    <span>BILANS (do dyspozycji):</span>
                                    <span id="summaryBalance">0,00 PLN</span>
                                </div>
                                <div class="summary-row">
                                    <span>Plan inwestycji (z kalkulatora):</span>
                                    <span id="summaryInvestPlan">0,00 PLN</span>
                                </div>
                                <div class="summary-row">
                                    <span>Nadwyżka po inwestycjach:</span>
                                    <span id="summarySurplus">0,00 PLN</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeAddMonthModal()">Anuluj</button>
                        <button type="submit" class="btn btn-primary">Zapisz miesiąc</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

let addMonthIncomeRows = [];
let addMonthExpenseRows = [];
let addMonthTransferRows = [];
let addMonthRecurringItems = [];

function loadRecurringExpenses(rok, miesiac) {
    const aktywneStale = wydatkiStale.filter(s => s.aktywny);
    
    // Filtruj tylko miesięczne lub te które przypadają na ten miesiąc
    addMonthRecurringItems = aktywneStale.filter(s => {
        if (s.czestotliwosc === 'monthly') return true;
        if (s.czestotliwosc === 'yearly' && s.miesiacPlatnosci === miesiac) return true;
        if (s.czestotliwosc === 'quarterly') {
            // Kwartalne: 1,4,7,10 lub 2,5,8,11 lub 3,6,9,12
            return (miesiac - s.miesiacPlatnosci) % 3 === 0;
        }
        return false;
    }).map(s => ({
        ...s,
        zaznaczony: true,
        kwota: s.kwotaTypowa
    }));
    
    renderRecurringList();
}

function loadPreviousMonthHints(rok, miesiac) {
    const poprzedni = getPoprzedniMiesiac(rok, miesiac);
    const poprzednieWydatki = wydatki.filter(w => 
        w.rok === poprzedni.rok && w.miesiac === poprzedni.miesiac
    );
    const poprzednieDochody = dochody.filter(d => 
        d.rok === poprzedni.rok && d.miesiac === poprzedni.miesiac
    );
    
    // Zainicjuj dochody z poprzedniego miesiąca
    addMonthIncomeRows = poprzednieDochody.map(d => ({
        zrodlo: d.zrodlo,
        podzrodlo: d.podzrodlo,
        pracodawca: d.pracodawca,
        kwota: d.kwotaNetto,
        waluta: d.waluta,
        hint: d.kwotaNetto
    }));
    
    if (addMonthIncomeRows.length === 0) {
        addMonthIncomeRows.push({ zrodlo: 'Wynagrodzenie', podzrodlo: '', pracodawca: '', kwota: 0, waluta: 'PLN' });
    }
    
    // Zainicjuj wydatki zmienne
    const staleIds = addMonthRecurringItems.map(r => `${r.kategoria}-${r.podkategoria}`);
    addMonthExpenseRows = poprzednieWydatki
        .filter(w => !w.jestStaly && !w.jestTransfer)
        .filter(w => !staleIds.includes(`${w.kategoria}-${w.podkategoria}`))
        .map(w => ({
            kategoria: w.kategoria,
            podkategoria: w.podkategoria,
            kwota: w.kwotaPLN,
            waluta: w.waluta,
            hint: w.kwotaPLN
        }));
    
    // Transfery
    addMonthTransferRows = poprzednieWydatki
        .filter(w => w.jestTransfer)
        .map(w => ({
            kategoria: w.kategoria,
            podkategoria: w.podkategoria,
            kwota: w.kwotaPLN,
            waluta: 'PLN'
        }));
    
    renderAllAddMonthLists();
    updateAddMonthSummary();
}

function renderAllAddMonthLists() {
    renderIncomeList();
    renderExpenseList();
    renderTransferList();
    renderRecurringList();
}

function renderIncomeList() {
    const container = document.getElementById('addMonthIncomeList');
    if (!container) return;
    
    container.innerHTML = addMonthIncomeRows.map((row, i) => `
        <div class="dynamic-row">
            <select class="form-select" onchange="updateIncomeRow(${i}, 'zrodlo', this.value)">
                <option value="">Źródło...</option>
                ${Object.keys(ZRODLA_DOCHODOW).map(z => 
                    `<option value="${z}" ${row.zrodlo === z ? 'selected' : ''}>${z}</option>`
                ).join('')}
            </select>
            <input type="text" class="form-input" placeholder="Pracodawca/opis" 
                   value="${row.pracodawca || ''}" 
                   onchange="updateIncomeRow(${i}, 'pracodawca', this.value)">
            <input type="number" class="form-input amount-input" placeholder="Kwota netto"
                   value="${row.kwota || ''}"
                   onchange="updateIncomeRow(${i}, 'kwota', parseFloat(this.value) || 0)">
            <select class="form-select currency-select" onchange="updateIncomeRow(${i}, 'waluta', this.value)">
                ${WALUTY.map(w => `<option value="${w}" ${row.waluta === w ? 'selected' : ''}>${w}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-icon btn-danger" onclick="removeIncomeRow(${i})">
                ${BUDGET_ICONS['trash']}
            </button>
        </div>
        ${row.hint ? `<div class="row-hint">Poprzednio: ${formatMoney(row.hint)}</div>` : ''}
    `).join('');
    
    updateAddMonthSummary();
}

function addIncomeRow() {
    addMonthIncomeRows.push({ zrodlo: '', podzrodlo: '', pracodawca: '', kwota: 0, waluta: 'PLN' });
    renderIncomeList();
}

function removeIncomeRow(index) {
    addMonthIncomeRows.splice(index, 1);
    renderIncomeList();
}

function updateIncomeRow(index, field, value) {
    addMonthIncomeRows[index][field] = value;
    updateAddMonthSummary();
}

function renderExpenseList() {
    const container = document.getElementById('addMonthExpenseList');
    if (!container) return;
    
    container.innerHTML = addMonthExpenseRows.map((row, i) => `
        <div class="dynamic-row">
            <select class="form-select" onchange="updateExpenseRow(${i}, 'kategoria', this.value); updateExpenseSubcategories(${i})">
                <option value="">Kategoria...</option>
                ${Object.keys(KATEGORIE_WYDATKOW).filter(k => !KATEGORIE_WYDATKOW[k].isTransfer).map(k => 
                    `<option value="${k}" ${row.kategoria === k ? 'selected' : ''}>${k}</option>`
                ).join('')}
            </select>
            <select class="form-select subcategory-select" id="expenseSubcat_${i}" 
                    onchange="updateExpenseRow(${i}, 'podkategoria', this.value)">
                <option value="">Podkategoria...</option>
                ${row.kategoria ? KATEGORIE_WYDATKOW[row.kategoria]?.podkategorie.map(p => 
                    `<option value="${p}" ${row.podkategoria === p ? 'selected' : ''}>${p}</option>`
                ).join('') : ''}
            </select>
            <input type="number" class="form-input amount-input" placeholder="Kwota"
                   value="${row.kwota || ''}"
                   onchange="updateExpenseRow(${i}, 'kwota', parseFloat(this.value) || 0)">
            <select class="form-select currency-select" onchange="updateExpenseRow(${i}, 'waluta', this.value)">
                ${WALUTY.map(w => `<option value="${w}" ${row.waluta === w ? 'selected' : ''}>${w}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-icon btn-danger" onclick="removeExpenseRow(${i})">
                ${BUDGET_ICONS['trash']}
            </button>
        </div>
        ${row.hint ? `<div class="row-hint">Poprzednio: ${formatMoney(row.hint)}</div>` : ''}
    `).join('');
    
    updateAddMonthSummary();
}

function addExpenseRow() {
    addMonthExpenseRows.push({ kategoria: '', podkategoria: '', kwota: 0, waluta: 'PLN' });
    renderExpenseList();
}

function removeExpenseRow(index) {
    addMonthExpenseRows.splice(index, 1);
    renderExpenseList();
}

function updateExpenseRow(index, field, value) {
    addMonthExpenseRows[index][field] = value;
    updateAddMonthSummary();
}

function updateExpenseSubcategories(index) {
    const row = addMonthExpenseRows[index];
    const select = document.getElementById(`expenseSubcat_${index}`);
    if (!select || !row.kategoria) return;
    
    const podkategorie = KATEGORIE_WYDATKOW[row.kategoria]?.podkategorie || [];
    select.innerHTML = `
        <option value="">Podkategoria...</option>
        ${podkategorie.map(p => `<option value="${p}">${p}</option>`).join('')}
    `;
    row.podkategoria = '';
}

function renderTransferList() {
    const container = document.getElementById('addMonthTransferList');
    if (!container) return;
    
    container.innerHTML = addMonthTransferRows.map((row, i) => `
        <div class="dynamic-row">
            <select class="form-select" disabled>
                <option selected>Firmowe</option>
            </select>
            <select class="form-select" onchange="updateTransferRow(${i}, 'podkategoria', this.value)">
                ${KATEGORIE_WYDATKOW['Firmowe'].podkategorie.map(p => 
                    `<option value="${p}" ${row.podkategoria === p ? 'selected' : ''}>${p}</option>`
                ).join('')}
            </select>
            <input type="number" class="form-input amount-input" placeholder="Kwota"
                   value="${row.kwota || ''}"
                   onchange="updateTransferRow(${i}, 'kwota', parseFloat(this.value) || 0)">
            <span class="currency-label">PLN</span>
            <button type="button" class="btn btn-icon btn-danger" onclick="removeTransferRow(${i})">
                ${BUDGET_ICONS['trash']}
            </button>
        </div>
    `).join('');
    
    updateAddMonthSummary();
}

function addTransferRow() {
    addMonthTransferRows.push({ kategoria: 'Firmowe', podkategoria: 'Przelew na rach. firmowy', kwota: 0, waluta: 'PLN' });
    renderTransferList();
}

function removeTransferRow(index) {
    addMonthTransferRows.splice(index, 1);
    renderTransferList();
}

function updateTransferRow(index, field, value) {
    addMonthTransferRows[index][field] = value;
    updateAddMonthSummary();
}

function renderRecurringList() {
    const container = document.getElementById('addMonthRecurringList');
    if (!container) return;
    
    container.innerHTML = addMonthRecurringItems.map((item, i) => `
        <div class="recurring-row ${item.zaznaczony ? '' : 'unchecked'}">
            <label class="checkbox-wrapper">
                <input type="checkbox" ${item.zaznaczony ? 'checked' : ''} 
                       onchange="toggleRecurringItem(${i})">
                <span class="recurring-name">${item.nazwa}</span>
            </label>
            <input type="number" class="form-input amount-input" 
                   value="${item.kwota}"
                   ${!item.zaznaczony ? 'disabled' : ''}
                   onchange="updateRecurringItem(${i}, parseFloat(this.value) || 0)">
            <span class="recurring-hint">${item.kwota === item.kwotaTypowa ? '≈ jak zawsze' : `typowo: ${formatMoney(item.kwotaTypowa)}`}</span>
        </div>
    `).join('');
    
    if (addMonthRecurringItems.length === 0) {
        container.innerHTML = '<p class="text-muted">Brak zdefiniowanych wydatków stałych. <a href="#" onclick="openRecurringSettings()">Dodaj szablon</a></p>';
    }
    
    updateAddMonthSummary();
}

function toggleRecurringItem(index) {
    addMonthRecurringItems[index].zaznaczony = !addMonthRecurringItems[index].zaznaczony;
    renderRecurringList();
}

function updateRecurringItem(index, value) {
    addMonthRecurringItems[index].kwota = value;
    updateAddMonthSummary();
}

function updateAddMonthSummary() {
    const sumaDochodow = addMonthIncomeRows.reduce((sum, r) => {
        const kwotaPLN = r.waluta === 'PLN' ? r.kwota : r.kwota * (currencyRates[r.waluta] || 1);
        return sum + (kwotaPLN || 0);
    }, 0);
    
    const sumaStale = addMonthRecurringItems
        .filter(r => r.zaznaczony)
        .reduce((sum, r) => sum + r.kwota, 0);
    
    const sumaZmienne = addMonthExpenseRows.reduce((sum, r) => {
        const kwotaPLN = r.waluta === 'PLN' ? r.kwota : r.kwota * (currencyRates[r.waluta] || 1);
        return sum + (kwotaPLN || 0);
    }, 0);
    
    const sumaTransfery = addMonthTransferRows.reduce((sum, r) => sum + (r.kwota || 0), 0);
    
    const bilans = sumaDochodow - sumaStale - sumaZmienne;
    const planInwest = planInwestycyjny?.kwotaMiesieczna || 0;
    const nadwyzka = bilans - sumaTransfery - planInwest;
    
    // Aktualizuj wyświetlanie
    document.getElementById('addMonthIncomeTotal').textContent = formatMoney(sumaDochodow);
    document.getElementById('addMonthRecurringTotal').textContent = formatMoney(sumaStale);
    document.getElementById('addMonthExpenseTotal').textContent = formatMoney(sumaZmienne);
    
    document.getElementById('summaryIncome').textContent = formatMoney(sumaDochodow);
    document.getElementById('summaryRecurring').textContent = formatMoney(sumaStale);
    document.getElementById('summaryVariable').textContent = formatMoney(sumaZmienne);
    document.getElementById('summaryTransfers').textContent = formatMoney(sumaTransfery);
    document.getElementById('summaryBalance').textContent = formatMoney(bilans);
    document.getElementById('summaryBalance').className = bilans >= 0 ? 'positive' : 'negative';
    document.getElementById('summaryInvestPlan').textContent = formatMoney(planInwest);
    document.getElementById('summarySurplus').textContent = formatMoney(nadwyzka);
    document.getElementById('summarySurplus').className = nadwyzka >= 0 ? 'positive' : 'negative';
}

function onMonthChange() {
    const rok = parseInt(document.getElementById('addMonthYear').value);
    const miesiac = parseInt(document.getElementById('addMonthMonth').value);
    loadRecurringExpenses(rok, miesiac);
    loadPreviousMonthHints(rok, miesiac);
}

async function handleAddMonthSubmit(e) {
    e.preventDefault();
    
    const rok = parseInt(document.getElementById('addMonthYear').value);
    const miesiac = parseInt(document.getElementById('addMonthMonth').value);
    
    try {
        showBudgetLoading(true);
        
        // Zapisz dochody
        const dochodyDoZapisu = addMonthIncomeRows
            .filter(r => r.zrodlo && r.kwota > 0)
            .map(r => ({
                rok,
                miesiac,
                zrodlo: r.zrodlo,
                podzrodlo: r.podzrodlo || '',
                pracodawca: r.pracodawca || '',
                kwotaBrutto: 0,
                kwotaNetto: r.kwota,
                waluta: r.waluta || 'PLN'
            }));
        
        if (dochodyDoZapisu.length > 0) {
            await BudgetSheets.addDochodyBulk(dochodyDoZapisu);
        }
        
        // Zapisz wydatki stałe
        const wydatkiStaleDoZapisu = addMonthRecurringItems
            .filter(r => r.zaznaczony && r.kwota > 0)
            .map(r => ({
                rok,
                miesiac,
                kategoria: r.kategoria,
                podkategoria: r.podkategoria || '',
                kwota: r.kwota,
                waluta: r.waluta || 'PLN',
                jestStaly: true
            }));
        
        // Zapisz wydatki zmienne
        const wydatkiZmienneDoZapisu = addMonthExpenseRows
            .filter(r => r.kategoria && r.kwota > 0)
            .map(r => ({
                rok,
                miesiac,
                kategoria: r.kategoria,
                podkategoria: r.podkategoria || '',
                kwota: r.kwota,
                waluta: r.waluta || 'PLN',
                jestStaly: false
            }));
        
        // Zapisz transfery
        const transferyDoZapisu = addMonthTransferRows
            .filter(r => r.kwota > 0)
            .map(r => ({
                rok,
                miesiac,
                kategoria: 'Firmowe',
                podkategoria: r.podkategoria || 'Przelew na rach. firmowy',
                kwota: r.kwota,
                waluta: 'PLN',
                jestStaly: false
            }));
        
        const wszystkieWydatki = [...wydatkiStaleDoZapisu, ...wydatkiZmienneDoZapisu, ...transferyDoZapisu];
        if (wszystkieWydatki.length > 0) {
            await BudgetSheets.addWydatkiBulk(wszystkieWydatki);
        }
        
        // Odśwież dane
        await refreshBudgetData();
        
        // Ustaw widok na nowo dodany miesiąc
        selectedOverviewMonth = { rok, miesiac };
        
        closeAddMonthModal();
        showToast(`Dane za ${formatMiesiac(rok, miesiac)} zapisane!`, 'success');
        
    } catch (error) {
        console.error('Błąd zapisu danych:', error);
        showToast('Nie udało się zapisać danych', 'error');
    } finally {
        showBudgetLoading(false);
    }
}

function openRecurringSettings() {
    // TODO: Otwórz modal z ustawieniami wydatków stałych
    showToast('Zarządzanie wydatkami stałymi - wkrótce', 'info');
}
