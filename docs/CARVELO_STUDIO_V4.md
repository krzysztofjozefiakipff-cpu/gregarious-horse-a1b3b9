# carVelo Studio v4 — wdrożenie workera

## Status
Nowy worker GitHub Actions używa salonu fotograficznego `assets/brand/carvelo-showroom-v1.webp.b64` jako bazy dla renderingu 800×450 (zatwierdzony pusty salon). Scena jest odtwarzana lokalnie przez Pillow w każdej sesji. Stary znak CARVELO w środkowej ścianie jest zastępowany jednolitym fragmentem oryginalnej ściany, z miękkim przejściem, po czym nakładany jest oficjalny wektor **carVelo** (czerwone V) jako szyld ścienny. Osobny, czytelny wektorowy znak jest nanoszony w prawym górnym rogu każdego wyniku.

Nie korzystamy ze zdjęć koncepcyjnych zawierających wygenerowane samochody: referencyjne tło musi być puste. Stąd unikanie sztucznego auta w kadrze po wstawieniu samochodu z oferty.

## Zdjęcia zewnętrzne
- Segmentacja U2Net jest wykonywana wyłącznie na źródłowym samochodzie; żaden element nadwozia nie jest generowany.
- Auto jest skalowane proporcjonalnie i osadzane w 85% wysokości kadru.
- Na posadzce dodawane są: rozmyty cień bryły, dwa lokalne cienie pod kołami, łagodny cień kierunkowy od przeszkleń z prawej oraz subtelne wygaszone odbicie.
- Źródłowe RGB karoserii i wyposażenia pozostaje nietknięte; sztuczne odbicia są ograniczone do posadzki.
- Wszelkie błędy masek blokują automatyczną publikację.

## Zdjęcia wnętrza
W trybie `showroom_windows` zmieniane są jedynie dostatecznie pewne regiony widoku *za* szybami lub maski zaznaczone przez pracownika. Kabina, kokpit, kierownica, lusterka i słupki nie są regenerowane. Przy niepewnej masce pozostaje oryginał + nowy znak.

## Moderacja i ograniczenia
Wynik otrzymuje `scene_version=studio-v4`, przechodzi przez OIDC broker i do prywatnej moderacji. W istniejącym mechanizmie konieczne są akceptacja wersji AI i zatwierdzenie fotografii do publikacji. Bez tego nie ma zamiany plików na publicznej stronie.

Źródłowa fotografia salonu ma 800×450 px. Worker powiększa ją proporcjonalnie, ale nie odzyska naturalnych detali wysokiej rozdzielczości. Do zdjęć pełnoekranowych zalecany jest później nowy **pusty** wzorzec 1600×900 lub większy. Nie należy wykorzystywać ilustracji z samochodami jako tła ani przerabiać rzeczywistych pojazdów generatywnie.

## Testy
W `.github/workflows/carvelo-photo-worker.yml` przy push na main testowane są: geometria auta, fototło, logo i ochrona wnętrza; aktywny worker pobiera maksymalnie jedno zadanie. Wynik jest niezależnie moderowany.
