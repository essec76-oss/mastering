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
      feeOpen: 0,
      feeClose: 0
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
    const spotFront = parseFloat(el('prezzoSpot').value) || 0;
    // Back (MES): contango/backwardation → valuta al livello Front + basis
    // così il P&L del Back non è distorto dallo spot di Front puro.
    const basis = (col === 'MES') ? (parseFloat(scheda.basis) || 0) : 0;
    const spot = (col === 'MES') ? (spotFront + basis) : spotFront;

    let qtaNetta = 0;
    let sommaPulitaPesata = 0;
    let qtaAssolutaCorrente = 0;
    let pnlRealizzatoTot = 0;
    let feeTotAttive = 0;

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

      // Compatibilità: se esiste ancora il vecchio campo unico "fee", lo tratta come feeOpen
      const feeOpen = (typeof m.feeOpen === 'number') ? m.feeOpen
        : ((typeof m.fee === 'number') ? m.fee : 0);
      const feeClose = (typeof m.feeClose === 'number') ? m.feeClose : 0;

      feeTotAttive += feeOpen + feeClose;

      if (qAp === 0) return;

      const residuo = qAp - qCh;

      // --- LOGICA FEE CAPITALIZZATE NEL PREZZO MEDIO ---
      // Se LONG, la fee aumenta il prezzo di carico. Se SHORT, lo diminuisce.
      const impattoFeeSuPrezzo = (feeOpen / qAp) * segno;
      const prezzoCaricoSporco = prezzoOpen + impattoFeeSuPrezzo;

      // P&L Realizzato (usiamo il prezzo sporco e NON sottraiamo più le fee)
      let pnlRea = 0;
      if (qCh > 0) {
        const basePrezzo = (m.prezzoMedioChiusura && m.prezzoMedioChiusura.prezzo)
          ? m.prezzoMedioChiusura.prezzo
          : prezzoCaricoSporco;
        pnlRea = (prezzoClose - basePrezzo) * qCh * segno * molt;
        pnlRealizzatoTot += pnlRea;
      }

      righe[idx].qChiusa = qCh;
      righe[idx].pnlRealizzato = pnlRea;
      righe[idx].mediaIngresso = prezzoCaricoSporco;
      righe[idx].stato = qCh > 0 ? 'CHIUSA' : 'APERTA';

      if (residuo > 0) {
        righe[idx].tipo = qCh > 0 ? 'mista' : 'apertura';
        righe[idx].qAperta = residuo;
        
        // Aggiungiamo al calcolo della media ponderata usando il prezzo sporco
        sommaPulitaPesata += prezzoCaricoSporco * residuo;
        
        qtaAssolutaCorrente += residuo;
        qtaNetta += segno * residuo;
      } else {
        righe[idx].tipo = 'chiusura';
      }
    });

    const segnoAperto = Math.sign(qtaNetta) || 1;
    
    // Calcolo media ponderata (sporca di fee)
    const mediaAperta = qtaAssolutaCorrente > 0
      ? sommaPulitaPesata / qtaAssolutaCorrente : 0;

    // Calcolo P&L Aperto (usiamo il prezzo medio già sporco di fee)
    let pnlApertoTot = 0;
    if (qtaAssolutaCorrente > 0 && spot > 0 && isFinite(mediaAperta)) {
      pnlApertoTot = (spot - mediaAperta) * qtaAssolutaCorrente * segnoAperto * molt;
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
