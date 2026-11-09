# CARVAMO — branding i migracja domeny

Status: przygotowanie na gałęzi `rebrand/carvamo-com`. Nie jest to wdrożenie produkcyjne.

## Marka
- Nazwa publiczna: **CARVAMO** (dawniej CARVELO)
- Domena docelowa: **https://carvamo.com** (własność i DNS do weryfikacji)
- Hasło: **Dobra cena. Prosto od dealera.**
- Brand book: Carvamo Brand Book 1.0; przed wdrożeniem pobrać oryginalne pliki logo, nie odtwarzać go z przybliżenia.
- Kolory: granat `#102A34`, turkus `#008F83`, mięta `#31E7D0`, tło `#F1F6F5`, CTA `#006B62`.
- Font: Inter; fallback Arial.
- Logo: turkusowy haczyk w miejscu litery „v”; obowiązkowy znak CARVAMO na zdjęciach, w salonie i komunikacji.

## Plan bezpiecznego wdrożenia
1. Zidentyfikować wszystkie miejsca prezentacji marki w frontendzie, szablonach maili, PDF, favicon, metadanych SEO i Photo AI.
2. Dodać zatwierdzone zasoby SVG/PNG CARVAMO do `assets/brand/` i wdrożyć spójne komponenty UI.
3. Zachować istniejące techniczne nazwy `carvelo-*`, `CARVELO_*`, bucketów, funkcji Supabase, kolejek i tabel do czasu jawnej migracji danych i integracji. Sama zmiana nazwy widocznej nie wymaga zmiany ich identyfikatorów.
4. W Photo AI zamienić logo w wynikach i w renderowanych scenach 3D; dodać test automatyczny wykrywający stare oznaczenie w wynikowym obrazie.
5. Skonfigurować `carvamo.com`, `www.carvamo.com`, `api.carvamo.com`, `admin.carvamo.com`, `staging.carvamo.com` dopiero po potwierdzeniu własności domeny i architektury.
6. Wykonać testy end-to-end, kontrolę CSP/CORS, callbacków auth, webhooków, URL-i zdjęć, maili i canonical SEO.
7. Wdrożyć na staging; dopiero po akceptacji i backupie przełączyć produkcję, zachowując rollback i przekierowania 301 ze starych adresów, jeśli są kontrolowane.

## Zakazy
- Nie podmieniać w ciemno nazw bucketów `carvelo-photo-originals` i `carvelo-photo-branded`, tabel, funkcji, zmiennych środowiskowych ani endpointów.
- Nie wyłączać Render, Supabase ani starej domeny przed weryfikacją migracji.
- Nie traktować nowej nazwy jako ukończenia Photo AI 180°.
