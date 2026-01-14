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
    const container = document.getElementById('content-inventory');
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
    if (document.getElementById('inventory-toolbar')) return; // Already exists

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
                    <option value="Inne">Inne</option>
                </select>
                <select id="inventoryRoomFilter" class="form-select" onchange="handleInventoryFilter()">
                    <option value="all">Wszystkie pomieszczenia</option>
                    <!-- Populated dynamically -->
                </select>
            </div>
            <div class="toolbar-right">
                <div class="view-toggle">
                    <button class="btn-icon ${inventoryInfo.viewMode === 'list' ? 'active' : ''}" onclick="setInventoryView('list')" title="Widok listy">
                        <i class="fas fa-list"></i>
                    </button>
                    <button class="btn-icon ${inventoryInfo.viewMode === 'grid' ? 'active' : ''}" onclick="setInventoryView('grid')" title="Widok siatki">
                        <i class="fas fa-th-large"></i>
                    </button>
                </div>
                <button class="btn btn-primary" onclick="openAddInventoryModal()">
                    <i class="fas fa-plus"></i> Dodaj przedmiot
                </button>
            </div>
        </div>
        <div id="inventory-stats" class="stats-grid">
            <!-- Stats populated by renderInventoryStats -->
        </div>
        <div id="inventory-grid-container" class="inventory-container"></div>
    `;
    container.innerHTML = html;

    populateRoomFilter();
}

function populateRoomFilter() {
    const select = document.getElementById('inventoryRoomFilter');
    // Collect all unique rooms from Properties
    const rooms = new Set();
    allProperties.forEach(p => {
        (p.pomieszczenia || []).forEach(r => rooms.add(r.name));
    });

    rooms.forEach(room => {
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

    // Warranty logic (simple check)
    const now = new Date();
    const expiringSoon = allInventory.filter(i => {
        if (!i.gwarancjaDo) return false;
        const date = new Date(i.gwarancjaDo);
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 30;
    }).length;

    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-title">Liczba przedmiotów</div>
            <div class="stat-value">${totalCount}</div>
        </div>
        <div class="stat-card">
            <div class="stat-title">Całkowita wartość</div>
            <div class="stat-value text-primary">${formatCurrency(totalValue)} PLN</div>
        </div>
        <div class="stat-card">
            <div class="stat-title">Kończące się gwarancje</div>
            <div class="stat-value ${expiringSoon > 0 ? 'text-warning' : ''}">${expiringSoon}</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// CONTENT - GRID / LIST
// ═══════════════════════════════════════════════════════════

function renderInventoryContent(container) {
    const content = document.getElementById('inventory-grid-container');
    content.className = inventoryInfo.viewMode === 'list' ? 'inventory-list-view' : 'inventory-grid-view';

    const filtered = filterInventory(allInventory);

    if (filtered.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-box-open"></i></div>
                <h3>Brak przedmiotów</h3>
                <p>Naciśnij "Dodaj przedmiot", aby rozpocząć inwentaryzację.</p>
            </div>
        `;
        return;
    }

    if (inventoryInfo.viewMode === 'list') {
        renderInventoryList(content, filtered);
    } else {
        renderInventoryGrid(content, filtered);
    }
}

function filterInventory(items) {
    const search = (document.getElementById('inventorySearch')?.value || '').toLowerCase();
    const cat = document.getElementById('inventoryCategoryFilter')?.value || 'all';
    const room = document.getElementById('inventoryRoomFilter')?.value || 'all';

    return items.filter(item => {
        const matchesSearch = (item.nazwa || '').toLowerCase().includes(search) ||
            (item.producent || '').toLowerCase().includes(search) ||
            (item.model || '').toLowerCase().includes(search);
        const matchesCat = cat === 'all' || item.kategoria === cat;
        // Room logic needs Property -> Room mapping or simple Room Name match if stored in item
        // Assuming item.idPomieszczenia stores Room ID or Name. For MVP let's match exact value.
        // Or if we store PropertyID + RoomID, we need to lookup.
        // For now, let's assume we store the ID and filter by that, BUT the filter sends Room Name?
        // Let's defer advanced Room filtering. Matching simple filter for now.
        const matchesRoom = room === 'all' || true; // Placeholder until strict Room ID Logic

        return matchesSearch && matchesCat && matchesRoom;
    });
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

function handleInventorySearch() {
    renderInventoryContent(document.getElementById('content-inventory'));
}

function handleInventoryFilter() {
    renderInventoryContent(document.getElementById('content-inventory'));
}

// ═══════════════════════════════════════════════════════════
// MODAL LOGIC
// ═══════════════════════════════════════════════════════════

// Placeholder for Sprint 3.1 Step 2 (Modal Implementation)

function openAddInventoryModal() {
    editingInventoryId = null;
    document.getElementById('inventoryModalTitle').textContent = 'Dodaj przedmiot';
    document.getElementById('inventoryForm').reset();
    document.getElementById('inventoryId').value = '';

    // Populate Properties
    populateInventoryPropertySelect();
    updateInventoryRoomSelect(); // Reset Rooms

    switchInventoryModalTab('info');
    document.getElementById('inventoryModal').classList.add('active');
}

function openEditInventoryModal(id) {
    const item = allInventory.find(i => i.id === id);
    if (!item) return;

    editingInventoryId = id;
    document.getElementById('inventoryModalTitle').textContent = 'Edytuj przedmiot';
    document.getElementById('inventoryId').value = item.id;

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
    document.getElementById('invPurchasePrice').value = item.wartoscZakupu || '';
    document.getElementById('invCurrency').value = item.waluta || 'PLN';
    document.getElementById('invCurrentValue').value = item.wartoscBiezaca || '';
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
    select.innerHTML = '<option value="">-- wybierz --</option>';
    allProperties.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nazwa;
        select.appendChild(opt);
    });
}

function updateInventoryRoomSelect() {
    const propId = document.getElementById('invProperty').value;
    const select = document.getElementById('invRoom');
    select.innerHTML = '<option value="">-- wybierz --</option>';

    if (!propId) {
        select.disabled = true;
        return;
    }

    const prop = allProperties.find(p => p.id === propId);
    if (prop && prop.pomieszczenia) {
        select.disabled = false;
        prop.pomieszczenia.forEach(room => {
            const opt = document.createElement('option');
            opt.value = room.name;
            opt.textContent = room.name;
            select.appendChild(opt);
        });
    } else {
        select.disabled = true;
        select.innerHTML = '<option value="">Brak pomieszczeń</option>';
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
        });
    }
}
