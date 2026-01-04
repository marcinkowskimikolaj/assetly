/**
 * Assetly - Budget Sheets API
 * Operacje CRUD dla modułu Budżet
 */

const BudgetSheets = {
    
    // Nazwy zakładek
    SHEETS: {
        EXPENSES: 'Budzet_Wydatki',
        INCOME: 'Budzet_Dochody',
        RECURRING: 'Budzet_Wydatki_Stale',
        PLANS: 'Budzet_Plany',
        SETTINGS: 'Budzet_Ustawienia'
    },
    
    // ═══════════════════════════════════════════════════════════
    // WYDATKI
    // ═══════════════════════════════════════════════════════════
    
    async getExpenses() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.EXPENSES}!A2:K`
            });
            
            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                id: row[0] || '',
                rok: parseInt(row[1]) || 0,
                miesiac: parseInt(row[2]) || 0,
                kategoria: row[3] || '',
                podkategoria: row[4] || '',
                kwota: parseFloat(row[5]) || 0,
                waluta: row[6] || 'PLN',
                kwotaPLN: parseFloat(row[7]) || 0,
                jestStaly: row[8] === 'TRUE',
                jestTransfer: row[9] === 'TRUE',
                notatka: row[10] || '',
                rowIndex: index + 2
            })).filter(e => e.id);
        } catch (error) {
            console.warn('Nie można pobrać wydatków:', error);
            return [];
        }
    },
    
    async getExpensesByMonth(rok, miesiac) {
        const all = await this.getExpenses();
        return all.filter(e => e.rok === rok && e.miesiac === miesiac);
    },
    
    async getExpensesByPeriod(startDate, endDate) {
        const all = await this.getExpenses();
        return all.filter(e => {
            const expDate = new Date(e.rok, e.miesiac - 1, 1);
            return expDate >= startDate && expDate <= endDate;
        });
    },
    
    async addExpense(expense) {
        const id = 'exp-' + Date.now();
        const kwotaPLN = expense.waluta === 'PLN' 
            ? expense.kwota 
            : expense.kwota * (currencyRates[expense.waluta] || 1);
        
        const row = [
            id,
            expense.rok.toString(),
            expense.miesiac.toString(),
            expense.kategoria,
            expense.podkategoria || '',
            expense.kwota.toString(),
            expense.waluta,
            kwotaPLN.toString(),
            expense.jestStaly ? 'TRUE' : 'FALSE',
            expense.jestTransfer ? 'TRUE' : 'FALSE',
            expense.notatka || ''
        ];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.EXPENSES}!A:K`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });
        
        return { ...expense, id, kwotaPLN };
    },
    
    async addExpensesBulk(expenses) {
        const rows = expenses.map(expense => {
            const id = 'exp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const kwotaPLN = expense.waluta === 'PLN' 
                ? expense.kwota 
                : expense.kwota * (currencyRates[expense.waluta] || 1);
            
            return [
                id,
                expense.rok.toString(),
                expense.miesiac.toString(),
                expense.kategoria,
                expense.podkategoria || '',
                expense.kwota.toString(),
                expense.waluta,
                kwotaPLN.toString(),
                expense.jestStaly ? 'TRUE' : 'FALSE',
                expense.jestTransfer ? 'TRUE' : 'FALSE',
                expense.notatka || ''
            ];
        });
        
        if (rows.length === 0) return [];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.EXPENSES}!A:K`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: rows }
        });
        
        return rows.length;
    },
    
    async updateExpense(id, updates) {
        const expenses = await this.getExpenses();
        const expense = expenses.find(e => e.id === id);
        if (!expense) return false;
        
        const kwotaPLN = (updates.waluta || expense.waluta) === 'PLN'
            ? (updates.kwota || expense.kwota)
            : (updates.kwota || expense.kwota) * (currencyRates[updates.waluta || expense.waluta] || 1);
        
        const row = [
            id,
            (updates.rok || expense.rok).toString(),
            (updates.miesiac || expense.miesiac).toString(),
            updates.kategoria || expense.kategoria,
            updates.podkategoria !== undefined ? updates.podkategoria : expense.podkategoria,
            (updates.kwota || expense.kwota).toString(),
            updates.waluta || expense.waluta,
            kwotaPLN.toString(),
            (updates.jestStaly !== undefined ? updates.jestStaly : expense.jestStaly) ? 'TRUE' : 'FALSE',
            (updates.jestTransfer !== undefined ? updates.jestTransfer : expense.jestTransfer) ? 'TRUE' : 'FALSE',
            updates.notatka !== undefined ? updates.notatka : expense.notatka
        ];
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.EXPENSES}!A${expense.rowIndex}:K${expense.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });
        
        return true;
    },
    
    async deleteExpense(id) {
        const expenses = await this.getExpenses();
        const expense = expenses.find(e => e.id === id);
        if (!expense) return false;
        
        const sheetId = await this.getSheetId(this.SHEETS.EXPENSES);
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: expense.rowIndex - 1,
                            endIndex: expense.rowIndex
                        }
                    }
                }]
            }
        });
        
        return true;
    },
    
    async deleteExpensesByMonth(rok, miesiac) {
        const expenses = await this.getExpensesByMonth(rok, miesiac);
        if (expenses.length === 0) return 0;
        
        // Usuwaj od końca żeby indeksy się nie przesunęły
        const sortedByIndex = [...expenses].sort((a, b) => b.rowIndex - a.rowIndex);
        const sheetId = await this.getSheetId(this.SHEETS.EXPENSES);
        
        for (const expense of sortedByIndex) {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: expense.rowIndex - 1,
                                endIndex: expense.rowIndex
                            }
                        }
                    }]
                }
            });
        }
        
        return expenses.length;
    },
    
    // ═══════════════════════════════════════════════════════════
    // DOCHODY
    // ═══════════════════════════════════════════════════════════
    
    async getIncome() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.INCOME}!A2:K`
            });
            
            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                id: row[0] || '',
                rok: parseInt(row[1]) || 0,
                miesiac: parseInt(row[2]) || 0,
                zrodlo: row[3] || '',
                pracodawca: row[4] || '',
                kwotaBrutto: parseFloat(row[5]) || 0,
                kwotaNetto: parseFloat(row[6]) || 0,
                waluta: row[7] || 'PLN',
                kwotaPLN: parseFloat(row[8]) || 0,
                notatka: row[9] || '',
                rowIndex: index + 2
            })).filter(i => i.id);
        } catch (error) {
            console.warn('Nie można pobrać dochodów:', error);
            return [];
        }
    },
    
    async getIncomeByMonth(rok, miesiac) {
        const all = await this.getIncome();
        return all.filter(i => i.rok === rok && i.miesiac === miesiac);
    },
    
    async addIncome(income) {
        const id = 'inc-' + Date.now();
        const kwotaPLN = income.waluta === 'PLN' 
            ? income.kwotaNetto 
            : income.kwotaNetto * (currencyRates[income.waluta] || 1);
        
        const row = [
            id,
            income.rok.toString(),
            income.miesiac.toString(),
            income.zrodlo,
            income.pracodawca || '',
            (income.kwotaBrutto || 0).toString(),
            income.kwotaNetto.toString(),
            income.waluta,
            kwotaPLN.toString(),
            income.notatka || ''
        ];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.INCOME}!A:J`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });
        
        return { ...income, id, kwotaPLN };
    },
    
    async addIncomeBulk(incomes) {
        const rows = incomes.map(income => {
            const id = 'inc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const kwotaPLN = income.waluta === 'PLN' 
                ? income.kwotaNetto 
                : income.kwotaNetto * (currencyRates[income.waluta] || 1);
            
            return [
                id,
                income.rok.toString(),
                income.miesiac.toString(),
                income.zrodlo,
                income.pracodawca || '',
                (income.kwotaBrutto || 0).toString(),
                income.kwotaNetto.toString(),
                income.waluta,
                kwotaPLN.toString(),
                income.notatka || ''
            ];
        });
        
        if (rows.length === 0) return [];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.INCOME}!A:J`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: rows }
        });
        
        return rows.length;
    },
    
    async deleteIncome(id) {
        const incomes = await this.getIncome();
        const income = incomes.find(i => i.id === id);
        if (!income) return false;
        
        const sheetId = await this.getSheetId(this.SHEETS.INCOME);
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: income.rowIndex - 1,
                            endIndex: income.rowIndex
                        }
                    }
                }]
            }
        });
        
        return true;
    },
    
    // ═══════════════════════════════════════════════════════════
    // WYDATKI STAŁE (SZABLONY)
    // ═══════════════════════════════════════════════════════════
    
    async getRecurringExpenses() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.RECURRING}!A2:J`
            });
            
            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                id: row[0] || '',
                kategoria: row[1] || '',
                podkategoria: row[2] || '',
                nazwa: row[3] || '',
                kwotaTypowa: parseFloat(row[4]) || 0,
                waluta: row[5] || 'PLN',
                czestotliwosc: row[6] || 'monthly',
                miesiacPlatnosci: parseInt(row[7]) || 0, // dla rocznych
                aktywny: row[8] !== 'FALSE',
                notatka: row[9] || '',
                rowIndex: index + 2
            })).filter(r => r.id);
        } catch (error) {
            console.warn('Nie można pobrać wydatków stałych:', error);
            return [];
        }
    },
    
    async getActiveRecurring(czestotliwosc = null) {
        const all = await this.getRecurringExpenses();
        return all.filter(r => {
            if (!r.aktywny) return false;
            if (czestotliwosc && r.czestotliwosc !== czestotliwosc) return false;
            return true;
        });
    },
    
    async addRecurringExpense(recurring) {
        const id = 'rec-' + Date.now();
        
        const row = [
            id,
            recurring.kategoria,
            recurring.podkategoria || '',
            recurring.nazwa,
            recurring.kwotaTypowa.toString(),
            recurring.waluta || 'PLN',
            recurring.czestotliwosc || 'monthly',
            (recurring.miesiacPlatnosci || 0).toString(),
            recurring.aktywny !== false ? 'TRUE' : 'FALSE',
            recurring.notatka || ''
        ];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.RECURRING}!A:J`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });
        
        return { ...recurring, id };
    },
    
    async updateRecurringExpense(id, updates) {
        const items = await this.getRecurringExpenses();
        const item = items.find(r => r.id === id);
        if (!item) return false;
        
        const row = [
            id,
            updates.kategoria || item.kategoria,
            updates.podkategoria !== undefined ? updates.podkategoria : item.podkategoria,
            updates.nazwa || item.nazwa,
            (updates.kwotaTypowa || item.kwotaTypowa).toString(),
            updates.waluta || item.waluta,
            updates.czestotliwosc || item.czestotliwosc,
            (updates.miesiacPlatnosci !== undefined ? updates.miesiacPlatnosci : item.miesiacPlatnosci).toString(),
            (updates.aktywny !== undefined ? updates.aktywny : item.aktywny) ? 'TRUE' : 'FALSE',
            updates.notatka !== undefined ? updates.notatka : item.notatka
        ];
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.RECURRING}!A${item.rowIndex}:J${item.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });
        
        return true;
    },
    
    async deleteRecurringExpense(id) {
        const items = await this.getRecurringExpenses();
        const item = items.find(r => r.id === id);
        if (!item) return false;
        
        const sheetId = await this.getSheetId(this.SHEETS.RECURRING);
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: item.rowIndex - 1,
                            endIndex: item.rowIndex
                        }
                    }
                }]
            }
        });
        
        return true;
    },
    
    // ═══════════════════════════════════════════════════════════
    // PLANY BUDŻETOWE
    // ═══════════════════════════════════════════════════════════
    
    async getPlans() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PLANS}!A2:G`
            });
            
            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                id: row[0] || '',
                rok: parseInt(row[1]) || 0,
                miesiac: parseInt(row[2]) || 0, // 0 = cały rok
                kategoria: row[3] || '',
                limit: parseFloat(row[4]) || 0,
                priorytet: row[5] || 'should', // must / should / nice
                notatka: row[6] || '',
                rowIndex: index + 2
            })).filter(p => p.id);
        } catch (error) {
            console.warn('Nie można pobrać planów:', error);
            return [];
        }
    },
    
    async getPlansByMonth(rok, miesiac) {
        const all = await this.getPlans();
        return all.filter(p => p.rok === rok && (p.miesiac === miesiac || p.miesiac === 0));
    },
    
    async addPlan(plan) {
        const id = 'plan-' + Date.now();
        
        const row = [
            id,
            plan.rok.toString(),
            (plan.miesiac || 0).toString(),
            plan.kategoria,
            plan.limit.toString(),
            plan.priorytet || 'should',
            plan.notatka || ''
        ];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PLANS}!A:G`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });
        
        return { ...plan, id };
    },
    
    async deletePlan(id) {
        const plans = await this.getPlans();
        const plan = plans.find(p => p.id === id);
        if (!plan) return false;
        
        const sheetId = await this.getSheetId(this.SHEETS.PLANS);
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: plan.rowIndex - 1,
                            endIndex: plan.rowIndex
                        }
                    }
                }]
            }
        });
        
        return true;
    },
    
    // ═══════════════════════════════════════════════════════════
    // USTAWIENIA
    // ═══════════════════════════════════════════════════════════
    
    async getSettings() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.SETTINGS}!A2:B`
            });
            
            const rows = response.result.values || [];
            const settings = {};
            rows.forEach(row => {
                if (row[0]) {
                    settings[row[0]] = row[1] || '';
                }
            });
            return settings;
        } catch (error) {
            console.warn('Nie można pobrać ustawień budżetu:', error);
            return {};
        }
    },
    
    async getSetting(key) {
        const settings = await this.getSettings();
        return settings[key] || null;
    },
    
    async setSetting(key, value) {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.SETTINGS}!A:B`
            });
            
            const rows = response.result.values || [];
            const rowIndex = rows.findIndex(row => row[0] === key);
            
            if (rowIndex >= 0) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: `${this.SHEETS.SETTINGS}!B${rowIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[value]] }
                });
            } else {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: `${this.SHEETS.SETTINGS}!A:B`,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    resource: { values: [[key, value]] }
                });
            }
            
            return true;
        } catch (error) {
            console.error('Błąd zapisu ustawienia:', error);
            return false;
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════
    
    async getSheetId(sheetName) {
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID
        });
        
        const sheet = response.result.sheets.find(s => 
            s.properties.title === sheetName
        );
        
        if (!sheet) throw new Error(`Nie znaleziono zakładki: ${sheetName}`);
        return sheet.properties.sheetId;
    },
    
    // Inicjalizacja - sprawdza czy zakładki istnieją
    async ensureSheetsExist() {
        const requiredSheets = Object.values(this.SHEETS);
        
        try {
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID
            });
            
            const existingSheets = response.result.sheets.map(s => s.properties.title);
            const missingSheets = requiredSheets.filter(s => !existingSheets.includes(s));
            
            if (missingSheets.length > 0) {
                const requests = missingSheets.map(title => ({
                    addSheet: { properties: { title } }
                }));
                
                await gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    resource: { requests }
                });
                
                await this.addHeaders(missingSheets);
            }
            
            return true;
        } catch (error) {
            console.error('Błąd inicjalizacji zakładek budżetu:', error);
            return false;
        }
    },
    
    async addHeaders(sheetNames) {
        const headers = {
            [this.SHEETS.EXPENSES]: ['ID', 'Rok', 'Miesiac', 'Kategoria', 'Podkategoria', 'Kwota', 'Waluta', 'Kwota_PLN', 'Jest_Staly', 'Jest_Transfer', 'Notatka'],
            [this.SHEETS.INCOME]: ['ID', 'Rok', 'Miesiac', 'Zrodlo', 'Pracodawca', 'Kwota_Brutto', 'Kwota_Netto', 'Waluta', 'Kwota_PLN', 'Notatka'],
            [this.SHEETS.RECURRING]: ['ID', 'Kategoria', 'Podkategoria', 'Nazwa', 'Kwota_Typowa', 'Waluta', 'Czestotliwosc', 'Miesiac_Platnosci', 'Aktywny', 'Notatka'],
            [this.SHEETS.PLANS]: ['ID', 'Rok', 'Miesiac', 'Kategoria', 'Limit', 'Priorytet', 'Notatka'],
            [this.SHEETS.SETTINGS]: ['Klucz', 'Wartosc']
        };
        
        for (const sheetName of sheetNames) {
            if (headers[sheetName]) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: `${sheetName}!A1:${String.fromCharCode(64 + headers[sheetName].length)}1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [headers[sheetName]] }
                });
            }
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // AGREGACJE I STATYSTYKI
    // ═══════════════════════════════════════════════════════════
    
    async getMonthlyTotals(rok, miesiac) {
        const [expenses, income] = await Promise.all([
            this.getExpensesByMonth(rok, miesiac),
            this.getIncomeByMonth(rok, miesiac)
        ]);
        
        // Wydatki per kategoria
        const expensesByCategory = {};
        let totalExpenses = 0;
        let totalFixed = 0;
        let totalVariable = 0;
        let totalTransfers = 0;
        
        expenses.forEach(e => {
            if (!expensesByCategory[e.kategoria]) {
                expensesByCategory[e.kategoria] = { total: 0, items: [] };
            }
            expensesByCategory[e.kategoria].total += e.kwotaPLN;
            expensesByCategory[e.kategoria].items.push(e);
            
            if (e.jestTransfer) {
                totalTransfers += e.kwotaPLN;
            } else {
                totalExpenses += e.kwotaPLN;
                if (e.jestStaly) {
                    totalFixed += e.kwotaPLN;
                } else {
                    totalVariable += e.kwotaPLN;
                }
            }
        });
        
        // Dochody per źródło
        const incomeBySource = {};
        let totalIncome = 0;
        
        income.forEach(i => {
            if (!incomeBySource[i.zrodlo]) {
                incomeBySource[i.zrodlo] = { total: 0, items: [] };
            }
            incomeBySource[i.zrodlo].total += i.kwotaPLN;
            incomeBySource[i.zrodlo].items.push(i);
            totalIncome += i.kwotaPLN;
        });
        
        return {
            rok,
            miesiac,
            income: {
                total: totalIncome,
                bySource: incomeBySource,
                items: income
            },
            expenses: {
                total: totalExpenses,
                fixed: totalFixed,
                variable: totalVariable,
                transfers: totalTransfers,
                byCategory: expensesByCategory,
                items: expenses
            },
            balance: totalIncome - totalExpenses,
            netBalance: totalIncome - totalExpenses - totalTransfers,
            savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0
        };
    },
    
    async getAvailableMonths() {
        const [expenses, income] = await Promise.all([
            this.getExpenses(),
            this.getIncome()
        ]);
        
        const months = new Map();
        
        [...expenses, ...income].forEach(item => {
            const key = `${item.rok}-${String(item.miesiac).padStart(2, '0')}`;
            if (!months.has(key)) {
                months.set(key, { rok: item.rok, miesiac: item.miesiac });
            }
        });
        
        return Array.from(months.values())
            .sort((a, b) => {
                if (a.rok !== b.rok) return b.rok - a.rok;
                return b.miesiac - a.miesiac;
            });
    },
    
    async getDataCompleteness() {
        const [expenses, income] = await Promise.all([
            this.getExpenses(),
            this.getIncome()
        ]);
        
        const expenseMonths = new Set(expenses.map(e => `${e.rok}-${e.miesiac}`));
        const incomeMonths = new Set(income.map(i => `${i.rok}-${i.miesiac}`));
        
        const allMonths = new Set([...expenseMonths, ...incomeMonths]);
        const result = [];
        
        allMonths.forEach(m => {
            const [rok, miesiac] = m.split('-').map(Number);
            const hasExpenses = expenseMonths.has(m);
            const hasIncome = incomeMonths.has(m);
            
            result.push({
                rok,
                miesiac,
                hasExpenses,
                hasIncome,
                isComplete: hasExpenses && hasIncome,
                status: hasExpenses && hasIncome ? 'complete' : 
                        hasExpenses || hasIncome ? 'partial' : 'empty'
            });
        });
        
        return result.sort((a, b) => {
            if (a.rok !== b.rok) return b.rok - a.rok;
            return b.miesiac - a.miesiac;
        });
    }
};
