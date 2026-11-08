# CARVELO — uruchomienie zabezpieczonego panelu

**Stan na 8 listopada 2026: Supabase CARVELO został uruchomiony i podłączony do panelu oraz publicznego katalogu.**
Zakładka Oferty dealerskie pobiera wyłącznie opublikowane wpisy z Supabase; zakładka Przykłady (demo) pozostaje odrębna. Zapytania klientów nadal są demonstracyjne i nie są wysyłane.

## Architektura i uprawnienia

- Publiczny katalog CARVELO: opublikowane oferty z Supabase oraz oddzielny tryb demo (index.html + catalog-live.js).
- Panel administracyjny i dealerski: folder panel/; adres https://carvelov2.netlify.app/panel/
- Supabase Auth: logowanie kont zaproszonych przez administratora.
- PostgreSQL + Row Level Security (RLS): oferty i uprawnienia egzekwowane w bazie.

| Rola | Uprawnienia |
| --- | --- |
| admin | Wszystkie oferty, publikacja, moderacja, zarządzanie dealerami i kontami |
| staff | Oferty wszystkich dealerów, dodawanie, edycja i moderacja; bez zarządzania kontami |
| dealer | Oferty swojego dealera; nowe oferty do moderacji, edycja nieopublikowanych ofert |
| unassigned | Brak dostępu — domyślnie konto nieaktywne |

## 1. Utwórz bazę

1. Załóż projekt Supabase. Rozważ region UE i sprawdź wymagania RODO.
2. Otwórz SQL Editor i uruchom skrypt supabase/migrations/202611080001_carvelo_core.sql na NOWYM projekcie.
3. W Authentication wyłącz samodzielną publiczną rejestrację; zachowaj możliwość zapraszania użytkowników. Włącz potwierdzanie adresu e-mail i rozważ MFA dla adminów.
4. W Authentication → Users wyślij zaproszenie do pierwszego administratora.
5. **Tylko w zaufanym SQL Editor** przypisz temu konkretnemu użytkownikowi rolę administratora, zastępując adres e-mail w poniższym przykładzie:

    insert into public.cv_profiles (id, display_name, role, enabled)
    select id, coalesce(split_part(email, '@', 1), ''), 'admin', true
    from auth.users
    where lower(email) = lower('ADMIN@TWOJA-FIRMA.PL')
    on conflict (id) do update
      set role = 'admin', enabled = true;

Sprawdź, że wynik dotyczył dokładnie jednego konta. Nie wykonuj tego zapytania w przeglądarce.

## 2. Podłącz frontend

Z projektu Supabase skopiuj publiczne Project URL i Publishable key / anon key. Uzupełnij plik panel/config.js:

    export const SUPABASE_URL = "https://TWOJ-PROJEKT.supabase.co";
    export const SUPABASE_PUBLISHABLE_KEY = "TWÓJ_KLUCZ_PUBLICZNY";

**Nigdy nie wstawiaj do repozytorium: service_role, secret key, haseł do bazy, tokenów ani haseł użytkowników.**
Klucz publiczny może być osadzony w kodzie przeglądarkowym tylko przy poprawnie skonfigurowanym RLS.

Skonfiguruj poprawny URL serwisu i dozwolone adresy przekierowań w Supabase Auth, np. https://carvelov2.netlify.app/panel/ .

Po zatwierdzeniu zmian w GitHub Netlify powinno opublikować panel. Przed skonfigurowaniem połączenia panel celowo pokazuje komunikat o braku konfiguracji.

## 3. Dodaj użytkowników i dealerów

1. Zaloguj się jako admin do /panel/.
2. Dodaj salony w sekcji Dealerzy.
3. Zaproś użytkowników przez Supabase Authentication → Users.
4. Nowo zaproszone konto domyślnie otrzymuje rolę unassigned i jest nieaktywne.
5. W panelu CARVELO → Konta i role przypisz rolę staff albo dealer, dla dealera wybierz salon, następnie aktywuj konto.
6. Pracownik CARVELO może dodawać oferty wszystkich partnerów; dealer może edytować tylko nieopublikowane oferty własnego salonu.
7. Administrator zarządza również rolami oraz publikacją.

## 4. Testy akceptacyjne przed obsługą prawdziwych klientów

Zaloguj osobne konta: admin, pracownik CARVELO, dealer A i dealer B. Sprawdź:

- Dealer A nie widzi nieopublikowanych ofert dealera B i nie może ich zmieniać nawet przez ręczne zapytania do API.
- Dealer nie może obejść moderacji ani samodzielnie przypisać sobie innej firmy.
- Pracownik może publikować oferty, ale nie może zmieniać ról innych użytkowników.
- Wyłączone konto i konto nieprzypisane nie może zarządzać ofertami.
- Wyłączenie dealera blokuje jego dostęp do ofert.
- Publiczny użytkownik widzi tylko opublikowane oferty i tylko niesekretne kolumny.

**Nie przeprowadzono jeszcze testów integracyjnych z rzeczywistą bazą Supabase** — do tego niezbędne jest podłączenie projektu i utworzenie kont testowych.

## 5. Kolejne prace przed produkcją

- Publiczny katalog odczytuje już opublikowane oferty z bazy. Oferty demo pozostają osobne i nie są synchronizowane z Supabase.
- Dodaj zdjęcia i wyposażenie, historia i audyt zmian, logi moderacji.
- Utwórz bezpieczną obsługę leadów z RODO, polityką prywatności, zgodami i retencją danych.
- Dodaj MFA administratorów, backupy, monitoring, testy penetracyjne i paginację dla dużej liczby ofert.
- Dopiero po testach integracyjnych i bezpieczeństwa uruchom obsługę realnych dealerów oraz klientów.

Nie wprowadzaj prawdziwych danych klientów do obecnej makiety demonstracyjnej.


## 6. Weryfikacja publicznego katalogu

1. Zaloguj się do panelu administratora CARVELO.
2. Dodaj dealera (jeśli jeszcze nie istnieje).
3. Dodaj samochód, przypisz go do dealera i ustaw status Opublikowana.
4. Otwórz portal, wybierz Oferty dealerskie i odśwież stronę. Opublikowane auto powinno się pojawić. Samochody z demo są dostępne osobno w Przykłady (demo).
5. Zmień status samochodu na Odrzucona i odśwież portal. Oferta nie może być już widoczna publicznie.
6. Sprawdź filtrowanie po racie, sortowanie, ulubione, porównywanie i możliwość udostępnienia linku do szczegółów.

Obecnie nie ma serwerowej obsługi zapytań od klientów. Na rzeczywistych kartach samochodów przycisk kontaktu wyświetla komunikat o niedostępności usługi i nie gromadzi danych osobowych klientów. Nie traktuj jeszcze portalu jako gotowego do komercyjnego uruchomienia.
