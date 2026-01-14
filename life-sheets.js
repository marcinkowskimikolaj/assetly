/**
 * Assetly - Life Sheets API
 * Operacje CRUD dla modułu Życie
 */

const LifeSheets = {

    // Nazwy zakładek
    SHEETS: {
        INSURANCE: 'Zycie_Ubezpieczenia',
        PROPERTY: 'Zycie_Nieruchomosci',
        INVENTORY: 'Zycie_Inwentarz',
        SUBSCRIPTIONS: 'Zycie_Subskrypcje'
        // Kalendarz NIE ma osobnej zakładki - dane są w innych (kolumna EventId_Calendar)
    },

    // ═══════════════════════════════════════════════════════════
    // UBEZPIECZENIA (INSURANCE)
    // ═══════════════════════════════════════════════════════════

    async getInsurancePolicies() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.INSURANCE}!A2:N`
            });

            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                id: row[0] || '',
                typ: row[1] || '',
                nazwa: row[2] || '',
                numerPolisy: row[3] || '',
                dataRozpoczecia: row[4] || '',
                dataZakonczenia: row[5] || '',
                skladkaRoczna: parseFloat(row[6]) || 0,
                waluta: row[7] || 'PLN',
                skladkaPLN: parseFloat(row[8]) || 0,
                sumaUbezpieczenia: parseFloat(row[9]) || 0,
                ubezpieczyciel: row[10] || '',
                notatki: row[11] || '',
                fileIdDrive: row[12] || '',
                eventIdCalendar: row[13] || '',
                rowIndex: index + 2
            })).filter(p => p.id);
        } catch (error) {
            console.warn('Nie można pobrać polis:', error);
            return [];
        }
    },

    async addInsurancePolicy(policy) {
        const id = 'ins-' + Date.now();
        const skladkaPLN = policy.waluta === 'PLN'
            ? policy.skladkaRoczna
            : policy.skladkaRoczna * (currencyRates[policy.waluta] || 1);

        const row = [
            id,
            policy.typ,
            policy.nazwa,
            policy.numerPolisy || '',
            policy.dataRozpoczecia,
            policy.dataZakonczenia,
            policy.skladkaRoczna.toString(),
            policy.waluta,
            skladkaPLN.toFixed(2),
            (policy.sumaUbezpieczenia || 0).toString(),
            policy.ubezpieczyciel,
            policy.notatki || '',
            '', // FileId_Drive - placeholder
            ''  // EventId_Calendar - placeholder
        ];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.INSURANCE}!A:N`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });

        return { ...policy, id, skladkaPLN };
    },

    async updateInsurancePolicy(id, updates) {
        const policies = await this.getInsurancePolicies();
        const policy = policies.find(p => p.id === id);
        if (!policy) return false;

        const skladkaPLN = (updates.waluta || policy.waluta) === 'PLN'
            ? (updates.skladkaRoczna || policy.skladkaRoczna)
            : (updates.skladkaRoczna || policy.skladkaRoczna) * (currencyRates[updates.waluta || policy.waluta] || 1);

        const row = [
            id,
            updates.typ || policy.typ,
            updates.nazwa || policy.nazwa,
            updates.numerPolisy !== undefined ? updates.numerPolisy : policy.numerPolisy,
            updates.dataRozpoczecia || policy.dataRozpoczecia,
            updates.dataZakonczenia || policy.dataZakonczenia,
            (updates.skladkaRoczna || policy.skladkaRoczna).toString(),
            updates.waluta || policy.waluta,
            skladkaPLN.toFixed(2),
            (updates.sumaUbezpieczenia !== undefined ? updates.sumaUbezpieczenia : policy.sumaUbezpieczenia).toString(),
            updates.ubezpieczyciel || policy.ubezpieczyciel,
            updates.notatki !== undefined ? updates.notatki : policy.notatki,
            updates.fileIdDrive !== undefined ? updates.fileIdDrive : policy.fileIdDrive,
            updates.eventIdCalendar !== undefined ? updates.eventIdCalendar : policy.eventIdCalendar
        ];

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.INSURANCE}!A${policy.rowIndex}:N${policy.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });

        return true;
    },

    async deleteInsurancePolicy(id) {
        const policies = await this.getInsurancePolicies();
        const policy = policies.find(p => p.id === id);
        if (!policy) return false;

        const sheetId = await this.getSheetId(this.SHEETS.INSURANCE);
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: policy.rowIndex - 1,
                            endIndex: policy.rowIndex
                        }
                    }
                }]
            }
        });

        return true;
    },

    // ═══════════════════════════════════════════════════════════
    // NIERUCHOMOŚCI (PROPERTY) - Sprint 2
    // ═══════════════════════════════════════════════════════════

    async getProperties() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.PROPERTY}!A2:O`
            });

            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                id: row[0] || '',
                typ: row[1] || '',
                nazwa: row[2] || '',
                adres: row[3] || '',
                powierzchniaM2: parseFloat(row[4]) || 0,
                wartoscRynkowa: parseFloat(row[5]) || 0,
                waluta: row[6] || 'PLN',
                wartoscPLN: parseFloat(row[7]) || 0,
                status: row[8] || '',
                dataZakupu: row[9] || '',
                notatki: row[10] || '',
                pomieszczenia: this._parseJsonSafe(row[11], []),
                harmonogramKonserwacji: this._parseJsonSafe(row[12], []),
                fileIdDrive: row[13] || '',
                eventIdCalendar: row[14] || '',
                rowIndex: index + 2
            })).filter(p => p.id);
        } catch (error) {
            console.warn('Nie można pobrać nieruchomości:', error);
            return [];
        }
    },

    async addProperty(property) {
        const id = 'prop-' + Date.now();
        const wartoscPLN = property.waluta === 'PLN'
            ? property.wartoscRynkowa
            : property.wartoscRynkowa * (currencyRates[property.waluta] || 1);

        const row = [
            id,
            property.typ,
            property.nazwa,
            property.adres,
            (property.powierzchniaM2 || 0).toString(),
            (property.wartoscRynkowa || 0).toString(),
            property.waluta,
            wartoscPLN.toFixed(2),
            property.status,
            property.dataZakupu,
            property.notatki || '',
            JSON.stringify(property.pomieszczenia || []),
            JSON.stringify(property.harmonogramKonserwacji || []),
            '', // FileId_Drive
            ''  // EventId_Calendar
        ];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PROPERTY}!A:O`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });

        return { ...property, id, wartoscPLN };
    },

    async updateProperty(id, updates) {
        const properties = await this.getProperties();
        const property = properties.find(p => p.id === id);
        if (!property) return false;

        const wartoscPLN = (updates.waluta || property.waluta) === 'PLN'
            ? (updates.wartoscRynkowa || property.wartoscRynkowa)
            : (updates.wartoscRynkowa || property.wartoscRynkowa) * (currencyRates[updates.waluta || property.waluta] || 1);

        // Logika łączenia tablicy pomieszczeń/harmonogramu
        const pomieszczenia = updates.pomieszczenia !== undefined ? updates.pomieszczenia : property.pomieszczenia;
        const harmonogram = updates.harmonogramKonserwacji !== undefined ? updates.harmonogramKonserwacji : property.harmonogramKonserwacji;

        const row = [
            id,
            updates.typ || property.typ,
            updates.nazwa || property.nazwa,
            updates.adres !== undefined ? updates.adres : property.adres,
            (updates.powierzchniaM2 !== undefined ? updates.powierzchniaM2 : property.powierzchniaM2).toString(),
            (updates.wartoscRynkowa !== undefined ? updates.wartoscRynkowa : property.wartoscRynkowa).toString(),
            updates.waluta || property.waluta,
            wartoscPLN.toFixed(2),
            updates.status || property.status,
            updates.dataZakupu || property.dataZakupu,
            updates.notatki !== undefined ? updates.notatki : property.notatki,
            JSON.stringify(pomieszczenia),
            JSON.stringify(harmonogram),
            updates.fileIdDrive !== undefined ? updates.fileIdDrive : property.fileIdDrive,
            updates.eventIdCalendar !== undefined ? updates.eventIdCalendar : property.eventIdCalendar
        ];

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PROPERTY}!A${property.rowIndex}:O${property.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });

        return true;
    },

    async deleteProperty(id) {
        const properties = await this.getProperties();
        const property = properties.find(p => p.id === id);
        if (!property) return false;

        const sheetId = await this.getSheetId(this.SHEETS.PROPERTY);
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: property.rowIndex - 1,
                            endIndex: property.rowIndex
                        }
                    }
                }]
            }
        });

        return true;
    },

    // ═══════════════════════════════════════════════════════════
    // INWENTARZ (INVENTORY) - Placeholder dla Sprint 3
    // ═══════════════════════════════════════════════════════════

    async getInventoryItems() {
        // TODO Sprint 3
        return [];
    },

    // ═══════════════════════════════════════════════════════════
    // SUBSKRYPCJE (SUBSCRIPTIONS) - Placeholder dla Sprint 4
    // ═══════════════════════════════════════════════════════════

    async getSubscriptions() {
        // TODO Sprint 4
        return [];
    },

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    _parseJsonSafe(jsonString, defaultValue) {
        if (!jsonString) return defaultValue;
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.warn('Błąd parsowania JSON:', e);
            return defaultValue;
        }
    },

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

    // Inicjalizacja - sprawdza czy zakładki istnieją i tworzy je jeśli brak
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

                console.log(`Utworzono zakładki: ${missingSheets.join(', ')}`);
            }

            return true;
        } catch (error) {
            console.error('Błąd inicjalizacji zakładek Życie:', error);
            return false;
        }
    },

    async addHeaders(sheetNames) {
        const headers = {
            [this.SHEETS.INSURANCE]: [
                'ID',
                'Typ',
                'Nazwa',
                'Numer_Polisy',
                'Data_Rozpoczecia',
                'Data_Zakonczenia',
                'Skladka_Roczna',
                'Waluta',
                'Skladka_PLN',
                'Suma_Ubezpieczenia',
                'Ubezpieczyciel',
                'Notatki',
                'FileId_Drive',
                'EventId_Calendar'
            ],
            [this.SHEETS.PROPERTY]: [
                'ID',
                'Typ',
                'Nazwa',
                'Adres',
                'Powierzchnia_m2',
                'Wartosc_Rynkowa',
                'Waluta',
                'Wartosc_PLN',
                'Status',
                'Data_Zakupu',
                'Notatki',
                'Pomieszczenia',
                'Harmonogram_Konserwacji',
                'FileId_Drive',
                'EventId_Calendar'
            ],
            [this.SHEETS.INVENTORY]: [
                'ID',
                'Kategoria',
                'Nazwa',
                'Producent',
                'Model',
                'Numer_Seryjny',
                'Data_Zakupu',
                'Wartosc_Zakupu',
                'Waluta',
                'Wartosc_PLN',
                'Wartosc_Biezaca',
                'Stan',
                'Lokalizacja',
                'Gwarancja_Do',
                'Notatki',
                'FileId_Drive'
            ],
            [this.SHEETS.SUBSCRIPTIONS]: [
                'ID',
                'Typ',
                'Kategoria',
                'Nazwa',
                'Dostawca',
                'Kwota',
                'Waluta',
                'Kwota_PLN',
                'Okres_Platnosci',
                'Data_Nastepnej_Platnosci',
                'Data_Rozpoczecia',
                'Data_Zakonczenia',
                'Aktywny',
                'Notatki',
                'EventId_Calendar'
            ]
        };

        for (const sheetName of sheetNames) {
            if (headers[sheetName]) {
                const headerRow = headers[sheetName];
                const lastColumn = String.fromCharCode(64 + headerRow.length);

                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: `${sheetName}!A1:${lastColumn}1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [headerRow] }
                });
            }
        }
    }
};
