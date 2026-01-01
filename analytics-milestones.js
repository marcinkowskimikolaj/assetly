/**
 * Assetly - Analytics Milestones
 * Zarządzanie kamieniami milowymi
 */

const AnalyticsMilestones = {
    
    // Pobierz kamienie milowe z informacją o statusie
    async getMilestonesWithStatus(currentNetWorth) {
        const milestones = await AnalyticsSheets.getMilestones();
        const snapshots = await AnalyticsSheets.getSnapshots();
        
        return milestones.map(m => {
            const isAchieved = m.osiagnietaData || currentNetWorth >= m.wartosc;
            let achievedDate = m.osiagnietaData;
            
            // Jeśli osiągnięty ale bez daty, znajdź datę w snapshotach
            if (isAchieved && !achievedDate) {
                achievedDate = this.findAchievementDate(m.wartosc, snapshots);
            }
            
            // Oblicz projekcję dla nieosiągniętych
            let projection = null;
            if (!isAchieved && currentNetWorth > 0) {
                const avgGrowthRate = this.estimateGrowthRate(snapshots);
                projection = AnalyticsMetrics.calculateProjection(
                    currentNetWorth, 
                    m.wartosc, 
                    avgGrowthRate
                );
            }
            
            return {
                wartosc: m.wartosc,
                isAchieved: isAchieved,
                achievedDate: achievedDate,
                projection: projection
            };
        });
    },
    
    // Znajdź datę osiągnięcia progu w snapshotach
    findAchievementDate(targetValue, snapshots) {
        // Grupuj snapshoty po dacie i oblicz sumy
        const byDate = {};
        snapshots.forEach(s => {
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
    estimateGrowthRate(snapshots) {
        // Grupuj po dacie
        const byDate = {};
        snapshots.forEach(s => {
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
    
    // Sprawdź i zaktualizuj osiągnięte kamienie milowe
    async checkAndUpdateAchievements(currentNetWorth) {
        const milestones = await AnalyticsSheets.getMilestones();
        const today = new Date().toISOString().substring(0, 10);
        const newlyAchieved = [];
        
        for (const m of milestones) {
            if (!m.osiagnietaData && currentNetWorth >= m.wartosc) {
                await AnalyticsSheets.updateMilestoneAchieved(m.wartosc, today);
                newlyAchieved.push(m.wartosc);
            }
        }
        
        return newlyAchieved;
    },
    
    // Dodaj nowy kamień milowy
    async addMilestone(wartosc) {
        if (wartosc <= 0) {
            throw new Error('Wartość musi być większa od 0');
        }
        
        await AnalyticsSheets.addMilestone(wartosc);
        return true;
    },
    
    // Usuń kamień milowy
    async deleteMilestone(wartosc) {
        await AnalyticsSheets.deleteMilestone(wartosc);
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
    }
};
