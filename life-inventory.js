/**
 * Assetly - Life Module - Inventory Tab
 * Logika i obsługa zakładki Inwentarz (Sprint 3)
 * Pełna przebudowa UI v2.0
 */

let allInventory = [];
let inventoryInfo = {
    viewMode: 'grid', // 'grid' | 'list'
    filterCategory: 'all',
    filterRoom: 'all',
    sortBy: 'value-desc'
};
let editingInventoryId = null;

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

async function renderInventoryTab() {
    const container = document.getElementById('life-inventory');
    if (!container) return;

    showLifeLoading(true);

    try {
        allInventory = await LifeSheets.getInventoryItems();
        if (typeof allProperties === 'undefined' || allProperties.length === 0) {
            allProperties = await LifeSheets.getProperties();
        }

        container.innerHTML = '';
        renderInventoryToolbar(container);
        renderInventoryStats(container);
        renderInventoryContent(container);
    } catch (error) {
        console.error('Błąd renderowania inwentarza:', error);
        container.innerHTML = '<div class="error-message">Nie udało się załadować inwentarza</div>';
    } finally {
        showLifeLoading(false);
    }
}

// ═══════════════════════════════════════════════════════════
// TOOLBAR - KOMPLETNIE PRZEBUDOWANY
// ═══════════════════════════════════════════════════════════

function renderInventoryToolbar(container) {
    const toolbarHtml = `
        <div id="inventory-toolbar" class="inv-toolbar">
            <div class="inv-toolbar-row">
                <div class="inv-search-wrapper">
                    <svg class="inv-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input type="text" id="inventorySearch" class="inv-search-input" placeholder="Szukaj przedmiotów..." oninput="handleInventorySearch()">
                </div>
                
                <div class="inv-filters">
                    <select id="inventoryCategoryFilter" class="inv-select" onchange="handleInventoryFilter()">
                        <option value="all">Wszystkie kategorie</option>
                        <option value="Elektronika">📱 Elektronika</option>
                        <option value="Meble">🪑 Meble</option>
                        <option value="RTV/AGD">📺 RTV / AGD</option>
                        <option value="Sport">⚽ Sport</option>
                        <option value="Narzędzia">🔧 Narzędzia</option>
                        <option value="Kolekcje">💎 Kolekcje</option>
                        <option value="Jubilerstwo">💍 Jubilerstwo</option>
                        <option value="Sztuka">🎨 Sztuka</option>
                        <option value="Inne">📦 Inne</option>
                    </select>
                    
                    <select id="inventoryRoomFilter" class="inv-select" onchange="handleInventoryFilter()">
                        <option value="all">Wszystkie pomieszczenia</option>
                    </select>
                    
                    <select id="inventorySortFilter" class="inv-select" onchange="handleInventorySort()">
                        <option value="value-desc">💰 Najwyższa wartość</option>
                        <option value="value-asc">💵 Najniższa wartość</option>
                        <option value="name-asc">🔤 Nazwa (A-Z)</option>
                        <option value="date-desc">📅 Najnowsze</option>
                    </select>
                </div>
                
                <div class="inv-toolbar-actions">
                    <div class="inv-view-toggle">
                        <button id="btn-view-grid" class="inv-view-btn ${inventoryInfo.viewMode === 'grid' ? 'active' : ''}" onclick="setInventoryView('grid')" title="Widok siatki">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                                <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                                <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                                <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                            </svg>
                        </button>
                        <button id="btn-view-list" class="inv-view-btn ${inventoryInfo.viewMode === 'list' ? 'active' : ''}" onclick="setInventoryView('list')" title="Widok listy">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="8" y1="6" x2="21" y2="6"></line>
                                <line x1="8" y1="12" x2="21" y2="12"></line>
                                <line x1="8" y1="18" x2="21" y2="18"></line>
                                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                <line x1="3" y1="18" x2="3.01" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    <button class="inv-add-btn" onclick="openAddInventoryModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        <span>Dodaj przedmiot</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', toolbarHtml);
    populateRoomFilter();
}

function populateRoomFilter() {
    const select = document.getElementById('inventoryRoomFilter');
    if (!select) return;

    const rooms = new Set();
    if (typeof allProperties !== 'undefined' && allProperties.length > 0) {
        allProperties.forEach(p => {
            if (Array.isArray(p.pomieszczenia)) {
                p.pomieszczenia.forEach(r => {
                    let roomName = null;
                    if (typeof r === 'string') {
                        roomName = r;
                    } else if (r && typeof r === 'object') {
                        roomName = r.name || r.nazwa || r.roomName;
                    }
                    if (roomName && roomName.trim()) {
                        rooms.add(roomName.trim());
                    }
                });
            }
        });
    }

    const sortedRooms = Array.from(rooms).sort((a, b) => a.localeCompare(b, 'pl'));

    sortedRooms.forEach(room => {
        const opt = document.createElement('option');
        opt.value = room;
        opt.textContent = `🏠 ${room}`;
        select.appendChild(opt);
    });
}

// ═══════════════════════════════════════════════════════════
// STATS - PRZEBUDOWANE Z IKONAMI SVG
// ═══════════════════════════════════════════════════════════

function renderInventoryStats(container) {
    const totalCount = allInventory.length;
    const totalValue = allInventory.reduce((sum, item) => sum + (item.wartoscBiezaca || item.wartoscPLN || 0), 0);

    const mostValuable = allInventory.length > 0
        ? [...allInventory].sort((a, b) => (b.wartoscBiezaca || b.wartoscPLN) - (a.wartoscBiezaca || a.wartoscPLN))[0]
        : null;

    const now = new Date();
    const expiringSoon = allInventory.filter(i => {
        if (!i.gwarancjaDo) return false;
        const date = new Date(i.gwarancjaDo);
        const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 30;
    }).length;

    const statsHtml = `
        <div id="inventory-stats" class="inv-stats-grid">
            <div class="inv-stat-card" data-color="blue">
                <div class="inv-stat-icon-wrapper">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                </div>
                <div class="inv-stat-content">
                    <span class="inv-stat-label">Liczba przedmiotów</span>
                    <span class="inv-stat-value">${totalCount}</span>
                </div>
            </div>
            
            <div class="inv-stat-card" data-color="green">
                <div class="inv-stat-icon-wrapper">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                </div>
                <div class="inv-stat-content">
                    <span class="inv-stat-label">Całkowita wartość</span>
                    <span class="inv-stat-value">${formatCurrency(totalValue)} <small>PLN</small></span>
                </div>
            </div>
            
            <div class="inv-stat-card" data-color="gold">
                <div class="inv-stat-icon-wrapper">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                    </svg>
                </div>
                <div class="inv-stat-content">
                    <span class="inv-stat-label">Najcenniejszy</span>
                    <span class="inv-stat-value">${mostValuable ? truncateString(mostValuable.nazwa, 18) : '—'}</span>
                </div>
            </div>
            
            <div class="inv-stat-card ${expiringSoon > 0 ? 'warning' : ''}" data-color="${expiringSoon > 0 ? 'orange' : 'gray'}">
                <div class="inv-stat-icon-wrapper">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                </div>
                <div class="inv-stat-content">
                    <span class="inv-stat-label">Kończące się gwarancje</span>
                    <span class="inv-stat-value">${expiringSoon}</span>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', statsHtml);
}

function truncateString(str, num) {
    if (!str) return '';
    if (str.length <= num) return str;
    return str.slice(0, num) + '...';
}

// ═══════════════════════════════════════════════════════════
// CONTENT - GRID / LIST z obsługą zdjęć
// ═══════════════════════════════════════════════════════════

function renderInventoryContent(container) {
    let contentWrapper = document.getElementById('inventory-content-wrapper');
    if (!contentWrapper) {
        contentWrapper = document.createElement('div');
        contentWrapper.id = 'inventory-content-wrapper';
        container.appendChild(contentWrapper);
    }

    contentWrapper.className = inventoryInfo.viewMode === 'list' ? 'inv-list-view' : 'inv-grid-view';

    const filtered = filterInventory(allInventory);

    if (filtered.length === 0) {
        contentWrapper.innerHTML = `
            <div class="inv-empty-state">
                <div class="inv-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                </div>
                <h3>Brak przedmiotów w inwentarzu</h3>
                <p>Zacznij dodawać przedmioty do swojego inwentarza, aby śledzić ich wartość i gwarancje.</p>
                <button class="inv-empty-btn" onclick="openAddInventoryModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Dodaj pierwszy przedmiot
                </button>
            </div>
        `;
        return;
    }

    if (inventoryInfo.viewMode === 'list') {
        renderInventoryList(contentWrapper, filtered);
    } else {
        renderInventoryGrid(contentWrapper, filtered);
    }
}

function filterInventory(items) {
    const search = (document.getElementById('inventorySearch')?.value || '').toLowerCase();
    const cat = document.getElementById('inventoryCategoryFilter')?.value || 'all';
    const room = document.getElementById('inventoryRoomFilter')?.value || 'all';
    const sortBy = document.getElementById('inventorySortFilter')?.value || 'value-desc';

    let filtered = items.filter(item => {
        const matchesSearch = (item.nazwa || '').toLowerCase().includes(search) ||
            (item.producent || '').toLowerCase().includes(search) ||
            (item.model || '').toLowerCase().includes(search);
        const matchesCat = cat === 'all' || item.kategoria === cat;
        const matchesRoom = room === 'all' || item.idPomieszczenia === room || item.roomName === room;
        return matchesSearch && matchesCat && matchesRoom;
    });

    filtered.sort((a, b) => {
        const valA = a.wartoscBiezaca || a.wartoscPLN || 0;
        const valB = b.wartoscBiezaca || b.wartoscPLN || 0;
        switch (sortBy) {
            case 'value-desc': return valB - valA;
            case 'value-asc': return valA - valB;
            case 'name-asc': return (a.nazwa || '').localeCompare(b.nazwa || '');
            case 'date-desc': return new Date(b.dataZakupu || 0) - new Date(a.dataZakupu || 0);
            default: return 0;
        }
    });

    return filtered;
}

function handleInventorySort() {
    renderInventoryContent(document.getElementById('life-inventory'));
}

function handleInventorySearch() {
    renderInventoryContent(document.getElementById('life-inventory'));
}

function handleInventoryFilter() {
    renderInventoryContent(document.getElementById('life-inventory'));
}

// ═══════════════════════════════════════════════════════════
// GRID VIEW - Premium karty ze zdjęciami
// ═══════════════════════════════════════════════════════════

function renderInventoryGrid(container, items) {
    const html = items.map(item => {
        const categoryIcon = getCategoryIconSVG(item.kategoria);
        const hasImage = item.zdjecie || item.imageUrl;
        const imageStyle = hasImage ? `background-image: url('${item.zdjecie || item.imageUrl}')` : '';

        return `
            <div class="inv-card" onclick="openEditInventoryModal('${item.id}')">
                <div class="inv-card-image ${hasImage ? 'has-image' : ''}" style="${imageStyle}">
                    ${!hasImage ? `
                        <div class="inv-card-placeholder">
                            ${categoryIcon}
                        </div>
                    ` : ''}
                    <div class="inv-card-badges">
                        <span class="inv-card-category">${item.kategoria}</span>
                    </div>
                </div>
                <div class="inv-card-content">
                    <h3 class="inv-card-title">${escapeHtml(item.nazwa)}</h3>
                    <p class="inv-card-subtitle">${escapeHtml(item.producent || '')} ${escapeHtml(item.model || '')}</p>
                    <div class="inv-card-footer">
                        <div class="inv-card-value">
                            <span class="inv-card-price">${formatCurrency(item.wartoscBiezaca || item.wartoscPLN)}</span>
                            <span class="inv-card-currency">PLN</span>
                        </div>
                        ${item.pomieszczenie || item.idPomieszczenia ? `
                            <div class="inv-card-location">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                                <span>${item.pomieszczenie || item.idPomieszczenia}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
// LIST VIEW - Nowoczesna tabela
// ═══════════════════════════════════════════════════════════

function renderInventoryList(container, items) {
    const html = `
        <div class="inv-table-wrapper">
            <table class="inv-table">
                <thead>
                    <tr>
                        <th class="inv-th-item">Przedmiot</th>
                        <th>Kategoria</th>
                        <th>Lokalizacja</th>
                        <th>Data zakupu</th>
                        <th class="inv-th-value">Wartość</th>
                        <th class="inv-th-actions"></th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
        const categoryIcon = getCategoryIconSVG(item.kategoria);
        const hasImage = item.zdjecie || item.imageUrl;

        return `
                            <tr onclick="openEditInventoryModal('${item.id}')">
                                <td class="inv-td-item">
                                    <div class="inv-table-item">
                                        <div class="inv-table-thumb ${hasImage ? 'has-image' : ''}" ${hasImage ? `style="background-image: url('${item.zdjecie || item.imageUrl}')"` : ''}>
                                            ${!hasImage ? categoryIcon : ''}
                                        </div>
                                        <div class="inv-table-info">
                                            <span class="inv-table-name">${escapeHtml(item.nazwa)}</span>
                                            <span class="inv-table-details">${escapeHtml(item.producent || '')} ${escapeHtml(item.model || '')}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span class="inv-table-badge">${item.kategoria}</span>
                                </td>
                                <td class="inv-td-location">
                                    ${item.pomieszczenie || item.idPomieszczenia || '—'}
                                </td>
                                <td class="inv-td-date">
                                    ${item.dataZakupu || '—'}
                                </td>
                                <td class="inv-td-value">
                                    <span class="inv-table-price">${formatCurrency(item.wartoscBiezaca || item.wartoscPLN)} PLN</span>
                                </td>
                                <td class="inv-td-actions">
                                    <button class="inv-table-action danger" onclick="event.stopPropagation(); deleteInventoryItem('${item.id}')" title="Usuń">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3,6 5,6 21,6"/>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
// HELPERS - Ikony kategorii jako SVG
// ═══════════════════════════════════════════════════════════

function getCategoryIconSVG(category) {
    const icons = {
        'Elektronika': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
        'Meble': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6a2 2 0 0 0-4 0H6a2 2 0 0 0-4 0Z"/><path d="M4 19v2"/><path d="M20 19v2"/></svg>',
        'RTV/AGD': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17,2 12,7 7,2"/></svg>',
        'Sport': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
        'Narzędzia': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
        'Kolekcje': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>',
        'Jubilerstwo': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="6,3 18,3 22,9 12,22 2,9"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="12" y1="22" x2="6" y2="3"/><line x1="12" y1="22" x2="18" y2="3"/></svg>',
        'Sztuka': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>',
        'Inne': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'
    };
    return icons[category] || icons['Inne'];
}

function getIconForCategory(cat) {
    const map = {
        'Elektronika': 'fa-laptop',
        'Meble': 'fa-couch',
        'RTV/AGD': 'fa-tv',
        'Sport': 'fa-bicycle',
        'Narzędzia': 'fa-tools',
        'Kolekcje': 'fa-gem',
        'Inne': 'fa-box'
    };
    return map[cat] || 'fa-box';
}

function setInventoryView(mode) {
    inventoryInfo.viewMode = mode;

    // Update button states
    document.querySelectorAll('.inv-view-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(mode === 'grid' ? 'btn-view-grid' : 'btn-view-list');
    if (activeBtn) activeBtn.classList.add('active');

    renderInventoryContent(document.getElementById('life-inventory'));
}

// ═══════════════════════════════════════════════════════════
// MODAL LOGIC
// ═══════════════════════════════════════════════════════════

async function openAddInventoryModal() {
    editingInventoryId = null;
    document.getElementById('inventoryModalTitle').textContent = 'Dodaj przedmiot';
    document.getElementById('inventoryForm').reset();
    document.getElementById('inventoryId').value = '';

    if (typeof allProperties === 'undefined' || allProperties.length === 0) {
        try {
            allProperties = await LifeSheets.getProperties();
        } catch (e) {
            console.error('Failed to load properties for modal', e);
        }
    }

    populateInventoryPropertySelect();
    updateInventoryRoomSelect();
    switchInventoryModalTab('info');
    document.getElementById('inventoryModal').classList.add('active');
}

async function openEditInventoryModal(id) {
    const item = allInventory.find(i => i.id === id);
    if (!item) return;

    editingInventoryId = id;
    document.getElementById('inventoryModalTitle').textContent = 'Edytuj przedmiot';
    document.getElementById('inventoryId').value = item.id;

    if (typeof allProperties === 'undefined' || allProperties.length === 0) {
        allProperties = await LifeSheets.getProperties();
    }

    document.getElementById('invName').value = item.nazwa;
    document.getElementById('invCategory').value = item.kategoria;
    document.getElementById('invBrand').value = item.producent || '';
    document.getElementById('invModel').value = item.model || '';
    document.getElementById('invSerial').value = item.numerSeryjny || '';

    populateInventoryPropertySelect();
    document.getElementById('invProperty').value = item.idNieruchomosci || '';
    updateInventoryRoomSelect();
    document.getElementById('invRoom').value = item.idPomieszczenia || '';

    document.getElementById('invPurchaseDate').value = item.dataZakupu || '';
    document.getElementById('invStatus').value = item.stan || 'W użyciu';
    document.getElementById('invPurchasePrice').value = item.wartoscZakupu;
    document.getElementById('invCurrency').value = item.waluta || 'PLN';
    document.getElementById('invCurrentValue').value = item.wartoscBiezaca;
    document.getElementById('invWarrantyDate').value = item.gwarancjaDo || '';

    document.getElementById('invNotes').value = item.notatki || '';

    switchInventoryModalTab('info');
    document.getElementById('inventoryModal').classList.add('active');
}

function closeInventoryModal() {
    document.getElementById('inventoryModal').classList.remove('active');
    editingInventoryId = null;
}

function switchInventoryModalTab(tabName) {
    document.querySelectorAll('#inventoryModal .modal-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#inventoryModal .modal-tab-content').forEach(content => content.classList.remove('active'));

    const btn = Array.from(document.querySelectorAll('#inventoryModal .modal-tab')).find(b =>
        b.onclick.toString().includes(tabName)
    );
    if (btn) btn.classList.add('active');

    document.getElementById(`inv-tab-${tabName}`).classList.add('active');
}

function populateInventoryPropertySelect() {
    const select = document.getElementById('invProperty');
    if (!select) return;

    const currentVal = select.value;

    select.innerHTML = '<option value="">-- wybierz --</option>';
    if (allProperties && allProperties.length > 0) {
        allProperties.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nazwa;
            select.appendChild(opt);
        });
    }

    if (currentVal) select.value = currentVal;
}

function updateInventoryRoomSelect() {
    const propId = document.getElementById('invProperty').value;
    const select = document.getElementById('invRoom');
    if (!select) return;

    select.innerHTML = '<option value="">-- wybierz --</option>';

    if (!propId) {
        select.disabled = true;
        return;
    }

    const prop = allProperties.find(p => p.id === propId);
    if (prop) {
        if (Array.isArray(prop.pomieszczenia) && prop.pomieszczenia.length > 0) {
            select.disabled = false;
            prop.pomieszczenia.forEach(room => {
                const opt = document.createElement('option');
                const roomName = room.name || room;
                opt.value = roomName;
                opt.textContent = roomName;
                select.appendChild(opt);
            });
        } else {
            select.disabled = false;
            select.innerHTML = '<option value="">Brak zdefiniowanych pomieszczeń</option>';
        }
    } else {
        select.disabled = true;
    }
}

async function handleSaveInventory(event) {
    event.preventDefault();
    if (!lifeInitialized) return;

    showLifeLoading(true);

    const formData = {
        nazwa: document.getElementById('invName').value,
        kategoria: document.getElementById('invCategory').value,
        producent: document.getElementById('invBrand').value,
        model: document.getElementById('invModel').value,
        numerSeryjny: document.getElementById('invSerial').value,

        idNieruchomosci: document.getElementById('invProperty').value,
        idPomieszczenia: document.getElementById('invRoom').value,

        dataZakupu: document.getElementById('invPurchaseDate').value,
        wartoscZakupu: parseFloat(document.getElementById('invPurchasePrice').value) || 0,
        waluta: document.getElementById('invCurrency').value,

        wartoscBiezaca: parseFloat(document.getElementById('invCurrentValue').value) || 0,

        stan: document.getElementById('invStatus').value,
        gwarancjaDo: document.getElementById('invWarrantyDate').value,
        notatki: document.getElementById('invNotes').value
    };

    try {
        if (editingInventoryId) {
            await LifeSheets.updateInventoryItem(editingInventoryId, formData);
            showToast('Zaktualizowano przedmiot', 'success');
        } else {
            await LifeSheets.addInventoryItem(formData);
            showToast('Dodano przedmiot', 'success');
        }
        closeInventoryModal();
        await renderInventoryTab();
    } catch (error) {
        console.error('Błąd zapisu inwentarza', error);
        showToast('Błąd zapisu', 'error');
    } finally {
        showLifeLoading(false);
    }
}

function deleteInventoryItem(id) {
    if (confirm('Czy na pewno chcesz usunąć ten przedmiot?')) {
        showLifeLoading(true);
        LifeSheets.deleteInventoryItem(id).then(() => {
            renderInventoryTab();
            showToast('Usunięto przedmiot', 'success');
        }).catch(() => {
            showToast('Błąd usuwania', 'error');
        }).finally(() => {
            showLifeLoading(false);
        });
    }
}
