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
    // futures-commodities. Riferimento SEMPRE la Matrice (stato.schede[0]):
    // sia i giorni totali (data analisi → prima scadenza opzioni attive)
    // sia il PL a scadenza. In qualunque scheda ti trovi (anche in
    // comparazione, anche alterando la data) il PmG resta quello
    // dell'operazione della Matrice.
    aggiornaPmG();

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
  // Data analisi della Matrice: i parametri sono per-scheda
  // (parametri-scheda.js li salva in scheda.par). Quando sei in una
  // comparazione gli input della pagina contengono i parametri di
  // QUELLA scheda: per la Matrice si legge sempre da matrice.par.
  function parMatrice(matrice) {
    return (matrice && matrice.par) ? matrice.par : null;
  }

  function dataAnalisiMatrice(matrice) {
    const p = parMatrice(matrice);
    if (p && p.dataAnalisi) return p.dataAnalisi;
    return el('dataAnalisi') ? el('dataAnalisi').value : dataOggiIso();
  }

  // Giorni totali dell'operazione: dalla data analisi della MATRICE
  // alla PRIMA scadenza tra le opzioni attive della Matrice.
  // La data della Matrice resta quella di apertura dell'operazione,
  // quindi il risultato è la durata COMPLETA originaria (es. 180 gg),
  // a prescindere dal tempo trascorso e dalla scheda in cui ti trovi.
  function giorniTotaliMatrice() {
    const matrice = stato.schede[0];
    if (!matrice || !Array.isArray(matrice.opzioni)) return 0;
    const scadenze = matrice.opzioni
      .filter(o => o && o.attivo !== false && o.scadenza)
      .map(o => new Date(o.scadenza + 'T00:00:00'))
      .filter(d => !isNaN(d.getTime()));
    if (!scadenze.length) return 0;
    const prima = new Date(Math.min(...scadenze));
    const analisi = new Date(dataAnalisiMatrice(matrice) + 'T00:00:00');
    return Math.max(0, Math.round((prima - analisi) / 86400000));
  }

  // PmG = PL a scadenza della MATRICE
  //        / giorni totali dell'operazione della MATRICE.
  // Tutto è calcolato sulla Matrice (stato.schede[0]): in qualunque
  // scheda ti trovi (anche comparazione con data alterata) il valore
  // resta quello dell'operazione della Matrice.
  // Mostra «—» se la Matrice non ha opzioni attive con scadenza.
  function aggiornaPmG() {
    const label = el('pmgLabel');
    const val = el('pmgValue');
    if (!label || !val) return;
    const visibile = stato.modalita === 'futures-commodities';
    label.style.display = visibile ? '' : 'none';
    val.style.display = visibile ? '' : 'none';
    if (!visibile) return;

    const matrice = stato.schede[0];
    const giorni = giorniTotaliMatrice();

    // PL a scadenza della Matrice: ricalcola le colonne della Matrice
    // (NON della scheda attiva) con TUTTI i parametri della Matrice
    // (spot, vol, risk-free, div, cash, data analisi — salvati in
    // matrice.par da parametri-scheda.js). Durante il calcolo gli
    // input della pagina vengono temporaneamente impostati sui
    // parametri della Matrice e poi ripristinati su quelli della
    // scheda attiva (il set programmatico NON fa scattare gli event
    // listener 'input'/'change', quindi nessun ricalcolo a catena).
    let pnlScadMatrice = NaN;
    const parM = parMatrice(matrice);
    if (matrice && parM) {
      const CAMPI_SWAP = ['prezzoSpot', 'volStorica', 'volAtm', 'riskFree',
                          'divYield', 'cash', 'dataAnalisi'];
      const precedenti = {};
      CAMPI_SWAP.forEach(id => {
        const e = el(id);
        if (e) precedenti[id] = e.value;
      });
      const cashPrecedente = stato.cash;
      try {
        CAMPI_SWAP.forEach(id => {
          const e = el(id);
          if (!e) return;
          const v = parM[id === 'prezzoSpot' ? 'spot' : id];
          if (v !== undefined && v !== null && v !== '') e.value = v;
        });
        const spotVal = parseFloat(el('prezzoSpot').value) || 0;
        stato.cash = parseFloat(parM.cash) || 0;
        if (spotVal > 0) {
          const resM_NES = calcolaColonna(matrice, 'NES');
          const resM_MES = calcolaColonna(matrice, 'MES');
          pnlScadMatrice = pnlCombinatoAt(matrice, spotVal, 'expiry', resM_NES, resM_MES);
        }
      } catch (e) {
        pnlScadMatrice = NaN;
      } finally {
        CAMPI_SWAP.forEach(id => {
          const e = el(id);
          if (e && precedenti[id] !== undefined) e.value = precedenti[id];
        });
        stato.cash = cashPrecedente;
      }
    }

    const pmg = (giorni > 0 && isFinite(pnlScadMatrice)) ? pnlScadMatrice / giorni : NaN;
    val.textContent = isFinite(pmg) ? formatEuro(pmg) + ' /gg' : '—';
    val.className = 'rg-val ' + (!isFinite(pmg) ? 'muted' : (pmg >= 0 ? 'green' : 'red'));
  }
