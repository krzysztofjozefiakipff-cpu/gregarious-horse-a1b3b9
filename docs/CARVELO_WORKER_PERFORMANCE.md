# CARVELO – wydajność workera: diagnoza i optymalizacja 8.11.2026

Wcześniej w GitHub Actions występował harmonogram 4 uruchomień/h oraz **tylko jedno zdjęcie na jeden run**. W efekcie kolejka rosnąca do 9 zdjęć mogła wymagać długiego oczekiwania.

## Aktualizacja
- Harmonogram zmieniono z 15 min na 5 min (GitHub Actions schedule działa w trybie best effort i może być opóźniony).
- Pierwsze zdjęcie działa jak wcześniej; następnie `batch_runner.py` pobiera i wykonuje do 8 dodatkowych zadań w tej samej maszynie.
- Drugi i kolejne obrazy używają już zainstalowanych pakietów, a U2Net / CLIPSeg są cache'owane w pamięci jednego procesu.
- Kiedy w pierwszym zadaniu nie jest potrzebny model szyb, dodatkowy batch instaluje PyTorch i CLIPSeg tylko wtedy, gdy pojawi się automatyczne zdjęcie wnętrza.
- Limit 720 s pracy dodatkowej i maks. 8 zadań zapobiega przekroczeniu limitu czasu pojedynczego workflow (22 min). Kolejne zaległe zadania pozostają w kolejce do następnego uruchomienia.
- Każdy wynik ma osobną wersję, logo i moderację; nie ma automatycznej publikacji. Błąd jednego zdjęcia nie blokuje pozostałych, a błąd raportowania do bazy przerywa pracę, by zachować spójność.

## Testy
`python tools/carvelo-photo-ai/test_batch_runner.py` sprawdza przetwarzanie kolejnych elementów po błędzie, instalowanie modelu szyb wyłącznie gdy potrzebny i limit czasu. Poprzednie testy segmentacji i geometrii pozostają uruchamiane przy push.

## Ryzyka
- Harmonogram GitHub Actions nie jest serwisem o gwarantowanym czasie odpowiedzi.
- Bezpieczne cache'owanie modeli skraca czas, ale sam CLIPSeg nadal może wymagać znaczącego czasu CPU.
- Każde przetworzone zdjęcie nadal wymaga kontroli przez pracownika.
