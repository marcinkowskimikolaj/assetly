/**
 * Assetly - Budget Module
 * Główna logika i nawigacja
 */

// Stan modułu
let budgetInitialized = false;
let currentBudgetTab = 'overview';

// Dane budżetu
let wydatki = [];
let dochody = [];
let wydatkiStale = [];
let plany = [];
let ustawienia = {};
let planInwestycyjny = null;

// Cache podsumowań
let podsumowaniaMiesiecy = {};

// Nazwy miesięcy
const NAZWY_MIESIECY = [
    '', 'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

const NAZWY_MIESIECY_SHORT = [
    '', 'Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze',
    'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'
];

// ═══════════════════════════════════════════════════════════
// INICJALIZACJA
// ═══════════════════════════════════════════════════════════

async function initBudget() {
    if (!requireAuth()) return;
    
    try {
        await initAuth();
        
        // Upewnij się, że zakładki istnieją
        await BudgetSheets.ensureSheetsExist();
        
        // Załaduj dane
        await loadBudgetData();
        
        // Setup UI
        setupBudgetEventListeners();
        
        // Renderuj pierwszy tab
        switchBudgetTab('overview');
        
        budgetInitialized = true;
        
    } catch (error) {
        console.error('Błąd inicjalizacji modułu budżetu:', error);
        showToast('Błąd ładowania modułu budżetu', 'error');
    }
}

async function loadBudgetData() {
    showBudgetLoading(true);
    
    try {
        const [
            wydatkiData,
            dochodyData,
            wydatkiStaleData,
            planyData,
            ustawieniaData,
            planInwestData
        ] = await Promise.all([
            BudgetSheets.getWydatki(),
            BudgetSheets.getDochody(),
            BudgetSheets.getWydatkiStale(),
            BudgetSheets.getPlany(),
            BudgetSheets.getUstawienia(),
            BudgetSheets.getPlanInwestycyjny()
        ]);
        
        wydatki = wydatkiData;
        dochody = dochodyData;
        wydatkiStale = wydatkiStaleData;
        plany = planyData;
        ustawienia = ustawieniaData;
        planInwestycyjny = planInwestData;
        
        // Wyczyść cache
        podsumowaniaMiesiecy = {};
        
    } catch (error) {
        console.error('Błąd ładowania danych budżetu:', error);
        throw error;
    } finally {
        showBudgetLoading(false);
    }
}

async function refreshBudgetData() {
    await loadBudgetData();
    switchBudgetTab(currentBudgetTab);
}

function setupBudgetEventListeners() {
    // Nawigacja tabów
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchBudgetTab(tab);
        });
    });
    
    // Wylogowanie
    document.getElementById('logoutBtn')?.addEventListener('click', handleGoogleLogout);
}

// ═══════════════════════════════════════════════════════════
// NAWIGACJA TABÓW
// ═══════════════════════════════════════════════════════════

function switchBudgetTab(tabName) {
    currentBudgetTab = tabName;
    
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
            renderBudgetOverview();
            break;
        case 'expenses':
            renderBudgetExpenses();
            break;
        case 'income':
            renderBudgetIncome();
            break;
        case 'plans':
            renderBudgetPlans();
            break;
        case 'trends':
            renderBudgetTrends();
            break;
        case 'ai':
            renderBudgetAI();
            break;
    }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function showBudgetLoading(show) {
    const loader = document.getElementById('budgetLoader');
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

function formatMoney(amount, currency = 'PLN') {
    return new Intl.NumberFormat('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount) + ' ' + currency;
}

function formatMoneyShort(amount) {
    if (Math.abs(amount) >= 1000000) {
        return (amount / 1000000).toFixed(1) + 'M';
    }
    if (Math.abs(amount) >= 1000) {
        return (amount / 1000).toFixed(1) + 'k';
    }
    return amount.toFixed(0);
}

function formatPercent(value, decimals = 1) {
    const sign = value >= 0 ? '+' : '';
    return sign + value.toFixed(decimals) + '%';
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

function formatMiesiac(rok, miesiac) {
    return `${NAZWY_MIESIECY[miesiac]} ${rok}`;
}

function formatMiesiacShort(rok, miesiac) {
    return `${NAZWY_MIESIECY_SHORT[miesiac]} ${rok}`;
}

function getPoprzedniMiesiac(rok, miesiac) {
    if (miesiac === 1) {
        return { rok: rok - 1, miesiac: 12 };
    }
    return { rok, miesiac: miesiac - 1 };
}

function getNastepnyMiesiac(rok, miesiac) {
    if (miesiac === 12) {
        return { rok: rok + 1, miesiac: 1 };
    }
    return { rok, miesiac: miesiac + 1 };
}

function getRokTemu(rok, miesiac) {
    return { rok: rok - 1, miesiac };
}

function getOstatnioZamknietyMiesiac() {
    const now = new Date();
    // Zakładamy że obecny miesiąc nie jest jeszcze zamknięty
    return getPoprzedniMiesiac(now.getFullYear(), now.getMonth() + 1);
}

function getMiesiaceZDanych() {
    const miesiace = new Set();
    
    wydatki.forEach(w => {
        miesiace.add(`${w.rok}-${String(w.miesiac).padStart(2, '0')}`);
    });
    
    dochody.forEach(d => {
        miesiace.add(`${d.rok}-${String(d.miesiac).padStart(2, '0')}`);
    });
    
    return Array.from(miesiace)
        .sort()
        .reverse()
        .map(m => {
            const [rok, miesiac] = m.split('-').map(Number);
            return { rok, miesiac };
        });
}

function getOstatniZamknietyMiesiacZDanych() {
    const miesiace = getMiesiaceZDanych();
    return miesiace.length > 0 ? miesiace[0] : getOstatnioZamknietyMiesiac();
}

// ═══════════════════════════════════════════════════════════
// OBLICZENIA PODSUMOWAŃ
// ═══════════════════════════════════════════════════════════

function getPodsumowanieMiesiaca(rok, miesiac) {
    const key = `${rok}-${miesiac}`;
    
    if (podsumowaniaMiesiecy[key]) {
        return podsumowaniaMiesiecy[key];
    }
    
    const wydatkiMies = wydatki.filter(w => w.rok === rok && w.miesiac === miesiac);
    const dochodyMies = dochody.filter(d => d.rok === rok && d.miesiac === miesiac);
    
    const sumaDochodow = dochodyMies.reduce((sum, d) => sum + d.kwotaPLN, 0);
    const sumaWydatkow = wydatkiMies.filter(w => !w.jestTransfer).reduce((sum, w) => sum + w.kwotaPLN, 0);
    const sumaTransferow = wydatkiMies.filter(w => w.jestTransfer).reduce((sum, w) => sum + w.kwotaPLN, 0);
    const wydatkiStaleKwota = wydatkiMies.filter(w => w.jestStaly && !w.jestTransfer).reduce((sum, w) => sum + w.kwotaPLN, 0);
    const wydatkiZmienne = sumaWydatkow - wydatkiStaleKwota;
    
    const bilans = sumaDochodow - sumaWydatkow;
    const bilansPoTransferach = bilans - sumaTransferow;
    const stopaOszczednosci = sumaDochodow > 0 ? (bilans / sumaDochodow) * 100 : 0;
    
    // Wydatki per kategoria
    const wydatkiPerKategoria = {};
    wydatkiMies.filter(w => !w.jestTransfer).forEach(w => {
        if (!wydatkiPerKategoria[w.kategoria]) {
            wydatkiPerKategoria[w.kategoria] = { suma: 0, pozycje: [] };
        }
        wydatkiPerKategoria[w.kategoria].suma += w.kwotaPLN;
        wydatkiPerKategoria[w.kategoria].pozycje.push(w);
    });
    
    // Dochody per źródło
    const dochodyPerZrodlo = {};
    dochodyMies.forEach(d => {
        if (!dochodyPerZrodlo[d.zrodlo]) {
            dochodyPerZrodlo[d.zrodlo] = { suma: 0, pozycje: [] };
        }
        dochodyPerZrodlo[d.zrodlo].suma += d.kwotaPLN;
        dochodyPerZrodlo[d.zrodlo].pozycje.push(d);
    });
    
    const podsumowanie = {
        rok,
        miesiac,
        dochody: sumaDochodow,
        wydatki: sumaWydatkow,
        wydatkiStale: wydatkiStaleKwota,
        wydatkiZmienne,
        transfery: sumaTransferow,
        bilans,
        bilansPoTransferach,
        stopaOszczednosci,
        planInwestycji: planInwestycyjny?.kwotaMiesieczna || 0,
        wydatkiPerKategoria,
        dochodyPerZrodlo,
        liczbaWydatkow: wydatkiMies.length,
        liczbaDochodo: dochodyMies.length,
        maDane: wydatkiMies.length > 0 || dochodyMies.length > 0
    };
    
    podsumowaniaMiesiecy[key] = podsumowanie;
    return podsumowanie;
}

function getSrednieMiesieczne(liczbaMiesiecy = 6) {
    const miesiace = getMiesiaceZDanych().slice(0, liczbaMiesiecy);
    
    if (miesiace.length === 0) {
        return { dochody: 0, wydatki: 0, oszczednosci: 0, stopaOszczednosci: 0 };
    }
    
    let sumaDochody = 0;
    let sumaWydatki = 0;
    let sumaOszczednosci = 0;
    
    miesiace.forEach(m => {
        const p = getPodsumowanieMiesiaca(m.rok, m.miesiac);
        sumaDochody += p.dochody;
        sumaWydatki += p.wydatki;
        sumaOszczednosci += p.bilans;
    });
    
    const count = miesiace.length;
    const srDochody = sumaDochody / count;
    const srWydatki = sumaWydatki / count;
    const srOszczednosci = sumaOszczednosci / count;
    
    return {
        dochody: srDochody,
        wydatki: srWydatki,
        oszczednosci: srOszczednosci,
        stopaOszczednosci: srDochody > 0 ? (srOszczednosci / srDochody) * 100 : 0,
        liczbaMiesiecy: count
    };
}

function getSrednieKategorii(kategoria, liczbaMiesiecy = 6) {
    const miesiace = getMiesiaceZDanych().slice(0, liczbaMiesiecy);
    
    if (miesiace.length === 0) return 0;
    
    let suma = 0;
    miesiace.forEach(m => {
        const p = getPodsumowanieMiesiaca(m.rok, m.miesiac);
        suma += p.wydatkiPerKategoria[kategoria]?.suma || 0;
    });
    
    return suma / miesiace.length;
}

function getStatusDanych() {
    const miesiace = getMiesiaceZDanych();
    const teraz = new Date();
    const aktualnyRok = teraz.getFullYear();
    
    // Grupuj po roku
    const lata = {};
    
    // Dodaj obecny rok i poprzedni
    [aktualnyRok, aktualnyRok - 1].forEach(rok => {
        lata[rok] = [];
        for (let m = 1; m <= 12; m++) {
            const maDane = miesiace.some(x => x.rok === rok && x.miesiac === m);
            const p = maDane ? getPodsumowanieMiesiaca(rok, m) : null;
            
            let status = 'brak';
            if (maDane) {
                const maWydatki = p.liczbaWydatkow > 0;
                const maDochody = p.liczbaDochodo > 0;
                if (maWydatki && maDochody) {
                    status = 'kompletne';
                } else {
                    status = 'czesciowe';
                }
            }
            
            lata[rok].push({
                miesiac: m,
                status,
                podsumowanie: p
            });
        }
    });
    
    return lata;
}

// ═══════════════════════════════════════════════════════════
// PORÓWNANIA
// ═══════════════════════════════════════════════════════════

function porownajMiesiace(rok1, mies1, rok2, mies2) {
    const p1 = getPodsumowanieMiesiaca(rok1, mies1);
    const p2 = getPodsumowanieMiesiaca(rok2, mies2);
    
    const zmianaDochody = p2.dochody - p1.dochody;
    const zmianaWydatki = p2.wydatki - p1.wydatki;
    const zmianaBilans = p2.bilans - p1.bilans;
    
    return {
        okres1: { rok: rok1, miesiac: mies1, ...p1 },
        okres2: { rok: rok2, miesiac: mies2, ...p2 },
        zmiana: {
            dochody: zmianaDochody,
            dochodyProcent: p1.dochody > 0 ? (zmianaDochody / p1.dochody) * 100 : 0,
            wydatki: zmianaWydatki,
            wydatkiProcent: p1.wydatki > 0 ? (zmianaWydatki / p1.wydatki) * 100 : 0,
            bilans: zmianaBilans,
            bilansProcent: Math.abs(p1.bilans) > 0 ? (zmianaBilans / Math.abs(p1.bilans)) * 100 : 0
        }
    };
}

// ═══════════════════════════════════════════════════════════
// ANALIZA KATEGORII
// ═══════════════════════════════════════════════════════════

function getTopKategorie(rok, miesiac, limit = 5) {
    const p = getPodsumowanieMiesiaca(rok, miesiac);
    const srednie = {};
    
    // Oblicz średnie dla każdej kategorii
    Object.keys(p.wydatkiPerKategoria).forEach(kat => {
        srednie[kat] = getSrednieKategorii(kat, 6);
    });
    
    return Object.entries(p.wydatkiPerKategoria)
        .map(([kategoria, data]) => {
            const srednia = srednie[kategoria] || 0;
            const odchylenie = srednia > 0 ? ((data.suma - srednia) / srednia) * 100 : 0;
            
            return {
                kategoria,
                suma: data.suma,
                udzial: p.wydatki > 0 ? (data.suma / p.wydatki) * 100 : 0,
                srednia,
                odchylenie,
                trend: odchylenie > 10 ? 'up' : odchylenie < -10 ? 'down' : 'stable'
            };
        })
        .sort((a, b) => b.suma - a.suma)
        .slice(0, limit);
}

function getAnomalieKategorii(rok, miesiac, prog = 15) {
    const p = getPodsumowanieMiesiaca(rok, miesiac);
    const anomalie = [];
    
    Object.entries(p.wydatkiPerKategoria).forEach(([kategoria, data]) => {
        const srednia = getSrednieKategorii(kategoria, 6);
        if (srednia > 0) {
            const odchylenie = ((data.suma - srednia) / srednia) * 100;
            if (Math.abs(odchylenie) > prog) {
                anomalie.push({
                    kategoria,
                    kwota: data.suma,
                    srednia,
                    odchylenie,
                    typ: odchylenie > 0 ? 'wzrost' : 'spadek'
                });
            }
        }
    });
    
    return anomalie.sort((a, b) => Math.abs(b.odchylenie) - Math.abs(a.odchylenie));
}

// ═══════════════════════════════════════════════════════════
// HISTORIA WYNAGRODZEŃ
// ═══════════════════════════════════════════════════════════

function getHistoriaWynagrodzen() {
    // Filtruj tylko wynagrodzenia
    const wynagrodzenia = dochody.filter(d => d.zrodlo === 'Wynagrodzenie');
    
    // Grupuj po pracodawcy
    const perPracodawca = {};
    
    wynagrodzenia.forEach(w => {
        const pracodawca = w.pracodawca || 'Nieznany';
        if (!perPracodawca[pracodawca]) {
            perPracodawca[pracodawca] = [];
        }
        perPracodawca[pracodawca].push({
            rok: w.rok,
            miesiac: w.miesiac,
            kwota: w.kwotaPLN,
            data: `${w.rok}-${String(w.miesiac).padStart(2, '0')}`
        });
    });
    
    // Sortuj chronologicznie i znajdź podwyżki
    const wynik = {};
    
    Object.entries(perPracodawca).forEach(([pracodawca, historia]) => {
        historia.sort((a, b) => a.data.localeCompare(b.data));
        
        let ostatniaKwota = 0;
        const podwyzki = [];
        
        historia.forEach((h, i) => {
            if (i > 0 && h.kwota !== ostatniaKwota) {
                podwyzki.push({
                    data: h.data,
                    poprzednia: ostatniaKwota,
                    nowa: h.kwota,
                    zmiana: h.kwota - ostatniaKwota,
                    zmianaProcent: ostatniaKwota > 0 ? ((h.kwota - ostatniaKwota) / ostatniaKwota) * 100 : 0
                });
            }
            ostatniaKwota = h.kwota;
        });
        
        const pierwsza = historia[0];
        const ostatnia = historia[historia.length - 1];
        
        wynik[pracodawca] = {
            historia,
            podwyzki,
            pierwszaKwota: pierwsza?.kwota || 0,
            obecnaKwota: ostatnia?.kwota || 0,
            wzrostCalkowity: ostatnia && pierwsza ? ostatnia.kwota - pierwsza.kwota : 0,
            wzrostProcentowy: pierwsza?.kwota > 0 ? 
                ((ostatnia.kwota - pierwsza.kwota) / pierwsza.kwota) * 100 : 0,
            liczbaMiesiecy: historia.length,
            ostatniaPodwyzka: podwyzki.length > 0 ? podwyzki[podwyzki.length - 1] : null
        };
    });
    
    return wynik;
}

// ═══════════════════════════════════════════════════════════
// BUFOR AWARYJNY
// ═══════════════════════════════════════════════════════════

function getBuforAwaryjny() {
    const srednie = getSrednieMiesieczne(6);
    const celMiesiecy = ustawienia.buforAwaryjnyMiesiace || 6;
    const celKwota = srednie.wydatki * celMiesiecy;
    
    // Oblicz oszczędności (suma bilansów)
    const miesiace = getMiesiaceZDanych();
    let sumaOszczednosci = 0;
    miesiace.forEach(m => {
        const p = getPodsumowanieMiesiaca(m.rok, m.miesiac);
        sumaOszczednosci += p.bilans;
    });
    
    const obecneMiesiace = srednie.wydatki > 0 ? sumaOszczednosci / srednie.wydatki : 0;
    const brakuje = Math.max(0, celKwota - sumaOszczednosci);
    const miesiacyDoCelu = srednie.oszczednosci > 0 ? brakuje / srednie.oszczednosci : Infinity;
    
    return {
        celMiesiecy,
        celKwota,
        obecneOszczednosci: sumaOszczednosci,
        obecneMiesiace,
        brakuje,
        miesiacyDoCelu: miesiacyDoCelu === Infinity ? null : Math.ceil(miesiacyDoCelu),
        procent: celKwota > 0 ? (sumaOszczednosci / celKwota) * 100 : 0
    };
}

// ═══════════════════════════════════════════════════════════
// IKONY I KOLORY
// ═══════════════════════════════════════════════════════════

function getKategoriaColor(kategoria) {
    return KATEGORIE_WYDATKOW[kategoria]?.color || '#6B7280';
}

function getKategoriaIcon(kategoria) {
    const iconName = KATEGORIE_WYDATKOW[kategoria]?.icon || 'help-circle';
    return BUDGET_ICONS[iconName] || BUDGET_ICONS['help-circle'];
}

function getZrodloColor(zrodlo) {
    return ZRODLA_DOCHODOW[zrodlo]?.color || '#6B7280';
}

function getZrodloIcon(zrodlo) {
    const iconName = ZRODLA_DOCHODOW[zrodlo]?.icon || 'plus-circle';
    return BUDGET_ICONS[iconName] || BUDGET_ICONS['plus-circle'];
}

// Ikony SVG dla budżetu
const BUDGET_ICONS = {
    'car': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>`,
    'shopping-cart': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>`,
    'home': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>`,
    'users': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    'briefcase': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>`,
    'x-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    'help-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    'user': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    'trending-up': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>`,
    'credit-card': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    'music': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    'dollar-sign': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
    'plus-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
    'calendar': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    'arrow-up': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5,12 12,5 19,12"/></svg>`,
    'arrow-down': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19,12 12,19 5,12"/></svg>`,
    'check-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>`,
    'alert-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    'info': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    'plus': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    'edit': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    'trash': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`,
    'copy': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
    'settings': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`
};

// ═══════════════════════════════════════════════════════════
// EKSPORT FUNKCJI GLOBALNYCH
// ═══════════════════════════════════════════════════════════

// Te funkcje są dostępne globalnie dla innych plików

// Inicjalizacja po załadowaniu strony
document.addEventListener('DOMContentLoaded', initBudget);
