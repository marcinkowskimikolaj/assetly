/**
 * Assetly - Budget Income
 * Tab: Dochody
 */

let incomeViewYear = new Date().getFullYear();
let selectedIncomeSource = null;

function renderBudgetIncome() {
    const container = document.getElementById('tab-income');
    if (!container) return;
    
    const dochodyRoku = dochody.filter(d => d.rok === incomeViewYear);
    const historiaWyn = getHistoriaWynagrodzen();
    const zrodlaStats = getZrodlaStats(incomeViewYear);
    
    // Główny pracodawca
    const glownyPracodawca = Object.entries(historiaWyn)
        .sort((a, b) => b[1].liczbaMiesiecy - a[1].liczbaMiesiecy)[0];
    
    container.innerHTML = `
        <div class="income-container">
            
            <!-- Header -->
            <div class="income-header">
                <div class="year-selector">
                    <button class="btn btn-icon" onclick="changeIncomeYear(-1)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
                    </button>
                    <span class="year-label">${incomeViewYear}</span>
                    <button class="btn btn-icon" onclick="changeIncomeYear(1)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,6 15,12 9,18"/></svg>
                    </button>
                </div>
                <button class="btn btn-primary" onclick="openAddIncomeModal()">
                    ${BUDGET_ICONS['plus']} Dodaj dochód
                </button>
            </div>
            
            <!-- Podsumowanie roku -->
            <div class="card income-year-summary">
                <div class="year-summary-stats">
                    <div class="year-stat">
                        <span class="year-stat-label">Suma dochodów ${incomeViewYear}</span>
                        <span class="year-stat-value income">${formatMoney(zrodlaStats.suma)}</span>
                    </div>
                    <div class="year-stat">
                        <span class="year-stat-label">Średnia miesięczna</span>
                        <span class="year-stat-value">${formatMoney(zrodlaStats.srednia)}</span>
                    </div>
                    <div class="year-stat">
                        <span class="year-stat-label">Miesięcy z dochodami</span>
                        <span class="year-stat-value">${zrodlaStats.liczbaMiesiecy}</span>
                    </div>
                </div>
            </div>
            
            <!-- Historia wynagrodzeń -->
            ${glownyPracodawca ? `
            <div class="card income-salary-card">
                <div class="salary-header">
                    <h3>Historia wynagrodzeń</h3>
                    ${glownyPracodawca[1].ostatniaPodwyzka ? `
                        <span class="last-raise">
                            Ostatnia podwyżka: ${glownyPracodawca[1].ostatniaPodwyzka.data} 
                            (+${formatMoney(glownyPracodawca[1].ostatniaPodwyzka.zmiana)}, 
                            ${formatPercent(glownyPracodawca[1].ostatniaPodwyzka.zmianaProcent)})
                        </span>
                    ` : ''}
                </div>
                
                ${Object.entries(historiaWyn).map(([pracodawca, dane]) => `
                    <div class="employer-section">
                        <div class="employer-header">
                            <span class="employer-name">${BUDGET_ICONS['briefcase']} ${pracodawca}</span>
                            <span class="employer-current">Obecne: ${formatMoney(dane.obecnaKwota)}</span>
                        </div>
                        
                        <div class="salary-chart">
                            ${renderSalaryChart(dane.historia)}
                        </div>
                        
                        ${dane.podwyzki.length > 0 ? `
                            <div class="raises-list">
                                <h4>Historia podwyżek:</h4>
                                ${dane.podwyzki.map(p => `
                                    <div class="raise-item">
                                        <span class="raise-date">${p.data}</span>
                                        <span class="raise-change positive">+${formatMoney(p.zmiana)}</span>
                                        <span class="raise-percent">(${formatPercent(p.zmianaProcent)})</span>
                                        <span class="raise-new">${formatMoney(p.nowa)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        
                        <div class="employer-stats">
                            <span>Wzrost całkowity: <strong class="positive">+${formatMoney(dane.wzrostCalkowity)}</strong> (${formatPercent(dane.wzrostProcentowy)})</span>
                            <span>Okres: ${dane.liczbaMiesiecy} miesięcy</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <!-- Źródła dochodów -->
            <div class="card income-sources-card">
                <h3>Źródła dochodów w ${incomeViewYear}</h3>
                
                <div class="sources-chart">
                    ${renderSourcesPieChart(zrodlaStats)}
                </div>
                
                <div class="sources-list">
                    ${zrodlaStats.zrodla.map(z => `
                        <div class="source-row" onclick="selectIncomeSource('${z.zrodlo}')">
                            <div class="source-icon" style="color: ${getZrodloColor(z.zrodlo)}">
                                ${getZrodloIcon(z.zrodlo)}
                            </div>
                            <div class="source-info">
                                <span class="source-name">${z.zrodlo}</span>
                                <span class="source-count">${z.count} wpływów</span>
                            </div>
                            <div class="source-amount">${formatMoney(z.suma)}</div>
                            <div class="source-percent">${z.udzial.toFixed(1)}%</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Lista miesięcy -->
            <div class="card income-months-card">
                <h3>Dochody per miesiąc</h3>
                <div class="income-months-list">
                    ${renderIncomeMonths(incomeViewYear)}
                </div>
            </div>
            
        </div>
    `;
}

function renderSalaryChart(historia) {
    if (historia.length === 0) return '<p class="text-muted">Brak danych</p>';
    
    const maxKwota = Math.max(...historia.map(h => h.kwota));
    const minKwota = Math.min(...historia.map(h => h.kwota));
    const range = maxKwota - minKwota || 1;
    
    // Ostatnie 12 miesięcy
    const ostatnie = historia.slice(-12);
    
    return `
        <div class="salary-line-chart">
            <div class="chart-y-axis">
                <span>${formatMoneyShort(maxKwota)}</span>
                <span>${formatMoneyShort(minKwota)}</span>
            </div>
            <div class="chart-area">
                <svg viewBox="0 0 ${ostatnie.length * 40} 100" preserveAspectRatio="none">
                    <polyline
                        points="${ostatnie.map((h, i) => {
                            const x = i * 40 + 20;
                            const y = 100 - ((h.kwota - minKwota) / range) * 80 - 10;
                            return `${x},${y}`;
                        }).join(' ')}"
                        fill="none"
                        stroke="#10B981"
                        stroke-width="2"
                    />
                    ${ostatnie.map((h, i) => {
                        const x = i * 40 + 20;
                        const y = 100 - ((h.kwota - minKwota) / range) * 80 - 10;
                        return `<circle cx="${x}" cy="${y}" r="4" fill="#10B981"/>`;
                    }).join('')}
                </svg>
            </div>
            <div class="chart-x-axis">
                ${ostatnie.map(h => `<span>${h.data.split('-')[1]}'${h.data.split('-')[0].slice(2)}</span>`).join('')}
            </div>
        </div>
    `;
}

function renderSourcesPieChart(stats) {
    if (stats.zrodla.length === 0) return '';
    
    const colors = stats.zrodla.map(z => getZrodloColor(z.zrodlo));
    let currentAngle = 0;
    
    const slices = stats.zrodla.map((z, i) => {
        const angle = (z.udzial / 100) * 360;
        const startAngle = currentAngle;
        currentAngle += angle;
        
        const startRad = (startAngle - 90) * Math.PI / 180;
        const endRad = (currentAngle - 90) * Math.PI / 180;
        
        const x1 = 50 + 40 * Math.cos(startRad);
        const y1 = 50 + 40 * Math.sin(startRad);
        const x2 = 50 + 40 * Math.cos(endRad);
        const y2 = 50 + 40 * Math.sin(endRad);
        
        const largeArc = angle > 180 ? 1 : 0;
        
        return `<path d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${colors[i]}"/>`;
    });
    
    return `
        <div class="pie-chart-container">
            <svg viewBox="0 0 100 100" class="pie-chart">
                ${slices.join('')}
                <circle cx="50" cy="50" r="25" fill="white"/>
            </svg>
        </div>
    `;
}

function renderIncomeMonths(rok) {
    const miesiace = [];
    for (let m = 12; m >= 1; m--) {
        const dochodyMies = dochody.filter(d => d.rok === rok && d.miesiac === m);
        if (dochodyMies.length > 0) {
            const suma = dochodyMies.reduce((s, d) => s + d.kwotaPLN, 0);
            miesiace.push({ miesiac: m, dochody: dochodyMies, suma });
        }
    }
    
    if (miesiace.length === 0) {
        return '<p class="text-muted">Brak dochodów w tym roku</p>';
    }
    
    return miesiace.map(m => `
        <div class="income-month-row">
            <span class="income-month-name">${NAZWY_MIESIECY[m.miesiac]}</span>
            <div class="income-month-sources">
                ${m.dochody.map(d => `
                    <span class="income-source-badge" style="background: ${getZrodloColor(d.zrodlo)}20; color: ${getZrodloColor(d.zrodlo)}">
                        ${d.zrodlo}: ${formatMoney(d.kwotaPLN)}
                    </span>
                `).join('')}
            </div>
            <span class="income-month-total">${formatMoney(m.suma)}</span>
        </div>
    `).join('');
}

function getZrodlaStats(rok) {
    const dochodyRoku = dochody.filter(d => d.rok === rok);
    
    const perZrodlo = {};
    let suma = 0;
    
    dochodyRoku.forEach(d => {
        if (!perZrodlo[d.zrodlo]) {
            perZrodlo[d.zrodlo] = { suma: 0, count: 0, miesiace: new Set() };
        }
        perZrodlo[d.zrodlo].suma += d.kwotaPLN;
        perZrodlo[d.zrodlo].count++;
        perZrodlo[d.zrodlo].miesiace.add(d.miesiac);
        suma += d.kwotaPLN;
    });
    
    const liczbaMiesiecy = new Set(dochodyRoku.map(d => d.miesiac)).size;
    
    const zrodla = Object.entries(perZrodlo)
        .map(([zrodlo, data]) => ({
            zrodlo,
            suma: data.suma,
            count: data.count,
            udzial: suma > 0 ? (data.suma / suma) * 100 : 0
        }))
        .sort((a, b) => b.suma - a.suma);
    
    return {
        suma,
        srednia: liczbaMiesiecy > 0 ? suma / liczbaMiesiecy : 0,
        liczbaMiesiecy,
        zrodla
    };
}

function changeIncomeYear(delta) {
    incomeViewYear += delta;
    renderBudgetIncome();
}

function selectIncomeSource(zrodlo) {
    selectedIncomeSource = zrodlo;
    showIncomeSourceHistory(zrodlo);
}

function showIncomeSourceHistory(zrodlo) {
    const dochodyZrodla = dochody.filter(d => d.zrodlo === zrodlo);
    
    // Grupuj po miesiącach
    const perMiesiac = {};
    dochodyZrodla.forEach(d => {
        const key = `${d.rok}-${String(d.miesiac).padStart(2, '0')}`;
        if (!perMiesiac[key]) {
            perMiesiac[key] = { suma: 0, count: 0 };
        }
        perMiesiac[key].suma += d.kwotaPLN;
        perMiesiac[key].count++;
    });
    
    const historia = Object.entries(perMiesiac)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12);
    
    const srednia = historia.length > 0 ? 
        historia.reduce((s, [_, d]) => s + d.suma, 0) / historia.length : 0;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'incomeSourceModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 style="color: ${getZrodloColor(zrodlo)}">
                    ${getZrodloIcon(zrodlo)} ${zrodlo} - historia
                </h3>
                <button class="modal-close" onclick="closeIncomeSourceModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="income-source-stats">
                    <div class="stat">
                        <span class="stat-label">Średnia miesięczna</span>
                        <span class="stat-value">${formatMoney(srednia)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Łącznie wpływów</span>
                        <span class="stat-value">${dochodyZrodla.length}</span>
                    </div>
                </div>
                
                <div class="income-history-list">
                    ${historia.map(([okres, data]) => {
                        const [rok, mies] = okres.split('-').map(Number);
                        return `
                            <div class="history-row">
                                <span class="history-date">${formatMiesiacShort(rok, mies)}</span>
                                <span class="history-amount">${formatMoney(data.suma)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeIncomeSourceModal()">Zamknij</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeIncomeSourceModal() {
    document.getElementById('incomeSourceModal')?.remove();
}

function openAddIncomeModal() {
    const ostatni = getOstatnioZamknietyMiesiac();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'addIncomeModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Dodaj dochód</h3>
                <button class="modal-close" onclick="closeAddIncomeModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <form id="addIncomeForm" onsubmit="handleAddIncome(event)">
                <div class="modal-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Miesiąc</label>
                            <select id="incomeMonth" class="form-select">
                                ${NAZWY_MIESIECY.slice(1).map((n, i) => 
                                    `<option value="${i+1}" ${i+1 === ostatni.miesiac ? 'selected' : ''}>${n}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Rok</label>
                            <select id="incomeYear" class="form-select">
                                ${[2026, 2025, 2024, 2023].map(r => 
                                    `<option value="${r}" ${r === ostatni.rok ? 'selected' : ''}>${r}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Źródło</label>
                        <select id="incomeSource" class="form-select" required onchange="updateIncomeSubsource()">
                            <option value="">Wybierz...</option>
                            ${Object.keys(ZRODLA_DOCHODOW).map(z => 
                                `<option value="${z}">${z}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Podźródło</label>
                        <select id="incomeSubsource" class="form-select">
                            <option value="">Wybierz źródło najpierw...</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Pracodawca / Opis</label>
                        <input type="text" id="incomeEmployer" class="form-input" placeholder="np. Nazwa firmy">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Kwota netto</label>
                            <input type="number" id="incomeAmount" class="form-input" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Waluta</label>
                            <select id="incomeCurrency" class="form-select">
                                ${WALUTY.map(w => `<option value="${w}">${w}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Notatka (opcjonalnie)</label>
                        <textarea id="incomeNote" class="form-textarea" rows="2"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeAddIncomeModal()">Anuluj</button>
                    <button type="submit" class="btn btn-primary">Zapisz</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeAddIncomeModal() {
    document.getElementById('addIncomeModal')?.remove();
}

function updateIncomeSubsource() {
    const zrodlo = document.getElementById('incomeSource').value;
    const select = document.getElementById('incomeSubsource');
    
    if (!zrodlo || !ZRODLA_DOCHODOW[zrodlo]) {
        select.innerHTML = '<option value="">Wybierz źródło najpierw...</option>';
        return;
    }
    
    const podzrodla = ZRODLA_DOCHODOW[zrodlo].podzrodla || [];
    select.innerHTML = `
        <option value="">Brak</option>
        ${podzrodla.map(p => `<option value="${p}">${p}</option>`).join('')}
    `;
}

async function handleAddIncome(e) {
    e.preventDefault();
    
    const rok = parseInt(document.getElementById('incomeYear').value);
    const miesiac = parseInt(document.getElementById('incomeMonth').value);
    const zrodlo = document.getElementById('incomeSource').value;
    const podzrodlo = document.getElementById('incomeSubsource').value;
    const pracodawca = document.getElementById('incomeEmployer').value;
    const kwota = parseFloat(document.getElementById('incomeAmount').value);
    const waluta = document.getElementById('incomeCurrency').value;
    const notatka = document.getElementById('incomeNote').value;
    
    try {
        showBudgetLoading(true);
        
        await BudgetSheets.addDochod({
            rok,
            miesiac,
            zrodlo,
            podzrodlo,
            pracodawca,
            kwotaBrutto: 0,
            kwotaNetto: kwota,
            waluta,
            notatka
        });
        
        await refreshBudgetData();
        closeAddIncomeModal();
        showToast('Dochód dodany!', 'success');
        
    } catch (error) {
        console.error('Błąd dodawania dochodu:', error);
        showToast('Nie udało się dodać dochodu', 'error');
    } finally {
        showBudgetLoading(false);
    }
}
