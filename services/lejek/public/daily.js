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
const sources = ['Walk-in','Facebook','Strona WWW','Kontakt z salonem','OTOMOTO','Polecenia','Baza retencyjna','Importerskie','Broker','Serwis','Galerie','Targi','Odzyskane przez BDC'];
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
  11:'Kontakt pozyskany podczas targów',
  12:'Lead odzyskany przez zespół BDC'
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
const weekday = day => {
  const index=new Date(day+'T12:00:00Z').getUTCDay();
  return index!==0&&(index!==6||day>='2026-11-19');
};
const remainingDays = (start,end,isScheduled=weekday) => {
  let count=0;
  for (let at=Date.parse(start); at<Date.parse(end); at+=86400000) {
    if (isScheduled(new Date(at).toISOString().slice(0,10))) count++;
  }
  return count;
};
const monthStart = (year,month) => new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
const panelNames={admin:'Panel administratora',group:'Panel szefa grupy dealerskiej',manager:'Panel kierownika salonu',seller:'Panel handlowca'};
const detailParams=new URLSearchParams(location.search);
const detailSeller=detailParams.get('handlowiec');
let data;
let editDay;
let busy=false;
const allPreviewSalons='\u0000all-salons';
let managerPreviewSalon=history.state?.managerPreviewSalon??'';
let groupPreviewName=history.state?.groupPreviewName??'';

async function api(path,body) {
  if (body!==undefined&&(managerPreviewSalon||groupPreviewName))
    throw new Error('To podgląd. Zmiany możesz zapisać z konta kierownika lub szefa grupy.');
  const url=new URL(path,location.origin);
  const selectedRole=data?.role||detailParams.get('role')||sessionStorage.getItem('lejek-active-role');
  if (selectedRole) url.searchParams.set('role',selectedRole);
  const response=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const result=await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

const calendarKinds={leave:'Urlop',saturday:'Wolna sobota',other:'Inny dzień bez aktywności'};
const calendarStatuses={pending:'Czeka na zatwierdzenie',approved:'Zatwierdzony',rejected:'Odrzucony'};

function renderCalendar(host,sellers,manager) {
  const currentPerson=host.querySelector('[data-calendar-person] select')?.value;
  const currentMonth=host.querySelector('[type="month"]')?.value;
  host.replaceChildren($('#calendar-template').content.cloneNode(true));
  const person=host.querySelector('[data-calendar-person] select');
  const month=host.querySelector('[type="month"]');
  const date=host.querySelector('[type="date"]');
  const kind=host.querySelector('[data-calendar-kind]');
  const status=host.querySelector('[data-calendar-status]');
  const list=host.querySelector('[data-calendar-list]');
  const save=host.querySelector('[data-calendar-save]');
  person.replaceChildren(...sellers.map(seller=>new Option(seller.name,seller.id)));
  if (sellers.some(seller=>String(seller.id)===currentPerson)) person.value=currentPerson;
  person.parentElement.hidden=!manager;
  month.value=currentMonth||data.today.slice(0,7);
  if (!manager) date.min=data.today;
  save.textContent=manager?'Zapisz dzień wolny':'Zgłoś do zatwierdzenia';
  let revision=0;
  const load=async()=>{
    const request=++revision;
    list.replaceChildren();
    if (!month.value) return;
    try {
      const {entries}=await api('/api/work-calendar?person='+person.value+'&month='+month.value);
      if (request!==revision||!list.isConnected) return;
      for (const entry of entries) {
        const row=document.createElement('li');
        const entryLabel=document.createElement('div');
        entryLabel.className='calendar-entry';
        const dateText=document.createElement('strong');
        dateText.textContent=dateLabel(entry.day);
        const statusLabel=document.createElement('span');
        statusLabel.className='calendar-status';
        statusLabel.dataset.status=entry.status;
        statusLabel.textContent=calendarStatuses[entry.status];
        entryLabel.append(dateText,calendarKinds[entry.kind],statusLabel);
        row.append(entryLabel);
        if (manager||(entry.status!=='approved'&&entry.day>=data.today)) {
          const edit=document.createElement('button');
          edit.type='button';
          edit.className='secondary';
          edit.textContent='Edytuj';
          edit.onclick=()=>{date.value=entry.day;kind.value=entry.kind;date.focus();};
          const remove=document.createElement('button');
          remove.type='button';
          remove.className='secondary';
          remove.textContent=entry.status==='approved'?'Przywróć dzień pracy':'Usuń zgłoszenie';
          remove.onclick=()=>change(remove,{day:entry.day,action:'remove'});
          const actions=document.createElement('div');
          actions.className='calendar-entry-actions';
          actions.append(edit,remove);
          row.append(actions);
        }
        list.append(row);
      }
      if (!entries.length) {
        const empty=document.createElement('li');
        empty.textContent='Brak zaplanowanych dni wolnych w tym miesiącu.';
        list.append(empty);
      }
    } catch (error) {
      if (request===revision) status.textContent=error.message;
    }
  };
  const change=async(button,values)=>{
    button.disabled=true;
    status.textContent='';
    try {
      await api('/api/work-calendar',{person:Number(person.value),...values});
      month.value=values.day.slice(0,7);
      await refresh();
      host.querySelector('[data-calendar-status]').textContent=values.action==='remove'?'Zaktualizowano kalendarz.'
        :manager?'Zapisano dzień wolny.':'Zgłoszono dzień wolny. Czeka na decyzję kierownika.';
    } catch (error) {
      status.textContent=error.message;
    } finally {button.disabled=false;}
  };
  save.onclick=()=>{
    if (!date.value||!date.reportValidity()) {status.textContent='Wybierz poprawną datę.';return;}
    change(save,{day:date.value,kind:kind.value,action:'save'});
  };
  person.onchange=month.onchange=load;
  load();
}
$('#seller-calendar').addEventListener('toggle',event=>{
  if (event.currentTarget.open&&data?.role==='seller') renderCalendar($('#seller-calendar-editor'),data.sellers,false);
});

const periodType=$('#seller-period-type');
const periodValue=$('#seller-period-value');
let periodRevision=0;
const periodLength={month:1,quarter:3,year:12};
const periodLabel={month:'Miesiąc',quarter:'Kwartał',year:'Rok'};

function periodStart(month,type) {
  if (type==='year') return month.slice(0,4)+'-01';
  if (type==='quarter') return month.slice(0,5)+String(Math.floor((Number(month.slice(5))-1)/3)*3+1).padStart(2,'0');
  return month;
}

function periodName(month,type) {
  if (type==='year') return month.slice(0,4);
  if (type==='quarter') return 'I II III IV'.split(' ')[Math.floor((Number(month.slice(5))-1)/3)]+' kwartał '+month.slice(0,4);
  return monthLabel(month);
}

function renderPeriodPicker(anchor=data.today.slice(0,7)) {
  const current=data.today.slice(0,7);
  const type=periodType.value;
  const months=new Set([current,...(data.availableMonths??[])]);
  const firstYear=Number([...months].sort()[0].slice(0,4));
  const [currentYear,currentMonth]=current.split('-').map(Number);
  for (let year=firstYear;year<=currentYear;year++) {
    const lastMonth=year===currentYear?currentMonth:12;
    for (let month=0;month<lastMonth;month++) months.add(monthStart(year,month).slice(0,7));
  }
  const options=[...new Set([...months].map(month=>periodStart(month,type)))].sort().reverse();
  const previous=periodStart(anchor,type);
  periodValue.replaceChildren(...options.map(month=>new Option(periodName(month,type),month)));
  periodValue.value=options.includes(previous)?previous:periodStart(current,type);
}

function periodNotice(month,type,currentMonth) {
  const current=periodStart(currentMonth,type);
  if (month===current) return '';
  return month<current?'Wyświetlasz zakończony okres.':'Wyświetlasz przyszły okres.';
}

async function loadSellerPeriod() {
  const type=periodType.value;
  const month=periodValue.value;
  const revision=++periodRevision;
  const status=$('#seller-period-status');
  status.hidden=false;
  status.textContent='Wczytywanie okresu…';
  try {
    const snapshot=type==='month'&&month===data.today.slice(0,7)?data
      :await api('/api/daily?month='+encodeURIComponent(month)+'&period='+type);
    if (revision!==periodRevision) return;
    renderPlans(snapshot,month,type);
    renderRanking(snapshot.ranking);
    const name=periodName(month,type);
    $('#seller-plan-period').textContent=name;
    const message=periodNotice(month,type,snapshot.today.slice(0,7));
    $('#seller-period-notice-text').textContent=message;
    $('#seller-period-notice').hidden=!message;
    status.hidden=true;
  } catch (error) {
    if (revision!==periodRevision) return;
    status.textContent=error.message;
  }
}

periodType.onchange=()=>{
  renderPeriodPicker(periodValue.value);
  loadSellerPeriod();
};
periodValue.onchange=loadSellerPeriod;
$('#seller-period-reset').onclick=()=>{
  periodType.value='month';
  renderPeriodPicker(data.today.slice(0,7));
  periodType.focus();
  loadSellerPeriod();
};

function periodMetrics(snapshot,start,count) {
  const [year,month]=start.split('-').map(Number);
  const records=snapshot.daily.filter(row=>row.day<=snapshot.today).map(row=>[row.day,JSON.parse(row.counters)]);
  const isScheduled=day=>weekday(day)&&!['leave','training'].includes(snapshot.personal.exceptions[day]);
  const metricsByMonth=Array.from({length:count},(_,index)=>{
    const first=monthStart(year,month-1+index);
    const end=monthStart(year,month+index);
    const key=first.slice(0,7);
    const day=snapshot.today<first?first:snapshot.today<end?snapshot.today:new Date(Date.parse(end)-86400000).toISOString().slice(0,10);
    const entries=records.filter(([date])=>date.startsWith(key));
    const metrics=monthlyMetrics(entries,entries.find(([date])=>date===day)?.[1]??[],
      snapshot.plans.find(row=>row.month===key)?.target,snapshot.funnelPlans.find(row=>row.month===key),
      snapshot.reviewPlans.find(row=>row.month===key)?.target,day,remainingDays(day,end,isScheduled),isScheduled(day),isScheduled);
    return metrics.map(metric=>{
      const goal=metric.target==null?null:snapshot.today<first?0:snapshot.today>=end?metric.target:metric.goal;
      return {...metric,goal,delta:goal==null?null:metric.actual-goal};
    });
  });
  const sum=(values,key)=>values.some(value=>value[key]!=null)
    ?values.reduce((total,value)=>total+(value[key]??0),0):null;
  const currentIndex=metricsByMonth.findIndex((_,i)=>monthStart(year,month-1+i).slice(0,7)===snapshot.today.slice(0,7));
  return metricsByMonth[0].map((metric,index)=>{
    const values=metricsByMonth.map(month=>month[index]);
    const actual=sum(values,'actual');
    const goal=sum(values,'goal');
    const daily=values[currentIndex];
    return {...metric,actual,goal,target:sum(values,'target'),delta:goal==null?null:actual-goal,
      doneToday:daily?.doneToday??0,todayTarget:daily?.todayTarget??null};
  });
}

function renderPlans(snapshot,month,type) {
  const metrics=periodMetrics(snapshot,month,periodLength[type]);
  const [year,monthNumber]=month.split('-').map(Number);
  const end=monthStart(year,monthNumber-1+periodLength[type]).slice(0,7);
  const saved=(snapshot.sourcePlans??[]).filter(plan=>plan.month>=month&&plan.month<end);
  const sourceTable=$('#seller-source-plan');
  sourceTable.hidden=!saved.length;
  const totals=sources.map(()=>Array(10).fill(0));
  for (const plan of saved) JSON.parse(plan.targets).forEach((row,index)=>row.forEach((value,column)=>{totals[index][column]+=value;}));
  $('#seller-source-rows').replaceChildren(...totals.flatMap((values,index)=>{
    if (!values.some(Boolean)) return [];
    const row=document.createElement('tr');
    const name=document.createElement('th');
    name.scope='row';
    name.textContent=sources[index];
    row.append(name);
    for (const value of [values[0],values[7],...values.slice(4,7),...values.slice(8),...values.slice(1,4)]) {
      const cell=document.createElement('td');
      cell.textContent=value;
      row.append(cell);
    }
    return [row];
  }));
  $('#seller-source-note').textContent='Miesiące z rozpisanym planem: '+saved.length+' / '+periodLength[type]+'.';
  const label=periodLabel[type];
  for (const [selector,index] of [['#cards',7],['#invoice-cards',10]]) {
    const {actual,target,goal,doneToday,todayTarget}=metrics.find(metric=>metric.index===index);
    const cards=[todayTarget==null?['Wykonanie narastająco',actual,goal]:['Dzisiaj',doneToday,todayTarget],[label,actual,target]];
    $(selector).innerHTML=cards.map(([name,value,expected])=>{
      const gap=expected==null?null:expected-value;
      return '<section><span>'+name+'</span><strong>'+value+' / '+(expected??'—')+'</strong><small class="'+(gap>0?'behind':gap<0?'ahead':'')+'">'+
        (gap==null?'Brak planu':gap>0?'Brakuje '+gap:gap<0?'Ponad plan':'Plan osiągnięty')+'</small></section>';
    }).join('')+'<section><span>Pozostało do celu</span><strong>'+
      (target==null?'—':Math.max(0,target-actual))+'</strong></section>';
  }
  const ratedMetrics=metrics.filter(({goal})=>goal>0);
  const average=ratedMetrics.length
    ?ratedMetrics.reduce((total,{actual,goal})=>total+actual/goal,0)/ratedMetrics.length
    :null;
  const stars=average===null?null:Math.min(5,average*5);
  const format=new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1});
  $('#rating-stars').hidden=stars===null;
  $('#rating-stars').style.setProperty('--rating-fill',((stars??0)*20)+'%');
  $('#seller-rating').textContent=stars===null?'Brak celów do oceny'
    :format.format(stars)+' / 5 · '+format.format(average*100)+'% realizacji';
  $('#pace').hidden=false;
  $('#pace-items').innerHTML=metrics.map(({label,actual,target,goal,delta})=>{
    const style=delta<0?'behind':delta>0?'ahead':'';
    const status=delta==null?'Brak celu':delta<0?'Brakuje '+(-delta):delta>0?'Ponad planem o '+delta:'Zgodnie z planem';
    return '<div class="pace-item"><span>'+label+'</span><strong class="pace-count">'+actual+' / '+(goal??'—')+'</strong>'+
      '<strong class="'+style+'">'+status+'</strong>'+(target==null?'':'<small class="pace-month">Cel okresu · '+target+'</small>')+'</div>';
  }).join('');
  renderMotivator(metrics,snapshot.today);
}

function monthlyMetrics(records,current,monthPlan,funnel,reviewTarget,day,daysLeft,isWorkday,isScheduled=weekday) {
  const [year,month]=day.split('-').map(Number);
  const monthEnd=monthStart(year,month);
  const daysMonth=remainingDays(day.slice(0,7)+'-01',monthEnd,isScheduled);
  const fraction=daysMonth?(remainingDays(day.slice(0,7)+'-01',day,isScheduled)+Number(isScheduled(day)))/daysMonth:0;
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

const taskLabels={
  0:'Obsłuż nowe zapytania',
  1:'Wykonaj próby kontaktu',
  2:'Przeprowadź spotkania',
  4:'Przeprowadź jazdy próbne',
  5:'Wyślij oferty',
  6:'Wróć do wysłanych ofert',
  7:'Domknij zamówienia',
  8:'Zarejestruj auta',
  9:'Zdobądź opinie w Google',
  10:'Wystaw faktury'
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

const taskPriorities=[
  ['Najpierw: klienci blisko decyzji', [7,6]],
  ['Następnie: nowe szanse i rozmowy', [0,1,5,2,4]],
  ['Obsługa sprzedaży', [10,8,9]]
];

function renderTodayTasks(metrics,previous,day) {
  const tasks=metrics.filter(({todayTarget,doneToday})=>todayTarget>doneToday);
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
  const tasksByIndex=new Map(tasks.map(task=>[task.index,task]));
  const groups=taskPriorities.map(([label,indexes],priority)=>{
    const items=indexes.filter(index=>tasksByIndex.has(index)).map(index=>{
      const {doneToday,todayTarget}=tasksByIndex.get(index);
      const gap=todayTarget-doneToday;
      return '<li class="task-action"><span>'+taskLabels[index]+'</span> <strong>'+gap+'</strong></li>';
    }).join('');
    return items?'<section class="task-group" data-priority="'+priority+'"><h3>'+label+'</h3><ol>'+items+'</ol></section>':'';
  }).join('');
  $('#tasks').innerHTML=groups||'<p class="task-message">'+(hasPlan?'Na dziś nie zostały żadne zadania z planu.':'Ustal z kierownikiem cel, a tutaj pojawią się Twoje zadania.')+'</p>';

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

async function dailyGif(config) {
  let items=await giphyResults(config,config.id);
  if (!config.id&&items.length) {
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

function renderGif(config) {
  const card=$('#giphy-card');
  const icon=$('#meme-icon');
  const caption=$('#meme-caption');
  card.hidden=true;
  renderMemeVotes('local');
  icon.hidden=false;
  caption.hidden=false;
  if (!config||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const request=giphyRequest??=dailyGif(config).catch(()=>null);
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
    for (const input of inputs) input.classList.toggle('has-value',input.valueAsNumber>0);
    const hasResults=inputs.some(input=>input.valueAsNumber>0);
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
      field.value=input.valueAsNumber>0?input.value:'';
    }
  }
  updateSourceStatuses();
});
$('#rows').addEventListener('focusout',event=>{
  const input=event.target;
  if (input.valueAsNumber===0) input.value='';
});
$('#entry').addEventListener('invalid',event=>{
  const row=event.target.closest('[data-source]');
  if (!row||!matchMedia('(max-width:1050px)').matches) return;
  const firstInvalid=$('#rows input:invalid');
  if (event.target===firstInvalid) showEntrySource(Number(row.dataset.source));
},true);

function labelPanel(role,scope='',preview=false) {
  const title=panelNames[role];
  $('#dealer').textContent=title;
  $('#salon').textContent=[preview?'Podgląd':'',scope].filter(Boolean).join(' · ');
  document.title=title+' · Bieg Wyżej';
}

function renderRanking(ranking) {
  const rankText=rank=>rank.place+'. miejsce (z '+rank.total+')';
  $('#ranking-title').textContent=ranking?.groupName?'Ranking grupy dealerskiej · '+ranking.groupName:'Ranking salonu';
  const podium=$('#ranking-podium');
  const podiumEntries=ranking?.podium??[];
  podium.hidden=!podiumEntries.length;
  $('#ranking-empty').hidden=Boolean(podiumEntries.length);
  podium.replaceChildren(...podiumEntries.map(({place,name,salon,self})=>{
    const card=document.createElement('li');
    card.dataset.place=place;
    const medal=document.createElement('span');
    medal.className='podium-medal';
    medal.textContent=place+'. miejsce';
    const seller=document.createElement('strong');
    seller.textContent=self?name+' (Ty)':name;
    const location=document.createElement('span');
    location.textContent=salon;
    card.append(medal,seller,location);
    return card;
  }));
  $('#ranking-salon').textContent=ranking?.salon?rankText(ranking.salon):'Brak pozycji';
  $('#ranking-group-row').hidden=!ranking?.groupName;
  $('#ranking-group').textContent=ranking?.group?rankText(ranking.group):'Brak pozycji';
  $('#ranking-result').textContent=ranking?.percent==null?'Brak planu'
    :new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(ranking.percent)+'%';
}

function renderSeller() {
  const {brand,personal,cause}=data;
  const salon=data.sellers[0].salon;
  labelPanel('seller',brand?.name??salon);
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
  $('#lesson-topic').textContent=lesson?.question??lesson?.topic??'Kierownik salonu może opublikować tutaj krótkie lekcje ze standardów obsługi.';
  const answer=$('#lesson-answer');
  if (answer.querySelector('p').textContent!==(lesson?.topic??'')) answer.open=false;
  answer.hidden=!lesson?.question;
  answer.querySelector('p').textContent=lesson?.question?lesson.topic:'';
  $('#lesson-remember').hidden=!lesson||Boolean(lesson.question);
  $('#lesson-remember span').textContent=lesson?.remember??'';
  const currentMonth=data.today.slice(0,7);
  const isScheduled=date=>weekday(date)&&!['leave','training'].includes(personal.exceptions[date]);
  const [year,monthNumber]=currentMonth.split('-').map(Number);
  $('#seller-calendar-days').textContent='Dni pracy do końca miesiąca: '+remainingDays(data.today,monthStart(year,monthNumber),isScheduled);
  renderTodayTasks(periodMetrics(data,currentMonth,1),data.previousDaily,data.today);
  renderPeriodPicker(periodValue.value||currentMonth);
  loadSellerPeriod();
  const pending=(data.calendar??[]).filter(row=>row.status==='pending').length;
  const reminder=$('#calendar-reminder');
  reminder.hidden=!pending;
  const calendarLink=document.createElement('a');
  calendarLink.href='#plan';
  calendarLink.dataset.panelRoute='';
  calendarLink.textContent='Otwórz kalendarz w zakładce Plan';
  calendarLink.onclick=()=>{$('#seller-calendar').open=true;};
  reminder.replaceChildren('Dni wolne czekające na zatwierdzenie: '+pending+'. ',calendarLink);
  $('#seller-calendar summary').textContent='Kalendarz pracy i dni wolne'+(pending?' · '+pending+' oczekuje':'');
  if ($('#seller-calendar').open) renderCalendar($('#seller-calendar-editor'),data.sellers,false);
  $('#entry-date').textContent=dateLabel(day);
  $('#backlog').hidden=!next;
  $('#backlog-text').textContent=next?personal.missing.length+' do rozliczenia · '+dateLabel(next)+(waiting?' · Czeka na zatwierdzenie':''):'';
  $('#resolve').hidden=!next||day===next||waiting;
  for (const button of document.querySelectorAll('[data-kind]')) button.hidden=!next||day!==next||waiting;
  const noActivity=$('#no-activity');
  if (noActivity.dataset.day!==day||exception==='pending') {
    noActivity.open=false;
    $('#reason').value='';
  }
  noActivity.dataset.day=day;
  noActivity.hidden=locked||exception==='pending';
  $('#save').disabled=$('#approve-day').disabled=busy||Boolean(blocked)||locked;
  const draft=personal.drafts?.[day];
  const matrix=records[day]?.[5]??draft;
  const legacy=records[day]&&!records[day][5];
  $('#columns').innerHTML='<tr><th scope="col">Źródło</th>'+columns.map(([,name])=>'<th scope="col">'+name+'</th>').join('')+'</tr>';
  const previousSource=$('#entry-grid').dataset.day===day?Number(sourceSelect.value):0;
  $('#entry-grid').dataset.day=day;
  $('#rows').innerHTML=legacy?'':sources.map((name,r)=>'<tr data-source="'+r+'"><th scope="row">'+name+
    (sourceDetails[r]?'<small class="source-detail">'+sourceDetails[r]+'</small>':'')+'</th>'+columns.map(([c,label])=>
    '<td><span class="entry-field-label" aria-hidden="true">'+label+'</span><input type="number" min="0" max="1000000" step="1" inputmode="numeric" enterkeyhint="next" aria-label="'+name+' – '+label+'" name="v'+r+'_'+c+'" value="'+(matrix?.[r]?.[c]>0?matrix[r][c]:'')+'"'+(locked||blocked?' disabled':'')+(r===0&&(c===1||c===2)?' readonly title="Automatycznie z liczby leadów"':'')+'></td>').join('')+'</tr>').join('');
  $('#mobile-entry').hidden=Boolean(legacy);
  $('#entry-navigation').hidden=Boolean(legacy);
  $('#entry-grid').hidden=Boolean(legacy);
  if (!legacy) {
    sourceSelect.replaceChildren(...sources.map((name,i)=>new Option(name,String(i))));
    showEntrySource(previousSource);
    updateSourceStatuses();
  }
  $('#status').textContent=legacy?'Dzień zapisano wcześniej w formacie sumarycznym.':records[day]?'Dzień zatwierdzony.':locked?'Dzień rozliczony.'
    :blocked?(exception==='pending'?'Dzień czeka na zatwierdzenie.':'Najpierw rozlicz zaległość.')
    :draft?'Zapisano roboczo. Możesz dalej edytować wartości.':'Możesz zapisywać zmiany w ciągu dnia.';
  const showMeme=data.sidebarMode==='meme';
  $('#cause').hidden=showMeme;
  $('#meme').hidden=!showMeme;
  $('#meme-actions').hidden=!showMeme;
  $('#meme-status').textContent='';
  if (showMeme) {
    const [title,icon,caption]=data.meme??['Na dziś wszystkie memy są rozdane.', '🙂', 'Zajrzyj jutro po kolejną scenkę z salonu.'];
    $('#meme-title').hidden=false;
    $('#meme-title').textContent=title;
    $('#meme-icon').textContent=icon;
    $('#meme-caption').textContent=caption;
    renderGif(data.giphy);
  }
  $('#cause-title').textContent=cause?.title??'Cel w przygotowaniu';
  $('#cause-org').textContent=cause?.organization??'';
  $('#cause-description').textContent=cause?.description??'Organizacja i opis pojawią się po opublikowaniu celu.';
  const [done,expected]=personal.progress;
  $('#progress-text').textContent=done+' z '+expected+' dni pracy rozliczonych do dziś';
  $('#progress').max=expected||1;
  $('#progress').value=done;
  $('#fortune').textContent=records[data.today]?fortunes[dayIndex%fortunes.length]:'Otworzy się po zatwierdzeniu dzisiejszych wyników.';
  selectSellerTab();
  $('#daily').hidden=false;
}

function salonPace(actual,target,elapsed,total) {
  const expected=target*elapsed/total;
  const forecast=elapsed>0?actual*total/elapsed:null;
  const tone=actual>=target?'ahead':forecast===null?'':forecast>=target?'ahead':'behind';
  const status=actual>=target?'Plan wykonany':forecast===null?'Za wcześnie na prognozę'
    :tone==='ahead'?'Zgodnie z tempem':'Plan zagrożony';
  return {expected,forecast,tone,status};
}

const managerActions={
  0:'Sprawdź dopływ zapytań według źródeł i przydział nowych leadów.',
  1:'Sprawdź nieobsłużone kontakty i rozdziel oddzwonienia w zespole.',
  2:'Ustal z zespołem, których klientów zaprosić na spotkanie i na kiedy.',
  4:'Sprawdź dostępność aut i terminy jazd z klientami.',
  5:'Przejrzyj otwarte szanse i ustal terminy wysyłki ofert.',
  6:'Przejrzyj oferty bez odpowiedzi i przypisz termin ponownego kontaktu.',
  7:'Omów transakcje bliskie podpisu i usuń przeszkody w ich domknięciu.',
  8:'Sprawdź brakujące dokumenty i terminy rejestracji.',
  9:'Sprawdź, czy klienci po odbiorze dostali zaproszenie do wystawienia opinii.',
  10:'Sprawdź, co blokuje fakturowanie podpisanych zamówień.'
};

function coachingSellerLink(seller) {
  const link=document.createElement('a');
  link.textContent=seller.name;
  link.href=sellerDetailUrl(seller.id,'wykonanie');
  link.target='_blank';
  link.rel='noopener';
  link.setAttribute('aria-label',seller.name+' – szczegóły lejka w nowej karcie');
  return link;
}

function salonQuickTotals(plan,elapsed,total,number) {
  const quickTotals=document.createElement('span');
  quickTotals.className='salon-quick-totals';
  for (const [index,label] of salonPlanMetrics.entries()) {
    const actual=plan.actuals[index];
    const target=plan.targets[index];
    const configured=plan.configured[index];
    const partial=plan.partial?.[index];
    const pace=configured&&target>0&&!partial?salonPace(actual,target,elapsed,total):null;
    const quickTotal=document.createElement('span');
    const tone=pace?.tone||'neutral';
    quickTotal.dataset.pace=tone;
    const paceLabel=pace?.status??(partial?'Plan obejmuje część salonów':configured?'Cel zerowy':'Brak planu');
    quickTotal.title=label+' · '+paceLabel;
    const icon=document.createElement('span');
    icon.setAttribute('aria-hidden','true');
    icon.textContent=salonPaceIcons[tone];
    const shortLabel=document.createElement('abbr');
    shortLabel.title=label;
    shortLabel.textContent=salonPlanAbbreviations[index];
    const accessiblePace=document.createElement('span');
    accessiblePace.className='salon-pace-description';
    accessiblePace.textContent=' · '+paceLabel;
    quickTotal.append(icon,' ',shortLabel,': '+number.format(actual)+'/'+(configured?number.format(target):'—')+(partial?'*':''),accessiblePace);
    quickTotals.append(quickTotal);
  }
  return quickTotals;
}

function renderSalonSummary(view,team=[]) {
  const results=$('#salon-results');
  const paceKey=$('#salon-pace-key');
  paceKey.hidden=true;
  const expanded=new Map([...results.querySelectorAll('details')].map(card=>[card.dataset.salon,card.open]));
  results.replaceChildren();
  if (!view.salons.length) {results.textContent='Brak przypisanych salonów.';return;}
  if (!data.salonPerformance) {results.textContent='Nie udało się pobrać realizacji planów salonów.';return;}
  $('#salon-period').textContent=dateLabel(view.today,{month:'long',year:'numeric'});
  const percent=new Intl.NumberFormat('pl-PL',{style:'percent',maximumFractionDigits:1});
  const number=new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1});
  const [year,month]=view.today.split('-').map(Number);
  const first=monthStart(year,month-1);
  const end=monthStart(year,month);
  const total=remainingDays(first,end);
  const elapsed=remainingDays(first,view.today)+Number(weekday(view.today));
  const salons=new Set(view.salons.map(({salon})=>salon));
  const plans=data.salonPerformance.filter(plan=>salons.has(plan.salon));
  paceKey.hidden=!plans.length;
  if (plans.length>1) {
    const planned=salonPlanMetrics.map((_,index)=>plans.filter(plan=>plan.configured[index]));
    const overall={
      actuals:salonPlanMetrics.map((_,index)=>plans.reduce((sum,plan)=>sum+plan.actuals[index],0)),
      targets:planned.map((entries,index)=>entries.reduce((sum,plan)=>sum+plan.targets[index],0)),
      configured:planned.map(entries=>entries.length>0),
      partial:planned.map(entries=>entries.length>0&&entries.length<plans.length)
    };
    const card=document.createElement('div');
    card.className='salon-overall-totals';
    const heading=document.createElement('strong');
    heading.textContent='Wszystkie salony · razem';
    card.append(heading,salonQuickTotals(overall,elapsed,total,number));
    if (overall.partial.some(Boolean)) {
      const note=document.createElement('p');
      note.textContent='* Plan obejmuje część salonów';
      card.append(note);
    }
    results.append(card);
  }
  for (const plan of plans) {
    const card=document.createElement('details');
    card.dataset.salon=plan.salon;
    const summary=document.createElement('summary');
    const title=document.createElement('strong');
    title.textContent=plan.salon;
    const grid=document.createElement('span');
    grid.className='salon-progress-grid';
    for (const [index,label] of salonPlanMetrics.entries()) {
      const indicator=document.createElement('span');
      const name=document.createElement('span');
      name.textContent=label;
      const values=document.createElement('strong');
      const actual=plan.actuals[index];
      const target=plan.targets[index];
      const configured=plan.configured[index];
      const ratio=configured&&target>0?actual/target:null;
      const pace=ratio===null?null:salonPace(actual,target,elapsed,total);
      values.textContent=actual+' / '+(configured?target:'—')+
        (ratio===null?(configured?' · cel zerowy':' · brak celu'):' · '+percent.format(ratio));
      if (pace) values.className=pace.tone;
      indicator.append(name,values);
      if (ratio!==null) {
        const progress=document.createElement('progress');
        progress.max=target;
        progress.value=Math.min(actual,target);
        progress.setAttribute('aria-label',plan.salon+' · '+label);
        progress.setAttribute('aria-valuetext',values.textContent);
        progress.style.setProperty('--plan-progress',pace.tone==='behind'?'#a12626':pace.tone==='ahead'?'#12633b':'#64748b');
        const status=document.createElement('strong');
        status.className=pace.tone;
        status.textContent=pace.status;
        const note=document.createElement('small');
        note.textContent='Tempo na dziś: '+number.format(pace.expected)
          +' · Prognoza na koniec: '+(pace.forecast===null?'—':number.format(pace.forecast));
        indicator.append(progress,status,note);
      }
      grid.append(indicator);
    }
    const assessed=plan.targets.map((target,index)=>plan.configured[index]&&target>0
      ?salonPace(plan.actuals[index],target,elapsed,total):null).filter(Boolean);
    const risky=assessed.some(metric=>metric.tone==='behind');
    const status=document.createElement('span');
    status.className='salon-pace-status '+(risky?'behind':assessed.some(metric=>metric.tone==='ahead')?'ahead':'');
    status.textContent=risky?'Plan zagrożony':!assessed.length?'Brak celów do oceny'
      :assessed.every(metric=>metric.status==='Plan wykonany')?'Plan wykonany'
      :assessed.some(metric=>metric.forecast===null)?'Za wcześnie na prognozę':'Zgodnie z tempem';
    const time=document.createElement('p');
    time.className='salon-pace-time';
    time.textContent=elapsed+' z '+total+' dni roboczych miesiąca (pon.–sob.) · '+percent.format(elapsed/total)
      +' · Prognoza zakłada utrzymanie dotychczasowego tempa.';
    summary.append(title,status,salonQuickTotals(plan,elapsed,total,number));
    const members=new Set([...plan.team,...plan.contributors].map(person=>person.id));
    const metrics=team.filter(person=>members.has(person.seller.id));
    const areas=columns.map(([index,label],column)=>{
      const results=metrics.map(person=>({seller:person.seller,...person.metrics[column]}));
      const salonIndex=[7,8,10,9].indexOf(index);
      const hasSalonPlan=plan.configured[salonIndex];
      const goal=hasSalonPlan?plan.targets[salonIndex]*elapsed/total
        :results.reduce((sum,metric)=>sum+(metric.goal??0),0);
      const actual=hasSalonPlan?plan.actuals[salonIndex]:results.reduce((sum,metric)=>sum+metric.actual,0);
      return {index,label,contributors:results.filter(metric=>metric.goal>0),actual,goal,delta:actual-goal};
    });
    const onPace=metrics.filter(person=>{
      const due=person.metrics.filter(metric=>metric.goal>0);
      return due.length&&due.every(metric=>metric.delta>=0);
    });
    const sections=document.createElement('div');
    sections.className='salon-coaching';
    for (const needsAction of [true,false]) {
      const section=document.createElement('section');
      section.className=needsAction?'coaching-risk':'coaching-good';
      const heading=document.createElement('h3');
      heading.textContent=needsAction?'Wymaga reakcji':'Co działa';
      section.append(heading);
      if (!needsAction&&onPace.length) {
        const row=document.createElement('div');
        row.className='coaching-metric coaching-on-pace';
        const title=document.createElement('strong');
        title.textContent='Handlowcy z planem zgodnym z tempem';
        const list=document.createElement('ul');
        for (const {seller} of onPace) {
          const item=document.createElement('li');
          item.append(coachingSellerLink(seller));
          list.append(item);
        }
        row.append(title,list);
        section.append(row);
      }
      for (const {index,label,contributors,actual,goal,delta} of areas) {
        const people=contributors.filter(metric=>needsAction?metric.delta<0:metric.delta>=0)
          .sort((a,b)=>needsAction?a.delta-b.delta:b.delta-a.delta);
        const salonOnPace=goal>0&&delta>=0;
        if (needsAction?goal<=0||delta>=0:!salonOnPace&&!people.length) continue;
        const row=document.createElement('div');
        row.className='coaching-metric';
        const name=document.createElement('strong');
        name.textContent=!needsAction&&!salonOnPace?label+' · handlowcy zgodnie z własnym tempem'
          :label+' · '+number.format(actual)+' / '+number.format(goal)+' na dziś'
            +(needsAction?' · brakuje '+Math.ceil(-delta):' · salon zgodnie z tempem');
        row.append(name);
        if (needsAction) {
          const action=document.createElement('p');
          action.textContent=managerActions[index];
          row.append(action);
        }
        const list=document.createElement('ul');
        for (const metric of people) {
          const item=document.createElement('li');
          item.append(coachingSellerLink(metric.seller));
          if (!needsAction) item.append(' · '+number.format(metric.actual)+' / '+number.format(metric.goal)+' na dziś');
          list.append(item);
        }
        if (list.children.length) row.append(list);
        section.append(row);
      }
      if (section.children.length===1) {
        const note=document.createElement('p');
        note.textContent=needsAction?'Brak wykazanych zaległości.':'Brak wskaźników na planie z wyznaczonym celem na dziś.';
        section.append(note);
      }
      sections.append(section);
    }
    card.append(summary,time,grid,sections);
    card.open=expanded.get(plan.salon)??false;
    results.append(card);
  }
}

function renderManagerDashboard(view,detailOnly=false) {
  const {today,sellers,daily,plans,funnelPlans,reviewPlans,teamDay}=view;
  const month=today.slice(0,7);
  const [year,monthNumber]=month.split('-').map(Number);
  const entries=new Map();
  for (const row of daily) {
    if (!row.day.startsWith(month)||row.day>today) continue;
    if (!entries.has(row.person)) entries.set(row.person,[]);
    entries.get(row.person).push([row.day,JSON.parse(row.counters)]);
  }
  const forSeller=(items,person)=>items.find(row=>row.month===month&&row.person===person);
  const statuses={leave:'Urlop',training:'Szkolenie',zero:'Dzień rozliczony bez aktywności',pending:'Czeka na zatwierdzenie'};
  const team=sellers.filter(seller=>seller.accountStatus!=='inactive').map(seller=>{
    const entry=teamDay.find(row=>row.person===seller.id);
    const active=Boolean(entry?.started&&entry.started<=today);
    const plannedToday=(view.calendar??[]).some(row=>row.person===seller.id&&row.day===today&&row.status==='approved');
    const status=entry?.saved?'Wpisano działania':plannedToday?'Zaplanowany dzień wolny':statuses[entry?.kind]??(!weekday(today)?'Dzień wolny':active?'Brak wpisu':'Ewidencja jeszcze nierozpoczęta');
    const records=entries.get(seller.id)??[];
    const current=records.find(([day])=>day===today)?.[1];
    const free=new Set((view.calendar??[]).filter(row=>row.person===seller.id&&row.status==='approved').map(row=>row.day));
    const isScheduled=day=>weekday(day)&&!free.has(day);
    const metrics=monthlyMetrics(records,current,forSeller(plans,seller.id)?.target,forSeller(funnelPlans,seller.id),
      forSeller(reviewPlans,seller.id)?.target,today,remainingDays(today,monthStart(year,monthNumber),isScheduled),isScheduled(today),isScheduled);
    const weakest=metrics.filter(metric=>metric.delta<0)
      .sort((a,b)=>a.actual/a.goal-b.actual/b.goal||a.delta-b.delta)[0];
    return {seller,status,metrics,weakest,orders:metrics.find(metric=>metric.index===7)};
  });
  if (detailOnly) return team;
  const list=$('#manager-team-list');
  list.replaceChildren();
  if (!team.length) list.textContent='Brak aktywnych handlowców.';
  const removed=$('#manager-team-removed');
  const inactive=sellers.filter(seller=>seller.accountStatus==='inactive');
  removed.replaceChildren(...(inactive.length?inactive:[null]).map(seller=>{
    const item=document.createElement('li');
    item.textContent=seller?seller.name+(view.salons.length>1?' · '+seller.salon:'')
      +(seller.archivedFrom?' · poza raportami od '+monthLabel(seller.archivedFrom):'')
      :'Brak usuniętych handlowców.';
    return item;
  }));
  const percent=new Intl.NumberFormat('pl-PL',{style:'percent',maximumFractionDigits:1});
  for (const {seller,status,metrics,weakest,orders} of team) {
    const detail=document.createElement('details');
    const summary=document.createElement('summary');
    const name=document.createElement('strong');
    name.textContent=seller.name+(view.salons.length>1?' · '+seller.salon:'');
    const progress=orders.target>0?percent.format(orders.actual/orders.target)+' planu miesiąca':'Brak planu zamówień';
    const badges=document.createElement('span');
    badges.className='team-statuses';
    const accountLabels={active:'Konto aktywne',inactive:'Konto nieaktywne',pending:'Konto bez hasła'};
    for (const [label,positive] of [
      [accountLabels[seller.accountStatus],seller.accountStatus==='active'],
      [seller.includeInReports?'W raportach':'Poza raportami',seller.includeInReports]
    ]) {
      const badge=document.createElement('span');
      badge.className='status-badge '+(positive?'status-positive':'status-negative');
      badge.textContent=label;
      badges.append(badge);
    }
    summary.append(name,badges,progress+' · '+status+(weakest?' · '+weakest.label+': brakuje '+(-weakest.delta):''));
    const figures=document.createElement('ul');
    for (const metric of metrics) {
      const row=document.createElement('li');
      row.textContent=metric.label+' · '+metric.actual+(metric.target==null?' · brak celu':' / '+metric.target+' w miesiącu');
      figures.append(row);
    }
    detail.id='zespol-handlowiec-'+seller.id;
    if (detailParams.get('osoba')===String(seller.id)) detail.open=true;
    detail.append(summary,figures);
    if (view.role==='manager'&&data.role==='manager'&&seller.accountStatus!=='inactive') {
      const link=document.createElement('a');
      link.href=sellerDetailUrl(seller.id,'zespol')+'#reopen-day-form';
      link.textContent='Zarządzaj zatwierdzonymi dniami';
      detail.append(link);
    }
    list.append(detail);
  }
  return team;
}

const salonPlans=$('#salon-plans');
const salonPlanMonth=$('#salon-plan-month');
const salonPlanMetrics=['Zamówienia','Rejestracje','Wystawione faktury','Opinie Google'];
const salonPlanAbbreviations=['Z','R','F','G'];
const salonPaceIcons={ahead:'✓',behind:'↓',neutral:'○'};
let salonPlanRevision=0;
let openPlanningSeller=null;

function planTargets(values,max,metrics=salonPlanMetrics) {
  const fields=document.createElement('div');
  fields.className='salon-plan-fields';
  const inputs=metrics.map((name,index)=>{
    const label=document.createElement('label');
    const input=document.createElement('input');
    input.type='number';
    input.inputMode='numeric';
    input.min='0';
    if (max) input.max=max;
    input.required=true;
    input.value=values[index]??'';
    label.append(name,input);
    fields.append(label);
    return input;
  });
  return {fields,inputs};
}

const sellerActivityPlan=[
  ['Próby kontaktu',1],['Jazdy próbne',4],['Oferty',5],['Leady',0],['Spotkania',2],['Follow-up',6]
];

function sourcePlanProposal(totals,shares,rates) {
  const allocated=totals.map(total=>allocateSourceTargets(total,shares));
  return shares.map((_,index)=>{
    const targets=allocated.map(column=>column[index]);
    return [...targets,...sourceActivityProposal(index,targets[0],rates[index])];
  });
}

function copySourcePlan(donor,shares,rates) {
  if (donor.sourceTargets) return donor.sourceTargets;
  const mix=shares??[...defaultMix,0];
  const values=sourcePlanProposal(donor.targets.map(target=>target??0),mix,rates);
  donor.funnelTargets.forEach((total,column)=>{
    if (total==null) return;
    allocateSourceTargets(total,mix).forEach((value,index)=>{values[index][column+4]=value;});
  });
  return values;
}

function sellerCopyControls(label,buttonText) {
  const controls=document.createElement('div');
  controls.className='salon-plan-fields';
  const field=document.createElement('label');
  const select=document.createElement('select');
  field.append(label,select);
  const button=document.createElement('button');
  button.type='button';
  button.className='secondary';
  button.textContent=buttonText;
  controls.append(field,button);
  return {controls,select,button};
}

function sellerCopyOptions(select,button,candidates) {
  select.replaceChildren(new Option(candidates.length?'Wybierz handlowca':'Brak handlowców do skopiowania',''),
    ...candidates.map(seller=>new Option(seller.name+' · '+seller.salon,seller.id)));
  button.disabled=true;
  select.onchange=()=>{button.disabled=!select.value;};
}

function sourceProfileEditor(person,individual,month,peers) {
  const panel=document.createElement('details');
  const title=document.createElement('summary');
  const names=types=>types.map(type=>sourceProfilePresets[type].label).join(' + ');
  const setTitle=()=>{
    const types=person.sourceProfileTypes??[];
    title.textContent='Profil źródeł pozyskania'+(types.length?' · '+(types.length>1?'Mieszany: ':'')+names(types):'');
  };
  setTitle();
  const label=document.createElement('label');
  label.textContent='Typ profilu ';
  const picker=document.createElement('select');
  const presets=Object.entries(sourceProfilePresets);
  picker.append(new Option('Wybierz profil',''),...presets.map(([type,preset])=>new Option(preset.label,type)),
    new Option('Mieszany','mixed'));
  const legacyOption=new Option('Dotychczasowy profil','legacy');
  legacyOption.hidden=true;
  picker.append(legacyOption);
  label.append(picker);
  const mixed=document.createElement('fieldset');
  const legend=document.createElement('legend');
  legend.textContent='Wybierz 2 lub 3 typy. Każdy ma równą wagę.';
  mixed.append(legend);
  const checks=presets.map(([type,preset])=>{
    const field=document.createElement('label');
    const input=document.createElement('input');
    input.type='checkbox';
    input.value=type;
    field.append(input,' '+preset.label+' ');
    mixed.append(field);
    return input;
  });
  const breakdown=document.createElement('p');
  const status=document.createElement('p');
  status.setAttribute('role','status');
  const save=document.createElement('button');
  save.type='button';
  save.textContent='Zapisz profil';
  let legacyShares=null;
  const selection=()=>{
    if (picker.value==='legacy') return [];
    if (picker.value!=='mixed') return picker.value?[picker.value]:[];
    const types=checks.filter(input=>input.checked).map(input=>input.value);
    return types.length>=2?types:[];
  };
  const update=()=>{
    mixed.hidden=picker.value!=='mixed';
    const shares=picker.value==='legacy'?legacyShares:sourceProfileShares(selection());
    breakdown.textContent=shares?sources.flatMap((source,i)=>shares[i]?[source+' '+shares[i]+'%']:[]).join(' · ')
      :picker.value==='mixed'?'Zaznacz przynajmniej dwa typy.':'Wybierz typ, aby zobaczyć podział źródeł.';
    save.disabled=!shares;
    status.textContent='';
  };
  const fill=donor=>{
    const types=donor.sourceProfileTypes??[];
    legacyShares=types.length?null:donor.sourceProfile;
    legacyOption.hidden=!legacyShares;
    picker.value=types.length>1?'mixed':types[0]??(legacyShares?'legacy':'');
    checks.forEach(input=>{input.checked=types.includes(input.value);});
    update();
  };
  picker.onchange=update;
  checks.forEach(input=>{input.onchange=update;});
  fill(person);
  save.onclick=async()=>{
    const types=selection();
    const shares=picker.value==='legacy'?legacyShares:sourceProfileShares(types);
    if (!shares) return;
    save.disabled=true;
    try {
      await api('/api/salon-plans/source-profile',{...individual,month,...(types.length?{types}:{shares})});
      person.sourceProfile=shares;
      person.sourceProfileTypes=types;
      setTitle();
      status.textContent='Profil zapisany.';
    } catch (error) { status.textContent=error.message; }
    finally { save.disabled=false; }
  };
  const copy=sellerCopyControls('Profil innego handlowca','Kopiuj profil');
  panel.addEventListener('toggle',()=>{
    if (panel.open) sellerCopyOptions(copy.select,copy.button,peers.filter(peer=>peer.sourceProfile));
  });
  copy.button.onclick=()=>{
    const donor=peers.find(peer=>String(peer.id)===copy.select.value);
    if (!donor?.sourceProfile) return;
    fill(donor);
    status.textContent='Wczytano profil: '+donor.name+'. Zapisz, aby go przypisać.';
  };
  panel.append(title,copy.controls,label,mixed,breakdown,status,save);
  return {panel,getProfile:()=>person.sourceProfile};
}

function sellerPlanForm(person,individual,month,sourceRates,peers,sourceHistoryRates=[]) {
  const form=document.createElement('form');
  const step=title=>{
    const section=document.createElement('section');
    section.className='planning-step';
    const heading=document.createElement('h3');
    heading.textContent=title;
    section.append(heading);
    return section;
  };
  const profileStep=step('1. Profil źródeł');
  const goalsStep=step('2. Cele miesięczne');
  const reviewStep=step('3. Podgląd i korekta');
  const reference=document.createElement('p');
  reference.textContent='Plan zakłada lepszą obsługę dostępnych leadów. Kalkulator przewiduje kolejne próby kontaktu oraz follow-up po niemal każdej ofercie. Przy co najmniej 60 leadach z danego źródła w trzech zakończonych miesiącach widać wynik salonu. Lepszy wynik może podnieść cel konwersji. Przy słabszym wyniku obok celu pokażemy różnicę do nadrobienia.';
  const percent=new Intl.NumberFormat('pl-PL',{style:'percent',maximumFractionDigits:1});
  const summary=document.createElement('dl');
  summary.className='planning-totals';
  const sourceDetails=document.createElement('details');
  const sourceHeading=document.createElement('summary');
  sourceHeading.textContent='Sprawdź lub edytuj cele według źródeł';
  sourceDetails.append(sourceHeading);
  const save=document.createElement('button');
  save.textContent='Zapisz plan';
  const profile=sourceProfileEditor(person,individual,month,peers);
  const proposal=planTargets(person.targets.map(target=>target??''),1000000);
  proposal.inputs.forEach(input=>{input.required=false;});
  const proposalTitle=document.createElement('p');
  const proposalInputs=()=>proposal.inputs.map(input=>input.value);
  let appliedTotals=proposalInputs().join(',');
  const propose=document.createElement('button');
  propose.type='button';
  propose.className='secondary';
  propose.textContent='Wylicz plan';
  const proposalStatus=document.createElement('p');
  proposalStatus.setAttribute('role','status');
  proposalTitle.textContent=monthLabel(month)+' · wpisz cele łączne';
  goalsStep.append(proposalTitle,proposal.fields,propose,proposalStatus);
  reviewStep.append(summary,sourceDetails);
  form.append(goalsStep,reviewStep);
  if (!person.sourceTargets&&person.targets.some(value=>value!==null)) {
    const legacy=document.createElement('p');
    legacy.textContent='Dotychczasowy plan łączny: '+salonPlanMetrics.map((label,index)=>label+' '+(person.targets[index]??'—')).join(' · ')+'. Rozdziel cele między źródła przed zapisaniem nowego planu.';
    goalsStep.append(legacy);
  }

  function updateSummary() {
    const totals=rows.reduce((sum,{inputs})=>sum.map((value,index)=>value+(inputs[index].valueAsNumber||0)),Array(10).fill(0));
    const labels=[...salonPlanMetrics,...sellerActivityPlan.map(([label])=>label)];
    summary.replaceChildren(...[0,2,1,3,7,4,8,5,6,9].map(index=>{
      const item=document.createElement('div');
      const name=document.createElement('dt');
      const value=document.createElement('dd');
      name.textContent=labels[index];
      value.textContent=totals[index];
      item.append(name,value);
      return item;
    }));
  }

  const rows=sources.map((source,index)=>{
    const saved=person.sourceTargets?.[index];
    const manual=planTargets(saved?.slice(0,4)??[0,0,0,0],1000000);
    const activity=planTargets(saved?.slice(4)??Array(6).fill(0),1000000,sellerActivityPlan.map(([label])=>label));
    const initial=sourceActivityProposal(index,saved?.[0]??0,sourceRates[index]);
    const edited=initial.map((value,i)=>Boolean(saved&&saved[i+4]!==value));
    const panel=document.createElement('details');
    const title=document.createElement('summary');
    const reset=document.createElement('button');
    reset.type='button';
    reset.className='secondary';
    reset.textContent='Przelicz działania dla źródła';

    function updateSource() {
      title.textContent=source+' · zamówienia: '+(manual.inputs[0].valueAsNumber||0)+' · leady: '+(activity.inputs[3].valueAsNumber||0);
      updateSummary();
    }
    function recalculate() {
      const orders=manual.inputs[0].valueAsNumber;
      if (!Number.isInteger(orders)||orders<0) return;
      const proposal=sourceActivityProposal(index,orders,sourceRates[index]);
      activity.inputs.forEach((input,i)=>{if (!edited[i]) input.value=proposal[i];});
    }
    manual.inputs[0].addEventListener('input',recalculate);
    manual.inputs.forEach(input=>input.addEventListener('input',updateSource));
    activity.inputs.forEach((input,i)=>input.addEventListener('input',()=>{edited[i]=true;updateSource();}));
    reset.onclick=()=>{edited.fill(false);recalculate();updateSource();};
    title.textContent=source+' · zamówienia: '+(saved?.[0]??0)+' · leady: '+(saved?.[7]??0);
    panel.className='planning-source';
    for (const input of [...manual.inputs,...activity.inputs]) {
      input.addEventListener('invalid',()=>{sourceDetails.open=true;panel.open=true;});
    }
    const rateNote=document.createElement('p');
    const targetRate=sourceConversionRate(index,sourceRates[index]);
    const historyRate=sourceHistoryRates[index];
    rateNote.textContent='Cel konwersji leadów na zamówienia · '+percent.format(targetRate);
    if (historyRate!=null) {
      const gap=targetRate-historyRate;
      rateNote.textContent+=' · wynik salonu '+percent.format(historyRate)
        +(gap>=0.001?' · do poprawy o '+new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(gap*100)+' p.p.':'');
    }
    panel.append(title,rateNote,manual.fields,activity.fields,reset);
    sourceDetails.append(panel);
    const inputs=[...manual.inputs,...activity.inputs];
    return {inputs,apply(values,keepActivities=false){
      inputs.forEach((input,i)=>{input.value=values[i];});
      edited.fill(keepActivities);
      panel.open=false;
      title.textContent=source+' · zamówienia: '+values[0]+' · leady: '+values[7];
    }};
  });
  updateSummary();
  propose.onclick=()=>{
    const shares=profile.getProfile();
    if (!shares) {
      proposalStatus.textContent='Najpierw ustaw i zapisz profil źródeł.';
      profile.panel.open=true;
      return;
    }
    if (!proposal.inputs.every(input=>input.reportValidity())) return;
    const totals=proposal.inputs.map(input=>input.valueAsNumber);
    if (totals.some(value=>!Number.isInteger(value))) {
      proposalStatus.textContent='Uzupełnij wszystkie cztery cele łączne. Jeśli cel wynosi zero, wpisz 0.';
      return;
    }
    const values=sourcePlanProposal(totals,shares,sourceRates);
    if (values.some(row=>row.some(value=>value>1000000))) {
      proposalStatus.textContent='Wyliczone działania przekraczają limit. Sprawdź podział zamówień między źródła.';
      return;
    }
    rows.forEach((row,index)=>row.apply(values[index]));
    updateSummary();
    appliedTotals=proposalInputs().join(',');
    proposalStatus.textContent='Plan wyliczony. Sprawdź podsumowanie poniżej i zapisz.';
  };
  const copy=sellerCopyControls('Plan innego handlowca','Kopiuj plan innego handlowca');
  const picker=document.createElement('details');
  const pickerTitle=document.createElement('summary');
  pickerTitle.textContent='Skopiuj zapisany plan';
  const monthLabelField=document.createElement('label');
  const fromMonth=document.createElement('input');
  fromMonth.type='month';
  const [year,monthNumber]=month.split('-').map(Number);
  fromMonth.value=monthStart(year,monthNumber-2).slice(0,7);
  monthLabelField.append('Kopiuj z miesiąca',fromMonth);
  const copyOwn=document.createElement('button');
  copyOwn.type='button';
  copyOwn.className='secondary';
  copyOwn.textContent='Kopiuj plan tego handlowca';
  const copyStatus=document.createElement('p');
  copyStatus.setAttribute('role','status');
  picker.append(pickerTitle,monthLabelField,copyOwn,copy.controls,copyStatus);
  picker.className='planning-compact';
  goalsStep.append(picker);
  let donors=[];
  let ownPlan=null;
  let revision=0;
  const loadDonors=async()=>{
    const request=++revision;
    const selectedMonth=fromMonth.value;
    copyStatus.textContent='Wczytywanie zapisanych planów…';
    sellerCopyOptions(copy.select,copy.button,[]);
    ownPlan=null;
    copyOwn.disabled=true;
    if (!selectedMonth) {copyStatus.textContent='Wybierz miesiąc planu źródłowego.';return;}
    try {
      const {plans}=await api('/api/salon-plans?month='+encodeURIComponent(selectedMonth));
      if (request!==revision||!picker.isConnected) return;
      const team=plans.flatMap(plan=>plan.team.map(seller=>({...seller,salon:plan.salon})));
      if (selectedMonth!==month) ownPlan=team.find(seller=>seller.id===person.id&&
        (seller.sourceTargets||seller.targets.some(value=>value!=null)||seller.funnelTargets.some(value=>value!=null)))??null;
      copyOwn.disabled=!ownPlan;
      donors=team.filter(seller=>seller.id!==person.id&&(seller.sourceTargets||seller.complete));
      sellerCopyOptions(copy.select,copy.button,donors);
      copyStatus.textContent=selectedMonth===month?'Wybierz inny miesiąc, aby skopiować plan tego handlowca.'
        :!ownPlan?'Ten handlowiec nie ma zapisanego planu w wybranym miesiącu.':'';

    } catch (error) {
      if (request===revision) copyStatus.textContent=error.message;
    }
  };
  fromMonth.onchange=loadDonors;
  picker.addEventListener('toggle',()=>{if (picker.open) loadDonors();});
  copyOwn.disabled=true;
  copyOwn.onclick=()=>applyCopy(ownPlan);
  copy.button.onclick=()=>applyCopy(donors.find(seller=>String(seller.id)===copy.select.value));
  function applyCopy(donor) {
    if (!donor) return;
    const shares=profile.getProfile();
    const values=copySourcePlan(donor,shares,sourceRates);
    proposal.inputs.forEach((input,index)=>{input.value=donor.targets[index]??0;});
    appliedTotals=proposalInputs().join(',');
    rows.forEach((row,index)=>row.apply(values[index],true));
    updateSummary();
    proposalStatus.textContent='';
    copyStatus.textContent='Wczytano plan: '+donor.name+' · '+monthLabel(fromMonth.value)+'. Sprawdź wartości przed zapisaniem.'
      +(donor.sourceTargets?'':' Plan łączny rozdzielono '+(shares?'według profilu odbiorcy.':'według domyślnego podziału źródeł.'))
      +(donor.targets.some(value=>value==null)?' Brakujące cele łączne uzupełniono zerami.':'');
  }
  const recalculateActivities=document.createElement('button');
  recalculateActivities.type='button';
  recalculateActivities.className='secondary';
  recalculateActivities.textContent='Przelicz tylko aktywności';
  const activityStatus=document.createElement('p');
  activityStatus.setAttribute('role','status');
  recalculateActivities.onclick=()=>{
    const goals=rows.map(({inputs})=>inputs.slice(0,4).map(input=>input.valueAsNumber));
    if (goals.some(row=>row.some(value=>!Number.isInteger(value)||value<0||value>1000000))) {
      activityStatus.textContent='Sprawdź cele wpisane przy poszczególnych źródłach.';
      return;
    }
    if (!goals.some(row=>row[0]>0)) {
      activityStatus.textContent='Najpierw wczytaj plan lub przypisz zamówienia do źródeł.';
      return;
    }
    const proposals=goals.map((row,index)=>sourceActivityProposal(index,row[0],sourceRates[index]));
    const exceedsLimit=proposals.some(row=>row.some(value=>value>1000000))||
      proposals[0].some((_,index)=>proposals.reduce((total,row)=>total+row[index],0)>1000000);
    if (exceedsLimit) {
      activityStatus.textContent='Wyliczone aktywności przekraczają limit.';
      return;
    }
    const previousLeads=rows.reduce((total,{inputs})=>total+(inputs[7].valueAsNumber||0),0);
    const nextLeads=proposals.reduce((total,row)=>total+row[3],0);
    rows.forEach((row,index)=>row.apply([...goals[index],...proposals[index]]));
    updateSummary();
    activityStatus.textContent='Leady w podglądzie · '+previousLeads+' → '+nextLeads+'. Sprawdź podgląd i zapisz.';
  };
  reviewStep.append(recalculateActivities,activityStatus);
  const calculationInfo=document.createElement('details');
  const calculationTitle=document.createElement('summary');
  calculationTitle.textContent='Jak liczymy działania?';
  calculationInfo.append(calculationTitle,reference);
  reviewStep.append(calculationInfo);
  const actions=document.createElement('div');
  actions.className='planning-actions';
  actions.append(save);
  form.append(actions);
  form.onsubmit=event=>{
    event.preventDefault();
    if (proposalInputs().join(',')!==appliedTotals) {
      proposalStatus.textContent='Przelicz plan po zmianie celów łącznych albo przywróć poprzednie wartości.';
      return;
    }
    const sourceTargets=rows.map(({inputs})=>inputs.map(input=>input.valueAsNumber));
    planAction(save,'/api/salon-plans/seller',{...individual,sourceTargets},month);
  };
  const editor=document.createElement('div');
  profileStep.append(profile.panel);
  if (!person.sourceProfile) profile.panel.open=true;
  editor.append(profileStep,form);
  return editor;
}

function planAction(button,path,body,month) {
  button.disabled=true;
  return api(path,{month,...body}).then(()=>{
    return refresh().then(()=>{
      if (salonPlanMonth.value===month) return loadSalonPlans().then(()=>{
        const status=$('#salon-plan-status');
        if (!status.textContent) status.textContent='Zapisano zmiany dla '+monthLabel(month)+'.';
      });
    });
  }).catch(error=>{
    if (salonPlanMonth.value===month) $('#salon-plan-status').textContent=error.message;
  }).finally(()=>{button.disabled=false;});
}

function salonGoalsEditor(plan,month) {
  const section=document.createElement('details');
  section.className='planning-compact';
  const title=document.createElement('summary');
  const restricted=data.role==='manager'&&plan.protected;
  const pending=plan.change?.status==='pending';
  title.textContent='Cele miesięczne salonu'+(pending?' · prośba o korektę':'');
  section.append(title);
  const scope={salon:plan.salon};
  if (restricted) {
    const current=document.createElement('p');
    current.textContent='Obowiązujący plan grupy · '+salonPlanMetrics.map((label,index)=>label+' '+plan.targets[index]).join(' · ');
    section.append(current);
  }
  if (plan.change) {
    const {id,status,targets,reason,requester}=plan.change;
    const request=document.createElement('div');
    request.className='planning-actions';
    const info=document.createElement('p');
    const statusLabels={pending:'Oczekuje na decyzję',approved:'Korekta zatwierdzona',rejected:'Prośba odrzucona',superseded:'Prośba zamknięta po zmianie planu'};
    info.textContent=statusLabels[status]+' · '+requester+' · '+reason;
    const proposal=document.createElement('p');
    proposal.textContent='Proponowane cele · '+salonPlanMetrics.map((label,index)=>label+' '+targets[index]).join(' · ');
    request.append(info,proposal);
    if (pending&&data.role==='group') {
      for (const approve of [true,false]) {
        const decision=document.createElement('button');
        decision.type='button';
        decision.className=approve?'':'secondary';
        decision.textContent=approve?'Zatwierdź korektę':'Odrzuć prośbę';
        decision.onclick=()=>planAction(decision,'/api/salon-plans/decide-change',{...scope,id,approve},month);
        request.append(decision);
      }
    }
    section.append(request);
    if (pending) section.open=true;
  }
  if (restricted&&pending) return section;
  const form=document.createElement('form');
  const {fields,inputs}=planTargets(plan.targets.map((value,index)=>plan.configured[index]?value:null),Number.MAX_SAFE_INTEGER);
  form.append(fields);
  const reason=document.createElement('textarea');
  if (restricted) {
    const label=document.createElement('label');
    reason.maxLength=500;
    reason.required=true;
    reason.rows=2;
    label.append('Uzasadnienie korekty',reason);
    form.append(label);
  }
  const save=document.createElement('button');
  save.textContent=restricted?'Wyślij prośbę do szefa grupy':'Zapisz plan salonu';
  form.append(save);
  form.onsubmit=event=>{
    event.preventDefault();
    const targets=inputs.map(input=>input.valueAsNumber);
    if (restricted) planAction(save,'/api/salon-plans/request-change',{...scope,targets,reason:reason.value},month);
    else planAction(save,'/api/salon-plans/direct',{...scope,targets},month);
  };
  section.append(form);
  return section;
}

async function loadSalonPlans() {
  const revision=++salonPlanRevision;
  const month=salonPlanMonth.value;
  const status=$('#salon-plan-status');
  const results=$('#salon-plan-results');
  results.replaceChildren();
  status.textContent=month?'Wczytywanie planów…':'Wybierz miesiąc.';
  if (!month) return;
  try {
    const {plans,pendingChanges=[]}=await api('/api/salon-plans?month='+encodeURIComponent(month));
    if (revision!==salonPlanRevision) return;
    if (pendingChanges.length) {
      const inbox=document.createElement('div');
      inbox.className='planning-toolbar';
      const title=document.createElement('strong');
      title.textContent='Prośby o korektę planu';
      inbox.append(title);
      for (const pending of pendingChanges) {
        const button=document.createElement('button');
        button.type='button';
        button.className='secondary';
        button.textContent=pending.salon+' · '+monthLabel(pending.month);
        button.onclick=async()=>{
          if (salonPlanMonth.value!==pending.month) {
            salonPlanMonth.value=pending.month;
            await loadSalonPlans();
          }
          [...results.querySelectorAll('article')].find(card=>card.dataset.salon===pending.salon)?.scrollIntoView({block:'center'});
        };
        inbox.append(button);
      }
      results.append(inbox);
    }
    const team=plans.flatMap(plan=>plan.team.map(person=>Object.assign(person,{salon:plan.salon})));
    for (const plan of plans) {
      const card=document.createElement('article');
      card.dataset.salon=plan.salon;
      const title=document.createElement('h2');
      title.textContent=plan.salon;
      const state=document.createElement('p');
      const approved=plan.team.filter(person=>person.approved).length;
      state.textContent=plan.direct?'Plan salonu ustawiony ręcznie'
        :plan.override?'Plan salonu po korekcie':'Plan salonu wyliczony z celów handlowców';
      if (plan.team.length) state.textContent+=' · Zatwierdzono '+approved+' z '+plan.team.length+' planów handlowców';
      const totals=document.createElement('dl');
      totals.className='planning-totals';
      for (const [index,label] of salonPlanMetrics.entries()) {
        const term=document.createElement('dt');
        const value=document.createElement('dd');
        term.textContent=label;
        value.textContent=plan.actuals[index]+' / '+plan.targets[index]+' · suma celów: '+plan.automatic[index];
        value.className=plan.actuals[index]>=plan.targets[index]?'ahead':'behind';
        const item=document.createElement('div');
        item.append(term,value);
        totals.append(item);
      }
      const overview=document.createElement('details');
      overview.className='planning-compact';
      const overviewTitle=document.createElement('summary');
      overviewTitle.textContent='Wyniki i cele salonu';
      overview.append(overviewTitle,state,totals);
      card.append(title,salonGoalsEditor(plan,month),overview);
      if (plan.contributors.length) {
        const note=document.createElement('p');
        note.textContent=plan.contributors.map(person=>person.name).join(', ')+' · zatwierdzone działania liczą się do wyników salonu.';
        card.append(note);
      }
      for (const person of plan.team) {
        const row=document.createElement('details');
        const summary=document.createElement('summary');
        const badge=document.createElement('span');
        badge.className='planning-badge';
        badge.dataset.state=person.approved?'approved':person.complete?'ready':'empty';
        badge.textContent=person.archived?'Konto usunięte':person.approved?'Zatwierdzony':person.complete?'Do zatwierdzenia':'Do uzupełnienia';
        summary.append(person.name,badge);
        row.className='planning-seller';
        row.name='planning-seller';
        row.open=openPlanningSeller===person.id;
        row.addEventListener('toggle',()=>{
          if (!row.isConnected) return;
          if (row.open) openPlanningSeller=person.id;
          else if (openPlanningSeller===person.id) openPlanningSeller=null;
        });
        row.append(summary);
        const individual={salon:plan.salon,person:person.id};
        if (data.role==='manager'&&!person.archived) {
          row.append(sellerPlanForm(person,individual,month,plan.sourceRates??[],team.filter(peer=>peer.id!==person.id),plan.sourceHistoryRates??[]));
        } else {
          const values=document.createElement('p');
          values.textContent=salonPlanMetrics.map((label,index)=>label+' '+(person.targets[index]??'—')).join(' · ');
          row.append(values);
        }
        if (person.complete&&!person.approved&&!person.archived) {
          const approve=document.createElement('button');
          approve.textContent='Zatwierdź plan handlowca';
          approve.onclick=()=>planAction(approve,'/api/salon-plans/approve',individual,month);
          row.append(approve);
        }
        card.append(row);
      }
      results.append(card);
    }
    status.textContent=plans.length?'':'Brak przypisanych salonów.';
  } catch(error) {
    if (revision===salonPlanRevision) status.textContent=error.message;
  }
}
salonPlanMonth.onchange=loadSalonPlans;
for (const [id,offset] of [['salon-plan-prev',-1],['salon-plan-current',0],['salon-plan-next',1]]) {
  $('#'+id).onclick=()=>{
    const current=data.today.slice(0,7);
    const [year,month]=(salonPlanMonth.value||current).split('-').map(Number);
    salonPlanMonth.value=offset?monthStart(year,month-1+offset).slice(0,7):current;
    loadSalonPlans();
  };
}
salonPlans.addEventListener('toggle',()=>{
  if (salonPlans.open&&!salonPlans.hidden) loadSalonPlans();
});

function selectManagementView() {
  if (location.hash==='#plany-salonow') {
    history.replaceState(history.state,'','#administracja');
    salonPlans.open=true;
  }
  const administration=location.hash==='#administracja';
  const team=(['manager','group'].includes(data?.role)||Boolean(managerPreviewSalon||groupPreviewName))&&location.hash==='#zespol';
  $('#manager-team-view').hidden=!team;
  $('#management-team').setAttribute('aria-current',team?'page':'false');
  salonPlans.hidden=!['group','manager'].includes(data?.role);
  if (!salonPlans.hidden&&!salonPlanMonth.value) salonPlanMonth.value=data.today.slice(0,7);
  $('#performance-view').hidden=administration||team;
  $('#administration-view').hidden=!administration;
  $('#management-performance').setAttribute('aria-current',administration||team?'false':'page');
  $('#management-admin').setAttribute('aria-current',administration?'page':'false');
}


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
let editableUsers=[];
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
  const selected=editing?editableUsers.find(user=>user.email===$('#user-picker').value):null;
  $('#user-picker-label').hidden=!editing;
  $('#user-fields').hidden=editing&&!selected;
  $('#user-save').textContent=editing?'Zapisz zmiany':'Dodaj użytkownika';
  userEditor.elements.name.value=selected?.name??'';
  userEditor.elements.email.value=selected?.email??'';
  userEditor.elements.email.readOnly=Boolean(selected);
  userEditor.elements.includeInReports.checked=selected?.includeInReports!==0;
  userEditor.elements.password.value='';
  userEditor.elements.invite.checked=false;
  $('#user-invite-label').hidden=editing;
  updateInviteFields();
  $('#user-password-label').textContent=editing?'Nowe hasło (opcjonalnie)':'Hasło do Biegu Wyżej (co najmniej 8 znaków)';
  userEditor.elements.salon.value=selected?.salon??'';
  userEditor.elements.dealerGroup.value=selected?.dealerGroup??'';
  for (const input of userEditor.querySelectorAll('input[name="roles"]')) input.checked=Boolean(selected?.roles.split(',').includes(input.value));
  $('#user-send-invite').hidden=!selected||Boolean(selected.archived||managerPreviewSalon||groupPreviewName);
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
  editUserBlock.hidden=false;
  const visibleSalons=new Set(view.salons.map(({salon})=>salon));
  editableUsers=delegated?data.users.filter(user=>
    visibleSalons.has(user.salon)&&!user.roles.split(',').includes('group')&&
    (view.role!=='manager'||user.roles==='seller')
  ):data.users;
  for (const [id,allowed] of [['user-group-role',!delegated],['user-manager-role',view.role!=='manager']]) {
    const label=$('#'+id);
    label.hidden=!allowed;
    label.querySelector('input').disabled=!allowed;
  }
  const salonPicker=userEditor.elements.salon;
  salonPicker.replaceChildren(new Option(view.salons.length?'Wybierz salon':'Brak dodanych salonów',''),
    ...view.salons.map(({salon})=>new Option(salon,salon)));
  const picker=$('#user-picker');
  const prior=picker.value;
  const groups=[false,true].map(archived=>{
    const group=document.createElement('optgroup');
    group.label=archived?'Usunięci użytkownicy':'Aktywni użytkownicy';
    group.append(...editableUsers.filter(user=>Boolean(user.archived)===archived)
      .map(user=>new Option(user.name===user.email?user.email:user.name+' · '+user.email,user.email)));
    return group;
  });
  picker.replaceChildren(new Option(editableUsers.length?'Wybierz użytkownika':'Brak użytkowników w tym zakresie',''),
    ...groups.filter(group=>group.children.length));
  if (editableUsers.some(user=>user.email===prior)) picker.value=prior;
  userEditor.elements.dealerGroup.replaceChildren(new Option('Wybierz grupę',''),...data.groups.map(group=>new Option(group.name,group.name)));
  loadUserEditor();
}
$('#user-picker').onchange=loadUserEditor;
function updateInviteFields() {
  const inviting=!editingUsers()&&userEditor.elements.invite.checked;
  $('#user-password-field').hidden=inviting;
  userEditor.elements.password.disabled=inviting;
  userEditor.elements.password.required=!editingUsers()&&!inviting;
}
userEditor.onchange=()=>{
  updateUserRoleFields();
  updateInviteFields();
};
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
    const result=await api('/api/users',{...fields,roles,invite:!editing&&values.has('invite'),includeInReports:values.has('includeInReports'),createOnly:!editing});
    await refresh();
    if (editing) {
      $('#user-picker').value=String(values.get('email')).trim().toLowerCase();
      loadUserEditor();
    }
    $('#user-status').textContent=editing?'Zapisano zmiany użytkownika.':result.invitation==='sent'?'Dodano użytkownika i wysłano zaproszenie.':result.invitation==='failed'?'Dodano użytkownika, ale nie udało się wysłać zaproszenia. Użytkownik może skorzystać z opcji „Nie pamiętam hasła”.':'Dodano użytkownika.';
  } catch(error) {
    $('#user-status').textContent=error.message;
  } finally {
    button.disabled=false;
  }
};

$('#user-send-invite').onclick=async event=>{
  const button=event.currentTarget;
  const selected=editableUsers.find(user=>user.email===$('#user-picker').value);
  if (!selected||selected.archived) return;
  button.disabled=true;
  $('#user-status').textContent='Wysyłam zaproszenie na '+selected.email+'…';
  try {
    await api('/api/users/invite',{email:selected.email});
    $('#user-status').textContent='Wysłano zaproszenie na '+selected.email+'.';
  } catch(error) {
    $('#user-status').textContent=error.message;
  } finally {
    button.disabled=false;
  }
};

$('#user-archive').onclick=async event=>{
  const button=event.currentTarget;
  const selected=editableUsers.find(user=>user.email===$('#user-picker').value);
  if (!selected) return;
  const archived=!selected.archived;
  if (archived&&!confirm('Usunąć dostęp użytkownika „'+selected.name+'” do Lejka? Od bieżącego miesiąca osoba ta wypadnie z raportów. Wyniki wcześniejszych miesięcy zostaną w historii.')) return;
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
  const picked=managerScope.options.length?managerScope.value:detailParams.get('salon');
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

  $('#manager-preview-note').hidden=!readOnlyPreview;
  $('#manager-preview-note').textContent=(groupPreview?'Podgląd szefa grupy.':'Podgląd kierownika.')+' Możesz wypróbować pola formularza. Dane salonu nie zostaną zapisane.';
  $('#management-team-shortcut').hidden=readOnlyPreview||data.role!=='manager';
  labelPanel(view.role,group?(selected||view.dealerGroup):manager?(selected||view.salon):'',readOnlyPreview);
  $('#management-nav').setAttribute('aria-label',panelNames[view.role]);
  $('#performance-title').textContent=teamDashboard?'Realizacja planów salonów':'Wykonanie planu';
  $('#management-performance').textContent=teamDashboard?'Realizacja planów':'Wykonanie planu';
  $('#management-team').hidden=!teamDashboard;
  const team=teamDashboard?renderManagerDashboard(view):[];
  $('#admin').hidden=false;
  selectManagementView();
  const params=new URLSearchParams({role:data.role,powrot:'administracja'});
  if (multiple&&selected) params.set('salon',selected);
  const query='?'+params;
  $('#management-team-link').href='/zarzadzanie.html'+query+'#administracja';
  $('#management-team-link').textContent='Ustawienia planów';
  $('#salon-summary').hidden=!teamDashboard;
  if (teamDashboard) renderSalonSummary(view,team);
  historySalons=new Set(view.salons.map(({salon})=>salon));
  $('[data-history="management"]').reloadHistory();
  userEditor.hidden=false;
  renderUserEditor(view);
  $('#group-add-salon-block').hidden=!group;
  $('#manager-assignments').hidden=view.role!=='admin';
  if (view.role==='admin') renderManagerAssignments();
  $('#group-editor').hidden=view.role!=='admin';
  if (view.role==='admin') renderDealerGroups(view.groups);
  $('#absence-panel').hidden=false;
  const calendarEditor=$('#manager-calendar-editor');
  calendarEditor.hidden=view.role!=='manager'||data.role!=='manager'||!view.sellers.length;
  if (!calendarEditor.hidden) renderCalendar(calendarEditor,view.sellers,true);
  $('#lesson-editor').hidden=false;
  $('#team').textContent=view.sellers.filter(seller=>seller.accountStatus!=='inactive').length+' aktywnych handlowców';
  const reviews=$('#reviews');
  reviews.replaceChildren();
  const plannedRequests=(view.calendar??[]).filter(row=>row.status==='pending'&&view.sellers.some(seller=>seller.id===row.person));
  if (!view.approvals.length&&!(data.role==='manager'&&plannedRequests.length)) reviews.textContent='Brak zgłoszeń do rozpatrzenia.';
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
  if (data.role==='manager') for (const request of plannedRequests) {
    const card=document.createElement('article');
    const name=view.sellers.find(seller=>seller.id===request.person).name;
    card.textContent=name+' · '+calendarKinds[request.kind]+' · '+dateLabel(request.day,{day:'numeric',month:'long',year:'numeric'});
    for (const [action,label] of [['approve','Zatwierdź'],['reject','Odrzuć']]) {
      const button=document.createElement('button');
      button.textContent=label;
      button.onclick=()=>run(()=>api('/api/work-calendar',{...request,action}));
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
  if ($('#admin-lessons-block').open&&!$('#admin-lessons-block').hidden) loadLessonPacks();
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
const navigation=panelNavigation(()=>{
  if (!data||detailSeller) return;
  const manager=history.state?.managerPreviewSalon??'';
  const group=history.state?.groupPreviewName??'';
  if (data.role==='admin'&&(manager!==managerPreviewSalon||group!==groupPreviewName)) {
    managerPreviewSalon=manager;
    groupPreviewName=group;
    showView();
  } else if (data.role==='seller') selectSellerTab();
  else selectManagementView();
});

const historyPanels=[...document.querySelectorAll('[data-history]')];
const monthLabel=month=>dateLabel(month+'-01',{month:'long',year:'numeric'});
let historySalons=new Set();

function historyMetrics(items) {
  const grid=document.createElement('div');
  grid.className='history-metrics';
  for (const {label,actual,target} of items) {
    const cell=document.createElement('div');
    cell.className='pace-item';
    const name=document.createElement('span');
    name.textContent=label;
    const value=document.createElement('strong');
    value.textContent=actual+' / '+(target??'—');
    if (target>0) value.className=actual>=target?'ahead':'behind';
    cell.append(name,value);
    grid.append(cell);
  }
  return grid;
}

for (const panel of historyPanels) {
  const input=panel.querySelector('input');
  const status=panel.querySelector('.history-status');
  const results=panel.querySelector('.history-results');
  let revision=0;
  const load=async()=>{
    const request=++revision;
    const month=input.value;
    results.replaceChildren();
    status.textContent='';
    if (!month) return;
    if (!input.validity.valid || month>=data.today.slice(0,7)) {
      status.textContent='Wybierz zakończony miesiąc.';
      return;
    }
    status.textContent='Wczytywanie…';
    try {
      const response=await api('/api/salon-plans?month='+encodeURIComponent(month));
      if(request!==revision) return;
      status.textContent=monthLabel(month)+' · wykonanie / cel miesięczny';
      const plans=response.plans.filter(plan=>historySalons.has(plan.salon));
      for (const plan of plans) {
        const card=document.createElement('section');
        card.className='history-salon';
        const title=document.createElement('h3');
        title.textContent=plan.salon;
        card.append(title,historyMetrics(salonPlanMetrics.map((label,index)=>({
          label,actual:plan.actuals[index],target:plan.configured[index]?plan.targets[index]:null
        }))));
        results.append(card);
      }
      if (!plans.length) results.textContent='Brak wyników dla wybranych salonów.';
    } catch (error) {
      if (request===revision) status.textContent=error.message;
    }
  };
  input.addEventListener('change',load);
  panel.addEventListener('toggle',()=>{if(panel.open && !input.value){input.value=input.max;load();}});
  panel.reloadHistory=()=>{if(panel.open && input.value) load();};
}

async function loadReopenDays(seller) {
  const select=$('#reopen-day-date');
  const button=$('#reopen-day-form button');
  const status=$('#reopen-day-status');
  button.disabled=true;
  select.replaceChildren();
  try {
    const {days}=await api('/api/daily/reopen?person='+seller.id);
    select.replaceChildren(...days.map(day=>new Option(dateLabel(day),day)));
    if (!days.length && !status.textContent) status.textContent='Brak zatwierdzonych dni do odblokowania.';
    button.disabled=!days.length;
  } catch (error) {
    status.textContent=error.message;
  }
}

$('#reopen-day-form').onsubmit=async event=>{
  event.preventDefault();
  const seller=data.sellers.find(person=>String(person.id)===detailSeller&&person.accountStatus!=='inactive');
  const day=$('#reopen-day-date').value;
  const button=event.currentTarget.querySelector('button');
  const status=$('#reopen-day-status');
  if (!seller||!day||button.disabled||
      !confirm('Odblokować dzień '+dateLabel(day)+'? Wyniki z tego dnia wrócą do raportów po ponownym zatwierdzeniu.')) return;
  button.disabled=true;
  try {
    await api('/api/daily/reopen',{person:seller.id,day});
    status.textContent='Dzień odblokowany. Handlowiec może poprawić wpis i ponownie go zatwierdzić.';
    await refresh();
  } catch (error) {
    status.textContent=error.message;
    await loadReopenDays(seller);
  }
};

function sellerDetailUrl(person,from) {
  const params=new URLSearchParams({handlowiec:person,role:data.role,powrot:from});
  const scope=$('#manager-scope');
  if (!$('#manager-scope-bar').hidden&&scope.value) params.set('salon',scope.value);
  return '/daily.html?'+params;
}

function renderSellerDetail() {
  const section=$('#seller-detail');
  section.hidden=false;
  const team=detailParams.get('powrot')==='zespol'&&['manager','group'].includes(data.role);
  const params=new URLSearchParams({role:data.role});
  if (detailParams.get('salon')) params.set('salon',detailParams.get('salon'));
  if (team) params.set('osoba',detailSeller);
  const back=$('#seller-detail-return');
  back.textContent=team?'← Wróć do zespołu':data.role==='seller'?'← Wróć do panelu':'← Wróć do realizacji planów';
  back.href='/daily.html?'+params+(team?'#zespol':data.role==='seller'?'#dzisiaj':'#wykonanie');
  const seller=data.role!=='seller'&&data.sellers.find(person=>String(person.id)===detailSeller&&person.accountStatus!=='inactive');
  if (!seller) {
    $('#seller-detail-heading').textContent='Brak dostępu do szczegółów handlowca';
    return;
  }
  const [person]=renderManagerDashboard({...data,sellers:[seller]},true);
  labelPanel(data.role,seller.salon);
  $('#seller-detail-heading').textContent=seller.name+' · praca na lejku';
  $('#seller-detail-period').textContent=seller.salon+' · '+monthLabel(data.today.slice(0,7))+' · '+person.status;
  const tbody=$('#seller-detail-metrics');
  tbody.replaceChildren(...person.metrics.map(metric=>{
    const row=document.createElement('tr');
    const heading=document.createElement('th');
    heading.scope='row';
    heading.textContent=metric.label;
    row.append(heading);
    if (metric.goal>0) row.className=metric.delta<0?'detail-behind':'detail-ahead';
    for (const value of [metric.actual,metric.goal,metric.target,!(metric.goal>0)?null:
      metric.delta<0?'Brakuje '+(-metric.delta):metric.delta>0?'Nadwyżka '+metric.delta:'Zgodnie z tempem']) {
      const cell=document.createElement('td');
      cell.textContent=value??'—';
      row.append(cell);
    }
    return row;
  }));
  $('#seller-detail-table').hidden=false;
  const reopenForm=$('#reopen-day-form');
  reopenForm.hidden=data.role!=='manager'||seller.accountStatus==='inactive';
  if (!reopenForm.hidden) loadReopenDays(seller);
}

function showView() {
  $('#daily').hidden=true;
  $('#admin').hidden=true;
  $('#logo').hidden=true;
  if (detailSeller) {
    renderSellerDetail();
    return;
  }
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
  renderAdmin();
}
$('#group-preview-toggle').onclick=()=>{
  if (data?.role!=='admin') return;
  if (groupPreviewName) {
    navigation.go(history.state?.previewReturn??'',{groupPreviewName:''});
  } else {
    $('#manager-scope').value='';
    navigation.go('#wykonanie',{groupPreviewName:$('#group-preview-select').value,previewReturn:location.hash});
  }
};
$('#group-preview-select').onchange=event=>{
  if (!groupPreviewName) return;
  groupPreviewName=event.target.value;
  history.replaceState({...history.state,groupPreviewName},'');
  $('#manager-scope').value='';
  showView();
};
$('#manager-preview-toggle').onclick=()=>{
  if (data?.role!=='admin') return;
  if (managerPreviewSalon) {
    navigation.go(history.state?.previewReturn??'',{managerPreviewSalon:''});
  } else {
    navigation.go('#wykonanie',{managerPreviewSalon:$('#manager-preview-salon').value,previewReturn:location.hash});
  }
};
$('#manager-preview-salon').onchange=event=>{
  if (!managerPreviewSalon) return;
  managerPreviewSalon=event.target.value;
  history.replaceState({...history.state,managerPreviewSalon},'');
  showView();
};
$('#account-role').onchange=event=>{
  const previous=new URL(location.href);
  previous.searchParams.set('role',data.role);
  history.replaceState(history.state,'',previous);
  sessionStorage.setItem('lejek-active-role',event.target.value);
  location.assign('/daily.html?'+new URLSearchParams({role:event.target.value}));
};
let restoredNavigation=false;
async function refresh() {
  data=await api('/api/daily?month='+today.slice(0,7));
  const month=data.today.slice(0,7);
  const [year,number]=month.split('-').map(Number);
  for (const panel of historyPanels) panel.querySelector('input').max=monthStart(year,number-2).slice(0,7);
  $('#management-plan-period').textContent='Okres · '+monthLabel(month);

  const signedIn=$('#signed-in');
  signedIn.querySelector('strong').textContent=data.signedInAs??'';
  signedIn.hidden=!data.signedInAs;
  if (!detailSeller&&data.role!=='seller') {
    data.salonPerformance=await api('/api/salon-plans?month='+data.today.slice(0,7))
      .then(({plans})=>plans).catch(()=>null);
  }
  const roleSelect=$('#account-role');
  $('#account-role-bar').hidden=Boolean(detailSeller)||data.roles.length<2;
  roleSelect.replaceChildren(...data.roles.map(role=>new Option(panelNames[role],role)));
  roleSelect.value=data.role;
  sessionStorage.setItem('lejek-active-role',data.role);
  $('#load').textContent='';
  $('#display-date').textContent=dateLabel(data.today,{day:'numeric',month:'long',year:'numeric'});
  showView();
  if (!restoredNavigation) {
    restoredNavigation=true;
    const anchor=detailSeller&&location.hash==='#reopen-day-form'?'reopen-day-form'
      :location.hash==='#zespol'&&detailParams.has('osoba')?'zespol-handlowiec-'+detailParams.get('osoba'):null;
    navigation.restoreInitialPosition(anchor);
  }
}
async function run(operation,openCookie=false,keepEditDay=false) {
  if (busy) return;
  busy=true;
  const entryWasDisabled=$('#save').disabled;
  $('#save').disabled=$('#approve-day').disabled=true;
  try {
    await operation();
    if (!keepEditDay) editDay=null;
    busy=false;
    await refresh();
    if (openCookie) $('#cookie').open=true;
    if (data.role!=='seller') $('#load').textContent='Zapisano zmiany.';
  } catch(error) {
    $('#load').textContent=error.message;
    if(data?.role==='seller') {
      $('#status').textContent=error.message;
      $('#save').disabled=$('#approve-day').disabled=entryWasDisabled;
    }
  } finally {busy=false;}
}
$('#resolve').onclick=()=>{editDay=data.personal.missing[0];renderSeller();$('#rows .active-source input')?.focus();};
$('#entry').onsubmit=event=>{
  event.preventDefault();
  if(data?.role!=='seller'||busy||$('#save').disabled) return;
  const day=editDay??data.today;
  const draft=event.submitter!==$('#approve-day');
  if (!draft&&!confirm('Czy na pewno chcesz zatwierdzić dzień '+dateLabel(day)+'? Po zatwierdzeniu edycja wartości będzie zablokowana.')) return;
  const rows=sources.map((_,r)=>{
    const row=Array(11).fill(0);
    for (const [index] of columns) row[index]=Number(event.target.elements['v'+r+'_'+index].value);
    return row;
  });
  run(()=>api('/api/daily',{person:data.sellers[0].id,day,rows,draft}),!draft&&day===data.today,draft);
};
for (const button of document.querySelectorAll('[data-kind]')) button.onclick=()=>{
  run(()=>api('/api/day-exception',{person:data.sellers[0].id,day:editDay,kind:button.dataset.kind}));
};
$('#send-no-activity').onclick=async event=>{
  const button=event.currentTarget;
  const panel=$('#no-activity');
  if (busy||panel.hidden) return;
  const reason=$('#reason');
  if (!reason.value.trim()) {
    $('#status').textContent='Podaj powód dnia bez aktywności.';
    reason.focus();
    return;
  }
  button.disabled=true;
  try {
    await run(()=>api('/api/day-exception',{person:data.sellers[0].id,day:panel.dataset.day,kind:'pending',reason:reason.value}),false,true);
  } finally {
    button.disabled=false;
  }
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
let lessonPackRevision=0;
async function loadLessonPacks() {
  const revision=++lessonPackRevision;
  const salon=$('#lesson-salon').value;
  const container=$('#lesson-packs');
  container.textContent=salon?'Wczytywanie paczek…':'Wybierz salon.';
  if (!salon) return;
  const path='/api/lesson-packs?salon='+encodeURIComponent(salon);
  try {
    const {packs}=await api(path);
    if (revision!==lessonPackRevision) return;
    container.replaceChildren();
    if (!packs.length) container.textContent='Brak zapisanych paczek.';
    for (const pack of packs) {
      const row=document.createElement('fieldset');
      const name=document.createElement('legend');
      name.textContent=pack.name;
      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.className='secondary';
      toggle.textContent=pack.active?'Wyłącz paczkę':'Włącz paczkę';
      toggle.onclick=async()=>{
        toggle.disabled=true;
        try {
          await api('/api/lesson-packs',{salon,id:pack.id,active:!pack.active});
          await loadLessonPacks();
        } catch (error) {
          $('#lesson-status').textContent=error.message;
          toggle.disabled=false;
        }
      };
      const preview=document.createElement('details');
      const summary=document.createElement('summary');
      summary.textContent=pack.count+' pytań lub lekcji · '+(pack.active?'Wyświetlana':'Wyłączona');
      const list=document.createElement('ol');
      preview.append(summary,list);
      preview.ontoggle=async()=>{
        if (!preview.open||list.children.length) return;
        try {
          const {lessons}=await api(path+'&id='+pack.id);
          list.replaceChildren(...lessons.map(lesson=>{
            const item=document.createElement('li');
            item.textContent=(lesson.question?lesson.question+' Odpowiedź: ':lesson.title+' · ')+lesson.topic;
            return item;
          }));
        } catch (error) {
          $('#lesson-status').textContent=error.message;
        }
      };
      row.append(name,preview,toggle);
      container.append(row);
    }
  } catch (error) {
    if (revision===lessonPackRevision) container.textContent=error.message;
  }
}
$('#lesson-salon').addEventListener('change',loadLessonPacks);
$('#admin-lessons-block').addEventListener('toggle',event=>{
  if (event.currentTarget.open) loadLessonPacks();
});
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
  status.textContent='Analizuję dokument i wybieram zagadnienia do nauki…';
  try {
    const encoded=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(',')[1]);
      reader.onerror=()=>reject(new Error('Nie udało się otworzyć pliku.'));
      reader.readAsDataURL(file);
    });
    const result=await api('/api/lesson-import',{salon:$('#lesson-salon').value,filename:file.name,file:encoded,mode:'pack'});
    if (!Number.isSafeInteger(result.count)||result.count<1)
      throw new Error('Nie udało się potwierdzić importu. Sprawdź listę paczek po odświeżeniu strony.');
    $('#lesson-file').value='';
    status.textContent='Zapisano '+result.count+' pytań w paczce „'+file.name+'”. Sprawdź treść i włącz paczkę, gdy będzie gotowa.';
    await loadLessonPacks();
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
    lessonDraftList.replaceChildren();
    status.textContent='Zapisano lekcje ręczne i włączono ich paczkę.';
    await loadLessonPacks();
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
