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
                'circle k', 'amic', 'lotos', 'fuel', 'gas', 'petrol', 'lpg',
                'cng', 'ładowanie auta', 'ładowarka ev'
            ]
        },
        'Parking i opłaty': {
            category: 'Auto i transport',
            synonyms: [
                'parking', 'parkowanie', 'parkomat', 'strefa płatna', 'abonament parkingowy',
                'opłata za parking', 'garaż', 'miejsce parkingowe', 'autostrada', 'myto',
                'viatoll', 'e-toll', 'a4', 'a2', 'opłata drogowa', 'winiety', 'mandat',
                'odholowanie', 'strefa'
            ]
        },
        'Przejazdy': {
            category: 'Auto i transport',
            synonyms: [
                'przejazd', 'przejazdy', 'uber', 'bolt', 'taxi', 'taksówka', 'taksa',
                'freenow', 'itaxi', 'komunikacja', 'autobus', 'tramwaj', 'metro',
                'bilet', 'bilety', 'mpk', 'ztm', 'kolej', 'pociąg', 'pkp', 'intercity',
                'flixbus', 'polskibus', 'transport publiczny', 'hulajnoga', 'lime',
                'tier', 'blinkee', 'rower miejski', 'veturilo'
            ]
        },
        'Serwis i części': {
            category: 'Auto i transport',
            synonyms: [
                'serwis', 'mechanik', 'warsztat', 'naprawa auta', 'naprawa samochodu',
                'części', 'części samochodowe', 'olej', 'wymiana oleju', 'opony',
                'wymiana opon', 'przegląd', 'przegląd techniczny', 'klimatyzacja',
                'hamulce', 'filtr', 'akumulator', 'auto detailing', 'myjnia',
                'wulkanizacja', 'geometria', 'rozrząd', 'sprzęgło'
            ]
        },
        'Ubezpieczenie auta': {
            category: 'Auto i transport',
            synonyms: [
                'ubezpieczenie auta', 'oc', 'ac', 'oc/ac', 'polisa samochodowa',
                'ubezpieczenie samochodu', 'assistance', 'nww', 'autocasco'
            ]
        },
        'Auto i transport - inne': {
            category: 'Auto i transport',
            synonyms: [
                'rejestracja', 'przerejestrowanie', 'tablice', 'dowód rejestracyjny',
                'badanie techniczne', 'stk'
            ]
        },
        
        // ─────────────────────────────────────────────────────────
        // CODZIENNE WYDATKI
        // ─────────────────────────────────────────────────────────
        'Żywność i chemia domowa': {
            category: 'Codzienne wydatki',
            synonyms: [
                'żywność', 'jedzenie', 'zakupy', 'spożywcze', 'zakupy spożywcze',
                'biedronka', 'lidl', 'auchan', 'carrefour', 'kaufland', 'netto',
                'żabka', 'lewiatan', 'dino', 'stokrotka', 'freshmarket', 'piotr i paweł',
                'intermarche', 'makro', 'selgros', 'market', 'supermarket', 'hipermarket',
                'warzywa', 'owoce', 'mięso', 'pieczywo', 'nabiał', 'mleko',
                'chemia', 'chemia domowa', 'proszek', 'płyn', 'środki czystości',
                'rossmann chemia', 'dm', 'artykuły spożywcze', 'grocery'
            ]
        },
        'Jedzenie poza domem': {
            category: 'Codzienne wydatki',
            synonyms: [
                'jedzenie poza domem', 'restauracja', 'restauracje', 'obiad', 'obiady',
                'lunch', 'kolacja', 'śniadanie', 'kawa', 'kawiarnia', 'cafe',
                'starbucks', 'costa', 'mcdonald', 'mcdonalds', 'kfc', 'burger king',
                'pizza hut', 'dominos', 'telepizza', 'sushi', 'kebab',
                'delivery', 'dowóz', 'pyszne.pl', 'pyszne', 'glovo', 'wolt', 'uber eats',
                'bolt food', 'food', 'catering', 'bar', 'bistro', 'fast food',
                'knajpa', 'knajpka', 'gastro', 'gastronomi'
            ]
        },
        'Alkohol': {
            category: 'Codzienne wydatki',
            synonyms: [
                'alkohol', 'alko', 'piwo', 'wino', 'wódka', 'whisky', 'whiskey',
                'rum', 'gin', 'tequila', 'likier', 'szampan', 'prosecco',
                'browar', 'monopolowy', 'sklep monopolowy', 'drinki', 'drink'
            ]
        },
        'Papierosy': {
            category: 'Codzienne wydatki',
            synonyms: [
                'papierosy', 'fajki', 'szlugi', 'tytoń', 'e-papieros', 'vape',
                'iqos', 'heets', 'glo', 'marlboro', 'camel', 'lucky strike',
                'nikotyna', 'palenie'
            ]
        },
        'Zwierzęta': {
            category: 'Codzienne wydatki',
            synonyms: [
                'zwierzęta', 'zwierzę', 'zwierzak', 'zwierzaka', 'zwierzaki',
                'pies', 'psa', 'psu', 'psem', 'psie', 'piesek', 'pieska', 'psiaka',
                'kot', 'kota', 'kotem', 'kocie', 'kotek', 'kotka', 'kociak',
                'pupil', 'pupila', 'pupilem', 'pupile',
                'karma', 'karmy', 'karmę', 'żarcie dla psa', 'żarcie dla kota',
                'weterynarz', 'weterynarza', 'weterynarii', 'wet', 'klinika weterynaryjna',
                'szczepienie psa', 'szczepienie kota', 'odrobaczanie', 'pchły', 'kleszcze',
                'smycz', 'obroża', 'transporter', 'legowisko', 'kuweta', 'żwirek',
                'zabawki dla psa', 'zabawki dla kota', 'przysmaki', 'gryzaki',
                'royal canin', 'whiskas', 'pedigree', 'friskies', 'felix', 'purina',
                'zooplus', 'maxi zoo', 'kakadu', 'pet', 'pets',
                'groomer', 'grooming', 'strzyżenie psa', 'psi fryzjer', 'trymowanie',
                'nachos', 'burek', 'reksio', 'mruczek', 'filemon'
            ]
        },
        'Codzienne wydatki - inne': {
            category: 'Codzienne wydatki',
            synonyms: []
        },
        
        // ─────────────────────────────────────────────────────────
        // DOM
        // ─────────────────────────────────────────────────────────
        'Akcesoria i wyposażenie': {
            category: 'Dom',
            synonyms: [
                'wyposażenie', 'akcesoria', 'meble', 'ikea', 'jysk', 'agata meble',
                'black red white', 'brw', 'komoda', 'szafa', 'łóżko', 'sofa',
                'fotel', 'stół', 'krzesła', 'biurko', 'regał', 'półka',
                'pościel', 'ręczniki', 'zasłony', 'firany', 'dywan', 'wykładzina',
                'kuchenne', 'garnki', 'patelnie', 'sztućce', 'talerze', 'szklanki',
                'dekoracje', 'obrazy', 'ramki', 'świeczki', 'wazony'
            ]
        },
        'Remont i ogród': {
            category: 'Dom',
            synonyms: [
                'remont', 'remonty', 'budowa', 'wykończenie', 'materiały budowlane',
                'leroy merlin', 'castorama', 'obi', 'bricomarche', 'bricoman',
                'farba', 'malowanie', 'tapeta', 'płytki', 'panele', 'podłoga',
                'hydraulik', 'elektryk', 'instalacja', 'ogród', 'ogródek',
                'rośliny', 'kwiaty', 'drzewa', 'trawnik', 'kosiarka', 'narzędzia ogrodowe',
                'meble ogrodowe', 'grill', 'basen', 'altana', 'taras'
            ]
        },
        'Ubezpieczenie domu': {
            category: 'Dom',
            synonyms: [
                'ubezpieczenie domu', 'ubezpieczenie mieszkania', 'polisa mieszkaniowa',
                'ubezpieczenie nieruchomości', 'ubezpieczenie od ognia', 'ubezpieczenie od kradzieży'
            ]
        },
        'Usługi domowe': {
            category: 'Dom',
            synonyms: [
                'usługi domowe', 'sprzątanie', 'sprzątaczka', 'firma sprzątająca',
                'pranie', 'pralnia', 'prasowanie', 'okna', 'mycie okien',
                'ogrodnik', 'koszenie trawy', 'odśnieżanie', 'wywóz śmieci',
                'dezynsekcja', 'deratyzacja', 'kominarz', 'serwis agd'
            ]
        },
        'Dom - inne': {
            category: 'Dom',
            synonyms: []
        },
        
        // ─────────────────────────────────────────────────────────
        // DZIECI
        // ─────────────────────────────────────────────────────────
        'Art. dziecięce i zabawki': {
            category: 'Dzieci',
            synonyms: [
                'artykuły dziecięce', 'zabawki', 'zabawka', 'lego', 'klocki',
                'lalka', 'lalki', 'misie', 'pluszaki', 'gry', 'puzzle',
                'smyk', 'toys r us', 'empik dziecięcy', 'pieluchy', 'pampersy',
                'wózek', 'fotelik', 'łóżeczko', 'przewijak', 'nosidełko',
                'butelka', 'smoczek', 'śliniaki', 'ubranka dziecięce'
            ]
        },
        'Przedszkole i opiekunka': {
            category: 'Dzieci',
            synonyms: [
                'przedszkole', 'przedszkolne', 'żłobek', 'opiekunka', 'niania',
                'babysitter', 'opieka nad dzieckiem', 'czesne przedszkole'
            ]
        },
        'Szkoła i wyprawka': {
            category: 'Dzieci',
            synonyms: [
                'szkoła', 'szkolne', 'wyprawka', 'plecak', 'tornister', 'piórnik',
                'zeszyty', 'książki szkolne', 'podręczniki', 'przybory szkolne',
                'mundurki', 'czesne', 'składki szkolne', 'wycieczka szkolna'
            ]
        },
        'Zajęcia dodatkowe': {
            category: 'Dzieci',
            synonyms: [
                'zajęcia dodatkowe', 'korepetycje', 'kurs', 'lekcje', 'basen dzieci',
                'angielski dzieci', 'piłka nożna', 'taniec', 'balet', 'judo',
                'karate', 'gimnastyka', 'muzyka', 'pianino', 'gitara'
            ]
        },
        'Dzieci - inne': {
            category: 'Dzieci',
            synonyms: []
        },
        
        // ─────────────────────────────────────────────────────────
        // FIRMOWE
        // ─────────────────────────────────────────────────────────
        'Przelew na rach. firmowy': {
            category: 'Firmowe',
            synonyms: [
                'przelew firmowy', 'konto firmowe', 'rachunek firmowy',
                'transfer na firmę', 'działalność gospodarcza'
            ]
        },
        'Zakupy firmowe': {
            category: 'Firmowe',
            synonyms: [
                'zakupy firmowe', 'faktura', 'wydatki firmowe', 'koszty firmowe',
                'sprzęt firmowy', 'materiały biurowe', 'artykuły biurowe'
            ]
        },
        'Firmowe - inne': {
            category: 'Firmowe',
            synonyms: []
        },
        
        // ─────────────────────────────────────────────────────────
        // OSOBISTE
        // ─────────────────────────────────────────────────────────
        'Edukacja': {
            category: 'Osobiste',
            synonyms: [
                'edukacja', 'kurs', 'kursy', 'szkolenie', 'szkolenia', 'nauka',
                'studia', 'czesne', 'uczelnia', 'uniwersytet', 'akademia',
                'książki', 'książka', 'ebook', 'audiobook', 'udemy', 'coursera',
                'linkedin learning', 'certyfikat', 'egzamin', 'kwalifikacje'
            ]
        },
        'Elektronika': {
            category: 'Osobiste',
            synonyms: [
                'elektronika', 'telefon', 'smartfon', 'iphone', 'samsung', 'xiaomi',
                'laptop', 'komputer', 'pc', 'tablet', 'ipad', 'słuchawki',
                'airpods', 'telewizor', 'tv', 'konsola', 'playstation', 'ps5', 'xbox',
                'nintendo', 'switch', 'aparat', 'kamera', 'gopro', 'dron',
                'media expert', 'rtv euro agd', 'media markt', 'x-kom', 'morele',
                'komputronik', 'allegro', 'amazon', 'agd', 'pralka', 'lodówka',
                'zmywarka', 'odkurzacz', 'mikser', 'robot kuchenny'
            ]
        },
        'Multimedia, książki i prasa': {
            category: 'Osobiste',
            synonyms: [
                'multimedia', 'netflix', 'hbo', 'hbo max', 'disney', 'disney+',
                'spotify', 'tidal', 'apple music', 'youtube premium', 'amazon prime',
                'subskrypcja', 'vod', 'streaming', 'canal+', 'player', 'polsat box',
                'prasa', 'gazeta', 'czasopismo', 'magazyn', 'prenumerata',
                'kino domowe', 'gry komputerowe', 'steam', 'playstation plus', 'xbox game pass'
            ]
        },
        'Odzież i obuwie': {
            category: 'Osobiste',
            synonyms: [
                'odzież', 'obuwie', 'ubrania', 'ubranie', 'ciuchy', 'buty', 'but',
                'kurtka', 'płaszcz', 'spodnie', 'jeansy', 'sukienka', 'koszula',
                'bluzka', 'sweter', 'bluza', 'tshirt', 'bielizna', 'skarpetki',
                'h&m', 'zara', 'reserved', 'house', 'cropp', 'sinsay', 'mohito',
                'ccc', 'deichmann', 'nike', 'adidas', 'puma', 'new balance',
                'zalando', 'answear', 'modivo', 'eobuwie', 'aboutyou',
                'krawiec', 'szewc', 'przeróbki', 'pranie chemiczne'
            ]
        },
        'Prezenty i wsparcie': {
            category: 'Osobiste',
            synonyms: [
                'prezenty', 'prezent', 'podarunek', 'upominek', 'gift',
                'urodziny', 'urodzinowy', 'imieniny', 'rocznica', 'świąteczne',
                'mikołaj', 'gwiazdka', 'komunia', 'chrzest', 'ślub', 'wesele',
                'wsparcie', 'darowizna', 'darowizny', 'pomoc', 'zbiórka',
                'siepomaga', 'zrzutka', 'charity', 'charytatywne'
            ]
        },
        'Zdrowie i uroda': {
            category: 'Osobiste',
            synonyms: [
                'zdrowie', 'uroda', 'apteka', 'leki', 'lekarstwa', 'tabletki',
                'suplementy', 'witaminy', 'lekarz', 'wizyta lekarska', 'dentysta',
                'stomatolog', 'okulista', 'okulary', 'soczewki', 'ortopeda',
                'fizjoterapia', 'rehabilitacja', 'masaż', 'badania', 'laboratorium',
                'szpital', 'klinika', 'prywatna opieka', 'medicover', 'luxmed', 'enel-med',
                'rossmann', 'hebe', 'sephora', 'douglas', 'kosmetyki', 'makijaż',
                'krem', 'szampon', 'perfumy', 'fryzjer', 'fryzjera', 'strzyżenie',
                'farbowanie', 'salon', 'salon kosmetyczny', 'manicure', 'pedicure',
                'depilacja', 'spa', 'zabieg', 'zabiegi', 'kosmetyczka'
            ]
        },
        'Osobiste - inne': {
            category: 'Osobiste',
            synonyms: []
        },
        
        // ─────────────────────────────────────────────────────────
        // OSZCZĘDNOŚCI I INWESTYCJE
        // ─────────────────────────────────────────────────────────
        'Fundusze': {
            category: 'Oszczędności i inw.',
            synonyms: [
                'fundusze', 'fundusz', 'tfi', 'fundusz inwestycyjny', 'etf',
                'fundusz akcji', 'fundusz obligacji', 'fundusz mieszany'
            ]
        },
        'Giełda': {
            category: 'Oszczędności i inw.',
            synonyms: [
                'giełda', 'gpw', 'akcje', 'obligacje', 'inwestycje', 'trading',
                'makler', 'broker', 'xtb', 'bossa', 'mbank maklerski', 'degiro',
                'revolut trading', 'etoro', 'dywidendy', 'zyski kapitałowe'
            ]
        },
        'Lokaty i konto oszcz.': {
            category: 'Oszczędności i inw.',
            synonyms: [
                'lokata', 'lokaty', 'konto oszczędnościowe', 'oszczędności',
                'depozyt', 'oprocentowanie', 'odsetki', 'kapitalizacja'
            ]
        },
        'Regularne oszczędzanie': {
            category: 'Oszczędności i inw.',
            synonyms: [
                'regularne oszczędzanie', 'oszczędzanie', 'odkładanie', 'cushion',
                'fundusz awaryjny', 'emergency fund', 'poduszka finansowa',
                'ike', 'ikze', 'ppk', 'emerytura', 'iii filar'
            ]
        },
        'Oszczędności i inw. - inne': {
            category: 'Oszczędności i inw.',
            synonyms: ['kryptowaluty', 'bitcoin', 'crypto', 'nft']
        },
        
        // ─────────────────────────────────────────────────────────
        // PŁATNOŚCI (RACHUNKI)
        // ─────────────────────────────────────────────────────────
        'Czynsz i wynajem': {
            category: 'Płatności',
            synonyms: [
                'czynsz', 'wynajem', 'najem', 'mieszkanie', 'opłata za mieszkanie',
                'wynajmujący', 'właściciel', 'administracja', 'wspólnota',
                'fundusz remontowy', 'zaliczka', 'rent'
            ]
        },
        'Gaz': {
            category: 'Płatności',
            synonyms: [
                'gaz', 'gazowy', 'pgnig', 'psp', 'gaz ziemny', 'rachunek za gaz',
                'prognoza gaz', 'rozliczenie gaz'
            ]
        },
        'Ogrzewanie': {
            category: 'Płatności',
            synonyms: [
                'ogrzewanie', 'ciepło', 'ciepła woda', 'mpec', 'veolia',
                'c.o.', 'centralne ogrzewanie', 'kaloryfer', 'piec', 'węgiel',
                'pellet', 'drewno opałowe', 'kominek'
            ]
        },
        'Opłaty i odsetki': {
            category: 'Płatności',
            synonyms: [
                'opłaty', 'odsetki', 'prowizja', 'prowizje', 'opłata bankowa',
                'karta', 'karta kredytowa', 'opłata za kartę', 'konto bankowe',
                'koszty bankowe', 'przelewy', 'opłata za przelew'
            ]
        },
        'Podatki': {
            category: 'Płatności',
            synonyms: [
                'podatki', 'podatek', 'pit', 'vat', 'cit', 'urząd skarbowy',
                'fiskus', 'rozliczenie roczne', 'zwrot podatku', 'dopłata podatku',
                'podatek od nieruchomości', 'podatek od samochodu'
            ]
        },
        'Prąd': {
            category: 'Płatności',
            synonyms: [
                'prąd', 'energia', 'elektryczność', 'tauron', 'pge', 'enea', 'energa',
                'rachunek za prąd', 'licznik', 'kilowatogodziny', 'kwh',
                'prognoza prąd', 'rozliczenie prąd'
            ]
        },
        'Spłaty rat': {
            category: 'Płatności',
            synonyms: [
                'rata', 'raty', 'spłata', 'kredyt', 'pożyczka', 'hipoteka',
                'kredyt hipoteczny', 'kredyt gotówkowy', 'kredyt samochodowy',
                'leasing', 'rata leasingowa', 'raty 0%', 'rrso'
            ]
        },
        'TV, internet, telefon': {
            category: 'Płatności',
            synonyms: [
                'tv', 'telewizja', 'internet', 'telefon', 'abonament', 'play',
                'orange', 't-mobile', 'plus', 'vectra', 'upc', 'multimedia',
                'netia', 'inea', 'światłowód', 'kablówka', 'nc+', 'polsat box go',
                'sim', 'roaming', 'pakiet', 'numer telefonu', 'komórka'
            ]
        },
        'Ubezpieczenia': {
            category: 'Płatności',
            synonyms: [
                'ubezpieczenie', 'ubezpieczenia', 'polisa', 'pzu', 'warta', 'allianz',
                'generali', 'aviva', 'axa', 'compensa', 'ergo hestia',
                'ubezpieczenie na życie', 'ubezpieczenie zdrowotne', 'nfz',
                'prywatne ubezpieczenie', 'grupowe ubezpieczenie', 'składka'
            ]
        },
        'Woda i kanalizacja': {
            category: 'Płatności',
            synonyms: [
                'woda', 'kanalizacja', 'wodociągi', 'ścieki', 'mpwik', 'aquanet',
                'rachunek za wodę', 'zużycie wody', 'licznik wody'
            ]
        },
        'Płatności - inne': {
            category: 'Płatności',
            synonyms: ['wywóz śmieci', 'odpady', 'segregacja']
        },
        
        // ─────────────────────────────────────────────────────────
        // ROZRYWKA
        // ─────────────────────────────────────────────────────────
        'Podróże i wyjazdy': {
            category: 'Rozrywka',
            synonyms: [
                'podróże', 'podróż', 'wyjazd', 'wyjazdy', 'wakacje', 'urlop',
                'wycieczka', 'wycieczki', 'lot', 'loty', 'samolot', 'ryanair',
                'wizzair', 'lufthansa', 'lot polski', 'lotnisko', 'bilet lotniczy',
                'hotel', 'hotele', 'nocleg', 'noclegi', 'booking', 'airbnb',
                'trivago', 'hostel', 'apartament', 'kemping', 'camping',
                'itaka', 'rainbow', 'tui', 'coral travel', 'biuro podróży',
                'all inclusive', 'last minute', 'paszport', 'wiza', 'travel'
            ]
        },
        'Sport i hobby': {
            category: 'Rozrywka',
            synonyms: [
                'sport', 'hobby', 'siłownia', 'gym', 'fitness', 'crossfit',
                'multisport', 'medicover sport', 'fitprofit', 'ok system',
                'basen', 'pływalnia', 'aquapark', 'tenis', 'squash', 'padel',
                'rower', 'bieganie', 'jogging', 'maraton', 'półmaraton',
                'narty', 'snowboard', 'skipass', 'wypożyczalnia', 'kajak',
                'wspinaczka', 'ścianka', 'decathlon', 'go sport', 'intersport',
                'sprzęt sportowy', 'odzież sportowa', 'buty sportowe',
                'fotografia', 'malarstwo', 'szycie', 'robótki', 'gry planszowe',
                'modelarstwo', 'kolekcjonowanie', 'wędkarstwo', 'golf'
            ]
        },
        'Wyjścia i wydarzenia': {
            category: 'Rozrywka',
            synonyms: [
                'wyjście', 'wyjścia', 'wydarzenie', 'wydarzenia', 'event',
                'kino', 'bilet do kina', 'cinema city', 'multikino', 'helios',
                'teatr', 'opera', 'filharmonia', 'koncert', 'koncerty', 'festiwal',
                'mecz', 'stadion', 'bilet na mecz', 'muzeum', 'galeria', 'wystawa',
                'zoo', 'park rozrywki', 'energylandia', 'escape room',
                'kręgle', 'bowling', 'bilard', 'klub', 'dyskoteka', 'impreza',
                'pub', 'bar', 'piwiarnia', 'spotkanie', 'grill', 'przyjęcie'
            ]
        },
        'Rozrywka - inne': {
            category: 'Rozrywka',
            synonyms: [
                'hazard', 'lotto', 'totalizator', 'kasyno', 'zakłady'
            ]
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // SYNONIMY KATEGORII GŁÓWNYCH
    // ═══════════════════════════════════════════════════════════
    
    CATEGORY_SYNONYMS: {
        'Auto i transport': ['auto', 'samochód', 'samochod', 'transport', 'jazda', 'mobilność'],
        'Codzienne wydatki': ['codzienne', 'zakupy', 'bieżące', 'spożywcze'],
        'Dom': ['dom', 'mieszkanie', 'mieszkania', 'domowe', 'nieruchomość'],
        'Dzieci': ['dzieci', 'dziecko', 'dziecięce', 'potomstwo'],
        'Firmowe': ['firmowe', 'firma', 'biznes', 'działalność'],
        'Osobiste': ['osobiste', 'prywatne', 'indywidualne'],
        'Oszczędności i inw.': ['oszczędności', 'inwestycje', 'lokaty', 'giełda', 'odkładanie'],
        'Płatności': ['płatności', 'rachunki', 'opłaty', 'bills', 'media', 'stałe'],
        'Rozrywka': ['rozrywka', 'rekreacja', 'wypoczynek', 'fun', 'relaks', 'zabawa']
    },
    
    // ═══════════════════════════════════════════════════════════
    // SŁOWA KLUCZOWE CZASOWE
    // ═══════════════════════════════════════════════════════════
    
    TIME_KEYWORDS: {
        'ostatni miesiąc': { type: 'relative', value: -1, unit: 'month' },
        'ostatnie miesiące': { type: 'relative', value: -3, unit: 'month' },
        'poprzedni miesiąc': { type: 'relative', value: -1, unit: 'month' },
        'ten miesiąc': { type: 'relative', value: 0, unit: 'month' },
        'bieżący miesiąc': { type: 'relative', value: 0, unit: 'month' },
        'w tym roku': { type: 'currentYear' },
        'ten rok': { type: 'currentYear' },
        'bieżący rok': { type: 'currentYear' },
        'zeszły rok': { type: 'previousYear' },
        'poprzedni rok': { type: 'previousYear' },
        'ubiegły rok': { type: 'previousYear' },
        '2025': { type: 'specificYear', year: 2025 },
        '2024': { type: 'specificYear', year: 2024 },
        '2023': { type: 'specificYear', year: 2023 },
        'styczeń': { type: 'month', month: 1 },
        'luty': { type: 'month', month: 2 },
        'marzec': { type: 'month', month: 3 },
        'kwiecień': { type: 'month', month: 4 },
        'maj': { type: 'month', month: 5 },
        'czerwiec': { type: 'month', month: 6 },
        'lipiec': { type: 'month', month: 7 },
        'sierpień': { type: 'month', month: 8 },
        'wrzesień': { type: 'month', month: 9 },
        'październik': { type: 'month', month: 10 },
        'listopad': { type: 'month', month: 11 },
        'grudzień': { type: 'month', month: 12 }
    },
    
    // ═══════════════════════════════════════════════════════════
    // SŁOWA KLUCZOWE INTENCJI
    // ═══════════════════════════════════════════════════════════
    
    INTENT_KEYWORDS: {
        'sum': ['suma', 'ile', 'wydałem', 'wydałam', 'wydatki', 'koszt', 'koszty', 'łącznie', 'razem', 'total', 'w sumie'],
        'trend': ['trend', 'trendy', 'jak się zmienia', 'zmieniało', 'rośnie', 'maleje', 'tendencja'],
        'compare': ['porównaj', 'porównanie', 'vs', 'versus', 'różnica', 'więcej', 'mniej'],
        'top': ['top', 'ranking', 'największe', 'najwyższe', 'najwięcej', 'główne'],
        'monthly': ['miesięcznie', 'miesięczne', 'miesiącach', 'miesiące', 'każdy miesiąc', 'co miesiąc', 'w poszczególnych', 'którym miesiącu'],
        'average': ['średnia', 'średnio', 'przeciętnie', 'przeciętna'],
        'share': ['udział', 'procent', 'procentowo', '%', 'struktura', 'rozkład'],
        'anomaly': ['anomalia', 'nietypowe', 'odstępstwo', 'dziwne', 'nienormalne']
    },
    
    // ═══════════════════════════════════════════════════════════
    // GŁÓWNA METODA ROZPOZNAWANIA
    // ═══════════════════════════════════════════════════════════
    
    resolve(query) {
        const normalizedQuery = this._normalizeQuery(query);
        const result = {
            originalQuery: query,
            normalizedQuery: normalizedQuery,
            subcategories: [],
            categories: [],
            timeContext: null,
            intents: [],
            synonymsMap: {}
        };
        
        // 1. Szukaj podkategorii
        result.subcategories = this._findSubcategories(normalizedQuery);
        
        // 2. Szukaj kategorii głównych (jeśli nie znaleziono podkategorii)
        if (result.subcategories.length === 0) {
            result.categories = this._findCategories(normalizedQuery);
        }
        
        // 3. Szukaj kontekstu czasowego
        result.timeContext = this._findTimeContext(normalizedQuery);
        
        // 4. Szukaj intencji
        result.intents = this._findIntents(normalizedQuery);
        
        // 5. Buduj mapę synonimów dla promptu
        result.subcategories.forEach(sub => {
            result.synonymsMap[sub.originalTerm] = {
                officialName: sub.officialName,
                category: sub.category
            };
        });
        
        return result;
    },
    
    _normalizeQuery(query) {
        return query
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // usuń akcenty
            .replace(/ł/g, 'l')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },
    
    _findSubcategories(query) {
        const found = [];
        const words = query.split(' ');
        
        for (const [subcatName, data] of Object.entries(this.SUBCATEGORY_SYNONYMS)) {
            for (const synonym of data.synonyms) {
                const normalizedSynonym = this._normalizeQuery(synonym);
                
                // Sprawdź czy synonim występuje w zapytaniu
                if (query.includes(normalizedSynonym)) {
                    // Oblicz confidence na podstawie długości dopasowania
                    let confidence = normalizedSynonym.length / query.length;
                    
                    // Bonus za dokładne dopasowanie słowa
                    if (words.includes(normalizedSynonym) || 
                        words.some(w => w.startsWith(normalizedSynonym) && normalizedSynonym.length >= 3)) {
                        confidence += 0.3;
                    }
                    
                    // Sprawdź czy już nie mamy tej podkategorii
                    const existing = found.find(f => f.officialName === subcatName);
                    if (!existing || existing.confidence < confidence) {
                        if (existing) {
                            found.splice(found.indexOf(existing), 1);
                        }
                        found.push({
                            originalTerm: synonym,
                            officialName: subcatName,
                            category: data.category,
                            confidence: Math.min(confidence, 1)
                        });
                    }
                }
            }
        }
        
        // Sortuj po confidence
        return found.sort((a, b) => b.confidence - a.confidence);
    },
    
    _findCategories(query) {
        const found = [];
        
        for (const [catName, synonyms] of Object.entries(this.CATEGORY_SYNONYMS)) {
            for (const synonym of synonyms) {
                const normalizedSynonym = this._normalizeQuery(synonym);
                if (query.includes(normalizedSynonym)) {
                    found.push({
                        originalTerm: synonym,
                        officialName: catName
                    });
                    break;
                }
            }
        }
        
        return found;
    },
    
    _findTimeContext(query) {
        for (const [keyword, context] of Object.entries(this.TIME_KEYWORDS)) {
            const normalizedKeyword = this._normalizeQuery(keyword);
            if (query.includes(normalizedKeyword)) {
                return { ...context, originalTerm: keyword };
            }
        }
        return null;
    },
    
    _findIntents(query) {
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
        
        return found;
    },
    
    // ═══════════════════════════════════════════════════════════
    // FORMATOWANIE DLA LLM7
    // ═══════════════════════════════════════════════════════════
    
    formatForLLM(resolved) {
        if (resolved.subcategories.length === 0 && resolved.categories.length === 0) {
            return null;
        }
        
        let text = '';
        
        if (resolved.subcategories.length > 0) {
            text += 'PODKATEGORIE:\n';
            resolved.subcategories.forEach(sub => {
                text += `• "${sub.originalTerm}" → oficjalna podkategoria: "${sub.officialName}" (kategoria: "${sub.category}")\n`;
            });
        }
        
        if (resolved.categories.length > 0) {
            text += 'KATEGORIE:\n';
            resolved.categories.forEach(cat => {
                text += `• "${cat.originalTerm}" → oficjalna kategoria: "${cat.officialName}"\n`;
            });
        }
        
        if (resolved.intents.length > 0) {
            text += `\nROZPOZNANA INTENCJA: ${resolved.intents.join(', ')}\n`;
            const suggestedFunc = this.suggestFunction(resolved.intents);
            if (suggestedFunc) {
                text += `SUGEROWANA FUNKCJA: ${suggestedFunc}\n`;
            }
        }
        
        if (resolved.timeContext) {
            text += `\nROZPOZNANY OKRES: ${JSON.stringify(resolved.timeContext)}\n`;
        }
        
        return text;
    },
    
    suggestFunction(intents) {
        if (intents.includes('monthly')) return 'monthlyBreakdown';
        if (intents.includes('trend')) return 'trendAnalysis';
        if (intents.includes('compare')) return 'compareMonths';
        if (intents.includes('top')) return 'topExpenses';
        if (intents.includes('average')) return 'averageExpense';
        if (intents.includes('share')) return 'categoryShare';
        if (intents.includes('anomaly')) return 'getAnomalies';
        if (intents.includes('sum')) return 'sumBySubcategory';
        return null;
    }
};

// Export dla Node.js (jeśli potrzebne)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BudgetAISynonyms;
}
