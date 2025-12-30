/**
 * Assetly - Investments Module
 * Główna logika i nawigacja
 */

// Stan modułu
let investmentsInitialized = false;
let currentTab = 'overview';
let allAssets = [];
let investmentAssets = [];
let portfolios = [];
let plan = null;
let planInstruments = [];
let paymentHistory = [];

// ═══════════════════════════════════════════════════════════
// INICJALIZACJA
// ═══════════════════════════════════════════════════════════

async function initInvestments() {
    if (!requireAuth()) return;
    
    try {
        await initAuth();
        
        // Upewnij się, że zakładki istnieją
        await InvestmentsSheets.ensureSheetsExist();
        
        // Załaduj dane
        await loadInvestmentsData();
        
        // Setup UI
        setupInvestmentsEventListeners();
        
        // Renderuj pierwszy tab
        switchTab('overview');
        
        investmentsInitialized = true;
        
    } catch (error) {
        console.error('Błąd inicjalizacji modułu inwestycji:', error);
        showToast('Błąd ładowania modułu inwestycji', 'error');
    }
}

async function loadInvestmentsData() {
    showInvestmentsLoading(true);
    
    try {
        // Pobierz wszystkie aktywa
        const sheetsAPI = createSheetsAPI(CONFIG.SPREADSHEET_ID);
        allAssets = await sheetsAPI.getAllAssets();
        
        // Filtruj tylko inwestycje
        investmentAssets = allAssets.filter(a => a.kategoria === 'Inwestycje');
        
        // Pobierz portfele i przypisania
        portfolios = await InvestmentsSheets.getPortfolios();
        const assignments = await InvestmentsSheets.getAllPortfolioAssignments();
        
        // Przypisz aktywa do portfeli
        portfolios.forEach(p => {
            const assetIds = assignments
                .filter(a => a.portfolioId === p.id)
                .map(a => a.assetId);
            p.assets = investmentAssets.filter(a => assetIds.includes(a.id));
            p.wartosc = p.assets.reduce((sum, a) => sum + convertToPLN(a.wartosc, a.waluta), 0);
        });
        
        // Pobierz plan i instrumenty
        plan = await InvestmentsSheets.getPlan();
        planInstruments = await InvestmentsSheets.getPlanInstruments();
        
        // Pobierz historię
        paymentHistory = await InvestmentsSheets.getPaymentHistory();
        
        // Pobierz limity IKE/IKZE
        await IKE_IKZE.fetchLimits({ spreadsheetId: CONFIG.SPREADSHEET_ID });
        
    } catch (error) {
        console.error('Błąd ładowania danych:', error);
        throw error;
    } finally {
        showInvestmentsLoading(false);
    }
}

function setupInvestmentsEventListeners() {
    // Nawigacja tabów
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Wylogowanie
    document.getElementById('logoutBtn')?.addEventListener('click', handleGoogleLogout);
}

// ═══════════════════════════════════════════════════════════
// NAWIGACJA TABÓW
// ═══════════════════════════════════════════════════════════

function switchTab(tabName) {
    currentTab = tabName;
    
    // Aktualizuj przyciski
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Aktualizuj zawartość
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    
    // Renderuj zawartość
    switch (tabName) {
        case 'overview':
            renderOverview();
            break;
        case 'portfolios':
            renderPortfolios();
            break;
        case 'plan':
            renderPlan();
            break;
        case 'calculator':
            renderCalculator();
            break;
    }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function showInvestmentsLoading(show) {
    const loader = document.getElementById('investmentsLoader');
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

function getInvestmentsTotalValue() {
    return investmentAssets.reduce((sum, a) => sum + convertToPLN(a.wartosc, a.waluta), 0);
}

function getIKEValue() {
    return investmentAssets
        .filter(a => a.kontoEmerytalne === 'IKE')
        .reduce((sum, a) => sum + convertToPLN(a.wartosc, a.waluta), 0);
}

function getIKZEValue() {
    return investmentAssets
        .filter(a => a.kontoEmerytalne === 'IKZE')
        .reduce((sum, a) => sum + convertToPLN(a.wartosc, a.waluta), 0);
}

function getUnassignedAssets() {
    const assignedIds = portfolios.flatMap(p => p.assets.map(a => a.id));
    return investmentAssets.filter(a => !assignedIds.includes(a.id));
}

// Format helpers (używamy tych z app.js jeśli są dostępne)
function formatMoney(amount, currency = 'PLN') {
    return new Intl.NumberFormat('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount) + ' ' + currency;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatPercent(value) {
    return value.toFixed(1) + '%';
}

// Inicjalizacja po załadowaniu strony
document.addEventListener('DOMContentLoaded', initInvestments);
