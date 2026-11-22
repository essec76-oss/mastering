// render-futures.js — render righe futures/azioni
// Parte di Mastering: l'ordine di caricamento è definito in index.html.

  const TAGLIA_FUT = { NES: 0.01, MES: 0.1, ES: 1 };

  function _tipoLabelCol(tipo, col) {
    if (tipo === 'X') return 'AZIONI';
    if (!tipo || tipo === '-') return col;
    return tipo;
  }

  // [RIMOSSA: deltaRiga — codice morto, sostituita da deltaInRiferimento
  //  chiamata inline in renderRigaTotale.]

  function tipoRiferimentoFut(scheda) {
    const candidati = [];
    ['NES', 'MES'].forEach(col => {
      const tipo = scheda['tipo' + col];
      const haPosizione = (scheda[col] || []).some(m =>
        m.attivo !== false && ((m.quantita || 0) - (m.quantitaChiusa || 0)) > 0);
      if (haPosizione && TAGLIA_FUT[tipo]) candidati.push(tipo);
    });
    (scheda.opzioni || []).forEach(o => {
      if (o.attivo === false || o.stato === 'CHIUSA') return;
      const s = o.strumento || 'MES';
      if (TAGLIA_FUT[s]) candidati.push(s);
    });
    let best = null;
    candidati.forEach(t => {
      if (!best || TAGLIA_FUT[t] > TAGLIA_FUT[best]) best = t;
    });
    return best;
  }

  function deltaInRiferimento(qtaNetta, tipo, tipoRif) {
    if (!tipoRif || !TAGLIA_FUT[tipo]) return qtaNetta;
    return qtaNetta * TAGLIA_FUT[tipo] / TAGLIA_FUT[tipoRif];
  }

  function ricalcolaStatiScheda(scheda, col) {
    const movimenti = scheda[col] || [];
    movimenti.forEach(m => {
      const qAp = m.quantita || 0;
      const qCh = Math.min(m.quantitaChiusa || 0, qAp);
      m.stato = qCh > 0 ? 'CHIUSA' : 'APERTA';
    });
  }

  function ricalcolaStatiSchedaAttiva() {
    const scheda = schedaAttiva();
    if (!scheda) return;
    ricalcolaStatiScheda(scheda, 'NES');
    ricalcolaStatiScheda(scheda, 'MES');
  }

  // [RIMOSSA: calcolaFeeStimate — codice morto, mai chiamata. Inoltre leggeva
  //  m.feeOpen/m.feeClose che migraMov() ha già consolidato in m.fee.]

  // Vista Front del Back (solo visuale): prezzo Back − basis.
  // Il basis è definito come Back − Front (vedi calcolaColonna).
  function basisScheda(scheda) {
    return parseFloat(scheda && scheda.basis) || 0;
  }
  function inVistaFrontMES(scheda) {
    return !!scheda && scheda.toggleBackView === false;
  }
  function prezzoVistaMES(p, scheda) {
    if (!(p > 0) || !inVistaFrontMES(scheda)) return p;
    return Math.round((p - basisScheda(scheda)) * 10000) / 10000;
  }

  function renderRigaTotale(col, res) {
    const scheda = schedaAttiva();
    const prezzoEl = el('csPrezzo' + col);
    if (prezzoEl) {
      if (col === 'MES') {
        const media = prezzoVistaMES(res.mediaPulita, scheda);
        prezzoEl.textContent = isFinite(media) ? formatPrezzo(media) : '—';
      } else {
        prezzoEl.textContent = isNaN(res.mediaPulita) ? '—' : formatPrezzo(res.mediaPulita);
      }
    }

    // 1. QUANTITÀ NETTA
    const qnEl = el('qtaNetta' + col);
    if (qnEl) {
      if (!res.qtaNetta) {
        qnEl.textContent = '—';
        qnEl.className = 'value muted';
      } else {
        const dir = res.qtaNetta > 0 ? 'LONG' : 'SHORT';
        qnEl.textContent = Math.abs(res.qtaNetta) + ' ' + dir;
        qnEl.className = 'value ' + (res.qtaNetta > 0 ? 'green' : 'red');
      }
    }

    // 2. DELTA
    const dEl = el('deltaAzCol' + col);
    const dLabelEl = el('deltaLabel' + col);
    if (dEl) {
      const tipoLabel = _tipoLabelCol(res.tipo, col);
      if (res.tipo === 'X') {
        if (dLabelEl) dLabelEl.textContent = 'Delta azioni';
        if (res.qtaNetta !== 0) {
          const dAz = res.qtaNetta / 100;
          dEl.textContent = formatGreek(dAz, 2);
          dEl.className = 'value ' + (dAz >= 0 ? 'green' : 'red');
        } else {
          dEl.textContent = '—';
          dEl.className = 'value muted';
        }
      } else {
        if (dLabelEl) dLabelEl.textContent = 'Delta ' + tipoLabel;
        if (res.qtaNetta !== 0) {
          const tipoRif = tipoRiferimentoFut(scheda);
          const dRif = deltaInRiferimento(res.qtaNetta, res.tipo, tipoRif);
          dEl.textContent = formatGreek(dRif, 2);
          dEl.className = 'value ' + (dRif >= 0 ? 'green' : 'red');
        } else {
          dEl.textContent = '—';
          dEl.className = 'value muted';
        }
      }
    }

    // 3. CALCOLO P&L REALIZZATO (Somma colonna RLZD)
    let pnlRealizzatoTot = 0;
    if (!scheda.soloAperte && res.righe && Array.isArray(res.righe)) {
      res.righe.forEach(info => {
        if (info && info.pnlRealizzato) {
          pnlRealizzatoTot += info.pnlRealizzato;
        }
      });
    }

    // 4. P&L NON REALIZZATO (calcolato in calcolaColonna con prezzo medio e spot)
    const pnlNonRealizzatoTot = res.pnlAperto || 0;

    // 5. AGGIORNAMENTO HTML
    // P&L RLZD
    const pnlEl = el('csPnl' + col);
    if (pnlEl) {
      pnlEl.textContent = formatEuro(pnlRealizzatoTot);
      pnlEl.className = 'value ' + (pnlRealizzatoTot === 0 ? 'muted' : (pnlRealizzatoTot >= 0 ? 'green' : 'red'));
    }

    // P&L NON RLZD
    const pnlNonRlzdEl = el('plNonRlzd' + col);
    if (pnlNonRlzdEl) {
      pnlNonRlzdEl.textContent = formatEuro(pnlNonRealizzatoTot);
      pnlNonRlzdEl.className = 'value ' + (pnlNonRealizzatoTot === 0 ? 'muted' : (pnlNonRealizzatoTot >= 0 ? 'green' : 'red'));
    }

    // P&L POSIZIONE (TOTALE: Realizzato + Non Realizzato)
    const pnlPosEl = el('plPosizione' + col);
    if (pnlPosEl) {
      const pnlPosizioneComplessivo = pnlRealizzatoTot + pnlNonRealizzatoTot;
      pnlPosEl.textContent = formatEuro(pnlPosizioneComplessivo);
      pnlPosEl.className = 'value ' + (pnlPosizioneComplessivo === 0 ? 'muted' : (pnlPosizioneComplessivo >= 0 ? 'green' : 'red'));
    }
  }

  function _valoreRlzdRiga(info, isOff) {
    if (isOff) return { testo: '—', classe: 'muted' };
    if (!info) return { testo: '—', classe: 'muted' };
    if (info.tipo === 'apertura' || info.tipo === 'vuota' || info.tipo === 'off') {
      return { testo: '—', classe: 'muted' };
    }
    if (info.tipo === 'chiusura' || info.tipo === 'mista') {
      const v = info.pnlRealizzato || 0;
      if (v === 0) return { testo: formatEuro(0), classe: 'muted' };
      return { testo: formatEuro(v), classe: v >= 0 ? 'green' : 'red' };
    }
    return { testo: '—', classe: 'muted' };
  }

  function aggiornaCalcolati(col) {
    const scheda = schedaAttiva();
    const res = calcolaColonna(scheda, col);
    renderRigaTotale(col, res);

    const tbody = el('body' + col);
    tbody.querySelectorAll('tr').forEach((tr, idx) => {
      const info = res.righe[idx];
      if (!info) return;
      const isOff = scheda[col][idx].attivo === false;

      const tdPnl = tr.querySelector('.pnl-riga');
      if (tdPnl) {
        const { testo, classe } = _valoreRlzdRiga(info, isOff);
        tdPnl.textContent = testo;
        tdPnl.className = 'pnl-riga ' + classe;
      }
    });
  }

  function renderMovimenti(col) {
    const scheda = schedaAttiva();
    ricalcolaStatiScheda(scheda, col);

    const res = calcolaColonna(scheda, col);
    renderRigaTotale(col, res);

    // Back bloccato in modifica se toggle visuale è su Front
    const backLocked = (col === 'MES' && scheda.toggleBackView === false);

    const scheda0 = schedaAttiva();
    const conv = (x) => (col === 'MES') ? prezzoVistaMES(x, scheda0) : x;

    const tbody = el('body' + col);
    tbody.innerHTML = '';

    if (typeof syncFrontBackUI === 'function') syncFrontBackUI();

    scheda[col].forEach((mov, idx) => {
      const info = res.righe[idx] || { tipo: 'vuota', qAperta: 0, qChiusa: 0, pnlRealizzato: 0, pnlTotale: 0 };
      const tr = document.createElement('tr');

      const isOn = mov.attivo !== false;
      const qAp = mov.quantita || 0;
      const qCh = Math.min(mov.quantitaChiusa || 0, qAp);

      if (qCh > 0 && qCh < qAp) tr.classList.add('row-mista');
      else if (qCh >= qAp && qCh > 0) tr.classList.add('row-chiusa');
      if (!isOn) tr.classList.add('row-off');

      // Riga chiusa (anche parzialmente): più grigia
      if (qCh >= qAp && qCh > 0) tr.style.opacity = '0.45';
      else if (qCh > 0) tr.style.opacity = '0.75';

      // DEL
      const tdDel = document.createElement('td');
      tdDel.className = 'td-del';
      tdDel.dataset.label = 'DEL';
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-del'; btnDel.innerHTML = '🗑';
      btnDel.title = backLocked ? 'Imposta il toggle su Back per modificare' : 'Elimina riga';
      btnDel.setAttribute('aria-label', 'Elimina riga');
      btnDel.disabled = backLocked;
      btnDel.addEventListener('click', () => {
        if (backLocked) return;
        if (!confirm('Eliminare questa riga di movimento?')) return;
        scheda[col].splice(idx, 1);
        renderMovimenti(col); calcolaTutto();
      });
      tdDel.appendChild(btnDel); tr.appendChild(tdDel);

      // NASCONDI + RIAPRI
      const tdAtt = document.createElement('td');
      tdAtt.dataset.label = 'Nascondi';
      const btnNascondi = document.createElement('button');
      btnNascondi.className = 'btn-stato' + (!isOn ? ' chiusa' : '');
      btnNascondi.innerHTML = isOn ? '👁' : '👁‍🗨';
      btnNascondi.title = isOn ? 'Nascondi riga (esclusa dai conteggi)' : 'Mostra riga';
      btnNascondi.setAttribute('aria-label', isOn ? 'Nascondi riga' : 'Mostra riga');
      btnNascondi.addEventListener('click', () => {
        scheda[col][idx].attivo = scheda[col][idx].attivo === false;
        renderMovimenti(col); calcolaTutto();
      });
      tdAtt.appendChild(btnNascondi);

      // RIAPRI (solo se la riga è chiusa o parzialmente chiusa)
      if (qCh > 0) {
        const btnRiapri = document.createElement('button');
        btnRiapri.className = 'btn-stato btn-riapri';
        btnRiapri.innerHTML = '↺';
        btnRiapri.title = 'Riapri posizione: annulla la chiusura e ripristina la riga aperta';
        btnRiapri.setAttribute('aria-label', 'Riapri posizione');
        btnRiapri.addEventListener('click', () => {
          if (!confirm('Riaprire questa posizione? Il P&L realizzato verrà annullato.')) return;
          scheda[col][idx].quantitaChiusa = 0;
          scheda[col][idx].prezzoClose = 0;
          delete scheda[col][idx].prezzoMedioChiusura;
          renderMovimenti(col);
          calcolaTutto();
        });
        tdAtt.appendChild(btnRiapri);
      }
      tr.appendChild(tdAtt);

      // TIPO (BUY / SELL)
      const tdTipo = document.createElement('td');
      tdTipo.dataset.label = 'Tipo';
      const selTipo = document.createElement('select');
      selTipo.className = 'select-tipo';
      const isShort = mov.direzione === 'SHORT';
      selTipo.dataset.tipo = isShort ? 'SELL' : 'BUY';
      selTipo.innerHTML = `
        <option value="LONG" ${!isShort ? 'selected' : ''}>BUY</option>
        <option value="SHORT" ${isShort ? 'selected' : ''}>SELL</option>
      `;
      // Bloccato quando la riga ha già una posizione aperta (qAp > 0):
      // l'unica inversione possibile è lo scarico.
      selTipo.disabled = qAp > 0 || backLocked;
      selTipo.title = (qAp > 0)
        ? 'Direzione bloccata: l\'inversione avviene solo con lo scarico'
        : 'BUY = posizione long, SELL = posizione short';
      selTipo.addEventListener('change', e => {
        scheda[col][idx].direzione = e.target.value;
        e.target.dataset.tipo = e.target.value === 'SHORT' ? 'SELL' : 'BUY';
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdTipo.appendChild(selTipo); tr.appendChild(tdTipo);

      // QTA OPEN
      const tdQta = document.createElement('td');
      tdQta.dataset.label = 'Q.tà';
      const inQta = document.createElement('input');
      inQta.type = 'number'; inQta.step = '1'; inQta.min = '0';
      inQta.value = (mov.quantita > 0) ? mov.quantita : '';
      inQta.placeholder = '—';
      inQta.disabled = qCh > 0 || backLocked;
      inQta.addEventListener('input', e => {
        const q = (e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0));
        scheda[col][idx].quantita = q;
        scheda[col][idx].quantitaChiusa = Math.min(scheda[col][idx].quantitaChiusa || 0, q);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdQta.appendChild(inQta); tr.appendChild(tdQta);

      // PREZZO OPEN
      const tdPrezzo = document.createElement('td');
      tdPrezzo.dataset.label = 'Prezzo Open';
      const inPrezzo = document.createElement('input');
      inPrezzo.type = 'number'; inPrezzo.step = '0.25';
      inPrezzo.className = 'prezzo-nominale';
      inPrezzo.value = (mov.prezzoPulito > 0) ? conv(mov.prezzoPulito) : '';
      inPrezzo.placeholder = '—';
      inPrezzo.disabled = qCh > 0 || backLocked;
      inPrezzo.addEventListener('input', e => {
        scheda[col][idx].prezzoPulito = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdPrezzo.appendChild(inPrezzo); tr.appendChild(tdPrezzo);

      // FEE OP. (dopo Prezzo Open) — editabile anche dopo chiusura
      const tdFeeOp = document.createElement('td');
      tdFeeOp.dataset.label = 'Fee Op.';
      const inFeeOp = document.createElement('input');
      inFeeOp.type = 'number';
      inFeeOp.step = '0.01';
      inFeeOp.min = '0';
      inFeeOp.className = 'in-fee';
      const feeOpVal = (typeof mov.feeOpen === 'number') ? mov.feeOpen : (mov.fee || 0);
      inFeeOp.value = (feeOpVal === 0) ? '' : feeOpVal;
      inFeeOp.placeholder = '0';
      inFeeOp.title = 'Fee di apertura';
      inFeeOp.disabled = backLocked;
      inFeeOp.addEventListener('input', e => {
        scheda[col][idx].feeOpen = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
        delete scheda[col][idx].fee;
        aggiornaCalcolati(col);
        calcolaTutto();
      });
      tdFeeOp.appendChild(inFeeOp);
      tr.appendChild(tdFeeOp);

      // QTA CLOSE (editabile se la riga è chiusa; 0 = riapre completamente)
      const tdQtaC = document.createElement('td');
      tdQtaC.dataset.label = 'Q.tà Close';
      const inQtaC = document.createElement('input');
      inQtaC.type = 'number';
      inQtaC.step = '1';
      inQtaC.min = '0';
      inQtaC.max = String(qAp);
      inQtaC.value = qCh || '';
      inQtaC.placeholder = '0';
      inQtaC.disabled = backLocked;
      inQtaC.title = 'Quantità chiusa. Metti 0 per riaprire completamente.';
      // 'change' invece di 'input': il rendering ricostruisce la tabella
      // e farebbe perdere il focus mentre l'utente digita.
      inQtaC.addEventListener('change', e => {
        let q = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
        q = Math.max(0, Math.min(q, qAp));   // non superare la quantità aperta
        scheda[col][idx].quantitaChiusa = q;
        if (q === 0) {
          scheda[col][idx].prezzoClose = 0;
          delete scheda[col][idx].prezzoMedioChiusura;
        }
        renderMovimenti(col);
        calcolaTutto();
      });
      tdQtaC.appendChild(inQtaC); tr.appendChild(tdQtaC);

      // PREZZO CLOSE (editabile solo se la riga ha già una chiusura)
      const tdPrezzoC = document.createElement('td');
      tdPrezzoC.dataset.label = 'Prezzo Close';
      const inPrezzoC = document.createElement('input');
      inPrezzoC.type = 'number';
      inPrezzoC.step = '0.25';
      inPrezzoC.className = 'prezzo-nominale';
      inPrezzoC.value = mov.prezzoClose ? conv(mov.prezzoClose) : '';
      inPrezzoC.placeholder = '—';
      inPrezzoC.disabled = backLocked || qCh === 0;
      inPrezzoC.title = qCh > 0
        ? 'Prezzo di chiusura. Modificabile.'
        : 'Valorizzato dallo scarico. Diventa editabile dopo la chiusura.';
      inPrezzoC.addEventListener('input', e => {
        scheda[col][idx].prezzoClose = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
        aggiornaCalcolati(col);
        calcolaTutto();
      });
      tdPrezzoC.appendChild(inPrezzoC); tr.appendChild(tdPrezzoC);

      // FEE CL.
      const tdFeeCl = document.createElement('td');
      tdFeeCl.dataset.label = 'Fee Cl.';
      const inFeeCl = document.createElement('input');
      inFeeCl.type = 'number';
      inFeeCl.step = '0.01';
      inFeeCl.min = '0';
      inFeeCl.className = 'in-fee';
      const feeClVal = (typeof mov.feeClose === 'number') ? mov.feeClose : 0;
      inFeeCl.value = (feeClVal === 0) ? '' : feeClVal;
      inFeeCl.placeholder = '0';
      inFeeCl.title = 'Fee di chiusura';
      inFeeCl.disabled = backLocked;
      inFeeCl.addEventListener('input', e => {
        scheda[col][idx].feeClose = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
        delete scheda[col][idx].fee;
        aggiornaCalcolati(col);
        calcolaTutto();
      });
      tdFeeCl.appendChild(inFeeCl);
      tr.appendChild(tdFeeCl);

      // RLZD
      const tdRlzd = document.createElement('td');
      tdRlzd.className = 'pnl-riga td-pnl';
      tdRlzd.dataset.label = 'RLZD';
      tdRlzd.title = 'P&L realizzato calcolato sul prezzo medio di carico al momento dello scarico.';
      const { testo, classe } = _valoreRlzdRiga(info, !isOn);
      tdRlzd.textContent = testo;
      tdRlzd.classList.add(classe);
      tr.appendChild(tdRlzd);

      tbody.appendChild(tr);
    });
  }
