# CARVELO — jeden wzorzec logo (v1)

**Status:** wersja ujednolicona do weryfikacji wizualnej. Wprowadzenie jednego źródłowego zasobu do portalu i panelu: 8 listopada 2026.

## Stała identyfikacja

- Oficjalny napis: **CARVELO**, wielkie litery, bez dodatkowego konturu samochodu, bez znaku graficznego nad nazwą.
- Charakter znaku: nowoczesna, prosta, premium typografia wektorowa. Kontury liter zakodowane w SVG — nie są generowane ponownie przez narzędzie AI i nie zależą od fontów na urządzeniu.
- Litera **V**: czerwony akcent **#D7192D**. Pozostałe litery: **#F8FAFD** na ciemnym tle albo **#12283C** na jasnym.
- Sygnet: sam czerwony **V**, dokładnie taki jak litera w oficjalnym logotypie. Przeznaczenie: favicon, avatar, małe ikonki.
- Hasło towarzyszące w materiałach premium: **AUTHORIZED DEALER NETWORK**. Hasło jest osobnym elementem podpisu — nie należy dopisywać ani wymyślać zamienników w samym logo.
- **Zabronione:** obrys samochodu nad napisem, przesuwanie czerwonego akcentu na inną literę, zmianę kroju lub proporcji między publikacjami, używanie obrazu logo wygenerowanego przez AI zamiast oficjalnego SVG, publikację zdjęć samochodów bez firmowego znaku.

## Oficjalne zasoby (jedno źródło)

- `assets/brand/carvelo-wordmark-on-dark.svg` — główny logotyp na ciemne tło, transparentny.
- `assets/brand/carvelo-wordmark-on-light.svg` — ten sam kształt, wersja na jasne tło, transparentna.
- `assets/brand/carvelo-v-icon.svg` — sam sygnet V.

To **warianty kolorystyczne tego samego** znaku, a nie różne projekty.

## Zastosowanie

1. **Portal i panel:** elementy nagłówka powinny odwoływać się do źródłowego pliku SVG, a nie tekstu stylizowanego przez CSS.
2. **Wirtualny salon:** zdjęcie tła może być tworzone przez AI, ale logo i podpis powinny zostać naniesione osobno z zasobu SVG i stałej typografii; generator obrazów nie powinien sam tworzyć nazwy ani hasła.
3. **Zdjęcia aut:** po obróbce nakładać logo SVG w stałych proporcjach i wybranym czytelnym narożniku. Watermark musi znajdować się w samych pikselach opublikowanego pliku, nie tylko w nakładce CSS. Dla miniatur renderować logo ponownie w odpowiedniej wielkości.
4. **Dokumenty, social media i reklamy:** używać tylko jednej z powyższych wersji, nie odtwarzać znaku ręcznie.

## Uwagi wdrożeniowe

- Wygenerowany salon to zdjęcie koncepcyjne; do produkcyjnej automatycznej kompozycji samochodów należy używać wersji z kontrolowaną geometrią, bez ryzyka zasłonięcia logotypu przez auto i z przewidywalnym umieszczeniem pojazdu.
- Przy zdjęciach wnętrza i detali nie zmieniaj tła; nałóż logo na gotowy obraz.
- Ten plik ujednolica identyfikację wizualną; sam nie uruchamia jeszcze automatycznego przetwarzania zdjęć samochodów w panelu.
