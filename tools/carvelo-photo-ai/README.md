# CARVELO — worker automatycznej obróbki zdjęć (BETA)

## Status: uruchomiony w GitHub Actions
**8 listopada 2026:** Repozytorium CARVELO jest publiczne. Workflow `.github/workflows/carvelo-photo-worker.yml` uruchamia standardową maszynę Ubuntu GitHub Actions przy zmianach kodu, ręcznie i cyklicznie w minutach **17 i 47 każdej godziny (UTC)**. Workflow po uruchomieniu pobiera maksymalnie jedno zadanie z prywatnej kolejki Supabase. Nie instaluje modelu, jeśli kolejka jest pusta.

Działa autoryzacja GitHub Actions **OIDC**, z weryfikacją podpisu JWT, właściciela repo, stałego ID repozytorium, gałęzi main i konkretnego pliku workflow. Po stronie GitHub Actions **nie są przechowywane** klucze service-role ani hasła bazy. Supabase Edge Function `carvelo-ai-broker` wydaje wyłącznie podpisany, krótkotrwały URL do jednego oryginału i przyjmuje wynik oznakowany logo CARVELO. Repozytorium ma ograniczone uprawnienia workflow: `contents: read`, `id-token: write`.

**Potwierdzone testy:**
- GitHub Actions ↔ Supabase OIDC i odczyt pustej kolejki — **SUCCESS**.
- Instalacja modelu U2Net CPU, rozpakowanie sceny i test segmentacji na publicznej ilustracji przykładowej — **SUCCESS** (run ID 42492815138).
- **Nie wykonano jeszcze end-to-end przetwarzania fotografii użytkownika**, gdyż istniejące 4 zdjęcia mają kategorię `unknown`, a liczba oczekujących zadań wynosi 0.

## Jak działa automatyka
1. Użytkownik dodaje samochód i fotografie, wskazując kategorię **Z zewnątrz**. Powstaje oryginał w prywatnym magazynie, a zdjęcie z obowiązkowym logo CARVELO pozostaje bezpiecznie do akceptacji.
2. Edge Function `carvelo-photos` automatycznie umieszcza zdjęcia kategorii `exterior` w kolejce `pgmq.carvelo_photo_ai`, jeśli styl `showroom-v1` jest aktywny. Zmiana starego zdjęcia `unknown` na `exterior` też zleca obróbkę.
3. GitHub Actions pobiera zadanie krótkotrwałym tokenem OIDC, uruchamia U2Net i komponuje **oryginalne piksele pojazdu** z jednym wzorcowym salonem CARVELO. Następnie nakłada oryginalny plik `assets/brand/carvelo-wordmark-on-dark.svg`.
4. Kandydat trafia do prywatnego magazynu `carvelo-photo-branded` i do `cv_photo_versions` ze statusem `review`.
5. Administrator ogląda nową wersję w sekcji zdjęć, wybiera **Zastosuj wersję AI do moderacji**, a potem **Zatwierdź**. Bez tych dwóch decyzji nie jest podmieniane publiczne zdjęcie.

## Ograniczenia wersji BETA
- U2Net to ogólny model segmentacji. Może źle zamaskować szybę, lusterko, koło lub krawędzie; jakość każdej wersji sprawdza człowiek.
- **Zdjęcia wnętrza oraz widoki za szybami nie są jeszcze przetwarzane.** Pozostają z oryginalnym tłem i logo CARVELO.
- Plik `assets/brand/carvelo-showroom-v1.webp.b64` to **pomniejszona testowa wersja wcześniej zatwierdzonego salonu**. Obraz ma celowo niską rozdzielczość — należy zastąpić go wysokorozdzielczym wzorcem przed profesjonalną publikacją rezultatów.
- Działanie harmonogramu GitHub Actions nie jest gwarantowane co do dokładnej minuty; GitHub może opóźniać wykonanie.
- Obecna klasyfikacja `exterior` pochodzi z wyboru użytkownika, nie z automatycznego rozpoznawania typu zdjęcia; kolejnym etapem jest niezależny klasyfikator i selektywna podmiana widoku przez szyby.
- Żaden płatny zewnętrzny silnik AI nie został podłączony.
- Maszyna nie działa stale: startuje na zadanie według harmonogramu i wyłącza się po przetworzeniu jednego zdjęcia.

## Pliki
- `.github/workflows/carvelo-photo-worker.yml` — harmonogram, bezpieczeństwo i testy.
- `tools/carvelo-photo-ai/broker.py` — pobranie JWT OIDC i jednego zadania.
- `tools/carvelo-photo-ai/render_github.py` — pobranie obrazu, segmentacja, kompozycja i wysyłka do moderacji.
- `tools/carvelo-photo-ai/requirements-gh.txt` — zależności Python.
- `supabase/functions/carvelo-ai-broker/index.ts` — weryfikacja GitHub OIDC i podpisane przekazanie zadania.
- `supabase/functions/carvelo-photos/index.ts` — automatyczne zlecanie zdjęć zewnętrznych i moderacja wersji AI.
- `tools/carvelo-photo-ai/worker.py` — starszy opcjonalny wariant workera, **nieaktywny**, wymagający własnego serwera i sekretów. Nie jest używany przez GitHub Actions.

## Bezpieczeństwo i eksploatacja
Nie upubliczniaj oryginałów ani URL-i z tokenami. Nie umieszczaj klucza `service_role` w GitHub repo, Netlify ani w przeglądarce. Zlecanie może wykonać tylko uwierzytelniony użytkownik z prawem do oferty, odczyt kandydatów kontroluje RLS, a operator CARVELO zatwierdza każdy wynik.

**Uwaga kosztowa:** podstawowe maszyny Github-hosted na publicznym repo są bezpłatne w listopadzie 2026, ale należy monitorować zmiany cennika i limity systemu. Harmonogram uruchamia worker najwyżej raz na pół godziny i pobiera jedno zadanie.
