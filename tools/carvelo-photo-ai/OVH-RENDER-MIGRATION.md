# CARVAMO Photo AI 180° — migracja bez Supabase

Status: **projekt interfejsu, NIE wdrożenie produkcyjne** (2026-11-10).

## Potwierdzony stan
- Render background worker `srv-dboftorrjlhs73bapd5g` działa z `main`, Dockerfile `tools/carvelo-photo-ai/Dockerfile`.
- Aktualny `persistent_worker.py` wymaga `CARVELO_DATABASE_URL`, `CARVELO_SUPABASE_URL` i `CARVELO_SUPABASE_SERVICE_ROLE_KEY`; pobiera oryginały i zapisuje wyniki przez Supabase Storage oraz wywołuje funkcje SQL `cv_ai_*`. **Nie jest niezależny od Supabase.**
- `broker.py` i `render_github.py` również zależą od starego brokera Supabase.
- Algorytm `studio_compose.py` jest osobnym modułem i można go wykorzystać w nowej integracji.
- Zielone testy syntetyczne nie potwierdzają działania na rzeczywistych zdjęciach.

## Docelowy kontrakt OVH ↔ Render (do zatwierdzenia po rozpoznaniu backendu OVH)
1. Backend CARVAMO zapisuje oryginalny plik w prywatnym magazynie OVH i tworzy zadanie `queued` z identyfikatorem oferty i zdjęcia.
2. Worker uwierzytelnia się maszynowo (sekret wyłącznie w Render, rotacja i ograniczenie uprawnień), pobiera jedno zadanie przez prywatne API backendu. Wymagane idempotentne claim i lease.
3. Backend wydaje krótkotrwały URL pobrania **jednego** oryginału. Worker sprawdza limit rozmiaru, format i liczbę pikseli.
4. Worker wykonuje segmentację, dobiera perspektywę tylko przy wiarygodnej estymacji, komponuje scenę i zapisuje **kandydata**, nigdy nie publikuje automatycznie.
5. Worker wysyła wynik do prywatnego API; backend sprawdza `job_id`, właściciela zasobu, lease i idempotency key; zapisuje wersję `review`.
6. Pracownik CARVAMO zatwierdza wersję w panelu; dopiero wtedy może być publiczna.
7. Błędy mają kody bez adresów URL, tokenów i danych osobowych; retry z limitem prób oraz dead-letter.

## Warunki przed wdrożeniem
- Ustalić faktyczny backend, bazę i storage działającego portalu OVH (nie zgadywać adresów endpointów).
- Ustalić uprawnienia workera i mechanizm uwierzytelniania; nie kopiować kluczy Supabase.
- Napisać adapter OVH i test kontraktowy z mock API, następnie test integracyjny na odizolowanym zdjęciu.
- Przetestować realne zdjęcie zewnętrzne i wewnętrzne, maskę, koła, cienie, logo CARVAMO oraz moderację.
- Dopiero po pozytywnych testach wdrożyć do Render i monitorować błędy.
- Wyłączyć legacy workflow Supabase dopiero po potwierdzeniu nowego przepływu, aby nie przerwać obsługi aktywnych ofert.

**Nie uruchamiać `persistent_worker.py` z nowymi danymi OVH bez napisania adaptera.** Samo podmienienie `DATABASE_URL` nie usuwa zależności od Supabase Storage i SQL RPC.
