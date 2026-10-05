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

    el('rpmNES').textContent = isNaN(resNES.mediaPulita) ? '—' : formatPrezzo(resNES.mediaPulita);
    el('rpmMES').textContent = isNaN(resMES.mediaPulita) ? '—' : formatPrezzo(resMES.mediaPulita);

    // Header scheda: P&L delle opzioni dello strumento selezionato nel menu
    const pnlOpz = calcolaPnlOpzioniTotale(strumentoOpzSelezionato());
    el('pnlOpzioni').textContent = formatEuro(pnlOpz);
    el('pnlOpzioni').className = 'value ' + (pnlOpz >= 0 ? 'green' : 'red');

    // Aggiorna greche e P&L di ogni riga opzione
    aggiornaPnlOpzioni();

    el('rpnlNES').textContent = formatEuro(resNES.pnlTotale);
    el('rpnlNES').className = 'value ' + (resNES.pnlTotale >= 0 ? 'green' : 'red');
    el('rpnlMES').textContent = formatEuro(resMES.pnlTotale);
    el('rpnlMES').className = 'value ' + (resMES.pnlTotale >= 0 ? 'green' : 'red');
    const pnlOpzTutti = calcolaPnlOpzioniTotale();
    el('rpnlOpzioni').textContent = formatEuro(pnlOpzTutti);
    el('rpnlOpzioni').className = 'value ' + (pnlOpzTutti >= 0 ? 'green' : 'red');

    // Cash annotato (incassi esternalizzati: premi a scadenza, righe rimosse/disattivate)
    const cashInserito = (typeof stato.cash === 'number') ? stato.cash : 0;
    const cash = cashAttivo();
    el('rcash').textContent = formatEuro(cashInserito);
    el('rcash').className = 'value ' + (stato.cashEscluso ? 'muted' : (cashInserito > 0 ? 'green' : cashInserito < 0 ? 'red' : 'muted'));

    const totaleTWS = resNES.pnlTotale + resMES.pnlTotale + pnlOpzTutti + cash;
    el('totaleTWS').textContent = formatEuro(totaleTWS);
    el('totaleTWS').className = 'big-value ' + (totaleTWS >= 0 ? 'green' : 'red');

    // Titolo del totale: "TWS" solo per la Matrice, nelle comparazioni nome scheda
    const twsLabel = el('totaleTwsLabel');
    if (twsLabel) twsLabel.textContent = scheda.nome === 'Matrice'
      ? 'TOTALE FUTURES TWS'
      : 'TOTALE FUTURES — ' + scheda.nome;

    // AT NOW = teorico Black-76 allo spot attuale (profitto se chiudessi ora),
    // A SCADENZA = valutato alla prima scadenza opzioni: intrinseco per le
    // gambe che scadono in quella data, teorico col tempo residuo per le
    // gambe più lunghe (strategie calendar). Il cash annotato (se non escluso
    // col box) è compreso in entrambi.
    const spotVal = parseFloat(el('prezzoSpot').value) || 0;
    const pnlNowVal = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'now', resNES, resMES) : NaN;
    const pnlScad = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'expiry', resNES, resMES) : NaN;
    const pnlNowEl = el('pnlNowTot');
    pnlNowEl.textContent = formatEuro(pnlNowVal);
    pnlNowEl.className = 'value ' + (!isFinite(pnlNowVal) ? 'muted' : (pnlNowVal >= 0 ? 'green' : 'red'));
    const pnlScadEl = el('pnlScadenzaTot');
    pnlScadEl.textContent = formatEuro(pnlScad);
    pnlScadEl.className = 'value ' + (!isFinite(pnlScad) ? 'muted' : (pnlScad >= 0 ? 'green' : 'red'));

    // Aggiorna anteprima payoff (tutte le schede) e legenda colori
    aggiornaPayoffPreview(scheda, resNES, resMES);
    aggiornaLegendaGrafico();

    // Autosave (debounce): ogni modifica viene comunque persistita
    autosalva();
  }
