/**
 * Assetly - Budget Categories
 * Definicje kategorii wydatków i źródeł dochodów
 */

const BudgetCategories = {
    
    // ═══════════════════════════════════════════════════════════
    // KATEGORIE WYDATKÓW
    // ═══════════════════════════════════════════════════════════
    
    EXPENSE_CATEGORIES: {
        'Auto i transport': {
            subcategories: [
                'Auto i transport - inne',
                'Paliwo',
                'Parking i opłaty',
                'Przejazdy',
                'Serwis i części',
                'Ubezpieczenie auta'
            ],
            icon: '🚗',
            type: 'variable', // domyślny typ
            methodology: 'needs' // 50/30/20: needs, wants, savings
        },
        'Codzienne wydatki': {
            subcategories: [
                'Alkohol',
                'Codzienne wydatki - inne',
                'Jedzenie poza domem',
                'Papierosy',
                'Zwierzęta',
                'Żywność i chemia domowa'
            ],
            icon: '🛒',
            type: 'variable',
            methodology: 'needs',
            subcategoryMethodology: {
                'Jedzenie poza domem': 'wants',
                'Alkohol': 'wants',
                'Papierosy': 'wants'
            }
        },
        'Dom': {
            subcategories: [
                'Akcesoria i wyposażenie',
                'Dom - inne',
                'Remont i ogród',
                'Ubezpieczenie domu',
                'Usługi domowe'
            ],
            icon: '🏠',
            type: 'variable',
            methodology: 'needs'
        },
        'Dzieci': {
            subcategories: [
                'Art. dziecięce i zabawki',
                'Dzieci - inne',
                'Przedszkole i opiekunka',
                'Szkoła i wyprawka',
                'Zajęcia dodatkowe'
            ],
            icon: '👶',
            type: 'variable',
            methodology: 'needs'
        },
        'Firmowe': {
            subcategories: [
                'Firmowe - inne',
                'Przelew na rach. firmowy',
                'Zakupy firmowe'
            ],
            icon: '💼',
            type: 'variable',
            methodology: 'needs',
            isTransfer: {
                'Przelew na rach. firmowy': true
            }
        },
        'Nieistotne': {
            subcategories: [],
            icon: '❓',
            type: 'variable',
            methodology: 'wants'
        },
        'Nieskategoryzowane': {
            subcategories: [],
            icon: '📦',
            type: 'variable',
            methodology: 'wants'
        },
        'Osobiste': {
            subcategories: [
                'Edukacja',
                'Elektronika',
                'Multimedia, książki i prasa',
                'Odzież i obuwie',
                'Osobiste - inne',
                'Prezenty i wsparcie',
                'Zdrowie i uroda'
            ],
            icon: '👤',
            type: 'variable',
            methodology: 'wants',
            subcategoryMethodology: {
                'Zdrowie i uroda': 'needs'
            }
        },
        'Oszczędności i inw.': {
            subcategories: [
                'Fundusze',
                'Giełda',
                'Lokaty i konto oszcz.',
                'Oszczędności i inw. - inne',
                'Regularne oszczędzanie'
            ],
            icon: '💰',
            type: 'variable',
            methodology: 'savings',
            isTransfer: true // cała kategoria to transfery
        },
        'Płatności': {
            subcategories: [
                'Czynsz i wynajem',
                'Gaz',
                'Ogrzewanie',
                'Opłaty i odsetki',
                'Płatności - inne',
                'Podatki',
                'Prąd',
                'Spłaty rat',
                'TV, internet, telefon',
                'Ubezpieczenia',
                'Woda i kanalizacja'
            ],
            icon: '📋',
            type: 'fixed',
            methodology: 'needs'
        },
        'Rozrywka': {
            subcategories: [
                'Podróże i wyjazdy',
                'Rozrywka - inne',
                'Sport i hobby',
                'Wyjścia i wydarzenia'
            ],
            icon: '🎉',
            type: 'variable',
            methodology: 'wants'
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // ŹRÓDŁA DOCHODÓW
    // ═══════════════════════════════════════════════════════════
    
    INCOME_SOURCES: {
        'Wynagrodzenie': {
            subtypes: ['Podstawowe', 'Premia', 'Nadgodziny', 'Benefity'],
            icon: '💵',
            isRegular: true
        },
        'Działalność': {
            subtypes: ['Freelance / B2B', 'Przychody z biznesu', 'Tantiemy / Licencje'],
            icon: '🏢',
            isRegular: false
        },
        'Pasywne': {
            subtypes: ['Dywidendy', 'Odsetki', 'Wynajem', 'Zwrot podatku'],
            icon: '📈',
            isRegular: false
        },
        'Inne': {
            subtypes: ['Sprzedaż rzeczy', 'Prezenty otrzymane', 'Zwroty i reklamacje', 'Inne'],
            icon: '📥',
            isRegular: false
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // CZĘSTOTLIWOŚĆ WYDATKÓW STAŁYCH
    // ═══════════════════════════════════════════════════════════
    
    FREQUENCIES: {
        'monthly': { label: 'Miesięcznie', multiplier: 12 },
        'quarterly': { label: 'Kwartalnie', multiplier: 4 },
        'yearly': { label: 'Rocznie', multiplier: 1 }
    },
    
    // ═══════════════════════════════════════════════════════════
    // PRIORYTETY PLANÓW
    // ═══════════════════════════════════════════════════════════
    
    PRIORITIES: {
        'must': { label: 'Konieczne', color: '#ef4444', icon: '🔴' },
        'should': { label: 'Ważne', color: '#f59e0b', icon: '🟡' },
        'nice': { label: 'Opcjonalne', color: '#22c55e', icon: '🟢' }
    },
    
    // ═══════════════════════════════════════════════════════════
    // METODY POMOCNICZE
    // ═══════════════════════════════════════════════════════════
    
    getAllCategories() {
        return Object.keys(this.EXPENSE_CATEGORIES);
    },
    
    getSubcategories(category) {
        return this.EXPENSE_CATEGORIES[category]?.subcategories || [];
    },
    
    getCategoryIcon(category) {
        return this.EXPENSE_CATEGORIES[category]?.icon || '📦';
    },
    
    getIncomeIcon(source) {
        return this.INCOME_SOURCES[source]?.icon || '💵';
    },
    
    isTransferCategory(category, subcategory = null) {
        const cat = this.EXPENSE_CATEGORIES[category];
        if (!cat) return false;
        
        // Cała kategoria to transfer
        if (cat.isTransfer === true) return true;
        
        // Konkretna podkategoria to transfer
        if (subcategory && cat.isTransfer && cat.isTransfer[subcategory]) {
            return true;
        }
        
        return false;
    },
    
    isFixedCategory(category) {
        return this.EXPENSE_CATEGORIES[category]?.type === 'fixed';
    },
    
    getMethodology(category, subcategory = null) {
        const cat = this.EXPENSE_CATEGORIES[category];
        if (!cat) return 'wants';
        
        // Sprawdź czy podkategoria ma własną metodologię
        if (subcategory && cat.subcategoryMethodology && cat.subcategoryMethodology[subcategory]) {
            return cat.subcategoryMethodology[subcategory];
        }
        
        return cat.methodology || 'wants';
    },
    
    // Grupuj wydatki wg metodyki 50/30/20
    groupByMethodology(expenses) {
        const result = {
            needs: { total: 0, items: [] },
            wants: { total: 0, items: [] },
            savings: { total: 0, items: [] }
        };
        
        expenses.forEach(e => {
            // Pomiń transfery
            if (e.jestTransfer || this.isTransferCategory(e.kategoria, e.podkategoria)) {
                return;
            }
            
            const method = this.getMethodology(e.kategoria, e.podkategoria);
            result[method].total += e.kwotaPLN;
            result[method].items.push(e);
        });
        
        return result;
    },
    
    // Walidacja kategorii
    isValidCategory(category) {
        return Object.keys(this.EXPENSE_CATEGORIES).includes(category);
    },
    
    isValidSubcategory(category, subcategory) {
        if (!subcategory) return true;
        const subs = this.getSubcategories(category);
        return subs.length === 0 || subs.includes(subcategory);
    },
    
    isValidIncomeSource(source) {
        return Object.keys(this.INCOME_SOURCES).includes(source);
    },
    
    // Generuj opcje dla selectów
    getCategoryOptions() {
        return this.getAllCategories().map(cat => ({
            value: cat,
            label: `${this.getCategoryIcon(cat)} ${cat}`,
            icon: this.getCategoryIcon(cat)
        }));
    },
    
    getSubcategoryOptions(category) {
        const subs = this.getSubcategories(category);
        if (subs.length === 0) {
            return [{ value: '', label: '(brak podkategorii)' }];
        }
        return [
            { value: '', label: '-- wybierz --' },
            ...subs.map(sub => ({ value: sub, label: sub }))
        ];
    },
    
    getIncomeSourceOptions() {
        return Object.keys(this.INCOME_SOURCES).map(src => ({
            value: src,
            label: `${this.getIncomeIcon(src)} ${src}`,
            icon: this.getIncomeIcon(src)
        }));
    },
    
    getFrequencyOptions() {
        return Object.entries(this.FREQUENCIES).map(([value, data]) => ({
            value,
            label: data.label
        }));
    },
    
    getPriorityOptions() {
        return Object.entries(this.PRIORITIES).map(([value, data]) => ({
            value,
            label: `${data.icon} ${data.label}`,
            color: data.color
        }));
    },
    
    // Nazwy miesięcy
    MONTH_NAMES: [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ],
    
    MONTH_NAMES_SHORT: [
        'Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze',
        'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'
    ],
    
    getMonthName(month, short = false) {
        const names = short ? this.MONTH_NAMES_SHORT : this.MONTH_NAMES;
        return names[month - 1] || '';
    },
    
    formatPeriod(rok, miesiac) {
        return `${this.getMonthName(miesiac)} ${rok}`;
    }
};
