// calcola-tutto.js — ricalcolo globale e header di riepilogo
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // CALCOLA TUTTO
  // ============================================================
  function calcolaTutto() {
    const scheda = schedaAttiva();
    const resNES = calcolaColonna(scheda, 'NES');
    const resMES = calcolaColonna(scheda, 'MES');

    renderRigaTotale('NES', resNES);
    renderRigaTotale('MES', resMES);

    // Header scheda: P&L delle opzioni dello strumento selezionato nel menu
    const pnlOpz = calcolaPnlOpzioniTotale(strumentoOpzSelezionato());
    el('pnlOpzioni').textContent = formatEuro(pnlOpz);
    el('pnlOpzioni').className = 'value ' + (pnlOpz >= 0 ? 'green' : 'red');

    // Aggiorna greche e P&L di ogni riga opzione
    aggiornaPnlOpzioni();

    // Riepilogo minimale: solo PL AT NOW e PL A SCADENZA
    // AT NOW  = teorico Black-76 allo spot attuale (profitto se chiudessi ora)
    // A SCADENZA = intrinseco alle scadenze + teorico residuale (calendar)
    // Entrambi includono futures + opzioni + cash (se non escluso)
    const spotVal = parseFloat(el('prezzoSpot').value) || 0;
    const pnlNowVal = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'now', resNES, resMES) : NaN;
    const pnlScad = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'expiry', resNES, resMES) : NaN;
    const pnlNowEl = el('pnlNowTot');
    pnlNowEl.textContent = formatEuro(pnlNowVal);
    pnlNowEl.className = 'big-value value ' + (!isFinite(pnlNowVal) ? 'muted' : (pnlNowVal >= 0 ? 'green' : 'red'));
    const pnlScadEl = el('pnlScadenzaTot');
    pnlScadEl.textContent = formatEuro(pnlScad);
    pnlScadEl.className = 'big-value value ' + (!isFinite(pnlScad) ? 'muted' : (pnlScad >= 0 ? 'green' : 'red'));

    // Aggiorna anteprima payoff (tutte le schede) e legenda colori
    aggiornaPayoffPreview(scheda, resNES, resMES);
    aggiornaLegendaGrafico();

    // Autosave (debounce): ogni modifica viene comunque persistita
    autosalva();
  }
