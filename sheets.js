/**
 * Assetly - Google Sheets API Wrapper
 */

class SheetsAPI {
    constructor(spreadsheetId) {
        this.spreadsheetId = spreadsheetId;
        this.sheetName = CONFIG.SHEET_NAME;
    }
    
    async testConnection() {
        try {
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            
            const sheets = response.result.sheets || [];
            const hasAktywa = sheets.some(sheet => 
                sheet.properties.title === this.sheetName
            );
            
            if (!hasAktywa) {
                throw new Error(`Brak zakładki "${this.sheetName}" w arkuszu`);
            }
            
            return true;
        } catch (error) {
            throw error;
        }
    }
    
    async getAllAssets() {
        try {
            await ensureValidToken();
            
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A2:I`,
            });
            
            const rows = response.result.values || [];
            
            return rows.map((row, index) => ({
                rowIndex: index + 2,
                timestamp: row[0] || '',
                id: row[1] || '',
                kategoria: row[2] || '',
                podkategoria: row[3] || '',
                nazwa: row[4] || '',
                wartosc: parseFloat(row[5]) || 0,
                waluta: row[6] || 'PLN',
                notatki: row[7] || '',
                kontoEmerytalne: row[8] || ''
            })).filter(asset => asset.id);
            
        } catch (error) {
            throw error;
        }
    }
    
    async addAsset(asset) {
        try {
            await ensureValidToken();
            
            // Sprawdź czy istnieje już takie samo aktywo
            const existingAssets = await this.getAllAssets();
            const duplicate = existingAssets.find(a => 
                a.kategoria === asset.kategoria &&
                a.nazwa === asset.nazwa &&
                a.waluta === asset.waluta &&
                (a.kontoEmerytalne || '') === (asset.kontoEmerytalne || '')
            );
            
            if (duplicate) {
                // Aktualizuj istniejące - zsumuj wartość
                const newValue = duplicate.wartosc + asset.wartosc;
                const newNotatki = this.mergeNotes(duplicate.notatki, asset.notatki, asset.wartosc);
                
                await this.updateAsset(duplicate.id, {
                    ...duplicate,
                    wartosc: newValue,
                    notatki: newNotatki
                });
                
                return { 
                    ...duplicate, 
                    wartosc: newValue, 
                    notatki: newNotatki,
                    wasUpdated: true 
                };
            }
            
            // Nowe aktywo - dodaj normalnie
            const id = this.generateUUID();
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            
            const row = [
                timestamp,
                id,
                asset.kategoria,
                asset.podkategoria,
                asset.nazwa,
                asset.wartosc.toString(),
                asset.waluta,
                asset.notatki || '',
                asset.kontoEmerytalne || ''
            ];
            
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:I`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: [row] }
            });
            
            return { id, timestamp, ...asset, wasUpdated: false };
            
        } catch (error) {
            throw error;
        }
    }
    
    // Helper: łączy notatki przy aktualizacji duplikatu
    mergeNotes(existingNotes, newNotes, addedValue) {
        const dateStr = new Date().toLocaleDateString('pl-PL');
        const valueNote = `+${addedValue.toFixed(2)} PLN (${dateStr})`;
        
        // Jeśli nowa notatka ma treść, użyj jej
        if (newNotes && newNotes.trim()) {
            if (existingNotes) {
                return `${existingNotes}; ${newNotes}`;
            }
            return newNotes;
        }
        
        // W przeciwnym razie dodaj informację o zwiększeniu wartości
        if (existingNotes) {
            // Sprawdź czy notatka już zawiera historię zakupów
            if (existingNotes.includes('+') && existingNotes.includes('PLN')) {
                return `${existingNotes}, ${valueNote}`;
            }
            return `${existingNotes}; Dokupiono: ${valueNote}`;
        }
        
        return `Dokupiono: ${valueNote}`;
    }
    
    async updateAsset(id, updates) {
        try {
            await ensureValidToken();
            
            const assets = await this.getAllAssets();
            const asset = assets.find(a => a.id === id);
            
            if (!asset) throw new Error('Nie znaleziono aktywa');
            
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const row = [
                timestamp,
                id,
                updates.kategoria || asset.kategoria,
                updates.podkategoria || asset.podkategoria,
                updates.nazwa || asset.nazwa,
                (updates.wartosc !== undefined ? updates.wartosc : asset.wartosc).toString(),
                updates.waluta || asset.waluta,
                updates.notatki !== undefined ? updates.notatki : asset.notatki,
                updates.kontoEmerytalne !== undefined ? updates.kontoEmerytalne : (asset.kontoEmerytalne || '')
            ];
            
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A${asset.rowIndex}:I${asset.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [row] }
            });
            
            return true;
            
        } catch (error) {
            throw error;
        }
    }
    
    async deleteAsset(id) {
        try {
            await ensureValidToken();
            
            const assets = await this.getAllAssets();
            const asset = assets.find(a => a.id === id);
            
            if (!asset) throw new Error('Nie znaleziono aktywa');
            
            const spreadsheet = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            
            const sheet = spreadsheet.result.sheets.find(s => 
                s.properties.title === this.sheetName
            );
            
            if (!sheet) throw new Error('Nie znaleziono zakładki');
            
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheet.properties.sheetId,
                                dimension: 'ROWS',
                                startIndex: asset.rowIndex - 1,
                                endIndex: asset.rowIndex
                            }
                        }
                    }]
                }
            });
            
            return true;
            
        } catch (error) {
            throw error;
        }
    }
    
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

function createSheetsAPI(spreadsheetId) {
    return new SheetsAPI(spreadsheetId);
}
