/**
 * Assetly - Budget Sheets API
 * Operacje CRUD dla modułu Budżet
 */

const BudgetSheets = {
    
    // Nazwy zakładek
    SHEETS: {
        WYDATKI: 'Budzet_Wydatki',
        DOCHODY: 'Budzet_Dochody',
        PLANY: 'Budzet_Plany',
        STALE: 'Budzet_Stale',
        USTAWIENIA: 'Budzet_Ustawienia'
    },
    
    // ═══════════════════════════════════════════════════════════
    // WYDATKI
    // ═══════════════════════════════════════════════════════════
    
    async getWydatki() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.WYDATKI}!A2:L`
            });
            
            const rows = response.result.values || [];
            return rows.map(row => ({
                id: row[0] || '',
                rok: parseInt(row[1]) || new Date().getFullYear(),
                miesiac: parseInt(row[2]) || 1,
                kategoria: row[3] || '',
                podkategoria: row[4] || '',
                kwota: parseFloat(row[5]) || 0,
                waluta: row[6] || 'PLN',
                kwotaPLN: parseFloat(row[7]) || 0,
                jestStaly: row[8] === 'TRUE',
                jestTransfer: row[9] === 'TRUE',
                notatka: row[10] || '',
                dataDodania: row[11] || ''
            })).filter(w => w.id);
        } catch (error) {
            console.warn('Nie można pobrać wydatków:', error);
            return [];
        }
    },
    
    async getWydatkiZaMiesiac(rok, miesiac) {
        const wszystkie = await this.getWydatki();
        return wszystkie.filter(w => w.rok === rok && w.miesiac === miesiac);
    },
    
    async getWydatkiZaOkres(rokOd, miesiacOd, rokDo, miesiacDo) {
        const wszystkie = await this.getWydatki();
        return wszystkie.filter(w => {
            const wDate = w.rok * 12 + w.miesiac;
            const fromDate = rokOd * 12 + miesiacOd;
            const toDate = rokDo * 12 + miesiacDo;
            return wDate >= fromDate && wDate <= toDate;
        });
    },
    
    async addWydatek(wydatek) {
        const id = 'exp-' + Date.now();
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const kwotaPLN = wydatek.waluta === 'PLN' ? wydatek.kwota : 
            wydatek.kwota * (currencyRates[wydatek.waluta] || 1);
        
        // Sprawdź czy kategoria jest transferem
        const kategoriaInfo = KATEGORIE_WYDATKOW[wydatek.kategoria];
        const jestTransfer = kategoriaInfo?.isTransfer || 
            wydatek.podkategoria === 'Przelew na rach. firmowy';
        
        const row = [
            id,
            wydatek.rok.toString(),
            wydatek.miesiac.toString(),
            wydatek.kategoria,
            wydatek.podkategoria || '',
            wydatek.kwota.toString(),
            wydatek.waluta || 'PLN',
            kwotaPLN.toString(),
            wydatek.jestStaly ? 'TRUE' : 'FALSE',
            jestTransfer ? 'TRUE' : 'FALSE',
            wydatek.notatka || '',
            timestamp
        ];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.WYDATKI}!A:L`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });
        
        return { id, ...wydatek, kwotaPLN, jestTransfer, dataDodania: timestamp };
    },
    
    async addWydatkiBulk(wydatki) {
        if (wydatki.length === 0) return [];
        
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const results = [];
        
        const rows = wydatki.map(wydatek => {
            const id = 'exp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
            const kwotaPLN = wydatek.waluta === 'PLN' ? wydatek.kwota : 
                wydatek.kwota * (currencyRates[wydatek.waluta] || 1);
            
            const kategoriaInfo = KATEGORIE_WYDATKOW[wydatek.kategoria];
            const jestTransfer = kategoriaInfo?.isTransfer || 
                wydatek.podkategoria === 'Przelew na rach. firmowy';
            
            results.push({ id, ...wydatek, kwotaPLN, jestTransfer, dataDodania: timestamp });
            
            return [
                id,
                wydatek.rok.toString(),
                wydatek.miesiac.toString(),
                wydatek.kategoria,
                wydatek.podkategoria || '',
                wydatek.kwota.toString(),
                wydatek.waluta || 'PLN',
                kwotaPLN.toString(),
                wydatek.jestStaly ? 'TRUE' : 'FALSE',
                jestTransfer ? 'TRUE' : 'FALSE',
                wydatek.notatka || '',
                timestamp
            ];
        });
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.WYDATKI}!A:L`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: rows }
        });
        
        return results;
    },
    
    async updateWydatek(id, updates) {
        const wydatki = await this.getWydatki();
        const index = wydatki.findIndex(w => w.id === id);
        if (index === -1) throw new Error('Nie znaleziono wydatku');
        
        const wydatek = wydatki[index];
        const kwotaPLN = (updates.waluta || wydatek.waluta) === 'PLN' ? 
            (updates.kwota || wydatek.kwota) : 
            (updates.kwota || wydatek.kwota) * (currencyRates[updates.waluta || wydatek.waluta] || 1);
        
        const row = [
            id,
            (updates.rok || wydatek.rok).toString(),
            (updates.miesiac || wydatek.miesiac).toString(),
            updates.kategoria || wydatek.kategoria,
            updates.podkategoria !== undefined ? updates.podkategoria : wydatek.podkategoria,
            (updates.kwota || wydatek.kwota).toString(),
            updates.waluta || wydatek.waluta,
            kwotaPLN.toString(),
            (updates.jestStaly !== undefined ? updates.jestStaly : wydatek.jestStaly) ? 'TRUE' : 'FALSE',
            wydatek.jestTransfer ? 'TRUE' : 'FALSE',
            updates.notatka !== undefined ? updates.notatka : wydatek.notatka,
            wydatek.dataDodania
        ];
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.WYDATKI}!A${index + 2}:L${index + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });
        
        return true;
    },
    
    async deleteWydatek(id) {
        const wydatki = await this.getWydatki();
        const index = wydatki.findIndex(w => w.id === id);
        if (index === -1) return false;
        
        const sheetId = await this.getSheetId(this.SHEETS.WYDATKI);
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
    
    async deleteWydatkiZaMiesiac(rok, miesiac) {
        const wydatki = await this.getWydatki();
        const toDelete = wydatki.filter(w => w.rok === rok && w.miesiac === miesiac);
        
        for (const w of toDelete.reverse()) {
            await this.deleteWydatek(w.id);
        }
        
        return toDelete.length;
    },
    
    // ═══════════════════════════════════════════════════════════
    // DOCHODY
    // ═══════════════════════════════════════════════════════════
    
    async getDochody() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.DOCHODY}!A2:K`
            });
            
            const rows = response.result.values || [];
            return rows.map(row => ({
                id: row[0] || '',
                rok: parseInt(row[1]) || new Date().getFullYear(),
                miesiac: parseInt(row[2]) || 1,
                zrodlo: row[3] || '',
                podzrodlo: row[4] || '',
                pracodawca: row[5] || '',
                kwotaBrutto: parseFloat(row[6]) || 0,
                kwotaNetto: parseFloat(row[7]) || 0,
                waluta: row[8] || 'PLN',
                kwotaPLN: parseFloat(row[9]) || 0,
                notatka: row[10] || ''
            })).filter(d => d.id);
        } catch (error) {
            console.warn('Nie można pobrać dochodów:', error);
            return [];
        }
    },
    
    async getDochodyZaMiesiac(rok, miesiac) {
        const wszystkie = await this.getDochody();
        return wszystkie.filter(d => d.rok === rok && d.miesiac === miesiac);
    },
    
    async getDochodyZaOkres(rokOd, miesiacOd, rokDo, miesiacDo) {
        const wszystkie = await this.getDochody();
        return wszystkie.filter(d => {
            const dDate = d.rok * 12 + d.miesiac;
            const fromDate = rokOd * 12 + miesiacOd;
            const toDate = rokDo * 12 + miesiacDo;
            return dDate >= fromDate && dDate <= toDate;
        });
    },
    
    async addDochod(dochod) {
        const id = 'inc-' + Date.now();
        const kwotaPLN = dochod.waluta === 'PLN' ? dochod.kwotaNetto : 
            dochod.kwotaNetto * (currencyRates[dochod.waluta] || 1);
        
        const row = [
            id,
            dochod.rok.toString(),
            dochod.miesiac.toString(),
            dochod.zrodlo,
            dochod.podzrodlo || '',
            dochod.pracodawca || '',
            (dochod.kwotaBrutto || 0).toString(),
            dochod.kwotaNetto.toString(),
            dochod.waluta || 'PLN',
            kwotaPLN.toString(),
            dochod.notatka || ''
        ];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.DOCHODY}!A:K`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });
        
        return { id, ...dochod, kwotaPLN };
    },
    
    async addDochodyBulk(dochody) {
        if (dochody.length === 0) return [];
        
        const results = [];
        const rows = dochody.map(dochod => {
            const id = 'inc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
            const kwotaPLN = dochod.waluta === 'PLN' ? dochod.kwotaNetto : 
                dochod.kwotaNetto * (currencyRates[dochod.waluta] || 1);
            
            results.push({ id, ...dochod, kwotaPLN });
            
            return [
                id,
                dochod.rok.toString(),
                dochod.miesiac.toString(),
                dochod.zrodlo,
                dochod.podzrodlo || '',
                dochod.pracodawca || '',
                (dochod.kwotaBrutto || 0).toString(),
                dochod.kwotaNetto.toString(),
                dochod.waluta || 'PLN',
                kwotaPLN.toString(),
                dochod.notatka || ''
            ];
        });
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.DOCHODY}!A:K`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: rows }
        });
        
        return results;
    },
    
    async updateDochod(id, updates) {
        const dochody = await this.getDochody();
        const index = dochody.findIndex(d => d.id === id);
        if (index === -1) throw new Error('Nie znaleziono dochodu');
        
        const dochod = dochody[index];
        const kwotaPLN = (updates.waluta || dochod.waluta) === 'PLN' ? 
            (updates.kwotaNetto || dochod.kwotaNetto) : 
            (updates.kwotaNetto || dochod.kwotaNetto) * (currencyRates[updates.waluta || dochod.waluta] || 1);
        
        const row = [
            id,
            (updates.rok || dochod.rok).toString(),
            (updates.miesiac || dochod.miesiac).toString(),
            updates.zrodlo || dochod.zrodlo,
            updates.podzrodlo !== undefined ? updates.podzrodlo : dochod.podzrodlo,
            updates.pracodawca !== undefined ? updates.pracodawca : dochod.pracodawca,
            (updates.kwotaBrutto !== undefined ? updates.kwotaBrutto : dochod.kwotaBrutto).toString(),
            (updates.kwotaNetto || dochod.kwotaNetto).toString(),
            updates.waluta || dochod.waluta,
            kwotaPLN.toString(),
            updates.notatka !== undefined ? updates.notatka : dochod.notatka
        ];
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.DOCHODY}!A${index + 2}:K${index + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });
        
        return true;
    },
    
    async deleteDochod(id) {
        const dochody = await this.getDochody();
        const index = dochody.findIndex(d => d.id === id);
        if (index === -1) return false;
        
        const sheetId = await this.getSheetId(this.SHEETS.DOCHODY);
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
    // WYDATKI STAŁE (szablony)
    // ═══════════════════════════════════════════════════════════
    
    async getWydatkiStale() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.STALE}!A2:I`
            });
            
            const rows = response.result.values || [];
            return rows.map(row => ({
                id: row[0] || '',
                kategoria: row[1] || '',
                podkategoria: row[2] || '',
                nazwa: row[3] || '',
                kwotaTypowa: parseFloat(row[4]) || 0,
                waluta: row[5] || 'PLN',
                czestotliwosc: row[6] || 'monthly',
                miesiacPlatnosci: parseInt(row[7]) || 0, // dla rocznych
                aktywny: row[8] !== 'FALSE'
            })).filter(s => s.id);
        } catch (error) {
            console.warn('Nie można pobrać wydatków stałych:', error);
            return [];
        }
    },
    
    async addWydatekStaly(staly) {
        const id = 'rec-' + Date.now();
        
        const row = [
            id,
            staly.kategoria,
            staly.podkategoria || '',
            staly.nazwa,
            staly.kwotaTypowa.toString(),
            staly.waluta || 'PLN',
            staly.czestotliwosc || 'monthly',
            (staly.miesiacPlatnosci || 0).toString(),
            'TRUE'
        ];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.STALE}!A:I`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });
        
        return { id, ...staly, aktywny: true };
    },
    
    async updateWydatekStaly(id, updates) {
        const stale = await this.getWydatkiStale();
        const index = stale.findIndex(s => s.id === id);
        if (index === -1) throw new Error('Nie znaleziono wydatku stałego');
        
        const staly = stale[index];
        const row = [
            id,
            updates.kategoria || staly.kategoria,
            updates.podkategoria !== undefined ? updates.podkategoria : staly.podkategoria,
            updates.nazwa || staly.nazwa,
            (updates.kwotaTypowa !== undefined ? updates.kwotaTypowa : staly.kwotaTypowa).toString(),
            updates.waluta || staly.waluta,
            updates.czestotliwosc || staly.czestotliwosc,
            (updates.miesiacPlatnosci !== undefined ? updates.miesiacPlatnosci : staly.miesiacPlatnosci).toString(),
            (updates.aktywny !== undefined ? updates.aktywny : staly.aktywny) ? 'TRUE' : 'FALSE'
        ];
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.STALE}!A${index + 2}:I${index + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });
        
        return true;
    },
    
    async deleteWydatekStaly(id) {
        const stale = await this.getWydatkiStale();
        const index = stale.findIndex(s => s.id === id);
        if (index === -1) return false;
        
        const sheetId = await this.getSheetId(this.SHEETS.STALE);
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
    // PLANY BUDŻETOWE
    // ═══════════════════════════════════════════════════════════
    
    async getPlany() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PLANY}!A2:G`
            });
            
            const rows = response.result.values || [];
            return rows.map(row => ({
                id: row[0] || '',
                rok: parseInt(row[1]) || new Date().getFullYear(),
                miesiac: parseInt(row[2]) || 0, // 0 = cały rok
                kategoria: row[3] || '',
                limit: parseFloat(row[4]) || 0,
                priorytet: row[5] || 'should',
                notatka: row[6] || ''
            })).filter(p => p.id);
        } catch (error) {
            console.warn('Nie można pobrać planów:', error);
            return [];
        }
    },
    
    async getPlanNaMiesiac(rok, miesiac) {
        const plany = await this.getPlany();
        return plany.filter(p => p.rok === rok && (p.miesiac === miesiac || p.miesiac === 0));
    },
    
    async savePlan(plan) {
        const id = 'plan-' + Date.now();
        
        const row = [
            id,
            plan.rok.toString(),
            plan.miesiac.toString(),
            plan.kategoria,
            plan.limit.toString(),
            plan.priorytet || 'should',
            plan.notatka || ''
        ];
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PLANY}!A:G`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });
        
        return { id, ...plan };
    },
    
    async deletePlan(id) {
        const plany = await this.getPlany();
        const index = plany.findIndex(p => p.id === id);
        if (index === -1) return false;
        
        const sheetId = await this.getSheetId(this.SHEETS.PLANY);
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
    // USTAWIENIA BUDŻETU
    // ═══════════════════════════════════════════════════════════
    
    async getUstawienia() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.USTAWIENIA}!A2:B`
            });
            
            const rows = response.result.values || [];
            const settings = {};
            rows.forEach(row => {
                if (row[0]) settings[row[0]] = row[1];
            });
            
            return {
                domyslnaWaluta: settings['Domyslna_Waluta'] || 'PLN',
                celOszczednosciProcent: parseFloat(settings['Cel_Oszczednosci_Procent']) || 20,
                buforAwaryjnyMiesiace: parseInt(settings['Bufor_Awaryjny_Miesiace']) || 6
            };
        } catch (error) {
            return {
                domyslnaWaluta: 'PLN',
                celOszczednosciProcent: 20,
                buforAwaryjnyMiesiace: 6
            };
        }
    },
    
    async saveUstawienie(klucz, wartosc) {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.USTAWIENIA}!A2:B`
            });
            
            const rows = response.result.values || [];
            const rowIndex = rows.findIndex(r => r[0] === klucz);
            
            if (rowIndex >= 0) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: `${this.SHEETS.USTAWIENIA}!B${rowIndex + 2}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[wartosc.toString()]] }
                });
            } else {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: `${this.SHEETS.USTAWIENIA}!A:B`,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    resource: { values: [[klucz, wartosc.toString()]] }
                });
            }
            
            return true;
        } catch (error) {
            console.error('Błąd zapisu ustawienia:', error);
            return false;
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // INTEGRACJA Z INWESTYCJAMI
    // ═══════════════════════════════════════════════════════════
    
    async getPlanInwestycyjny() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: 'Plan_Inwestycyjny!A2:E2'
            });
            
            const row = response.result.values?.[0];
            if (!row) return null;
            
            const wynagrodzenie = parseFloat(row[0]) || 0;
            const stopaProcentowa = parseFloat(row[1]) || 0;
            
            return {
                wynagrodzenie,
                stopaProcentowa,
                kwotaMiesieczna: wynagrodzenie * (stopaProcentowa / 100)
            };
        } catch (error) {
            return null;
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
            [this.SHEETS.WYDATKI]: ['ID', 'Rok', 'Miesiac', 'Kategoria', 'Podkategoria', 'Kwota', 'Waluta', 'Kwota_PLN', 'Jest_Staly', 'Jest_Transfer', 'Notatka', 'Data_Dodania'],
            [this.SHEETS.DOCHODY]: ['ID', 'Rok', 'Miesiac', 'Zrodlo', 'Podzrodlo', 'Pracodawca', 'Kwota_Brutto', 'Kwota_Netto', 'Waluta', 'Kwota_PLN', 'Notatka'],
            [this.SHEETS.PLANY]: ['ID', 'Rok', 'Miesiac', 'Kategoria', 'Limit', 'Priorytet', 'Notatka'],
            [this.SHEETS.STALE]: ['ID', 'Kategoria', 'Podkategoria', 'Nazwa', 'Kwota_Typowa', 'Waluta', 'Czestotliwosc', 'Miesiac_Platnosci', 'Aktywny'],
            [this.SHEETS.USTAWIENIA]: ['Klucz', 'Wartosc']
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
    // STATYSTYKI I AGREGACJE
    // ═══════════════════════════════════════════════════════════
    
    async getMiesiaceZDanymi() {
        const [wydatki, dochody] = await Promise.all([
            this.getWydatki(),
            this.getDochody()
        ]);
        
        const miesiace = new Set();
        
        wydatki.forEach(w => miesiace.add(`${w.rok}-${String(w.miesiac).padStart(2, '0')}`));
        dochody.forEach(d => miesiace.add(`${d.rok}-${String(d.miesiac).padStart(2, '0')}`));
        
        return Array.from(miesiace).sort().reverse();
    },
    
    async getPodsumowanieMiesiaca(rok, miesiac) {
        const [wydatki, dochody, planInwest] = await Promise.all([
            this.getWydatkiZaMiesiac(rok, miesiac),
            this.getDochodyZaMiesiac(rok, miesiac),
            this.getPlanInwestycyjny()
        ]);
        
        const sumaDochodow = dochody.reduce((sum, d) => sum + d.kwotaPLN, 0);
        const sumaWydatkow = wydatki.filter(w => !w.jestTransfer).reduce((sum, w) => sum + w.kwotaPLN, 0);
        const sumaTransferow = wydatki.filter(w => w.jestTransfer).reduce((sum, w) => sum + w.kwotaPLN, 0);
        const wydatkiStale = wydatki.filter(w => w.jestStaly && !w.jestTransfer).reduce((sum, w) => sum + w.kwotaPLN, 0);
        const wydatkiZmienne = sumaWydatkow - wydatkiStale;
        
        const bilans = sumaDochodow - sumaWydatkow;
        const bilansPoTransferach = bilans - sumaTransferow;
        const stopaOszczednosci = sumaDochodow > 0 ? (bilans / sumaDochodow) * 100 : 0;
        
        // Wydatki per kategoria
        const wydatkiPerKategoria = {};
        wydatki.filter(w => !w.jestTransfer).forEach(w => {
            if (!wydatkiPerKategoria[w.kategoria]) {
                wydatkiPerKategoria[w.kategoria] = 0;
            }
            wydatkiPerKategoria[w.kategoria] += w.kwotaPLN;
        });
        
        return {
            rok,
            miesiac,
            dochody: sumaDochodow,
            wydatki: sumaWydatkow,
            wydatkiStale,
            wydatkiZmienne,
            transfery: sumaTransferow,
            bilans,
            bilansPoTransferach,
            stopaOszczednosci,
            planInwestycji: planInwest?.kwotaMiesieczna || 0,
            wydatkiPerKategoria,
            liczbaWydatkow: wydatki.length,
            liczbaDochodo: dochody.length
        };
    },
    
    async getHistoriaPodsumowania(liczbaMiesiecy = 12) {
        const miesiace = await this.getMiesiaceZDanymi();
        const historia = [];
        
        for (const m of miesiace.slice(0, liczbaMiesiecy)) {
            const [rok, miesiac] = m.split('-').map(Number);
            const podsumowanie = await this.getPodsumowanieMiesiaca(rok, miesiac);
            historia.push(podsumowanie);
        }
        
        return historia;
    }
};
