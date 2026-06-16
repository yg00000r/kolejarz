// Template-based message catalog derived from komunikaty.md
// Placeholders use {{key}} syntax; renderTemplate() substitutes them.

export type CatalogSection = 'basic' | 'partA' | 'partB' | 'partC';

export type CatalogEntry = {
  id: string;
  section: CatalogSection;
  title: string;
  titleEn?: string;
  whenToUse: string;
  template: string;
  templateEn?: string;
  variants?: CatalogVariant[];
  repeatNote?: string;
};

export type CatalogVariant = {
  condition: string;
  template: string;
  templateEn?: string;
};

export const MESSAGE_CATALOG: CatalogEntry[] = [
  // ═══════════ BASIC (1-5 + gastro + transit) ═══════════

  {
    id: 'p_start',
    section: 'basic',
    title: 'Powitalny — skrócony startowy',
    titleEn: 'Welcome — short starter',
    whenToUse: 'Pomiędzy stacjami w mieście, w którym pociąg rozpoczyna bieg',
    template: 'Następna stacja {{nextStation}}.',
    templateEn: 'Next station {{nextStation}}.',
    variants: [
      {
        condition: 'delayed',
        template: 'Następna stacja {{nextStation}}.\n\nPrzepraszamy za opóźnienie pociągu.',
        templateEn: 'Next station {{nextStation}}.\n\nWe would like to apologize for the delay.',
      },
      {
        condition: 'gastro',
        template: 'Następna stacja {{nextStation}}.\n\n{{gastroText}}',
      },
      {
        condition: 'delayed+gastro',
        template: 'Następna stacja {{nextStation}}.\n\nPrzepraszamy za opóźnienie pociągu.\n\n{{gastroText}}',
      },
    ],
  },

  {
    id: 'p_rozszerzony',
    section: 'basic',
    title: 'Powitalny — rozszerzony',
    titleEn: 'Welcome — extended',
    whenToUse: 'Za miastem startowym, za miastem wojewódzkim, po przekroczeniu granicy',
    template: '{{greeting}}\n\nWitamy w pociągu {{trainDesc}} ze stacji {{stationFrom}} do stacji {{stationTo}}{{viaText}}.\n\nNastępna stacja {{nextStation}}.\n\n{{delayBlock}}W trosce o Państwa komfort i bezpieczeństwo, prosimy o zapoznanie się z informacjami zamieszczonymi w wagonach. Drużyna konduktorska pozostaje do Państwa dyspozycji i służy pomocą w trakcie całej podróży. Przedział konduktorski znajduje się w wagonie numer {{serviceWagon}}.\n\n{{gastroText}}',
  },

  {
    id: 'p_skrocony',
    section: 'basic',
    title: 'Powitalny — skrócony',
    titleEn: 'Welcome — short',
    whenToUse: 'Za miejscowością niewojewódzką',
    template: 'Następna stacja {{nextStation}}.\n\n{{delayBlock}}{{gastroText}}',
  },

  {
    id: 'pp_pozegnalny',
    section: 'basic',
    title: 'Powitalno-pożegnalny (tranzytowy)',
    titleEn: 'Welcome-farewell (transit)',
    whenToUse: 'Pomiędzy stacjami w mieście tranzytowym lub czas przejazdu ≤7 min',
    template: '{{gastroText}}Zbliżamy się do stacji {{stationName}}.\n\n{{delayApology}}{{longStopText}}Osoby wysiadające prosimy o zabranie swoich rzeczy oraz zachowanie ostrożności.\n\nDziękujemy za podróż z PKP Intercity.\n\n{{transferText}}Prosimy o zwrócenie uwagi na informacje stacyjne.\n\n{{detachText}}',
  },

  {
    id: 'pozegnalny',
    section: 'basic',
    title: 'Pożegnalny',
    titleEn: 'Farewell',
    whenToUse: 'Przed każdą stacją pośrednią lub docelową',
    template: 'Zbliżamy się do stacji {{stationName}}.{{finalSuffix}}\n\n{{delayApology}}Osoby wysiadające prosimy o zabranie swoich rzeczy oraz o zachowanie ostrożności.\n\nDziękujemy za podróż z PKP Intercity.\n\n{{transferText}}Prosimy o zwrócenie uwagi na informacje stacyjne.',
  },

  // ═══════════ PART A — opóźnienia ═══════════

  {
    id: 'a1_opoznienie',
    section: 'partA',
    title: 'A1 — Opóźnienie / zmiana czasu opóźnienia',
    whenToUse: 'Po uzyskaniu informacji o powstaniu lub zmianie czasu opóźnienia',
    template: 'Informujemy, że w związku z {{delayReason}} pociąg jest opóźniony o {{delayMinutes}} minut. Czas opóźnienia może ulec zmianie. Przepraszamy za opóźnienie. Osoby przesiadające się do innych pociągów prosimy o zgłaszanie tego zamiaru drużynie konduktorskiej.',
    variants: [
      {
        condition: 'onSchedule',
        template: 'Informujemy, że pociąg jedzie zgodnie z rozkładem jazdy.',
      },
    ],
  },

  {
    id: 'a2_semafor',
    section: 'partA',
    title: 'A2 — Zatrzymanie przed semaforem / na szlaku',
    whenToUse: 'Po zatrzymaniu pociągu (postój ≥5 min)',
    template: 'Informujemy, że zatrzymanie pociągu nastąpiło z przyczyn technicznych / z powodu oczekiwania na wolny tor. Po uzyskaniu zgody na odjazd, pociąg niezwłocznie ruszy w dalszą drogę. Przepraszamy za powstałe utrudnienia.',
  },

  {
    id: 'a3_skomunikowanie_oczekiwanie',
    section: 'partA',
    title: 'A3 — Skomunikowanie (oczekiwanie na inny pociąg)',
    whenToUse: 'Gdy pociąg oczekuje na skomunikowanie',
    template: 'Informujemy, że pociąg oczekuje na przyjazd pociągu {{otherTrainDesc}} ze stacji {{otherTrainFrom}}. Po przejściu osób przesiadających się, pociąg ruszy w dalszą drogę. Przepraszamy za powstałe utrudnienia.',
  },

  {
    id: 'a4_skomunikowanie_info',
    section: 'partA',
    title: 'A4 — Informacja o skomunikowaniu',
    whenToUse: 'Po zebraniu informacji o potrzebie skomunikowania',
    template: 'Prosimy o uwagę!\n\nPociąg {{trainDesc}} do stacji {{trainEnd}}, przez stacje: {{trainVia}}, będzie oczekiwał na Państwa na stacji {{waitingStation}}. Prosimy o zwrócenie uwagi na informacje stacyjne.',
    repeatNote: 'Komunikat należy powtórzyć.',
    variants: [
      {
        condition: 'refused',
        template: 'Prosimy o uwagę!\n\nPociąg {{trainDesc}} do stacji {{trainEnd}}, przez stacje: {{trainVia}}, nie będzie oczekiwał na przyjazd naszego pociągu. Przepraszamy za niedogodności. Dodatkowych informacji udzieli Państwu drużyna konduktorska. Przedział konduktorski znajduje się w wagonie numer {{serviceWagon}}.',
      },
    ],
  },

  // ═══════════ PART B — wypadki, awarie, sytuacje nadzwyczajne ═══════════

  {
    id: 'b1_nieplanowy_postoj_1',
    section: 'partB',
    title: 'B1 #1 — Nieplanowy postój (przyczyna nieustalona)',
    whenToUse: 'Zaraz po nieplanowanym zatrzymaniu, przyczyna i opóźnienie nieustalone',
    template: 'Informujemy, że nastąpiła nieprzewidziana przerwa w ruchu. Przepraszamy za niedogodności i prosimy o wyrozumiałość. W chwili obecnej ustalamy przyczyny nieplanowego postoju pociągu.\n\nZe względów bezpieczeństwa, otwieranie drzwi wyjściowych oraz opuszczanie pociągu jest zabronione.',
  },

  {
    id: 'b1_nieplanowy_postoj_2',
    section: 'partB',
    title: 'B1 #2 — Nieplanowy postój (nadal nieustalona)',
    whenToUse: 'Automatycznie po 15 min lub ręcznie, gdy przyczyna nadal nieustalona',
    template: 'Nadal trwa ustalanie przyczyny przerwy w ruchu oraz wielkości opóźnienia. Przepraszamy za niedogodności i prosimy o wyrozumiałość. Szczegółowy komunikat zostanie wygłoszony niezwłocznie po ustaleniu przyczyny zatrzymania oraz przewidywanej wielkości opóźnienia.\n\nZe względów bezpieczeństwa, otwieranie drzwi wyjściowych oraz opuszczanie pociągu jest zabronione.',
  },

  {
    id: 'b1_nieplanowy_postoj_3',
    section: 'partB',
    title: 'B1 #3 — Nieplanowy postój (przyczyna i opóźnienie ustalone)',
    whenToUse: 'Gdy przyczyna i przewidywana wielkość opóźnienia są ustalone',
    template: 'Informujemy, że z powodu {{delayReason}} pociąg odjedzie z opóźnieniem około {{delayMinutes}} minut. O zmianie opóźnienia będziemy informować na bieżąco. Przepraszamy za utrudnienia.\n\nOsoby przesiadające się do innych pociągów prosimy o zgłaszanie tego zamiaru drużynie konduktorskiej. Przedział konduktorski znajduje się w wagonie numer {{serviceWagon}}.\n\nZe względów bezpieczeństwa, otwieranie drzwi wyjściowych oraz opuszczanie pociągu jest zabronione.',
    variants: [
      {
        condition: 'over60min',
        template: 'Informujemy, że z powodu {{delayReason}} pociąg odjedzie z opóźnieniem około {{delayMinutes}} minut. O zmianie opóźnienia będziemy informować na bieżąco. Przepraszamy za utrudnienia.\n\nOsoby przesiadające się do innych pociągów prosimy o zgłaszanie tego zamiaru drużynie konduktorskiej. Przedział konduktorski znajduje się w wagonie numer {{serviceWagon}}.\n\nW związku z przewidywanym czasem postoju przekraczającym 60 minut, mają Państwo prawo do rezygnacji z dalszej podróży. Szczegółowych informacji o zasadach zwrotu należności za bilety udzieli Państwu drużyna konduktorska lub pracownicy punktów obsługi klienta na stacjach.\n\nZe względów bezpieczeństwa, otwieranie drzwi wyjściowych oraz opuszczanie pociągu jest zabronione.',
      },
    ],
  },

  {
    id: 'b2_ewakuacja',
    section: 'partB',
    title: 'B2 — Ewakuacja pasażerów',
    whenToUse: 'Po podjęciu decyzji o ewakuacji podróżnych',
    template: 'Prosimy o uwagę!\n\nZ przyczyn bezpieczeństwa zapadła decyzja o ewakuacji pociągu. Prosimy o zachowanie spokoju i wykonywanie poleceń drużyny konduktorskiej oraz służb ratunkowych. Prosimy o zabranie bagażu podręcznego i opuszczenie pociągu wskazanymi wyjściami.',
  },

  {
    id: 'b3_hamulec',
    section: 'partB',
    title: 'B3 — Nieuzasadnione użycie hamulca bezpieczeństwa',
    whenToUse: 'Po nieuzasadnionym użyciu hamulca bezpieczeństwa',
    template: 'Informujemy, że zatrzymanie pociągu nastąpiło w wyniku nieuzasadnionego użycia hamulca bezpieczeństwa. Przypominamy, że za nieuzasadnione zatrzymanie pociągu grozi kara pieniężna. Dalsza jazda nastąpi po sprawdzeniu urządzeń pociągu.',
  },

  {
    id: 'b4_klimatyzacja',
    section: 'partB',
    title: 'B4 — Awaria klimatyzacji / ogrzewania',
    whenToUse: 'W przypadku awarii klimatyzacji lub ogrzewania',
    template: 'Informujemy, że w wagonie numer {{wagonNumber}} wystąpiła awaria układu klimatyzacji / ogrzewania. Przepraszamy za niedogodności. Podróżnych z tego wagonu prosimy o przejście do wagonu numer {{targetWagon}}, gdzie znajdują się wolne miejsca. Drużyna konduktorska służy Państwu pomocą.',
  },

  {
    id: 'b5_sip',
    section: 'partB',
    title: 'B5 — Awaria systemu informacji pasażerskiej (SIP)',
    whenToUse: 'W przypadku awarii automatycznych zapowiedzi lub wyświetlaczy',
    template: 'Informujemy, że z przyczyn technicznych system informacji pasażerskiej w pociągu jest nieaktywny. Informacje o stacjach oraz czasie przejazdu będą podawane przez drużynę konduktorską. Przepraszamy za utrudnienia.',
  },

  {
    id: 'b6_agresja',
    section: 'partB',
    title: 'B6 — Agresywne zachowanie',
    whenToUse: 'W sytuacji zakłócania porządku w pociągu',
    template: 'Prosimy o zachowanie spokoju i kulturalne zachowanie wobec współpasażerów oraz drużyny konduktorskiej. Informujemy, że w przypadku dalszego zakłócania porządku, na najbliższej stacji zostaną wezwane służby ochrony kolei lub policja, co może skutkować usunięciem z pociągu.',
  },

  {
    id: 'b7_pomoc_medyczna',
    section: 'partB',
    title: 'B7 — Pomoc medyczna',
    whenToUse: 'W celu wezwania pomocy medycznej spośród podróżnych',
    template: 'Prosimy o uwagę! Czy w pociągu znajduje się lekarz, ratownik medyczny lub osoba przeszkolona w udzielaniu pierwszej pomocy? Jeśli tak, prosimy o pilne zgłoszenie się do drużyny konduktorskiej w wagonie numer {{serviceWagon}}. Dziękujemy.',
  },

  {
    id: 'b8_bagaz',
    section: 'partB',
    title: 'B8 — Pozostawiony bagaż / przedmiot',
    whenToUse: 'W przypadku znalezienia przedmiotu niewiadomego pochodzenia',
    template: 'Prosimy o uwagę! W wagonie numer {{wagonNumber}} znaleziono pozostawiony bagaż / przedmiot. Prosimy właściciela o niezwłoczne zgłoszenie się do drużyny konduktorskiej. Jednocześnie przypominamy o konieczności nadzoru nad własnym bagażem podczas całej podróży.',
  },

  {
    id: 'b9_zagubienie',
    section: 'partB',
    title: 'B9 — Zagubienie osoby / dziecka',
    whenToUse: 'Na prośbę opiekuna lub po znalezieniu zagubionej osoby',
    template: 'Prosimy o uwagę! W pociągu poszukiwany jest / znajduje się {{personDesc}}. Opiekuna lub osoby posiadające informacje prosimy o pilny kontakt z drużyną konduktorską w wagonie numer {{serviceWagon}}.',
  },

  {
    id: 'b10_palenie',
    section: 'partB',
    title: 'B10 — Palenie tytoniu i e-papierosów',
    whenToUse: 'Komunikat przypominający o zakazie palenia',
    template: 'Przypominamy, że w całym pociągu, w tym w toaletach oraz przedsionkach wagonów, obowiązuje całkowity zakaz palenia tytoniu oraz używania e-papierosów. Nieprzestrzeganie zakazu grozi karą pieniężną oraz interwencją służb porządkowych.',
  },

  // ═══════════ PART C — pozostałe ═══════════

  {
    id: 'c1_krotkie_perony',
    section: 'partC',
    title: 'C1 — Krótkie perony',
    whenToUse: 'Gdy ostatnie wagony zatrzymają się poza krawędzią peronu',
    template: 'Prosimy o uwagę! Informujemy, że na stacji {{stationName}} ostatnie wagony w składzie pociągu, oznaczone numerami {{wagonsOutside}}, zatrzymają się poza peronem. Podróżnych wysiadających na tej stacji prosimy o przejście do wagonów numer {{wagonsInside}}, znajdujących się bliżej lokomotywy, z których możliwe będzie bezpieczne opuszczenie pociągu. Przepraszamy za niedogodności i prosimy o zachowanie ostrożności podczas wysiadania.',
  },

  {
    id: 'c2_postoj_techniczny',
    section: 'partC',
    title: 'C2 — Postój techniczny',
    whenToUse: 'Postój uwzględniony w rozkładzie jazdy',
    template: 'Informujemy, że obecny postój techniczny pociągu został uwzględniony w rozkładzie jazdy i nie powinien spowodować/zwiększyć opóźnienia. Ze względów bezpieczeństwa, otwieranie drzwi wyjściowych oraz opuszczanie pociągu jest zabronione.',
  },

  {
    id: 'c3_sklad_zastepczy',
    section: 'partC',
    title: 'C3 — Skład zastępczy zamiast EZT',
    whenToUse: 'Gdy pociąg został zestawiony z wagonów klasycznych zamiast EZT',
    template: 'Informujemy, że pociąg zestawiony jest dziś z wagonów klasycznych.',
    variants: [
      {
        condition: 'replacementSeats',
        template: 'Informujemy, że pociąg zestawiony jest dziś z wagonów klasycznych. Prosimy o zwrócenie uwagi na informacje dotyczące wyznaczenia miejsc zastępczych. Dodatkowych informacji udzieli drużyna konduktorska. Przepraszamy za niedogodności.',
      },
      {
        condition: 'ed250',
        template: 'Informujemy, że pociąg zestawiony jest dziś z wagonów klasycznych. Prosimy o zwrócenie uwagi na informacje dotyczące wyznaczenia miejsc zastępczych. Dodatkowych informacji udzieli drużyna konduktorska. Przepraszamy za niedogodności.\n\nRównocześnie informujemy, że mogą Państwo ubiegać się o rekompensatę, w drodze reklamacji. Szczegółowe informacje dotyczące możliwości złożenia reklamacji dostępne są w przedsionkach wagonów i na stronie: www.intercity.pl.',
      },
    ],
  },

  {
    id: 'c4_zakazy',
    section: 'partC',
    title: 'C4 — Nieprzestrzeganie zakazów',
    whenToUse: 'Przypomnienie o zakazie palenia lub spożywania alkoholu',
    template: 'Przypominamy, że w pociągu obowiązuje całkowity zakaz palenia wyrobów tytoniowych i papierosów elektronicznych.',
    variants: [
      {
        condition: 'emergencyStop',
        template: 'Przypominamy, że w pociągu obowiązuje całkowity zakaz palenia wyrobów tytoniowych i papierosów elektronicznych. Niezastosowanie się do zakazu może spowodować awaryjne zatrzymanie pociągu.',
      },
      {
        condition: 'alcohol',
        template: 'Informujemy, że alkohol zakupiony w strefie gastronomicznej, można tylko tam spożywać. W pociągu poza strefą gastronomiczną obowiązuje zakaz spożycia alkoholu. Niezastosowanie się do zakazu spowoduje konieczność interwencji służb porządkowych.',
      },
    ],
  },

  {
    id: 'c5_nierownomierne',
    section: 'partC',
    title: 'C5 — Nierównomierne rozmieszczenie podróżnych',
    whenToUse: 'Gdy wolne miejsca dostępne w innych wagonach',
    template: 'Informujemy, że wolne miejsca siedzące są dostępne w wagonie/wagonach numer {{freeWagons}}, który znajduje się / które znajdują się w {{trainSection}} części pociągu.',
  },

  {
    id: 'c6_toalety',
    section: 'partC',
    title: 'C6 — Zamknięcie toalet',
    whenToUse: 'Gdy toalety nieczynne na odcinku trasy',
    template: 'Informujemy, że na odcinku {{segmentFrom}} – {{segmentTo}} w pociągu / wagonach numer {{wagonNumber}} nie będzie możliwości skorzystania z toalet. Przepraszamy za niedogodności.',
  },
];

// ─── Template rendering ──────────────────────────────────────────────────────

export function renderTemplate(
  template: string,
  ctx: Record<string, string>,
): string {
  let result = template.replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] ?? '');
  // Clean up consecutive newlines from empty blocks
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

export function findCatalogEntry(id: string): CatalogEntry | undefined {
  return MESSAGE_CATALOG.find(e => e.id === id);
}

export function findVariant(entry: CatalogEntry, condition: string): CatalogVariant | undefined {
  return entry.variants?.find(v => v.condition === condition);
}
