/**
 * Assetly - Konfiguracja aplikacji
 * 
 * WAŻNE: Wklej swój Google Client ID poniżej!
 * Instrukcja: README.md
 */

const CONFIG = {
    // ============================================
    // WKLEJ TUTAJ SWÓJ GOOGLE CLIENT ID
    // ============================================
    GOOGLE_CLIENT_ID: '799146036720-7bb7nm102ooua14h54q5qnkgl7f5pune.apps.googleusercontent.com',
    
    // Uprawnienia wymagane przez aplikację
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
    
    // Discovery document dla Google Sheets API
    DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
    
    // API NBP dla kursów walut
    NBP_API_URL: 'https://api.nbp.pl/api/exchangerates/rates/a/',
    
    // Nazwa zakładki w arkuszu
    SHEET_NAME: 'Aktywa',
    
    // Klucz localStorage dla ID arkusza
    STORAGE_KEY_SPREADSHEET: 'assetly_spreadsheet_id',
    
    // Klucz localStorage dla danych użytkownika
    STORAGE_KEY_USER: 'assetly_user'
};

// Kategorie i podkategorie aktywów (po polsku)
const KATEGORIE = {
    'gotowka': {
        nazwa: 'Gotówka',
        ikona: '💵',
        podkategorie: [
            'Gotówka fizyczna PLN',
            'Gotówka USD',
            'Gotówka EUR',
            'Gotówka GBP',
            'Gotówka CHF',
            'Inne waluty gotówkowe'
        ]
    },
    'konta': {
        nazwa: 'Konta bankowe',
        ikona: '🏦',
        podkategorie: [
            'Konto osobiste PLN',
            'Konto oszczędnościowe PLN',
            'Konto walutowe USD',
            'Konto walutowe EUR',
            'Konto walutowe GBP',
            'Konto walutowe CHF',
            'Konto walutowe multi-currency'
        ]
    },
    'inwestycje': {
        nazwa: 'Inwestycje',
        ikona: '📈',
        podkategorie: [
            'Akcje (XTB)',
            'ETF (XTB)',
            'Obligacje',
            'Fundusze inwestycyjne',
            'Kryptowaluty',
            'Złoto/Srebro',
            'Inne instrumenty'
        ]
    },
    'nieruchomosci': {
        nazwa: 'Nieruchomości',
        ikona: '🏠',
        podkategorie: [
            'Mieszkanie własnościowe',
            'Dom',
            'Działka',
            'Garaż/Parking',
            'Lokal użytkowy',
            'Nieruchomość inwestycyjna'
        ]
    },
    'aktywa': {
        nazwa: 'Inne aktywa',
        ikona: '🚗',
        podkategorie: [
            'Samochód',
            'Motocykl',
            'Sprzęt elektroniczny',
            'Biżuteria',
            'Dzieła sztuki',
            'Inne'
        ]
    },
    'dlugi': {
        nazwa: 'Długi',
        ikona: '💳',
        podkategorie: [
            'Kredyt hipoteczny',
            'Kredyt konsumpcyjny',
            'Kredyt samochodowy',
            'Karta kredytowa',
            'Pożyczka prywatna',
            'Inne zobowiązania'
        ]
    }
};

// Wspierane waluty
const WALUTY = [
    'PLN', 'USD', 'EUR', 'GBP', 'CHF',
    'JPY', 'CAD', 'AUD', 'SEK', 'NOK'
];

// Kolory dla wykresu (dopasowane do kategorii)
const CHART_COLORS = {
    'gotowka': '#00D9B3',      // Miętowy
    'konta': '#6C63FF',         // Fioletowy
    'inwestycje': '#FFB800',    // Złoty
    'nieruchomosci': '#FF6B6B', // Czerwony
    'aktywa': '#4ECDC4',        // Turkusowy
    'dlugi': '#95A5A6'          // Szary
};
