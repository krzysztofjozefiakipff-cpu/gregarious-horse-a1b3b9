const reviewNotes = {
  below:['Google nie czyta w myślach. Przypomnij klientowi po odbiorze, że może zostawić opinię.','Klient wyjechał nowym autem. Link do opinii może ruszyć za nim.','Kluczyki przekazane, zdjęcie z odbioru zrobione. Czas powiedzieć klientowi, gdzie może podzielić się wrażeniami.','Google ma wolne miejsce. Zaproś ostatniego klienta do podzielenia się wrażeniami.'],
  on:['Opinie dowiezione. Nawigacja może przestać mówić „przeliczam trasę”.','Plan w punkt. Nawet Google Maps nie znalazłoby krótszej drogi.'],
  above:['Google chyba już wie, gdzie pracujesz. Dobra robota!','Plan został w lusterku wstecznym. Możesz dopić kawę na ciepło.','Zrzut ekranu do rozmowy o podwyżce? Materiał jest.','Opinie przyjechały w komplecie i jeszcze przywiozły kolegów.']
};
const belowPlanNotes = {
  "Próby kontaktu": [
    "Telefon sam nie zadzwoni. Ma w tej sprawie bardzo konsekwentne stanowisko.",
    "Lista kontaktów czeka. Zacznij od osoby, której obiecałeś oddzwonić.",
    "Klient może być gotowy. Twój numer nadal ma ustawione «dzwoń pierwszy».",
    "CRM nie gryzie. Co najwyżej przypomni, komu obiecałeś telefon.",
    "Uwaga, na biurku wykryto sprawny telefon. Czas na pierwsze połączenie.",
    "Na telepatię jeszcze nie ma rubryki. Zadzwoń do klienta, który czeka na odpowiedź."
  ],
  "Jazdy próbne": [
    "Auto demonstracyjne ma dziś mniej ruchu niż ekspres do kawy. Umów jazdę.",
    "Kluczyki leżą na biurku i udają wyposażenie ekspozycji. Zaproponuj klientowi termin.",
    "Place parkingowe są świetne, ale klient nie poczuje na nich zawieszenia. Zaproś go na jazdę.",
    "Auto zna już każdy centymetr placu. Pokaż mu kawałek drogi z klientem za kierownicą.",
    "Tryb parkingowy opanowany do perfekcji. Czas wpisać do kalendarza jazdę próbną.",
    "Fotel kierowcy nie przeprowadzi prezentacji sam. Zaproś klienta, żeby w nim usiadł."
  ],
  "Oferty": [
    "Oferta w szkicach ma skuteczność koperty bez znaczka. Wyślij ją.",
    "PDF sam się nie wyśle. Sprawdzał to już niejeden handlowiec.",
    "Wersja «oferta_final» czeka na swoją premierę. Wyślij ją klientowi po ostatnim sprawdzeniu.",
    "Kalkulator wykonał swoją część roboty. Teraz kolej na przycisk «Wyślij».",
    "Klient prosił o konkrety. Dobra wiadomość: możesz mu je wysłać szybciej niż kalkulator się rozładuje.",
    "Najlepszy rabat w szkicach nikogo jeszcze nie przekonał. Wyślij ofertę klientowi, który na nią czeka."
  ]
};
const abovePlanNotes = [
  "Możesz iść na urlop. Kierownik pewnie poprosi tylko o datę powrotu.",
  "Zasłużyłeś na przerwę. Tym razem kawa ma szansę być wypita na ciepło.",
  "Złóż wniosek o podwyżkę. Załącznik już masz.",
  "Kawa na koszt firmy? Zacznij negocjacje od dwóch.",
  "CRM właśnie sprawdza, czy to na pewno Twój pierwszy bieg.",
  "Plan miał być ambitny. Chyba nie przewidział Ciebie.",
  "Zrób zrzut ekranu. Przy rozmowie o premii może się przydać.",
  "Na dziś wolno Ci zamknąć Excela bez poczucia winy.",
  "Premia sama się nie wynegocjuje. Chociaż te liczby próbują.",
  "Ktoś tu zasłużył na kawę. Dopisz do wyposażenia standardowego.",
  "Jeśli kierownik spyta, co się stało, powiedz: „To było w standardzie”.",
  "Możesz złożyć wniosek o dodatkowy pączek. Uzasadnienie jest powyżej.",
  "Ustaw status „na przerwie”. Tylko nie zapomnij wrócić po komplementy.",
  "Kierownik może już odświeżać raport. Tym razem z ciekawości.",
  "Pora na przerwę. Siadaj, zanim ktoś dopisze Ci kolejne zadanie.",
  "Nie zmieściłeś się w planie. Z tej strony to akurat dobra wiadomość.",
  "Ogłoś przerwę techniczną. Organizm domaga się kawy i oklasków.",
  "Przy negocjacji podwyżki zacznij od: „Pokażę tylko jedną rzecz”.",
  "Niech teraz ktoś spróbuje Ci sprzedać dodatkowe zadanie bez rabatu.",
  "Na placu można odpalić klakson. W biurze wystarczy przybić piątkę.",
  "Jeżeli to był tryb Eco, kierownik będzie chciał zobaczyć Sport.",
  "Zrób miejsce na biurku. Chwalipięctwo najlepiej wygląda na czysto.",
  "Dobra robota. Możesz wybrać, kto dziś stawia kawę.",
  "Prośba o dzień wolny właśnie dostała solidne uzasadnienie."
];
const $ = selector => document.querySelector(selector);
const sources = ['Walk-in','Facebook','Strona WWW','Kontakt z salonem','OTOMOTO','Polecenia','Baza retencyjna','Importerskie','Broker','Serwis','Galerie','Targi'];
const sourceDetails = {
  0:'Klient przyszedł do salonu bez umówienia',
  1:'Wiadomość, komentarz lub zgłoszenie z reklamy na Facebooku',
  2:'E-mail lub formularz z naszej strony',
  3:'Karta kontaktu lub telefon do salonu',
  4:'Zapytanie z ogłoszenia na OTOMOTO',
  5:'Klient skierowany do salonu z polecenia',
  6:'Kontakt z dotychczasowym klientem z bazy salonu',
  7:'Zapytanie przekazane przez importera marki',
  8:'VEHIS i inne portale brokerskie',
  9:'Kontakt sprzedażowy z klientem serwisu',
  10:'Kontakt z ekspozycji lub akcji w galerii handlowej',
  11:'Kontakt pozyskany podczas targów'
};
// Keep the existing daily row positions. Slot 3 is the retired scheduled-drive count.
const columns = [
  [0,'Leady'],[1,'Próby kontaktu'],[2,'Spotkania'],[4,'Jazdy próbne'],[5,'Oferty'],
  [6,'Follow-up'],[7,'Zamówienia'],[10,'Wystawione faktury'],[8,'Rejestracje'],[9,'Opinie Google']
];
const quotes = ['Klient nie czyta w myślach. Zadzwoń.','Dobra jazda próbna zaczyna się od pytania.','Oferta wysłana? Daj klientowi powód, żeby do niej wrócił.','Czasem najlepszy argument to chwila ciszy.','Zamknij dzień, zanim dzień zamknie Ciebie.'];
const fortunes = [
  "Szacunek widać najlepiej wtedy, gdy rozmowa nie idzie po naszej myśli.",
  "Obiecuj tyle, ile możesz zrobić. Potem zrób to, co obiecałeś.",
  "To, co robisz regularnie, ma większe znaczenie niż to, co robisz od święta.",
  "Dobra praca zaczyna się od szacunku do czasu drugiego człowieka.",
  "Jeśli nie znasz odpowiedzi, powiedz to i wróć z odpowiedzią, której jesteś pewien.",
  "Ludzie pamiętają, czy potraktowałeś ich poważnie, także wtedy, gdy nic od Ciebie nie kupili.",
  "Uczciwa odpowiedź bywa trudna przez chwilę. Unik zostawia problem na dłużej.",
  "Z pracy wykonanej starannie korzysta też ktoś, kto przejmie ją po Tobie.",
  "Małe sprawy domykane na bieżąco rzadko urastają do wielkich problemów.",
  "Zanim komuś doradzisz, daj mu skończyć mówić.",
  "Własny błąd najłatwiej naprawić, kiedy nazwiesz go wprost.",
  "Pracowitość to również dokończenie sprawy, której nikt już dziś nie sprawdzi.",
  "Dobre nawyki buduje się w zwyczajne dni.",
  "Jeśli ktoś powierza Ci swój czas, odpłać mu uwagą.",
  "Kiedy termin jest zagrożony, uprzedź człowieka, który na Ciebie czeka.",
  "Rzetelność poznaje się po tym, czy jutro można polegać na tym, co zrobiłeś dziś.",
  "Każdy ma prawo do spokojnego wyjaśnienia, nawet gdy zadaje pytanie po raz drugi.",
  "Najwięcej zaufania budują drobne obietnice dotrzymane wiele razy.",
  "Jedna sprawa dokończona z uwagą jest warta więcej niż trzy zaczęte w pośpiechu.",
  "Gdy czyjaś praca Ci pomogła, powiedz mu o tym.",
  "Jutro łatwiej będzie wrócić do sprawy, jeśli dziś zapiszesz, na czym stanęła.",
  "W trudnej rozmowie możesz mówić wprost i zachować życzliwość.",
  "Systematyczność przydaje się szczególnie wtedy, gdy ze swojej pracy jeszcze nie widzisz efektu.",
  "Decyzję zostaw drugiemu człowiekowi. Zadbaj o to, by miał wszystkie potrzebne informacje.",
  "Kiedy ktoś się z Tobą nie zgadza, daj mu czas na dokończenie myśli.",
  "Kiedy podejmujesz się zadania, powiedz jasno, czego może się po Tobie spodziewać.",
  "Kiedy odkrywasz błąd, powiedz o tym osobom, których to dotyczy.",
  "Kiedy kończysz dzień pracy, zapisz, na czym stanęło.",
  "Kiedy długa lista zaczyna przytłaczać, wybierz jeden krok, który możesz wykonać od razu.",
  "Kiedy ktoś pomaga Ci w pracy, powiedz, za co konkretnie jesteś wdzięczny.",
  "Gdy rozmówca zadaje trudne pytanie, zacznij od upewnienia się, że dobrze rozumiesz jego punkt widzenia.",
  "Gdy ustalasz z kimś termin, zapisz ustalenia, póki są świeże.",
  "Gdy praca zaczyna się opóźniać, nazwij rzecz po imieniu i zaproponuj następny krok.",
  "Gdy odkładasz sprawę do jutra, zaznacz, które sprawy wciąż czekają na decyzję.",
  "Gdy duży cel wydaje się daleki, zapisz najbliższą rzecz do zrobienia i daj jej trochę czasu.",
  "Gdy kolega przejmuje trudną sprawę, zauważ także pracę wykonaną w tle.",
  "Kiedy klient wraca z wątpliwością, zostaw miejsce na odpowiedź drugiej osoby.",
  "Kiedy składasz obietnicę, zostaw sobie czas na staranne wykonanie pracy.",
  "Kiedy pojawia się przeszkoda, powiedz, co możesz zrobić od razu.",
  "Kiedy oddajesz komuś zadanie, sprawdź, czy kolejny krok jest jasny.",
  "Kiedy masz kilka spraw naraz, zacznij od punktu, który odblokuje dalszą pracę.",
  "Kiedy widzisz dobrze wykonaną pracę, daj tej osobie znać, co dzięki niej poszło lepiej.",
  "Gdy w zespole pojawia się różnica zdań, mów wprost i zachowaj życzliwość.",
  "Gdy ktoś prosi Cię o pomoc, umów się na termin, którego możesz dotrzymać.",
  "Gdy zmieniają się ustalenia, oddziel to, co już wiesz, od tego, co wymaga sprawdzenia.",
  "Gdy zamykasz ważny etap pracy, zostaw pod ręką potrzebne informacje.",
  "Gdy zadanie utknęło w połowie, ustal, która sprawa czeka na Ciebie najdłużej.",
  "Gdy zespół wspólnie osiąga cel, pamiętaj o tym, kiedy sam będziesz mógł pomóc.",
  "Kiedy ktoś opowiada o swoim problemie, sprawdź, co jest dla niego najważniejsze.",
  "Kiedy bierzesz odpowiedzialność za wspólną sprawę, ustal też, kiedy wrócisz z wiadomością.",
  "Kiedy sprawa wymaga poprawki, uprzedź tych, którzy liczą na Twój wynik.",
  "Kiedy robisz przerwę w dłuższym zadaniu, uporządkuj to, do czego będzie trzeba wrócić.",
  "Kiedy trudno Ci zacząć, przeznacz chwilę na to, co ma największe znaczenie.",
  "Kiedy ktoś dzieli się z Tobą doświadczeniem, wymień ten wkład, kiedy opowiadasz o wyniku.",
  "Gdy rozmowa schodzi na trudny temat, słuchaj uważnie także wtedy, gdy masz już własną odpowiedź.",
  "Gdy ustalasz, co zrobisz dla drugiej osoby, uwzględnij, ile czasu druga osoba będzie na Ciebie czekać.",
  "Gdy widzisz, że sprawy idą inaczej, niż zakładałeś, zadbaj, by każdy zainteresowany wiedział, co stanie się dalej.",
  "Gdy przekazujesz komuś wyniki swojej pracy, pomyśl, co ułatwi pracę osobie, która po Tobie ją podejmie.",
  "Gdy dzień zrobił się zbyt ciasny, podziel pracę na kawałki, które możesz uczciwie domknąć.",
  "Gdy czyjś wysiłek ułatwia Ci dzień, okaż szacunek, choćby krótkim i szczerym podziękowaniem.",
  "Kiedy ktoś się z Tobą nie zgadza, zacznij od upewnienia się, że dobrze rozumiesz jego punkt widzenia.",
  "Kiedy podejmujesz się zadania, zapisz ustalenia, póki są świeże.",
  "Kiedy odkrywasz błąd, nazwij rzecz po imieniu i zaproponuj następny krok.",
  "Kiedy kończysz dzień pracy, zaznacz, które sprawy wciąż czekają na decyzję.",
  "Kiedy długa lista zaczyna przytłaczać, zapisz najbliższą rzecz do zrobienia i daj jej trochę czasu.",
  "Kiedy ktoś pomaga Ci w pracy, zauważ także pracę wykonaną w tle.",
  "Gdy rozmówca zadaje trudne pytanie, zostaw miejsce na odpowiedź drugiej osoby.",
  "Gdy ustalasz z kimś termin, zostaw sobie czas na staranne wykonanie pracy.",
  "Gdy praca zaczyna się opóźniać, powiedz, co możesz zrobić od razu.",
  "Gdy odkładasz sprawę do jutra, sprawdź, czy kolejny krok jest jasny.",
  "Gdy duży cel wydaje się daleki, zacznij od punktu, który odblokuje dalszą pracę.",
  "Gdy kolega przejmuje trudną sprawę, daj tej osobie znać, co dzięki niej poszło lepiej.",
  "Kiedy klient wraca z wątpliwością, mów wprost i zachowaj życzliwość.",
  "Kiedy składasz obietnicę, umów się na termin, którego możesz dotrzymać.",
  "Kiedy pojawia się przeszkoda, oddziel to, co już wiesz, od tego, co wymaga sprawdzenia.",
  "Kiedy oddajesz komuś zadanie, zostaw pod ręką potrzebne informacje.",
  "Kiedy masz kilka spraw naraz, ustal, która sprawa czeka na Ciebie najdłużej.",
  "Kiedy widzisz dobrze wykonaną pracę, pamiętaj o tym, kiedy sam będziesz mógł pomóc.",
  "Gdy w zespole pojawia się różnica zdań, sprawdź, co jest dla niego najważniejsze.",
  "Gdy ktoś prosi Cię o pomoc, ustal też, kiedy wrócisz z wiadomością.",
  "Gdy zmieniają się ustalenia, uprzedź tych, którzy liczą na Twój wynik.",
  "Gdy zamykasz ważny etap pracy, uporządkuj to, do czego będzie trzeba wrócić.",
  "Gdy zadanie utknęło w połowie, przeznacz chwilę na to, co ma największe znaczenie.",
  "Gdy zespół wspólnie osiąga cel, wymień ten wkład, kiedy opowiadasz o wyniku.",
  "Kiedy ktoś opowiada o swoim problemie, słuchaj uważnie także wtedy, gdy masz już własną odpowiedź.",
  "Kiedy bierzesz odpowiedzialność za wspólną sprawę, uwzględnij, ile czasu druga osoba będzie na Ciebie czekać.",
  "Kiedy sprawa wymaga poprawki, zadbaj, by każdy zainteresowany wiedział, co stanie się dalej.",
  "Kiedy robisz przerwę w dłuższym zadaniu, pomyśl, co ułatwi pracę osobie, która po Tobie ją podejmie.",
  "Kiedy trudno Ci zacząć, podziel pracę na kawałki, które możesz uczciwie domknąć.",
  "Kiedy ktoś dzieli się z Tobą doświadczeniem, okaż szacunek, choćby krótkim i szczerym podziękowaniem.",
  "Gdy rozmowa schodzi na trudny temat, daj mu czas na dokończenie myśli.",
  "Gdy ustalasz, co zrobisz dla drugiej osoby, powiedz jasno, czego może się po Tobie spodziewać.",
  "Gdy widzisz, że sprawy idą inaczej, niż zakładałeś, powiedz o tym osobom, których to dotyczy.",
  "Gdy przekazujesz komuś wyniki swojej pracy, zapisz, na czym stanęło.",
  "Gdy dzień zrobił się zbyt ciasny, wybierz jeden krok, który możesz wykonać od razu.",
  "Gdy czyjś wysiłek ułatwia Ci dzień, powiedz, za co konkretnie jesteś wdzięczny.",
  "Kiedy ktoś się z Tobą nie zgadza, zostaw miejsce na odpowiedź drugiej osoby.",
  "Kiedy podejmujesz się zadania, zostaw sobie czas na staranne wykonanie pracy.",
  "Kiedy odkrywasz błąd, powiedz, co możesz zrobić od razu.",
  "Kiedy kończysz dzień pracy, sprawdź, czy kolejny krok jest jasny.",
  "Kiedy długa lista zaczyna przytłaczać, zacznij od punktu, który odblokuje dalszą pracę.",
  "Kiedy ktoś pomaga Ci w pracy, daj tej osobie znać, co dzięki niej poszło lepiej.",
  "Gdy rozmówca zadaje trudne pytanie, mów wprost i zachowaj życzliwość.",
  "Gdy ustalasz z kimś termin, umów się na termin, którego możesz dotrzymać.",
  "Gdy praca zaczyna się opóźniać, oddziel to, co już wiesz, od tego, co wymaga sprawdzenia.",
  "Gdy odkładasz sprawę do jutra, zostaw pod ręką potrzebne informacje.",
  "Gdy duży cel wydaje się daleki, ustal, która sprawa czeka na Ciebie najdłużej.",
  "Gdy kolega przejmuje trudną sprawę, pamiętaj o tym, kiedy sam będziesz mógł pomóc.",
  "Kiedy klient wraca z wątpliwością, sprawdź, co jest dla niego najważniejsze.",
  "Kiedy składasz obietnicę, ustal też, kiedy wrócisz z wiadomością.",
  "Kiedy pojawia się przeszkoda, uprzedź tych, którzy liczą na Twój wynik.",
  "Kiedy oddajesz komuś zadanie, uporządkuj to, do czego będzie trzeba wrócić.",
  "Kiedy masz kilka spraw naraz, przeznacz chwilę na to, co ma największe znaczenie.",
  "Kiedy widzisz dobrze wykonaną pracę, wymień ten wkład, kiedy opowiadasz o wyniku.",
  "Gdy w zespole pojawia się różnica zdań, słuchaj uważnie także wtedy, gdy masz już własną odpowiedź.",
  "Gdy ktoś prosi Cię o pomoc, uwzględnij, ile czasu druga osoba będzie na Ciebie czekać.",
  "Gdy zmieniają się ustalenia, zadbaj, by każdy zainteresowany wiedział, co stanie się dalej.",
  "Gdy zamykasz ważny etap pracy, pomyśl, co ułatwi pracę osobie, która po Tobie ją podejmie.",
  "Gdy zadanie utknęło w połowie, podziel pracę na kawałki, które możesz uczciwie domknąć.",
  "Gdy zespół wspólnie osiąga cel, okaż szacunek, choćby krótkim i szczerym podziękowaniem.",
  "Kiedy ktoś opowiada o swoim problemie, daj mu czas na dokończenie myśli.",
  "Kiedy bierzesz odpowiedzialność za wspólną sprawę, powiedz jasno, czego może się po Tobie spodziewać.",
  "Kiedy sprawa wymaga poprawki, powiedz o tym osobom, których to dotyczy.",
  "Kiedy robisz przerwę w dłuższym zadaniu, zapisz, na czym stanęło.",
  "Kiedy trudno Ci zacząć, wybierz jeden krok, który możesz wykonać od razu.",
  "Kiedy ktoś dzieli się z Tobą doświadczeniem, powiedz, za co konkretnie jesteś wdzięczny.",
  "Gdy rozmowa schodzi na trudny temat, zacznij od upewnienia się, że dobrze rozumiesz jego punkt widzenia.",
  "Gdy ustalasz, co zrobisz dla drugiej osoby, zapisz ustalenia, póki są świeże.",
  "Gdy widzisz, że sprawy idą inaczej, niż zakładałeś, nazwij rzecz po imieniu i zaproponuj następny krok.",
  "Gdy przekazujesz komuś wyniki swojej pracy, zaznacz, które sprawy wciąż czekają na decyzję.",
  "Gdy dzień zrobił się zbyt ciasny, zapisz najbliższą rzecz do zrobienia i daj jej trochę czasu.",
  "Gdy czyjś wysiłek ułatwia Ci dzień, zauważ także pracę wykonaną w tle.",
  "Kiedy ktoś się z Tobą nie zgadza, mów wprost i zachowaj życzliwość.",
  "Kiedy podejmujesz się zadania, umów się na termin, którego możesz dotrzymać.",
  "Kiedy odkrywasz błąd, oddziel to, co już wiesz, od tego, co wymaga sprawdzenia.",
  "Kiedy kończysz dzień pracy, zostaw pod ręką potrzebne informacje.",
  "Kiedy długa lista zaczyna przytłaczać, ustal, która sprawa czeka na Ciebie najdłużej.",
  "Kiedy ktoś pomaga Ci w pracy, pamiętaj o tym, kiedy sam będziesz mógł pomóc.",
  "Gdy rozmówca zadaje trudne pytanie, sprawdź, co jest dla niego najważniejsze.",
  "Gdy ustalasz z kimś termin, ustal też, kiedy wrócisz z wiadomością.",
  "Gdy praca zaczyna się opóźniać, uprzedź tych, którzy liczą na Twój wynik.",
  "Gdy odkładasz sprawę do jutra, uporządkuj to, do czego będzie trzeba wrócić.",
  "Gdy duży cel wydaje się daleki, przeznacz chwilę na to, co ma największe znaczenie.",
  "Gdy kolega przejmuje trudną sprawę, wymień ten wkład, kiedy opowiadasz o wyniku.",
  "Kiedy klient wraca z wątpliwością, słuchaj uważnie także wtedy, gdy masz już własną odpowiedź.",
  "Kiedy składasz obietnicę, uwzględnij, ile czasu druga osoba będzie na Ciebie czekać.",
  "Kiedy pojawia się przeszkoda, zadbaj, by każdy zainteresowany wiedział, co stanie się dalej.",
  "Kiedy oddajesz komuś zadanie, pomyśl, co ułatwi pracę osobie, która po Tobie ją podejmie.",
  "Kiedy masz kilka spraw naraz, podziel pracę na kawałki, które możesz uczciwie domknąć.",
  "Kiedy widzisz dobrze wykonaną pracę, okaż szacunek, choćby krótkim i szczerym podziękowaniem.",
  "Gdy w zespole pojawia się różnica zdań, daj mu czas na dokończenie myśli.",
  "Gdy ktoś prosi Cię o pomoc, powiedz jasno, czego może się po Tobie spodziewać.",
  "Gdy zmieniają się ustalenia, powiedz o tym osobom, których to dotyczy.",
  "Gdy zamykasz ważny etap pracy, zapisz, na czym stanęło.",
  "Gdy zadanie utknęło w połowie, wybierz jeden krok, który możesz wykonać od razu.",
  "Gdy zespół wspólnie osiąga cel, powiedz, za co konkretnie jesteś wdzięczny.",
  "Kiedy ktoś opowiada o swoim problemie, zacznij od upewnienia się, że dobrze rozumiesz jego punkt widzenia.",
  "Kiedy bierzesz odpowiedzialność za wspólną sprawę, zapisz ustalenia, póki są świeże.",
  "Kiedy sprawa wymaga poprawki, nazwij rzecz po imieniu i zaproponuj następny krok.",
  "Kiedy robisz przerwę w dłuższym zadaniu, zaznacz, które sprawy wciąż czekają na decyzję.",
  "Kiedy trudno Ci zacząć, zapisz najbliższą rzecz do zrobienia i daj jej trochę czasu.",
  "Kiedy ktoś dzieli się z Tobą doświadczeniem, zauważ także pracę wykonaną w tle.",
  "Gdy rozmowa schodzi na trudny temat, zostaw miejsce na odpowiedź drugiej osoby.",
  "Gdy ustalasz, co zrobisz dla drugiej osoby, zostaw sobie czas na staranne wykonanie pracy.",
  "Gdy widzisz, że sprawy idą inaczej, niż zakładałeś, powiedz, co możesz zrobić od razu.",
  "Gdy przekazujesz komuś wyniki swojej pracy, sprawdź, czy kolejny krok jest jasny.",
  "Gdy dzień zrobił się zbyt ciasny, zacznij od punktu, który odblokuje dalszą pracę.",
  "Gdy czyjś wysiłek ułatwia Ci dzień, daj tej osobie znać, co dzięki niej poszło lepiej.",
  "Kiedy ktoś się z Tobą nie zgadza, sprawdź, co jest dla niego najważniejsze.",
  "Kiedy podejmujesz się zadania, ustal też, kiedy wrócisz z wiadomością.",
  "Kiedy odkrywasz błąd, uprzedź tych, którzy liczą na Twój wynik.",
  "Kiedy kończysz dzień pracy, uporządkuj to, do czego będzie trzeba wrócić.",
  "Kiedy długa lista zaczyna przytłaczać, przeznacz chwilę na to, co ma największe znaczenie.",
  "Kiedy ktoś pomaga Ci w pracy, wymień ten wkład, kiedy opowiadasz o wyniku.",
  "Gdy rozmówca zadaje trudne pytanie, słuchaj uważnie także wtedy, gdy masz już własną odpowiedź.",
  "Gdy ustalasz z kimś termin, uwzględnij, ile czasu druga osoba będzie na Ciebie czekać.",
  "Gdy praca zaczyna się opóźniać, zadbaj, by każdy zainteresowany wiedział, co stanie się dalej.",
  "Gdy odkładasz sprawę do jutra, pomyśl, co ułatwi pracę osobie, która po Tobie ją podejmie.",
  "Gdy duży cel wydaje się daleki, podziel pracę na kawałki, które możesz uczciwie domknąć.",
  "Gdy kolega przejmuje trudną sprawę, okaż szacunek, choćby krótkim i szczerym podziękowaniem.",
  "Kiedy klient wraca z wątpliwością, daj mu czas na dokończenie myśli.",
  "Kiedy składasz obietnicę, powiedz jasno, czego może się po Tobie spodziewać.",
  "Kiedy pojawia się przeszkoda, powiedz o tym osobom, których to dotyczy.",
  "Kiedy oddajesz komuś zadanie, zapisz, na czym stanęło.",
  "Kiedy masz kilka spraw naraz, wybierz jeden krok, który możesz wykonać od razu.",
  "Kiedy widzisz dobrze wykonaną pracę, powiedz, za co konkretnie jesteś wdzięczny.",
  "Gdy w zespole pojawia się różnica zdań, zacznij od upewnienia się, że dobrze rozumiesz jego punkt widzenia.",
  "Gdy ktoś prosi Cię o pomoc, zapisz ustalenia, póki są świeże.",
  "Gdy zmieniają się ustalenia, nazwij rzecz po imieniu i zaproponuj następny krok.",
  "Gdy zamykasz ważny etap pracy, zaznacz, które sprawy wciąż czekają na decyzję.",
  "Gdy zadanie utknęło w połowie, zapisz najbliższą rzecz do zrobienia i daj jej trochę czasu.",
  "Gdy zespół wspólnie osiąga cel, zauważ także pracę wykonaną w tle.",
  "Kiedy ktoś opowiada o swoim problemie, zostaw miejsce na odpowiedź drugiej osoby.",
  "Kiedy bierzesz odpowiedzialność za wspólną sprawę, zostaw sobie czas na staranne wykonanie pracy.",
  "Kiedy sprawa wymaga poprawki, powiedz, co możesz zrobić od razu.",
  "Kiedy robisz przerwę w dłuższym zadaniu, sprawdź, czy kolejny krok jest jasny.",
  "Kiedy trudno Ci zacząć, zacznij od punktu, który odblokuje dalszą pracę.",
  "Kiedy ktoś dzieli się z Tobą doświadczeniem, daj tej osobie znać, co dzięki niej poszło lepiej.",
  "Gdy rozmowa schodzi na trudny temat, mów wprost i zachowaj życzliwość.",
  "Gdy ustalasz, co zrobisz dla drugiej osoby, umów się na termin, którego możesz dotrzymać.",
  "Gdy widzisz, że sprawy idą inaczej, niż zakładałeś, oddziel to, co już wiesz, od tego, co wymaga sprawdzenia.",
  "Gdy przekazujesz komuś wyniki swojej pracy, zostaw pod ręką potrzebne informacje.",
  "Gdy dzień zrobił się zbyt ciasny, ustal, która sprawa czeka na Ciebie najdłużej.",
  "Gdy czyjś wysiłek ułatwia Ci dzień, pamiętaj o tym, kiedy sam będziesz mógł pomóc.",
  "Kiedy ktoś się z Tobą nie zgadza, słuchaj uważnie także wtedy, gdy masz już własną odpowiedź.",
  "Kiedy podejmujesz się zadania, uwzględnij, ile czasu druga osoba będzie na Ciebie czekać.",
  "Kiedy odkrywasz błąd, zadbaj, by każdy zainteresowany wiedział, co stanie się dalej.",
  "Kiedy kończysz dzień pracy, pomyśl, co ułatwi pracę osobie, która po Tobie ją podejmie.",
  "Kiedy długa lista zaczyna przytłaczać, podziel pracę na kawałki, które możesz uczciwie domknąć.",
  "Kiedy ktoś pomaga Ci w pracy, okaż szacunek, choćby krótkim i szczerym podziękowaniem.",
  "Gdy rozmówca zadaje trudne pytanie, daj mu czas na dokończenie myśli.",
  "Gdy ustalasz z kimś termin, powiedz jasno, czego może się po Tobie spodziewać.",
  "Gdy praca zaczyna się opóźniać, powiedz o tym osobom, których to dotyczy.",
  "Gdy odkładasz sprawę do jutra, zapisz, na czym stanęło.",
  "Gdy duży cel wydaje się daleki, wybierz jeden krok, który możesz wykonać od razu.",
  "Gdy kolega przejmuje trudną sprawę, powiedz, za co konkretnie jesteś wdzięczny.",
  "Kiedy klient wraca z wątpliwością, zacznij od upewnienia się, że dobrze rozumiesz jego punkt widzenia.",
  "Kiedy składasz obietnicę, zapisz ustalenia, póki są świeże.",
  "Kiedy pojawia się przeszkoda, nazwij rzecz po imieniu i zaproponuj następny krok.",
  "Kiedy oddajesz komuś zadanie, zaznacz, które sprawy wciąż czekają na decyzję.",
  "Kiedy masz kilka spraw naraz, zapisz najbliższą rzecz do zrobienia i daj jej trochę czasu.",
  "Kiedy widzisz dobrze wykonaną pracę, zauważ także pracę wykonaną w tle.",
  "Gdy w zespole pojawia się różnica zdań, zostaw miejsce na odpowiedź drugiej osoby.",
  "Gdy ktoś prosi Cię o pomoc, zostaw sobie czas na staranne wykonanie pracy.",
  "Gdy zmieniają się ustalenia, powiedz, co możesz zrobić od razu.",
  "Gdy zamykasz ważny etap pracy, sprawdź, czy kolejny krok jest jasny.",
  "Gdy zadanie utknęło w połowie, zacznij od punktu, który odblokuje dalszą pracę.",
  "Gdy zespół wspólnie osiąga cel, daj tej osobie znać, co dzięki niej poszło lepiej.",
  "Kiedy ktoś opowiada o swoim problemie, mów wprost i zachowaj życzliwość.",
  "Kiedy bierzesz odpowiedzialność za wspólną sprawę, umów się na termin, którego możesz dotrzymać.",
  "Kiedy sprawa wymaga poprawki, oddziel to, co już wiesz, od tego, co wymaga sprawdzenia.",
  "Kiedy robisz przerwę w dłuższym zadaniu, zostaw pod ręką potrzebne informacje.",
  "Kiedy trudno Ci zacząć, ustal, która sprawa czeka na Ciebie najdłużej.",
  "Kiedy ktoś dzieli się z Tobą doświadczeniem, pamiętaj o tym, kiedy sam będziesz mógł pomóc.",
  "Gdy rozmowa schodzi na trudny temat, sprawdź, co jest dla niego najważniejsze.",
  "Gdy ustalasz, co zrobisz dla drugiej osoby, ustal też, kiedy wrócisz z wiadomością.",
  "Gdy widzisz, że sprawy idą inaczej, niż zakładałeś, uprzedź tych, którzy liczą na Twój wynik.",
  "Gdy przekazujesz komuś wyniki swojej pracy, uporządkuj to, do czego będzie trzeba wrócić.",
  "Gdy dzień zrobił się zbyt ciasny, przeznacz chwilę na to, co ma największe znaczenie.",
  "Gdy czyjś wysiłek ułatwia Ci dzień, wymień ten wkład, kiedy opowiadasz o wyniku."
];
const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(new Date());
const dateLabel = (day,options={day:'numeric',month:'long'}) => new Date(day+'T12:00:00Z').toLocaleDateString('pl-PL',options);
const weekday = day => ![0,6].includes(new Date(day+'T12:00:00Z').getUTCDay());
const remainingDays = (start,end) => {
  let count=0;
  for (let at=Date.parse(start); at<Date.parse(end); at+=86400000) {
    if (weekday(new Date(at).toISOString().slice(0,10))) count++;
  }
  return count;
};
const monthStart = (year,month) => new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
let data;
let editDay;
let busy=false;
let preview=false;
const allPreviewSalons='\u0000all-salons';
let managerPreviewSalon='';
let groupPreviewName='';
let managerReturnHash='';
let previewResult=null;

async function api(path,body) {
  if (body!==undefined&&(managerPreviewSalon||groupPreviewName))
    throw new Error('To podgląd. Zmiany możesz zapisać z konta kierownika lub szefa grupy.');
  const url=new URL(path,location.origin);
  const selectedRole=sessionStorage.getItem('lejek-active-role');
  if (selectedRole) url.searchParams.set('role',selectedRole);
  const response=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const result=await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function pluralForm(count,forms) {
  if (count===1) return forms[0];
  const last=count%10;
  const lastTwo=count%100;
  return last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?forms[1]:forms[2];
}

function renderPlans(records) {
  const [year,month]=data.today.split('-').map(Number);
  const monthKey=data.today.slice(0,7);
  const monthEnd=monthStart(year,month);
  const monthPlan=data.plans.find(row=>row.month===monthKey)?.target;
  const quarterPlan=data.plans.length===3?data.plans.reduce((total,row)=>total+row.target,0):null;
  const sales=entries=>entries.reduce((total,[,values])=>total+(values[4]??0),0);
  const toDate=Object.entries(records).filter(([day])=>day<=data.today);
  const monthRecords=toDate.filter(([day])=>day.startsWith(monthKey));
  const monthSales=sales(monthRecords);
  const quarterSales=sales(toDate);
  const daysLeft=remainingDays(data.today,monthEnd);
  const isWorkday=weekday(data.today)&&!['leave','training'].includes(data.personal.exceptions[data.today]);
  const current=records[data.today]??[];
  const todayOrders=activityCount(current,7);
  const orderGoal=dailyTarget(monthPlan,monthSales-todayOrders,daysLeft,isWorkday);
  const cards=[['Dzisiaj',todayOrders,orderGoal],['Miesiąc',monthSales,monthPlan],['Kwartał',quarterSales,quarterPlan]];
  $('#cards').innerHTML=cards.map(([name,value,target])=>{
    const gap=target==null?null:target-value;
    return '<section><span>'+name+'</span><strong>'+value+' / '+(target??'—')+'</strong><small class="'+(gap>0?'behind':gap<0?'ahead':'')+'">'+
      (gap==null?'Brak planu':gap>0?'Brakuje '+gap:gap<0?'Ponad plan':'Plan osiągnięty')+'</small></section>';
  }).join('');
  const funnel=data.funnelPlans?.find(row=>row.month===monthKey);
  const reviewTarget=data.reviewPlans?.find(row=>row.month===monthKey)?.target;
  const metrics=monthlyMetrics(monthRecords,current,monthPlan,funnel,reviewTarget,data.today,daysLeft,isWorkday);
  $('#pace').hidden=false;
  $('#pace-items').innerHTML=metrics.map(({label,actual,target,goal,delta})=>{
    const style=delta<0?'behind':delta>0?'ahead':'';
    const status=delta==null?'Brak celu':delta<0?'Brakuje '+(-delta):delta>0?'Ponad planem o '+delta:'Zgodnie z planem';
    return '<div class="pace-item"><span>'+label+'</span><strong class="pace-count">'+actual+' / '+(goal??'—')+'</strong>'+
      '<strong class="'+style+'">'+status+'</strong>'+(target==null?'':'<small class="pace-month">Cel miesiąca · '+target+'</small>')+'</div>';
  }).join('');
  renderTodayTasks(metrics,data.previousDaily,data.today);
  renderMotivator(metrics,data.today);
}

function monthlyMetrics(records,current,monthPlan,funnel,reviewTarget,day,daysLeft,isWorkday) {
  const [year,month]=day.split('-').map(Number);
  const monthEnd=monthStart(year,month);
  const daysMonth=remainingDays(day.slice(0,7)+'-01',monthEnd);
  const elapsed=daysMonth-remainingDays(day,monthEnd);
  const fraction=(elapsed+Number(weekday(day)))/daysMonth;
  const monthTargets=monthPlan?sourceTargets(monthPlan):[];
  const custom=funnel?JSON.parse(funnel.targets):[];
  const customIndex={1:0,4:1,5:2,0:3,2:4,6:5,10:6,8:7};
  return columns.map(([index,label])=>{
    const actual=records.reduce((sum,[,values])=>sum+activityCount(values,index),0);
    const standard=monthPlan!=null&&index<=7?monthTargets.reduce((sum,row)=>sum+(row[index]??0),0):null;
    const target=(index===9?reviewTarget:index===7?monthPlan:(custom[customIndex[index]]??standard))??null;
    const goal=target==null?null:Math.round(target*fraction);
    const doneToday=activityCount(current,index);
    const todayTarget=dailyTarget(target,actual-doneToday,daysLeft,isWorkday);
    return {index,label,actual,target,goal,delta:goal==null?null:actual-goal,doneToday,todayTarget};
  });
}

function activityCount(values,index) {
  const legacyIndex={1:0,4:2,5:3,7:4};
  const matrix=values?.[5];
  return Array.isArray(matrix)
    ?matrix.reduce((sum,row)=>sum+(row[index]??0),0)
    :values?.[legacyIndex[index]]??0;
}

const taskWording={
  0:['Obsłuż',['nowe zapytanie','nowe zapytania','nowych zapytań']],
  1:['Wykonaj',['próbę kontaktu','próby kontaktu','prób kontaktu']],
  2:['Przeprowadź',['spotkanie','spotkania','spotkań']],
  4:['Przeprowadź',['jazdę próbną','jazdy próbne','jazd próbnych']],
  5:['Wyślij',['ofertę','oferty','ofert']],
  6:['Zrób',['follow-up','follow-upy','follow-upów']],
  7:['Domknij',['zamówienie','zamówienia','zamówień']],
  8:['Zarejestruj',['auto','auta','aut']],
  9:['Zdobądź',['opinię w Google','opinie w Google','opinii w Google']],
  10:['Wystaw',['fakturę','faktury','faktur']]
};

function dailyTarget(monthTarget,doneBeforeToday,daysLeft,isWorkday) {
  if (monthTarget==null) return null;
  return isWorkday?Math.ceil(Math.max(0,monthTarget-doneBeforeToday)/Math.max(1,daysLeft)):0;
}

const dailyMotivators={
  mixed:[
    'Jeden odcinek masz z górki. Drugi jeszcze pod górę, więc przyda się bieg niżej.',
    'Jest czym się pochwalić przy kawie. Po kawie wróć do miejsca, które odstaje.',
    'Na jednym odcinku zielona fala, na drugim mały korek. Jest co odblokować.',
    'Oferta poszła jak po maśle. Teraz odblokuj to, co jeszcze stoi w kolejce.',
    'Jedna kontrolka świeci na zielono. Zerknij też na tę, która się dopomina.',
    'Wynik ma i gaz, i hamulec. Zacznij od miejsca, w którym traci prędkość.',
    'Jedna liczba już zasłużyła na kawę. Drugiej przyda się telefon.',
    'W jednym miejscu kolejka się rozładowała. Czas ruszyć ten drugi korek.',
    'Masz powód do uśmiechu i punkt do poprawy. Oba zmieszczą się przed lunchem.',
    'Jedna rubryka wygląda jak z prezentacji dla szefa. Drugą weź teraz na warsztat.',
    'Po jednej stronie salonu fanfary. Po drugiej wystarczy kilka konkretnych ruchów.',
    'Dobra passa już jest. Przenieś ją tam, gdzie licznik stoi.'
  ],
  behind:[
    'Plan złapał korek. Jeden konkretny ruch i zacznie się rozjeżdżać.',
    'Lejek zaciągnął ręczny. Pierwsze zadanie to dobry moment, żeby go zwolnić.',
    'Samym patrzeniem na licznik daleko nie zajedziemy. Zacznij od jednego ruchu.',
    'Klient nie oddzwoni do wykresu. Zacznij od rozmowy, którą odkładasz.',
    'CRM ma pamięć słonia. Przypomnij sobie, komu obiecałeś odpowiedź.',
    'Kawa już zrobiła swoje. Teraz kolej na pierwszy punkt z listy.',
    'Cel nie odbierze telefonu sam. Wybierz jeden numer i rusz z miejsca.',
    'Dziś plan marudzi. Najszybciej uciszy go pierwsze wykonane zadanie.',
    'Lista wygląda groźnie głównie przed pierwszym odhaczeniem. Sprawdźmy tę teorię.',
    'Jeśli lejek stoi, zrób pierwszy ruch. Nawet ekspozycyjne auto kiedyś wyjeżdża.',
    'Najtrudniej zacząć. Potem już tylko klient mówi, że musi się zastanowić.',
    'Zaległość sama nie zniknie. Ale po jednym telefonie może być o jedną mniejsza.'
  ],
  ahead:[
    'Tempo masz jak na jeździe próbnej. Trzymaj je, jutro sobie podziękujesz.',
    'Plan zostaje w lusterku. Jeszcze jeden dobry ruch i jutro ruszysz z przewagą.',
    'Jest zapas, ale auto samo do mety nie dojedzie. Trzymaj tempo.',
    'Masz przewagę. Zrób jeszcze jeden ruch, żeby jutrzejsza kawa była spokojniejsza.',
    'Licznik wygląda dobrze. Utrzymaj rytm, zanim CRM uzna, że dziś święto.',
    'Plan już macha z tyłu. Dokończ otwarte sprawy i zrób miejsce na jutro.',
    'Dzisiaj to Ty nadajesz tempo. Wykorzystaj zapas na rozmowę, którą warto domknąć.',
    'Plan dostał lekkiej zadyszki. Ty możesz jeszcze przygotować grunt na jutro.',
    'Wynik wygląda, jakby wypił podwójne espresso. Dokończ dzień w swoim tempie.',
    'Masz bufor. Zużyj go na jedno dobre przygotowanie, zanim kalendarz znów się zapełni.',
    'Zapas jest po Twojej stronie. Dopnij jeden temat, żeby jutro wystartować z rozpędu.',
    'Można już pomyśleć o kawie. Wcześniej pozamykaj sprawy, które jutro mogłyby wrócić.'
  ],
  onPace:[
    'Jedziesz zgodnie z planem. Nawigacja może odetchnąć, Ty odhacz następny krok.',
    'Tempo jest w punkt. Jeszcze jeden dobry ruch i można spokojnie dopić kawę.',
    'Wszystko jedzie według rozkładu. Pilnuj rytmu, a plan nie ucieknie.',
    'Licznik i plan jadą równo. Pilnuj odstępu i odhacz kolejny punkt.',
    'CRM jeszcze nie klaszcze, ale liczby już wyglądają dobrze. Trzymaj rytm.',
    'Na razie plan się nie czepia. Dokończ następny punkt, żeby tak zostało.',
    'Masz dobre tempo. Przy najbliższym postoju sprawdź, co jeszcze dziś zostało.',
    'Kalendarz mówi, że jest dobrze. Lista poniżej wie, co zrobić dalej.',
    'Dzień idzie według rozpiski. Jeden konkret przed kawą zrobi różnicę.',
    'Jesteś na trasie. Żadnych nerwowych manewrów, po prostu kolejny ruch.',
    'Plan jest zadowolony. Na wszelki wypadek odhacz następny punkt.',
    'Wynik trzyma się planu jak klient dobrej oferty. Utrzymaj ten rytm.'
  ]
};

const dailyClosings={
  tasks:[
    "Pierwszy punkt sam się nie odhaczy. Reszta pójdzie z górki.",
    "Zacznij od konkretu. Kawa może robić za nagrodę.",
    "Pierwszy ruch należy do Ciebie. CRM tylko patrzy.",
    "Odhacz jedno. Lista od razu przestanie wyglądać jak poniedziałek.",
    "Jeden krok teraz, jeden problem mniej przed zamknięciem salonu.",
    "Klient nie zna Twojego planu. Zna za to swój numer telefonu.",
    "Zacznij od góry. Lista nie ma trybu automatycznego.",
    "Nie trzeba dziś wygrać rajdu. Wystarczy przejechać dzisiejszy odcinek.",
    "Zrób pierwszy ruch, zanim kawa wystygnie.",
    "Kliknięcie w CRM jest szybkie. Ruch przed kliknięciem robi wynik.",
    "Plan lubi konkrety. Zacznij od pierwszego z listy.",
    "Jeden dobry ruch i licznik przestanie udawać dekorację."
  ],
  followups:[
    "Oferta wysłana. Teraz piłka znów jest u Ciebie.",
    "Oferta w skrzynce to początek rozmowy. Zadzwoń i sprawdź ciąg dalszy.",
    "Klient miał się zastanowić. Daj mu okazję powiedzieć, nad czym.",
    "Skrzynka milczy? Telefon nadal działa.",
    "Zamiast odświeżać skrzynkę, odśwież klientowi temat.",
    "Dobra oferta zasługuje na ciąg dalszy. Ustal z klientem następny krok.",
    "Oferta nie ma funkcji oddzwaniania. Na szczęście masz ją Ty.",
    "Masz już ofertę. Teraz sprawdź, czego klient potrzebuje do decyzji.",
    "Jedno pytanie do klienta może oszczędzić tydzień zgadywania.",
    "Wysłane nie znaczy przeczytane. Sprawdź, czy oferta dotarła.",
    "Oferta samotnie stoi w skrzynce. Dotrzymaj jej towarzystwa telefonem.",
    "Zadzwoń w sprawie oferty. Może klient już wie więcej niż wczoraj."
  ],
  done:[
    "Plan na dziś odhaczony. Kawa smakuje lepiej bez zaległych punktów.",
    "Lista pusta. Nawet CRM może chwilę odpocząć.",
    "Dzisiejszy odcinek zaliczony. Jutro ruszysz z rozpędu.",
    "Plan zrobiony. Ten moment warto zapamiętać na następny poniedziałek.",
    "Lista zgłasza brak uwag. To się jej rzadko zdarza.",
    "Wszystko odhaczone. Kawa tym razem bez pośpiechu.",
    "Dobra robota. Jutro licznik startuje od zera, Ty już z doświadczeniem.",
    "Plan domknięty. Możesz spokojnie zgasić światła na ekspozycji.",
    "Lejek mówi, że wystarczy. Dzisiaj warto go posłuchać.",
    "Cel dzienny zaliczony. Zapisz wynik, zanim CRM zacznie tęsknić.",
    "Lista jest pusta. To całkiem dobry widok na koniec dnia.",
    "Dzisiejsza trasa za Tobą. Jutro kolejny odcinek."
  ]
};

function renderTodayTasks(metrics,previous,day) {
  const tasks=metrics.filter(({todayTarget,doneToday})=>todayTarget>doneToday)
    .sort((a,b)=>(a.goal?a.actual/a.goal:1)-(b.goal?b.actual/b.goal:1));
  const strongest=metrics.filter(metric=>metric.delta>0).sort((a,b)=>b.delta-a.delta)[0];
  const weakest=metrics.filter(metric=>metric.goal>0&&metric.delta<0)
    .sort((a,b)=>a.actual/a.goal-b.actual/b.goal)[0];
  const hasPlan=metrics.some(({target})=>target!=null);
  const intro=$('#tasks-intro');
  intro.hidden=!hasPlan;
  const tone=weakest?(strongest?'mixed':'behind'):(strongest?'ahead':'onPace');
  const highlights=[strongest&&strongest.label+' ponad planem.',weakest&&weakest.label+' poniżej planu.'].filter(Boolean);
  const messages=dailyMotivators[tone];
  const variant=Math.floor(Date.parse(day)/86400000)%messages.length;
  intro.textContent=[...highlights,messages[variant]].join(' ');
  $('#tasks').innerHTML=tasks.length?tasks.map(({index,doneToday,todayTarget})=>{
    const [verb,forms]=taskWording[index];
    const gap=todayTarget-doneToday;
    return '<li><span class="task-action"><span>'+verb+'</span> <strong>'+gap+'</strong> <span>'+pluralForm(gap,forms)+'</span></span></li>';
  }).join(''):'<li class="task-message">'+(hasPlan?'Na dziś nie zostały żadne zadania z planu.':'Ustal z kierownikiem cel, a tutaj pojawią się Twoje zadania.')+'</li>';

  const previousOffers=previous?activityCount(JSON.parse(previous.counters),5):0;
  const followups=metrics.find(({index})=>index===6);
  const remaining=Math.max(0,previousOffers-(followups?.doneToday??0));
  const reminder=$('#followup-reminder');
  reminder.hidden=!remaining;
  reminder.textContent=remaining
    ?'Wróć do ofert z '+dateLabel(previous.day)+' ('+remaining+' do sprawdzenia). ' + (followups?.target!=null?'Rozmowy liczą się do planu.':'')
    :'';
  const closing=$('#tasks-closing');
  closing.hidden=!tasks.length&&!remaining&&!metrics.some(metric=>metric.todayTarget>0);
  const endings=dailyClosings[tasks.length?'tasks':remaining?'followups':'done'];
  const dayIndex=Math.floor(Date.parse(day)/86400000);
  closing.textContent=endings[dayIndex%endings.length];
}

const actionsByMetric={
  0:'Wróć do nowych zapytań i uzupełnij leady.',
  1:'Oddzwoń najpierw do klientów, którzy czekają na odpowiedź.',
  2:'Zaproponuj zainteresowanym klientom konkretną godzinę spotkania.',
  4:'Potwierdź z klientami terminy jazd i przygotuj auta.',
  5:'Dokończ oferty dla klientów najbliżej decyzji i wyślij je.',
  6:'Wróć do wysłanych ofert i ustal z klientami następny krok.',
  7:'Skontaktuj się z klientami, którzy są najbliżej podpisania zamówienia.',
  10:'Sprawdź, które transakcje mają komplet dokumentów do wystawienia faktury.',
  8:'Sprawdź dokumenty aut do rejestracji.',
  9:'Po odbiorze zaproś klientów do podzielenia się szczerą opinią.'
};
const belowSummaryNotes=[
  'Tu lejek włączył hamulec. Zacznij od pierwszego kroku poniżej.',
  'Tu mamy korek. Najpierw odblokuj ten odcinek.',
  'Temat nie zniknie po odświeżeniu raportu. Jeden konkretny ruch będzie lepszy.',
  'Tu warto wrzucić bieg. Rozgrzewkę mamy już za sobą.'
];

function renderMotivator(metrics,day) {
  const dayIndex=Math.floor(Date.parse(day)/86400000);
  const ranked=metrics.filter(metric=>metric.goal>0)
    .sort((a,b)=>b.actual/b.goal-a.actual/a.goal||b.delta-a.delta);
  const strongest=ranked[0];
  const gaps=ranked.filter(metric=>metric.delta<0).reverse();
  const weakest=gaps[0]??ranked.at(-1);
  const percent=metric=>new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(100*metric.actual/metric.goal)+'% celu na dziś';
  const best=$('#motivation-best');
  const low=$('#motivation-low');
  best.hidden=!strongest||strongest===weakest&&strongest.delta<0;
  low.hidden=!weakest||weakest===strongest&&weakest.delta>=0;
  if (!best.hidden) {
    const notes=strongest.index===9?reviewNotes.above:abovePlanNotes;
    const note=strongest.delta>0?notes[dayIndex%notes.length]
      :strongest.delta===0?'Tu jesteś na planie. Nawigacja nie musi przeliczać trasy.'
      :'Tu jesteś najbliżej celu. Silnik pracuje, jeszcze kawałek drogi.';
    best.textContent='Najmocniejszy punkt · '+strongest.label+' · '+percent(strongest)+'. '+note;
  }
  if (!low.hidden) {
    const notes=weakest.index===9?reviewNotes.below:(belowPlanNotes[weakest.label]??belowSummaryNotes);
    const note=weakest.delta<0?notes[dayIndex%notes.length]:'Tu masz najmniejszy zapas. Trzymaj tempo, a kawa może zostać w kubku.';
    low.textContent=(weakest.delta<0?'Najdalej od celu':'Najmniejszy zapas')+' · '+weakest.label+' · '+percent(weakest)+'. '+note;
  }
  const list=$('#motivation-actions');
  list.replaceChildren();
  for (const metric of gaps.slice(0,3)) {
    const li=document.createElement('li');
    const head=document.createElement('strong');
    head.textContent=metric.label+' · brakuje '+(-metric.delta);
    li.append(head,' — '+actionsByMetric[metric.index]);
    list.append(li);
  }
  const message=$('#motivation-message');
  message.textContent=!ranked.length?'Ustal z kierownikiem cele, żeby Lejek mógł wskazać priorytety.'
    :!gaps.length?'Dziś wszystkie mierzone obszary są na planie. Dobra robota — dopij kawę i utrzymaj tempo.'
    :gaps.length>3?'Zacznij od tych trzech. Pozostałe braki widać w zestawieniu powyżej.':'Zacznij od pierwszego punktu i odhaczaj kolejne.';
}

function renderQuote(text) {
  const full=$('#quote');
  if (full.textContent===text) return;
  full.textContent=text;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  const card=full.closest('.quote');
  const animated=$('#quote-animated');
  const letters=Array.from(text);
  const interval=Math.min(42,1600/letters.length);
  let started;
  card.classList.add('is-typing');
  animated.textContent='';
  function frame(now) {
    started ??= now;
    const count=Math.floor((now-started)/interval);
    if (count>=letters.length||motion.matches) {
      card.classList.remove('is-typing');
      return;
    }
    animated.textContent=letters.slice(0,count).join('');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

let giphyRequest;
async function giphyResults(config,assignedId) {
  const params=new URLSearchParams({api_key:config.key,rating:'g'});
  if (!assignedId) params.set('limit','50');
  const endpoint=assignedId?encodeURIComponent(assignedId):'trending';
  const response=await fetch('https://api.giphy.com/v1/gifs/'+endpoint+'?'+params,{
    cache:'no-store',signal:AbortSignal.timeout(6500)
  });
  if (!response.ok) throw new Error('GIF niedostępny.');
  const {data}=await response.json();
  return (assignedId?[data]:data??[]).filter(item=>{
    const media=item?.images?.fixed_width?.url;
    const url=URL.canParse(media??'')?new URL(media):null;
    return typeof item?.id==='string'&&url?.protocol==='https:'&&url.hostname.endsWith('.giphy.com');
  });
}

async function dailyGif(config,readOnly) {
  let items=await giphyResults(config,config.id);
  if (!config.id&&!readOnly&&items.length) {
    const {id}=await api('/api/giphy-assign',{ids:items.map(item=>item.id)});
    if (!id) return null;
    if (!items.some(item=>item.id===id)) items=await giphyResults(config,id);
    return items.find(item=>item.id===id)??null;
  }
  return items[0]??null;
}

const voteButtons=[...document.querySelectorAll('[data-meme-vote]')];
let memeVoteSource='local';
function renderMemeVotes(source) {
  memeVoteSource=source;
  $('#meme-votes').hidden=source==='local'&&!data.meme;
  for (const button of voteButtons) {
    button.setAttribute('aria-pressed',String(data.memeVotes?.[source]===Number(button.dataset.memeVote)));
  }
}

function renderGif(config,readOnly) {
  const card=$('#giphy-card');
  const icon=$('#meme-icon');
  const caption=$('#meme-caption');
  card.hidden=true;
  renderMemeVotes('local');
  icon.hidden=false;
  caption.hidden=false;
  if (!config||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const request=giphyRequest??=dailyGif(config,readOnly).catch(()=>null);
  request.then(item=>{
    if (!item||$('#meme').hidden||request!==giphyRequest) return;
    const image=$('#giphy-image');
    image.onload=()=>{
      if (request!==giphyRequest||$('#meme').hidden) return;
      $('#meme-title').hidden=true;
      icon.hidden=true;
      caption.hidden=true;
      renderMemeVotes('giphy');
      card.hidden=false;
    };
    image.onerror=()=>{card.hidden=true;};
    image.alt=item.content_description||item.title||'GIF dnia';
    image.src=item.images.fixed_width.url;
  });
}

const sourceSelect=$('#entry-source');
function showEntrySource(index) {
  sourceSelect.value=String(index);
  for (const row of $('#rows').rows) row.classList.toggle('active-source',Number(row.dataset.source)===index);
  $('#entry-prev').disabled=index===0;
  $('#entry-next').disabled=index===sources.length-1;
  $('#entry-count').textContent=(index+1)+' z '+sources.length;
}

function updateSourceStatuses() {
  for (const [index,row] of Array.from($('#rows').rows).entries()) {
    const inputs=Array.from(row.querySelectorAll('input'));
    const hasResults=inputs.some(input=>Number(input.value)>0);
    sourceSelect.options[index].textContent=sources[index]+(hasResults?' — wpisano wyniki':'');
  }
}

sourceSelect.onchange=()=>showEntrySource(Number(sourceSelect.value));
$('#entry-prev').onclick=()=>showEntrySource(Number(sourceSelect.value)-1);
$('#entry-next').onclick=()=>showEntrySource(Number(sourceSelect.value)+1);
$('#rows').addEventListener('keydown',event=>{
  const input=event.target;
  if (event.key!=='Enter'||event.isComposing||input.type!=='number') return;
  event.preventDefault();
  if (!input.reportValidity()) return;
  const editable='input[type="number"]:not([readonly]):not(:disabled)';
  const rows=$('#rows');
  const mobile=matchMedia('(max-width:1050px)').matches;
  const currentRow=input.closest('tr');
  const fields=[...(mobile?currentRow:rows).querySelectorAll(editable)];
  const next=fields[fields.indexOf(input)+1];
  if (next) {
    next.focus();
  } else if (mobile&&currentRow.nextElementSibling) {
    const nextRow=currentRow.nextElementSibling;
    showEntrySource(Number(nextRow.dataset.source));
    nextRow.querySelector(editable)?.focus();
  } else if (!$('#save').disabled) {
    $('#save').focus();
  }
});
$('#rows').addEventListener('input',event=>{
  const input=event.target;
  if (input.name==='v0_0'&&input.validity.valid) {
    const row=input.closest('tr');
    for (const name of ['v0_1','v0_2']) {
      const field=row.querySelector('[name="'+name+'"]');
      field.value=input.value;
    }
  }
  updateSourceStatuses();
});
$('#entry').addEventListener('invalid',event=>{
  const row=event.target.closest('[data-source]');
  if (!row||!matchMedia('(max-width:1050px)').matches) return;
  const firstInvalid=$('#rows input:invalid');
  if (event.target===firstInvalid) showEntrySource(Number(row.dataset.source));
},true);

function renderSeller(readOnly=false) {
  const {brand,personal,cause}=data;
  const salon=data.sellers[0].salon;
  $('#dealer').textContent=brand?.name??salon;
  $('#salon').textContent=brand?salon:'';
  $('#logo').hidden=!brand?.logo;
  if (brand?.logo) $('#logo').src=brand.logo;
  const records=Object.fromEntries(data.daily.map(row=>[row.day,JSON.parse(row.counters)]));
  const next=personal.missing[0];
  const day=next&&editDay===next?editDay:data.today;
  const exception=personal.exceptions[day];
  const waiting=personal.exceptions[next]==='pending';
  const blocked=(next&&day!==next)||exception==='pending';
  const locked=Boolean(records[day]||exception==='zero'||exception==='leave'||exception==='training');
  const dayIndex=Math.floor(Date.parse(data.today)/86400000);
  renderQuote(quotes[dayIndex%quotes.length]);
  const lesson=data.lesson;
  $('#lesson-title').textContent=lesson?.title??'Lekcje w przygotowaniu';
  $('#lesson-topic').textContent=lesson?.topic??'Kierownik salonu może opublikować tutaj krótkie lekcje ze standardów obsługi.';
  $('#lesson-remember').hidden=!lesson;
  $('#lesson-remember span').textContent=lesson?.remember??'';
  renderPlans(records);
  const ranking=data.ranking;
  const rankText=rank=>rank.place+'. miejsce (z '+rank.total+')';
  $('#seller-ranking').textContent=ranking
    ?'Ranking miesiąca · Salon: '+rankText(ranking.salon)+(ranking.group?' · Grupa: '+rankText(ranking.group):'')+' · Realizacja: '+new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(ranking.percent)+'%'
    :'';
  $('#entry-date').textContent=dateLabel(day);
  $('#backlog').hidden=!next;
  $('#backlog-text').textContent=next?personal.missing.length+' do rozliczenia · '+dateLabel(next)+(waiting?' · Czeka na zatwierdzenie':''):'';
  $('#resolve').hidden=!next||day===next||waiting;
  for (const button of document.querySelectorAll('[data-kind]')) button.hidden=!next||day!==next||waiting;
  $('#reason').hidden=true;
  $('#save').disabled=busy||Boolean(blocked)||locked;
  const matrix=records[day]?.[5];
  const legacy=records[day]&&!matrix;
  $('#columns').innerHTML='<tr><th scope="col">Źródło</th>'+columns.map(([,name])=>'<th scope="col">'+name+'</th>').join('')+'</tr>';
  const previousSource=$('#entry-grid').dataset.day===day?Number(sourceSelect.value):0;
  $('#entry-grid').dataset.day=day;
  $('#rows').innerHTML=legacy?'':sources.map((name,r)=>'<tr data-source="'+r+'"><th scope="row">'+name+
    (sourceDetails[r]?'<small class="source-detail">'+sourceDetails[r]+'</small>':'')+'</th>'+columns.map(([c,label])=>
    '<td><span class="entry-field-label" aria-hidden="true">'+label+'</span><input type="number" min="0" max="1000000" step="1" inputmode="numeric" enterkeyhint="next" aria-label="'+name+' – '+label+'" name="v'+r+'_'+c+'" value="'+(matrix?.[r]?.[c]??'')+'"'+(locked?' disabled':'')+(r===0&&(c===1||c===2)?' readonly title="Automatycznie z liczby leadów"':'')+'></td>').join('')+'</tr>').join('');
  $('#mobile-entry').hidden=Boolean(legacy);
  $('#entry-navigation').hidden=Boolean(legacy);
  $('#entry-grid').hidden=Boolean(legacy);
  if (!legacy) {
    sourceSelect.replaceChildren(...sources.map((name,i)=>new Option(name,String(i))));
    showEntrySource(previousSource);
    updateSourceStatuses();
  }
  $('#status').textContent=readOnly?(locked?'Zapisano przykładowy dzień.':'Podgląd · zapis próbny nie trafi do raportów.'):legacy?'Dzień zapisano wcześniej w formacie sumarycznym.':locked?'Dzień rozliczony.':blocked?'Najpierw rozlicz zaległość.':'';
  const showMeme=data.sidebarMode==='meme';
  $('#cause').hidden=showMeme;
  $('#meme').hidden=!showMeme;
  $('#meme-actions').hidden=!showMeme;
  $('#meme-status').textContent=showMeme&&readOnly?'Podgląd · oceny i historie zapisują się na koncie handlowca.':'';
  if (showMeme) {
    const [title,icon,caption]=data.meme??['Na dziś wszystkie memy są rozdane.', '🙂', 'Zajrzyj jutro po kolejną scenkę z salonu.'];
    $('#meme-title').hidden=false;
    $('#meme-title').textContent=title;
    $('#meme-icon').textContent=icon;
    $('#meme-caption').textContent=caption;
    renderGif(data.giphy,readOnly);
  }
  $('#cause-title').textContent=cause?.title??'Cel w przygotowaniu';
  $('#cause-org').textContent=cause?.organization??'';
  $('#cause-description').textContent=cause?.description??'Organizacja i opis pojawią się po opublikowaniu celu.';
  const [done,expected]=personal.progress;
  $('#progress-text').textContent=done+' z '+expected+' dni pracy rozliczonych do dziś';
  $('#progress').max=expected||1;
  $('#progress').value=done;
  $('#fortune').textContent=records[data.today]?fortunes[dayIndex%fortunes.length]:'Otworzy się po zapisaniu dzisiejszych wyników.';
  selectSellerTab();
  $('#daily').hidden=false;
}

function renderSalonSummary(view) {
  const month=view.today.slice(0,7);
  const results=$('#salon-results');
  results.replaceChildren();
  const pct=(orders,target)=>new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(100*orders/target)+'%';
  const describe=(orders,target)=>target>0?orders+' / '+target+' · '+pct(orders,target):orders+' zam. · Brak planu';
  const targets=new Map(view.plans.filter(plan=>plan.month===month).map(plan=>[plan.person,plan.target]));
  const ordersBySeller=new Map();
  for (const result of view.daily) {
    if (!result.day.startsWith(month)||result.day>view.today) continue;
    ordersBySeller.set(result.person,(ordersBySeller.get(result.person)??0)+(JSON.parse(result.counters)[4]??0));
  }
  for (const {salon} of view.salons) {
    const team=view.sellers.filter(seller=>seller.salon===salon);
    const planned=team.filter(seller=>(targets.get(seller.id)??0)>0);
    const total=planned.reduce((sum,seller)=>sum+targets.get(seller.id),0);
    const orders=planned.reduce((sum,seller)=>sum+(ordersBySeller.get(seller.id)??0),0);
    const detail=document.createElement('details');
    const summary=document.createElement('summary');
    summary.textContent=salon+' · '+describe(orders,total)+' · '+planned.length+' z '+team.length+' osób z planem';
    detail.append(summary);
    const people=document.createElement('ul');
    for (const seller of team) {
      const item=document.createElement('li');
      item.textContent=seller.name+' · '+describe(ordersBySeller.get(seller.id)??0,targets.get(seller.id));
      people.append(item);
    }
    detail.append(people);
    results.append(detail);
  }
  if (!results.children.length) results.textContent='Brak przypisanych salonów.';
}

function renderManagerDashboard(view) {
  const {today,sellers,daily,plans,funnelPlans,reviewPlans,teamDay}=view;
  const month=today.slice(0,7);
  const [year,monthNumber]=month.split('-').map(Number);
  const daysLeft=remainingDays(today,monthStart(year,monthNumber));
  const entries=new Map();
  for (const row of daily) {
    if (!row.day.startsWith(month)||row.day>today) continue;
    if (!entries.has(row.person)) entries.set(row.person,[]);
    entries.get(row.person).push([row.day,JSON.parse(row.counters)]);
  }
  const forSeller=(items,person)=>items.find(row=>row.month===month&&row.person===person);
  const statuses={leave:'Urlop',training:'Szkolenie',zero:'Dzień rozliczony bez aktywności',pending:'Czeka na zatwierdzenie'};
  const team=sellers.map(seller=>{
    const entry=teamDay.find(row=>row.person===seller.id);
    const active=Boolean(entry?.started&&entry.started<=today);
    const expected=!entry?.archived&&weekday(today)&&active&&!statuses[entry?.kind];
    const status=entry?.archived?'Konto usunięte':entry?.saved?'Wpisano działania':statuses[entry?.kind]??(!weekday(today)?'Dzień wolny':active?'Brak wpisu':'Ewidencja jeszcze nierozpoczęta');
    const records=entries.get(seller.id)??[];
    const current=records.find(([day])=>day===today)?.[1];
    const metrics=monthlyMetrics(records,current,forSeller(plans,seller.id)?.target,forSeller(funnelPlans,seller.id),
      forSeller(reviewPlans,seller.id)?.target,today,daysLeft,weekday(today)&&!['leave','training','zero'].includes(entry?.kind));
    const weakest=metrics.filter(metric=>metric.delta<0)
      .sort((a,b)=>a.actual/a.goal-b.actual/b.goal||a.delta-b.delta)[0];
    return {seller,expected,saved:Boolean(entry?.saved),status,metrics,weakest,orders:metrics.find(metric=>metric.index===7)};
  });
  const missing=team.filter(person=>person.expected&&!person.saved);
  const planned=team.filter(person=>person.orders.todayTarget!=null);
  const todayOrders=(planned.length?planned:team).reduce((sum,person)=>sum+person.orders.doneToday,0);
  const todayTarget=planned.reduce((sum,person)=>sum+person.orders.todayTarget,0);
  const gaps=columns.map(([index,label],i)=>{
    const actual=team.reduce((sum,person)=>sum+(person.metrics[i].goal==null?0:person.metrics[i].actual),0);
    const goal=team.reduce((sum,person)=>sum+(person.metrics[i].goal??0),0);
    return {label,actual,goal};
  }).filter(row=>row.actual<row.goal).sort((a,b)=>a.actual/a.goal-b.actual/b.goal);
  const priority=gaps[0];
  const cards=$('#manager-cards');
  cards.replaceChildren();
  for (const [label,value] of [
    ['Zamówienia dziś',planned.length?todayOrders+' / '+todayTarget:todayOrders+' · brak planu'],
    ['Wpisy do uzupełnienia',String(missing.length)],
    ['Priorytet w lejku',priority?priority.label+' · brakuje '+(priority.goal-priority.actual):team.some(person=>person.metrics.some(metric=>metric.target>0))?'Brak zaległości względem tempa':'Brak celów zespołu']
  ]) {
    const card=document.createElement('article');
    const valueNode=document.createElement('strong');
    valueNode.textContent=value;
    card.append(label,valueNode);
    cards.append(card);
  }
  $('#manager-missing').textContent=missing.length?'Brak wpisu: '+missing.map(person=>person.seller.name).join(', '):'';
  const list=$('#manager-team-list');
  list.replaceChildren();
  if (!team.length) list.textContent='Brak przypisanych handlowców.';
  const percent=new Intl.NumberFormat('pl-PL',{style:'percent',maximumFractionDigits:1});
  for (const {seller,status,metrics,weakest,orders} of team) {
    const detail=document.createElement('details');
    const summary=document.createElement('summary');
    const name=document.createElement('strong');
    name.textContent=seller.name+(view.salons.length>1?' · '+seller.salon:'');
    const progress=orders.target>0?percent.format(orders.actual/orders.target)+' planu miesiąca':'Brak planu zamówień';
    summary.append(name,progress+' · '+status+(weakest?' · '+weakest.label+': brakuje '+(-weakest.delta):''));
    const figures=document.createElement('ul');
    for (const metric of metrics) {
      const row=document.createElement('li');
      row.textContent=metric.label+' · '+metric.actual+(metric.target==null?' · brak celu':' / '+metric.target+' w miesiącu');
      figures.append(row);
    }
    detail.append(summary,figures);
    list.append(detail);
  }
}

function selectManagementView() {
  const administration=location.hash==='#administracja';
  const team=(['manager','group'].includes(data?.role)||Boolean(managerPreviewSalon||groupPreviewName))&&location.hash==='#zespol';
  $('#manager-team-view').hidden=!team;
  $('#management-team').setAttribute('aria-current',team?'page':'false');
  $('#performance-view').hidden=administration||team;
  $('#administration-view').hidden=!administration;
  $('#management-performance').setAttribute('aria-current',administration||team?'false':'page');
  $('#management-admin').setAttribute('aria-current',administration?'page':'false');
}
window.addEventListener('hashchange',selectManagementView);

function renderManagerAssignments() {
  const picker=$('#assignment-manager');
  const previous=picker.value;
  const managers=new Map(data.managerAssignments.map(row=>[row.id,row]));
  picker.replaceChildren(...[...managers.values()].map(({id,name})=>new Option(name,id)));
  if (managers.has(Number(previous))) picker.value=previous;
  const manager=managers.get(Number(picker.value));
  $('#assignment-primary').textContent=manager?'Salon główny: '+manager.salon:'Najpierw dodaj konto kierownika w sekcji Konta zespołu.';
  $('#assignment-save').disabled=!manager;
  const choices=$('#assignment-salons');
  choices.replaceChildren();
  if (!manager) return;
  const assigned=new Set(data.managerAssignments.filter(row=>row.id===manager.id).map(row=>row.additional));
  for (const {salon} of data.salons) {
    if (salon===manager.salon) continue;
    const label=document.createElement('label');
    const checkbox=document.createElement('input');
    checkbox.type='checkbox';
    checkbox.value=salon;
    checkbox.checked=assigned.has(salon);
    label.append(checkbox,salon);
    choices.append(label);
  }
}

$('#assignment-manager').onchange=renderManagerAssignments;
$('#manager-assignments').onsubmit=event=>{
  event.preventDefault();
  const salons=[...$('#assignment-salons').querySelectorAll('input:checked')].map(input=>input.value);
  run(()=>api('/api/manager-salons',{manager:Number($('#assignment-manager').value),salons}));
};
$('#manager-scope').onchange=()=>renderAdmin();

const userEditor=$('#user-editor');
const addUserBlock=$('#admin-users-block');
const editUserBlock=$('#admin-edit-users-block');
const editingUsers=()=>userEditor.parentElement===editUserBlock;
for (const block of [addUserBlock,editUserBlock]) block.addEventListener('toggle',()=>{
  if (!block.open||block.hidden||userEditor.parentElement===block) return;
  block.append(userEditor);
  loadUserEditor();
});
function updateUserRoleFields() {
  const roles=[...userEditor.querySelectorAll('input[name="roles"]:checked')].map(input=>input.value);
  const group=roles.includes('group');
  const salon=roles.includes('manager')||roles.includes('seller');
  $('#user-group-label').hidden=!group;
  $('#user-salon-label').hidden=!salon;
  userEditor.elements.dealerGroup.required=group;
  userEditor.elements.salon.required=salon;
}
function loadUserEditor() {
  const editing=editingUsers();
  const selected=editing?data.users.find(user=>user.email===$('#user-picker').value):null;
  $('#user-picker-label').hidden=!editing;
  $('#user-fields').hidden=editing&&!selected;
  $('#user-save').textContent=editing?'Zapisz zmiany':'Dodaj użytkownika';
  userEditor.elements.name.value=selected?.name??'';
  userEditor.elements.email.value=selected?.email??'';
  userEditor.elements.email.readOnly=Boolean(selected);
  userEditor.elements.salon.value=selected?.salon??'';
  userEditor.elements.dealerGroup.value=selected?.dealerGroup??'';
  for (const input of userEditor.querySelectorAll('input[name="roles"]')) input.checked=Boolean(selected?.roles.split(',').includes(input.value));
  const archiveButton=$('#user-archive');
  archiveButton.hidden=!selected;
  archiveButton.dataset.archived=String(Boolean(selected?.archived));
  archiveButton.textContent=selected?.archived?'Przywróć użytkownika':'Usuń użytkownika';
  $('#user-save').hidden=Boolean(selected?.archived);
  $('#user-status').textContent=selected?.archived?'Użytkownik usunięty z aktywnych kont Lejka.':'';
  updateUserRoleFields();
}
function renderUserEditor(view) {
  const delegated=view.role!=='admin';
  editUserBlock.hidden=delegated;
  if (delegated&&editingUsers()) addUserBlock.append(userEditor);
  for (const [id,allowed] of [['user-group-role',!delegated],['user-manager-role',view.role!=='manager']]) {
    const label=$('#'+id);
    label.hidden=!allowed;
    label.querySelector('input').disabled=!allowed;
  }
  const salonPicker=userEditor.elements.salon;
  salonPicker.replaceChildren(new Option(view.salons.length?'Wybierz salon':'Brak dodanych salonów',''),
    ...view.salons.map(({salon})=>new Option(salon,salon)));
  const picker=$('#user-picker');
  const prior=delegated?'':picker.value;
  picker.replaceChildren(new Option('Wybierz użytkownika',''),...data.users.map(user=>new Option((user.archived?'Usunięty · ':'')+(user.name===user.email?user.email:user.name+' · '+user.email),user.email)));
  if (data.users.some(user=>user.email===prior)) picker.value=prior;
  userEditor.elements.dealerGroup.replaceChildren(new Option('Wybierz grupę',''),...data.groups.map(group=>new Option(group.name,group.name)));
  loadUserEditor();
}
$('#user-picker').onchange=loadUserEditor;
userEditor.onchange=updateUserRoleFields;
userEditor.onsubmit=async event=>{
  event.preventDefault();
  const values=new FormData(userEditor);
  const roles=values.getAll('roles');
  const editing=editingUsers();
  if (editing&&!$('#user-picker').value) return;
  const button=$('#user-save');
  button.disabled=true;
  try {
    const fields=Object.fromEntries(values);
    await api('/api/users',{...fields,roles,createOnly:!editing});
    await refresh();
    if (editing) {
      $('#user-picker').value=String(values.get('email')).trim().toLowerCase();
      loadUserEditor();
    }
    $('#user-status').textContent=editing?'Zapisano zmiany użytkownika.':'Dodano użytkownika.';
  } catch(error) {
    $('#user-status').textContent=error.message;
  } finally {
    button.disabled=false;
  }
};

$('#user-archive').onclick=async event=>{
  const button=event.currentTarget;
  const selected=data.users.find(user=>user.email===$('#user-picker').value);
  if (!selected) return;
  const archived=!selected.archived;
  if (data.role!=='admin') return;
  if (archived&&!confirm('Usunąć dostęp użytkownika „'+selected.name+'” do Lejka? Zapisane wyniki pozostaną w raportach.')) return;
  button.disabled=true;
  try {
    await api('/api/users/archive',{email:selected.email,archived});
    await refresh();
    if (archived) {
      $('#user-picker').value='';
      loadUserEditor();
    }
    $('#user-status').textContent=archived?'Użytkownik usunięty z aktywnych kont Lejka.':'Przywrócono dostęp użytkownika.';
  } catch(error) {
    $('#user-status').textContent=error.message;
  } finally {
    button.disabled=false;
  }
};

function renderAdmin() {
  const groupPreview=data.role==='admin'?data.groups.find(group=>group.name===groupPreviewName):null;
  const previewSalons=new Set((groupPreview?.salons??'').split('\n').filter(Boolean));
  const baseView=groupPreview?{...data,role:'group',dealerGroup:groupPreview.name,
    salons:data.salons.filter(({salon})=>previewSalons.has(salon)),
    sellers:data.sellers.filter(seller=>previewSalons.has(seller.salon)),approvals:[]}:data;
  const managerPreview=data.role==='admin'&&Boolean(managerPreviewSalon);
  const readOnlyPreview=managerPreview||Boolean(groupPreview);
  const managerScope=$('#manager-scope');
  const picked=managerScope.value;
  const group=baseView.role==='group';
  const multiple=(baseView.role==='manager'||group)&&baseView.salons.length>1;
  $('#manager-scope-bar').hidden=!multiple;
  if (multiple) {
    managerScope.replaceChildren(new Option(group?'Wszystkie salony grupy':'Wszystkie moje salony',''),...baseView.salons.map(({salon})=>new Option(salon,salon)));
    if (baseView.salons.some(({salon})=>salon===picked)) managerScope.value=picked;
  }
  const selected=managerPreview?(managerPreviewSalon===allPreviewSalons?'':managerPreviewSalon):multiple?managerScope.value:'';
  const people=selected?baseView.sellers.filter(seller=>seller.salon===selected):baseView.sellers;
  const view=selected?{...baseView,role:managerPreview?'manager':baseView.role,salon:selected,sellers:people,
    salons:[{salon:selected}],approvals:baseView.approvals.filter(row=>people.some(seller=>seller.id===row.person))}
    :managerPreview?{...baseView,role:'manager',salon:'Wszystkie salony'}:baseView;
  const manager=view.role==='manager';
  const teamDashboard=manager||group;
  const title=group?(selected?'Dziś w salonie':'Dziś w grupie'):manager?'Dziś w salonie':'Wykonanie planu';
  $('#manager-preview-note').hidden=!readOnlyPreview;
  $('#manager-preview-note').textContent=(groupPreview?'Podgląd szefa grupy.':'Podgląd kierownika.')+' Możesz wypróbować pola formularza. Dane salonu nie zostaną zapisane.';
  $('#management-report-link').hidden=readOnlyPreview;
  $('#management-team-shortcut').hidden=readOnlyPreview||data.role!=='manager';
  $('#dealer').textContent=group?(selected||view.dealerGroup):manager?(multiple&&!selected?'Wszystkie moje salony':view.salon):'Panel salonu';
  $('#performance-title').textContent=title;
  $('#management-performance').textContent=group?'Wyniki grupy':title;
  $('#management-admin').textContent='Panel administracyjny';
  $('#management-team').hidden=!teamDashboard;
  $('#manager-today').hidden=!teamDashboard;
  if (teamDashboard) renderManagerDashboard(view);
  $('#admin').hidden=false;
  selectManagementView();
  const query=multiple&&selected?'?salon='+encodeURIComponent(selected):'';
  $('#management-team-link').href='/zarzadzanie.html'+query+'#administracja';
  $('#management-report-link a').href='/zarzadzanie.html'+query;
  $('#management-team-link').textContent='Ustawienia planów';
  renderSalonSummary(view);
  userEditor.hidden=false;
  renderUserEditor(view);
  $('#group-add-salon-block').hidden=!group;
  $('#manager-assignments').hidden=view.role!=='admin';
  if (view.role==='admin') renderManagerAssignments();
  $('#group-editor').hidden=view.role!=='admin';
  if (view.role==='admin') renderDealerGroups(view.groups);
  $('#absence-panel').hidden=false;
  $('#lesson-editor').hidden=false;
  $('#team').textContent=view.sellers.length+' handlowców';
  const reviews=$('#reviews');
  reviews.replaceChildren();
  if (!view.approvals.length) reviews.textContent='Brak zgłoszeń do rozpatrzenia.';
  for (const review of view.approvals) {
    const card=document.createElement('article');
    const label=document.createElement('strong');
    label.textContent=view.sellers.find(seller=>seller.id===review.person)?.name+' · '+dateLabel(review.day);
    const note=document.createElement('p');
    note.textContent=review.reason;
    card.append(label,note);
    for (const approve of [true,false]) {
      const button=document.createElement('button');
      button.textContent=approve?'Zatwierdź dzień bez aktywności':'Odrzuć';
      button.onclick=()=>run(()=>api('/api/review',{person:review.person,day:review.day,approve}));
      card.append(button);
    }
    reviews.append(card);
  }
  $('#settings').hidden=false;
  $('#global-sidebar-settings').hidden=view.role!=='admin';
  $('#global-charity-settings').hidden=view.role!=='admin';
  for (const [block,content] of [
    ['admin-users-block','user-editor'],['admin-groups-block','group-editor'],
    ['admin-salons-block','manager-assignments'],['admin-absence-block','absence-panel'],
    ['admin-lessons-block','lesson-editor'],['admin-settings-block','settings']
  ]) $('#' + block).hidden=$('#' + content).hidden;
  const lessonSalon=$('#lesson-salon');
  const selectedSalon=lessonSalon.value;
  const lessonSalons=view.salons.map(({salon})=>salon);
  lessonSalon.replaceChildren(...(lessonSalons.length>1?[new Option('Wybierz salon','')]:[]),...lessonSalons.map(salon=>new Option(salon,salon)));
  if (lessonSalons.includes(selectedSalon)) lessonSalon.value=selectedSalon;
  $('#lesson-salon-label').hidden=view.role!=='admin'&&lessonSalons.length<=1;
  {
    const form=$('#brand');
    const selected=form.elements.salon.value;
    form.elements.salon.replaceChildren(...view.salons.map(({salon})=>new Option(salon,salon)));
    if (view.salons.some(({salon})=>salon===selected)) form.elements.salon.value=selected;
    renderStoryQueue(readOnlyPreview?[]:view.memeStories);
  }
  if (view.role==='admin') {
    $('#giphy-option').disabled=!view.giphyAvailable;
    $('#sidebar-settings').elements.mode.value=view.giphy?'giphy':view.sidebarMode;
    $('#charity').elements.month.value ||= view.today.slice(0,7);
  }
}
function renderStoryQueue(stories) {
  const queue=$('#story-queue');
  queue.replaceChildren();
  if (!stories.length) queue.textContent='Brak nowych zgłoszeń.';
  for (const {id,title,caption} of stories) {
    const form=document.createElement('form');
    form.innerHTML='<label>Tytuł <input name="title" maxlength="120" required></label><label>Historia <textarea name="caption" maxlength="500" required></textarea></label><div><button>Zatwierdź</button> <button type="button" class="secondary">Odrzuć</button></div>';
    form.elements.title.value=title;
    form.elements.caption.value=caption;
    form.onsubmit=event=>{
      event.preventDefault();
      run(()=>api('/api/meme-review',{id,approve:true,...Object.fromEntries(new FormData(form))}));
    };
    form.querySelector('.secondary').onclick=()=>run(()=>api('/api/meme-review',{id,approve:false}));
    queue.append(form);
  }
}

function selectSellerTab() {
  const requested=location.hash.slice(1);
  const links=[...document.querySelectorAll('[data-seller-tab]')];
  const active=links.some(link=>link.dataset.sellerTab===requested)?requested:'dzisiaj';
  for (const link of links) {
    if (link.dataset.sellerTab===active) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  for (const panel of document.querySelectorAll('[data-seller-panel]')) {
    panel.hidden=panel.dataset.sellerPanel!==active;
  }
}
window.addEventListener('hashchange',()=>{
  if ($('#daily').hidden) return;
  selectSellerTab();
  window.scrollTo(0,0);
});

function showView() {
  $('#daily').hidden=true;
  $('#admin').hidden=true;
  if (data.role==='seller') {
    renderSeller();
    return;
  }
  const salonSelect=$('#manager-preview-salon');
  const selected=managerPreviewSalon||salonSelect.value;
  const canPreview=data.role==='admin'&&data.salons.length>0;
  if (!canPreview) managerPreviewSalon='';
  $('#manager-preview-bar').hidden=!canPreview;
  if (canPreview) {
    const salons=data.salons.map(({salon})=>salon);
    salonSelect.replaceChildren(new Option('Wszystkie salony',allPreviewSalons),
      ...salons.map(salon=>new Option(salon,salon)));
    if (salons.includes(selected)||selected===allPreviewSalons) salonSelect.value=selected;
    else managerPreviewSalon='';
    $('#manager-preview-toggle').textContent=managerPreviewSalon?'Wróć do panelu administratora':'Podgląd kierownika';
  }
  const groupSelect=$('#group-preview-select');
  if (data.role==='admin') {
    const chosen=groupPreviewName||groupSelect.value;
    groupSelect.replaceChildren(...data.groups.map(group=>new Option(group.name,group.name)));
    if (data.groups.some(group=>group.name===chosen)) groupSelect.value=chosen;
    else groupPreviewName='';
    $('#group-preview-toggle').textContent=groupPreviewName?'Wróć do panelu administratora':'Podgląd szefa grupy';
  }
  $('#group-preview-bar').hidden=data.role!=='admin'||Boolean(managerPreviewSalon)||!data.groups.length;
  if (groupPreviewName) $('#manager-preview-bar').hidden=true;
  $('#preview-bar').hidden=Boolean(managerPreviewSalon||groupPreviewName);
  $('#view-switch').textContent=preview?'Zarządzanie salonem':'Podgląd handlowca';
  if (!preview) {
    renderAdmin();
    return;
  }
  const actual=data;
  const [year,month]=actual.today.split('-').map(Number);
  const quarterStart=Math.floor((month-1)/3)*3;
  data={today:actual.today,sellers:[{salon:'Salon demonstracyjny'}],
    plans:[0,1,2].map(offset=>({month:monthStart(year,quarterStart+offset).slice(0,7),target:12})),
    ranking:{salon:{place:3,total:8},group:{place:7,total:24},percent:0},
    reviewPlans:[{month:actual.today.slice(0,7),target:5}],daily:previewResult?.day===actual.today?[previewResult]:[],personal:{missing:[],exceptions:{},progress:[0,0]},
    sidebarMode:actual.sidebarMode,cause:actual.cause,meme:actual.meme,giphy:actual.giphy,
    lesson:{title:'Pierwszy kontakt',topic:'Przywitaj klienta, przedstaw się i zapytaj, czego potrzebuje.',remember:'Najpierw wysłuchaj, potem zaproponuj rozwiązanie.'}};
  try { renderSeller(true); } finally { data=actual; }
}
$('#group-preview-toggle').onclick=()=>{
  if (data?.role!=='admin') return;
  if (groupPreviewName) {
    groupPreviewName='';
    location.hash=managerReturnHash;
  } else {
    managerReturnHash=location.hash;
    groupPreviewName=$('#group-preview-select').value;
    $('#manager-scope').value='';
    location.hash='#wykonanie';
  }
  showView();
};
$('#group-preview-select').onchange=event=>{
  if (!groupPreviewName) return;
  groupPreviewName=event.target.value;
  $('#manager-scope').value='';
  showView();
};
$('#manager-preview-toggle').onclick=()=>{
  if (data?.role!=='admin') return;
  if (managerPreviewSalon) {
    managerPreviewSalon='';
    location.hash=managerReturnHash;
  } else {
    managerReturnHash=location.hash;
    managerPreviewSalon=$('#manager-preview-salon').value;
    location.hash='#wykonanie';
  }
  showView();
};
$('#manager-preview-salon').onchange=event=>{
  if (!managerPreviewSalon) return;
  managerPreviewSalon=event.target.value;
  showView();
};
$('#view-switch').onclick=()=>{preview=!preview;previewResult=null;$('#cookie').open=false;showView();};
$('#account-role').onchange=event=>{
  sessionStorage.setItem('lejek-active-role',event.target.value);
  location.replace('/daily.html');
};
async function refresh() {
  data=await api('/api/daily?month='+today.slice(0,7));
  const roleSelect=$('#account-role');
  const labels={group:'Szef grupy dealerskiej',manager:'Kierownik salonu',seller:'Handlowiec'};
  $('#account-role-bar').hidden=data.roles.length<2;
  roleSelect.replaceChildren(...data.roles.map(role=>new Option(labels[role]??role,role)));
  roleSelect.value=data.role;
  sessionStorage.setItem('lejek-active-role',data.role);
  $('#load').textContent='';
  $('#display-date').textContent=dateLabel(data.today,{day:'numeric',month:'long',year:'numeric'});
  showView();
}
async function run(operation,openCookie=false) {
  if (busy) return;
  busy=true;
  $('#save').disabled=true;
  try {
    await operation();
    editDay=null;
    busy=false;
    await refresh();
    if (openCookie) $('#cookie').open=true;
    if (data.role!=='seller') $('#load').textContent='Zapisano zmiany.';
  } catch(error) {
    $('#load').textContent=error.message;
    if(data?.role==='seller') {
      const day=editDay??data.today;
      $('#status').textContent=error.message;
      $('#save').disabled=Boolean(data.personal.missing[0]&&day!==data.personal.missing[0])||data.personal.exceptions[day]==='pending';
    }
  } finally {busy=false;}
}
$('#resolve').onclick=()=>{editDay=data.personal.missing[0];renderSeller();$('#rows .active-source input')?.focus();};
$('#entry').onsubmit=event=>{
  event.preventDefault();
  if(data.role!=='seller'&&!preview) return;
  const day=editDay??data.today;
  const rows=sources.map((_,r)=>{
    const row=Array(11).fill(0);
    for (const [index] of columns) row[index]=Number(event.target.elements['v'+r+'_'+index].value);
    return row;
  });
  if (data.role!=='seller') {
    if (previewResult?.day===day) return;
    if (!rows.some(row=>row.some(value=>value>0))) {
      $('#status').textContent='Wpisz co najmniej jedno wykonane działanie.';
      return;
    }
    const totals=[1,3,4,5,7].map(index=>rows.reduce((sum,row)=>sum+row[index],0));
    previewResult={day,counters:JSON.stringify([...totals,rows])};
    showView();
    $('#cookie').open=true;
    return;
  }
  run(()=>api('/api/daily',{person:data.sellers[0].id,day,rows}),day===data.today);
};
for (const button of document.querySelectorAll('[data-kind]')) button.onclick=()=>{
  const {kind}=button.dataset;
  const reason=$('#reason');
  if(kind==='pending'&&(!reason.value.trim()||reason.hidden)){reason.hidden=false;reason.focus();return;}
  run(()=>api('/api/day-exception',{person:data.sellers[0].id,day:editDay,kind,reason:reason.value})).then(()=>{if(reason.hidden) reason.value='';});
};
$('#brand').onsubmit=event=>{
  event.preventDefault();
  const {salon,name,logo}=event.target.elements;
  const file=logo.files[0];
  if(file?.size>40960){$('#load').textContent='Logo może mieć maksymalnie 40 KB.';return;}
  run(async ()=>{
    const encoded=file?await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error('Nie udało się odczytać logo.'));
      reader.readAsDataURL(file);
    }):'';
    await api('/api/brand',{salon:salon.value,name:name.value,logo:encoded});
  });
};
for (const button of voteButtons) button.onclick=async()=>{
  if (data.role!=='seller') {
    for (const control of voteButtons) control.setAttribute('aria-pressed',String(control===button));
    return;
  }
  const {today:day}=data;
  const source=memeVoteSource;
  const vote=Number(button.dataset.memeVote);
  for (const control of voteButtons) control.disabled=true;
  try {
    await api('/api/meme-vote',{source,vote,day});
    if (data.today===day) {
      (data.memeVotes??={})[source]=vote;
      renderMemeVotes(memeVoteSource);
      $('#meme-status').textContent='Zapisano ocenę.';
    }
  } catch(error) {
    $('#meme-status').textContent=error.message;
  } finally {
    for (const control of voteButtons) control.disabled=false;
  }
};
$('#meme-suggest').onclick=event=>{
  const form=$('#meme-form');
  form.hidden=!form.hidden;
  event.currentTarget.setAttribute('aria-expanded',String(!form.hidden));
  if (!form.hidden) form.elements.title.focus();
};
$('#meme-form').onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  if (data.role!=='seller') {
    $('#meme-status').textContent='Podgląd · historię możesz wysłać z konta handlowca.';
    return;
  }
  const submit=form.querySelector('button');
  submit.disabled=true;
  try {
    await api('/api/meme-story',Object.fromEntries(new FormData(form)));
    form.reset();
    form.hidden=true;
    $('#meme-suggest').setAttribute('aria-expanded','false');
    $('#meme-status').textContent='Dzięki! Historia czeka na decyzję administratora.';
  } catch(error) {
    $('#meme-status').textContent=error.message;
  } finally {
    submit.disabled=false;
  }
};
function renderDealerGroups(groups) {
  const list=$('#group-list');
  list.replaceChildren();
  if (!groups.length) list.textContent='Brak grup dealerskich.';
  for (const group of groups) {
    const section=document.createElement('section');
    const heading=document.createElement('h3');
    heading.textContent=group.name;
    section.append(heading);
    const removeButton=(label,question,payload)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='secondary';
      button.textContent=label;
      button.onclick=()=>{
        if (confirm(question)) run(()=>api('/api/group/remove',{name:group.name,...payload}));
      };
      return button;
    };
    for (const salon of (group.salons??'').split('\n').filter(Boolean)) {
      const row=document.createElement('div');
      row.append(salon+' ',removeButton('Odłącz salon','Odłączyć salon „'+salon+'” od grupy „'+group.name+'”? Dane salonu zostaną zachowane.',{salon}));
      section.append(row);
    }
    for (const email of (group.heads??'').split('\n').filter(Boolean)) {
      const row=document.createElement('div');
      row.append(email+' ',removeButton('Odłącz szefa','Odłączyć to konto od grupy „'+group.name+'”?',{email}));
      section.append(row);
    }
    section.append(removeButton('Usuń grupę','Usunąć grupę „'+group.name+'” i jej przypisania? Wyniki, konta i plany pozostaną zapisane.',{}));
    list.append(section);
  }
}
$('#group-add-salon').onsubmit=event=>{
  event.preventDefault();
  const form=event.currentTarget;
  run(async()=>{await api('/api/group/salon',{salon:form.elements.salon.value});form.reset();});
};
$('#group-editor').onsubmit=event=>{
  event.preventDefault();
  const values=Object.fromEntries(new FormData(event.target));
  run(()=>api('/api/group',{name:values.name,salons:values.salons.split(/\r?\n/).map(line=>line.trim()).filter(Boolean)}));
};
const lessonEditor=$('#lesson-editor');
const lessonDraftList=$('#lesson-drafts');
let lessonBusy=false;
function updateLessonButtons() {
  const total=lessonDraftList.children.length;
  $('#lesson-publish').disabled=lessonBusy||total===0;
  $('#lesson-add').disabled=lessonBusy||total>=40;
  $('#lesson-import').disabled=lessonBusy;
}
function appendLesson({title='',topic='',remember=''}={}) {
  const field=document.createElement('fieldset');
  field.innerHTML='<legend>Lekcja</legend><label>Tytuł <input data-lesson="title" maxlength="120" required></label><label>Zagadnienie <textarea data-lesson="topic" maxlength="650" rows="3" required></textarea></label><label>Zapamiętaj! <textarea data-lesson="remember" maxlength="220" rows="2" required></textarea></label><button type="button" class="secondary">Usuń szkic</button>';
  for (const [key,value] of Object.entries({title,topic,remember})) field.querySelector('[data-lesson="'+key+'"]').value=value;
  field.querySelector('button').onclick=()=>{field.remove();updateLessonButtons();};
  lessonDraftList.append(field);
  updateLessonButtons();
}
$('#lesson-add').onclick=()=>appendLesson();
$('#lesson-import').onclick=async ()=>{
  const file=$('#lesson-file').files[0];
  const status=$('#lesson-status');
  if (!file||file.size>15*1024*1024) {status.textContent='Wybierz plik do 15 MB.';return;}
  lessonBusy=true;
  updateLessonButtons();
  status.textContent='Odczytuję plik…';
  try {
    const encoded=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(',')[1]);
      reader.onerror=()=>reject(new Error('Nie udało się otworzyć pliku.'));
      reader.readAsDataURL(file);
    });
    const result=await api('/api/lesson-import',{salon:$('#lesson-salon').value,filename:file.name,file:encoded});
    lessonDraftList.replaceChildren();
    for (const lesson of result.lessons) appendLesson(lesson);
    status.textContent='Przygotowano '+result.lessons.length+' szkiców. Sprawdź i uzupełnij podsumowania przed publikacją.';
  } catch(error) {status.textContent=error.message;}
  finally {lessonBusy=false;updateLessonButtons();}
};
lessonEditor.onsubmit=async event=>{
  event.preventDefault();
  const status=$('#lesson-status');
  const lessons=Array.from(lessonDraftList.children,field=>Object.fromEntries(Array.from(field.querySelectorAll('[data-lesson]'),input=>[input.dataset.lesson,input.value.trim()])));
  lessonBusy=true;
  updateLessonButtons();
  try {
    await api('/api/lessons',{salon:$('#lesson-salon').value,lessons});
    status.textContent='Opublikowano serię. Pierwsza lekcja jest już widoczna w salonie.';
  } catch(error) {status.textContent=error.message;}
  finally {lessonBusy=false;updateLessonButtons();}
};
$('#sidebar-settings').onsubmit=event=>{
  event.preventDefault();
  giphyRequest=undefined;
  run(()=>api('/api/sidebar',{mode:event.target.elements.mode.value}));
};
$('#charity').onsubmit=event=>{
  event.preventDefault();
  const form=event.target;
  run(()=>api('/api/cause',Object.fromEntries(new FormData(form))));
};
refresh().catch(error=>{$('#load').textContent=error.message;});
