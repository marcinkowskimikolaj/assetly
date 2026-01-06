/**
 * Assetly - Budget AI Router
 * Router zapytań z LLM7 + walidacja + fallback + mechanizm naprawczy (Second Pass)
 */

const BudgetAIRouter = {
    
    // Stan ostatniego routingu
    _lastRouting: null,

    // ═══════════════════════════════════════════════════════════
    // ZAMKNIĘTA TAKSONOMIA (HARD CONTRACT)
    // ═══════════════════════════════════════════════════════════
    TAXONOMY: {
        "Auto i transport": ["Auto i transport - inne", "Paliwo", "Parking i opłaty", "Przejazdy", "Serwis i części", "Ubezpieczenie auta"],
        "Codzienne wydatki": ["Alkohol", "Codzienne wydatki - inne", "Jedzenie poza domem", "Papierosy", "Zwierzęta", "Żywność i chemia domowa"],
        "Dom": ["Akcesoria i wyposażenie", "Dom - inne", "Remont i ogród", "Ubezpieczenie domu", "Usługi domowe"],
        "Dzieci": ["Art. dziecięce i zabawki", "Dzieci - inne", "Przedszkole i opiekunka", "Szkoła i wyprawka", "Zajęcia dodatkowe"],
        "Firmowe": ["Firmowe - inne", "Przelew na rach. firmowy", "Zakupy firmowe"],
        "Nieistotne": [],
        "Nieskategoryzowane": [],
        "Osobiste": ["Edukacja", "Elektronika", "Multimedia, książki i prasa", "Odzież i obuwie", "Osobiste - inne", "Prezenty i wsparcie", "Zdrowie i uroda"],
        "Oszczędności i inw.": ["Fundusze", "Giełda", "Lokaty i konto oszcz.", "Oszczędności i inw. - inne", "Regularne oszczędzanie"],
        "Płatności": ["Czynsz i wynajem", "Gaz", "Ogrzewanie", "Opłaty i odsetki", "Płatności - inne", "Podatki", "Prąd", "Spłaty rat", "TV, internet, telefon", "Ubezpieczenia", "Woda i kanalizacja"],
        "Rozrywka": ["Podróże i wyjazdy", "Rozrywka - inne", "Sport i hobby", "Wyjścia i wydarzenia"]
    },
    
    // ═══════════════════════════════════════════════════════════
    // SCHEMA ODPOWIEDZI ROUTERA
    // ═══════════════════════════════════════════════════════════
    
    ROUTER_SCHEMA: {
        intent_summary: 'string', 
        question_shape: ['time_peak', 'ranking', 'sum', 'compare_mm', 'trend', 'analyze_503020', 'advice_savings', 'general', 'clarify'],
        confidence: 'number', // 0.0 - 1.0
        route: ['compute_sum', 'compute_top', 'compute_trend', 'compute_compare', 
                'compute_503020', 'compute_anomalies', 'compute_summary', 
                'clarify', 'general'],
        operations: 'array',
        canonical_category: 'string|null',
        canonical_subcategory: 'string|null',
        period_from: 'string|null',
        period_to: 'string|null'
    },
    
    // ═══════════════════════════════════════════════════════════
    // GŁÓWNA METODA ROUTINGU
    // ═══════════════════════════════════════════════════════════
    
    async classifyIntent(userQuery, cache = null) {
        this._lastRouting = null;
        if (!cache) cache = await BudgetAICache.getCache();
        
        // 1. Próba z LLM7 (Pass #1)
        let result = await this._classifyWithLLM7(userQuery, cache, false);
        
        // Jeśli LLM7 zawiódł technicznie (np. błąd sieci), fallback
        if (!result.success && !result.isLogicError) {
            console.warn('BudgetAIRouter: LLM7 technical fail, fallback to deterministic.');
            return this._fallbackRouting(userQuery, cache);
        }

        // 2. Walidacja logiczna i ewentualny Repair (Pass #2)
        if (result.success) {
            const validation = this._validateLogic(userQuery, result.routing);
            
            if (!validation.valid) {
                console.warn(`BudgetAIRouter: Logic validation failed (${validation.reason}). Attempting Second Pass (Repair)...`);
                
                // Pass #2: Repair
                const repairResult = await this._classifyWithLLM7(userQuery, cache, true, {
                    originalPlan: result.routing,
                    issue: validation.reason
                });

                if (repairResult.success) {
                    // Waliduj ponownie naprawiony plan
                    const revalidation = this._validateLogic(userQuery, repairResult.routing);
                    if (revalidation.valid) {
                        console.log('BudgetAIRouter: Plan repaired successfully.');
                        return repairResult.routing;
                    }
                }
                
                console.warn('BudgetAIRouter: Repair failed or invalid. Fallback to deterministic.');
                return this._fallbackRouting(userQuery, cache);
            }
            
            return result.routing;
        }

        return this._fallbackRouting(userQuery, cache);
    },
    
    // ═══════════════════════════════════════════════════════════
    // LLM7 CLASSIFICATION (PASS #1 & #2)
    // ═══════════════════════════════════════════════════════════

    async _classifyWithLLM7(userQuery, cache, isRepair = false, repairContext = null) {
        let resolvedSynonyms = null;
        if (typeof BudgetAISynonyms !== 'undefined') {
            resolvedSynonyms = BudgetAISynonyms.resolve(userQuery);
        }
        
        const systemPrompt = this._buildRouterSystemPrompt(cache, resolvedSynonyms, isRepair, repairContext);
        
        // Jeśli repair, dodajemy kontekst do userMessage
        let userMessage = userQuery;
        if (isRepair && repairContext) {
            userMessage = `ORYGINALNE PYTANIE: "${userQuery}"\n\nTwój poprzedni plan był błędny: ${repairContext.issue}.\nPopraw go zgodnie z instrukcjami systemowymi.`;
        }

        const result = await AIProviders.callRouter(systemPrompt, userMessage);
        
        if (!result.success) {
            return { success: false, error: result.error };
        }
        
        try {
            const jsonContent = this._extractJson(result.content);
            const parsed = JSON.parse(jsonContent);
            const validatedStructure = this._validateStructure(parsed, cache);
            
            if (!validatedStructure.valid) {
                return { success: false, error: validatedStructure.error, isLogicError: true };
            }
            
            return { success: true, routing: validatedStructure.routing };
            
        } catch (error) {
            return { success: false, error: `JSON Parse Error: ${error.message}`, isLogicError: true };
        }
    },

    _extractJson(content) {
        let json = content.trim();
        // Usuwanie markdown
        json = json.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
        // Znajdowanie klamer
        const first = json.indexOf('{');
        const last = json.lastIndexOf('}');
        if (first !== -1 && last !== -1) {
            json = json.substring(first, last + 1);
        }
        return json;
    },
    
    _buildRouterSystemPrompt(cache, resolvedSynonyms, isRepair, repairContext) {
        const functions = BudgetAICompute.getFunctionList();
        // Używamy naszej zamkniętej taksonomii zamiast cache
        const taxonomy = this.TAXONOMY;
        const periods = cache.availablePeriods || [];
        
        let prompt = `Jesteś architektem zapytań finansowych (Router AI). Twoim celem jest zwrócenie planu wykonania w formacie JSON.
        
ZASADY KRYTYCZNE:
1. TAXONOMIA JEST ZAMKNIĘTA. Nie wymyślaj kategorii. Używaj tylko tych z listy poniżej.
2. QUESTION_SHAPE: Musisz określić kształt pytania.
   - "time_peak": pytania "w którym miesiącu", "kiedy najwięcej". WYMAGA użycia 'monthlyBreakdown'. ZABRONIONE 'topExpenses'.
   - "ranking": pytania "na co najwięcej", "top wydatki". Użyj 'topExpenses'.
   - "sum": "ile wydałem", "suma". Użyj 'sumByCategory'.
   - "trend": "jak się zmienia", "rośnie czy maleje". Użyj 'trendAnalysis' lub 'monthlyBreakdown'.
3. WALIDACJA: Jeśli canonical_category nie jest na liście, ustaw null.

DOSTĘPNA TAKSONOMIA (Kategorie -> [Podkategorie]):
${JSON.stringify(taxonomy, null, 2)}

DOSTĘPNE FUNKCJE:
${JSON.stringify(functions.map(f => ({ name: f.name, params: f.params })))}

DOSTĘPNE OKRESY (dla period_from/to):
${periods.slice(0, 6).map(p => p.label).join(', ')}... (format YYYY-MM)

`;

        if (resolvedSynonyms) {
             prompt += `\nKONTEKST SYNONIMÓW (Mocna sugestia):\n`;
             if (resolvedSynonyms.subcategories.length > 0) {
                 prompt += `Wykryto podkategorie: ${JSON.stringify(resolvedSynonyms.subcategories.map(s => `${s.originalTerm} -> ${s.category}/${s.officialName}`))}\n`;
             }
             if (resolvedSynonyms.categories.length > 0) {
                 prompt += `Wykryto kategorie: ${JSON.stringify(resolvedSynonyms.categories.map(s => `${s.originalTerm} -> ${s.officialName}`))}\n`;
             }
             if (resolvedSynonyms.timeContext) {
                 prompt += `Wykryto czas: ${JSON.stringify(resolvedSynonyms.timeContext)}\n`;
             }
        }

        if (isRepair) {
            prompt += `\nTRYB NAPRAWCZY (REPAIR MODE):\nPoprzedni plan zawierał błędy logiczne. Przeanalizuj powód odrzucenia i popraw plan.\n`;
        }

        prompt += `\nFORMAT ODPOWIEDZI (JSON ONLY):
{
  "intent_summary": "string (PL)",
  "question_shape": "time_peak|ranking|sum|compare_mm|trend|analyze_503020|advice_savings|general|clarify",
  "confidence": 0.0-1.0,
  "route": "compute_sum|compute_top|compute_trend...",
  "operations": [ { "function": "name", "params": { ... } } ],
  "canonical_category": "Exact Category Name from Taxonomy or null",
  "canonical_subcategory": "Exact Subcategory Name from Taxonomy or null",
  "period_from": "YYYY-MM or null",
  "period_to": "YYYY-MM or null"
}`;

        return prompt;
    },
    
    // ═══════════════════════════════════════════════════════════
    // WALIDACJA STRUKTURALNA I LOGICZNA
    // ═══════════════════════════════════════════════════════════

    _validateStructure(response, cache) {
        // Podstawowe pola
        if (!response.question_shape || !response.intent_summary || !response.route) {
            return { valid: false, error: 'Missing required fields (question_shape, intent_summary, route)' };
        }

        // Walidacja taksonomii (Twarda)
        const taxonomy = this.TAXONOMY;
        const validCategories = Object.keys(taxonomy);

        // Naprawa literówek w kategoriach (fuzzy match w prostym wydaniu - exact match required by prompt, but let's be safe)
        if (response.canonical_category && !validCategories.includes(response.canonical_category)) {
            response.canonical_category = null; // Odrzucamy wymysły
        }

        // Naprawa podkategorii
        if (response.canonical_category && response.canonical_subcategory) {
            const validSubs = taxonomy[response.canonical_category] || [];
            if (!validSubs.includes(response.canonical_subcategory)) {
                // Może model zgadł kategorię źle, a podkategoria jest unikalna?
                // Sprawdźmy odwrotnie
                let foundCat = null;
                for (const [cat, subs] of Object.entries(taxonomy)) {
                    if (subs.includes(response.canonical_subcategory)) {
                        foundCat = cat;
                        break;
                    }
                }
                if (foundCat) {
                    response.canonical_category = foundCat; // Auto-fix
                } else {
                    response.canonical_subcategory = null; // Odrzucamy
                }
            }
        } else if (!response.canonical_category && response.canonical_subcategory) {
             // Samotna podkategoria - znajdź rodzica
             for (const [cat, subs] of Object.entries(taxonomy)) {
                if (subs.includes(response.canonical_subcategory)) {
                    response.canonical_category = cat;
                    break;
                }
            }
        }

        return { valid: true, routing: response };
    },

    _validateLogic(query, routing) {
        // Reguła 1: Time Peak vs Top Expenses
        // Pytanie: "W którym miesiącu..." -> question_shape: "time_peak"
        // BŁĄD: Użycie topExpenses (to zwróci kategorie, a nie miesiące)
        if (routing.question_shape === 'time_peak') {
            const hasMonthlyBreakdown = routing.operations.some(op => op.function === 'monthlyBreakdown' || op.function === 'trendAnalysis');
            if (!hasMonthlyBreakdown) {
                return { valid: false, reason: 'Question asks for time peak (which month), but plan implies ranking/sum without monthly breakdown.' };
            }
            if (routing.route === 'compute_top') {
                 return { valid: false, reason: 'Route mismatch: time_peak questions cannot use compute_top route.' };
            }
        }

        // Reguła 2: Confidence threshold
        if (routing.confidence < 0.6) {
             return { valid: false, reason: 'Confidence too low.' };
        }

        return { valid: true };
    },
    
    // ═══════════════════════════════════════════════════════════
    // FALLBACK ROUTING
    // ═══════════════════════════════════════════════════════════
    
    _fallbackRouting(userQuery, cache) {
        // Prosty regex-based routing (zoptymalizowany pod kątem bezpieczeństwa)
        const query = userQuery.toLowerCase();
        let resolvedSynonyms = null;
        if (typeof BudgetAISynonyms !== 'undefined') {
            resolvedSynonyms = BudgetAISynonyms.resolve(userQuery);
        }

        let category = null;
        let subcategory = null;

        if (resolvedSynonyms && resolvedSynonyms.subcategories.length > 0) {
            category = resolvedSynonyms.subcategories[0].category;
            subcategory = resolvedSynonyms.subcategories[0].officialName;
        } else if (resolvedSynonyms && resolvedSynonyms.categories.length > 0) {
             category = resolvedSynonyms.categories[0].officialName;
        }

        const periodMatch = BudgetAICompute.parsePeriod(userQuery);
        const periodFrom = periodMatch?.from || null;
        const periodTo = periodMatch?.to || null;

        let route = 'general';
        let shape = 'general';
        let operations = [];
        let summary = 'Analiza budżetu';

        // Detekcja intencji
        if (query.match(/miesiąc|kiedy|stycz|lut|marz|kwiec|maj|czerw|lip|sierp|wrzes|paźdz|listop|grudz/)) {
            // Time related
            if (query.match(/najwięcej|najmniej|dużo|mało/)) {
                shape = 'time_peak';
                route = 'compute_trend';
                operations.push({ function: 'monthlyBreakdown', params: { category, subcategory, periodFrom, periodTo } });
                summary = 'Analiza wydatków w czasie';
            } else {
                shape = 'trend';
                route = 'compute_trend';
                operations.push({ function: 'monthlyBreakdown', params: { category, subcategory, periodFrom, periodTo } });
                 summary = 'Trend wydatków';
            }
        } else if (query.match(/top|ranking|najwięcej|największe/)) {
            shape = 'ranking';
            route = 'compute_top';
            operations.push({ function: 'topExpenses', params: { n: 5, category, periodFrom, periodTo } }); // Added category filter
             summary = 'Ranking wydatków';
        } else if (query.match(/suma|ile|koszt|łącznie/)) {
             shape = 'sum';
             route = 'compute_sum';
             operations.push({ function: 'sumByCategory', params: { category, subcategory, periodFrom, periodTo } });
              summary = 'Podsumowanie wydatków';
        } else if (query.match(/porównaj|vs|różnica/)) {
             shape = 'compare_mm';
             route = 'compute_compare';
             // Domyślne porównanie ostatnich 2 msc
             const periods = cache.availablePeriods || [];
             if (periods.length >= 2) {
                 operations.push({ function: 'compareMonths', params: { period1: `${periods[1].rok}-${String(periods[1].miesiac).padStart(2,'0')}`, period2: `${periods[0].rok}-${String(periods[0].miesiac).padStart(2,'0')}` } });
             }
              summary = 'Porównanie okresów';
        }

        return {
            intent_summary: summary,
            question_shape: shape,
            confidence: 0.5, // Fallback always low confidence
            route: route,
            operations: operations,
            canonical_category: category,
            canonical_subcategory: subcategory,
            period_from: periodFrom,
            period_to: periodTo,
            source: 'fallback'
        };
    },
    
    // ═══════════════════════════════════════════════════════════
    // BUILD FACTS CAPSULE (Rozszerzona)
    // ═══════════════════════════════════════════════════════════
    
    buildFactsCapsule(userQuery, routing, computeResults, cache) {
        const capsule = {
            user_query: userQuery,
            query_intent: routing.intent_summary,
            question_shape: routing.question_shape,
            route: routing.route,
            timestamp: new Date().toISOString(),
            results: {},
            derived: {}, // Nowe pole na obliczenia deterministyczne
            context: {
                queriedCategory: routing.canonical_category,
                queriedSubcategory: routing.canonical_subcategory,
                period: { from: routing.period_from, to: routing.period_to }
            }
        };

        // Przetwarzanie wyników i generowanie derived stats
        computeResults.forEach((result, idx) => {
            const key = result.operation;
            if (result.success) {
                // Jeśli wynik to monthlyBreakdown, oblicz peak/trough/avg
                if (key === 'monthlyBreakdown' && Array.isArray(result.data.breakdown)) {
                    this._calculateTimeSeriesDerived(capsule, result.data.breakdown, idx);
                }
                
                // Normalizuj wyniki do results (support list of same ops)
                if (!capsule.results[key]) capsule.results[key] = [];
                capsule.results[key].push(result.data);
            } else {
                if (!capsule.results.errors) capsule.results.errors = [];
                capsule.results.errors.push({ operation: key, error: result.error });
            }
        });

        return capsule;
    },

    _calculateTimeSeriesDerived(capsule, breakdown, idx) {
        if (!breakdown || breakdown.length === 0) return;

        // Znajdź wartości (obsługa 'value' lub 'amount' lub 'expenses' w zależności od struktury)
        const items = breakdown.map(item => ({
            period: item.period,
            val: item.value ?? item.amount ?? item.expenses ?? 0
        }));

        if (items.length === 0) return;

        // Sort by value
        const sorted = [...items].sort((a, b) => b.val - a.val);
        const peak = sorted[0];
        const trough = sorted[sorted.length - 1];
        
        const total = items.reduce((sum, item) => sum + item.val, 0);
        const avg = total / items.length;

        capsule.derived[`time_series_${idx}`] = {
            peak_period: peak.period,
            peak_value: peak.val,
            trough_period: trough.period,
            trough_value: trough.val,
            average: avg,
            total: total,
            count: items.length
        };
    },

    getGeneratorSystemPrompt() {
        return `Jesteś analitykiem finansowym Assetly.
Twoim zadaniem jest odpowiedzieć na pytanie użytkownika WYŁĄCZNIE w oparciu o dostarczone dane w sekcji "Dane do analizy".

ZASADY BEZPIECZEŃSTWA:
1. Nie wymyślaj danych. Jeśli w danych jest "notFound" lub pusta lista, powiedz: "Nie znalazłem takich wydatków w Twoim budżecie".
2. Jeśli pytanie dotyczyło "kiedy najwięcej" (time_peak), użyj sekcji "derived" w danych, aby wskazać konkretny miesiąc i kwotę.
3. Kwoty formatuj jako "1 200 zł".
4. Bądź konkretny. Unikaj lania wody.
5. Jeśli wynik jest zerowy, upewnij się czy to dobrze (np. "Brak wydatków na X w tym okresie").

ODPOWIEDŹ:
Ma być w formacie tekstowym (Markdown), czytelna i krótka (max 3-4 zdania chyba że to złożona analiza).`;
    }
};
