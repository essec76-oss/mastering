// opzioni.js — P&L opzioni: valore nominale, singola riga, totale
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.

  function moltOpz(opz) {
    return MOLTIPLICATORI[opz.strumento || 'MES'];
  }

  function calcolaPnlOpzione(opz) {
    if (opz.attivo === false) return 0;
    if (opz.stato === 'CHIUSA') return 0;
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    return pnlOpzioneAt(spot, opz, 'now');
  }

  function calcolaPnlOpzioniTotale(filtro) {
    return schedaAttiva().opzioni.reduce((sum, o) => {
      if (filtro && (o.strumento || 'MES') !== filtro) return sum;
      return sum + calcolaPnlOpzione(o);
    }, 0);
  }
