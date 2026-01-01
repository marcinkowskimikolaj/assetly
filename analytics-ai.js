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
    // PRZYGOTOWANIE DANYCH - BOGATE DANE Z PRZELICZONYMI METRYKAMI
    // ═══════════════════════════════════════════════════════════
    
    prepareDataForAI(assets, snapshots, milestones) {
        const today = new Date().toISOString().substring(0, 10);
        
        // === 1. AKTUALNE AKTYWA ===
        const currentData = this.calculateCurrentState(assets);
        
        // === 2. HISTORIA ===
        const historyData = this.calculateHistory(snapshots);
        
        // === 3. GOTOWE METRYKI ===
        const metrics = this.calculateMetrics(currentData, historyData);
        
        // === 4. SZCZEGÓŁY AKTYWÓW ===
        const assetsDetails = this.getAssetsDetails(assets);
        
        // === 5. SZCZEGÓŁY HISTORII ===
        const historyDetails = this.getHistoryDetails(snapshots);
        
        // === 6. KAMIENIE MILOWE ===
        const milestonesData = this.formatMilestones(milestones, currentData.totalNetWorth, metrics);
        
        // === 7. ANALIZA STRUKTURY ===
        const structureAnalysis = this.analyzeStructure(currentData, historyData);
        
        return {
            today,
            current: currentData,
            history: historyData,
            metrics,
            assetsDetails,
            historyDetails,
            milestones: milestonesData,
            structure: structureAnalysis
        };
    },
    
    calculateCurrentState(assets) {
        let totalNetWorth = 0;
        let totalAssets = 0;
        let totalDebts = 0;
        const byCategory = {};
        const byCurrency = {};
        const byRetirementAccount = { IKE: 0, IKZE: 0, none: 0 };
        
        assets.forEach(a => {
            const valuePLN = convertToPLN(a.wartosc, a.waluta);
            const isDebt = a.kategoria === 'Długi';
            
            if (isDebt) {
                totalDebts += Math.abs(valuePLN);
                totalNetWorth -= Math.abs(valuePLN);
            } else {
                totalAssets += valuePLN;
                totalNetWorth += valuePLN;
            }
            
            // Per kategoria
            if (!byCategory[a.kategoria]) {
                byCategory[a.kategoria] = { total: 0, count: 0, items: [] };
            }
            byCategory[a.kategoria].total += isDebt ? -Math.abs(valuePLN) : valuePLN;
            byCategory[a.kategoria].count++;
            byCategory[a.kategoria].items.push({
                nazwa: a.nazwa,
                wartoscPLN: valuePLN,
                waluta: a.waluta,
                konto: a.kontoEmerytalne || null
            });
            
            // Per waluta
            if (!byCurrency[a.waluta]) {
                byCurrency[a.waluta] = { total: 0, totalPLN: 0, count: 0 };
            }
            byCurrency[a.waluta].total += a.wartosc;
            byCurrency[a.waluta].totalPLN += valuePLN;
            byCurrency[a.waluta].count++;
            
            // Per konto emerytalne
            if (a.kontoEmerytalne === 'IKE') {
                byRetirementAccount.IKE += valuePLN;
            } else if (a.kontoEmerytalne === 'IKZE') {
                byRetirementAccount.IKZE += valuePLN;
            } else if (!isDebt) {
                byRetirementAccount.none += valuePLN;
            }
        });
        
        return { 
            totalNetWorth, 
            totalAssets,
            totalDebts,
            byCategory, 
            byCurrency,
            byRetirementAccount,
            assetCount: assets.length 
        };
    },
    
    calculateHistory(snapshots) {
        if (!snapshots || snapshots.length === 0) {
            return { hasData: false, months: [], monthCount: 0 };
        }
        
        // Grupuj snapshoty po dacie
        const byDate = {};
        
        snapshots.forEach(s => {
            if (!s.data) return;
            
            if (!byDate[s.data]) {
                byDate[s.data] = { 
                    assets: new Map(),
                    byCategory: {}
                };
            }
            
            // Używamy Map żeby uniknąć duplikatów
            const assetKey = s.aktywoId || `${s.nazwa}|${s.kategoria}|${s.waluta}`;
            const value = s.kategoria === 'Długi' ? -Math.abs(s.wartoscPLN) : s.wartoscPLN;
            
            // Nadpisz jeśli istnieje (nie sumuj duplikatów)
            byDate[s.data].assets.set(assetKey, {
                kategoria: s.kategoria,
                nazwa: s.nazwa,
                value: value
            });
        });
        
        // Przelicz sumy
        const months = Object.entries(byDate)
            .map(([date, data]) => {
                let total = 0;
                const byCategory = {};
                
                data.assets.forEach((asset) => {
                    total += asset.value;
                    if (!byCategory[asset.kategoria]) {
                        byCategory[asset.kategoria] = 0;
                    }
                    byCategory[asset.kategoria] += asset.value;
                });
                
                return { date, total, byCategory, assetCount: data.assets.size };
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Dodaj zmiany do każdego miesiąca
        for (let i = 1; i < months.length; i++) {
            const prev = months[i - 1];
            const curr = months[i];
            curr.change = curr.total - prev.total;
            curr.changePercent = prev.total !== 0 ? (curr.change / Math.abs(prev.total)) * 100 : 0;
        }
        
        return { hasData: months.length > 0, months, monthCount: months.length };
    },
    
    calculateMetrics(currentData, historyData) {
        const result = {
            currentNetWorth: currentData.totalNetWorth,
            totalAssets: currentData.totalAssets,
            totalDebts: currentData.totalDebts,
            changeMonthly: null,
            changeYearly: null,
            change3Months: null,
            change6Months: null,
            avgMonthlyGrowth: null,
            avgMonthlyGrowthPercent: null,
            bestMonth: null,
            worstMonth: null,
            volatility: null,
            growthTrend: null
        };
        
        if (!historyData.hasData || historyData.months.length < 2) {
            return result;
        }
        
        const months = historyData.months;
        const lastMonth = months[months.length - 1];
        const prevMonth = months[months.length - 2];
        
        // Zmiana m/m
        result.changeMonthly = this.calcChange(prevMonth, lastMonth);
        
        // Zmiana 3 miesiące
        if (months.length >= 4) {
            result.change3Months = this.calcChange(months[months.length - 4], lastMonth);
        }
        
        // Zmiana 6 miesięcy
        if (months.length >= 7) {
            result.change6Months = this.calcChange(months[months.length - 7], lastMonth);
        }
        
        // Zmiana r/r
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const yearAgoMonth = oneYearAgo.toISOString().substring(0, 7);
        const yearAgoData = months.find(m => m.date.startsWith(yearAgoMonth));
        if (yearAgoData) {
            result.changeYearly = this.calcChange(yearAgoData, lastMonth);
        }
        
        // Statystyki zmian
        const changes = [];
        let bestChange = { value: -Infinity, idx: 0 };
        let worstChange = { value: Infinity, idx: 0 };
        
        for (let i = 1; i < months.length; i++) {
            const change = months[i].total - months[i-1].total;
            const pct = months[i-1].total !== 0 ? (change / Math.abs(months[i-1].total)) * 100 : 0;
            changes.push({ value: change, percent: pct, date: months[i].date });
            
            if (change > bestChange.value) {
                bestChange = { value: change, idx: i, percent: pct };
            }
            if (change < worstChange.value) {
                worstChange = { value: change, idx: i, percent: pct };
            }
        }
        
        // Średni przyrost
        const totalGrowth = changes.reduce((sum, c) => sum + c.value, 0);
        result.avgMonthlyGrowth = totalGrowth / changes.length;
        
        const totalGrowthPct = changes.reduce((sum, c) => sum + c.percent, 0);
        result.avgMonthlyGrowthPercent = totalGrowthPct / changes.length;
        
        // Najlepszy/najgorszy
        if (bestChange.idx > 0) {
            result.bestMonth = {
                date: months[bestChange.idx].date,
                change: bestChange.value,
                percent: bestChange.percent
            };
        }
        if (worstChange.idx > 0) {
            result.worstMonth = {
                date: months[worstChange.idx].date,
                change: worstChange.value,
                percent: worstChange.percent
            };
        }
        
        // Zmienność (odchylenie standardowe zmian %)
        if (changes.length >= 3) {
            const avgPct = totalGrowthPct / changes.length;
            const variance = changes.reduce((sum, c) => sum + Math.pow(c.percent - avgPct, 2), 0) / changes.length;
            result.volatility = Math.sqrt(variance);
        }
        
        // Trend (porównanie ostatnich 3 miesięcy vs wcześniejsze 3)
        if (changes.length >= 6) {
            const recent3 = changes.slice(-3).reduce((sum, c) => sum + c.value, 0) / 3;
            const earlier3 = changes.slice(-6, -3).reduce((sum, c) => sum + c.value, 0) / 3;
            result.growthTrend = {
                recent: recent3,
                earlier: earlier3,
                direction: recent3 > earlier3 ? 'przyspieszający' : recent3 < earlier3 ? 'zwalniający' : 'stabilny'
            };
        }
        
        return result;
    },
    
    calcChange(from, to) {
        const change = to.total - from.total;
        const percent = from.total !== 0 ? (change / Math.abs(from.total)) * 100 : 0;
        return {
            from: from.date,
            to: to.date,
            fromValue: from.total,
            toValue: to.total,
            change: change,
            percent: percent
        };
    },
    
    getAssetsDetails(assets) {
        // Grupuj i sortuj aktywa
        const sorted = [...assets].sort((a, b) => {
            const valA = convertToPLN(a.wartosc, a.waluta);
            const valB = convertToPLN(b.wartosc, b.waluta);
            return valB - valA;
        });
        
        return sorted.map(a => ({
            nazwa: a.nazwa,
            kategoria: a.kategoria,
            podkategoria: a.podkategoria || null,
            wartosc: a.wartosc,
            waluta: a.waluta,
            wartoscPLN: convertToPLN(a.wartosc, a.waluta),
            kontoEmerytalne: a.kontoEmerytalne || null
        }));
    },
    
    getHistoryDetails(snapshots) {
        if (!snapshots || snapshots.length === 0) return [];
        
        // Grupuj po dacie
        const byDate = {};
        snapshots.forEach(s => {
            if (!s.data) return;
            if (!byDate[s.data]) {
                byDate[s.data] = [];
            }
            byDate[s.data].push({
                nazwa: s.nazwa,
                kategoria: s.kategoria,
                wartoscPLN: s.wartoscPLN
            });
        });
        
        return Object.entries(byDate)
            .sort((a, b) => new Date(b[0]) - new Date(a[0]))
            .map(([date, assets]) => ({
                date,
                assets: assets.sort((a, b) => b.wartoscPLN - a.wartoscPLN)
            }));
    },
    
    formatMilestones(milestones, currentNetWorth, metrics) {
        if (!milestones || milestones.length === 0) return [];
        
        const avgGrowth = metrics.avgMonthlyGrowth || 0;
        
        return milestones.map(m => {
            const remaining = m.wartosc - currentNetWorth;
            let monthsToReach = null;
            
            if (!m.isAchieved && avgGrowth > 0 && remaining > 0) {
                monthsToReach = Math.ceil(remaining / avgGrowth);
            }
            
            return {
                target: m.wartosc,
                achieved: m.isAchieved,
                achievedDate: m.achievedDate || null,
                remaining: m.isAchieved ? 0 : remaining,
                monthsToReach: monthsToReach
            };
        });
    },
    
    analyzeStructure(currentData, historyData) {
        const analysis = {
            categoryShares: {},
            currencyExposure: {},
            retirementShare: 0,
            diversification: 'niska',
            liquidityRatio: 0
        };
        
        // Udziały kategorii
        if (currentData.totalAssets > 0) {
            Object.entries(currentData.byCategory).forEach(([kat, data]) => {
                if (kat !== 'Długi') {
                    analysis.categoryShares[kat] = (data.total / currentData.totalAssets) * 100;
                }
            });
        }
        
        // Ekspozycja walutowa
        if (currentData.totalAssets > 0) {
            Object.entries(currentData.byCurrency).forEach(([currency, data]) => {
                analysis.currencyExposure[currency] = (data.totalPLN / currentData.totalAssets) * 100;
            });
        }
        
        // Udział kont emerytalnych
        const retirementTotal = currentData.byRetirementAccount.IKE + currentData.byRetirementAccount.IKZE;
        if (currentData.totalAssets > 0) {
            analysis.retirementShare = (retirementTotal / currentData.totalAssets) * 100;
        }
        
        // Dywersyfikacja
        const categoryCount = Object.keys(currentData.byCategory).filter(k => k !== 'Długi').length;
        if (categoryCount >= 5) analysis.diversification = 'wysoka';
        else if (categoryCount >= 3) analysis.diversification = 'średnia';
        
        // Płynność (gotówka + konta / całość)
        const liquid = (currentData.byCategory['Gotówka']?.total || 0) + 
                       (currentData.byCategory['Konta bankowe']?.total || 0);
        if (currentData.totalAssets > 0) {
            analysis.liquidityRatio = (liquid / currentData.totalAssets) * 100;
        }
        
        // Trend kategorii (jak się zmieniały udziały)
        if (historyData.hasData && historyData.months.length >= 2) {
            const first = historyData.months[0];
            const last = historyData.months[historyData.months.length - 1];
            
            analysis.categoryTrends = {};
            Object.keys(last.byCategory).forEach(kat => {
                const firstVal = first.byCategory[kat] || 0;
                const lastVal = last.byCategory[kat] || 0;
                const firstShare = first.total > 0 ? (firstVal / first.total) * 100 : 0;
                const lastShare = last.total > 0 ? (lastVal / last.total) * 100 : 0;
                analysis.categoryTrends[kat] = {
                    shareChange: lastShare - firstShare,
                    valueChange: lastVal - firstVal
                };
            });
        }
        
        return analysis;
    },
    
    // ═══════════════════════════════════════════════════════════
    // FORMATOWANIE TEKSTU DLA AI - BOGATY KONTEKST
    // ═══════════════════════════════════════════════════════════
    
    formatDataAsText(data) {
        const fmt = (v) => v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtPLN = (v) => fmt(v) + ' PLN';
        const fmtPct = (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
        const fmtChange = (v, p) => `${v >= 0 ? '+' : ''}${fmtPLN(v)} (${fmtPct(p)})`;
        
        let text = '';
        
        // ════════════════════════════════════════════════════════
        // SEKCJA 1: PRZELICZONE METRYKI (PRIORYTET - używaj tych!)
        // ════════════════════════════════════════════════════════
        text += `╔══════════════════════════════════════════════════════════════╗
║  PRZELICZONE METRYKI - UŻYWAJ TYCH WARTOŚCI!                 ║
╚══════════════════════════════════════════════════════════════╝

📅 Data analizy: ${data.today}

💰 WARTOŚCI GŁÓWNE:
• Majątek netto: ${fmtPLN(data.metrics.currentNetWorth)}
• Suma aktywów: ${fmtPLN(data.metrics.totalAssets)}
• Suma długów: ${fmtPLN(data.metrics.totalDebts)}

`;
        
        // Zmiany czasowe
        text += `📈 ZMIANY WARTOŚCI:\n`;
        
        if (data.metrics.changeMonthly) {
            const m = data.metrics.changeMonthly;
            text += `• Zmiana miesięczna (${m.from} → ${m.to}): ${fmtChange(m.change, m.percent)}
  - Wartość początkowa: ${fmtPLN(m.fromValue)}
  - Wartość końcowa: ${fmtPLN(m.toValue)}\n`;
        } else {
            text += `• Zmiana miesięczna: BRAK DANYCH (potrzeba min. 2 snapshotów)\n`;
        }
        
        if (data.metrics.change3Months) {
            const m = data.metrics.change3Months;
            text += `• Zmiana 3-miesięczna (${m.from} → ${m.to}): ${fmtChange(m.change, m.percent)}\n`;
        }
        
        if (data.metrics.change6Months) {
            const m = data.metrics.change6Months;
            text += `• Zmiana 6-miesięczna (${m.from} → ${m.to}): ${fmtChange(m.change, m.percent)}\n`;
        }
        
        if (data.metrics.changeYearly) {
            const y = data.metrics.changeYearly;
            text += `• Zmiana roczna (${y.from} → ${y.to}): ${fmtChange(y.change, y.percent)}
  - Wartość rok temu: ${fmtPLN(y.fromValue)}
  - Wartość teraz: ${fmtPLN(y.toValue)}\n`;
        } else {
            text += `• Zmiana roczna: BRAK DANYCH (potrzeba snapshotu sprzed roku)\n`;
        }
        
        // Statystyki
        text += `\n📊 STATYSTYKI:\n`;
        
        if (data.metrics.avgMonthlyGrowth !== null) {
            text += `• Średni miesięczny przyrost: ${fmtChange(data.metrics.avgMonthlyGrowth, data.metrics.avgMonthlyGrowthPercent || 0)}\n`;
        }
        
        if (data.metrics.bestMonth) {
            text += `• Najlepszy miesiąc: ${data.metrics.bestMonth.date} → ${fmtChange(data.metrics.bestMonth.change, data.metrics.bestMonth.percent)}\n`;
        }
        
        if (data.metrics.worstMonth) {
            text += `• Najgorszy miesiąc: ${data.metrics.worstMonth.date} → ${fmtChange(data.metrics.worstMonth.change, data.metrics.worstMonth.percent)}\n`;
        }
        
        if (data.metrics.volatility !== null) {
            text += `• Zmienność (odch. std.): ${data.metrics.volatility.toFixed(1)}%\n`;
        }
        
        if (data.metrics.growthTrend) {
            text += `• Trend wzrostu: ${data.metrics.growthTrend.direction}
  - Średnia ostatnie 3 mies.: ${fmtPLN(data.metrics.growthTrend.recent)}/mies.
  - Średnia wcześniejsze 3 mies.: ${fmtPLN(data.metrics.growthTrend.earlier)}/mies.\n`;
        }
        
        // ════════════════════════════════════════════════════════
        // SEKCJA 2: STRUKTURA MAJĄTKU
        // ════════════════════════════════════════════════════════
        text += `
╔══════════════════════════════════════════════════════════════╗
║  STRUKTURA MAJĄTKU                                           ║
╚══════════════════════════════════════════════════════════════╝

📂 PODZIAŁ NA KATEGORIE:\n`;
        
        Object.entries(data.current.byCategory)
            .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
            .forEach(([kat, info]) => {
                const share = data.structure.categoryShares[kat];
                const shareStr = share ? ` (${share.toFixed(1)}% portfela)` : '';
                text += `• ${kat}: ${fmtPLN(info.total)}${shareStr} [${info.count} pozycji]\n`;
            });
        
        text += `\n💱 EKSPOZYCJA WALUTOWA:\n`;
        Object.entries(data.current.byCurrency)
            .sort((a, b) => b[1].totalPLN - a[1].totalPLN)
            .forEach(([currency, info]) => {
                const share = data.structure.currencyExposure[currency] || 0;
                text += `• ${currency}: ${fmt(info.total)} ${currency} = ${fmtPLN(info.totalPLN)} (${share.toFixed(1)}%)\n`;
            });
        
        text += `\n🏦 KONTA EMERYTALNE:\n`;
        text += `• IKE: ${fmtPLN(data.current.byRetirementAccount.IKE)}\n`;
        text += `• IKZE: ${fmtPLN(data.current.byRetirementAccount.IKZE)}\n`;
        text += `• Poza kontami emery.: ${fmtPLN(data.current.byRetirementAccount.none)}\n`;
        text += `• Udział kont emerytalnych: ${data.structure.retirementShare.toFixed(1)}%\n`;
        
        text += `\n📋 ANALIZA STRUKTURY:\n`;
        text += `• Dywersyfikacja: ${data.structure.diversification}\n`;
        text += `• Płynność (gotówka+konta/całość): ${data.structure.liquidityRatio.toFixed(1)}%\n`;
        
        // ════════════════════════════════════════════════════════
        // SEKCJA 3: SZCZEGÓŁOWA LISTA AKTYWÓW
        // ════════════════════════════════════════════════════════
        text += `
╔══════════════════════════════════════════════════════════════╗
║  SZCZEGÓŁOWA LISTA AKTYWÓW (${data.assetsDetails.length} pozycji)                     ║
╚══════════════════════════════════════════════════════════════╝
`;
        
        // Grupuj po kategorii dla czytelności
        const byCategory = {};
        data.assetsDetails.forEach(a => {
            if (!byCategory[a.kategoria]) byCategory[a.kategoria] = [];
            byCategory[a.kategoria].push(a);
        });
        
        Object.entries(byCategory).forEach(([kat, assets]) => {
            text += `\n${kat}:\n`;
            assets.forEach(a => {
                let details = `  • ${a.nazwa}: ${fmtPLN(a.wartoscPLN)}`;
                if (a.waluta !== 'PLN') details += ` (${fmt(a.wartosc)} ${a.waluta})`;
                if (a.kontoEmerytalne) details += ` [${a.kontoEmerytalne}]`;
                if (a.podkategoria) details += ` - ${a.podkategoria}`;
                text += details + '\n';
            });
        });
        
        // ════════════════════════════════════════════════════════
        // SEKCJA 4: HISTORIA (SNAPSHOTY)
        // ════════════════════════════════════════════════════════
        text += `
╔══════════════════════════════════════════════════════════════╗
║  HISTORIA MAJĄTKU (${data.history.monthCount} snapshotów)                            ║
╚══════════════════════════════════════════════════════════════╝
`;
        
        if (data.history.hasData) {
            text += `\n📅 WARTOŚĆ W POSZCZEGÓLNYCH MIESIĄCACH:\n`;
            data.history.months.forEach((m, i) => {
                let line = `${m.date}: ${fmtPLN(m.total)}`;
                if (m.change !== undefined) {
                    line += ` | zmiana: ${fmtChange(m.change, m.changePercent)}`;
                } else {
                    line += ` | (pierwszy snapshot)`;
                }
                text += line + '\n';
            });
            
            // Szczegóły ostatnich snapshotów
            if (data.historyDetails.length > 0) {
                text += `\n📋 SZCZEGÓŁY OSTATNICH SNAPSHOTÓW:\n`;
                const recentSnapshots = data.historyDetails.slice(0, 3); // ostatnie 3
                recentSnapshots.forEach(snapshot => {
                    text += `\n${snapshot.date}:\n`;
                    snapshot.assets.slice(0, 10).forEach(a => { // top 10 aktywów
                        text += `  • ${a.nazwa} (${a.kategoria}): ${fmtPLN(a.wartoscPLN)}\n`;
                    });
                    if (snapshot.assets.length > 10) {
                        text += `  ... i ${snapshot.assets.length - 10} więcej\n`;
                    }
                });
            }
            
            // Trendy kategorii
            if (data.structure.categoryTrends) {
                text += `\n📈 ZMIANY UDZIAŁÓW KATEGORII (od początku historii):\n`;
                Object.entries(data.structure.categoryTrends)
                    .sort((a, b) => Math.abs(b[1].valueChange) - Math.abs(a[1].valueChange))
                    .forEach(([kat, trend]) => {
                        text += `• ${kat}: ${fmtChange(trend.valueChange, 0).split('(')[0].trim()}, udział ${trend.shareChange >= 0 ? '+' : ''}${trend.shareChange.toFixed(1)} p.p.\n`;
                    });
            }
        } else {
            text += `\nBrak snapshotów historycznych. Pierwszy snapshot zostanie utworzony 1-go dnia następnego miesiąca.\n`;
        }
        
        // ════════════════════════════════════════════════════════
        // SEKCJA 5: KAMIENIE MILOWE
        // ════════════════════════════════════════════════════════
        if (data.milestones.length > 0) {
            text += `
╔══════════════════════════════════════════════════════════════╗
║  KAMIENIE MILOWE                                             ║
╚══════════════════════════════════════════════════════════════╝
`;
            data.milestones.forEach(m => {
                if (m.achieved) {
                    text += `✅ ${fmtPLN(m.target)} - OSIĄGNIĘTY`;
                    if (m.achievedDate) text += ` (${m.achievedDate})`;
                    text += '\n';
                } else {
                    text += `⏳ ${fmtPLN(m.target)} - brakuje ${fmtPLN(m.remaining)}`;
                    if (m.monthsToReach) {
                        text += ` (szac. ${m.monthsToReach} mies. przy obecnym tempie)`;
                    }
                    text += '\n';
                }
            });
        }
        
        return text;
    },
    
    // ═══════════════════════════════════════════════════════════
    // SYSTEM PROMPT
    // ═══════════════════════════════════════════════════════════
    
    getSystemPrompt(dataText) {
        return `Jesteś ekspertem od analizy majątku osobistego. Pomagasz użytkownikowi zrozumieć jego finanse.

══════════════════════════════════════════════════════════════
ZASADY ODPOWIADANIA:
══════════════════════════════════════════════════════════════

1. PRIORYTET: Używaj wartości z sekcji "PRZELICZONE METRYKI" - są już obliczone i zweryfikowane.

2. CYTUJ DOKŁADNIE: Podawaj konkretne liczby, daty i procenty z danych.

3. BRAK DANYCH: Jeśli czegoś nie ma w danych, powiedz wprost "brak danych" lub "za mało historii".

4. NIE ZGADUJ: Nie wymyślaj liczb, dat ani trendów które nie wynikają z danych.

5. JĘZYK: Odpowiadaj po polsku, prostym językiem zrozumiałym dla laika.

6. BEZ PORAD: Nie dawaj rekomendacji inwestycyjnych ani finansowych. Tylko analiza faktów.

7. KONTEKST: Masz dostęp do pełnych danych - możesz analizować szczegóły aktywów, strukturę, historię.

══════════════════════════════════════════════════════════════
DANE UŻYTKOWNIKA:
══════════════════════════════════════════════════════════════

${dataText}

══════════════════════════════════════════════════════════════

Odpowiadaj konkretnie i pomocnie. Jeśli użytkownik pyta o coś czego nie ma w danych - powiedz to wprost.`;
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
        
        // Określ zakres
        let scopeInfo = 'Analizuj CAŁY MAJĄTEK.';
        if (options.scope === 'investments') {
            scopeInfo = 'Skup się TYLKO na kategorii "Inwestycje" - ignoruj inne kategorie.';
        } else if (options.scope === 'cash') {
            scopeInfo = 'Skup się TYLKO na kategorii "Gotówka" - ignoruj inne kategorie.';
        } else if (options.scope === 'accounts') {
            scopeInfo = 'Skup się TYLKO na kategorii "Konta bankowe" - ignoruj inne kategorie.';
        }
        
        // Określ okres
        let periodInfo = 'Analizuj całą dostępną historię.';
        if (options.period === '3m') {
            periodInfo = 'Skup się na OSTATNICH 3 MIESIĄCACH.';
        } else if (options.period === '6m') {
            periodInfo = 'Skup się na OSTATNICH 6 MIESIĄCACH.';
        } else if (options.period === '1y') {
            periodInfo = 'Skup się na OSTATNIM ROKU.';
        }
        
        // Buduj listę analiz do wykonania
        const tasks = [];
        if (options.summary) tasks.push('📊 PODSUMOWANIE: Opisz aktualny stan i najważniejsze zmiany wartości. Użyj liczb z sekcji "PRZELICZONE METRYKI".');
        if (options.trends) tasks.push('📈 TRENDY: Czy majątek rośnie/maleje? Jakie jest tempo? Czy trend przyspiesza czy zwalnia?');
        if (options.seasonality) tasks.push('📅 SEZONOWOŚĆ: Czy widać powtarzające się wzorce w poszczególnych miesiącach?');
        if (options.anomalies) tasks.push('⚠️ ANOMALIE: Czy były nietypowo duże zmiany? Które miesiące wyróżniają się?');
        if (options.comparison) tasks.push('🔄 PORÓWNANIE: Porównaj obecny okres z poprzednim (np. ostatnie 3 mies. vs wcześniejsze 3 mies.).');
        
        const userPrompt = `ZADANIE: Przeprowadź analizę majątku użytkownika.

${scopeInfo}
${periodInfo}

WYKONAJ NASTĘPUJĄCE ANALIZY:
${tasks.join('\n')}

WAŻNE:
- Używaj KONKRETNYCH LICZB z danych (nie zaokrąglaj niepotrzebnie)
- Podawaj DATY przy opisie zmian
- Jeśli brakuje danych do jakiejś analizy - napisz to wprost
- Formatuj odpowiedź czytelnie z nagłówkami`;
        
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
                temperature: 0.2,
                max_tokens: 2000
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
                temperature: 0.2,
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
