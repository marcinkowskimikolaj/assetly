/**
 * Assetly - Budget AI Assistant
 * Tab: AI Asystent budżetowy
 */

let budgetAiMessages = [];
let budgetAiLoading = false;

function renderBudgetAI() {
    const container = document.getElementById('tab-ai');
    if (!container) return;
    
    container.innerHTML = `
        <div class="ai-container">
            
            <!-- Szybkie analizy -->
            <div class="ai-quick-actions">
                <h3>Szybkie analizy</h3>
                <div class="quick-buttons">
                    <button class="quick-btn" onclick="quickBudgetAnalysis('summary')">
                        📊 Podsumowanie miesiąca
                    </button>
                    <button class="quick-btn" onclick="quickBudgetAnalysis('savings')">
                        💰 Gdzie mogę zaoszczędzić?
                    </button>
                    <button class="quick-btn" onclick="quickBudgetAnalysis('projection')">
                        📈 Projekcja następnego miesiąca
                    </button>
                    <button class="quick-btn" onclick="quickBudgetAnalysis('trends')">
                        📉 Analiza trendów
                    </button>
                    <button class="quick-btn" onclick="quickBudgetAnalysis('yearly')">
                        📅 Porównanie rok do roku
                    </button>
                    <button class="quick-btn" onclick="quickBudgetAnalysis('afford')">
                        🤔 Czy stać mnie na...
                    </button>
                </div>
            </div>
            
            <!-- Chat -->
            <div class="ai-chat-container">
                <div class="ai-messages" id="budgetAiMessages">
                    ${budgetAiMessages.length === 0 ? `
                        <div class="ai-welcome">
                            <h3>👋 Cześć! Jestem Twoim asystentem budżetowym.</h3>
                            <p>Mogę pomóc Ci z:</p>
                            <ul>
                                <li>Analizą wydatków i dochodów</li>
                                <li>Identyfikacją możliwości oszczędności</li>
                                <li>Planowaniem budżetu</li>
                                <li>Prognozowaniem przyszłych wydatków</li>
                                <li>Oceną czy stać Cię na konkretne wydatki</li>
                            </ul>
                            <p>Zadaj mi pytanie lub wybierz szybką analizę powyżej!</p>
                        </div>
                    ` : budgetAiMessages.map(m => renderAiMessage(m)).join('')}
                </div>
                
                <div class="ai-input-container">
                    <textarea id="budgetAiInput" 
                              placeholder="Zadaj pytanie o swój budżet..." 
                              rows="2"
                              onkeydown="handleBudgetAiKeydown(event)"></textarea>
                    <button class="btn btn-primary" onclick="sendBudgetAiMessage()" ${budgetAiLoading ? 'disabled' : ''}>
                        ${budgetAiLoading ? '...' : '➤'}
                    </button>
                </div>
            </div>
            
        </div>
    `;
    
    // Scroll do końca
    const messagesContainer = document.getElementById('budgetAiMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function renderAiMessage(msg) {
    return `
        <div class="ai-message ${msg.role}">
            <div class="ai-message-avatar">
                ${msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div class="ai-message-content">
                ${msg.role === 'assistant' ? formatAiResponse(msg.content) : escapeHtml(msg.content)}
            </div>
        </div>
    `;
}

function formatAiResponse(content) {
    // Konwertuj markdown-like formatting
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n- /g, '</p><li>')
        .replace(/\n(\d+)\. /g, '</p><li>')
        .replace(/<li>/g, '<ul><li>')
        .replace(/<\/li>(?!<li>)/g, '</li></ul>')
        .split('\n').join('<br>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function handleBudgetAiKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBudgetAiMessage();
    }
}

async function sendBudgetAiMessage() {
    const input = document.getElementById('budgetAiInput');
    const message = input.value.trim();
    
    if (!message || budgetAiLoading) return;
    
    input.value = '';
    budgetAiMessages.push({ role: 'user', content: message });
    renderBudgetAI();
    
    await processBudgetAiMessage(message);
}

async function quickBudgetAnalysis(type) {
    const prompts = {
        summary: 'Podsumuj mój ostatni zamknięty miesiąc. Podaj konkretne liczby: dochody, wydatki, oszczędności, stopę oszczędności. Porównaj z poprzednim miesiącem i średnią. Wskaż największe kategorie wydatków.',
        savings: 'Przeanalizuj moje wydatki i wskaż gdzie mogę zaoszczędzić. Podaj konkretne kategorie które rosną lub są powyżej średniej. Zasugeruj realistyczne cięcia z konkretnymi kwotami.',
        projection: 'Na podstawie moich danych historycznych, zrób projekcję wydatków na następny miesiąc. Uwzględnij sezonowość i trendy. Podaj konkretne kwoty per kategoria.',
        trends: 'Przeanalizuj trendy w moich wydatkach za ostatnie 6 miesięcy. Które kategorie rosną, które spadają? Czy moja stopa oszczędności się poprawia czy pogarsza?',
        yearly: 'Porównaj moje wydatki rok do roku (ten sam miesiąc rok temu). Co się zmieniło? Które kategorie najbardziej wzrosły/spadły?',
        afford: 'Czy stać mnie na dodatkowy wydatek 2000 zł? Przeanalizuj mój budżet, oszczędności i obecną stopę oszczędności. Podaj czy to jest realistyczne bez naruszenia planu inwestycji.'
    };
    
    const message = prompts[type];
    budgetAiMessages.push({ role: 'user', content: message });
    renderBudgetAI();
    
    await processBudgetAiMessage(message);
}

async function processBudgetAiMessage(userMessage) {
    budgetAiLoading = true;
    renderBudgetAI();
    
    try {
        // Pobierz klucz API
        const apiKey = await AnalyticsSheets.getOpenAIKey();
        
        if (!apiKey) {
            budgetAiMessages.push({
                role: 'assistant',
                content: '⚠️ Nie skonfigurowano klucza OpenAI API. Przejdź do modułu Analityka, aby dodać klucz w ustawieniach.'
            });
            budgetAiLoading = false;
            renderBudgetAI();
            return;
        }
        
        // Przygotuj kontekst
        const context = prepareBudgetContext();
        const systemPrompt = getBudgetSystemPrompt(context);
        
        // Wyślij do API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...budgetAiMessages.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                ],
                temperature: 0.7,
                max_tokens: 1500
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        budgetAiMessages.push({
            role: 'assistant',
            content: aiResponse
        });
        
    } catch (error) {
        console.error('Błąd AI:', error);
        budgetAiMessages.push({
            role: 'assistant',
            content: `⚠️ Wystąpił błąd: ${error.message}. Sprawdź czy klucz API jest poprawny.`
        });
    } finally {
        budgetAiLoading = false;
        renderBudgetAI();
    }
}

function prepareBudgetContext() {
    const ostatni = getOstatniZamknietyMiesiacZDanych();
    const pOstatni = getPodsumowanieMiesiaca(ostatni.rok, ostatni.miesiac);
    
    const poprzedni = getPoprzedniMiesiac(ostatni.rok, ostatni.miesiac);
    const pPoprzedni = getPodsumowanieMiesiaca(poprzedni.rok, poprzedni.miesiac);
    
    const rokTemu = getRokTemu(ostatni.rok, ostatni.miesiac);
    const pRokTemu = getPodsumowanieMiesiaca(rokTemu.rok, rokTemu.miesiac);
    
    const srednie6 = getSrednieMiesieczne(6);
    const srednie12 = getSrednieMiesieczne(12);
    
    const historiaWyn = getHistoriaWynagrodzen();
    const bufor = getBuforAwaryjny();
    const anomalie = getAnomalieKategorii(ostatni.rok, ostatni.miesiac);
    
    // Top kategorie z historią
    const topKat = getTopKategorie(ostatni.rok, ostatni.miesiac, 10);
    
    return {
        currentMonth: {
            okres: formatMiesiac(ostatni.rok, ostatni.miesiac),
            dochody: pOstatni.dochody,
            wydatki: pOstatni.wydatki,
            wydatkiStale: pOstatni.wydatkiStale,
            wydatkiZmienne: pOstatni.wydatkiZmienne,
            bilans: pOstatni.bilans,
            stopaOszczednosci: pOstatni.stopaOszczednosci,
            transfery: pOstatni.transfery,
            wydatkiPerKategoria: pOstatni.wydatkiPerKategoria
        },
        previousMonth: pPoprzedni.maDane ? {
            okres: formatMiesiac(poprzedni.rok, poprzedni.miesiac),
            dochody: pPoprzedni.dochody,
            wydatki: pPoprzedni.wydatki,
            bilans: pPoprzedni.bilans,
            stopaOszczednosci: pPoprzedni.stopaOszczednosci
        } : null,
        yearAgo: pRokTemu.maDane ? {
            okres: formatMiesiac(rokTemu.rok, rokTemu.miesiac),
            dochody: pRokTemu.dochody,
            wydatki: pRokTemu.wydatki,
            bilans: pRokTemu.bilans
        } : null,
        averages: {
            '6mies': srednie6,
            '12mies': srednie12
        },
        investmentPlan: planInwestycyjny,
        emergencyFund: bufor,
        salaryHistory: historiaWyn,
        anomalies: anomalie,
        topCategories: topKat,
        settings: {
            celOszczednosci: ustawienia.celOszczednosciProcent || 20,
            buforMiesiace: ustawienia.buforAwaryjnyMiesiace || 6
        }
    };
}

function getBudgetSystemPrompt(context) {
    return `Jesteś ekspertem finansowym i asystentem budżetowym dla polskiego użytkownika. 
    
TWOJE ZASADY:
1. Mów po polsku
2. Podawaj KONKRETNE liczby z danych - nie zgaduj
3. Wszystkie kwoty w PLN z formatowaniem polskim (np. 5 432,00 PLN)
4. Porównuj z: planem, średnimi historycznymi, poprzednim miesiącem
5. Identyfikuj anomalie (odchylenia >15% od średniej)
6. Dawaj konkretne, liczbowe rekomendacje
7. Odnos się do kontekstu inwestycji użytkownika
8. Stosuj metodologię 50/30/20 jako benchmark
9. Uwzględniaj sezonowość wydatków
10. Bądź konstruktywny ale szczery

KONTEKST FINANSOWY UŻYTKOWNIKA:
${JSON.stringify(context, null, 2)}

WAŻNE:
- To jest system RETROSPEKTYWNY - użytkownik wprowadza dane na koniec miesiąca
- Dane są zagregowane per kategoria, nie pojedyncze transakcje
- Transfery (np. na firmę) to NIE są wydatki konsumpcyjne
- Plan inwestycji pochodzi z osobnego kalkulatora i powinien być priorytetem

Odpowiadaj zwięźle ale merytorycznie. Używaj formatowania (**, listy) dla czytelności.`;
}
