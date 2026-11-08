# CARVELO — specyfikacja wdrożeniowa modułu obróbki zdjęć
**Wersja:** 1.0 · **Data:** 8 listopada 2026 · **Status:** DO WDROŻENIA (nie jest to funkcja uruchomiona)  
**Projekt:** CARVELO, repozytorium \`krzysztofjozefiakipff-cpu/gregarious-horse-a1b3b9\`  
**Docelowy interfejs:** \`/panel/\`; **backend:** Supabase Auth, PostgreSQL, Storage oraz funkcje serwerowe.

## 1. Cel biznesowy
Wszystkie fotografie **publikowane w CARVELO** mają mieć jednakowy, premium charakter. **Każde zdjęcie i każda publiczna miniatura muszą mieć trwale naniesione logo CARVELO** (watermark zapisany w pikselach pliku, nigdy tylko nakładka CSS). Fotografie całych samochodów z zewnątrz mają — po pomyślnej weryfikacji jakości — otrzymywać spójne tło wirtualnego salonu CARVELO. Wnętrza, elementy wyposażenia i detale zachowują oryginalne tło. Sam samochód, kolor lakieru, koła, proporcje, logo producenta i wyposażenie nigdy nie mogą być generatywnie zmieniane.

**Rozróżnienie:** prywatny oryginał techniczny pozostaje bez znakowania, aby możliwa była ponowna obróbka; nigdy nie jest publikowany ani udostępniany przez publiczne API. Wersja na stronie, w karcie samochodu, miniaturach i eksporcie zawsze zawiera logo.

## 2. Zakres MVP i reguły niepodlegające negocjacji

| Typ obrazu / rozpoznanie | Obróbka tła | Logo CARVELO | Wytyczne |
| --- | --- | --- | --- |
| Zewnętrzne ujęcie całego samochodu | Tak, o ile maska i klasyfikacja spełniają progi jakości | **Obowiązkowe** | Zachowaj samochód pikselowo, z zachowaniem geometrii; można dopasować tło, cień i kolorystykę *otoczenia* |
| Zewnętrzny kadr z uciętym samochodem, niepewna maska | Nie; oryginalne tło + kolejka do weryfikacji | **Obowiązkowe** | Nie ryzykuj „dorabiania” części auta |
| Wnętrze (kabina, kokpit, fotele, bagażnik od środka) | **Nigdy** | **Obowiązkowe** | Bez zmiany układu i obiektów; tylko korekta ekspozycji / balansu bieli |
| Detale (lampy, felgi, logo producenta, silnik, tapicerka itd.) | **Nigdy** | **Obowiązkowe** | Nie retuszuj cech wpływających na opis oferty |
| Materiał nierozpoznany / błąd AI | Nie; zachowaj tło, oznacz „do sprawdzenia” | **Obowiązkowe** | Bezpieczny fallback, żadnej automatycznej zamiany tła |
| Materiał niebędący prawidłową fotografią pojazdu | Nie publikuj automatycznie | — | Odrzuć lub skieruj do moderacji |

**Nie może istnieć** przycisk „Usuń logo” ani opcja publikowania oryginału. Dealer i pracownik mogą zmienić kategorię zdjęcia na „wnętrze/detal/bez podmiany tła”, zmienić kolejność, przesłać nowe zdjęcie i zaakceptować prawidłową wersję. Przy każdej zmianie źródła lub tła następuje ponowny rendering znaku firmowego.

## 3. Brandbook i „wirtualny salon CARVELO”

### 3.1 Zestaw referencyjny (asset bundle)
Przed wdrożeniem AI zatwierdzić komplet assetów:
- Kanoniczne logo CARVELO: plik SVG/PNG alpha w jasnej i ciemnej wersji, przechowywany w kontrolowanym magazynie; **nie pobierać przypadkowych grafik logo z Internetu**.
- Jedna zatwierdzona plansza tła \`carvelo-showroom-v1\` (minimalistyczny salon premium, neutralny grafit i subtelne światło, posadzka i perspektywa pozwalające na naturalny montaż auta, bez logo innych marek, bez osób).
- Parametry perspektywy podłoża i cienia kontaktowego; wersja 4:3 do głównego zdjęcia, adaptacje 16:9 i miniatury.

### 3.2 Zasady logotypu
- Preferowane umiejscowienie: prawy dolny róg; gdy zasłania pojazd/ważne informacje: lewy dół, prawy góra, lewy góra.
- Margines „safe area”: min. 2,5–3% krótszego boku, w dużych kadrach maks. 42 px; logo zajmuje orientacyjnie 12–16% szerokości (weryfikacja wizualna na miniaturach).
- Standard: 90% krycia; jasny lub ciemny wariant wybierany automatycznie dla kontrastu, w razie potrzeby na delikatnej półprzezroczystej płytce.
- **Logo ma być czytelne po wygenerowaniu każdej docelowej rozdzielczości**; renderować watermark osobno dla wariantu 1600 px, 960 px i miniatur, a nie tylko skalować oznakowane pełne zdjęcie.
- Nie zasłaniać tablicy VIN, informacji o wyposażeniu ani istotnych cech pojazdu. Dopuszcza się nieznaczną zmianę pozycji logo, nigdy jego usunięcie.
- Zapisuj \`logo_version\`, \`logo_position\` i \`logo_applied = true\` jako wynik operacji procesora, **nie jako deklarację klienta**.

### 3.3 Bezpieczeństwo wizerunku auta
Nie generować zmienionego lakieru, reflektorów, kół, karoserii, elementów wnętrza, pakietów stylistycznych ani tabliczek modelu. Przy wymianie tła używać wyciętej **oryginalnej warstwy pojazdu** (maskowanie / compositing), a nie obrazowego „odtwarzania samochodu” z promptu. Zachować proporcje, kąt ujęcia i perspektywę. W razie halo na krawędziach, nienaturalnych szyb lub niezgodnego odbicia — pozostawić oryginalne tło z logo i skierować do poprawy.

## 4. Integracja z obecnym CARVELO
Stan zastany (zweryfikowany w repozytorium i Supabase):
- \`public.cv_offers\`: oferta, status \`draft|pending|published|rejected\`, \`dealer_id\`, \`created_by\`.
- \`public.cv_profiles\`: role \`admin|staff|dealer|unassigned\`; \`public.cv_dealers\`: dealerzy.
- \`panel/index.html\` + \`panel/app.js\`: panel formularza oferty; jeszcze bez uploadu zdjęć.
- \`catalog-live.js\`: publiczny odczyt opublikowanych ofert Supabase; nie pobiera zdjęć.
- Brak tabel na zdjęcia i brak gotowego pipeline'u; niniejszy plik **niczego nie wdraża w produkcyjnej bazie**.

### 4.1 Uprawnienia
- **Admin CARVELO:** przegląd wszystkich zdjęć, zatwierdzanie i odrzucanie, zmiana stylu salonu, publikacja oferty, ponowne przetwarzanie.
- **Pracownik CARVELO (\`staff\`):** upload do każdej oferty, korekta kategorii, wybór bezpiecznego tła, przegląd i akceptacja przetworzonych zdjęć, moderacja zgodna z uprawnieniami do oferty.
- **Dealer (\`dealer\`):** upload oraz zarządzanie zdjęciami **tylko własnej firmy**, wybór kategorii „wnętrze/detal” i prośba o ponowne przetworzenie; brak publikacji bez moderacji CARVELO.
- **Anon:** wyłącznie gotowe, zaakceptowane i oznakowane zdjęcia **opublikowanych** ofert.
- Każda zmiana jest sprawdzana po stronie serwera i w RLS; nie ufać \`dealer_id\` z przeglądarki.

## 5. UX panelu — ekran „Zdjęcia samochodu”
W istniejącym formularzu dodawania/edycji oferty dodać sekcję **Zdjęcia**:
- Drag & drop lub przycisk „Dodaj zdjęcia” (multi-upload, także telefon).
- Licznik, miniatury, postęp osobno dla każdego pliku.
- W każdym kafelku: **Oryginał techniczny** (dostępny wyłącznie uprawnionemu personelowi do porównania), **Zdjęcie CARVELO** (z logo), typ rozpoznania, status, ewentualny powód ręcznej weryfikacji.
- Ustawienie dla zewnętrznych: \`Wirtualny salon CARVELO\` / \`Oryginalne tło\`. Wnętrze/detal: wybór salonu niedostępny.
- Pole „Logo CARVELO: **Zawsze włączone**” jako informacja (nie checkbox, nie do wyłączenia).
- Działania: „Podejrzyj”, „Zaakceptuj”, „Odrzuć”, „Przetwórz ponownie”, „Ustaw jako główne”, „Zmień kolejność”, „Usuń”.
- Statusy: \`uploaded\` → \`queued\` → \`classifying\` → \`processing\` → \`review\` → \`approved\` lub \`failed\` / \`rejected\`.
- Po ściśle określonym błędzie AI: pokaż opcję „Zachowaj oryginalne tło + dodaj logo”; dla wnętrza/detalu zawsze w ten sposób.
- Przed publikacją wymagane co najmniej jedno zaakceptowane zdjęcie główne z logo (warunek po stronie backendu). Pozostałe mogą czekać na obróbkę, lecz nie trafią do galerii aż do akceptacji.

### 5.1 Stany wyjątkowe
Niepoprawny typ pliku, zbyt duży obraz, podejrzenie złośliwego pliku, przerwany upload, brak zgody na wykorzystanie zdjęcia, awaria dostawcy AI, duplikat fotografii lub brak pewności rozpoznania: czytelny komunikat + możliwość ponowienia, nigdy „goły” oryginał w katalogu.

## 6. Pipeline przetwarzania — serwerowo

\`\`\`
Użytkownik CARVELO/dealer
    ↓ (Auth + rola + prawa do oferty)
POST /photos/upload-url → walidacja → krótko ważny podpisany upload
    ↓
Supabase Storage: carvelo-photo-originals (PRIVATE)
    ↓
cv_offer_photos / cv_photo_jobs → QUEUE
    ↓
Worker: walidacja pliku, EXIF orientacja, usunięcie GPS,
        analiza typu (exterior_full / interior / detail / unknown)
    ↓
Jeżeli exterior_full i maska bezpieczna: kompozycja z salonem CARVELO
W przeciwnym razie: oryginalne tło
    ↓
Korekta / kadrowanie BEZ modyfikacji pojazdu
    ↓
Watermark CARVELO → render 1600 px / 960 px / thumbnail
    ↓
Kontrola czy logo faktycznie wypalone w obrazie (wynik procesora + walidacja)
    ↓
Storage: carvelo-photo-processed (PRIVATE) → review
    ↓
Akceptacja personelu → approved
    ↓
Publikacja oferty + approved → kopia wyłącznie wersji z logo
    ↓
Storage: carvelo-photo-public (PUBLIC) → galeria CARVELO
\`\`\`

**Orkiestracja:** Supabase Edge Functions do autoryzacji, wydawania uploadów i sterowania zadaniami. Długotrwała obróbka AI ma działać w osobnym workerze/kolejce (nie w oczekiwaniu przeglądarki); Edge Function może uruchamiać job i odbierać webhook. Procesor może używać zewnętrznego silnika segmentacji/AI, ale klucze dostępu tylko na serwerze. Worker ponawia błędy maks. 3 razy z backoff, jest idempotentny względem \`photo_id + processing_version\` i chroni przed wyścigami przy publikacji.

**Priorytet:** bezpieczna klasyfikacja i zgodność samochodu, nie agresywna zamiana tła. Jeśli wynik jest niepewny, publikowalną alternatywą jest ta sama fotografia z oryginalnym tłem + obowiązkowym logo.

## 7. Proponowany model danych i migracja (DO NAPISANIA)

### 7.1 \`public.cv_offer_photos\`
| Kolumna | Typ / reguła |
| --- | --- |
| \`id\` | UUID PK |
| \`offer_id\` | UUID FK \`cv_offers.id\`, ON DELETE CASCADE |
| \`uploaded_by\` | UUID FK \`auth.users.id\` |
| \`original_path\` | text, tylko private bucket |
| \`processed_path\` | text nullable, tylko private bucket |
| \`public_path\` | text nullable, ustawiane wyłącznie przez serwer po publikacji |
| \`type_detected\` | enum \`exterior_full / interior / detail / unknown\` |
| \`type_effective\` | enum jak wyżej; nadpisanie podlega uprawnieniom i audytowi |
| \`type_confidence\` | numeric 0–1 nullable |
| \`background_style\` | \`showroom_v1 / original\` |
| \`background_changed\` | boolean DEFAULT false, potwierdzone przez worker |
| \`logo_applied\` | boolean DEFAULT false, ustawiane wyłącznie przez worker |
| \`logo_version\` | text nullable; asset + wersja |
| \`logo_position\` | text nullable; walidowany słownik |
| \`processing_version\` | text; wersja algorytmu / ustawień |
| \`processing_status\` | enum \`uploaded / queued / classifying / processing / review / approved / failed / rejected\` |
| \`moderated_by\`, \`moderated_at\` | UUID / timestamptz nullable |
| \`is_cover\`, \`sort_order\` | boolean / integer; jedna okładka na ofertę |
| \`width\`, \`height\`, \`mime_type\`, \`size_bytes\`, \`sha256\` | metadane do walidacji/duplikatów |
| \`error_code\`, \`created_at\`, \`updated_at\` | diagnoza i audyt |

**Reguły spójności:** \`approved\` wymaga \`processed_path\`, \`logo_applied=true\` i wersji logo; \`public_path\` wymaga \`approved\` oraz opublikowanej oferty i zatwierdzenia zaufanym procesem; uniknąć bezpośredniego zapisu tych pól przez użytkowników. Dodatkowe ograniczenie: jedno główne zdjęcie na ofertę (unikalny indeks częściowy na \`offer_id\` WHERE \`is_cover=true\`).

### 7.2 \`public.cv_photo_jobs\` (niepubliczne API)
\`id\`, \`photo_id\`, \`job_type\`, \`status\`, \`attempt\`, \`idempotency_key\`, \`provider\`, \`processing_version\`, \`started_at\`, \`finished_at\`, \`error_code\`, \`created_at\`. Rejestr kosztu / czasu opcjonalny; bez przechowywania kluczy AI.

### 7.3 \`public.cv_photo_audit\`
\`id\`, \`photo_id\`, \`actor_id\`, \`action\`, \`previous_state\`, \`next_state\`, \`reason\`, \`created_at\`. Audyt czytelny dla administratora, append-only; serwer wymusza zapis zdarzeń.

### 7.4 Konfiguracja tła
Tabela lub konfiguracja serwerowa \`cv_photo_styles\`: \`style_code\`, \`background_asset_path\`, \`logo_asset_version\`, \`enabled\`, \`created_by\`, \`created_at\`. W pierwszym wydaniu tylko \`showroom_v1\` i \`original\`.

### 7.5 Supabase Storage
- \`carvelo-photo-originals\` — private, prywatny oryginał bez logo, brak publicznego list/read.
- \`carvelo-photo-processed\` — private, renderowane wersje robocze, signed read tylko dla uprawnionych.
- \`carvelo-photo-public\` — publiczne, zawiera wyłącznie zaakceptowane, opublikowane i oznakowane warianty. Brak uploadu z klienta.
- Klucze obiektów: \`<dealer_id>/<offer_id>/<photo_id>/<version>/<variant>.webp\`, bez adresów e-mail / danych osobowych.
- Przy wycofaniu oferty usunąć publiczne warianty i unieważnić cache/CDN (wersjonowane adresy + strategia TTL). **Uwaga:** plik wcześniej opublikowany publicznie może pozostać w zewnętrznych pamięciach podręcznych; dlatego przed publikacją wymagana jest akceptacja.
- Storage RLS na \`storage.objects\`, walidacja ścieżek i ról; nie utożsamiać posiadania ID z uprawnieniem do obiektu.

## 8. Kontrakt API / Edge Functions (projekt)
Każdy endpoint wymaga JWT użytkownika oraz sprawdzenia dostępu do oferty i powiązanego dealera; wyjątkiem jest publiczny odczyt zatwierdzonych zdjęć opublikowanych ofert.

| Metoda i endpoint | Cel |
| --- | --- |
| \`POST /photo-upload-init\` | \`offer_id\`, MIME, size, sha256 → walidacja i podpisany upload do private bucket |
| \`POST /photo-upload-complete\` | Identyfikator uploadu → sprawdzenie realnego obiektu i kolejka |
| \`GET /offer-photos?offer_id=...\` | Zdjęcia i statusy widoczne dla uprawnionych |
| \`POST /photo-reprocess\` | Ponów / zmień bezpieczny typ i styl (bez możliwości wyłączenia logo) |
| \`POST /photo-moderate\` | Akceptuj / odrzuć / komentarz |
| \`POST /photo-reorder\` | Zmień kolejność / okładkę w zakresie swojej oferty |
| \`POST /offer-publication-check\` | Serwerowy warunek logo + zaakceptowana okładka przed publikacją |

**Nie ufać** wartościom \`logo_applied\`, \`processed_path\`, \`public_path\`, \`dealer_id\`, \`status\` ani podanej lokalizacji w payloadzie z przeglądarki. Operacje uprzywilejowane implementować po stronie serwera; wykorzystanie klucza service-role tylko w sekretach serwera, nigdy w \`index.html\` ani \`panel/config.js\`. Publiczne API galerii używa gotowych bezpiecznych URL-i i zwraca \`alt\`, rozmiary, \`sort_order\`.

## 9. Parametry uploadu i formatowanie
Wstępne parametry konfigurowalne:
- Do 40 zdjęć na ofertę; max 20 MB na plik (osobne limity rozdzielczości, pikseli i budżetu przetwarzania).
- JPEG, PNG, WebP; HEIC/HEIF w etapie rozszerzenia, po testach konwersji.
- Minimalna rozdzielczość robocza zalecana: 1200 px dłuższego boku. Bardzo małe/rozmyte zdjęcia: do ręcznej weryfikacji.
- Normalizacja orientacji EXIF, usuwanie GPS i wrażliwych metadanych, strip EXIF w plikach publicznych.
- Publiczne warianty: okładka 1600 px, karta 960 px, miniatura 480 px, preferowany WebP z kontrolą jakości. Osobne generowanie logo dla każdego wariantu.
- Zachować oryginalne proporcje bazowego zdjęcia; ewentualny crop okładki nie może obciąć ważnych części samochodu.
- Sprawdzać realny MIME/magic bytes, limit rozmiaru po dekodowaniu, liczby pikseli, ochronę przed decompression bombs. Walidować uprawnienia, kwoty uploadów, rate limiting oraz rozsądne czasy życia podpisanych URL-i.

## 10. Akceptacja, bezpieczeństwo, testy
**Kryteria odbioru MVP (wszystkie obowiązkowe):**
1. Każda publicznie widoczna fotografia i miniatura zawiera rzeczywiście wypalone, czytelne logo CARVELO.
2. Zdjęcia wnętrza i detalu nigdy nie otrzymują nowego tła, również po ręcznym przeklasyfikowaniu.
3. Zewnętrzny samochód zachowuje geometrię, kolor, detale; przy niepewnej masce fallback do oryginalnego tła + logo.
4. Dealer A nie może podglądać, moderować ani usuwać prywatnych zdjęć dealera B; testować także bezpośrednio przez Storage API / REST.
5. Nieopublikowany samochód nie ujawnia zdjęć ani prywatnych URL-i użytkownikom anonimowym.
6. Przeglądarka nie może opublikować oryginału, ustawić \`logo_applied=true\`, przełączyć \`approved\` ani podmienić \`public_path\` poza dopuszczonym procesem.
7. Oferta nie publikuje się bez minimum jednego zaakceptowanego zdjęcia głównego z logo; zmiana statusu \`cv_offers\` poza aplikacją również musi zostać zablokowana przez bazę lub zaufany serwer.
8. Ponowienie joba nie tworzy duplikatów; ponowne przetworzenie zachowuje historię poprzednich wersji.
9. Na telefonie możliwy upload wielu zdjęć, śledzenie postępu, poprawienie typu i zatwierdzenie.
10. Zmiana oferty na \`draft\` / \`rejected\` usuwa publiczne kopie lub uniemożliwia ich dalsze serwowanie według przyjętej strategii.
11. Testy automatyczne: klasyfikacja / fallback, logo pixel-check, RLS, API z błędnym JWT, wycieki EXIF, duplikaty, duże obrazy, błędy dostawcy, retry, link publiczny / prywatny.
12. Testy wizualne na min. 30 zdjęciach: SUV jasny i ciemny, różne kąty, szyby, chrom, refleksy, otwarte drzwi/bagażnik, wnętrze i detale.

**Dodatkowe ostrzeżenia:** maski AI wymagają kontroli jakości; potwierdzenie watermarku przez bazową flagę nie zastępuje weryfikacji plików. Zapobiegać wstrzykiwaniu poleceń przez nazwy plików i metadane. Ograniczyć retencję oryginałów zgodnie z umowami i prawami do zdjęć. Udokumentować podstawę prawną używania fotografii dostarczonych przez dealerów oraz warunki zewnętrznego procesora AI i przetwarzania danych.

## 11. Plan implementacji (kolejność prac)
**Faza A — fundamenty:** zatwierdzić oficjalne logo i asset salonu; przygotować migrację DB, buckety private/public, Storage RLS, uprawnienia, testy negatywne.  
**Faza B — upload i logo:** podpisany upload, walidacja, worker bez AI, watermark każdej fotografii, formaty i warianty, moderacja. **To pierwszy bezpieczny release MVP.**  
**Faza C — inteligentne tło:** klasyfikacja zewnętrzne/wnętrze/detal; bezpieczna segmentacja i kompozycja wyłącznie zewnętrznych pełnych ujęć; fallback bez zmiany tła.  
**Faza D — publikacja i katalog:** ograniczenia DB/server na publikację, galeria oferty i zdjęcie główne, publiczne warianty, cache invalidation, integracja z \`catalog-live.js\`.  
**Faza E — testy i operacje:** e2e dealer/admin, visual QA, koszty na zdjęcie, monitoring workerów, błędów i limitów, dokumentacja.

**Decyzje do zatwierdzenia przed implementacją:** ostateczny plik logo CARVELO i logo_version; jedna scena salonu CARVELO; dostawca segmentacji/worker i jego koszty; limit zdjęć; zasady retencji oryginałów. Te decyzje nie blokują rozpoczęcia projektowania DB/UX ani samego modułu watermarkowania.

## 12. Definition of Done
Wersję MVP można uznać za gotową dopiero gdy: istnieje działający upload w obecnym \`/panel/\`, zdjęcia przetwarzane są na serwerze, oryginały pozostają prywatne, logo widnieje na 100% publicznych wariantów, wnętrza i detale pozostają nietknięte pod względem tła, kontrola RLS i publikacja są egzekwowane po stronie backendu, galeria pojawia się na publicznej karcie samochodu, a testy jakości i bezpieczeństwa przechodzą pozytywnie.

---
**Status dokumentu:** specyfikacja do realizacji. **Brak jeszcze działającego modułu fotograficznego w panelu lub bazie**; żadne schematy, Storage ani funkcje AI nie zostały utworzone przez zapisanie niniejszego dokumentu.

### Dokumentacja techniczna
- Supabase Storage RLS: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase PostgreSQL RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
