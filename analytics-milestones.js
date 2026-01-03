/**
 * Assetly - Analytics Milestones
 * Zarządzanie kamieniami milowymi z podziałem na kategorie
 */

const AnalyticsMilestones = {
    
    // Mapowanie kategorii na filtry snapshotów
    CATEGORY_MAP: {
        'all': null, // wszystkie
        'Inwestycje': 'Inwestycje',
        'Gotówka': 'Gotówka',
        'Konta bankowe': 'Konta bankowe'
    },
    
    // Etykiety kategorii
    CATEGORY_LABELS: {
        'all': 'Cały majątek',
        'Inwestycje': 'Inwestycje',
        'Gotówka': 'Gotówka',
        'Konta bankowe': 'Konta bankowe'
    },
    
    // Cache dla danych (unikamy wielokrotnego pobierania)
    _cachedMilestones: null,
    _cachedSnapshots: null,
    
    // Wyczyść cache (wywoływane po zmianach)
    clearCache() {
        this._cachedMilestones = null;
        this._cachedSnapshots = null;
    },
    
    // Pobierz wszystkie kamienie milowe ze statusem - ZOPTYMALIZOWANE (jedno zapytanie)
    async getAllMilestonesWithStatus(currentValues, snapshotsFromParent = null) {
        // Pobierz dane tylko raz
        const [allMilestones, snapshots] = await Promise.all([
            AnalyticsSheets.getMilestones(),
            snapshotsFromParent ? Promise.resolve(snapshotsFromParent) : AnalyticsSheets.getSnapshots()
        ]);
        
        // Oblicz growth rate dla każdej kategorii raz
        const growthRates = {};
        for (const kategoria of Object.keys(this.CATEGORY_MAP)) {
            growthRates[kategoria] = this.estimateGrowthRate(snapshots, kategoria);
        }
        
        // Przetwórz wszystkie kategorie bez dodatkowych zapytań
        const result = {};
        for (const kategoria of Object.keys(this.CATEGORY_MAP)) {
            const milestones = allMilestones.filter(m => m.kategoria === kategoria);
            const currentValue = currentValues[kategoria] || 0;
            
            result[kategoria] = milestones.map(m => {
                const isAchieved = m.osiagnietaData || currentValue >= m.wartosc;
                let achievedDate = m.osiagnietaData;
                
                if (isAchieved && !achievedDate) {
                    achievedDate = this.findAchievementDate(m.wartosc, snapshots, kategoria);
                }
                
                let projection = null;
                if (!isAchieved && currentValue > 0) {
                    projection = AnalyticsMetrics.calculateProjection(
                        currentValue, 
                        m.wartosc, 
                        growthRates[kategoria]
                    );
                }
                
                return {
                    wartosc: m.wartosc,
                    kategoria: m.kategoria,
                    isAchieved: isAchieved,
                    achievedDate: achievedDate,
                    projection: projection
                };
            });
        }
        
        return result;
    },
    
    // Znajdź datę osiągnięcia progu w snapshotach
    findAchievementDate(targetValue, snapshots, kategoria = 'all') {
        // Grupuj snapshoty po dacie i oblicz sumy
        const byDate = {};
        const categoryFilter = this.CATEGORY_MAP[kategoria];
        
        snapshots.forEach(s => {
            // Filtruj po kategorii jeśli nie "all"
            if (categoryFilter && s.kategoria !== categoryFilter) return;
            
            if (!byDate[s.data]) byDate[s.data] = 0;
            if (s.kategoria === 'Długi') {
                byDate[s.data] -= Math.abs(s.wartoscPLN);
            } else {
                byDate[s.data] += s.wartoscPLN;
            }
        });
        
        // Znajdź pierwszą datę przekroczenia
        const sortedDates = Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b));
        
        for (const date of sortedDates) {
            if (byDate[date] >= targetValue) {
                return date;
            }
        }
        
        return null;
    },
    
    // Oszacuj średnią stopę wzrostu z snapshotów
    estimateGrowthRate(snapshots, kategoria = 'all') {
        // Grupuj po dacie
        const byDate = {};
        const categoryFilter = this.CATEGORY_MAP[kategoria];
        
        snapshots.forEach(s => {
            // Filtruj po kategorii jeśli nie "all"
            if (categoryFilter && s.kategoria !== categoryFilter) return;
            
            if (!byDate[s.data]) byDate[s.data] = 0;
            if (s.kategoria === 'Długi') {
                byDate[s.data] -= Math.abs(s.wartoscPLN);
            } else {
                byDate[s.data] += s.wartoscPLN;
            }
        });
        
        const dates = Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b));
        if (dates.length < 2) return 2; // Domyślnie 2%
        
        let totalRate = 0;
        let count = 0;
        
        for (let i = 1; i < dates.length; i++) {
            const prev = byDate[dates[i - 1]];
            const curr = byDate[dates[i]];
            if (prev > 0) {
                totalRate += ((curr - prev) / prev) * 100;
                count++;
            }
        }
        
        return count > 0 ? totalRate / count : 2;
    },
    
    // Sprawdź i zaktualizuj osiągnięte kamienie milowe (przyjmuje opcjonalnie już pobrane milestones)
    async checkAndUpdateAchievements(currentValues, milestonesFromParent = null) {
        const milestones = milestonesFromParent || await AnalyticsSheets.getMilestones();
        const today = new Date().toISOString().substring(0, 10);
        const newlyAchieved = [];
        
        for (const m of milestones) {
            const currentValue = currentValues[m.kategoria] || 0;
            if (!m.osiagnietaData && currentValue >= m.wartosc) {
                await AnalyticsSheets.updateMilestoneAchieved(m.wartosc, m.kategoria, today);
                newlyAchieved.push({ wartosc: m.wartosc, kategoria: m.kategoria });
            }
        }
        
        return newlyAchieved;
    },
    
    // Dodaj nowy kamień milowy
    async addMilestone(wartosc, kategoria = 'all') {
        if (wartosc <= 0) {
            throw new Error('Wartość musi być większa od 0');
        }
        
        await AnalyticsSheets.addMilestone(wartosc, kategoria);
        return true;
    },
    
    // Usuń kamień milowy
    async deleteMilestone(wartosc, kategoria) {
        await AnalyticsSheets.deleteMilestone(wartosc, kategoria);
        return true;
    },
    
    // Formatuj projekcję
    formatProjection(months) {
        if (months === null) return 'Nie dotyczy';
        if (months <= 0) return 'Osiągnięty!';
        if (months === 1) return '~1 miesiąc';
        if (months < 12) return `~${months} mies.`;
        
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        
        if (remainingMonths === 0) {
            return years === 1 ? '~1 rok' : `~${years} lata`;
        }
        
        return `~${years} ${years === 1 ? 'rok' : 'lata'} ${remainingMonths} mies.`;
    },
    
    // Formatuj wartość kamienia milowego
    formatMilestoneValue(value) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1).replace('.0', '') + 'M PLN';
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(0) + 'k PLN';
        }
        return value + ' PLN';
    },
    
    // Pobierz etykietę kategorii
    getCategoryLabel(kategoria) {
        return this.CATEGORY_LABELS[kategoria] || kategoria;
    }
};
