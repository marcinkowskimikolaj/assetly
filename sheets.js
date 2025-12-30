/**
 * Assetly - Wrapper dla Google Sheets API
 */

class SheetsAPI {
    constructor(spreadsheetId) {
        this.spreadsheetId = spreadsheetId;
        this.sheetName = CONFIG.SHEET_NAME;
    }
    
    /**
     * Testuje połączenie z arkuszem
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            // Pobierz metadane arkusza
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            
            // Sprawdź czy istnieje zakładka "Aktywa"
            const sheets = response.result.sheets || [];
            const hasAktywa = sheets.some(sheet => 
                sheet.properties.title === this.sheetName
            );
            
            if (!hasAktywa) {
                throw new Error(`Brak zakładki "${this.sheetName}" w arkuszu`);
            }
            
            return true;
        } catch (error) {
            console.error('Błąd połączenia z arkuszem:', error);
            throw error;
        }
    }
    
    /**
     * Pobiera wszystkie aktywa z arkusza
     * @returns {Promise<Array>}
     */
    async getAllAssets() {
        try {
            await ensureValidToken();
            
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A2:H`,
            });
            
            const rows = response.result.values || [];
            
            // Parsuj wiersze na obiekty
            return rows.map((row, index) => ({
                rowIndex: index + 2, // +2 bo zaczynamy od A2
                timestamp: row[0] || '',
                id: row[1] || '',
                kategoria: row[2] || '',
                podkategoria: row[3] || '',
                nazwa: row[4] || '',
                wartosc: parseFloat(row[5]) || 0,
                waluta: row[6] || 'PLN',
                notatki: row[7] || ''
            })).filter(asset => asset.id); // Filtruj puste wiersze
            
        } catch (error) {
            console.error('Błąd pobierania aktywów:', error);
            throw error;
        }
    }
    
    /**
     * Dodaje nowe aktywo do arkusza
     * @param {Object} asset - Dane aktywa
     * @returns {Promise<Object>}
     */
    async addAsset(asset) {
        try {
            await ensureValidToken();
            
            // Generuj UUID i timestamp
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
                asset.notatki || ''
            ];
            
            const response = await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:H`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [row]
                }
            });
            
            return {
                id,
                timestamp,
                ...asset
            };
            
        } catch (error) {
            console.error('Błąd dodawania aktywa:', error);
            throw error;
        }
    }
    
    /**
     * Aktualizuje istniejące aktywo
     * @param {string} id - ID aktywa
     * @param {Object} updates - Nowe wartości
     * @returns {Promise<boolean>}
     */
    async updateAsset(id, updates) {
        try {
            await ensureValidToken();
            
            // Najpierw znajdź wiersz z danym ID
            const assets = await this.getAllAssets();
            const asset = assets.find(a => a.id === id);
            
            if (!asset) {
                throw new Error('Nie znaleziono aktywa o podanym ID');
            }
            
            // Przygotuj zaktualizowany wiersz
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const row = [
                timestamp,
                id,
                updates.kategoria || asset.kategoria,
                updates.podkategoria || asset.podkategoria,
                updates.nazwa || asset.nazwa,
                (updates.wartosc !== undefined ? updates.wartosc : asset.wartosc).toString(),
                updates.waluta || asset.waluta,
                updates.notatki !== undefined ? updates.notatki : asset.notatki
            ];
            
            // Zaktualizuj wiersz
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A${asset.rowIndex}:H${asset.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [row]
                }
            });
            
            return true;
            
        } catch (error) {
            console.error('Błąd aktualizacji aktywa:', error);
            throw error;
        }
    }
    
    /**
     * Usuwa aktywo z arkusza
     * @param {string} id - ID aktywa do usunięcia
     * @returns {Promise<boolean>}
     */
    async deleteAsset(id) {
        try {
            await ensureValidToken();
            
            // Znajdź wiersz z danym ID
            const assets = await this.getAllAssets();
            const asset = assets.find(a => a.id === id);
            
            if (!asset) {
                throw new Error('Nie znaleziono aktywa o podanym ID');
            }
            
            // Pobierz ID arkusza (sheet ID)
            const spreadsheet = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            
            const sheet = spreadsheet.result.sheets.find(s => 
                s.properties.title === this.sheetName
            );
            
            if (!sheet) {
                throw new Error('Nie znaleziono zakładki');
            }
            
            const sheetId = sheet.properties.sheetId;
            
            // Usuń wiersz
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: asset.rowIndex - 1, // 0-indexed
                                endIndex: asset.rowIndex        // exclusive
                            }
                        }
                    }]
                }
            });
            
            return true;
            
        } catch (error) {
            console.error('Błąd usuwania aktywa:', error);
            throw error;
        }
    }
    
    /**
     * Generuje unikalny identyfikator UUID v4
     * @returns {string}
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// Funkcja pomocnicza do tworzenia instancji SheetsAPI
function createSheetsAPI(spreadsheetId) {
    return new SheetsAPI(spreadsheetId);
}
