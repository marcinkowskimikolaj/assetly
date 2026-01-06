/**
 * Assetly - Budget AI Router (v3)
 * Router zapytań z LLM7 + twardy kontrakt JSON + walidacja spójności + naprawa planu
 * 
 * ZMIANY v3:
 * - Dodano pole question_shape do schematu (RANKING/MAX_IN_TIME/MIN_IN_TIME/SUM/TREND/COMPARISON/ANALYSIS/GENERAL)
 * - Rozbudowano prompt LLM7 o precyzyjne zasady dla pytań o miesiąc
 * - Dodano walidację spójności planu z pytaniem
 * - Dodano mechanizm naprawy planu przez LLM7 (max 1 raz)
 * - Rozbudowano kapsułę faktów o deterministyczne pochodne (max/min/sum/avg)
 */

const BudgetAIRouter = {
    
    // Stan ostatniego routingu
    _lastRouting: null,
    
    // Flaga czy naprawa planu już była wykonana (zapobiega zapętleniu)
    _planRepairAttempted: false,
    
    // ═══════════════════════════════════════════════════════════
    // ZAMKNIĘTA LISTA KATEGORII I PODKATEGORII (TAKSONOMIA)
    // ═══════════════════════════════════════════════════════════
    
    VALID_CATEGORIES: [
        'Auto i transport',
        'Codzienne wydatki',
        'Dom',
        'Dzieci',
        'Firmowe',
        'Nieistotne',
        'Nieskategoryzowane',
        'Osobiste',
        'Oszczędności i inw.',
        'Płatności',
        'Rozrywka'
    ],
    
    VALID_SUBCATEGORIES: {
        'Auto i transport': ['Auto i transport - inne', 'Paliwo', 'Parking i opłaty', 'Przejazdy', 'Serwis i części', 'Ubezpieczenie auta'],
        'Codzienne wydatki': ['Alkohol', 'Codzienne wydatki - inne', 'Jedzenie poza domem', 'Papierosy', 'Zwierzęta', 'Żywność i chemia domowa'],
        'Dom': ['Akcesoria i wyposażenie', 'Dom - inne', 'Remont i ogród', 'Ubezpieczenie domu', 'Usługi domowe'],
        'Dzieci': ['Art. dziecięce i zabawki', 'Dzieci - inne', 'Przedszkole i opiekunka', 'Szkoła i wyprawka', 'Zajęcia dodatkowe'],
        'Firmowe': ['Firmowe - inne', 'Przelew na rach. firmowy', 'Zakupy firmowe'],
        'Nieistotne': [],
        'Nieskategoryzowane': [],
        'Osobiste': ['Edukacja', 'Elektronika', 'Multimedia, książki i prasa', 'Odzież i obuwie', 'Osobiste - inne', 'Prezenty i wsparcie', 'Zdrowie i uroda'],
        'Oszczędności i inw.': ['Fundusze', 'Giełda', 'Lokaty i konto oszcz.', 'Oszczędności i inw. - inne', 'Regularne oszczędzanie'],
        'Płatności': ['Czynsz i wynajem', 'Gaz', 'Ogrzewanie', 'Opłaty i odsetki', 'Płatności - inne', 'Podatki', 'Prąd', 'Spłaty rat', 'TV, internet, telefon', 'Ubezpieczenia', 'Woda i kanalizacja'],
        'Rozrywka': ['Podróże i wyjazdy', 'Rozrywka - inne', 'Sport i hobby', 'Wyjścia i wydarzenia']
    },
    
    // ═══════════════════════════════════════════════════════════
    // ROZSZERZONY SCHEMA ODPOWIEDZI ROUTERA
    // ═══════════════════════════════════════════════════════════
    
    ROUTER_SCHEMA: {
        intent_summary: 'string',           // Streszczenie intencji po polsku
        question_shape: [                   // NOWE: Kształt pytania
            'RANKING',         // "Top X", "Które największe"
            'MAX_IN_TIME',     // "W którym miesiącu najwięcej"
            'MIN_IN_TIME',     // "W którym miesiącu najmniej"
            'SUM',             // "Ile wydałem", "Suma"
            'TREND',           // "Jak się zmieniało", "Trend"
            'COMPARISON',      // "Porównaj X z Y"
            'ANALYSIS',        // "Analiza 50/30/20", "Podsumowanie"
            'BREAKDOWN',       // "Rozbicie miesięczne"
            'GENERAL'          // Ogólne pytanie
        ],
        route: ['compute_sum', 'compute_top', 'compute_trend', 'compute_compare', 
                'compute_503020', 'compute_anomalies', 'compute_summary', 
                'clarify', 'general'],
        operations: 'array',
        canonical_category: 'string|null',
        canonical_subcategory: 'string|null',
        period_from: 'string|null',
        period_to: 'string|null',
        confidence: 'number'               // NOWE: Pewność 0-1
    },
    
    // ═══════════════════════════════════════════════════════════
    // WZORCE WYKRYWANIA KSZTAŁTU PYTANIA
    // ═══════════════════════════════════════════════════════════
    
    QUESTION_SHAPE_PATTERNS: {
        MAX_IN_TIME: [
            /w\s+którym\s+miesiącu.*najwięcej/i,
            /który\s+miesiąc.*najwięcej/i,
            /kiedy\s+wydałem.*najwięcej/i,
            /kiedy\s+najwięcej/i,
            /w\s+jakim\s+miesiącu.*maksym/i,
            /miesięczny\s+rekord/i,
            /szczyt\s+wydatków/i
        ],
        MIN_IN_TIME: [
            /w\s+którym\s+miesiącu.*najmniej/i,
            /który\s+miesiąc.*najmniej/i,
            /kiedy\s+wydałem.*najmniej/i,
            /kiedy\s+najmniej/i,
            /w\s+jakim\s+miesiącu.*minim/i,
            /najniższe\s+wydatki/i
        ],
        RANKING: [
            /top\s*\d*/i,
            /ranking/i,
            /które\s+kategorie.*największe/i,
            /główne\s+wydatki/i,
            /na\s+co\s+wydaję\s+najwięcej/i
        ],
        SUM: [
            /ile\s+wydałem/i,
            /suma\s+wydatków/i,
            /łącznie/i,
            /całkowity\s+koszt/i,
            /razem\s+na/i
        ],
        TREND: [
            /jak\s+się\s+zmienia/i,
            /trend/i,
            /rośnie.*maleje/i,
            /tendencja/i
        ],
        COMPARISON: [
            /porównaj/i,
            /porównanie/i,
            /vs\.?/i,
            /różnica\s+między/i
        ],
        BREAKDOWN: [
            /w\s+poszczególnych\s+miesiącach/i,
            /rozbicie\s+miesięczne/i,
            /miesięcznie/i,
            /co\s+miesiąc/i
        ]
    },
    
    // ═══════════════════════════════════════════════════════════
    // GŁÓWNA METODA ROUTINGU
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Klasyfikuje zapytanie użytkownika i zwraca routing
     * @param {string} userQuery - Pytanie użytkownika
     * @param {object} cache - Cache danych
     * @param {boolean} isRepairAttempt - Czy to próba naprawy planu
     */
    async classifyIntent(userQuery, cache = null, isRepairAttempt = false) {
        // Resetuj flagę naprawy tylko przy nowym zapytaniu (nie przy naprawie)
        if (!isRepairAttempt) {
            this._lastRouting = null;
            this._planRepairAttempted = false;
        }
        
        // Pobierz cache jeśli nie podano
        if (!cache) {
            cache = await BudgetAICache.getCache();
        }
        
        // 1. Wykryj kształt pytania PRZED wysłaniem do LLM7
        const detectedShape = this._detectQuestionShape(userQuery);
        console.log('BudgetAIRouter: Detected question shape:', detectedShape);
        
        // 2. Próba z LLM7
        const llm7Result = await this._classifyWithLLM7(userQuery, cache, detectedShape);
        
        if (llm7Result.success) {
            // 3. Waliduj spójność planu z pytaniem
            const consistencyCheck = this._validatePlanConsistency(
                llm7Result.routing, 
                userQuery, 
                detectedShape
            );
            
            if (!consistencyCheck.valid && !isRepairAttempt && !this._planRepairAttempted) {
                console.warn('BudgetAIRouter: Plan inconsistent:', consistencyCheck.reason);
                
                // Oznacz że próbujemy naprawy
                this._planRepairAttempted = true;
                
                // Uruchom naprawę planu
                const repairedRouting = await this._repairPlan(
                    userQuery, 
                    llm7Result.routing, 
                    consistencyCheck.reason,
                    cache,
                    detectedShape
                );
                
                if (repairedRouting) {
                    console.log('BudgetAIRouter: Plan repaired successfully');
                    return repairedRouting;
                }
            }
            
            console.log('BudgetAIRouter: LLM7 routing:', llm7Result.routing);
            return llm7Result.routing;
        }
        
        console.log('BudgetAIRouter: LLM7 failed, using fallback:', llm7Result.error);
        
        // 4. Fallback: deterministyczny routing z uwzględnieniem kształtu pytania
        return this._fallbackRouting(userQuery, cache, detectedShape);
    },
    
    /**
     * Wykrywa kształt pytania na podstawie wzorców
     */
    _detectQuestionShape(query) {
        const normalizedQuery = query.toLowerCase();
        
        for (const [shape, patterns] of Object.entries(this.QUESTION_SHAPE_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(normalizedQuery)) {
                    return shape;
                }
            }
        }
        
        return 'GENERAL';
    },
    
    async _classifyWithLLM7(userQuery, cache, detectedShape) {
        // Rozpoznaj synonimy PRZED wysłaniem do LLM7
        let resolvedSynonyms = null;
        if (typeof BudgetAISynonyms !== 'undefined') {
            resolvedSynonyms = BudgetAISynonyms.resolve(userQuery);
            console.log('BudgetAIRouter: Resolved synonyms:', {
                subcategories: resolvedSynonyms.subcategories,
                intents: resolvedSynonyms.intents,
                timeContext: resolvedSynonyms.timeContext
            });
        }
        
        // Buduj prompt dla LLM7 z rozpoznanymi synonimami i wykrytym kształtem
        const systemPrompt = this._buildRouterSystemPrompt(cache, resolvedSynonyms, detectedShape);
        
        const result = await AIProviders.callRouter(systemPrompt, userQuery);
        
        if (!result.success) {
            return { success: false, error: result.error };
        }
        
        // Parsuj i waliduj odpowiedź
        try {
            let jsonContent = result.content.trim();
            
            // Wyciągnij JSON z markdown code blocks
            const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                jsonContent = codeBlockMatch[1].trim();
            }
            
            if (jsonContent.startsWith('```')) {
                jsonContent = jsonContent.replace(/^```(?:json)?[\r\n]*/, '').replace(/[\r\n]*```$/, '').trim();
            }
            
            if (!jsonContent.startsWith('{')) {
                const firstBrace = jsonContent.indexOf('{');
                const lastBrace = jsonContent.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
                }
            }
            
            console.log('BudgetAIRouter: Parsing JSON:', jsonContent.substring(0, 150) + '...');
            
            const parsed = JSON.parse(jsonContent);
            
            // Dodaj wykryty kształt jeśli brak
            if (!parsed.question_shape) {
                parsed.question_shape = detectedShape;
            }
            
            const validated = this._validateRouterResponse(parsed, cache);
            
            if (!validated.valid) {
                return { success: false, error: validated.error };
            }
            
            return { success: true, routing: validated.routing };
            
        } catch (error) {
            return { success: false, error: `Błąd parsowania JSON: ${error.message}` };
        }
    },
    
    _buildRouterSystemPrompt(cache, resolvedSynonyms = null, detectedShape = null) {
        const functions = BudgetAICompute.getFunctionList();
        const categories = this.VALID_CATEGORIES;
        const subcategories = this.VALID_SUBCATEGORIES;
        const periods = cache.availablePeriods || [];
        
        // Sekcja z rozpoznanymi synonimami
        let synonymsSection = '';
        if (resolvedSynonyms && (resolvedSynonyms.subcategories.length > 0 || resolvedSynonyms.categories.length > 0)) {
            synonymsSection = `
═══════════════════════════════════════════════════════════════════════
ROZPOZNANE SYNONIMY W ZAPYTANIU (UŻYWAJ DOKŁADNIE TYCH NAZW!):
═══════════════════════════════════════════════════════════════════════

`;
            if (resolvedSynonyms.subcategories.length > 0) {
                synonymsSection += 'PODKATEGORIE:\n';
                resolvedSynonyms.subcategories.forEach(sub => {
                    synonymsSection += `• "${sub.originalTerm}" → oficjalna podkategoria: "${sub.officialName}" (kategoria: "${sub.category}")\n`;
                });
            }
            
            if (resolvedSynonyms.categories.length > 0) {
                synonymsSection += 'KATEGORIE:\n';
                resolvedSynonyms.categories.forEach(cat => {
                    synonymsSection += `• "${cat.originalTerm}" → oficjalna kategoria: "${cat.officialName}"\n`;
                });
            }
            
            if (resolvedSynonyms.intents.length > 0) {
                const suggestedFunc = typeof BudgetAISynonyms !== 'undefined' 
                    ? BudgetAISynonyms.suggestFunction(resolvedSynonyms.intents) 
                    : null;
                synonymsSection += `\nROZPOZNANA INTENCJA: ${resolvedSynonyms.intents.join(', ')}\n`;
                if (suggestedFunc) {
                    synonymsSection += `SUGEROWANA FUNKCJA: ${suggestedFunc}\n`;
                }
            }
            
            if (resolvedSynonyms.timeContext) {
                synonymsSection += `\nROZPOZNANY OKRES: ${JSON.stringify(resolvedSynonyms.timeContext)}\n`;
            }
            
            synonymsSection += `
═══════════════════════════════════════════════════════════════════════
WAŻNE: Użyj DOKŁADNIE powyższych oficjalnych nazw w odpowiedzi JSON!
═══════════════════════════════════════════════════════════════════════

`;
        }
        
        // Sekcja z wykrytym kształtem pytania
        let shapeSection = '';
        if (detectedShape && detectedShape !== 'GENERAL') {
            shapeSection = `
═══════════════════════════════════════════════════════════════════════
WYKRYTY KSZTAŁT PYTANIA: ${detectedShape}
═══════════════════════════════════════════════════════════════════════
${this._getShapeInstructions(detectedShape)}
═══════════════════════════════════════════════════════════════════════

`;
        }
        
        return `Jesteś routerem zapytań budżetowych. Analizujesz pytanie użytkownika i zwracasz JSON z instrukcjami.
${synonymsSection}${shapeSection}
DOSTĘPNE FUNKCJE OBLICZENIOWE:
${JSON.stringify(functions, null, 2)}

ZAMKNIĘTA LISTA KATEGORII (używaj TYLKO tych nazw):
${JSON.stringify(categories)}

ZAMKNIĘTA LISTA PODKATEGORII (używaj TYLKO tych nazw):
${JSON.stringify(subcategories)}

DOSTĘPNE OKRESY (od najnowszego):
${periods.slice(0, 12).map(p => p.label).join(', ')}

═══════════════════════════════════════════════════════════════════════
KRYTYCZNE ZASADY KLASYFIKACJI PYTAŃ:
═══════════════════════════════════════════════════════════════════════

1. PYTANIA "W KTÓRYM MIESIĄCU NAJWIĘCEJ/NAJMNIEJ":
   - Frazy: "w którym miesiącu", "kiedy najwięcej", "kiedy najmniej", "który miesiąc"
   - question_shape: "MAX_IN_TIME" lub "MIN_IN_TIME"
   - WYMAGANA operacja: monthlyBreakdown (NIE topExpenses!)
   - Przykład: "W którym miesiącu wydałem najwięcej na psa?"
     → monthlyBreakdown dla podkategorii "Zwierzęta", question_shape: "MAX_IN_TIME"

2. PYTANIA O RANKING/TOP (bez kontekstu czasowego):
   - Frazy: "top 10", "ranking", "które kategorie", "na co wydaję najwięcej"
   - question_shape: "RANKING"
   - WYMAGANA operacja: topExpenses
   - Przykład: "Na co wydaję najwięcej pieniędzy?"
     → topExpenses, question_shape: "RANKING"

3. PYTANIA O SUMĘ:
   - Frazy: "ile wydałem", "suma", "łącznie", "razem"
   - question_shape: "SUM"
   - WYMAGANA operacja: sumByCategory lub sumBySubcategory

4. PYTANIA O TREND:
   - Frazy: "jak się zmieniało", "trend", "rośnie/maleje"
   - question_shape: "TREND"
   - WYMAGANA operacja: monthlyBreakdown lub trendAnalysis

5. PYTANIA O PORÓWNANIE:
   - Frazy: "porównaj", "vs", "różnica między"
   - question_shape: "COMPARISON"
   - WYMAGANA operacja: compareMonths

═══════════════════════════════════════════════════════════════════════
ZASADY MAPOWANIA SYNONIMÓW:
═══════════════════════════════════════════════════════════════════════

- "pies", "psa", "zwierzak" → podkategoria "Zwierzęta" w kategorii "Codzienne wydatki"
- "paliwo", "benzyna", "tankowanie" → podkategoria "Paliwo" w kategorii "Auto i transport"
- "restauracja", "jedzenie poza domem" → podkategoria "Jedzenie poza domem" w kategorii "Codzienne wydatki"
- "czynsz", "najem" → podkategoria "Czynsz i wynajem" w kategorii "Płatności"
- "prąd", "elektryczność" → podkategoria "Prąd" w kategorii "Płatności"

═══════════════════════════════════════════════════════════════════════
FORMAT ODPOWIEDZI JSON (OBOWIĄZKOWE POLA):
═══════════════════════════════════════════════════════════════════════

{
  "intent_summary": "Krótki opis intencji po polsku",
  "question_shape": "RANKING|MAX_IN_TIME|MIN_IN_TIME|SUM|TREND|COMPARISON|BREAKDOWN|ANALYSIS|GENERAL",
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
  "period_to": "YYYY-MM lub null",
  "confidence": 0.9
}

═══════════════════════════════════════════════════════════════════════
WAŻNE:
═══════════════════════════════════════════════════════════════════════

1. Odpowiadaj TYLKO poprawnym JSON bez dodatkowego tekstu
2. Używaj WYŁĄCZNIE nazw kategorii i podkategorii z zamkniętej listy
3. question_shape MUSI odpowiadać typowi pytania
4. Jeśli pytanie jest niejasne, ustaw route: "clarify"
5. confidence: 0.0-1.0 określa pewność klasyfikacji`;
    },
    
    /**
     * Zwraca instrukcje dla konkretnego kształtu pytania
     */
    _getShapeInstructions(shape) {
        const instructions = {
            'MAX_IN_TIME': `To pytanie o MAKSIMUM W CZASIE. Użytkownik chce wiedzieć W KTÓRYM MIESIĄCU było najwięcej.
MUSISZ użyć: monthlyBreakdown (NIE topExpenses!)
MUSISZ ustawić: question_shape: "MAX_IN_TIME"`,
            
            'MIN_IN_TIME': `To pytanie o MINIMUM W CZASIE. Użytkownik chce wiedzieć W KTÓRYM MIESIĄCU było najmniej.
MUSISZ użyć: monthlyBreakdown (NIE topExpenses!)
MUSISZ ustawić: question_shape: "MIN_IN_TIME"`,
            
            'RANKING': `To pytanie o RANKING kategorii/podkategorii.
MUSISZ użyć: topExpenses
MUSISZ ustawić: question_shape: "RANKING"`,
            
            'SUM': `To pytanie o SUMĘ wydatków.
MUSISZ użyć: sumByCategory lub sumBySubcategory
MUSISZ ustawić: question_shape: "SUM"`,
            
            'TREND': `To pytanie o TREND zmian w czasie.
MUSISZ użyć: trendAnalysis lub monthlyBreakdown
MUSISZ ustawić: question_shape: "TREND"`,
            
            'COMPARISON': `To pytanie o PORÓWNANIE okresów.
MUSISZ użyć: compareMonths
MUSISZ ustawić: question_shape: "COMPARISON"`,
            
            'BREAKDOWN': `To pytanie o ROZBICIE MIESIĘCZNE.
MUSISZ użyć: monthlyBreakdown
MUSISZ ustawić: question_shape: "BREAKDOWN"`
        };
        
        return instructions[shape] || '';
    },
    
    /**
     * Waliduje spójność planu z pytaniem
     */
    _validatePlanConsistency(routing, userQuery, detectedShape) {
        const operations = routing.operations || [];
        const operationFunctions = operations.map(op => op.function);
        
        // Reguła 1: MAX_IN_TIME/MIN_IN_TIME wymaga monthlyBreakdown
        if ((detectedShape === 'MAX_IN_TIME' || detectedShape === 'MIN_IN_TIME') && 
            !operationFunctions.includes('monthlyBreakdown')) {
            return {
                valid: false,
                reason: `Pytanie typu ${detectedShape} wymaga operacji monthlyBreakdown, ale plan zawiera: ${operationFunctions.join(', ')}`
            };
        }
        
        // Reguła 2: Wykryto synonim kategorii, ale plan nie ma operacji dla tej kategorii
        if (routing.canonical_subcategory && operations.length > 0) {
            const hasMatchingOperation = operations.some(op => 
                op.params?.subcategory === routing.canonical_subcategory ||
                op.params?.category === routing.canonical_category
            );
            
            if (!hasMatchingOperation && !['topExpenses', 'getSummary', 'analyze503020'].includes(operationFunctions[0])) {
                return {
                    valid: false,
                    reason: `Wykryto podkategorię "${routing.canonical_subcategory}" ale operacje nie używają tej podkategorii`
                };
            }
        }
        
        // Reguła 3: question_shape nie zgadza się z operations
        if (routing.question_shape === 'RANKING' && !operationFunctions.includes('topExpenses')) {
            // To może być ok jeśli to ranking w ramach kategorii
            // Nie wymuszamy naprawy
        }
        
        return { valid: true };
    },
    
    /**
     * Naprawa planu przez drugie wywołanie LLM7
     */
    async _repairPlan(userQuery, originalRouting, problemDescription, cache, detectedShape) {
        console.log('BudgetAIRouter: Attempting plan repair...');
        
        const repairPrompt = `Jesteś routerem naprawczym. Poprzedni plan był BŁĘDNY i musisz go naprawić.

ORYGINALNE PYTANIE UŻYTKOWNIKA:
"${userQuery}"

POPRZEDNI (BŁĘDNY) PLAN:
${JSON.stringify(originalRouting, null, 2)}

WYKRYTY PROBLEM:
${problemDescription}

WYKRYTY KSZTAŁT PYTANIA: ${detectedShape}

${this._getShapeInstructions(detectedShape)}

NAPRAW PLAN - zwróć TYLKO poprawny JSON w tym samym formacie co poprzednio.
Upewnij się że:
1. operations zawiera właściwe funkcje dla typu pytania
2. question_shape jest poprawny
3. kategoria/podkategoria są zachowane jeśli były poprawne`;

        try {
            const result = await AIProviders.callRouter(repairPrompt, 'Napraw powyższy plan.');
            
            if (!result.success) {
                console.warn('BudgetAIRouter: Repair call failed:', result.error);
                return null;
            }
            
            let jsonContent = result.content.trim();
            const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                jsonContent = codeBlockMatch[1].trim();
            }
            
            if (!jsonContent.startsWith('{')) {
                const firstBrace = jsonContent.indexOf('{');
                const lastBrace = jsonContent.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
                }
            }
            
            const parsed = JSON.parse(jsonContent);
            const validated = this._validateRouterResponse(parsed, cache);
            
            if (validated.valid) {
                validated.routing.source = 'llm7_repaired';
                return validated.routing;
            }
            
            return null;
            
        } catch (error) {
            console.warn('BudgetAIRouter: Repair parsing failed:', error);
            return null;
        }
    },
    
    _validateRouterResponse(response, cache) {
        // Sprawdź wymagane pola
        if (!response.intent_summary || typeof response.intent_summary !== 'string') {
            return { valid: false, error: 'Brak intent_summary' };
        }
        
        const validRoutes = ['compute_sum', 'compute_top', 'compute_trend', 'compute_compare', 
                           'compute_503020', 'compute_anomalies', 'compute_summary', 'clarify', 'general'];
        if (!response.route || !validRoutes.includes(response.route)) {
            return { valid: false, error: `Nieprawidłowy route: ${response.route}` };
        }
        
        // Waliduj question_shape
        const validShapes = ['RANKING', 'MAX_IN_TIME', 'MIN_IN_TIME', 'SUM', 'TREND', 
                           'COMPARISON', 'BREAKDOWN', 'ANALYSIS', 'GENERAL'];
        if (response.question_shape && !validShapes.includes(response.question_shape)) {
            response.question_shape = 'GENERAL';
        }
        
        // Waliduj kategorie przeciwko zamkniętej liście
        if (response.canonical_category) {
            if (!this.VALID_CATEGORIES.includes(response.canonical_category)) {
                // Może to jest podkategoria? Szukaj
                let foundCategory = null;
                let foundSubcategory = null;
                
                for (const cat of this.VALID_CATEGORIES) {
                    const subs = this.VALID_SUBCATEGORIES[cat] || [];
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
        
        // Waliduj podkategorię
        if (response.canonical_subcategory && response.canonical_category) {
            const validSubs = this.VALID_SUBCATEGORIES[response.canonical_category] || [];
            if (!validSubs.includes(response.canonical_subcategory)) {
                console.warn('BudgetAIRouter: Nieznana podkategoria:', response.canonical_subcategory);
                response.canonical_subcategory = null;
            }
        }
        
        // Jeśli mamy tylko subcategory bez category, znajdź kategorię
        if (response.canonical_subcategory && !response.canonical_category) {
            for (const cat of this.VALID_CATEGORIES) {
                const subs = this.VALID_SUBCATEGORIES[cat] || [];
                if (subs.includes(response.canonical_subcategory)) {
                    response.canonical_category = cat;
                    break;
                }
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
                
                // Napraw kategorie w params
                if (op.params) {
                    if (op.params.category && !this.VALID_CATEGORIES.includes(op.params.category)) {
                        for (const cat of this.VALID_CATEGORIES) {
                            const subs = this.VALID_SUBCATEGORIES[cat] || [];
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
        
        // Dodaj source jeśli brak
        if (!response.source) {
            response.source = 'llm7';
        }
        
        return { valid: true, routing: response };
    },
    
    // ═══════════════════════════════════════════════════════════
    // FALLBACK ROUTING (DETERMINISTYCZNY)
    // ═══════════════════════════════════════════════════════════
    
    _fallbackRouting(userQuery, cache, detectedShape = null) {
        const query = userQuery.toLowerCase();
        
        // Użyj BudgetAISynonyms
        let resolvedSynonyms = null;
        if (typeof BudgetAISynonyms !== 'undefined') {
            resolvedSynonyms = BudgetAISynonyms.resolve(userQuery);
        }
        
        // Wykryj kategorie
        let detectedCategories = [];
        if (resolvedSynonyms && resolvedSynonyms.subcategories.length > 0) {
            detectedCategories = resolvedSynonyms.subcategories.map(s => ({
                category: s.category,
                subcategory: s.officialName
            }));
        } else {
            detectedCategories = this._detectAllCategories(userQuery);
        }
        
        let category = detectedCategories.length > 0 ? detectedCategories[0].category : null;
        let subcategory = detectedCategories.length > 0 ? detectedCategories[0].subcategory : null;
        
        // Wykryj okres
        const periodMatch = BudgetAICompute.parsePeriod(userQuery);
        const periodFrom = periodMatch?.from || null;
        const periodTo = periodMatch?.to || null;
        
        // Użyj wykrytego kształtu lub wykryj ponownie
        const questionShape = detectedShape || this._detectQuestionShape(userQuery);
        
        let route = 'general';
        let operations = [];
        let intentSummary = 'Ogólne pytanie o finanse';
        
        // Routing na podstawie kształtu pytania
        switch (questionShape) {
            case 'MAX_IN_TIME':
            case 'MIN_IN_TIME':
                route = 'compute_trend';
                intentSummary = questionShape === 'MAX_IN_TIME' 
                    ? `Szukam miesiąca z najwyższymi wydatkami${subcategory ? ` na "${subcategory}"` : ''}`
                    : `Szukam miesiąca z najniższymi wydatkami${subcategory ? ` na "${subcategory}"` : ''}`;
                operations.push({
                    function: 'monthlyBreakdown',
                    params: { category, subcategory, periodFrom, periodTo }
                });
                break;
                
            case 'RANKING':
                route = 'compute_top';
                intentSummary = 'Top wydatki';
                const nMatch = query.match(/top\s*(\d+)/);
                const n = nMatch ? parseInt(nMatch[1]) : 10;
                operations.push({
                    function: 'topExpenses',
                    params: { 
                        n, 
                        level: subcategory ? 'subcategory' : 'category', 
                        periodFrom, 
                        periodTo,
                        filterCategory: category  // NOWE: filtr kategorii
                    }
                });
                break;
                
            case 'SUM':
                route = 'compute_sum';
                intentSummary = `Suma wydatków${subcategory ? ` dla "${subcategory}"` : (category ? ` dla "${category}"` : '')}`;
                operations.push({
                    function: 'sumByCategory',
                    params: { category, subcategory, periodFrom, periodTo }
                });
                break;
                
            case 'TREND':
            case 'BREAKDOWN':
                route = 'compute_trend';
                intentSummary = `Wydatki miesięczne${subcategory ? ` dla "${subcategory}"` : ''}`;
                operations.push({
                    function: 'monthlyBreakdown',
                    params: { category, subcategory, periodFrom, periodTo }
                });
                break;
                
            case 'COMPARISON':
                route = 'compute_compare';
                intentSummary = 'Porównanie okresów';
                const periods = cache.availablePeriods || [];
                if (periods.length >= 2) {
                    const p1 = `${periods[1].rok}-${String(periods[1].miesiac).padStart(2, '0')}`;
                    const p2 = `${periods[0].rok}-${String(periods[0].miesiac).padStart(2, '0')}`;
                    operations.push({
                        function: 'compareMonths',
                        params: { period1: p1, period2: p2 }
                    });
                }
                break;
                
            default:
                // Stara logika fallback dla nierozpoznanych
                if (query.match(/50.?30.?20|potrzeby|zachcianki/)) {
                    route = 'compute_503020';
                    intentSummary = 'Analiza 50/30/20';
                    operations.push({ function: 'analyze503020', params: { period: null } });
                } else if (query.match(/podsumowanie|podsumuj|przegląd/)) {
                    route = 'compute_summary';
                    intentSummary = 'Podsumowanie finansów';
                    operations.push({ function: 'getSummary', params: { period: null } });
                } else if (category) {
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
        }
        
        return {
            intent_summary: intentSummary,
            question_shape: questionShape,
            route,
            operations,
            canonical_category: category,
            canonical_subcategory: subcategory,
            period_from: periodFrom,
            period_to: periodTo,
            confidence: 0.6,
            source: 'fallback'
        };
    },
    
    /**
     * Wykrywa WSZYSTKIE kategorie/podkategorie wymienione w zapytaniu
     */
    _detectAllCategories(userQuery) {
        const detected = [];
        const query = userQuery.toLowerCase();
        const words = query.split(/[\s,;]+/).filter(w => w.length >= 3);
        
        // Sprawdź każde słowo
        for (const word of words) {
            const match = BudgetAICompute.normalizeCategory(word);
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
        
        // Sprawdź frazy 2-3 słowne
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
        
        return detected;
    },
    
    // ═══════════════════════════════════════════════════════════
    // BUDOWANIE KAPSUŁY FAKTÓW (ROZSZERZONE)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Buduje minimalną kapsułę faktów z deterministycznymi pochodnymi
     */
    buildFactsCapsule(routing, computeResults, cache, userQuery = null) {
        const capsule = {
            // NOWE: Oryginalne pytanie użytkownika
            original_query: userQuery,
            query_intent: routing.intent_summary,
            question_shape: routing.question_shape || 'GENERAL',
            route: routing.route,
            timestamp: new Date().toISOString(),
            results: {},
            derived: {},  // NOWE: Deterministycznie wyliczone pochodne
            context: {}
        };
        
        // Dodaj wyniki obliczeń
        computeResults.forEach((result, index) => {
            const operation = result.operation;
            
            if (result.success) {
                if (capsule.results[operation]) {
                    if (!Array.isArray(capsule.results[operation])) {
                        capsule.results[operation] = [capsule.results[operation]];
                    }
                    capsule.results[operation].push(result.data);
                } else {
                    capsule.results[operation] = result.data;
                }
                
                // NOWE: Oblicz pochodne dla monthlyBreakdown
                if (operation === 'monthlyBreakdown' && result.data?.breakdown) {
                    const derivedData = this._calculateDerivedMetrics(result.data, routing.question_shape);
                    Object.assign(capsule.derived, derivedData);
                }
            } else {
                const errorKey = `${operation}_error_${index}`;
                capsule.results[errorKey] = { error: result.error };
            }
        });
        
        // Dodaj kontekst
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
        
        // Dodaj trendy jeśli dostępne
        if (cache.trends) {
            capsule.context.overallTrends = {
                expenses: cache.trends.expenses?.direction || 'unknown',
                income: cache.trends.income?.direction || 'unknown',
                balance: cache.trends.balance?.direction || 'unknown'
            };
        }
        
        return capsule;
    },
    
    /**
     * Oblicza deterministyczne metryki pochodne dla breakdownu
     */
    _calculateDerivedMetrics(breakdownResult, questionShape) {
        const derived = {};
        const breakdown = breakdownResult.breakdown || [];
        
        if (breakdown.length === 0) {
            derived.hasData = false;
            derived.message = 'Brak danych dla wybranej kategorii/podkategorii';
            return derived;
        }
        
        derived.hasData = true;
        
        // Znajdź max i min - obsłuż zarówno "value" jak i "amount"
        let maxEntry = null;
        let minEntry = null;
        let sum = 0;
        
        for (const entry of breakdown) {
            const value = entry.value ?? entry.amount ?? 0;
            sum += value;
            
            if (!maxEntry || value > (maxEntry.value ?? maxEntry.amount ?? 0)) {
                maxEntry = entry;
            }
            if (!minEntry || value < (minEntry.value ?? minEntry.amount ?? 0)) {
                minEntry = entry;
            }
        }
        
        const maxValue = maxEntry ? (maxEntry.value ?? maxEntry.amount ?? 0) : 0;
        const minValue = minEntry ? (minEntry.value ?? minEntry.amount ?? 0) : 0;
        
        derived.total = sum;
        derived.count = breakdown.length;
        derived.average = breakdown.length > 0 ? sum / breakdown.length : 0;
        
        derived.maximum = {
            period: maxEntry?.period,
            value: maxValue,
            label: this._formatPeriodLabel(maxEntry?.period)
        };
        
        derived.minimum = {
            period: minEntry?.period,
            value: minValue,
            label: this._formatPeriodLabel(minEntry?.period)
        };
        
        // Dodaj bezpośrednią odpowiedź na pytanie o max/min w czasie
        if (questionShape === 'MAX_IN_TIME') {
            derived.answer = `Najwięcej wydano w ${derived.maximum.label}: ${this._formatAmount(maxValue)}`;
        } else if (questionShape === 'MIN_IN_TIME') {
            derived.answer = `Najmniej wydano w ${derived.minimum.label}: ${this._formatAmount(minValue)}`;
        }
        
        return derived;
    },
    
    _formatPeriodLabel(period) {
        if (!period) return 'nieznany';
        const [year, month] = period.split('-');
        const monthNames = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
                          'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
        const monthIndex = parseInt(month) - 1;
        return `${monthNames[monthIndex] || month} ${year}`;
    },
    
    _formatAmount(value) {
        return new Intl.NumberFormat('pl-PL', { 
            style: 'currency', 
            currency: 'PLN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
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
6. Jeśli dane są niekompletne lub brak danych (hasData: false), powiedz o tym JASNO
7. Dla trendów opisz kierunek i dynamikę
8. Używaj emoji dla czytelności: 📊 📈 📉 💰 ⚠️ ✅

WAŻNE DLA PODSUMOWAŃ MIESIĘCZNYCH:
- Używaj lastPeriodLabel jako nazwy miesiąca (np. "grudzień 2025")
- Jeśli isClosedMonth: true, to jest "ostatni zamknięty miesiąc"
- Jeśli isClosedMonth: false, to jest bieżący miesiąc (w trakcie)
- Sprawdź _meta.periodStatus: 'closed' = zamknięty, 'current' = bieżący
- Bilans = lastMonth.income - lastMonth.expenses LUB lastMonth.balance
- Wykonanie planu = savingsRate (stosunek oszczędności do dochodów)

WAŻNE DLA PYTAŃ O MAKSIMUM/MINIMUM W CZASIE:
- Jeśli w derived.answer jest gotowa odpowiedź, UŻYJ JEJ
- Jeśli question_shape to MAX_IN_TIME, odpowiedz o miesiącu z najwyższą wartością
- Jeśli question_shape to MIN_IN_TIME, odpowiedz o miesiącu z najniższą wartością
- Użyj danych z derived.maximum lub derived.minimum

WAŻNE DLA BRAKU DANYCH:
- Jeśli hasData: false, poinformuj że brak danych dla tej kategorii
- NIE pokazuj danych z innych kategorii
- NIE zgaduj wartości

FORMAT ODPOWIEDZI:
- Zacznij od bezpośredniej odpowiedzi na pytanie
- Podaj kluczowe liczby
- Dodaj krótki kontekst lub wnioski
- Maksymalnie 3-4 akapity

Odpowiadaj po polsku w naturalnym, przyjaznym tonie.`;
    }
};
