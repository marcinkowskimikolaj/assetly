/**
 * Assetly - Budget AI Router
 * Router zapytań z LLM7 + walidacja + fallback
 */

const BudgetAIRouter = {
    
    // ═══════════════════════════════════════════════════════════
    // SCHEMA ODPOWIEDZI ROUTERA
    // ═══════════════════════════════════════════════════════════
    
    ROUTER_SCHEMA: {
        intent_summary: 'string', // Streszczenie intencji po polsku
        route: ['compute_sum', 'compute_top', 'compute_trend', 'compute_compare', 
                'compute_503020', 'compute_anomalies', 'compute_summary', 
                'clarify', 'general'],
        operations: 'array', // Lista operacji do wykonania
        canonical_category: 'string|null',
        canonical_subcategory: 'string|null',
        period_from: 'string|null',
        period_to: 'string|null'
    },
    
    // ═══════════════════════════════════════════════════════════
    // GŁÓWNA METODA ROUTINGU
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Klasyfikuje zapytanie użytkownika i zwraca routing
     */
    async classifyIntent(userQuery, cache = null) {
        // Pobierz cache jeśli nie podano
        if (!cache) {
            cache = await BudgetAICache.getCache();
        }
        
        // 1. Próba z LLM7
        const llm7Result = await this._classifyWithLLM7(userQuery, cache);
        
        if (llm7Result.success) {
            console.log('BudgetAIRouter: LLM7 routing:', llm7Result.routing);
            return llm7Result.routing;
        }
        
        console.log('BudgetAIRouter: LLM7 failed, using fallback:', llm7Result.error);
        
        // 2. Fallback: deterministyczny routing
        return this._fallbackRouting(userQuery, cache);
    },
    
    async _classifyWithLLM7(userQuery, cache) {
        // Buduj prompt dla LLM7
        const systemPrompt = this._buildRouterSystemPrompt(cache);
        
        const result = await AIProviders.callRouter(systemPrompt, userQuery);
        
        if (!result.success) {
            return { success: false, error: result.error };
        }
        
        // Parsuj i waliduj odpowiedź
        try {
            const parsed = JSON.parse(result.content);
            const validated = this._validateRouterResponse(parsed, cache);
            
            if (!validated.valid) {
                return { success: false, error: validated.error };
            }
            
            return { success: true, routing: validated.routing };
            
        } catch (error) {
            return { success: false, error: `Błąd parsowania JSON: ${error.message}` };
        }
    },
    
    _buildRouterSystemPrompt(cache) {
        const functions = BudgetAICompute.getFunctionList();
        const categories = cache.categoryList || BudgetCategories.getAllCategories();
        const subcategories = cache.subcategoryList || {};
        const periods = cache.availablePeriods || [];
        
        return `Jesteś routerem zapytań budżetowych. Analizujesz pytanie użytkownika i zwracasz JSON z instrukcjami.

DOSTĘPNE FUNKCJE OBLICZENIOWE:
${JSON.stringify(functions, null, 2)}

DOSTĘPNE KATEGORIE:
${JSON.stringify(categories)}

DOSTĘPNE PODKATEGORIE:
${JSON.stringify(subcategories)}

DOSTĘPNE OKRESY (od najnowszego):
${periods.slice(0, 12).map(p => p.label).join(', ')}

WAŻNE ZASADY:
1. Odpowiadaj TYLKO poprawnym JSON bez dodatkowego tekstu
2. Mapuj polskie synonimy na oficjalne nazwy kategorii:
   - "paliwo", "benzyna", "tankowanie" → kategoria "Auto i transport", podkategoria "Paliwo"
   - "jedzenie poza domem", "restauracje" → kategoria "Codzienne wydatki", podkategoria "Jedzenie poza domem"
   - "czynsz", "najem" → kategoria "Płatności", podkategoria "Czynsz i wynajem"
3. Jeśli użytkownik nie podał okresu, użyj null (całość historii)
4. Jeśli pytanie jest niejasne, ustaw route: "clarify"
5. Dla ogólnych pytań o finanse ustaw route: "general"

FORMAT ODPOWIEDZI:
{
  "intent_summary": "Krótki opis intencji po polsku",
  "route": "compute_sum|compute_top|compute_trend|compute_compare|compute_503020|compute_anomalies|compute_summary|clarify|general",
  "operations": [
    {
      "function": "nazwa_funkcji",
      "params": {
        "category": "nazwa kategorii lub null",
        "subcategory": "nazwa podkategorii lub null",
        "periodFrom": "YYYY-MM lub null",
        "periodTo": "YYYY-MM lub null",
        "n": "liczba (dla top)"
      }
    }
  ],
  "canonical_category": "oficjalna nazwa kategorii lub null",
  "canonical_subcategory": "oficjalna nazwa podkategorii lub null",
  "period_from": "YYYY-MM lub null",
  "period_to": "YYYY-MM lub null"
}`;
    },
    
    _validateRouterResponse(response, cache) {
        // Sprawdź wymagane pola
        if (!response.intent_summary || typeof response.intent_summary !== 'string') {
            return { valid: false, error: 'Brak intent_summary' };
        }
        
        if (!response.route || !this.ROUTER_SCHEMA.route.includes(response.route)) {
            return { valid: false, error: `Nieprawidłowy route: ${response.route}` };
        }
        
        // Waliduj kategorie
        if (response.canonical_category) {
            const validCategories = cache.categoryList || BudgetCategories.getAllCategories();
            if (!validCategories.includes(response.canonical_category)) {
                console.warn('BudgetAIRouter: Nieznana kategoria:', response.canonical_category);
                response.canonical_category = null;
            }
        }
        
        if (response.canonical_subcategory && response.canonical_category) {
            const validSubs = cache.subcategoryList?.[response.canonical_category] || 
                             BudgetCategories.getSubcategories(response.canonical_category);
            if (!validSubs.includes(response.canonical_subcategory)) {
                console.warn('BudgetAIRouter: Nieznana podkategoria:', response.canonical_subcategory);
                response.canonical_subcategory = null;
            }
        }
        
        // Waliduj operacje
        if (response.operations && Array.isArray(response.operations)) {
            const validFunctions = Object.keys(BudgetAICompute.AVAILABLE_FUNCTIONS);
            
            response.operations = response.operations.filter(op => {
                if (!op.function || !validFunctions.includes(op.function)) {
                    console.warn('BudgetAIRouter: Nieznana funkcja:', op.function);
                    return false;
                }
                return true;
            });
        } else {
            response.operations = [];
        }
        
        return { valid: true, routing: response };
    },
    
    // ═══════════════════════════════════════════════════════════
    // FALLBACK ROUTING (DETERMINISTYCZNY)
    // ═══════════════════════════════════════════════════════════
    
    _fallbackRouting(userQuery, cache) {
        const query = userQuery.toLowerCase();
        
        // Wykryj kategorię/podkategorię
        const categoryMatch = BudgetAICompute.normalizeCategory(userQuery);
        let category = null;
        let subcategory = null;
        
        if (categoryMatch) {
            if (typeof categoryMatch === 'object') {
                category = categoryMatch.category;
                subcategory = categoryMatch.subcategory;
            } else {
                category = categoryMatch;
            }
        }
        
        // Wykryj okres
        const periodMatch = BudgetAICompute.parsePeriod(userQuery);
        const periodFrom = periodMatch?.from || null;
        const periodTo = periodMatch?.to || null;
        
        // Wykryj intencję na podstawie słów kluczowych
        let route = 'general';
        let operations = [];
        let intentSummary = 'Ogólne pytanie o finanse';
        
        // Suma / wydatki na X
        if (query.match(/suma|ile|wydatki na|wydałem|wydałam|koszt|koszty/)) {
            route = 'compute_sum';
            intentSummary = `Suma wydatków${category ? ` dla "${category}"` : ''}`;
            
            operations.push({
                function: 'sumByCategory',
                params: { category, subcategory, periodFrom, periodTo }
            });
        }
        
        // Top / ranking
        else if (query.match(/top|ranking|najwięcej|największe|główne/)) {
            route = 'compute_top';
            intentSummary = 'Top wydatki';
            
            const nMatch = query.match(/top\s*(\d+)/);
            const n = nMatch ? parseInt(nMatch[1]) : 10;
            
            operations.push({
                function: 'topExpenses',
                params: { n, level: subcategory ? 'subcategory' : 'category', periodFrom, periodTo }
            });
        }
        
        // Trend / zmiana
        else if (query.match(/trend|zmiana|rośnie|maleje|wzrost|spadek|jak się zmien/)) {
            route = 'compute_trend';
            intentSummary = 'Analiza trendu';
            
            let metric = 'expenses';
            if (query.includes('dochod') || query.includes('zarab')) metric = 'income';
            if (query.includes('bilans') || query.includes('oszczęd')) metric = 'balance';
            
            operations.push({
                function: 'trendAnalysis',
                params: { metric }
            });
        }
        
        // Porównanie
        else if (query.match(/porównaj|porównanie|vs|versus|różnica między/)) {
            route = 'compute_compare';
            intentSummary = 'Porównanie okresów';
            
            // Proste porównanie ostatnich 2 miesięcy
            const periods = cache.availablePeriods || [];
            if (periods.length >= 2) {
                const p1 = `${periods[1].rok}-${String(periods[1].miesiac).padStart(2, '0')}`;
                const p2 = `${periods[0].rok}-${String(periods[0].miesiac).padStart(2, '0')}`;
                
                operations.push({
                    function: 'compareMonths',
                    params: { period1: p1, period2: p2 }
                });
            }
        }
        
        // 50/30/20
        else if (query.match(/50.?30.?20|potrzeby|zachcianki|metodyka|proporcje/)) {
            route = 'compute_503020';
            intentSummary = 'Analiza 50/30/20';
            
            operations.push({
                function: 'analyze503020',
                params: { period: null }
            });
        }
        
        // Anomalie
        else if (query.match(/anomali|nietypow|odstępst|przekrocz|za dużo/)) {
            route = 'compute_anomalies';
            intentSummary = 'Wykrywanie anomalii';
            
            operations.push({
                function: 'getAnomalies',
                params: { threshold: 15 }
            });
        }
        
        // Podsumowanie
        else if (query.match(/podsumowanie|podsumuj|ogólnie|przegląd|status|jak stoję/)) {
            route = 'compute_summary';
            intentSummary = 'Podsumowanie finansów';
            
            operations.push({
                function: 'getSummary',
                params: { period: null }
            });
        }
        
        // Bilans / oszczędności
        else if (query.match(/bilans|oszczędn|zaoszczędz|nadwyżka|saldo/)) {
            route = 'compute_sum';
            intentSummary = 'Bilans i oszczędności';
            
            operations.push({
                function: 'totalBalance',
                params: { periodFrom, periodTo }
            });
        }
        
        // Dochody
        else if (query.match(/dochod|zarobk|pensj|wynagrodzeni|przych/)) {
            route = 'compute_sum';
            intentSummary = 'Analiza dochodów';
            
            operations.push({
                function: 'incomeBySource',
                params: { source: null, periodFrom, periodTo }
            });
        }
        
        // Średnia
        else if (query.match(/średni|średnio|przeciętn/)) {
            route = 'compute_sum';
            intentSummary = `Średnie wydatki${category ? ` dla "${category}"` : ''}`;
            
            operations.push({
                function: 'averageExpense',
                params: { category, subcategory }
            });
        }
        
        // Jeśli znaleziono kategorię ale nie intencję
        else if (category) {
            route = 'compute_sum';
            intentSummary = `Analiza wydatków dla "${category}"`;
            
            operations.push({
                function: 'sumByCategory',
                params: { category, subcategory, periodFrom, periodTo }
            });
            
            operations.push({
                function: 'monthlyBreakdown',
                params: { category, subcategory }
            });
        }
        
        return {
            intent_summary: intentSummary,
            route,
            operations,
            canonical_category: category,
            canonical_subcategory: subcategory,
            period_from: periodFrom,
            period_to: periodTo,
            source: 'fallback'
        };
    },
    
    // ═══════════════════════════════════════════════════════════
    // BUDOWANIE KAPSUŁY FAKTÓW
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Buduje minimalną kapsułę faktów na podstawie wyników obliczeń
     */
    buildFactsCapsule(routing, computeResults, cache) {
        const capsule = {
            query_intent: routing.intent_summary,
            route: routing.route,
            timestamp: new Date().toISOString(),
            results: {},
            context: {}
        };
        
        // Dodaj wyniki obliczeń
        computeResults.forEach((result, index) => {
            if (result.success) {
                capsule.results[result.operation] = result.data;
            } else {
                capsule.results[result.operation] = { error: result.error };
            }
        });
        
        // Dodaj minimalny kontekst
        const periods = cache.availablePeriods || [];
        capsule.context = {
            availableMonths: periods.length,
            oldestPeriod: periods.length > 0 ? periods[periods.length - 1].label : null,
            newestPeriod: periods.length > 0 ? periods[0].label : null,
            queriedCategory: routing.canonical_category,
            queriedSubcategory: routing.canonical_subcategory,
            queriedPeriod: {
                from: routing.period_from,
                to: routing.period_to
            }
        };
        
        // Dodaj informacje o trendach jeśli dostępne
        if (cache.trends) {
            capsule.context.overallTrends = {
                expenses: cache.trends.expenses?.direction || 'unknown',
                income: cache.trends.income?.direction || 'unknown',
                balance: cache.trends.balance?.direction || 'unknown'
            };
        }
        
        return capsule;
    },
    
    // ═══════════════════════════════════════════════════════════
    // SYSTEM PROMPT DLA GENERATORA
    // ═══════════════════════════════════════════════════════════
    
    getGeneratorSystemPrompt() {
        return `Jesteś asystentem finansowym. Odpowiadasz na pytania o budżet na podstawie WYŁĄCZNIE dostarczonych danych.

ZASADY:
1. Używaj TYLKO liczb i faktów z przekazanych danych
2. NIE wymyślaj ani NIE zgaduj żadnych wartości
3. Formatuj kwoty w PLN z separatorem tysięcy (np. "12 500 zł")
4. Podawaj procenty z jednym miejscem po przecinku
5. Bądź zwięzły ale merytoryczny
6. Jeśli dane są niekompletne, powiedz o tym
7. Dla trendów opisz kierunek i dynamikę
8. Używaj emoji dla czytelności: 📊 📈 📉 💰 ⚠️ ✅

FORMAT ODPOWIEDZI:
- Zacznij od bezpośredniej odpowiedzi na pytanie
- Podaj kluczowe liczby
- Dodaj krótki kontekst lub wnioski
- Maksymalnie 3-4 akapity

Odpowiadaj po polsku w naturalnym, przyjaznym tonie.`;
    }
};
