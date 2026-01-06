/**
 * Assetly - Budget AI Synonyms
 * Moduł rozpoznawania synonimów PRZED wysłaniem do LLM7
 * 
 * Cel: LLM7 dostaje już zmapowane synonimy, nie musi zgadywać
 */

const BudgetAISynonyms = {
    
    // ═══════════════════════════════════════════════════════════
    // BAZA SYNONIMÓW - PODKATEGORIE
    // ═══════════════════════════════════════════════════════════
    
    SUBCATEGORY_SYNONYMS: {
        // ─────────────────────────────────────────────────────────
        // AUTO I TRANSPORT
        // ─────────────────────────────────────────────────────────
        'Paliwo': {
            category: 'Auto i transport',
            synonyms: [
                'paliwo', 'benzyna', 'benz', 'diesel', 'tankowanie', 'tankuję', 
                'tankowałem', 'stacja', 'stacja benzynowa', 'orlen', 'bp', 'shell',
                'circle k', 'amic', 'lotos', 'fuel', 'gas', 'petrol'
            ]
        },
        'Parking i opłaty': {
            category: 'Auto i transport',
            synonyms: [
                'parking', 'parkowanie', 'parkomat', 'strefa płatna', 'abonament parkingowy',
                'opłata za parking', 'garaż', 'miejsce parkingowe', 'autostrada', 'myto',
                'viaTOLL', 'e-toll', 'a4', 'a2', 'opłata drogowa', 'winiety'
            ]
        },
        'Przejazdy': {
            category: 'Auto i transport',
            synonyms: [
                'przejazd', 'przejazdy', 'uber', 'bolt', 'taxi', 'taksówka', 'taksa',
                'freeNow', 'itaxi', 'komunikacja', 'autobus', 'tramwaj', 'metro',
                'bilet', 'bilety', 'mpk', 'ztm', 'kolej', 'pociąg', 'pkp', 'intercity',
                'flixbus', 'polskibus', 'transport publiczny'
            ]
        },
        'Serwis i części': {
            category: 'Auto i transport',
            synonyms: [
                'serwis', 'mechanik', 'warsztat', 'naprawa auta', 'naprawa samochodu',
                'części', 'części samochodowe', 'olej', 'wymiana oleju', 'opony',
                'wymiana opon', 'przegląd', 'przegląd techniczny', 'klimatyzacja',
                'hamulce', 'filtr', 'akumulator', 'auto detailing', 'myjnia'
            ]
        },
        'Ubezpieczenie auta': {
            category: 'Auto i transport',
            synonyms: [
                'ubezpieczenie auta', 'ubezpieczenie samochodu', 'oc', 'ac', 'oc/ac',
                'polisa samochodowa', 'ubezpieczenie pojazdu', 'assistance', 'nww'
            ]
        },
        'Auto i transport - inne': {
            category: 'Auto i transport',
            synonyms: [
                'auto inne', 'transport inne', 'wypożyczenie auta', 'car sharing',
                'panek', 'traficar', 'cityBee', 'wynajem samochodu'
            ]
        },
        
        // ─────────────────────────────────────────────────────────
        // CODZIENNE WYDATKI
        // ─────────────────────────────────────────────────────────
        'Żywność i chemia domowa': {
            category: 'Codzienne wydatki',
            synonyms: [
                'żywność', 'jedzenie', 'żarcie', 'zakupy spożywcze', 'spożywka',
                'zakupy', 'biedronka', 'lidl', 'auchan', 'carrefour', 'tesco',
                'żabka', 'stokrotka', 'netto', 'dino', 'kaufland', 'selgros',
                'makro', 'chemia', 'chemia domowa', 'środki czystości', 'proszek',
                'płyn do naczyń', 'artykuły spożywcze', 'groceries', 'market',
                'sklep', 'warzywa', 'owoce', 'mięso', 'nabiał', 'pieczywo'
            ]
        },
        'Jedzenie poza domem': {
            category: 'Codzienne wydatki',
            synonyms: [
                'jedzenie poza domem', 'restauracja', 'restauracje', 'knajpa', 'knajpy',
                'bar', 'pub', 'kawiarnia', 'cafe', 'kawa', 'lunch', 'obiad w mieście',
                'kolacja', 'fast food', 'mcdonald', 'kfc', 'burger king', 'pizza',
                'pizzeria', 'sushi', 'kebab', 'food court', 'jedzenie na mieście',
                'wyjście na jedzenie', 'delivery', 'pyszne.pl', 'glovo', 'wolt',
                'uber eats', 'dostawa jedzenia', 'takeaway', 'na wynos'
            ]
        },
        'Alkohol': {
            category: 'Codzienne wydatki',
            synonyms: [
                'alkohol', 'alko', 'piwo', 'piwko', 'piwa', 'wino', 'wódka', 'wóda',
                'whisky', 'whiskey', 'rum', 'gin', 'tequila', 'szampan', 'prosecco',
                'drink', 'drinki', 'koktajl', 'shot', 'browary', 'trunek', 'trunki',
                'monopolowy', 'sklep monopolowy', 'liquor'
            ]
        },
        'Papierosy': {
            category: 'Codzienne wydatki',
            synonyms: [
                'papierosy', 'fajki', 'szlugi', 'marlboro', 'camel', 'lucky strike',
                'l&m', 'tytoń', 'e-papieros', 'vape', 'iqos', 'heets', 'glo',
                'nikotyna', 'liquid', 'wkłady'
            ]
        },
        'Zwierzęta': {
            category: 'Codzienne wydatki',
            synonyms: [
                'zwierzęta', 'zwierzak', 'zwierzaki', 'pies', 'piesek', 'kot', 'kotek',
                'karma', 'karma dla psa', 'karma dla kota', 'weterynarz', 'weterynarza',
                'szczepienie', 'akcesoria dla zwierząt', 'smycz', 'obroża', 'kuweta',
                'żwirek', 'zabawki dla psa', 'gryzak', 'pet shop', 'zooplus'
            ]
        },
        'Codzienne wydatki - inne': {
            category: 'Codzienne wydatki',
            synonyms: [
                'codzienne inne', 'drobne wydatki', 'drobiazgi', 'różne'
            ]
        },
        
        // ─────────────────────────────────────────────────────────
        // DOM
        // ─────────────────────────────────────────────────────────
        'Akcesoria i wyposażenie': {
            category: 'Dom',
            synonyms: [
                'akcesoria domowe', 'wyposażenie', 'meble', 'mebel', 'ikea', 'jysk',
                'black red white', 'agata meble', 'dekoracje', 'firany', 'zasłony',
                'dywan', 'poduszki', 'pościel', 'ręczniki', 'naczynia', 'garnki',
                'sztućce', 'talerze', 'lamp', 'lampa', 'oświetlenie'
            ]
        },
        'Remont i ogród': {
            category: 'Dom',
            synonyms: [
                'remont', 'remonty', 'renowacja', 'malowanie', 'farba', 'tapeta',
                'podłoga', 'płytki', 'łazienka', 'kuchnia remont', 'ogród', 'ogródek',
                'rośliny', 'kwiaty', 'doniczki', 'narzędzia ogrodowe', 'kosiarka',
                'leroy merlin', 'castorama', 'obi', 'bricomarche', 'majsterkowanie'
            ]
        },
        'Ubezpieczenie domu': {
            category: 'Dom',
            synonyms: [
                'ubezpieczenie domu', 'ubezpieczenie mieszkania', 'polisa mieszkaniowa',
                'ubezpieczenie nieruchomości', 'polisa domowa'
            ]
        },
        'Usługi domowe': {
            category: 'Dom',
            synonyms: [
                'usługi domowe', 'sprzątanie', 'sprzątaczka', 'pani do sprzątania',
                'pranie', 'pralnia', 'pralnia chemiczna', 'prasowanie', 'złota rączka',
                'hydraulik', 'elektryk', 'serwis agd', 'naprawa pralki', 'kominarz'
            ]
        },
        'Dom - inne': {
            category: 'Dom',
            synonyms: ['dom inne', 'mieszkanie inne']
        },
        
        // ─────────────────────────────────────────────────────────
        // DZIECI
        // ─────────────────────────────────────────────────────────
        'Art. dziecięce i zabawki': {
            category: 'Dzieci',
            synonyms: [
                'zabawki', 'zabawka', 'klocki', 'lego', 'lalka', 'maskotka',
                'artykuły dziecięce', 'pieluchy', 'pampersy', 'smoczek', 'butelka',
                'wózek', 'fotelik', 'nosidełko', 'ubranka dziecięce', 'śpioszki',
                'smyk', 'toys r us', 'empik dziecięcy'
            ]
        },
        'Przedszkole i opiekunka': {
            category: 'Dzieci',
            synonyms: [
                'przedszkole', 'żłobek', 'opiekunka', 'niania', 'babysitter',
                'opieka nad dzieckiem', 'czesne przedszkole', 'wyprawka przedszkolna'
            ]
        },
        'Szkoła i wyprawka': {
            category: 'Dzieci',
            synonyms: [
                'szkoła', 'wyprawka', 'wyprawka szkolna', 'podręczniki', 'zeszyty',
                'tornister', 'plecak szkolny', 'przybory szkolne', 'świetlica',
                'obiady szkolne', 'wycieczka szkolna', 'składka klasowa'
            ]
        },
        'Zajęcia dodatkowe': {
            category: 'Dzieci',
            synonyms: [
                'zajęcia dodatkowe', 'korepetycje', 'angielski dla dzieci', 'basen dzieci',
                'taniec', 'piłka nożna', 'sport dzieci', 'muzyka', 'plastyka'
            ]
        },
        'Dzieci - inne': {
            category: 'Dzieci',
            synonyms: ['dzieci inne', 'wydatki na dzieci']
        },
        
        // ─────────────────────────────────────────────────────────
        // FIRMOWE
        // ─────────────────────────────────────────────────────────
        'Przelew na rach. firmowy': {
            category: 'Firmowe',
            synonyms: [
                'przelew na firmę', 'transfer firmowy', 'zasilenie konta firmowego',
                'przelew firmowy', 'konto firmowe'
            ]
        },
        'Zakupy firmowe': {
            category: 'Firmowe',
            synonyms: [
                'zakupy firmowe', 'wydatki firmowe', 'sprzęt firmowy', 'biuro',
                'materiały biurowe', 'laptop służbowy', 'telefon służbowy'
            ]
        },
        'Firmowe - inne': {
            category: 'Firmowe',
            synonyms: ['firmowe inne', 'firma inne']
        },
        
        // ─────────────────────────────────────────────────────────
        // OSOBISTE
        // ─────────────────────────────────────────────────────────
        'Edukacja': {
            category: 'Osobiste',
            synonyms: [
                'edukacja', 'kurs', 'kursy', 'szkolenie', 'szkolenia', 'studia',
                'czesne', 'książki', 'ebook', 'udemy', 'coursera', 'nauka',
                'certyfikat', 'egzamin', 'konferencja', 'webinar'
            ]
        },
        'Elektronika': {
            category: 'Osobiste',
            synonyms: [
                'elektronika', 'komputer', 'laptop', 'telefon', 'smartfon', 'iphone',
                'samsung', 'tablet', 'ipad', 'słuchawki', 'airpods', 'głośnik',
                'telewizor', 'tv', 'monitor', 'klawiatura', 'mysz', 'ładowarka',
                'powerbank', 'kabel', 'pendrive', 'dysk', 'ssd', 'rtv agd',
                'media expert', 'media markt', 'x-kom', 'morele', 'komputronik'
            ]
        },
        'Multimedia, książki i prasa': {
            category: 'Osobiste',
            synonyms: [
                'multimedia', 'książki', 'książka', 'ebook', 'audiobook', 'empik',
                'prasa', 'gazeta', 'czasopismo', 'subskrypcja', 'netflix', 'spotify',
                'hbo', 'disney+', 'amazon prime', 'audible', 'legimi', 'storytel',
                'youtube premium', 'apple music', 'tidal', 'gry', 'steam', 'playstation',
                'xbox', 'nintendo', 'game pass'
            ]
        },
        'Odzież i obuwie': {
            category: 'Osobiste',
            synonyms: [
                'odzież', 'ubrania', 'ubranie', 'ciuchy', 'ciuch', 'koszula', 'spodnie',
                'sukienka', 'kurtka', 'płaszcz', 'sweter', 'bluza', 't-shirt',
                'obuwie', 'buty', 'but', 'adidasy', 'trampki', 'szpilki', 'sandały',
                'h&m', 'zara', 'reserved', 'ccc', 'deichmann', 'zalando', 'aboutyou',
                'bielizna', 'skarpety', 'rajstopy'
            ]
        },
        'Prezenty i wsparcie': {
            category: 'Osobiste',
            synonyms: [
                'prezent', 'prezenty', 'upominek', 'upominki', 'gift', 'podarunek',
                'urodziny prezent', 'imieniny', 'gwiazdka', 'mikołaj', 'komunia',
                'ślub prezent', 'wesele', 'chrzest', 'wsparcie', 'pomoc finansowa',
                'darowizna', 'zbiórka', 'crowdfunding', 'siepomaga', 'zrzutka'
            ]
        },
        'Zdrowie i uroda': {
            category: 'Osobiste',
            synonyms: [
                'zdrowie', 'leki', 'apteka', 'lekarstwa', 'witaminy', 'suplementy',
                'lekarz', 'wizyta lekarska', 'dentysta', 'stomatolog', 'okulista',
                'okulary', 'soczewki', 'badania', 'usg', 'rezonans', 'rehabilitacja',
                'fizjoterapia', 'masaż', 'uroda', 'kosmetyki', 'krem', 'szampon',
                'perfumy', 'makijaż', 'fryzjer', 'strzyżenie', 'manicure', 'pedicure',
                'spa', 'rossmann', 'hebe', 'sephora', 'douglas'
            ]
        },
        'Osobiste - inne': {
            category: 'Osobiste',
            synonyms: ['osobiste inne', 'wydatki osobiste']
        },
        
        // ─────────────────────────────────────────────────────────
        // OSZCZĘDNOŚCI I INWESTYCJE
        // ─────────────────────────────────────────────────────────
        'Fundusze': {
            category: 'Oszczędności i inw.',
            synonyms: [
                'fundusz', 'fundusze', 'tfi', 'fundusz inwestycyjny', 'etf',
                'fundusz obligacji', 'fundusz akcji', 'inpzu', 'finax'
            ]
        },
        'Giełda': {
            category: 'Oszczędności i inw.',
            synonyms: [
                'giełda', 'akcje', 'gpw', 'obligacje', 'obligacja', 'makler',
                'broker', 'xtb', 'degiro', 'bossa', 'mbank broker', 'trading',
                'inwestowanie', 'dywidenda'
            ]
        },
        'Lokaty i konto oszcz.': {
            category: 'Oszczędności i inw.',
            synonyms: [
                'lokata', 'lokaty', 'konto oszczędnościowe', 'oszczędności',
                'odkładanie', 'odłożyłem', 'oszczędzanie'
            ]
        },
        'Regularne oszczędzanie': {
            category: 'Oszczędności i inw.',
            synonyms: [
                'regularne oszczędzanie', 'systematyczne oszczędzanie', 'zlecenie stałe',
                'ike', 'ikze', 'ppk', 'emerytura', 'konto emerytalne'
            ]
        },
        'Oszczędności i inw. - inne': {
            category: 'Oszczędności i inw.',
            synonyms: ['inwestycje inne', 'oszczędności inne']
        },
        
        // ─────────────────────────────────────────────────────────
        // PŁATNOŚCI
        // ─────────────────────────────────────────────────────────
        'Czynsz i wynajem': {
            category: 'Płatności',
            synonyms: [
                'czynsz', 'najem', 'wynajem', 'mieszkanie', 'wynajmuję', 'rent',
                'opłata za mieszkanie', 'czynsz administracyjny', 'fundusz remontowy',
                'wspólnota', 'spółdzielnia'
            ]
        },
        'Gaz': {
            category: 'Płatności',
            synonyms: [
                'gaz', 'gaz ziemny', 'pgnig', 'rachunek za gaz', 'faktura za gaz'
            ]
        },
        'Ogrzewanie': {
            category: 'Płatności',
            synonyms: [
                'ogrzewanie', 'ciepło', 'c.o.', 'centralne ogrzewanie', 'mpec',
                'ciepłownia', 'rachunki za ogrzewanie', 'opał', 'pellet', 'węgiel'
            ]
        },
        'Opłaty i odsetki': {
            category: 'Płatności',
            synonyms: [
                'opłaty bankowe', 'prowizja', 'odsetki', 'opłata za kartę',
                'opłata za konto', 'opłata za przelew', 'odsetki od kredytu'
            ]
        },
        'Podatki': {
            category: 'Płatności',
            synonyms: [
                'podatek', 'podatki', 'pit', 'vat', 'cit', 'urząd skarbowy',
                'podatek od nieruchomości', 'podatek dochodowy', 'dopłata podatku'
            ]
        },
        'Prąd': {
            category: 'Płatności',
            synonyms: [
                'prąd', 'elektryczność', 'energia', 'energia elektryczna', 'tauron',
                'pge', 'enea', 'energa', 'innogy', 'rachunek za prąd', 'faktura za prąd'
            ]
        },
        'Spłaty rat': {
            category: 'Płatności',
            synonyms: [
                'rata', 'raty', 'kredyt', 'pożyczka', 'spłata kredytu', 'spłata raty',
                'hipoteka', 'kredyt hipoteczny', 'kredyt gotówkowy', 'raty 0%',
                'leasing', 'rata leasingu'
            ]
        },
        'TV, internet, telefon': {
            category: 'Płatności',
            synonyms: [
                'internet', 'tv', 'telewizja', 'telefon', 'abonament', 'abonament telefoniczny',
                'play', 'orange', 'plus', 't-mobile', 'upc', 'vectra', 'netia',
                'multimedia', 'światłowód', 'router', 'kablówka', 'cyfrowy polsat',
                'canal+', 'nc+', 'polsat box'
            ]
        },
        'Ubezpieczenia': {
            category: 'Płatności',
            synonyms: [
                'ubezpieczenie', 'ubezpieczenia', 'polisa', 'ubezpieczenie na życie',
                'ubezpieczenie zdrowotne', 'nfz', 'pzu', 'warta', 'allianz', 'axa',
                'generali', 'uniqa', 'prywatna opieka medyczna', 'medicover', 'luxmed',
                'enel-med', 'pakiet medyczny'
            ]
        },
        'Woda i kanalizacja': {
            category: 'Płatności',
            synonyms: [
                'woda', 'kanalizacja', 'wodociągi', 'mpwik', 'rachunek za wodę',
                'ścieki', 'wodkan'
            ]
        },
        'Płatności - inne': {
            category: 'Płatności',
            synonyms: ['płatności inne', 'rachunki inne', 'opłaty inne']
        },
        
        // ─────────────────────────────────────────────────────────
        // ROZRYWKA
        // ─────────────────────────────────────────────────────────
        'Podróże i wyjazdy': {
            category: 'Rozrywka',
            synonyms: [
                'podróż', 'podróże', 'wyjazd', 'wyjazdy', 'wakacje', 'urlop',
                'lot', 'samolot', 'bilet lotniczy', 'ryanair', 'wizzair', 'lot polish',
                'hotel', 'hostel', 'airbnb', 'booking', 'nocleg', 'zwiedzanie',
                'wycieczka', 'all inclusive', 'last minute', 'tui', 'itaka', 'rainbow'
            ]
        },
        'Sport i hobby': {
            category: 'Rozrywka',
            synonyms: [
                'sport', 'hobby', 'siłownia', 'fitness', 'gym', 'karnet', 'multisport',
                'basen', 'joga', 'crossfit', 'rower', 'bieganie', 'piłka nożna',
                'tenis', 'squash', 'narty', 'snowboard', 'wspinaczka', 'martial arts',
                'sztuki walki', 'sprzęt sportowy', 'decathlon', 'intersport'
            ]
        },
        'Wyjścia i wydarzenia': {
            category: 'Rozrywka',
            synonyms: [
                'wyjście', 'wyjścia', 'kino', 'teatr', 'koncert', 'festiwal',
                'wydarzenie', 'bilet', 'bilety', 'spektakl', 'opera', 'muzeum',
                'galeria', 'wystawa', 'escape room', 'park rozrywki', 'luna park',
                'impreza', 'event', 'eventim', 'ebilet', 'ticketmaster', 'going'
            ]
        },
        'Rozrywka - inne': {
            category: 'Rozrywka',
            synonyms: ['rozrywka inne', 'zabawa inne']
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // SYNONIMY KATEGORII GŁÓWNYCH
    // ═══════════════════════════════════════════════════════════
    
    CATEGORY_SYNONYMS: {
        'Auto i transport': ['auto', 'samochód', 'transport', 'motoryzacja', 'jazda'],
        'Codzienne wydatki': ['codzienne', 'bieżące', 'życie', 'podstawowe'],
        'Dom': ['dom', 'mieszkanie', 'house', 'gospodarstwo'],
        'Dzieci': ['dzieci', 'dziecko', 'potomstwo', 'syn', 'córka'],
        'Firmowe': ['firma', 'firmowe', 'biznes', 'działalność', 'praca'],
        'Osobiste': ['osobiste', 'prywatne', 'własne', 'moje'],
        'Oszczędności i inw.': ['oszczędności', 'inwestycje', 'odkładanie', 'inwestowanie'],
        'Płatności': ['płatności', 'rachunki', 'opłaty', 'bills', 'stałe'],
        'Rozrywka': ['rozrywka', 'zabawa', 'fun', 'leisure', 'relax'],
        'Nieistotne': ['nieistotne', 'nieważne', 'drobne'],
        'Nieskategoryzowane': ['nieskategoryzowane', 'inne', 'pozostałe', 'różne']
    },
    
    // ═══════════════════════════════════════════════════════════
    // SŁOWA KLUCZOWE CZASOWE
    // ═══════════════════════════════════════════════════════════
    
    TIME_KEYWORDS: {
        'ostatni miesiąc': { type: 'relative', value: -1, unit: 'month' },
        'poprzedni miesiąc': { type: 'relative', value: -1, unit: 'month' },
        'w tym miesiącu': { type: 'current', unit: 'month' },
        'bieżący miesiąc': { type: 'current', unit: 'month' },
        'ostatnie 3 miesiące': { type: 'relative', value: -3, unit: 'month' },
        'ostatni kwartał': { type: 'relative', value: -3, unit: 'month' },
        'ostatnie pół roku': { type: 'relative', value: -6, unit: 'month' },
        'ostatnie 6 miesięcy': { type: 'relative', value: -6, unit: 'month' },
        'ostatni rok': { type: 'relative', value: -12, unit: 'month' },
        'w tym roku': { type: 'currentYear' },
        'rok temu': { type: 'relative', value: -1, unit: 'year' },
        'zeszły rok': { type: 'previousYear' },
        'styczeń': { type: 'month', value: 1 },
        'luty': { type: 'month', value: 2 },
        'marzec': { type: 'month', value: 3 },
        'kwiecień': { type: 'month', value: 4 },
        'maj': { type: 'month', value: 5 },
        'czerwiec': { type: 'month', value: 6 },
        'lipiec': { type: 'month', value: 7 },
        'sierpień': { type: 'month', value: 8 },
        'wrzesień': { type: 'month', value: 9 },
        'październik': { type: 'month', value: 10 },
        'listopad': { type: 'month', value: 11 },
        'grudzień': { type: 'month', value: 12 }
    },
    
    // ═══════════════════════════════════════════════════════════
    // SŁOWA KLUCZOWE INTENCJI
    // ═══════════════════════════════════════════════════════════
    
    INTENT_KEYWORDS: {
        sum: ['ile', 'suma', 'łącznie', 'razem', 'całkowity', 'total', 'wydałem', 'wydałam', 'kosztowało'],
        trend: ['trend', 'tendencja', 'rośnie', 'maleje', 'zmienia się', 'kierunek'],
        compare: ['porównaj', 'porównanie', 'vs', 'versus', 'różnica', 'zestawienie'],
        top: ['top', 'ranking', 'najwięcej', 'największe', 'najwyższe', 'główne'],
        monthly: ['miesięcznie', 'miesiące', 'miesiąc po miesiącu', 'w poszczególnych miesiącach', 'jak się zmieniało'],
        average: ['średnia', 'średnio', 'przeciętnie', 'typically'],
        share: ['udział', 'procent', 'część', 'odsetek'],
        anomaly: ['anomalia', 'odstępstwo', 'nietypowe', 'dziwne', 'wysokie']
    },
    
    // ═══════════════════════════════════════════════════════════
    // GŁÓWNA FUNKCJA RESOLVERA
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Analizuje zapytanie i zwraca rozpoznane synonimy
     * @param {string} query - zapytanie użytkownika
     * @returns {Object} - rozpoznane elementy
     */
    resolve(query) {
        const normalizedQuery = this._normalizeQuery(query);
        const tokens = this._tokenize(normalizedQuery);
        
        const result = {
            originalQuery: query,
            normalizedQuery: normalizedQuery,
            
            // Rozpoznane kategorie/podkategorie
            categories: [],
            subcategories: [],
            
            // Rozpoznany czas
            timeContext: null,
            
            // Rozpoznana intencja
            intents: [],
            
            // Pełne mapowanie do przekazania LLM7
            synonymMap: {}
        };
        
        // 1. Szukaj podkategorii (najważniejsze!)
        result.subcategories = this._findSubcategories(normalizedQuery, tokens);
        
        // 2. Szukaj kategorii
        result.categories = this._findCategories(normalizedQuery, tokens);
        
        // 3. Szukaj kontekstu czasowego
        result.timeContext = this._findTimeContext(normalizedQuery);
        
        // 4. Szukaj intencji
        result.intents = this._findIntents(normalizedQuery, tokens);
        
        // 5. Buduj mapę synonimów
        result.synonymMap = this._buildSynonymMap(result);
        
        return result;
    },
    
    // ═══════════════════════════════════════════════════════════
    // METODY POMOCNICZE
    // ═══════════════════════════════════════════════════════════
    
    _normalizeQuery(query) {
        return query
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // usuń akcenty
            .replace(/ł/g, 'l')
            .replace(/ą/g, 'a')
            .replace(/ę/g, 'e')
            .replace(/ó/g, 'o')
            .replace(/ś/g, 's')
            .replace(/ć/g, 'c')
            .replace(/ń/g, 'n')
            .replace(/ż|ź/g, 'z')
            .trim();
    },
    
    _tokenize(query) {
        // Rozdziel na słowa i frazy
        return query
            .split(/[\s,;.!?]+/)
            .filter(t => t.length > 1);
    },
    
    _findSubcategories(query, tokens) {
        const found = [];
        
        for (const [subcatName, subcatData] of Object.entries(this.SUBCATEGORY_SYNONYMS)) {
            for (const synonym of subcatData.synonyms) {
                const normalizedSynonym = this._normalizeQuery(synonym);
                
                // Sprawdź czy synonim występuje w zapytaniu
                if (query.includes(normalizedSynonym)) {
                    // Sprawdź czy to nie jest część dłuższego słowa
                    const regex = new RegExp(`\\b${this._escapeRegex(normalizedSynonym)}\\b`, 'i');
                    if (regex.test(query) || normalizedSynonym.length >= 4) {
                        found.push({
                            originalTerm: synonym,
                            officialName: subcatName,
                            category: subcatData.category,
                            confidence: this._calculateConfidence(synonym, query)
                        });
                        break; // Jedna podkategoria = jeden match
                    }
                }
            }
        }
        
        // Sortuj po confidence, usuń duplikaty
        const unique = [];
        const seen = new Set();
        
        found.sort((a, b) => b.confidence - a.confidence);
        for (const item of found) {
            if (!seen.has(item.officialName)) {
                seen.add(item.officialName);
                unique.push(item);
            }
        }
        
        return unique;
    },
    
    _findCategories(query, tokens) {
        const found = [];
        
        for (const [catName, synonyms] of Object.entries(this.CATEGORY_SYNONYMS)) {
            for (const synonym of synonyms) {
                const normalizedSynonym = this._normalizeQuery(synonym);
                
                if (query.includes(normalizedSynonym)) {
                    found.push({
                        originalTerm: synonym,
                        officialName: catName,
                        confidence: this._calculateConfidence(synonym, query)
                    });
                    break;
                }
            }
        }
        
        return found;
    },
    
    _findTimeContext(query) {
        for (const [phrase, config] of Object.entries(this.TIME_KEYWORDS)) {
            const normalizedPhrase = this._normalizeQuery(phrase);
            if (query.includes(normalizedPhrase)) {
                return {
                    originalPhrase: phrase,
                    ...config
                };
            }
        }
        
        // Szukaj wzorca "w 2024", "w roku 2023" itp.
        const yearMatch = query.match(/(?:w\s+)?(?:roku?\s+)?(\d{4})/);
        if (yearMatch) {
            return {
                type: 'specificYear',
                year: parseInt(yearMatch[1])
            };
        }
        
        return null;
    },
    
    _findIntents(query, tokens) {
        const found = [];
        
        for (const [intent, keywords] of Object.entries(this.INTENT_KEYWORDS)) {
            for (const keyword of keywords) {
                const normalizedKeyword = this._normalizeQuery(keyword);
                if (query.includes(normalizedKeyword)) {
                    found.push(intent);
                    break;
                }
            }
        }
        
        // Domyślna intencja jeśli nie znaleziono
        if (found.length === 0) {
            found.push('sum'); // domyślnie pytają o sumę
        }
        
        return [...new Set(found)];
    },
    
    _buildSynonymMap(result) {
        const map = {};
        
        // Mapuj podkategorie
        for (const subcat of result.subcategories) {
            map[subcat.originalTerm] = {
                type: 'subcategory',
                officialName: subcat.officialName,
                category: subcat.category,
                confidence: subcat.confidence
            };
        }
        
        // Mapuj kategorie
        for (const cat of result.categories) {
            map[cat.originalTerm] = {
                type: 'category',
                officialName: cat.officialName,
                confidence: cat.confidence
            };
        }
        
        return map;
    },
    
    _calculateConfidence(synonym, query) {
        // Dłuższe dopasowanie = wyższa pewność
        const lengthScore = Math.min(synonym.length / 10, 1);
        
        // Exact word match = wyższa pewność
        const regex = new RegExp(`\\b${this._escapeRegex(this._normalizeQuery(synonym))}\\b`, 'i');
        const exactMatch = regex.test(query) ? 0.3 : 0;
        
        return Math.min(0.5 + lengthScore * 0.3 + exactMatch, 1);
    },
    
    _escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },
    
    // ═══════════════════════════════════════════════════════════
    // FORMATOWANIE DLA LLM7
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Formatuje wynik resolvera jako tekst dla LLM7
     */
    formatForLLM(resolved) {
        if (resolved.subcategories.length === 0 && resolved.categories.length === 0) {
            return null; // Nic nie rozpoznano
        }
        
        let text = 'ROZPOZNANE SYNONIMY W ZAPYTANIU:\n';
        
        if (resolved.subcategories.length > 0) {
            text += '\nPODKATEGORIE:\n';
            for (const sub of resolved.subcategories) {
                text += `• "${sub.originalTerm}" → podkategoria "${sub.officialName}" (kategoria: ${sub.category})\n`;
            }
        }
        
        if (resolved.categories.length > 0) {
            text += '\nKATEGORIE:\n';
            for (const cat of resolved.categories) {
                text += `• "${cat.originalTerm}" → kategoria "${cat.officialName}"\n`;
            }
        }
        
        if (resolved.timeContext) {
            text += `\nOKRES: ${JSON.stringify(resolved.timeContext)}\n`;
        }
        
        if (resolved.intents.length > 0) {
            text += `\nINTENCJE: ${resolved.intents.join(', ')}\n`;
        }
        
        text += '\nUŻYWAJ POWYŻSZYCH OFICJALNYCH NAZW W ODPOWIEDZI JSON!\n';
        
        return text;
    },
    
    /**
     * Zwraca sugerowaną funkcję na podstawie intencji
     */
    suggestFunction(intents) {
        if (intents.includes('monthly')) return 'monthlyBreakdown';
        if (intents.includes('trend')) return 'trendAnalysis';
        if (intents.includes('compare')) return 'compareMonths';
        if (intents.includes('top')) return 'topExpenses';
        if (intents.includes('average')) return 'averageExpense';
        if (intents.includes('share')) return 'categoryShare';
        if (intents.includes('anomaly')) return 'getAnomalies';
        return 'sumBySubcategory'; // domyślnie
    }
};

// Export dla modułów
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BudgetAISynonyms;
}
