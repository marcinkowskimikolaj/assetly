/**
 * Assetly - Budget AI Assistant (Dual Provider + Sheet Settings)
 * - Ustawienia (klucze, tryb, modele) przechowywane w arkuszu: Budzet_Ustawienia (A=key, B=value)
 * - Konfiguracja przez systemowe prompt() (brak custom modal)
 * - Dwa providery równolegle: OpenAI + LLM7.io (OpenAI-compatible)
 * - Routing po rozmiarze kontekstu + fallback na błąd
 * - Do AI wysyłane są KOMPAKTOWE agregaty (nie surowe listy transakcji) aby unikać ucinania kontekstu
 */

// ═══════════════════════════════════════════════════════════
// KONFIGURACJA
// ═══════════════════════════════════════════════════════════

const BUDGET_AI_CONFIG = {
  maxTokens: 2000,
  temperature: 0.3, // niższa = bardziej precyzyjne
  requestTimeoutMs: 60000
};

const BUDGET_AI_DEFAULT_SETTINGS = {
  ai_provider_mode: 'auto',            // auto | openai | llm7
  ai_openai_model: 'gpt-4o-mini',
  ai_llm7_model: 'default',            // default | fast | pro (LLM7)
  ai_large_chars_threshold: '50000',   // routing: duże konteksty -> backup
  openai_api_key: '',
  llm7_api_key: ''
};

const BUDGET_AI_PROVIDERS = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    headerName: 'Authorization'
  },
  llm7: {
    id: 'llm7',
    label: 'LLM7.io',
    baseUrl: 'https://api.llm7.io/v1',
    headerName: 'Authorization'
  }
};

const BUDGET_QUICK_PROMPTS = [
  {
    id: 'summary',
    label: 'Podsumowanie',
    icon: '📊',
    prompt: 'Podaj kompletne podsumowanie moich finansów: łączne dochody, wydatki, bilans, stopa oszczędności. Uwzględnij podział na kategorie.'
  },
  {
    id: 'categories',
    label: 'Kategorie',
    icon: '📁',
    prompt: 'Podaj szczegółową analizę KAŻDEJ kategorii wydatków: suma, średnia, min, max, trend. Posortuj od największej do najmniejszej.'
  },
  {
    id: 'trends',
    label: 'Trendy',
    icon: '📈',
    prompt: 'Jakie są największe trendy (wzrost/spadek) w moich wydatkach w ostatnich miesiącach? Podaj TOP 5 rosnących i TOP 5 malejących kategorii.'
  },
  {
    id: 'savings',
    label: 'Oszczędności',
    icon: '💰',
    prompt: 'Ile odkładam miesięcznie? Podaj średnią, min, max i trend bilansu miesięcznego. Zaproponuj 3 konkretne sposoby poprawy.'
  }
];

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

let budgetAISettings = { ...BUDGET_AI_DEFAULT_SETTINGS };
let budgetAISettingsLoaded = false;

let lastPreparedData = null;
let budgetChatHistory = []; // {role, content}

const budgetAIProviderStatus = {
  openai: { lastOk: null, lastError: null, lastLatencyMs: null },
  llm7: { lastOk: null, lastError: null, lastLatencyMs: null }
};

function _nowIso() {
  return new Date().toISOString();
}

function _monthKey(rok, miesiac) {
  const mm = String(miesiac).padStart(2, '0');
  return `${rok}-${mm}`;
}

function _safeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function _approxTokensFromChars(chars) {
  // heurystyka; działa dobrze w praktyce
  return Math.ceil(chars / 3.7);
}

function _maskKey(key) {
  if (!key) return '(brak)';
  const k = String(key);
  if (k.length <= 8) return '••••••••';
  return '••••••••' + k.slice(-4);
}

// ═══════════════════════════════════════════════════════════
// SETTINGS: SHEET <-> APP
// ═══════════════════════════════════════════════════════════

async function loadBudgetAISettings(force = false) {
  if (budgetAISettingsLoaded && !force) return budgetAISettings;

  try {
    if (typeof BudgetSheets !== 'undefined' && BudgetSheets.getSettings) {
      const sheetSettings = await BudgetSheets.getSettings();
      // merge defaults + sheet
      budgetAISettings = { ...BUDGET_AI_DEFAULT_SETTINGS, ...sheetSettings };

      // normalizacja
      const mode = (budgetAISettings.ai_provider_mode || 'auto').toLowerCase();
      budgetAISettings.ai_provider_mode = ['auto', 'openai', 'llm7'].includes(mode) ? mode : 'auto';

      const llm7Model = (budgetAISettings.ai_llm7_model || 'default').toLowerCase();
      budgetAISettings.ai_llm7_model = ['default', 'fast', 'pro'].includes(llm7Model) ? llm7Model : 'default';

      const openaiModel = (budgetAISettings.ai_openai_model || 'gpt-4o-mini').trim();
      budgetAISettings.ai_openai_model = openaiModel || 'gpt-4o-mini';

      const thr = parseInt(budgetAISettings.ai_large_chars_threshold, 10);
      budgetAISettings.ai_large_chars_threshold = String(Number.isFinite(thr) && thr > 0 ? thr : 50000);

      budgetAISettingsLoaded = true;
      refreshBudgetAIConnectionUI();
      return budgetAISettings;
    }
  } catch (e) {
    console.warn('Nie można wczytać ustawień AI z arkusza:', e);
  }

  // fallback: zostaw domyślne
  budgetAISettingsLoaded = true;
  refreshBudgetAIConnectionUI();
  return budgetAISettings;
}

async function saveBudgetAISettingToSheet(key, value) {
  try {
    if (typeof BudgetSheets === 'undefined' || !BudgetSheets.setSetting) {
      throw new Error('BudgetSheets.setSetting niedostępne');
    }
    await BudgetSheets.setSetting(key, value ?? '');
    // update local cache
    budgetAISettings[key] = value ?? '';
    budgetAISettingsLoaded = true;
    refreshBudgetAIConnectionUI();
    return true;
  } catch (e) {
    console.warn('Nie można zapisać ustawienia AI do arkusza:', key, e);
    return false;
  }
}

async function showBudgetAISettingsPopup() {
  await loadBudgetAISettings();

  // 1) Tryb
  const modeInput = prompt(
    `Ustawienia AI – tryb routingu\n\n` +
      `Aktualnie: ${budgetAISettings.ai_provider_mode}\n` +
      `Wpisz: auto / openai / llm7\n\n` +
      `Pusty = bez zmian`,
    budgetAISettings.ai_provider_mode
  );
  if (modeInput !== null && modeInput.trim() !== '') {
    const mode = modeInput.trim().toLowerCase();
    if (['auto', 'openai', 'llm7'].includes(mode)) {
      await saveBudgetAISettingToSheet('ai_provider_mode', mode);
    } else {
      alert('Nieprawidłowy tryb. Dozwolone: auto/openai/llm7');
    }
  }

  // 2) Modele
  const openaiModel = prompt(
    `OpenAI – model (np. gpt-4o-mini)\n\nAktualnie: ${budgetAISettings.ai_openai_model}\nPusty = bez zmian`,
    budgetAISettings.ai_openai_model
  );
  if (openaiModel !== null && openaiModel.trim() !== '') {
    await saveBudgetAISettingToSheet('ai_openai_model', openaiModel.trim());
  }

  const llm7Model = prompt(
    `LLM7.io – model (default / fast / pro)\n\nAktualnie: ${budgetAISettings.ai_llm7_model}\nPusty = bez zmian`,
    budgetAISettings.ai_llm7_model
  );
  if (llm7Model !== null && llm7Model.trim() !== '') {
    const m = llm7Model.trim().toLowerCase();
    if (['default', 'fast', 'pro'].includes(m)) {
      await saveBudgetAISettingToSheet('ai_llm7_model', m);
    } else {
      alert('Nieprawidłowy model LLM7. Dozwolone: default/fast/pro');
    }
  }

  // 3) Próg routingu (chars)
  const thr = prompt(
    `Routing – próg "dużego" kontekstu (liczba znaków)\n` +
      `Powyżej progu AUTO preferuje LLM7.\n\n` +
      `Aktualnie: ${budgetAISettings.ai_large_chars_threshold}\nPusty = bez zmian`,
    budgetAISettings.ai_large_chars_threshold
  );
  if (thr !== null && thr.trim() !== '') {
    const v = parseInt(thr.trim(), 10);
    if (Number.isFinite(v) && v > 0) {
      await saveBudgetAISettingToSheet('ai_large_chars_threshold', String(v));
    } else {
      alert('Próg musi być dodatnią liczbą całkowitą.');
    }
  }

  // 4) Klucze (w arkuszu)
  const openaiKey = prompt(
    `OpenAI – klucz API (zostanie zapisany w ARKUSZU)\n` +
      `Aktualnie: ${_maskKey(budgetAISettings.openai_api_key)}\n\n` +
      `Wklej nowy klucz, wpisz "-" aby usunąć, pusty = bez zmian`,
    ''
  );
  if (openaiKey !== null) {
    const v = openaiKey.trim();
    if (v === '-') {
      await saveBudgetAISettingToSheet('openai_api_key', '');
    } else if (v !== '') {
      await saveBudgetAISettingToSheet('openai_api_key', v);
    }
  }

  const llm7Key = prompt(
    `LLM7.io – token (zostanie zapisany w ARKUSZU)\n` +
      `Aktualnie: ${_maskKey(budgetAISettings.llm7_api_key)}\n\n` +
      `Wklej nowy token, wpisz "-" aby usunąć, pusty = bez zmian`,
    ''
  );
  if (llm7Key !== null) {
    const v = llm7Key.trim();
    if (v === '-') {
      await saveBudgetAISettingToSheet('llm7_api_key', '');
    } else if (v !== '') {
      await saveBudgetAISettingToSheet('llm7_api_key', v);
    }
  }

  // odśwież widok
  refreshBudgetAIConnectionUI();
  if (typeof renderBudgetAITab === 'function') renderBudgetAITab();
}

// ═══════════════════════════════════════════════════════════
// DATA PREP (COMPACT)
// ═══════════════════════════════════════════════════════════

function prepareBudgetDataForAI() {
  // allExpenses / allIncome są globalami z budget.js
  const exp = Array.isArray(allExpenses) ? allExpenses : [];
  const inc = Array.isArray(allIncome) ? allIncome : [];

  if (exp.length === 0 && inc.length === 0) {
    return { error: 'Brak danych budżetowych. Dodaj najpierw wydatki lub dochody.' };
  }

  const periodsSet = new Set();
  exp.forEach(e => periodsSet.add(_monthKey(e.rok, e.miesiac)));
  inc.forEach(i => periodsSet.add(_monthKey(i.rok, i.miesiac)));
  const periods = Array.from(periodsSet).sort();

  const expensesTotals = {
    total: exp.reduce((s, e) => s + _safeNumber(e.kwotaPLN), 0),
    totalNoTransfers: exp.filter(e => !e.jestTransfer).reduce((s, e) => s + _safeNumber(e.kwotaPLN), 0),
    transfers: exp.filter(e => e.jestTransfer).reduce((s, e) => s + _safeNumber(e.kwotaPLN), 0),
    count: exp.length,
    countNoTransfers: exp.filter(e => !e.jestTransfer).length
  };

  const incomeTotals = {
    total: inc.reduce((s, i) => s + _safeNumber(i.kwotaPLN), 0),
    count: inc.length
  };

  // Monthly totals
  const monthly = {};
  periods.forEach(p => (monthly[p] = { income: 0, expenses: 0, expensesNoTransfers: 0, balance: 0, byCategory: {} }));

  inc.forEach(i => {
    const p = _monthKey(i.rok, i.miesiac);
    if (!monthly[p]) monthly[p] = { income: 0, expenses: 0, expensesNoTransfers: 0, balance: 0, byCategory: {} };
    monthly[p].income += _safeNumber(i.kwotaPLN);
  });

  exp.forEach(e => {
    const p = _monthKey(e.rok, e.miesiac);
    if (!monthly[p]) monthly[p] = { income: 0, expenses: 0, expensesNoTransfers: 0, balance: 0, byCategory: {} };
    const amt = _safeNumber(e.kwotaPLN);
    monthly[p].expenses += amt;
    if (!e.jestTransfer) monthly[p].expensesNoTransfers += amt;
    const cat = e.kategoria || '(brak)';
    monthly[p].byCategory[cat] = (monthly[p].byCategory[cat] || 0) + amt;
  });

  periods.forEach(p => {
    monthly[p].balance = monthly[p].income - monthly[p].expenses;
  });

  // Category stats (NoTransfers for more sensible analysis, but keep both)
  const byCategory = {}; // cat -> stats
  exp.forEach(e => {
    const cat = e.kategoria || '(brak)';
    const sub = e.podkategoria || '(brak)';
    const amt = _safeNumber(e.kwotaPLN);
    const p = _monthKey(e.rok, e.miesiac);

    if (!byCategory[cat]) {
      byCategory[cat] = {
        total: 0,
        totalNoTransfers: 0,
        count: 0,
        countNoTransfers: 0,
        min: null,
        max: null,
        monthly: {},
        subcategories: {}
      };
    }

    const c = byCategory[cat];
    c.total += amt;
    c.count += 1;
    c.min = c.min === null ? amt : Math.min(c.min, amt);
    c.max = c.max === null ? amt : Math.max(c.max, amt);
    c.monthly[p] = (c.monthly[p] || 0) + amt;

    if (!e.jestTransfer) {
      c.totalNoTransfers += amt;
      c.countNoTransfers += 1;
    }

    if (!c.subcategories[sub]) {
      c.subcategories[sub] = { total: 0, count: 0 };
    }
    c.subcategories[sub].total += amt;
    c.subcategories[sub].count += 1;
  });

  // add derived metrics: avg/min/max/trend
  const categoryStats = {};
  Object.entries(byCategory).forEach(([cat, c]) => {
    const monthlySeries = periods.map(p => _safeNumber(c.monthly[p] || 0));
    const slope = linearRegressionSlope(monthlySeries);
    const last = monthlySeries.length ? monthlySeries[monthlySeries.length - 1] : 0;
    const prev = monthlySeries.length > 1 ? monthlySeries[monthlySeries.length - 2] : 0;
    const momPct = prev > 0 ? ((last - prev) / prev) : null;

    categoryStats[cat] = {
      total: round2(c.total),
      totalNoTransfers: round2(c.totalNoTransfers),
      count: c.count,
      countNoTransfers: c.countNoTransfers,
      avg: c.count ? round2(c.total / c.count) : 0,
      min: c.min === null ? 0 : round2(c.min),
      max: c.max === null ? 0 : round2(c.max),
      monthly: Object.fromEntries(periods.map(p => [p, round2(_safeNumber(c.monthly[p] || 0))])),
      trend: {
        slopePerMonth: round2(slope), // PLN / miesiąc
        lastVsPrevPct: momPct === null ? null : round4(momPct)
      },
      subcategories: topSubcategoriesCompact(c.subcategories, 20)
    };
  });

  // Income stats by source (if available)
  const incomeBySource = {};
  inc.forEach(i => {
    const src = i.zrodlo || 'Inne';
    const amt = _safeNumber(i.kwotaPLN);
    if (!incomeBySource[src]) incomeBySource[src] = { total: 0, count: 0, min: null, max: null, monthly: {} };
    const s = incomeBySource[src];
    s.total += amt;
    s.count += 1;
    s.min = s.min === null ? amt : Math.min(s.min, amt);
    s.max = s.max === null ? amt : Math.max(s.max, amt);
    const p = _monthKey(i.rok, i.miesiac);
    s.monthly[p] = (s.monthly[p] || 0) + amt;
  });

  const incomeStats = {};
  Object.entries(incomeBySource).forEach(([src, s]) => {
    const monthlySeries = periods.map(p => _safeNumber(s.monthly[p] || 0));
    const slope = linearRegressionSlope(monthlySeries);
    incomeStats[src] = {
      total: round2(s.total),
      count: s.count,
      avg: s.count ? round2(s.total / s.count) : 0,
      min: s.min === null ? 0 : round2(s.min),
      max: s.max === null ? 0 : round2(s.max),
      monthly: Object.fromEntries(periods.map(p => [p, round2(_safeNumber(s.monthly[p] || 0))])),
      trend: { slopePerMonth: round2(slope) }
    };
  });

  const data = {
    meta: {
      generatedAt: _nowIso(),
      periods,
      currency: 'PLN'
    },
    totals: {
      income: round2(incomeTotals.total),
      expenses: round2(expensesTotals.total),
      expensesNoTransfers: round2(expensesTotals.totalNoTransfers),
      balance: round2(incomeTotals.total - expensesTotals.total),
      savingsRate: incomeTotals.total > 0 ? round4((incomeTotals.total - expensesTotals.total) / incomeTotals.total) : null
    },
    expenses: {
      totals: expensesTotals,
      categoryStats,
      note: 'categoryStats zawiera sum/avg/min/max + miesięczną serię + trend. Preferuj totalNoTransfers do analizy konsumpcji.'
    },
    income: {
      totals: incomeTotals,
      sourceStats: incomeStats
    },
    monthly: Object.fromEntries(periods.map(p => [p, {
      income: round2(monthly[p].income),
      expenses: round2(monthly[p].expenses),
      expensesNoTransfers: round2(monthly[p].expensesNoTransfers),
      balance: round2(monthly[p].balance),
      byCategory: topObject(monthly[p].byCategory, 15)
    }]))
  };

  return data;
}

function round2(n) { return Math.round(_safeNumber(n) * 100) / 100; }
function round4(n) { return Math.round(_safeNumber(n) * 10000) / 10000; }

function topObject(obj, limit = 10) {
  const entries = Object.entries(obj || {}).sort((a, b) => _safeNumber(b[1]) - _safeNumber(a[1]));
  return Object.fromEntries(entries.slice(0, limit).map(([k, v]) => [k, round2(v)]));
}

function topSubcategoriesCompact(subObj, limit = 20) {
  const entries = Object.entries(subObj || {}).map(([k, v]) => [k, { total: round2(v.total), count: v.count }]);
  entries.sort((a, b) => _safeNumber(b[1].total) - _safeNumber(a[1].total));
  return Object.fromEntries(entries.slice(0, limit));
}

function linearRegressionSlope(series) {
  // x = 0..n-1
  const n = series.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = _safeNumber(series[i]);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = (n * sumXX - sumX * sumX);
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

// ═══════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════

function getBudgetSystemPrompt() {
  return `Jesteś EKSPERTEM od finansów osobistych i analityki budżetu. Twoja rola to precyzyjna analiza danych użytkownika.

## DANE, KTÓRE MASZ
W kontekście dostajesz OBLICZONE agregaty (kompaktowe, bez surowych list transakcji):
- totals: income, expenses, balance, savingsRate
- expenses.categoryStats[category]: total/avg/min/max + monthly + trend + subcategories
- income.sourceStats[source]: total/avg/min/max + monthly + trend
- monthly[YYYY-MM]: income/expenses/balance + byCategory (top)

## ZASADY
- Odpowiadaj konkretnie, liczbowo, po polsku.
- Jeśli użytkownik prosi o tabelę, zwróć tabelę markdown.
- Trend: używaj expenses.categoryStats[X].trend.slopePerMonth (PLN/mies) oraz lastVsPrevPct (m/m).
- Domyślnie do analizy „konsumpcji” używaj totalNoTransfers (transfers to przesunięcia środków).

## FORMAT
- Najpierw wnioski, potem dane.
- Przy porównaniach miesięcy: pokazuj oba miesiące + różnicę + %.
`;
}

// ═══════════════════════════════════════════════════════════
// AI REQUESTS (Dual provider + routing + fallback)
// ═══════════════════════════════════════════════════════════

async function postChatCompletions(providerId, payload) {
  const provider = BUDGET_AI_PROVIDERS[providerId];
  if (!provider) throw new Error(`Nieznany provider: ${providerId}`);

  const url = `${provider.baseUrl}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };

  // auth
  const key = providerId === 'openai' ? (budgetAISettings.openai_api_key || '') : (budgetAISettings.llm7_api_key || '');
  if (key) {
    headers[provider.headerName] = `Bearer ${key}`;
  } else {
    // dla OpenAI brak klucza = błąd (wymusi fallback)
    if (providerId === 'openai') throw new Error('Brak klucza OpenAI.');
    // dla LLM7 spróbuj bez tokena (jeśli działa w darmowym trybie)
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BUDGET_AI_CONFIG.requestTimeoutMs);

  const started = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const latency = Math.round(performance.now() - started);
    budgetAIProviderStatus[providerId].lastLatencyMs = latency;

    if (!res.ok) {
      let errJson = {};
      try { errJson = await res.json(); } catch (_) {}
      const msg =
        errJson?.error?.message ||
        errJson?.message ||
        `HTTP ${res.status}`;
      const e = new Error(msg);
      e.httpStatus = res.status;
      e.providerId = providerId;
      budgetAIProviderStatus[providerId].lastOk = null;
      budgetAIProviderStatus[providerId].lastError = `${_nowIso()} • ${msg}`;
      refreshBudgetAIConnectionUI();
      throw e;
    }

    const data = await res.json();
    budgetAIProviderStatus[providerId].lastOk = _nowIso();
    budgetAIProviderStatus[providerId].lastError = null;
    refreshBudgetAIConnectionUI();

    const assistant = data?.choices?.[0]?.message?.content ?? '';
    return { assistant, raw: data, providerId, latencyMs: latency };
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Timeout (przekroczony czas odpowiedzi).');
      err.providerId = providerId;
      budgetAIProviderStatus[providerId].lastOk = null;
      budgetAIProviderStatus[providerId].lastError = `${_nowIso()} • Timeout`;
      refreshBudgetAIConnectionUI();
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

function pickPrimaryProvider(totalInputChars) {
  const mode = (budgetAISettings.ai_provider_mode || 'auto').toLowerCase();
  const threshold = parseInt(budgetAISettings.ai_large_chars_threshold, 10) || 50000;

  if (mode === 'openai') return 'openai';
  if (mode === 'llm7') return 'llm7';

  // auto
  if (totalInputChars >= threshold) return 'llm7';
  // jeśli brak klucza openai, a jest llm7 -> llm7
  if (!budgetAISettings.openai_api_key && budgetAISettings.llm7_api_key) return 'llm7';
  return 'openai';
}

function getModelForProvider(providerId) {
  if (providerId === 'openai') return (budgetAISettings.ai_openai_model || 'gpt-4o-mini').trim();
  return (budgetAISettings.ai_llm7_model || 'default').trim();
}

async function callWithRouting(messages, totalInputChars) {
  const primary = pickPrimaryProvider(totalInputChars);
  const secondary = primary === 'openai' ? 'llm7' : 'openai';

  const payloadPrimary = {
    model: getModelForProvider(primary),
    messages,
    temperature: BUDGET_AI_CONFIG.temperature,
    max_tokens: BUDGET_AI_CONFIG.maxTokens
  };

  try {
    const r = await postChatCompletions(primary, payloadPrimary);
    return { ...r, used: primary, fallbackUsed: false, fallbackFrom: null };
  } catch (err) {
    // always fallback on error
    const payloadSecondary = {
      model: getModelForProvider(secondary),
      messages,
      temperature: BUDGET_AI_CONFIG.temperature,
      max_tokens: BUDGET_AI_CONFIG.maxTokens
    };
    try {
      const r2 = await postChatCompletions(secondary, payloadSecondary);
      return { ...r2, used: secondary, fallbackUsed: true, fallbackFrom: primary, primaryError: err.message };
    } catch (err2) {
      // bubble nicer combined error
      const e = new Error(`Błąd AI. Primary (${primary}): ${err.message}. Fallback (${secondary}): ${err2.message}`);
      e.primary = err;
      e.fallback = err2;
      throw e;
    }
  }
}

async function testBudgetAIProvider(providerId) {
  await loadBudgetAISettings();
  const model = getModelForProvider(providerId);

  const payload = {
    model,
    messages: [
      { role: 'system', content: 'Odpowiedz krótko: OK' },
      { role: 'user', content: 'ping' }
    ],
    temperature: 0,
    max_tokens: 16
  };

  try {
    const r = await postChatCompletions(providerId, payload);
    alert(`${BUDGET_AI_PROVIDERS[providerId].label} OK ✅\nModel: ${model}\nLatency: ${r.latencyMs} ms`);
  } catch (e) {
    alert(`${BUDGET_AI_PROVIDERS[providerId].label} ERROR ❌\nModel: ${model}\n${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN CHAT
// ═══════════════════════════════════════════════════════════

async function sendBudgetMessage(customMessage = null) {
  const input = document.getElementById('budgetChatInput');
  const message = customMessage || (input ? input.value.trim() : '');

  if (!message) return;
  if (input) input.value = '';

  await loadBudgetAISettings();

  // Dodaj wiadomość użytkownika
  addBudgetChatMessage('user', message);

  // Przygotuj dane
  const budgetData = prepareBudgetDataForAI();
  if (budgetData?.error) {
    addBudgetChatMessage('assistant', `⚠️ ${budgetData.error}`);
    return;
  }

  lastPreparedData = budgetData;

  // Minimalizuj JSON (bez wcięć)
  const dataContext = JSON.stringify(budgetData);

  const messages = [
    { role: 'system', content: getBudgetSystemPrompt() },
    { role: 'system', content: `## DANE FINANSOWE UŻYTKOWNIKA (JSON)\n\`\`\`json\n${dataContext}\n\`\`\`` },
    ...budgetChatHistory.slice(-10),
    { role: 'user', content: message }
  ];

  const totalChars = messages.reduce((s, m) => s + (m.content?.length || 0), 0);
  const approxTok = _approxTokensFromChars(totalChars);

  // Loading
  const loadingId = addBudgetChatMessage('assistant', '⏳ Analizuję dane...', true);

  try {
    const result = await callWithRouting(messages, totalChars);

    removeBudgetChatMessage(loadingId);

    const metaLine =
      `\n\n---\n` +
      `Źródło: **${BUDGET_AI_PROVIDERS[result.used].label}** • model: \`${getModelForProvider(result.used)}\` • ~${approxTok} tok • ${result.latencyMs ?? ''} ms` +
      (result.fallbackUsed ? ` • fallback z ${BUDGET_AI_PROVIDERS[result.fallbackFrom].label} (${result.primaryError})` : '');

    const assistantMessage = (result.assistant || '(brak odpowiedzi)') + metaLine;

    addBudgetChatMessage('assistant', assistantMessage);

    budgetChatHistory.push({ role: 'user', content: message });
    budgetChatHistory.push({ role: 'assistant', content: result.assistant || '' });
  } catch (error) {
    console.error('Błąd AI:', error);
    removeBudgetChatMessage(loadingId);
    addBudgetChatMessage('assistant', `❌ ${error.message}`);
  }
}

function runBudgetQuickPrompt(promptId) {
  const prompt = BUDGET_QUICK_PROMPTS.find(p => p.id === promptId);
  if (prompt) sendBudgetMessage(prompt.prompt);
}

// ═══════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════

function renderBudgetAITab() {
  const container = document.getElementById('budget-ai');
  if (!container) return;

  const expCount = Array.isArray(allExpenses) ? allExpenses.length : 0;
  const incCount = Array.isArray(allIncome) ? allIncome.length : 0;

  // ensure settings loaded asynchronously
  loadBudgetAISettings().catch(() => {});

  const mode = budgetAISettings.ai_provider_mode || 'auto';
  const openaiKeyOk = !!(budgetAISettings.openai_api_key || '');
  const llm7KeyOk = !!(budgetAISettings.llm7_api_key || '');

  container.innerHTML = `
    <div class="ai-container">
      <!-- Info o danych -->
      <div class="ai-data-info">
        <span class="data-badge">📊 ${expCount} wydatków</span>
        <span class="data-badge">💵 ${incCount} dochodów</span>
        <span class="data-badge">📅 ${getMonthCount()} miesięcy</span>
      </div>

      <!-- Connection card -->
      <div class="card ai-connection-card">
        <div class="card-header">
          <h3 class="card-title">🔌 Połączenie AI</h3>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="btn btn-secondary btn-sm" onclick="testBudgetAIProvider('openai')" title="Test OpenAI">Test OpenAI</button>
            <button class="btn btn-secondary btn-sm" onclick="testBudgetAIProvider('llm7')" title="Test LLM7">Test LLM7</button>
            <button class="btn btn-ghost btn-sm" onclick="showBudgetAISettingsPopup()" title="Ustawienia AI (arkusz)">
              ⚙️
            </button>
          </div>
        </div>
        <div class="card-body">
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <span class="data-badge" id="aiModeBadge">🔀 tryb: <strong>${escapeHtml(mode)}</strong></span>
            <span class="data-badge" id="aiThresholdBadge">📏 próg: <strong>${escapeHtml(budgetAISettings.ai_large_chars_threshold)}</strong> znaków</span>
            <span class="data-badge" id="aiOpenAIBadge">🧠 OpenAI: <strong>${escapeHtml(budgetAISettings.ai_openai_model)}</strong> • klucz: ${openaiKeyOk ? '✅' : '❌'}</span>
            <span class="data-badge" id="aiLLM7Badge">⚡ LLM7: <strong>${escapeHtml(budgetAISettings.ai_llm7_model)}</strong> • token: ${llm7KeyOk ? '✅' : '❌'}</span>
          </div>
          <div style="margin-top:8px; font-size:12px; opacity:.85;">
            <div id="aiStatusOpenAI"></div>
            <div id="aiStatusLLM7"></div>
          </div>
        </div>
      </div>

      <!-- Assistant card -->
      <div class="card ai-assistant-card">
        <div class="card-header">
          <h3 class="card-title">🤖 Asystent budżetowy AI</h3>
        </div>

        <div class="quick-prompts">
          ${BUDGET_QUICK_PROMPTS.map(p => `
            <button class="quick-prompt-btn" onclick="runBudgetQuickPrompt('${p.id}')" title="${escapeHtml(p.prompt)}">
              <span class="quick-prompt-icon">${escapeHtml(p.icon)}</span>
              <span class="quick-prompt-label">${escapeHtml(p.label)}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Chat -->
      <div class="card chat-card">
        <div id="budgetChatMessages" class="chat-messages">
          <div class="chat-welcome">
            <h4>👋 Witaj w Asystencie Budżetowym!</h4>
            <p>Mam dostęp do <strong>agregatów</strong> Twoich danych (sumy, trendy, serie miesięczne) i mogę odpowiedzieć na pytania:</p>
            <ul>
              <li>💸 "Ile wydałem na paliwo od początku roku?"</li>
              <li>📊 "Pokaż wydatki na rozrywkę w każdym miesiącu"</li>
              <li>📈 "Jak zmieniało się moje wynagrodzenie?"</li>
              <li>🔍 "Które podkategorie kosztują mnie najwięcej?"</li>
              <li>⚖️ "Porównaj wydatki grudzień vs listopad"</li>
            </ul>
            <p>Wybierz szybką analizę powyżej lub zadaj własne pytanie.</p>
          </div>
        </div>

        <div class="chat-input-container">
          <input type="text" id="budgetChatInput" class="chat-input"
            placeholder="Zadaj pytanie o swój budżet..."
            onkeypress="if(event.key==='Enter') sendBudgetMessage()">
          <button class="btn btn-primary" onclick="sendBudgetMessage()">Wyślij</button>
        </div>
      </div>
    </div>
  `;

  refreshBudgetAIConnectionUI();
}

function refreshBudgetAIConnectionUI() {
  // update badges if present
  try {
    const modeEl = document.getElementById('aiModeBadge');
    if (modeEl) modeEl.innerHTML = `🔀 tryb: <strong>${escapeHtml(budgetAISettings.ai_provider_mode || 'auto')}</strong>`;

    const thrEl = document.getElementById('aiThresholdBadge');
    if (thrEl) thrEl.innerHTML = `📏 próg: <strong>${escapeHtml(budgetAISettings.ai_large_chars_threshold || '50000')}</strong> znaków`;

    const openEl = document.getElementById('aiOpenAIBadge');
    if (openEl) {
      const ok = !!(budgetAISettings.openai_api_key || '');
      openEl.innerHTML = `🧠 OpenAI: <strong>${escapeHtml(budgetAISettings.ai_openai_model || 'gpt-4o-mini')}</strong> • klucz: ${ok ? '✅' : '❌'}`;
    }

    const llmEl = document.getElementById('aiLLM7Badge');
    if (llmEl) {
      const ok = !!(budgetAISettings.llm7_api_key || '');
      llmEl.innerHTML = `⚡ LLM7: <strong>${escapeHtml(budgetAISettings.ai_llm7_model || 'default')}</strong> • token: ${ok ? '✅' : '❌'}`;
    }

    const sO = document.getElementById('aiStatusOpenAI');
    if (sO) {
      const st = budgetAIProviderStatus.openai;
      sO.innerHTML = `OpenAI status: ${st.lastOk ? '✅ ' + escapeHtml(st.lastOk) : (st.lastError ? '❌ ' + escapeHtml(st.lastError) : '—')}` +
        (st.lastLatencyMs ? ` • ${st.lastLatencyMs} ms` : '');
    }

    const sL = document.getElementById('aiStatusLLM7');
    if (sL) {
      const st = budgetAIProviderStatus.llm7;
      sL.innerHTML = `LLM7 status: ${st.lastOk ? '✅ ' + escapeHtml(st.lastOk) : (st.lastError ? '❌ ' + escapeHtml(st.lastError) : '—')}` +
        (st.lastLatencyMs ? ` • ${st.lastLatencyMs} ms` : '');
    }
  } catch (_) {}
}

function getMonthCount() {
  const periods = new Set();
  (Array.isArray(allExpenses) ? allExpenses : []).forEach(e => periods.add(_monthKey(e.rok, e.miesiac)));
  (Array.isArray(allIncome) ? allIncome : []).forEach(i => periods.add(_monthKey(i.rok, i.miesiac)));
  return periods.size;
}

// ═══════════════════════════════════════════════════════════
// CHAT HELPERS + MARKDOWN
// ═══════════════════════════════════════════════════════════

let budgetMessageCounter = 0;

function addBudgetChatMessage(role, content, isLoading = false) {
  const container = document.getElementById('budgetChatMessages');
  if (!container) return null;

  budgetMessageCounter++;
  const id = `msg-${budgetMessageCounter}`;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${role} ${isLoading ? 'loading' : ''}`;
  msgDiv.id = id;

  const formattedContent = isLoading ? escapeHtml(content) : formatMarkdownToHtml(content);

  msgDiv.innerHTML = `
    <div class="chat-avatar">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="chat-content">${formattedContent}</div>
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;

  return id;
}

function removeBudgetChatMessage(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMarkdownToHtml(text) {
  if (!text) return '';

  let t = String(text);

  // code blocks
  t = t.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  });

  // inline code
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');

  // bold/italic
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // headings
  t = t.replace(/^### (.*)$/gm, '<h5>$1</h5>');
  t = t.replace(/^## (.*)$/gm, '<h4>$1</h4>');
  t = t.replace(/^# (.*)$/gm, '<h3>$1</h3>');

  // lists
  t = t.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
  t = t.replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`);

  // tables (simple)
  if (t.includes('|') && t.includes('---')) {
    t = t.replace(/^\|(.+)\|\n\|([\-\:\|\s]+)\|\n((?:\|.*\|\n?)*)/gm, (m, header, sep, rows) => {
      const headers = header.split('|').map(h => h.trim());
      const thead = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
      const bodyRows = rows.trim().split('\n').filter(Boolean).map(r => {
        const cells = r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        return `<tr>${cells.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`;
      }).join('');
      return `<table><thead><tr>${thead}</tr></thead><tbody>${bodyRows}</tbody></table>`;
    });
  }

  // hr
  t = t.replace(/^---$/gm, '<hr>');

  // newlines
  t = t.replace(/\n/g, '<br>');
  t = t.replace(/<\/(table|ul|ol|pre|h[1-5]|hr)><br>/g, '</$1>');
  t = t.replace(/<br><(table|ul|ol|pre|h[1-5]|hr)/g, '<$1');

  return t;
}

// ═══════════════════════════════════════════════════════════
// BACKWARD COMPAT: keep old name used by older UI
// ═══════════════════════════════════════════════════════════
function showBudgetApiKeyModal() {
  // old handler -> new popup
  showBudgetAISettingsPopup();
}

// On first load, try to preload settings (silent)
loadBudgetAISettings().catch(() => {});
