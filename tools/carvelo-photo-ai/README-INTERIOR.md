# CARVELO — obróbka widoku za szybami (BETA)
Status: **wersja testowa, bez automatycznej publikacji**.

W przypadku zdjęcia `interior` worker GitHub Actions uruchamia model `CIDAS/clipseg-rd64-refined` na CPU i na podstawie opisów wyszukuje fragmenty z otoczeniem widocznym przez przednią, boczne lub tylną szybę.

## Ochrona wnętrza
- Model nie generuje wnętrza, tapicerki, deski, elementów wyposażenia ani samochodu.
- Wzorcowy salon CARVELO jest nakładany wyłącznie na **konserwatywny środek maski** widoku zewnętrznego.
- Maska jest ograniczona progami pewności, odejmowaniem propozycji wnętrza oraz erozją chroniącą krawędzie szyb i słupków.
- Piksele poza maską pozostają identyczne z oryginalnym obrazem. Każda końcowa wersja zawiera oficjalny plik logo CARVELO (V na czerwono).
- Przy maskach niepewnych obróbka kończy się bez utworzenia kandydata AI; oryginał z logo pozostaje dostępny. Brak automatycznej publikacji.
- Przetworzony obraz trafia do **prywatnego** magazynu `carvelo-photo-branded` i tabeli `cv_photo_versions`; wymagana ręczna akceptacja administratora.

## Uruchomienie
Niezależny worker pobiera zadania `showroom_windows` ze wspólnej kolejki `pgmq` i dla tego trybu instaluje biblioteki CPU PyTorch + Transformers. Klucze Supabase nie są przechowywane w repo — pośredniczy Edge Function z weryfikacją GitHub OIDC.

Tryb globalny `windows-v1` pozostaje domyślnie wyłączony do czasu przeglądu pierwszych realnych zdjęć. To **nie** jest gwarantowana, fotorealistyczna zamiana widoku na każdym zdjęciu: CLIPSeg jest modelem ogólnego przeznaczenia. Wątpliwe kadry wymagają maskowania ręcznego lub zachowania oryginału.

## Testy
```
python -m pip install pillow numpy
python tools/carvelo-photo-ai/test_interior_windows.py
```
Test sprawdza brak zmian poza maską, brak ingerencji w dolny obszar wnętrza oraz odrzucanie błędnej maski całego kadru. Modelowy test na obrazie prawdziwym jest rozdzielony od tych nieinwazyjnych testów bezpieczeństwa.

**Tryb pilotażowy:** jednorazowo zlecony dla istniejącego zdjęcia wnętrza oznaczonego `review`, nie dla zatwierdzonego zdjęcia głównego. Żaden wynik nie zostanie opublikowany bez moderacji.
