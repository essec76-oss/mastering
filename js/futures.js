// futures.js — calcolo colonna futures: prezzo medio e P&L
// Parte di Mastering: l'ordine di caricamento è definito in index.html.

  function risolviMoltiplicatore(scheda, col) {
    const tipo = scheda['tipo' + col];
    return MOLTIPLICATORI[tipo];
  }

  function nuovoMovimentoFutures(direzione) {
    return {
      attivo: true,
      direzione: direzione || 'LONG',
      quantita: 0,
      prezzoPulito: 0,
      direzioneClose: (direzione || 'LONG') === 'LONG' ? 'SHORT' : 'LONG',
      quantitaChiusa: 0,
      prezzoClose: 0,
      fee: 0
    };
  }

  function direzioneInversa(d) {
    return d === 'LONG' ? 'SHORT' : 'LONG';
  }

  function calcolaColonna(scheda, col) {
    const movimenti = scheda[col];
    const tipo = scheda['tipo' + col];

    if (tipo === '-' || !movimenti || movimenti.length === 0) {
      return { righe: [], mediaPulita: NaN, pnlAperto: 0, pnlRealizzato: 0,
        pnlTotale: 0, qtaNetta: 0, qtaAssolutaCorrente: 0, tipo, feeTotali: 0 };
    }

    const molt = risolviMoltiplicatore(scheda, col);
    const spot = parseFloat(el('prezzoSpot').value) || 0;

    let qtaNetta = 0;
    let sommaPulitaPesata = 0;
    let qtaAssolutaCorrente = 0;
    let pnlRealizzatoTot = 0;
    let feeTotAttive = 0;
    let feeResidue = 0;

    const righe = movimenti.map(m => ({
      tipo: 'vuota', qOriginale: m.quantita || 0, prezzo: m.prezzoPulito || 0,
      direzione: m.direzione, stato: m.stato || 'APERTA',
      qAperta: 0, qChiusa: 0, mediaIngresso: 0,
      pnlRealizzato: 0, pnlAperto: 0, pnlTotale: 0
    }));

    movimenti.forEach((m, idx) => {
      if (m.attivo === false) {
        righe[idx].tipo = 'off';
        return;
      }

      const qAp = m.quantita || 0;
      const prezzoOpen = m.prezzoPulito || 0;
      const segno = m.direzione === 'LONG' ? 1 : -1;
      const qCh = Math.min(m.quantitaChiusa || 0, qAp);
      const prezzoClose = m.prezzoClose || 0;
      const fee = m.fee || 0;

      feeTotAttive += fee;

      if (qAp === 0) return;

      const residuo = qAp - qCh;
      const frazChiusa = qCh / qAp;
      const feeRea = fee * frazChiusa;
      const feeRes = fee - feeRea;

      // P&L realizzato del lato chiuso (calcolato sul prezzo open della riga)
      let pnlRea = 0;
      if (qCh > 0) {
        pnlRea = (prezzoClose - prezzoOpen) * qCh * segno * molt - feeRea;
        pnlRealizzatoTot += pnlRea;
      }

      righe[idx].qChiusa = qCh;
      righe[idx].pnlRealizzato = pnlRea;
      righe[idx].mediaIngresso = prezzoOpen;
      righe[idx].stato = qCh > 0 ? 'CHIUSA' : 'APERTA';

      if (residuo > 0) {
        // La parte residua resta aperta: forma media e posizione netta
        righe[idx].tipo = qCh > 0 ? 'mista' : 'apertura';
        righe[idx].qAperta = residuo;
        sommaPulitaPesata += prezzoOpen * residuo;
        qtaAssolutaCorrente += residuo;
        qtaNetta += segno * residuo;
        feeResidue += feeRes;
      } else {
        righe[idx].tipo = 'chiusura';
      }
    });

    const segnoAperto = Math.sign(qtaNetta) || 1;
    const mediaAperta = qtaAssolutaCorrente > 0
      ? sommaPulitaPesata / qtaAssolutaCorrente : 0;
    let pnlApertoTot = 0;
    if (qtaAssolutaCorrente > 0 && spot > 0 && isFinite(mediaAperta)) {
      pnlApertoTot = (spot - mediaAperta) * qtaAssolutaCorrente * segnoAperto * molt - feeResidue;
    }

    righe.forEach(r => {
      r.pnlAperto = 0;
      r.pnlTotale = r.pnlRealizzato;
    });

    const mediaPulita = qtaAssolutaCorrente > 0
      ? sommaPulitaPesata / qtaAssolutaCorrente : NaN;

    const pnlTotale = pnlApertoTot + pnlRealizzatoTot;

    return {
      righe, mediaPulita, pnlAperto: pnlApertoTot, pnlRealizzato: pnlRealizzatoTot,
      pnlTotale, qtaNetta, qtaAssolutaCorrente, tipo, feeTotali: feeTotAttive
    };
  }
