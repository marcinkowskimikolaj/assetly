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
    // PRZYGOTOWANIE KONTEKSTU
    // ═══════════════════════════════════════════════════════════
    
    async prepareContext(assets, snapshots, milestones) {
        // Formatuj aktualne aktywa
        const assetsContext = assets.map(a => {
            const valuePLN = convertToPLN(a.wartosc, a.waluta);
            return `- ${a.nazwa} (${a.kategoria}): ${valuePLN.toFixed(2)} PLN${a.kontoEmerytalne ? ` [${a.kontoEmerytalne}]` : ''}`;
        }).join('\n');
        
        // Formatuj historię (snapshoty pogrupowane po dacie)
        const snapshotsByDate = {};
        snapshots.forEach(s => {
            if (!snapshotsByDate[s.data]) {
                snapshotsByDate[s.data] = { suma: 0, kategorie: {} };
            }
            if (s.kategoria === 'Długi') {
                snapshotsByDate[s.data].suma -= Math.abs(s.wartoscPLN);
            } else {
                snapshotsByDate[s.data].suma += s.wartoscPLN;
            }
            if (!snapshotsByDate[s.data].kategorie[s.kategoria]) {
                snapshotsByDate[s.data].kategorie[s.kategoria] = 0;
            }
            snapshotsByDate[s.data].kategorie[s.kategoria] += s.wartoscPLN;
        });
        
        const historyContext = Object.entries(snapshotsByDate)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .map(([data, info]) => {
                const kategorieStr = Object.entries(info.kategorie)
                    .map(([k, v]) => `${k}: ${v.toFixed(0)}`)
                    .join(', ');
                return `${data}: ${info.suma.toFixed(0)} PLN (${kategorieStr})`;
            }).join('\n');
        
        // Formatuj kamienie milowe
        const milestonesContext = milestones.map(m => {
            if (m.isAchieved) {
                return `✓ ${m.wartosc.toFixed(0)} PLN - osiągnięty ${m.achievedDate || 'tak'}`;
            }
            return `◯ ${m.wartosc.toFixed(0)} PLN - cel`;
        }).join('\n');
        
        return {
            assets: assetsContext,
            history: historyContext,
            milestones: milestonesContext
        };
    },
    
    getSystemPrompt(context) {
        return `Jesteś asystentem analizy finansowej. Analizujesz dane majątkowe użytkownika.

WAŻNE ZASADY:
- NIE dawaj rekomendacji inwestycyjnych
- NIE sugeruj konkretnych działań finansowych
- Skup się TYLKO na faktach, trendach i obserwacjach
- Używaj prostego języka, bez żargonu finansowego
- Odpowiadaj po polsku
- Bądź zwięzły ale konkretny

AKTUALNE AKTYWA UŻYTKOWNIKA:
${context.assets || 'Brak danych'}

HISTORIA WARTOŚCI MAJĄTKU (snapshoty miesięczne):
${context.history || 'Brak historii'}

KAMIENIE MILOWE UŻYTKOWNIKA:
${context.milestones || 'Brak zdefiniowanych'}

Odpowiadaj na pytania użytkownika bazując na powyższych danych.`;
    },
    
    // ═══════════════════════════════════════════════════════════
    // SZYBKA ANALIZA
    // ═══════════════════════════════════════════════════════════
    
    async runQuickAnalysis(options, assets, snapshots, milestones) {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('Brak klucza API OpenAI');
        }
        
        const context = await this.prepareContext(assets, snapshots, milestones);
        
        // Filtruj dane według opcji
        let filteredSnapshots = snapshots;
        if (options.scope !== 'all') {
            filteredSnapshots = snapshots.filter(s => {
                if (options.scope === 'investments') return s.kategoria === 'Inwestycje';
                if (options.scope === 'cash') return s.kategoria === 'Gotówka';
                if (options.scope === 'accounts') return s.kategoria === 'Konta bankowe';
                if (options.scope === 'category') return s.kategoria === options.category;
                if (options.scope === 'asset') return s.nazwa === options.assetName;
                return true;
            });
        }
        
        // Filtruj po okresie
        if (options.period !== 'all') {
            const now = new Date();
            let cutoff = new Date();
            if (options.period === '3m') cutoff.setMonth(now.getMonth() - 3);
            else if (options.period === '6m') cutoff.setMonth(now.getMonth() - 6);
            else if (options.period === '1y') cutoff.setFullYear(now.getFullYear() - 1);
            
            filteredSnapshots = filteredSnapshots.filter(s => new Date(s.data) >= cutoff);
        }
        
        // Buduj prompt analizy
        const analysisTypes = [];
        if (options.summary) analysisTypes.push('podsumowanie zmian wartości');
        if (options.trends) analysisTypes.push('wykrycie trendów');
        if (options.seasonality) analysisTypes.push('analiza sezonowości');
        if (options.anomalies) analysisTypes.push('wykrycie nietypowych zmian');
        if (options.comparison) analysisTypes.push('porównanie z poprzednim okresem');
        
        const scopeLabel = this.getScopeLabel(options);
        const periodLabel = this.getPeriodLabel(options);
        
        const userPrompt = `Przeprowadź analizę: ${analysisTypes.join(', ')}.

Zakres: ${scopeLabel}
Okres: ${periodLabel}

Dane do analizy:
${this.formatSnapshotsForAnalysis(filteredSnapshots)}

Przedstaw wyniki w czytelnej formie, używając punktów i konkretnych liczb.`;
        
        return await this.callOpenAI(apiKey, context, userPrompt);
    },
    
    getScopeLabel(options) {
        switch (options.scope) {
            case 'all': return 'Cały majątek';
            case 'investments': return 'Inwestycje';
            case 'cash': return 'Gotówka';
            case 'accounts': return 'Konta bankowe';
            case 'category': return `Kategoria: ${options.category}`;
            case 'asset': return `Aktywo: ${options.assetName}`;
            default: return 'Cały majątek';
        }
    },
    
    getPeriodLabel(options) {
        switch (options.period) {
            case '3m': return 'Ostatnie 3 miesiące';
            case '6m': return 'Ostatnie 6 miesięcy';
            case '1y': return 'Ostatni rok';
            case 'all': return 'Cała historia';
            default: return 'Cała historia';
        }
    },
    
    formatSnapshotsForAnalysis(snapshots) {
        const byDate = {};
        snapshots.forEach(s => {
            if (!byDate[s.data]) byDate[s.data] = 0;
            byDate[s.data] += s.wartoscPLN;
        });
        
        return Object.entries(byDate)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .map(([data, suma]) => `${data}: ${suma.toFixed(0)} PLN`)
            .join('\n');
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
        
        const context = await this.prepareContext(assets, snapshots, milestones);
        
        // Buduj historię rozmowy dla API
        const messages = [
            { role: 'system', content: this.getSystemPrompt(context) },
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
    
    async callOpenAI(apiKey, context, userPrompt) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: this.getSystemPrompt(context) },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 1500
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Błąd API OpenAI');
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
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
                temperature: 0.7,
                max_tokens: 1000
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Błąd API OpenAI');
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
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
