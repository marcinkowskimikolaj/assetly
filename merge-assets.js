/**
 * Assetly - Merge Assets Module
 * Wspólna logika łączenia duplikatów aktywów
 */

const MergeAssets = {
    
    /**
     * Wykrywa potencjalne duplikaty używając normalizacji nazw
     */
    detectDuplicates(assets) {
        const groups = {};
        
        assets.forEach(asset => {
            const key = this.getAssetKey(asset);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(asset);
        });
        
        // Zwróć tylko grupy z więcej niż 1 aktywem
        const duplicates = [];
        Object.entries(groups).forEach(([key, assetList]) => {
            if (assetList.length > 1) {
                duplicates.push({
                    key: key,
                    normalizedName: this.normalizeAssetName(assetList[0].nazwa),
                    assets: assetList,
                    totalValue: assetList.reduce((sum, a) => sum + a.wartosc, 0),
                    waluta: assetList[0].waluta,
                    kontoEmerytalne: assetList[0].kontoEmerytalne || ''
                });
            }
        });
        
        return duplicates;
    },
    
    /**
     * Normalizuje nazwę aktywa (używa tej samej logiki co sheets.js)
     */
    normalizeAssetName(name) {
        if (!name) return '';
        
        let normalized = name.toLowerCase().trim();
        
        // Usuń ticker z formatu "TICKER - Nazwa" lub "TICKER.XX - Nazwa"
        normalized = normalized.replace(/^[a-z0-9.]+\s*-\s*/i, '');
        
        // Ujednolicenie formatowania
        normalized = normalized
            .replace(/\s+/g, ' ')              // multiple spaces → single space
            .replace(/[-–—]/g, '-')            // unify dashes
            .replace(/[()[\]{}]/g, '')         // remove brackets
            .replace(/[^\w\s-]/g, '');         // remove special chars
        
        return normalized;
    },
    
    /**
     * Generuje klucz dla grupy duplikatów
     */
    getAssetKey(asset) {
        const normalizedName = this.normalizeAssetName(asset.nazwa);
        const konto = (asset.kontoEmerytalne || '').toUpperCase().trim();
        return `${asset.kategoria}|${normalizedName}|${asset.waluta}|${konto}`;
    },
    
    /**
     * Renderuje modal z duplikatami
     */
    renderDuplicatesModal(duplicates, assets, context = 'dashboard') {
        const modalId = context === 'dashboard' ? 'mergeDuplicatesModal' : 'mergeDuplicatesModalInv';
        
        // Zapisz assets dla późniejszego użycia
        this.currentAssets = assets;
        this.currentContext = context;
        
        return `
            <div id="${modalId}" class="modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3 class="modal-title">🔗 Zarządzaj duplikatami</h3>
                        <button class="modal-close" onclick="MergeAssets.closeModal('${context}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="merge-tabs">
                        <button class="merge-tab active" data-tab="auto" onclick="MergeAssets.switchMergeTab('auto', '${context}')">
                            Wykryte automatycznie (${duplicates.length})
                        </button>
                        <button class="merge-tab" data-tab="manual" onclick="MergeAssets.switchMergeTab('manual', '${context}')">
                            Ręczne łączenie
                        </button>
                    </div>
                    
                    <div id="merge-tab-auto-${context}" class="merge-tab-content active">
                        ${this.renderAutoDuplicates(duplicates, context)}
                    </div>
                    
                    <div id="merge-tab-manual-${context}" class="merge-tab-content">
                        ${this.renderManualSelection(assets, context)}
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * Renderuje wykryte automatycznie duplikaty
     */
    renderAutoDuplicates(duplicates, context) {
        if (duplicates.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <p class="empty-state-text">Brak wykrytych duplikatów<br>Wszystkie aktywa mają unikalne nazwy.</p>
                </div>
            `;
        }
        
        return `
            <div class="merge-groups">
                ${duplicates.map((group, groupIndex) => `
                    <div class="merge-group">
                        <div class="merge-group-header">
                            <div class="merge-group-info">
                                <h4>📦 ${escapeHtml(group.normalizedName.toUpperCase())}</h4>
                                <div class="merge-group-meta">
                                    ${group.assets.length} aktywa • 
                                    ${group.waluta} • 
                                    ${group.kontoEmerytalne ? `<span class="retirement-badge ${group.kontoEmerytalne.toLowerCase()}">${group.kontoEmerytalne}</span>` : 'Brak konta'}
                                </div>
                            </div>
                            <div class="merge-group-total">
                                Suma: ${formatCurrency(group.totalValue, group.waluta)}
                            </div>
                        </div>
                        
                        <div class="merge-group-assets">
                            ${group.assets.map((asset, assetIndex) => `
                                <label class="merge-asset-item">
                                    <input type="checkbox" 
                                        class="merge-checkbox" 
                                        data-group="${groupIndex}"
                                        data-asset-id="${asset.id}"
                                        onchange="MergeAssets.updateGroupSelection(${groupIndex}, '${context}')">
                                    <div class="merge-asset-content">
                                        <div class="merge-asset-name">
                                            ${assetIndex === 0 ? '⭐ ' : ''}${escapeHtml(asset.nazwa)}
                                        </div>
                                        <div class="merge-asset-value">
                                            ${formatCurrency(asset.wartosc, asset.waluta)}
                                        </div>
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                        
                        <div class="merge-group-actions">
                            <button class="btn btn-secondary btn-sm" 
                                onclick="MergeAssets.selectAllInGroup(${groupIndex}, '${context}')">
                                Zaznacz wszystkie
                            </button>
                            <button class="btn btn-primary btn-sm" 
                                id="merge-btn-${groupIndex}"
                                onclick="MergeAssets.confirmMerge(${groupIndex}, '${context}')"
                                disabled>
                                Połącz zaznaczone (0)
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    /**
     * Renderuje sekcję ręcznego wyboru
     */
    renderManualSelection(assets, context) {
        // Filtruj tylko aktywa inwestycyjne
        const investmentAssets = assets.filter(a => a.kategoria === 'Inwestycje');
        
        if (investmentAssets.length === 0) {
            return `
                <div class="empty-state">
                    <p class="empty-state-text">Brak aktywów inwestycyjnych do połączenia</p>
                </div>
            `;
        }
        
        return `
            <div class="manual-merge-container">
                <div class="manual-merge-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    Wybierz co najmniej 2 aktywa do połączenia
                </div>
                
                <div class="manual-merge-list">
                    ${investmentAssets.map(asset => `
                        <label class="merge-asset-item">
                            <input type="checkbox" 
                                class="merge-checkbox-manual" 
                                data-asset-id="${asset.id}"
                                onchange="MergeAssets.updateManualSelection('${context}')">
                            <div class="merge-asset-content">
                                <div class="merge-asset-name">
                                    ${escapeHtml(asset.nazwa)}
                                    ${asset.kontoEmerytalne ? `<span class="retirement-badge ${asset.kontoEmerytalne.toLowerCase()}">${asset.kontoEmerytalne}</span>` : ''}
                                </div>
                                <div class="merge-asset-value">
                                    ${formatCurrency(asset.wartosc, asset.waluta)}
                                </div>
                            </div>
                        </label>
                    `).join('')}
                </div>
                
                <div class="manual-merge-actions">
                    <button class="btn btn-primary" 
                        id="manual-merge-btn-${context}"
                        onclick="MergeAssets.confirmManualMerge('${context}')"
                        disabled>
                        Połącz zaznaczone (0)
                    </button>
                </div>
            </div>
        `;
    },
    
    /**
     * Przełącza taby w modalu merge
     */
    switchMergeTab(tabName, context) {
        // Update buttons
        document.querySelectorAll('.merge-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update content
        document.querySelectorAll(`[id^="merge-tab-"]`).forEach(content => {
            const isActive = content.id === `merge-tab-${tabName}-${context}`;
            content.classList.toggle('active', isActive);
        });
    },
    
    /**
     * Aktualizuje licznik zaznaczonych w grupie
     */
    updateGroupSelection(groupIndex, context) {
        const checkboxes = document.querySelectorAll(`input[data-group="${groupIndex}"]`);
        const checked = Array.from(checkboxes).filter(cb => cb.checked);
        const button = document.getElementById(`merge-btn-${groupIndex}`);
        
        if (button) {
            button.disabled = checked.length < 2;
            button.textContent = `Połącz zaznaczone (${checked.length})`;
        }
    },
    
    /**
     * Zaznacza wszystkie aktywa w grupie
     */
    selectAllInGroup(groupIndex, context) {
        const checkboxes = document.querySelectorAll(`input[data-group="${groupIndex}"]`);
        checkboxes.forEach(cb => cb.checked = true);
        this.updateGroupSelection(groupIndex, context);
    },
    
    /**
     * Aktualizuje licznik dla ręcznego wyboru
     */
    updateManualSelection(context) {
        const checkboxes = document.querySelectorAll('.merge-checkbox-manual');
        const checked = Array.from(checkboxes).filter(cb => cb.checked);
        const button = document.getElementById(`manual-merge-btn-${context}`);
        
        if (button) {
            button.disabled = checked.length < 2;
            button.textContent = `Połącz zaznaczone (${checked.length})`;
        }
    },
    
    /**
     * Potwierdza merge dla grupy (auto)
     */
    async confirmMerge(groupIndex, context) {
        const checkboxes = document.querySelectorAll(`input[data-group="${groupIndex}"]:checked`);
        const assetIds = Array.from(checkboxes).map(cb => cb.dataset.assetId);
        
        if (assetIds.length < 2) {
            window.showToast('Wybierz co najmniej 2 aktywa do połączenia', 'warning');
            return;
        }
        
        await this.showPrimaryAssetChoice(assetIds, context, this.currentAssets);
    },
    
    /**
     * Potwierdza merge dla ręcznego wyboru
     */
    async confirmManualMerge(context) {
        const checkboxes = document.querySelectorAll('.merge-checkbox-manual:checked');
        const assetIds = Array.from(checkboxes).map(cb => cb.dataset.assetId);
        
        if (assetIds.length < 2) {
            window.showToast('Wybierz co najmniej 2 aktywa do połączenia', 'warning');
            return;
        }
        
        // Walidacja - czy mają tę samą walutę i konto?
        let assetsToMerge;
        if (context === 'dashboard') {
            assetsToMerge = this.currentAssets.filter(a => assetIds.includes(a.id));
        } else {
            assetsToMerge = this.currentAssets.filter(a => assetIds.includes(a.id));
        }
        
        const currencies = [...new Set(assetsToMerge.map(a => a.waluta))];
        const accounts = [...new Set(assetsToMerge.map(a => a.kontoEmerytalne || ''))];
        
        if (currencies.length > 1) {
            window.showToast('Nie można połączyć aktywów w różnych walutach', 'error');
            return;
        }
        
        if (accounts.length > 1) {
            window.showToast('Nie można połączyć aktywów z różnych kont (IKE/IKZE/Brak)', 'error');
            return;
        }
        
        await this.showPrimaryAssetChoice(assetIds, context, this.currentAssets);
    },
    
    /**
     * Pokazuje dialog wyboru głównego aktywa
     */
    async showPrimaryAssetChoice(assetIds, context, assetsArray) {
        // Użyj przekazanej tablicy assets
        const assetsToMerge = assetsArray.filter(a => assetIds.includes(a.id));
        
        const totalValue = assetsToMerge.reduce((sum, a) => sum + a.wartosc, 0);
        const waluta = assetsToMerge[0].waluta;
        
        const html = `
            <div id="primaryAssetModal" class="modal active">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Wybierz główne aktywo</h3>
                    </div>
                    
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">
                        Które aktywo zachować? Jego nazwa i notatki zostaną użyte w połączonym aktywie.
                    </p>
                    
                    <div class="primary-asset-choices">
                        ${assetsToMerge.map((asset, index) => `
                            <label class="primary-asset-choice">
                                <input type="radio" name="primary" value="${asset.id}" ${index === 0 ? 'checked' : ''}>
                                <div class="primary-asset-info">
                                    <div class="primary-asset-name">${index === 0 ? '⭐ ' : ''}${escapeHtml(asset.nazwa)}</div>
                                    <div class="primary-asset-meta">${formatCurrency(asset.wartosc, asset.waluta)}</div>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                    
                    <div class="merge-preview">
                        <h4>Podgląd połączenia:</h4>
                        <div class="merge-preview-items">
                            <div class="merge-preview-item">
                                <span>Wartość:</span>
                                <strong>${formatCurrency(totalValue, waluta)} (suma ${assetsToMerge.length} aktywów)</strong>
                            </div>
                            <div class="merge-preview-item">
                                <span>Waluta:</span>
                                <strong>${waluta}</strong>
                            </div>
                            <div class="merge-preview-item">
                                <span>Konto:</span>
                                <strong>${assetsToMerge[0].kontoEmerytalne || 'Brak'}</strong>
                            </div>
                            <div class="merge-preview-item">
                                <span>Pozostałe aktywa:</span>
                                <strong>Zostaną usunięte (${assetIds.length - 1})</strong>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="MergeAssets.closePrimaryModal()">
                            Anuluj
                        </button>
                        <button class="btn btn-primary" onclick="MergeAssets.executeMerge('${context}')">
                            Połącz aktywa
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Dodaj modal do body
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        document.body.appendChild(tempDiv.firstElementChild);
        
        // Zapisz context i IDs
        this.pendingMerge = { assetIds, context };
    },
    
    /**
     * Wykonuje merge
     */
    async executeMerge(context) {
        const primaryRadio = document.querySelector('input[name="primary"]:checked');
        if (!primaryRadio) return;
        
        const primaryId = primaryRadio.value;
        const { assetIds } = this.pendingMerge;
        
        try {
            this.closePrimaryModal();
            
            if (context === 'dashboard') {
                window.showLoading(true);
            } else {
                window.showInvestmentsLoading(true);
            }
            
            // Pobierz sheetsAPI
            let api;
            if (context === 'dashboard') {
                api = window.sheetsAPI;
            } else {
                api = window.createSheetsAPI(window.CONFIG.SPREADSHEET_ID);
            }
            
            // Wykonaj merge
            await api.mergeAssets(primaryId, assetIds);
            
            // Odśwież dane
            if (context === 'dashboard') {
                await window.loadAssets();
                this.closeModal(context);
            } else {
                await window.loadInvestmentsData();
                this.closeModal(context);
                if (window.switchTab) {
                    window.switchTab('portfolios'); // Odśwież widok
                }
            }
            
            window.window.showToast(`Pomyślnie połączono ${assetIds.length} aktywów`, 'success');
            
        } catch (error) {
            console.error('Błąd merge:', error);
            window.window.showToast('Nie udało się połączyć aktywów', 'error');
        } finally {
            if (context === 'dashboard') {
                window.showLoading(false);
            } else {
                window.showInvestmentsLoading(false);
            }
        }
    },
    
    /**
     * Zamyka modal wyboru głównego aktywa
     */
    closePrimaryModal() {
        const modal = document.getElementById('primaryAssetModal');
        if (modal) {
            modal.remove();
        }
        this.pendingMerge = null;
    },
    
    /**
     * Zamyka główny modal merge
     */
    closeModal(context) {
        const modalId = context === 'dashboard' ? 'mergeDuplicatesModal' : 'mergeDuplicatesModalInv';
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },
    
    pendingMerge: null,
    currentAssets: [],
    currentContext: null
};
