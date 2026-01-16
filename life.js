/**
 * Assetly - Life Module
 * Główna logika modułu Życie
 */

// ═══════════════════════════════════════════════════════════
// STAN MODUŁU
// ═══════════════════════════════════════════════════════════

let lifeInitialized = false;
let currentLifeTab = 'insurance';

// Dane
let allInsurancePolicies = [];
let allProperties = [];
let allInventoryItems = [];
let allSubscriptions = [];

// Filtry i sortowanie - Ubezpieczenia
let insuranceTypeFilter = 'all';
let insuranceSortBy = 'endDate-asc';

// Stan modalów
let editingPolicyId = null;
let deletingPolicyId = null;

// ═══════════════════════════════════════════════════════════
// INICJALIZACJA
// ═══════════════════════════════════════════════════════════

async function initLifeModule() {
    if (lifeInitialized) {
        switchLifeTab(currentLifeTab);
        return;
    }

    showLifeLoading(true);

    try {
        // Upewnij się że arkusze istnieją
        await LifeSheets.ensureSheetsExist();

        // Załaduj dane
        await loadLifeData();

        // Inicjalizuj taby
        initLifeTabs();

        // Renderuj pierwszy tab
        switchLifeTab('insurance');

        lifeInitialized = true;

    } catch (error) {
        console.error('Błąd inicjalizacji modułu Życie:', error);
        if (typeof showToast === 'function') {
            showToast('Błąd ładowania modułu Życie', 'error');
        }
    } finally {
        showLifeLoading(false);
    }
}

async function loadLifeData() {
    const [policies, properties, inventory, subscriptions] = await Promise.all([
        LifeSheets.getInsurancePolicies(),
        LifeSheets.getProperties(),
        LifeSheets.getInventoryItems(),
        LifeSheets.getSubscriptions()
    ]);

    allInsurancePolicies = policies;
    allProperties = properties;
    allInventoryItems = inventory;
    allSubscriptions = subscriptions;
}

function showLifeLoading(show) {
    const loader = document.getElementById('lifeLoader');
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

// ═══════════════════════════════════════════════════════════
// NAWIGACJA TABÓW
// ═══════════════════════════════════════════════════════════

function initLifeTabs() {
    document.querySelectorAll('.life-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchLifeTab(btn.dataset.tab);
        });
    });
}

function switchLifeTab(tabName) {
    currentLifeTab = tabName;

    // Aktualizuj przyciski
    document.querySelectorAll('.life-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Aktualizuj kontenery
    document.querySelectorAll('.life-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const activeContent = document.getElementById(`life-${tabName}`);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // Renderuj zawartość
    switch (tabName) {
        case 'insurance':
            renderInsuranceTab();
            break;
        case 'property':
            renderPropertyTab();
            break;
        case 'inventory':
            renderInventoryTab();
            break;
        case 'subscriptions':
            renderSubscriptionsTab();
            break;
        case 'calendar':
            renderCalendarTab();
            break;
    }
}

// ═══════════════════════════════════════════════════════════
// TAB: UBEZPIECZENIA (PEŁNA IMPLEMENTACJA)
// ═══════════════════════════════════════════════════════════

function renderInsuranceTab() {
    const container = document.getElementById('life-insurance');
    if (!container) return;

    // Header z filtami i przyciskiem dodaj
    const headerHtml = `
        <div class="insurance-header">
            <div class="insurance-filters">
                <select id="insuranceTypeFilter" class="form-select" onchange="handleInsuranceFilterChange()">
                    <option value="all">Wszystkie typy</option>
                    <option value="OC/AC">OC/AC (komunikacyjne)</option>
                    <option value="Mieszkanie">Mieszkanie</option>
                    <option value="Życie">Życie</option>
                    <option value="NNW">NNW</option>
                    <option value="Podróżne">Podróżne</option>
                    <option value="Zdrowotne">Zdrowotne</option>
                    <option value="Inne">Inne</option>
                </select>
                
                <select id="insuranceSortBy" class="form-select" onchange="handleInsuranceSortChange()">
                    <option value="endDate-asc">Data końca: najbliższe</option>
                    <option value="endDate-desc">Data końca: najdalsze</option>
                    <option value="premium-asc">Składka: od najniższej</option>
                    <option value="premium-desc">Składka: od najwyższej</option>
                </select>
            </div>
            
            <button class="btn btn-primary" onclick="openAddPolicyModal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Dodaj polisę
            </button>
        </div>
    `;

    // Banner wygasających polis
    const expiringPolicies = getExpiringPolicies(30);
    const bannerHtml = expiringPolicies.length > 0 ? `
        <div class="insurance-warning-banner" id="insuranceWarningBanner">
            <svg class="insurance-warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div class="insurance-warning-content">
                <p>⚠️ Uwaga! <strong>${expiringPolicies.length}</strong> ${expiringPolicies.length === 1 ? 'polisa wygasa' : 'polis wygasa'} w ciągu 30 dni. <a class="insurance-warning-link" onclick="filterExpiringPolicies()">Pokaż</a></p>
            </div>
        </div>
    ` : '';

    // Porównanie kosztów rok/rok
    const yearComparison = calculateYearlyComparison();
    const comparisonHtml = Object.keys(yearComparison).length >= 2 ? `
        <div class="year-comparison-card">
            <h3>Porównanie składek rok do roku</h3>
            <div class="year-comparison-stats">
                ${renderYearComparisonStats(yearComparison)}
            </div>
        </div>
    ` : '';

    // Lista polis
    const filteredPolicies = getFilteredPolicies();
    const listHtml = filteredPolicies.length > 0
        ? `<div class="insurance-list">${filteredPolicies.map(renderPolicyCard).join('')}</div>`
        : renderEmptyInsurance();

    container.innerHTML = headerHtml + bannerHtml + comparisonHtml + listHtml;

    // Ustaw wartości filtrów
    document.getElementById('insuranceTypeFilter').value = insuranceTypeFilter;
    document.getElementById('insuranceSortBy').value = insuranceSortBy;
}

function renderPolicyCard(policy) {
    const today = new Date();
    const endDate = new Date(policy.dataZakonczenia);
    const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    const isExpired = daysLeft < 0;
    const isExpiringSoon = daysLeft >= 0 && daysLeft <= 30;

    const statusBadges = [];
    if (isExpired) {
        statusBadges.push('<span class="status-badge expired">Wygasła</span>');
    } else if (isExpiringSoon) {
        statusBadges.push('<span class="status-badge expiring-soon">Wygasa wkrótce</span>');
    }

    const cardClass = isExpiringSoon && !isExpired ? 'insurance-item expiring' : isExpired ? 'insurance-item expired' : 'insurance-item';

    const daysLeftClass = daysLeft < 0 ? 'critical' : daysLeft <= 30 ? 'warning' : '';
    const daysLeftText = isExpired ? 'Polisa wygasła' : `${daysLeft} ${daysLeft === 1 ? 'dzień' : daysLeft < 5 ? 'dni' : 'dni'} do końca`;

    const hasDocument = policy.fileIdDrive && policy.fileIdDrive.trim() !== '';
    const hasReminder = policy.eventIdCalendar && policy.eventIdCalendar.trim() !== '';

    return `
        <div class="${cardClass}">
            <div class="insurance-item-header">
                <div class="insurance-item-title">
                    <div class="insurance-type-badge">${escapeHtml(policy.typ)}</div>
                    <div class="insurance-item-name">${escapeHtml(policy.nazwa)}</div>
                    <div class="insurance-item-insurer">${escapeHtml(policy.ubezpieczyciel)}</div>
                </div>
                <div class="insurance-status-badges">
                    ${statusBadges.join('')}
                </div>
            </div>
            
            <div class="insurance-item-body">
                ${policy.numerPolisy ? `
                <div class="insurance-item-detail">
                    <div class="insurance-item-detail-label">Numer polisy</div>
                    <div class="insurance-item-detail-value">${escapeHtml(policy.numerPolisy)}</div>
                </div>
                ` : ''}
                
                <div class="insurance-item-detail">
                    <div class="insurance-item-detail-label">Okres</div>
                    <div class="insurance-item-detail-value">${formatDate(policy.dataRozpoczecia)} – ${formatDate(policy.dataZakonczenia)}</div>
                </div>
                
                <div class="insurance-item-detail">
                    <div class="insurance-item-detail-label">Do końca</div>
                    <div class="insurance-item-detail-value days-left ${daysLeftClass}">${daysLeftText}</div>
                </div>
                
                <div class="insurance-item-detail">
                    <div class="insurance-item-detail-label">Składka roczna</div>
                    <div class="insurance-item-detail-value premium">${formatCurrency(policy.skladkaPLN)} PLN</div>
                </div>
                
                ${policy.sumaUbezpieczenia > 0 ? `
                <div class="insurance-item-detail">
                    <div class="insurance-item-detail-label">Suma ubezpieczenia</div>
                    <div class="insurance-item-detail-value">${formatCurrency(policy.sumaUbezpieczenia)} PLN</div>
                </div>
                ` : ''}
            </div>
            
            <div class="insurance-item-footer">
                <div class="insurance-item-meta">
                    ${hasDocument ? `
                    <a href="#" class="insurance-item-attachment" title="Dokument polisy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
                            <polyline points="13 2 13 9 20 9"/>
                        </svg>
                        Dokument
                    </a>
                    ` : `
                    <a href="#" class="insurance-item-attachment disabled" title="Dołącz dokument (dostępne w Sprint 6)" onclick="attachDocumentToPolicy('${policy.id}'); return false;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                        </svg>
                        Dołącz dokument
                    </a>
                    `}
                    
                    ${hasReminder ? `
                    <a href="#" class="insurance-item-attachment" title="Przypomnienie w kalendarzu">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        Przypomnienie
                    </a>
                    ` : `
                    <a href="#" class="insurance-item-attachment disabled" title="Dodaj przypomnienie (dostępne w Sprint 7)" onclick="createPolicyReminder('${policy.id}'); return false;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 01-3.46 0"/>
                        </svg>
                        Dodaj przypomnienie
                    </a>
                    `}
                </div>
                
                <div class="insurance-item-actions">
                    <button class="btn btn-icon-only btn-edit" onclick="openEditPolicyModal('${policy.id}')" title="Edytuj">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-icon-only btn-delete" onclick="openDeletePolicyModal('${policy.id}')" title="Usuń">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderEmptyInsurance() {
    return `
        <div class="insurance-empty">
            <svg class="insurance-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <h3>Brak polis ubezpieczeniowych</h3>
            <p>Dodaj pierwszą polisę, aby rozpocząć zarządzanie ubezpieczeniami</p>
            <button class="btn btn-primary" onclick="openAddPolicyModal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Dodaj pierwszą polisę
            </button>
        </div>
    `;
}

// Filtrowanie i sortowanie
function getFilteredPolicies() {
    let filtered = [...allInsurancePolicies];

    // Filtruj po typie
    if (insuranceTypeFilter !== 'all') {
        filtered = filtered.filter(p => p.typ === insuranceTypeFilter);
    }

    // Sortuj
    filtered.sort((a, b) => {
        switch (insuranceSortBy) {
            case 'endDate-asc':
                return new Date(a.dataZakonczenia) - new Date(b.dataZakonczenia);
            case 'endDate-desc':
                return new Date(b.dataZakonczenia) - new Date(a.dataZakonczenia);
            case 'premium-asc':
                return a.skladkaPLN - b.skladkaPLN;
            case 'premium-desc':
                return b.skladkaPLN - a.skladkaPLN;
            default:
                return 0;
        }
    });

    return filtered;
}

function handleInsuranceFilterChange() {
    insuranceTypeFilter = document.getElementById('insuranceTypeFilter').value;
    renderInsuranceTab();
}

function handleInsuranceSortChange() {
    insuranceSortBy = document.getElementById('insuranceSortBy').value;
    renderInsuranceTab();
}

function filterExpiringPolicies() {
    insuranceTypeFilter = 'all';
    insuranceSortBy = 'endDate-asc';
    renderInsuranceTab();

    // Scroll do pierwszej wygasającej polisy
    setTimeout(() => {
        const expiringCard = document.querySelector('.insurance-item.expiring');
        if (expiringCard) {
            expiringCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

// Wygasające polisy
function getExpiringPolicies(daysThreshold = 30) {
    const today = new Date();
    const threshold = new Date(today.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

    return allInsurancePolicies.filter(p => {
        const endDate = new Date(p.dataZakonczenia);
        return endDate >= today && endDate <= threshold;
    });
}

// Porównanie kosztów rok/rok
function calculateYearlyComparison() {
    const yearTotals = {};

    allInsurancePolicies.forEach(policy => {
        const year = new Date(policy.dataZakonczenia).getFullYear();
        if (!yearTotals[year]) {
            yearTotals[year] = 0;
        }
        yearTotals[year] += policy.skladkaPLN;
    });

    return yearTotals;
}

function renderYearComparisonStats(yearComparison) {
    const years = Object.keys(yearComparison).sort((a, b) => b - a);
    if (years.length < 2) return '';

    const currentYear = years[0];
    const previousYear = years[1];
    const currentTotal = yearComparison[currentYear];
    const previousTotal = yearComparison[previousYear];
    const difference = currentTotal - previousTotal;
    const percentChange = previousTotal > 0 ? ((difference / previousTotal) * 100) : 0;

    const diffClass = difference > 0 ? 'negative' : difference < 0 ? 'positive' : '';
    const diffSign = difference > 0 ? '+' : '';

    return `
        <div class="year-stat">
            <div class="year-stat-label">Składki ${previousYear}</div>
            <div class="year-stat-value">${formatCurrency(previousTotal)} PLN</div>
        </div>
        <div class="year-stat">
            <div class="year-stat-label">Składki ${currentYear}</div>
            <div class="year-stat-value">${formatCurrency(currentTotal)} PLN</div>
        </div>
        <div class="year-stat">
            <div class="year-stat-label">Różnica</div>
            <div class="year-stat-value ${diffClass}">${diffSign}${formatCurrency(Math.abs(difference))} PLN</div>
            <div class="year-stat-change">${diffSign}${percentChange.toFixed(1)}%</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// MODALE - UBEZPIECZENIA
// ═══════════════════════════════════════════════════════════

function openAddPolicyModal() {
    editingPolicyId = null;
    document.getElementById('policyModalTitle').textContent = 'Dodaj polisę ubezpieczeniową';
    document.getElementById('policyForm').reset();
    document.getElementById('policyId').value = '';

    // Ustaw dzisiejszą datę jako domyślną datę rozpoczęcia
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('policyStartDate').value = today;

    document.getElementById('policyModal').classList.add('active');
}

function openEditPolicyModal(policyId) {
    const policy = allInsurancePolicies.find(p => p.id === policyId);
    if (!policy) return;

    editingPolicyId = policyId;
    document.getElementById('policyModalTitle').textContent = 'Edytuj polisę ubezpieczeniową';

    // Wypełnij formularz
    document.getElementById('policyId').value = policy.id;
    document.getElementById('policyType').value = policy.typ;
    document.getElementById('policyName').value = policy.nazwa;
    document.getElementById('policyNumber').value = policy.numerPolisy;
    document.getElementById('policyStartDate').value = policy.dataRozpoczecia;
    document.getElementById('policyEndDate').value = policy.dataZakonczenia;
    document.getElementById('policyPremium').value = policy.skladkaRoczna;
    document.getElementById('policyCurrency').value = policy.waluta;
    document.getElementById('policyCoverage').value = policy.sumaUbezpieczenia || '';
    document.getElementById('policyInsurer').value = policy.ubezpieczyciel;
    document.getElementById('policyNotes').value = policy.notatki;

    document.getElementById('policyModal').classList.add('active');
}

function closePolicyModal() {
    document.getElementById('policyModal').classList.remove('active');
    editingPolicyId = null;
}

async function handleSavePolicy(event) {
    event.preventDefault();

    const formData = {
        typ: document.getElementById('policyType').value,
        nazwa: document.getElementById('policyName').value,
        numerPolisy: document.getElementById('policyNumber').value,
        dataRozpoczecia: document.getElementById('policyStartDate').value,
        dataZakonczenia: document.getElementById('policyEndDate').value,
        skladkaRoczna: parseFloat(document.getElementById('policyPremium').value),
        waluta: document.getElementById('policyCurrency').value,
        sumaUbezpieczenia: parseFloat(document.getElementById('policyCoverage').value) || 0,
        ubezpieczyciel: document.getElementById('policyInsurer').value,
        notatki: document.getElementById('policyNotes').value
    };

    // Walidacja dat
    if (new Date(formData.dataZakonczenia) < new Date(formData.dataRozpoczecia)) {
        showToast('Data zakończenia nie może być wcześniejsza niż data rozpoczęcia', 'error');
        return;
    }

    showLifeLoading(true);

    try {
        if (editingPolicyId) {
            // Edycja
            await LifeSheets.updateInsurancePolicy(editingPolicyId, formData);
            showToast('Polisa zaktualizowana pomyślnie', 'success');
        } else {
            // Dodawanie
            await LifeSheets.addInsurancePolicy(formData);
            showToast('Polisa dodana pomyślnie', 'success');
        }

        // Przeładuj dane i odśwież widok
        await loadLifeData();
        renderInsuranceTab();
        closePolicyModal();

    } catch (error) {
        console.error('Błąd zapisu polisy:', error);
        showToast('Błąd podczas zapisu polisy', 'error');
    } finally {
        showLifeLoading(false);
    }
}

function openDeletePolicyModal(policyId) {
    const policy = allInsurancePolicies.find(p => p.id === policyId);
    if (!policy) return;

    deletingPolicyId = policyId;
    document.getElementById('deletePolicyMessage').textContent =
        `Czy na pewno chcesz usunąć polisę "${policy.nazwa}" (${policy.typ})?`;

    document.getElementById('deletePolicyModal').classList.add('active');
}

function closeDeletePolicyModal() {
    document.getElementById('deletePolicyModal').classList.remove('active');
    deletingPolicyId = null;
}

async function confirmDeletePolicy() {
    if (!deletingPolicyId) return;

    showLifeLoading(true);

    try {
        await LifeSheets.deleteInsurancePolicy(deletingPolicyId);
        showToast('Polisa usunięta pomyślnie', 'success');

        // Przeładuj dane i odśwież widok
        await loadLifeData();
        renderInsuranceTab();
        closeDeletePolicyModal();

    } catch (error) {
        console.error('Błąd usuwania polisy:', error);
        showToast('Błąd podczas usuwania polisy', 'error');
    } finally {
        showLifeLoading(false);
    }
}

// ═══════════════════════════════════════════════════════════
// PLACEHOLDERY DRIVE/CALENDAR - Sprint 6 i 7
// ═══════════════════════════════════════════════════════════

function attachDocumentToPolicy(policyId) {
    // TODO Sprint 6: Implementacja uploadu do Drive
    showToast('Funkcja dołączania dokumentów będzie dostępna w Sprint 6', 'info');
    return false;
}

function createPolicyReminder(policyId) {
    // TODO Sprint 7: Implementacja eventu w Calendar
    showToast('Funkcja przypomnień będzie dostępna w Sprint 7', 'info');
    return false;
}

// ═══════════════════════════════════════════════════════════
// PLACEHOLDERY INNYCH TABÓW - Sprint 2, 3, 4, 5
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// TAB: NIERUCHOMOŚCI - SPRINT 2
// ═══════════════════════════════════════════════════════════



// function renderInventoryTab() moved to life-inventory.js

// function renderSubscriptionsTab() moved to life-subscriptions.js

function renderCalendarTab() {
    const container = document.getElementById('life-calendar');
    if (!container) return;

    container.innerHTML = `
        <div class="placeholder-tab">
            <h2>Kalendarz Wydarzeń</h2>
            <p>Graficzny kalendarz będzie dostępny w Sprint 5</p>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Zamknięcie modali przez kliknięcie w tło
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'policyModal') closePolicyModal();
        if (e.target.id === 'deletePolicyModal') closeDeletePolicyModal();
        if (e.target.id === 'inventoryModal') closeInventoryModal();
        if (e.target.id === 'subscriptionModal') closeSubscriptionModal();
    }
});
