/**
 * Assetly - Budget AI Compute (v3)
 * Deterministyczne funkcje obliczeniowe dla AI
 * 
 * ZMIANY v3:
 * - topExpenses respektuje filtry kategorii (filterCategory param)
 * - monthlyBreakdown zwraca notFound gdy brak danych
 * - Metadane w wynikach (_meta) do weryfikacji spójności
 * - Obsługa zarówno "value" jak i "amount" w breakdown
 * - Stabilna iteracja po obiektach (Object.entries zamiast keys+values)
 * - Eliminacja pustych tokenów w normalizacji
 */

const BudgetAICompute = {
    
    // ═══════════════════════════════════════════════════════════
    // SŁOWNIK SYNONIMÓW I NORMALIZACJA
    // ═══════════════════════════════════════════════════════════
    
    // Synonimy kategorii (mapowanie na nazwę kategorii)
    CATEGORY_SYNONYMS: {
        'auto': 'Auto i transport',
        'samochód': 'Auto i transport',
        'samochod': 'Auto i transport',
        'transport': 'Auto i transport',
        'jazda': 'Auto i transport',
        'jedzenie': 'Codzienne wydatki',
        'żywność': 'Codzienne wydatki',
        'zywnosc': 'Codzienne wydatki',
        'zakupy': 'Codzienne wydatki',
        'codzienne': 'Codzienne wydatki',
        'spożywcze': 'Codzienne wydatki',
        'dom': 'Dom',
        'mieszkanie': 'Dom',
        'remont': 'Dom',
        'dzieci': 'Dzieci',
        'dziecko': 'Dzieci',
        'firma': 'Firmowe',
        'biznes': 'Firmowe',
        'działalność': 'Firmowe',
        'osobiste': 'Osobiste',
        'prywatne': 'Osobiste',
        'oszczędności': 'Oszczędności i inw.',
        'oszczednosci': 'Oszczędności i inw.',
        'inwestycje': 'Oszczędności i inw.',
        'lokaty': 'Oszczędności i inw.',
        'płatności': 'Płatności',
        'platnosci': 'Płatności',
        'rachunki': 'Płatności',
        'opłaty': 'Płatności',
        'oplaty': 'Płatności',
        'rozrywka': 'Rozrywka',
        'zabawa': 'Rozrywka',
        'hobby': 'Rozrywka'
    },
    
    // Synonimy podkategorii (mapowanie na {category, subcategory})
    SUBCATEGORY_SYNONYMS: {
        // Auto i transport
        'paliwo': { category: 'Auto i transport', subcategory: 'Paliwo' },
        'benzyna': { category: 'Auto i transport', subcategory: 'Paliwo' },
        'diesel': { category: 'Auto i transport', subcategory: 'Paliwo' },
        'tankowanie': { category: 'Auto i transport', subcategory: 'Paliwo' },
        'stacja benzynowa': { category: 'Auto i transport', subcategory: 'Paliwo' },
        'parking': { category: 'Auto i transport', subcategory: 'Parking i opłaty' },
        'autostrada': { category: 'Auto i transport', subcategory: 'Parking i opłaty' },
        'opłaty drogowe': { category: 'Auto i transport', subcategory: 'Parking i opłaty' },
        'serwis': { category: 'Auto i transport', subcategory: 'Serwis i części' },
        'mechanik': { category: 'Auto i transport', subcategory: 'Serwis i części' },
        'naprawa auta': { category: 'Auto i transport', subcategory: 'Serwis i części' },
        'ubezpieczenie auta': { category: 'Auto i transport', subcategory: 'Ubezpieczenie auta' },
        'oc': { category: 'Auto i transport', subcategory: 'Ubezpieczenie auta' },
        'ac': { category: 'Auto i transport', subcategory: 'Ubezpieczenie auta' },
        
        // Codzienne wydatki
        'restauracja': { category: 'Codzienne wydatki', subcategory: 'Jedzenie poza domem' },
        'restauracje': { category: 'Codzienne wydatki', subcategory: 'Jedzenie poza domem' },
        'bar': { category: 'Codzienne wydatki', subcategory: 'Jedzenie poza domem' },
        'kawiarnia': { category: 'Codzienne wydatki', subcategory: 'Jedzenie poza domem' },
        'na mieście': { category: 'Codzienne wydatki', subcategory: 'Jedzenie poza domem' },
        'alkohol': { category: 'Codzienne wydatki', subcategory: 'Alkohol' },
        'piwo': { category: 'Codzienne wydatki', subcategory: 'Alkohol' },
        'wino': { category: 'Codzienne wydatki', subcategory: 'Alkohol' },
        'papierosy': { category: 'Codzienne wydatki', subcategory: 'Papierosy' },
        'zwierzęta': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'zwierzeta': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'pies': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'psa': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'psu': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'psem': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'piesek': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'pieska': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'kot': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'kota': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'kotek': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'pupil': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'zwierzak': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'zwierzaka': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'karma': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'weterynarz': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        
        // Płatności
        'czynsz': { category: 'Płatności', subcategory: 'Czynsz i wynajem' },
        'najem': { category: 'Płatności', subcategory: 'Czynsz i wynajem' },
        'wynajem': { category: 'Płatności', subcategory: 'Czynsz i wynajem' },
        'prąd': { category: 'Płatności', subcategory: 'Prąd' },
        'prad': { category: 'Płatności', subcategory: 'Prąd' },
        'elektryczność': { category: 'Płatności', subcategory: 'Prąd' },
        'elektrycznosc': { category: 'Płatności', subcategory: 'Prąd' },
        'gaz': { category: 'Płatności', subcategory: 'Gaz' },
        'ogrzewanie': { category: 'Płatności', subcategory: 'Ogrzewanie' },
        'woda': { category: 'Płatności', subcategory: 'Woda i kanalizacja' },
        'internet': { category: 'Płatności', subcategory: 'TV, internet, telefon' },
        'telefon': { category: 'Płatności', subcategory: 'TV, internet, telefon' },
        'telewizja': { category: 'Płatności', subcategory: 'TV, internet, telefon' },
        'tv': { category: 'Płatności', subcategory: 'TV, internet, telefon' },
        'rata': { category: 'Płatności', subcategory: 'Spłaty rat' },
        'raty': { category: 'Płatności', subcategory: 'Spłaty rat' },
        'kredyt': { category: 'Płatności', subcategory: 'Spłaty rat' },
        'podatek': { category: 'Płatności', subcategory: 'Podatki' },
        'podatki': { category: 'Płatności', subcategory: 'Podatki' },
        'pit': { category: 'Płatności', subcategory: 'Podatki' },
        'ubezpieczenie': { category: 'Płatności', subcategory: 'Ubezpieczenia' },
        'polisa': { category: 'Płatności', subcategory: 'Ubezpieczenia' },
        
        // Rozrywka
        'podróże': { category: 'Rozrywka', subcategory: 'Podróże i wyjazdy' },
        'podroze': { category: 'Rozrywka', subcategory: 'Podróże i wyjazdy' },
        'wyjazdy': { category: 'Rozrywka', subcategory: 'Podróże i wyjazdy' },
        'wakacje': { category: 'Rozrywka', subcategory: 'Podróże i wyjazdy' },
        'urlop': { category: 'Rozrywka', subcategory: 'Podróże i wyjazdy' },
        'sport': { category: 'Rozrywka', subcategory: 'Sport i hobby' },
        'siłownia': { category: 'Rozrywka', subcategory: 'Sport i hobby' },
        'silownia': { category: 'Rozrywka', subcategory: 'Sport i hobby' },
        'fitness': { category: 'Rozrywka', subcategory: 'Sport i hobby' },
        'kino': { category: 'Rozrywka', subcategory: 'Wyjścia i wydarzenia' },
        'teatr': { category: 'Rozrywka', subcategory: 'Wyjścia i wydarzenia' },
        'koncert': { category: 'Rozrywka', subcategory: 'Wyjścia i wydarzenia' },
        
        // Osobiste
        'ubrania': { category: 'Osobiste', subcategory: 'Odzież i obuwie' },
        'odzież': { category: 'Osobiste', subcategory: 'Odzież i obuwie' },
        'odziez': { category: 'Osobiste', subcategory: 'Odzież i obuwie' },
        'buty': { category: 'Osobiste', subcategory: 'Odzież i obuwie' },
        'lekarz': { category: 'Osobiste', subcategory: 'Zdrowie i uroda' },
        'apteka': { category: 'Osobiste', subcategory: 'Zdrowie i uroda' },
        'leki': { category: 'Osobiste', subcategory: 'Zdrowie i uroda' },
        'fryzjer': { category: 'Osobiste', subcategory: 'Zdrowie i uroda' },
        'prezent': { category: 'Osobiste', subcategory: 'Prezenty i wsparcie' },
        'prezenty': { category: 'Osobiste', subcategory: 'Prezenty i wsparcie' },
        'książka': { category: 'Osobiste', subcategory: 'Multimedia, książki i prasa' },
        'ksiazka': { category: 'Osobiste', subcategory: 'Multimedia, książki i prasa' },
        'książki': { category: 'Osobiste', subcategory: 'Multimedia, książki i prasa' },
        'ksiazki': { category: 'Osobiste', subcategory: 'Multimedia, książki i prasa' },
        'elektronika': { category: 'Osobiste', subcategory: 'Elektronika' },
        'komputer': { category: 'Osobiste', subcategory: 'Elektronika' },
        
        // Oszczędności
        'giełda': { category: 'Oszczędności i inw.', subcategory: 'Giełda' },
        'gielda': { category: 'Oszczędności i inw.', subcategory: 'Giełda' },
        'akcje': { category: 'Oszczędności i inw.', subcategory: 'Giełda' },
        'etf': { category: 'Oszczędności i inw.', subcategory: 'Giełda' },
        'fundusze': { category: 'Oszczędności i inw.', subcategory: 'Fundusze' },
        'lokata': { category: 'Oszczędności i inw.', subcategory: 'Lokaty i konto oszcz.' }
    },
    
    /**
     * Normalizuje tekst i mapuje na kategorię/podkategorię
     * @returns {string|{category: string, subcategory: string}|null}
     */
    normalizeCategory(input) {
        if (!input) return null;
        
        const normalized = this._normalizeText(input);
        
        // Pomiń puste lub zbyt krótkie tokeny
        if (!normalized || normalized.length < 2) return null;
        
        // 1. NAJPIERW sprawdź synonimy podkategorii (bardziej specyficzne)
        for (const [synonym, mapping] of Object.entries(this.SUBCATEGORY_SYNONYMS)) {
            const synNorm = this._normalizeText(synonym);
            
            // Dokładne dopasowanie lub zawieranie (tylko dla dłuższych synonimów)
            if (normalized === synNorm || 
                (synNorm.length >= 3 && normalized.includes(synNorm))) {
                return { category: mapping.category, subcategory: mapping.subcategory };
            }
        }
        
        // 2. Potem sprawdź synonimy kategorii
        for (const [synonym, category] of Object.entries(this.CATEGORY_SYNONYMS)) {
            const synNorm = this._normalizeText(synonym);
            
            if (normalized === synNorm || 
                (synNorm.length >= 3 && normalized.includes(synNorm))) {
                return category;
            }
        }
        
        // 3. Sprawdź bezpośrednie dopasowanie do kategorii
        const categories = BudgetCategories.getAllCategories();
        for (const cat of categories) {
            const catNorm = this._normalizeText(cat);
            
            if (normalized.includes(catNorm) || catNorm.includes(normalized)) {
                return cat;
            }
        }
        
        // 4. Sprawdź bezpośrednie dopasowanie do podkategorii
        for (const cat of categories) {
            const subs = BudgetCategories.getSubcategories(cat);
            for (const sub of subs) {
                const subNorm = this._normalizeText(sub);
                
                if (normalized.includes(subNorm) || subNorm.includes(normalized)) {
                    return { category: cat, subcategory: sub };
                }
            }
        }
        
        return null;
    },
    
    /**
     * Helper: normalizuje tekst (usuwa polskie znaki, małe litery, znaki specjalne)
     */
    _normalizeText(text) {
        if (!text || typeof text !== 'string') return '';
        
        return text.toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/ł/g, 'l')
            .replace(/ą/g, 'a')
            .replace(/ę/g, 'e')
            .replace(/ó/g, 'o')
            .replace(/ś/g, 's')
            .replace(/ć/g, 'c')
            .replace(/ź/g, 'z')
            .replace(/ż/g, 'z')
            .replace(/ń/g, 'n')
            // NOWE: Usuń znaki specjalne które mogą powodować problemy
            .replace(/[%$€£]/g, '')
            .replace(/[^\w\s-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },
    
    /**
     * Parsuje zakres czasowy z tekstu
     */
    parsePeriod(input) {
        if (!input) return null;
        
        const text = input.toLowerCase();
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        // "ostatni miesiąc" / "poprzedni miesiąc"
        if (text.includes('ostatni miesiąc') || text.includes('poprzedni miesiąc') || 
            text.includes('ostatnim miesiącu') || text.includes('poprzednim miesiącu')) {
            const m = currentMonth === 1 ? 12 : currentMonth - 1;
            const y = currentMonth === 1 ? currentYear - 1 : currentYear;
            return { from: `${y}-${String(m).padStart(2, '0')}`, to: `${y}-${String(m).padStart(2, '0')}` };
        }
        
        // "ostatnie 3 miesiące"
        const monthsMatch = text.match(/ostatni?e?\s+(\d+)\s+miesi/);
        if (monthsMatch) {
            const months = parseInt(monthsMatch[1]);
            const fromDate = new Date(currentYear, currentMonth - months - 1, 1);
            return {
                from: `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`,
                to: `${currentYear}-${String(currentMonth).padStart(2, '0')}`
            };
        }
        
        // "rok 2024" / "w 2024"
        const yearMatch = text.match(/(?:rok\s+)?(\d{4})/);
        if (yearMatch) {
            const year = parseInt(yearMatch[1]);
            if (year >= 2000 && year <= 2100) {
                return { from: `${year}-01`, to: `${year}-12` };
            }
        }
        
        // "styczeń 2024"
        const monthNames = BudgetCategories.MONTH_NAMES.map(n => n.toLowerCase());
        for (let i = 0; i < monthNames.length; i++) {
            if (text.includes(monthNames[i])) {
                const yMatch = text.match(/(\d{4})/);
                const year = yMatch ? parseInt(yMatch[1]) : currentYear;
                const month = String(i + 1).padStart(2, '0');
                return { from: `${year}-${month}`, to: `${year}-${month}` };
            }
        }
        
        // "cały czas" / "wszystko" / "od początku"
        if (text.includes('cały czas') || text.includes('wszystko') || 
            text.includes('od początku') || text.includes('całość') ||
            text.includes('calej historii') || text.includes('całej historii')) {
            return { from: null, to: null };
        }
        
        return null;
    },
    
    // ═══════════════════════════════════════════════════════════
    // WHITELISTA FUNKCJI DLA ROUTERA
    // ═══════════════════════════════════════════════════════════
    
    AVAILABLE_FUNCTIONS: {
        sumByCategory: {
            name: 'sumByCategory',
            description: 'Suma wydatków dla kategorii/podkategorii w okresie',
            params: ['category', 'subcategory?', 'periodFrom?', 'periodTo?']
        },
        sumBySubcategory: {
            name: 'sumBySubcategory',
            description: 'Suma wydatków dla podkategorii',
            params: ['category', 'subcategory', 'periodFrom?', 'periodTo?']
        },
        topExpenses: {
            name: 'topExpenses',
            description: 'Top N kategorii/podkategorii wydatków (z opcjonalnym filtrem kategorii)',
            params: ['n', 'level?', 'periodFrom?', 'periodTo?', 'filterCategory?']
        },
        monthlyBreakdown: {
            name: 'monthlyBreakdown',
            description: 'Rozbicie miesięczne dla kategorii/podkategorii',
            params: ['category?', 'subcategory?', 'periodFrom?', 'periodTo?']
        },
        compareMonths: {
            name: 'compareMonths',
            description: 'Porównanie dwóch miesięcy',
            params: ['period1', 'period2']
        },
        trendAnalysis: {
            name: 'trendAnalysis',
            description: 'Analiza trendu (income/expenses/balance)',
            params: ['metric', 'months?']
        },
        categoryShare: {
            name: 'categoryShare',
            description: 'Udział kategorii w całości wydatków',
            params: ['category', 'periodFrom?', 'periodTo?']
        },
        averageExpense: {
            name: 'averageExpense',
            description: 'Średni wydatek miesięczny',
            params: ['category?', 'subcategory?', 'months?']
        },
        analyze503020: {
            name: 'analyze503020',
            description: 'Analiza metodą 50/30/20',
            params: ['period?']
        },
        getAnomalies: {
            name: 'getAnomalies',
            description: 'Wykryte anomalie (odstępstwa od średniej)',
            params: ['threshold?']
        },
        totalBalance: {
            name: 'totalBalance',
            description: 'Całkowity bilans (dochody - wydatki)',
            params: ['periodFrom?', 'periodTo?']
        },
        incomeBySource: {
            name: 'incomeBySource',
            description: 'Dochody według źródła',
            params: ['source?', 'periodFrom?', 'periodTo?']
        },
        getSummary: {
            name: 'getSummary',
            description: 'Ogólne podsumowanie finansów',
            params: ['period?']
        }
    },
    
    /**
     * Zwraca listę funkcji dla routera LLM7
     */
    getFunctionList() {
        return Object.values(this.AVAILABLE_FUNCTIONS).map(f => ({
            name: f.name,
            description: f.description,
            params: f.params
        }));
    },
    
    // ═══════════════════════════════════════════════════════════
    // WYKONANIE OPERACJI
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Wykonuje listę operacji i zwraca wyniki
     */
    async executeOperations(operations, cache = null) {
        if (!cache) {
            cache = await BudgetAICache.getCache();
        }
        
        const results = [];
        
        for (const op of operations) {
            try {
                const result = await this._executeOperation(op, cache);
                results.push({
                    operation: op.function,
                    success: true,
                    data: result,
                    // NOWE: Metadane do weryfikacji
                    _meta: {
                        requestedCategory: op.params?.category,
                        requestedSubcategory: op.params?.subcategory,
                        resultCategory: result?.category,
                        resultSubcategory: result?.subcategory,
                        hasData: !result?.notFound && (result?.total > 0 || (result?.breakdown?.length > 0))
                    }
                });
            } catch (error) {
                console.warn('BudgetAICompute: Błąd operacji:', op.function, error);
                results.push({
                    operation: op.function,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    },
    
    async _executeOperation(op, cache) {
        const fn = op.function;
        const params = op.params || {};
        
        switch (fn) {
            case 'sumByCategory':
                return this.sumByCategory(params.category, params.subcategory, params.periodFrom, params.periodTo, cache);
            
            case 'sumBySubcategory':
                return this.sumBySubcategory(params.category, params.subcategory, params.periodFrom, params.periodTo, cache);
            
            case 'topExpenses':
                // NOWE: Przekaż filterCategory
                return this.topExpenses(
                    params.n || 10, 
                    params.level || 'category', 
                    params.periodFrom, 
                    params.periodTo, 
                    cache,
                    params.filterCategory  // NOWE
                );
            
            case 'monthlyBreakdown':
                return this.monthlyBreakdown(params.category, params.subcategory, cache, params.periodFrom, params.periodTo);
            
            case 'compareMonths':
                return this.compareMonths(params.period1, params.period2, cache);
            
            case 'trendAnalysis':
                return this.trendAnalysis(params.metric || 'expenses', params.months, cache);
            
            case 'categoryShare':
                return this.categoryShare(params.category, params.periodFrom, params.periodTo, cache);
            
            case 'averageExpense':
                return this.averageExpense(params.category, params.subcategory, params.months, cache);
            
            case 'analyze503020':
                return this.analyze503020(params.period, cache);
            
            case 'getAnomalies':
                return this.getAnomalies(params.threshold, cache);
            
            case 'totalBalance':
                return this.totalBalance(params.periodFrom, params.periodTo, cache);
            
            case 'incomeBySource':
                return this.incomeBySource(params.source, params.periodFrom, params.periodTo, cache);
            
            case 'getSummary':
                return this.getSummary(params.period, cache);
            
            default:
                throw new Error(`Nieznana funkcja: ${fn}`);
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // IMPLEMENTACJE FUNKCJI
    // ═══════════════════════════════════════════════════════════
    
    sumByCategory(category, subcategory, periodFrom, periodTo, cache) {
        let total = 0;
        let count = 0;
        const byPeriod = {};
        
        if (subcategory) {
            // Suma dla podkategorii
            let key = `${category}|${subcategory}`;
            let subData = cache.subcategorySums[key];
            
            // Jeśli nie znaleziono i brak kategorii, szukaj podkategorii we wszystkich kategoriach
            if (!subData && !category) {
                for (const [fullKey, data] of Object.entries(cache.subcategorySums)) {
                    if (fullKey.endsWith(`|${subcategory}`)) {
                        key = fullKey;
                        subData = data;
                        category = fullKey.split('|')[0];
                        break;
                    }
                }
            }
            
            // Jeśli nadal nie znaleziono, spróbuj szukać po częściowym dopasowaniu
            if (!subData) {
                const normalizedSub = this._normalizeText(subcategory);
                for (const [fullKey, data] of Object.entries(cache.subcategorySums)) {
                    const [cat, sub] = fullKey.split('|');
                    const normalizedStoredSub = this._normalizeText(sub);
                    if (normalizedStoredSub.includes(normalizedSub) || normalizedSub.includes(normalizedStoredSub)) {
                        key = fullKey;
                        subData = data;
                        category = cat;
                        subcategory = sub;
                        break;
                    }
                }
            }
            
            if (!subData) {
                return { 
                    total: 0, 
                    count: 0, 
                    category, 
                    subcategory, 
                    notFound: true,
                    message: `Brak danych dla podkategorii "${subcategory}"`
                };
            }
            
            if (!periodFrom && !periodTo) {
                return {
                    total: subData.total,
                    count: subData.count,
                    category,
                    subcategory,
                    byPeriod: subData.byPeriod
                };
            }
            
            // Filtruj po okresie - używamy Object.entries dla stabilnej iteracji
            for (const [period, value] of Object.entries(subData.byPeriod)) {
                if (this._periodInRange(period, periodFrom, periodTo)) {
                    total += value;
                    count++;
                    byPeriod[period] = value;
                }
            }
            
        } else if (category) {
            // Suma dla kategorii
            const catData = cache.categorySums[category];
            
            if (!catData) {
                return { 
                    total: 0, 
                    count: 0, 
                    category, 
                    notFound: true,
                    message: `Brak danych dla kategorii "${category}"`
                };
            }
            
            if (!periodFrom && !periodTo) {
                return {
                    total: catData.total,
                    count: catData.count,
                    category,
                    byPeriod: catData.byPeriod
                };
            }
            
            for (const [period, value] of Object.entries(catData.byPeriod)) {
                if (this._periodInRange(period, periodFrom, periodTo)) {
                    total += value;
                    count++;
                    byPeriod[period] = value;
                }
            }
            
        } else {
            // Suma wszystkich wydatków
            for (const [period, monthData] of Object.entries(cache.monthlyTotals)) {
                if (this._periodInRange(period, periodFrom, periodTo)) {
                    total += monthData.expenses;
                    count++;
                    byPeriod[period] = monthData.expenses;
                }
            }
        }
        
        return { total, count, category, subcategory, periodFrom, periodTo, byPeriod };
    },
    
    sumBySubcategory(category, subcategory, periodFrom, periodTo, cache) {
        return this.sumByCategory(category, subcategory, periodFrom, periodTo, cache);
    },
    
    /**
     * Top N wydatków z opcjonalnym filtrem kategorii
     * @param {number} n - Liczba wyników
     * @param {string} level - 'category' lub 'subcategory'
     * @param {string} periodFrom - Okres od
     * @param {string} periodTo - Okres do
     * @param {object} cache - Cache danych
     * @param {string} filterCategory - NOWE: Opcjonalny filtr kategorii
     */
    topExpenses(n = 10, level = 'category', periodFrom, periodTo, cache, filterCategory = null) {
        const results = [];
        
        if (level === 'subcategory') {
            for (const [key, data] of Object.entries(cache.subcategorySums)) {
                // NOWE: Filtruj po kategorii jeśli podano
                if (filterCategory && data.kategoria !== filterCategory) {
                    continue;
                }
                
                let total = data.total;
                
                if (periodFrom || periodTo) {
                    total = 0;
                    for (const [period, value] of Object.entries(data.byPeriod)) {
                        if (this._periodInRange(period, periodFrom, periodTo)) {
                            total += value;
                        }
                    }
                }
                
                if (total > 0) {
                    results.push({
                        category: data.kategoria,
                        subcategory: data.podkategoria,
                        total
                    });
                }
            }
        } else {
            for (const [category, data] of Object.entries(cache.categorySums)) {
                // Pomiń oszczędności (transfery)
                if (category === 'Oszczędności i inw.') continue;
                
                // NOWE: Filtruj po kategorii jeśli podano
                if (filterCategory && category !== filterCategory) {
                    continue;
                }
                
                let total = data.total;
                
                if (periodFrom || periodTo) {
                    total = 0;
                    for (const [period, value] of Object.entries(data.byPeriod)) {
                        if (this._periodInRange(period, periodFrom, periodTo)) {
                            total += value;
                        }
                    }
                }
                
                if (total > 0) {
                    results.push({ category, total });
                }
            }
        }
        
        // Sortuj i ogranicz
        const sorted = results.sort((a, b) => b.total - a.total).slice(0, n);
        
        // NOWE: Dodaj metadane
        return {
            items: sorted,
            count: sorted.length,
            level,
            filterCategory,
            periodFrom,
            periodTo,
            _meta: {
                totalItemsBeforeFilter: results.length,
                filterApplied: !!filterCategory
            }
        };
    },
    
    /**
     * Rozbicie miesięczne - ULEPSZONE z notFound i metadanymi
     */
    monthlyBreakdown(category, subcategory, cache, periodFrom = null, periodTo = null) {
        const breakdown = [];
        
        if (subcategory) {
            // Szukaj klucza podkategorii
            let key = `${category}|${subcategory}`;
            let subData = cache.subcategorySums[key];
            
            // Jeśli nie znaleziono bezpośrednio, szukaj
            if (!subData) {
                for (const [fullKey, data] of Object.entries(cache.subcategorySums)) {
                    const [cat, sub] = fullKey.split('|');
                    if (sub === subcategory || 
                        this._normalizeText(sub) === this._normalizeText(subcategory)) {
                        key = fullKey;
                        subData = data;
                        category = cat;
                        break;
                    }
                }
            }
            
            if (!subData || !subData.byPeriod) {
                return {
                    category,
                    subcategory,
                    breakdown: [],
                    notFound: true,
                    message: `Brak danych dla podkategorii "${subcategory}"`,
                    _meta: {
                        requestedCategory: category,
                        requestedSubcategory: subcategory,
                        hasData: false
                    }
                };
            }
            
            // Sortuj okresy i buduj breakdown
            const sortedPeriods = Object.entries(subData.byPeriod)
                .sort((a, b) => a[0].localeCompare(b[0]));
            
            for (const [period, value] of sortedPeriods) {
                if (this._periodInRange(period, periodFrom, periodTo)) {
                    breakdown.push({ period, value, amount: value }); // Oba pola dla kompatybilności
                }
            }
            
        } else if (category) {
            const catData = cache.categorySums[category];
            
            if (!catData || !catData.byPeriod) {
                return {
                    category,
                    subcategory: null,
                    breakdown: [],
                    notFound: true,
                    message: `Brak danych dla kategorii "${category}"`,
                    _meta: {
                        requestedCategory: category,
                        requestedSubcategory: null,
                        hasData: false
                    }
                };
            }
            
            const sortedPeriods = Object.entries(catData.byPeriod)
                .sort((a, b) => a[0].localeCompare(b[0]));
            
            for (const [period, value] of sortedPeriods) {
                if (this._periodInRange(period, periodFrom, periodTo)) {
                    breakdown.push({ period, value, amount: value });
                }
            }
            
        } else {
            // Wszystkie wydatki miesięcznie
            const sortedPeriods = Object.entries(cache.monthlyTotals)
                .sort((a, b) => a[0].localeCompare(b[0]));
            
            for (const [period, data] of sortedPeriods) {
                if (this._periodInRange(period, periodFrom, periodTo)) {
                    breakdown.push({
                        period,
                        income: data.income,
                        expenses: data.expenses,
                        balance: data.balance,
                        value: data.expenses,  // Alias
                        amount: data.expenses  // Alias
                    });
                }
            }
        }
        
        // NOWE: Oblicz statystyki pomocnicze
        const values = breakdown.map(b => b.value ?? b.amount ?? b.expenses ?? 0);
        const sum = values.reduce((a, b) => a + b, 0);
        const max = values.length > 0 ? Math.max(...values) : 0;
        const min = values.length > 0 ? Math.min(...values) : 0;
        const avg = values.length > 0 ? sum / values.length : 0;
        
        const maxEntry = breakdown.find(b => (b.value ?? b.amount ?? b.expenses ?? 0) === max);
        const minEntry = breakdown.find(b => (b.value ?? b.amount ?? b.expenses ?? 0) === min);
        
        return { 
            category, 
            subcategory, 
            breakdown,
            // NOWE: Statystyki
            stats: {
                total: sum,
                average: avg,
                max: { period: maxEntry?.period, value: max },
                min: { period: minEntry?.period, value: min },
                count: breakdown.length
            },
            _meta: {
                requestedCategory: category,
                requestedSubcategory: subcategory,
                hasData: breakdown.length > 0,
                periodFrom,
                periodTo
            }
        };
    },
    
    compareMonths(period1, period2, cache) {
        const data1 = cache.monthlyTotals[period1];
        const data2 = cache.monthlyTotals[period2];
        
        if (!data1 || !data2) {
            return {
                error: 'Brak danych dla jednego lub obu okresów',
                period1: period1,
                period2: period2,
                data1Exists: !!data1,
                data2Exists: !!data2,
                notFound: true
            };
        }
        
        return {
            period1: { ...data1, period: period1 },
            period2: { ...data2, period: period2 },
            diff: {
                income: data2.income - data1.income,
                expenses: data2.expenses - data1.expenses,
                balance: data2.balance - data1.balance,
                incomePercent: data1.income ? ((data2.income - data1.income) / data1.income * 100) : 0,
                expensesPercent: data1.expenses ? ((data2.expenses - data1.expenses) / data1.expenses * 100) : 0
            }
        };
    },
    
    trendAnalysis(metric = 'expenses', months, cache) {
        // Użyj danych z cache
        const trends = cache.trends;
        
        if (trends && trends[metric]) {
            return {
                metric,
                ...trends[metric],
                description: this._describeTrend(trends[metric])
            };
        }
        
        // Fallback: oblicz na żywo
        const monthlyData = Object.entries(cache.monthlyTotals)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-(months || 12))
            .map(([period, data]) => ({
                period,
                value: metric === 'income' ? data.income : 
                       metric === 'balance' ? data.balance : data.expenses
            }));
        
        if (monthlyData.length < 2) {
            return { metric, error: 'Za mało danych do analizy trendu', notFound: true };
        }
        
        const first = monthlyData[0].value;
        const last = monthlyData[monthlyData.length - 1].value;
        const change = last - first;
        const changePercent = first ? (change / first * 100) : 0;
        
        return {
            metric,
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
            percentChange: changePercent,
            firstValue: first,
            lastValue: last,
            dataPoints: monthlyData.length
        };
    },
    
    _describeTrend(trend) {
        if (!trend) return '';
        
        const dir = trend.direction;
        const pct = Math.abs(trend.percentChange || 0).toFixed(1);
        
        if (dir === 'up') return `Trend rosnący (${pct}% wzrost)`;
        if (dir === 'down') return `Trend malejący (${pct}% spadek)`;
        return 'Trend stabilny';
    },
    
    categoryShare(category, periodFrom, periodTo, cache) {
        const catSum = this.sumByCategory(category, null, periodFrom, periodTo, cache);
        const totalSum = this.sumByCategory(null, null, periodFrom, periodTo, cache);
        
        const share = totalSum.total > 0 ? (catSum.total / totalSum.total * 100) : 0;
        
        return {
            category,
            categoryTotal: catSum.total,
            allExpensesTotal: totalSum.total,
            sharePercent: share,
            periodFrom,
            periodTo
        };
    },
    
    averageExpense(category, subcategory, months, cache) {
        const result = this.sumByCategory(category, subcategory, null, null, cache);
        
        const periodCount = Object.keys(result.byPeriod || {}).length || 1;
        const average = result.total / periodCount;
        
        return {
            category,
            subcategory,
            total: result.total,
            monthsWithData: periodCount,
            averageMonthly: average
        };
    },
    
    analyze503020(period, cache) {
        // Użyj danych z cache lub przelicz
        if (!period && cache.methodology503020 && Object.keys(cache.methodology503020).length > 0) {
            return cache.methodology503020;
        }
        
        // Pobierz dane dla okresu
        const periodKey = period || Object.keys(cache.monthlyTotals).sort().pop();
        const monthData = cache.monthlyTotals[periodKey];
        
        if (!monthData) {
            return { error: 'Brak danych dla okresu', period: periodKey, notFound: true };
        }
        
        const income = monthData.income;
        
        // Uproszczona analiza
        const needs = monthData.fixed * 0.7 + monthData.variable * 0.4;
        const wants = monthData.variable * 0.6 + monthData.fixed * 0.1;
        const savings = monthData.balance;
        
        return {
            period: periodKey,
            income,
            needs: {
                actual: needs,
                limit: income * 0.5,
                percent: income > 0 ? (needs / income * 100) : 0,
                status: needs <= income * 0.5 ? 'ok' : 'over'
            },
            wants: {
                actual: wants,
                limit: income * 0.3,
                percent: income > 0 ? (wants / income * 100) : 0,
                status: wants <= income * 0.3 ? 'ok' : 'over'
            },
            savings: {
                actual: savings,
                limit: income * 0.2,
                percent: income > 0 ? (savings / income * 100) : 0,
                status: savings >= income * 0.2 ? 'ok' : 'under'
            }
        };
    },
    
    getAnomalies(threshold = 15, cache) {
        if (cache.anomalies && cache.anomalies.length > 0) {
            return cache.anomalies.filter(a => a.percent >= threshold);
        }
        
        return [];
    },
    
    totalBalance(periodFrom, periodTo, cache) {
        let totalIncome = 0;
        let totalExpenses = 0;
        let months = 0;
        
        for (const [period, data] of Object.entries(cache.monthlyTotals)) {
            if (this._periodInRange(period, periodFrom, periodTo)) {
                totalIncome += data.income;
                totalExpenses += data.expenses;
                months++;
            }
        }
        
        return {
            totalIncome,
            totalExpenses,
            balance: totalIncome - totalExpenses,
            savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0,
            monthsAnalyzed: months,
            periodFrom,
            periodTo
        };
    },
    
    incomeBySource(source, periodFrom, periodTo, cache) {
        if (source) {
            const sourceData = cache.incomeSources[source];
            
            if (!sourceData) {
                return { source, total: 0, notFound: true, message: `Brak danych dla źródła "${source}"` };
            }
            
            return {
                source,
                total: sourceData.total,
                count: sourceData.count,
                byPracodawca: sourceData.byPracodawca
            };
        }
        
        // Wszystkie źródła
        return Object.entries(cache.incomeSources).map(([source, data]) => ({
            source,
            total: data.total,
            count: data.count
        })).sort((a, b) => b.total - a.total);
    },
    
    getSummary(period, cache) {
        const periods = cache.availablePeriods || [];
        const lastPeriod = period || (periods.length > 0 ? `${periods[0].rok}-${String(periods[0].miesiac).padStart(2, '0')}` : null);
        
        const lastMonthData = lastPeriod ? cache.monthlyTotals[lastPeriod] : null;
        
        const totalBalance = this.totalBalance(null, null, cache);
        const topCatsResult = this.topExpenses(5, 'category', null, null, cache);
        
        return {
            lastPeriod,
            lastMonth: lastMonthData,
            allTime: totalBalance,
            topCategories: topCatsResult.items || topCatsResult,
            trends: cache.trends,
            monthsWithData: Object.keys(cache.monthlyTotals).length
        };
    },
    
    // ═══════════════════════════════════════════════════════════
    // HELPERY
    // ═══════════════════════════════════════════════════════════
    
    _periodInRange(period, from, to) {
        if (!from && !to) return true;
        if (from && period < from) return false;
        if (to && period > to) return false;
        return true;
    }
};
