/**
 * Assetly - Analytics Metrics
 * Obliczenia metryk analitycznych
 */

const AnalyticsMetrics = {
    
    // Oblicz wszystkie metryki dla danego filtra kategorii
    async calculateAllMetrics(categoryFilter = null) {
        const historyData = await AnalyticsSnapshots.getCategorySumsByDate(categoryFilter);
        
        if (historyData.length === 0) {
            return this.getEmptyMetrics();
        }
        
        const currentValue = this.getCurrentValue(historyData);
        const monthAgoValue = this.getValueMonthsAgo(historyData, 1);
        const yearAgoValue = this.getValueMonthsAgo(historyData, 12);
        
        return {
            // Aktualna wartość
            currentValue: currentValue,
            
            // Zmiana m/m
            changeMonthly: this.calculateChange(currentValue, monthAgoValue),
            
            // Zmiana r/r
            changeYearly: this.calculateChange(currentValue, yearAgoValue),
            
            // Średni przyrost miesięczny
            averageMonthlyGrowth: this.calculateAverageGrowth(historyData),
            
            // Najlepszy miesiąc
            bestMonth: this.findBestMonth(historyData),
            
            // Najgorszy miesiąc
            worstMonth: this.findWorstMonth(historyData),
            
            // Tempo wzrostu (%)
            growthRate: this.calculateGrowthRate(historyData),
            
            // Dane do wykresów
            chartData: historyData,
            
            // Zmiany miesięczne
            monthlyChanges: this.calculateMonthlyChanges(historyData)
        };
    },
    
    getEmptyMetrics() {
        return {
            currentValue: 0,
            changeMonthly: { value: 0, percent: 0, hasData: false },
            changeYearly: { value: 0, percent: 0, hasData: false },
            averageMonthlyGrowth: 0,
            bestMonth: null,
            worstMonth: null,
            growthRate: { current: 0, average: 0 },
            chartData: [],
            monthlyChanges: []
        };
    },
    
    getCurrentValue(historyData) {
        if (historyData.length === 0) return 0;
        return historyData[historyData.length - 1].suma;
    },
    
    getValueMonthsAgo(historyData, months) {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() - months);
        const targetMonth = targetDate.toISOString().substring(0, 7);
        
        const entry = historyData.find(d => d.data.startsWith(targetMonth));
        return entry ? entry.suma : null;
    },
    
    calculateChange(currentValue, previousValue) {
        if (previousValue === null || previousValue === undefined) {
            return { value: 0, percent: 0, hasData: false };
        }
        
        const change = currentValue - previousValue;
        const percent = previousValue !== 0 ? (change / previousValue) * 100 : 0;
        
        return {
            value: change,
            percent: percent,
            hasData: true
        };
    },
    
    calculateAverageGrowth(historyData) {
        if (historyData.length < 2) return 0;
        
        let totalGrowth = 0;
        let count = 0;
        
        for (let i = 1; i < historyData.length; i++) {
            const growth = historyData[i].suma - historyData[i - 1].suma;
            totalGrowth += growth;
            count++;
        }
        
        return count > 0 ? totalGrowth / count : 0;
    },
    
    calculateMonthlyChanges(historyData) {
        const changes = [];
        
        for (let i = 1; i < historyData.length; i++) {
            const prev = historyData[i - 1];
            const curr = historyData[i];
            const change = curr.suma - prev.suma;
            const percent = prev.suma !== 0 ? (change / prev.suma) * 100 : 0;
            
            changes.push({
                data: curr.data,
                label: this.formatMonthLabel(curr.data),
                change: change,
                percent: percent,
                valueBefore: prev.suma,
                valueAfter: curr.suma
            });
        }
        
        return changes;
    },
    
    findBestMonth(historyData) {
        const changes = this.calculateMonthlyChanges(historyData);
        if (changes.length === 0) return null;
        
        const best = changes.reduce((max, curr) => 
            curr.change > max.change ? curr : max
        , changes[0]);
        
        return {
            label: best.label,
            data: best.data,
            change: best.change,
            percent: best.percent
        };
    },
    
    findWorstMonth(historyData) {
        const changes = this.calculateMonthlyChanges(historyData);
        if (changes.length === 0) return null;
        
        const worst = changes.reduce((min, curr) => 
            curr.change < min.change ? curr : min
        , changes[0]);
        
        return {
            label: worst.label,
            data: worst.data,
            change: worst.change,
            percent: worst.percent
        };
    },
    
    calculateGrowthRate(historyData) {
        if (historyData.length < 2) {
            return { current: 0, average: 0 };
        }
        
        // Obecne tempo (ostatni miesiąc)
        const lastIndex = historyData.length - 1;
        const currentGrowth = historyData[lastIndex].suma - historyData[lastIndex - 1].suma;
        const currentRate = historyData[lastIndex - 1].suma !== 0 
            ? (currentGrowth / historyData[lastIndex - 1].suma) * 100 
            : 0;
        
        // Średnie tempo
        let totalRate = 0;
        let count = 0;
        
        for (let i = 1; i < historyData.length; i++) {
            if (historyData[i - 1].suma !== 0) {
                const growth = historyData[i].suma - historyData[i - 1].suma;
                totalRate += (growth / historyData[i - 1].suma) * 100;
                count++;
            }
        }
        
        const averageRate = count > 0 ? totalRate / count : 0;
        
        return {
            current: currentRate,
            average: averageRate
        };
    },
    
    // Projekcja osiągnięcia celu
    calculateProjection(currentValue, targetValue, monthlyGrowthRate) {
        if (monthlyGrowthRate <= 0 || currentValue >= targetValue) {
            return null;
        }
        
        // Używamy wzrostu procentowego
        if (monthlyGrowthRate > 0) {
            const growthMultiplier = 1 + (monthlyGrowthRate / 100);
            const months = Math.log(targetValue / currentValue) / Math.log(growthMultiplier);
            return Math.ceil(months);
        }
        
        // Używamy wzrostu absolutnego
        const avgGrowth = currentValue * (monthlyGrowthRate / 100);
        if (avgGrowth <= 0) return null;
        
        return Math.ceil((targetValue - currentValue) / avgGrowth);
    },
    
    // Formatowanie etykiety miesiąca
    formatMonthLabel(dateStr) {
        const date = new Date(dateStr);
        const months = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 
                       'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    },
    
    // Metryki dla konkretnego aktywa
    async calculateAssetMetrics(aktywoId) {
        const history = await AnalyticsSnapshots.getAssetHistory(aktywoId);
        
        if (history.length === 0) {
            return {
                hasData: false,
                currentValue: 0,
                changeFromStart: { value: 0, percent: 0 },
                history: []
            };
        }
        
        const firstValue = history[0].wartoscPLN;
        const currentValue = history[history.length - 1].wartoscPLN;
        const change = currentValue - firstValue;
        const percent = firstValue !== 0 ? (change / firstValue) * 100 : 0;
        
        return {
            hasData: true,
            currentValue: currentValue,
            firstValue: firstValue,
            firstDate: history[0].data,
            changeFromStart: {
                value: change,
                percent: percent
            },
            history: history.map(h => ({
                data: h.data,
                label: this.formatMonthLabel(h.data),
                wartosc: h.wartoscPLN
            }))
        };
    }
};
