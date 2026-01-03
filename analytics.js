/**
 * Assetly - Analytics Module
 * Główna logika i nawigacja
 */

// Stan modułu
let analyticsInitialized = false;
let currentAnalyticsTab = 'networth';
let allAnalyticsAssets = [];
let analyticsSnapshots = [];
let analyticsMilestones = {}; // Obiekt: { 'all': [...], 'Inwestycje': [...], ... }
let currentCategoryValues = {}; // Wartości per kategoria: { 'all': 100000, 'Inwestycje': 50000, ... }
let currentChartRange = 'all';
let currentChartType = 'line';
let selectedAssetForAnalysis = null;

// Mapowanie tabów na kategorie kamieni milowych
const TAB_TO_MILESTONE_CATEGORY = {
    'networth': 'all',
    'investments': 'Inwestycje',
    'cash': 'Gotówka',
    'accounts': 'Konta bankowe'
};

// ═══════════════════════════════════════════════════════════
// INICJALIZACJA
// ═══════════════════════════════════════════════════════════

async function initAnalytics() {
    if (!requireAuth()) return;
    
    try {
        await initAuth();
        
        // Upewnij się, że zakładki istnieją
        await AnalyticsSheets.ensureSheetsExist();
        
        // Załaduj dane
        await loadAnalyticsData();
        
        // Sprawdź i utwórz snapshot jeśli potrzeba
        await checkForSnapshot();
        
        // Setup UI
        setupAnalyticsEventListeners();
        
        // Renderuj pierwszy tab
        switchAnalyticsTab('networth');
        
        analyticsInitialized = true;
        
    } catch (error) {
        console.error('Błąd inicjalizacji modułu Analityka:', error);
        showToast('Błąd ładowania modułu Analityka', 'error');
    }
}

async function loadAnalyticsData() {
    showAnalyticsLoading(true);
    
    try {
        const sheetsAPI = createSheetsAPI(CONFIG.SPREADSHEET_ID);
        
        // Pobierz WSZYSTKIE dane równolegle w jednym zapytaniu
        const [assets, snapshots, milestones, _] = await Promise.all([
            sheetsAPI.getAllAssets(),
            AnalyticsSheets.getSnapshots(),
            AnalyticsSheets.getMilestones(),
            fetchCurrencyRates()
        ]);
        
        allAnalyticsAssets = assets;
        analyticsSnapshots = snapshots;
        
        // Oblicz wartości per kategoria (lokalne obliczenia, brak API)
        currentCategoryValues = calculateCategoryValues();
        
        // Pobierz kamienie milowe ze statusem - przekaż już pobrane snapshoty
        analyticsMilestones = await AnalyticsMilestones.getAllMilestonesWithStatus(
            currentCategoryValues, 
            snapshots
        );
        
        // Sprawdź nowo osiągnięte - przekaż już pobrane milestones
        const newlyAchieved = await AnalyticsMilestones.checkAndUpdateAchievements(
            currentCategoryValues,
            milestones
        );
        
        if (newlyAchieved.length > 0) {
            newlyAchieved.forEach(item => {
                const label = AnalyticsMilestones.getCategoryLabel(item.kategoria);
                showToast(`🎉 Osiągnięto kamień milowy: ${formatMoney(item.wartosc)} (${label})!`, 'success');
            });
        }
        
    } catch (error) {
        console.error('Błąd ładowania danych:', error);
        throw error;
    } finally {
        showAnalyticsLoading(false);
    }
}

async function checkForSnapshot() {
    const result = await AnalyticsSnapshots.checkAndCreateSnapshot(allAnalyticsAssets);
    if (result.created) {
        showToast(`Zapisano stan majątku na ${result.date}`, 'info');
        // Przeładuj snapshoty
        analyticsSnapshots = await AnalyticsSheets.getSnapshots();
    }
}

function setupAnalyticsEventListeners() {
    // Nawigacja tabów
    document.querySelectorAll('.analytics-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchAnalyticsTab(tab);
        });
    });
    
    // Wylogowanie
    document.getElementById('logoutBtn')?.addEventListener('click', handleGoogleLogout);
}

// ═══════════════════════════════════════════════════════════
// NAWIGACJA TABÓW
// ═══════════════════════════════════════════════════════════

function switchAnalyticsTab(tabName) {
    currentAnalyticsTab = tabName;
    
    // Aktualizuj przyciski
    document.querySelectorAll('.analytics-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Aktualizuj zawartość
    document.querySelectorAll('.analytics-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `analytics-${tabName}`);
    });
    
    // Renderuj zawartość
    switch (tabName) {
        case 'networth':
            renderDataTab(null);
            break;
        case 'investments':
            renderDataTab('Inwestycje');
            break;
        case 'cash':
            renderDataTab('Gotówka');
            break;
        case 'accounts':
            renderDataTab('Konta bankowe');
            break;
        case 'ai':
            renderAITab();
            break;
    }
}

// ═══════════════════════════════════════════════════════════
// RENDEROWANIE TABÓW DANYCH
// ═══════════════════════════════════════════════════════════

async function renderDataTab(categoryFilter) {
    const tabId = categoryFilter 
        ? `analytics-${categoryFilter === 'Inwestycje' ? 'investments' : categoryFilter === 'Gotówka' ? 'cash' : 'accounts'}`
        : 'analytics-networth';
    
    // Mapowanie kategorii filtra na kategorię kamieni milowych
    const milestoneCategory = categoryFilter || 'all';
    
    const container = document.getElementById(tabId);
    if (!container) return;
    
    showAnalyticsLoading(true);
    
    try {
        const metrics = AnalyticsMetrics.calculateAllMetrics(categoryFilter);
        const filteredData = AnalyticsCharts.filterDataByRange(metrics.chartData, currentChartRange);
        
        container.innerHTML = `
            <!-- Wykres główny -->
            <div class="analytics-card">
                <div class="analytics-card-header">
                    <h3>Wartość w czasie</h3>
                    <div class="chart-controls">
                        <select class="form-select form-select-sm" onchange="changeChartRange(this.value)">
                            <option value="3m" ${currentChartRange === '3m' ? 'selected' : ''}>3 miesiące</option>
                            <option value="6m" ${currentChartRange === '6m' ? 'selected' : ''}>6 miesięcy</option>
                            <option value="1y" ${currentChartRange === '1y' ? 'selected' : ''}>Rok</option>
                            <option value="all" ${currentChartRange === 'all' ? 'selected' : ''}>Wszystko</option>
                        </select>
                        <select class="form-select form-select-sm" onchange="changeChartType(this.value, '${categoryFilter || ''}')">
                            <option value="line" ${currentChartType === 'line' ? 'selected' : ''}>Liniowy</option>
                            <option value="area" ${currentChartType === 'area' ? 'selected' : ''}>Warstwowy</option>
                        </select>
                    </div>
                </div>
                <div class="main-chart-container">
                    <canvas id="mainChart-${tabId}"></canvas>
                </div>
            </div>
            
            <!-- Karty metryk -->
            <div class="metrics-grid">
                ${renderMetricCard('Zmiana m/m', metrics.changeMonthly, 'monthly')}
                ${renderMetricCard('Zmiana r/r', metrics.changeYearly, 'yearly')}
                ${renderMetricCard('Śr. przyrost', { value: metrics.averageMonthlyGrowth, isAverage: true }, 'average')}
                ${renderBestMonthCard(metrics.bestMonth)}
            </div>
            
            <!-- Wykres zmian miesięcznych -->
            <div class="analytics-card">
                <div class="analytics-card-header">
                    <h3>Zmiany miesięczne</h3>
                </div>
                <div class="monthly-chart-container">
                    <canvas id="monthlyChart-${tabId}"></canvas>
                </div>
            </div>
            
            <!-- Kamienie milowe i tempo wzrostu -->
            <div class="analytics-two-cols">
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <h3>Kamienie milowe</h3>
                        <button class="btn btn-ghost btn-sm" onclick="showAddMilestoneModal('${milestoneCategory}')">+ Dodaj</button>
                    </div>
                    ${renderMilestones(milestoneCategory)}
                </div>
                
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <h3>Tempo wzrostu</h3>
                    </div>
                    ${renderGrowthRate(metrics.growthRate, milestoneCategory)}
                </div>
            </div>
            
            <!-- Analiza konkretnego aktywa -->
            <div class="analytics-card">
                <div class="analytics-card-header">
                    <h3>Analiza aktywa</h3>
                </div>
                ${renderAssetAnalysisSection(categoryFilter)}
            </div>
        `;
        
        // Renderuj wykresy
        setTimeout(() => {
            if (currentChartType === 'area' && !categoryFilter) {
                AnalyticsCharts.renderStackedAreaChart(`mainChart-${tabId}`, filteredData);
            } else {
                AnalyticsCharts.renderMainChart(`mainChart-${tabId}`, filteredData, currentChartType);
            }
            AnalyticsCharts.renderMonthlyChangesChart(`monthlyChart-${tabId}`, metrics.monthlyChanges.slice(-12));
        }, 100);
        
    } catch (error) {
        console.error('Błąd renderowania:', error);
        container.innerHTML = `<div class="empty-state"><p>Błąd ładowania danych</p></div>`;
    } finally {
        showAnalyticsLoading(false);
    }
}

function renderMetricCard(title, data, type) {
    let valueStr = '';
    let changeClass = '';
    let arrow = '';
    
    if (data.isAverage) {
        valueStr = formatMoney(data.value);
        changeClass = data.value >= 0 ? 'positive' : 'negative';
        arrow = '/mies.';
    } else if (data.hasData === false) {
        valueStr = 'Brak danych';
    } else {
        const sign = data.value >= 0 ? '+' : '';
        valueStr = `${sign}${formatMoney(data.value)}`;
        changeClass = data.value >= 0 ? 'positive' : 'negative';
        arrow = data.value >= 0 
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="18,15 12,9 6,15"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6,9 12,15 18,9"/></svg>';
    }
    
    return `
        <div class="metric-card">
            <div class="metric-title">${title}</div>
            <div class="metric-value ${changeClass}">${valueStr}</div>
            ${data.hasData !== false && !data.isAverage ? `
                <div class="metric-change ${changeClass}">
                    ${arrow}
                    <span>${data.percent >= 0 ? '+' : ''}${data.percent.toFixed(1)}%</span>
                </div>
            ` : `<div class="metric-change">${arrow}</div>`}
        </div>
    `;
}

function renderBestMonthCard(bestMonth) {
    if (!bestMonth) {
        return `
            <div class="metric-card">
                <div class="metric-title">Najlepszy miesiąc</div>
                <div class="metric-value">Brak danych</div>
            </div>
        `;
    }
    
    return `
        <div class="metric-card">
            <div class="metric-title">Najlepszy miesiąc</div>
            <div class="metric-value">${bestMonth.label}</div>
            <div class="metric-change positive">+${formatMoney(bestMonth.change)}</div>
        </div>
    `;
}

function renderMilestones(kategoria = 'all') {
    const milestones = analyticsMilestones[kategoria] || [];
    const categoryLabel = AnalyticsMilestones.getCategoryLabel(kategoria);
    
    if (milestones.length === 0) {
        return `
            <div class="milestones-empty">
                <p>Brak kamieni milowych dla: ${categoryLabel}</p>
                <button class="btn btn-secondary btn-sm" onclick="showAddMilestoneModal('${kategoria}')">Dodaj pierwszy</button>
            </div>
        `;
    }
    
    return `
        <div class="milestones-list">
            ${milestones.map(m => `
                <div class="milestone-item ${m.isAchieved ? 'achieved' : ''}">
                    <div class="milestone-icon">
                        ${m.isAchieved 
                            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>'
                            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'
                        }
                    </div>
                    <div class="milestone-info">
                        <div class="milestone-value">${AnalyticsMilestones.formatMilestoneValue(m.wartosc)}</div>
                        <div class="milestone-status">
                            ${m.isAchieved 
                                ? `Osiągnięty ${m.achievedDate || ''}`
                                : AnalyticsMilestones.formatProjection(m.projection)
                            }
                        </div>
                    </div>
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteMilestone(${m.wartosc}, '${kategoria}')" title="Usuń">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function renderGrowthRate(growthRate, kategoria = 'all') {
    const milestones = analyticsMilestones[kategoria] || [];
    const nextMilestone = milestones.find(m => !m.isAchieved);
    
    return `
        <div class="growth-rate-content">
            <div class="growth-rate-item">
                <span class="growth-rate-label">Obecne tempo:</span>
                <span class="growth-rate-value ${growthRate.current >= 0 ? 'positive' : 'negative'}">
                    ${growthRate.current >= 0 ? '+' : ''}${growthRate.current.toFixed(1)}% / mies.
                </span>
            </div>
            <div class="growth-rate-item">
                <span class="growth-rate-label">Średnie tempo:</span>
                <span class="growth-rate-value">
                    ${growthRate.average >= 0 ? '+' : ''}${growthRate.average.toFixed(1)}% / mies.
                </span>
            </div>
            ${nextMilestone ? `
                <div class="growth-rate-projection">
                    <span class="growth-rate-label">Najbliższy cel:</span>
                    <span class="growth-rate-value">
                        ${AnalyticsMilestones.formatMilestoneValue(nextMilestone.wartosc)}
                        za ${AnalyticsMilestones.formatProjection(nextMilestone.projection)}
                    </span>
                </div>
            ` : ''}
        </div>
    `;
}

function renderAssetAnalysisSection(categoryFilter) {
    const assets = categoryFilter 
        ? allAnalyticsAssets.filter(a => a.kategoria === categoryFilter)
        : allAnalyticsAssets;
    
    if (assets.length === 0) {
        return `<div class="empty-state-small"><p>Brak aktywów do analizy</p></div>`;
    }
    
    return `
        <div class="asset-analysis-form">
            <select class="form-select" id="assetSelect" onchange="analyzeSelectedAsset()">
                <option value="">Wybierz aktywo...</option>
                ${assets.map(a => `
                    <option value="${a.id}" data-name="${escapeHtml(a.nazwa)}">${escapeHtml(a.nazwa)}</option>
                `).join('')}
            </select>
        </div>
        <div id="assetAnalysisResult"></div>
    `;
}

// ═══════════════════════════════════════════════════════════
// AKCJE
// ═══════════════════════════════════════════════════════════

function changeChartRange(range) {
    currentChartRange = range;
    switchAnalyticsTab(currentAnalyticsTab);
}

function changeChartType(type, categoryFilter) {
    currentChartType = type;
    switchAnalyticsTab(currentAnalyticsTab);
}

async function analyzeSelectedAsset() {
    const select = document.getElementById('assetSelect');
    const assetId = select.value;
    const resultContainer = document.getElementById('assetAnalysisResult');
    
    if (!assetId) {
        resultContainer.innerHTML = '';
        return;
    }
    
    const assetName = select.options[select.selectedIndex].dataset.name;
    const metrics = AnalyticsMetrics.calculateAssetMetrics(assetId);
    
    if (!metrics.hasData) {
        resultContainer.innerHTML = `
            <div class="asset-analysis-empty">
                <p>Brak historii dla tego aktywa. Historia będzie dostępna po kolejnych snapshotach.</p>
            </div>
        `;
        return;
    }
    
    resultContainer.innerHTML = `
        <div class="asset-analysis-content">
            <div class="asset-chart-container">
                <canvas id="assetChart"></canvas>
            </div>
            <div class="asset-metrics">
                <div class="asset-metric">
                    <span class="label">Aktualna wartość</span>
                    <span class="value">${formatMoney(metrics.currentValue)}</span>
                </div>
                <div class="asset-metric">
                    <span class="label">Zmiana od ${metrics.firstDate}</span>
                    <span class="value ${metrics.changeFromStart.value >= 0 ? 'positive' : 'negative'}">
                        ${metrics.changeFromStart.value >= 0 ? '+' : ''}${formatMoney(metrics.changeFromStart.value)}
                        (${metrics.changeFromStart.percent >= 0 ? '+' : ''}${metrics.changeFromStart.percent.toFixed(1)}%)
                    </span>
                </div>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        AnalyticsCharts.renderAssetChart('assetChart', metrics.history);
    }, 100);
}


function showAddMilestoneModal(kategoria = 'all') {
    document.getElementById('milestoneModal').classList.add('active');
    document.getElementById('milestoneValue').value = '';
    
    // Ustaw domyślną kategorię
    const categorySelect = document.getElementById('milestoneCategory');
    if (categorySelect) {
        categorySelect.value = kategoria;
    }
    
    document.getElementById('milestoneValue').focus();
}

function closeMilestoneModal() {
    document.getElementById('milestoneModal').classList.remove('active');
}

async function handleMilestoneSubmit(e) {
    e.preventDefault();
    
    const value = parseFloat(document.getElementById('milestoneValue').value);
    const kategoria = document.getElementById('milestoneCategory')?.value || 'all';
    
    if (!value || value <= 0) {
        showToast('Wprowadź prawidłową wartość', 'warning');
        return;
    }
    
    try {
        await AnalyticsMilestones.addMilestone(value, kategoria);
        await loadAnalyticsData();
        closeMilestoneModal();
        switchAnalyticsTab(currentAnalyticsTab);
        const label = AnalyticsMilestones.getCategoryLabel(kategoria);
        showToast(`Kamień milowy dodany (${label})`, 'success');
    } catch (error) {
        showToast(error.message || 'Błąd dodawania', 'error');
    }
}

async function deleteMilestone(value, kategoria = 'all') {
    const label = AnalyticsMilestones.getCategoryLabel(kategoria);
    if (!confirm(`Usunąć kamień milowy ${formatMoney(value)} (${label})?`)) return;
    
    try {
        await AnalyticsMilestones.deleteMilestone(value, kategoria);
        await loadAnalyticsData();
        switchAnalyticsTab(currentAnalyticsTab);
        showToast('Kamień milowy usunięty', 'success');
    } catch (error) {
        showToast('Błąd usuwania', 'error');
    }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function calculateCurrentNetWorth() {
    return currentCategoryValues['all'] || 0;
}

function calculateCategoryValues() {
    const values = {
        'all': 0,
        'Inwestycje': 0,
        'Gotówka': 0,
        'Konta bankowe': 0
    };
    
    allAnalyticsAssets.forEach(a => {
        const valuePLN = convertToPLN(a.wartosc, a.waluta);
        
        if (a.kategoria === 'Długi') {
            values['all'] -= Math.abs(valuePLN);
        } else {
            values['all'] += valuePLN;
            
            // Dodaj do odpowiedniej kategorii
            if (values.hasOwnProperty(a.kategoria)) {
                values[a.kategoria] += valuePLN;
            }
        }
    });
    
    return values;
}

function showAnalyticsLoading(show) {
    const loader = document.getElementById('analyticsLoader');
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

function formatMoney(amount) {
    return new Intl.NumberFormat('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount) + ' PLN';
}

// Inicjalizacja
document.addEventListener('DOMContentLoaded', initAnalytics);

// ═══════════════════════════════════════════════════════════
// TAB AI ASYSTENT
// ═══════════════════════════════════════════════════════════

function renderAITab() {
    const container = document.getElementById('analytics-ai');
    if (!container) return;
    
    const categories = [...new Set(allAnalyticsAssets.map(a => a.kategoria))];
    
    container.innerHTML = `
        <!-- Szybka analiza -->
        <div class="analytics-card">
            <div class="analytics-card-header">
                <h3>🎯 Szybka analiza</h3>
            </div>
            
            <form id="quickAnalysisForm" onsubmit="runQuickAnalysis(event)">
                <div class="ai-form-section">
                    <label class="ai-form-label">Zakres danych:</label>
                    <div class="ai-radio-group">
                        <label class="ai-radio"><input type="radio" name="scope" value="all" checked> Cały majątek</label>
                        <label class="ai-radio"><input type="radio" name="scope" value="investments"> Inwestycje</label>
                        <label class="ai-radio"><input type="radio" name="scope" value="cash"> Gotówka</label>
                        <label class="ai-radio"><input type="radio" name="scope" value="accounts"> Konta bankowe</label>
                    </div>
                </div>
                
                <div class="ai-form-section">
                    <label class="ai-form-label">Okres:</label>
                    <div class="ai-radio-group">
                        <label class="ai-radio"><input type="radio" name="period" value="3m"> 3 mies.</label>
                        <label class="ai-radio"><input type="radio" name="period" value="6m"> 6 mies.</label>
                        <label class="ai-radio"><input type="radio" name="period" value="1y" checked> Rok</label>
                        <label class="ai-radio"><input type="radio" name="period" value="all"> Wszystko</label>
                    </div>
                </div>
                
                <div class="ai-form-section">
                    <label class="ai-form-label">Co przeanalizować:</label>
                    <div class="ai-checkbox-group">
                        <label class="ai-checkbox"><input type="checkbox" name="summary" checked> Podsumowanie zmian</label>
                        <label class="ai-checkbox"><input type="checkbox" name="trends" checked> Trendy</label>
                        <label class="ai-checkbox"><input type="checkbox" name="seasonality"> Sezonowość</label>
                        <label class="ai-checkbox"><input type="checkbox" name="anomalies"> Wykrycie anomalii</label>
                        <label class="ai-checkbox"><input type="checkbox" name="comparison"> Porównanie z poprzednim okresem</label>
                    </div>
                </div>
                
                <button type="submit" class="btn btn-primary" id="analyzeBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                        <polygon points="5,3 19,12 5,21 5,3"/>
                    </svg>
                    Analizuj
                </button>
            </form>
        </div>
        
        <!-- Wynik analizy -->
        <div class="analytics-card" id="analysisResultCard" style="display: none;">
            <div class="analytics-card-header">
                <h3>📋 Wynik analizy</h3>
            </div>
            <div id="analysisResult" class="ai-result"></div>
        </div>
        
        <!-- Czat -->
        <div class="analytics-card ai-chat-card">
            <div class="analytics-card-header">
                <h3>💬 Zapytaj AI</h3>
                <div class="chat-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="saveCurrentChat()" title="Zapisz rozmowę">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                            <polyline points="17,21 17,13 7,13 7,21"/>
                            <polyline points="7,3 7,8 15,8"/>
                        </svg>
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="showSavedChatsModal()" title="Historia rozmów">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12,6 12,12 16,14"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div id="chatMessages" class="chat-messages">
                <div class="chat-welcome">
                    <p>Zapytaj o swój majątek. Na przykład:</p>
                    <ul>
                        <li>"Jak zmieniła się moja gotówka w ostatnim roku?"</li>
                        <li>"Który miesiąc był najlepszy?"</li>
                        <li>"Porównaj inwestycje z początku i końca roku"</li>
                    </ul>
                </div>
            </div>
            
            <div class="chat-input-container">
                <input type="text" id="chatInput" class="form-input" placeholder="Wpisz pytanie..." 
                    onkeypress="if(event.key==='Enter') sendChatMessage()">
                <button class="btn btn-primary btn-icon" onclick="sendChatMessage()" id="sendChatBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22,2 15,22 11,13 2,9 22,2"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    // Sprawdź czy jest klucz API
    checkApiKey();
}

async function checkApiKey() {
    const apiKey = await AnalyticsAI.getApiKey();
    if (!apiKey) {
        showApiKeyModal();
    }
}

function showApiKeyModal() {
    document.getElementById('apiKeyModal').classList.add('active');
}

function closeApiKeyModal() {
    document.getElementById('apiKeyModal').classList.remove('active');
}

async function handleApiKeySubmit(e) {
    e.preventDefault();
    
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) {
        showToast('Wprowadź klucz API', 'warning');
        return;
    }
    
    showAnalyticsLoading(true);
    
    try {
        const isValid = await AnalyticsAI.validateApiKey(key);
        if (!isValid) {
            showToast('Nieprawidłowy klucz API', 'error');
            return;
        }
        
        await AnalyticsAI.setApiKey(key);
        closeApiKeyModal();
        showToast('Klucz API zapisany', 'success');
    } catch (error) {
        showToast('Błąd weryfikacji klucza', 'error');
    } finally {
        showAnalyticsLoading(false);
    }
}

async function runQuickAnalysis(e) {
    e.preventDefault();
    
    const apiKey = await AnalyticsAI.getApiKey();
    if (!apiKey) {
        showApiKeyModal();
        return;
    }
    
    const form = e.target;
    const options = {
        scope: form.querySelector('input[name="scope"]:checked').value,
        period: form.querySelector('input[name="period"]:checked').value,
        summary: form.querySelector('input[name="summary"]').checked,
        trends: form.querySelector('input[name="trends"]').checked,
        seasonality: form.querySelector('input[name="seasonality"]').checked,
        anomalies: form.querySelector('input[name="anomalies"]').checked,
        comparison: form.querySelector('input[name="comparison"]').checked
    };
    
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-small"></span> Analizuję...';
    
    const resultCard = document.getElementById('analysisResultCard');
    const resultDiv = document.getElementById('analysisResult');
    
    try {
        // Spłaszcz kamienie milowe ze wszystkich kategorii do jednej tablicy dla AI
        const allMilestones = Object.values(analyticsMilestones).flat();
        
        const result = await AnalyticsAI.runQuickAnalysis(
            options, 
            allAnalyticsAssets, 
            analyticsSnapshots, 
            allMilestones
        );
        
        resultDiv.innerHTML = formatAIResponse(result);
        resultCard.style.display = 'block';
        resultCard.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        showToast(error.message || 'Błąd analizy', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <polygon points="5,3 19,12 5,21 5,3"/>
            </svg>
            Analizuj
        `;
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    const apiKey = await AnalyticsAI.getApiKey();
    if (!apiKey) {
        showApiKeyModal();
        return;
    }
    
    input.value = '';
    
    const messagesContainer = document.getElementById('chatMessages');
    
    // Usuń welcome jeśli jest
    const welcome = messagesContainer.querySelector('.chat-welcome');
    if (welcome) welcome.remove();
    
    // Dodaj wiadomość użytkownika
    messagesContainer.innerHTML += `
        <div class="chat-message user">
            <div class="chat-message-content">${escapeHtml(message)}</div>
        </div>
    `;
    
    // Dodaj placeholder dla odpowiedzi AI
    messagesContainer.innerHTML += `
        <div class="chat-message ai" id="aiTyping">
            <div class="chat-message-content">
                <span class="typing-indicator">
                    <span></span><span></span><span></span>
                </span>
            </div>
        </div>
    `;
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    const sendBtn = document.getElementById('sendChatBtn');
    sendBtn.disabled = true;
    
    try {
        // Spłaszcz kamienie milowe ze wszystkich kategorii do jednej tablicy dla AI
        const allMilestones = Object.values(analyticsMilestones).flat();
        
        const response = await AnalyticsAI.sendChatMessage(
            message,
            allAnalyticsAssets,
            analyticsSnapshots,
            allMilestones
        );
        
        // Zamień placeholder na odpowiedź
        const typingEl = document.getElementById('aiTyping');
        typingEl.outerHTML = `
            <div class="chat-message ai">
                <div class="chat-message-content">${formatAIResponse(response)}</div>
            </div>
        `;
        
    } catch (error) {
        const typingEl = document.getElementById('aiTyping');
        typingEl.outerHTML = `
            <div class="chat-message ai error">
                <div class="chat-message-content">Błąd: ${escapeHtml(error.message)}</div>
            </div>
        `;
    } finally {
        sendBtn.disabled = false;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

async function saveCurrentChat() {
    const messages = AnalyticsAI.getChatMessages();
    if (messages.length === 0) {
        showToast('Brak wiadomości do zapisania', 'warning');
        return;
    }
    
    const title = prompt('Podaj tytuł rozmowy:');
    if (!title) return;
    
    try {
        await AnalyticsAI.saveCurrentChat(title);
        showToast('Rozmowa zapisana', 'success');
    } catch (error) {
        showToast(error.message || 'Błąd zapisu', 'error');
    }
}

async function showSavedChatsModal() {
    const modal = document.getElementById('savedChatsModal');
    const listContainer = document.getElementById('savedChatsList');
    
    listContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    modal.classList.add('active');
    
    try {
        const chats = await AnalyticsAI.getSavedChats();
        
        if (chats.length === 0) {
            listContainer.innerHTML = '<div class="empty-state-small"><p>Brak zapisanych rozmów</p></div>';
            return;
        }
        
        listContainer.innerHTML = chats.map(chat => `
            <div class="saved-chat-item" onclick="viewSavedChat('${chat.id}')">
                <div class="saved-chat-info">
                    <div class="saved-chat-title">${escapeHtml(chat.tytul)}</div>
                    <div class="saved-chat-date">${chat.data}</div>
                </div>
                <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation(); deleteSavedChat('${chat.id}')" title="Usuń">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
                    </svg>
                </button>
            </div>
        `).join('');
    } catch (error) {
        listContainer.innerHTML = '<div class="empty-state-small"><p>Błąd ładowania</p></div>';
    }
}

function closeSavedChatsModal() {
    document.getElementById('savedChatsModal').classList.remove('active');
}

async function viewSavedChat(chatId) {
    const chats = await AnalyticsAI.getSavedChats();
    const chat = chats.find(c => c.id === chatId);
    
    if (!chat) return;
    
    const modal = document.getElementById('viewChatModal');
    const titleEl = document.getElementById('viewChatTitle');
    const contentEl = document.getElementById('viewChatContent');
    
    titleEl.textContent = chat.tytul;
    contentEl.innerHTML = chat.tresc.map(m => `
        <div class="chat-message ${m.role === 'user' ? 'user' : 'ai'}">
            <div class="chat-message-content">${formatAIResponse(m.content)}</div>
        </div>
    `).join('');
    
    closeSavedChatsModal();
    modal.classList.add('active');
}

function closeViewChatModal() {
    document.getElementById('viewChatModal').classList.remove('active');
}

async function deleteSavedChat(chatId) {
    if (!confirm('Usunąć tę rozmowę?')) return;
    
    try {
        await AnalyticsAI.deleteChat(chatId);
        showSavedChatsModal(); // Odśwież listę
        showToast('Rozmowa usunięta', 'success');
    } catch (error) {
        showToast('Błąd usuwania', 'error');
    }
}

function formatAIResponse(text) {
    // Zamień ** na <strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Zamień nowe linie na <br>
    text = text.replace(/\n/g, '<br>');
    // Zamień - na punkty na początku linii
    text = text.replace(/<br>- /g, '<br>• ');
    if (text.startsWith('- ')) text = '• ' + text.substring(2);
    return text;
}
