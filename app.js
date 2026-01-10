/**
 * Assetly - Główna logika aplikacji
 */

let sheetsAPI = null;
let assets = [];
let paymentHistory = []; // Historia wpłat z zakładki Historia_Wplat
let depositUsage = { IKE: 0, IKZE: 0 }; // Poprawne wykorzystanie limitów z Historia_Wplat
let currencyRates = { PLN: 1 };
let pieChart = null;
let currentEditId = null;
let deleteAssetId = null;
let selectedBreakdownItems = new Set(); // Zaznaczone elementy w rozkładzie majątku

// ============================================
// INICJALIZACJA
// ============================================

async function initApp() {
    if (!requireAuth()) return;
    
    try {
        await initAuth();
        setupEventListeners();
        
        // Automatyczne połączenie z arkuszem
        if (CONFIG.SPREADSHEET_ID && !CONFIG.SPREADSHEET_ID.includes('WKLEJ')) {
            await connectSpreadsheet();
        } else {
            updateConnectionStatus('disconnected');
            showToast('Skonfiguruj SPREADSHEET_ID w config.js', 'warning');
        }
        
    } catch (error) {
        console.error('Init error:', error);
        showToast('Błąd inicjalizacji aplikacji', 'error');
    }
}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', handleGoogleLogout);
    document.getElementById('addAssetBtn').addEventListener('click', () => showAddAssetModal());
    
    // Modal aktywa
    document.getElementById('assetModal').addEventListener('click', (e) => {
        if (e.target.id === 'assetModal') closeModal();
    });
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('assetForm').addEventListener('submit', handleAssetFormSubmit);
    document.getElementById('kategoria').addEventListener('change', () => {
        updatePodkategorie();
        updateKontoEmerytalneVisibility();
    });
    
    // Modal potwierdzenia
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target.id === 'confirmModal') closeConfirmModal();
    });
    document.getElementById('confirmCancelBtn').addEventListener('click', closeConfirmModal);
    
    // Auto-refresh gdy dane zmienią się w innej karcie (np. z Investments)
    window.addEventListener('storage', (e) => {
        if (e.key === 'assetly_data_changed' && sheetsAPI) {
            console.log('[Dashboard] Wykryto zmiany danych - odświeżam...');
            loadAssets();
            loadPaymentHistory();
        }
    });
}

// ============================================
// POŁĄCZENIE Z ARKUSZEM
// ============================================

async function connectSpreadsheet() {
    updateConnectionStatus('loading');
    showLoading(true);
    
    try {
        await ensureValidToken();
        
        sheetsAPI = createSheetsAPI(CONFIG.SPREADSHEET_ID);
        await sheetsAPI.testConnection();
        
        updateConnectionStatus('connected');
        
        // Pobierz kursy walut, limity, aktywa i historię wpłat równolegle
        await Promise.all([
            fetchCurrencyRates(),
            IKE_IKZE.fetchLimits(sheetsAPI),
            loadAssets(false), // nie renderuj jeszcze
            loadPaymentHistory() // pobierz historię wpłat dla limitów IKE/IKZE
        ]);
        
        // Teraz renderuj z wszystkimi danymi
        renderDashboard();
        
    } catch (error) {
        console.error('Connection error:', error);
        updateConnectionStatus('disconnected');
        
        let message = 'Nie można połączyć z arkuszem';
        if (error.message?.includes('Brak zakładki')) {
            message = error.message;
        } else if (error.status === 404) {
            message = 'Nie znaleziono arkusza';
        } else if (error.status === 403) {
            message = 'Brak dostępu do arkusza';
        }
        
        showToast(message, 'error');
    } finally {
        showLoading(false);
    }
}

function updateConnectionStatus(status) {
    const badge = document.getElementById('connectionStatus');
    badge.className = `connection-badge ${status}`;
    
    const texts = {
        connected: 'Połączono',
        disconnected: 'Rozłączono',
        loading: 'Łączenie...'
    };
    
    badge.innerHTML = `<span class="connection-dot"></span>${texts[status] || status}`;
}

// ============================================
// KURSY WALUT
// ============================================

async function fetchCurrencyRates() {
    const currencies = WALUTY.filter(c => c !== 'PLN');
    
    // Pobierz wszystkie kursy równolegle
    const promises = currencies.map(async (currency) => {
        try {
            const response = await fetch(`${CONFIG.NBP_API_URL}${currency}/?format=json`);
            if (response.ok) {
                const data = await response.json();
                return { currency, rate: data.rates[0].mid };
            }
        } catch (error) {
            // Cicha obsługa błędu
        }
        return { currency, rate: 1 };
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ currency, rate }) => {
        currencyRates[currency] = rate;
    });
}

function convertToPLN(amount, currency) {
    if (currency === 'PLN') return amount;
    return amount * (currencyRates[currency] || 1);
}

function formatCurrency(amount, currency = 'PLN') {
    return new Intl.NumberFormat('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount) + ' ' + currency;
}

// ============================================
// ZARZĄDZANIE AKTYWAMI
// ============================================

async function loadAssets(shouldRender = true) {
    if (shouldRender) showLoading(true);
    
    try {
        assets = await sheetsAPI.getAllAssets();
        if (shouldRender) {
            renderDashboard();
        }
    } catch (error) {
        console.error('Load error:', error);
        showToast('Błąd ładowania danych', 'error');
    } finally {
        if (shouldRender) showLoading(false);
    }
}

async function loadPaymentHistory() {
    try {
        // Pobierz dane z zakładki Historia_Wplat
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: 'Historia_Wplat!A2:F'
        });
        
        const rows = response.result.values || [];
        paymentHistory = rows.map(row => ({
            id: row[0] || '',
            data: row[1] || '',
            kwotaCalkowita: parseFloat(row[2]) || 0,
            kwotaIke: parseFloat(row[3]) || 0,
            kwotaIkze: parseFloat(row[4]) || 0,
            szczegolyJSON: row[5] || ''
        })).filter(p => p.id);
        
        // Wylicz poprawne wykorzystanie limitów z Historia_Wplat
        depositUsage = IKE_IKZE.calculateUsageFromDeposits(paymentHistory);
        
        console.log('[Dashboard] Wykorzystanie limitów IKE/IKZE (z Historia_Wplat):', depositUsage);
        
    } catch (error) {
        console.warn('Nie można pobrać Historia_Wplat (może nie istnieć):', error);
        paymentHistory = [];
        depositUsage = { IKE: 0, IKZE: 0 };
    }
}

async function handleAddAsset(formData) {
    try {
        showLoading(true);
        const result = await sheetsAPI.addAsset(formData);
        await loadAssets();
        
        if (result.wasUpdated) {
            showToast(`Zaktualizowano "${formData.nazwa}" - zsumowano wartość`, 'success');
        } else {
            showToast('Aktywo dodane!', 'success');
        }
        
        closeModal();
    } catch (error) {
        showToast('Nie udało się dodać aktywa', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleEditAsset(id, formData) {
    try {
        showLoading(true);
        await sheetsAPI.updateAsset(id, formData);
        await loadAssets();
        showToast('Aktywo zaktualizowane!', 'success');
        closeModal();
    } catch (error) {
        showToast('Nie udało się zaktualizować aktywa', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleDeleteAsset(id) {
    try {
        showLoading(true);
        await sheetsAPI.deleteAsset(id);
        await loadAssets();
        showToast('Aktywo usunięte', 'success');
        closeConfirmModal();
    } catch (error) {
        showToast('Nie udało się usunąć aktywa', 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// KALKULACJE
// ============================================

function calculateTotalWorth() {
    return assets.reduce((total, asset) => {
        const valuePLN = convertToPLN(asset.wartosc, asset.waluta);
        if (asset.kategoria === 'Długi') {
            return total - Math.abs(valuePLN);
        }
        return total + valuePLN;
    }, 0);
}

function calculateCategoryBreakdown() {
    const breakdown = {};
    
    assets.forEach(asset => {
        const categoryKey = getCategoryKey(asset.kategoria);
        if (!categoryKey) return;
        
        const categoryData = KATEGORIE[categoryKey];
        const waluta = asset.waluta;
        const key = `${categoryKey}_${waluta}`;
        
        if (!breakdown[key]) {
            breakdown[key] = {
                categoryKey: categoryKey,
                nazwa: categoryData.nazwa,
                waluta: waluta,
                icon: categoryData.icon,
                color: categoryData.color,
                wartosc: 0,
                wartoscPLN: 0
            };
        }
        
        const valuePLN = convertToPLN(asset.wartosc, asset.waluta);
        
        if (categoryKey === 'dlugi') {
            breakdown[key].wartosc -= Math.abs(asset.wartosc);
            breakdown[key].wartoscPLN -= Math.abs(valuePLN);
        } else {
            breakdown[key].wartosc += asset.wartosc;
            breakdown[key].wartoscPLN += valuePLN;
        }
    });
    
    return breakdown;
}

function getCategoryKey(categoryName) {
    for (const [key, value] of Object.entries(KATEGORIE)) {
        if (value.nazwa === categoryName) return key;
    }
    return null;
}

function getIcon(iconName) {
    return ICONS[iconName] || ICONS.wallet;
}

// ============================================
// RENDEROWANIE
// ============================================

function renderDashboard() {
    renderNetWorth();
    renderBreakdown();
    renderChart();
    renderAssetsList();
    renderIkeIkze();
}

function renderNetWorth() {
    const breakdown = calculateCategoryBreakdown();
    let total = 0;
    
    Object.entries(breakdown).forEach(([key, data]) => {
        // Jeśli selectedBreakdownItems jest puste (pierwsze ładowanie), pokaż wszystko
        // W przeciwnym razie sprawdź czy element jest zaznaczony
        if (selectedBreakdownItems.size === 0 || selectedBreakdownItems.has(key)) {
            total += data.wartoscPLN;
        }
    });
    
    document.getElementById('netWorthValue').textContent = 
        new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(total);
}

function renderBreakdown() {
    const breakdown = calculateCategoryBreakdown();
    const container = document.getElementById('breakdownGrid');
    
    const items = Object.entries(breakdown)
        .filter(([_, data]) => data.wartosc !== 0)
        .sort((a, b) => Math.abs(b[1].wartoscPLN) - Math.abs(a[1].wartoscPLN));
    
    if (items.length === 0) {
        container.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: var(--text-muted); padding: 24px;">Brak aktywów do wyświetlenia</p>';
        selectedBreakdownItems.clear();
        return;
    }
    
    // Synchronizuj selectedBreakdownItems z aktualnymi danymi
    const currentKeys = new Set(items.map(([key]) => key));
    const isFirstLoad = selectedBreakdownItems.size === 0;
    
    // Usuń nieistniejące elementy
    selectedBreakdownItems.forEach(key => {
        if (!currentKeys.has(key)) {
            selectedBreakdownItems.delete(key);
        }
    });
    
    // Dodaj nowe elementy (domyślnie zaznaczone)
    items.forEach(([key]) => {
        if (!selectedBreakdownItems.has(key)) {
            selectedBreakdownItems.add(key);
        }
    });
    
    container.innerHTML = items.map(([key, data]) => {
        const showConverted = data.waluta !== 'PLN';
        const displayName = `${data.nazwa} ${data.waluta}`;
        const isSelected = selectedBreakdownItems.has(key);
        
        return `
            <div class="breakdown-item ${isSelected ? 'selected' : 'deselected'}" 
                 data-key="${key}" 
                 onclick="toggleBreakdownItem('${key}')">
                <div class="breakdown-icon" style="background: ${data.color}20; color: ${data.color}">
                    ${getIcon(data.icon)}
                </div>
                <div class="breakdown-info">
                    <div class="breakdown-name">${displayName}</div>
                    <div class="breakdown-value ${data.wartoscPLN < 0 ? 'negative' : ''}">
                        ${formatCurrency(data.wartosc, data.waluta)}
                        ${showConverted ? `<span class="breakdown-converted">≈ ${formatCurrency(data.wartoscPLN)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleBreakdownItem(key) {
    if (selectedBreakdownItems.has(key)) {
        // Nie pozwól odznaczyć wszystkiego
        if (selectedBreakdownItems.size > 1) {
            selectedBreakdownItems.delete(key);
        }
    } else {
        selectedBreakdownItems.add(key);
    }
    
    // Aktualizuj UI
    updateBreakdownSelection();
    renderFilteredNetWorth();
    renderFilteredChart();
}

function updateBreakdownSelection() {
    document.querySelectorAll('.breakdown-item').forEach(item => {
        const key = item.dataset.key;
        if (selectedBreakdownItems.has(key)) {
            item.classList.remove('deselected');
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
            item.classList.add('deselected');
        }
    });
}

function renderFilteredNetWorth() {
    renderNetWorth();
}

function renderFilteredChart() {
    renderChart();
}

function renderChart() {
    const ctx = document.getElementById('pieChart').getContext('2d');
    const breakdown = calculateCategoryBreakdown();
    
    // Grupuj po kategorii, ale tylko zaznaczone elementy
    const categoryTotals = {};
    
    Object.entries(breakdown).forEach(([key, data]) => {
        // Jeśli selectedBreakdownItems jest puste (pierwsze ładowanie), pokaż wszystko
        // W przeciwnym razie sprawdź czy element jest zaznaczony
        if (selectedBreakdownItems.size > 0 && !selectedBreakdownItems.has(key)) return;
        if (data.categoryKey === 'dlugi') return;
        if (data.wartoscPLN <= 0) return;
        
        const categoryKey = data.categoryKey;
        
        if (!categoryTotals[categoryKey]) {
            categoryTotals[categoryKey] = {
                nazwa: KATEGORIE[categoryKey]?.nazwa || data.nazwa,
                color: data.color,
                wartosc: 0
            };
        }
        
        categoryTotals[categoryKey].wartosc += data.wartoscPLN;
    });
    
    const chartData = Object.entries(categoryTotals)
        .filter(([_, data]) => data.wartosc > 0)
        .sort((a, b) => b[1].wartosc - a[1].wartosc);
    
    const total = chartData.reduce((sum, [_, data]) => sum + data.wartosc, 0);
    
    document.getElementById('chartCenterValue').textContent = 
        new Intl.NumberFormat('pl-PL', { notation: 'compact', maximumFractionDigits: 1 }).format(total) + ' PLN';
    
    if (chartData.length === 0) {
        if (pieChart) {
            pieChart.destroy();
            pieChart = null;
        }
        return;
    }
    
    const labels = chartData.map(([_, data]) => data.nazwa);
    const values = chartData.map(([_, data]) => data.wartosc);
    const colors = chartData.map(([_, data]) => data.color);
    
    if (pieChart) pieChart.destroy();
    
    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: 'rgba(10, 15, 13, 1)',
                borderWidth: 4,
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
                    padding: 12,
                    callbacks: {
                        label: (context) => formatCurrency(context.raw)
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function renderAssetsList() {
    const container = document.getElementById('assetsList');
    
    if (assets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${ICONS.wallet}</div>
                <p class="empty-state-text">Nie masz jeszcze żadnych aktywów.<br>Dodaj pierwsze aktywo, aby rozpocząć śledzenie majątku.</p>
                <button class="btn btn-primary" onclick="showAddAssetModal()">
                    ${ICONS.plus} Dodaj aktywo
                </button>
            </div>
        `;
        return;
    }
    
    const sortedAssets = [...assets].sort((a, b) => {
        if (a.kategoria !== b.kategoria) return a.kategoria.localeCompare(b.kategoria);
        return convertToPLN(b.wartosc, b.waluta) - convertToPLN(a.wartosc, a.waluta);
    });
    
    container.innerHTML = sortedAssets.map(asset => {
        const categoryKey = getCategoryKey(asset.kategoria);
        const categoryData = KATEGORIE[categoryKey] || { icon: 'wallet', color: '#6366F1' };
        const valuePLN = convertToPLN(asset.wartosc, asset.waluta);
        const isDebt = asset.kategoria === 'Długi';
        const displayValue = isDebt ? -Math.abs(asset.wartosc) : asset.wartosc;
        const displayValuePLN = isDebt ? -Math.abs(valuePLN) : valuePLN;
        
        // Badge IKE/IKZE
        const retirementBadge = asset.kontoEmerytalne 
            ? `<span class="retirement-badge ${asset.kontoEmerytalne.toLowerCase()}">${asset.kontoEmerytalne}</span>` 
            : '';
        
        return `
            <div class="asset-item">
                <div class="asset-icon" style="background: ${categoryData.color}20; color: ${categoryData.color}">
                    ${getIcon(categoryData.icon)}
                </div>
                <div class="asset-info">
                    <div class="asset-name">${escapeHtml(asset.nazwa)} ${retirementBadge}</div>
                    <div class="asset-category">${escapeHtml(asset.podkategoria)}</div>
                </div>
                <div class="asset-values">
                    <div class="asset-value-main ${isDebt ? 'negative' : ''}">${formatCurrency(displayValue, asset.waluta)}</div>
                    ${asset.waluta !== 'PLN' ? `<div class="asset-value-converted">≈ ${formatCurrency(displayValuePLN)}</div>` : ''}
                </div>
                <div class="asset-actions">
                    <button class="btn btn-ghost btn-icon" onclick="showEditAssetModal('${asset.id}')" title="Edytuj">
                        ${ICONS.edit}
                    </button>
                    <button class="btn btn-ghost btn-icon" onclick="showDeleteConfirm('${asset.id}', '${escapeHtml(asset.nazwa)}')" title="Usuń">
                        ${ICONS.trash}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// MODAL - DODAWANIE/EDYCJA
// ============================================

function showAddAssetModal() {
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'Dodaj aktywo';
    document.getElementById('submitBtn').innerHTML = `${ICONS.plus} Dodaj`;
    document.getElementById('assetForm').reset();
    
    populateCategories();
    updatePodkategorie();
    updateKontoEmerytalneVisibility();
    
    document.getElementById('assetModal').classList.add('active');
}

function showEditAssetModal(id) {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    
    currentEditId = id;
    document.getElementById('modalTitle').textContent = 'Edytuj aktywo';
    document.getElementById('submitBtn').innerHTML = 'Zapisz zmiany';
    
    populateCategories();
    
    document.getElementById('kategoria').value = asset.kategoria;
    updatePodkategorie();
    updateKontoEmerytalneVisibility();
    
    document.getElementById('podkategoria').value = asset.podkategoria;
    document.getElementById('nazwa').value = asset.nazwa;
    document.getElementById('wartosc').value = asset.wartosc;
    document.getElementById('waluta').value = asset.waluta;
    document.getElementById('notatki').value = asset.notatki || '';
    document.getElementById('kontoEmerytalne').value = asset.kontoEmerytalne || '';
    
    document.getElementById('assetModal').classList.add('active');
}

function closeModal() {
    document.getElementById('assetModal').classList.remove('active');
    currentEditId = null;
}

function populateCategories() {
    const select = document.getElementById('kategoria');
    select.innerHTML = Object.entries(KATEGORIE)
        .map(([_, cat]) => `<option value="${cat.nazwa}">${cat.nazwa}</option>`)
        .join('');
}

function updatePodkategorie() {
    const kategoriaValue = document.getElementById('kategoria').value;
    const select = document.getElementById('podkategoria');
    
    let podkategorie = [];
    for (const cat of Object.values(KATEGORIE)) {
        if (cat.nazwa === kategoriaValue) {
            podkategorie = cat.podkategorie;
            break;
        }
    }
    
    select.innerHTML = podkategorie.map(p => `<option value="${p}">${p}</option>`).join('');
}

function updateKontoEmerytalneVisibility() {
    const kategoria = document.getElementById('kategoria').value;
    const group = document.getElementById('kontoEmerytalneGroup');
    
    if (IKE_IKZE.canHaveRetirementAccount(kategoria)) {
        group.classList.remove('hidden');
    } else {
        group.classList.add('hidden');
        document.getElementById('kontoEmerytalne').value = '';
    }
}

function renderIkeIkze() {
    const container = document.getElementById('ikeIkzeSection');
    if (container) {
        // Przekazujemy poprawne wykorzystanie z Historia_Wplat zamiast sum wartości aktywów
        container.innerHTML = IKE_IKZE.renderSection(assets, depositUsage);
    }
}

async function handleAssetFormSubmit(e) {
    e.preventDefault();
    
    const kategoria = document.getElementById('kategoria').value;
    
    const formData = {
        kategoria: kategoria,
        podkategoria: document.getElementById('podkategoria').value,
        nazwa: document.getElementById('nazwa').value.trim(),
        wartosc: parseFloat(document.getElementById('wartosc').value),
        waluta: document.getElementById('waluta').value,
        notatki: document.getElementById('notatki').value.trim(),
        kontoEmerytalne: IKE_IKZE.canHaveRetirementAccount(kategoria) 
            ? document.getElementById('kontoEmerytalne').value 
            : ''
    };
    
    if (!formData.nazwa) {
        showToast('Wprowadź nazwę aktywa', 'warning');
        return;
    }
    
    if (isNaN(formData.wartosc) || formData.wartosc <= 0) {
        showToast('Wprowadź prawidłową wartość', 'warning');
        return;
    }
    
    if (currentEditId) {
        await handleEditAsset(currentEditId, formData);
    } else {
        await handleAddAsset(formData);
    }
}

// ============================================
// MODAL - POTWIERDZENIE
// ============================================

function showDeleteConfirm(id, nazwa) {
    deleteAssetId = id;
    document.getElementById('confirmText').innerHTML = 
        `Czy na pewno chcesz usunąć aktywo <strong style="color: var(--text-primary)">${escapeHtml(nazwa)}</strong>?<br><span style="font-size: 0.875rem">Ta operacja jest nieodwracalna.</span>`;
    document.getElementById('confirmModal').classList.add('active');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
    deleteAssetId = null;
}

async function confirmDelete() {
    if (deleteAssetId) {
        await handleDeleteAsset(deleteAssetId);
    }
}

// ============================================
// POMOCNICZE
// ============================================

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.toggle('hidden', !show);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const iconsSvg = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${iconsSvg[type] || iconsSvg.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', initApp);
