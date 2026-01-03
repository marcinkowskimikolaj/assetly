/**
 * Assetly - Analytics Sheets API
 * Operacje CRUD dla modułu Analityka
 */

const AnalyticsSheets = {
    
    // Nazwy zakładek
    SHEETS: {
        SNAPSHOTS: 'Snapshoty',
        MILESTONES: 'Kamienie_Milowe',
        SAVED_CHATS: 'Zapisane_Czaty',
        SETTINGS: 'Ustawienia'
    },
    
    // ═══════════════════════════════════════════════════════════
    // SNAPSHOTY
    // ═══════════════════════════════════════════════════════════
    
    async getSnapshots() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.SNAPSHOTS}!A2:I`
            });
            
            const rows = response.result.values || [];
            return rows.map(row => ({
                data: row[0] || '',
                aktywoId: row[1] || '',
                kategoria: row[2] || '',
                podkategoria: row[3] || '',
                nazwa: row[4] || '',
                wartosc: parseFloat(row[5]) || 0,
                waluta: row[6] || 'PLN',
                wartoscPLN: parseFloat(row[7]) || 0,
                kontoEmerytalne: row[8] || ''
            })).filter(s => s.data);
        } catch (error) {
            console.warn('Nie można pobrać snapshotów:', error);
            return [];
        }
    },
    
    async getSnapshotDates() {
        const snapshots = await this.getSnapshots();
        const dates = [...new Set(snapshots.map(s => s.data))];
        return dates.sort((a, b) => new Date(a) - new Date(b));
    },
    
    async hasSnapshotForMonth(year, month) {
        const snapshots = await this.getSnapshots();
        const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
        return snapshots.some(s => s.data.startsWith(targetMonth));
    },
    
    async createSnapshot(assets) {
        const today = new Date();
        const dateStr = today.toISOString().substring(0, 10); // YYYY-MM-DD
        
        const rows = assets.map(asset => {
            const wartoscPLN = convertToPLN(asset.wartosc, asset.waluta);
            return [
                dateStr,
                asset.id,
                asset.kategoria,
                asset.podkategoria || '',
                asset.nazwa,
                asset.wartosc.toString(),
                asset.waluta,
                wartoscPLN.toString(),
                asset.kontoEmerytalne || ''
            ];
        });
        
        if (rows.length === 0) return null;
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.SNAPSHOTS}!A:I`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: rows }
        });
        
        return { date: dateStr, count: rows.length };
    },
    
    // ═══════════════════════════════════════════════════════════
    // KAMIENIE MILOWE
    // ═══════════════════════════════════════════════════════════
    
    async getMilestones() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.MILESTONES}!A2:C`
            });
            
            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                wartosc: parseFloat(row[0]) || 0,
                kategoria: row[1] || 'all',
                osiagnietaData: row[2] || null,
                rowIndex: index + 2 // do usuwania/aktualizacji
            })).filter(m => m.wartosc > 0).sort((a, b) => a.wartosc - b.wartosc);
        } catch (error) {
            console.warn('Nie można pobrać kamieni milowych:', error);
            return [];
        }
    },
    
    async getMilestonesByCategory(kategoria) {
        const all = await this.getMilestones();
        return all.filter(m => m.kategoria === kategoria);
    },
    
    async addMilestone(wartosc, kategoria = 'all') {
        const existing = await this.getMilestones();
        if (existing.some(m => m.wartosc === wartosc && m.kategoria === kategoria)) {
            throw new Error('Taki kamień milowy już istnieje dla tej kategorii');
        }
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.MILESTONES}!A:C`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [[wartosc.toString(), kategoria, '']] }
        });
        
        return true;
    },
    
    async deleteMilestone(wartosc, kategoria) {
        const milestones = await this.getMilestones();
        const milestone = milestones.find(m => m.wartosc === wartosc && m.kategoria === kategoria);
        if (!milestone) return false;
        
        const sheetId = await this.getSheetId(this.SHEETS.MILESTONES);
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: milestone.rowIndex - 1,
                            endIndex: milestone.rowIndex
                        }
                    }
                }]
            }
        });
        
        return true;
    },
    
    async updateMilestoneAchieved(wartosc, kategoria, data) {
        const milestones = await this.getMilestones();
        const milestone = milestones.find(m => m.wartosc === wartosc && m.kategoria === kategoria);
        if (!milestone) return false;
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.MILESTONES}!C${milestone.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[data]] }
        });
        
        return true;
    },
    
    // ═══════════════════════════════════════════════════════════
    // ZAPISANE CZATY
    // ═══════════════════════════════════════════════════════════
    
    async getSavedChats() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.SAVED_CHATS}!A2:D`
            });
            
            const rows = response.result.values || [];
            return rows.map(row => ({
                id: row[0] || '',
                tytul: row[1] || '',
                data: row[2] || '',
                tresc: row[3] ? JSON.parse(row[3]) : []
            })).filter(c => c.id).sort((a, b) => new Date(b.data) - new Date(a.data));
        } catch (error) {
            console.warn('Nie można pobrać zapisanych czatów:', error);
            return [];
        }
    },
    
    async saveChat(tytul, messages) {
        const id = 'chat-' + Date.now();
        const data = new Date().toISOString().substring(0, 19).replace('T', ' ');
        
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.SAVED_CHATS}!A:D`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [[id, tytul, data, JSON.stringify(messages)]] }
        });
        
        return { id, tytul, data, tresc: messages };
    },
    
    async deleteChat(id) {
        const chats = await this.getSavedChats();
        const index = chats.findIndex(c => c.id === id);
        if (index === -1) return false;
        
        const sheetId = await this.getSheetId(this.SHEETS.SAVED_CHATS);
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
    // USTAWIENIA
    // ═══════════════════════════════════════════════════════════
    
    async getSetting(key) {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.SETTINGS}!A2:B`
            });
            
            const rows = response.result.values || [];
            const row = rows.find(r => r[0] === key);
            return row ? row[1] : null;
        } catch (error) {
            return null;
        }
    },
    
    async setSetting(key, value) {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.SETTINGS}!A2:B`
            });
            
            const rows = response.result.values || [];
            const rowIndex = rows.findIndex(r => r[0] === key);
            
            if (rowIndex >= 0) {
                // Update existing
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: `${this.SHEETS.SETTINGS}!B${rowIndex + 2}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[value]] }
                });
            } else {
                // Add new
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
    
    async getOpenAIKey() {
        return await this.getSetting('OpenAI_API_Key');
    },
    
    async setOpenAIKey(key) {
        return await this.setSetting('OpenAI_API_Key', key);
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
            console.error('Błąd inicjalizacji zakładek:', error);
            return false;
        }
    },
    
    async addHeaders(sheetNames) {
        const headers = {
            [this.SHEETS.SNAPSHOTS]: ['Data', 'Aktywo_ID', 'Kategoria', 'Podkategoria', 'Nazwa', 'Wartosc', 'Waluta', 'Wartosc_PLN', 'Konto_Emerytalne'],
            [this.SHEETS.MILESTONES]: ['Wartosc', 'Kategoria', 'Osiagnieto_Data'],
            [this.SHEETS.SAVED_CHATS]: ['ID', 'Tytul', 'Data', 'Tresc_JSON'],
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
    }
};
