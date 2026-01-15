/** 
 * Assetly - Life Module - Inventory Tab
 * Logika i obsługa zakładki Inwentarz (Sprint 3)
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
    if (!container) return; // Should not happen if HTML is correct

    showLifeLoading(true);

    try {
        allInventory = await LifeSheets.getInventoryItems();
        // Pre-fetch properties for room mapping if needed
        // (Assuming Properties are already loaded or we load them here)
        if (typeof allProperties === 'undefined' || allProperties.length === 0) {
            allProperties = await LifeSheets.getProperties();
        }

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
// TOOLBAR & STATS
// ═══════════════════════════════════════════════════════════

function renderInventoryToolbar(container) {
    // We want to re-render if it exists to update button states, 
    // but without losing focus on search if possible.
    // For MVP, we'll just check if toolbar needs refresh.

    let toolbar = document.getElementById('inventory-toolbar');
    if (toolbar) {
        // Just update active classes on view buttons
        const viewGrid = document.getElementById('btn-view-grid');
        const viewList = document.getElementById('btn-view-list');
        if (viewGrid && viewList) {
            viewGrid.classList.toggle('active', inventoryInfo.viewMode === 'grid');
            viewList.classList.toggle('active', inventoryInfo.viewMode === 'list');
        }
        return;
    }

    const html = `
        <div id="inventory-toolbar" class="life-toolbar">
            <div class="toolbar-left">
                <div class="search-box">
                    <i class="fas fa-search"></i>
                    <input type="text" id="inventorySearch" placeholder="Szukaj przedmiotu..." oninput="handleInventorySearch()">
                </div>
                <select id="inventoryCategoryFilter" class="form-select" onchange="handleInventoryFilter()">
                    <option value="all">Wszystkie kategorie</option>
                    <option value="Elektronika">Elektronika</option>
                    <option value="Meble">Meble</option>
                    <option value="RTV/AGD">RTV / AGD</option>
                    <option value="Sport">Sport</option>
                    <option value="Narzędzia">Narzędzia</option>
                    <option value="Kolekcje">Kolekcje</option>
                    <option value="Jubilerstwo">Jubilerstwo</option>
                    <option value="Sztuka">Sztuka</option>
                    <option value="Inne">Inne</option>
                </select>
                <select id="inventoryRoomFilter" class="form-select" onchange="handleInventoryFilter()">
                    <option value="all">Wszystkie pomieszczenia</option>
                </select>
                <select id="inventorySortFilter" class="form-select" onchange="handleInventorySort()">
                    <option value="value-desc">Najwyższa wartość</option>
                    <option value="value-asc">Najniższa wartość</option>
                    <option value="name-asc">Nazwa (A-Z)</option>
                    <option value="date-desc">Najnowsze nabytki</option>
                </select>
            </div>
            <div class="toolbar-right">
                <div class="view-toggle">
                    <button id="btn-view-list" class="btn-icon ${inventoryInfo.viewMode === 'list' ? 'active' : ''}" onclick="setInventoryView('list')" title="Widok listy">
                        <i class="fas fa-list"></i>
                    </button>
                    <button id="btn-view-grid" class="btn-icon ${inventoryInfo.viewMode === 'grid' ? 'active' : ''}" onclick="setInventoryView('grid')" title="Widok siatki">
                        <i class="fas fa-th-large"></i>
                    </button>
                </div>
                <button class="btn btn-primary btn-with-icon" onclick="openAddInventoryModal()">
                    <i class="fas fa-plus"></i> Dodaj przedmiot
                </button>
            </div>
        </div>
        <div id="inventory-stats" class="inventory-stats-bar">
            <!-- Stats populated by renderInventoryStats -->
        </div>
        <div id="inventory-grid-container" class="inventory-container"></div>
    `;
    container.innerHTML = html;

    populateRoomFilter();
}

function populateRoomFilter() {
    const select = document.getElementById('inventoryRoomFilter');
    if (!select) return;

    // Collect all unique rooms from Properties
    const rooms = new Set();
    if (typeof allProperties !== 'undefined' && allProperties.length > 0) {
        allProperties.forEach(p => {
            if (Array.isArray(p.pomieszczenia)) {
                p.pomieszczenia.forEach(r => {
                    // Handle different room formats
                    let roomName = null;
                    if (typeof r === 'string') {
                        roomName = r;
                    } else if (r && typeof r === 'object') {
                        // Try different property names
                        roomName = r.name || r.nazwa || r.roomName;
                    }

                    if (roomName && roomName.trim()) {
                        rooms.add(roomName.trim());
                    }
                });
            }
        });
    }

    // Sort rooms alphabetically
    const sortedRooms = Array.from(rooms).sort((a, b) => a.localeCompare(b, 'pl'));

    sortedRooms.forEach(room => {
        const opt = document.createElement('option');
        opt.value = room;
        opt.textContent = room;
        select.appendChild(opt);
    });
}

function renderInventoryStats(container) {
    const statsContainer = document.getElementById('inventory-stats');
    if (!statsContainer) return;

    const totalCount = allInventory.length;
    const totalValue = allInventory.reduce((sum, item) => sum + (item.wartoscBiezaca || item.wartoscPLN || 0), 0);

    // Most expensive
    const mostValuable = allInventory.length > 0
        ? [...allInventory].sort((a, b) => (b.wartoscBiezaca || b.wartoscPLN) - (a.wartoscBiezaca || a.wartoscPLN))[0]
        : null;

    // Warranty logic
    const now = new Date();
    const expiringSoon = allInventory.filter(i => {
        if (!i.gwarancjaDo) return false;
        const date = new Date(i.gwarancjaDo);
        const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 30;
    }).length;

    statsContainer.innerHTML = `
        <div class="inv-stat-card">
            <div class="inv-stat-icon"><i class="fas fa-boxes"></i></div>
            <div class="inv-stat-info">
                <span class="inv-stat-label">Liczba przedmiotów</span>
                <span class="inv-stat-value">${totalCount}</span>
            </div>
        </div>
        <div class="inv-stat-card">
            <div class="inv-stat-icon text-primary"><i class="fas fa-wallet"></i></div>
            <div class="inv-stat-info">
                <span class="inv-stat-label">Całkowita wartość</span>
                <span class="inv-stat-value">${formatCurrency(totalValue)} PLN</span>
            </div>
        </div>
        ${mostValuable ? `
        <div class="inv-stat-card">
            <div class="inv-stat-icon text-accent"><i class="fas fa-crown"></i></div>
            <div class="inv-stat-info">
                <span class="inv-stat-label">Najcenniejszy przedmiot</span>
                <span class="inv-stat-value" title="${mostValuable.nazwa}">${truncateString(mostValuable.nazwa, 12)}</span>
            </div>
        </div>
        ` : ''}
        <div class="inv-stat-card ${expiringSoon > 0 ? 'warning' : ''}">
            <div class="inv-stat-icon"><i class="fas fa-shield-alt"></i></div>
            <div class="inv-stat-info">
                <span class="inv-stat-label">Kończące się gwarancje</span>
                <span class="inv-stat-value">${expiringSoon}</span>
            </div>
        </div>
    `;
}

function truncateString(str, num) {
    if (str.length <= num) return str;
    return str.slice(0, num) + '...';
}

// ═══════════════════════════════════════════════════════════
// CONTENT - GRID / LIST
// ═══════════════════════════════════════════════════════════

function renderInventoryContent(container) {
    const content = document.getElementById('inventory-grid-container');
    if (!content) return;

    // Add fade effect
    content.style.opacity = '0.5';

    content.className = inventoryInfo.viewMode === 'list' ? 'inventory-list-view' : 'inventory-grid-view';

    const filtered = filterInventory(allInventory);

    if (filtered.length === 0) {
        content.innerHTML = `
            <div class="empty-state fade-in">
                <div class="empty-icon"><i class="fas fa-box-open"></i></div>
                <h3>Brak przedmiotów</h3>
                <p>Naciśnij "Dodaj przedmiot", aby rozpocząć inwentaryzację.</p>
            </div>
        `;
        setTimeout(() => content.style.opacity = '1', 50);
        return;
    }

    if (inventoryInfo.viewMode === 'list') {
        renderInventoryList(content, filtered);
    } else {
        renderInventoryGrid(content, filtered);
    }

    // Restore opacity after render
    setTimeout(() => content.style.opacity = '1', 50);
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

    // Sorting
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

function renderInventoryGrid(container, items) {
    const html = items.map(item => `
        <div class="inventory-card" onclick="openEditInventoryModal('${item.id}')">
            <div class="inv-card-img">
                <i class="fas ${getIconForCategory(item.kategoria)}"></i>
            </div>
            <div class="inv-card-body">
                <div class="inv-card-header">
                    <span class="inv-category badge">${item.kategoria}</span>
                    <span class="inv-value">${formatCurrency(item.wartoscBiezaca || item.wartoscPLN)} PLN</span>
                </div>
                <h4 class="inv-title">${escapeHtml(item.nazwa)}</h4>
                <div class="inv-details">
                    <span>${escapeHtml(item.producent || '')} ${escapeHtml(item.model || '')}</span>
                </div>
            </div>
        </div>
    `).join('');
    container.innerHTML = html;
}

function renderInventoryList(container, items) {
    const html = `
        <table class="life-table">
            <thead>
                <tr>
                    <th>Nazwa</th>
                    <th>Kategoria</th>
                    <th>Producent / Model</th>
                    <th>Data Zakupu</th>
                    <th class="text-right">Wartość</th>
                    <th>Akcje</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr onclick="openEditInventoryModal('${item.id}')" style="cursor: pointer;">
                        <td><strong>${escapeHtml(item.nazwa)}</strong></td>
                        <td><span class="badge">${item.kategoria}</span></td>
                        <td>${escapeHtml(item.producent || '')} ${escapeHtml(item.model || '')}</td>
                        <td>${item.dataZakupu || '-'}</td>
                        <td class="text-right">${formatCurrency(item.wartoscBiezaca || item.wartoscPLN)} PLN</td>
                        <td>
                            <button class="btn-icon text-danger" onclick="event.stopPropagation(); deleteInventoryItem('${item.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = html;
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
    // Update active button
    document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
    // (Re-render logic handled by global render)
    renderInventoryTab();
}

// ═══════════════════════════════════════════════════════════
// MODAL LOGIC
// ═══════════════════════════════════════════════════════════

async function openAddInventoryModal() {
    editingInventoryId = null;
    document.getElementById('inventoryModalTitle').textContent = 'Dodaj przedmiot';
    document.getElementById('inventoryForm').reset();
    document.getElementById('inventoryId').value = '';

    // Ensure Properties are loaded (JIC)
    if (typeof allProperties === 'undefined' || allProperties.length === 0) {
        try {
            allProperties = await LifeSheets.getProperties();
        } catch (e) {
            console.error('Failed to load properties for modal', e);
        }
    }

    // Populate Properties
    populateInventoryPropertySelect();
    updateInventoryRoomSelect(); // Reset Rooms

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

    // Info Tab
    document.getElementById('invName').value = item.nazwa;
    document.getElementById('invCategory').value = item.kategoria;
    document.getElementById('invBrand').value = item.producent || '';
    document.getElementById('invModel').value = item.model || '';
    document.getElementById('invSerial').value = item.numerSeryjny || '';

    // Location
    populateInventoryPropertySelect();
    document.getElementById('invProperty').value = item.idNieruchomosci || '';
    updateInventoryRoomSelect(); // Populate rooms
    document.getElementById('invRoom').value = item.idPomieszczenia || '';

    // Value Tab
    document.getElementById('invPurchaseDate').value = item.dataZakupu || '';
    document.getElementById('invStatus').value = item.stan || 'W użyciu';
    // Handle number inputs carefully
    document.getElementById('invPurchasePrice').value = item.wartoscZakupu;
    document.getElementById('invCurrency').value = item.waluta || 'PLN';
    document.getElementById('invCurrentValue').value = item.wartoscBiezaca;
    document.getElementById('invWarrantyDate').value = item.gwarancjaDo || '';

    // Maintenance Tab
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

    // Save current value if re-populating
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
            select.disabled = false; // Enable so user sees "Brak"
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
