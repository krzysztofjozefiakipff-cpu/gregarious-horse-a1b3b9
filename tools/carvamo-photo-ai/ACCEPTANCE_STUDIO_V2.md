# CARVAMO Premium Studio V2 — zamrożony wzorzec i odbiór etapów 1–4

## Źródło prawdy
Wzorzec: przesłany przez właściciela obraz 1536 × 865 px przedstawiający srebrny JAECOO 8 na tle ciemnego salonu CARVAMO, z logotypem i hasłem na ścianie. Nie zastępować go renderami pośrednimi. Wzorzec jest obrazem kompozytowym z pojazdem; porównanie pustego salonu musi ignorować obszar zajmowany przez pojazd.

## Wymagania obowiązkowe
1. Perspektywa szerokokątna, widoczne sufit, ściany boczne i znaczna część posadzki; poziom styku ściana–podłoga w dolnej części kadru, nie na środku.
2. Głęboki morski granat, niemal czarna lustrzana posadzka, białe podłużne linie LED na suficie, białe pionowe listwy ścienne, turkusowe akcenty przy podłodze.
3. Oryginalne logo z CARVAMO Brand Book 2.0 (nigdy fontowe przybliżenie); hasło dokładnie: „Dobra cena. Prosto od dealera.”; przy zastosowaniu jasnego pola ochronnego przestrzegać brand booka.
4. Scena V2 jest niezależna od działającego generatora i produkcji. Samochód nie jest częścią odbioru etapów 1–4.

## Punkty kontrolne wzorca — pomiar obrazu źródłowego
Obraz źródłowy: 1536 × 865; mediany RGB z trzech równych poziomych pasów, informacyjne (środkowy i dolny pas zawierają samochód):
- górny: [38, 77, 84]
- środkowy: [8, 52, 61]
- dolny: [29, 64, 72]

Odrzucony poprzedni podgląd ze zrzutu iPhone'a (przybliżone przycięcie): mediany RGB [115,143,155] / [115,143,154] / [99,129,142]. W szczególności render był znacznie za jasny. Nie traktować wartości RGB jako jedynego kryterium jakości.

## Bramki odbioru
- G1: Blender zakończy render, powstanie plik PNG 1280 × 720 i manifest.
- G2: automatyczny test stwierdzi dostatecznie ciemny obraz, obecność jasnych elementów w górnej części oraz czytelny rozkład jasności. Wynik testu = kandydat, nie akceptacja.
- G3: branding: oficjalny plik logo rzeczywiście użyty w scenie; w przeciwnym razie FAIL.
- G4: wizualne porównanie z zaakceptowanym wzorcem (kadr, geometria, światło, posadzka, branding). Bez porównania G4 = PENDING, a nie PASS.

Dopiero G1–G4 PASS pozwalają przejść do etapu 5. Automatyczne publikowanie pliku nie oznacza odbioru. Zachować historię kolejnych kandydatów i raporty QA.
