# CARVELO — plan wdrożenia automatycznej zamiany tła i widoku za szybami
**Data:** 2026-11-08 | **Wersja:** 1.0 | **Status:** PLAN, nie wdrożenie AI  
**Zakres:** istniejący portal carvelov2.netlify.app, panel /panel/, Supabase project CARVELO.

## 1. Punkt wyjścia (sprawdzone w projekcie)
- Działa panel dodawania ofert, upload JPG/PNG/WebP oraz serwerowe znakowanie fotografii kanonicznym plikiem logo CARVELO (biały napis, czerwona litera V).
- Supabase: cv_offers, cv_dealers, cv_profiles, cv_offer_photos, prywatne buckety carvelo-photo-originals i carvelo-photo-branded, Edge Function carvelo-photos.
- Istniejące zdjęcia mają status review; kategoria jest deklarowana przez użytkownika, **nie wykrywana automatycznie przez AI**.
- Brak działającego serwisu AI segmentacji, maski okien, zadaniowej kolejki, kompozycji z salonem, podglądu przed/po i obsługi zadań asynchronicznych.
- W chwili przeglądu: 1 oferta, 4 zdjęcia, 0 zaakceptowanych, wszystkie 4 w kategorii unknown. Materiały nadają się do weryfikacji procesu, lecz nie muszą wystarczyć do jakościowych testów segmentacji; należy dodać min. 30 różnorodnych fotografii.
- Aktualna funkcja Edge nakłada logo synchronicznie na oryginał. Nowy proces należy zbudować jako osobne wersjonowane przetwarzanie, **bez niszczenia obecnych oryginałów i zatwierdzonych wariantów**.

## 2. Docelowy algorytm: klasyfikacja → maski → kompozycja → logo → akceptacja

### 2.1 Exterior — samochód z zewnątrz
1. Model klasyfikacji rozpoznaje fotografię całego auta / częściowo ucięty kadr / niejednoznaczną scenę.
2. Segmentator tworzy dokładną maskę samochodu, uwzględniając szyby, koła, anteny, lusterka, krawędzie i cienkie elementy.
3. Kompozytor wkleja **wyłącznie oryginalne piksele auta** do stałego tła \`carvelo-showroom-v1\`, z dopasowaniem podłoża, perspektywy, skali i cienia kontaktowego. Generatywne odtwarzanie karoserii jest zabronione.
4. Ocena zgodności maski: dla słabych krawędzi, nietypowych kadrów, rozmytych szyb lub uciętych elementów → **oryginalne tło + logo** i status do weryfikacji.
5. Jeżeli przez szyby sfotografowane z zewnątrz widać wnętrze i tło, nie zmieniać wnętrza, deski, siedzeń i odbić; opcjonalny odrębny etap tylko dla pewnych pikseli widoku za szybą.

### 2.2 Interior — wnętrze z widocznym otoczeniem przez szyby
1. Klasyfikacja wnętrza: kokpit / przednie fotele / tylne siedzenia / bagażnik od środka.
2. Model semantyczny wyznacza maski **otworów szyb** (przednia, boczne, tylna), osobno maski ram/słupków/uszczelek, kierownicy, deski, lusterek, tapicerki, wyświetlaczy i innych części auta.
3. Spośród pikseli w obszarze szyb wyznacza piksele **rzeczywistego widoku na zewnątrz**, odróżniając je od refleksów, kropli, przyciemnienia i elementów wnętrza. Maska edycji = „w pełni pewny widok na zewnątrz” ∩ „wnętrze szyby” − „odbicia i elementy pojazdu”.
4. Podstawia perspektywicznie spójny widok do wnętrza \`carvelo-showroom-v1\`, zachowuje naturalne przyciemnienie i subtelne odbicia oryginalnych szyb. Dla kątów niedopasowanych do sceny pozostawia widok oryginalny i zgłasza weryfikację.
5. **Zakaz** zmiany pikseli słupków, ramek szyb, deski rozdzielczej, kierownicy, foteli, podsufitki, lusterek, wyświetlaczy i oznaczeń wyposażenia.
6. W szczególności: nie generować „nowych szyb”, kierownicy czy wyświetlaczy; nie przenosić obrazu salonu na szybę na zasadzie jednolitej naklejki. Zmiana musi obejmować wyłącznie tło **widziane przez szybę**.
7. W przypadku szyb z mocnym odbiciem, bardzo ciemnych szyb, panoramy dachu, deszczu, nietypowych ujęć i niewystarczającej pewności: **bez zmiany widoku + logo**, oznaczyć „do ręcznej decyzji”.

### 2.3 Detail — elementy wyposażenia
Zachować oryginalne tło i sam detal; wyjątek jedynie wtedy, gdy zdjęcie zawiera wyraźny obszar widoku na zewnątrz **przez szybę** i algorytm może go wydzielić bez ingerencji w detal. W przeciwnym razie tylko logo.

### 2.4 Watermark dla 100% zdjęć
Po wszystkich operacjach obrazu i po każdym skalowaniu/rendrowaniu wariantu nanosić **dokładnie ten sam oficjalny plik** \`assets/brand/carvelo-wordmark-on-dark.svg\` (V w kolorze czerwonym). Nie używać generatora AI do rysowania znaku. Nie oferować wyłączenia logo. Oryginał pozostaje bez znaku **wyłącznie w prywatnym Storage**, nigdy w publicznym katalogu.

## 3. Wersjonowanie wzorcowego salonu CARVELO
- Wykorzystać zaakceptowany projekt wirtualnego salonu z rozmowy, bez samochodu i ludzi.
- Zapisać **stały plik wejściowy** \`carvelo-showroom-v1\` jako zasób referencyjny Storage / repo, z niezmiennym hashem SHA-256 i wersją, aby wynik nie różnił się między ofertami.
- Ustalić punkty geometrii posadzki, perspektywę i dozwoloną przestrzeń ekspozycji.
- Szyby od środka wykorzystują wycinek tej samej sceny zgodny z kierunkiem kamery. Nigdy nie zastępować go przypadkowym, każdorazowo generowanym salonem.
- Logo w tle salonu oraz znak wodny oferty muszą używać tego samego wzorca znaku CARVELO; ten na ścianie nie zastępuje logo na zdjęciu.

## 4. Architektura na bazie istniejącego CARVELO
\`\`\`
/panel/ zdjęcia + wybór stylu (domyślnie AUTO)
        ↓
Edge Function carvelo-photos (Auth + role + dealer + walidacja)
        ↓
Supabase Storage / private original (bez zmian)
        ↓
cv_photo_jobs + Supabase Queues (durable queue)
        ↓
Photo Worker / zewnętrzne segmentowanie obrazu
  ├─ klasyfikacja: exterior | interior | detail | unknown
  ├─ exterior: maska pojazdu + showroom
  ├─ interior: maska widoku przez szyby + showroom
  └─ fallback: oryginalne tło
        ↓
kontrola geometrii, jakości maski, zmian niedozwolonych
        ↓
render wariantów + kanoniczne logo CARVELO
        ↓
prywatny Storage, nowa processing_version, status review
        ↓
podgląd PRZED/PO i akceptacja CARVELO
        ↓
oferta opublikowana → zatwierdzona galeria w katalogu
\`\`\`

**Podział odpowiedzialności:** Edge Functions tylko autoryzują, tworzą zadania, odczytują status i zatwierdzają. Pracochłonne maskowanie i renderowanie wykonuje worker o limitach czasu, pamięci i kosztów odpowiednich do przetwarzania obrazów. Komunikacja worker–Supabase z użyciem sekretów po stronie serwera; kluczy nie umieszczać w HTML/JS. Workers muszą być idempotentne, obsługiwać retry (max. 3), dead-letter i kontrolę równoległego przetwarzania jednego photo_id.

## 5. Zmiany bazy danych i Storage (nowa migracja, bez nadpisania starych)
**\`cv_offer_photos\`**: zachować \`original_path\`, \`processed_path\`, \`state\`; dodać \`processing_status\`, \`processing_version\`, \`detected_type\`, \`confidence\`, \`mask_quality\`, \`background_applied\`, \`window_view_changed\`, \`showroom_version\`, \`review_required_reason\`, \`approved_version_id\` oraz \`source_sha256\`. Nowe ścieżki każdej wygenerowanej wersji bez nadpisywania obecnej.
**\`cv_photo_versions\`**: \`id\`, \`photo_id\`, \`result_path\`, \`thumb_path\`, \`background_style\`, \`window_composite\`, \`logo_version\`, \`quality_flags\`, \`mask_path\` (private), \`created_at\`, \`approved_at\`.
**\`cv_photo_jobs\`**: \`job_id\`, \`photo_id\`, \`status\`, \`attempts\`, \`error_code\`, \`created_at\`, \`finished_at\`, \`processing_cost\`; worker zapisuje metadane.
**Buckets**: pozostawić prywatne oryginały; generowane warianty i maski również przechowywać prywatnie do akceptacji. Udostępniać tylko oznakowane, zaakceptowane warianty dla ofert opublikowanych; nigdy pliki \`original_path\`.
**RLS**: dealer — tylko własne zdjęcia, CARVELO — moderacja; anon — tylko gotowa galeria. Weryfikacja tego samego warunku na API, funkcjach i bazie. Publikacja nadal wymaga zaakceptowanego głównego zdjęcia z logo.

## 6. Interfejs użytkownika — konkretne zmiany
W sekcji zdjęć przy dodawaniu oferty:
1. \`Obróbka tła: Automatyczna\` (domyślnie); inne opcje: \`Oryginalne tło\` i \`Do ręcznego sprawdzenia\`.
2. \`Logo CARVELO: obowiązkowe\` — wyłącznie etykieta, żadnego przełącznika.
3. Karta każdego zdjęcia: \`Wykryto: nadwozie / wnętrze / detal\`, \`Tło: salon / widok za szybami / bez zmian\`, \`W trakcie / do akceptacji / zatwierdzone / błąd\`.
4. Podgląd \`Oryginał ↔ CARVELO\` (suwak porównawczy) i podgląd obszaru zmodyfikowanego; administrator widzi maskę do kontroli.
5. \`Zatwierdź\`, \`Popraw maskę / ponów\`, \`Zachowaj oryginalne tło z logo\`. Dealer może wskazać błędny typ, ale nie może zaakceptować własnego zdjęcia ani obejść kontroli publikacji.
6. Zmiany statusu oferty i galerii muszą odzwierciedlać wersję zaakceptowaną, nie „najnowszą z AI”.

## 7. Etapy realizacji (kolejność, z kryteriami wejścia/wyjścia)
**Etap A — niezawodny silnik i zasoby**
- Dodać wersjonowany asset salonu CARVELO do źródeł i Storage; zapisać checksums.
- Dodać migrację dla jobs, photo_versions i pól statusów; RLS + testy uprawnień.
- Uruchomić Supabase Queues (pgmq) i osobny worker segmentacji/kompozycji; dobór dostawcy dopiero po analizie ceny za zdjęcie, warunków licencji i lokalizacji przetwarzania.
- Wyjście: job tworzy się, przechodzi retry i kończy się bez nadpisania oryginału.

**Etap B — zewnętrzne ujęcia aut**
- Segmentacja maski pojazdu, korekta perspektywy, wspólna scena, bez generatywnej zmiany auta.
- Quality gate dla krawędzi, szyb i cieni; fallback.
- Wyjście: >=95% z zatwierdzonego zestawu testowego bez zniekształceń elementów auta; reszta trafia do sprawdzenia, nie publikuje się automatycznie.

**Etap C — wnętrze i szyby**
- Oddzielne maski szyb, widoku zewnętrznego, refleksów, ramek i wnętrza.
- Dobrane perspektywicznie okno showroomu CARVELO; ochrona pikseli wnętrza; gdy brak pewności, oryginalny widok + logo.
- Wyjście: żadne elementy wnętrza nie są zmienione; kontrola wizualna wszystkich zdjęć testowych z szybami, w tym szyb mocno przyciemnionych.

**Etap D — panel, moderacja i katalog**
- Pokazać przed/po, wykryty typ, status, „zachowaj oryginał”, reprocess.
- Wersjonować akceptację i generować miniatury z dokładnie tym samym logo.
- Publiczny katalog pobiera wyłącznie zaakceptowane zdjęcia dla statusu oferty \`published\`.
- Wyjście: kompleksowy test: dealer → upload → AI → CARVELO zatwierdza → publikacja → widok w wyszukiwarce.

**Etap E — testy produkcyjne i rozliczenie**
- Próbka min. 30–50 ujęć: jasne/czarne auta, refleksy, szkło panoramiczne, zdjęcia wnętrza, różne proporcje i cięcia, częściowe przesłonięcia.
- Zmierzyć koszt rzeczywisty na fotografię, liczbę poprawek i odsetek fallbacków.
- Scenariusze: awaria AI, błędna klasyfikacja, podmiana ścieżki, nieautoryzowany dostęp, przerwanie zadania, reprocessing zdjęcia już zatwierdzonego.
- Wyjście: brak wycieku oryginałów, brak możliwości usunięcia logo, brak automatycznej zmiany elementów wyposażenia, poprawne naliczanie wersji i uprawnień.

## 8. Warunki akceptacji
- **100%** zdjęć udostępnionych publicznie ma wypalone oficjalne logo CARVELO po obróbce i tworzeniu miniatur.
- **0** generatywnie zmodyfikowanych elementów auta lub wnętrza; poza wyciętym obszarem widoku za szybami piksele auta są nienaruszone (wyjątek zwykła bezpieczna korekta ekspozycji bez zmiany treści).
- **0** zdjęć oryginalnych w publicznym Storage.
- Bezpieczne fallbacki przy niejednoznacznej masce; ręczna akceptacja dla ryzykownych zdjęć.
- Zmiana tła tylko dla exterior i pewnych pikseli widoku przez szyby; szczegóły auta zachowane.
- Wersja zaakceptowana jest stabilna do momentu następnego zatwierdzenia.
- RLS, worker i funkcje serwerowe przeszły testy negatywne z dwoma dealerami.
- Pierwsze cztery obecnie przesłane zdjęcia można przetworzyć ponownie bez konieczności przesyłania od nowa.

## 9. Ryzyka i decyzje architektoniczne
- **Koszty zewnętrznego AI:** nie szacować bez próby na realnych zdjęciach; żaden płatny dostawca nie będzie podłączany bez zatwierdzenia zasad i kosztu.
- **Dokładność przez szyby:** nie istnieje gwarancja automatycznej, fotorealistycznej wymiany tła dla każdego kadru; fallback jest warunkiem bezpieczeństwa.
- **RODO i prawa do zdjęć:** sprawdzić umowę z dostawcą AI, przetwarzanie przez strony trzecie i prawo dealerów do udostępniania zdjęć.
- **Stan zastany:** obecny synchroniczny watermark nie jest jeszcze funkcją AI. Plan nie oznacza działającej podmiany tła. Aktualnych danych nie kasować.
- **Nie zmieniać brandingu:** jedyny znak to zatwierdzony \`assets/brand/carvelo-wordmark-on-dark.svg\` + dopasowana do jasnych teł wersja z tego samego projektu. Czerwona litera V, brak rysunku samochodu.

### Źródła techniczne
- Supabase Queues: https://supabase.com/docs/guides/queues
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Storage RLS: https://supabase.com/docs/guides/storage/security/access-control
- Obowiązująca baza projektu: \`docs/SPECYFIKACJA_MODULU_ZDJEC_CARVELO.md\`


## Stan prac — 8 listopada 2026

**Uruchomiono w Supabase:** prywatną kolejkę pgmq carvelo_photo_ai, tabele cv_photo_jobs, cv_photo_versions i cv_photo_styles, reguły RLS, serwerowy trigger tworzenia komunikatów i atomową akceptację wariantu AI wyłącznie przez rolę service_role. Wdrożona Edge Function carvelo-photos (v2) obsługuje klasyfikację i zapytania o status AI. Panel pokazuje kategorie zdjęć, pracę kolejki i kandydatów do akceptacji.

**Kod przygotowany, ale worker nie działa produkcyjnie:** tools/carvelo-photo-ai/worker.py segmentuje pojazd modelem u2net i zapisuje prywatną wersję z oficjalnym logo CARVELO do zatwierdzenia. Nie podłączono serwera, który wykonywałby przetwarzanie.

**Pozostałe warunki aktywacji:** umieścić zatwierdzony obraz salonu na serwerze workera, uruchomić Python + model i prywatne sekrety Supabase, przeprowadzić testy 30+ zdjęć, następnie ustawić CARVELO_AI_WORKER_ENABLED=true w środowisku Edge Function. Dopóki silnik nie działa, request_ai zwraca HTTP 503 i nie tworzy zadań oczekujących bez wykonawcy.

**Dopiero kolejny etap:** rozpoznawanie i modyfikacja otoczenia widocznego przez szyby wnętrza. Obecny worker działa wyłącznie na ujęciach exterior. Nie włączono żadnego płatnego dostawcy AI.

**Akceptacja:** kandydata AI ogląda administrator, potem ręcznie włącza wariant do moderacji i zatwierdza zdjęcie. Oryginały pozostają prywatne i nietknięte; watermark CARVELO jest obowiązkowy.

## Aktualizacja — GitHub Actions worker aktywowany 8 listopada 2026

Worker zdjęć zewnętrznych (BETA) jest uruchomiony na darmowym standardowym GitHub-hosted runnerze w publicznym repo CARVELO. Odczytuje prywatną kolejkę Supabase przez broker z weryfikacją GitHub OIDC, bez przechowywania kluczy administracyjnych w GitHub. Harmonogram: 17 i 47 minuta każdej godziny UTC, oraz ręczne uruchomienie i testowe uruchomienie przy zmianach kodu. Wykonuje najwyżej jedno zdjęcie na uruchomienie. Model U2Net, logo ze wzorcowego CARVELO SVG, obraz wynikowy wymaga dwuetapowej akceptacji w panelu.

Testy potwierdzone: OIDC ↔ Supabase SUCCESS; instalacja zależności CPU SUCCESS; segmentacja publicznego obrazu testowego, kompozycja z salonem i logo SUCCESS (GitHub Actions run 42492815138). Funkcja carvelo-photos v3 zleca zadania automatycznie dla zdjęć oznaczonych jako exterior. Flaga showroom-v1 is_active=true w cv_photo_styles. Przed testem na prawdziwym obrazie: w bazie są 4 zdjęcia typu unknown, 0 zadań. Nie uruchomiono jeszcze obróbki zdjęcia rzeczywistego klienta end-to-end.

Ograniczenia: testowy zasób salonu zapisany na razie w skompresowanej wersji podglądowej w repo, do wymiany na pełną rozdzielczość przed profesjonalną publikacją rezultatów. Typ zdjęcia jest wybierany przez użytkownika; autonomiczna klasyfikacja i obróbka widoku za szybami będą kolejnym krokiem. Klucze Supabase nie są wysyłane do GitHub Actions. Po sprawdzeniu jakości administrator ręcznie akceptuje każdą wersję AI.
