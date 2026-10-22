// opzioni.js — P&L opzioni: valore nominale, singola riga, totale
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // OPZIONI
  // ============================================================
  //
  // v29 — Override moltiplicatore commodities:
  //   moltOpz(opz) risolve il moltiplicatore contrattuale dell'opzione.
  //   - azioni / indici → MOLTIPLICATORI[strumento] standard
  //   - commodities con strumento 'custom' → usa scheda.moltiplicatoreCommodity
  //     (fallback su MOLTIPLICATORI.ZW)
  //   Tutte le funzioni che prima usavano MOLTIPLICATORI[opz.strumento]
  //   devono passare da moltOpz(opz) per coerenza con il sottotitolo/colonne.
  //
  function moltOpz(opz) {
    const strumento = (opz && opz.strumento) || 'MES';
    const isComm = (typeof stato !== 'undefined' && stato.modalita === 'futures-commodities');
    if (isComm && strumento === 'custom') {
      const scheda = schedaAttiva();
      const v = parseFloat(scheda && scheda.moltiplicatoreCommodity);
      if (isFinite(v) && v > 0) return v;
      return MOLTIPLICATORI.ZW || 50;
    }
    return MOLTIPLICATORI[strumento];
  }

  // P&L di una singola opzione:
  // - disattivata → 0
  // - CHIUSA → 0 (il realizzato va annotato nel box Cash in alto)
  // - APERTA → mark-to-market: (teorico − premio) × side × qta × molt
  //   Se premio vuoto/0: usa il TEORICO CORRENTE come prezzo di carico
  //   (P&L now = 0 → coerente con "opzione non ancora caricata a prezzo fisso")
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
