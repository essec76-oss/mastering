// calcola-tutto.js — ricalcolo globale e header di riepilogo
// Parte di Mastering (già app.js): l'ordine di caricamento è definito in index.html.
// v27 — P&L lordo: nessun riferimento a commissioni.

  function calcolaTutto() {
    const scheda = schedaAttiva();

    if (typeof ricalcolaStatiSchedaAttiva === 'function') {
      ricalcolaStatiSchedaAttiva();
    }

    const resNES = calcolaColonna(scheda, 'NES');
    const resMES = calcolaColonna(scheda, 'MES');

    renderRigaTotale('NES', resNES);
    renderRigaTotale('MES', resMES);

    // Header scheda: P&L delle opzioni dello strumento selezionato nel menu
    const pnlOpz = calcolaPnlOpzioniTotale(strumentoOpzSelezionato());
    el('pnlOpzioni').textContent = formatEuro(pnlOpz);
    el('pnlOpzioni').className = 'value ' + (pnlOpz >= 0 ? 'green' : 'red');

    aggiornaPnlOpzioni();

    const spotVal = parseFloat(el('prezzoSpot').value) || 0;
    const pnlNowVal = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'now', resNES, resMES) : NaN;
    const pnlScad = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'expiry', resNES, resMES) : NaN;
    const pnlNowEl = el('pnlNowTot');
    pnlNowEl.textContent = formatEuro(pnlNowVal);
    pnlNowEl.className = 'big-value value ' + (!isFinite(pnlNowVal) ? 'muted' : (pnlNowVal >= 0 ? 'green' : 'red'));
    const pnlScadEl = el('pnlScadenzaTot');
    pnlScadEl.textContent = formatEuro(pnlScad);
    pnlScadEl.className = 'big-value value ' + (!isFinite(pnlScad) ? 'muted' : (pnlScad >= 0 ? 'green' : 'red'));

    aggiornaPayoffPreview(scheda, resNES, resMES);
    aggiornaLegendaGrafico();

    autosalva();
  }
