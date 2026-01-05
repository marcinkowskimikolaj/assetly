/**
 * Assetly - Budget AI Assistant v2.1 (Fixed)
 * Kaskadowy provider: Gemini → LLM7 → OpenAI
 * Lokalny router intencji (bez LLM klasyfikacji - eliminuje lag)
 */

// ═══════════════════════════════════════════════════════════
// KONFIGURACJA
// ═══════════════════════════════════════════════════════════

const AI_PROVIDERS = {
    gemini: {
        name: 'Google Gemini',
        models: [
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (zalecany)' },
            { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash' },
            { id: 'gemini-pro', name: 'Gemini Pro' }
        ],
        defaultModel: 'gemini-2.0-flash',
        icon: '🟣',
        color: '#8b5cf6'
    },
    llm7: {
        name: 'LLM7.io',
        models: [
            { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano (szybki)' },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' }
        ],
        defaultModel: 'gpt-4.1-nano',
        icon: '🔵',
        color: '#3b82f6'
    },
    openai: {
        name: 'OpenAI',
        models: [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ],
        defaultModel: 'gpt-4o-mini',
        icon: '🟢',
        color: '#10a37f'
    }
};

const AI_MODES = {
    auto: { name: 'Automatyczny', description: 'Kaskada: Gemini → LLM7 → OpenAI' },
    gemini: { name: 'Tylko Gemini', description: 'Google Gemini' },
    llm7: { name: 'Tylko LLM7', description: 'LLM7.io' },
    openai: { name: 'Tylko OpenAI', description: 'OpenAI' }
};

const PROVIDER_TIMEOUT = 45000; // 45 sekund - LLM7 potrzebuje czasu

const QUICK_PROMPTS = [
    { id: 'summary', label: 'Podsumowanie', icon: '📊', prompt: 'Podaj kompletne podsumowanie moich finansów: łączne dochody, wydatki, bilans, stopa oszczędności. Wymień top 5 kategorii wydatków.' },
    { id: 'top-expenses', label: 'Top wydatki', icon: '💸', prompt: 'Podaj TOP 10 podkategorii na które wydaję najwięcej. Dla każdej podaj sumę i procent całości.' },
    { id: 'savings', label: 'Oszczędności', icon: '💰', prompt: 'Gdzie mogę zaoszczędzić? Wskaż kategorie z największym potencjałem oszczędności.' },
    { id: 'trends', label: 'Trendy', icon: '📈', prompt: 'Jak zmieniają się moje wydatki miesiąc do miesiąca? Które kategorie rosną najszybciej?' },
    { id: 'income', label: 'Dochody', icon: '💵', prompt: 'Przeanalizuj moje dochody: źródła, średnia miesięczna, historia wynagrodzeń i podwyżek.' },
    { id: '503020', label: '50/30/20', icon: '🎯', prompt: 'Przeanalizuj moje finanse według metodyki 50/30/20 (potrzeby/zachcianki/oszczędności).' },
    { id: 'compare', label: 'Porównanie', icon: '📅', prompt: 'Porównaj moje finanse z ostatnich 3 miesięcy. Który był najlepszy, który najgorszy?' },
    { id: 'fuel', label: 'Paliwo', icon: '⛽', prompt: 'Ile wydałem na paliwo? Podaj sumę, średnią miesięczną i rozbicie na miesiące.' }
];

// ═══════════════════════════════════════════════════════════
// STAN
// ═══════════════════════════════════════════════════════════

let aiState = {
    keys: { gemini: null, llm7: null, openai: null },
    mode: 'auto',
    models: { 
        gemini: 'gemini-2.0-flash', 
        llm7: 'gpt-4.1-nano', 
        openai: 'gpt-4o-mini' 
    },
    status: {
        gemini: { tested: false, working: false, error: null },
        llm7: { tested: false, working: false, error: null },
        openai: { tested: false, working: false, error: null }
    },
    stats: { geminiCalls: 0, llm7Calls: 0, openaiCalls: 0, fallbacks: 0 },
    lastProvider: null
};

let chatHistory = [];
let settingsOpen = false;

// ═══════════════════════════════════════════════════════════
// PERSYSTENCJA
// ═══════════════════════════════════════════════════════════

function loadAiSettings() {
    try {
        const saved = localStorage.getItem('assetly_ai_v2');
        if (saved) {
            const p = JSON.parse(saved);
            aiState.keys = { ...aiState.keys, ...p.keys };
            aiState.mode = p.mode || 'auto';
            aiState.models = { ...aiState.models, ...p.models };
            aiState.stats = { ...aiState.stats, ...p.stats };
        }
        // Migracja starego klucza
        const oldKey = localStorage.getItem('openai_api_key');
        if (oldKey && !aiState.keys.openai) aiState.keys.openai = oldKey;
    } catch (e) { console.warn('Load settings error:', e); }
}

function saveAiSettings() {
    try {
        localStorage.setItem('assetly_ai_v2', JSON.stringify({
            keys: aiState.keys,
            mode: aiState.mode,
            models: aiState.models,
            stats: aiState.stats
        }));
    } catch (e) {}
}

// ═══════════════════════════════════════════════════════════
// PRZYGOTOWANIE DANYCH - KOMPLETNE
// ═══════════════════════════════════════════════════════════

function prepareBudgetData() {
    if (typeof allExpenses === 'undefined' || typeof allIncome === 'undefined') {
        return { error: 'Dane nie zostały załadowane.' };
    }
    
    if (allExpenses.length === 0 && allIncome.length === 0) {
        return { error: 'Brak danych. Dodaj wydatki lub dochody.' };
    }
    
    // Podstawowe sumy
    const totalExp = allExpenses.reduce((s, e) => s + e.kwotaPLN, 0);
    const totalInc = allIncome.reduce((s, i) => s + i.kwotaPLN, 0);
    const balance = totalInc - totalExp;
    
    // Okresy
    const periods = new Set();
    allExpenses.forEach(e => periods.add(`${e.rok}-${String(e.miesiac).padStart(2,'0')}`));
    allIncome.forEach(i => periods.add(`${i.rok}-${String(i.miesiac).padStart(2,'0')}`));
    const sortedPeriods = [...periods].sort();
    const monthCount = periods.size || 1;
    
    // Wydatki wg kategorii
    const byCategory = {};
    allExpenses.forEach(e => {
        if (!byCategory[e.kategoria]) {
            byCategory[e.kategoria] = { total: 0, count: 0, subcategories: {} };
        }
        byCategory[e.kategoria].total += e.kwotaPLN;
        byCategory[e.kategoria].count++;
        
        const sub = e.podkategoria || '(inne)';
        if (!byCategory[e.kategoria].subcategories[sub]) {
            byCategory[e.kategoria].subcategories[sub] = { total: 0, count: 0, months: {} };
        }
        byCategory[e.kategoria].subcategories[sub].total += e.kwotaPLN;
        byCategory[e.kategoria].subcategories[sub].count++;
        
        const period = `${e.rok}-${String(e.miesiac).padStart(2,'0')}`;
        if (!byCategory[e.kategoria].subcategories[sub].months[period]) {
            byCategory[e.kategoria].subcategories[sub].months[period] = 0;
        }
        byCategory[e.kategoria].subcategories[sub].months[period] += e.kwotaPLN;
    });
    
    // TOP podkategorie
    const allSubs = [];
    Object.entries(byCategory).forEach(([cat, data]) => {
        Object.entries(data.subcategories).forEach(([sub, subData]) => {
            allSubs.push({
                kategoria: cat,
                podkategoria: sub,
                suma: subData.total,
                liczba: subData.count,
                srMies: subData.total / monthCount,
                procent: totalExp > 0 ? (subData.total / totalExp * 100) : 0,
                miesiace: subData.months
            });
        });
    });
    allSubs.sort((a, b) => b.suma - a.suma);
    
    // Miesięczne agregaty
    const monthly = {};
    allExpenses.forEach(e => {
        const p = `${e.rok}-${String(e.miesiac).padStart(2,'0')}`;
        if (!monthly[p]) monthly[p] = { okres: p, dochod: 0, wydatki: 0, stale: 0, zmienne: 0 };
        monthly[p].wydatki += e.kwotaPLN;
        if (e.jestStaly) monthly[p].stale += e.kwotaPLN;
        else monthly[p].zmienne += e.kwotaPLN;
    });
    allIncome.forEach(i => {
        const p = `${i.rok}-${String(i.miesiac).padStart(2,'0')}`;
        if (!monthly[p]) monthly[p] = { okres: p, dochod: 0, wydatki: 0, stale: 0, zmienne: 0 };
        monthly[p].dochod += i.kwotaPLN;
    });
    const monthlyArr = Object.values(monthly).sort((a, b) => a.okres.localeCompare(b.okres));
    monthlyArr.forEach(m => {
        m.bilans = m.dochod - m.wydatki;
        m.stopaOszcz = m.dochod > 0 ? (m.bilans / m.dochod * 100) : 0;
    });
    
    // Dochody wg źródeł
    const incBySrc = {};
    allIncome.forEach(i => {
        if (!incBySrc[i.zrodlo]) incBySrc[i.zrodlo] = { total: 0, count: 0, employers: {} };
        incBySrc[i.zrodlo].total += i.kwotaPLN;
        incBySrc[i.zrodlo].count++;
        if (i.pracodawca) {
            if (!incBySrc[i.zrodlo].employers[i.pracodawca]) {
                incBySrc[i.zrodlo].employers[i.pracodawca] = [];
            }
            incBySrc[i.zrodlo].employers[i.pracodawca].push({
                okres: `${i.rok}-${String(i.miesiac).padStart(2,'0')}`,
                kwota: i.kwotaPLN
            });
        }
    });
    
    // Historia wynagrodzeń
    const salaryHistory = [];
    if (incBySrc['Wynagrodzenie']) {
        Object.entries(incBySrc['Wynagrodzenie'].employers).forEach(([emp, records]) => {
            records.sort((a, b) => a.okres.localeCompare(b.okres));
            salaryHistory.push({ pracodawca: emp, historia: records });
        });
    }
    
    // 50/30/20
    let needs = 0, wants = 0;
    allExpenses.forEach(e => {
        if (e.jestTransfer) return;
        const meth = typeof BudgetCategories !== 'undefined' ? BudgetCategories.getMethodology(e.kategoria) : 'wants';
        if (meth === 'needs') needs += e.kwotaPLN;
        else wants += e.kwotaPLN;
    });
    const savings = totalInc - needs - wants;
    
    return {
        podsumowanie: {
            wydatkiLacznie: totalExp,
            dochodyLacznie: totalInc,
            bilans: balance,
            stopaOszczednosci: totalInc > 0 ? (balance / totalInc * 100) : 0,
            liczbaWydatkow: allExpenses.length,
            liczbaDochodow: allIncome.length,
            okresOd: sortedPeriods[0],
            okresDo: sortedPeriods[sortedPeriods.length - 1],
            liczbaMiesiecy: monthCount,
            srWydatkiMies: totalExp / monthCount,
            srDochodyMies: totalInc / monthCount
        },
        wydatkiWgKategorii: Object.entries(byCategory).map(([k, v]) => ({
            kategoria: k,
            suma: v.total,
            liczba: v.count,
            procent: totalExp > 0 ? (v.total / totalExp * 100) : 0
        })).sort((a, b) => b.suma - a.suma),
        topPodkategorie: allSubs.slice(0, 25),
        miesieczne: monthlyArr,
        dochodyWgZrodel: Object.entries(incBySrc).map(([k, v]) => ({
            zrodlo: k,
            suma: v.total,
            liczba: v.count,
            procent: totalInc > 0 ? (v.total / totalInc * 100) : 0
        })),
        historiaWynagrodzen: salaryHistory,
        metodyka503020: {
            potrzeby: { kwota: needs, procent: totalInc > 0 ? (needs / totalInc * 100) : 0, cel: 50 },
            zachcianki: { kwota: wants, procent: totalInc > 0 ? (wants / totalInc * 100) : 0, cel: 30 },
            oszczednosci: { kwota: savings, procent: totalInc > 0 ? (savings / totalInc * 100) : 0, cel: 20 }
        }
    };
}

// ═══════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════

function getSystemPrompt() {
    return `Jesteś ekspertem od finansów osobistych. Analizujesz dane budżetowe użytkownika.

## ZASADY BEZWZGLĘDNE
1. Odpowiadaj WYŁĄCZNIE po polsku
2. Używaj TYLKO danych z kontekstu - NIGDY nie wymyślaj
3. Format kwot: "1 234,56 zł" (spacja jako separator tysięcy, przecinek dziesiętny)
4. Procenty: jeden znak po przecinku, np. "23,5%"
5. Dla rankingów i porównań ZAWSZE używaj tabel markdown

## STRUKTURA DANYCH
- podsumowanie: wydatkiLacznie, dochodyLacznie, bilans, stopaOszczednosci
- wydatkiWgKategorii: [{kategoria, suma, procent}]
- topPodkategorie: [{kategoria, podkategoria, suma, srMies, procent, miesiace}]
- miesieczne: [{okres, dochod, wydatki, bilans, stopaOszcz}]
- dochodyWgZrodel: [{zrodlo, suma, procent}]
- historiaWynagrodzen: [{pracodawca, historia: [{okres, kwota}]}]
- metodyka503020: {potrzeby, zachcianki, oszczednosci}

## WAŻNE
- Gdy pytanie o konkretną podkategorię (np. "paliwo") - szukaj w topPodkategorie i podsumuj dane z miesiace
- Transfery NIE są wydatkami konsumpcyjnymi
- Dawaj konkretne wnioski i rekomendacje

## FORMAT TABEL
| Kolumna | Wartość |
|---------|---------|
| Dane    | 1 234 zł |`;
}

// ═══════════════════════════════════════════════════════════
// API CALLS
// ═══════════════════════════════════════════════════════════

async function callGemini(messages) {
    const apiKey = aiState.keys.gemini;
    const model = aiState.models.gemini;
    
    // Przygotuj treść
    let systemText = '';
    const contents = [];
    
    messages.forEach(m => {
        if (m.role === 'system') {
            systemText += m.content + '\n\n';
        } else {
            contents.push({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            });
        }
    });
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const body = {
        contents,
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096
        }
    };
    
    if (systemText) {
        body.systemInstruction = { parts: [{ text: systemText }] };
    }
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Brak odpowiedzi');
    }
    
    return data.candidates[0].content.parts[0].text;
}

async function callLLM7(messages) {
    const response = await fetch('https://api.llm7.io/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiState.keys.llm7}`
        },
        body: JSON.stringify({
            model: aiState.models.llm7,
            messages,
            temperature: 0.3,
            max_tokens: 4096
        })
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

async function callOpenAI(messages) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiState.keys.openai}`
        },
        body: JSON.stringify({
            model: aiState.models.openai,
            messages,
            temperature: 0.3,
            max_tokens: 4096
        })
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

async function callProviderWithTimeout(provider, messages) {
    const callers = {
        gemini: callGemini,
        llm7: callLLM7,
        openai: callOpenAI
    };
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timeout (45s)'));
        }, PROVIDER_TIMEOUT);
        
        callers[provider](messages)
            .then(result => {
                clearTimeout(timeout);
                resolve(result);
            })
            .catch(err => {
                clearTimeout(timeout);
                reject(err);
            });
    });
}

// ═══════════════════════════════════════════════════════════
// KASKADOWY FALLBACK
// ═══════════════════════════════════════════════════════════

function getProviderOrder() {
    if (aiState.mode !== 'auto') {
        return aiState.keys[aiState.mode] ? [aiState.mode] : [];
    }
    return ['gemini', 'llm7', 'openai'].filter(p => aiState.keys[p]);
}

async function callWithFallback(messages, onStatus) {
    const providers = getProviderOrder();
    
    if (providers.length === 0) {
        throw new Error('Brak kluczy API. Skonfiguruj w ⚙️ Ustawieniach.');
    }
    
    const errors = [];
    
    for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        const cfg = AI_PROVIDERS[provider];
        
        onStatus?.(`${cfg.icon} ${cfg.name}...`);
        
        try {
            const response = await callProviderWithTimeout(provider, messages);
            
            if (!response || response.trim() === '') {
                throw new Error('Pusta odpowiedź');
            }
            
            // Sukces
            aiState.status[provider] = { tested: true, working: true, error: null };
            aiState.stats[`${provider}Calls`]++;
            aiState.lastProvider = provider;
            saveAiSettings();
            
            return { response, provider };
            
        } catch (err) {
            console.warn(`Błąd ${provider}:`, err.message);
            errors.push({ provider, error: err.message });
            aiState.status[provider] = { tested: true, working: false, error: err.message };
            
            if (i < providers.length - 1) {
                aiState.stats.fallbacks++;
                onStatus?.(`⚠️ ${cfg.name} niedostępny...`);
                await new Promise(r => setTimeout(r, 300));
            }
        }
    }
    
    throw new Error(errors.map(e => `${AI_PROVIDERS[e.provider].name}: ${e.error}`).join('\n'));
}

// ═══════════════════════════════════════════════════════════
// GŁÓWNA FUNKCJA
// ═══════════════════════════════════════════════════════════

async function sendBudgetMessage(customMessage = null) {
    const input = document.getElementById('budgetChatInput');
    const message = customMessage || input?.value?.trim();
    
    if (!message) return;
    if (input) input.value = '';
    
    addChatMessage('user', message);
    
    // Przygotuj dane
    const data = prepareBudgetData();
    if (data.error) {
        addChatMessage('assistant', `⚠️ ${data.error}`);
        return;
    }
    
    // Loading
    const loadingId = addChatMessage('assistant', '⏳ Analizuję...');
    
    // Buduj kontekst
    const dataStr = JSON.stringify(data, null, 2);
    console.log('📊 Rozmiar kontekstu:', (dataStr.length / 1024).toFixed(1), 'KB');
    
    const messages = [
        { role: 'system', content: getSystemPrompt() },
        { role: 'system', content: `## DANE FINANSOWE UŻYTKOWNIKA\n\`\`\`json\n${dataStr}\n\`\`\`` },
        ...chatHistory.slice(-6),
        { role: 'user', content: message }
    ];
    
    try {
        const { response, provider } = await callWithFallback(messages, status => {
            updateChatMessage(loadingId, `⏳ ${status}`);
        });
        
        chatHistory.push({ role: 'user', content: message });
        chatHistory.push({ role: 'assistant', content: response });
        
        removeChatMessage(loadingId);
        addChatMessage('assistant', response, provider);
        
    } catch (err) {
        removeChatMessage(loadingId);
        addChatMessage('assistant', `❌ Błąd:\n${err.message}\n\nSprawdź ustawienia ⚙️`);
    }
}

function runQuickPrompt(id) {
    const p = QUICK_PROMPTS.find(x => x.id === id);
    if (p) sendBudgetMessage(p.prompt);
}

// ═══════════════════════════════════════════════════════════
// UI - CHAT
// ═══════════════════════════════════════════════════════════

let msgId = 0;

function addChatMessage(role, content, provider = null) {
    const container = document.getElementById('budgetChatMessages');
    if (!container) return null;
    
    container.querySelector('.chat-welcome')?.remove();
    
    const id = `msg-${++msgId}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = `chat-message ${role}`;
    
    const badge = provider ? `<span class="provider-tag" style="background:${AI_PROVIDERS[provider].color}">${AI_PROVIDERS[provider].icon} ${AI_PROVIDERS[provider].name}</span>` : '';
    
    div.innerHTML = `
        <div class="msg-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="msg-bubble">
            ${badge}
            <div class="msg-text">${formatMd(content)}</div>
        </div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function updateChatMessage(id, content) {
    const el = document.getElementById(id);
    if (el) {
        const txt = el.querySelector('.msg-text');
        if (txt) txt.innerHTML = formatMd(content);
    }
}

function removeChatMessage(id) {
    document.getElementById(id)?.remove();
}

function formatMd(text) {
    if (!text) return '';
    
    // Code blocks
    text = text.replace(/```[\s\S]*?```/g, m => {
        const code = m.replace(/```\w*\n?/g, '').replace(/```$/g, '');
        return `<pre>${escapeHtml(code)}</pre>`;
    });
    
    // Tables
    text = text.replace(/(\|.+\|[\r\n]+)+/g, match => {
        const rows = match.trim().split(/[\r\n]+/).filter(r => r.includes('|'));
        let html = '<table>';
        rows.forEach((row, i) => {
            if (row.match(/^\|[\s\-:]+\|$/)) return;
            const cells = row.split('|').slice(1, -1);
            const tag = i === 0 ? 'th' : 'td';
            html += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
        });
        return html + '</table>';
    });
    
    // Lists
    text = text.replace(/^[\t ]*[-*]\s+(.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>[\s\S]*?<\/li>)+/g, '<ul>$&</ul>');
    
    // Inline
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    text = text.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    
    // Newlines
    text = text.replace(/\n/g, '<br>');
    text = text.replace(/<\/(table|ul|pre|h[34])><br>/g, '</$1>');
    
    return text;
}

function escapeHtml(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ═══════════════════════════════════════════════════════════
// UI - MAIN RENDER
// ═══════════════════════════════════════════════════════════

function renderBudgetAITab() {
    const container = document.getElementById('budget-ai');
    if (!container) return;
    
    loadAiSettings();
    
    const expCount = typeof allExpenses !== 'undefined' ? allExpenses.length : 0;
    const incCount = typeof allIncome !== 'undefined' ? allIncome.length : 0;
    const hasKey = Object.values(aiState.keys).some(k => k);
    
    const provBadges = Object.entries(AI_PROVIDERS).map(([id, cfg]) => {
        const has = !!aiState.keys[id];
        return `<span class="prov-indicator ${has ? 'active' : ''}" title="${cfg.name} ${has ? '✓' : '✗'}">${cfg.icon}</span>`;
    }).join('');
    
    container.innerHTML = `
        <div class="ai-panel">
            <div class="ai-header">
                <div class="ai-stats">
                    <span class="stat-badge">📊 ${expCount} wydatków</span>
                    <span class="stat-badge">💵 ${incCount} dochodów</span>
                </div>
                <div class="ai-controls">
                    ${provBadges}
                    <span class="mode-tag">${AI_MODES[aiState.mode].name}</span>
                    <button class="btn-settings" onclick="openAiSettings()" title="Ustawienia">⚙️</button>
                </div>
            </div>
            
            <div class="card">
                <h3 class="card-title">🤖 Asystent AI</h3>
                <div class="quick-btns">
                    ${QUICK_PROMPTS.map(p => `
                        <button class="qbtn" onclick="runQuickPrompt('${p.id}')" title="${p.prompt}">
                            <span class="qicon">${p.icon}</span>
                            <span class="qlabel">${p.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div class="card chat-box">
                <div id="budgetChatMessages" class="chat-msgs">
                    <div class="chat-welcome">
                        <h4>👋 Witaj!</h4>
                        <p>Zadaj pytanie o finanse lub wybierz szybką analizę.</p>
                        ${!hasKey ? '<p class="warn">⚠️ Dodaj klucz API w ⚙️ Ustawieniach</p>' : ''}
                    </div>
                </div>
                <div class="chat-input-row">
                    <input type="text" id="budgetChatInput" class="chat-input" 
                        placeholder="Zadaj pytanie..." 
                        onkeypress="if(event.key==='Enter')sendBudgetMessage()"
                        ${!hasKey ? 'disabled' : ''}>
                    <button class="btn-send" onclick="sendBudgetMessage()" ${!hasKey ? 'disabled' : ''}>➤</button>
                </div>
            </div>
        </div>
        
        <div id="aiSettingsModal" class="ai-modal ${settingsOpen ? 'show' : ''}">
            <div class="ai-modal-box">
                ${renderSettingsContent()}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// UI - SETTINGS
// ═══════════════════════════════════════════════════════════

function renderSettingsContent() {
    return `
        <div class="modal-head">
            <h3>⚙️ Ustawienia AI</h3>
            <button class="btn-x" onclick="closeAiSettings()">✕</button>
        </div>
        <div class="modal-body">
            <section class="settings-section">
                <h4>Tryb</h4>
                <div class="mode-list">
                    ${Object.entries(AI_MODES).map(([id, m]) => `
                        <label class="mode-item ${aiState.mode === id ? 'sel' : ''}">
                            <input type="radio" name="aimode" value="${id}" ${aiState.mode === id ? 'checked' : ''} onchange="setAiMode('${id}')">
                            <span class="mname">${m.name}</span>
                            <span class="mdesc">${m.description}</span>
                        </label>
                    `).join('')}
                </div>
            </section>
            
            ${Object.entries(AI_PROVIDERS).map(([id, cfg]) => `
                <section class="settings-section prov-box">
                    <div class="prov-head">
                        <h4>${cfg.icon} ${cfg.name}</h4>
                        <span class="pstatus ${aiState.status[id].working ? 'ok' : aiState.status[id].tested ? 'err' : ''}">
                            ${aiState.status[id].working ? '✓' : aiState.status[id].tested ? '✗' : '—'}
                        </span>
                    </div>
                    <div class="key-row">
                        <input type="password" id="key-${id}" class="key-input" 
                            value="${aiState.keys[id] || ''}" 
                            placeholder="Klucz API..."
                            onchange="setAiKey('${id}', this.value)">
                        <button class="btn-sm" onclick="toggleKeyVis('key-${id}')">👁️</button>
                        <button class="btn-sm" onclick="testProvider('${id}')" ${!aiState.keys[id] ? 'disabled' : ''}>Test</button>
                    </div>
                    <select class="model-select" onchange="setAiModel('${id}', this.value)">
                        ${cfg.models.map(m => `<option value="${m.id}" ${aiState.models[id] === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
                    </select>
                    ${aiState.status[id].error ? `<p class="perror">${aiState.status[id].error}</p>` : ''}
                </section>
            `).join('')}
            
            <section class="settings-section">
                <h4>📈 Statystyki</h4>
                <div class="stats-grid">
                    <div class="sbox"><span class="sval">${aiState.stats.geminiCalls}</span><span class="slbl">Gemini</span></div>
                    <div class="sbox"><span class="sval">${aiState.stats.llm7Calls}</span><span class="slbl">LLM7</span></div>
                    <div class="sbox"><span class="sval">${aiState.stats.openaiCalls}</span><span class="slbl">OpenAI</span></div>
                    <div class="sbox"><span class="sval">${aiState.stats.fallbacks}</span><span class="slbl">Fallback</span></div>
                </div>
            </section>
        </div>
    `;
}

function openAiSettings() {
    settingsOpen = true;
    const modal = document.getElementById('aiSettingsModal');
    if (modal) {
        modal.classList.add('show');
        modal.querySelector('.ai-modal-box').innerHTML = renderSettingsContent();
    }
}

function closeAiSettings() {
    settingsOpen = false;
    document.getElementById('aiSettingsModal')?.classList.remove('show');
    renderBudgetAITab();
}

function setAiMode(mode) {
    aiState.mode = mode;
    saveAiSettings();
    document.querySelector('.ai-modal-box').innerHTML = renderSettingsContent();
}

function setAiKey(provider, val) {
    aiState.keys[provider] = val.trim() || null;
    aiState.status[provider] = { tested: false, working: false, error: null };
    saveAiSettings();
}

function setAiModel(provider, model) {
    aiState.models[provider] = model;
    saveAiSettings();
}

function toggleKeyVis(inputId) {
    const el = document.getElementById(inputId);
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

async function testProvider(provider) {
    const btn = event.target;
    btn.textContent = '...';
    btn.disabled = true;
    
    try {
        const testMsg = [{ role: 'user', content: 'Odpowiedz jednym słowem: OK' }];
        
        if (provider === 'gemini') await callGemini(testMsg);
        else if (provider === 'llm7') await callLLM7(testMsg);
        else await callOpenAI(testMsg);
        
        aiState.status[provider] = { tested: true, working: true, error: null };
        showToast?.(`${AI_PROVIDERS[provider].name}: OK!`, 'success');
    } catch (e) {
        aiState.status[provider] = { tested: true, working: false, error: e.message };
        showToast?.(`${AI_PROVIDERS[provider].name}: ${e.message}`, 'error');
    }
    
    saveAiSettings();
    btn.textContent = 'Test';
    btn.disabled = false;
    document.querySelector('.ai-modal-box').innerHTML = renderSettingsContent();
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

if (!document.getElementById('budgetAiStyles3')) {
    const s = document.createElement('style');
    s.id = 'budgetAiStyles3';
    s.textContent = `
.ai-panel{display:flex;flex-direction:column;gap:16px}
.ai-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.ai-stats{display:flex;gap:6px}
.stat-badge{background:var(--bg-hover);padding:4px 10px;border-radius:6px;font-size:.75rem}
.ai-controls{display:flex;gap:6px;align-items:center}
.prov-indicator{width:22px;height:22px;border-radius:50%;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:.85rem;opacity:.35}
.prov-indicator.active{opacity:1;background:rgba(139,92,246,.15)}
.mode-tag{background:var(--primary);color:#fff;padding:2px 8px;border-radius:4px;font-size:.7rem}
.btn-settings{background:none;border:none;font-size:1.1rem;cursor:pointer;padding:4px}
.quick-btns{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px}
.qbtn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;background:var(--bg-hover);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:.15s}
.qbtn:hover{border-color:var(--primary);transform:translateY(-1px)}
.qicon{font-size:1.2rem}
.qlabel{font-size:.68rem;text-align:center}
.chat-box{display:flex;flex-direction:column;min-height:380px}
.chat-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;max-height:420px}
.chat-welcome{padding:14px;background:var(--bg-hover);border-radius:8px}
.chat-welcome h4{margin:0 0 6px}
.chat-welcome .warn{color:#f59e0b;margin-top:10px}
.chat-message{display:flex;gap:8px;max-width:90%}
.chat-message.user{align-self:flex-end;flex-direction:row-reverse}
.msg-avatar{width:30px;height:30px;border-radius:50%;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0}
.msg-bubble{display:flex;flex-direction:column;gap:3px}
.provider-tag{align-self:flex-start;padding:1px 6px;border-radius:6px;font-size:.6rem;color:#fff}
.msg-text{padding:10px 12px;border-radius:10px;background:var(--bg-card);border:1px solid var(--border);font-size:.84rem;line-height:1.5}
.chat-message.user .msg-text{background:var(--primary);color:#fff;border:none}
.msg-text h3,.msg-text h4{margin:8px 0 4px}
.msg-text h3:first-child,.msg-text h4:first-child{margin-top:0}
.msg-text table{border-collapse:collapse;margin:8px 0;font-size:.78rem;width:100%;display:block;overflow-x:auto}
.msg-text th,.msg-text td{border:1px solid var(--border);padding:5px 8px;text-align:left}
.msg-text th{background:var(--primary);color:#fff}
.msg-text tr:nth-child(even) td{background:var(--bg-hover)}
.msg-text ul{margin:6px 0;padding-left:18px}
.msg-text code{background:var(--bg-hover);padding:1px 4px;border-radius:3px;font-size:.8em}
.msg-text pre{background:var(--bg-hover);padding:8px;border-radius:6px;overflow-x:auto;font-size:.8rem}
.chat-input-row{display:flex;gap:8px;padding:10px;border-top:1px solid var(--border)}
.chat-input{flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-hover);color:var(--text-primary);font-size:.9rem}
.chat-input:focus{outline:none;border-color:var(--primary)}
.btn-send{width:38px;height:38px;border:none;border-radius:8px;background:var(--primary);color:#fff;font-size:1rem;cursor:pointer}
.btn-send:disabled{opacity:.4;cursor:not-allowed}
.ai-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;visibility:hidden;transition:.2s}
.ai-modal.show{opacity:1;visibility:visible}
.ai-modal-box{background:var(--bg-card);border-radius:12px;width:92%;max-width:480px;max-height:85vh;overflow-y:auto}
.modal-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border)}
.modal-head h3{margin:0;font-size:1.1rem}
.btn-x{background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-secondary)}
.modal-body{padding:18px}
.settings-section{margin-bottom:20px}
.settings-section h4{margin:0 0 10px;font-size:.9rem}
.mode-list{display:flex;flex-direction:column;gap:6px}
.mode-item{display:flex;flex-direction:column;padding:10px;border:2px solid var(--border);border-radius:8px;cursor:pointer}
.mode-item.sel{border-color:var(--primary);background:rgba(139,92,246,.08)}
.mode-item input{display:none}
.mname{font-weight:600;font-size:.85rem}
.mdesc{font-size:.72rem;color:var(--text-muted)}
.prov-box{background:var(--bg-hover);padding:14px;border-radius:8px}
.prov-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.prov-head h4{margin:0;font-size:.9rem}
.pstatus{font-size:.7rem;padding:2px 6px;border-radius:8px}
.pstatus.ok{background:rgba(16,185,129,.15);color:#10b981}
.pstatus.err{background:rgba(239,68,68,.15);color:#ef4444}
.key-row{display:flex;gap:5px;margin-bottom:8px}
.key-input{flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:.85rem}
.model-select{width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text-primary);font-size:.85rem}
.btn-sm{padding:5px 8px;border:1px solid var(--border);border-radius:5px;background:var(--bg-card);cursor:pointer;font-size:.75rem}
.btn-sm:disabled{opacity:.4;cursor:not-allowed}
.perror{color:#ef4444;font-size:.72rem;margin:6px 0 0}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.sbox{text-align:center;padding:10px;background:var(--bg-card);border-radius:6px}
.sval{display:block;font-size:1.2rem;font-weight:700;color:var(--primary)}
.slbl{font-size:.65rem;color:var(--text-muted)}
@media(max-width:600px){.quick-btns{grid-template-columns:repeat(2,1fr)}.stats-grid{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(s);
}

// Init
loadAiSettings();
