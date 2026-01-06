/**
 * Assetly - Budget AI Cache
 * System cache'owania agregacji dla AI
 */

const BudgetAICache = {
    
    // ═══════════════════════════════════════════════════════════
    // KONFIGURACJA
    // ═══════════════════════════════════════════════════════════
    
    CACHE_SHEET: 'Budzet_AI_Cache',
    
    // Typy cache'owanych danych
    CACHE_TYPES: {
        MONTHLY_TOTALS: 'monthly_totals',
        CATEGORY_SUMS: 'category_sums',
        SUBCATEGORY_SUMS: 'subcategory_sums',
        TRENDS: 'trends',
        ANOMALIES: 'anomalies',
        METHODOLOGY_503020: 'methodology_503020',
        TOP_EXPENSES: 'top_expenses',
        INCOME_SOURCES: 'income_sources',
        DATA_HASH: 'data_hash',
        AVAILABLE_PERIODS: 'available_periods',
        CATEGORY_LIST: 'category_list'
    },
    
    // Lokalny cache w pamięci
    _memoryCache: null,
    _lastUpdate: null,
    _dataHash: null,
    
    // ═══════════════════════════════════════════════════════════
    // INICJALIZACJA
    // ═══════════════════════════════════════════════════════════
    
    async ensureCacheSheetExists() {
        try {
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID
            });
            
            const existingSheets = response.result.sheets.map(s => s.properties.title);
            
            if (!existingSheets.includes(this.CACHE_SHEET)) {
                await gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    resource: {
                        requests: [{
                            addSheet: { properties: { title: this.CACHE_SHEET } }
                        }]
                    }
                });
                
                // Dodaj nagłówki
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: `${this.CACHE_SHEET}!A1:E1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: [['Typ', 'Klucz', 'Wartosc_JSON', 'Timestamp', 'Hash']]
                    }
                });
            }
            
            return true;
        } catch (error) {
            console.warn('BudgetAICache: Błąd inicjalizacji arkusza cache:', error);
            return false;
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // GŁÓWNA LOGIKA AKTUALIZACJI
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Sprawdza czy cache wymaga aktualizacji i aktualizuje jeśli potrzeba
     */
    async updateIfNeeded() {
        try {
            await this.ensureCacheSheetExists();
            
            // Oblicz hash aktualnych danych
            const currentHash = await this._calculateDataHash();
            
            // Pobierz zapisany hash
            const savedHash = await this._getSavedHash();
            
            // Jeśli hashe się zgadzają, cache jest aktualny
            if (savedHash && savedHash === currentHash) {
                console.log('BudgetAICache: Cache aktualny, pomijam przeliczanie');
                return { updated: false, fromCache: true };
            }
            
            console.log('BudgetAICache: Dane zmienione, przeliczam agregacje...');
            
            // Przelicz wszystkie agregacje
            const aggregations = await this._calculateAllAggregations();
            
            // Zapisz do arkusza
            await this._saveToSheet(aggregations, currentHash);
            
            // Aktualizuj lokalny cache
            this._memoryCache = aggregations;
            this._dataHash = currentHash;
            this._lastUpdate = new Date().toISOString();
            
            console.log('BudgetAICache: Aktualizacja zakończona');
            
            return { updated: true, fromCache: false };
            
        } catch (error) {
            console.error('BudgetAICache: Błąd aktualizacji:', error);
            
            // Przy błędzie spróbuj załadować z pamięci lub przeliczyć minimalnie
            if (!this._memoryCache) {
                this._memoryCache = await this._calculateAllAggregations();
            }
            
            return { updated: false, error: error.message };
        }
    },
    
    /**
     * Pobiera dane z cache (z pamięci lub arkusza)
     */
    async getCache() {
        // Najpierw sprawdź pamięć
        if (this._memoryCache) {
            return this._memoryCache;
        }
        
        // Spróbuj załadować z arkusza
        try {
            const sheetCache = await this._loadFromSheet();
            if (sheetCache) {
                this._memoryCache = sheetCache;
                return sheetCache;
            }
        } catch (error) {
            console.warn('BudgetAICache: Błąd ładowania z arkusza:', error);
        }
        
        // Fallback: przelicz na żywo
        const aggregations = await this._calculateAllAggregations();
        this._memoryCache = aggregations;
        return aggregations;
    },
    
    // ═══════════════════════════════════════════════════════════
    // OBLICZANIE AGREGACJI
    // ═══════════════════════════════════════════════════════════
    
    async _calculateAllAggregations() {
        const aggregations = {
            timestamp: new Date().toISOString(),
            availablePeriods: [],
            monthlyTotals: {},
            categorySums: {},
            subcategorySums: {},
            categoryList: [],
            subcategoryList: {},
            incomeSources: {},
            trends: {},
            anomalies: [],
            methodology503020: {},
            topExpenses: []
        };
        
        try {
            // 1. Dostępne okresy
            const availableMonths = getAvailableMonthsFromData();
            aggregations.availablePeriods = availableMonths.map(m => ({
                rok: m.rok,
                miesiac: m.miesiac,
                label: BudgetCategories.formatPeriod(m.rok, m.miesiac)
            }));
            
            // 2. Lista kategorii i podkategorii
            aggregations.categoryList = BudgetCategories.getAllCategories();
            
            BudgetCategories.getAllCategories().forEach(cat => {
                aggregations.subcategoryList[cat] = BudgetCategories.getSubcategories(cat);
            });
            
            // 3. Sumy miesięczne
            for (const period of availableMonths.slice(0, 24)) { // max 24 miesiące
                const monthData = getMonthlyData(period.rok, period.miesiac);
                const key = `${period.rok}-${String(period.miesiac).padStart(2, '0')}`;
                
                aggregations.monthlyTotals[key] = {
                    income: monthData.income.total,
                    expenses: monthData.expenses.total,
                    fixed: monthData.expenses.fixed,
                    variable: monthData.expenses.variable,
                    transfers: monthData.expenses.transfers,
                    balance: monthData.balance,
                    savingsRate: monthData.savingsRate
                };
            }
            
            // 4. Sumy per kategoria (całość historii)
            const categoryTotals = {};
            const subcategoryTotals = {};
            
            allExpenses.forEach(e => {
                // Kategoria
                if (!categoryTotals[e.kategoria]) {
                    categoryTotals[e.kategoria] = {
                        total: 0,
                        count: 0,
                        byPeriod: {}
                    };
                }
                categoryTotals[e.kategoria].total += e.kwotaPLN;
                categoryTotals[e.kategoria].count++;
                
                const periodKey = `${e.rok}-${String(e.miesiac).padStart(2, '0')}`;
                if (!categoryTotals[e.kategoria].byPeriod[periodKey]) {
                    categoryTotals[e.kategoria].byPeriod[periodKey] = 0;
                }
                categoryTotals[e.kategoria].byPeriod[periodKey] += e.kwotaPLN;
                
                // Podkategoria
                if (e.podkategoria) {
                    const subKey = `${e.kategoria}|${e.podkategoria}`;
                    if (!subcategoryTotals[subKey]) {
                        subcategoryTotals[subKey] = {
                            kategoria: e.kategoria,
                            podkategoria: e.podkategoria,
                            total: 0,
                            count: 0,
                            byPeriod: {}
                        };
                    }
                    subcategoryTotals[subKey].total += e.kwotaPLN;
                    subcategoryTotals[subKey].count++;
                    
                    if (!subcategoryTotals[subKey].byPeriod[periodKey]) {
                        subcategoryTotals[subKey].byPeriod[periodKey] = 0;
                    }
                    subcategoryTotals[subKey].byPeriod[periodKey] += e.kwotaPLN;
                }
            });
            
            aggregations.categorySums = categoryTotals;
            aggregations.subcategorySums = subcategoryTotals;
            
            // 5. Źródła dochodów
            const incomeTotals = {};
            allIncome.forEach(i => {
                if (!incomeTotals[i.zrodlo]) {
                    incomeTotals[i.zrodlo] = {
                        total: 0,
                        count: 0,
                        byPracodawca: {}
                    };
                }
                incomeTotals[i.zrodlo].total += i.kwotaPLN;
                incomeTotals[i.zrodlo].count++;
                
                if (i.pracodawca) {
                    if (!incomeTotals[i.zrodlo].byPracodawca[i.pracodawca]) {
                        incomeTotals[i.zrodlo].byPracodawca[i.pracodawca] = 0;
                    }
                    incomeTotals[i.zrodlo].byPracodawca[i.pracodawca] += i.kwotaPLN;
                }
            });
            aggregations.incomeSources = incomeTotals;
            
            // 6. Trendy (ostatnie 12 miesięcy)
            const last12Months = getLast12MonthsData();
            if (last12Months.length >= 2) {
                aggregations.trends = {
                    income: BudgetMetrics.calculateTrend(last12Months, 'income'),
                    expenses: BudgetMetrics.calculateTrend(last12Months, 'expenses'),
                    balance: BudgetMetrics.calculateTrend(last12Months, 'balance')
                };
            }
            
            // 7. Anomalie (ostatni miesiąc vs średnia)
            if (availableMonths.length > 0) {
                const lastMonth = getMonthlyData(availableMonths[0].rok, availableMonths[0].miesiac);
                const categoryAverages = BudgetMetrics.aggregateByCategory(last12Months);
                aggregations.anomalies = BudgetMetrics.findAnomalies(lastMonth, categoryAverages);
            }
            
            // 8. Analiza 50/30/20 (ostatni miesiąc)
            if (availableMonths.length > 0) {
                const lastMonth = getMonthlyData(availableMonths[0].rok, availableMonths[0].miesiac);
                aggregations.methodology503020 = BudgetMetrics.analyze503020(lastMonth);
            }
            
            // 9. Top 10 wydatków (po kategorii, całość)
            aggregations.topExpenses = Object.entries(categoryTotals)
                .filter(([cat]) => cat !== 'Oszczędności i inw.')
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 10)
                .map(([cat, data]) => ({
                    kategoria: cat,
                    total: data.total,
                    count: data.count,
                    average: data.count > 0 ? data.total / data.count : 0
                }));
            
        } catch (error) {
            console.error('BudgetAICache: Błąd obliczania agregacji:', error);
        }
        
        return aggregations;
    },
    
    // ═══════════════════════════════════════════════════════════
    // HASH DANYCH
    // ═══════════════════════════════════════════════════════════
    
    async _calculateDataHash() {
        // Prosty hash oparty na liczbie rekordów i sumach
        const expenseSum = allExpenses.reduce((s, e) => s + e.kwotaPLN, 0);
        const incomeSum = allIncome.reduce((s, i) => s + i.kwotaPLN, 0);
        const recurringCount = allRecurring.length;
        
        const hashString = `e${allExpenses.length}_${expenseSum.toFixed(2)}_i${allIncome.length}_${incomeSum.toFixed(2)}_r${recurringCount}`;
        
        // Prosty hash
        let hash = 0;
        for (let i = 0; i < hashString.length; i++) {
            const char = hashString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return Math.abs(hash).toString(16);
    },
    
    async _getSavedHash() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.CACHE_SHEET}!A2:E`
            });
            
            const rows = response.result.values || [];
            const hashRow = rows.find(r => r[0] === this.CACHE_TYPES.DATA_HASH);
            
            return hashRow ? hashRow[4] : null;
            
        } catch (error) {
            return null;
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // OPERACJE NA ARKUSZU
    // ═══════════════════════════════════════════════════════════
    
    async _saveToSheet(aggregations, hash) {
        const timestamp = new Date().toISOString();
        
        const rows = [
            [this.CACHE_TYPES.DATA_HASH, 'current', '', timestamp, hash],
            [this.CACHE_TYPES.AVAILABLE_PERIODS, 'all', JSON.stringify(aggregations.availablePeriods), timestamp, ''],
            [this.CACHE_TYPES.MONTHLY_TOTALS, 'all', JSON.stringify(aggregations.monthlyTotals), timestamp, ''],
            [this.CACHE_TYPES.CATEGORY_SUMS, 'all', JSON.stringify(aggregations.categorySums), timestamp, ''],
            [this.CACHE_TYPES.SUBCATEGORY_SUMS, 'all', JSON.stringify(aggregations.subcategorySums), timestamp, ''],
            [this.CACHE_TYPES.CATEGORY_LIST, 'all', JSON.stringify({
                categories: aggregations.categoryList,
                subcategories: aggregations.subcategoryList
            }), timestamp, ''],
            [this.CACHE_TYPES.INCOME_SOURCES, 'all', JSON.stringify(aggregations.incomeSources), timestamp, ''],
            [this.CACHE_TYPES.TRENDS, 'all', JSON.stringify(aggregations.trends), timestamp, ''],
            [this.CACHE_TYPES.ANOMALIES, 'last', JSON.stringify(aggregations.anomalies), timestamp, ''],
            [this.CACHE_TYPES.METHODOLOGY_503020, 'last', JSON.stringify(aggregations.methodology503020), timestamp, ''],
            [this.CACHE_TYPES.TOP_EXPENSES, 'all', JSON.stringify(aggregations.topExpenses), timestamp, '']
        ];
        
        // Wyczyść i zapisz
        try {
            // Najpierw usuń stare dane (zachowaj nagłówek)
            const sheetId = await this._getSheetId();
            
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                resource: {
                    requests: [{
                        updateCells: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: 1,
                                startColumnIndex: 0
                            },
                            fields: 'userEnteredValue'
                        }
                    }]
                }
            });
            
            // Zapisz nowe dane
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.CACHE_SHEET}!A2:E${rows.length + 1}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: rows }
            });
            
        } catch (error) {
            console.error('BudgetAICache: Błąd zapisu do arkusza:', error);
            throw error;
        }
    },
    
    async _loadFromSheet() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.CACHE_SHEET}!A2:E`
            });
            
            const rows = response.result.values || [];
            
            if (rows.length === 0) {
                return null;
            }
            
            const cache = {
                timestamp: null,
                availablePeriods: [],
                monthlyTotals: {},
                categorySums: {},
                subcategorySums: {},
                categoryList: [],
                subcategoryList: {},
                incomeSources: {},
                trends: {},
                anomalies: [],
                methodology503020: {},
                topExpenses: []
            };
            
            rows.forEach(row => {
                const [type, , valueJson, timestamp] = row;
                
                if (timestamp && (!cache.timestamp || timestamp > cache.timestamp)) {
                    cache.timestamp = timestamp;
                }
                
                try {
                    const value = valueJson ? JSON.parse(valueJson) : null;
                    
                    switch (type) {
                        case this.CACHE_TYPES.AVAILABLE_PERIODS:
                            cache.availablePeriods = value || [];
                            break;
                        case this.CACHE_TYPES.MONTHLY_TOTALS:
                            cache.monthlyTotals = value || {};
                            break;
                        case this.CACHE_TYPES.CATEGORY_SUMS:
                            cache.categorySums = value || {};
                            break;
                        case this.CACHE_TYPES.SUBCATEGORY_SUMS:
                            cache.subcategorySums = value || {};
                            break;
                        case this.CACHE_TYPES.CATEGORY_LIST:
                            cache.categoryList = value?.categories || [];
                            cache.subcategoryList = value?.subcategories || {};
                            break;
                        case this.CACHE_TYPES.INCOME_SOURCES:
                            cache.incomeSources = value || {};
                            break;
                        case this.CACHE_TYPES.TRENDS:
                            cache.trends = value || {};
                            break;
                        case this.CACHE_TYPES.ANOMALIES:
                            cache.anomalies = value || [];
                            break;
                        case this.CACHE_TYPES.METHODOLOGY_503020:
                            cache.methodology503020 = value || {};
                            break;
                        case this.CACHE_TYPES.TOP_EXPENSES:
                            cache.topExpenses = value || [];
                            break;
                    }
                } catch (e) {
                    console.warn('BudgetAICache: Błąd parsowania:', type, e);
                }
            });
            
            return cache;
            
        } catch (error) {
            console.warn('BudgetAICache: Błąd ładowania z arkusza:', error);
            return null;
        }
    },
    
    async _getSheetId() {
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID
        });
        
        const sheet = response.result.sheets.find(s => 
            s.properties.title === this.CACHE_SHEET
        );
        
        if (!sheet) {
            throw new Error(`Nie znaleziono arkusza: ${this.CACHE_SHEET}`);
        }
        
        return sheet.properties.sheetId;
    },
    
    // ═══════════════════════════════════════════════════════════
    // PUBLICZNE METODY DOSTĘPU
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Pobiera sumy dla kategorii
     */
    async getCategorySums(category = null) {
        const cache = await this.getCache();
        
        if (category) {
            return cache.categorySums[category] || null;
        }
        
        return cache.categorySums;
    },
    
    /**
     * Pobiera sumy dla podkategorii
     */
    async getSubcategorySums(category, subcategory) {
        const cache = await this.getCache();
        const key = `${category}|${subcategory}`;
        return cache.subcategorySums[key] || null;
    },
    
    /**
     * Pobiera listę dostępnych kategorii i podkategorii
     */
    async getCategoryList() {
        const cache = await this.getCache();
        return {
            categories: cache.categoryList,
            subcategories: cache.subcategoryList
        };
    },
    
    /**
     * Pobiera sumy miesięczne
     */
    async getMonthlyTotals(period = null) {
        const cache = await this.getCache();
        
        if (period) {
            return cache.monthlyTotals[period] || null;
        }
        
        return cache.monthlyTotals;
    },
    
    /**
     * Pobiera dostępne okresy
     */
    async getAvailablePeriods() {
        const cache = await this.getCache();
        return cache.availablePeriods;
    },
    
    /**
     * Pobiera trendy
     */
    async getTrends() {
        const cache = await this.getCache();
        return cache.trends;
    },
    
    /**
     * Pobiera anomalie
     */
    async getAnomalies() {
        const cache = await this.getCache();
        return cache.anomalies;
    },
    
    /**
     * Pobiera analizę 50/30/20
     */
    async getMethodology503020() {
        const cache = await this.getCache();
        return cache.methodology503020;
    },
    
    /**
     * Pobiera top wydatki
     */
    async getTopExpenses() {
        const cache = await this.getCache();
        return cache.topExpenses;
    },
    
    /**
     * Czyści cache (wymusza przeliczenie przy następnym wywołaniu)
     */
    clearCache() {
        this._memoryCache = null;
        this._dataHash = null;
        this._lastUpdate = null;
    }
};
