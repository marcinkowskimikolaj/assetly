/**
 * Assetly - Budget AI Intent Router
 * Hybrydowy router: lokalny pattern matching + LLM klasyfikacja
 * Minimalizuje kontekst wysyłany do głównego AI
 */

const BudgetAIRouter = (function() {
    
    // ═══════════════════════════════════════════════════════════
    // DEFINICJE INTENCJI
    // ═══════════════════════════════════════════════════════════
    
    const INTENTS = {
        summary: {
            name: 'summary',
            description: 'Ogólne podsumowanie finansów',
            requiredData: ['SUMMARY', 'METHODOLOGY'],
            keywords: ['podsumowanie', 'podsumuj', 'ogólnie', 'całość', 'wszystko', 'overview', 'status', 'sytuacja finansowa']
        },
        top_categories: {
            name: 'top_categories',
            description: 'Ranking kategorii wydatków',
            requiredData: ['TOP_CATEGORIES'],
            keywords: ['top', 'ranking', 'najwięcej', 'kategorie', 'na co wydaję', 'gdzie idą pieniądze']
        },
        top_subcategories: {
            name: 'top_subcategories',
            description: 'Ranking podkategorii wydatków',
            requiredData: ['TOP_SUBCATEGORIES'],
            keywords: ['podkategorie', 'szczegółowo', 'dokładnie na co']
        },
        expense_by_category: {
            name: 'expense_by_category',
            description: 'Wydatki w konkretnej kategorii',
            requiredData: ['TOP_CATEGORIES', 'TOP_SUBCATEGORIES'],
            keywords: ['wydatki na', 'ile na', 'kategoria', 'w kategorii'],
            extractFilters: true
        },
        expense_by_subcategory: {
            name: 'expense_by_subcategory',
            description: 'Wydatki w konkretnej podkategorii',
            requiredData: ['TOP_SUBCATEGORIES', 'MONTHLY'],
            keywords: ['paliwo', 'jedzenie', 'czynsz', 'prąd', 'internet', 'telefon', 'ubrania', 'rozrywka', 'restauracje', 'zakupy'],
            extractFilters: true
        },
        expense_by_period: {
            name: 'expense_by_period',
            description: 'Wydatki w konkretnym okresie',
            requiredData: ['MONTHLY'],
            keywords: ['w styczniu', 'w lutym', 'w marcu', 'w kwietniu', 'w maju', 'w czerwcu', 
                       'w lipcu', 'w sierpniu', 'we wrześniu', 'w październiku', 'w listopadzie', 'w grudniu',
                       'ostatni miesiąc', 'poprzedni miesiąc', 'ten miesiąc'],
            extractFilters: true
        },
        income_analysis: {
            name: 'income_analysis',
            description: 'Analiza dochodów',
            requiredData: ['INCOME_BY_SOURCE', 'SALARY_HISTORY', 'SUMMARY'],
            keywords: ['dochody', 'przychody', 'zarobki', 'wpływy', 'źródła dochodu', 'skąd pieniądze']
        },
        salary_history: {
            name: 'salary_history',
            description: 'Historia wynagrodzeń i podwyżek',
            requiredData: ['SALARY_HISTORY'],
            keywords: ['wynagrodzenie', 'pensja', 'wypłata', 'podwyżka', 'podwyżki', 'historia zarobków', 'jak rosła pensja']
        },
        compare_periods: {
            name: 'compare_periods',
            description: 'Porównanie okresów',
            requiredData: ['MONTHLY'],
            keywords: ['porównaj', 'porównanie', 'vs', 'versus', 'a ', 'różnica między', 'lepszy miesiąc', 'gorszy miesiąc'],
            extractFilters: true
        },
        methodology_503020: {
            name: 'methodology_503020',
            description: 'Analiza metodyki 50/30/20',
            requiredData: ['METHODOLOGY', 'SUMMARY'],
            keywords: ['50/30/20', '50 30 20', 'metodyka', 'potrzeby', 'zachcianki', 'oszczędności', 'proporcje wydatków']
        },
        trend_analysis: {
            name: 'trend_analysis',
            description: 'Analiza trendów',
            requiredData: ['MONTHLY', 'TRENDS'],
            keywords: ['trend', 'trendy', 'jak się zmieniają', 'rosną', 'maleją', 'wzrost', 'spadek', 'dynamika']
        },
        savings_potential: {
            name: 'savings_potential',
            description: 'Potencjał oszczędności',
            requiredData: ['TOP_CATEGORIES', 'TOP_SUBCATEGORIES', 'METHODOLOGY'],
            keywords: ['oszczędzić', 'oszczędności', 'zaoszczędzić', 'ograniczyć', 'zmniejszyć wydatki', 'gdzie ciąć']
        }
    };
    
    // Mapowanie nazw miesięcy na numery
    const MONTH_NAMES = {
        'styczeń': '01', 'stycznia': '01', 'styczniu': '01',
        'luty': '02', 'lutego': '02', 'lutym': '02',
        'marzec': '03', 'marca': '03', 'marcu': '03',
        'kwiecień': '04', 'kwietnia': '04', 'kwietniu': '04',
        'maj': '05', 'maja': '05', 'maju': '05',
        'czerwiec': '06', 'czerwca': '06', 'czerwcu': '06',
        'lipiec': '07', 'lipca': '07', 'lipcu': '07',
        'sierpień': '08', 'sierpnia': '08', 'sierpniu': '08',
        'wrzesień': '09', 'września': '09', 'wrześniu': '09',
        'październik': '10', 'października': '10', 'październiku': '10',
        'listopad': '11', 'listopada': '11', 'listopadzie': '11',
        'grudzień': '12', 'grudnia': '12', 'grudniu': '12'
    };
    
    // Znane podkategorie do wyłapywania
    const KNOWN_SUBCATEGORIES = [
        'paliwo', 'benzyna', 'tankowanie',
        'żywność', 'jedzenie', 'spożywcze', 'zakupy spożywcze',
        'czynsz', 'wynajem', 'mieszkanie',
        'prąd', 'energia', 'elektryczność',
        'gaz', 'ogrzewanie',
        'internet', 'telefon', 'abonament',
        'ubrania', 'odzież', 'buty',
        'restauracje', 'jedzenie poza domem', 'fast food',
        'rozrywka', 'kino', 'koncerty', 'netflix', 'spotify',
        'leki', 'apteka', 'zdrowie',
        'transport', 'bilety', 'uber',
        'prezenty', 'upominki'
    ];
    
    // ═══════════════════════════════════════════════════════════
    // LOKALNY PATTERN MATCHING
    // ═══════════════════════════════════════════════════════════
    
    function localPatternMatch(question) {
        const q = question.toLowerCase().trim();
        let bestMatch = null;
        let bestScore = 0;
        let filters = {};
        
        // Sprawdź każdą intencję
        for (const [intentId, intent] of Object.entries(INTENTS)) {
            let score = 0;
            
            // Liczenie dopasowanych keywords
            for (const keyword of intent.keywords) {
                if (q.includes(keyword.toLowerCase())) {
                    // Dłuższe keywords = większa waga
                    score += keyword.length;
                }
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = intentId;
            }
        }
        
        // Ekstrakcja filtrów
        if (bestMatch) {
            filters = extractFilters(q);
        }
        
        // Oblicz pewność (0-100)
        const confidence = Math.min(100, bestScore * 10);
        
        return {
            intent: bestMatch || 'unknown',
            confidence: confidence,
            filters: filters,
            method: 'local'
        };
    }
    
    function extractFilters(question) {
        const filters = {};
        const q = question.toLowerCase();
        
        // Ekstrakcja miesięcy
        for (const [monthName, monthNum] of Object.entries(MONTH_NAMES)) {
            if (q.includes(monthName)) {
                // Spróbuj znaleźć rok
                const yearMatch = question.match(/20\d{2}/);
                const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
                filters.period = `${year}-${monthNum}`;
                break;
            }
        }
        
        // Ekstrakcja podkategorii
        for (const subcat of KNOWN_SUBCATEGORIES) {
            if (q.includes(subcat.toLowerCase())) {
                filters.subcategory = subcat;
                break;
            }
        }
        
        // Ekstrakcja kategorii (jeśli wymieniona wprost)
        const categoryPatterns = [
            /(?:kategori[aię]|w kategorii)\s+[„"']?([^„"']+)[„"']?/i,
            /(?:na|wydatki na)\s+([a-zA-ZąęółśżźćńĄĘÓŁŚŻŹĆŃ\s]+?)(?:\s+w|\s+za|\s*$)/i
        ];
        
        for (const pattern of categoryPatterns) {
            const match = question.match(pattern);
            if (match && match[1]) {
                const potentialCategory = match[1].trim();
                if (potentialCategory.length > 2 && potentialCategory.length < 30) {
                    filters.category = potentialCategory;
                    break;
                }
            }
        }
        
        return filters;
    }
    
    // ═══════════════════════════════════════════════════════════
    // LLM KLASYFIKACJA (FALLBACK)
    // ═══════════════════════════════════════════════════════════
    
    async function llmClassify(question, aiState) {
        // Sprawdź czy mamy dostęp do LLM7
        if (!aiState.keys.llm7) {
            console.warn('Brak klucza LLM7 dla klasyfikacji');
            return null;
        }
        
        const classificationPrompt = buildClassificationPrompt(question);
        
        try {
            const response = await fetch('https://api.llm7.io/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${aiState.keys.llm7}`
                },
                body: JSON.stringify({
                    model: 'gpt-4.1-nano',
                    messages: [
                        { role: 'system', content: classificationPrompt.system },
                        { role: 'user', content: classificationPrompt.user }
                    ],
                    temperature: 0.1,
                    max_tokens: 200
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const content = data.choices[0].message.content.trim();
            
            // Parsuj JSON z odpowiedzi
            const parsed = parseClassificationResponse(content);
            if (parsed) {
                parsed.method = 'llm';
                parsed.confidence = 90; // LLM ma wysoką pewność
                return parsed;
            }
            
        } catch (error) {
            console.error('Błąd klasyfikacji LLM:', error);
        }
        
        return null;
    }
    
    function buildClassificationPrompt(question) {
        const intentList = Object.entries(INTENTS)
            .map(([id, def]) => `- ${id}: ${def.description}`)
            .join('\n');
        
        return {
            system: `Jesteś klasyfikatorem zapytań finansowych. Twoim zadaniem jest określić intencję użytkownika.

DOZWOLONE INTENCJE:
${intentList}
- unknown: pytanie nie pasuje do powyższych

ZASADY:
1. Zwróć TYLKO czysty JSON, bez markdown, bez komentarzy
2. Jeśli pytanie dotyczy konkretnej kategorii/podkategorii/okresu, wypełnij "filters"
3. "required_data" to lista sekcji danych potrzebnych do odpowiedzi

FORMAT ODPOWIEDZI (TYLKO JSON):
{"intent": "nazwa_intencji", "filters": {"category": null, "subcategory": null, "period": null}, "required_data": ["SECTION1", "SECTION2"]}`,
            
            user: `Sklasyfikuj to pytanie: "${question}"`
        };
    }
    
    function parseClassificationResponse(content) {
        try {
            // Usuń ewentualne markdown backticki
            let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            // Znajdź JSON w odpowiedzi
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleaned = jsonMatch[0];
            }
            
            const parsed = JSON.parse(cleaned);
            
            // Walidacja
            if (!parsed.intent) {
                return null;
            }
            
            // Uzupełnij brakujące pola
            return {
                intent: parsed.intent,
                filters: parsed.filters || {},
                requiredData: parsed.required_data || INTENTS[parsed.intent]?.requiredData || ['SUMMARY']
            };
            
        } catch (e) {
            console.warn('Nie można sparsować odpowiedzi klasyfikatora:', content);
            return null;
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // GŁÓWNA FUNKCJA ROUTINGU
    // ═══════════════════════════════════════════════════════════
    
    async function routeQuestion(question, aiState) {
        console.log('🔀 Routing pytania:', question.substring(0, 50) + '...');
        
        // Krok 1: Lokalny pattern matching
        const localResult = localPatternMatch(question);
        console.log('📍 Lokalny wynik:', localResult);
        
        // Jeśli pewność >= 80%, użyj lokalnego wyniku
        if (localResult.confidence >= 80 && localResult.intent !== 'unknown') {
            console.log('✅ Używam lokalnego routingu (pewność:', localResult.confidence + '%)');
            return {
                intent: localResult.intent,
                filters: localResult.filters,
                requiredData: INTENTS[localResult.intent]?.requiredData || ['SUMMARY'],
                method: 'local',
                confidence: localResult.confidence
            };
        }
        
        // Krok 2: LLM klasyfikacja dla niepewnych przypadków
        console.log('🤖 Pewność niska (' + localResult.confidence + '%), próbuję LLM klasyfikację...');
        
        const llmResult = await llmClassify(question, aiState);
        
        if (llmResult) {
            console.log('✅ LLM klasyfikacja:', llmResult);
            return {
                intent: llmResult.intent,
                filters: { ...localResult.filters, ...llmResult.filters },
                requiredData: llmResult.requiredData || INTENTS[llmResult.intent]?.requiredData || ['SUMMARY'],
                method: 'llm',
                confidence: llmResult.confidence
            };
        }
        
        // Krok 3: Fallback - użyj lokalnego wyniku nawet jeśli niepewny
        console.log('⚠️ LLM niedostępny, używam lokalnego z fallback data');
        return {
            intent: localResult.intent !== 'unknown' ? localResult.intent : 'summary',
            filters: localResult.filters,
            requiredData: ['SUMMARY', 'TOP_CATEGORIES', 'MONTHLY'],
            method: 'fallback',
            confidence: localResult.confidence
        };
    }
    
    // ═══════════════════════════════════════════════════════════
    // QUICK PROMPT ROUTING (BEZ LLM)
    // ═══════════════════════════════════════════════════════════
    
    function routeQuickPrompt(promptId) {
        const quickPromptMapping = {
            'summary': {
                intent: 'summary',
                requiredData: ['SUMMARY', 'METHODOLOGY', 'TRENDS'],
                filters: {}
            },
            'top-expenses': {
                intent: 'top_subcategories',
                requiredData: ['TOP_CATEGORIES', 'TOP_SUBCATEGORIES'],
                filters: {}
            },
            'savings-potential': {
                intent: 'savings_potential',
                requiredData: ['TOP_CATEGORIES', 'TOP_SUBCATEGORIES', 'METHODOLOGY'],
                filters: {}
            },
            'trends': {
                intent: 'trend_analysis',
                requiredData: ['MONTHLY', 'TRENDS'],
                filters: {}
            },
            'income-analysis': {
                intent: 'income_analysis',
                requiredData: ['INCOME_BY_SOURCE', 'SALARY_HISTORY', 'SUMMARY'],
                filters: {}
            },
            '503020': {
                intent: 'methodology_503020',
                requiredData: ['METHODOLOGY', 'SUMMARY'],
                filters: {}
            },
            'monthly-compare': {
                intent: 'compare_periods',
                requiredData: ['MONTHLY'],
                filters: {}
            },
            'category-deep': {
                intent: 'top_categories',
                requiredData: ['TOP_CATEGORIES', 'TOP_SUBCATEGORIES', 'MONTHLY'],
                filters: {}
            }
        };
        
        return quickPromptMapping[promptId] || {
            intent: 'summary',
            requiredData: ['SUMMARY', 'TOP_CATEGORIES'],
            filters: {}
        };
    }
    
    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════
    
    return {
        INTENTS,
        routeQuestion,
        routeQuickPrompt,
        localPatternMatch,
        extractFilters
    };
    
})();

if (typeof window !== 'undefined') {
    window.BudgetAIRouter = BudgetAIRouter;
}
