# CARVAMO Photo AI — bezpieczna aktywacja OVH + Render

**Stan:** kod w gałęzi testowej, nie jest wdrożony na OVH ani Render. Bez Supabase.

## Zależności infrastruktury (wymagają sprawdzenia na serwerze)
1. Zidentyfikować działający kontener `services/accounts` i jego reverse proxy; sprawdzić, czy obsługuje rzeczywiste oferty i zdjęcia. Samo istnienie plików w GitHub nie dowodzi wdrożenia.
2. Zweryfikować, czy `offer_photos.original_path` jest względną ścieżką do pliku na dysku OVH, czy identyfikatorem obiektu innego magazynu. **Nie włączać endpointu pobierania, jeśli to nie jest katalog lokalny.**
3. Zapewnić trwałe wolumeny: `CARVAMO_PHOTO_ORIGINALS_DIR` (tylko odczyt) i `CARVAMO_PHOTO_CANDIDATES_DIR` (zapis, niepubliczny). Dwa różne katalogi; nie wystawiać ich przez statyczny serwer.
4. Wykonać backup bazy i uruchomić `infra/ovh/db/004_photo_ai_queue.sql` w tej samej bazie co oferty. Wcześniej sprawdzić schemat, uprawnienia i istniejące dane.
5. Ustawić osobny losowy sekret min. 32 znaki `CARVAMO_PHOTO_WORKER_TOKEN` na OVH i Render, wyłącznie w menedżerze sekretów. Wymusić HTTPS, prywatną trasę i ograniczenia sieciowe.
6. Na OVH włączyć `CARVAMO_PHOTO_API_ENABLED=true` dopiero po testach backendu.
7. W Render uruchomić **osobny worker testowy** z poleceniem `python tools/carvelo-photo-ai/ovh_worker.py`, `CARVAMO_OVH_WORKER_ENABLED=true`, `CARVAMO_PHOTO_API_URL` i sekretem. Nie nadpisywać aktywnego `persistent_worker.py` bez planu przełączenia.
8. Wymienić pozostałe zasoby graficzne CARVELO na zatwierdzone CARVAMO przed publikacją. Obecny nowy worker wciąż wykorzystuje stary salon i logo.
9. Przetestować 1 zdjęcie zewnętrzne w odizolowanej ofercie; zweryfikować maskę, perspektywę, koła, cienie, wynik w `photo_versions` i brak automatycznej publikacji.
10. Dopiero po poprawnym teście przełączyć ruch, zapewnić rollback i wyłączyć starszy mechanizm.

## Istotne ograniczenia kodu
- Prototyp API zakłada **lokalny filesystem**. Jeżeli OVH używa object storage, konieczny jest adapter do tego magazynu.
- Lease wygasa po 15 minutach, a obecnie nie ma heartbeat. Długie zadania mogą wymagać odnowienia lease.
- `photo_versions` ma stan review, ale panel zatwierdzania z nowej bazy nie został jeszcze podłączony.
- Brak potwierdzonego rzeczywistego przetworzenia zdjęcia. Testy CI sprawdzają tylko komponenty i sceny syntetyczne.
- Nie wykonywać migracji ani zmiany `main` bez dostępu do OVH i walidacji środowiska.
