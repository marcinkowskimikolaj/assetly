/**
 * Assetly - Budget Trends
 * Tab: Trendy i analiza
 */

let trendsTimeRange = 12; // miesięcy

function renderBudgetTrends() {
    const container = document.getElementById('tab-trends');
    if (!container) return;
    
    const miesiace = getMiesiaceZDanych().slice(0, trendsTimeRange);
    
    if (miesiace.length < 2) {
        container.innerHTML = `
            <div class="trends-container">
                <div class="no-data-card">
                    <h3>Za mało danych</h3>
                    <p>Potrzebujemy danych z przynajmniej 2 miesięcy, aby pokazać trendy.</p>
                </div>
            </div>
        `;
        return;
    }
    
    const historia = miesiace.map(m => getPodsumowanieMiesiaca(m.rok, m.miesiac)).reverse();
    const sezonowosc = analyzeSeasonality(historia);
    const driftKategorii = analyzeCategoryDrift();
    const stopaOszczednosci = analyzeSavingsRate(historia);
    
    container.innerHTML = `
        <div class="trends-container">
            
            <!-- Time range selector -->
            <div class="trends-header">
                <h2>Trendy i analiza</h2>
                <div class="time-range-selector">
                    <button class="btn ${trendsTimeRange === 6 ? 'btn-primary' : 'btn-secondary'}" onclick="setTrendsRange(6)">6 mies.</button>
                    <button class="btn ${trendsTimeRange === 12 ? 'btn-primary' : 'btn-secondary'}" onclick="setTrendsRange(12)">12 mies.</button>
                    <button class="btn ${trendsTimeRange === 24 ? 'btn-primary' : 'btn-secondary'}" onclick="setTrendsRange(24)">24 mies.</button>
                </div>
            </div>
            
            <!-- Główny wykres: Dochody vs Wydatki vs Oszczędności -->
            <div class="card trends-main-chart">
                <h3>Dochody vs Wydatki vs Oszczędności</h3>
                <div class="chart-container">
                    ${renderMainTrendChart(historia)}
                </div>
                <div class="chart-legend">
                    <span class="legend-item"><span class="legend-color income"></span> Dochody</span>
                    <span class="legend-item"><span class="legend-color expense"></span> Wydatki</span>
                    <span class="legend-item"><span class="legend-color savings"></span> Oszczędności</span>
                </div>
            </div>
            
            <!-- Stopa oszczędności -->
            <div class="card trends-savings-rate">
                <h3>Stopa oszczędności</h3>
                <div class="savings-rate-stats">
                    <div class="stat-box">
                        <span class="stat-label">Obecna (ostatni mies.)</span>
                        <span class="stat-value ${stopaOszczednosci.obecna >= 20 ? 'positive' : 'warning'}">
                            ${stopaOszczednosci.obecna.toFixed(1)}%
                        </span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Średnia (${trendsTimeRange} mies.)</span>
                        <span class="stat-value">${stopaOszczednosci.srednia.toFixed(1)}%</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Trend</span>
                        <span class="stat-value ${stopaOszczednosci.trend >= 0 ? 'positive' : 'negative'}">
                            ${stopaOszczednosci.trend >= 0 ? '↑' : '↓'} ${Math.abs(stopaOszczednosci.trend).toFixed(1)}%/mies
                        </span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Cel</span>
                        <span class="stat-value">${ustawienia.celOszczednosciProcent || 20}%</span>
                    </div>
                </div>
                <div class="savings-rate-chart">
                    ${renderSavingsRateChart(historia)}
                </div>
            </div>
            
            <!-- Sezonowość wydatków -->
            <div class="card trends-seasonality">
                <h3>Sezonowość wydatków</h3>
                <p class="text-muted">Średnie wydatki w poszczególnych miesiącach roku</p>
                <div class="seasonality-chart">
                    ${renderSeasonalityChart(sezonowosc)}
                </div>
                <div class="seasonality-insights">
                    ${renderSeasonalityInsights(sezonowosc)}
                </div>
            </div>
            
            <!-- Drift kategorii -->
            <div class="card trends-category-drift">
                <h3>Drift kategorii (wzrosty/spadki)</h3>
                <p class="text-muted">Porównanie ostatnich 3 miesięcy vs wcześniejszych 3 miesięcy</p>
                <div class="drift-list">
                    ${renderCategoryDrift(driftKategorii)}
                </div>
            </div>
            
            <!-- Wykres wydatków per kategoria -->
            <div class="card trends-category-stacked">
                <h3>Struktura wydatków w czasie</h3>
                <div class="stacked-chart">
                    ${renderStackedCategoryChart(historia)}
                </div>
            </div>
            
        </div>
    `;
}

function setTrendsRange(months) {
    trendsTimeRange = months;
    renderBudgetTrends();
}

function renderMainTrendChart(historia) {
    if (historia.length === 0) return '<p class="text-muted">Brak danych</p>';
    
    const maxValue = Math.max(
        ...historia.map(h => Math.max(h.dochody, h.wydatki))
    );
    
    const width = 800;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const xStep = chartWidth / (historia.length - 1 || 1);
    
    const getY = (value) => padding.top + chartHeight - (value / maxValue) * chartHeight;
    
    // Punkty dla linii
    const dochodyPoints = historia.map((h, i) => `${padding.left + i * xStep},${getY(h.dochody)}`).join(' ');
    const wydatkiPoints = historia.map((h, i) => `${padding.left + i * xStep},${getY(h.wydatki)}`).join(' ');
    const oszczednosciPoints = historia.map((h, i) => `${padding.left + i * xStep},${getY(h.bilans > 0 ? h.bilans : 0)}`).join(' ');
    
    return `
        <svg viewBox="0 0 ${width} ${height}" class="line-chart">
            <!-- Grid lines -->
            ${[0, 0.25, 0.5, 0.75, 1].map(p => `
                <line x1="${padding.left}" y1="${padding.top + (1-p) * chartHeight}" 
                      x2="${width - padding.right}" y2="${padding.top + (1-p) * chartHeight}" 
                      stroke="#e5e7eb" stroke-dasharray="4"/>
                <text x="${padding.left - 10}" y="${padding.top + (1-p) * chartHeight + 4}" 
                      text-anchor="end" fill="#6b7280" font-size="10">
                    ${formatMoneyShort(maxValue * p)}
                </text>
            `).join('')}
            
            <!-- Lines -->
            <polyline points="${dochodyPoints}" fill="none" stroke="#10B981" stroke-width="2"/>
            <polyline points="${wydatkiPoints}" fill="none" stroke="#EF4444" stroke-width="2"/>
            <polyline points="${oszczednosciPoints}" fill="none" stroke="#3B82F6" stroke-width="2" stroke-dasharray="4"/>
            
            <!-- X axis labels -->
            ${historia.map((h, i) => `
                <text x="${padding.left + i * xStep}" y="${height - 10}" 
                      text-anchor="middle" fill="#6b7280" font-size="10">
                    ${NAZWY_MIESIECY_SHORT[h.miesiac]}'${String(h.rok).slice(2)}
                </text>
            `).join('')}
        </svg>
    `;
}

function renderSavingsRateChart(historia) {
    if (historia.length === 0) return '';
    
    const cel = ustawienia.celOszczednosciProcent || 20;
    const maxRate = Math.max(cel + 10, ...historia.map(h => h.stopaOszczednosci));
    const minRate = Math.min(0, ...historia.map(h => h.stopaOszczednosci));
    const range = maxRate - minRate;
    
    return `
        <div class="bar-chart savings-chart">
            <div class="chart-target-line" style="bottom: ${((cel - minRate) / range) * 100}%">
                <span>Cel ${cel}%</span>
            </div>
            ${historia.map(h => {
                const height = ((h.stopaOszczednosci - minRate) / range) * 100;
                const isPositive = h.stopaOszczednosci >= 0;
                const meetsGoal = h.stopaOszczednosci >= cel;
                
                return `
                    <div class="bar-column">
                        <div class="bar ${isPositive ? (meetsGoal ? 'success' : 'warning') : 'negative'}" 
                             style="height: ${Math.abs(height)}%; ${!isPositive ? 'transform: scaleY(-1);' : ''}">
                        </div>
                        <span class="bar-label">${NAZWY_MIESIECY_SHORT[h.miesiac]}</span>
                        <span class="bar-value">${h.stopaOszczednosci.toFixed(0)}%</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function analyzeSeasonality(historia) {
    // Grupuj po miesiącach roku
    const perMiesiac = {};
    
    historia.forEach(h => {
        if (!perMiesiac[h.miesiac]) {
            perMiesiac[h.miesiac] = [];
        }
        perMiesiac[h.miesiac].push(h.wydatki);
    });
    
    // Oblicz średnie
    const srednie = {};
    Object.entries(perMiesiac).forEach(([mies, values]) => {
        srednie[mies] = values.reduce((s, v) => s + v, 0) / values.length;
    });
    
    // Znajdź min/max
    const sredniaRoczna = Object.values(srednie).reduce((s, v) => s + v, 0) / Object.keys(srednie).length;
    
    return {
        perMiesiac: srednie,
        sredniaRoczna,
        najdrozszy: Object.entries(srednie).sort((a, b) => b[1] - a[1])[0],
        najtanszy: Object.entries(srednie).sort((a, b) => a[1] - b[1])[0]
    };
}

function renderSeasonalityChart(sezonowosc) {
    const maxValue = Math.max(...Object.values(sezonowosc.perMiesiac));
    
    return `
        <div class="seasonality-bars">
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                const value = sezonowosc.perMiesiac[m] || 0;
                const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const isMax = sezonowosc.najdrozszy && parseInt(sezonowosc.najdrozszy[0]) === m;
                const isMin = sezonowosc.najtanszy && parseInt(sezonowosc.najtanszy[0]) === m;
                
                return `
                    <div class="season-bar-col">
                        <div class="season-bar ${isMax ? 'max' : isMin ? 'min' : ''}" 
                             style="height: ${height}%"
                             title="${NAZWY_MIESIECY[m]}: ${formatMoney(value)}">
                        </div>
                        <span class="season-label">${NAZWY_MIESIECY_SHORT[m]}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderSeasonalityInsights(sezonowosc) {
    if (!sezonowosc.najdrozszy || !sezonowosc.najtanszy) return '';
    
    const najdrozszyMies = parseInt(sezonowosc.najdrozszy[0]);
    const najtanszyMies = parseInt(sezonowosc.najtanszy[0]);
    const roznica = ((sezonowosc.najdrozszy[1] - sezonowosc.najtanszy[1]) / sezonowosc.sredniaRoczna) * 100;
    
    return `
        <div class="insights-list">
            <div class="insight-item">
                <span class="insight-icon">📈</span>
                <span>Najdroższy miesiąc: <strong>${NAZWY_MIESIECY[najdrozszyMies]}</strong> (śr. ${formatMoney(sezonowosc.najdrozszy[1])})</span>
            </div>
            <div class="insight-item">
                <span class="insight-icon">📉</span>
                <span>Najtańszy miesiąc: <strong>${NAZWY_MIESIECY[najtanszyMies]}</strong> (śr. ${formatMoney(sezonowosc.najtanszy[1])})</span>
            </div>
            <div class="insight-item">
                <span class="insight-icon">📊</span>
                <span>Rozpiętość sezonowa: <strong>${roznica.toFixed(0)}%</strong> różnicy między miesiącami</span>
            </div>
        </div>
    `;
}

function analyzeCategoryDrift() {
    const miesiace = getMiesiaceZDanych();
    
    if (miesiace.length < 6) return [];
    
    const ostatnie3 = miesiace.slice(0, 3);
    const wczesniejsze3 = miesiace.slice(3, 6);
    
    const kategorie = Object.keys(KATEGORIE_WYDATKOW).filter(k => !KATEGORIE_WYDATKOW[k].isTransfer);
    
    return kategorie.map(kat => {
        let sumaOstatnie = 0;
        let sumaWczesniejsze = 0;
        
        ostatnie3.forEach(m => {
            const p = getPodsumowanieMiesiaca(m.rok, m.miesiac);
            sumaOstatnie += p.wydatkiPerKategoria[kat]?.suma || 0;
        });
        
        wczesniejsze3.forEach(m => {
            const p = getPodsumowanieMiesiaca(m.rok, m.miesiac);
            sumaWczesniejsze += p.wydatkiPerKategoria[kat]?.suma || 0;
        });
        
        const srOstatnie = sumaOstatnie / 3;
        const srWczesniejsze = sumaWczesniejsze / 3;
        const zmiana = srWczesniejsze > 0 ? ((srOstatnie - srWczesniejsze) / srWczesniejsze) * 100 : 0;
        
        return {
            kategoria: kat,
            srOstatnie,
            srWczesniejsze,
            zmiana
        };
    }).filter(k => Math.abs(k.zmiana) > 5 && k.srWczesniejsze > 0)
      .sort((a, b) => Math.abs(b.zmiana) - Math.abs(a.zmiana));
}

function renderCategoryDrift(drift) {
    if (drift.length === 0) {
        return '<p class="text-muted">Brak znaczących zmian w kategoriach</p>';
    }
    
    return drift.slice(0, 8).map(d => `
        <div class="drift-item ${d.zmiana > 0 ? 'up' : 'down'}">
            <div class="drift-category" style="color: ${getKategoriaColor(d.kategoria)}">
                ${getKategoriaIcon(d.kategoria)} ${d.kategoria}
            </div>
            <div class="drift-values">
                <span class="drift-old">${formatMoney(d.srWczesniejsze)}</span>
                <span class="drift-arrow">${d.zmiana > 0 ? '→' : '→'}</span>
                <span class="drift-new">${formatMoney(d.srOstatnie)}</span>
            </div>
            <div class="drift-change ${d.zmiana > 0 ? 'negative' : 'positive'}">
                ${d.zmiana > 0 ? '+' : ''}${d.zmiana.toFixed(0)}%
            </div>
        </div>
    `).join('');
}

function analyzeSavingsRate(historia) {
    if (historia.length === 0) {
        return { obecna: 0, srednia: 0, trend: 0 };
    }
    
    const obecna = historia[historia.length - 1].stopaOszczednosci;
    const srednia = historia.reduce((s, h) => s + h.stopaOszczednosci, 0) / historia.length;
    
    // Trend - regresja liniowa
    let trend = 0;
    if (historia.length >= 3) {
        const n = historia.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = historia.reduce((s, h) => s + h.stopaOszczednosci, 0);
        const sumXY = historia.reduce((s, h, i) => s + i * h.stopaOszczednosci, 0);
        const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
        
        trend = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }
    
    return { obecna, srednia, trend };
}

function renderStackedCategoryChart(historia) {
    if (historia.length === 0) return '<p class="text-muted">Brak danych</p>';
    
    // Pobierz wszystkie kategorie
    const allCategories = new Set();
    historia.forEach(h => {
        Object.keys(h.wydatkiPerKategoria).forEach(k => allCategories.add(k));
    });
    
    const kategorie = Array.from(allCategories).filter(k => !KATEGORIE_WYDATKOW[k]?.isTransfer);
    const maxTotal = Math.max(...historia.map(h => h.wydatki));
    
    return `
        <div class="stacked-bar-chart">
            ${historia.map(h => {
                let currentY = 0;
                
                return `
                    <div class="stacked-column">
                        <div class="stacked-bars" style="height: ${(h.wydatki / maxTotal) * 100}%">
                            ${kategorie.map(kat => {
                                const value = h.wydatkiPerKategoria[kat]?.suma || 0;
                                const percent = h.wydatki > 0 ? (value / h.wydatki) * 100 : 0;
                                
                                if (percent < 1) return '';
                                
                                return `
                                    <div class="stacked-segment" 
                                         style="height: ${percent}%; background: ${getKategoriaColor(kat)}"
                                         title="${kat}: ${formatMoney(value)}">
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <span class="stacked-label">${NAZWY_MIESIECY_SHORT[h.miesiac]}</span>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="stacked-legend">
            ${kategorie.slice(0, 6).map(kat => `
                <span class="legend-item">
                    <span class="legend-color" style="background: ${getKategoriaColor(kat)}"></span>
                    ${kat}
                </span>
            `).join('')}
        </div>
    `;
}
