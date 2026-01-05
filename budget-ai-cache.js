/**
 * Assetly - Budget AI Cache Manager
 * Zarządzanie arkuszem _AI_Cache z pre-computed agregatami
 * Automatyczne tworzenie i aktualizacja cache dla AI
 */

const BudgetAICache = (function() {
    
    const CACHE_SHEET_NAME = '_AI_Cache';
    const CACHE_VERSION = '1.0';
    const HISTORY_MONTHS = 24;
    
    // ═══════════════════════════════════════════════════════════
    // STRUKTURA CACHE
    // ═══════════════════════════════════════════════════════════
    
    const CACHE_SECTIONS = {
        // Sekcja A: Metadane i podsumowanie ogólne (A1:F10)
        SUMMARY: {
            range: 'A1:F10',
            startRow: 1,
            headers: ['Metryka', 'Wartość', 'Waluta', 'Okres_Od', 'Okres_Do', 'Aktualizacja']
        },
        // Sekcja B: TOP kategorie wydatków (A15:G40)
        TOP_CATEGORIES: {
            range: 'A15:G40',
            startRow: 15,
            headers: ['Kategoria', 'Suma', 'Liczba', 'Srednia_Mies', 'Procent_Calosc', 'Min_Mies', 'Max_Mies']
        },
        // Sekcja C: TOP podkategorie (A45:H70)
        TOP_SUBCATEGORIES: {
            range: 'A45:H70',
            startRow: 45,
            headers: ['Kategoria', 'Podkategoria', 'Suma', 'Liczba', 'Srednia_Mies', 'Procent_Calosc', 'Procent_Kat', 'Trend']
        },
        // Sekcja D: Agregaty miesięczne (A75:L100)
        MONTHLY: {
            range: 'A75:L100',
            startRow: 75,
            headers: ['Okres', 'Rok', 'Miesiac', 'Dochod', 'Wydatki', 'Stale', 'Zmienne', 'Transfery', 'Bilans', 'Stopa_Oszcz', 'Zmiana_vs_Poprz', 'Zmiana_Proc']
        },
        // Sekcja E: Historia wynagrodzeń (A105:G125)
        SALARY_HISTORY: {
            range: 'A105:G125',
            startRow: 105,
            headers: ['Okres', 'Pracodawca', 'Kwota', 'Zmiana', 'Zmiana_Proc', 'Czy_Podwyzka', 'Miesiac_Zatrudnienia']
        },
        // Sekcja F: Analiza 50/30/20 (A130:F135)
        METHODOLOGY: {
            range: 'A130:F135',
            startRow: 130,
            headers: ['Typ', 'Kwota', 'Procent', 'Cel', 'Roznica', 'Status']
        },
        // Sekcja G: Dochody wg źródeł (A140:F155)
        INCOME_BY_SOURCE: {
            range: 'A140:F155',
            startRow: 140,
            headers: ['Zrodlo', 'Suma', 'Liczba', 'Srednia_Mies', 'Procent_Calosc', 'Trend']
        },
        // Sekcja H: Trendy (A160:E165)
        TRENDS: {
            range: 'A160:E165',
            startRow: 160,
            headers: ['Metryka', 'Srednia_Pierwsza_Pol', 'Srednia_Druga_Pol', 'Zmiana_Proc', 'Kierunek']
        }
    };

    // ═══════════════════════════════════════════════════════════
    // SPRAWDZANIE I TWORZENIE ARKUSZA
    // ═══════════════════════════════════════════════════════════
    
    async function ensureCacheExists() {
        try {
            const spreadsheetId = localStorage.getItem('budget_spreadsheet_id');
            if (!spreadsheetId) {
                console.warn('Brak ID arkusza budżetu');
                return false;
            }
            
            // Sprawdź czy arkusz istnieje
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: spreadsheetId
            });
            
            const sheets = response.result.sheets || [];
            const cacheSheet = sheets.find(s => s.properties.title === CACHE_SHEET_NAME);
            
            if (!cacheSheet) {
                console.log('Tworzę arkusz _AI_Cache...');
                await createCacheSheet(spreadsheetId);
                return true;
            }
            
            return true;
        } catch (error) {
            console.error('Błąd sprawdzania cache:', error);
            return false;
        }
    }
    
    async function createCacheSheet(spreadsheetId) {
        try {
            // Dodaj nowy arkusz
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: CACHE_SHEET_NAME,
                                gridProperties: {
                                    rowCount: 200,
                                    columnCount: 15
                                }
                            }
                        }
                    }]
                }
            });
            
            // Ustaw nagłówki sekcji
            await initializeCacheHeaders(spreadsheetId);
            
            console.log('Arkusz _AI_Cache utworzony');
            return true;
        } catch (error) {
            console.error('Błąd tworzenia arkusza cache:', error);
            throw error;
        }
    }
    
    async function initializeCacheHeaders(spreadsheetId) {
        const updates = [];
        
        // Nagłówki dla każdej sekcji
        Object.entries(CACHE_SECTIONS).forEach(([name, section]) => {
            updates.push({
                range: `${CACHE_SHEET_NAME}!A${section.startRow}`,
                values: [section.headers]
            });
            
            // Etykieta sekcji (wiersz powyżej)
            if (section.startRow > 1) {
                updates.push({
                    range: `${CACHE_SHEET_NAME}!A${section.startRow - 1}`,
                    values: [[`### ${name} ###`]]
                });
            }
        });
        
        await gapi.client.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: updates
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // AKTUALIZACJA CACHE (OBLICZENIA LOKALNE)
    // ═══════════════════════════════════════════════════════════
    
    async function refreshCache() {
        console.log('Odświeżam _AI_Cache...');
        
        const spreadsheetId = localStorage.getItem('budget_spreadsheet_id');
        if (!spreadsheetId) return false;
        
        // Upewnij się że arkusz istnieje
        await ensureCacheExists();
        
        // Sprawdź czy mamy dane
        if (typeof allExpenses === 'undefined' || typeof allIncome === 'undefined') {
            console.warn('Brak danych do cache');
            return false;
        }
        
        const now = new Date().toISOString();
        const updates = [];
        
        // Oblicz cutoff dla 24 miesięcy
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - HISTORY_MONTHS);
        const cutoffYear = cutoffDate.getFullYear();
        const cutoffMonth = cutoffDate.getMonth() + 1;
        
        // Filtruj dane do ostatnich 24 miesięcy
        const filteredExpenses = allExpenses.filter(e => {
            if (e.rok > cutoffYear) return true;
            if (e.rok === cutoffYear && e.miesiac >= cutoffMonth) return true;
            return false;
        });
        
        const filteredIncome = allIncome.filter(i => {
            if (i.rok > cutoffYear) return true;
            if (i.rok === cutoffYear && i.miesiac >= cutoffMonth) return true;
            return false;
        });
        
        // === SEKCJA A: SUMMARY ===
        const summaryData = calculateSummary(filteredExpenses, filteredIncome, now);
        updates.push({
            range: `${CACHE_SHEET_NAME}!A2:F10`,
            values: summaryData
        });
        
        // === SEKCJA B: TOP CATEGORIES ===
        const topCategoriesData = calculateTopCategories(filteredExpenses);
        updates.push({
            range: `${CACHE_SHEET_NAME}!A16:G40`,
            values: topCategoriesData
        });
        
        // === SEKCJA C: TOP SUBCATEGORIES ===
        const topSubcategoriesData = calculateTopSubcategories(filteredExpenses);
        updates.push({
            range: `${CACHE_SHEET_NAME}!A46:H70`,
            values: topSubcategoriesData
        });
        
        // === SEKCJA D: MONTHLY ===
        const monthlyData = calculateMonthlyAggregates(filteredExpenses, filteredIncome);
        updates.push({
            range: `${CACHE_SHEET_NAME}!A76:L100`,
            values: monthlyData
        });
        
        // === SEKCJA E: SALARY HISTORY ===
        const salaryData = calculateSalaryHistory(filteredIncome);
        updates.push({
            range: `${CACHE_SHEET_NAME}!A106:G125`,
            values: salaryData
        });
        
        // === SEKCJA F: METHODOLOGY 50/30/20 ===
        const methodologyData = calculateMethodology(filteredExpenses, filteredIncome);
        updates.push({
            range: `${CACHE_SHEET_NAME}!A131:F135`,
            values: methodologyData
        });
        
        // === SEKCJA G: INCOME BY SOURCE ===
        const incomeBySourceData = calculateIncomeBySource(filteredIncome);
        updates.push({
            range: `${CACHE_SHEET_NAME}!A141:F155`,
            values: incomeBySourceData
        });
        
        // === SEKCJA H: TRENDS ===
        const trendsData = calculateTrends(filteredExpenses, filteredIncome);
        updates.push({
            range: `${CACHE_SHEET_NAME}!A161:E165`,
            values: trendsData
        });
        
        // Zapisz wszystko do arkusza
        try {
            await gapi.client.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: updates
                }
            });
            
            console.log('_AI_Cache zaktualizowany');
            return true;
        } catch (error) {
            console.error('Błąd zapisu cache:', error);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // FUNKCJE OBLICZENIOWE
    // ═══════════════════════════════════════════════════════════
    
    function calculateSummary(expenses, income, timestamp) {
        const totalExpenses = expenses.reduce((s, e) => s + e.kwotaPLN, 0);
        const totalIncome = income.reduce((s, i) => s + i.kwotaPLN, 0);
        const balance = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? (balance / totalIncome * 100) : 0;
        
        const periods = new Set();
        expenses.forEach(e => periods.add(`${e.rok}-${String(e.miesiac).padStart(2, '0')}`));
        income.forEach(i => periods.add(`${i.rok}-${String(i.miesiac).padStart(2, '0')}`));
        const sortedPeriods = [...periods].sort();
        
        const monthCount = periods.size || 1;
        
        return [
            ['Łączne_wydatki', totalExpenses, 'PLN', sortedPeriods[0] || '', sortedPeriods[sortedPeriods.length - 1] || '', timestamp],
            ['Łączne_dochody', totalIncome, 'PLN', '', '', ''],
            ['Bilans', balance, 'PLN', '', '', ''],
            ['Stopa_oszczędności', savingsRate, '%', '', '', ''],
            ['Liczba_miesięcy', monthCount, '', '', '', ''],
            ['Liczba_wydatków', expenses.length, '', '', '', ''],
            ['Liczba_dochodów', income.length, '', '', '', ''],
            ['Średnie_wydatki_mies', totalExpenses / monthCount, 'PLN', '', '', ''],
            ['Średnie_dochody_mies', totalIncome / monthCount, 'PLN', '', '', '']
        ];
    }
    
    function calculateTopCategories(expenses) {
        const byCategory = {};
        const monthlyByCategory = {};
        
        expenses.forEach(e => {
            if (!byCategory[e.kategoria]) {
                byCategory[e.kategoria] = { total: 0, count: 0 };
                monthlyByCategory[e.kategoria] = {};
            }
            byCategory[e.kategoria].total += e.kwotaPLN;
            byCategory[e.kategoria].count++;
            
            const period = `${e.rok}-${e.miesiac}`;
            if (!monthlyByCategory[e.kategoria][period]) {
                monthlyByCategory[e.kategoria][period] = 0;
            }
            monthlyByCategory[e.kategoria][period] += e.kwotaPLN;
        });
        
        const totalExpenses = expenses.reduce((s, e) => s + e.kwotaPLN, 0);
        const periods = new Set(expenses.map(e => `${e.rok}-${e.miesiac}`));
        const monthCount = periods.size || 1;
        
        const sorted = Object.entries(byCategory)
            .map(([cat, data]) => {
                const monthlyValues = Object.values(monthlyByCategory[cat]);
                return {
                    category: cat,
                    total: data.total,
                    count: data.count,
                    avg: data.total / monthCount,
                    percent: totalExpenses > 0 ? (data.total / totalExpenses * 100) : 0,
                    min: monthlyValues.length > 0 ? Math.min(...monthlyValues) : 0,
                    max: monthlyValues.length > 0 ? Math.max(...monthlyValues) : 0
                };
            })
            .sort((a, b) => b.total - a.total)
            .slice(0, 20);
        
        return sorted.map(c => [
            c.category, c.total, c.count, c.avg, c.percent, c.min, c.max
        ]);
    }
    
    function calculateTopSubcategories(expenses) {
        const bySubcategory = {};
        const monthlyBySub = {};
        const categoryTotals = {};
        
        expenses.forEach(e => {
            const key = `${e.kategoria}|||${e.podkategoria || '(brak)'}`;
            if (!bySubcategory[key]) {
                bySubcategory[key] = { 
                    category: e.kategoria, 
                    subcategory: e.podkategoria || '(brak)', 
                    total: 0, 
                    count: 0 
                };
                monthlyBySub[key] = {};
            }
            bySubcategory[key].total += e.kwotaPLN;
            bySubcategory[key].count++;
            
            const period = `${e.rok}-${e.miesiac}`;
            if (!monthlyBySub[key][period]) monthlyBySub[key][period] = 0;
            monthlyBySub[key][period] += e.kwotaPLN;
            
            if (!categoryTotals[e.kategoria]) categoryTotals[e.kategoria] = 0;
            categoryTotals[e.kategoria] += e.kwotaPLN;
        });
        
        const totalExpenses = expenses.reduce((s, e) => s + e.kwotaPLN, 0);
        const periods = new Set(expenses.map(e => `${e.rok}-${e.miesiac}`));
        const monthCount = periods.size || 1;
        
        const sorted = Object.entries(bySubcategory)
            .map(([key, data]) => {
                const monthlyValues = Object.values(monthlyBySub[key]);
                const trend = calculateSimpleTrend(monthlyValues);
                return {
                    ...data,
                    avg: data.total / monthCount,
                    percentTotal: totalExpenses > 0 ? (data.total / totalExpenses * 100) : 0,
                    percentCat: categoryTotals[data.category] > 0 ? (data.total / categoryTotals[data.category] * 100) : 0,
                    trend: trend
                };
            })
            .sort((a, b) => b.total - a.total)
            .slice(0, 20);
        
        return sorted.map(s => [
            s.category, s.subcategory, s.total, s.count, s.avg, s.percentTotal, s.percentCat, s.trend
        ]);
    }
    
    function calculateMonthlyAggregates(expenses, income) {
        const months = {};
        
        expenses.forEach(e => {
            const period = `${e.rok}-${String(e.miesiac).padStart(2, '0')}`;
            if (!months[period]) {
                months[period] = { 
                    period, rok: e.rok, miesiac: e.miesiac,
                    income: 0, expenses: 0, fixed: 0, variable: 0, transfers: 0 
                };
            }
            months[period].expenses += e.kwotaPLN;
            if (e.jestStaly) months[period].fixed += e.kwotaPLN;
            else if (e.jestTransfer) months[period].transfers += e.kwotaPLN;
            else months[period].variable += e.kwotaPLN;
        });
        
        income.forEach(i => {
            const period = `${i.rok}-${String(i.miesiac).padStart(2, '0')}`;
            if (!months[period]) {
                months[period] = { 
                    period, rok: i.rok, miesiac: i.miesiac,
                    income: 0, expenses: 0, fixed: 0, variable: 0, transfers: 0 
                };
            }
            months[period].income += i.kwotaPLN;
        });
        
        const sorted = Object.values(months).sort((a, b) => a.period.localeCompare(b.period));
        
        return sorted.map((m, idx) => {
            const balance = m.income - m.expenses + m.transfers;
            const savingsRate = m.income > 0 ? (balance / m.income * 100) : 0;
            const prev = idx > 0 ? sorted[idx - 1] : null;
            const prevBalance = prev ? (prev.income - prev.expenses + prev.transfers) : 0;
            const change = prev ? (balance - prevBalance) : 0;
            const changePercent = prev && prevBalance !== 0 ? ((balance - prevBalance) / Math.abs(prevBalance) * 100) : 0;
            
            return [
                m.period, m.rok, m.miesiac, m.income, m.expenses, 
                m.fixed, m.variable, m.transfers, balance, savingsRate,
                change, changePercent
            ];
        }).slice(-HISTORY_MONTHS);
    }
    
    function calculateSalaryHistory(income) {
        const salaries = income
            .filter(i => i.zrodlo === 'Wynagrodzenie' && i.pracodawca)
            .sort((a, b) => {
                if (a.rok !== b.rok) return a.rok - b.rok;
                return a.miesiac - b.miesiac;
            });
        
        const result = [];
        let monthCounter = {};
        
        salaries.forEach((s, idx) => {
            const period = `${s.rok}-${String(s.miesiac).padStart(2, '0')}`;
            const prev = idx > 0 ? salaries[idx - 1] : null;
            const change = prev ? (s.kwotaPLN - prev.kwotaPLN) : 0;
            const changePercent = prev && prev.kwotaPLN > 0 ? ((s.kwotaPLN - prev.kwotaPLN) / prev.kwotaPLN * 100) : 0;
            const isRaise = change > 0 ? 'TAK' : 'NIE';
            
            if (!monthCounter[s.pracodawca]) monthCounter[s.pracodawca] = 0;
            monthCounter[s.pracodawca]++;
            
            result.push([
                period, s.pracodawca, s.kwotaPLN, change, changePercent, isRaise, monthCounter[s.pracodawca]
            ]);
        });
        
        return result.slice(-20);
    }
    
    function calculateMethodology(expenses, income) {
        const totalIncome = income.reduce((s, i) => s + i.kwotaPLN, 0);
        
        // Kategoryzacja według 50/30/20
        let needs = 0, wants = 0;
        
        expenses.forEach(e => {
            if (e.jestTransfer) return;
            
            const methodology = typeof BudgetCategories !== 'undefined' 
                ? BudgetCategories.getMethodology(e.kategoria) 
                : 'wants';
            
            if (methodology === 'needs') needs += e.kwotaPLN;
            else wants += e.kwotaPLN;
        });
        
        const savings = totalIncome - needs - wants;
        
        const needsPercent = totalIncome > 0 ? (needs / totalIncome * 100) : 0;
        const wantsPercent = totalIncome > 0 ? (wants / totalIncome * 100) : 0;
        const savingsPercent = totalIncome > 0 ? (savings / totalIncome * 100) : 0;
        
        return [
            ['Potrzeby', needs, needsPercent, 50, needsPercent - 50, needsPercent <= 50 ? 'OK' : 'PRZEKROCZONO'],
            ['Zachcianki', wants, wantsPercent, 30, wantsPercent - 30, wantsPercent <= 30 ? 'OK' : 'PRZEKROCZONO'],
            ['Oszczędności', savings, savingsPercent, 20, savingsPercent - 20, savingsPercent >= 20 ? 'OK' : 'PONIŻEJ_CELU'],
            ['SUMA', totalIncome, 100, 100, 0, '']
        ];
    }
    
    function calculateIncomeBySource(income) {
        const bySource = {};
        const monthlyBySource = {};
        
        income.forEach(i => {
            if (!bySource[i.zrodlo]) {
                bySource[i.zrodlo] = { total: 0, count: 0 };
                monthlyBySource[i.zrodlo] = {};
            }
            bySource[i.zrodlo].total += i.kwotaPLN;
            bySource[i.zrodlo].count++;
            
            const period = `${i.rok}-${i.miesiac}`;
            if (!monthlyBySource[i.zrodlo][period]) monthlyBySource[i.zrodlo][period] = 0;
            monthlyBySource[i.zrodlo][period] += i.kwotaPLN;
        });
        
        const totalIncome = income.reduce((s, i) => s + i.kwotaPLN, 0);
        const periods = new Set(income.map(i => `${i.rok}-${i.miesiac}`));
        const monthCount = periods.size || 1;
        
        const sorted = Object.entries(bySource)
            .map(([source, data]) => {
                const trend = calculateSimpleTrend(Object.values(monthlyBySource[source]));
                return {
                    source,
                    total: data.total,
                    count: data.count,
                    avg: data.total / monthCount,
                    percent: totalIncome > 0 ? (data.total / totalIncome * 100) : 0,
                    trend
                };
            })
            .sort((a, b) => b.total - a.total);
        
        return sorted.map(s => [s.source, s.total, s.count, s.avg, s.percent, s.trend]);
    }
    
    function calculateTrends(expenses, income) {
        const monthly = {};
        
        expenses.forEach(e => {
            const period = `${e.rok}-${String(e.miesiac).padStart(2, '0')}`;
            if (!monthly[period]) monthly[period] = { expenses: 0, income: 0 };
            monthly[period].expenses += e.kwotaPLN;
        });
        
        income.forEach(i => {
            const period = `${i.rok}-${String(i.miesiac).padStart(2, '0')}`;
            if (!monthly[period]) monthly[period] = { expenses: 0, income: 0 };
            monthly[period].income += i.kwotaPLN;
        });
        
        const sorted = Object.values(monthly);
        const mid = Math.floor(sorted.length / 2);
        const firstHalf = sorted.slice(0, mid);
        const secondHalf = sorted.slice(mid);
        
        const avgExpFirst = firstHalf.length > 0 ? firstHalf.reduce((s, m) => s + m.expenses, 0) / firstHalf.length : 0;
        const avgExpSecond = secondHalf.length > 0 ? secondHalf.reduce((s, m) => s + m.expenses, 0) / secondHalf.length : 0;
        const avgIncFirst = firstHalf.length > 0 ? firstHalf.reduce((s, m) => s + m.income, 0) / firstHalf.length : 0;
        const avgIncSecond = secondHalf.length > 0 ? secondHalf.reduce((s, m) => s + m.income, 0) / secondHalf.length : 0;
        
        const expChange = avgExpFirst > 0 ? ((avgExpSecond - avgExpFirst) / avgExpFirst * 100) : 0;
        const incChange = avgIncFirst > 0 ? ((avgIncSecond - avgIncFirst) / avgIncFirst * 100) : 0;
        const balanceFirst = avgIncFirst - avgExpFirst;
        const balanceSecond = avgIncSecond - avgExpSecond;
        const balChange = balanceFirst !== 0 ? ((balanceSecond - balanceFirst) / Math.abs(balanceFirst) * 100) : 0;
        
        return [
            ['Wydatki', avgExpFirst, avgExpSecond, expChange, getTrendDirection(expChange)],
            ['Dochody', avgIncFirst, avgIncSecond, incChange, getTrendDirection(incChange)],
            ['Bilans', balanceFirst, balanceSecond, balChange, getTrendDirection(balChange)],
            ['Stopa_oszczędności', 
                avgIncFirst > 0 ? (balanceFirst / avgIncFirst * 100) : 0,
                avgIncSecond > 0 ? (balanceSecond / avgIncSecond * 100) : 0,
                0, '']
        ];
    }
    
    function calculateSimpleTrend(values) {
        if (values.length < 2) return 'BRAK_DANYCH';
        const mid = Math.floor(values.length / 2);
        const firstHalf = values.slice(0, mid);
        const secondHalf = values.slice(mid);
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        const change = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst * 100) : 0;
        return getTrendDirection(change);
    }
    
    function getTrendDirection(changePercent) {
        if (changePercent > 10) return 'ROSNĄCY';
        if (changePercent < -10) return 'MALEJĄCY';
        return 'STABILNY';
    }

    // ═══════════════════════════════════════════════════════════
    // POBIERANIE DANYCH Z CACHE
    // ═══════════════════════════════════════════════════════════
    
    async function getCacheSection(sectionName) {
        const spreadsheetId = localStorage.getItem('budget_spreadsheet_id');
        if (!spreadsheetId) return null;
        
        const section = CACHE_SECTIONS[sectionName];
        if (!section) return null;
        
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `${CACHE_SHEET_NAME}!${section.range}`
            });
            
            return {
                headers: section.headers,
                data: response.result.values || []
            };
        } catch (error) {
            console.error(`Błąd pobierania sekcji ${sectionName}:`, error);
            return null;
        }
    }
    
    async function getMultipleSections(sectionNames) {
        const result = {};
        for (const name of sectionNames) {
            result[name] = await getCacheSection(name);
        }
        return result;
    }
    
    // Pobierz konkretne dane dla intencji
    async function getDataForIntent(intent, filters = {}) {
        const intentToSections = {
            'summary': ['SUMMARY', 'METHODOLOGY'],
            'top_categories': ['TOP_CATEGORIES'],
            'top_subcategories': ['TOP_SUBCATEGORIES'],
            'expense_by_category': ['TOP_CATEGORIES', 'TOP_SUBCATEGORIES'],
            'expense_by_subcategory': ['TOP_SUBCATEGORIES'],
            'expense_by_period': ['MONTHLY'],
            'income_analysis': ['INCOME_BY_SOURCE', 'SALARY_HISTORY'],
            'salary_history': ['SALARY_HISTORY'],
            'compare_periods': ['MONTHLY'],
            'methodology_503020': ['METHODOLOGY'],
            'trend_analysis': ['MONTHLY', 'TRENDS'],
            'unknown': ['SUMMARY', 'TOP_CATEGORIES', 'MONTHLY']
        };
        
        const sections = intentToSections[intent] || intentToSections['unknown'];
        const data = await getMultipleSections(sections);
        
        // Zastosuj filtry jeśli są
        if (filters.category && data.TOP_SUBCATEGORIES) {
            data.TOP_SUBCATEGORIES.data = data.TOP_SUBCATEGORIES.data.filter(
                row => row[0] && row[0].toLowerCase().includes(filters.category.toLowerCase())
            );
        }
        
        if (filters.subcategory && data.TOP_SUBCATEGORIES) {
            data.TOP_SUBCATEGORIES.data = data.TOP_SUBCATEGORIES.data.filter(
                row => row[1] && row[1].toLowerCase().includes(filters.subcategory.toLowerCase())
            );
        }
        
        if (filters.period && data.MONTHLY) {
            data.MONTHLY.data = data.MONTHLY.data.filter(
                row => row[0] && row[0].includes(filters.period)
            );
        }
        
        return data;
    }
    
    // Konwertuj dane cache do czytelnego formatu dla AI
    function formatCacheForAI(cacheData) {
        const lines = [];
        
        Object.entries(cacheData).forEach(([section, content]) => {
            if (!content || !content.data || content.data.length === 0) return;
            
            lines.push(`\n### ${section}`);
            lines.push(content.headers.join(' | '));
            lines.push(content.headers.map(() => '---').join(' | '));
            
            content.data.forEach(row => {
                if (row && row.length > 0) {
                    lines.push(row.map(cell => {
                        if (typeof cell === 'number') {
                            return Number.isInteger(cell) ? cell : cell.toFixed(2);
                        }
                        return cell || '';
                    }).join(' | '));
                }
            });
        });
        
        return lines.join('\n');
    }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════
    
    return {
        CACHE_SHEET_NAME,
        CACHE_SECTIONS,
        ensureCacheExists,
        refreshCache,
        getCacheSection,
        getMultipleSections,
        getDataForIntent,
        formatCacheForAI
    };
    
})();

// Auto-refresh przy zmianie danych (jeśli moduł budżetu jest aktywny)
if (typeof window !== 'undefined') {
    window.BudgetAICache = BudgetAICache;
}
