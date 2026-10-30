// render-futures.js — render righe futures/azioni
// Parte di Mastering: l'ordine di caricamento è definito in index.html.

  const TAGLIA_FUT = { NES: 0.01, MES: 0.1, ES: 1 };

  function _tipoLabelCol(tipo, col) {
    if (tipo === 'X') return 'AZIONI';
    if (!tipo || tipo === '-') return col;
    return tipo;
  }

  function deltaRiga(info, tipo) {
    if (!info || !(info.qAperta > 0)) return NaN;
    if (tipo === 'X') return NaN;
    const molt = MOLTIPLICATORI[tipo] || 0;
    if (!molt) return NaN;
    const segno = info.direzione === 'LONG' ? 1 : -1;
    return segno * info.qAperta * (molt / MOLTIPLICATORI.MES);
  }

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

  function calcolaFeeStimate(col) {
    const scheda = schedaAttiva();
    const tipo = scheda['tipo' + col];
    if (!tipo || tipo === '-') return 0;
    let tot = 0;
    (scheda[col] || []).forEach(m => {
      if (m.attivo === false) return;
      tot += (m.fee || 0);
    });
    return tot;
  }

  function renderRigaTotale(col, res) {
    const prezzoEl = el('csPrezzo' + col);
    if (prezzoEl) {
      prezzoEl.textContent = isNaN(res.mediaPulita) ? '—' : formatPrezzo(res.mediaPulita);
    }

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
          const tipoRif = tipoRiferimentoFut(schedaAttiva());
          const dRif = deltaInRiferimento(res.qtaNetta, res.tipo, tipoRif);
          dEl.textContent = formatGreek(dRif, 2);
          dEl.className = 'value ' + (dRif >= 0 ? 'green' : 'red');
        } else {
          dEl.textContent = '—';
          dEl.className = 'value muted';
        }
      }
    }

    const pnlEl = el('csPnl' + col);
    if (pnlEl) {
      const p = res.pnlTotale || 0;
      pnlEl.textContent = formatEuro(p);
      pnlEl.className = 'value ' + (!isFinite(p) || p === 0 ? 'muted' : (p >= 0 ? 'green' : 'red'));
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

    const tbody = el('body' + col);
    tbody.innerHTML = '';

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
      btnDel.className = 'btn-del'; btnDel.textContent = 'DEL';
      btnDel.title = 'Elimina riga';
      btnDel.addEventListener('click', () => {
        if (!confirm('Eliminare questa riga di movimento?')) return;
        scheda[col].splice(idx, 1);
        renderMovimenti(col); calcolaTutto();
      });
      tdDel.appendChild(btnDel); tr.appendChild(tdDel);

      // NASCONDI
      const tdAtt = document.createElement('td');
      tdAtt.dataset.label = 'Nascondi';
      const btnNascondi = document.createElement('button');
      btnNascondi.className = 'btn-stato' + (!isOn ? ' chiusa' : '');
      btnNascondi.textContent = isOn ? 'NASCONDI' : 'MOSTRA';
      btnNascondi.title = 'Clicca per nascondere la riga';
      btnNascondi.addEventListener('click', () => {
        scheda[col][idx].attivo = scheda[col][idx].attivo === false;
        renderMovimenti(col); calcolaTutto();
      });
      tdAtt.appendChild(btnNascondi); tr.appendChild(tdAtt);

      // POS OPEN
      const tdPos = document.createElement('td');
      tdPos.dataset.label = 'Pos';
      const selPos = document.createElement('select');
      selPos.innerHTML = '<option value="LONG">BUY</option><option value="SHORT">SELL</option>';
      selPos.value = mov.direzione;
      selPos.disabled = qCh > 0;   // non cambiabile dopo una chiusura
      selPos.addEventListener('change', e => {
        const d = e.target.value;
        scheda[col][idx].direzione = d;
        scheda[col][idx].direzioneClose = direzioneInversa(d);
        renderMovimenti(col); calcolaTutto();
      });
      tdPos.appendChild(selPos); tr.appendChild(tdPos);

      // QTA OPEN
      const tdQta = document.createElement('td');
      tdQta.dataset.label = 'Q.tà';
      const inQta = document.createElement('input');
      inQta.type = 'number'; inQta.step = '1'; inQta.min = '0';
      inQta.value = mov.quantita;
      inQta.disabled = qCh > 0;
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
      inPrezzo.value = (mov.prezzoPulito === 0 || mov.prezzoPulito === undefined) ? '' : mov.prezzoPulito;
      inPrezzo.placeholder = '—';
      inPrezzo.disabled = qCh > 0;
      inPrezzo.addEventListener('input', e => {
        scheda[col][idx].prezzoPulito = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdPrezzo.appendChild(inPrezzo); tr.appendChild(tdPrezzo);

      // QTA CLOSE (sola lettura: la valorizza solo lo scarico)
      const tdQtaC = document.createElement('td');
      tdQtaC.dataset.label = 'Q.tà Close';
      const inQtaC = document.createElement('input');
      inQtaC.type = 'number';
      inQtaC.value = qCh || '';
      inQtaC.placeholder = '0';
      inQtaC.disabled = true;
      tdQtaC.appendChild(inQtaC); tr.appendChild(tdQtaC);

      // PREZZO CLOSE (sola lettura: spot al momento dello scarico)
      const tdPrezzoC = document.createElement('td');
      tdPrezzoC.dataset.label = 'Prezzo Close';
      const inPrezzoC = document.createElement('input');
      inPrezzoC.type = 'number';
      inPrezzoC.step = '0.25';
      inPrezzoC.className = 'prezzo-nominale';
      inPrezzoC.value = mov.prezzoClose ? mov.prezzoClose : '';
      inPrezzoC.placeholder = '—';
      inPrezzoC.disabled = true;
      inPrezzoC.title = 'Valorizzato dallo scarico con lo spot al momento della chiusura.';
      tdPrezzoC.appendChild(inPrezzoC); tr.appendChild(tdPrezzoC);

      // FEE (attiva solo dopo una chiusura)
      const tdFee = document.createElement('td');
      tdFee.dataset.label = 'Fee';
      const inFee = document.createElement('input');
      inFee.type = 'number'; inFee.step = '0.01'; inFee.min = '0';
      inFee.className = 'in-fee';
      inFee.value = (mov.fee === 0 || mov.fee === undefined) ? '' : mov.fee;
      inFee.placeholder = '0';
      inFee.disabled = qCh === 0;
      inFee.addEventListener('input', e => {
        scheda[col][idx].fee = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdFee.appendChild(inFee); tr.appendChild(tdFee);

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
