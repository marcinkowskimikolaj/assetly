/**
 * Assetly - Budget AI Compute
 * Deterministyczne funkcje obliczeniowe dla AI (Uszczelnione)
 */

const BudgetAICompute = {
    
    // ═══════════════════════════════════════════════════════════
    // NORMALIZACJA I PARSOWANIE
    // ═══════════════════════════════════════════════════════════
    
    normalizeCategory(input) {
        // Wrapper na BudgetAISynonyms jeśli dostępny, w przeciwnym razie prosta normalizacja
        if (typeof BudgetAISynonyms !== 'undefined') {
             // To jest używane głównie przez Router fallback, ale compute też może potrzebować
             // weryfikacji. Tutaj zostawiamy prostą logikę lub odwołanie do synonimów.
             return null; // Compute powinno polegać na 'canonical' z Routera
        }
        return null; 
    },

    parsePeriod(input) {
        if (!input) return null;
        const text = input.toLowerCase();
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        if (text.includes('ostatni miesiąc') || text.includes('poprzedni miesiąc')) {
            const m = currentMonth === 1 ? 12 : currentMonth - 1;
            const y = currentMonth === 1 ? currentYear - 1 : currentYear;
            const s = `${y}-${String(m).padStart(2, '0')}`;
            return { from: s, to: s };
        }
        
        // Prosty parser YYYY
        const yearMatch = text.match(/(?:rok\s+)?(\d{4})/);
        if (yearMatch) {
            const year = parseInt(yearMatch[1]);
            return { from: `${year}-01`, to: `${year}-12` };
        }
        
        return null;
    },

    // ═══════════════════════════════════════════════════════════
    // LISTA FUNKCJI (WHITELIST)
    // ═══════════════════════════════════════════════════════════

    AVAILABLE_FUNCTIONS: {
        sumByCategory: { name: 'sumByCategory', params: ['category', 'subcategory?', 'periodFrom?', 'periodTo?'] },
        sumBySubcategory: { name: 'sumBySubcategory', params: ['category', 'subcategory', 'periodFrom?', 'periodTo?'] },
        topExpenses: { name: 'topExpenses', params: ['n', 'category?', 'periodFrom?', 'periodTo?'] }, // Added category
        monthlyBreakdown: { name: 'monthlyBreakdown', params: ['category?', 'subcategory?', 'periodFrom?', 'periodTo?'] }, // Added periods
        compareMonths: { name: 'compareMonths', params: ['period1', 'period2'] },
        trendAnalysis: { name: 'trendAnalysis', params: ['metric', 'months?'] },
        analyze503020: { name: 'analyze503020', params: ['period?'] },
        getSummary: { name: 'getSummary', params: ['period?'] },
        getAnomalies: { name: 'getAnomalies', params: ['threshold?'] },
        totalBalance: { name: 'totalBalance', params: ['periodFrom?', 'periodTo?'] },
        incomeBySource: { name: 'incomeBySource', params: ['source?', 'periodFrom?', 'periodTo?'] }
    },

    getFunctionList() {
        return Object.values(this.AVAILABLE_FUNCTIONS);
    },

    // ═══════════════════════════════════════════════════════════
    // WYKONANIE (EXECUTION LAYER)
    // ═══════════════════════════════════════════════════════════

    async executeOperations(operations, cache = null) {
        if (!cache) cache = await BudgetAICache.getCache();
        const results = [];

        for (const op of operations) {
            try {
                // Walidacja parametrów przed wykonaniem
                const result = await this._executeOperation(op, cache);
                results.push({
                    operation: op.function,
                    success: true,
                    data: result
                });
            } catch (error) {
                console.warn('BudgetAICompute Error:', op.function, error);
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
        const p = op.params || {};

        // Mapowanie wywołań
        if (this[fn]) {
            // Przekazujemy parametry jawnie
            if (fn === 'sumByCategory') return this.sumByCategory(p.category, p.subcategory, p.periodFrom, p.periodTo, cache);
            if (fn === 'sumBySubcategory') return this.sumByCategory(p.category, p.subcategory, p.periodFrom, p.periodTo, cache); // Alias
            if (fn === 'topExpenses') return this.topExpenses(p.n, p.category, p.periodFrom, p.periodTo, cache); // Updated signature
            if (fn === 'monthlyBreakdown') return this.monthlyBreakdown(p.category, p.subcategory, p.periodFrom, p.periodTo, cache); // Updated signature
            if (fn === 'compareMonths') return this.compareMonths(p.period1, p.period2, cache);
            if (fn === 'trendAnalysis') return this.trendAnalysis(p.metric, p.months, cache);
            if (fn === 'analyze503020') return this.analyze503020(p.period, cache);
            if (fn === 'getSummary') return this.getSummary(p.period, cache);
            if (fn === 'getAnomalies') return this.getAnomalies(p.threshold, cache);
            if (fn === 'totalBalance') return this.totalBalance(p.periodFrom, p.periodTo, cache);
            if (fn === 'incomeBySource') return this.incomeBySource(p.source, p.periodFrom, p.periodTo, cache);
            
            throw new Error(`Function implementation missing: ${fn}`);
        }
        throw new Error(`Unknown function: ${fn}`);
    },

    // ═══════════════════════════════════════════════════════════
    // IMPLEMENTACJE (FIXED)
    // ═══════════════════════════════════════════════════════════

    // Poprawiona iteracja i obsługa okresów
    sumByCategory(category, subcategory, periodFrom, periodTo, cache) {
        let total = 0;
        let count = 0;
        const byPeriod = {};
        let matchedKey = null;

        // Scenariusz 1: Konkretna podkategoria
        if (category && subcategory) {
            const key = `${category}|${subcategory}`;
            const subData = cache.subcategorySums[key];
            
            if (!subData) return { notFound: true, category, subcategory };
            
            matchedKey = key;
            // Iteracja po entries (bezpieczna)
            Object.entries(subData.byPeriod || {}).forEach(([per, val]) => {
                if (this._periodInRange(per, periodFrom, periodTo)) {
                    total += val;
                    count++;
                    byPeriod[per] = val;
                }
            });

        // Scenariusz 2: Tylko kategoria
        } else if (category) {
            const catData = cache.categorySums[category];
            if (!catData) return { notFound: true, category };
            
            matchedKey = category;
            Object.entries(catData.byPeriod || {}).forEach(([per, val]) => {
                if (this._periodInRange(per, periodFrom, periodTo)) {
                    total += val;
                    count++;
                    byPeriod[per] = val;
                }
            });

        // Scenariusz 3: Global (suma wszystkiego)
        } else {
             Object.entries(cache.monthlyTotals || {}).forEach(([per, data]) => {
                if (this._periodInRange(per, periodFrom, periodTo)) {
                    total += data.expenses;
                    count++;
                    byPeriod[per] = data.expenses;
                }
            });
        }

        return {
            total,
            count, // Ilość miesięcy z danymi
            category,
            subcategory,
            periodFrom,
            periodTo,
            rowsMatched: count > 0, // Metadata
            byPeriod // Opcjonalnie do debugu
        };
    },

    // Poprawione topExpenses z filtrowaniem kategorii
    topExpenses(n = 10, categoryFilter = null, periodFrom, periodTo, cache) {
        const results = [];
        
        // Jeśli podano kategorię, szukamy top podkategorii w tej kategorii
        // Jeśli nie, szukamy top kategorii globalnie
        
        if (categoryFilter) {
            // Ranking podkategorii w ramach danej kategorii
            Object.entries(cache.subcategorySums || {}).forEach(([key, data]) => {
                if (data.kategoria !== categoryFilter) return;

                let sum = 0;
                let hasData = false;
                
                Object.entries(data.byPeriod || {}).forEach(([per, val]) => {
                    if (this._periodInRange(per, periodFrom, periodTo)) {
                        sum += val;
                        hasData = true;
                    }
                });

                if (hasData && sum > 0) {
                    results.push({ name: data.podkategoria, value: sum, type: 'subcategory' });
                }
            });

        } else {
            // Globalny ranking kategorii (bez podkategorii)
            Object.entries(cache.categorySums || {}).forEach(([cat, data]) => {
                if (cat === 'Oszczędności i inw.' || cat === 'Nieistotne') return;

                let sum = 0;
                let hasData = false;

                Object.entries(data.byPeriod || {}).forEach(([per, val]) => {
                    if (this._periodInRange(per, periodFrom, periodTo)) {
                        sum += val;
                        hasData = true;
                    }
                });

                if (hasData && sum > 0) {
                    results.push({ name: cat, value: sum, type: 'category' });
                }
            });
        }

        return results
            .sort((a, b) => b.value - a.value)
            .slice(0, n)
            .map((r, i) => ({ rank: i + 1, ...r }));
    },

    // Monthly Breakdown z obsługą zakresów i notFound
    monthlyBreakdown(category, subcategory, periodFrom, periodTo, cache) {
        const breakdown = [];
        let sourceData = null;
        let matchedContext = '';

        if (category && subcategory) {
            sourceData = cache.subcategorySums[`${category}|${subcategory}`];
            matchedContext = `${category} / ${subcategory}`;
        } else if (category) {
            sourceData = cache.categorySums[category];
            matchedContext = category;
        } else {
            // Global expenses breakdown
            sourceData = { byPeriod: {} };
            Object.entries(cache.monthlyTotals).forEach(([p, d]) => {
                sourceData.byPeriod[p] = d.expenses;
            });
            matchedContext = 'Wszystkie wydatki';
        }

        if (!sourceData) {
            return { notFound: true, context: matchedContext };
        }

        // Iteracja i filtrowanie
        Object.entries(sourceData.byPeriod || {})
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([period, value]) => {
                if (this._periodInRange(period, periodFrom, periodTo)) {
                    breakdown.push({ period, value });
                }
            });

        if (breakdown.length === 0) {
            return { notFound: true, context: matchedContext, reason: 'No data in period' };
        }

        return {
            context: matchedContext,
            periodFrom,
            periodTo,
            breakdown // [{period: '2024-01', value: 100}, ...]
        };
    },

    // Inne funkcje pomocnicze (zachowane logicznie, poprawione iteracje)
    compareMonths(period1, period2, cache) {
        const d1 = cache.monthlyTotals[period1];
        const d2 = cache.monthlyTotals[period2];
        
        if (!d1 || !d2) return { error: 'Missing data for comparison', p1: !!d1, p2: !!d2 };

        return {
            period1: { period: period1, ...d1 },
            period2: { period: period2, ...d2 },
            diff: {
                income: d2.income - d1.income,
                expenses: d2.expenses - d1.expenses,
                balance: d2.balance - d1.balance
            }
        };
    },

    trendAnalysis(metric = 'expenses', months = 6, cache) {
        // Oblicz trend na żywo z monthlyTotals
        const data = Object.entries(cache.monthlyTotals || {})
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-months)
            .map(([p, d]) => ({
                period: p,
                value: metric === 'income' ? d.income : (metric === 'balance' ? d.balance : d.expenses)
            }));

        if (data.length < 2) return { error: 'Not enough data for trend' };

        // Prosta regresja lub zmiana first-last
        const first = data[0].value;
        const last = data[data.length - 1].value;
        const diff = last - first;
        const percent = first !== 0 ? (diff / first) * 100 : 0;
        
        return {
            metric,
            direction: diff > 0 ? 'up' : (diff < 0 ? 'down' : 'stable'),
            percentChange: percent,
            dataPoints: data
        };
    },

    analyze503020(period, cache) {
        // Pobierz ostatni miesiąc jeśli brak period
        const p = period || Object.keys(cache.monthlyTotals).sort().pop();
        const d = cache.monthlyTotals[p];
        
        if (!d) return { error: 'No data' };
        
        const income = d.income;
        if (income === 0) return { error: 'Zero income' };

        return {
            period: p,
            needs: { val: d.fixed, pct: (d.fixed/income)*100, target: 50 },
            wants: { val: d.variable, pct: (d.variable/income)*100, target: 30 },
            savings: { val: d.balance, pct: (d.balance/income)*100, target: 20 }
        };
    },
    
    getSummary(period, cache) {
         const p = period || Object.keys(cache.monthlyTotals).sort().pop();
         return {
             period: p,
             data: cache.monthlyTotals[p] || null,
             topCats: this.topExpenses(3, null, p, p, cache)
         };
    },
    
    getAnomalies(threshold = 15, cache) {
        return cache.anomalies ? cache.anomalies.filter(a => a.percent > threshold) : [];
    },

    totalBalance(periodFrom, periodTo, cache) {
        let inc = 0, exp = 0;
        Object.entries(cache.monthlyTotals).forEach(([p, d]) => {
            if (this._periodInRange(p, periodFrom, periodTo)) {
                inc += d.income;
                exp += d.expenses;
            }
        });
        return { income: inc, expenses: exp, balance: inc - exp };
    },

    incomeBySource(source, periodFrom, periodTo, cache) {
        // Implementacja uproszczona - korzysta z cache.incomeSources
        // Wymagałaby filtrowania po okresie wewnątrz struktury incomeSources,
        // ale w cache.incomeSources zazwyczaj są sumy całkowite.
        // Jeśli chcemy po okresie, musimy iterować 'allIncome' z budget.js
        // Ale 'compute' powinno działać na cache.
        // Zakładamy że cache ma incomeSources zagregowane globalnie.
        
        if (source && cache.incomeSources[source]) {
            return { source, total: cache.incomeSources[source].total };
        }
        return Object.entries(cache.incomeSources).map(([k, v]) => ({ source: k, total: v.total }));
    },

    _periodInRange(period, from, to) {
        if (from && period < from) return false;
        if (to && period > to) return false;
        return true;
    }
};
