/**
 * Assetly - Główna logika aplikacji
 */

// Stan aplikacji
let sheetsAPI = null;
let assets = [];
let currencyRates = { PLN: 1 };
let pieChart = null;
let currentEditId = null;

// ============================================
// INICJALIZACJA
// ============================================

/**
 * Główna inicjalizacja aplikacji
 */
async function initApp() {
    // Sprawdź autoryzację
    if (!requireAuth()) return;
    
    // Inicjalizuj Google API
    try {
        await initAuth();
        
        // Sprawdź zapisany spreadsheet ID
        const savedId = localStorage.getItem(CONFIG.STORAGE_KEY_SPREADSHEET);
        if (savedId) {
            document.getElementById('spreadsheetId').value = savedId;
            await connectSpreadsheet(savedId);
        } else {
            updateConnectionStatus('disconnected', 'Wklej ID arkusza');
        }
        
        // Event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Błąd inicjalizacji:', error);
        showToast('Błąd inicjalizacji aplikacji', 'error');
    }
}

/**
 * Konfiguracja event listenerów
 */
function setupEventListeners() {
    // Połączenie z arkuszem
    document.getElementById('connectBtn').addEventListener('click', handleConnect);
    document.getElementById('spreadsheetId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleConnect();
    });
    
    // Wylogowanie
    document.getElementById('logoutBtn').addEventListener('click', handleGoogleLogout);
    
    // Dodawanie aktywa
    document.getElementById('addAssetBtn').addEventListener('click', () => showAddAssetModal());
    
    // Modal
    document.getElementById('assetModal').addEventListener('click', (e) => {
        if (e.target.id === 'assetModal') closeModal();
    });
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('assetForm').addEventListener('submit', handleAssetFormSubmit);
    
    // Dynamiczne podkategorie
    document.getElementById('kategoria').addEventListener('change', updatePodkategorie);
    
    // Modal potwierdzenia
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target.id === 'confirmModal') closeConfirmModal();
    });
    document.getElementById('confirmCancelBtn').addEventListener('click', closeConfirmModal);
}

// ============================================
// POŁĄCZENIE Z ARKUSZEM
// ============================================

/**
 * Obsługa przycisku połączenia
 */
async function handleConnect() {
    const spreadsheetId = document.getElementById('spreadsheetId').value.trim();
    
    if (!spreadsheetId) {
        showToast('Wprowadź ID arkusza', 'warning');
        return;
    }
    
    await connectSpreadsheet(spreadsheetId);
}

/**
 * Połącz z arkuszem Google Sheets
 */
async function connectSpreadsheet(spreadsheetId) {
    updateConnectionStatus('loading', 'Łączenie...');
    
    try {
        // Upewnij się, że mamy token
        await ensureValidToken();
        
        // Utwórz instancję API
        sheetsAPI = createSheetsAPI(spreadsheetId);
        
        // Testuj połączenie
        await sheetsAPI.testConnection();
        
        // Zapisz ID
        localStorage.setItem(CONFIG.STORAGE_KEY_SPREADSHEET, spreadsheetId);
        
        updateConnectionStatus('connected', 'Połączono');
        showToast('Połączono z arkuszem!', 'success');
        
        // Pobierz kursy walut i załaduj dane
        await fetchCurrencyRates();
        await loadAssets();
        
    } catch (error) {
        console.error('Błąd połączenia:', error);
        updateConnectionStatus('disconnected', 'Błąd połączenia');
        
        let message = 'Nie można połączyć z arkuszem';
        if (error.message?.includes('Brak zakładki')) {
            message = error.message;
        } else if (error.status === 404) {
            message = 'Nie znaleziono arkusza o podanym ID';
        } else if (error.status === 403) {
            message = 'Brak dostępu do arkusza. Sprawdź uprawnienia.';
        }
        
        showToast(message, 'error');
    }
}

/**
 * Aktualizuj status połączenia w UI
 */
function updateConnectionStatus(status, text) {
    const statusEl = document.getElementById('connectionStatus');
    statusEl.className = `connection-status ${status}`;
    
    const icons = {
        connected: '✅',
        disconnected: '❌',
        loading: '⏳'
    };
    
    statusEl.innerHTML = `<span>${icons[status] || ''}</span> ${text}`;
}

// ============================================
// KURSY WALUT (NBP API)
// ============================================

/**
 * Pobierz kursy walut z NBP
 */
async function fetchCurrencyRates() {
    const currencies = WALUTY.filter(c => c !== 'PLN');
    
    for (const currency of currencies) {
        try {
            const response = await fetch(`${CONFIG.NBP_API_URL}${currency}/?format=json`);
            
            if (response.ok) {
                const data = await response.json();
                currencyRates[currency] = data.rates[0].mid;
            }
        } catch (error) {
            console.warn(`Nie udało się pobrać kursu ${currency}:`, error);
            // Ustaw domyślny kurs
            currencyRates[currency] = 1;
        }
    }
    
    console.log('Kursy walut:', currencyRates);
}

/**
 * Konwertuj wartość na PLN
 */
function convertToPLN(amount, currency) {
    if (currency === 'PLN') return amount;
    
    const rate = currencyRates[currency] || 1;
    return amount * rate;
}

/**
 * Formatuj kwotę
 */
function formatCurrency(amount, currency = 'PLN') {
    return new Intl.NumberFormat('pl-PL', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount) + ' ' + currency;
}

// ============================================
// ZARZĄDZANIE AKTYWAMI
// ============================================

/**
 * Załaduj aktywa z arkusza
 */
async function loadAssets() {
    showLoading(true);
    
    try {
        assets = await sheetsAPI.getAllAssets();
        renderDashboard();
    } catch (error) {
        console.error('Błąd ładowania aktywów:', error);
        showToast('Błąd ładowania danych', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Dodaj nowe aktywo
 */
async function handleAddAsset(formData) {
    try {
        showLoading(true);
        await sheetsAPI.addAsset(formData);
        await loadAssets();
        showToast('Aktywo dodane!', 'success');
        closeModal();
    } catch (error) {
        console.error('Błąd dodawania:', error);
        showToast('Nie udało się dodać aktywa', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Edytuj aktywo
 */
async function handleEditAsset(id, formData) {
    try {
        showLoading(true);
        await sheetsAPI.updateAsset(id, formData);
        await loadAssets();
        showToast('Aktywo zaktualizowane!', 'success');
        closeModal();
    } catch (error) {
        console.error('Błąd edycji:', error);
        showToast('Nie udało się zaktualizować aktywa', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Usuń aktywo
 */
async function handleDeleteAsset(id) {
    try {
        showLoading(true);
        await sheetsAPI.deleteAsset(id);
        await loadAssets();
        showToast('Aktywo usunięte', 'success');
        closeConfirmModal();
    } catch (error) {
        console.error('Błąd usuwania:', error);
        showToast('Nie udało się usunąć aktywa', 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// KALKULACJE
// ============================================

/**
 * Oblicz całkowitą wartość netto majątku
 */
function calculateTotalWorth() {
    return assets.reduce((total, asset) => {
        const valuePLN = convertToPLN(asset.wartosc, asset.waluta);
        
        // Długi odejmujemy
        if (asset.kategoria === 'Długi') {
            return total - Math.abs(valuePLN);
        }
        return total + valuePLN;
    }, 0);
}

/**
 * Oblicz rozkład majątku po kategoriach
 */
function calculateCategoryBreakdown() {
    const breakdown = {};
    
    // Inicjalizuj wszystkie kategorie
    Object.entries(KATEGORIE).forEach(([key, cat]) => {
        breakdown[key] = {
            nazwa: cat.nazwa,
            ikona: cat.ikona,
            wartosc: 0
        };
    });
    
    // Sumuj wartości
    assets.forEach(asset => {
        const categoryKey = getCategoryKey(asset.kategoria);
        if (categoryKey && breakdown[categoryKey]) {
            const valuePLN = convertToPLN(asset.wartosc, asset.waluta);
            
            if (categoryKey === 'dlugi') {
                breakdown[categoryKey].wartosc -= Math.abs(valuePLN);
            } else {
                breakdown[categoryKey].wartosc += valuePLN;
            }
        }
    });
    
    return breakdown;
}

/**
 * Znajdź klucz kategorii na podstawie nazwy
 */
function getCategoryKey(categoryName) {
    for (const [key, value] of Object.entries(KATEGORIE)) {
        if (value.nazwa === categoryName) {
            return key;
        }
    }
    return null;
}

// ============================================
// RENDEROWANIE UI
// ============================================

/**
 * Wyrenderuj cały dashboard
 */
function renderDashboard() {
    renderNetWorth();
    renderBreakdown();
    renderChart();
    renderAssetsList();
}

/**
 * Renderuj wartość netto
 */
function renderNetWorth() {
    const total = calculateTotalWorth();
    const formattedValue = new Intl.NumberFormat('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(total);
    
    document.getElementById('netWorthValue').textContent = formattedValue;
}

/**
 * Renderuj rozkład majątku
 */
function renderBreakdown() {
    const breakdown = calculateCategoryBreakdown();
    const container = document.getElementById('breakdownList');
    
    container.innerHTML = Object.entries(breakdown)
        .filter(([_, data]) => data.wartosc !== 0)
        .sort((a, b) => Math.abs(b[1].wartosc) - Math.abs(a[1].wartosc))
        .map(([key, data]) => `
            <div class="breakdown-item">
                <div class="breakdown-item-left">
                    <span class="breakdown-item-icon">${data.ikona}</span>
                    <span class="breakdown-item-name">${data.nazwa}</span>
                </div>
                <span class="breakdown-item-value ${data.wartosc < 0 ? 'negative' : ''}">
                    ${formatCurrency(data.wartosc)}
                </span>
            </div>
        `).join('');
    
    if (container.innerHTML === '') {
        container.innerHTML = '<p class="text-center" style="color: var(--text-dim); padding: 20px;">Brak aktywów</p>';
    }
}

/**
 * Renderuj wykres kołowy
 */
function renderChart() {
    const ctx = document.getElementById('pieChart').getContext('2d');
    const breakdown = calculateCategoryBreakdown();
    
    // Przygotuj dane (tylko wartości dodatnie dla wykresu)
    const chartData = Object.entries(breakdown)
        .filter(([key, data]) => data.wartosc > 0 && key !== 'dlugi')
        .sort((a, b) => b[1].wartosc - a[1].wartosc);
    
    if (chartData.length === 0) {
        // Pusty wykres
        if (pieChart) {
            pieChart.destroy();
            pieChart = null;
        }
        return;
    }
    
    const labels = chartData.map(([_, data]) => data.nazwa);
    const values = chartData.map(([_, data]) => data.wartosc);
    const colors = chartData.map(([key, _]) => CHART_COLORS[key] || '#6C63FF');
    
    // Zniszcz poprzedni wykres jeśli istnieje
    if (pieChart) {
        pieChart.destroy();
    }
    
    // Utwórz nowy wykres
    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: 'rgba(30, 30, 63, 1)',
                borderWidth: 3,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 30, 63, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#B4B4C8',
                    borderColor: 'rgba(108, 99, 255, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.raw);
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

/**
 * Renderuj listę aktywów
 */
function renderAssetsList() {
    const container = document.getElementById('assetsList');
    
    if (assets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p class="empty-state-text">Nie masz jeszcze żadnych aktywów</p>
                <button class="btn btn-primary" onclick="showAddAssetModal()">
                    Dodaj pierwsze aktywo
                </button>
            </div>
        `;
        return;
    }
    
    // Sortuj: najpierw po kategorii, potem po wartości
    const sortedAssets = [...assets].sort((a, b) => {
        if (a.kategoria !== b.kategoria) {
            return a.kategoria.localeCompare(b.kategoria);
        }
        return convertToPLN(b.wartosc, b.waluta) - convertToPLN(a.wartosc, a.waluta);
    });
    
    container.innerHTML = sortedAssets.map(asset => {
        const categoryKey = getCategoryKey(asset.kategoria);
        const categoryData = KATEGORIE[categoryKey] || { ikona: '📦' };
        const valuePLN = convertToPLN(asset.wartosc, asset.waluta);
        const isDebt = asset.kategoria === 'Długi';
        const displayValue = isDebt ? -Math.abs(asset.wartosc) : asset.wartosc;
        const displayValuePLN = isDebt ? -Math.abs(valuePLN) : valuePLN;
        
        return `
            <div class="asset-card">
                <div class="asset-info">
                    <div class="asset-icon">${categoryData.ikona}</div>
                    <div class="asset-details">
                        <div class="asset-name">${escapeHtml(asset.nazwa)}</div>
                        <div class="asset-category">${escapeHtml(asset.podkategoria)}</div>
                    </div>
                </div>
                <div class="asset-values">
                    <div class="asset-value-main ${isDebt ? 'negative' : ''}">
                        ${formatCurrency(displayValue, asset.waluta)}
                    </div>
                    ${asset.waluta !== 'PLN' ? `
                        <div class="asset-value-converted">
                            ≈ ${formatCurrency(displayValuePLN)}
                        </div>
                    ` : ''}
                </div>
                <div class="asset-actions">
                    <button class="btn btn-secondary btn-sm" onclick="showEditAssetModal('${asset.id}')">
                        Edytuj
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="showDeleteConfirm('${asset.id}', '${escapeHtml(asset.nazwa)}')">
                        Usuń
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// MODAL - DODAWANIE/EDYCJA
// ============================================

/**
 * Pokaż modal dodawania aktywa
 */
function showAddAssetModal() {
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'Dodaj aktywo';
    document.getElementById('submitBtn').textContent = 'Dodaj';
    document.getElementById('assetForm').reset();
    
    // Wypełnij kategorie
    populateCategories();
    updatePodkategorie();
    
    document.getElementById('assetModal').classList.add('active');
}

/**
 * Pokaż modal edycji aktywa
 */
function showEditAssetModal(id) {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    
    currentEditId = id;
    document.getElementById('modalTitle').textContent = 'Edytuj aktywo';
    document.getElementById('submitBtn').textContent = 'Zapisz';
    
    // Wypełnij kategorie
    populateCategories();
    
    // Ustaw wartości
    document.getElementById('kategoria').value = asset.kategoria;
    updatePodkategorie();
    document.getElementById('podkategoria').value = asset.podkategoria;
    document.getElementById('nazwa').value = asset.nazwa;
    document.getElementById('wartosc').value = asset.wartosc;
    document.getElementById('waluta').value = asset.waluta;
    document.getElementById('notatki').value = asset.notatki || '';
    
    document.getElementById('assetModal').classList.add('active');
}

/**
 * Zamknij modal
 */
function closeModal() {
    document.getElementById('assetModal').classList.remove('active');
    currentEditId = null;
}

/**
 * Wypełnij dropdown kategorii
 */
function populateCategories() {
    const select = document.getElementById('kategoria');
    select.innerHTML = Object.entries(KATEGORIE)
        .map(([key, cat]) => `<option value="${cat.nazwa}">${cat.ikona} ${cat.nazwa}</option>`)
        .join('');
}

/**
 * Aktualizuj dropdown podkategorii
 */
function updatePodkategorie() {
    const kategoriaValue = document.getElementById('kategoria').value;
    const select = document.getElementById('podkategoria');
    
    // Znajdź kategorię
    let podkategorie = [];
    for (const [key, cat] of Object.entries(KATEGORIE)) {
        if (cat.nazwa === kategoriaValue) {
            podkategorie = cat.podkategorie;
            break;
        }
    }
    
    select.innerHTML = podkategorie
        .map(p => `<option value="${p}">${p}</option>`)
        .join('');
}

/**
 * Obsługa formularza aktywa
 */
async function handleAssetFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        kategoria: document.getElementById('kategoria').value,
        podkategoria: document.getElementById('podkategoria').value,
        nazwa: document.getElementById('nazwa').value.trim(),
        wartosc: parseFloat(document.getElementById('wartosc').value),
        waluta: document.getElementById('waluta').value,
        notatki: document.getElementById('notatki').value.trim()
    };
    
    // Walidacja
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
// MODAL - POTWIERDZENIE USUNIĘCIA
// ============================================

let deleteAssetId = null;

/**
 * Pokaż modal potwierdzenia usunięcia
 */
function showDeleteConfirm(id, nazwa) {
    deleteAssetId = id;
    document.getElementById('confirmText').innerHTML = 
        `Czy na pewno chcesz usunąć aktywo <strong>${escapeHtml(nazwa)}</strong>?`;
    document.getElementById('confirmModal').classList.add('active');
}

/**
 * Zamknij modal potwierdzenia
 */
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
    deleteAssetId = null;
}

/**
 * Potwierdź usunięcie
 */
async function confirmDelete() {
    if (deleteAssetId) {
        await handleDeleteAsset(deleteAssetId);
    }
}

// ============================================
// POMOCNICZE
// ============================================

/**
 * Pokaż/ukryj loading
 */
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.toggle('hidden', !show);
    }
}

/**
 * Pokaż toast
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || ''}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    // Usuń po 4 sekundach
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// INICJALIZACJA PO ZAŁADOWANIU STRONY
// ============================================

document.addEventListener('DOMContentLoaded', initApp);
