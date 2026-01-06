/**
 * Assetly - Budget AI Router
 * Router zapytań z LLM7 + walidacja + fallback
 */

const BudgetAIRouter = {
    
    // Stan ostatniego routingu (do czyszczenia między zapytaniami)
    _lastRouting: null,
    
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
        // Wyczyść poprzedni routing
        this._lastRouting = null;
        
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
        // 1. NAJPIERW: Rozpoznaj synonimy przed wysłaniem do LLM7
        let resolvedSynonyms = null;
        if (typeof BudgetAISynonyms !== 'undefined') {
            resolvedSynonyms = BudgetAISynonyms.resolve(userQuery);
            console.log('BudgetAIRouter: Resolved synonyms:', {
                subcategories: resolvedSynonyms.subcategories.map(s => `${s.originalTerm} → ${s.officialName}`),
                intents: resolvedSynonyms.intents,
                timeContext: resolvedSynonyms.timeContext
            });
        }
        
        // 2. Buduj prompt dla LLM7 z rozpoznanymi synonimami
        const systemPrompt = this._buildRouterSystemPrompt(cache, resolvedSynonyms);
        
        const result = await AIProviders.callRouter(systemPrompt, userQuery);
        
        if (!result.success) {
            return { success: false, error: result.error };
        }
        
        // Parsuj i waliduj odpowiedź
        try {
            // Wyciągnij JSON z markdown code blocks jeśli obecne
            let jsonContent = result.content.trim();
            
            // Metoda 1: Usuń ```json ... ``` lub ``` ... ```
            const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                jsonContent = codeBlockMatch[1].trim();
            }
            
            // Metoda 2: Jeśli nadal zaczyna się od ``` - usuń ręcznie
            if (jsonContent.startsWith('```')) {
                jsonContent = jsonContent.replace(/^```(?:json)?[\r\n]*/, '').replace(/[\r\n]*```$/, '').trim();
            }
            
            // Metoda 3: Znajdź pierwszy { i ostatni }
            if (!jsonContent.startsWith('{')) {
                const firstBrace = jsonContent.indexOf('{');
                const lastBrace = jsonContent.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
                }
            }
            
            console.log('BudgetAIRouter: Parsing JSON:', jsonContent.substring(0, 100) + '...');
            
            const parsed = JSON.parse(jsonContent);
            const validated = this._validateRouterResponse(parsed, cache);
            
            if (!validated.valid) {
                return { success: false, error: validated.error };
            }
            
            return { success: true, routing: validated.routing };
            
        } catch (error) {
            return { success: false, error: `Błąd parsowania JSON: ${error.message}` };
        }
    },
    
    _buildRouterSystemPrompt(cache, resolvedSynonyms = null) {
        const functions = BudgetAICompute.getFunctionList();
        const categories = cache.categoryList || BudgetCategories.getAllCategories();
        const subcategories = cache.subcategoryList || {};
        const periods = cache.availablePeriods || [];
        
        // KLUCZOWE: Sekcja z rozpoznanymi synonimami
        let synonymSection = '';
        if (resolvedSynonyms && (resolvedSynonyms.subcategories.length > 0 || resolvedSynonyms.categories.length > 0)) {
            synonymSection = `
═══════════════════════════════════════════════════════════════════════
ROZPOZNANE SYNONIMY W ZAPYTANIU (UŻYWAJ TYCH NAZW!):
═══════════════════════════════════════════════════════════════════════
`;
            if (resolvedSynonyms.subcategories.length > 0) {
                synonymSection += '\nPODKATEGORIE:\n';
                for (const sub of resolvedSynonyms.subcategories) {
                    synonymSection += `• "${sub.originalTerm}" → oficjalna podkategoria: "${sub.officialName}" (kategoria: "${sub.category}")\n`;
                }
            }
            
            if (resolvedSynonyms.categories.length > 0) {
                synonymSection += '\nKATEGORIE:\n';
                for (const cat of resolvedSynonyms.categories) {
                    synonymSection += `• "${cat.originalTerm}" → oficjalna kategoria: "${cat.officialName}"\n`;
                }
            }
            
            if (resolvedSynonyms.intents.length > 0) {
                synonymSection += `\nROZPOZNANA INTENCJA: ${resolvedSynonyms.intents.join(', ')}\n`;
                const suggestedFunc = BudgetAISynonyms.suggestFunction(resolvedSynonyms.intents);
                synonymSection += `SUGEROWANA FUNKCJA: ${suggestedFunc}\n`;
            }
            
            if (resolvedSynonyms.timeContext) {
                synonymSection += `\nROZPOZNANY OKRES: ${JSON.stringify(resolvedSynonyms.timeContext)}\n`;
            }
            
            synonymSection += `
═══════════════════════════════════════════════════════════════════════
WAŻNE: Użyj DOKŁADNIE powyższych oficjalnych nazw w odpowiedzi JSON!
═══════════════════════════════════════════════════════════════════════

`;
        }
        
        return `Jesteś routerem zapytań budżetowych. Analizujesz pytanie użytkownika i zwracasz JSON z instrukcjami.
${synonymSection}
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
2. Mapuj polskie synonimy na oficjalne nazwy kategorii i podkategorii:
   - "paliwo", "benzyna", "tankowanie" → kategoria "Auto i transport", podkategoria "Paliwo"
   - "jedzenie poza domem", "restauracje" → kategoria "Codzienne wydatki", podkategoria "Jedzenie poza domem"
   - "czynsz", "najem", "mieszkanie" → kategoria "Płatności", podkategoria "Czynsz i wynajem"
   - "prezent", "prezenty" → kategoria "Osobiste", podkategoria "Prezenty i wsparcie"
   - "ubrania", "odzież", "buty" → kategoria "Osobiste", podkategoria "Odzież i obuwie"
   - "zdrowie", "leki", "lekarz" → kategoria "Osobiste", podkategoria "Zdrowie i uroda"
   - "podróże", "wakacje", "wyjazd" → kategoria "Rozrywka", podkategoria "Podróże i wyjazdy"
   - "sport", "siłownia", "hobby" → kategoria "Rozrywka", podkategoria "Sport i hobby"
   - "alkohol", "piwo", "wino" → kategoria "Codzienne wydatki", podkategoria "Alkohol"
   - "prąd", "elektryczność" → kategoria "Płatności", podkategoria "Prąd"
   - "internet", "telefon", "tv" → kategoria "Płatności", podkategoria "TV, internet, telefon"
   - "raty", "kredyt" → kategoria "Płatności", podkategoria "Spłaty rat"
3. Jeśli użytkownik nie podał okresu, użyj null (całość historii)
4. Jeśli pytanie jest niejasne, ustaw route: "clarify"
5. Dla ogólnych pytań o finanse ustaw route: "general"
6. ZAWSZE używaj dokładnych nazw podkategorii z listy DOSTĘPNE PODKATEGORIE

KIEDY UŻYWAĆ KTÓREJ FUNKCJI:
- "w poszczególnych miesiącach", "jak się zmieniało", "miesięcznie", "miesiąc po miesiącu" → monthlyBreakdown
- "ile wydałem", "suma", "łącznie", "całkowity koszt" → sumByCategory lub sumBySubcategory
- "top", "ranking", "najwięcej" → topExpenses
- "porównaj", "vs", "różnica między miesiącami" → compareMonths
- "trend", "rośnie/maleje" → trendAnalysis

WIELE PODKATEGORII W JEDNYM PYTANIU:
Gdy użytkownik wymienia wiele rzeczy (np. "czynsz, prąd oraz internet"), generuj OSOBNĄ operację dla każdej podkategorii:
{
  "operations": [
    { "function": "monthlyBreakdown", "params": { "category": "Płatności", "subcategory": "Czynsz i wynajem" }},
    { "function": "monthlyBreakdown", "params": { "category": "Płatności", "subcategory": "Prąd" }},
    { "function": "monthlyBreakdown", "params": { "category": "Płatności", "subcategory": "TV, internet, telefon" }}
  ]
}

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
                // Może to jest podkategoria? Szukaj we wszystkich kategoriach
                let foundCategory = null;
                let foundSubcategory = null;
                
                for (const cat of validCategories) {
                    const subs = cache.subcategoryList?.[cat] || BudgetCategories.getSubcategories(cat);
                    if (subs.includes(response.canonical_category)) {
                        foundCategory = cat;
                        foundSubcategory = response.canonical_category;
                        break;
                    }
                }
                
                if (foundCategory) {
                    console.log('BudgetAIRouter: Naprawiono kategorię:', response.canonical_category, '→', foundCategory, '/', foundSubcategory);
                    response.canonical_category = foundCategory;
                    response.canonical_subcategory = foundSubcategory;
                } else {
                    console.warn('BudgetAIRouter: Nieznana kategoria:', response.canonical_category);
                    response.canonical_category = null;
                }
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
        
        // Jeśli mamy tylko subcategory bez category, spróbuj znaleźć kategorię
        if (response.canonical_subcategory && !response.canonical_category) {
            const validCategories = cache.categoryList || BudgetCategories.getAllCategories();
            for (const cat of validCategories) {
                const subs = cache.subcategoryList?.[cat] || BudgetCategories.getSubcategories(cat);
                if (subs.includes(response.canonical_subcategory)) {
                    response.canonical_category = cat;
                    console.log('BudgetAIRouter: Znaleziono kategorię dla podkategorii:', response.canonical_subcategory, '→', cat);
                    break;
                }
            }
        }
        
        // Waliduj operacje - napraw też kategorie w operacjach
        if (response.operations && Array.isArray(response.operations)) {
            const validFunctions = Object.keys(BudgetAICompute.AVAILABLE_FUNCTIONS);
            const validCategories = cache.categoryList || BudgetCategories.getAllCategories();
            
            response.operations = response.operations.filter(op => {
                if (!op.function || !validFunctions.includes(op.function)) {
                    console.warn('BudgetAIRouter: Nieznana funkcja:', op.function);
                    return false;
                }
                
                // Napraw kategorie w params
                if (op.params) {
                    // Jeśli category nie jest prawidłowa, sprawdź czy to podkategoria
                    if (op.params.category && !validCategories.includes(op.params.category)) {
                        for (const cat of validCategories) {
                            const subs = cache.subcategoryList?.[cat] || BudgetCategories.getSubcategories(cat);
                            if (subs.includes(op.params.category)) {
                                op.params.subcategory = op.params.category;
                                op.params.category = cat;
                                break;
                            }
                        }
                    }
                    
                    // Użyj canonical jeśli brak w params
                    if (!op.params.category && response.canonical_category) {
                        op.params.category = response.canonical_category;
                    }
                    if (!op.params.subcategory && response.canonical_subcategory) {
                        op.params.subcategory = response.canonical_subcategory;
                    }
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
        
        // NAJPIERW: Użyj BudgetAISynonyms jeśli dostępny
        let resolvedSynonyms = null;
        if (typeof BudgetAISynonyms !== 'undefined') {
            resolvedSynonyms = BudgetAISynonyms.resolve(userQuery);
            console.log('BudgetAIRouter Fallback: Using resolved synonyms:', resolvedSynonyms.subcategories);
        }
        
        // Wykryj WSZYSTKIE kategorie/podkategorie - preferuj resolved synonyms
        let detectedCategories = [];
        
        if (resolvedSynonyms && resolvedSynonyms.subcategories.length > 0) {
            // Użyj rozpoznanych synonimów - są dokładniejsze
            detectedCategories = resolvedSynonyms.subcategories.map(s => ({
                category: s.category,
                subcategory: s.officialName
            }));
        } else {
            // Fallback do starej metody
            detectedCategories = this._detectAllCategories(userQuery);
        }
        
        // Jeśli wykryto wiele kategorii, użyj pierwszej jako głównej
        let category = null;
        let subcategory = null;
        
        if (detectedCategories.length > 0) {
            category = detectedCategories[0].category;
            subcategory = detectedCategories[0].subcategory;
        }
        
        // Wykryj okres - preferuj resolver
        let periodFrom = null;
        let periodTo = null;
        
        if (resolvedSynonyms?.timeContext) {
            // Użyj czasu z resolvera
            const tc = resolvedSynonyms.timeContext;
            const now = new Date();
            
            if (tc.type === 'relative') {
                const targetDate = new Date(now);
                if (tc.unit === 'month') {
                    targetDate.setMonth(targetDate.getMonth() + tc.value);
                } else if (tc.unit === 'year') {
                    targetDate.setFullYear(targetDate.getFullYear() + tc.value);
                }
                periodFrom = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
                periodTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            } else if (tc.type === 'currentYear') {
                periodFrom = `${now.getFullYear()}-01`;
                periodTo = `${now.getFullYear()}-12`;
            } else if (tc.type === 'previousYear') {
                periodFrom = `${now.getFullYear() - 1}-01`;
                periodTo = `${now.getFullYear() - 1}-12`;
            } else if (tc.type === 'specificYear' && tc.year) {
                periodFrom = `${tc.year}-01`;
                periodTo = `${tc.year}-12`;
            }
        } else {
            // Fallback do starej metody
            const periodMatch = BudgetAICompute.parsePeriod(userQuery);
            periodFrom = periodMatch?.from || null;
            periodTo = periodMatch?.to || null;
        }
        
        // Wykryj intencję - preferuj resolver
        let route = 'general';
        let operations = [];
        let intentSummary = 'Ogólne pytanie o finanse';
        
        // Użyj intencji z resolvera jeśli dostępna
        const resolvedIntents = resolvedSynonyms?.intents || [];
        
        // Jeśli wykryto wiele kategorii - generuj operacje dla każdej
        const hasMultipleCategories = detectedCategories.length > 1;
        
        // NOWE: Użyj sugerowanej funkcji z resolvera
        if (resolvedIntents.length > 0 && category) {
            const suggestedFunc = typeof BudgetAISynonyms !== 'undefined' 
                ? BudgetAISynonyms.suggestFunction(resolvedIntents)
                : 'sumBySubcategory';
            
            if (resolvedIntents.includes('monthly')) {
                route = 'compute_trend';
                if (hasMultipleCategories) {
                    intentSummary = `Wydatki miesięczne dla: ${detectedCategories.map(c => c.subcategory || c.category).join(', ')}`;
                    detectedCategories.forEach(cat => {
                        operations.push({
                            function: 'monthlyBreakdown',
                            params: { category: cat.category, subcategory: cat.subcategory }
                        });
                    });
                } else {
                    intentSummary = `Wydatki miesięczne dla "${subcategory || category}"`;
                    operations.push({
                        function: 'monthlyBreakdown',
                        params: { category, subcategory }
                    });
                }
                return this._buildFallbackResult(intentSummary, route, operations, category, subcategory, periodFrom, periodTo);
            }
            
            if (resolvedIntents.includes('trend')) {
                route = 'compute_trend';
                intentSummary = `Trend wydatków`;
                operations.push({ function: 'trendAnalysis', params: { metric: 'expenses' } });
                return this._buildFallbackResult(intentSummary, route, operations, category, subcategory, periodFrom, periodTo);
            }
            
            if (resolvedIntents.includes('top')) {
                route = 'compute_top';
                intentSummary = `Ranking wydatków`;
                operations.push({ function: 'topExpenses', params: { n: 10, level: 'subcategory' } });
                return this._buildFallbackResult(intentSummary, route, operations, category, subcategory, periodFrom, periodTo);
            }
            
            if (resolvedIntents.includes('compare')) {
                route = 'compute_compare';
                intentSummary = `Porównanie miesięcy`;
                // Porównaj ostatnie 2 miesiące
                const periods = cache?.availablePeriods || [];
                if (periods.length >= 2) {
                    const p1 = `${periods[1].rok}-${String(periods[1].miesiac).padStart(2, '0')}`;
                    const p2 = `${periods[0].rok}-${String(periods[0].miesiac).padStart(2, '0')}`;
                    operations.push({ function: 'compareMonths', params: { period1: p1, period2: p2 } });
                }
                return this._buildFallbackResult(intentSummary, route, operations, category, subcategory, periodFrom, periodTo);
            }
            
            // Domyślnie: sum
            route = 'compute_sum';
            if (hasMultipleCategories) {
                intentSummary = `Suma wydatków dla: ${detectedCategories.map(c => c.subcategory || c.category).join(', ')}`;
                detectedCategories.forEach(cat => {
                    operations.push({
                        function: cat.subcategory ? 'sumBySubcategory' : 'sumByCategory',
                        params: { category: cat.category, subcategory: cat.subcategory, periodFrom, periodTo }
                    });
                });
            } else {
                intentSummary = `Suma wydatków dla "${subcategory || category}"`;
                operations.push({
                    function: subcategory ? 'sumBySubcategory' : 'sumByCategory',
                    params: { category, subcategory, periodFrom, periodTo }
                });
            }
            return this._buildFallbackResult(intentSummary, route, operations, category, subcategory, periodFrom, periodTo);
        }
        
        // STARA LOGIKA (fallback gdy resolver nie pomógł)
        
        // Suma / wydatki na X / trend / zmiana w czasie
        if (query.match(/suma|ile|wydatki na|wydałem|wydałam|koszt|koszty|jak się zmien|w poszczególnych|miesiącach|zmieniało/)) {
            
            // Jeśli pytanie o zmiany w czasie - użyj monthlyBreakdown
            if (query.match(/jak się zmien|zmieniało|w poszczególnych|miesiącach|miesięcznie/)) {
                route = 'compute_trend';
                
                if (hasMultipleCategories) {
                    intentSummary = `Wydatki miesięczne dla: ${detectedCategories.map(c => c.subcategory || c.category).join(', ')}`;
                    
                    // Generuj operację dla każdej wykrytej kategorii
                    detectedCategories.forEach(cat => {
                        operations.push({
                            function: 'monthlyBreakdown',
                            params: { 
                                category: cat.category, 
                                subcategory: cat.subcategory, 
                                periodFrom, 
                                periodTo
                            }
                        });
                    });
                } else {
                    const catLabel = subcategory ? `"${subcategory}"` : (category ? `"${category}"` : '');
                    intentSummary = `Wydatki miesięczne${catLabel ? ` dla ${catLabel}` : ''}`;
                    
                    operations.push({
                        function: 'monthlyBreakdown',
                        params: { category, subcategory, periodFrom, periodTo }
                    });
                }
            } else {
                route = 'compute_sum';
                
                if (hasMultipleCategories) {
                    intentSummary = `Suma wydatków dla: ${detectedCategories.map(c => c.subcategory || c.category).join(', ')}`;
                    
                    detectedCategories.forEach(cat => {
                        operations.push({
                            function: 'sumByCategory',
                            params: { 
                                category: cat.category, 
                                subcategory: cat.subcategory, 
                                periodFrom, 
                                periodTo 
                            }
                        });
                    });
                } else {
                    const catLabel = subcategory ? `"${subcategory}"` : (category ? `"${category}"` : '');
                    intentSummary = `Suma wydatków${catLabel ? ` dla ${catLabel}` : ''}`;
                    
                    operations.push({
                        function: 'sumByCategory',
                        params: { category, subcategory, periodFrom, periodTo }
                    });
                }
            }
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
    
    /**
     * Helper do budowania wyniku fallback
     */
    _buildFallbackResult(intentSummary, route, operations, category, subcategory, periodFrom, periodTo) {
        return {
            intent_summary: intentSummary,
            route,
            operations,
            canonical_category: category,
            canonical_subcategory: subcategory,
            period_from: periodFrom,
            period_to: periodTo,
            source: 'fallback_with_synonyms'
        };
    },
    
    /**
     * Wykrywa WSZYSTKIE kategorie/podkategorie wymienione w zapytaniu
     */
    _detectAllCategories(userQuery) {
        const detected = [];
        const query = userQuery.toLowerCase();
        const words = query.split(/[\s,;]+/);
        
        // Sprawdź każde słowo i frazę
        for (const word of words) {
            if (word.length < 3) continue; // Pomijaj krótkie słowa
            
            const match = BudgetAICompute.normalizeCategory(word);
            if (match) {
                const entry = typeof match === 'object' 
                    ? { category: match.category, subcategory: match.subcategory }
                    : { category: match, subcategory: null };
                
                // Sprawdź czy już nie mamy tej kategorii/podkategorii
                const isDuplicate = detected.some(d => 
                    d.category === entry.category && d.subcategory === entry.subcategory
                );
                
                if (!isDuplicate) {
                    detected.push(entry);
                }
            }
        }
        
        // Sprawdź też frazy (2-3 słowa)
        for (let i = 0; i < words.length - 1; i++) {
            const phrase2 = words.slice(i, i + 2).join(' ');
            const phrase3 = i < words.length - 2 ? words.slice(i, i + 3).join(' ') : null;
            
            for (const phrase of [phrase2, phrase3].filter(Boolean)) {
                const match = BudgetAICompute.normalizeCategory(phrase);
                if (match) {
                    const entry = typeof match === 'object' 
                        ? { category: match.category, subcategory: match.subcategory }
                        : { category: match, subcategory: null };
                    
                    const isDuplicate = detected.some(d => 
                        d.category === entry.category && d.subcategory === entry.subcategory
                    );
                    
                    if (!isDuplicate) {
                        detected.push(entry);
                    }
                }
            }
        }
        
        console.log('BudgetAIRouter: Detected categories:', detected);
        return detected;
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
- Dodaj kontekst lub wnioski

Odpowiadaj po polsku w naturalnym, przyjaznym tonie.`;
    }
};
