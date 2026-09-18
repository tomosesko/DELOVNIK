#!/usr/bin/env python3
"""Zgradi index.html (GitHub Pages) iz izvorne strani za Artifact.

Doda: ovoj dokumenta, SEO, prijavni zaslon z računom, odklepanje s Face ID
in samodejno sinhronizacijo z Google preglednico.
"""
import io, re, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "stran-izvorna.html")
OUT = os.path.join(HERE, "index.html")

src = io.open(SRC, encoding="utf-8").read()

title = re.search(r"<title>(.*?)</title>", src).group(1)
links = re.findall(r"<link [^>]*>", src)
body = re.sub(r"<title>.*?</title>\s*", "", src, count=1)
body = re.sub(r'<meta name="description"[^>]*>\s*', "", body, count=1)
for l in links:
    body = body.replace(l + "\n", "")

DESC = ("Preprosta evidenca delovnih ur, vožnje in počitka. Vpišeš ure vsak dan, "
        "vsak teden oceniš tveganje in kompleksnost dela, ob koncu meseca gre poročilo "
        "samodejno na e-pošto vodje.")

GATE_CSS = """
/* zaslon za prijavo; dokler traja, je aplikacija skrita */
body.gate > *:not(#gate){display:none !important}
#gate{display:none;position:fixed;inset:0;z-index:200;background:#fff;overflow-y:auto;
      padding:32px 18px;align-items:flex-start;justify-content:center}
body.gate #gate{display:flex}
.gate-card{width:100%;max-width:400px}
.gate-logo{display:flex;justify-content:center;margin-bottom:26px}
.gate-card h1{font-size:20px;font-weight:700;letter-spacing:-0.02em;margin:0 0 4px}
.gate-card .lead{font-size:13px;color:#79838D;margin:0 0 22px;line-height:1.5}
.gate-form{display:flex;flex-direction:column;gap:13px}
#gate [hidden]{display:none !important}   /* display:flex sicer prebije atribut hidden */
.gate-msg{display:none;font-size:13px;border-radius:8px;padding:10px 12px;line-height:1.45}
.gate-msg.on{display:block}
.gate-msg.err{background:#B3261E14;color:#8E2A22;border:1px solid #B3261E33}
.gate-msg.info{background:#1B4E9B14;color:#153D7A;border:1px solid #1B4E9B33}
.gate-alt{margin-top:20px;padding-top:18px;border-top:1px solid #E1E6EC;text-align:center;font-size:13px;color:#79838D}
.gate-alt button{background:none;border:0;color:#1B4E9B;font-weight:600;cursor:pointer;font-size:13px;
                 padding:2px 4px;text-decoration:underline;text-underline-offset:2px}
.gate-bio{width:100%;justify-content:center;display:flex;align-items:center;gap:9px}
.gate-foot{margin-top:22px;font-size:11.5px;color:#79838D;text-align:center;line-height:1.5}
#gate .btn{width:100%;padding:14px 17px;font-size:15px;transition:background .12s,box-shadow .12s}
#gate .btn.primary:hover{background:#153D7A;box-shadow:0 2px 10px -2px #1B4E9B66}

/* jasen znak, na katerem polju je miška in katero je aktivno */
#gate .field{border-radius:10px;padding:2px;margin:-2px;transition:background .12s}
#gate .field:hover{background:#1B4E9B0A}
#gate .field label{transition:color .12s}
#gate .field:hover label,#gate .field:focus-within label{color:#1B4E9B}
#gate .field input{cursor:text;transition:border-color .12s,background .12s,box-shadow .12s}
#gate .field input:hover{border-color:#1B4E9B;background:#F2F6FB}
#gate .field input:focus{border-color:#1B4E9B;background:#fff;outline:none;
                         box-shadow:0 0 0 3px #1B4E9B26}
#gate .gate-alt button:hover{color:#153D7A;background:#1B4E9B0F;border-radius:6px}
@media (max-width:560px){
  #syncPill .pill-txt{display:none}        /* na telefonu zadostuje barvna pika */
  #syncPill{padding:0 13px}
  #gate{padding:24px 16px}
  .gate-logo{margin-bottom:20px}
  .gate-card h1{font-size:22px}
  #gate .field input{padding:13px 12px;font-size:16px}
  .gate-alt button{padding:8px 6px}
}
"""

GATE_HTML = """
<div id="gate">
  <div class="gate-card">
    <div class="gate-logo">
      <div class="logo lg" aria-label="Šeško Developement">
        <span class="word">ŠEŠKO</span><span class="sub">Developement</span>
      </div>
    </div>

    <!-- odklepanje z obrazom / prstom -->
    <div id="gateUnlock" hidden>
      <h1 id="gateUnlockName">Dobrodošel nazaj</h1>
      <p class="lead">Odkleni z obrazom ali prstnim odtisom.</p>
      <div class="gate-msg" id="gateUnlockMsg"></div>
      <div class="gate-form">
        <button type="button" class="btn primary gate-bio" id="btnUnlock">Odkleni</button>
      </div>
      <div class="gate-alt">
        <button type="button" id="toLoginFromUnlock">Prijava z geslom</button>
      </div>
    </div>

    <!-- prijava -->
    <form id="gateLogin" class="gate-form" hidden>
      <div>
        <h1>Prijava</h1>
        <p class="lead">Vpiši se in tvoje ure so na vseh napravah.</p>
      </div>
      <div class="gate-msg" id="gateLoginMsg"></div>
      <div class="field">
        <label for="liEmail">E-mail</label>
        <input type="email" id="liEmail" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="liPass">Geslo</label>
        <input type="password" id="liPass" autocomplete="current-password" required>
      </div>
      <button type="submit" class="btn primary" id="btnLogin">Prijava</button>
      <div class="gate-alt">Še nimaš računa? <button type="button" id="toRegister">Ustvari ga</button></div>
    </form>

    <!-- registracija -->
    <form id="gateRegister" class="gate-form" hidden>
      <div>
        <h1>Nov račun</h1>
        <p class="lead">Enkraten vpis. Potem samo vpisuješ ure.</p>
      </div>
      <div class="gate-msg" id="gateRegMsg"></div>
      <div class="field">
        <label for="rgName">Tvoje ime in priimek</label>
        <input type="text" id="rgName" autocomplete="name" required>
      </div>
      <div class="field">
        <label for="rgEmail">Tvoj e-mail</label>
        <input type="email" id="rgEmail" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="rgPass">Geslo</label>
        <input type="password" id="rgPass" autocomplete="new-password" minlength="8" required>
        <span class="hint">Vsaj 8 znakov. Ne uporabi gesla, ki ga imaš že kje drugje.</span>
      </div>
      <div class="field">
        <label for="rgCompany">Podjetje</label>
        <input type="text" id="rgCompany" autocomplete="organization">
      </div>
      <div class="field">
        <label for="rgBossName">Ime in priimek vodje</label>
        <input type="text" id="rgBossName">
      </div>
      <div class="field">
        <label for="rgBoss">E-mail vodje</label>
        <input type="email" id="rgBoss" required>
        <span class="hint">Tja gre mesečno poročilo.</span>
      </div>
      <button type="submit" class="btn primary" id="btnRegister">Ustvari račun</button>
      <div class="gate-alt">Račun že imaš? <button type="button" id="toLogin">Prijavi se</button></div>
    </form>

    <p class="gate-foot">Ure se shranjujejo sproti in so na voljo na vsaki napravi, kjer se prijaviš.</p>
  </div>
</div>
"""

SYNC = r"""
<script>
/* ------------------------------------------------------------------
   POVEZAVA S STREŽNIKOM
   Spodnjo vrstico zamenjaj z naslovom svoje Apps Script aplikacije
   (dobiš ga pri koraku "Nova uvedba" — konča se z /exec).
   ------------------------------------------------------------------ */
var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzXDD9xMb1F54kVRD8KNyNeSqPwOZO_Q1ct8ZxMdTub-huLWqRoyqU-gmJRGvosE2_8/exec";

(function () {
  "use strict";

  var K_TOKEN = "delovnik.token", K_BIO = "delovnik.bio", K_NAME = "delovnik.ime";
  var $ = function (id) { return document.getElementById(id); };

  function shrani(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function beri(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function zbrisi(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* Brez naslova strežnika teče stran samostojno, brez prijave. */
  if (SCRIPT_URL.indexOf("https://script.google.com/") !== 0) {
    document.body.classList.remove("gate");
    return;
  }

  /* ---------------- klic strežnika ---------------- */
  function poslji(telo) {
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(telo)
    }).then(function (r) { return r.json(); });
  }
  function sporocilo(el, besedilo, vrsta) {
    el.textContent = besedilo;
    el.className = "gate-msg on " + (vrsta || "err");
  }
  function pocisti(el) { el.className = "gate-msg"; }

  /* ---------------- stanje zaslona ---------------- */
  function pokazi(kateri) {
    zapriNastavitve();
    ["gateUnlock", "gateLogin", "gateRegister"].forEach(function (id) {
      $(id).hidden = id !== kateri;
    });
    document.body.classList.add("gate");
  }

  /* Modalno okno Nastavitev gre v "top layer" in njegova nevidna podlaga
     prestreže vse klike po prijavnem zaslonu. Dokler traja prijava, ga ne
     spustimo gor. */
  function zapriNastavitve() {
    var d = $("dlgSettings");
    if (!d) return;
    try { if (d.open) d.close(); } catch (e) {}
    d.removeAttribute("open");
  }
  (function zaporaNastavitev() {
    var d = $("dlgSettings");
    if (!d || d.__zaklenjeno) return;
    d.__zaklenjeno = true;
    var izvirni = d.showModal;
    d.showModal = function () {
      if (document.body.classList.contains("gate")) return;   // med prijavo ne
      return izvirni.apply(d, arguments);
    };
    // varovalka za prvih nekaj sekund, če bi se okno odprlo po drugi poti
    var strazar = setInterval(function () {
      if (document.body.classList.contains("gate")) zapriNastavitve();
    }, 120);
    setTimeout(function () { clearInterval(strazar); }, 5000);
  })();
  function vstopi() {
    document.body.classList.remove("gate");
    var d = $("dlgSettings");
    if (d && d.open) d.close();           // pozdravno okno ni več potrebno
  }

  /* ---------------- odklepanje z obrazom / prstom ---------------- */
  var b64 = function (buf) {
    var b = new Uint8Array(buf), s = "";
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  };
  var izB64 = function (t) {
    var s = atob(t), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  };
  function bioNaVoljo() {
    if (!window.PublicKeyCredential || !navigator.credentials || !window.isSecureContext) {
      return Promise.resolve(false);
    }
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(function (x) { return !!x; })
      .catch(function () { return false; });
  }
  function bioVklopi(email, ime) {
    return navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Delovnik in vožnja" },
        user: { id: new TextEncoder().encode(email), name: email, displayName: ime || email },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        attestation: "none",
        timeout: 60000
      }
    }).then(function (c) { shrani(K_BIO, b64(c.rawId)); return true; });
  }
  function bioOdkleni() {
    var id = beri(K_BIO);
    if (!id) return Promise.reject(new Error("ni prijave"));
    return navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: izB64(id) }],
        userVerification: "required",
        timeout: 60000
      }
    });
  }

  /* ---------------- prenos podatkov ---------------- */
  var pill, dot, txt;
  function status(stanje, oznaka) {
    if (!dot) return;
    dot.style.background = { idle: "#3F7D53", busy: "#96690F", bad: "#A8492C" }[stanje] || "#79838D";
    txt.nodeValue = oznaka;
    pill.title = oznaka;
    pill.setAttribute("aria-label", oznaka);
  }
  function odjava(sporocilo_) {
    zbrisi(K_TOKEN); zbrisi(K_BIO); zbrisi(K_NAME); zbrisi("delovnik.v1");
    location.reload();
  }
  function naloziSStreznika(token) {
    status("busy", "Prenašam…");
    return poslji({ action: "load", token: token }).then(function (o) {
      if (o && o.error === "seja") { odjava(); return; }
      if (o && o.ok && o.state) window.__delovnikSet(o.state);
      status("idle", "Shranjeno v oblak");
      vstopi();
    }).catch(function () {
      status("bad", "Ni povezave");
      vstopi();                            // brez povezave delaj s tem, kar je na napravi
    });
  }

  var cakalec = null, zadnje = "";
  window.__sync = function (state) {
    var token = beri(K_TOKEN);
    if (!token) return;
    clearTimeout(cakalec);
    cakalec = setTimeout(function () {
      var telo = JSON.stringify({ action: "save", token: token, state: state });
      if (telo === zadnje) return;
      status("busy", "Shranjujem…");
      fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: telo
      }).then(function (r) { return r.json(); })
        .then(function (o) {
          if (o && o.error === "seja") { odjava(); return; }
          if (o && o.ok) { zadnje = telo; status("idle", "Shranjeno v oblak"); }
          else status("bad", "Shranjevanje ni uspelo");
        })
        .catch(function () { status("bad", "Ni povezave — shranjeno na napravi"); });
    }, 1200);
  };

  window.__sendNow = function (opt) {
    var token = beri(K_TOKEN);
    status("busy", "Pošiljam…");
    return poslji({
      action: "sendNow", token: token, state: window.__delovnikGet(),
      month: opt.month, reason: opt.reason, subject: opt.subject
    }).then(function (o) {
      if (!o || !o.ok) throw new Error((o && o.message) || "napaka");
      status("idle", "Poslano vodji");
      return o;
    }).catch(function (e) { status("bad", "Pošiljanje ni uspelo"); throw e; });
  };

  /* ---------------- gumb stanja v vrhnji vrstici ---------------- */
  function postaviPill() {
    pill = document.createElement("button");
    pill.type = "button"; pill.className = "icon-btn"; pill.id = "syncPill";
    pill.style.cssText = "gap:7px;display:inline-flex;align-items:center";
    dot = document.createElement("i");
    dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:#79838D;flex:none";
    var oznaka = document.createElement("span");
    oznaka.className = "pill-txt";
    txt = document.createTextNode("");
    oznaka.appendChild(txt);
    pill.appendChild(dot); pill.appendChild(oznaka);
    var bar = document.querySelector(".topbar-in");
    if (bar) bar.insertBefore(pill, $("openArchive"));
    pill.onclick = function () {
      var t = beri(K_TOKEN);
      if (t) naloziSStreznika(t);
    };
    status("idle", "Shranjeno v oblak");
  }

  /* ---------------- račun v nastavitvah ---------------- */
  function postaviRacun() {
    var box = $("accountBox");
    if (!box) return;
    box.innerHTML =
      '<div class="divider"></div>' +
      '<div class="eyebrow" style="margin-bottom:9px">Račun</div>' +
      '<p class="note" style="margin:0 0 12px" id="accWho"></p>' +
      '<label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;cursor:pointer" id="bioWrap" hidden>' +
        '<input type="checkbox" id="bioToggle" style="margin-top:3px">' +
        '<span>Odklepanje z obrazom ali prstnim odtisom na tej napravi' +
        '<br><span class="hint">Namesto vpisovanja gesla ob vsakem odprtju.</span></span>' +
      "</label>" +
      '<div class="actions"><button type="button" class="btn ghost" id="btnLogout">Odjava</button></div>';

    $("accWho").textContent = "Prijavljen kot " + (beri(K_NAME) || "—") + ".";
    $("btnLogout").onclick = function () {
      if (confirm("Odjavim te s te naprave?\n\nUre ostanejo shranjene na strežniku.")) odjava();
    };

    bioNaVoljo().then(function (ok) {
      if (!ok) return;
      $("bioWrap").hidden = false;
      var t = $("bioToggle");
      t.checked = !!beri(K_BIO);
      t.onchange = function () {
        if (!t.checked) { zbrisi(K_BIO); window.__delovnikToast("Odklepanje izklopljeno."); return; }
        var s = window.__delovnikGet();
        bioVklopi(s.profile.email || "", s.profile.name || "")
          .then(function () { window.__delovnikToast("Odklepanje vklopljeno."); })
          .catch(function () { t.checked = false; window.__delovnikToast("Ni uspelo — poskusi znova."); });
      };
    });
  }

  /* ---------------- prijava in registracija ---------------- */
  function poPrijavi(o, ime) {
    shrani(K_TOKEN, o.token);
    shrani(K_NAME, ime || "");
    if (o.state) window.__delovnikSet(o.state);
    postaviPill(); postaviRacun(); vstopi();
    bioNaVoljo().then(function (ok) {
      if (ok && !beri(K_BIO)) {
        setTimeout(function () {
          window.__delovnikToast("V Nastavitvah lahko vklopiš odklepanje z obrazom.");
        }, 1400);
      }
    });
  }

  $("gateLogin").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var b = $("btnLogin"), m = $("gateLoginMsg");
    pocisti(m); b.disabled = true; b.textContent = "Prijavljam…";
    poslji({ action: "login", email: $("liEmail").value.trim(), password: $("liPass").value })
      .then(function (o) {
        b.disabled = false; b.textContent = "Prijava";
        if (!o || !o.ok) { sporocilo(m, (o && o.message) || "Prijava ni uspela."); return; }
        poPrijavi(o, (o.state && o.state.profile && o.state.profile.name) || $("liEmail").value.trim());
      })
      .catch(function () {
        b.disabled = false; b.textContent = "Prijava";
        sporocilo(m, "Strežnik ni dosegljiv. Preveri povezavo.");
      });
  });

  $("gateRegister").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var b = $("btnRegister"), m = $("gateRegMsg");
    pocisti(m); b.disabled = true; b.textContent = "Ustvarjam…";
    poslji({
      action: "register",
      email: $("rgEmail").value.trim(), password: $("rgPass").value,
      name: $("rgName").value.trim(), company: $("rgCompany").value.trim(),
      bossName: $("rgBossName").value.trim(), bossEmail: $("rgBoss").value.trim()
    }).then(function (o) {
        b.disabled = false; b.textContent = "Ustvari račun";
        if (!o || !o.ok) { sporocilo(m, (o && o.message) || "Registracija ni uspela."); return; }
        poPrijavi(o, $("rgName").value.trim());
      })
      .catch(function () {
        b.disabled = false; b.textContent = "Ustvari račun";
        sporocilo(m, "Strežnik ni dosegljiv. Preveri povezavo.");
      });
  });

  $("toRegister").onclick = function () { pokazi("gateRegister"); };
  $("toLogin").onclick = function () { pokazi("gateLogin"); };
  $("toLoginFromUnlock").onclick = function () { pokazi("gateLogin"); };

  /* ---------------- zagon ---------------- */
  var token = beri(K_TOKEN);
  if (!token) {
    pokazi("gateLogin");
  } else if (beri(K_BIO)) {
    pokazi("gateUnlock");
    var ime = beri(K_NAME);
    if (ime) $("gateUnlockName").textContent = "Pozdravljen, " + ime.split(" ")[0];
    var poskus = function () {
      pocisti($("gateUnlockMsg"));
      bioOdkleni()
        .then(function () { postaviPill(); postaviRacun(); naloziSStreznika(token); })
        .catch(function () { sporocilo($("gateUnlockMsg"), "Odklepanje ni uspelo. Poskusi znova ali se prijavi z geslom."); });
    };
    $("btnUnlock").onclick = poskus;
    setTimeout(poskus, 350);
  } else {
    postaviPill(); postaviRacun();
    naloziSStreznika(token);
  }
})();
</script>
"""

doc = """<!doctype html>
<html lang="sl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — evidenca delovnih ur in vožnje</title>
<meta name="description" content="{desc}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:title" content="{title} — evidenca delovnih ur in vožnje">
<meta property="og:description" content="{desc}">
<meta property="og:locale" content="sl_SI">
<meta name="theme-color" content="#1B4E9B">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Delovnik">
{links}
<style>:root{{color-scheme:light}}html,body{{background:#fff}}*{{margin:0}}img{{max-width:100%}}{gate_css}</style>
</head>
<body class="gate">
{gate_html}
{body}
{sync}
</body>
</html>
""".format(title=title, desc=DESC, links="\n".join(links), gate_css=GATE_CSS,
           gate_html=GATE_HTML, body=body.strip(), sync=SYNC)

io.open(OUT, "w", encoding="utf-8").write(doc)
print("index.html zgrajen:", len(doc), "znakov")
