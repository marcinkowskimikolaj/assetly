/**
 * Assetly - Moduł autoryzacji Google OAuth
 * Token jest zapisywany, przywracany i AUTOMATYCZNIE ODŚWIEŻANY
 */

let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let tokenRefreshTimer = null;

const TOKEN_STORAGE_KEY = 'assetly_google_token';
const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000; // 5 minut przed wygaśnięciem

// ═══════════════════════════════════════════════════════════
// INICJALIZACJA
// ═══════════════════════════════════════════════════════════

async function initGAPI() {
    return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    discoveryDocs: [CONFIG.DISCOVERY_DOC],
                });
                gapiInited = true;
                
                // Przywróć zapisany token jeśli istnieje
                const restored = restoreToken();
                
                // Jeśli przywrócono token, ustaw automatyczne odświeżanie
                if (restored) {
                    scheduleTokenRefresh();
                }
                
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

function initGIS() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: handleTokenResponse,
        error_callback: handleTokenError
    });
    gisInited = true;
}

async function initAuth() {
    try {
        await initGAPI();
        initGIS();
        return true;
    } catch (error) {
        console.error('Auth init error:', error);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════
// OBSŁUGA TOKENA
// ═══════════════════════════════════════════════════════════

function handleTokenResponse(response) {
    if (response.error) {
        console.error('Token error:', response.error);
        showToast('Błąd logowania. Spróbuj ponownie.', 'error');
        return;
    }
    
    // Zapisz token do localStorage
    saveToken(response);
    
    // Ustaw automatyczne odświeżanie
    scheduleTokenRefresh();
    
    // Zapisz status użytkownika
    localStorage.setItem(CONFIG.STORAGE_KEY_USER, JSON.stringify({
        isLoggedIn: true,
        loginTime: new Date().toISOString()
    }));
    
    // Przekieruj na dashboard (tylko jeśli jesteśmy na stronie logowania)
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
        window.location.href = 'dashboard.html';
    }
    
    // Jeśli to było ciche odświeżenie, wywołaj callback
    if (typeof window.onTokenRefreshed === 'function') {
        window.onTokenRefreshed();
    }
}

function handleTokenError(error) {
    console.error('Token client error:', error);
    
    // Jeśli błąd podczas cichego odświeżania
    if (error.type === 'popup_closed' || error.type === 'popup_failed_to_open') {
        // Użytkownik zamknął popup - nie rób nic
        return;
    }
    
    // Inne błędy - wyloguj
    handleGoogleLogout();
}

function saveToken(tokenResponse) {
    const tokenData = {
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type || 'Bearer',
        expires_in: tokenResponse.expires_in || 3600,
        scope: tokenResponse.scope,
        saved_at: Date.now()
    };
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenData));
    
    console.log('[Auth] Token saved, expires in:', tokenData.expires_in, 'seconds');
}

function restoreToken() {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!savedToken) return false;
    
    try {
        const tokenData = JSON.parse(savedToken);
        
        // Sprawdź czy token nie wygasł (z marginesem 5 minut)
        const expiresAt = tokenData.saved_at + (tokenData.expires_in * 1000);
        const now = Date.now();
        
        if (now >= expiresAt - TOKEN_REFRESH_MARGIN) {
            // Token wygasł lub zaraz wygaśnie
            console.log('[Auth] Token expired or expiring soon');
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            return false;
        }
        
        // Przywróć token do gapi
        gapi.client.setToken({
            access_token: tokenData.access_token,
            token_type: tokenData.token_type,
            expires_in: tokenData.expires_in,
            scope: tokenData.scope
        });
        
        console.log('[Auth] Token restored, valid for:', Math.round((expiresAt - now) / 1000 / 60), 'minutes');
        return true;
    } catch (e) {
        console.error('[Auth] Error restoring token:', e);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════
// AUTOMATYCZNE ODŚWIEŻANIE TOKENA
// ═══════════════════════════════════════════════════════════

function scheduleTokenRefresh() {
    // Anuluj poprzedni timer
    if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer);
        tokenRefreshTimer = null;
    }
    
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!savedToken) return;
    
    try {
        const tokenData = JSON.parse(savedToken);
        const expiresAt = tokenData.saved_at + (tokenData.expires_in * 1000);
        const now = Date.now();
        
        // Oblicz kiedy odświeżyć (5 minut przed wygaśnięciem)
        const refreshAt = expiresAt - TOKEN_REFRESH_MARGIN;
        const timeUntilRefresh = refreshAt - now;
        
        if (timeUntilRefresh <= 0) {
            // Trzeba odświeżyć teraz
            console.log('[Auth] Token needs immediate refresh');
            silentRefreshToken();
        } else {
            // Zaplanuj odświeżenie
            console.log('[Auth] Token refresh scheduled in:', Math.round(timeUntilRefresh / 1000 / 60), 'minutes');
            tokenRefreshTimer = setTimeout(() => {
                silentRefreshToken();
            }, timeUntilRefresh);
        }
    } catch (e) {
        console.error('[Auth] Error scheduling refresh:', e);
    }
}

function silentRefreshToken() {
    console.log('[Auth] Attempting silent token refresh...');
    
    if (!tokenClient || !gisInited) {
        console.error('[Auth] Token client not initialized');
        return;
    }
    
    // Ciche odświeżenie - bez promptu jeśli użytkownik już wcześniej zaakceptował
    try {
        tokenClient.requestAccessToken({ 
            prompt: ''  // Pusty prompt = ciche odświeżenie
        });
    } catch (e) {
        console.error('[Auth] Silent refresh failed:', e);
        // Spróbuj z consent
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }
}

// Funkcja do ręcznego odświeżenia tokena (np. po błędzie 401)
async function refreshTokenIfNeeded() {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    
    if (!savedToken) {
        return false;
    }
    
    try {
        const tokenData = JSON.parse(savedToken);
        const expiresAt = tokenData.saved_at + (tokenData.expires_in * 1000);
        const now = Date.now();
        
        // Jeśli token wygasa w ciągu 10 minut, odśwież
        if (now >= expiresAt - 10 * 60 * 1000) {
            return new Promise((resolve) => {
                window.onTokenRefreshed = () => {
                    window.onTokenRefreshed = null;
                    resolve(true);
                };
                
                // Timeout na wypadek gdyby odświeżenie nie zadziałało
                setTimeout(() => {
                    if (window.onTokenRefreshed) {
                        window.onTokenRefreshed = null;
                        resolve(false);
                    }
                }, 30000);
                
                silentRefreshToken();
            });
        }
        
        return true; // Token jeszcze ważny
    } catch (e) {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════
// API WRAPPER Z AUTOMATYCZNYM RETRY
// ═══════════════════════════════════════════════════════════

/**
 * Wrapper do wywołań Google API z automatycznym odświeżaniem tokena
 * Użycie: const result = await apiCallWithRetry(() => gapi.client.sheets.spreadsheets.values.get({...}));
 */
async function apiCallWithRetry(apiCall, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Upewnij się że mamy token
            await ensureValidToken();
            
            // Wykonaj wywołanie API
            const result = await apiCall();
            return result;
            
        } catch (error) {
            const status = error?.status || error?.result?.error?.code;
            
            // Błąd autoryzacji - spróbuj odświeżyć token
            if (status === 401 || status === 403) {
                console.warn(`[Auth] API call failed with ${status}, attempt ${attempt + 1}/${maxRetries + 1}`);
                
                if (attempt < maxRetries) {
                    const refreshed = await refreshTokenIfNeeded();
                    if (refreshed) {
                        console.log('[Auth] Token refreshed, retrying...');
                        continue; // Spróbuj ponownie
                    }
                }
                
                // Nie udało się odświeżyć - wyloguj
                console.error('[Auth] Could not refresh token, logging out');
                handleGoogleLogout();
                throw new Error('Sesja wygasła - zaloguj się ponownie');
            }
            
            // Inny błąd - przekaż dalej
            throw error;
        }
    }
}

// ═══════════════════════════════════════════════════════════
// LOGOWANIE / WYLOGOWANIE
// ═══════════════════════════════════════════════════════════

function handleGoogleLogin() {
    if (!gisInited) {
        showToast('Ładowanie... Spróbuj za chwilę.', 'warning');
        return;
    }
    
    // Zawsze pokaż consent dla pełnych uprawnień przy pierwszym logowaniu
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleGoogleLogout() {
    // Anuluj timer odświeżania
    if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer);
        tokenRefreshTimer = null;
    }
    
    // Anuluj keep-alive
    stopKeepAlive();
    
    const token = gapi.client.getToken();
    
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {});
        gapi.client.setToken(null);
    }
    
    // Wyczyść wszystko z localStorage
    localStorage.removeItem(CONFIG.STORAGE_KEY_USER);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    
    window.location.href = 'index.html';
}

// ═══════════════════════════════════════════════════════════
// SPRAWDZANIE STANU AUTORYZACJI
// ═══════════════════════════════════════════════════════════

function isUserSignedIn() {
    const userData = localStorage.getItem(CONFIG.STORAGE_KEY_USER);
    const tokenData = localStorage.getItem(TOKEN_STORAGE_KEY);
    
    if (!userData || !tokenData) return false;
    
    try {
        const user = JSON.parse(userData);
        const token = JSON.parse(tokenData);
        
        // Sprawdź czy token nie wygasł
        const expiresAt = token.saved_at + (token.expires_in * 1000);
        if (Date.now() >= expiresAt) {
            // Token wygasł ale może uda się odświeżyć - nie wylogowujemy od razu
            return user.isLoggedIn === true;
        }
        
        return user.isLoggedIn === true;
    } catch {
        return false;
    }
}

function hasValidToken() {
    const token = gapi.client.getToken();
    return token !== null && token.access_token;
}

async function ensureValidToken() {
    // Najpierw sprawdź czy mamy token w gapi
    if (hasValidToken()) {
        // Sprawdź czy nie wygasa wkrótce
        const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (savedToken) {
            const tokenData = JSON.parse(savedToken);
            const expiresAt = tokenData.saved_at + (tokenData.expires_in * 1000);
            
            // Jeśli wygasa w ciągu 2 minut, odśwież w tle
            if (Date.now() >= expiresAt - 2 * 60 * 1000) {
                silentRefreshToken();
            }
        }
        return true;
    }
    
    // Spróbuj przywrócić z localStorage
    if (restoreToken() && hasValidToken()) {
        scheduleTokenRefresh();
        return true;
    }
    
    // Spróbuj ciche odświeżenie
    const refreshed = await refreshTokenIfNeeded();
    if (refreshed && hasValidToken()) {
        return true;
    }
    
    // Brak ważnego tokena - przekieruj na login
    handleGoogleLogout();
    throw new Error('Brak ważnego tokena - wymagane ponowne logowanie');
}

function checkAuthAndRedirect() {
    if (isUserSignedIn()) {
        window.location.href = 'dashboard.html';
    }
}

function requireAuth() {
    if (!isUserSignedIn()) {
        window.location.href = 'index.html';
        return false;
    }
    
    // Ustaw odświeżanie tokena jeśli jeszcze nie ustawione
    if (!tokenRefreshTimer) {
        scheduleTokenRefresh();
    }
    
    // Uruchom keep-alive
    startKeepAlive();
    
    return true;
}

// ═══════════════════════════════════════════════════════════
// KEEP-ALIVE - utrzymuje połączenie aktywne
// ═══════════════════════════════════════════════════════════

let keepAliveTimer = null;

function startKeepAlive() {
    if (keepAliveTimer) return;
    
    // Pinguj API co 10 minut żeby utrzymać połączenie
    keepAliveTimer = setInterval(async () => {
        if (!hasValidToken()) return;
        
        try {
            // Lekkie zapytanie do API
            await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                fields: 'spreadsheetId'
            });
            console.log('[Auth] Keep-alive ping OK');
        } catch (e) {
            console.warn('[Auth] Keep-alive ping failed:', e);
            // Spróbuj odświeżyć token
            silentRefreshToken();
        }
    }, 10 * 60 * 1000); // Co 10 minut
}

function stopKeepAlive() {
    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
    }
}

// Obsługa widoczności strony - odśwież token gdy użytkownik wraca do karty
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isUserSignedIn()) {
        console.log('[Auth] Page visible, checking token...');
        
        // Sprawdź czy trzeba odświeżyć token
        const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (savedToken) {
            const tokenData = JSON.parse(savedToken);
            const expiresAt = tokenData.saved_at + (tokenData.expires_in * 1000);
            const now = Date.now();
            
            // Jeśli token wygasł lub wygasa w ciągu 5 minut
            if (now >= expiresAt - TOKEN_REFRESH_MARGIN) {
                console.log('[Auth] Token expired/expiring, refreshing...');
                silentRefreshToken();
            } else {
                // Przywróć token do gapi jeśli nie ma
                if (!hasValidToken()) {
                    restoreToken();
                }
                scheduleTokenRefresh();
            }
        }
        
        startKeepAlive();
    } else {
        stopKeepAlive();
    }
});
