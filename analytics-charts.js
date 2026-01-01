/**
 * Assetly - Analytics Charts
 * Wykresy dla modułu Analityka
 */

const AnalyticsCharts = {
    
    // Przechowuj instancje wykresów
    charts: {
        main: null,
        monthly: null,
        asset: null
    },
    
    // Kolory
    colors: {
        primary: '#10B981',
        primaryLight: 'rgba(16, 185, 129, 0.2)',
        negative: '#EF4444',
        negativeLight: 'rgba(239, 68, 68, 0.2)',
        grid: 'rgba(255, 255, 255, 0.1)',
        text: 'rgba(255, 255, 255, 0.7)',
        categories: {
            'Gotówka': '#10B981',
            'Konta bankowe': '#14B8A6',
            'Inwestycje': '#6366F1',
            'Nieruchomości': '#F59E0B',
            'Samochody': '#EC4899',
            'Przedmioty wartościowe': '#8B5CF6',
            'Inne aktywa': '#84CC16',
            'Długi': '#EF4444'
        }
    },
    
    // Wspólne opcje
    getCommonOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(21, 31, 27, 0.95)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255,255,255,0.7)',
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12
                }
            },
            scales: {
                x: {
                    grid: { color: this.colors.grid },
                    ticks: { color: this.colors.text }
                },
                y: {
                    grid: { color: this.colors.grid },
                    ticks: { 
                        color: this.colors.text,
                        callback: (value) => this.formatValue(value)
                    }
                }
            }
        };
    },
    
    // Formatuj wartość na wykresie
    formatValue(value) {
        if (Math.abs(value) >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        }
        if (Math.abs(value) >= 1000) {
            return (value / 1000).toFixed(0) + 'k';
        }
        return value.toFixed(0);
    },
    
    // Formatuj pełną wartość dla tooltip
    formatFullValue(value) {
        return new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value) + ' PLN';
    },
    
    // ═══════════════════════════════════════════════════════════
    // WYKRES GŁÓWNY (liniowy)
    // ═══════════════════════════════════════════════════════════
    
    renderMainChart(canvasId, data, chartType = 'line') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.main) {
            this.charts.main.destroy();
        }
        
        if (data.length === 0) {
            this.showEmptyChart(canvas, 'Brak danych do wyświetlenia');
            return;
        }
        
        const labels = data.map(d => AnalyticsMetrics.formatMonthLabel(d.data));
        const values = data.map(d => d.suma);
        
        const config = {
            type: chartType === 'area' ? 'line' : chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Wartość',
                    data: values,
                    borderColor: this.colors.primary,
                    backgroundColor: chartType === 'area' 
                        ? this.createGradient(ctx, this.colors.primary)
                        : this.colors.primaryLight,
                    borderWidth: 3,
                    fill: chartType === 'area',
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: this.colors.primary,
                    pointBorderColor: '#0A0F0D',
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...this.getCommonOptions(),
                plugins: {
                    ...this.getCommonOptions().plugins,
                    tooltip: {
                        ...this.getCommonOptions().plugins.tooltip,
                        callbacks: {
                            label: (context) => this.formatFullValue(context.raw)
                        }
                    }
                }
            }
        };
        
        this.charts.main = new Chart(ctx, config);
    },
    
    // Wykres warstwowy (area) z kategoriami
    renderStackedAreaChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.main) {
            this.charts.main.destroy();
        }
        
        if (data.length === 0) {
            this.showEmptyChart(canvas, 'Brak danych do wyświetlenia');
            return;
        }
        
        // Zbierz wszystkie kategorie
        const allCategories = new Set();
        data.forEach(d => {
            Object.keys(d.kategorie || {}).forEach(k => allCategories.add(k));
        });
        
        const categories = [...allCategories].filter(c => c !== 'Długi');
        const labels = data.map(d => AnalyticsMetrics.formatMonthLabel(d.data));
        
        const datasets = categories.map(category => ({
            label: category,
            data: data.map(d => d.kategorie?.[category] || 0),
            backgroundColor: this.colors.categories[category] || '#6366F1',
            borderColor: this.colors.categories[category] || '#6366F1',
            borderWidth: 1,
            fill: true
        }));
        
        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                ...this.getCommonOptions(),
                plugins: {
                    ...this.getCommonOptions().plugins,
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: this.colors.text,
                            usePointStyle: true,
                            padding: 16
                        }
                    },
                    tooltip: {
                        ...this.getCommonOptions().plugins.tooltip,
                        mode: 'index',
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${this.formatFullValue(context.raw)}`
                        }
                    }
                },
                scales: {
                    ...this.getCommonOptions().scales,
                    y: {
                        ...this.getCommonOptions().scales.y,
                        stacked: true
                    }
                }
            }
        };
        
        this.charts.main = new Chart(ctx, config);
    },
    
    // ═══════════════════════════════════════════════════════════
    // WYKRES ZMIAN MIESIĘCZNYCH (słupkowy)
    // ═══════════════════════════════════════════════════════════
    
    renderMonthlyChangesChart(canvasId, changes) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }
        
        if (changes.length === 0) {
            this.showEmptyChart(canvas, 'Za mało danych');
            return;
        }
        
        const labels = changes.map(c => c.label);
        const values = changes.map(c => c.change);
        const colors = values.map(v => v >= 0 ? this.colors.primary : this.colors.negative);
        
        const config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Zmiana',
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 4
                }]
            },
            options: {
                ...this.getCommonOptions(),
                plugins: {
                    ...this.getCommonOptions().plugins,
                    tooltip: {
                        ...this.getCommonOptions().plugins.tooltip,
                        callbacks: {
                            label: (context) => {
                                const change = changes[context.dataIndex];
                                const sign = change.change >= 0 ? '+' : '';
                                return `${sign}${this.formatFullValue(change.change)} (${sign}${change.percent.toFixed(1)}%)`;
                            }
                        }
                    }
                }
            }
        };
        
        this.charts.monthly = new Chart(ctx, config);
    },
    
    // ═══════════════════════════════════════════════════════════
    // WYKRES AKTYWA (mały, liniowy)
    // ═══════════════════════════════════════════════════════════
    
    renderAssetChart(canvasId, history) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.asset) {
            this.charts.asset.destroy();
        }
        
        if (history.length === 0) {
            this.showEmptyChart(canvas, 'Brak historii');
            return;
        }
        
        const labels = history.map(h => h.label);
        const values = history.map(h => h.wartosc);
        
        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Wartość',
                    data: values,
                    borderColor: this.colors.primary,
                    backgroundColor: this.colors.primaryLight,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                ...this.getCommonOptions(),
                plugins: {
                    ...this.getCommonOptions().plugins,
                    tooltip: {
                        ...this.getCommonOptions().plugins.tooltip,
                        callbacks: {
                            label: (context) => this.formatFullValue(context.raw)
                        }
                    }
                }
            }
        };
        
        this.charts.asset = new Chart(ctx, config);
    },
    
    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════
    
    createGradient(ctx, color) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, color.replace(')', ', 0.3)').replace('rgb', 'rgba'));
        gradient.addColorStop(1, color.replace(')', ', 0.0)').replace('rgb', 'rgba'));
        return gradient;
    },
    
    showEmptyChart(canvas, message) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    },
    
    // Zniszcz wszystkie wykresy
    destroyAll() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = { main: null, monthly: null, asset: null };
    },
    
    // Filtruj dane po zakresie czasowym
    filterDataByRange(data, range) {
        if (!data || data.length === 0) return data;
        
        const now = new Date();
        let cutoffDate = new Date();
        
        switch (range) {
            case '3m':
                cutoffDate.setMonth(now.getMonth() - 3);
                break;
            case '6m':
                cutoffDate.setMonth(now.getMonth() - 6);
                break;
            case '1y':
                cutoffDate.setFullYear(now.getFullYear() - 1);
                break;
            case 'all':
            default:
                return data;
        }
        
        return data.filter(d => new Date(d.data) >= cutoffDate);
    }
};
