// parametri-scheda.js — parametri di mercato per scheda (spot, vol, tassi, cash, data)
// Caricato dopo schede.js e storage.js, prima di eventi.js e main.js.
(function () {
  // Campi di input che appartengono alla scheda
  const CAMPI = [
    { id: 'prezzoSpot', key: 'spot' },
    { id: 'volAtm',     key: 'volAtm' },
    { id: 'riskFree',   key: 'riskFree' },
    { id: 'divYield',   key: 'divYield' },
    { id: 'dataAnalisi', key: 'dataAnalisi' },
    { id: 'cash',       key: 'cash' }
  ];

  function leggiDaInput() {
    const p = {};
    CAMPI.forEach(c => {
      const e = document.getElementById(c.id);
      p[c.key] = e ? e.value : '';
    });
    return p;
  }

  function scriviSuInput(p) {
    CAMPI.forEach(c => {
      const e = document.getElementById(c.id);
      if (!e) return;
      let v = p[c.key];
      if (v === undefined || v === null || v === '') {
        if (c.key === 'dataAnalisi') v = dataOggiIso();
        else if (c.key === 'cash') v = '0';
        else v = e.value; // mantieni il valore attuale se il parametro manca
      }
      e.value = v;
    });
    stato.cash = parseFloat(p.cash) || 0;
    if (typeof aggiornaStileCash === 'function') aggiornaStileCash();
  }

  // Scheda la cui configurazione è attualmente visibile nei campi
  let _schedaCaricata = null;

  // Carica i parametri della scheda attiva nei campi, se è cambiata
  function sincronizzaParametri() {
    const s = schedaAttiva();
    if (!s) return;
    if (!s.par) s.par = leggiDaInput();
    if (s !== _schedaCaricata) {
      scriviSuInput(s.par);
      _schedaCaricata = s;
    }
  }

  // Salva i valori dei campi nella scheda attiva
  function salvaDaInput() {
    const s = schedaAttiva();
    if (!s) return;
    s.par = leggiDaInput();
  }

  // Ogni modifica di un campo finisce nella scheda attiva
  CAMPI.forEach(c => {
    const e = document.getElementById(c.id);
    if (!e) return;
    e.addEventListener('input', salvaDaInput);
    e.addEventListener('change', salvaDaInput);
  });

  // Quando si mostra una scheda, carica i suoi parametri prima di disegnarla
  const _renderSchedaOrig = window.renderScheda;
  window.renderScheda = function () {
    sincronizzaParametri();
    return _renderSchedaOrig.apply(this, arguments);
  };

  // Quando si crea una comparazione, la nuova scheda riceve una COPIA dei parametri
  const _creaComparazioneOrig = window.creaComparazione;
  window.creaComparazione = function () {
    salvaDaInput();
    const prev = schedaAttiva();
    const risultato = _creaComparazioneOrig.apply(this, arguments);
    const nuova = schedaAttiva();
    if (nuova && prev && nuova !== prev) {
      if (!nuova.par || nuova.par === prev.par) {
        nuova.par = { ...(prev.par || leggiDaInput()) };
      }
    }
    _schedaCaricata = null; // forza il caricamento dei parametri della nuova scheda
    sincronizzaParametri();
    return risultato;
  };

  // Primo avvio: se la scheda ha già parametri, li carica
  window.addEventListener('DOMContentLoaded', () => {
    _schedaCaricata = null;
  });
})();
