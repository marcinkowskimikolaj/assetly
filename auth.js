/**
 * Assetly - Moduł autoryzacji Google OAuth
 * Token jest zapisywany i przywracany automatycznie
 */

let tokenClient = null;
let gapiInited = false;
let gisInited = false;

const TOKEN_STORAGE_KEY = 'assetly_google_token';

async function initGAPI() {
    return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    discoveryDocs: [CONFIG.DISCOVERY_DOC],
                });
                gapiInited = true;
                
                // Przywróć zapisany token jeśli istnieje
                restoreToken();
                
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
    });
    gisInited = true;
}

function handleTokenResponse(response) {
    if (response.error) {
        showToast('Błąd logowania. Spróbuj ponownie.', 'error');
        return;
    }
    
    // Zapisz token do localStorage
    saveToken(response);
    
    // Zapisz status użytkownika
    localStorage.setItem(CONFIG.STORAGE_KEY_USER, JSON.stringify({
        isLoggedIn: true,
        loginTime: new Date().toISOString()
    }));
    
    // Przekieruj na dashboard (tylko jeśli jesteśmy na stronie logowania)
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
        window.location.href = 'dashboard.html';
    }
}

function saveToken(tokenResponse) {
    const tokenData = {
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type,
        expires_in: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        saved_at: Date.now()
    };
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenData));
}

function restoreToken() {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!savedToken) return false;
    
    try {
        const tokenData = JSON.parse(savedToken);
        
        // Sprawdź czy token nie wygasł (z marginesem 5 minut)
        const expiresAt = tokenData.saved_at + (tokenData.expires_in * 1000);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (now >= expiresAt - fiveMinutes) {
            // Token wygasł lub zaraz wygaśnie
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
        
        return true;
    } catch (e) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return false;
    }
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

function handleGoogleLogin() {
    if (!gisInited) {
        showToast('Ładowanie... Spróbuj za chwilę.', 'warning');
        return;
    }
    
    // Zawsze pokaż consent dla pełnych uprawnień
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleGoogleLogout() {
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
            return false;
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
        return true;
    }
    
    // Spróbuj przywrócić z localStorage
    if (restoreToken() && hasValidToken()) {
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
    return true;
}
