/**
 * Assetly - Analytics Snapshots
 * Automatyczne tworzenie snapshotów 1-go dnia miesiąca
 */

const AnalyticsSnapshots = {
    
    // Sprawdź i utwórz snapshot jeśli potrzeba
    async checkAndCreateSnapshot(assets) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        
        // Sprawdź czy mamy snapshot za ten miesiąc
        const hasSnapshot = await AnalyticsSheets.hasSnapshotForMonth(year, month);
        
        if (!hasSnapshot && assets.length > 0) {
            // Utwórz snapshot
            const result = await AnalyticsSheets.createSnapshot(assets);
            if (result) {
                return {
                    created: true,
                    date: result.date,
                    count: result.count
                };
            }
        }
        
        return { created: false };
    },
    
    // Pobierz snapshoty pogrupowane po dacie
    async getSnapshotsByDate() {
        const snapshots = await AnalyticsSheets.getSnapshots();
        const grouped = {};
        
        snapshots.forEach(s => {
            if (!grouped[s.data]) {
                grouped[s.data] = [];
            }
            grouped[s.data].push(s);
        });
        
        return grouped;
    },
    
    // Pobierz sumy per kategoria dla każdej daty
    async getCategorySumsByDate(categoryFilter = null) {
        const snapshots = await AnalyticsSheets.getSnapshots();
        const result = {};
        
        snapshots.forEach(s => {
            // Filtruj po kategorii jeśli podano
            if (categoryFilter && s.kategoria !== categoryFilter) return;
            
            if (!result[s.data]) {
                result[s.data] = {
                    data: s.data,
                    suma: 0,
                    kategorie: {}
                };
            }
            
            result[s.data].suma += s.wartoscPLN;
            
            if (!result[s.data].kategorie[s.kategoria]) {
                result[s.data].kategorie[s.kategoria] = 0;
            }
            result[s.data].kategorie[s.kategoria] += s.wartoscPLN;
        });
        
        // Konwertuj na posortowaną tablicę
        return Object.values(result).sort((a, b) => new Date(a.data) - new Date(b.data));
    },
    
    // Pobierz historię konkretnego aktywa
    async getAssetHistory(aktywoId) {
        const snapshots = await AnalyticsSheets.getSnapshots();
        return snapshots
            .filter(s => s.aktywoId === aktywoId)
            .sort((a, b) => new Date(a.data) - new Date(b.data));
    },
    
    // Pobierz historię aktywów po nazwie (dla aktywów bez stałego ID)
    async getAssetHistoryByName(nazwa, kategoria = null) {
        const snapshots = await AnalyticsSheets.getSnapshots();
        return snapshots
            .filter(s => s.nazwa === nazwa && (!kategoria || s.kategoria === kategoria))
            .sort((a, b) => new Date(a.data) - new Date(b.data));
    },
    
    // Pobierz ostatni snapshot (najnowsza data)
    async getLatestSnapshot() {
        const snapshots = await AnalyticsSheets.getSnapshots();
        if (snapshots.length === 0) return null;
        
        const dates = [...new Set(snapshots.map(s => s.data))];
        const latestDate = dates.sort((a, b) => new Date(b) - new Date(a))[0];
        
        return {
            date: latestDate,
            assets: snapshots.filter(s => s.data === latestDate)
        };
    },
    
    // Pobierz snapshot z przed N miesięcy
    async getSnapshotMonthsAgo(monthsAgo) {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() - monthsAgo);
        const targetMonth = targetDate.toISOString().substring(0, 7); // YYYY-MM
        
        const snapshots = await AnalyticsSheets.getSnapshots();
        const matching = snapshots.filter(s => s.data.startsWith(targetMonth));
        
        if (matching.length === 0) return null;
        
        const date = matching[0].data;
        return {
            date: date,
            assets: matching
        };
    },
    
    // Oblicz sumę dla danego filtra i daty
    calculateSum(snapshots, categoryFilter = null) {
        return snapshots
            .filter(s => !categoryFilter || s.kategoria === categoryFilter)
            .reduce((sum, s) => sum + s.wartoscPLN, 0);
    },
    
    // Oblicz wartość netto (aktywa - długi)
    calculateNetWorth(snapshots) {
        let total = 0;
        snapshots.forEach(s => {
            if (s.kategoria === 'Długi') {
                total -= Math.abs(s.wartoscPLN);
            } else {
                total += s.wartoscPLN;
            }
        });
        return total;
    }
};
