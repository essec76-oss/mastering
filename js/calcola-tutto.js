// calcola-tutto.js — ricalcolo globale e header di riepilogo
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // CALCOLA TUTTO
  // ============================================================
  function calcolaTutto() {
    const scheda = schedaAttiva();

    // v26 — Modello transazionale: ricalcola gli stati (APERTA/CHIUSA)
    // di NES e MES in base alla direzione rispetto alla posizione netta.
    // Il campo `stato` resta nel dato per compatibilità salvataggi, ma
    // non è più editabile dall'utente (niente pulsante sulla riga).
    if (typeof ricalcolaStatiSchedaAttiva === 'function') {
      ricalcolaStatiSchedaAttiva();
    }

    const resNES = calcolaColonna(scheda, 'NES');
    const resMES = calcolaColonna(scheda, 'MES');

    renderRigaTotale('NES', resNES);
    renderRigaTotale('MES', resMES);

    // v27 — il riquadro "P&L Opzioni" dell'header è stato rimosso:
    // il totale P&L NOW delle opzioni vive solo nel footer della tabella.
    // Aggiorna greche e P&L di ogni riga opzione (popola anche il footer).
    aggiornaPnlOpzioni();

    // Riepilogo minimale: PL AT NOW e PL A SCADENZA
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

    // v28 — PmG (Profitto medio giornaliero): visibile SOLO in modalità
    // futures-commodities. Giorni totali presi sempre dalla Matrice
    // (stato.schede[0]): data analisi → prima scadenza opzioni attive.
    // Anche in scheda comparazione non si usano i DTE di quella scheda.
    aggiornaPmG(scheda, pnlScad);

    // Aggiorna anteprima payoff (tutte le schede), breakeven,
    // delta totale nel riepilogo e legenda colori
    aggiornaPayoffPreview(scheda, resNES, resMES);
    aggiornaLegendaGrafico();

 
   // Autosave (debounce): ogni modifica viene comunque persistita
    autosalva();
  }

  // ============================================================
  // PmG — PROFITTO MEDIO GIORNALIERO
  // ============================================================
  // Giorni totali dell'operazione: dalla data analisi alla PRIMA scadenza
  // tra le opzioni attive della Matrice (stato.schede[0]).
  // Con una sola opzione = suo DTE; con più opzioni = scadenza più corta.
  // In scheda comparazione NON si usano i giorni residui di quella scheda.
  function giorniTotaliMatrice() {
    const matrice = stato.schede[0];
    if (!matrice || !Array.isArray(matrice.opzioni)) return 0;
    const scadenze = matrice.opzioni
      .filter(o => o && o.attivo !== false && o.scadenza)
      .map(o => new Date(o.scadenza + 'T00:00:00'))
      .filter(d => !isNaN(d.getTime()));
    if (!scadenze.length) return 0;
    const prima = new Date(Math.min(...scadenze));
    const analisi = dataAnalisiDate();
    return Math.max(0, Math.round((prima - analisi) / 86400000));
  }

  // PmG = PL a scadenza della scheda corrente (anche comparazione)
  //        / giorni totali dell'operazione presi dalla Matrice.
  // Mostra «—» se la Matrice non ha opzioni attive con scadenza.
  function aggiornaPmG(scheda, pnlScad) {
    const label = el('pmgLabel');
    const val = el('pmgValue');
    if (!label || !val) return;
    const visibile = stato.modalita === 'futures-commodities';
    label.style.display = visibile ? '' : 'none';
    val.style.display = visibile ? '' : 'none';
    if (!visibile) return;

    const giorni = giorniTotaliMatrice();
    const pmg = (giorni > 0 && isFinite(pnlScad)) ? pnlScad / giorni : NaN;
    val.textContent = isFinite(pmg) ? formatEuro(pmg) + ' /gg' : '—';
    val.className = 'rg-val ' + (!isFinite(pmg) ? 'muted' : (pmg >= 0 ? 'green' : 'red'));
  }
