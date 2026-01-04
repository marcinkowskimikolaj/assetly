/**
 * Assetly - Budget Metrics
 * Obliczenia metryk, trendów i analiz budżetowych
 */

const BudgetMetrics = {
    
    // ═══════════════════════════════════════════════════════════
    // OBLICZENIA PODSTAWOWE
    // ═══════════════════════════════════════════════════════════
    
    // Oblicz statystyki dla zakresu miesięcy
    calculatePeriodStats(monthlyData) {
        if (!monthlyData || monthlyData.length === 0) {
            return this.getEmptyStats();
        }
        
        const totals = {
            income: 0,
            expenses: 0,
            fixed: 0,
            variable: 0,
            transfers: 0,
            balance: 0
        };
        
        monthlyData.forEach(m => {
            totals.income += m.income.total;
            totals.expenses += m.expenses.total;
            totals.fixed += m.expenses.fixed;
            totals.variable += m.expenses.variable;
            totals.transfers += m.expenses.transfers;
            totals.balance += m.balance;
        });
        
        const count = monthlyData.length;
        
        return {
            total: totals,
            average: {
                income: totals.income / count,
                expenses: totals.expenses / count,
                fixed: totals.fixed / count,
                variable: totals.variable / count,
                transfers: totals.transfers / count,
                balance: totals.balance / count
            },
            count,
            savingsRate: totals.income > 0 ? (totals.balance / totals.income * 100) : 0
        };
    },
    
    getEmptyStats() {
        return {
            total: { income: 0, expenses: 0, fixed: 0, variable: 0, transfers: 0, balance: 0 },
            average: { income: 0, expenses: 0, fixed: 0, variable: 0, transfers: 0, balance: 0 },
            count: 0,
            savingsRate: 0
        };
    },
    
    // ═══════════════════════════════════════════════════════════
    // PORÓWNANIA
    // ═══════════════════════════════════════════════════════════
    
    // Porównaj dwa miesiące
    compareMonths(current, previous) {
        if (!previous) {
            return {
                income: { diff: 0, percent: 0 },
                expenses: { diff: 0, percent: 0 },
                balance: { diff: 0, percent: 0 },
                hasPrevious: false
            };
        }
        
        const calcDiff = (curr, prev) => {
            const diff = curr - prev;
            const percent = prev !== 0 ? (diff / prev * 100) : 0;
            return { diff, percent };
        };
        
        return {
            income: calcDiff(current.income.total, previous.income.total),
            expenses: calcDiff(current.expenses.total, previous.expenses.total),
            balance: calcDiff(current.balance, previous.balance),
            fixed: calcDiff(current.expenses.fixed, previous.expenses.fixed),
            variable: calcDiff(current.expenses.variable, previous.expenses.variable),
            hasPrevious: true
        };
    },
    
    // Porównaj ze średnią
    compareWithAverage(current, averages) {
        const calcDiff = (curr, avg) => {
            const diff = curr - avg;
            const percent = avg !== 0 ? (diff / avg * 100) : 0;
            return { diff, percent, isAbove: diff > 0 };
        };
        
        return {
            income: calcDiff(current.income.total, averages.income),
            expenses: calcDiff(current.expenses.total, averages.expenses),
            balance: calcDiff(current.balance, averages.balance)
        };
    },
    
    // ═══════════════════════════════════════════════════════════
    // ANALIZA KATEGORII
    // ═══════════════════════════════════════════════════════════
    
    // Agreguj wydatki po kategoriach dla wielu miesięcy
    aggregateByCategory(monthlyData) {
        const categories = {};
        
        monthlyData.forEach(month => {
            Object.entries(month.expenses.byCategory).forEach(([cat, data]) => {
                if (!categories[cat]) {
                    categories[cat] = {
                        total: 0,
                        months: [],
                        average: 0
                    };
                }
                categories[cat].total += data.total;
                categories[cat].months.push({
                    rok: month.rok,
                    miesiac: month.miesiac,
                    kwota: data.total
                });
            });
        });
        
        // Oblicz średnie
        Object.keys(categories).forEach(cat => {
            categories[cat].average = categories[cat].total / monthlyData.length;
        });
        
        return categories;
    },
    
    // Znajdź anomalie (wydatki znacząco powyżej średniej)
    findAnomalies(currentMonth, categoryAverages, threshold = 0.15) {
        const anomalies = [];
        
        Object.entries(currentMonth.expenses.byCategory).forEach(([cat, data]) => {
            const avg = categoryAverages[cat]?.average || 0;
            if (avg > 0) {
                const diff = data.total - avg;
                const percent = diff / avg;
                
                if (percent > threshold) {
                    anomalies.push({
                        kategoria: cat,
                        current: data.total,
                        average: avg,
                        diff: diff,
                        percent: percent * 100,
                        severity: percent > 0.5 ? 'high' : percent > 0.25 ? 'medium' : 'low'
                    });
                }
            }
        });
        
        return anomalies.sort((a, b) => b.percent - a.percent);
    },
    
    // Top N kategorii wydatków
    getTopCategories(monthData, n = 5) {
        const categories = Object.entries(monthData.expenses.byCategory)
            .map(([cat, data]) => ({
                kategoria: cat,
                kwota: data.total,
                procent: monthData.expenses.total > 0 
                    ? (data.total / monthData.expenses.total * 100) 
                    : 0,
                icon: BudgetCategories.getCategoryIcon(cat)
            }))
            .sort((a, b) => b.kwota - a.kwota);
        
        return categories.slice(0, n);
    },
    
    // ═══════════════════════════════════════════════════════════
    // TRENDY
    // ═══════════════════════════════════════════════════════════
    
    // Oblicz trend (wzrost/spadek) dla serii danych
    calculateTrend(monthlyData, field = 'balance') {
        if (monthlyData.length < 2) {
            return { slope: 0, direction: 'stable', percentChange: 0 };
        }
        
        // Prosta regresja liniowa
        const values = monthlyData.map((m, i) => ({
            x: i,
            y: field === 'income' ? m.income.total :
               field === 'expenses' ? m.expenses.total :
               m.balance
        }));
        
        const n = values.length;
        const sumX = values.reduce((a, v) => a + v.x, 0);
        const sumY = values.reduce((a, v) => a + v.y, 0);
        const sumXY = values.reduce((a, v) => a + v.x * v.y, 0);
        const sumX2 = values.reduce((a, v) => a + v.x * v.x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const avgY = sumY / n;
        const percentChange = avgY !== 0 ? (slope / avgY * 100) : 0;
        
        return {
            slope,
            direction: slope > 0.01 * avgY ? 'up' : slope < -0.01 * avgY ? 'down' : 'stable',
            percentChange,
            avgValue: avgY
        };
    },
    
    // Trend dla konkretnej kategorii
    calculateCategoryTrend(monthlyData, category) {
        const values = monthlyData.map(m => ({
            rok: m.rok,
            miesiac: m.miesiac,
            kwota: m.expenses.byCategory[category]?.total || 0
        }));
        
        if (values.length < 2) {
            return { trend: 'stable', percentChange: 0, data: values };
        }
        
        const first = values.slice(0, Math.ceil(values.length / 2));
        const second = values.slice(Math.ceil(values.length / 2));
        
        const avgFirst = first.reduce((a, v) => a + v.kwota, 0) / first.length;
        const avgSecond = second.reduce((a, v) => a + v.kwota, 0) / second.length;
        
        const percentChange = avgFirst !== 0 ? ((avgSecond - avgFirst) / avgFirst * 100) : 0;
        
        return {
            trend: percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'stable',
            percentChange,
            avgFirst,
            avgSecond,
            data: values
        };
    },
    
    // ═══════════════════════════════════════════════════════════
    // ANALIZA DOCHODÓW
    // ═══════════════════════════════════════════════════════════
    
    // Historia wynagrodzenia od konkretnego pracodawcy
    getSalaryHistory(incomeData, pracodawca) {
        const salaries = incomeData
            .filter(i => i.pracodawca === pracodawca && i.zrodlo === 'Wynagrodzenie')
            .sort((a, b) => {
                if (a.rok !== b.rok) return a.rok - b.rok;
                return a.miesiac - b.miesiac;
            });
        
        if (salaries.length === 0) {
            return { history: [], raises: [], totalGrowth: 0 };
        }
        
        // Znajdź podwyżki
        const raises = [];
        for (let i = 1; i < salaries.length; i++) {
            const diff = salaries[i].kwotaPLN - salaries[i-1].kwotaPLN;
            if (diff !== 0) {
                raises.push({
                    rok: salaries[i].rok,
                    miesiac: salaries[i].miesiac,
                    kwotaPoprzednia: salaries[i-1].kwotaPLN,
                    kwotaNowa: salaries[i].kwotaPLN,
                    roznica: diff,
                    procent: salaries[i-1].kwotaPLN !== 0 
                        ? (diff / salaries[i-1].kwotaPLN * 100) 
                        : 0
                });
            }
        }
        
        const first = salaries[0].kwotaPLN;
        const last = salaries[salaries.length - 1].kwotaPLN;
        
        return {
            history: salaries,
            raises,
            firstSalary: first,
            currentSalary: last,
            totalGrowth: first !== 0 ? ((last - first) / first * 100) : 0,
            employmentMonths: salaries.length
        };
    },
    
    // Agregacja dochodów po źródłach
    aggregateIncomeBySource(monthlyData) {
        const sources = {};
        
        monthlyData.forEach(month => {
            Object.entries(month.income.bySource).forEach(([src, data]) => {
                if (!sources[src]) {
                    sources[src] = {
                        total: 0,
                        months: 0,
                        average: 0
                    };
                }
                sources[src].total += data.total;
                sources[src].months++;
            });
        });
        
        Object.keys(sources).forEach(src => {
            sources[src].average = sources[src].total / monthlyData.length;
        });
        
        return sources;
    },
    
    // ═══════════════════════════════════════════════════════════
    // METODYKA 50/30/20
    // ═══════════════════════════════════════════════════════════
    
    analyze503020(monthData) {
        const income = monthData.income.total;
        const expenses = monthData.expenses.items.filter(e => !e.jestTransfer);
        
        const grouped = BudgetCategories.groupByMethodology(expenses);
        
        const limits = {
            needs: income * 0.5,
            wants: income * 0.3,
            savings: income * 0.2
        };
        
        return {
            income,
            needs: {
                actual: grouped.needs.total,
                limit: limits.needs,
                percent: income > 0 ? (grouped.needs.total / income * 100) : 0,
                diff: limits.needs - grouped.needs.total,
                status: grouped.needs.total <= limits.needs ? 'ok' : 'over'
            },
            wants: {
                actual: grouped.wants.total,
                limit: limits.wants,
                percent: income > 0 ? (grouped.wants.total / income * 100) : 0,
                diff: limits.wants - grouped.wants.total,
                status: grouped.wants.total <= limits.wants ? 'ok' : 'over'
            },
            savings: {
                actual: monthData.balance,
                limit: limits.savings,
                percent: income > 0 ? (monthData.balance / income * 100) : 0,
                diff: monthData.balance - limits.savings,
                status: monthData.balance >= limits.savings ? 'ok' : 'under'
            }
        };
    },
    
    // ═══════════════════════════════════════════════════════════
    // SEZONOWOŚĆ
    // ═══════════════════════════════════════════════════════════
    
    // Oblicz średnie wydatki per miesiąc roku (sezonowość)
    calculateSeasonality(monthlyData) {
        const byMonth = {};
        
        // Grupuj po miesiącu
        for (let m = 1; m <= 12; m++) {
            byMonth[m] = { expenses: [], income: [], count: 0 };
        }
        
        monthlyData.forEach(data => {
            byMonth[data.miesiac].expenses.push(data.expenses.total);
            byMonth[data.miesiac].income.push(data.income.total);
            byMonth[data.miesiac].count++;
        });
        
        // Oblicz średnie
        const result = {};
        const overallAvgExpenses = monthlyData.reduce((a, m) => a + m.expenses.total, 0) / monthlyData.length;
        
        for (let m = 1; m <= 12; m++) {
            const data = byMonth[m];
            if (data.count > 0) {
                const avgExpenses = data.expenses.reduce((a, v) => a + v, 0) / data.count;
                const avgIncome = data.income.reduce((a, v) => a + v, 0) / data.count;
                
                result[m] = {
                    miesiac: m,
                    nazwa: BudgetCategories.getMonthName(m),
                    avgExpenses,
                    avgIncome,
                    varianceFromAvg: overallAvgExpenses > 0 
                        ? ((avgExpenses - overallAvgExpenses) / overallAvgExpenses * 100) 
                        : 0,
                    dataPoints: data.count
                };
            }
        }
        
        return result;
    },
    
    // Znajdź najdroższy i najtańszy miesiąc
    findSeasonalExtremes(seasonality) {
        const months = Object.values(seasonality);
        if (months.length === 0) return { highest: null, lowest: null };
        
        const highest = months.reduce((max, m) => 
            m.avgExpenses > max.avgExpenses ? m : max
        );
        
        const lowest = months.reduce((min, m) => 
            m.avgExpenses < min.avgExpenses ? m : min
        );
        
        return { highest, lowest };
    },
    
    // ═══════════════════════════════════════════════════════════
    // PROJEKCJE
    // ═══════════════════════════════════════════════════════════
    
    // Projekcja na następny miesiąc
    projectNextMonth(monthlyData, seasonality = null) {
        if (monthlyData.length === 0) {
            return { income: 0, expenses: 0, balance: 0 };
        }
        
        // Średnia z ostatnich 3 miesięcy
        const recent = monthlyData.slice(-3);
        const avgIncome = recent.reduce((a, m) => a + m.income.total, 0) / recent.length;
        const avgExpenses = recent.reduce((a, m) => a + m.expenses.total, 0) / recent.length;
        
        // Uwzględnij sezonowość jeśli dostępna
        let projectedExpenses = avgExpenses;
        if (seasonality) {
            const lastMonth = monthlyData[monthlyData.length - 1];
            const nextMonthNum = lastMonth.miesiac === 12 ? 1 : lastMonth.miesiac + 1;
            
            if (seasonality[nextMonthNum]) {
                const seasonalFactor = 1 + (seasonality[nextMonthNum].varianceFromAvg / 100);
                projectedExpenses = avgExpenses * seasonalFactor;
            }
        }
        
        return {
            income: avgIncome,
            expenses: projectedExpenses,
            balance: avgIncome - projectedExpenses,
            basedOnMonths: recent.length
        };
    },
    
    // Projekcja roczna
    projectYearly(monthlyData, currentYearMonths) {
        const completed = currentYearMonths.length;
        const remaining = 12 - completed;
        
        if (completed === 0) {
            return null;
        }
        
        // Suma YTD
        const ytdIncome = currentYearMonths.reduce((a, m) => a + m.income.total, 0);
        const ytdExpenses = currentYearMonths.reduce((a, m) => a + m.expenses.total, 0);
        
        // Średnia miesięczna YTD
        const avgMonthlyIncome = ytdIncome / completed;
        const avgMonthlyExpenses = ytdExpenses / completed;
        
        return {
            ytd: {
                income: ytdIncome,
                expenses: ytdExpenses,
                balance: ytdIncome - ytdExpenses,
                months: completed
            },
            projected: {
                income: ytdIncome + (avgMonthlyIncome * remaining),
                expenses: ytdExpenses + (avgMonthlyExpenses * remaining),
                balance: (ytdIncome + avgMonthlyIncome * remaining) - (ytdExpenses + avgMonthlyExpenses * remaining),
                remainingMonths: remaining
            },
            averages: {
                income: avgMonthlyIncome,
                expenses: avgMonthlyExpenses,
                balance: avgMonthlyIncome - avgMonthlyExpenses
            }
        };
    },
    
    // ═══════════════════════════════════════════════════════════
    // BUFOR AWARYJNY
    // ═══════════════════════════════════════════════════════════
    
    calculateEmergencyFund(avgMonthlyExpenses, currentSavings, targetMonths = 6) {
        const target = avgMonthlyExpenses * targetMonths;
        const currentMonths = avgMonthlyExpenses > 0 ? (currentSavings / avgMonthlyExpenses) : 0;
        
        return {
            target,
            current: currentSavings,
            currentMonths: currentMonths,
            targetMonths,
            diff: target - currentSavings,
            progress: target > 0 ? (currentSavings / target * 100) : 0,
            isComplete: currentSavings >= target
        };
    },
    
    // Ile miesięcy do celu przy obecnym tempie oszczędzania
    monthsToEmergencyFund(avgMonthlySavings, currentSavings, avgMonthlyExpenses, targetMonths = 6) {
        const target = avgMonthlyExpenses * targetMonths;
        const remaining = target - currentSavings;
        
        if (remaining <= 0) return 0;
        if (avgMonthlySavings <= 0) return null; // Nie da się osiągnąć
        
        return Math.ceil(remaining / avgMonthlySavings);
    }
};
