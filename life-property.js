/**
 * Assetly - Life Module - Property Tab
 * Logika i obsługa zakładki Nieruchomości
 */

// Stan - Nieruchomości
let propertyInfo = {
    typeFilter: 'all',
    statusFilter: 'all',
    sortBy: 'value-desc'
};
let editingPropertyId = null;
let deletingPropertyId = null;
let tempRooms = [];
let tempMaintenance = [];
let tempProjects = [];

// ═══════════════════════════════════════════════════════════
// RENDERING TABU
// ═══════════════════════════════════════════════════════════

function renderPropertyTab() {
    const container = document.getElementById('life-property');
    if (!container) return;

    // Metryki
    renderPropertyMetrics();

    // Lista
    const filteredProperties = getFilteredProperties();
    const listContainer = document.getElementById('propertyList');

    if (filteredProperties.length > 0) {
        listContainer.innerHTML = filteredProperties.map(renderPropertyCard).join('');
    } else {
        listContainer.innerHTML = renderEmptyProperty();
    }

    // Ustaw wartości filtrów
    document.getElementById('propertyTypeFilter').value = propertyInfo.typeFilter;
    document.getElementById('propertyStatusFilter').value = propertyInfo.statusFilter;
    document.getElementById('propertySortBy').value = propertyInfo.sortBy;
}

function renderPropertyMetrics() {
    const container = document.getElementById('propertyMetrics');
    if (!container) return;

    const totalValue = allProperties.reduce((sum, p) => sum + p.wartoscPLN, 0);
    const totalArea = allProperties.reduce((sum, p) => sum + p.powierzchniaM2, 0);
    const avgPriceM2 = totalArea > 0 ? totalValue / totalArea : 0;

    container.innerHTML = `
        <div class="metric-card">
            <div class="metric-label">Wartość portfela</div>
            <div class="metric-value">${formatCurrency(totalValue)} PLN</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Łączna powierzchnia</div>
            <div class="metric-value">${totalArea.toFixed(2)} m²</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Średnia cena/m²</div>
            <div class="metric-value">${formatCurrency(avgPriceM2)} PLN</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Liczba nieruchomości</div>
            <div class="metric-value">${allProperties.length}</div>
        </div>
    `;
}

function renderPropertyCard(property) {
    const roomCount = (property.pomieszczenia || []).length;
    const taskCount = (property.harmonogramKonserwacji || []).length;

    // Znajdź najbliższe zadanie
    const nextTask = (property.harmonogramKonserwacji || [])
        .map(t => ({ ...t, dateObj: new Date(t.nastepnie) }))
        .sort((a, b) => a.dateObj - b.dateObj)
        .find(t => t.dateObj >= new Date());

    const maintenanceStatus = nextTask
        ? `<div class="maintenance-status upcoming">🔧 ${nextTask.zadanie}: ${formatDate(nextTask.nastepnie)}</div>`
        : `<div class="maintenance-status ok">✅ Konserwacja na bieżąco</div>`;

    return `
        <div class="property-card">
            <div class="property-card-header">
                <div>
                    <div class="property-type-badge">${escapeHtml(property.typ)}</div>
                    <div class="property-name">${escapeHtml(property.nazwa)}</div>
                    <div class="property-address">${escapeHtml(property.adres)}</div>
                </div>
                <div class="property-value-badge">
                    ${formatCurrency(property.wartoscPLN)} PLN
                </div>
            </div>
            
            <div class="property-card-body">
                <div class="property-detail">
                    <span class="detail-label">Powierzchnia</span>
                    <span class="detail-value">${property.powierzchniaM2} m²</span>
                </div>
                <div class="property-detail">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">${escapeHtml(property.status)}</span>
                </div>
                <div class="property-detail">
                    <span class="detail-label">Data zakupu</span>
                    <span class="detail-value">${formatDate(property.dataZakupu)}</span>
                </div>
                <div class="property-detail">
                    <span class="detail-label">Pomieszczenia</span>
                    <span class="detail-value">${roomCount}</span>
                </div>
            </div>
            
            <div class="property-maintenance-row">
                ${maintenanceStatus}
            </div>
            
            <div class="property-card-footer">
                <button class="btn btn-sm btn-secondary" onclick="openViewPropertyModal('${property.id}')">Szczegóły</button>
                <button class="btn btn-icon-only btn-delete" onclick="openDeletePropertyModal('${property.id}')" title="Usuń">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

function renderEmptyProperty() {
    return `
        <div class="property-empty">
            <h3>Brak nieruchomości</h3>
            <p>Dodaj swoją pierwszą nieruchomość, aby zarządzać jej utrzymaniem.</p>
            <button class="btn btn-primary" onclick="openAddPropertyModal()">Dodaj nieruchomość</button>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// FILTROWANIE I SORTOWANIE
// ═══════════════════════════════════════════════════════════

function getFilteredProperties() {
    let filtered = [...allProperties];

    if (propertyInfo.typeFilter !== 'all') {
        filtered = filtered.filter(p => p.typ === propertyInfo.typeFilter);
    }

    if (propertyInfo.statusFilter !== 'all') {
        filtered = filtered.filter(p => p.status === propertyInfo.statusFilter);
    }

    filtered.sort((a, b) => {
        switch (propertyInfo.sortBy) {
            case 'value-desc': return b.wartoscPLN - a.wartoscPLN;
            case 'value-asc': return a.wartoscPLN - b.wartoscPLN;
            case 'date-desc': return new Date(b.dataZakupu) - new Date(a.dataZakupu);
            case 'date-asc': return new Date(a.dataZakupu) - new Date(b.dataZakupu);
            default: return 0;
        }
    });

    return filtered;
}

function handlePropertyFilterChange() {
    propertyInfo.typeFilter = document.getElementById('propertyTypeFilter').value;
    propertyInfo.statusFilter = document.getElementById('propertyStatusFilter').value;
    renderPropertyTab();
}

function handlePropertySortChange() {
    propertyInfo.sortBy = document.getElementById('propertySortBy').value;
    renderPropertyTab();
}

// ═══════════════════════════════════════════════════════════
// MODALE I CRUD
// ═══════════════════════════════════════════════════════════

function openAddPropertyModal() {
    editingPropertyId = null;
    document.getElementById('propertyModalTitle').textContent = 'Dodaj nieruchomość';
    document.getElementById('propertyForm').reset();
    document.getElementById('propertyId').value = '';

    // Reset tabs
    switchPropertyModalTab('info');

    // Reset sub-lists
    tempRooms = [];
    tempMaintenance = [];
    tempProjects = [];
    renderRoomsListModal();
    renderMaintenanceListModal();
    renderProjectsListModal();

    document.getElementById('propertyModal').classList.add('active');
}

function openEditPropertyModal(propId) {
    const prop = allProperties.find(p => p.id === propId);
    if (!prop) return;

    editingPropertyId = propId;
    document.getElementById('propertyModalTitle').textContent = 'Edytuj nieruchomość';

    // Wypełnij dane - Podstawowe
    document.getElementById('propertyId').value = prop.id;
    document.getElementById('propType').value = prop.typ;
    document.getElementById('propStatus').value = prop.status;
    document.getElementById('propName').value = prop.nazwa;
    document.getElementById('propAddress').value = prop.adres;
    document.getElementById('propArea').value = prop.powierzchniaM2;
    document.getElementById('propDate').value = prop.dataZakupu;
    document.getElementById('propValue').value = prop.wartoscRynkowa;
    document.getElementById('propCurrency').value = prop.waluta;
    document.getElementById('propNotes').value = prop.notatki;
    document.getElementById('propYearBuilt').value = prop.rokBudowy || '';
    document.getElementById('propPurchasePrice').value = prop.wartoscZakupu || '';
    document.getElementById('propKW').value = prop.numerKW || '';
    document.getElementById('propPlot').value = prop.numerDzialki || '';

    // Finanse
    const oplaty = prop.oplatyConfig || {};
    document.getElementById('propTax').value = oplaty.tax || '';
    document.getElementById('propRent').value = oplaty.rent || '';

    // Sub-listy
    tempRooms = JSON.parse(JSON.stringify(prop.pomieszczenia || []));
    tempMaintenance = JSON.parse(JSON.stringify(prop.harmonogramKonserwacji || []));
    tempProjects = JSON.parse(JSON.stringify(prop.projektyRemontowe || []));
    renderRoomsListModal();
    renderMaintenanceListModal();
    renderProjectsListModal();

    // Reset tabs
    switchPropertyModalTab('info');

    document.getElementById('propertyModal').classList.add('active');
}

function closePropertyModal() {
    document.getElementById('propertyModal').classList.remove('active');
    editingPropertyId = null;
}

function switchPropertyModalTab(tabName) {
    // Buttons
    document.querySelectorAll('.modal-tab').forEach(btn => {
        btn.classList.remove('active');
        const text = btn.textContent;
        // Simple mapping check
        if ((tabName === 'info' && text.includes('Informacje')) ||
            (tabName === 'finance' && text.includes('Finanse')) ||
            (tabName === 'projects' && text.includes('Projekty')) ||
            (tabName === 'rooms' && text.includes('Pomieszczenia')) ||
            (tabName === 'maintenance' && text.includes('Konserwacja')) ||
            (tabName === 'docs' && text.includes('Dokumenty'))) {
            btn.classList.add('active');
        }
    });

    // Content
    document.querySelectorAll('.modal-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`prop-tab-${tabName}`).classList.add('active');
}

async function handleSaveProperty(event) {
    event.preventDefault();

    const oplatyConfig = {
        tax: parseFloat(document.getElementById('propTax').value) || 0,
        rent: parseFloat(document.getElementById('propRent').value) || 0
    };

    const formData = {
        typ: document.getElementById('propType').value,
        status: document.getElementById('propStatus').value,
        nazwa: document.getElementById('propName').value,
        adres: document.getElementById('propAddress').value,
        powierzchniaM2: parseFloat(document.getElementById('propArea').value) || 0,
        dataZakupu: document.getElementById('propDate').value,
        wartoscRynkowa: parseFloat(document.getElementById('propValue').value) || 0,
        waluta: document.getElementById('propCurrency').value,
        notatki: document.getElementById('propNotes').value,
        rokBudowy: document.getElementById('propYearBuilt').value,
        wartoscZakupu: parseFloat(document.getElementById('propPurchasePrice').value) || 0,
        numerKW: document.getElementById('propKW').value,
        numerDzialki: document.getElementById('propPlot').value,
        oplatyConfig: oplatyConfig,
        pomieszczenia: tempRooms,
        harmonogramKonserwacji: tempMaintenance,
        projektyRemontowe: tempProjects
    };

    showLifeLoading(true);

    try {
        if (editingPropertyId) {
            await LifeSheets.updateProperty(editingPropertyId, formData);
            showToast('Nieruchomość zaktualizowana', 'success');
        } else {
            await LifeSheets.addProperty(formData);
            showToast('Nieruchomość dodana', 'success');
        }

        await loadLifeData();
        renderPropertyTab();
        closePropertyModal();
    } catch (error) {
        console.error('Błąd zapisu nieruchomości:', error);
        showToast('Błąd zapisu', 'error');
    } finally {
        showLifeLoading(false);
    }
}

function openDeletePropertyModal(propId) {
    const prop = allProperties.find(p => p.id === propId);
    if (!prop) return;

    deletingPropertyId = propId;
    document.getElementById('deletePropertyMessage').textContent =
        `Czy na pewno chcesz usunąć nieruchomość "${prop.nazwa}"?`;
    document.getElementById('deletePropertyModal').classList.add('active');
}

function closeDeletePropertyModal() {
    document.getElementById('deletePropertyModal').classList.remove('active');
    deletingPropertyId = null;
}

async function confirmDeleteProperty() {
    if (!deletingPropertyId) return;

    showLifeLoading(true);
    try {
        await LifeSheets.deleteProperty(deletingPropertyId);
        showToast('Nieruchomość usunięta', 'success');
        await loadLifeData();
        renderPropertyTab();
        closeDeletePropertyModal();
    } catch (error) {
        console.error('Błąd usuwania:', error);
        showToast('Błąd usuwania', 'error');
    } finally {
        showLifeLoading(false);
    }
}

// ═══════════════════════════════════════════════════════════
// SUB-LIST HELPERS
// ═══════════════════════════════════════════════════════════

// Rooms
function renderRoomsListModal() {
    const container = document.getElementById('roomsContainer');
    container.innerHTML = tempRooms.map((room, index) => `
        <div class="sub-list-item">
            <div class="sub-item-row">
                <input type="text" class="form-input form-input-sm" placeholder="Nazwa (np. Salon)" value="${room.nazwa}" onchange="updateRoom(${index}, 'nazwa', this.value)">
                <input type="number" class="form-input form-input-sm" placeholder="m²" style="width: 80px" value="${room.metraz}" onchange="updateRoom(${index}, 'metraz', this.value)">
                <button type="button" class="btn btn-icon-only btn-delete" onclick="removeRoomRow(${index})">×</button>
            </div>
            <input type="text" class="form-input form-input-sm" placeholder="Opis (opcjonalnie)" value="${room.opis || ''}" onchange="updateRoom(${index}, 'opis', this.value)">
        </div>
    `).join('');
}

function addRoomRow() {
    tempRooms.push({ nazwa: '', metraz: 0, opis: '' });
    renderRoomsListModal();
}

function removeRoomRow(index) {
    tempRooms.splice(index, 1);
    renderRoomsListModal();
}

function updateRoom(index, field, value) {
    if (field === 'metraz') value = parseFloat(value) || 0;
    tempRooms[index][field] = value;
}

// Maintenance
function renderMaintenanceListModal() {
    const container = document.getElementById('maintenanceContainer');
    container.innerHTML = tempMaintenance.map((task, index) => `
        <div class="sub-list-item">
            <div class="sub-item-row">
                <input type="text" class="form-input form-input-sm" placeholder="Zadanie" value="${task.zadanie}" onchange="updateMaintenance(${index}, 'zadanie', this.value)">
                <select class="form-select form-select-sm" onchange="updateMaintenance(${index}, 'czestotliwosc', this.value)">
                    <option value="miesięcznie" ${task.czestotliwosc === 'miesięcznie' ? 'selected' : ''}>Miesięcznie</option>
                    <option value="kwartalnie" ${task.czestotliwosc === 'kwartalnie' ? 'selected' : ''}>Kwartalnie</option>
                    <option value="półrocznie" ${task.czestotliwosc === 'półrocznie' ? 'selected' : ''}>Półrocznie</option>
                    <option value="rocznie" ${task.czestotliwosc === 'rocznie' ? 'selected' : ''}>Rocznie</option>
                </select>
                <button type="button" class="btn btn-icon-only btn-delete" onclick="removeMaintenanceRow(${index})">×</button>
            </div>
            <div class="sub-item-row">
                <label class="sub-label">Ostatnio:</label>
                <input type="date" class="form-input form-input-sm" value="${task.ostatnio}" onchange="updateMaintenance(${index}, 'ostatnio', this.value)">
                <label class="sub-label">Następnie:</label>
                <input type="date" class="form-input form-input-sm" value="${task.nastepnie}" onchange="updateMaintenance(${index}, 'nastepnie', this.value)">
            </div>
        </div>
    `).join('');
}

function addMaintenanceRow() {
    const today = new Date().toISOString().split('T')[0];
    tempMaintenance.push({ zadanie: '', czestotliwosc: 'rocznie', ostatnio: today, nastepnie: calculateNextDate(today, 'rocznie') });
    renderMaintenanceListModal();
}

function removeMaintenanceRow(index) {
    tempMaintenance.splice(index, 1);
    renderMaintenanceListModal();
}

function updateMaintenance(index, field, value) {
    tempMaintenance[index][field] = value;

    // Auto-calculate next date if 'ostatnio' or 'czestotliwosc' changes
    if (field === 'ostatnio' || field === 'czestotliwosc') {
        const t = tempMaintenance[index];
        t.nastepnie = calculateNextDate(t.ostatnio, t.czestotliwosc);
        renderMaintenanceListModal(); // Re-render to show new date
    }
}

function calculateNextDate(dateStr, freq) {
    if (!dateStr) return '';
    const date = new Date(dateStr);

    if (freq === 'miesięcznie') date.setMonth(date.getMonth() + 1);
    if (freq === 'kwartalnie') date.setMonth(date.getMonth() + 3);
    if (freq === 'półrocznie') date.setMonth(date.getMonth() + 6);
    if (freq === 'rocznie') date.setFullYear(date.getFullYear() + 1);

    return date.toISOString().split('T')[0];
}

// Projects
function renderProjectsListModal() {
    const container = document.getElementById('projectsContainer');
    container.innerHTML = tempProjects.map((proj, index) => `
        <div class="sub-list-item">
            <div class="sub-item-row">
                <input type="text" class="form-input form-input-sm" placeholder="Nazwa projektu (np. Remont łazienki)" value="${proj.nazwa}" onchange="updateProject(${index}, 'nazwa', this.value)">
                <select class="form-select form-select-sm" style="width: 120px" onchange="updateProject(${index}, 'status', this.value)">
                    <option value="Planowany" ${proj.status === 'Planowany' ? 'selected' : ''}>Planowany</option>
                    <option value="W trakcie" ${proj.status === 'W trakcie' ? 'selected' : ''}>W trakcie</option>
                    <option value="Zakończony" ${proj.status === 'Zakończony' ? 'selected' : ''}>Zakończony</option>
                </select>
                <button type="button" class="btn btn-icon-only btn-delete" onclick="removeProjectRow(${index})">×</button>
            </div>
            <div class="sub-item-row">
                <label class="sub-label">Budżet:</label>
                <input type="number" class="form-input form-input-sm" placeholder="0.00" value="${proj.budzet}" onchange="updateProject(${index}, 'budzet', this.value)">
                <label class="sub-label">Koszt:</label>
                <input type="number" class="form-input form-input-sm" placeholder="0.00" value="${proj.koszt}" onchange="updateProject(${index}, 'koszt', this.value)">
            </div>
            <input type="text" class="form-input form-input-sm" placeholder="Opis (opcjonalnie)" value="${proj.opis || ''}" onchange="updateProject(${index}, 'opis', this.value)" style="margin-top: 0.5rem">
        </div>
    `).join('');
}

function addProjectRow() {
    tempProjects.push({ nazwa: '', status: 'Planowany', budzet: 0, koszt: 0, opis: '' });
    renderProjectsListModal();
}

function removeProjectRow(index) {
    tempProjects.splice(index, 1);
    renderProjectsListModal();
}

function updateProject(index, field, value) {
    if (field === 'budzet' || field === 'koszt') value = parseFloat(value) || 0;
    tempProjects[index][field] = value;
}

// ═══════════════════════════════════════════════════════════
// VIEW MODAL (DASHBOARD)
// ═══════════════════════════════════════════════════════════

function openViewPropertyModal(propId) {
    const prop = allProperties.find(p => p.id === propId);
    if (!prop) return;

    // Header
    document.getElementById('viewPropName').textContent = prop.nazwa;
    document.getElementById('viewPropAddress').textContent = `${prop.typ} • ${prop.adres}`;

    // Stats
    document.getElementById('viewPropValue').textContent = `${formatCurrency(prop.wartoscPLN)} PLN`;
    document.getElementById('viewPropPurchase').textContent = `${formatCurrency(prop.wartoscZakupu || 0)} PLN`;

    // ROI Calculation
    const purchase = prop.wartoscZakupu || 0;
    const value = prop.wartoscPLN || 0;
    // Sum projects that are Completed
    const projectsCost = (prop.projektyRemontowe || [])
        .reduce((sum, p) => sum + (parseFloat(p.koszt) || 0), 0);

    let roi = 0;
    if (purchase > 0) {
        roi = ((value - purchase - projectsCost) / purchase) * 100;
    }
    const roiEl = document.getElementById('viewPropROI');
    roiEl.textContent = `${roi.toFixed(1)}%`;
    roiEl.style.color = roi >= 0 ? 'var(--success)' : 'var(--error)';

    document.getElementById('viewPropArea').textContent = `${prop.powierzchniaM2} m²`;
    document.getElementById('viewPropYear').textContent = prop.rokBudowy || '-';

    // Map
    const mapFrame = document.getElementById('viewPropMap');
    const mapPlaceholder = document.getElementById('viewMapPlaceholder');

    if (prop.adres && prop.adres.length > 5) {
        const query = encodeURIComponent(prop.adres);
        mapFrame.src = `https://maps.google.com/maps?q=${query}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
        mapFrame.style.display = 'block';
        mapPlaceholder.style.display = 'none';
    } else {
        mapFrame.style.display = 'none';
        mapPlaceholder.style.display = 'flex';
    }

    // Projects Tab
    const projectsContainer = document.getElementById('viewProjectsList');
    const projects = prop.projektyRemontowe || [];
    if (projects.length > 0) {
        projectsContainer.innerHTML = projects.map(p => `
            <div class="view-project-item">
                <div class="project-header">
                    <span class="project-name">${escapeHtml(p.nazwa)}</span>
                    <span class="project-status status-${(p.status || '').toLowerCase().replace(' ', '-')}">${p.status}</span>
                </div>
                <div class="project-details">
                    <span>Budżet: ${formatCurrency(p.budzet)}</span>
                    <span>Koszt: ${formatCurrency(p.koszt)}</span>
                </div>
            </div>
        `).join('');
    } else {
        projectsContainer.innerHTML = '<p class="text-muted">Brak projektów remontowych.</p>';
    }

    // Finance Tab
    const oplaty = prop.oplatyConfig || {};
    document.getElementById('viewPropRent').textContent = oplaty.rent ? `${formatCurrency(oplaty.rent)} PLN` : '-';
    document.getElementById('viewPropTax').textContent = oplaty.tax ? `${formatCurrency(oplaty.tax)} PLN` : '-';

    // Details Tab
    document.getElementById('viewPropType').textContent = prop.typ;
    document.getElementById('viewPropStatus').textContent = prop.status;
    document.getElementById('viewPropKW').textContent = prop.numerKW || '-';
    document.getElementById('viewPropPlot').textContent = prop.numerDzialki || '-';
    document.getElementById('viewPropNotes').textContent = prop.notatki || '-';

    // Edit Button
    document.getElementById('viewEditBtn').onclick = function () {
        closeViewPropertyModal();
        openEditPropertyModal(propId);
    };

    // Reset Tabs
    switchViewModalTab('projects');

    document.getElementById('propertyViewModal').classList.add('active');
}

function closeViewPropertyModal() {
    document.getElementById('propertyViewModal').classList.remove('active');
    // Clear map src to stop loading
    document.getElementById('viewPropMap').src = '';
}

function switchViewModalTab(tabName) {
    document.querySelectorAll('#propertyViewModal .modal-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.onclick.toString().includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('#propertyViewModal .modal-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`view-tab-${tabName}`).classList.add('active');
}
