/**
 * Assetly - Investments Portfolios
 * Tab: Zarządzanie portfelami
 */

let currentPortfolioId = null;
let portfolioModalMode = 'add'; // 'add' | 'edit'

function renderPortfolios() {
    const container = document.getElementById('tab-portfolios');
    if (!container) return;
    
    container.innerHTML = `
        <div class="portfolios-header">
            <h2>Twoje portfele</h2>
            <button class="btn btn-primary" onclick="showAddPortfolioModal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nowy portfel
            </button>
        </div>
        
        <div class="portfolios-grid">
            ${renderPortfoliosList()}
        </div>
        
        <!-- Nieprzypisane aktywa -->
        <div class="card unassigned-section">
            <div class="card-header">
                <h3 class="card-title">Aktywa bez portfela</h3>
            </div>
            ${renderUnassignedAssets()}
        </div>
    `;
}

function renderPortfoliosList() {
    if (portfolios.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 12V7H5a2 2 0 010-4h14v4"/>
                        <path d="M3 5v14a2 2 0 002 2h16v-5"/>
                        <path d="M18 12a2 2 0 100 4 2 2 0 000-4z"/>
                    </svg>
                </div>
                <p class="empty-state-text">Nie masz jeszcze żadnych portfeli.<br>Utwórz pierwszy portfel, aby grupować swoje inwestycje.</p>
                <button class="btn btn-primary" onclick="showAddPortfolioModal()">Utwórz portfel</button>
            </div>
        `;
    }
    
    return portfolios.map(p => `
        <div class="portfolio-card card" data-id="${p.id}">
            <div class="portfolio-card-header">
                <div class="portfolio-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 3v18h18"/>
                        <path d="M18 9l-5 5-4-4-4 4"/>
                    </svg>
                </div>
                <div class="portfolio-card-info">
                    <h3 class="portfolio-card-name">${escapeHtml(p.nazwa)}</h3>
                    <div class="portfolio-card-meta">
                        ${p.broker ? `<span>${p.broker}</span>` : ''}
                        ${p.kontoEmerytalne ? `<span class="retirement-badge ${p.kontoEmerytalne.toLowerCase()}">${p.kontoEmerytalne}</span>` : ''}
                    </div>
                </div>
                <div class="portfolio-card-value">${formatMoney(p.wartosc)}</div>
            </div>
            
            <div class="portfolio-card-assets">
                ${p.assets.length > 0 ? `
                    <div class="portfolio-assets-preview">
                        ${p.assets.slice(0, 3).map(a => `
                            <div class="asset-preview-item">
                                <span class="asset-preview-name">${escapeHtml(a.nazwa)}</span>
                                <span class="asset-preview-value">${formatMoney(a.wartosc, a.waluta)}</span>
                            </div>
                        `).join('')}
                        ${p.assets.length > 3 ? `<div class="asset-preview-more">+${p.assets.length - 3} więcej</div>` : ''}
                    </div>
                ` : `
                    <div class="portfolio-empty">Brak aktywów w portfelu</div>
                `}
            </div>
            
            <div class="portfolio-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="showPortfolioDetails('${p.id}')">
                    Szczegóły
                </button>
                <button class="btn btn-ghost btn-sm" onclick="showEditPortfolioModal('${p.id}')">
                    Edytuj
                </button>
                <button class="btn btn-ghost btn-sm" onclick="confirmDeletePortfolio('${p.id}', '${escapeHtml(p.nazwa)}')">
                    Usuń
                </button>
            </div>
        </div>
    `).join('');
}

function renderUnassignedAssets() {
    const unassigned = getUnassignedAssets();
    
    if (unassigned.length === 0) {
        return `<div class="empty-state-small"><p>Wszystkie aktywa są przypisane do portfeli</p></div>`;
    }
    
    return `
        <div class="unassigned-assets-list">
            ${unassigned.map(a => `
                <div class="unassigned-asset-item">
                    <div class="unassigned-asset-info">
                        <span class="unassigned-asset-name">${escapeHtml(a.nazwa)}</span>
                        ${a.kontoEmerytalne ? `<span class="retirement-badge ${a.kontoEmerytalne.toLowerCase()}">${a.kontoEmerytalne}</span>` : ''}
                    </div>
                    <div class="unassigned-asset-value">${formatMoney(a.wartosc, a.waluta)}</div>
                    <div class="unassigned-asset-actions">
                        <select class="form-select form-select-sm" onchange="assignAssetToPortfolio('${a.id}', this.value)">
                            <option value="">Przypisz do...</option>
                            ${portfolios.map(p => `<option value="${p.id}">${escapeHtml(p.nazwa)}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// SZCZEGÓŁY PORTFELA
// ═══════════════════════════════════════════════════════════

function showPortfolioDetails(portfolioId) {
    const portfolio = portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return;
    
    currentPortfolioId = portfolioId;
    
    const modal = document.getElementById('portfolioDetailsModal');
    const content = document.getElementById('portfolioDetailsContent');
    
    // Oblicz alokację procentową
    const totalValue = portfolio.wartosc || 0;
    const allocations = portfolio.assets.map(a => ({
        nazwa: a.nazwa,
        wartosc: convertToPLN(a.wartosc, a.waluta),
        procent: totalValue > 0 ? (convertToPLN(a.wartosc, a.waluta) / totalValue * 100) : 0
    })).sort((a, b) => b.wartosc - a.wartosc);
    
    content.innerHTML = `
        <div class="portfolio-details-header">
            <h2>${escapeHtml(portfolio.nazwa)}</h2>
            <div class="portfolio-details-meta">
                ${portfolio.broker ? `<span class="detail-badge">${portfolio.broker}</span>` : ''}
                ${portfolio.kontoEmerytalne ? `<span class="retirement-badge ${portfolio.kontoEmerytalne.toLowerCase()}">${portfolio.kontoEmerytalne}</span>` : ''}
            </div>
            ${portfolio.opis ? `<p class="portfolio-details-desc">${escapeHtml(portfolio.opis)}</p>` : ''}
        </div>
        
        <div class="portfolio-details-value">
            <span class="label">Wartość portfela</span>
            <span class="value">${formatMoney(portfolio.wartosc)}</span>
        </div>
        
        ${portfolio.assets.length > 0 ? `
            <div class="portfolio-details-allocation">
                <div class="allocation-chart-container">
                    <canvas id="portfolioAllocationChart"></canvas>
                </div>
                <div class="allocation-legend">
                    ${allocations.map((a, i) => `
                        <div class="allocation-legend-item">
                            <span class="allocation-color" style="background: ${getAllocationColor(i)}"></span>
                            <span class="allocation-name">${escapeHtml(a.nazwa)}</span>
                            <span class="allocation-percent">${a.procent.toFixed(1)}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <div class="portfolio-details-assets">
            <h4>Aktywa w portfelu (${portfolio.assets.length})</h4>
            ${portfolio.assets.length > 0 ? `
                <div class="portfolio-assets-list">
                    ${portfolio.assets.map(a => `
                        <div class="portfolio-asset-item">
                            <div class="portfolio-asset-info">
                                <span class="portfolio-asset-name">${escapeHtml(a.nazwa)}</span>
                                <span class="portfolio-asset-category">${escapeHtml(a.podkategoria)}</span>
                            </div>
                            <div class="portfolio-asset-value">${formatMoney(a.wartosc, a.waluta)}</div>
                            <button class="btn btn-ghost btn-icon btn-sm" onclick="removeAssetFromPortfolioUI('${portfolio.id}', '${a.id}')" title="Usuń z portfela">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="empty-state-small"><p>Brak aktywów w portfelu</p></div>
            `}
        </div>
        
        <div class="portfolio-details-add">
            <h4>Dodaj aktywo do portfela</h4>
            ${renderAddAssetToPortfolio(portfolio)}
        </div>
    `;
    
    modal.classList.add('active');
    
    // Renderuj wykres po dodaniu do DOM
    if (portfolio.assets.length > 0) {
        renderPortfolioAllocationChart(allocations);
    }
}

function getAllocationColor(index) {
    const colors = [
        '#10B981', '#6366F1', '#F59E0B', '#EC4899', 
        '#14B8A6', '#8B5CF6', '#EF4444', '#84CC16',
        '#06B6D4', '#F97316', '#A855F7', '#22C55E'
    ];
    return colors[index % colors.length];
}

function renderPortfolioAllocationChart(allocations) {
    const canvas = document.getElementById('portfolioAllocationChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const colors = allocations.map((_, i) => getAllocationColor(i));
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: allocations.map(a => a.nazwa),
            datasets: [{
                data: allocations.map(a => a.wartosc),
                backgroundColor: colors,
                borderColor: 'rgba(10, 15, 13, 1)',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(21, 31, 27, 0.95)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255,255,255,0.7)',
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: (context) => {
                            const value = formatMoney(context.raw);
                            const percent = allocations[context.dataIndex].procent.toFixed(1);
                            return `${value} (${percent}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

function renderAddAssetToPortfolio(portfolio) {
    const unassigned = getUnassignedAssets();
    
    if (unassigned.length === 0) {
        return `<div class="empty-state-small"><p>Wszystkie aktywa są już przypisane</p></div>`;
    }
    
    return `
        <div class="add-asset-list">
            ${unassigned.map(a => `
                <div class="add-asset-item">
                    <div class="add-asset-info">
                        <span>${escapeHtml(a.nazwa)}</span>
                        ${a.kontoEmerytalne ? `<span class="retirement-badge ${a.kontoEmerytalne.toLowerCase()}">${a.kontoEmerytalne}</span>` : ''}
                    </div>
                    <div class="add-asset-value">${formatMoney(a.wartosc, a.waluta)}</div>
                    <button class="btn btn-secondary btn-sm" onclick="assignAssetToPortfolio('${a.id}', '${portfolio.id}')">
                        Dodaj
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function closePortfolioDetails() {
    document.getElementById('portfolioDetailsModal').classList.remove('active');
    currentPortfolioId = null;
}

// ═══════════════════════════════════════════════════════════
// MODAL: DODAJ/EDYTUJ PORTFEL
// ═══════════════════════════════════════════════════════════

function showAddPortfolioModal() {
    portfolioModalMode = 'add';
    currentPortfolioId = null;
    
    document.getElementById('portfolioModalTitle').textContent = 'Nowy portfel';
    document.getElementById('portfolioForm').reset();
    document.getElementById('portfolioSubmitBtn').innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Utwórz portfel
    `;
    
    document.getElementById('portfolioModal').classList.add('active');
}

function showEditPortfolioModal(portfolioId) {
    const portfolio = portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return;
    
    portfolioModalMode = 'edit';
    currentPortfolioId = portfolioId;
    
    document.getElementById('portfolioModalTitle').textContent = 'Edytuj portfel';
    document.getElementById('portfolioNazwa').value = portfolio.nazwa;
    document.getElementById('portfolioBroker').value = portfolio.broker || '';
    document.getElementById('portfolioKonto').value = portfolio.kontoEmerytalne || '';
    document.getElementById('portfolioOpis').value = portfolio.opis || '';
    document.getElementById('portfolioSubmitBtn').textContent = 'Zapisz zmiany';
    
    document.getElementById('portfolioModal').classList.add('active');
}

function closePortfolioModal() {
    document.getElementById('portfolioModal').classList.remove('active');
    currentPortfolioId = null;
}

async function handlePortfolioSubmit(e) {
    e.preventDefault();
    
    const formData = {
        nazwa: document.getElementById('portfolioNazwa').value.trim(),
        broker: document.getElementById('portfolioBroker').value.trim(),
        kontoEmerytalne: document.getElementById('portfolioKonto').value,
        opis: document.getElementById('portfolioOpis').value.trim()
    };
    
    if (!formData.nazwa) {
        showToast('Wprowadź nazwę portfela', 'warning');
        return;
    }
    
    try {
        showInvestmentsLoading(true);
        
        if (portfolioModalMode === 'edit' && currentPortfolioId) {
            await InvestmentsSheets.updatePortfolio(currentPortfolioId, formData);
            showToast('Portfel zaktualizowany', 'success');
        } else {
            await InvestmentsSheets.addPortfolio(formData);
            showToast('Portfel utworzony', 'success');
        }
        
        await loadInvestmentsData();
        closePortfolioModal();
        renderPortfolios();
        
    } catch (error) {
        console.error('Błąd zapisu portfela:', error);
        showToast('Nie udało się zapisać portfela', 'error');
    } finally {
        showInvestmentsLoading(false);
    }
}

// ═══════════════════════════════════════════════════════════
// OPERACJE NA PORTFELACH
// ═══════════════════════════════════════════════════════════

async function assignAssetToPortfolio(assetId, portfolioId) {
    if (!portfolioId) return;
    
    try {
        showInvestmentsLoading(true);
        await InvestmentsSheets.assignAssetToPortfolio(portfolioId, assetId);
        await loadInvestmentsData();
        
        // Odśwież widok
        if (currentPortfolioId) {
            showPortfolioDetails(currentPortfolioId);
        }
        renderPortfolios();
        
        showToast('Aktywo przypisane do portfela', 'success');
    } catch (error) {
        console.error('Błąd przypisania:', error);
        showToast('Nie udało się przypisać aktywa', 'error');
    } finally {
        showInvestmentsLoading(false);
    }
}

async function removeAssetFromPortfolioUI(portfolioId, assetId) {
    try {
        showInvestmentsLoading(true);
        await InvestmentsSheets.removeAssetFromPortfolio(portfolioId, assetId);
        await loadInvestmentsData();
        
        // Odśwież widok
        showPortfolioDetails(portfolioId);
        renderPortfolios();
        
        showToast('Aktywo usunięte z portfela', 'success');
    } catch (error) {
        console.error('Błąd usunięcia:', error);
        showToast('Nie udało się usunąć aktywa', 'error');
    } finally {
        showInvestmentsLoading(false);
    }
}

function confirmDeletePortfolio(portfolioId, nazwa) {
    if (confirm(`Czy na pewno chcesz usunąć portfel "${nazwa}"?\n\nAktywa nie zostaną usunięte - będą dostępne jako nieprzypisane.`)) {
        deletePortfolio(portfolioId);
    }
}

async function deletePortfolio(portfolioId) {
    try {
        showInvestmentsLoading(true);
        await InvestmentsSheets.deletePortfolio(portfolioId);
        await loadInvestmentsData();
        renderPortfolios();
        showToast('Portfel usunięty', 'success');
    } catch (error) {
        console.error('Błąd usunięcia:', error);
        showToast('Nie udało się usunąć portfela', 'error');
    } finally {
        showInvestmentsLoading(false);
    }
}
