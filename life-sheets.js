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
                range: `${this.SHEETS.PROPERTY}!A2:V`
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
                rokBudowy: row[15] || '',
                wartoscZakupu: parseFloat(row[16]) || 0,
                numerKW: row[17] || '',
                numerDzialki: row[18] || '',
                oplatyConfig: this._parseJsonSafe(row[19], {}),
                projektyRemontowe: this._parseJsonSafe(row[20], []),
                linkedPolicyId: row[21] || '',
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
            '', // EventId_Calendar
            property.rokBudowy || '',
            (property.wartoscZakupu || 0).toString(),
            property.numerKW || '',
            property.numerDzialki || '',
            JSON.stringify(property.oplatyConfig || {}),
            JSON.stringify(property.projektyRemontowe || []),
            property.linkedPolicyId || ''
        ];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PROPERTY}!A:V`,
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

        // Logika łączenia JSON
        const pomieszczenia = updates.pomieszczenia !== undefined ? updates.pomieszczenia : property.pomieszczenia;
        const harmonogram = updates.harmonogramKonserwacji !== undefined ? updates.harmonogramKonserwacji : property.harmonogramKonserwacji;
        const oplaty = updates.oplatyConfig !== undefined ? updates.oplatyConfig : property.oplatyConfig;
        const projekty = updates.projektyRemontowe !== undefined ? updates.projektyRemontowe : property.projektyRemontowe;

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
            updates.eventIdCalendar !== undefined ? updates.eventIdCalendar : property.eventIdCalendar,
            updates.rokBudowy !== undefined ? updates.rokBudowy : property.rokBudowy,
            (updates.wartoscZakupu !== undefined ? updates.wartoscZakupu : property.wartoscZakupu).toString(),
            updates.numerKW !== undefined ? updates.numerKW : property.numerKW,
            updates.numerDzialki !== undefined ? updates.numerDzialki : property.numerDzialki,
            JSON.stringify(oplaty),
            JSON.stringify(projekty),
            updates.linkedPolicyId !== undefined ? updates.linkedPolicyId : (property.linkedPolicyId || '')
        ];

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.PROPERTY}!A${property.rowIndex}:V${property.rowIndex}`,
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
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.INVENTORY}!A2:T`
            });

            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                id: row[0] || '',
                kategoria: row[1] || 'Inne',
                nazwa: row[2] || '',
                producent: row[3] || '',
                model: row[4] || '',
                numerSeryjny: row[5] || '',
                dataZakupu: row[6] || '',
                wartoscZakupu: parseFloat(row[7]) || 0,
                waluta: row[8] || 'PLN',
                wartoscPLN: parseFloat(row[9]) || 0,
                wartoscBiezaca: parseFloat(row[10]) || 0,
                stan: row[11] || 'W użyciu',
                idNieruchomosci: row[12] || '',
                idPomieszczenia: row[13] || '',
                gwarancjaDo: row[14] || '',
                notatki: row[15] || '',
                fileIdDrive: row[16] || '',
                zalaczniki: this._parseJsonSafe(row[17], []),
                historiaSerwisow: this._parseJsonSafe(row[18], []),
                opcjeDeprecjacji: this._parseJsonSafe(row[19], {}),
                rowIndex: index + 2
            })).filter(item => item.id);
        } catch (error) {
            console.warn('Nie można pobrać inwentarza:', error);
            return [];
        }
    },

    async addInventoryItem(item) {
        const id = 'inv-' + Date.now();
        const wartoscPLN = item.waluta === 'PLN'
            ? item.wartoscZakupu
            : item.wartoscZakupu * (currencyRates[item.waluta] || 1);

        const row = [
            id,
            item.kategoria || 'Inne',
            item.nazwa,
            item.producent || '',
            item.model || '',
            item.numerSeryjny || '',
            item.dataZakupu || '',
            (item.wartoscZakupu || 0).toString(),
            item.waluta || 'PLN',
            wartoscPLN.toFixed(2),
            (item.wartoscBiezaca || wartoscPLN).toString(),
            item.stan || 'W użyciu',
            item.idNieruchomosci || '',
            item.idPomieszczenia || '',
            item.gwarancjaDo || '',
            item.notatki || '',
            item.fileIdDrive || '',
            JSON.stringify(item.zalaczniki || []),
            JSON.stringify(item.historiaSerwisow || []),
            JSON.stringify(item.opcjeDeprecjacji || {})
        ];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.INVENTORY}!A:T`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });

        return { ...item, id, wartoscPLN };
    },

    async updateInventoryItem(id, updates) {
        const items = await this.getInventoryItems();
        const item = items.find(i => i.id === id);
        if (!item) return false;

        // Recalculate Value PLN if needed
        let wartoscPLN = item.wartoscPLN;
        if (updates.wartoscZakupu || updates.waluta) {
            const val = updates.wartoscZakupu || item.wartoscZakupu;
            const cur = updates.waluta || item.waluta;
            wartoscPLN = cur === 'PLN' ? val : val * (currencyRates[cur] || 1);
        }

        const row = [
            id,
            updates.kategoria || item.kategoria,
            updates.nazwa || item.nazwa,
            updates.producent !== undefined ? updates.producent : item.producent,
            updates.model !== undefined ? updates.model : item.model,
            updates.numerSeryjny !== undefined ? updates.numerSeryjny : item.numerSeryjny,
            updates.dataZakupu !== undefined ? updates.dataZakupu : item.dataZakupu,
            (updates.wartoscZakupu !== undefined ? updates.wartoscZakupu : item.wartoscZakupu).toString(),
            updates.waluta || item.waluta,
            wartoscPLN.toFixed(2),
            (updates.wartoscBiezaca !== undefined ? updates.wartoscBiezaca : item.wartoscBiezaca).toString(),
            updates.stan || item.stan,
            updates.idNieruchomosci !== undefined ? updates.idNieruchomosci : item.idNieruchomosci,
            updates.idPomieszczenia !== undefined ? updates.idPomieszczenia : item.idPomieszczenia,
            updates.gwarancjaDo !== undefined ? updates.gwarancjaDo : item.gwarancjaDo,
            updates.notatki !== undefined ? updates.notatki : item.notatki,
            updates.fileIdDrive !== undefined ? updates.fileIdDrive : item.fileIdDrive,
            JSON.stringify(updates.zalaczniki !== undefined ? updates.zalaczniki : item.zalaczniki),
            JSON.stringify(updates.historiaSerwisow !== undefined ? updates.historiaSerwisow : item.historiaSerwisow),
            JSON.stringify(updates.opcjeDeprecjacji !== undefined ? updates.opcjeDeprecjacji : item.opcjeDeprecjacji)
        ];

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.INVENTORY}!A${item.rowIndex}:T${item.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });

        return true;
    },

    async deleteInventoryItem(id) {
        const items = await this.getInventoryItems();
        const item = items.find(i => i.id === id);
        if (!item) return false;

        const sheetId = await this.getSheetId(this.SHEETS.INVENTORY);
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
    // SUBSKRYPCJE (SUBSCRIPTIONS)
    // ═══════════════════════════════════════════════════════════

    async getSubscriptions() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${this.SHEETS.SUBSCRIPTIONS}!A2:O`
            });

            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                id: row[0] || '',
                typ: row[1] || '',
                kategoria: row[2] || '',
                nazwa: row[3] || '',
                dostawca: row[4] || '',
                kwota: parseFloat(row[5]) || 0,
                waluta: row[6] || 'PLN',
                kwotaPLN: parseFloat(row[7]) || 0,
                okresPlatnosci: row[8] || 'miesięczny',
                dataNastepnejPlatnosci: row[9] || '',
                dataRozpoczecia: row[10] || '',
                dataZakonczenia: row[11] || '',
                aktywny: String(row[12]).toLowerCase() === 'true' || row[12] === true,
                notatki: row[13] || '',
                eventIdCalendar: row[14] || '',
                rowIndex: index + 2
            })).filter(s => s.id);
        } catch (error) {
            console.warn('Nie można pobrać subskrypcji:', error);
            return [];
        }
    },

    async addSubscription(subscription) {
        const id = 'sub-' + Date.now();
        const kwotaPLN = subscription.waluta === 'PLN'
            ? subscription.kwota
            : subscription.kwota * (currencyRates[subscription.waluta] || 1);

        const row = [
            id,
            subscription.typ || '',
            subscription.kategoria || '',
            subscription.nazwa,
            subscription.dostawca || '',
            subscription.kwota.toString(),
            subscription.waluta || 'PLN',
            kwotaPLN.toFixed(2),
            subscription.okresPlatnosci || 'miesięczny',
            subscription.dataNastepnejPlatnosci || '',
            subscription.dataRozpoczecia || '',
            subscription.dataZakonczenia || '',
            subscription.aktywny !== false ? 'true' : 'false',
            subscription.notatki || '',
            '' // EventId_Calendar
        ];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.SUBSCRIPTIONS}!A:O`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });

        return { ...subscription, id, kwotaPLN };
    },

    async updateSubscription(id, updates) {
        const subscriptions = await this.getSubscriptions();
        const sub = subscriptions.find(s => s.id === id);
        if (!sub) return false;

        const kwotaPLN = (updates.waluta || sub.waluta) === 'PLN'
            ? (updates.kwota !== undefined ? updates.kwota : sub.kwota)
            : (updates.kwota !== undefined ? updates.kwota : sub.kwota) * (currencyRates[updates.waluta || sub.waluta] || 1);

        const row = [
            id,
            updates.typ !== undefined ? updates.typ : sub.typ,
            updates.kategoria !== undefined ? updates.kategoria : sub.kategoria,
            updates.nazwa !== undefined ? updates.nazwa : sub.nazwa,
            updates.dostawca !== undefined ? updates.dostawca : sub.dostawca,
            (updates.kwota !== undefined ? updates.kwota : sub.kwota).toString(),
            updates.waluta !== undefined ? updates.waluta : sub.waluta,
            kwotaPLN.toFixed(2),
            updates.okresPlatnosci !== undefined ? updates.okresPlatnosci : sub.okresPlatnosci,
            updates.dataNastepnejPlatnosci !== undefined ? updates.dataNastepnejPlatnosci : sub.dataNastepnejPlatnosci,
            updates.dataRozpoczecia !== undefined ? updates.dataRozpoczecia : sub.dataRozpoczecia,
            updates.dataZakonczenia !== undefined ? updates.dataZakonczenia : sub.dataZakonczenia,
            (updates.aktywny !== undefined ? updates.aktywny : sub.aktywny) ? 'true' : 'false',
            updates.notatki !== undefined ? updates.notatki : sub.notatki,
            sub.eventIdCalendar || ''
        ];

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${this.SHEETS.SUBSCRIPTIONS}!A${sub.rowIndex}:O${sub.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });

        return true;
    },

    async deleteSubscription(id) {
        const subscriptions = await this.getSubscriptions();
        const sub = subscriptions.find(s => s.id === id);
        if (!sub) return false;

        const sheetId = await this.getSheetId(this.SHEETS.SUBSCRIPTIONS);

        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: sub.rowIndex - 1,
                            endIndex: sub.rowIndex
                        }
                    }
                }]
            }
        });

        return true;
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
                'EventId_Calendar',
                'Rok_Budowy',
                'Wartosc_Zakupu',
                'Numer_KW',
                'Numer_Dzialki',
                'Oplaty_Config',
                'Projekty_Remontowe',
                'Powiazana_Polisa_ID'
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
                'Wartosc_Biezaca', // Szacowana
                'Stan',
                'ID_Nieruchomosci',
                'ID_Pomieszczenia',
                'Gwarancja_Do',
                'Notatki', // Instrukcja, historia
                'FileId_Drive', // Główne zdjęcie
                'Zalaczniki_JSON', // Paragony, inne pliki
                'Historia_Serwisow', // JSON
                'Opcje_Deprecjacji' // JSON
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
