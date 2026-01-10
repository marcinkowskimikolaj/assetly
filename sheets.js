/**
 * Assetly - Google Sheets API Wrapper
 */

class SheetsAPI {
    constructor(spreadsheetId) {
        this.spreadsheetId = spreadsheetId;
        this.sheetName = CONFIG.SHEET_NAME;
    }
    
    /**
     * Normalizuje nazwę aktywa dla deduplikacji
     * Usuwa ticker, różnice w formatowaniu, które nie powinny tworzyć duplikatów
     */
    normalizeAssetName(name) {
        if (!name) return '';
        
        let normalized = name.toLowerCase().trim();
        
        // Usuń ticker z formatu "TICKER - Nazwa" lub "TICKER.XX - Nazwa"
        // Przykłady: "IWDA.UK - Core MSCI World" → "core msci world"
        normalized = normalized.replace(/^[a-z0-9.]+\s*-\s*/i, '');
        
        // Ujednolicenie formatowania
        normalized = normalized
            .replace(/\s+/g, ' ')              // multiple spaces → single space
            .replace(/[-–—]/g, '-')            // unify dashes
            .replace(/[()[\]{}]/g, '')         // remove brackets
            .replace(/[^\w\s-]/g, '');         // remove special chars
        
        return normalized;
    }
    
    /**
     * Generuje klucz unikatowy aktywa do deduplikacji
     */
    getAssetKey(asset) {
        const normalizedName = this.normalizeAssetName(asset.nazwa);
        const konto = (asset.kontoEmerytalne || '').toUpperCase().trim();
        return `${asset.kategoria}|${normalizedName}|${asset.waluta}|${konto}`;
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
                throw new Error(`Brak zakÅ‚adki "${this.sheetName}" w arkuszu`);
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
            
            // Sprawdź czy istnieje już takie samo aktywo (używając znormalizowanego klucza)
            const existingAssets = await this.getAllAssets();
            const assetKey = this.getAssetKey(asset);
            
            const duplicate = existingAssets.find(a => this.getAssetKey(a) === assetKey);
            
            if (duplicate) {
                // Aktualizuj istniejące - zsumuj wartość (SUMA ZAKUPÓW)
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
    
    // Helper: Å‚Ä…czy notatki przy aktualizacji duplikatu
    mergeNotes(existingNotes, newNotes, addedValue) {
        const dateStr = new Date().toLocaleDateString('pl-PL');
        const valueNote = `+${addedValue.toFixed(2)} PLN (${dateStr})`;
        
        // JeÅ›li nowa notatka ma treÅ›Ä‡, uÅ¼yj jej
        if (newNotes && newNotes.trim()) {
            if (existingNotes) {
                return `${existingNotes}; ${newNotes}`;
            }
            return newNotes;
        }
        
        // W przeciwnym razie dodaj informacjÄ™ o zwiÄ™kszeniu wartoÅ›ci
        if (existingNotes) {
            // SprawdÅº czy notatka juÅ¼ zawiera historiÄ™ zakupÃ³w
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
            
            if (!sheet) throw new Error('Nie znaleziono zakÅ‚adki');
            
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
    
    /**
     * Łączy wiele aktywów w jedno
     * @param {string} primaryId - ID aktywa które pozostanie (główne)
     * @param {string[]} assetIds - Tablica ID wszystkich aktywów do połączenia (włącznie z primaryId)
     */
    async mergeAssets(primaryId, assetIds) {
        try {
            await ensureValidToken();
            
            // Pobierz wszystkie aktywa
            const allAssets = await this.getAllAssets();
            
            // Znajdź główne aktywo i aktywa do połączenia
            const primaryAsset = allAssets.find(a => a.id === primaryId);
            const assetsToMerge = allAssets.filter(a => assetIds.includes(a.id));
            
            if (!primaryAsset) {
                throw new Error('Nie znaleziono głównego aktywa');
            }
            
            if (assetsToMerge.length < 2) {
                throw new Error('Wybierz co najmniej 2 aktywa do połączenia');
            }
            
            // Walidacja - czy można je połączyć?
            const currencies = [...new Set(assetsToMerge.map(a => a.waluta))];
            const accounts = [...new Set(assetsToMerge.map(a => a.kontoEmerytalne || ''))];
            
            if (currencies.length > 1) {
                throw new Error('Nie można połączyć aktywów w różnych walutach');
            }
            
            if (accounts.length > 1) {
                throw new Error('Nie można połączyć aktywów z różnych kont emerytalnych');
            }
            
            // OBLICZ NOWĄ WARTOŚĆ (suma wszystkich)
            const totalValue = assetsToMerge.reduce((sum, a) => sum + a.wartosc, 0);
            
            // Zaktualizuj główne aktywo z nową sumą wartości
            await this.updateAsset(primaryId, {
                ...primaryAsset,
                wartosc: totalValue
                // Nazwa, notatki, kategoria, podkategoria - pozostają z primaryAsset
            });
            
            // Usuń pozostałe aktywa (wszystkie OPRÓCZ głównego)
            const assetsToDelete = assetIds.filter(id => id !== primaryId);
            
            for (const assetId of assetsToDelete) {
                // Usuń relacje portfel-aktywa dla tego aktywa (jeśli istnieją)
                try {
                    if (window.InvestmentsSheets) {
                        await window.InvestmentsSheets.removeAllRelationsForAsset(assetId);
                    }
                } catch (err) {
                    console.warn('Nie można usunąć relacji portfel-aktywa:', err);
                }
                
                await this.deleteAsset(assetId);
            }
            
            console.log(`[Merge] Połączono ${assetsToMerge.length} aktywów. Główne: ${primaryId}, Usunięto: ${assetsToDelete.length}`);
            
            return {
                success: true,
                primaryId: primaryId,
                mergedCount: assetsToMerge.length,
                deletedCount: assetsToDelete.length,
                totalValue: totalValue
            };
            
        } catch (error) {
            console.error('Błąd merge:', error);
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
