# CARVELO — stały worker zdjęć (szablon wdrożenia Render)

## Co jest przygotowane
`tools/carvelo-photo-ai/persistent_worker.py` odczytuje zadania bezpośrednio z prywatnej kolejki Supabase/Postgres poprzez istniejące funkcje `cv_ai_claim`, `cv_ai_complete_v3`, `cv_ai_fail`. Model U2Net i CLIPSeg są ładowane leniwie tylko raz na proces (cache `lru_cache`) i używane dla następnych zadań. Wynik otrzymuje oryginalny znak carVelo i trafia wyłącznie do moderacji.

`tools/carvelo-photo-ai/Dockerfile` buduje obraz z przypiętymi zależnościami CPU; `render.yaml` przygotowuje usługę typu **Background Worker**.

## Bezpieczeństwo
**Nie wpisuj kluczy do GitHuba ani przeglądarki.** W Render ustaw w tajnych zmiennych:
- `CARVELO_DATABASE_URL`: pełny prywatny DSN PostgreSQL z TLS, którego użytkownik ma dostęp do istniejących funkcji kolejki i tabel.
- `CARVELO_SUPABASE_URL`: adres projektu.
- `CARVELO_SUPABASE_SERVICE_ROLE_KEY`: tajny klucz Storage.
- `CARVELO_POLL_SECONDS=2` (opcjonalnie).

Nie udostępniaj sekretów w logach ani commitach. Domyślnie nie podłączamy hostingu automatycznie, ponieważ wymaga połączenia konta i akceptacji kosztów. Zamiast tego nadal uruchamia się dotychczasowe GitHub Actions.

Po podłączeniu uruchom dokładnie jednego workera i zatwierdź przynajmniej 3 realne zdjęcia testowe, zanim wyłączysz cron GitHuba. Przed skalowaniem należy monitorować pamięć dla modeli Torch + U2Net. W przypadku aktywnego worker Render sugerowane jest pozostawienie harmonogramu GitHub jako awaryjnego, rzadkiego fallback, a nie równoległej stałej siły obliczeniowej.

## Tryb natychmiastowy GitHub (opcjonalny)
Niezależnie od Render, funkcja Supabase `carvelo-photos` może wyzwalać `workflow_dispatch` za pomocą `CARVELO_GITHUB_DISPATCH_TOKEN` z uprawnieniem Actions:write do **jednego** repozytorium. Nie ma automatycznego dostępu do tego tokenu — musi zostać świadomie ustawiony przez administratora w Supabase secrets.

## Kontekst nowego tła
Zdjęcie referencyjne użytkownika przedstawia dwa samochody. Wzorcowe tło dla automatycznego montażu musi być puste. Istniejące studio v4 zostaje aktywne, dopóki użytkownik nie zatwierdzi czystego tła z fotografii; nie należy używać oryginalnego zdjęcia z samochodami jako tła.
