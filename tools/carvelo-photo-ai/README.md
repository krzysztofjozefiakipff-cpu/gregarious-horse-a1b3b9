# CARVELO — prywatny worker zdjęć zewnętrznych

Status: kod przygotowany, **nieuruchomiony**. Repozytorium nie zawiera zatwierdzonego pliku tła ani sekretów. Bez wdrożonego workera kolejka pgmq nie obrabia automatycznie obrazów.

Model: jawnie wybrany `rembg u2net` (nie non-commercial `bria-rmbg`); model tylko segmentuje oryginalny pojazd. Wynik trafia do private Storage i `cv_photo_versions.qa_status=review`; nie jest publikowany automatycznie. Wnętrza i widoki za szybami nie są jeszcze modyfikowane.

Wymagane po stronie uruchomienia:

- zatwierdzony obraz `assets/brand/carvelo-showroom-v1.png` bez auta (wgrany z pliku zaakceptowanego przez właściciela marki) oraz kanoniczny znak `assets/brand/carvelo-wordmark-on-dark.svg`;
- serwer/runner Python 3.11–3.13 z RAM odpowiednim do modelu i internetem do pobrania wag;
- sekrety **wyłącznie** w środowisku serwerowym: `CARVELO_DATABASE_URL` (Supabase pooler), `CARVELO_SUPABASE_URL`, `CARVELO_SUPABASE_SERVICE_ROLE_KEY`, opcjonalny `CARVELO_SHOWROOM_SHA256`;
- przy pierwszym uruchomieniu `python -m pip install -r tools/carvelo-photo-ai/requirements.txt`; następnie `python tools/carvelo-photo-ai/worker.py`.

Nie przenoś sekretów do Netlify, plików statycznych, logów ani publicznego repo. Worker ma przetwarzać wyłącznie prośby `showroom_exterior` zaakceptowane przez serwer. Dane historyczne w `cv_offer_photos` nie są kasowane ani modyfikowane przez workera.

## QA i akceptacja

Wynik oznaczony `review` **nie jest automatycznie ofertą publiczną**. Przed wdrożeniem komercyjnym wymagane są dodatkowo: zatwierdzanie kandydata AI w panelu, publikowanie wersji z logo, kontrola masek (szczególnie szyby i odbicia), automatyczne retry, raport błędów, zabezpieczenia obciążenia oraz testy na różnorodnych samochodach. Funkcja widoku przez szyby wymaga odrębnego modelu semantycznego i nie jest zawarta w tym workerze.
