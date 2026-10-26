// parametri-scheda.js — parametri di mercato per scheda (spot, vol, tassi, cash, data)
// Caricato dopo schede.js e storage.js, prima di eventi.js e main.js.
(function () {
  const CAMPI = [
    { id: 'prezzoSpot',  key: 'spot' },
    { id: 'volStorica',  key: 'volStorica' },
    { id: 'volAtm',      key: 'volAtm' },
    { id: 'riskFree',    key: 'riskFree' },
    { id: 'divYield',    key: 'divYield' },
    { id: 'cash',        key: 'cash' },
    { id: 'dataAnalisi', key: 'dataAnalisi' }
  ];

  // Scheda i cui parametri sono attualmente nei campi della pagina
  let _caricata = null;

  function leggi() {
    const p = {};
    CAMPI.forEach(c => {
      const e = document.getElementById(c.id);
      p[c.key] = e ? e.value : '';
    });
    return p;
  }

  function scrivi(p) {
    CAMPI.forEach(c => {
      const e = document.getElementById(c.id);
      if (!e) return;
      const v = p[c.key];
      e.value = (v === undefined || v === null) ? e.value : v;
    });
    stato.cash = parseFloat(p.cash) || 0;
    if (typeof aggiornaStileCash === 'function') aggiornaStileCash();
  }

  // Porta i campi sulla scheda attiva, se è cambiata
  function applica() {
    const s = schedaAttiva();
    if (!s || s === _caricata) return;
    // Scheda senza parametri (es. appena azzerata): usa i valori attualmente nei campi
    if (!s.par) s.par = leggi();
    scrivi(s.par);
    _caricata = s;
  }

  // Salva i campi nella scheda caricata. Non tocca mai una scheda diversa.
  function salva() {
    const s = schedaAttiva();
    if (!s || s !== _caricata) return;
    s.par = leggi();
  }

  CAMPI.forEach(c => {
    const e = document.getElementById(c.id);
    if (!e) return;
    e.addEventListener('input', salva);
    e.addEventListener('change', salva);
  });

  // Hook su calcolaTutto: viene chiamata ad ogni cambio (scheda, modifiche, comparazione)
  if (typeof window.calcolaTutto === 'function') {
    const _ct = window.calcolaTutto;
    window.calcolaTutto = function () {
      applica();
      return _ct.apply(this, arguments);
    };
  }

  // Hook su renderScheda, se è una funzione globale
  if (typeof window.renderScheda === 'function') {
    const _rs = window.renderScheda;
    window.renderScheda = function () {
      applica();
      return _rs.apply(this, arguments);
    };
  }

  // Comparazione: la nuova scheda riceve una COPIA dei parametri della scheda di partenza
  if (typeof window.creaComparazione === 'function') {
    const _cc = window.creaComparazione;
    window.creaComparazione = function () {
      salva();
      const prev = schedaAttiva();
      const risultato = _cc.apply(this, arguments);
      const nuova = schedaAttiva();
      if (nuova && prev && nuova !== prev) {
        nuova.par = { ...(prev.par || leggi()) };
      }
      _caricata = null; // forza il ricaricamento dei campi dalla nuova scheda
      applica();
      return risultato;
    };
  }
})();
