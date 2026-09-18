# Delovnik in vožnja — postavitev

Trije deli: **Google preglednica** (shramba + pošiljanje), **Apps Script** (koda, ki pošlje mail),
in **GitHub Pages** (javna spletna stran). Računalo je ~30 minut, večino klikaš v brskalniku.

Datoteke v tej mapi:

| Datoteka | Kam gre |
|---|---|
| `Code.gs` | v Google Apps Script (korak 2) |
| `index.html` | na GitHub (korak 4) |
| `build.py` | samo zame — iz izvorne strani zgradi `index.html` |

---

## Korak 1 — Google preglednica

1. Odpri [sheets.new](https://sheets.new) (prijavljen v svoj Google račun).
2. Preglednico poimenuj npr. **Delovnik — podatki**.
3. Pusti jo odprto.

## Korak 2 — Apps Script

1. V preglednici: **Razširitve → Apps Script**.
2. Pobriši vso obstoječo kodo v urejevalniku.
3. Odpri `Code.gs` iz te mape, kopiraj **vso** vsebino in jo prilepi noter.
4. Shrani (ikona diskete ali Ctrl/Cmd + S).
5. V spustnem meniju zgoraj izberi funkcijo **`nastaviVse`** in klikni **Zaženi**.
6. Google bo vprašal za dovoljenja:
   - *Preglej dovoljenja* → izberi svoj račun
   - *Google this app isn't verified* → **Napredno** → **Pojdi na … (nevarno)**
   - **Dovoli**

   To je normalno: skripta je tvoja lastna, Google samo opozarja, ker ni objavljena v trgovini.
7. Ko se konča, bo preglednica dobila liste **Uporabniki, Dnevi, Tedni, Meseci**.

> Dovolil si dostop do Gmaila — skripta ga uporablja **samo** za pošiljanje mesečnega
> poročila. Ne bere tvoje pošte.

## Korak 3 — objavi skripto kot spletno aplikacijo

1. V Apps Script zgoraj desno: **Uvedi → Nova uvedba**.
2. Ob **Izberi vrsto** klikni zobnik → **Spletna aplikacija**.
3. Nastavi:
   - **Izvedi kot:** *Jaz* (tvoj e-mail)
   - **Kdo ima dostop:** **Vsi** ← pomembno, sicer stran ne bo mogla shranjevati
4. **Uvedi** → kopiraj **URL spletne aplikacije**. Konča se z `/exec` in izgleda tako:

   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

5. Ta naslov shrani — rabiš ga v naslednjem koraku.

## Korak 4 — vpiši naslov v stran

1. Odpri `index.html` v urejevalniku besedila (TextEdit, VS Code, karkoli).
2. Poišči vrstico (je blizu konca datoteke):

   ```js
   var SCRIPT_URL = "TUKAJ_PRILEPI_SVOJ_APPS_SCRIPT_URL";
   ```

3. Med narekovaje prilepi svoj `/exec` naslov iz koraka 3 in shrani.

## Korak 5 — GitHub Pages

1. Naredi račun na [github.com](https://github.com) (če ga še nimaš).
2. **New repository** → ime npr. `delovnik` → **Public** → **Create repository**.
3. Na strani repozitorija: **Add file → Upload files** → povleci noter `index.html` → **Commit changes**.
4. **Settings → Pages** (levo v meniju):
   - **Source:** *Deploy from a branch*
   - **Branch:** `main`, mapa `/ (root)` → **Save**
5. Počakaj 1–2 minuti in osveži. Zgoraj se pokaže naslov:

   ```
   https://TVOJE-IME.github.io/delovnik/
   ```

Ta naslov pošiljaš sodelavcem. Deluje na telefonu in računalniku.

## Korak 6 — preizkus

1. Odpri svojo stran. Pokaže se **Prijava** → klikni **Ustvari ga**.
2. Izpolni: ime in priimek, svoj e-mail, geslo (vsaj 8 znakov), podjetje, ime in e-mail vodje.
   → **Ustvari račun**. Takoj si notri.
3. Vpiši en dan ur in shrani.
4. Gumb zgoraj desno mora pokazati **»Shranjeno v oblak«** (zelena pika).
5. V preglednici preveri list **Dnevi** — vrstica mora biti tam.
6. Odpri isto stran na telefonu, prijavi se z istim e-mailom in geslom → isti dan mora biti tam.
7. V Apps Script zaženi funkcijo **`preizkusiPosiljanje`** → poročilo za pretekli mesec
   pride **nate** (ne na vodjo), da vidiš, kako izgleda.

Če pika ostane siva ali rdeča: naslov v `index.html` ni pravi, ali pa v koraku 3
»Kdo ima dostop« ni nastavljeno na **Vsi**.

## Kako posodobiš kodo pozneje

Če ti pošljem nov `Code.gs`, samo shraniti **ni dovolj** — objavljena aplikacija še vedno
teče na stari različici. Narediš takole:

1. Prilepi novo kodo in shrani.
2. **Uvedi → Upravljaj uvedbe**.
3. Ob obstoječi uvedbi klikni **svinčnik** (uredi).
4. **Različica → Nova različica** → **Uvedi**.

Naslov `/exec` ostane isti, spremeniti ga ni treba nikjer.

---

## Kako potem teče samo

- Vsak dan vpišeš ure → shrani se lokalno **in** v preglednico.
- Vsak teden oceniš tveganje in kompleksnost → Shrani.
- **1. v mesecu ob 7:00** skripta sama sestavi poročilo za pretekli mesec in ga
  pošlje vodji, s kopijo tebi. Nič ne rabiš klikniti.
- Poročilo vsebuje vsak teden posebej, dnevni razpored in mesečne odgovore.

Mesečna vprašanja (učinkovitost, poškodbe) odgovoriš v aplikaciji do 1. v mesecu.
Če jih ne, poročilo vseeno odide — samo pri teh postavkah bo pisalo `—`.

### Prijava in naprave

Račun je en sam: e-mail in geslo. Prijaviš se lahko na telefonu, tablici in računalniku —
ure so povsod iste in se prenašajo same. Nič ni treba izvažati ali uvažati.

**Odklepanje z obrazom ali prstnim odtisom:** v **Nastavitvah** obkljukaj
»Odklepanje z obrazom ali prstnim odtisom na tej napravi«. Odslej te ob odprtju
strani pozdravi Face ID (ali prstni odtis) namesto tipkanja gesla.

To je *ključavnica na napravi*, ne nadomestilo gesla: gesla ne shrani nikamor, prepreči pa,
da bi kdo, ki dobi tvoj odklenjen telefon v roke, kar odprl tvoje ure. Geslo še vedno rabiš,
ko se prvič prijaviš na novo napravo. Vklopiti ga moraš na vsaki napravi posebej.

### Predčasna oddaja

Čisto na dnu strani je **Predčasna oddaja** — za bolniško, odpoved ali kadar moraš ure
oddati sredi meseca. Izbereš razlog, po želji dodaš pojasnilo, potrdiš in mail odide takoj.
V poročilu se pojavi vrstica `Oddano: predčasno — <razlog>`.

Samodejnega pošiljanja 1. v mesecu to **ne prekliče**. Če hočeš, da ta mesec ne gre več nič,
klikni še **Označi kot poslano**.

---

## Kar moraš vedeti

**Pošta odhaja iz tvojega Gmaila.** Tudi če sodelavec uporablja tvojo povezavo, gre
njegovo poročilo njegovemu vodji, ampak **poslano iz tvojega naslova**. Če to ni v redu,
naj vsak sodelavec naredi svojo kopijo preglednice in skripte (koraki 1–3) ter svojo
stran s svojim `SCRIPT_URL`.

**Vsi podatki so v tvoji preglednici.** Vsak, ki si naredi račun na tvoji povezavi,
pristane v njej. Preglednice ne deli javno.

**Gesla so shranjena zgoščena** (2000 krogov SHA-256 s soljo), na skritem listu `Racuni`.
Iz njih gesla ni mogoče prebrati, ampak to ni bančna zaščita — **ne uporabi gesla,
ki ga imaš že kje drugje**. Pozabljenega gesla ni mogoče obnoviti sam: pobrišeš vrstico
v listu `Racuni` in uporabnik se registrira znova (ure ostanejo).

**Gmail dovoli 100 poslanih sporočil na dan** (brezplačen račun). Za to uporabo daleč dovolj.

**Ko spremeniš `index.html`**, ga moraš znova naložiti na GitHub (Add file → Upload files,
isto ime datoteke — prepiše staro).

---

## Da te najde Google

GitHub Pages je javen, ampak Google potrebuje nekaj tednov, da stran sam najde.
Pospešiš takole:

1. Odpri [Google Search Console](https://search.google.com/search-console).
2. **Add property → URL prefix** → prilepi svoj `https://TVOJE-IME.github.io/delovnik/`.
3. Potrdi lastništvo (najlažje: **HTML tag** — kodo prilepi v `<head>` v `index.html`,
   znova naloži na GitHub, klikni Verify).
4. Zgoraj v iskalno polje prilepi svoj naslov → **Request indexing**.

Stran ima že vpisan naslov, opis in `lang="sl"`, tako da bo v rezultatih izgledala urejeno.
