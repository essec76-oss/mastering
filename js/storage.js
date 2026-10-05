// storage.js — persistenza localStorage, migrazioni e stato di salvataggio
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // UTILITY
  // ============================================================
  let autosaveTimer = null;
  function autosalva() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => salva(true), 800);
  }
  // Flush immediato alla chiusura della pagina
  window.addEventListener('beforeunload', () => {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
      salva(true);
    }
  });

  function salva(silent) {
    const dati = {
      prezzoSpot: parseFloat(el('prezzoSpot').value) || 0,
      riskFree: parseFloat(el('riskFree').value) || 0,
      volAtm: parseFloat(el('volAtm').value) || 0,
      divYield: parseFloat(el('divYield') && el('divYield').value) || 0,
      cash: parseFloat(el('cash').value) || 0,
      cashEscluso: !!stato.cashEscluso,
      commissioniOn: commissioniAttive(),
      dataAnalisi: el('dataAnalisi') ? (el('dataAnalisi').value || '') : '',
      tipoNES: el('tipoNES').value,
      tipoMES: el('tipoMES').value,
      attiva: stato.attiva,
      schede: stato.schede
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dati));
      if (!silent) mostraStatus('✓ Salvato');
    } catch (e) { mostraStatus('Errore salvataggio', true); }
  }

  function carica() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      for (const k of STORAGE_KEYS_LEGACY) {
        if (raw) break;
        raw = localStorage.getItem(k);
      }
      if (!raw) return false;
      const dati = JSON.parse(raw);
      if (typeof dati.prezzoSpot === 'number') el('prezzoSpot').value = dati.prezzoSpot;
      if (typeof dati.riskFree === 'number') el('riskFree').value = dati.riskFree;
      if (typeof dati.volAtm === 'number') el('volAtm').value = dati.vo
lAtm;
      if (typeof dati.divYield === 'number' && el('divYield')) el('divYield').value = dati.divYield;
      if (typeof dati.cash === 'number') { el('cash').value = dati.cash; stato.cash = dati.cash; aggiornaStileCash(); }
      stato.cashEscluso = dati.cashEscluso === true;
      if (el('cashEscludi')) el('cashEscludi').checked = stato.cashEscluso;
      if (el('commissioniOn')) el('commissioniOn').checked = dati.commissioniOn !== false;
      if (typeof dati.dataAnalisi === 'string' && dati.dataAnalisi) el('dataAnalisi').value = dati.dataAnalisi;
      if (dati.tipoNES) el('tipoNES').value = dati.tipoNES;
      if (dati.tipoMES) el('tipoMES').value = dati.tipoMES;
      if (Array.isArray(dati.schede) && dati.schede.length) {
        stato.schede = dati.schede.map(migraScheda);
      } else if (Array.isArray(dati.NES) || Array.isArray(dati.MES) || Array.isArray(dati.opzioni)) {
        // v18 e precedenti: una sola scheda → diventa la Matrice
        stato.schede = [migraScheda({
          nome: 'Matrice',
          tipoNES: dati.tipoNES || 'NES',
          tipoMES: dati.tipoMES || 'MES',
          NES: dati.NES, MES: dati.MES,
          opzioni: dati.opzioni,
          strumentoOpzioni: dati.strumentoOpzioni || 'MES'
        })];
      }
      stato.attiva = Math.max(0, Math.min(stato.schede.length - 1, dati.attiva || 0));
      return true;
    } catch (e) { return false; }
  }

  // Migrazione di una scheda (dati vecchi/corrotti non rompono nulla)
  function migraScheda(s) {
    return {
      nome: s.nome || 'Matrice',
      tipoNES: s.tipoNES || 'NES',
      tipoMES: s.tipoMES || 'MES',
      NES: Array.isArray(s.NES) ? s.NES.map(migraMov) : [],
      MES: Array.isArray(s.MES) ? s.MES.map(migraMov) : [],
      opzioni: Array.isArray(s.opzioni) ? s.opzioni.map(migraOpz) : [],
      strumentoOpzioni: s.strumentoOpzioni || 'MES'
    };
  }

  function migraMov(m) {
    if (m.prezzoPulito === undefined) m.prezzoPulito = m.prezzo || 0;
    delete m.prezzo;
  
  if (m.attivo === undefined) m.attivo = true;
    return m;
  }

  function migraOpz(o) {
    return {
      attivo: o.attivo !== false,
      strumento: o.strumento || 'MES',
      pos: o.pos || 'SELL',
      tipo: o.tipo || 'PUT',
      qta: o.qta || 0,
      assgn: !!o.assgn,
      strike: o.strike || 0,
      premio: o.premio || 0,
      vol: o.vol || 0,
      scadenza: o.scadenza || '',
      rlzd: (o.rlzd === undefined || o.rlzd === null) ? '' : o.rlzd,
      stato: o.stato === 'CHIUSA' ? 'CHIUSA' : 'APERTA'
    };
  }

  function reset() {
    if (!confirm('Vuoi davvero azzerare tutti i dati?\n\nIl foglio tornerà completamente vuoto, pronto per nuovi inserimenti.')) return;
    localStorage.removeItem(STORAGE_KEY);
    STORAGE_KEYS_LEGACY.forEach(k => localStorage.removeItem(k));
    stato.schede = [{
      nome: 'Matrice',
      tipoNES: '-', tipoMES: '-',
      NES: [], MES: [], opzioni: [],
      strumentoOpzioni: 'MES'
    }];
    stato.attiva = 0;
    el('prezzoSpot').value = '';
    el('riskFree').value = 0;
    el('volAtm').value = 0;
    if (el('divYield')) el('divYield').value = 0;
    el('cash').value = 0;
    stato.cash = 0;
    aggiornaStileCash();
    stato.cashEscluso = false;
    if (el('cashEscludi')) el('cashEscludi').checked = false;
    if (el('commissioniOn')) el('commissioniOn').checked = true;
    el('dataAnalisi').value = dataOggiIso();
    el('tipoNES').value = '-';
    el('tipoMES').value = '-';
    if (el('strumentoOpzioni')) el('strumentoOpzioni').value = 'MES';
    if (typeof chartView !== 'undefined') {
      chartView.xMin = null; chartView.xMax = null;
      chartView.baseMin = null; chartView.baseMax = null;
      chartView._sig = null;
    }
    renderTabs();
    renderScheda();
    mostraStatus('✓ Foglio azzerato');
  }

  let statusTimer = null;
  function mostraStatus(txt, err) {
    const s = el('saveStatus');
    s.textContent = txt;
    s.style.color = err ? 'var(--red)' : 'var(--green)';
    s.classList.add('show');
  
  clearTimeout(statusTimer);
    statusTimer = setTimeout(() => s.classList.remove('show'), 1800);
  }
