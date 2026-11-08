# CARVELO — fotorealistyczne studio, standard przetwarzania v3

**Wdrożenie:** `tools/carvelo-photo-ai/studio_compose.py` oraz `tools/carvelo-photo-ai/render_github.py`  
**Tło:** `assets/brand/carvelo-studio-v2.svg` — neutralna ściana i posadzka, bez tekstu i bez narysowanego logotypu.  
**Logo:** wyłącznie `assets/brand/carvelo-wordmark-on-dark.svg`, niezmienne, w górnym prawym rogu.  
**Wersja wynikowa:** `scene_version=studio-v3`, zachowana osobno w `cv_photo_versions`.

## Algorytm dla fotografii zewnętrznych

1. Model segmentujący U2Net wyznacza alfa-matę na **oryginalnym zdjęciu**. Nie generuje nadwozia.
2. Obwiednia alfy (>96/255) ustala kadr obiektu, który jest **wyłącznie proporcjonalnie skalowany**. Maks. 84% szerokości sceny, 57% wysokości, skalowanie maks. 1,5×.
3. Dolny punkt sylwetki ma współrzędną Y = **85% wysokości** wyjściowego kadru; auto jest wycentrowane. To ogranicza efekt zawieszenia nad podłogą.
4. Położenie kontaktu kół pochodzi z dwóch skupisk skrajnych dolnych pikseli maski (>175 alfa). Gdy wykrycie jest niepewne, stosuje się konserwatywny punkt odniesienia przy 24% i 76% szerokości sylwetki.
5. **Miękki cień pod bryłą:** elipsa 7–93% długości obiektu, alfa 58/255, Gaussian blur 1,9% wysokości obrazu.
6. **Cienie kontaktowe pod kołami:** dwie małe elipsy o szerokości 14% długości auta, alfa 139/255, blur 0,7% wysokości.
7. **Odbicie posadzki:** poniżej punktu kontaktu, pionowo odwrócony i skompresowany obraz auta do 19% jego wysokości; maks. 7,8% początkowej alfy, wygaszanie do zera i lekkie rozmycie. Brak ostrego lustrzanego odbicia.
8. **Kolorystyka nadwozia:** bez zmiany RGB w oryginalnym pojeździe; korekty dotyczą warstw posadzki/cieni. Nie wolno zmieniać lakieru, felg, emblematu ani wyposażenia.
9. **Marka:** nałożenie oficjalnego, dostarczonego pliku SVG na tle ciemnej półprzezroczystej plakietki w prawym górnym rogu. Nigdy logo wygenerowane modelem.
10. Wynik do **prywatnej moderacji**, nigdy do automatycznej publikacji.

## Fotografie wnętrza

Obróbka `showroom_windows` nie jest objęta pozycjonowaniem sylwetki ani cieniami kół. Nadal zmieniamy wyłącznie wyznaczony obszar widoku przez szyby; reszta wnętrza pozostaje dokładnie jak w oryginale. Przy niepewnej masce pozostawiamy oryginał z logo.

## Kontrola jakości i testy

- `test_studio_compose.py`: kontakt z posadzką, dwa punkty pod kołami, miękki cień, delikatne odbicie, niezmienione piksele lakieru w modelu testowym, położenie logo, brak znaku pośrodku ściany, odrzucenie pustej maski.
- `test_interior_windows.py`: bezpieczeństwo maski i zakaz edycji wnętrza.
- GitHub Actions uruchamia testy przy zmianach workera i sprawdza kolejkę co 15 minut.
- Zdjęcie wynikowe należy ocenić na **co najmniej 30–50 rzeczywistych ujęciach**: przód, tył, profil, kąt 3/4, z jasnym/ciemnym lakierem, SUV i pojazd dostawczy, różne źródła światła, mokra posadzka i mocne odbicia.

**Ograniczenia:** geometria oparta na alfa-macie nie jest pełnym pomiarem 3D. Należy ręcznie sprawdzić zgodność punktów pod oponami, naturalność cienia i krawędzie. Gdy maska utnie koło albo lusterko, wynik odrzucić i powtórzyć segmentację; nie naprawiać elementów pojazdu generatywnie.

## Usuwanie ofert — wdrożenie równoległe

- Panel administratora: przycisk **Usuń trwale**, dwukrotne świadome potwierdzenie przez wpisanie `USUŃ`.
- Edge Function `carvelo-photos` / `delete_offer` weryfikuje uprawnienia **admin** i wywołuje `cv_delete_offer_admin` z kluczem service-role niewidocznym dla przeglądarki.
- Baza nie pozwala usuwać ofert z aktywnym zadaniem `processing`. Zadania `queued` są archiwizowane, a zdjęcia, wersje i zadania AI są usuwane w jednej transakcji.
- Lista plików z obu prywatnych bucketów zostaje zapisana w `cv_offer_cleanup_batches`, po czym Storage API usuwa pliki; ewentualny niepowodzenie zachowuje stan `failed` do administracyjnej naprawy.
- Rola `dealer` i `staff` nie ma przycisku usuwania ofert, a zwykłe tokeny `authenticated` nie mają prawa wywoływać funkcji SQL.
