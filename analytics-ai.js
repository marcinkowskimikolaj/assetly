/**
 * Assetly - Analytics AI
 * Integracja z OpenAI API + obsługa czatu
 */

const AnalyticsAI = {
    
    // Stan czatu
    chatMessages: [],
    isProcessing: false,
    
    // ═══════════════════════════════════════════════════════════
    // KONFIGURACJA API
    // ═══════════════════════════════════════════════════════════
    
    async getApiKey() {
        return await AnalyticsSheets.getOpenAIKey();
    },
    
    async setApiKey(key) {
        return await AnalyticsSheets.setOpenAIKey(key);
    },
    
    async validateApiKey(key) {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${key}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // PRZYGOTOWANIE DANYCH - UPROSZCZONE I PRZELICZONE
    // ═══════════════════════════════════════════════════════════
    
    prepareDataForAI(assets, snapshots, milestones) {
        const today = new Date().toISOString().substring(0, 10);
        
        // === 1. AKTUALNE AKTYWA - z deduplikacją ===
        const uniqueAssets = this.deduplicateAssets(assets);
        const currentData = this.calculateCurrentState(uniqueAssets);
        
        // === 2. HISTORIA - z deduplikacją i agregacją ===
        const historyData = this.calculateHistory(snapshots);
        
        // === 3. GOTOWE METRYKI ===
        const metrics = this.calculateMetrics(currentData, historyData);
        
        // === 4. KAMIENIE MILOWE ===
        const milestonesData = this.formatMilestones(milestones, currentData.totalNetWorth);
        
        return {
            today,
            current: currentData,
            history: historyData,
            metrics,
            milestones: milestonesData
        };
    },
    
    deduplicateAssets(assets) {
        // Grupuj po unikalnym kluczu (nazwa + kategoria + waluta + konto)
        const grouped = {};
        assets.forEach(a => {
            const key = `${a.nazwa}|${a.kategoria}|${a.waluta}|${a.kontoEmerytalne || ''}`;
            if (!grouped[key]) {
                grouped[key] = { ...a, wartosc: 0 };
            }
            grouped[key].wartosc += parseFloat(a.wartosc) || 0;
        });
        return Object.values(grouped);
    },
    
    calculateCurrentState(assets) {
        let totalNetWorth = 0;
        const byCategory = {};
        
        assets.forEach(a => {
            const valuePLN = convertToPLN(a.wartosc, a.waluta);
            const isDebt = a.kategoria === 'Długi';
            const value = isDebt ? -Math.abs(valuePLN) : valuePLN;
            
            totalNetWorth += value;
            
            if (!byCategory[a.kategoria]) {
                byCategory[a.kategoria] = { total: 0, items: [] };
            }
            byCategory[a.kategoria].total += value;
            byCategory[a.kategoria].items.push({
                nazwa: a.nazwa,
                wartoscPLN: valuePLN,
                konto: a.kontoEmerytalne || null
            });
        });
        
        return { totalNetWorth, byCategory, assetCount: assets.length };
    },
    
    calculateHistory(snapshots) {
        if (!snapshots || snapshots.length === 0) {
            return { hasData: false, months: [] };
        }
        
        // Grupuj snapshoty po dacie i deduplikuj po ID aktywa
        const byDate = {};
        
        snapshots.forEach(s => {
            if (!s.data) return;
            
            if (!byDate[s.data]) {
                byDate[s.data] = { assets: {}, total: 0 };
            }
            
            // Deduplikacja - używamy aktywoId lub nazwy jako klucza
            const assetKey = s.aktywoId || `${s.nazwa}|${s.kategoria}`;
            
            // Jeśli już mamy to aktywo dla tej daty, nadpisz (nie sumuj!)
            const value = s.kategoria === 'Długi' ? -Math.abs(s.wartoscPLN) : s.wartoscPLN;
            byDate[s.data].assets[assetKey] = {
                kategoria: s.kategoria,
                value: value
            };
        });
        
        // Przelicz sumy po deduplikacji
        const months = Object.entries(byDate)
            .map(([date, data]) => {
                let total = 0;
                const byCategory = {};
                
                Object.values(data.assets).forEach(asset => {
                    total += asset.value;
                    if (!byCategory[asset.kategoria]) {
                        byCategory[asset.kategoria] = 0;
                    }
                    byCategory[asset.kategoria] += asset.value;
                });
                
                return { date, total, byCategory };
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        return { hasData: months.length > 0, months };
    },
    
    calculateMetrics(currentData, historyData) {
        const result = {
            currentNetWorth: currentData.totalNetWorth,
            changeMonthly: null,
            changeYearly: null,
            avgMonthlyGrowth: null,
            bestMonth: null,
            worstMonth: null
        };
        
        if (!historyData.hasData || historyData.months.length < 2) {
            return result;
        }
        
        const months = historyData.months;
        const lastMonth = months[months.length - 1];
        const prevMonth = months[months.length - 2];
        
        // Zmiana m/m
        const changeM = lastMonth.total - prevMonth.total;
        const changeMPercent = prevMonth.total !== 0 ? (changeM / Math.abs(prevMonth.total)) * 100 : 0;
        result.changeMonthly = {
            from: prevMonth.date,
            to: lastMonth.date,
            fromValue: prevMonth.total,
            toValue: lastMonth.total,
            change: changeM,
            percent: changeMPercent
        };
        
        // Zmiana r/r (znajdź miesiąc sprzed roku)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const yearAgoMonth = oneYearAgo.toISOString().substring(0, 7);
        const yearAgoData = months.find(m => m.date.startsWith(yearAgoMonth));
        
        if (yearAgoData) {
            const changeY = lastMonth.total - yearAgoData.total;
            const changeYPercent = yearAgoData.total !== 0 ? (changeY / Math.abs(yearAgoData.total)) * 100 : 0;
            result.changeYearly = {
                from: yearAgoData.date,
                to: lastMonth.date,
                fromValue: yearAgoData.total,
                toValue: lastMonth.total,
                change: changeY,
                percent: changeYPercent
            };
        }
        
        // Średni miesięczny przyrost
        let totalGrowth = 0;
        let bestChange = -Infinity;
        let worstChange = Infinity;
        let bestIdx = 0;
        let worstIdx = 0;
        
        for (let i = 1; i < months.length; i++) {
            const change = months[i].total - months[i-1].total;
            totalGrowth += change;
            
            if (change > bestChange) {
                bestChange = change;
                bestIdx = i;
            }
            if (change < worstChange) {
                worstChange = change;
                worstIdx = i;
            }
        }
        
        result.avgMonthlyGrowth = totalGrowth / (months.length - 1);
        
        if (bestIdx > 0) {
            result.bestMonth = {
                date: months[bestIdx].date,
                change: bestChange,
                percent: months[bestIdx-1].total !== 0 ? (bestChange / Math.abs(months[bestIdx-1].total)) * 100 : 0
            };
        }
        
        if (worstIdx > 0) {
            result.worstMonth = {
                date: months[worstIdx].date,
                change: worstChange,
                percent: months[worstIdx-1].total !== 0 ? (worstChange / Math.abs(months[worstIdx-1].total)) * 100 : 0
            };
        }
        
        return result;
    },
    
    formatMilestones(milestones, currentNetWorth) {
        if (!milestones || milestones.length === 0) return [];
        
        return milestones.map(m => ({
            target: m.wartosc,
            achieved: m.isAchieved,
            achievedDate: m.achievedDate || null,
            remaining: m.isAchieved ? 0 : m.wartosc - currentNetWorth
        }));
    },
    
    // ═══════════════════════════════════════════════════════════
    // FORMATOWANIE TEKSTU DLA AI
    // ═══════════════════════════════════════════════════════════
    
    formatDataAsText(data) {
        const formatPLN = (v) => v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' PLN';
        const formatChange = (v, p) => `${v >= 0 ? '+' : ''}${formatPLN(v)} (${p >= 0 ? '+' : ''}${p.toFixed(1)}%)`;
        
        let text = `=== DANE NA DZIEŃ ${data.today} ===\n\n`;
        
        // Główna wartość
        text += `MAJĄTEK NETTO: ${formatPLN(data.current.totalNetWorth)}\n\n`;
        
        // Podział na kategorie
        text += `PODZIAŁ MAJĄTKU:\n`;
        Object.entries(data.current.byCategory)
            .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
            .forEach(([kat, info]) => {
                text += `• ${kat}: ${formatPLN(info.total)}\n`;
            });
        
        // Metryki - tylko jeśli są dane
        text += `\n=== OBLICZONE METRYKI ===\n`;
        
        if (data.metrics.changeMonthly) {
            const m = data.metrics.changeMonthly;
            text += `\nZMIANA MIESIĘCZNA (${m.from} → ${m.to}):\n`;
            text += `• Było: ${formatPLN(m.fromValue)}\n`;
            text += `• Jest: ${formatPLN(m.toValue)}\n`;
            text += `• Zmiana: ${formatChange(m.change, m.percent)}\n`;
        } else {
            text += `\nZMIANA MIESIĘCZNA: brak danych (potrzeba min. 2 snapshotów)\n`;
        }
        
        if (data.metrics.changeYearly) {
            const y = data.metrics.changeYearly;
            text += `\nZMIANA ROCZNA (${y.from} → ${y.to}):\n`;
            text += `• Było: ${formatPLN(y.fromValue)}\n`;
            text += `• Jest: ${formatPLN(y.toValue)}\n`;
            text += `• Zmiana: ${formatChange(y.change, y.percent)}\n`;
        } else {
            text += `\nZMIANA ROCZNA: brak danych (potrzeba snapshotu sprzed roku)\n`;
        }
        
        if (data.metrics.avgMonthlyGrowth !== null) {
            text += `\nŚREDNI MIESIĘCZNY PRZYROST: ${formatChange(data.metrics.avgMonthlyGrowth, 0).split('(')[0].trim()}\n`;
        }
        
        if (data.metrics.bestMonth) {
            text += `\nNAJLEPSZY MIESIĄC: ${data.metrics.bestMonth.date} (${formatChange(data.metrics.bestMonth.change, data.metrics.bestMonth.percent)})\n`;
        }
        
        if (data.metrics.worstMonth) {
            text += `\nNAJGORSZY MIESIĄC: ${data.metrics.worstMonth.date} (${formatChange(data.metrics.worstMonth.change, data.metrics.worstMonth.percent)})\n`;
        }
        
        // Historia
        if (data.history.hasData) {
            text += `\n=== HISTORIA (${data.history.months.length} snapshotów) ===\n`;
            data.history.months.forEach((m, i) => {
                let changeStr = '';
                if (i > 0) {
                    const prev = data.history.months[i-1].total;
                    const change = m.total - prev;
                    const pct = prev !== 0 ? (change / Math.abs(prev)) * 100 : 0;
                    changeStr = ` | zmiana: ${change >= 0 ? '+' : ''}${change.toFixed(0)} PLN (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
                }
                text += `${m.date}: ${formatPLN(m.total)}${changeStr}\n`;
            });
        } else {
            text += `\n=== HISTORIA ===\nBrak snapshotów historycznych.\n`;
        }
        
        // Kamienie milowe
        if (data.milestones.length > 0) {
            text += `\n=== KAMIENIE MILOWE ===\n`;
            data.milestones.forEach(m => {
                if (m.achieved) {
                    text += `✓ ${formatPLN(m.target)} - OSIĄGNIĘTY${m.achievedDate ? ' (' + m.achievedDate + ')' : ''}\n`;
                } else {
                    text += `○ ${formatPLN(m.target)} - brakuje ${formatPLN(m.remaining)}\n`;
                }
            });
        }
        
        return text;
    },
    
    // ═══════════════════════════════════════════════════════════
    // SYSTEM PROMPT
    // ═══════════════════════════════════════════════════════════
    
    getSystemPrompt(dataText) {
        return `Jesteś asystentem do analizy majątku osobistego. Odpowiadasz po polsku.

TWOJE ZADANIE:
- Odpowiadaj na pytania TYLKO na podstawie poniższych danych
- Cytuj konkretne liczby z danych
- Nie wymyślaj żadnych liczb ani dat
- Jeśli czegoś nie ma w danych, powiedz "brak danych"
- Nie dawaj porad inwestycyjnych

ZAKAZY:
- NIE zgaduj wartości
- NIE zakładaj zmian które nie są w danych
- NIE mylisz pojęć (np. zmiana miesięczna vs roczna)

${dataText}

Odpowiadaj konkretnie i dopasowanie do zapytania, cytując liczby z powyższych danych.`;
    },
    
    // ═══════════════════════════════════════════════════════════
    // SZYBKA ANALIZA
    // ═══════════════════════════════════════════════════════════
    
    async runQuickAnalysis(options, assets, snapshots, milestones) {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('Brak klucza API OpenAI');
        }
        
        // Przygotuj dane
        const data = this.prepareDataForAI(assets, snapshots, milestones);
        const dataText = this.formatDataAsText(data);
        
        // Filtruj dla konkretnego zakresu jeśli potrzeba
        let scopeInfo = '';
        if (options.scope === 'investments') {
            scopeInfo = 'Skup się TYLKO na kategorii "Inwestycje".';
        } else if (options.scope === 'cash') {
            scopeInfo = 'Skup się TYLKO na kategorii "Gotówka".';
        } else if (options.scope === 'accounts') {
            scopeInfo = 'Skup się TYLKO na kategorii "Konta bankowe".';
        }
        
        // Buduj prompt
        const analysisTypes = [];
        if (options.summary) analysisTypes.push('podsumowanie zmian wartości');
        if (options.trends) analysisTypes.push('wykrycie trendów');
        if (options.seasonality) analysisTypes.push('analiza sezonowości');
        if (options.anomalies) analysisTypes.push('wykrycie nietypowych zmian');
        if (options.comparison) analysisTypes.push('porównanie z poprzednim okresem');
        
        const userPrompt = `Przeprowadź analizę: ${analysisTypes.join(', ')}.
${scopeInfo}

Używaj TYLKO liczb z sekcji "OBLICZONE METRYKI" i "HISTORIA". 
Podawaj konkretne wartości i daty.
Odpowiedz w punktach.`;
        
        return await this.callOpenAI(apiKey, dataText, userPrompt);
    },
    
    // ═══════════════════════════════════════════════════════════
    // CZAT
    // ═══════════════════════════════════════════════════════════
    
    async sendChatMessage(message, assets, snapshots, milestones) {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('Brak klucza API OpenAI');
        }
        
        // Dodaj wiadomość użytkownika
        this.chatMessages.push({ role: 'user', content: message });
        
        // Przygotuj dane
        const data = this.prepareDataForAI(assets, snapshots, milestones);
        const dataText = this.formatDataAsText(data);
        
        // Buduj historię rozmowy dla API
        const messages = [
            { role: 'system', content: this.getSystemPrompt(dataText) },
            ...this.chatMessages.map(m => ({ role: m.role, content: m.content }))
        ];
        
        const response = await this.callOpenAIChat(apiKey, messages);
        
        // Dodaj odpowiedź AI
        this.chatMessages.push({ role: 'assistant', content: response });
        
        return response;
    },
    
    clearChat() {
        this.chatMessages = [];
    },
    
    getChatMessages() {
        return [...this.chatMessages];
    },
    
    // ═══════════════════════════════════════════════════════════
    // OPENAI API CALLS
    // ═══════════════════════════════════════════════════════════
    
    async callOpenAI(apiKey, dataText, userPrompt) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: this.getSystemPrompt(dataText) },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1,
                max_tokens: 1500
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Błąd API OpenAI');
        }
        
        const result = await response.json();
        return result.choices[0].message.content;
    },
    
    async callOpenAIChat(apiKey, messages) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                temperature: 0.1,
                max_tokens: 1000
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Błąd API OpenAI');
        }
        
        const result = await response.json();
        return result.choices[0].message.content;
    },
    
    // ═══════════════════════════════════════════════════════════
    // ZAPISANE CZATY
    // ═══════════════════════════════════════════════════════════
    
    async saveCurrentChat(title) {
        if (this.chatMessages.length === 0) {
            throw new Error('Brak wiadomości do zapisania');
        }
        
        return await AnalyticsSheets.saveChat(title, this.chatMessages);
    },
    
    async getSavedChats() {
        return await AnalyticsSheets.getSavedChats();
    },
    
    async deleteChat(id) {
        return await AnalyticsSheets.deleteChat(id);
    }
};
