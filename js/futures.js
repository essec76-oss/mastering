// futures.js — calcolo colonna futures: prezzo medio e P&L
// Modello: ogni riga ha uno stato APERTA / CHIUSA.
//  - APERTE: formano la posizione netta (delta, P&L aperto, media carico)
//  - CHIUSE: P&L realizzato congelato (calcolato contro la media di carico
//    corrente delle APERTE al momento della chiusura), scalano le APERTE.
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.

  // Whitelist commissioni futures: solo NES paga fee.
  const STRUMENTI_CON_COMMISSIONI = ['NES'];
  function feeLatoFutureAttiva(tipo) {
    return STRUMENTI_CON_COMMISSIONI.includes(tipo) ? feeLatoFuture(tipo) : 0;
  }

  function calcolaColonna(scheda, col) {
    const movimenti = scheda[col];
    const tipo = scheda['tipo' + col];

    if (tipo === '-' || movimenti.length === 0) {
      return { righe: [], mediaPulita: NaN, pnlAperto: 0, pnlRealizzato: 0,
        pnlTotale: 0, qtaNetta: 0, qtaAssolutaCorrente: 0, tipo };
    }

    const molt = MOLTIPLICATORI[tipo];
    const spot = parseFloat(el('prezzoSpot').value) || 0;

    // Stato: pool di posizioni APERTE (media di carico) + P&L realizzato.
    // Ogni voce del pool: { qtaConSegno, prezzo } con qtaConSegno > 0 (long)
    // o < 0 (short). La chiusura scala dal pool usando la media di carico
    // corrente delle APERTE (non FIFO).
    let qtaNetta = 0;
    let sommaPulitaPesata = 0;       // per media di carico
    let qtaAssolutaCorrente = 0;
    let pnlRealizzatoTot = 0;

    const righe = movimenti.map(m => ({
      tipo: 'vuota', qOriginale: m.quantita || 0, prezzo: m.prezzoPulito || 0,
      direzione: m.direzione, stato: m.stato || 'APERTA',
      qAperta: 0, qChiusa: 0, mediaIngresso: 0,
      pnlRealizzato: 0, pnlAperto: 0, pnlTotale: 0
    }));

    // Media di carico corrente delle righe APERTE (calcolata sul pool)
    function mediaCorrente() {
      if (qtaAssolutaCorrente === 0) return 0;
      return sommaPulitaPesata / qtaAssolutaCorrente;
    }

    // Applica una chiusura: riduce il pool delle APERTE e aggiorna mediaPesata.
    // Ritorna il P&L realizzato prodotto dalla parte di chiusura.
    function applicaChiusura(qta, prezzoUscita, segnoUscita) {
      // qta > 0; segnoUscita = +1 (BUY chiude short) o -1 (SELL chiude long)
      const media = mediaCorrente();
      const qChiusa = Math.min(qta, qtaAssolutaCorrente);
      if (qChiusa === 0) return 0;

      // P&L realizzato: differenza fra prezzo di uscita e media di carico,
      // moltiplicata per la q.tà chiusa e il segno opposto alla posizione
      // aperta (chiudo un long vendendo, chiudo uno short comprando).
      const segnoAperta = Math.sign(qtaNetta) || segnoUscita;
      const pnlRea = (prezzoUscita - media) * qChiusa * segnoAperta * molt;
      const feeRt = feeLatoFutureAttiva(tipo) * 2 * qChiusa;
      return pnlRea - feeRt;
    }

    // Riduce il pool APERTE di `qta` (in valore assoluto)
    function riduciPool(qta) {
      let da = qta;
      while (da > 0 && qtaAssolutaCorrente > 0) {
        // riduzione proporzionale: aggiorna i contatori del pool
        const frazione = Math.min(da, qtaAssolutaCorrente) / qtaAssolutaCorrente;
        sommaPulitaPesata *= (1 - frazione);
        qtaAssolutaCorrente -= Math.min(da, qtaAssolutaCorrente);
        qtaNetta = (qtaNetta > 0 ? 1 : -1) * qtaAssolutaCorrente;
        da -= frazione * qtaAssolutaCorrente;
      }
    }

    // Aggiunge al pool una nuova apertura
    function aggiungiPool(qta, prezzo, segno) {
      const qtaConSegno = segno * qta;
      // Se il pool è vuoto o ha lo stesso segno → aggiunge
      if (qtaNetta === 0 || Math.sign(qtaNetta) === segno) {
        sommaPulitaPesata += prezzo * qta;
        qtaAssolutaCorrente += qta;
        qtaNetta += qtaConSegno;
      } else {
        // Cambio di segno: chiude la parte opposta e apre l'eccedenza
        const qChiusa = Math.min(qta, Math.abs(qtaNetta));
        const pnl = applicaChiusura(qChiusa, prezzo, segno);
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
        // Riga CHIUSA: chiude dal pool delle APERTE al prezzo di questa riga
        righe[idx].tipo = 'chiusura';
        const media = mediaCorrente();
        righe[idx].mediaIngresso = media;
        const qChiusa = Math.min(q, qtaAssolutaCorrente);
        const qResidua = q - qChiusa;
        if (qChiusa > 0) {
          const pnlRea = applicaChiusura(qChiusa, prezzo, segno);
          righe[idx].pnlRealizzato = pnlRea;
          righe[idx].qChiusa = qChiusa;
          pnlRealizzatoTot += pnlRea;
          riduciPool(qChiusa);
        }
        // Eccedenza: diventa nuova posizione aperta nel verso della riga
        if (qResidua > 0) {
          righe[idx].tipo = 'mista';
          righe[idx].qAperta = qResidua;
          aggiungiPool(qResidua, prezzo, segno);
        }
      } else {
        // Riga APERTA: aggiunge al pool
        righe[idx].tipo = 'apertura';
        righe[idx].qAperta = q;
        aggiungiPool(q, prezzo, segno);
      }
    });

    // Calcola P&L aperto a spot corrente per ogni riga APERTA
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
