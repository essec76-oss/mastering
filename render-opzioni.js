// render-opzioni.js — render opzioni: greche, colonne extra e P&L combinato
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // OPZIONI RENDER
  // ============================================================
  function formatGreek(v, digits = 3) {
    if (!isFinite(v)) return 'â';
    return v.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  // Formato adattivo per le greche di POSIZIONE (scalate col moltiplicatore
  // dello strumento): i valori spaziano da frazioni (1 lotto MES Ã5) a
  // centinaia (lotti AZIONI Ã100); decimali min/max evitano sia la perdita
  // di precisione sia gli zeri in coda inutili.
  function formatGreekAuto(v, minDig, maxDig) {
    if (!isFinite(v)) return 'â';
    return v.toLocaleString('it-IT', { minimumFractionDigits: minDig, maximumFractionDigits: maxDig });
  }

  // Aggiorna la cella GG residui di una riga opzione
  function aggiornaGiorniResidui(tr, opz) {
    const ggCell = tr.querySelector('[data-field="gg"]');
    if (!ggCell) return;
    const gg = giorniResiduiOpzione(opz);
    if (gg === null) {
      ggCell.textContent = 'â';
      ggCell.style.color = '';
      return;
    }
    ggCell.textContent = String(gg);
    ggCell.style.color = gg < 0 ? 'var(--red)' : (gg <= 7 ? 'var(--yellow)' : 'var(--muted)');
  }

  // Aggiorna le celle aggiuntive della riga opzione (V. Intr, V. Temp,
  // P. Tocco, P&L Scad., Deb/Cred) â le stesse colonne della gamba opzioni
  // del Calcolatore Payoff, calcolate col metodo giÃ  usato dal file:
  // intrinseco/teorico dal modello dello strumento (BS per AZIONI, Black-76
  // per MES/ES), P&L Scad. alla prima scadenza della scheda (metodo calendar).
  function aggiornaExtraOpzione(tr, opz) {
    const setG = (f, val, dig) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (cell) cell.textContent = formatGreek(val, dig);
    };
    const setPct = (f, p) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (!cell) return;
      if (p === null || !isFinite(p)) { cell.textContent = 'â'; return; }
      cell.textContent = (p * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    };

    if (opz.attivo === false || opz.stato === 'CHIUSA') {
      setG('intrinseco', NaN, 2);
      setG('temporale', NaN, 2);
      setPct('tocco', null);
      const sc = tr.querySelector('[data-field="pnlScad"]');
      if (sc) { sc.textContent = 'â'; sc.classList.remove('green', 'red', 'muted'); sc.classList.add('muted'); }
      const dc = tr.querySelector('[data-field="debitcredit"]');
      if (dc) dc.textContent = 'â';
      return;
    }

    // Valori dal modello (price/intrinsic giÃ  calcolati dalle greche)
    const g = calcolaGrecheOpzione(opz);
    setG('intrinseco', g.intrinsic, 2);
    setG('temporale', (isFinite(g.price) && isFinite(g.intrinsic)) ? g.price - g.intrinsic : NaN, 2);

    // ProbabilitÃ  di tocco dello strike (come nel Calcolatore Payoff)
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    const volFrac = (parseFloat(opz.vol) || 0) / 100;
    const T = (g && isFinite(g.T)) ? Math.max(0, g.T) : 0;
    setPct('tocco', touchProbability(spot, opz.strike, volFrac, T));

    // P&L a scadenza della riga (metodo calendar della scheda attiva)
    const sc = tr.querySelector('[data-field="pnlScad"]');
    if (sc) {
      const pnlScad = pnlOpzioneAt(spot, opz, 'expiry', firstExpiryOpzioni(schedaAttiva()));
      sc.textContent = formatEuro(pnlScad);
      sc.classList.remove('green', 'red', 'muted');
      sc.classList.add(pnlScad >= 0 ? 'green' : 'red');
    }

    // Debit/Credit: premio Ã q.tÃ  Ã moltiplicatore (senza segno di posizione)
    const dc = tr.querySelector('[data-field="debitcredit"]');
    if (dc) dc.textContent = formatEuro((opz.premio || 0) * (opz.qta || 0) * moltOpz(opz));
  }

  function aggiornaRigaOpzione(idx) {
    const tbody = el('bodyOpzioni');
    const tr = tbody.querySelector(`tr[data-idx="${idx}"]`);
    if (!tr) return;
    const opz = schedaAttiva().opzioni[idx];
    if (!opz) return;

    const tdPnl = tr.querySelector('.pnl-riga[data-label="P&L"]');
    if (tdPnl) {
      const pnl = calcolaPnlOpzione(opz);
      tdPnl.textContent = formatEuro(pnl);
      tdPnl.classList.remove('green', 'red', 'muted');
      tdPnl.classList.add(pnl >= 0 ? 'green' : 'red');
    }

    // Giorni residui (dipende da scadenza e data analisi)
    aggiornaGiorniResidui(tr, opz);
    aggiornaMoneyness(tr, opz);

    const setG = (sel, val, dig) => {
      const cell = tr.querySelector(sel);
      if (cell) cell.textContent = formatGreek(val, dig);
    };

    // Greche e teorico solo se attiva e aperta (altrimenti 'â')
    if (opz.attivo === false || opz.stato === 'CHIUSA') {
      ['teorico','delta','gamma','vega','theta'].forEach(f => setG(`[data-field="${f}"]`, NaN, 2));
      aggiornaExtraOpzione(tr, opz);
      return;
    }

    const g = calcolaGrecheOpzione(opz);
    const segno = opz.pos === 'SELL' ? -1 : 1;
    const qta = opz.qta || 0;

    setG('[data-field="teorico"]', g.price, 2);
    // Greche di posizione scalate col moltiplicatore ($/pt, $/ptÂ², $/1% IV, $/gg)
    const molt = moltOpz(opz);
    const setPos = (f, v, minD, maxD) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (cell) cell.textContent = formatGreekAuto(v, minD, maxD);
    };
    setPos('delta', segno * qta * g.delta * molt, 2, 3);
    setPos('gamma', segno * qta * g.gamma * molt, 2, 4);
    setPos('vega', segno * qta * g.vega * molt, 2, 3);
    setPos('theta', segno * qta * g.theta * molt, 2, 3);
    aggiornaExtraOpzione(tr, opz);
  }

  // Strumento selezionato nel menu a tendina dell'header (MES / ES / AZIONI)
  function strumentoOpzSelezionato() {
    const sel = el('strumentoOpzioni');
    return sel ? sel.value : 'MES';
  }

  function renderOpzioni() {
    const tbody = el('bodyOpzioni');
    tbody.innerHTML = '';
    const strumentoSel = strumentoOpzSelezionato();
    const opzioniScheda = schedaAttiva().opzioni;
    opzioniScheda.forEach((opz, idx) => {
      // Mostra solo le opzioni dello strumento selezionato:
      // le altre restano salvate e dormienti, pronte quando le richiami
      if ((opz.strumento || 'MES') !== strumentoSel) return;
      const tr = document.createElement('tr');
      tr.dataset.idx = idx;
      if (opz.attivo === false) tr.classList.add('row-off');
      if (opz.stato === 'CHIUSA') tr.classList.add('row-chiusa');

      // A
      const tdA = document.createElement('td');
      tdA.dataset.label = 'ï';
      const inA = document.createElement('input');
      inA.type = 'checkbox';
      inA.className = 'toggle-on';
      inA.checked = opz.attivo === false;
      inA.title = 'Spunta per escludere dai conteggi (riga oscurata)';
      inA.addEventListener('change', e => {
        opzioniScheda[idx].attivo = !e.target.checked;
        renderOpzioni();
        calcolaTutto();
      });
      tdA.appendChild(inA); tr.appendChild(tdA);

      // Stato (APERTA / CHIUSA) â click per commutare
      const tdStato = document.createElement('td');
      tdStato.dataset.label = 'Stato';
      const btnStato = document.createElement('button');
      const isChiusa = opz.stato === 'CHIUSA';
      btnStato.className = 'btn-stato' + (isChiusa ? ' chiusa' : '');
      btnStato.textContent = isChiusa ? 'CHIUSA' : 'APERTA';
      btnStato.title = 'Clicca per aprire/chiudere la posizione: se CHIUSA il P&L = 0, il realizzato va annotato nel box Cash in alto';
      btnStato.addEventListener('click', () => {
        opzioniScheda[idx].stato = opzioniScheda[idx].stato === 'CHIUSA' ? 'APERTA' : 'CHIUSA';
        renderOpzioni();
        calcolaTutto();
      });
      tdStato.appendChild(btnStato); tr.appendChild(tdStato);

      // DEL
      const tdDel = document.createElement('td');
      tdDel.className = 'td-del';
      tdDel.dataset.label = 'DEL';
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-del'; btnDel.textContent = 'DEL';
      btnDel.title = 'Elimina riga';
      btnDel.addEventListener('click', () => {
        if (!confirm('Eliminare questa riga di opzione?')) return;
        opzioniScheda.splice(idx, 1); renderOpzioni(); calcolaTutto();
      });
      tdDel.appendChild(btnDel); tr.appendChild(tdDel);

      // Pos
      const tdPos = document.createElement('td');
      tdPos.dataset.label = 'Pos';
      const selPos = document.createElement('select');
      selPos.innerHTML = '<option value="SELL">SELL</option><option value="BUY">BUY</option>';
      selPos.value = opz.pos || 'SELL';
      selPos.addEventListener('change', e => { opzioniScheda[idx].pos = e.target.value; aggiornaRigaOpzione(idx); calcolaTutto(); });
      tdPos.appendChild(selPos); tr.appendChild(tdPos);

      // Tipo
      const tdTipo = document.createElement('td');
      tdTipo.dataset.label = 'Tipo';
      const selTipo = document.createElement('select');
      selTipo.innerHTML = '<option value="PUT">PUT</option><option value="CALL">CALL</option>';
      selTipo.value = opz.tipo || 'PUT';
      selTipo.addEventListener('change', e => { opzioniScheda[idx].tipo = e.target.value; aggiornaRigaOpzione(idx); calcolaTutto(); });
      tdTipo.appendChild(selTipo); tr.appendChild(tdTipo);

      // Q.tÃ 
      const tdQta = document.createElement('td');
      tdQta.dataset.label = 'Q.tÃ ';
      const inQta = document.createElement('input');
      inQta.type = 'number'; inQta.step = '1'; inQta.min = '0'; inQta.value = opz.qta || 1;
      inQta.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].qta = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdQta.appendChild(inQta); tr.appendChild(tdQta);

      // K
      const tdK = document.createElement('td');
      tdK.dataset.label = 'Strike';
      const inK = document.createElement('input');
      inK.type = 'number'; inK.step = '1'; inK.value = opz.strike || '';
      inK.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].strike = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdK.appendChild(inK); tr.appendChild(tdK);

      // Premio
      const tdPremio = document.createElement('td');
      tdPremio.dataset.label = 'Premio';
      const inPremio = document.createElement('input');
      inPremio.type = 'number'; inPremio.step = '0.05'; inPremio.value = opz.premio || '';
      inPremio.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].premio = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdPremio.appendChild(inPremio); tr.appendChild(tdPremio);

      // Vol%
      const tdVol = document.createElement('td');
      tdVol.dataset.label = 'Vol%';
      const inVol = document.createElement('input');
      inVol.type = 'number'; inVol.step = '0.1'; inVol.value = opz.vol || '';
      inVol.placeholder = 'â';
      inVol.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].vol = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdVol.appendChild(inVol); tr.appendChild(tdVol);

      // Scadenza
      const tdScad = document.createElement('td');
      tdScad.dataset.label = 'Scadenza';
      const inScad = document.createElement('input');
      inScad.type = 'date';
      inScad.value = opz.scadenza || '';
      inScad.addEventListener('change', e => {
        opzioniScheda[idx].scadenza = e.target.value;
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdScad.appendChild(inScad); tr.appendChild(tdScad);

      // GG residui (data analisi â scadenza)
      const tdGG = document.createElement('td');
      tdGG.dataset.label = 'GG';
      const spanGG = document.createElement('span');
      spanGG.dataset.field = 'gg';
      spanGG.textContent = 'â';
      spanGG.style.fontVariantNumeric = 'tabular-nums';
      tdGG.appendChild(spanGG); tr.appendChild(tdGG);
      aggiornaGiorniResidui(tr, opz);

      // Moneyness: ATM/OTM/ITM + distanza in Ï (Vol ATM)
      const tdMS = document.createElement('td');
      tdMS.dataset.label = 'M/S';
      const wrapMS = document.createElement('div');
      wrapMS.className = 'ms-wrap';
      const spanM = document.createElement('span');
      spanM.dataset.field = 'ms';
      spanM.textContent = 'â';
      const spanMSigma = document.createElement('span');
      spanMSigma.dataset.field = 'msSigma';
      spanMSigma.className = 'ms-sub';
      wrapMS.appendChild(spanM); wrapMS.appendChild(spanMSigma);
      tdMS.appendChild(wrapMS); tr.appendChild(tdMS);
      aggiornaMoneyness(tr, opz);

      // Teorico (readonly)
      const tdTeorico = document.createElement('td');
      tdTeorico.dataset.label = 'Teorico';
      const spanTeorico = document.createElement('span');
      spanTeorico.dataset.field = 'teorico';
      spanTeorico.textContent = 'â';
      spanTeorico.style.fontVariantNumeric = 'tabular-nums';
      tdTeorico.appendChild(spanTeorico); tr.appendChild(tdTeorico);

      // Delta
      const tdDelta = document.createElement('td');
      tdDelta.dataset.label = 'Delta';
      const spanDelta = document.createElement('span');
      spanDelta.dataset.field = 'delta';
      spanDelta.textContent = 'â';
      spanDelta.style.fontVariantNumeric = 'tabular-nums';
      tdDelta.appendChild(spanDelta); tr.appendChild(tdDelta);

      // Gamma
      const tdGamma = document.createElement('td');
      tdGamma.dataset.label = 'Gamma';
      const spanGamma = document.createElement('span');
      spanGamma.dataset.field = 'gamma';
      spanGamma.textContent = 'â';
      spanGamma.style.fontVariantNumeric = 'tabular-nums';
      tdGamma.appendChild(spanGamma); tr.appendChild(tdGamma);

      // Vega
      const tdVega = document.createElement('td');
      tdVega.dataset.label = 'Vega';
      const spanVega = document.createElement('span');
      spanVega.dataset.field = 'vega';
      spanVega.textContent = 'â';
      spanVega.style.fontVariantNumeric = 'tabular-nums';
      tdVega.appendChild(spanVega); tr.appendChild(tdVega);

      // Theta
      const tdTheta = document.createElement('td');
      tdTheta.dataset.label = 'Theta';
      const spanTheta = document.createElement('span');
      spanTheta.dataset.field = 'theta';
      spanTheta.textContent = 'â';
      spanTheta.style.fontVariantNumeric = 'tabular-nums';
      tdTheta.appendChild(spanTheta); tr.appendChild(tdTheta);

      // Valore intrinseco (come la gamba opzioni del Calcolatore Payoff)
      const tdVintr = document.createElement('td');
      tdVintr.dataset.label = 'V. Intr';
      const spanVintr = document.createElement('span');
      spanVintr.dataset.field = 'intrinseco';
      spanVintr.textContent = 'â';
      spanVintr.style.fontVariantNumeric = 'tabular-nums';
      tdVintr.appendChild(spanVintr); tr.appendChild(tdVintr);

      // Valore temporale (teorico â intrinseco)
      const tdVtemp = document.createElement('td');
      tdVtemp.dataset.label = 'V. Temp';
      const spanVtemp = document.createElement('span');
      spanVtemp.dataset.field = 'temporale';
      spanVtemp.textContent = 'â';
      spanVtemp.style.fontVariantNumeric = 'tabular-nums';
      tdVtemp.appendChild(spanVtemp); tr.appendChild(tdVtemp);

      // ProbabilitÃ  di tocco dello strike
      const tdTocco = document.createElement('td');
      tdTocco.dataset.label = 'P. Tocco';
      const spanTocco = document.createElement('span');
      spanTocco.dataset.field = 'tocco';
      spanTocco.textContent = 'â';
      spanTocco.style.fontVariantNumeric = 'tabular-nums';
      tdTocco.appendChild(spanTocco); tr.appendChild(tdTocco);

      // P&L a scadenza della gamba piÃ¹ corta (metodo calendar)
      const tdPnlScad = document.createElement('td');
      tdPnlScad.className = 'pnl-riga td-pnl';
      tdPnlScad.dataset.label = 'P&L Scad.';
      const spanPnlScad = document.createElement('span');
      spanPnlScad.dataset.field = 'pnlScad';
      tdPnlScad.appendChild(spanPnlScad);
      tr.appendChild(tdPnlScad);

      // P&L (now)
      const tdPnl = document.createElement('td');
      tdPnl.className = 'pnl-riga td-pnl';
      tdPnl.dataset.label = 'P&L';
      tr.appendChild(tdPnl);

      // Debit/Credit (premio Ã q.tÃ  Ã moltiplicatore)
      const tdDebCred = document.createElement('td');
      tdDebCred.dataset.label = 'Deb/Cred';
      const spanDebCred = document.createElement('span');
      spanDebCred.dataset.field = 'debitcredit';
      spanDebCred.style.fontVariantNumeric = 'tabular-nums';
      tdDebCred.appendChild(spanDebCred); tr.appendChild(tdDebCred);

      tbody.appendChild(tr);
    });
    aggiornaPnlOpzioni();
  }

  function aggiornaPnlOpzioni() {
    const tbody = el('bodyOpzioni');
    let totDelta = 0, totGamma = 0, totVega = 0, totTheta = 0;

    tbody.querySelectorAll('tr').forEach((tr) => {
      const idx = Number(tr.dataset.idx);
      const opz = schedaAttiva().opzioni[idx];
      if (!opz) return;

      const tdPnl = tr.querySelector('.pnl-riga[data-label="P&L"]');
      if (tdPnl) {
        if (opz.attivo === false) {
          tdPnl.textContent = 'â';
          tdPnl.classList.remove('green', 'red');
          tdPnl.classList.add('muted');
        } else {
          const pnl = calcolaPnlOpzione(opz);
          tdPnl.textContent = formatEuro(pnl);
          tdPnl.classList.remove('green', 'red', 'muted');
          tdPnl.classList.add(pnl >= 0 ? 'green' : 'red');
        }
      }

      // Giorni residui (dipendono dalla data analisi)
      aggiornaGiorniResidui(tr, opz);
      aggiornaMoneyness(tr, opz);
      aggiornaExtraOpzione(tr, opz);

      const setG = (sel, val, dig) => {
        const cell = tr.querySelector(sel);
        if (cell) cell.textContent = formatGreek(val, dig);
      };

      // Greche solo se attiva e aperta
      if (opz.attivo !== false && opz.stato !== 'CHIUSA') {
        const g = calcolaGrecheOpzione(opz);
        const segno = opz.pos === 'SELL' ? -1 : 1;
        const qta = opz.qta || 0;
        // Greche di posizione SCALATE COL MOLTIPLICATORE dello strumento
        // (MES Ã5, ES Ã50, AZIONI Ã100): sono dollari per punto di movimento
        // del sottostante, omogenee e sommabili tra strumenti diversi.
        // Prima si sommavano greche per unitÃ  mescolando strumenti non
        // confrontabili: il totale non aveva unitÃ  di senso.
        const molt = moltOpz(opz);
        // input incompleti â NaN: esclusi dai totali, 'â' a video
        if (isFinite(g.delta)) totDelta += segno * qta * g.delta * molt;
        if (isFinite(g.gamma)) totGamma += segno * qta * g.gamma * molt;
        if (isFinite(g.vega)) totVega += segno * qta * g.vega * molt;
        if (isFinite(g.theta)) totTheta += segno * qta * g.theta * molt;

        setG('[data-field="teorico"]', g.price, 2);
        const setPos = (f, v, minD, maxD) => {
          const cell = tr.querySelector(`[data-field="${f}"]`);
          if (cell) cell.textContent = formatGreekAuto(v, minD, maxD);
        };
        setPos('delta', segno * qta * g.delta * molt, 2, 3);
        setPos('gamma', segno * qta * g.gamma * molt, 2, 4);
        setPos('vega', segno * qta * g.vega * molt, 2, 3);
        setPos('theta', segno * qta * g.theta * molt, 2, 3);
      } else {
        ['teorico','delta','gamma','vega','theta'].forEach(f => setG(`[data-field="${f}"]`, NaN, 2));
      }
    });

    // Aggiorna totali greche in header (Î $/pt, Î $/ptÂ², Vega $/1% IV, Î $/gg)
    el('greeksDelta').textContent = formatGreekAuto(totDelta, 2, 3);
    el('greeksGamma').textContent = formatGreekAuto(totGamma, 2, 4);
    el('greeksVega').textContent = formatGreekAuto(totVega, 2, 3);
    el('greeksTheta').textContent = formatGreekAuto(totTheta, 2, 3);
  }
