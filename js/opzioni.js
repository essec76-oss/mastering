// opzioni.js — P&L opzioni: valore nominale, singola riga, totale
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // OPZIONI
  // ============================================================
  // P&L di una singola opzione:
  // - disattivata → 0
  // - CHIUSA → 0 (il realizzato va annotato nel box Cash in alto)
  // - APERTA → mark-to-market: (teorico − premio) × side × qta × 5
  //   Coerente con la curva "Now" del grafico e con il balance IBKR.
  function calcolaPnlOpzione(opz) {
    if (opz.attivo === false) return 0;
    if (opz.stato === 'CHIUSA') return 0;
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    return pnlOpzioneAt(spot, opz, 'now');
  }
  // Totale P&L opzioni: con filtro = solo dello strumento indicato,
  // senza filtro = tutti gli strumenti (riepilogo, TWS, payoff)
  function calcolaPnlOpzioniTotale(filtro) {
    return schedaAttiva().opzioni.reduce((sum, o) => {
      if (filtro && (o.strumento || 'MES') !== filtro) return sum;
      return sum + calcolaPnlOpzione(o);
    }, 0);
  }
