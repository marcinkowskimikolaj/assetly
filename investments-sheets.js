/**
 * Assetly - Investments Sheets API
 * Operacje CRUD dla modułu inwestycji
 */

const InvestmentsSheets = {
    
    // Nazwy zakładek
    SHEETS: {
        PORTFOLIOS: 'Portfele',
        PORTFOLIO_ASSETS: 'Portfel_Aktywa',
        PLAN: 'Plan_Inwestycyjny',
        PLAN_INSTRUMENTS: 'Plan_Instrumenty',
        HISTORY: 'Historia_Wplat'
    },
    
    // ═══════════════════════════════════════════════════════════
    // PORTFELE
    // ═══════════════════════════════════════════════════════════
    
    async getPortfolios() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PORTFOLIOS}!A2:F`
            });
            
            const rows = response.result.values || [];
            return rows.map(row => ({
                id: row[0] || '',
                nazwa: row[1] || '',
                broker: row[2] || '',
                kontoEmerytalne: row[3] || '',
                opis: row[4] || '',
                utworzony: row[5] || ''
            })).filter(p => p.id);
        } catch (error) {
            console.warn('Nie można pobrać portfeli:', error);
            return [];
        }
    },
    
    async addPortfolio(portfolio) {
        const id = 'port-' + this.generateId();
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        
        const row = [
            id,
            portfolio.nazwa,
            portfolio.broker || '',
            portfolio.kontoEmerytalne || '',
            portfolio.opis || '',
            timestamp
        ];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PORTFOLIOS}!A:F`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });
        
        return { id, ...portfolio, utworzony: timestamp };
    },
    
    async updatePortfolio(id, updates) {
        const portfolios = await this.getPortfolios();
        const index = portfolios.findIndex(p => p.id === id);
        if (index === -1) throw new Error('Nie znaleziono portfela');
        
        const portfolio = portfolios[index];
        const row = [
            id,
            updates.nazwa || portfolio.nazwa,
            updates.broker || portfolio.broker,
            updates.kontoEmerytalne || portfolio.kontoEmerytalne,
            updates.opis !== undefined ? updates.opis : portfolio.opis,
            portfolio.utworzony
        ];
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PORTFOLIOS}!A${index + 2}:F${index + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });
        
        return true;
    },
    
    async deletePortfolio(id) {
        const portfolios = await this.getPortfolios();
        const index = portfolios.findIndex(p => p.id === id);
        if (index === -1) throw new Error('Nie znaleziono portfela');
        
        // Usuń powiązania z aktywami
        await this.removeAllAssetsFromPortfolio(id);
        
        // Usuń portfel
        const sheetId = await this.getSheetId(this.SHEETS.PORTFOLIOS);
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: index + 1,
                            endIndex: index + 2
                        }
                    }
                }]
            }
        });
        
        return true;
    },
    
    // ═══════════════════════════════════════════════════════════
    // PORTFEL - AKTYWA (relacje)
    // ═══════════════════════════════════════════════════════════
    
    async getPortfolioAssets(portfolioId) {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PORTFOLIO_ASSETS}!A2:B`
            });
            
            const rows = response.result.values || [];
            return rows
                .filter(row => row[0] === portfolioId)
                .map(row => row[1]);
        } catch (error) {
            console.warn('Nie można pobrać aktywów portfela:', error);
            return [];
        }
    },
    
    async getAllPortfolioAssignments() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PORTFOLIO_ASSETS}!A2:B`
            });
            
            const rows = response.result.values || [];
            return rows.map(row => ({
                portfolioId: row[0],
                assetId: row[1]
            }));
        } catch (error) {
            return [];
        }
    },
    
    async assignAssetToPortfolio(portfolioId, assetId) {
        // Sprawdź czy już nie jest przypisane
        const existing = await this.getAllPortfolioAssignments();
        if (existing.some(a => a.portfolioId === portfolioId && a.assetId === assetId)) {
            return true; // Już przypisane
        }
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PORTFOLIO_ASSETS}!A:B`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [[portfolioId, assetId]] }
        });
        
        return true;
    },
    
    async removeAssetFromPortfolio(portfolioId, assetId) {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PORTFOLIO_ASSETS}!A2:B`
        });
        
        const rows = response.result.values || [];
        const index = rows.findIndex(row => row[0] === portfolioId && row[1] === assetId);
        
        if (index === -1) return true;
        
        const sheetId = await this.getSheetId(this.SHEETS.PORTFOLIO_ASSETS);
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: index + 1,
                            endIndex: index + 2
                        }
                    }
                }]
            }
        });
        
        return true;
    },
    
    async removeAllAssetsFromPortfolio(portfolioId) {
        const assignments = await this.getAllPortfolioAssignments();
        const toRemove = assignments.filter(a => a.portfolioId === portfolioId);
        
        for (const assignment of toRemove) {
            await this.removeAssetFromPortfolio(portfolioId, assignment.assetId);
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // PLAN INWESTYCYJNY
    // ═══════════════════════════════════════════════════════════
    
    async getPlan() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PLAN}!A2:E2`
            });
            
            const row = response.result.values?.[0];
            if (!row) return null;
            
            return {
                wynagrodzenie: parseFloat(row[0]) || 0,
                stopaProcentowa: parseFloat(row[1]) || 0,
                ikeProcentowy: parseFloat(row[2]) || 50,
                portfeleTozame: row[3] === 'TAK',
                zmodyfikowano: row[4] || ''
            };
        } catch (error) {
            console.warn('Nie można pobrać planu:', error);
            return null;
        }
    },
    
    async savePlan(plan) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        
        const row = [
            plan.wynagrodzenie.toString(),
            plan.stopaProcentowa.toString(),
            plan.ikeProcentowy.toString(),
            plan.portfeleTozame ? 'TAK' : 'NIE',
            timestamp
        ];
        
        // Sprawdź czy istnieje plan
        const existing = await this.getPlan();
        
        if (existing) {
            // Update
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PLAN}!A2:E2`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [row] }
            });
        } else {
            // Insert
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PLAN}!A:E`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: [row] }
            });
        }
        
        return { ...plan, zmodyfikowano: timestamp };
    },
    
    // ═══════════════════════════════════════════════════════════
    // INSTRUMENTY PLANU
    // ═══════════════════════════════════════════════════════════
    
    async getPlanInstruments() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PLAN_INSTRUMENTS}!A2:D`
            });
            
            const rows = response.result.values || [];
            return rows.map(row => ({
                ticker: row[0] || '',
                nazwa: row[1] || '',
                konto: row[2] || 'TOZAME',
                procentAlokacji: parseFloat(row[3]) || 0
            })).filter(i => i.ticker);
        } catch (error) {
            console.warn('Nie można pobrać instrumentów:', error);
            return [];
        }
    },
    
    async savePlanInstruments(instruments) {
        // Wyczyść istniejące instrumenty
        await this.clearPlanInstruments();
        
        if (instruments.length === 0) return;
        
        const rows = instruments.map(i => [
            i.ticker,
            i.nazwa,
            i.konto,
            i.procentAlokacji.toString()
        ]);
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PLAN_INSTRUMENTS}!A:D`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: rows }
        });
        
        return true;
    },
    
    async clearPlanInstruments() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PLAN_INSTRUMENTS}!A2:D`
            });
            
            const rows = response.result.values || [];
            if (rows.length === 0) return;
            
            const sheetId = await this.getSheetId(this.SHEETS.PLAN_INSTRUMENTS);
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: 1,
                                endIndex: rows.length + 1
                            }
                        }
                    }]
                }
            });
        } catch (error) {
            // Zakładka może nie istnieć
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // HISTORIA WPŁAT
    // ═══════════════════════════════════════════════════════════
    
    async getPaymentHistory() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.HISTORY}!A2:F`
            });
            
            const rows = response.result.values || [];
            return rows.map(row => ({
                id: row[0] || '',
                data: row[1] || '',
                kwotaCalkowita: parseFloat(row[2]) || 0,
                kwotaIke: parseFloat(row[3]) || 0,
                kwotaIkze: parseFloat(row[4]) || 0,
                szczegoly: row[5] ? JSON.parse(row[5]) : []
            })).filter(h => h.id).sort((a, b) => new Date(b.data) - new Date(a.data));
        } catch (error) {
            console.warn('Nie można pobrać historii:', error);
            return [];
        }
    },
    
    async addPaymentHistory(payment) {
        const id = 'wpl-' + this.generateId();
        const data = new Date().toISOString().substring(0, 10);
        
        const row = [
            id,
            data,
            payment.kwotaCalkowita.toString(),
            payment.kwotaIke.toString(),
            payment.kwotaIkze.toString(),
            JSON.stringify(payment.szczegoly)
        ];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.HISTORY}!A:F`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });
        
        return { id, data, ...payment };
    },
    
    // ═══════════════════════════════════════════════════════════
    // TWORZENIE AKTYWÓW Z KALKULATORA
    // ═══════════════════════════════════════════════════════════
    
    async createAssetsFromCalculation(items, sheetsAPI) {
        const results = {
            created: 0,
            updated: 0,
            assets: []
        };
        
        // Pobierz portfele IKE i IKZE
        const portfolios = await this.getPortfolios();
        const portfelIKE = portfolios.find(p => p.kontoEmerytalne === 'IKE');
        const portfelIKZE = portfolios.find(p => p.kontoEmerytalne === 'IKZE');
        
        if (!portfelIKE || !portfelIKZE) {
            throw new Error('Nie znaleziono portfeli IKE/IKZE. Utwórz portfele przed realizacją zakupów.');
        }
        
        for (const item of items) {
            const asset = {
                kategoria: 'Inwestycje',
                podkategoria: 'ETF',
                nazwa: `${item.ticker} - ${item.nazwa}`,
                wartosc: item.wartosc,
                waluta: 'PLN',
                notatki: '',
                kontoEmerytalne: item.konto === 'TOZAME' ? '' : item.konto
            };
            
            // addAsset automatycznie obsłuży duplikaty (zsumuje wartość)
            const result = await sheetsAPI.addAsset(asset);
            
            // Automatycznie przypisz do portfela IKE lub IKZE
            const konto = item.konto === 'TOZAME' ? '' : item.konto;
            if (konto === 'IKE') {
                await this.assignAssetToPortfolio(portfelIKE.id, result.id);
            } else if (konto === 'IKZE') {
                await this.assignAssetToPortfolio(portfelIKZE.id, result.id);
            }
            
            if (result.wasUpdated) {
                results.updated++;
            } else {
                results.created++;
            }
            results.assets.push(result);
        }
        
        return results;
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
    
    generateId() {
        return Math.random().toString(36).substring(2, 10);
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
                // Utwórz brakujące zakładki
                const requests = missingSheets.map(title => ({
                    addSheet: {
                        properties: { title }
                    }
                }));
                
                await gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    resource: { requests }
                });
                
                // Dodaj nagłówki
                await this.addHeaders(missingSheets);
            }
            
            return true;
        } catch (error) {
            console.error('Błąd inicjalizacji zakładek:', error);
            return false;
        }
    },
    
    async addHeaders(sheetNames) {
        const headers = {
            [this.SHEETS.PORTFOLIOS]: ['ID', 'Nazwa', 'Broker', 'Konto_Emerytalne', 'Opis', 'Utworzony'],
            [this.SHEETS.PORTFOLIO_ASSETS]: ['Portfel_ID', 'Aktywo_ID'],
            [this.SHEETS.PLAN]: ['Wynagrodzenie', 'Stopa_Procent', 'IKE_Procent', 'Portfele_Tozame', 'Zmodyfikowano'],
            [this.SHEETS.PLAN_INSTRUMENTS]: ['Ticker', 'Nazwa', 'Konto', 'Procent_Alokacji'],
            [this.SHEETS.HISTORY]: ['ID', 'Data', 'Kwota_Calkowita', 'Kwota_IKE', 'Kwota_IKZE', 'Szczegoly_JSON']
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
    }
};
