/**
 * Assetly - Budget AI Router (v4.0)
 * 
 * NOWY PARADYGMAT: LLM7 jako główny decydent
 * 
 * Przepływ:
 * 1. JS zbiera HINTS (podpowiedzi) - NIE decyduje
 * 2. LLM7 otrzymuje zapytanie + taksonomię + hints → INTERPRETUJE i DECYDUJE
 * 3. JS waliduje technicznie (czy route/kategorie istnieją) - NIE kwestionuje interpretacji
 * 4. W razie błędu → drugi obieg LLM7 (repair)
 * 5. Ostateczny fallback → deterministyczny JS routing
 */

const BudgetAIRouter = {
    
    // Stan
    _lastRouting: null,
    _planRepairAttempted: false,
    
    // ═══════════════════════════════════════════════════════════
    // ZAMKNIĘTA TAKSONOMIA (źródło prawdy)
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
    
    VALID_ROUTES: [
        'compute_sum', 
        'compute_top', 
        'compute_trend', 
        'compute_compare', 
        'compute_503020', 
        'compute_anomalies', 
        'compute_summary', 
        'clarify', 
        'general'
    ],
    
    VALID_SHAPES: [
        'RANKING', 
        'MAX_IN_TIME', 
        'MIN_IN_TIME', 
        'SUM', 
        'TREND', 
        'COMPARISON', 
        'BREAKDOWN', 
        'ANALYSIS', 
        'GENERAL'
    ],
    
    // ═══════════════════════════════════════════════════════════
    // WZORCE DO ZBIERANIA HINTS (nie do decydowania!)
    // ═══════════════════════════════════════════════════════════
    
    SHAPE_HINT_PATTERNS: {
        MAX_IN_TIME: [
            /w\s+kt[óo]rym\s+miesi[aą]cu.*najwi[eę]cej/i,
            /kt[óo]ry\s+miesi[aą]c.*najwi[eę]cej/i,
            /kiedy\s+wyda[łl]em.*najwi[eę]cej/i,
            /kiedy\s+najwi[eę]cej/i
        ],
        MIN_IN_TIME: [
            /w\s+kt[óo]rym\s+miesi[aą]cu.*najmniej/i,
            /kt[óo]ry\s+miesi[aą]c.*najmniej/i,
            /kiedy\s+wyda[łl]em.*najmniej/i,
            /kiedy\s+najmniej/i
        ],
        RANKING: [
            /top\s*\d*/i,
            /ranking/i,
            /na\s+co\s+wydaj[eę]\s+najwi[eę]cej/i
        ],
        SUM: [
            /ile\s+wyda[łl]em/i,
            /suma\s+wydatk[óo]w/i,
            /[łl][aą]cznie/i
        ],
        TREND: [
            /jak\s+si[eę]\s+zmienia/i,
            /trend/i,
            /przez\s+ostatni/i,
            /ostatnie\s+\d+\s+miesi/i
        ],
        COMPARISON: [
            /por[óo]wnaj/i,
            /vs\.?/i
        ],
        ANALYSIS: [
            /podsumowanie/i,
            /podsumuj/i,
            /analiz/i,
            /przegląd/i
        ]
    },
    
    // ═══════════════════════════════════════════════════════════
    // GŁÓWNA METODA ROUTINGU
    // ═══════════════════════════════════════════════════════════
    
    async classifyIntent(userQuery, cache = null, isRepairAttempt = false) {
        if (!isRepairAttempt) {
            this._lastRouting = null;
            this._planRepairAttempted = false;
        }
        
        if (!cache) {
            cache = await BudgetAICache.getCache();
        }
        
        // ─────────────────────────────────────────────────────────
        // KROK 1: JS zbiera HINTS (podpowiedzi) - NIE decyduje!
        // ─────────────────────────────────────────────────────────
        const hints = this._collectHints(userQuery, cache);
        console.log('BudgetAIRouter: Collected hints:', hints);
        
        // ─────────────────────────────────────────────────────────
        // KROK 2: LLM7 - GŁÓWNY DECYDENT
        // ─────────────────────────────────────────────────────────
        const llm7Result = await this._askLLM7ToDecide(userQuery, cache, hints);
        
        if (llm7Result.success) {
            // ─────────────────────────────────────────────────────
            // KROK 3: Techniczna walidacja (nie kwestionuje interpretacji!)
            // ─────────────────────────────────────────────────────
            const validation = this._technicalValidation(llm7Result.routing);
            
            if (validation.valid) {
                console.log('BudgetAIRouter: LLM7 routing accepted:', llm7Result.routing);
                return llm7Result.routing;
            }
            
            // ─────────────────────────────────────────────────────
            // KROK 4: Próba naprawy przez drugi obieg LLM7
            // ─────────────────────────────────────────────────────
            if (!isRepairAttempt && !this._planRepairAttempted) {
                console.warn('BudgetAIRouter: Technical validation failed:', validation.errors);
                this._planRepairAttempted = true;
                
                const repairedRouting = await this._repairPlan(
                    userQuery, 
                    llm7Result.routing, 
                    validation.errors,
                    cache,
                    hints
                );
                
                if (repairedRouting) {
                    console.log('BudgetAIRouter: Plan repaired successfully');
                    return repairedRouting;
                }
            }
        } else {
            console.warn('BudgetAIRouter: LLM7 failed:', llm7Result.error);
        }
        
        // ─────────────────────────────────────────────────────────
        // KROK 5: Ostateczny fallback - deterministyczny JS
        // ─────────────────────────────────────────────────────────
        console.log('BudgetAIRouter: Using fallback routing');
        return this._fallbackRouting(userQuery, cache, hints);
    },
    
    // ═══════════════════════════════════════════════════════════
    // KROK 1: ZBIERANIE HINTS (JS jako asystent)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Zbiera podpowiedzi z zapytania - NIE podejmuje decyzji!
     * Te dane są POMOCNICZE dla LLM7
     */
    _collectHints(userQuery, cache) {
        const query = userQuery.toLowerCase();
        
        const hints = {
            // Surowe słowa kluczowe z zapytania
            keywords: this._extractKeywords(userQuery),
            
            // Hint o kształcie pytania (wzorce regex)
            shapeHint: this._detectShapeHint(query),
            
            // Hint o okresie czasowym
            periodHint: this._detectPeriodHint(userQuery, cache),
            
            // Hinty z BudgetAISynonyms (jeśli coś znalazł)
            synonymHints: this._getSynonymHints(userQuery),
            
            // Czy pytanie wygląda na ogólne (bez konkretnej kategorii)?
            looksGeneral: this._looksLikeGeneralQuestion(query),
            
            // Czy wykryto wiele tematów?
            multipleTopicsDetected: this._detectMultipleTopics(query)
        };
        
        return hints;
    },
    
    _extractKeywords(query) {
        // Wyciągnij znaczące słowa (>2 znaki, nie stop-words)
        const stopWords = ['ile', 'jak', 'czy', 'moje', 'mój', 'moja', 'się', 'przez', 
                          'ostatnie', 'ostatni', 'ostatnich', 'oraz', 'dla', 'czy', 'może',
                          'chcę', 'chce', 'powiedz', 'opowiedz', 'pokaż', 'pokaz'];
        
        return query.toLowerCase()
            .split(/[\s,;.!?]+/)
            .filter(word => word.length > 2 && !stopWords.includes(word));
    },
    
    _detectShapeHint(query) {
        for (const [shape, patterns] of Object.entries(this.SHAPE_HINT_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(query)) {
                    return shape;
                }
            }
        }
        return null; // Brak pewnego hinta - LLM7 zdecyduje
    },
    
    _detectPeriodHint(userQuery, cache) {
        const periodMatch = BudgetAICompute.parsePeriod(userQuery);
        if (periodMatch) {
            return {
                from: periodMatch.from,
                to: periodMatch.to,
                confidence: 'detected_by_parser'
            };
        }
        
        // Sprawdź względne okresy
        const query = userQuery.toLowerCase();
        if (query.match(/ostatni(ch|e|ego)?\s+(\d+)\s+miesi/)) {
            const match = query.match(/ostatni(ch|e|ego)?\s+(\d+)\s+miesi/);
            return {
                relativeMonths: parseInt(match[2]),
                confidence: 'relative_detected'
            };
        }
        
        if (query.match(/zesz[łl]y\s+miesi[aą]c/)) {
            return { relativeMonths: 1, confidence: 'relative_detected' };
        }
        
        return null;
    },
    
    _getSynonymHints(userQuery) {
        if (typeof BudgetAISynonyms === 'undefined') {
            return null;
        }
        
        const resolved = BudgetAISynonyms.resolve(userQuery);
        
        // Zwracamy jako HINTY, nie jako decyzje
        if (resolved.subcategories.length > 0 || resolved.categories.length > 0) {
            return {
                possibleSubcategories: resolved.subcategories.map(s => ({
                    term: s.originalTerm,
                    suggestion: s.officialName,
                    category: s.category,
                    confidence: 'js_synonym_match'
                })),
                possibleCategories: resolved.categories.map(c => ({
                    term: c.originalTerm,
                    suggestion: c.officialName,
                    confidence: 'js_synonym_match'
                })),
                detectedIntents: resolved.intents
            };
        }
        
        return null;
    },
    
    _looksLikeGeneralQuestion(query) {
        const generalPatterns = [
            /jak\s+(wygl[aą]daj[aą]|zmienia[łl]y\s+si[eę])\s+moje\s+(wydatki|finanse|dochody)/i,
            /og[oó]ln[ey]\s+(sytuacj|trend|podsumowan)/i,
            /podsumuj\s+moje\s+finanse/i,
            /czy\s+s[aą]\s+jakie[sś]\s+niepokojące/i
        ];
        
        return generalPatterns.some(p => p.test(query));
    },
    
    _detectMultipleTopics(query) {
        // Wykryj "X oraz Y", "X i Y", "X, Y"
        const multiPatterns = [
            /(\w+)\s+(oraz|i|,)\s+(\w+)/i,
            /zar[oó]wno\s+(\w+)\s+jak\s+i\s+(\w+)/i
        ];
        
        for (const pattern of multiPatterns) {
            const match = query.match(pattern);
            if (match) {
                return {
                    detected: true,
                    terms: [match[1], match[3] || match[2]].filter(Boolean)
                };
            }
        }
        
        return { detected: false };
    },
    
    // ═══════════════════════════════════════════════════════════
    // KROK 2: LLM7 - GŁÓWNY DECYDENT
    // ═══════════════════════════════════════════════════════════
    
    async _askLLM7ToDecide(userQuery, cache, hints) {
        const systemPrompt = this._buildLLM7Prompt(cache, hints);
        
        const result = await AIProviders.callRouter(systemPrompt, userQuery);
        
        if (!result.success) {
            return { success: false, error: result.error };
        }
        
        try {
            let jsonContent = result.content.trim();
            
            // Wyciągnij JSON
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
            parsed.source = 'llm7';
            
            return { success: true, routing: parsed };
            
        } catch (error) {
            return { success: false, error: `JSON parse error: ${error.message}` };
        }
    },
    
    _buildLLM7Prompt(cache, hints) {
        const functions = BudgetAICompute.getFunctionList();
        const periods = cache.availablePeriods || [];
        
        // ─────────────────────────────────────────────────────────
        // SEKCJA A: Rola i zadanie LLM7
        // ─────────────────────────────────────────────────────────
        let prompt = `Jesteś GŁÓWNYM INTERPRETATOREM zapytań budżetowych. 

TWOJE ZADANIE:
1. Przeczytaj zapytanie użytkownika
2. Zinterpretuj CO użytkownik chce wiedzieć (użyj swojej wiedzy o języku i kontekście!)
3. Dopasuj do odpowiedniej kategorii/podkategorii z taksonomii
4. Wybierz właściwą funkcję obliczeniową
5. Zwróć plan routingu jako JSON

WAŻNE: Ty DECYDUJESZ o interpretacji. Dane pomocnicze od JS to tylko HINTY - możesz je zignorować jeśli Twoja interpretacja jest lepsza.

`;

        // ─────────────────────────────────────────────────────────
        // SEKCJA B: Pełna taksonomia (do interpretacji)
        // ─────────────────────────────────────────────────────────
        prompt += `
═══════════════════════════════════════════════════════════════════════
TAKSONOMIA KATEGORII I PODKATEGORII
═══════════════════════════════════════════════════════════════════════

STRUKTURA: KATEGORIA (główna) → PODKATEGORIA (szczegółowa)
W params.category używaj nazwy KATEGORII, w params.subcategory nazwy PODKATEGORII!

`;
        
        for (const category of this.VALID_CATEGORIES) {
            const subs = this.VALID_SUBCATEGORIES[category] || [];
            prompt += `📁 KATEGORIA: "${category}"\n`;
            if (subs.length > 0) {
                subs.forEach(sub => {
                    prompt += `   └─ PODKATEGORIA: "${sub}"\n`;
                });
            } else {
                prompt += `   └─ (brak podkategorii)\n`;
            }
            prompt += '\n';
        }

        // ─────────────────────────────────────────────────────────
        // SEKCJA C: Dostępne funkcje obliczeniowe
        // ─────────────────────────────────────────────────────────
        prompt += `
═══════════════════════════════════════════════════════════════════════
DOSTĘPNE FUNKCJE OBLICZENIOWE
═══════════════════════════════════════════════════════════════════════

`;
        
        for (const [name, info] of Object.entries(functions)) {
            prompt += `• ${name}: ${info.description}\n`;
            prompt += `  Parametry: ${JSON.stringify(info.params)}\n\n`;
        }

        // ─────────────────────────────────────────────────────────
        // SEKCJA D: Dostępne okresy
        // ─────────────────────────────────────────────────────────
        prompt += `
═══════════════════════════════════════════════════════════════════════
DOSTĘPNE OKRESY CZASOWE
═══════════════════════════════════════════════════════════════════════

Dane od: ${periods.length > 0 ? periods[periods.length - 1].label : 'brak'}
Dane do: ${periods.length > 0 ? periods[0].label : 'brak'}
Liczba miesięcy: ${periods.length}

`;

        // ─────────────────────────────────────────────────────────
        // SEKCJA E: HINTS od JS (pomocnicze!)
        // ─────────────────────────────────────────────────────────
        prompt += `
═══════════════════════════════════════════════════════════════════════
DANE POMOCNICZE OD JS (HINTS) - możesz użyć lub zignorować
═══════════════════════════════════════════════════════════════════════

`;
        
        if (hints.keywords && hints.keywords.length > 0) {
            prompt += `Wykryte słowa kluczowe: ${hints.keywords.join(', ')}\n`;
        }
        
        if (hints.shapeHint) {
            prompt += `Sugerowany typ pytania: ${hints.shapeHint} (z regex patterns)\n`;
        }
        
        if (hints.periodHint) {
            prompt += `Wykryty okres: ${JSON.stringify(hints.periodHint)}\n`;
        }
        
        if (hints.synonymHints) {
            prompt += `\nSugestie synonimów od JS:\n`;
            if (hints.synonymHints.possibleSubcategories?.length > 0) {
                hints.synonymHints.possibleSubcategories.forEach(s => {
                    prompt += `  • "${s.term}" → może być: "${s.suggestion}" (${s.category})\n`;
                });
            }
            if (hints.synonymHints.possibleCategories?.length > 0) {
                hints.synonymHints.possibleCategories.forEach(c => {
                    prompt += `  • "${c.term}" → może być: "${c.suggestion}"\n`;
                });
            }
        }
        
        if (hints.looksGeneral) {
            prompt += `\n⚠️ JS uważa, że to może być OGÓLNE pytanie o finanse (bez konkretnej kategorii)\n`;
        }
        
        if (hints.multipleTopicsDetected?.detected) {
            prompt += `\n⚠️ JS wykrył WIELE tematów: ${hints.multipleTopicsDetected.terms?.join(', ')}\n`;
            prompt += `   Rozważ dodanie osobnych operacji dla każdego tematu.\n`;
        }

        // ─────────────────────────────────────────────────────────
        // SEKCJA F: Instrukcje interpretacji
        // ─────────────────────────────────────────────────────────
        prompt += `

═══════════════════════════════════════════════════════════════════════
INSTRUKCJE INTERPRETACJI (TY DECYDUJESZ!)
═══════════════════════════════════════════════════════════════════════

1. INTERPRETUJ SEMANTYCZNIE:
   • "york", "labrador", "mruczek" → to zwierzęta → podkategoria "Zwierzęta"
   • "jazda autem", "tankowanie", "paliwo" → koszty auta → podkategoria "Paliwo"
   • "lekarz", "apteka", "tabletki" → zdrowie → podkategoria "Zdrowie i uroda"
   
2. PYTANIA OGÓLNE (bez konkretnej kategorii):
   • "Jak zmieniały się moje wydatki?" → canonical_category: null
   • "Podsumuj moje finanse" → canonical_category: null
   • Użyj: getSummary lub trendAnalysis bez filtra kategorii

3. WIELE KATEGORII w jednym pytaniu:
   • "zdrowie oraz żywność" → dodaj OSOBNE operacje dla każdej!
   • operations: [{dla zdrowia}, {dla żywności}]

4. TYPY PYTAŃ → FUNKCJE:
   • "ile wydałem" (SUM) → sumByCategory/sumBySubcategory
   • "w którym miesiącu najwięcej" (MAX_IN_TIME) → monthlyBreakdown
   • "top wydatki" (RANKING) → topExpenses
   • "jak się zmieniają" (TREND) → monthlyBreakdown lub trendAnalysis
   • "porównaj" (COMPARISON) → compareMonths

5. JEŚLI NIE JESTEŚ PEWIEN kategorii:
   • Lepiej użyć szerszej kategorii niż błędnej podkategorii
   • Możesz użyć route: "clarify" i poprosić o doprecyzowanie

═══════════════════════════════════════════════════════════════════════
FORMAT ODPOWIEDZI (TYLKO JSON!)
═══════════════════════════════════════════════════════════════════════

WAŻNE O CATEGORY vs SUBCATEGORY:
• "category" = główna kategoria (np. "Osobiste", "Codzienne wydatki", "Auto i transport")
• "subcategory" = podkategoria (np. "Zdrowie i uroda", "Żywność i chemia domowa", "Paliwo")

Przykłady poprawnego mapowania:
• Zdrowie → category: "Osobiste", subcategory: "Zdrowie i uroda"
• Żywność → category: "Codzienne wydatki", subcategory: "Żywność i chemia domowa"
• Paliwo → category: "Auto i transport", subcategory: "Paliwo"
• Zwierzęta → category: "Codzienne wydatki", subcategory: "Zwierzęta"

{
  "intent_summary": "Krótki opis co użytkownik chce wiedzieć",
  "interpretation_notes": "Twoje rozumowanie przy interpretacji (opcjonalne)",
  "question_shape": "RANKING|MAX_IN_TIME|MIN_IN_TIME|SUM|TREND|COMPARISON|BREAKDOWN|ANALYSIS|GENERAL",
  "route": "compute_sum|compute_top|compute_trend|compute_compare|compute_503020|compute_anomalies|compute_summary|clarify|general",
  "operations": [
    {
      "function": "nazwa_funkcji",
      "params": {
        "category": "GŁÓWNA kategoria (np. 'Osobiste') lub null",
        "subcategory": "PODKATEGORIA (np. 'Zdrowie i uroda') lub null",
        "periodFrom": "YYYY-MM lub null",
        "periodTo": "YYYY-MM lub null"
      },
      "description": "co ta operacja ma policzyć"
    }
  ],
  "canonical_category": "główna kategoria lub null dla ogólnych pytań",
  "canonical_subcategory": "główna podkategoria lub null",
  "period_from": "YYYY-MM lub null",
  "period_to": "YYYY-MM lub null",
  "confidence": 0.0-1.0,
  "used_js_hints": true/false
}

Odpowiedz TYLKO poprawnym JSON. Nie dodawaj tekstu przed ani po JSON.`;

        return prompt;
    },
    
    // ═══════════════════════════════════════════════════════════
    // KROK 3: TECHNICZNA WALIDACJA (nie kwestionuje interpretacji!)
    // ═══════════════════════════════════════════════════════════
    
    _technicalValidation(routing) {
        const errors = [];
        
        // 1. Sprawdź wymagane pola
        if (!routing.intent_summary) {
            errors.push('Brak intent_summary');
        }
        
        // 2. Sprawdź czy route jest na liście
        if (!routing.route || !this.VALID_ROUTES.includes(routing.route)) {
            // Próba naprawy przez mapowanie
            const fixedRoute = this._tryFixRoute(routing.route, routing.operations, routing.question_shape);
            if (fixedRoute) {
                routing.route = fixedRoute;
                console.log(`BudgetAIRouter: Auto-fixed route to "${fixedRoute}"`);
            } else {
                errors.push(`Nieprawidłowy route: "${routing.route}"`);
            }
        }
        
        // 3. Sprawdź czy kategoria istnieje (jeśli podana)
        if (routing.canonical_category && !this.VALID_CATEGORIES.includes(routing.canonical_category)) {
            // Może LLM7 podał podkategorię jako kategorię?
            const found = this._findCategoryForSubcategory(routing.canonical_category);
            if (found) {
                routing.canonical_subcategory = routing.canonical_category;
                routing.canonical_category = found;
                console.log(`BudgetAIRouter: Auto-fixed category: "${routing.canonical_subcategory}" belongs to "${found}"`);
            } else {
                errors.push(`Nieznana kategoria: "${routing.canonical_category}"`);
            }
        }
        
        // 4. Sprawdź czy podkategoria istnieje i pasuje do kategorii
        if (routing.canonical_subcategory && routing.canonical_category) {
            const validSubs = this.VALID_SUBCATEGORIES[routing.canonical_category] || [];
            if (!validSubs.includes(routing.canonical_subcategory)) {
                // Może podkategoria istnieje w innej kategorii?
                const correctCat = this._findCategoryForSubcategory(routing.canonical_subcategory);
                if (correctCat) {
                    routing.canonical_category = correctCat;
                    console.log(`BudgetAIRouter: Auto-fixed: "${routing.canonical_subcategory}" moved to "${correctCat}"`);
                } else {
                    errors.push(`Podkategoria "${routing.canonical_subcategory}" nie istnieje w "${routing.canonical_category}"`);
                }
            }
        }
        
        // 5. Sprawdź operacje
        if (routing.operations && Array.isArray(routing.operations)) {
            const validFunctions = Object.keys(BudgetAICompute.AVAILABLE_FUNCTIONS);
            
            routing.operations = routing.operations.filter(op => {
                if (!op.function) {
                    errors.push('Operacja bez nazwy funkcji');
                    return false;
                }
                if (!validFunctions.includes(op.function)) {
                    errors.push(`Nieznana funkcja: "${op.function}"`);
                    return false;
                }
                return true;
            });
            
            // Napraw kategorie w params operacji
            routing.operations.forEach(op => {
                if (op.params) {
                    // KLUCZOWA NAPRAWA: Sprawdź czy params.category to tak naprawdę PODKATEGORIA
                    if (op.params.category && !this.VALID_CATEGORIES.includes(op.params.category)) {
                        // Może LLM7 wpisał podkategorię do category?
                        const correctCategory = this._findCategoryForSubcategory(op.params.category);
                        if (correctCategory) {
                            console.log(`BudgetAIRouter: Auto-fixed operation params: "${op.params.category}" is subcategory of "${correctCategory}"`);
                            op.params.subcategory = op.params.category;
                            op.params.category = correctCategory;
                        }
                    }
                    
                    // Jeśli mamy subcategory ale nie mamy category, znajdź kategorię
                    if (op.params.subcategory && !op.params.category) {
                        const correctCategory = this._findCategoryForSubcategory(op.params.subcategory);
                        if (correctCategory) {
                            op.params.category = correctCategory;
                            console.log(`BudgetAIRouter: Auto-added category "${correctCategory}" for subcategory "${op.params.subcategory}"`);
                        }
                    }
                    
                    // Propaguj canonical do params jeśli brak
                    if (!op.params.category && routing.canonical_category) {
                        op.params.category = routing.canonical_category;
                    }
                    if (!op.params.subcategory && routing.canonical_subcategory) {
                        op.params.subcategory = routing.canonical_subcategory;
                    }
                }
            });
        }
        
        // 6. Sprawdź question_shape
        if (routing.question_shape && !this.VALID_SHAPES.includes(routing.question_shape)) {
            routing.question_shape = 'GENERAL';
        }
        
        return {
            valid: errors.length === 0,
            errors: errors,
            routing: routing
        };
    },
    
    _tryFixRoute(originalRoute, operations, questionShape) {
        // Mapowanie częstych błędów
        const routeMapping = {
            'trendAnalysis': 'compute_trend',
            'trend_analysis': 'compute_trend',
            'trend': 'compute_trend',
            'sumByCategory': 'compute_sum',
            'sumBySubcategory': 'compute_sum',
            'sum': 'compute_sum',
            'topExpenses': 'compute_top',
            'ranking': 'compute_top',
            'monthlyBreakdown': 'compute_trend',
            'breakdown': 'compute_trend',
            'compareMonths': 'compute_compare',
            'compare': 'compute_compare',
            'getSummary': 'compute_summary',
            'summary': 'compute_summary',
            'analyze503020': 'compute_503020',
            'getAnomalies': 'compute_anomalies'
        };
        
        if (originalRoute && routeMapping[originalRoute]) {
            return routeMapping[originalRoute];
        }
        
        // Wnioskuj z operations
        if (operations && operations.length > 0) {
            const firstFunc = operations[0].function;
            if (routeMapping[firstFunc]) {
                return routeMapping[firstFunc];
            }
        }
        
        // Wnioskuj z question_shape
        const shapeToRoute = {
            'RANKING': 'compute_top',
            'MAX_IN_TIME': 'compute_trend',
            'MIN_IN_TIME': 'compute_trend',
            'SUM': 'compute_sum',
            'TREND': 'compute_trend',
            'COMPARISON': 'compute_compare',
            'BREAKDOWN': 'compute_trend',
            'ANALYSIS': 'compute_summary',
            'GENERAL': 'general'
        };
        
        if (questionShape && shapeToRoute[questionShape]) {
            return shapeToRoute[questionShape];
        }
        
        return null;
    },
    
    _findCategoryForSubcategory(subcategory) {
        for (const [cat, subs] of Object.entries(this.VALID_SUBCATEGORIES)) {
            if (subs.includes(subcategory)) {
                return cat;
            }
        }
        return null;
    },
    
    // ═══════════════════════════════════════════════════════════
    // KROK 4: NAPRAWA PLANU (drugi obieg LLM7)
    // ═══════════════════════════════════════════════════════════
    
    async _repairPlan(userQuery, originalRouting, errors, cache, hints) {
        console.log('BudgetAIRouter: Attempting plan repair...');
        
        const repairPrompt = `Jesteś routerem naprawczym. Poprzedni plan miał BŁĘDY TECHNICZNE i musisz go naprawić.

ORYGINALNE ZAPYTANIE UŻYTKOWNIKA:
"${userQuery}"

POPRZEDNI PLAN (z błędami):
${JSON.stringify(originalRouting, null, 2)}

WYKRYTE BŁĘDY:
${errors.map(e => `• ${e}`).join('\n')}

DOZWOLONE WARTOŚCI:
• route: ${this.VALID_ROUTES.join(', ')}
• question_shape: ${this.VALID_SHAPES.join(', ')}
• kategorie: ${this.VALID_CATEGORIES.join(', ')}
• funkcje: ${Object.keys(BudgetAICompute.AVAILABLE_FUNCTIONS).join(', ')}

NAPRAW PLAN - zachowaj interpretację ale użyj prawidłowych nazw.
Zwróć TYLKO poprawny JSON.`;

        try {
            const result = await AIProviders.callRouter(repairPrompt, 'Napraw powyższy plan routingu.');
            
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
            const validation = this._technicalValidation(parsed);
            
            if (validation.valid) {
                validation.routing.source = 'llm7_repaired';
                return validation.routing;
            }
            
            console.warn('BudgetAIRouter: Repair still has errors:', validation.errors);
            return null;
            
        } catch (error) {
            console.warn('BudgetAIRouter: Repair parsing failed:', error);
            return null;
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // KROK 5: FALLBACK (ostateczność)
    // ═══════════════════════════════════════════════════════════
    
    _fallbackRouting(userQuery, cache, hints) {
        const query = userQuery.toLowerCase();
        
        let route = 'general';
        let operations = [];
        let intentSummary = 'Ogólne pytanie o finanse';
        let category = null;
        let subcategory = null;
        let questionShape = hints.shapeHint || 'GENERAL';
        
        // Użyj hints do podstawowego routingu
        if (hints.synonymHints?.possibleSubcategories?.length > 0) {
            const first = hints.synonymHints.possibleSubcategories[0];
            category = first.category;
            subcategory = first.suggestion;
        }
        
        // Okres
        let periodFrom = null;
        let periodTo = null;
        if (hints.periodHint) {
            periodFrom = hints.periodHint.from;
            periodTo = hints.periodHint.to;
        }
        
        // Routing na podstawie shape
        switch (questionShape) {
            case 'MAX_IN_TIME':
            case 'MIN_IN_TIME':
                route = 'compute_trend';
                intentSummary = `Szukam miesiąca z ${questionShape === 'MAX_IN_TIME' ? 'najwyższymi' : 'najniższymi'} wydatkami`;
                operations.push({
                    function: 'monthlyBreakdown',
                    params: { category, subcategory, periodFrom, periodTo }
                });
                break;
                
            case 'RANKING':
                route = 'compute_top';
                intentSummary = 'Top wydatki';
                operations.push({
                    function: 'topExpenses',
                    params: { n: 10, level: 'category', periodFrom, periodTo }
                });
                break;
                
            case 'SUM':
                route = 'compute_sum';
                intentSummary = `Suma wydatków${subcategory ? ` dla "${subcategory}"` : ''}`;
                operations.push({
                    function: 'sumByCategory',
                    params: { category, subcategory, periodFrom, periodTo }
                });
                break;
                
            case 'TREND':
            case 'ANALYSIS':
                if (hints.looksGeneral || !category) {
                    route = 'compute_summary';
                    intentSummary = 'Analiza trendów finansowych';
                    operations.push({ function: 'getSummary', params: {} });
                    operations.push({ function: 'trendAnalysis', params: { metric: 'expenses', months: 6 } });
                } else {
                    route = 'compute_trend';
                    intentSummary = `Trend wydatków${subcategory ? ` dla "${subcategory}"` : ''}`;
                    operations.push({
                        function: 'monthlyBreakdown',
                        params: { category, subcategory, periodFrom, periodTo }
                    });
                }
                break;
                
            default:
                if (query.match(/50.?30.?20/)) {
                    route = 'compute_503020';
                    intentSummary = 'Analiza 50/30/20';
                    operations.push({ function: 'analyze503020', params: {} });
                } else if (query.match(/podsumowanie|podsumuj/)) {
                    route = 'compute_summary';
                    intentSummary = 'Podsumowanie finansów';
                    operations.push({ function: 'getSummary', params: {} });
                } else if (category) {
                    route = 'compute_sum';
                    intentSummary = `Analiza wydatków dla "${category}"`;
                    operations.push({
                        function: 'sumByCategory',
                        params: { category, subcategory, periodFrom, periodTo }
                    });
                } else {
                    route = 'compute_summary';
                    intentSummary = 'Podsumowanie finansów';
                    operations.push({ function: 'getSummary', params: {} });
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
            confidence: 0.5,
            source: 'fallback'
        };
    },
    
    // ═══════════════════════════════════════════════════════════
    // BUDOWANIE KAPSULY FAKTÓW
    // ═══════════════════════════════════════════════════════════
    
    buildFactsCapsule(routing, computeResults, cache, userQuery = null) {
        const capsule = {
            original_query: userQuery,
            query_intent: routing.intent_summary,
            interpretation_notes: routing.interpretation_notes || null,
            question_shape: routing.question_shape || 'GENERAL',
            route: routing.route,
            timestamp: new Date().toISOString(),
            results: {},
            derived: {},
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
                
                if (operation === 'monthlyBreakdown' && result.data?.breakdown) {
                    const derivedData = this._calculateDerivedMetrics(result.data, routing.question_shape);
                    Object.assign(capsule.derived, derivedData);
                }
            } else {
                capsule.results[`${operation}_error_${index}`] = { error: result.error };
            }
        });
        
        // Kontekst
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
        
        if (cache.trends) {
            capsule.context.overallTrends = {
                expenses: cache.trends.expenses?.direction || 'unknown',
                income: cache.trends.income?.direction || 'unknown',
                balance: cache.trends.balance?.direction || 'unknown'
            };
        }
        
        return capsule;
    },
    
    _calculateDerivedMetrics(breakdownResult, questionShape) {
        const derived = {};
        const breakdown = breakdownResult.breakdown || [];
        
        if (breakdown.length === 0) {
            derived.hasData = false;
            derived.message = 'Brak danych dla wybranej kategorii/podkategorii';
            return derived;
        }
        
        derived.hasData = true;
        
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
- Bilans = dochody - wydatki
- Wykonanie planu = savingsRate (stosunek oszczędności do dochodów)

WAŻNE DLA PYTAŃ O MAKSIMUM/MINIMUM W CZASIE:
- Jeśli w derived.answer jest gotowa odpowiedź, UŻYJ JEJ
- Jeśli question_shape to MAX_IN_TIME, odpowiedz o miesiącu z najwyższą wartością
- Jeśli question_shape to MIN_IN_TIME, odpowiedz o miesiącu z najniższą wartością

WAŻNE DLA PYTAŃ O OGÓLNE TRENDY:
- Jeśli queriedCategory jest null, to pytanie o OGÓLNE finanse
- Opisz trendy dla CAŁYCH wydatków i dochodów
- NIE wymyślaj kategorii

WAŻNE DLA BRAKU DANYCH:
- Jeśli hasData: false, poinformuj że brak danych
- NIE pokazuj danych z innych kategorii

FORMAT:
- Zacznij od bezpośredniej odpowiedzi
- Podaj kluczowe liczby
- Dodaj kontekst

Odpowiadaj po polsku w naturalnym, przyjaznym tonie.`;
    }
};
