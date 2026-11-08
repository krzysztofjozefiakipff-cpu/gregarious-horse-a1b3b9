# carVelo — poprawki po kontroli kolejki, listopad 2026

## Wdrożone w kodzie
- Zwiększona precyzja osadzania samochodu: kontakt kół jest wyznaczany z dolnych nieprzezroczystych pikseli segmentacji w lokalnym otoczeniu obu kół. Cienie kontaktowe nie są już rysowane na jednej fikcyjnej linii. Przy zbyt dużej różnicy wysokości punktów styku zdjęcie jest blokowane do weryfikacji.
- Zachowana pełna proporcja samochodu i oryginalne piksele nadwozia.
- Statusy panelu rozróżniają oczekiwanie w kolejce, przetwarzanie, gotowość do akceptacji i zakończenie. Procent jest etapem, a nie prognozą czasu.
- Moderacja przed publikacją nadal obowiązuje.

## Wymagające osobnego wdrożenia
- **Tło użytkownika:** załączone zdjęcie salonu zawiera dwa samochody. Nie wolno go bezpośrednio użyć jako szablonu dla ofert, bo pojazdy pojawiłyby się w każdym wyniku. Wymagany jest wyczyszczony, zweryfikowany plik 16:9 z usuniętymi samochodami, odtworzonymi płytkami, szybami, odbiciami i zasłoniętymi fragmentami architektury. Dopóki taki plik nie jest gotowy, obowiązuje poprzednie puste tło; nie deklarować wdrożenia zdjęcia użytkownika.
- **Natychmiastowy trigger:** GitHub Actions cron nie gwarantuje startu na czas. Należy wdrożyć stale działającego workera z bezpiecznym uwierzytelnianiem do brokera, bez service_role w przeglądarce. Nie należy wyłączać GitHub OIDC bez zamiennika.
- **Wykrywanie szyb:** nie należy obniżać progów maski bez testów na prawdziwych zdjęciach. Tryb ręcznego wskazywania szyb pozostaje bezpiecznym obejściem.

## Weryfikacja
Workflow uruchamia testy na push, a wynik obróbki pozostaje prywatnym kandydatem do zatwierdzenia.
