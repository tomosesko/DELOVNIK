/**
 * Delovnik in vožnja — zaledje (Google Apps Script)
 *
 * Kaj dela:
 *  1. Sprejema vnose s spletne strani in jih shranjuje v to preglednico.
 *  2. Prvega v mesecu ob 7:00 samodejno pošlje poročilo za pretekli mesec
 *     vodji vsakega uporabnika, iz tvojega Gmail naslova.
 *
 * Zaženeš ga enkrat ročno (funkcija `nastaviVse`), potem teče sam.
 */

var SHEET_USERS  = 'Uporabniki';
var SHEET_DAYS   = 'Dnevi';
var SHEET_WEEKS  = 'Tedni';
var SHEET_MONTHS = 'Meseci';
var SHEET_ACC    = 'Racuni';   // skrit list: e-mail, sol, zgoščena koda, žeton

/* ============================================================
   1. NASTAVITEV — to zaženeš enkrat, ročno
   ============================================================ */

function nastaviVse() {
  pripraviListe_();
  nastaviSprozilec_();
  SpreadsheetApp.getActive().toast('Vse pripravljeno. Zdaj objavi še spletno aplikacijo.', 'Delovnik', 8);
}

function nastaviSprozilec_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'posljiMesecnaPorocila') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('posljiMesecnaPorocila')
    .timeBased().onMonthDay(1).atHour(7).create();
}

function pripraviListe_() {
  var ss = SpreadsheetApp.getActive();
  glava_(ss, SHEET_USERS,  ['E-mail', 'Ime', 'Podjetje', 'Vodja', 'E-mail vodje', 'Zadnja sprememba', 'Podatki (JSON)']);
  glava_(ss, SHEET_DAYS,   ['E-mail', 'Datum', 'Dan', 'Delo od', 'Delo do', 'Vožnja tja od', 'Vožnja tja do',
                            'Vožnja nazaj od', 'Vožnja nazaj do', 'Počitek od', 'Počitek do',
                            'Ure delo', 'Ure vožnja', 'Ure počitek', 'Vikend', 'Opomba']);
  glava_(ss, SHEET_WEEKS,  ['E-mail', 'Teden', 'Od', 'Do', 'Tveganje', 'Tveganje opis',
                            'Kompleksnost', 'Kompleksnost opis', 'Pripombe']);
  glava_(ss, SHEET_MONTHS, ['E-mail', 'Mesec', 'Ure delo', 'Ure vožnja', 'Ure počitek',
                            'Učinkovitost %', 'Poškodbe', 'Resne poškodbe', 'Opombe', 'Poslano']);
  var acc = glava_(ss, SHEET_ACC, ['E-mail', 'Sol', 'Zgoščena koda', 'Žeton', 'Ustvarjen', 'Zadnja prijava']);
  acc.hideSheet();   // gesla naj ne visijo pred očmi
}

function glava_(ss, ime, stolpci) {
  var sh = ss.getSheetByName(ime) || ss.insertSheet(ime);
  sh.getRange(1, 1, 1, stolpci.length).setValues([stolpci]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

/* ============================================================
   2. SPREJEM PODATKOV S SPLETNE STRANI
   ============================================================ */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'register') return registracija_(body);
    if (body.action === 'login')    return prijava_(body);

    // vse ostalo zahteva veljaven žeton
    var racun = racunPoZetonu_(body.token);
    if (!racun) return odgovor_({ ok: false, error: 'seja', message: 'Seja je potekla. Prijavi se znova.' });

    if (body.action === 'load')    return odgovor_({ ok: true, state: naloziStanje_(racun.email) });
    if (body.action === 'save')    { shraniStanje_(racun.email, body.state); return odgovor_({ ok: true }); }
    if (body.action === 'sendNow') return posljiTakoj_(racun.email, body);
    return odgovor_({ ok: false, error: 'neznana akcija' });
  } catch (err) {
    return odgovor_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  // Podatki gredo ven samo prek POST z žetonom; GET služi le za preverjanje, da skripta teče.
  return odgovor_({ ok: true, info: 'Delovnik zaledje deluje.' });
}

function odgovor_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function naloziStanje_(email) {
  if (!email) return null;
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  if (!sh) return null;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).toLowerCase() === String(email).toLowerCase()) {
      try { return JSON.parse(v[i][6]); } catch (err) { return null; }
    }
  }
  return null;
}

function shraniStanje_(email, state) {
  if (!state || !state.profile) return;
  email = String(email || '').trim().toLowerCase();
  if (!email) return;
  state.profile.email = email;              // e-mail določa žeton, ne odjemalec

  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_USERS) || glava_(ss, SHEET_USERS,
    ['E-mail', 'Ime', 'Podjetje', 'Vodja', 'E-mail vodje', 'Zadnja sprememba', 'Podatki (JSON)']);

  var vrstica = [email, state.profile.name || '', state.profile.company || '',
                 state.profile.bossName || '', state.profile.bossEmail || '',
                 new Date(), JSON.stringify(state)];

  var v = sh.getDataRange().getValues(), naslo = false;
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).toLowerCase() === email) {
      sh.getRange(i + 1, 1, 1, vrstica.length).setValues([vrstica]);
      naslo = true; break;
    }
  }
  if (!naslo) sh.appendRow(vrstica);

  osveziPregled_(email, state);
}

/** Berljivi listi: za tega uporabnika jih vsakič zgradimo na novo. */
function osveziPregled_(email, state) {
  var ss = SpreadsheetApp.getActive();
  pobrisiVrstice_(ss.getSheetByName(SHEET_DAYS), email);
  pobrisiVrstice_(ss.getSheetByName(SHEET_WEEKS), email);
  pobrisiVrstice_(ss.getSheetByName(SHEET_MONTHS), email);

  var dnevi = [];
  Object.keys(state.days || {}).sort().forEach(function (k) {
    var r = state.days[k], x = ureDneva_(r), d = izDatuma_(k);
    dnevi.push([email, k, DNEVI[d.getDay()], r.wFrom || '', r.wTo || '',
      r.d1From || '', r.d1To || '', r.d2From || '', r.d2To || '', r.rFrom || '', r.rTo || '',
      ure_(x.work), ure_(x.drive), ure_(x.rest), jeVikend_(k) ? 'da' : '', r.note || '']);
  });
  if (dnevi.length) ss.getSheetByName(SHEET_DAYS).getRange(
    ss.getSheetByName(SHEET_DAYS).getLastRow() + 1, 1, dnevi.length, dnevi[0].length).setValues(dnevi);

  var tedni = [];
  Object.keys(state.weeks || {}).sort().forEach(function (k) {
    var a = state.weeks[k];
    if (!a || !a.risk || !a.cplx) return;
    var meje = mejeTedna_(k);
    tedni.push([email, k, meje.od, meje.doo, a.risk, TVEGANJE[a.risk], a.cplx, KOMPLEKS[a.cplx], a.note || '']);
  });
  if (tedni.length) ss.getSheetByName(SHEET_WEEKS).getRange(
    ss.getSheetByName(SHEET_WEEKS).getLastRow() + 1, 1, tedni.length, tedni[0].length).setValues(tedni);

  var meseci = [];
  Object.keys(state.months || {}).sort().forEach(function (mk) {
    var a = state.months[mk], t = skupajMeseca_(state, mk);
    meseci.push([email, mk, ure_(t.work), ure_(t.drive), ure_(t.rest),
      a.eff !== undefined ? a.eff : '', a.inj !== undefined ? a.inj : '',
      a.injBad !== undefined ? a.injBad : '', a.note || '', a.sentAt || '']);
  });
  if (meseci.length) ss.getSheetByName(SHEET_MONTHS).getRange(
    ss.getSheetByName(SHEET_MONTHS).getLastRow() + 1, 1, meseci.length, meseci[0].length).setValues(meseci);
}

function pobrisiVrstice_(sh, email) {
  if (!sh || sh.getLastRow() < 2) return;
  var v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) {
    if (String(v[i][0]).toLowerCase() === email) sh.deleteRow(i + 1);
  }
}

/**
 * Predčasna oddaja — uporabnik sam klikne "Pošlji zdaj" (bolniška, odpoved,
 * sredi meseca). Samodejno pošiljanje 1. v mesecu to NE prekliče.
 */
function posljiTakoj_(email, body) {
  var state = body.state;
  if (!state || !state.profile) return odgovor_({ ok: false, error: 'ni podatkov' });

  var sefMail = String(state.profile.bossEmail || '').trim();
  if (!sefMail) return odgovor_({ ok: false, message: 'Ni e-maila vodje.' });

  shraniStanje_(email, state);                            // najprej shrani, potem pošlji

  var mk = String(body.month || '');
  var y = +mk.slice(0, 4), m = +mk.slice(5, 7) - 1;
  if (!y || m < 0 || m > 11) return odgovor_({ ok: false, error: 'napačen mesec' });

  var razlog = String(body.reason || 'predčasna oddaja').slice(0, 200);
  var besedilo = sestaviPorocilo_(state, y, m, razlog);
  var zadeva = String(body.subject || ('Delovne ure ' + MESECI[m] + ' ' + y + ' (predčasna oddaja)')).slice(0, 200);

  try {
    MailApp.sendEmail({
      to: sefMail,
      cc: email || undefined,
      subject: zadeva,
      body: besedilo,
      htmlBody: porociloHtml_(besedilo)
    });
  } catch (err) {
    return odgovor_({ ok: false, error: String(err) });
  }

  // zabeležimo v list Meseci, da ostane sled
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_MONTHS);
    if (sh) {
      var v = sh.getDataRange().getValues();
      var email = String(state.profile.email || '').toLowerCase();
      for (var i = 1; i < v.length; i++) {
        if (String(v[i][0]).toLowerCase() === email && String(v[i][1]) === mk) {
          sh.getRange(i + 1, 10).setValue('predčasno ' +
            Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy') + ' — ' + razlog);
          break;
        }
      }
    }
  } catch (err) { /* zapis v pregled ni ključen */ }

  return odgovor_({ ok: true });
}


/* ============================================================
   2a. RAČUNI — registracija, prijava, žetoni
   ============================================================ */

var ZGOSCEVANJ = 2000;   // koliko krogov, da uganjevanje gesla ni poceni

function zgosti_(geslo, sol) {
  var b = Utilities.newBlob(sol + '|' + geslo).getBytes();
  for (var i = 0; i < ZGOSCEVANJ; i++) {
    b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b);
  }
  return Utilities.base64Encode(b);
}
function novZeton_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }
function listRacunov_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_ACC);
  if (!sh) { sh = glava_(ss, SHEET_ACC, ['E-mail', 'Sol', 'Zgoščena koda', 'Žeton', 'Ustvarjen', 'Zadnja prijava']); sh.hideSheet(); }
  return sh;
}
function racunPoEmailu_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return null;
  var sh = listRacunov_(), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).toLowerCase() === email) {
      return { vrstica: i + 1, email: String(v[i][0]), sol: String(v[i][1]), hash: String(v[i][2]), zeton: String(v[i][3]) };
    }
  }
  return null;
}
function racunPoZetonu_(zeton) {
  zeton = String(zeton || '');
  if (zeton.length < 20) return null;
  var sh = listRacunov_(), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][3]) === zeton) return { vrstica: i + 1, email: String(v[i][0]) };
  }
  return null;
}

function registracija_(body) {
  var email = String(body.email || '').trim().toLowerCase();
  var geslo = String(body.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return odgovor_({ ok: false, message: 'Vpiši veljaven e-mail.' });
  if (geslo.length < 8) return odgovor_({ ok: false, message: 'Geslo naj ima vsaj 8 znakov.' });
  if (racunPoEmailu_(email)) return odgovor_({ ok: false, message: 'Račun s tem e-mailom že obstaja. Prijavi se.' });

  var sol = Utilities.getUuid();
  var zeton = novZeton_();
  listRacunov_().appendRow([email, sol, zgosti_(geslo, sol), zeton, new Date(), new Date()]);

  var profil = {
    name: String(body.name || '').trim(),
    email: email,
    company: String(body.company || '').trim(),
    bossName: String(body.bossName || '').trim(),
    bossEmail: String(body.bossEmail || '').trim()
  };
  var state = { profile: profil, days: {}, weeks: {}, months: {} };
  shraniStanje_(email, state);
  return odgovor_({ ok: true, token: zeton, state: state });
}

function prijava_(body) {
  var email = String(body.email || '').trim().toLowerCase();
  var geslo = String(body.password || '');
  var r = racunPoEmailu_(email);
  // isto sporočilo v obeh primerih, da ne izdamo, kateri e-maili obstajajo
  if (!r || zgosti_(geslo, r.sol) !== r.hash) return odgovor_({ ok: false, message: 'Napačen e-mail ali geslo.' });

  var zeton = r.zeton || novZeton_();
  var sh = listRacunov_();
  sh.getRange(r.vrstica, 4).setValue(zeton);
  sh.getRange(r.vrstica, 6).setValue(new Date());
  return odgovor_({ ok: true, token: zeton, state: naloziStanje_(email) });
}

/* ============================================================
   3. SAMODEJNO MESEČNO POŠILJANJE
   ============================================================ */

function posljiMesecnaPorocila() {
  var d = new Date();
  var prej = new Date(d.getFullYear(), d.getMonth() - 1, 1);   // pretekli mesec
  var mk = prej.getFullYear() + '-' + dvomestno_(prej.getMonth() + 1);

  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  if (!sh || sh.getLastRow() < 2) return;
  var v = sh.getDataRange().getValues();

  for (var i = 1; i < v.length; i++) {
    var email = String(v[i][0] || '').trim();
    var sefMail = String(v[i][4] || '').trim();
    if (!email || !sefMail) continue;

    var state;
    try { state = JSON.parse(v[i][6]); } catch (err) { continue; }
    if (!state) continue;

    var a = (state.months && state.months[mk]) || null;
    var t = skupajMeseca_(state, mk);
    if (t.work + t.drive + t.rest <= 0) continue;      // brez vnosov ne pošiljamo
    if (a && a.sentAt) continue;                        // že poslano

    var zadeva = 'Delovne ure ' + MESECI[prej.getMonth()] + ' ' + prej.getFullYear() +
                 (state.profile && state.profile.name ? ' – ' + state.profile.name : '');
    var besedilo = sestaviPorocilo_(state, prej.getFullYear(), prej.getMonth());
    try {
      MailApp.sendEmail({
        to: sefMail,
        cc: email,
        subject: zadeva,
        body: besedilo,                        // za programe brez HTML
        htmlBody: porociloHtml_(besedilo)      // skupne ure in učinkovitost v rdeči
      });
    } catch (err) {
      Logger.log('Pošiljanje ni uspelo za ' + email + ': ' + err);
      continue;
    }

    state.months = state.months || {};
    state.months[mk] = state.months[mk] || {};
    state.months[mk].sentAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    sh.getRange(i + 1, 7).setValue(JSON.stringify(state));
  }
}

/** Ročni preizkus: pošlje poročilo za pretekli mesec samo tebi. */
function preizkusiPosiljanje() {
  var d = new Date(), prej = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_USERS);
  var v = sh.getDataRange().getValues();
  if (v.length < 2) { SpreadsheetApp.getActive().toast('Ni še nobenega uporabnika.'); return; }
  var state = JSON.parse(v[1][6]);
  var besedilo = sestaviPorocilo_(state, prej.getFullYear(), prej.getMonth());
  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: '[PREIZKUS] Delovne ure ' + MESECI[prej.getMonth()] + ' ' + prej.getFullYear(),
    body: besedilo,
    htmlBody: porociloHtml_(besedilo)
  });
  SpreadsheetApp.getActive().toast('Preizkusni mail poslan nate.');
}

/**
 * Poročilo v HTML, da se skupne ure in učinkovitost izpišejo v rdeči.
 * Stolpci ostanejo poravnani, ker gre vse v <pre> z monospace pisavo.
 */
var RDECA = '#B3261E';

function porociloHtml_(besedilo) {
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var poudari = function (v) {
    return v.indexOf('--- SKUPAJ ---') === 0 ||
           v.indexOf('Skupaj:') === 0 ||
           v.indexOf('Učinkovitost:') === 0;
  };
  var vrstice = besedilo.split('\n').map(function (v) {
    var e = esc(v);
    return poudari(v) ? '<span style="color:' + RDECA + ';font-weight:700">' + e + '</span>' : e;
  });
  return '<div style="background:#ffffff;padding:16px">' +
         '<pre style="margin:0;font-family:Menlo,Consolas,\'DejaVu Sans Mono\',monospace;' +
         'font-size:13px;line-height:1.55;color:#101820;white-space:pre-wrap">' +
         vrstice.join('\n') + '</pre></div>';
}

/* ============================================================
   4. IZRAČUNI IN POROČILO  (enaki kot na spletni strani)
   ============================================================ */

var DNEVI   = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];
var MESECI  = ['januar','februar','marec','april','maj','junij',
               'julij','avgust','september','oktober','november','december'];
var TVEGANJE = ['', 'zanemarljivo', 'nizko', 'zmerno', 'visoko', 'kritično'];
var KOMPLEKS = ['', 'rutinsko', 'enostavno', 'zmerno', 'zahtevno', 'zelo zahtevno'];

function dvomestno_(n) { return (n < 10 ? '0' : '') + n; }
function izDatuma_(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
function jeVikend_(s) { var g = izDatuma_(s).getDay(); return g === 0 || g === 6; }
function vMinute_(s) {
  if (!s) return null;
  var a = String(s).split(':'); if (a.length < 2) return null;
  var m = (+a[0]) * 60 + (+a[1]);
  return isFinite(m) ? m : null;
}
function razpon_(od, doo) {
  var a = vMinute_(od), b = vMinute_(doo);
  if (a === null || b === null) return null;
  if (b <= a) b += 1440;
  return [a, b];
}
function dolzina_(r) { return r ? r[1] - r[0] : 0; }
function prekrivanje_(a, b) { return (!a || !b) ? 0 : Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0])); }
function ure_(min) { min = Math.max(0, Math.round(min)); return Math.floor(min / 60) + ':' + dvomestno_(min % 60); }
function odstotek_(n) { return (Math.round(n * 10) / 10).toString().replace('.', ',') + ' %'; }
function stevilo_(n) { return n.toFixed(1).replace('.', ','); }
function desno_(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

function ureDneva_(r) {
  if (!r) return { work: 0, drive: 0, rest: 0 };
  var w = razpon_(r.wFrom, r.wTo);
  var d1 = razpon_(r.d1From, r.d1To), d2 = razpon_(r.d2From, r.d2To);
  var p = razpon_(r.rFrom, r.rTo);
  var ov = prekrivanje_(w, d1) + prekrivanje_(w, d2) + prekrivanje_(w, p);
  return { work: Math.max(0, dolzina_(w) - ov), drive: dolzina_(d1) + dolzina_(d2), rest: dolzina_(p) };
}

function skupajMeseca_(state, mk) {
  var t = { work: 0, drive: 0, rest: 0, days: 0, weekend: 0, weekendAll: 0 };
  Object.keys(state.days || {}).forEach(function (k) {
    if (k.indexOf(mk) !== 0) return;
    var x = ureDneva_(state.days[k]);
    if (x.work + x.drive + x.rest <= 0) return;
    t.work += x.work; t.drive += x.drive; t.rest += x.rest; t.days++;
    if (jeVikend_(k)) { t.weekend++; t.weekendAll += x.work + x.drive; }
  });
  return t;
}

function isoTeden_(d) {
  var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  var prvi = new Date(t.getFullYear(), 0, 4);
  var n = 1 + Math.round(((t - prvi) / 86400000 - 3 + ((prvi.getDay() + 6) % 7)) / 7);
  return { week: n, key: t.getFullYear() + '-W' + dvomestno_(n) };
}
function ponedeljek_(d) {
  var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return t;
}
function tedniMeseca_(y, m) {
  var zadnji = new Date(y, m + 1, 0), cur = ponedeljek_(new Date(y, m, 1));
  var out = [], videno = {};
  while (cur <= zadnji) {
    var w = isoTeden_(cur);
    if (!videno[w.key]) {
      videno[w.key] = 1;
      out.push({ key: w.key, week: w.week, start: new Date(cur),
                 end: new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 6) });
    }
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
  }
  return out;
}
function mejeTedna_(key) {
  var y = +key.slice(0, 4), n = +key.slice(6);
  var d = new Date(y, 0, 4);
  var pon = ponedeljek_(d);
  pon.setDate(pon.getDate() + (n - 1) * 7);
  var ned = new Date(pon.getFullYear(), pon.getMonth(), pon.getDate() + 6);
  var f = function (x) { return dvomestno_(x.getDate()) + '.' + dvomestno_(x.getMonth() + 1) + '.' + x.getFullYear(); };
  return { od: f(pon), doo: f(ned) };
}
function ureTedna_(state, w) {
  var t = { work: 0, drive: 0, rest: 0 }, c = new Date(w.start);
  while (c <= w.end) {
    var k = c.getFullYear() + '-' + dvomestno_(c.getMonth() + 1) + '-' + dvomestno_(c.getDate());
    var x = ureDneva_((state.days || {})[k]);
    t.work += x.work; t.drive += x.drive; t.rest += x.rest;
    c = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 1);
  }
  return t;
}

function sestaviPorocilo_(state, y, m, razlog) {
  var mk = y + '-' + dvomestno_(m + 1);
  var p = state.profile || {}, t = skupajMeseca_(state, mk);
  var vsota = t.work + t.drive + t.rest;
  var a = (state.months || {})[mk] || {};
  var L = [];

  L.push('POROČILO O DELOVNEM ČASU');
  L.push('Zaposleni: ' + (p.name || '—') + (p.email ? '  <' + p.email + '>' : ''));
  if (p.company) L.push('Podjetje:  ' + p.company);
  L.push('Vodja:     ' + (p.bossName || '—') + (p.bossEmail ? '  <' + p.bossEmail + '>' : ''));
  L.push('Obdobje:   ' + MESECI[m] + ' ' + y);
  if (razlog) L.push('Oddano:    predčasno — ' + razlog + ' (' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy') + ')');
  L.push('');
  L.push('--- SKUPAJ ---');
  L.push('Delo:     ' + ure_(t.work) + '  (' + (vsota ? odstotek_(t.work / vsota * 100) : '0 %') + ')');
  L.push('Vožnja:   ' + ure_(t.drive) + '  (' + (vsota ? odstotek_(t.drive / vsota * 100) : '0 %') + ')');
  L.push('Počitek:  ' + ure_(t.rest) + '  (' + (vsota ? odstotek_(t.rest / vsota * 100) : '0 %') + ')');
  L.push('Skupaj:   ' + ure_(vsota));
  L.push('Dnevi:    ' + t.days + (t.weekend ? '  (vikendi: ' + t.weekend + ', ' + ure_(t.weekendAll) + ')' : ''));
  L.push('');

  L.push('--- TEDENSKE OCENE (vsak teden posebej) ---');
  var vsota_r = 0, vsota_k = 0, n = 0;
  tedniMeseca_(y, m).forEach(function (w) {
    var x = (state.weeks || {})[w.key], wt = ureTedna_(state, w);
    L.push('');
    L.push('Teden ' + w.week + ' · ' + dvomestno_(w.start.getDate()) + '.' + dvomestno_(w.start.getMonth() + 1) +
           '. – ' + dvomestno_(w.end.getDate()) + '.' + dvomestno_(w.end.getMonth() + 1) + '.');
    if (!x || !x.risk || !x.cplx) {
      L.push('  ' + desno_('Ocena:', 24) + 'ni bilo oddano');
    } else {
      vsota_r += x.risk; vsota_k += x.cplx; n++;
      L.push('  ' + desno_('Ocena tveganja dela:', 24) + x.risk + '/5 (' + TVEGANJE[x.risk] + ')');
      L.push('  ' + desno_('Kompleksnost problemov:', 24) + x.cplx + '/5 (' + KOMPLEKS[x.cplx] + ')');
      if (x.note) L.push('  ' + desno_('Pripombe:', 24) + x.note);
    }
    L.push('  ' + desno_('Ure v tednu:', 24) + ure_(wt.work) + ' delo · ' + ure_(wt.drive) +
           ' vožnja · ' + ure_(wt.rest) + ' počitek');
  });
  if (n) {
    L.push('');
    L.push('Povprečje meseca: tveganje ' + stevilo_(vsota_r / n) + '/5 · kompleksnost ' +
           stevilo_(vsota_k / n) + '/5  (' + n + ' ocenjenih tednov)');
  }
  L.push('');

  L.push('--- MESEČNA OCENA ---');
  L.push(desno_('Učinkovitost:', 24) + (a.eff !== undefined ? a.eff + ' %' : '—'));
  L.push(desno_('Število poškodb:', 24) + (a.inj !== undefined ? a.inj : '—'));
  L.push(desno_('Število resnih poškodb:', 24) + (a.injBad !== undefined ? a.injBad : '—'));
  if (a.note) L.push('Opombe: ' + a.note);

  L.push('');
  L.push('--- PO DNEVIH ---');
  L.push('dat.    dan  delo          vožnja                    počitek  delo    vožnja');
  Object.keys(state.days || {}).sort().forEach(function (k) {
    if (k.indexOf(mk) !== 0) return;
    var r = state.days[k], x = ureDneva_(r), d = izDatuma_(k);
    if (x.work + x.drive + x.rest <= 0) return;
    var dp = [];
    if (r.d1From && r.d1To) dp.push(r.d1From + '-' + r.d1To);
    if (r.d2From && r.d2To) dp.push(r.d2From + '-' + r.d2To);
    L.push(desno_(dvomestno_(d.getDate()) + '.' + dvomestno_(d.getMonth() + 1) + '.', 8) +
      desno_(DNEVI[d.getDay()], 5) +
      desno_((r.wFrom && r.wTo) ? r.wFrom + '-' + r.wTo : '—', 14) +
      desno_(dp.join(' ') || '—', 26) +
      desno_(x.rest ? ure_(x.rest) : '—', 9) +
      desno_(ure_(x.work), 8) + ure_(x.drive) +
      (jeVikend_(k) ? '   [vikend]' : '') + (r.note ? '   ' + r.note : ''));
  });

  L.push('');
  L.push('Poslano samodejno ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy') +
         (p.company ? ' · ' + p.company : ''));
  return L.join('\n');
}
