/**
 * Assetly - Moduł autoryzacji Google OAuth
 */

// Stan autoryzacji
let tokenClient = null;
let gapiInited = false;
let gisInited = false;

/**
 * Inicjalizacja Google API (GAPI)
 */
async function initGAPI() {
    return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: '', // Nie potrzebujemy API key dla OAuth
                    discoveryDocs: [CONFIG.DISCOVERY_DOC],
                });
                gapiInited = true;
                console.log('GAPI zainicjalizowane');
                resolve();
            } catch (error) {
                console.error('Błąd inicjalizacji GAPI:', error);
                reject(error);
            }
        });
    });
}

/**
 * Inicjalizacja Google Identity Services (GIS)
 */
function initGIS() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: handleTokenResponse,
    });
    gisInited = true;
    console.log('GIS zainicjalizowane');
}

/**
 * Obsługa odpowiedzi z tokenem
 */
function handleTokenResponse(response) {
    if (response.error) {
        console.error('Błąd autoryzacji:', response.error);
        showToast('Błąd logowania. Spróbuj ponownie.', 'error');
        return;
    }
    
    // Token otrzymany - zapisz dane użytkownika
    const userData = {
        isLoggedIn: true,
        loginTime: new Date().toISOString()
    };
    
    localStorage.setItem(CONFIG.STORAGE_KEY_USER, JSON.stringify(userData));
    console.log('Zalogowano pomyślnie');
    
    // Przekieruj na dashboard
    window.location.href = 'dashboard.html';
}

/**
 * Pełna inicjalizacja autoryzacji
 */
async function initAuth() {
    try {
        await initGAPI();
        initGIS();
        return true;
    } catch (error) {
        console.error('Błąd inicjalizacji autoryzacji:', error);
        return false;
    }
}

/**
 * Rozpocznij proces logowania
 */
function handleGoogleLogin() {
    if (!gisInited) {
        showToast('Ładowanie... Spróbuj za chwilę.', 'warning');
        return;
    }
    
    // Sprawdź czy mamy zapisany token
    if (gapi.client.getToken() === null) {
        // Pierwszy raz - pokaż popup
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Mamy token - użyj go
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

/**
 * Wylogowanie
 */
function handleGoogleLogout() {
    const token = gapi.client.getToken();
    
    if (token !== null) {
        // Odwołaj token
        google.accounts.oauth2.revoke(token.access_token, () => {
            console.log('Token odwołany');
        });
        gapi.client.setToken(null);
    }
    
    // Wyczyść localStorage
    localStorage.removeItem(CONFIG.STORAGE_KEY_USER);
    localStorage.removeItem(CONFIG.STORAGE_KEY_SPREADSHEET);
    
    // Przekieruj na stronę logowania
    window.location.href = 'index.html';
}

/**
 * Sprawdź czy użytkownik jest zalogowany
 */
function isUserSignedIn() {
    const userData = localStorage.getItem(CONFIG.STORAGE_KEY_USER);
    if (!userData) return false;
    
    try {
        const parsed = JSON.parse(userData);
        return parsed.isLoggedIn === true;
    } catch {
        return false;
    }
}

/**
 * Sprawdź czy mamy ważny token Google
 */
function hasValidToken() {
    const token = gapi.client.getToken();
    return token !== null;
}

/**
 * Odśwież token jeśli wygasł
 */
async function ensureValidToken() {
    return new Promise((resolve, reject) => {
        if (hasValidToken()) {
            resolve(true);
            return;
        }
        
        // Potrzebujemy nowego tokena
        tokenClient.callback = (response) => {
            if (response.error) {
                reject(response.error);
            } else {
                resolve(true);
            }
        };
        
        tokenClient.requestAccessToken({ prompt: '' });
    });
}

/**
 * Sprawdź status autoryzacji i przekieruj jeśli trzeba
 * Używane na stronie logowania
 */
function checkAuthAndRedirect() {
    if (isUserSignedIn()) {
        window.location.href = 'dashboard.html';
    }
}

/**
 * Sprawdź czy użytkownik jest zalogowany
 * Używane na dashboardzie
 */
function requireAuth() {
    if (!isUserSignedIn()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}
