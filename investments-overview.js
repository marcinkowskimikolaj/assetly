/**
 * Assetly - Investments Overview
 * Tab: Przegląd inwestycji
 */

function renderOverview() {
    const container = document.getElementById('tab-overview');
    if (!container) return;
    
    const totalValue = getInvestmentsTotalValue();
    const ikeValue = getIKEValue();
    const ikzeValue = getIKZEValue();
    
    const limits = IKE_IKZE.limits || IKE_IKZE.DEFAULT_LIMITS;
    const ikeUsage = depositUsage; // Używamy depositUsage z Historia_Wplat zamiast calculateUsage
    const ikePercent = IKE_IKZE.calculatePercentage(ikeUsage.IKE, limits.IKE);
    const ikzePercent = IKE_IKZE.calculatePercentage(ikeUsage.IKZE, limits.IKZE);
    
    container.innerHTML = `
        <div class="overview-grid">
            
            <!-- Główna wartość -->
            <div class="overview-hero card-glass">
                <div class="overview-hero-label">Łączna wartość inwestycji</div>
                <div class="overview-hero-value">${formatMoney(totalValue)}</div>
            </div>
            
            <!-- Statystyki -->
            <div class="overview-stats">
                <div class="stat-card">
                    <div class="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12V7H5a2 2 0 010-4h14v4"/>
                            <path d="M3 5v14a2 2 0 002 2h16v-5"/>
                            <path d="M18 12a2 2 0 100 4 2 2 0 000-4z"/>
                        </svg>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${portfolios.length}</div>
                        <div class="stat-label">Portfele</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon ike">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M9 12h6M12 9v6"/>
                        </svg>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${formatMoney(ikeValue)}</div>
                        <div class="stat-label">IKE (limit: ${formatPercent(ikePercent)})</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon ikze">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M9 12h6"/>
                        </svg>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${formatMoney(ikzeValue)}</div>
                        <div class="stat-label">IKZE (limit: ${formatPercent(ikzePercent)})</div>
                    </div>
                </div>
            </div>
            
            <!-- Portfele -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Podział po portfelach</h3>
                </div>
                ${renderPortfoliosSummary()}
            </div>
            
            <!-- Wykres -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Alokacja</h3>
                </div>
                <div class="overview-chart-container">
                    <canvas id="overviewChart"></canvas>
                </div>
            </div>
            
            <!-- Ostatnie wpłaty -->
            <div class="card overview-history">
                <div class="card-header">
                    <h3 class="card-title">Ostatnie wpłaty</h3>
                </div>
                ${renderRecentPayments()}
            </div>
            
        </div>
    `;
    
    // Renderuj wykres
    renderOverviewChart();
}

function renderPortfoliosSummary() {
    if (portfolios.length === 0) {
        return `
            <div class="empty-state-small">
                <p>Brak portfeli</p>
                <button class="btn btn-secondary btn-sm" onclick="switchTab('portfolios')">
                    Utwórz portfel
                </button>
            </div>
        `;
    }
    
    const sortedPortfolios = [...portfolios].sort((a, b) => b.wartosc - a.wartosc);
    
    return `
        <div class="portfolios-summary">
            ${sortedPortfolios.map(p => `
                <div class="portfolio-summary-item">
                    <div class="portfolio-summary-info">
                        <div class="portfolio-summary-name">${escapeHtml(p.nazwa)}</div>
                        <div class="portfolio-summary-meta">
                            ${p.broker ? p.broker + ' • ' : ''}${p.assets.length} aktywów
                            ${p.kontoEmerytalne ? `<span class="retirement-badge ${p.kontoEmerytalne.toLowerCase()}">${p.kontoEmerytalne}</span>` : ''}
                        </div>
                    </div>
                    <div class="portfolio-summary-value">${formatMoney(p.wartosc)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderRecentPayments() {
    if (paymentHistory.length === 0) {
        return `
            <div class="empty-state-small">
                <p>Brak historii wpłat</p>
            </div>
        `;
    }
    
    const recent = paymentHistory.slice(0, 5);
    
    return `
        <div class="payments-list">
            ${recent.map(p => `
                <div class="payment-item">
                    <div class="payment-date">${formatDate(p.data)}</div>
                    <div class="payment-amount">${formatMoney(p.kwotaCalkowita)}</div>
                    <div class="payment-split">
                        IKE: ${formatMoney(p.kwotaIke)} • IKZE: ${formatMoney(p.kwotaIkze)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderOverviewChart() {
    const canvas = document.getElementById('overviewChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Grupuj po portfelach
    const data = portfolios
        .filter(p => p.wartosc > 0)
        .map(p => ({
            label: p.nazwa,
            value: p.wartosc
        }));
    
    // Dodaj nieprzypisane
    const unassigned = getUnassignedAssets();
    const unassignedValue = unassigned.reduce((sum, a) => sum + convertToPLN(a.wartosc, a.waluta), 0);
    
    if (unassignedValue > 0) {
        data.push({
            label: 'Nieprzypisane',
            value: unassignedValue
        });
    }
    
    if (data.length === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state-small"><p>Brak danych do wykresu</p></div>';
        return;
    }
    
    const colors = [
        '#10B981', '#6366F1', '#F59E0B', '#EC4899', 
        '#14B8A6', '#8B5CF6', '#EF4444', '#84CC16'
    ];
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                data: data.map(d => d.value),
                backgroundColor: colors.slice(0, data.length),
                borderColor: 'rgba(10, 15, 13, 1)',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'rgba(255,255,255,0.7)',
                        padding: 16,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(21, 31, 27, 0.95)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255,255,255,0.7)',
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    borderWidth: 1,
                    callbacks: {
                        label: (context) => formatMoney(context.raw)
                    }
                }
            },
            cutout: '60%'
        }
    });
}
