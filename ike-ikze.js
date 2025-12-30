/**
 * Assetly - Moduł IKE/IKZE
 * Obsługa limitów kont emerytalnych
 */

const IKE_IKZE = {
    // Domyślne limity na 2025 (IKZE dla działalności gospodarczej)
    DEFAULT_LIMITS: {
        IKE: 24805.20,
        IKZE: 12282.60
    },
    
    // Nazwa zakładki z limitami
    SHEET_NAME: 'Limity',
    
    // Cache na limity
    limits: null,
    
    /**
     * Pobiera limity z arkusza lub zwraca domyślne
     */
    async fetchLimits(sheetsAPI) {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: sheetsAPI.spreadsheetId,
                range: `${this.SHEET_NAME}!A2:C10`,
            });
            
            const rows = response.result.values || [];
            const currentYear = new Date().getFullYear();
            
            const limits = {
                IKE: this.DEFAULT_LIMITS.IKE,
                IKZE: this.DEFAULT_LIMITS.IKZE,
                year: currentYear
            };
            
            // Parsuj limity z arkusza
            rows.forEach(row => {
                const typ = (row[0] || '').toUpperCase().trim();
                const limit = parseFloat(row[1]) || 0;
                const rok = parseInt(row[2]) || currentYear;
                
                // Bierz tylko limity z aktualnego roku
                if (rok === currentYear) {
                    if (typ === 'IKE' && limit > 0) {
                        limits.IKE = limit;
                    } else if (typ === 'IKZE' && limit > 0) {
                        limits.IKZE = limit;
                    }
                }
            });
            
            this.limits = limits;
            return limits;
            
        } catch (error) {
            // Zakładka nie istnieje lub błąd - użyj domyślnych
            console.warn('Nie można pobrać limitów IKE/IKZE, używam domyślnych:', error);
            this.limits = {
                IKE: this.DEFAULT_LIMITS.IKE,
                IKZE: this.DEFAULT_LIMITS.IKZE,
                year: new Date().getFullYear()
            };
            return this.limits;
        }
    },
    
    /**
     * Oblicza wykorzystanie IKE/IKZE na podstawie aktywów
     */
    calculateUsage(assets) {
        const currentYear = new Date().getFullYear();
        
        const usage = {
            IKE: 0,
            IKZE: 0
        };
        
        assets.forEach(asset => {
            const konto = (asset.kontoEmerytalne || '').toUpperCase().trim();
            
            // Bierz tylko aktywa z bieżącego roku (sprawdź timestamp)
            const assetYear = asset.timestamp ? new Date(asset.timestamp).getFullYear() : currentYear;
            
            if (assetYear === currentYear) {
                if (konto === 'IKE') {
                    usage.IKE += convertToPLN(asset.wartosc, asset.waluta);
                } else if (konto === 'IKZE') {
                    usage.IKZE += convertToPLN(asset.wartosc, asset.waluta);
                }
            }
        });
        
        return usage;
    },
    
    /**
     * Oblicza procent wykorzystania
     */
    calculatePercentage(used, limit) {
        if (limit <= 0) return 0;
        return Math.min((used / limit) * 100, 100);
    },
    
    /**
     * Zwraca kolor progress bara na podstawie procentu
     */
    getProgressColor(percentage) {
        if (percentage >= 100) return 'var(--error)';
        if (percentage >= 80) return 'var(--warning)';
        return 'var(--primary)';
    },
    
    /**
     * Oblicza dni do końca roku
     */
    getDaysUntilReset() {
        const now = new Date();
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        const diffTime = endOfYear - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    },
    
    /**
     * Formatuje dni do resetu
     */
    formatDaysUntilReset() {
        const days = this.getDaysUntilReset();
        
        if (days === 0) return 'Ostatni dzień roku!';
        if (days === 1) return 'Pozostał 1 dzień do resetu';
        
        // Polska odmiana
        if (days >= 2 && days <= 4) {
            return `Pozostały ${days} dni do resetu`;
        }
        return `Pozostało ${days} dni do resetu`;
    },
    
    /**
     * Generuje HTML dla sekcji IKE/IKZE
     */
    renderSection(assets) {
        const limits = this.limits || {
            IKE: this.DEFAULT_LIMITS.IKE,
            IKZE: this.DEFAULT_LIMITS.IKZE
        };
        
        const usage = this.calculateUsage(assets);
        
        const ikePercentage = this.calculatePercentage(usage.IKE, limits.IKE);
        const ikzePercentage = this.calculatePercentage(usage.IKZE, limits.IKZE);
        
        const ikeColor = this.getProgressColor(ikePercentage);
        const ikzeColor = this.getProgressColor(ikzePercentage);
        
        const ikeRemaining = Math.max(0, limits.IKE - usage.IKE);
        const ikzeRemaining = Math.max(0, limits.IKZE - usage.IKZE);
        
        return `
            <div class="ike-ikze-item">
                <div class="ike-ikze-header">
                    <span class="ike-ikze-label">IKE</span>
                    <span class="ike-ikze-values">${formatCurrency(usage.IKE)} / ${formatCurrency(limits.IKE)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${ikePercentage}%; background: ${ikeColor}"></div>
                </div>
                <div class="ike-ikze-footer">
                    <span class="ike-ikze-percentage">${ikePercentage.toFixed(1)}%</span>
                    <span class="ike-ikze-remaining">Pozostało: ${formatCurrency(ikeRemaining)}</span>
                </div>
            </div>
            
            <div class="ike-ikze-item">
                <div class="ike-ikze-header">
                    <span class="ike-ikze-label">IKZE</span>
                    <span class="ike-ikze-values">${formatCurrency(usage.IKZE)} / ${formatCurrency(limits.IKZE)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${ikzePercentage}%; background: ${ikzeColor}"></div>
                </div>
                <div class="ike-ikze-footer">
                    <span class="ike-ikze-percentage">${ikzePercentage.toFixed(1)}%</span>
                    <span class="ike-ikze-remaining">Pozostało: ${formatCurrency(ikzeRemaining)}</span>
                </div>
            </div>
            
            <div class="ike-ikze-reset">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12,6 12,12 16,14"/>
                </svg>
                ${this.formatDaysUntilReset()}
            </div>
        `;
    },
    
    /**
     * Sprawdza czy kategoria może mieć konto emerytalne
     */
    canHaveRetirementAccount(kategoria) {
        return kategoria === 'Inwestycje';
    }
};
