// futures.js — calcolo colonna futures: prezzo medio e P&L
// Parte di Mastering: l'ordine di caricamento è definito in index.html.
//
// v29 — Modello riga unica apertura+chiusura (con fee):
//   Ogni movimento è una riga unica che contiene ENTRAMBI i lati:
//     APERTURA: dataOpen, direzione (BUY/SELL), quantita, prezzoPulito, feeOpen
//     CHIUSURA: dataClose, direzioneClose (inversa automatica di direzione),
//               quantitaChiusa, prezzoClose, feeClose
//   - La chiusura può essere parziale: quantitaChiusa <= quantita.
//     Il residuo (quantita - quantitaChiusa) resta aperto e forma la
//     posizione netta / media carico della colonna.
//   - P&L realizzato della riga (RLZD), fee INCLUSE:
//       (prezzoClose - prezzoOpen) * qChiusa * segno * molt
//       - feeClose - feeOpen * (qChiusa / qAperta)
//     La parte di feeOpen proporzionale alla parte ancora aperta resta
//     caricata sul P&L aperto (non si perde).
//   - Fee defaults: se l'utente non ha modificato a mano il campo fee,
//     il render (render-futures.js) lo stima automaticamente come
//     feeLatoFutureAttiva(tipo) * quantita.
//   - Retrocompatibilità: movimenti salvati senza campi chiusura
//     (quantitaChiusa, prezzoClose, fee*) sono trattati come APERTE
//     (fallback || 0). Nessuna migrazione richiesta.
//
// NOTA: STRUMENTI_CON_COMMISSIONI e feeLatoFutureAttiva() sono definiti in
// config.js e condivisi da tutti i moduli. NON ridichiararli qui.

  function risolviMoltiplicatore(scheda, col) {
    const tipo = scheda['tipo' + col];
    return MOLTIPLICATORI[tipo];
  }

  // Movimento di default (v29). Usalo quando in eventi.js si preme
  // "+ Aggiungi movimento": scheda[col].push(nuovoMovimentoFutures()).
  // I vecchi push senza questi campi continuano a funzionare (fallback || 0).
  function nuovoMovimentoFutures(direzione) {
    return {
      attivo: true,
      dataOpen: '',
      direzione: direzione || 'LONG',
      quantita: 0,
      prezzoPulito: 0,
      feeOpen: 0,
      feeOpenManuale: false,
      dataClose: '',
      direzioneClose: (direzione || 'LONG') === 'LONG' ? 'SHORT' : 'LONG',
      quantitaChiusa: 0,
      prezzoClose: 0,
      feeClose: 0,
      feeCloseManuale: false
    };
  }

  // Direzione inversa (BUY -> SELL, SELL -> BUY)
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
    let feeOpenResidue = 0; // quota di feeOpen della parte ancora aperta

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
      const feeOpen = m.feeOpen || 0;
      const feeClose = m.feeClose || 0;

      feeTotAttive += feeOpen + feeClose;

      if (qAp === 0) return;

      const residuo = qAp - qCh;
      // Quota di feeOpen imputata alla parte chiusa (proporzionale)
      const frazChiusa = qCh / qAp;
      const feeOpenRea = feeOpen * frazChiusa;
      const feeOpenRes = feeOpen - feeOpenRea;

      // P&L realizzato del lato chiuso (fee incluse)
      let pnlRea = 0;
      if (qCh > 0) {
        pnlRea = (prezzoClose - prezzoOpen) * qCh * segno * molt
               - feeClose - feeOpenRea;
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
        feeOpenResidue += feeOpenRes;
      } else {
        righe[idx].tipo = 'chiusura';
      }
    });

    // ============================================================
    // P&L APERTO — calcolato UNA VOLTA sulle variabili aggregate
    // (metodo prezzo medio). Include la quota residua delle fee
    // di apertura della parte ancora aperta.
    // ============================================================
    const segnoAperto = Math.sign(qtaNetta) || 1;
    const mediaAperta = qtaAssolutaCorrente > 0
      ? sommaPulitaPesata / qtaAssolutaCorrente : 0;
    let pnlApertoTot = 0;
    if (qtaAssolutaCorrente > 0 && spot > 0 && isFinite(mediaAperta)) {
      pnlApertoTot = (spot - mediaAperta) * qtaAssolutaCorrente * segnoAperto * molt
                   - feeOpenResidue;
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
