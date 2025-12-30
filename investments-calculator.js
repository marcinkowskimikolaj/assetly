/**
 * Assetly - Investments Calculator
 * Tab: Kalkulator wpłat
 */

let calculatorItems = [];

function renderCalculator() {
    const container = document.getElementById('tab-calculator');
    if (!container) return;
    
    // Sprawdź czy jest plan
    if (!plan || planInstruments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                        <path d="M9 9h6M9 13h6M9 17h4"/>
                    </svg>
                </div>
                <p class="empty-state-text">Najpierw skonfiguruj plan wpłat, aby móc korzystać z kalkulatora.</p>
                <button class="btn btn-primary" onclick="switchTab('plan')">Przejdź do planu</button>
            </div>
        `;
        return;
    }
    
    // Oblicz wpłaty na podstawie planu
    calculatePayments();
    
    // Pobierz limity i wykorzystanie
    const limits = IKE_IKZE.limits || IKE_IKZE.DEFAULT_LIMITS;
    const usage = IKE_IKZE.calculateUsage(allAssets);
    const ikeRemaining = Math.max(0, limits.IKE - usage.IKE);
    const ikzeRemaining = Math.max(0, limits.IKZE - usage.IKZE);
    
    // Oblicz sumy
    const ikeTotal = calculatorItems.filter(i => i.konto === 'IKE').reduce((sum, i) => sum + i.wartosc, 0);
    const ikzeTotal = calculatorItems.filter(i => i.konto === 'IKZE').reduce((sum, i) => sum + i.wartosc, 0);
    const total = ikeTotal + ikzeTotal;
    
    // Sprawdź ostrzeżenia o limitach
    const ikeWarning = ikeTotal > ikeRemaining;
    const ikzeWarning = ikzeTotal > ikzeRemaining;
    
    const currentMonth = new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
    
    container.innerHTML = `
        <div class="calculator-container">
            
            <!-- Nagłówek -->
            <div class="calculator-header card-glass">
                <div class="calculator-header-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="4" y="2" width="16" height="20" rx="2"/>
                        <line x1="8" y1="6" x2="16" y2="6"/>
                        <line x1="8" y1="10" x2="16" y2="10"/>
                        <line x1="8" y1="14" x2="12" y2="14"/>
                        <line x1="8" y1="18" x2="10" y2="18"/>
                    </svg>
                </div>
                <div class="calculator-header-info">
                    <div class="calculator-header-month">${currentMonth}</div>
                    <div class="calculator-header-plan">
                        Plan: ${formatMoney(plan.wynagrodzenie * (plan.stopaProcentowa / 100))} 
                        (${plan.stopaProcentowa}% z ${formatMoney(plan.wynagrodzenie)})
                    </div>
                </div>
            </div>
            
            <!-- Ostrzeżenia -->
            ${ikeWarning || ikzeWarning ? `
                <div class="calculator-warnings">
                    ${ikeWarning ? `
                        <div class="warning-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span>Wpłata IKE (${formatMoney(ikeTotal)}) przekracza pozostały limit o ${formatMoney(ikeTotal - ikeRemaining)}</span>
                        </div>
                    ` : ''}
                    ${ikzeWarning ? `
                        <div class="warning-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span>Wpłata IKZE (${formatMoney(ikzeTotal)}) przekracza pozostały limit o ${formatMoney(ikzeTotal - ikzeRemaining)}</span>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <!-- Tabela zakupów -->
            <div class="calculator-table card">
                <div class="card-header">
                    <h3 class="card-title">Do zakupu</h3>
                </div>
                
                <div class="calculator-items">
                    <div class="calculator-items-header">
                        <span>Instrument</span>
                        <span>Konto</span>
                        <span>Alokacja</span>
                        <span>Wartość zakupu</span>
                    </div>
                    
                    ${calculatorItems.map((item, index) => `
                        <div class="calculator-item">
                            <div class="calculator-item-name">
                                <strong>${escapeHtml(item.ticker)}</strong>
                                <span>${escapeHtml(item.nazwa)}</span>
                            </div>
                            <div class="calculator-item-konto">
                                <span class="retirement-badge ${item.konto.toLowerCase()}">${item.konto}</span>
                            </div>
                            <div class="calculator-item-alokacja">
                                ${item.procentAlokacji.toFixed(0)}%
                            </div>
                            <div class="calculator-item-wartosc">
                                <input type="number" class="form-input form-input-sm calculator-value-input"
                                    value="${item.wartosc.toFixed(2)}"
                                    min="0" step="0.01"
                                    data-index="${index}"
                                    onchange="updateCalculatorItem(${index}, this.value)">
                                <span class="input-suffix-sm">PLN</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="calculator-note">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    Możesz edytować wartości jeśli faktyczne zakupy się różnią od planu
                </div>
            </div>
            
            <!-- Podsumowanie -->
            <div class="calculator-summary card">
                <div class="card-header">
                    <h3 class="card-title">Podsumowanie</h3>
                </div>
                
                <div class="summary-rows">
                    <div class="summary-row">
                        <span class="summary-label">IKE</span>
                        <span class="summary-value">${formatMoney(ikeTotal)}</span>
                        <span class="summary-limit ${ikeWarning ? 'warning' : ''}">
                            (limit: ${formatPercent((usage.IKE + ikeTotal) / limits.IKE * 100)} wykorzystany)
                        </span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">IKZE</span>
                        <span class="summary-value">${formatMoney(ikzeTotal)}</span>
                        <span class="summary-limit ${ikzeWarning ? 'warning' : ''}">
                            (limit: ${formatPercent((usage.IKZE + ikzeTotal) / limits.IKZE * 100)} wykorzystany)
                        </span>
                    </div>
                    <div class="summary-row total">
                        <span class="summary-label">Razem</span>
                        <span class="summary-value">${formatMoney(total)}</span>
                        <span class="summary-limit"></span>
                    </div>
                </div>
            </div>
            
            <!-- Przycisk realizacji -->
            <div class="calculator-actions">
                <button class="btn btn-primary btn-lg" onclick="executePayment()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                        <polyline points="20,6 9,17 4,12"/>
                    </svg>
                    Zrealizowano zakupy - zapisz aktywa
                </button>
            </div>
            
            <!-- Historia -->
            <div class="calculator-history card">
                <div class="card-header">
                    <h3 class="card-title">Historia realizacji</h3>
                </div>
                ${renderPaymentHistory()}
            </div>
            
        </div>
    `;
}

function calculatePayments() {
    calculatorItems = [];
    
    if (!plan || planInstruments.length === 0) return;
    
    const kwotaInwestycji = plan.wynagrodzenie * (plan.stopaProcentowa / 100);
    const kwotaIke = kwotaInwestycji * (plan.ikeProcentowy / 100);
    const kwotaIkze = kwotaInwestycji * ((100 - plan.ikeProcentowy) / 100);
    
    if (plan.portfeleTozame) {
        // Instrumenty są wspólne - rozdziel proporcjonalnie
        const instruments = planInstruments.filter(i => i.konto === 'TOZAME');
        
        instruments.forEach(inst => {
            // IKE
            calculatorItems.push({
                ticker: inst.ticker,
                nazwa: inst.nazwa,
                konto: 'IKE',
                procentAlokacji: inst.procentAlokacji,
                wartosc: kwotaIke * (inst.procentAlokacji / 100)
            });
            
            // IKZE
            calculatorItems.push({
                ticker: inst.ticker,
                nazwa: inst.nazwa,
                konto: 'IKZE',
                procentAlokacji: inst.procentAlokacji,
                wartosc: kwotaIkze * (inst.procentAlokacji / 100)
            });
        });
    } else {
        // Osobne instrumenty dla IKE i IKZE
        planInstruments.forEach(inst => {
            const kwota = inst.konto === 'IKE' ? kwotaIke : kwotaIkze;
            
            calculatorItems.push({
                ticker: inst.ticker,
                nazwa: inst.nazwa,
                konto: inst.konto,
                procentAlokacji: inst.procentAlokacji,
                wartosc: kwota * (inst.procentAlokacji / 100)
            });
        });
    }
    
    // Sortuj: najpierw IKE, potem IKZE
    calculatorItems.sort((a, b) => {
        if (a.konto !== b.konto) return a.konto === 'IKE' ? -1 : 1;
        return b.wartosc - a.wartosc;
    });
}

function updateCalculatorItem(index, value) {
    const newValue = parseFloat(value) || 0;
    if (calculatorItems[index]) {
        calculatorItems[index].wartosc = newValue;
    }
    
    // Odśwież podsumowanie
    updateCalculatorSummary();
}

function updateCalculatorSummary() {
    const limits = IKE_IKZE.limits || IKE_IKZE.DEFAULT_LIMITS;
    const usage = IKE_IKZE.calculateUsage(allAssets);
    
    const ikeTotal = calculatorItems.filter(i => i.konto === 'IKE').reduce((sum, i) => sum + i.wartosc, 0);
    const ikzeTotal = calculatorItems.filter(i => i.konto === 'IKZE').reduce((sum, i) => sum + i.wartosc, 0);
    const total = ikeTotal + ikzeTotal;
    
    // Aktualizuj wartości w DOM
    const summaryRows = document.querySelectorAll('.summary-row');
    if (summaryRows.length >= 3) {
        summaryRows[0].querySelector('.summary-value').textContent = formatMoney(ikeTotal);
        summaryRows[0].querySelector('.summary-limit').textContent = 
            `(limit: ${formatPercent((usage.IKE + ikeTotal) / limits.IKE * 100)} wykorzystany)`;
        
        summaryRows[1].querySelector('.summary-value').textContent = formatMoney(ikzeTotal);
        summaryRows[1].querySelector('.summary-limit').textContent = 
            `(limit: ${formatPercent((usage.IKZE + ikzeTotal) / limits.IKZE * 100)} wykorzystany)`;
        
        summaryRows[2].querySelector('.summary-value').textContent = formatMoney(total);
    }
}

function renderPaymentHistory() {
    if (paymentHistory.length === 0) {
        return `<div class="empty-state-small"><p>Brak historii realizacji</p></div>`;
    }
    
    return `
        <div class="history-list">
            ${paymentHistory.map(p => `
                <div class="history-item">
                    <div class="history-date">${formatDate(p.data)}</div>
                    <div class="history-amount">${formatMoney(p.kwotaCalkowita)}</div>
                    <div class="history-split">
                        <span class="retirement-badge ike">IKE: ${formatMoney(p.kwotaIke)}</span>
                        <span class="retirement-badge ikze">IKZE: ${formatMoney(p.kwotaIkze)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// REALIZACJA ZAKUPÓW
// ═══════════════════════════════════════════════════════════

async function executePayment() {
    // Filtruj tylko pozycje z wartością > 0
    const validItems = calculatorItems.filter(i => i.wartosc > 0);
    
    if (validItems.length === 0) {
        showToast('Brak pozycji do zapisania', 'warning');
        return;
    }
    
    // Potwierdź
    const ikeTotal = validItems.filter(i => i.konto === 'IKE').reduce((sum, i) => sum + i.wartosc, 0);
    const ikzeTotal = validItems.filter(i => i.konto === 'IKZE').reduce((sum, i) => sum + i.wartosc, 0);
    const total = ikeTotal + ikzeTotal;
    
    const confirmed = confirm(
        `Czy potwierdzasz realizację zakupów?\n\n` +
        `IKE: ${formatMoney(ikeTotal)}\n` +
        `IKZE: ${formatMoney(ikzeTotal)}\n` +
        `Razem: ${formatMoney(total)}\n\n` +
        `Zostanie utworzonych ${validItems.length} aktywów.`
    );
    
    if (!confirmed) return;
    
    try {
        showInvestmentsLoading(true);
        
        // Utwórz aktywa
        const sheetsAPI = createSheetsAPI(CONFIG.SPREADSHEET_ID);
        await InvestmentsSheets.createAssetsFromCalculation(validItems, sheetsAPI);
        
        // Zapisz w historii
        await InvestmentsSheets.addPaymentHistory({
            kwotaCalkowita: total,
            kwotaIke: ikeTotal,
            kwotaIkze: ikzeTotal,
            szczegoly: validItems.map(i => ({
                ticker: i.ticker,
                konto: i.konto,
                wartosc: i.wartosc
            }))
        });
        
        // Odśwież dane
        await loadInvestmentsData();
        
        showToast(`Zakupy zrealizowane! Dodano ${validItems.length} aktywów.`, 'success');
        
        // Odśwież widok
        renderCalculator();
        
    } catch (error) {
        console.error('Błąd realizacji:', error);
        showToast('Nie udało się zapisać zakupów', 'error');
    } finally {
        showInvestmentsLoading(false);
    }
}
