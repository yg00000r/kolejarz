// ─── Kody zniżek handlowych ───────────────────────────────────────────────────

export type DiscountCode = {
  kod: string;
  opis: string;
  znizka: string;
  uprawniony: string | null;
};

export const KODY_ZNIZEK: DiscountCode[] = [
  { kod: '1',  opis: '---',      znizka: 'N',        uprawniony: null },
  { kod: '35', opis: 'MKZ FIP',  znizka: '50%',      uprawniony: 'Posiadacz Karty Zniżek FIP – koleje obce' },
  { kod: '36', opis: 'SENIOR',   znizka: '30%',      uprawniony: 'Osoba pow. 60 r.ż. w ofercie Bilet Seniora' },
  { kod: '40', opis: 'PRACOWN',  znizka: 'ryczałt',  uprawniony: 'Pracownik / stypendysta kolejowy' },
  { kod: '41', opis: 'EMERYT',   znizka: 'ryczałt',  uprawniony: 'Emeryt / rencista kolejowy' },
  { kod: '42', opis: 'R.PRAC.',  znizka: '80%',      uprawniony: 'Rodzina pracownika kolejowego' },
  { kod: '51', opis: 'UMOWA',    znizka: '50%',      uprawniony: 'Posiadacz legitymacji H-1096' },
  { kod: '64', opis: 'GRUPA',    znizka: '0%',       uprawniony: 'Osoba bez ulgi ustawowej w ofercie Bilet Grupowy' },
  { kod: '65', opis: 'RODZINA',  znizka: '30%',      uprawniony: 'Osoba bez ulgi ustawowej w ofercie Bilet Rodzinny' },
];

// ─── Oferty ───────────────────────────────────────────────────────────────────

export type Procedure = { sytuacja: string; akcja: string };
export type Offer = {
  nazwa: string;
  opis?: string;
  klasy?: string;
  kategorie?: string;
  uwagi?: string;
  procedures: Procedure[];
};

export const OFERTY: Offer[] = [
  {
    nazwa: 'Bilet jednorazowy bez oferty',
    klasy: '1, 2',
    kategorie: 'TLK · IC · EIC · EIP',
    procedures: [
      {
        sytuacja: 'Brak ważnego dokumentu do ulgi → zmiana na normalny',
        akcja: 'Dopłata (of. 202/204/206): różnica między ceną biletu normalnego a okazanego + poświadczenie nr 22.',
      },
      {
        sytuacja: 'Brak ważnego dokumentu do ulgi → zmiana na inną ulgę',
        akcja: 'Nowy bilet wg uprawnień + poświadczenie nr 14 o niewykorzystaniu starego biletu.',
      },
      {
        sytuacja: 'Zmiana klasy 2→1',
        akcja: 'Dopłata do kl. 1 (of. 101/102/103): różnica między ceną normalną na kl. 1 a kl. 2.',
      },
      {
        sytuacja: 'Zmiana klasy 1→2',
        akcja: 'Poświadczenie nr 19 o częściowym niewykorzystaniu.',
      },
      {
        sytuacja: 'Przejazd poza stację przeznaczenia — ten sam cennik',
        akcja: 'Dopłata (of. 202/204/206): różnica między ceną od stacji wyjazdu do nowej a ceną okazanego biletu.',
      },
      {
        sytuacja: 'Przejazd poza stację przeznaczenia — tańszy cennik',
        akcja: 'Dopłata: różnica między nową dłuższą trasą wg tańszego cennika a starą trasą wg tańszego.',
      },
      {
        sytuacja: 'Przejazd poza stację przeznaczenia — droższy cennik',
        akcja: 'Dopłata 1 (wg tańszego cennika do nowej stacji) + dopłata 2 (różnica cenników na przedłużonym odcinku).',
      },
    ],
  },
  {
    nazwa: 'Bilet Seniora',
    opis: '30% taniej dla osób, które ukończyły 60 lat',
    klasy: '1, 2',
    kategorie: 'TLK · IC · EIC · EIP',
    uwagi: 'Należy wybrać ofertę Bilet Seniora jako ulgę (kod 36).',
    procedures: [
      {
        sytuacja: 'Brak uprawnień (pasażer nie ma 60 lat)',
        akcja: 'Nowy bilet wg indywidualnych uprawnień + poświadczenie nr 11 o niewykorzystaniu.',
      },
      {
        sytuacja: 'Zmiana klasy 2→1',
        akcja: 'Dopłata do kl. 1 (of. 101/102/103): różnica ceny wg oferty na kl. 1 i kl. 2.',
      },
      {
        sytuacja: 'Zmiana klasy 1→2',
        akcja: 'Poświadczenie nr 19.',
      },
    ],
  },
  {
    nazwa: 'Promo',
    opis: 'Limitowane pule biletów z niższą ceną',
    klasy: '1, 2',
    kategorie: 'TLK · IC · EIC · EIP',
    uwagi: 'Wyłączenia: WL, Bc. Poziomy I–IX (kody K, F, J, E, H, G, C, D, B).',
    procedures: [
      {
        sytuacja: 'Zmiana klasy',
        akcja: 'Nowy bilet wg indywidualnych uprawnień + poświadczenie nr 11.',
      },
      {
        sytuacja: 'Brak dokumentu do ulgi',
        akcja: 'Dopłata (of. 290–255 zależnie od poziomu Promo) z różnicy cen + poświadczenie nr 22.',
      },
    ],
  },
  {
    nazwa: 'Duża Rodzina',
    opis: '30% taniej przy wspólnym przejeździe min. 2 osób z Kartą Dużej Rodziny',
    klasy: '1, 2',
    kategorie: 'TLK · IC · EIC · EIP',
    procedures: [
      {
        sytuacja: 'Brak dokumentu KDR',
        akcja: 'Nowy bilet wg indywidualnych uprawnień + poświadczenie nr 11.',
      },
      {
        sytuacja: 'Brak dokumentu ulgi ustawowej',
        akcja: 'Dopłata (of. 215/216/217) z poświadczeniem nr 22.',
      },
    ],
  },
  {
    nazwa: 'Bilet Rodzinny',
    opis: '30% taniej przy wspólnym przejeździe 2–5 osób, w tym min. 1 dziecko do 16 lat',
    klasy: '1, 2',
    kategorie: 'EIC · EIP',
    procedures: [
      {
        sytuacja: 'Brak dziecka do 16 lat',
        akcja: 'Nowy bilet wg indywidualnych uprawnień + poświadczenie nr 11.',
      },
      {
        sytuacja: 'Zmiana klasy 2→1',
        akcja: 'Dopłata (of. --/102/103): różnica między ceną bazową na kl. 1 a kl. 2.',
      },
    ],
  },
  {
    nazwa: 'Bilet Grupowy',
    opis: 'Zniżki dla grup od 11 osób. Na każde 15 płacących — 1 bezpłatnie (max 4).',
    kategorie: 'TLK · IC · EIC · EIP',
    uwagi: 'Dla osoby bez ulgi: kod 64 (0%). Wyłącznie z kartą przejazdu grupy.',
    procedures: [
      {
        sytuacja: 'TLK / IC',
        akcja: '30% taniej.',
      },
      {
        sytuacja: 'EIC / EIP — pon., czw., sob.',
        akcja: '20% taniej.',
      },
      {
        sytuacja: 'EIC / EIP — pt., ndz.',
        akcja: '15% taniej.',
      },
    ],
  },
  {
    nazwa: 'Bilety Odcinkowe',
    opis: 'Nieograniczona liczba przejazdów na danym odcinku (do 240 km)',
    klasy: '1, 2',
    kategorie: 'TLK · IC',
    uwagi: 'Wyłączenia: WL, Bc. Rodzaje: tygodniowy, miesięczny, kwartalny.',
    procedures: [
      {
        sytuacja: 'Zmiana klasy na wyższą',
        akcja: 'Dopłata do kl. 1 (of. 101/--/--) dla biletów normalnych i większości ulg.',
      },
      {
        sytuacja: 'Przejazd poza stacje TLK/IC',
        akcja: 'Dopłata (of. 202/--/--) za różnicę relacji.',
      },
    ],
  },
  {
    nazwa: 'Multiprzejazd / Multiprzejazd Max',
    opis: 'Nieograniczona liczba przejazdów od 00:00 we wtorek do 24:00 w czwartek',
    klasy: '1, 2',
    uwagi: 'Multiprzejazd: TLK, IC. Multiprzejazd Max: TLK, IC, EIC, EIP.',
    procedures: [
      {
        sytuacja: 'Zmiana klasy na 1',
        akcja: 'Dopłata (of. 149 / of. 189): różnica cen między Multiprzejazd na kl. 1 i kl. 2.',
      },
      {
        sytuacja: 'Dopłata do EIP w Multiprzejazd Max',
        akcja: 'Dopłata do poc. EIP: 10 zł (of. --/--/140).',
      },
    ],
  },
];

// ─── Kody ulg ustawowych ──────────────────────────────────────────────────────

export const KODY_ULGI_USTAWOWE: DiscountCode[] = [
  { kod: '57',  opis: 'KDR-J',    znizka: '37%',  uprawniony: 'Posiadacz Karty Dużej Rodziny' },
  { kod: '63',  opis: 'DZ.OPOZ',  znizka: '51%',  uprawniony: 'Działacz opozycji / osoba represjonowana' },
  { kod: '67',  opis: 'KOMB.51',  znizka: '51%',  uprawniony: 'Kombatant / kombatant-inwalida / Korpus Weteranów Walk' },
  { kod: '71',  opis: 'DZ/UCZ',   znizka: '37%',  uprawniony: 'Dziecko od 4 r.ż. / uczeń' },
  { kod: '73',  opis: 'ŻOŁN',     znizka: '78%',  uprawniony: 'Żołnierz niezawodowy' },
  { kod: '74',  opis: 'I/E/W',    znizka: '37%',  uprawniony: 'Weteran poszkodowany [kl. 2] / OzN I gr. / emeryt / rencista' },
  { kod: '75',  opis: 'NIEWID.',   znizka: '37%',  uprawniony: 'OzN niewidoma II gr. / cywilna niewidoma II gr.' },
  { kod: '77',  opis: 'BEZPŁ',    znizka: '100%', uprawniony: 'Dziecko do lat 4 / funkcjonariusz podczas czynności' },
  { kod: '78',  opis: 'DN/OP',    znizka: '78%',  uprawniony: 'Dziecko/student OzN / opiekun — w określonych relacjach' },
  { kod: '79',  opis: 'PRZEWOD',  znizka: '95%',  uprawniony: 'Opiekun OzN I gr. / przewodnik osoby niewidomej' },
  { kod: '82',  opis: 'IW',       znizka: '37%',  uprawniony: 'Inwalida wojenny lub wojskowy / kombatant-inwalida' },
  { kod: '83',  opis: 'IW1',      znizka: '78%',  uprawniony: 'Inwalida wojenny lub wojskowy I gr. / kombatant-inwalida I gr.' },
  { kod: '84',  opis: 'P/IW1',    znizka: '95%',  uprawniony: 'Opiekun inwalidy I gr. / opiekun kombatanta I gr.' },
  { kod: '85',  opis: 'WETERAN',  znizka: '37%',  uprawniony: 'Weteran poszkodowany [kl. 1]' },
  { kod: '87',  opis: 'CYW/N',    znizka: '78%',  uprawniony: 'Cywilna niewidoma ofiara działań wojennych I gr.' },
  { kod: '88',  opis: 'K.POL',    znizka: '37%',  uprawniony: 'Posiadacz Karty Polaka' },
  { kod: '98',  opis: 'NIEWID1',  znizka: '51%',  uprawniony: 'OzN niewidoma I gr.' },
  { kod: '99',  opis: 'STU/DOK',  znizka: '51%',  uprawniony: 'Student / doktorant' },
];

// ─── Ulgi ustawowe ogólne ─────────────────────────────────────────────────────

export type UlgaUstawowa = {
  grupa: string;
  znizka_jednorazowa: string;
  znizka_miesieczna?: string;
  dokument?: string;
  uwagi?: string;
};

export const ULGI_USTAWOWE: UlgaUstawowa[] = [
  {
    grupa: 'Dziecko do lat 4',
    znizka_jednorazowa: '100% (kod 77)',
    dokument: 'Dokument stwierdzający wiek.',
  },
  {
    grupa: 'Dzieci (4+), uczniowie (do 24 r.ż.), uczący się j. polskiego (do 18 r.ż.)',
    znizka_jednorazowa: '37% (kod 71)',
    znizka_miesieczna: '49% (kod 76)',
    dokument: 'Legitymacja szkolna / przedszkolna / zaświadczenie.',
  },
  {
    grupa: 'Studenci (do 26 r.ż.), słuchacze kolegiów, doktoranci (do 35 r.ż.)',
    znizka_jednorazowa: '51% (kod 99)',
    znizka_miesieczna: '51% (kod 99)',
    dokument: 'Legitymacja studencka / doktoranta / ISIC. Wymagane obywatelstwo polskie.',
  },
  {
    grupa: 'Emeryt / rencista',
    znizka_jednorazowa: '37% (kod 74)',
    dokument: 'Zaświadczenie (biała wkładka).',
    uwagi: 'Wyłącznie 2 przejazdy w roku.',
  },
  {
    grupa: 'Posiadacz KDR (rodzic / małżonek rodzica)',
    znizka_jednorazowa: '37% (kod 57)',
    znizka_miesieczna: '49% (kod 68)',
    dokument: 'Karta Dużej Rodziny (dostępna też w mObywatel).',
  },
  {
    grupa: 'Posiadacz Karty Polaka',
    znizka_jednorazowa: '37% (kod 88)',
    dokument: 'Karta Polaka.',
  },
  {
    grupa: 'Żołnierz niezawodowy',
    znizka_jednorazowa: '78% (kod 73)',
    dokument: 'Książeczka wojskowa z wpisem.',
    uwagi: 'Tylko klasa 2.',
  },
  {
    grupa: 'Służby mundurowe podczas czynności służbowych (Policja, SG, SC-S, ŻW)',
    znizka_jednorazowa: '100% (kod 77)',
    dokument: 'Legitymacja służbowa + zaświadczenie o wykonywaniu czynności.',
    uwagi: 'Tylko klasa 2.',
  },
  {
    grupa: 'OzN I grupa',
    znizka_jednorazowa: '37% (kod 74)',
    znizka_miesieczna: '51%',
    dokument: 'Legitymacja OzN / orzeczenie / wypis z wpisem I grupa.',
  },
  {
    grupa: 'OzN niewidoma I grupa',
    znizka_jednorazowa: '51% (kod 98)',
    znizka_miesieczna: '51% (kod 98)',
    dokument: 'Dokument z wpisem I grupa z powodu stanu narządu wzroku.',
  },
  {
    grupa: 'OzN niewidoma II grupa',
    znizka_jednorazowa: '37% (kod 75)',
    znizka_miesieczna: '37% (kod 75)',
    dokument: 'Dokument z wpisem II grupa z powodu narządu wzroku.',
  },
  {
    grupa: 'Cywilna niewidoma ofiara działań wojennych I gr.',
    znizka_jednorazowa: '78% (kod 87)',
    dokument: 'Odpowiednia legitymacja.',
    uwagi: 'WYŁĄCZNIE W TLK / IC.',
  },
  {
    grupa: 'Cywilna niewidoma ofiara działań wojennych II gr.',
    znizka_jednorazowa: '37% (kod 75)',
  },
  {
    grupa: 'Dziecko / student z niepełnosprawnością oraz ich opiekunowie',
    znizka_jednorazowa: '78% (kod 78)',
    uwagi: 'WYŁĄCZNIE W OKREŚLONYCH RELACJACH (z miejsca pobytu do placówki).',
  },
  {
    grupa: 'Opiekun OzN I grupy / przewodnik osoby niewidomej (od 13 r.ż.)',
    znizka_jednorazowa: '95% (kod 79)',
    dokument: 'Dokumenty osoby podopiecznej.',
  },
];

// ─── Kombatanci i inwalidzi wojenni ───────────────────────────────────────────

export type KombatantRow = {
  grupa: string;
  tlk_ic: string;
  eic_eip_kl2: string;
  eic_eip_kl1: string;
};

export const KOMBATANCI: KombatantRow[] = [
  {
    grupa: 'Kombatant / Weteran Walk / Opozycja antykomunistyczna / Represjonowani',
    tlk_ic: '51% (67/63)',
    eic_eip_kl2: '51% (67/63)',
    eic_eip_kl1: '51% (67/63)',
  },
  {
    grupa: 'Weteran poszkodowany',
    tlk_ic: '37% (kl. 2: 74, kl. 1: 85)',
    eic_eip_kl2: '37% (74)',
    eic_eip_kl1: '37% (74)',
  },
  {
    grupa: 'Inwalida wojenny / wojskowy I gr.',
    tlk_ic: '78% (83)',
    eic_eip_kl2: '37% (82)',
    eic_eip_kl1: '37% (82)',
  },
  {
    grupa: 'Inwalida wojenny / wojskowy II/III gr.',
    tlk_ic: '37% (82)',
    eic_eip_kl2: '37% (82)',
    eic_eip_kl1: '37% (82)',
  },
  {
    grupa: 'Kombatant będący inwalidą I gr.',
    tlk_ic: '78% (83)',
    eic_eip_kl2: '51% (67)',
    eic_eip_kl1: '37% (82)',
  },
  {
    grupa: 'Kombatant będący inwalidą II/III gr.',
    tlk_ic: '51% (67)',
    eic_eip_kl2: '51% (67)',
    eic_eip_kl1: '37% (82)',
  },
  {
    grupa: 'Opiekun inwalidy I gr. / opiekun kombatanta-inwalidy I gr.',
    tlk_ic: '95% (84)',
    eic_eip_kl2: '95% (84)',
    eic_eip_kl1: '95% (84)',
  },
];

// ─── Posłowie i Senatorowie ───────────────────────────────────────────────────

export const POSEL_SENATOR = {
  znizka: '100% (bezpłatnie)',
  kategorie: 'TLK · IC · EIC · EIP — klasa 1 i 2',
  miejsca: 'Uprawnieni do nieodpłatnej rezerwacji na WL (sypialny) i Bc (kuszetki) na podstawie zlecenia Kancelarii Sejmu/Senatu.',
  dokumenty: 'Legitymacja poselska / senatorska lub odpowiednie zaświadczenie.',
};

// ─── Słownik pojęć ────────────────────────────────────────────────────────────

export type SlownikEntry = { term: string; opis: string };

export const SLOWNIK: SlownikEntry[] = [
  { term: 'I grupa inwalidztwa', opis: 'Stopień znaczny — niezdolny do samodzielnej egzystencji.' },
  { term: 'II grupa inwalidztwa', opis: 'Stopień umiarkowany — całkowicie niezdolny do pracy.' },
  { term: 'III grupa inwalidztwa', opis: 'Stopień lekki — częściowo niezdolny do pracy.' },
  { term: 'Niepełnosprawność wzroku', opis: 'Symbol: 04-O/o/h, § 26 pkt 1 lit. h. Charakterystyczna cecha: zielony kolor legitymacji.' },
  { term: 'Przypis (d)', opis: 'Jeśli dokument nie ma zdjęcia lub określonego wieku, ważny wyłącznie wraz z innym dokumentem umożliwiającym stwierdzenie tożsamości lub wieku.' },
  { term: 'Przypis (m)', opis: 'Dokument dostępny w aplikacji mObywatel.' },
];

// ─── Poziomy cenowe Promo ──────────────────────────────────────────────────────

export type PromoLevel = { poziom: string; znizka: string; kod: string };

export const PROMO_LEVELS: PromoLevel[] = [
  { poziom: 'I',    znizka: '7%',        kod: 'K' },
  { poziom: 'II',   znizka: '15%',       kod: 'F' },
  { poziom: 'III',  znizka: '21%',       kod: 'J' },
  { poziom: 'IV',   znizka: '30%',       kod: 'E' },
  { poziom: 'V',    znizka: '35%',       kod: 'H' },
  { poziom: 'VI',   znizka: '40%',       kod: 'G' },
  { poziom: 'VII',  znizka: '45%',       kod: 'C' },
  { poziom: 'VIII', znizka: 'wg cennika', kod: 'D' },
  { poziom: 'IX',   znizka: 'wg cennika', kod: 'B' },
];
