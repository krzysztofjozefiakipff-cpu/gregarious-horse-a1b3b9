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


## Tryb precyzyjny: ręczne zaznaczanie widoku przez szyby

Gdy CLIPSeg nie może wiarygodnie oddzielić widoku na zewnątrz od elementów kokpitu, administrator CARVELO wybiera w panelu zdjęcie kategorii **Wnętrze** i przycisk **„Zaznacz widok za szybą”**. Na podglądzie wskazuje punkty wielokąta w wewnętrznej części szyby, zamyka obszar (może oznaczyć maksymalnie 6 szyb), a następnie wybiera **„Przygotuj zdjęcie CARVELO”**.

Backend `carvelo-photos` sprawdza rolę admin/staff, publikację oferty, kategorię, geometrię wielokątów i obszar do 35% zdjęcia, po czym zapisuje `window_polygons` w prywatnym zadaniu `showroom_windows`. GitHub Actions, przez krótkotrwały token OIDC, odbiera bezpieczny JSON i uruchamia funkcję `compose_staff_window_mask`. Model generatywny **nie rysuje samochodu**: wyłącznie wskazane wnętrza polygonów są zastępowane otoczeniem salonu CARVELO, z erozją krawędzi. Oryginalne piksele poza maską pozostają identyczne.

Każdy wariant dostaje oficjalne logo CARVELO, trafia do prywatnego magazynu jako kandydat do moderacji i nie jest stosowany do opublikowanej oferty bez jej wycofania i ponownego zatwierdzenia zdjęcia. Nieaktywna flaga `windows-v1` blokuje wyłącznie tryb **automatyczny**; administrator może używać maski precyzyjnej w nieopublikowanej ofercie.

W CI sprawdzono `INTERIOR MASK SAFETY PASS` i `MANUAL WINDOW MASK SAFETY PASS`. Pierwszy test automatycznego CLIPSeg na rzeczywistym zdjęciu wnętrza zakończył się `window_mask_uncertain` — oryginał pozostał nietknięty. Nie traktować tego jako gotowości automatycznego trybu dla wszystkich zdjęć.
