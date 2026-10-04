// futures.js — calcolo colonna futures: prezzo medio e P&L
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // CALCOLO COLONNA
  // ============================================================
  function calcolaColonna(scheda, col) {
    const movimenti = scheda[col];
    const tipo = scheda['tipo' + col];

    if (tipo === '-' || movimenti.length === 0) {
      return { righe: [], mediaPulita: NaN, pnlAperto: 0, pnlRealizzato: 0,
        pnlTotale: 0, qtaNetta: 0, qtaAssolutaCorrente: 0, tipo };
    }

    const molt = MOLTIPLICATORI[tipo];
    const spot = parseFloat(el('prezzoSpot').value) || 0;

    let qtaNetta = 0, sommaPulitaPesata = 0, qtaAssolutaCorrente = 0, pnlRealizzatoTot = 0;

    const righe = movimenti.map(m => ({
      tipo: 'vuota', qOriginale: m.quantita || 0, prezzo: m.prezzoPulito || 0,
      direzione: m.direzione, qAperta: 0, qChiusa: 0, mediaIngresso: 0,
      pnlRealizzato: 0, pnlAperto: 0, pnlTotale: 0
    }));

    const fifo = [];

    movimenti.forEach((m, idx) => {
      // Riga disattivata: esclusa da FIFO, P&L, media e payoff
      if (m.attivo === false) {
        righe[idx].tipo = 'off';
        return;
      }
      const q = m.quantita || 0;
      const prezzo = m.prezzoPulito || 0;
      const segno = m.direzione === 'LONG' ? 1 : -1;
      const qtaConSegno = segno * q;
      if (q === 0) return;

      const segnoPos = Math.sign(qtaNetta);

      if (segnoPos === 0 || segnoPos === segno) {
        // APERTURA
        righe[idx].tipo = 'apertura';
        righe[idx].qAperta = q;
        fifo.push({ rowIdx: idx, qta: q, prezzo, segno });

        qtaNetta += qtaConSegno;
        sommaPulitaPesata += prezzo * q;
        qtaAssolutaCorrente += q;
      } else {
        // CHIUSURA
        righe[idx].tipo = 'chiusura';
        const mediaIngresso = qtaAssolutaCorrente > 0
          ? sommaPulitaPesata / qtaAssolutaCorrente : 0;
        const qtaChiusa = Math.min(Math.abs(qtaConSegno), Math.abs(qtaNetta));
        const qtaApre = q - qtaChiusa;

        const pnlRea = (prezzo - mediaIngresso) * qtaChiusa * segnoPos * molt
                     - FEE_ROUND_TRIP * qtaChiusa;
        righe[idx].pnlRealizzato = pnlRea;
        righe[idx].qChiusa = qtaChiusa;
        righe[idx].mediaIngresso = mediaIngresso;

        pnlRealizzatoTot += pnlRea;

        let daChiudere = qtaChiusa;
        while (daChiudere > 0 && fifo.length > 0) {
          const f = fifo[0];
          const qc = Math.min(daChiudere, f.qta);
          f.qta -= qc;
          righe[f.rowIdx].qAperta -= qc;
          righe[f.rowIdx].qChiusa += qc;
          daChiudere -= qc;
          if (f.qta === 0) fifo.shift();
        }

        if (qtaApre > 0) {
          righe[idx].qAperta = qtaApre;
          righe[idx].tipo = 'mista';
          fifo.push({ rowIdx: idx, qta: qtaApre, prezzo, segno });
        }

        const vecchioSegno = segnoPos;
        qtaNetta += qtaConSegno;
        if (qtaNetta === 0) { sommaPulitaPesata = 0; qtaAssolutaCorrente = 0; }
        else if (Math.sign(qtaNetta) !== vecchioSegno) {
          sommaPulitaPesata = prezzo * Math.abs(qtaNetta);
          qtaAssolutaCorrente = Math.abs(qtaNetta);
        } else {
          const frazione = Math.abs(qtaNetta) / qtaAssolutaCorrente;
          sommaPulitaPesata *= frazione;
          qtaAssolutaCorrente = Math.abs(qtaNetta);
        }
      }
    });

    let pnlApertoTot = 0;
    righe.forEach(r => {
      if (r.qAperta > 0) {
        const segno = r.direzione === 'LONG' ? 1 : -1;
        const pnlLive = (spot - r.prezzo) * r.qAperta * segno * molt
                      - FEE_ROUND_TRIP * r.qAperta;
        r.pnlAperto = pnlLive;
        pnlApertoTot += pnlLive;
      }
      r.pnlTotale = r.pnlAperto + r.pnlRealizzato;
    });

    const mediaPulita = qtaAssolutaCorrente > 0
      ? sommaPulitaPesata / qtaAssolutaCorrente : NaN;

    const pnlTotale = pnlApertoTot + pnlRealizzatoTot;

    return {
      righe, mediaPulita, pnlAperto: pnlApertoTot, pnlRealizzato: pnlRealizzatoTot,
      pnlTotale, qtaNetta, qtaAssolutaCorrente, tipo
    };
  }
