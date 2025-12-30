/**
 * Assetly - Moduł autoryzacji Google OAuth
 */

let tokenClient = null;
let gapiInited = false;
let gisInited = false;

async function initGAPI() {
    return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    discoveryDocs: [CONFIG.DISCOVERY_DOC],
                });
                gapiInited = true;
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
    
    localStorage.setItem(CONFIG.STORAGE_KEY_USER, JSON.stringify({
        isLoggedIn: true,
        loginTime: new Date().toISOString()
    }));
    
    window.location.href = 'dashboard.html';
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
    
    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function handleGoogleLogout() {
    const token = gapi.client.getToken();
    
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {});
        gapi.client.setToken(null);
    }
    
    localStorage.removeItem(CONFIG.STORAGE_KEY_USER);
    window.location.href = 'index.html';
}

function isUserSignedIn() {
    const userData = localStorage.getItem(CONFIG.STORAGE_KEY_USER);
    if (!userData) return false;
    
    try {
        return JSON.parse(userData).isLoggedIn === true;
    } catch {
        return false;
    }
}

function hasValidToken() {
    return gapi.client.getToken() !== null;
}

async function ensureValidToken() {
    return new Promise((resolve, reject) => {
        if (hasValidToken()) {
            resolve(true);
            return;
        }
        
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
