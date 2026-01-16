/**
 * Assetly - Life Module - Subscriptions Tab
 * Zarządzanie subskrypcjami i stałymi opłatami
 */

let allSubscriptions = [];
let editingSubscriptionId = null;

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

async function renderSubscriptionsTab() {
    const container = document.getElementById('life-subscriptions');
    if (!container) return;

    showLifeLoading(true);

    try {
        allSubscriptions = await LifeSheets.getSubscriptions();

        container.innerHTML = '';
        renderSubscriptionsToolbar(container);
        renderSubscriptionsStats(container);
        renderSubscriptionsList(container);
    } catch (error) {
        console.error('Błąd renderowania subskrypcji:', error);
        container.innerHTML = '<div class="error-message">Nie udało się załadować subskrypcji</div>';
    } finally {
        showLifeLoading(false);
    }
}

// ═══════════════════════════════════════════════════════════
// TOOLBAR
// ═══════════════════════════════════════════════════════════

function renderSubscriptionsToolbar(container) {
    const html = `
        <div class="sub-toolbar">
            <div class="sub-toolbar-left">
                <div class="sub-search-wrapper">
                    <svg class="sub-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input type="text" id="subscriptionSearch" class="sub-search-input" placeholder="Szukaj subskrypcji..." oninput="handleSubscriptionSearch()">
                </div>
                
                <select id="subscriptionCategoryFilter" class="sub-select" onchange="handleSubscriptionFilter()">
                    <option value="all">Wszystkie kategorie</option>
                    <option value="streaming">🎬 Streaming</option>
                    <option value="muzyka">🎵 Muzyka</option>
                    <option value="oprogramowanie">💻 Oprogramowanie</option>
                    <option value="gaming">🎮 Gaming</option>
                    <option value="cloud">☁️ Chmura</option>
                    <option value="fitness">💪 Fitness</option>
                    <option value="news">📰 News/Media</option>
                    <option value="inne">📦 Inne</option>
                </select>
                
                <select id="subscriptionStatusFilter" class="sub-select" onchange="handleSubscriptionFilter()">
                    <option value="all">Wszystkie statusy</option>
                    <option value="active">✅ Aktywne</option>
                    <option value="inactive">⏸️ Nieaktywne</option>
                </select>
            </div>
            
            <button class="sub-add-btn" onclick="openAddSubscriptionModal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Dodaj subskrypcję</span>
            </button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

// ═══════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════

function renderSubscriptionsStats(container) {
    const activeSubscriptions = allSubscriptions.filter(s => s.aktywny);

    // Oblicz miesięczny koszt
    let monthlyTotal = 0;
    activeSubscriptions.forEach(s => {
        const amount = s.kwotaPLN || s.kwota;
        switch (s.okresPlatnosci) {
            case 'miesięczny': monthlyTotal += amount; break;
            case 'kwartalny': monthlyTotal += amount / 3; break;
            case 'roczny': monthlyTotal += amount / 12; break;
            default: monthlyTotal += amount;
        }
    });

    const yearlyTotal = monthlyTotal * 12;

    // Znajdź zbliżające się płatności (7 dni)
    const now = new Date();
    const upcomingPayments = activeSubscriptions.filter(s => {
        if (!s.dataNastepnejPlatnosci) return false;
        const date = new Date(s.dataNastepnejPlatnosci);
        const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
    }).length;

    const html = `
        <div class="sub-stats-grid">
            <div class="sub-stat-card" data-color="blue">
                <div class="sub-stat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                </div>
                <div class="sub-stat-content">
                    <span class="sub-stat-label">Miesięcznie</span>
                    <span class="sub-stat-value">${formatCurrency(monthlyTotal)} <small>PLN</small></span>
                </div>
            </div>
            
            <div class="sub-stat-card" data-color="green">
                <div class="sub-stat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                    </svg>
                </div>
                <div class="sub-stat-content">
                    <span class="sub-stat-label">Rocznie</span>
                    <span class="sub-stat-value">${formatCurrency(yearlyTotal)} <small>PLN</small></span>
                </div>
            </div>
            
            <div class="sub-stat-card" data-color="purple">
                <div class="sub-stat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22,4 12,14.01 9,11.01"/>
                    </svg>
                </div>
                <div class="sub-stat-content">
                    <span class="sub-stat-label">Aktywne</span>
                    <span class="sub-stat-value">${activeSubscriptions.length}</span>
                </div>
            </div>
            
            <div class="sub-stat-card ${upcomingPayments > 0 ? 'warning' : ''}" data-color="${upcomingPayments > 0 ? 'orange' : 'gray'}">
                <div class="sub-stat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                </div>
                <div class="sub-stat-content">
                    <span class="sub-stat-label">Płatności w tym tygodniu</span>
                    <span class="sub-stat-value">${upcomingPayments}</span>
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTIONS LIST
// ═══════════════════════════════════════════════════════════

function renderSubscriptionsList(container) {
    const filtered = filterSubscriptions(allSubscriptions);

    if (filtered.length === 0) {
        const html = `
            <div class="sub-empty-state">
                <div class="sub-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                    </svg>
                </div>
                <h3>Brak subskrypcji</h3>
                <p>Dodaj swoje subskrypcje, aby śledzić koszty i daty płatności.</p>
                <button class="sub-empty-btn" onclick="openAddSubscriptionModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Dodaj pierwszą subskrypcję
                </button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
        return;
    }

    const html = `
        <div class="sub-grid">
            ${filtered.map(sub => renderSubscriptionCard(sub)).join('')}
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

function renderSubscriptionCard(sub) {
    const icon = getCategoryIcon(sub.kategoria);
    const statusClass = sub.aktywny ? 'active' : 'inactive';
    const statusText = sub.aktywny ? 'Aktywna' : 'Nieaktywna';

    // Oblicz cenę wg okresu
    let periodText = '';
    switch (sub.okresPlatnosci) {
        case 'miesięczny': periodText = '/ miesiąc'; break;
        case 'kwartalny': periodText = '/ kwartał'; break;
        case 'roczny': periodText = '/ rok'; break;
        default: periodText = '/ miesiąc';
    }

    // Sprawdź czy płatność zbliża się
    let paymentAlert = '';
    if (sub.aktywny && sub.dataNastepnejPlatnosci) {
        const now = new Date();
        const payDate = new Date(sub.dataNastepnejPlatnosci);
        const diffDays = Math.ceil((payDate - now) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            paymentAlert = '<span class="sub-alert danger">Płatność przeterminowana!</span>';
        } else if (diffDays <= 3) {
            paymentAlert = `<span class="sub-alert warning">Za ${diffDays} dni</span>`;
        } else if (diffDays <= 7) {
            paymentAlert = `<span class="sub-alert info">Za ${diffDays} dni</span>`;
        }
    }

    return `
        <div class="sub-card ${statusClass}" onclick="openEditSubscriptionModal('${sub.id}')">
            <div class="sub-card-header">
                <div class="sub-card-icon" style="background: ${getCategoryColor(sub.kategoria)}20; color: ${getCategoryColor(sub.kategoria)}">
                    ${icon}
                </div>
                <div class="sub-card-status ${statusClass}">${statusText}</div>
            </div>
            
            <div class="sub-card-body">
                <h3 class="sub-card-title">${escapeHtml(sub.nazwa)}</h3>
                <p class="sub-card-provider">${escapeHtml(sub.dostawca || sub.kategoria)}</p>
                ${paymentAlert}
            </div>
            
            <div class="sub-card-footer">
                <div class="sub-card-price">
                    <span class="sub-price-amount">${formatCurrency(sub.kwotaPLN || sub.kwota)}</span>
                    <span class="sub-price-currency">PLN</span>
                    <span class="sub-price-period">${periodText}</span>
                </div>
                ${sub.dataNastepnejPlatnosci ? `
                    <div class="sub-card-date">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span>${formatDateShort(sub.dataNastepnejPlatnosci)}</span>
                    </div>
                ` : ''}
            </div>
            
            <button class="sub-card-delete" onclick="event.stopPropagation(); deleteSubscription('${sub.id}')" title="Usuń">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function getCategoryIcon(category) {
    const icons = {
        'streaming': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>',
        'muzyka': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M8 17V5l12-2v12"/></svg>',
        'oprogramowanie': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/></svg>',
        'gaming': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>',
        'cloud': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
        'fitness': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        'news': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>',
        'inne': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    };
    return icons[category] || icons['inne'];
}

function getCategoryColor(category) {
    const colors = {
        'streaming': '#E50914',
        'muzyka': '#1DB954',
        'oprogramowanie': '#0078D4',
        'gaming': '#9146FF',
        'cloud': '#4285F4',
        'fitness': '#FF6B6B',
        'news': '#FF6600',
        'inne': '#6B7280'
    };
    return colors[category] || colors['inne'];
}

function formatDateShort(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function filterSubscriptions(subs) {
    const search = (document.getElementById('subscriptionSearch')?.value || '').toLowerCase();
    const category = document.getElementById('subscriptionCategoryFilter')?.value || 'all';
    const status = document.getElementById('subscriptionStatusFilter')?.value || 'all';

    return subs.filter(sub => {
        const matchesSearch = (sub.nazwa || '').toLowerCase().includes(search) ||
            (sub.dostawca || '').toLowerCase().includes(search);
        const matchesCategory = category === 'all' || sub.kategoria === category;
        const matchesStatus = status === 'all' ||
            (status === 'active' && sub.aktywny) ||
            (status === 'inactive' && !sub.aktywny);
        return matchesSearch && matchesCategory && matchesStatus;
    });
}

function handleSubscriptionSearch() {
    const container = document.getElementById('life-subscriptions');
    const grid = container.querySelector('.sub-grid');
    const empty = container.querySelector('.sub-empty-state');
    if (grid) grid.remove();
    if (empty) empty.remove();

    renderSubscriptionsList(container);
}

function handleSubscriptionFilter() {
    handleSubscriptionSearch();
}

// ═══════════════════════════════════════════════════════════
// MODAL LOGIC
// ═══════════════════════════════════════════════════════════

function openAddSubscriptionModal() {
    editingSubscriptionId = null;
    document.getElementById('subscriptionModalTitle').textContent = 'Dodaj subskrypcję';
    document.getElementById('subscriptionForm').reset();
    document.getElementById('subscriptionId').value = '';
    document.getElementById('subAktywny').checked = true;

    document.getElementById('subscriptionModal').classList.add('active');
}

function openEditSubscriptionModal(id) {
    const sub = allSubscriptions.find(s => s.id === id);
    if (!sub) return;

    editingSubscriptionId = id;
    document.getElementById('subscriptionModalTitle').textContent = 'Edytuj subskrypcję';
    document.getElementById('subscriptionId').value = sub.id;

    document.getElementById('subNazwa').value = sub.nazwa;
    document.getElementById('subDostawca').value = sub.dostawca || '';
    document.getElementById('subKategoria').value = sub.kategoria || 'inne';
    document.getElementById('subKwota').value = sub.kwota;
    document.getElementById('subWaluta').value = sub.waluta || 'PLN';
    document.getElementById('subOkres').value = sub.okresPlatnosci || 'miesięczny';
    document.getElementById('subDataNastepnej').value = sub.dataNastepnejPlatnosci || '';
    document.getElementById('subDataRozpoczecia').value = sub.dataRozpoczecia || '';
    document.getElementById('subAktywny').checked = sub.aktywny;
    document.getElementById('subNotatki').value = sub.notatki || '';

    document.getElementById('subscriptionModal').classList.add('active');
}

function closeSubscriptionModal() {
    document.getElementById('subscriptionModal').classList.remove('active');
    editingSubscriptionId = null;
}

async function handleSaveSubscription(event) {
    event.preventDefault();
    if (!lifeInitialized) return;

    showLifeLoading(true);

    const formData = {
        nazwa: document.getElementById('subNazwa').value,
        dostawca: document.getElementById('subDostawca').value,
        kategoria: document.getElementById('subKategoria').value,
        kwota: parseFloat(document.getElementById('subKwota').value) || 0,
        waluta: document.getElementById('subWaluta').value,
        okresPlatnosci: document.getElementById('subOkres').value,
        dataNastepnejPlatnosci: document.getElementById('subDataNastepnej').value,
        dataRozpoczecia: document.getElementById('subDataRozpoczecia').value,
        aktywny: document.getElementById('subAktywny').checked,
        notatki: document.getElementById('subNotatki').value
    };

    try {
        if (editingSubscriptionId) {
            await LifeSheets.updateSubscription(editingSubscriptionId, formData);
            showToast('Zaktualizowano subskrypcję', 'success');
        } else {
            await LifeSheets.addSubscription(formData);
            showToast('Dodano subskrypcję', 'success');
        }
        closeSubscriptionModal();
        await renderSubscriptionsTab();
    } catch (error) {
        console.error('Błąd zapisu subskrypcji', error);
        showToast('Błąd zapisu', 'error');
    } finally {
        showLifeLoading(false);
    }
}

async function deleteSubscription(id) {
    if (!confirm('Czy na pewno chcesz usunąć tę subskrypcję?')) return;

    showLifeLoading(true);
    try {
        await LifeSheets.deleteSubscription(id);
        showToast('Usunięto subskrypcję', 'success');
        await renderSubscriptionsTab();
    } catch (error) {
        console.error('Błąd usuwania subskrypcji', error);
        showToast('Błąd usuwania', 'error');
    } finally {
        showLifeLoading(false);
    }
}
