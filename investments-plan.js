/**
 * Assetly - Investments Plan
 * Tab: Plan wpłat inwestycyjnych
 */

let planInstrumentsTemp = [];
let planPortfeleTozame = true;

function renderPlan() {
    const container = document.getElementById('tab-plan');
    if (!container) return;
    
    // Załaduj dane z zapisanego planu lub domyślne
    const currentPlan = plan || {
        wynagrodzenie: 0,
        stopaProcentowa: 20,
        ikeProcentowy: 70,
        portfeleTozame: true
    };
    
    planInstrumentsTemp = [...planInstruments];
    planPortfeleTozame = currentPlan.portfeleTozame;
    
    const kwotaInwestycji = currentPlan.wynagrodzenie * (currentPlan.stopaProcentowa / 100);
    const kwotaIke = kwotaInwestycji * (currentPlan.ikeProcentowy / 100);
    const kwotaIkze = kwotaInwestycji * ((100 - currentPlan.ikeProcentowy) / 100);
    
    // Pobierz limity
    const limits = IKE_IKZE.limits || IKE_IKZE.DEFAULT_LIMITS;
    const usage = IKE_IKZE.calculateUsage(allAssets);
    const ikeRemaining = Math.max(0, limits.IKE - usage.IKE);
    const ikzeRemaining = Math.max(0, limits.IKZE - usage.IKZE);
    
    container.innerHTML = `
        <div class="plan-container">
            <form id="planForm" onsubmit="handlePlanSubmit(event)">
                
                <!-- Podstawa obliczeń -->
                <div class="plan-section card">
                    <div class="plan-section-header">
                        <h3>Podstawa obliczeń</h3>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Wynagrodzenie miesięczne</label>
                        <div class="input-with-suffix">
                            <input type="number" id="planWynagrodzenie" class="form-input" 
                                value="${currentPlan.wynagrodzenie}" 
                                min="0" step="100" 
                                oninput="updatePlanCalculations()">
                            <span class="input-suffix">PLN</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Stopa inwestycji: <span id="stopaValue">${currentPlan.stopaProcentowa}%</span></label>
                        <input type="range" id="planStopa" class="form-range" 
                            value="${currentPlan.stopaProcentowa}" 
                            min="0" max="100" step="1"
                            oninput="updatePlanCalculations()">
                    </div>
                    
                    <div class="plan-result">
                        <div class="plan-result-label">Kwota do zainwestowania</div>
                        <div class="plan-result-value" id="kwotaInwestycji">${formatMoney(kwotaInwestycji)}</div>
                    </div>
                </div>
                
                <!-- Podział IKE/IKZE -->
                <div class="plan-section card">
                    <div class="plan-section-header">
                        <h3>Podział IKE / IKZE</h3>
                    </div>
                    
                    <div class="form-group">
                        <div class="ike-ikze-slider-labels">
                            <span>IKE</span>
                            <span>IKZE</span>
                        </div>
                        <input type="range" id="planIkeProcent" class="form-range ike-ikze-range" 
                            value="${currentPlan.ikeProcentowy}" 
                            min="0" max="100" step="5"
                            oninput="updatePlanCalculations()">
                        <div class="ike-ikze-slider-values">
                            <span id="ikeProcentLabel">${currentPlan.ikeProcentowy}%</span>
                            <span id="ikzeProcentLabel">${100 - currentPlan.ikeProcentowy}%</span>
                        </div>
                    </div>
                    
                    <div class="ike-ikze-boxes">
                        <div class="ike-ikze-box">
                            <div class="ike-ikze-box-label">IKE</div>
                            <div class="ike-ikze-box-value" id="kwotaIke">${formatMoney(kwotaIke)}</div>
                            <div class="ike-ikze-box-limit">
                                Limit: ${formatMoney(limits.IKE)}<br>
                                Wolne: ${formatMoney(ikeRemaining)}
                            </div>
                        </div>
                        <div class="ike-ikze-box">
                            <div class="ike-ikze-box-label">IKZE</div>
                            <div class="ike-ikze-box-value" id="kwotaIkze">${formatMoney(kwotaIkze)}</div>
                            <div class="ike-ikze-box-limit">
                                Limit: ${formatMoney(limits.IKZE)}<br>
                                Wolne: ${formatMoney(ikzeRemaining)}
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="planPortfeleTozame" 
                                ${currentPlan.portfeleTozame ? 'checked' : ''}
                                onchange="togglePortfeleTozame()">
                            <span>Portfele IKE i IKZE są tożsame (te same instrumenty)</span>
                        </label>
                    </div>
                </div>
                
                <!-- Instrumenty -->
                <div class="plan-section card">
                    <div class="plan-section-header">
                        <h3>Instrumenty</h3>
                    </div>
                    
                    <div id="instrumentsContainer">
                        ${renderInstrumentsForm()}
                    </div>
                </div>
                
                <!-- Zapisz -->
                <div class="plan-actions">
                    <button type="submit" class="btn btn-primary btn-lg">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                            <polyline points="17,21 17,13 7,13 7,21"/>
                            <polyline points="7,3 7,8 15,8"/>
                        </svg>
                        Zapisz plan
                    </button>
                </div>
                
            </form>
        </div>
    `;
}

function renderInstrumentsForm() {
    const portfeleTozame = document.getElementById('planPortfeleTozame')?.checked ?? planPortfeleTozame;
    
    if (portfeleTozame) {
        // Jedna lista dla obu kont
        const instruments = planInstrumentsTemp.filter(i => i.konto === 'TOZAME' || !i.konto);
        return renderInstrumentsList(instruments, 'TOZAME', 'Instrumenty (IKE + IKZE)');
    } else {
        // Dwie osobne listy
        const ikeInstruments = planInstrumentsTemp.filter(i => i.konto === 'IKE');
        const ikzeInstruments = planInstrumentsTemp.filter(i => i.konto === 'IKZE');
        
        return `
            ${renderInstrumentsList(ikeInstruments, 'IKE', 'Instrumenty IKE')}
            ${renderInstrumentsList(ikzeInstruments, 'IKZE', 'Instrumenty IKZE')}
        `;
    }
}

function renderInstrumentsList(instruments, konto, title) {
    const kwotaInwestycji = getPlanKwotaInwestycji();
    const ikeProc = parseFloat(document.getElementById('planIkeProcent')?.value ?? plan?.ikeProcentowy ?? 70);
    
    let kwotaDlaKonta = kwotaInwestycji;
    if (konto === 'IKE') {
        kwotaDlaKonta = kwotaInwestycji * (ikeProc / 100);
    } else if (konto === 'IKZE') {
        kwotaDlaKonta = kwotaInwestycji * ((100 - ikeProc) / 100);
    }
    
    const sumaAlokacji = instruments.reduce((sum, i) => sum + i.procentAlokacji, 0);
    const isValid = Math.abs(sumaAlokacji - 100) < 0.1 || instruments.length === 0;
    
    return `
        <div class="instruments-section" data-konto="${konto}">
            <div class="instruments-header">
                <h4>${title}</h4>
                ${konto !== 'TOZAME' ? `<span class="instruments-kwota">${formatMoney(kwotaDlaKonta)}</span>` : ''}
            </div>
            
            <div class="instruments-list" id="instrumentsList_${konto}">
                ${instruments.length > 0 ? instruments.map((inst, index) => `
                    <div class="instrument-row" data-index="${index}" data-konto="${konto}">
                        <div class="instrument-ticker">
                            <input type="text" class="form-input form-input-sm" 
                                value="${escapeHtml(inst.ticker)}" 
                                placeholder="Ticker"
                                onchange="updateInstrument('${konto}', ${index}, 'ticker', this.value)">
                        </div>
                        <div class="instrument-nazwa">
                            <input type="text" class="form-input form-input-sm" 
                                value="${escapeHtml(inst.nazwa)}" 
                                placeholder="Nazwa instrumentu"
                                onchange="updateInstrument('${konto}', ${index}, 'nazwa', this.value)">
                        </div>
                        <div class="instrument-alokacja">
                            <input type="number" class="form-input form-input-sm" 
                                value="${inst.procentAlokacji}" 
                                min="0" max="100" step="1"
                                onchange="updateInstrument('${konto}', ${index}, 'procentAlokacji', parseFloat(this.value) || 0)">
                            <span class="input-suffix-sm">%</span>
                        </div>
                        <div class="instrument-kwota">
                            ${formatMoney(kwotaDlaKonta * (inst.procentAlokacji / 100))}
                        </div>
                        <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="removeInstrument('${konto}', ${index})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                `).join('') : `
                    <div class="instruments-empty">Brak instrumentów</div>
                `}
            </div>
            
            <div class="instruments-footer">
                <button type="button" class="btn btn-secondary btn-sm" onclick="addInstrument('${konto}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Dodaj instrument
                </button>
                <div class="instruments-sum ${isValid ? 'valid' : 'invalid'}">
                    Suma: ${sumaAlokacji.toFixed(0)}% ${isValid ? '✓' : '(wymagane 100%)'}
                </div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// AKTUALIZACJE KALKULACJI
// ═══════════════════════════════════════════════════════════

function getPlanKwotaInwestycji() {
    const wynagrodzenie = parseFloat(document.getElementById('planWynagrodzenie')?.value) || 0;
    const stopa = parseFloat(document.getElementById('planStopa')?.value) || 0;
    return wynagrodzenie * (stopa / 100);
}

function updatePlanCalculations() {
    const wynagrodzenie = parseFloat(document.getElementById('planWynagrodzenie')?.value) || 0;
    const stopa = parseFloat(document.getElementById('planStopa')?.value) || 0;
    const ikeProcent = parseFloat(document.getElementById('planIkeProcent')?.value) || 0;
    
    const kwotaInwestycji = wynagrodzenie * (stopa / 100);
    const kwotaIke = kwotaInwestycji * (ikeProcent / 100);
    const kwotaIkze = kwotaInwestycji * ((100 - ikeProcent) / 100);
    
    // Aktualizuj wyświetlane wartości
    document.getElementById('stopaValue').textContent = stopa + '%';
    document.getElementById('kwotaInwestycji').textContent = formatMoney(kwotaInwestycji);
    document.getElementById('ikeProcentLabel').textContent = ikeProcent + '%';
    document.getElementById('ikzeProcentLabel').textContent = (100 - ikeProcent) + '%';
    document.getElementById('kwotaIke').textContent = formatMoney(kwotaIke);
    document.getElementById('kwotaIkze').textContent = formatMoney(kwotaIkze);
    
    // Odśwież instrumenty żeby zaktualizować kwoty
    refreshInstrumentsDisplay();
}

function togglePortfeleTozame() {
    const tozame = document.getElementById('planPortfeleTozame').checked;
    planPortfeleTozame = tozame;
    
    // Konwertuj instrumenty
    if (tozame) {
        // Scal do TOZAME
        planInstrumentsTemp = planInstrumentsTemp.map(i => ({ ...i, konto: 'TOZAME' }));
        // Usuń duplikaty po tickerze, sumując alokację
        const merged = {};
        planInstrumentsTemp.forEach(i => {
            if (merged[i.ticker]) {
                merged[i.ticker].procentAlokacji += i.procentAlokacji;
            } else {
                merged[i.ticker] = { ...i };
            }
        });
        planInstrumentsTemp = Object.values(merged);
    } else {
        // Rozdziel na IKE i IKZE
        const tozameInstruments = planInstrumentsTemp.filter(i => i.konto === 'TOZAME');
        planInstrumentsTemp = [];
        tozameInstruments.forEach(i => {
            planInstrumentsTemp.push({ ...i, konto: 'IKE' });
            planInstrumentsTemp.push({ ...i, konto: 'IKZE' });
        });
    }
    
    refreshInstrumentsDisplay();
}

function refreshInstrumentsDisplay() {
    const container = document.getElementById('instrumentsContainer');
    if (container) {
        container.innerHTML = renderInstrumentsForm();
    }
}

// ═══════════════════════════════════════════════════════════
// ZARZĄDZANIE INSTRUMENTAMI
// ═══════════════════════════════════════════════════════════

function addInstrument(konto) {
    planInstrumentsTemp.push({
        ticker: '',
        nazwa: '',
        konto: konto,
        procentAlokacji: 0
    });
    refreshInstrumentsDisplay();
}

function removeInstrument(konto, index) {
    const filtered = planInstrumentsTemp.filter(i => i.konto === konto);
    filtered.splice(index, 1);
    
    // Odbuduj listę
    planInstrumentsTemp = [
        ...planInstrumentsTemp.filter(i => i.konto !== konto),
        ...filtered
    ];
    
    refreshInstrumentsDisplay();
}

function updateInstrument(konto, index, field, value) {
    const filtered = planInstrumentsTemp.filter(i => i.konto === konto);
    if (filtered[index]) {
        filtered[index][field] = value;
    }
    
    // Odśwież wyświetlanie kwot
    if (field === 'procentAlokacji') {
        refreshInstrumentsDisplay();
    }
}

// ═══════════════════════════════════════════════════════════
// ZAPISYWANIE PLANU
// ═══════════════════════════════════════════════════════════

async function handlePlanSubmit(e) {
    e.preventDefault();
    
    const wynagrodzenie = parseFloat(document.getElementById('planWynagrodzenie').value) || 0;
    const stopaProcentowa = parseFloat(document.getElementById('planStopa').value) || 0;
    const ikeProcentowy = parseFloat(document.getElementById('planIkeProcent').value) || 0;
    const portfeleTozame = document.getElementById('planPortfeleTozame').checked;
    
    // Walidacja
    if (wynagrodzenie <= 0) {
        showToast('Wprowadź wynagrodzenie', 'warning');
        return;
    }
    
    // Walidacja instrumentów
    const validInstruments = planInstrumentsTemp.filter(i => i.ticker && i.procentAlokacji > 0);
    
    if (validInstruments.length === 0) {
        showToast('Dodaj przynajmniej jeden instrument', 'warning');
        return;
    }
    
    // Sprawdź sumy alokacji
    if (portfeleTozame) {
        const suma = validInstruments.reduce((sum, i) => sum + i.procentAlokacji, 0);
        if (Math.abs(suma - 100) > 0.1) {
            showToast(`Suma alokacji musi wynosić 100% (obecnie: ${suma.toFixed(0)}%)`, 'warning');
            return;
        }
    } else {
        const ikeSum = validInstruments.filter(i => i.konto === 'IKE').reduce((sum, i) => sum + i.procentAlokacji, 0);
        const ikzeSum = validInstruments.filter(i => i.konto === 'IKZE').reduce((sum, i) => sum + i.procentAlokacji, 0);
        
        if (Math.abs(ikeSum - 100) > 0.1) {
            showToast(`Suma alokacji IKE musi wynosić 100% (obecnie: ${ikeSum.toFixed(0)}%)`, 'warning');
            return;
        }
        if (Math.abs(ikzeSum - 100) > 0.1) {
            showToast(`Suma alokacji IKZE musi wynosić 100% (obecnie: ${ikzeSum.toFixed(0)}%)`, 'warning');
            return;
        }
    }
    
    try {
        showInvestmentsLoading(true);
        
        // Zapisz plan
        await InvestmentsSheets.savePlan({
            wynagrodzenie,
            stopaProcentowa,
            ikeProcentowy,
            portfeleTozame
        });
        
        // Zapisz instrumenty
        await InvestmentsSheets.savePlanInstruments(validInstruments);
        
        // Odśwież dane
        await loadInvestmentsData();
        
        showToast('Plan zapisany!', 'success');
        
    } catch (error) {
        console.error('Błąd zapisu planu:', error);
        showToast('Nie udało się zapisać planu', 'error');
    } finally {
        showInvestmentsLoading(false);
    }
}
