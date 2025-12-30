/**
 * Assetly - Konfiguracja aplikacji
 */

const CONFIG = {
    // ============================================
    // GOOGLE API - Wklej swój Client ID
    // ============================================
    GOOGLE_CLIENT_ID: '799146036720-7bb7nm102ooua14h54q5qnkgl7f5pune.apps.googleusercontent.com',
    
    // ============================================
    // GOOGLE SHEETS - Wklej ID swojego arkusza
    // Aplikacja połączy się automatycznie po zalogowaniu
    // ============================================
    SPREADSHEET_ID: '1x7fhL0ES2_xmsLgYS8_lTT7xFjaNLsGi8AAcvyi-DUg',
    
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
    DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
    NBP_API_URL: 'https://api.nbp.pl/api/exchangerates/rates/a/',
    SHEET_NAME: 'Aktywa',
    STORAGE_KEY_USER: 'assetly_user'
};

// Kategorie aktywów
const KATEGORIE = {
    'gotowka': {
        nazwa: 'Gotówka',
        icon: 'cash',
        color: '#10B981',
        podkategorie: ['Gotówka fizyczna PLN', 'Gotówka USD', 'Gotówka EUR', 'Gotówka GBP', 'Gotówka CHF', 'Inne waluty gotówkowe']
    },
    'konta': {
        nazwa: 'Konta bankowe',
        icon: 'bank',
        color: '#6366F1',
        podkategorie: ['Konto osobiste PLN', 'Konto oszczędnościowe PLN', 'Konto walutowe USD', 'Konto walutowe EUR', 'Konto walutowe GBP', 'Konto walutowe CHF', 'Konto walutowe multi-currency']
    },
    'inwestycje': {
        nazwa: 'Inwestycje',
        icon: 'chart',
        color: '#F59E0B',
        podkategorie: ['Akcje (XTB)', 'ETF (XTB)', 'Obligacje', 'Fundusze inwestycyjne', 'Kryptowaluty', 'Złoto/Srebro', 'Inne instrumenty']
    },
    'nieruchomosci': {
        nazwa: 'Nieruchomości',
        icon: 'home',
        color: '#EC4899',
        podkategorie: ['Mieszkanie własnościowe', 'Dom', 'Działka', 'Garaż/Parking', 'Lokal użytkowy', 'Nieruchomość inwestycyjna']
    },
    'aktywa': {
        nazwa: 'Inne aktywa',
        icon: 'car',
        color: '#14B8A6',
        podkategorie: ['Samochód', 'Motocykl', 'Sprzęt elektroniczny', 'Biżuteria', 'Dzieła sztuki', 'Inne']
    },
    'dlugi': {
        nazwa: 'Długi',
        icon: 'credit-card',
        color: '#EF4444',
        podkategorie: ['Kredyt hipoteczny', 'Kredyt konsumpcyjny', 'Kredyt samochodowy', 'Karta kredytowa', 'Pożyczka prywatna', 'Inne zobowiązania']
    }
};

const WALUTY = ['PLN', 'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK'];

// SVG Icons
const ICONS = {
    cash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>`,
    bank: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 9l-5 5-4-4-4 4"/></svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>`,
    car: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>`,
    'credit-card': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 100 4 2 2 0 000-4z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
    grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};
