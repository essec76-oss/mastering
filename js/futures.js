// futures.js — calcolo colonna futures: prezzo medio e P&L
// Parte di Mastering: l'ordine di caricamento è definito in index.html.
//
// v31 — Modello riga unica, calcolo su PREZZO MEDIO STORICO:
//   Ogni movimento è una riga unica che contiene ENTRAMBI i lati:
//     APERTURA: direzione, quantita, prezzoPulito
//     CHIUSURA: direzioneClose, quantitaChiusa, prezzoClose
//     FEE: una sola per riga (m.fee), sottratta pro-quota al P&L.
//
//   - Il PREZZO MEDIO DI CARICO è calcolato su TUTTE le quantità aperte
//     originarie. Chiudere una posizione NON altera il prezzo medio.
//   - La CHIUSURA (quantitaChiusa) riduce la posizione netta.
//   - P&L REALIZZATO (RLZD) di ogni riga = (prezzoClose - prezzoMedio) * qChiusa * segno * molt.
//   - P&L APERTO = (spot - prezzoMedio) * qResidua * segno * molt.
//   - P&L TOTALE = Realizzato + Aperto.

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

    let sommaPulitaStorica = 0;
    let qtaStoricaAperta = 0; // Quantità originaria (non chiusa)
    let qtaNetta = 0; // Quantità attualmente detenuta
    let pnlRealizzatoTot = 0;
    let feeTotAttive = 0;
    let feeResidue = 0;

    // 1. Calcolo del Prezzo Medio Storico (su tutte le quantità aperte originarie)
    movimenti.forEach(m => {
      if (m.attivo === false) return;
      const qAp = m.quantita || 0;
      const prezzoOpen = m.prezzoPulito || 0;
      if (qAp > 0) {
        sommaPulitaStorica += prezzoOpen * qAp;
        qtaStoricaAperta += qAp;
      }
    });

    const prezzoMedioStorico = qtaStoricaAperta > 0
      ? sommaPulitaStorica / qtaStoricaAperta : 0;

    const righe = movimenti.map(m => ({
      tipo: 'vuota', qOriginale: m.quantita || 0, prezzo: m.prezzoPulito || 0,
      direzione: m.direzione, stato: m.stato || 'APERTA',
      qAperta: 0, qChiusa: 0, mediaIngresso: 0,
      pnlRealizzato: 0, pnlAperto: 0, pnlTotale: 0
    }));

    // 2. Calcolo delle singole righe (chiusure e residui)
    movimenti.forEach((m, idx) => {
      if (m.attivo === false) {
        righe[idx].tipo = 'off';
        return;
      }

      const qAp = m.quantita || 0;
      const segno = m.direzione === 'LONG' ? 1 : -1;
      const qCh = Math.min(m.quantitaChiusa || 0, qAp);
      const prezzoClose = m.prezzoClose !== undefined && m.prezzoClose !== 0 
        ? m.prezzoClose 
        : (qCh > 0 ? spot : 0); // Se non specificato, chiude a mercato (spot)
      const fee = m.fee || 0;

      feeTotAttive += fee;

      if (qAp === 0) return;

      const residuo = qAp - qCh;
      const frazChiusa = qCh / qAp;
      const feeRea = fee * frazChiusa;
      const feeRes = fee - feeRea;

      // P&L realizzato: usa il PREZZO MEDIO STORICO della colonna, non il prezzo della singola riga
      let pnlRea = 0;
      if (qCh > 0) {
        pnlRea = (prezzoClose - prezzoMedioStorico) * qCh * segno * molt - feeRea;
        pnlRealizzatoTot += pnlRea;
      }

      righe[idx].qChiusa = qCh;
      righe[idx].pnlRealizzato = pnlRea;
      righe[idx].mediaIngresso = prezzoMedioStorico;
      righe[idx].stato = qCh > 0 ? 'CHIUSA' : 'APERTA';

      if (residuo > 0) {
        righe[idx].tipo = qCh > 0 ? 'mista' : 'apertura';
        righe[idx].qAperta = residuo;
        qtaNetta += segno * residuo;
        feeResidue += feeRes;
      } else {
        righe[idx].tipo = 'chiusura';
      }
    });

    // 3. P&L Aperto (basato sul prezzo medio storico e sulle quantità residue)
    const segnoAperto = Math.sign(qtaNetta) || 1;
    const qtaAssolutaCorrente = Math.abs(qtaNetta);
    let pnlApertoTot = 0;
    
    if (qtaAssolutaCorrente > 0 && spot > 0) {
      pnlApertoTot = (spot - prezzoMedioStorico) * qtaAssolutaCorrente * segnoAperto * molt - feeResidue;
    }

    righe.forEach(r => {
      r.pnlAperto = 0;
      r.pnlTotale = r.pnlRealizzato; // Il P&L totale di riga è solo quello realizzato
    });

    const pnlTotale = pnlApertoTot + pnlRealizzatoTot;

    return {
      righe, mediaPulita: prezzoMedioStorico, pnlAperto: pnlApertoTot, pnlRealizzato: pnlRealizzatoTot,
      pnlTotale, qtaNetta, qtaAssolutaCorrente, tipo, feeTotali: feeTotAttive
    };
  }
