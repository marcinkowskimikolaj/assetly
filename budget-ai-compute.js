/**
 * Assetly - Budget AI Compute
 * Deterministyczne funkcje obliczeniowe dla AI
 */

const BudgetAICompute = {
    
    // ═══════════════════════════════════════════════════════════
    // SŁOWNIK SYNONIMÓW I NORMALIZACJA
    // ═══════════════════════════════════════════════════════════
    
    // Synonimy kategorii (mapowanie na nazwę kategorii)
    CATEGORY_SYNONYMS: {
        'auto': 'Auto i transport',
        'samochód': 'Auto i transport',
        'transport': 'Auto i transport',
        'jazda': 'Auto i transport',
        'jedzenie': 'Codzienne wydatki',
        'żywność': 'Codzienne wydatki',
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
        'inwestycje': 'Oszczędności i inw.',
        'lokaty': 'Oszczędności i inw.',
        'płatności': 'Płatności',
        'rachunki': 'Płatności',
        'opłaty': 'Płatności',
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
        'pies': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        'kot': { category: 'Codzienne wydatki', subcategory: 'Zwierzęta' },
        
        // Płatności
        'czynsz': { category: 'Płatności', subcategory: 'Czynsz i wynajem' },
        'najem': { category: 'Płatności', subcategory: 'Czynsz i wynajem' },
        'wynajem': { category: 'Płatności', subcategory: 'Czynsz i wynajem' },
        'prąd': { category: 'Płatności', subcategory: 'Prąd' },
        'elektryczność': { category: 'Płatności', subcategory: 'Prąd' },
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
        
        // Rozrywka
        'podróże': { category: 'Rozrywka', subcategory: 'Podróże i wyjazdy' },
        'wyjazdy': { category: 'Rozrywka', subcategory: 'Podróże i wyjazdy' },
        'wakacje': { category: 'Rozrywka', subcategory: 'Podróże i wyjazdy' },
        'urlop': { category: 'Rozrywka', subcategory: 'Podróże i wyjazdy' },
        'sport': { category: 'Rozrywka', subcategory: 'Sport i hobby' },
        'siłownia': { category: 'Rozrywka', subcategory: 'Sport i hobby' },
        'fitness': { category: 'Rozrywka', subcategory: 'Sport i hobby' },
        'kino': { category: 'Rozrywka', subcategory: 'Wyjścia i wydarzenia' },
        'teatr': { category: 'Rozrywka', subcategory: 'Wyjścia i wydarzenia' },
        'koncert': { category: 'Rozrywka', subcategory: 'Wyjścia i wydarzenia' },
        
        // Osobiste
        'ubrania': { category: 'Osobiste', subcategory: 'Odzież i obuwie' },
        'odzież': { category: 'Osobiste', subcategory: 'Odzież i obuwie' },
        'buty': { category: 'Osobiste', subcategory: 'Odzież i obuwie' },
        'lekarz': { category: 'Osobiste', subcategory: 'Zdrowie i uroda' },
        'apteka': { category: 'Osobiste', subcategory: 'Zdrowie i uroda' },
        'leki': { category: 'Osobiste', subcategory: 'Zdrowie i uroda' },
        'fryzjer': { category: 'Osobiste', subcategory: 'Zdrowie i uroda' },
        'prezent': { category: 'Osobiste', subcategory: 'Prezenty i wsparcie' },
        'prezenty': { category: 'Osobiste', subcategory: 'Prezenty i wsparcie' },
        'książka': { category: 'Osobiste', subcategory: 'Multimedia, książki i prasa' },
        'książki': { category: 'Osobiste', subcategory: 'Multimedia, książki i prasa' },
        'elektronika': { category: 'Osobiste', subcategory: 'Elektronika' },
        'komputer': { category: 'Osobiste', subcategory: 'Elektronika' },
        
        // Oszczędności
        'giełda': { category: 'Oszczędności i inw.', subcategory: 'Giełda' },
        'akcje': { category: 'Oszczędności i inw.', subcategory: 'Giełda' },
        'etf': { category: 'Oszczędności i inw.', subcategory: 'Giełda' },
        'fundusze': { category: 'Oszczędności i inw.', subcategory: 'Fundusze' },
        'lokata': { category: 'Oszczędności i inw.', subcategory: 'Lokaty i konto oszcz.' }
    },
    
    // Stary SYNONYMS dla kompatybilności wstecznej (nie używać)
    SYNONYMS: {},
    
    /**
     * Normalizuje tekst i mapuje na kategorię/podkategorię
     * @returns {string|{category: string, subcategory: string}|null}
     */
    normalizeCategory(input) {
        if (!input) return null;
        
        const normalized = this._normalizeText(input);
        
        // 1. NAJPIERW sprawdź synonimy podkategorii (bardziej specyficzne)
        for (const [synonym, mapping] of Object.entries(this.SUBCATEGORY_SYNONYMS)) {
            const synNorm = this._normalizeText(synonym);
            
            if (normalized === synNorm || normalized.includes(synNorm)) {
                return { category: mapping.category, subcategory: mapping.subcategory };
            }
        }
        
        // 2. Potem sprawdź synonimy kategorii
        for (const [synonym, category] of Object.entries(this.CATEGORY_SYNONYMS)) {
            const synNorm = this._normalizeText(synonym);
            
            if (normalized === synNorm || normalized.includes(synNorm)) {
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
     * Helper: normalizuje tekst (usuwa polskie znaki, małe litery)
     */
    _normalizeText(text) {
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
            .replace(/ń/g, 'n');
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
        if (text.includes('ostatni miesiąc') || text.includes('poprzedni miesiąc')) {
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
            return { from: `${year}-01`, to: `${year}-12` };
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
        if (text.includes('cały czas') || text.includes('wszystko') || text.includes('od początku') || text.includes('całość')) {
            return { from: null, to: null }; // null = brak filtra
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
            description: 'Top N kategorii/podkategorii wydatków',
            params: ['n', 'level?', 'periodFrom?', 'periodTo?']
        },
        monthlyBreakdown: {
            name: 'monthlyBreakdown',
            description: 'Rozbicie miesięczne dla kategorii',
            params: ['category?', 'subcategory?']
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
                    data: result
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
                return this.topExpenses(params.n || 10, params.level || 'category', params.periodFrom, params.periodTo, cache);
            
            case 'monthlyBreakdown':
                return this.monthlyBreakdown(params.category, params.subcategory, cache);
            
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
            const key = `${category}|${subcategory}`;
            const subData = cache.subcategorySums[key];
            
            if (!subData) {
                return { total: 0, count: 0, category, subcategory, notFound: true };
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
            
            // Filtruj po okresie
            Object.entries(subData.byPeriod).forEach(([period, value]) => {
                if (this._periodInRange(period, periodFrom, periodTo)) {
                    total += value;
                    count++;
                    byPeriod[period] = value;
                }
            });
            
        } else if (category) {
            // Suma dla kategorii
            const catData = cache.categorySums[category];
            
            if (!catData) {
                return { total: 0, count: 0, category, notFound: true };
            }
            
            if (!periodFrom && !periodTo) {
                return {
                    total: catData.total,
                    count: catData.count,
                    category,
                    byPeriod: catData.byPeriod
                };
            }
            
            Object.entries(catData.byPeriod).forEach(([period, value]) => {
                if (this._periodInRange(period, periodFrom, periodTo)) {
                    total += value;
                    count++;
                    byPeriod[period] = value;
                }
            });
            
        } else {
            // Suma wszystkich wydatków
            Object.values(cache.monthlyTotals).forEach((monthData, i) => {
                const periods = Object.keys(cache.monthlyTotals);
                const period = periods[i];
                
                if (this._periodInRange(period, periodFrom, periodTo)) {
                    total += monthData.expenses;
                    count++;
                    byPeriod[period] = monthData.expenses;
                }
            });
        }
        
        return { total, count, category, subcategory, periodFrom, periodTo, byPeriod };
    },
    
    sumBySubcategory(category, subcategory, periodFrom, periodTo, cache) {
        return this.sumByCategory(category, subcategory, periodFrom, periodTo, cache);
    },
    
    topExpenses(n = 10, level = 'category', periodFrom, periodTo, cache) {
        const results = [];
        
        if (level === 'subcategory') {
            Object.entries(cache.subcategorySums).forEach(([key, data]) => {
                let total = data.total;
                
                if (periodFrom || periodTo) {
                    total = 0;
                    Object.entries(data.byPeriod).forEach(([period, value]) => {
                        if (this._periodInRange(period, periodFrom, periodTo)) {
                            total += value;
                        }
                    });
                }
                
                results.push({
                    category: data.kategoria,
                    subcategory: data.podkategoria,
                    total
                });
            });
        } else {
            Object.entries(cache.categorySums).forEach(([category, data]) => {
                // Pomiń oszczędności
                if (category === 'Oszczędności i inw.') return;
                
                let total = data.total;
                
                if (periodFrom || periodTo) {
                    total = 0;
                    Object.entries(data.byPeriod).forEach(([period, value]) => {
                        if (this._periodInRange(period, periodFrom, periodTo)) {
                            total += value;
                        }
                    });
                }
                
                results.push({ category, total });
            });
        }
        
        return results
            .sort((a, b) => b.total - a.total)
            .slice(0, n);
    },
    
    monthlyBreakdown(category, subcategory, cache) {
        const breakdown = [];
        
        if (subcategory) {
            const key = `${category}|${subcategory}`;
            const subData = cache.subcategorySums[key];
            
            if (subData?.byPeriod) {
                Object.entries(subData.byPeriod)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .forEach(([period, value]) => {
                        breakdown.push({ period, value });
                    });
            }
        } else if (category) {
            const catData = cache.categorySums[category];
            
            if (catData?.byPeriod) {
                Object.entries(catData.byPeriod)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .forEach(([period, value]) => {
                        breakdown.push({ period, value });
                    });
            }
        } else {
            Object.entries(cache.monthlyTotals)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .forEach(([period, data]) => {
                    breakdown.push({
                        period,
                        income: data.income,
                        expenses: data.expenses,
                        balance: data.balance
                    });
                });
        }
        
        return { category, subcategory, breakdown };
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
                data2Exists: !!data2
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
            return { metric, error: 'Za mało danych do analizy trendu' };
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
            return { error: 'Brak danych dla okresu', period: periodKey };
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
        
        Object.entries(cache.monthlyTotals).forEach(([period, data]) => {
            if (this._periodInRange(period, periodFrom, periodTo)) {
                totalIncome += data.income;
                totalExpenses += data.expenses;
                months++;
            }
        });
        
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
                return { source, total: 0, notFound: true };
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
        const topCats = this.topExpenses(5, 'category', null, null, cache);
        
        return {
            lastPeriod,
            lastMonth: lastMonthData,
            allTime: totalBalance,
            topCategories: topCats,
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
