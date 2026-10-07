// futures.js — calcolo colonna futures: prezzo medio e P&L
// Modello: ogni riga ha uno stato APERTA / CHIUSA.
//  - APERTE: formano la posizione netta (delta, P&L aperto, media carico)
//  - CHIUSE: P&L realizzato congelato contro la media di carico corrente
//    delle APERTE, scalano le APERTE. Il P&L realizzato entra nei totali
//    e nel grafico (via pnlFutureApertoAt in grafico.js).
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
//
// NOTA: STRUMENTI_CON_COMMISSIONI e feeLatoFutureAttiva() sono definiti in
// config.js e condivisi da tutti i moduli. NON ridichiararli qui.

  function calcolaColonna(scheda, col) {
    const movimenti = scheda[col];
    const tipo = scheda['tipo' + col];

    if (tipo === '-' || movimenti.length === 0) {
      return { righe: [], mediaPulita: NaN, pnlAperto: 0, pnlRealizzato: 0,
        pnlTotale: 0, qtaNetta: 0, qtaAssolutaCorrente: 0, tipo };
    }

    const molt = MOLTIPLICATORI[tipo];
    const spot = parseFloat(el('prezzoSpot').value) || 0;

    let qtaNetta = 0;
    let sommaPulitaPesata = 0;
    let qtaAssolutaCorrente = 0;
    let pnlRealizzatoTot = 0;

    const righe = movimenti.map(m => ({
      tipo: 'vuota', qOriginale: m.quantita || 0, prezzo: m.prezzoPulito || 0,
      direzione: m.direzione, stato: m.stato || 'APERTA',
      qAperta: 0, qChiusa: 0, mediaIngresso: 0,
      pnlRealizzato: 0, pnlAperto: 0, pnlTotale: 0
    }));

    function mediaCorrente() {
      if (qtaAssolutaCorrente === 0) return 0;
      return sommaPulitaPesata / qtaAssolutaCorrente;
    }

    // Applica una chiusura: P&L realizzato + fee round-trip.
    // Ritorna il P&L realizzato prodotto dalla parte di chiusura.
    function applicaChiusura(qta, prezzoUscita) {
      const media = mediaCorrente();
      const qChiusa = Math.min(qta, qtaAssolutaCorrente);
      if (qChiusa === 0) return 0;
      const segnoAperta = Math.sign(qtaNetta) || 1;
      const pnlRea = (prezzoUscita - media) * qChiusa * segnoAperta * molt;
      const feeRt = feeLatoFutureAttiva(tipo) * 2 * qChiusa;
      return pnlRea - feeRt;
    }

    // Riduce il pool APERTE di `qta` (in valore assoluto)
    function riduciPool(qta) {
      let da = qta;
      while (da > 0 && qtaAssolutaCorrente > 0) {
        const qRid = Math.min(da, qtaAssolutaCorrente);
        const frazione = qRid / qtaAssolutaCorrente;
        sommaPulitaPesata *= (1 - frazione);
        qtaAssolutaCorrente -= qRid;
        qtaNetta = (qtaNetta > 0 ? 1 : -1) * qtaAssolutaCorrente;
        da -= qRid;
      }
    }

    function aggiungiPool(qta, prezzo, segno) {
      const qtaConSegno = segno * qta;
      if (qtaNetta === 0 || Math.sign(qtaNetta) === segno) {
        sommaPulitaPesata += prezzo * qta;
        qtaAssolutaCorrente += qta;
        qtaNetta += qtaConSegno;
      } else {
        const qChiusa = Math.min(qta, Math.abs(qtaNetta));
        const pnl = applicaChiusura(qChiusa, prezzo);
        pnlRealizzatoTot += pnl;
        riduciPool(qChiusa);
        const qResidua = qta - qChiusa;
        if (qResidua > 0) {
          sommaPulitaPesata = prezzo * qResidua;
          qtaAssolutaCorrente = qResidua;
          qtaNetta = segno * qResidua;
        }
      }
    }

    movimenti.forEach((m, idx) => {
      if (m.attivo === false) {
        righe[idx].tipo = 'off';
        return;
      }
      const q = m.quantita || 0;
      const prezzo = m.prezzoPulito || 0;
      const segno = m.direzione === 'LONG' ? 1 : -1;
      const stato = m.stato || 'APERTA';
      righe[idx].stato = stato;
      if (q === 0) return;

      if (stato === 'CHIUSA') {
        righe[idx].tipo = 'chiusura';
        const media = mediaCorrente();
        righe[idx].mediaIngresso = media;
        const qChiusa = Math.min(q, qtaAssolutaCorrente);
        const qResidua = q - qChiusa;
        if (qChiusa > 0) {
          const pnlRea = applicaChiusura(qChiusa, prezzo);
          righe[idx].pnlRealizzato = pnlRea;
          righe[idx].qChiusa = qChiusa;
          pnlRealizzatoTot += pnlRea;
          riduciPool(qChiusa);
        }
        if (qResidua > 0) {
          righe[idx].tipo = 'mista';
          righe[idx].qAperta = qResidua;
          aggiungiPool(qResidua, prezzo, segno);
        }
      } else {
        righe[idx].tipo = 'apertura';
        righe[idx].qAperta = q;
        aggiungiPool(q, prezzo, segno);
      }
    });

    const feeAperto = feeLatoFutureAttiva(tipo);
    let pnlApertoTot = 0;
    righe.forEach(r => {
      if (r.qAperta > 0) {
        const segno = r.direzione === 'LONG' ? 1 : -1;
        const pnlLive = (spot - r.prezzo) * r.qAperta * segno * molt - feeAperto * r.qAperta;
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
