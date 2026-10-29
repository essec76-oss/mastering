// render-futures.js — render righe futures/azioni
// Parte di Mastering: l'ordine di caricamento è definito in index.html.
//
// v29 — Riga unica apertura+chiusura:
//   Colonne della riga, nell'ordine richiesto:
//     DEL · NASCONDI/MOSTRA ·
//     OPEN (data) · Pos · Q.tà · Prezzo Open · Fee ·
//     CLOSE (data) · Pos (inversa automatica di Pos open) · Q.tà · Prezzo Close · Fee ·
//     RLZD
//   - DEL è il primo elemento della riga, subito seguito dal pulsante
//     NASCONDI/MOSTRA (riga esclusa da conteggi/valori/grafico se nascosta).
//   - Pos di chiusura: generata automaticamente come inversa della Pos di
//     apertura (BUY -> SELL, SELL -> BUY). Se cambi la Pos open, la Pos close
//     si aggiorna da sola all'inversa.
//   - Fee: campi editabili per lato. Se non li tocchi, vengono stimati in
//     automatico (fee per contratto per lato x q.tà) a ogni cambio q.tà.
//     Le fee ENTRANO nel RLZD e nei P&L (vedi futures.js v29).
//   - La q.tà close può essere minore della open: chiusura parziale, il
//     residuo resta aperto (riga "mista").
//
// Retrocompatibilità: movimenti salvati con il vecchio formato
// (senza quantitaChiusa/prezzoClose/fee) si aprono come APERTE.

  // Taglie relative in unità ES (fisse, indipendenti dai moltiplicatori)
  const TAGLIA_FUT = { NES: 0.01, MES: 0.1, ES: 1 };

  function _tipoLabelCol(tipo, col) {
    if (tipo === 'X') return 'AZIONI';
    if (!tipo || tipo === '-') return col;
    return tipo;
  }

  // Delta di riga (solo per calcolo interno, non mostrato).
  function deltaRiga(info, tipo) {
    if (!info || !(info.qAperta > 0)) return NaN;
    if (tipo === 'X') return NaN;
    const molt = MOLTIPLICATORI[tipo] || 0;
    if (!molt) return NaN;
    const segno = info.direzione === 'LONG' ? 1 : -1;
    return segno * info.qAperta * (molt / MOLTIPLICATORI.MES);
  }

  // Contratto di taglia maggiore presente nella scheda (NES/MES/ES),
  // considerando colonne con posizione attiva e opzioni FUT non chiuse.
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

  // Converte una quantità netta di un tipo nell'unità del riferimento
  function deltaInRiferimento(qtaNetta, tipo, tipoRif) {
    if (!tipoRif || !TAGLIA_FUT[tipo]) return qtaNetta;
    return qtaNetta * TAGLIA_FUT[tipo] / TAGLIA_FUT[tipoRif];
  }

  // ============================================================
  // STATI (compatibilità con il resto dell'app)
  // v29: lo stato non dipende più dalla posizione netta ma dalla
  // coppia open/close della riga stessa. Mantenuta per i moduli
  // che la chiamano (calcola-tutto, ecc.): è un no-op sicuro.
  // ============================================================
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

  // ============================================================
  // FEE TOTALI (v29)
  // Somma delle fee inserite/stimate nelle righe ATTIVE della colonna.
  // Le fee ora entrano nei P&L: il valore in header è quello pagato.
  // ============================================================
  function calcolaFeeStimate(col) {
    const scheda = schedaAttiva();
    const tipo = scheda['tipo' + col];
    if (!tipo || tipo === '-') return 0;
    let tot = 0;
    (scheda[col] || []).forEach(m => {
      if (m.attivo === false) return;
      tot += (m.feeOpen || 0) + (m.feeClose || 0);
    });
    return tot;
  }

  // Fee stimata per un lato: fee per contratto per lato x quantità.
  function _feeStimataLato(tipo, qta) {
    return (feeLatoFutureAttiva(tipo) || 0) * (qta || 0);
  }

  function renderRigaTotale(col, res) {
    const prezzoEl = el('csPrezzo' + col);
    if (prezzoEl) {
      prezzoEl.textContent = isNaN(res.mediaPulita) ? '—' : formatPrezzo(res.mediaPulita);
    }

    const feeEl = el('fee' + col);
    if (feeEl) {
      const fee = calcolaFeeStimate(col);
      if (fee > 0) {
        feeEl.textContent = '-' + formatEuro(fee);
        feeEl.className = 'cs-fee-val red';
      } else {
        feeEl.textContent = '-0,00';
        feeEl.className = 'cs-fee-val muted';
      }
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

  // Valore RLZD della riga:
  // - off / apertura (nessuna chiusura) / vuota → "—"
  // - chiusura / mista → P&L realizzato del lato chiuso, fee incluse
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

  // ============================================================
  // RENDER RIGA — v29
  // ============================================================
  function renderMovimenti(col) {
    const scheda = schedaAttiva();
    ricalcolaStatiScheda(scheda, col);

    const res = calcolaColonna(scheda, col);
    const tipo = scheda['tipo' + col];
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

      // ---- 1. DEL (primo pulsante della riga) ----
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

      // ---- 2. NASCONDI / MOSTRA ----
      const tdAtt = document.createElement('td');
      tdAtt.dataset.label = 'Nascondi';
      const btnNascondi = document.createElement('button');
      btnNascondi.className = 'btn-stato' + (!isOn ? ' chiusa' : '');
      btnNascondi.textContent = isOn ? 'NASCONDI' : 'MOSTRA';
      btnNascondi.title = 'Clicca per nascondere la riga: resta visibile ma è esclusa da conteggi, valori numerici e grafico (clicca di nuovo per mostrarla)';
      btnNascondi.addEventListener('click', () => {
        scheda[col][idx].attivo = scheda[col][idx].attivo === false;
        renderMovimenti(col);
        calcolaTutto();
      });
      tdAtt.appendChild(btnNascondi); tr.appendChild(tdAtt);

      // ---- BLOCCO APERTURA ----

      // OPEN (data)
      const tdDataO = document.createElement('td');
      tdDataO.dataset.label = 'Open';
      const inDataO = document.createElement('input');
      inDataO.type = 'date';
      inDataO.className = 'in-data';
      inDataO.value = mov.dataOpen || '';
      inDataO.title = 'Data di apertura';
      inDataO.addEventListener('change', e => {
        scheda[col][idx].dataOpen = e.target.value;
        calcolaTutto();
      });
      tdDataO.appendChild(inDataO); tr.appendChild(tdDataO);

      // Pos (BUY/SELL) — cambiandola, la Pos close si rigenera all'inversa
      const tdPos = document.createElement('td');
      tdPos.dataset.label = 'Pos';
      const selPos = document.createElement('select');
      selPos.innerHTML = '<option value="LONG">BUY</option><option value="SHORT">SELL</option>';
      selPos.value = mov.direzione;
      selPos.title = 'Direzione di apertura: se BUY la chiusura è SELL, se SELL la chiusura è BUY';
      selPos.addEventListener('change', e => {
        const d = e.target.value;
        scheda[col][idx].direzione = d;
        // Pos close = inversa automatica della Pos open
        scheda[col][idx].direzioneClose = direzioneInversa(d);
        renderMovimenti(col); calcolaTutto();
      });
      tdPos.appendChild(selPos); tr.appendChild(tdPos);

      // Q.tà open
      const tdQta = document.createElement('td');
      tdQta.dataset.label = 'Q.tà';
      const inQta = document.createElement('input');
      inQta.type = 'number'; inQta.step = '1'; inQta.min = '0';
      inQta.value = mov.quantita;
      inQta.title = 'Quantità aperta';
      inQta.addEventListener('input', e => {
        const v = e.target.value;
        const q = v === '' ? 0 : (parseFloat(v) || 0);
        scheda[col][idx].quantita = q;
        // ricalcola lo stato del lato close rispetto alla nuova q.tà open
        scheda[col][idx].quantitaChiusa = Math.min(scheda[col][idx].quantitaChiusa || 0, q);
        // fee stimata automatica (solo se non modificata a mano)
        if (!scheda[col][idx].feeOpenManuale) {
          scheda[col][idx].feeOpen = _feeStimataLato(tipo, q);
        }
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdQta.appendChild(inQta); tr.appendChild(tdQta);

      // Prezzo open
      const tdPrezzo = document.createElement('td');
      tdPrezzo.dataset.label = 'Prezzo Open';
      const inPrezzo = document.createElement('input');
      inPrezzo.type = 'number'; inPrezzo.step = '0.25';
      inPrezzo.className = 'prezzo-nominale';
      inPrezzo.value = (mov.prezzoPulito === 0 || mov.prezzoPulito === undefined) ? '' : mov.prezzoPulito;
      inPrezzo.placeholder = '—';
      inPrezzo.title = 'Prezzo di apertura';
      inPrezzo.addEventListener('input', e => {
        const v = e.target.value;
        scheda[col][idx].prezzoPulito = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdPrezzo.appendChild(inPrezzo); tr.appendChild(tdPrezzo);

      // Fee open
      const tdFeeO = document.createElement('td');
      tdFeeO.dataset.label = 'Fee';
      const inFeeO = document.createElement('input');
      inFeeO.type = 'number'; inFeeO.step = '0.01'; inFeeO.min = '0';
      inFeeO.className = 'in-fee';
      inFeeO.value = (mov.feeOpen === 0 || mov.feeOpen === undefined) ? '' : mov.feeOpen;
      inFeeO.placeholder = '0';
      inFeeO.title = 'Fee di apertura. Se non la modifichi viene stimata automaticamente (fee per contratto per lato × q.tà). Entra nel P&L.';
      inFeeO.addEventListener('input', e => {
        const v = e.target.value;
        scheda[col][idx].feeOpen = v === '' ? 0 : (parseFloat(v) || 0);
        scheda[col][idx].feeOpenManuale = true; // da ora non più auto-stimata
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdFeeO.appendChild(inFeeO); tr.appendChild(tdFeeO);

      // ---- BLOCCO CHIUSURA ----

      // CLOSE (data)
      const tdDataC = document.createElement('td');
      tdDataC.dataset.label = 'Close';
      const inDataC = document.createElement('input');
      inDataC.type = 'date';
      inDataC.className = 'in-data';
      inDataC.value = mov.dataClose || '';
      inDataC.title = 'Data di chiusura';
      inDataC.addEventListener('change', e => {
        scheda[col][idx].dataClose = e.target.value;
        calcolaTutto();
      });
      tdDataC.appendChild(inDataC); tr.appendChild(tdDataC);

      // Pos close (inversa automatica della Pos open)
      const tdPosC = document.createElement('td');
      tdPosC.dataset.label = 'Pos Close';
      const selPosC = document.createElement('select');
      selPosC.innerHTML = '<option value="LONG">BUY</option><option value="SHORT">SELL</option>';
      selPosC.value = mov.direzioneClose || direzioneInversa(mov.direzione);
      selPosC.title = 'Direzione di chiusura: generata automaticamente come inversa della Pos di apertura';
      selPosC.addEventListener('change', e => {
        scheda[col][idx].direzioneClose = e.target.value;
        calcolaTutto();
      });
      tdPosC.appendChild(selPosC); tr.appendChild(tdPosC);

      // Q.tà close (chiusura parziale consentita)
      const tdQtaC = document.createElement('td');
      tdQtaC.dataset.label = 'Q.tà Close';
      const inQtaC = document.createElement('input');
      inQtaC.type = 'number'; inQtaC.step = '1'; inQtaC.min = '0';
      inQtaC.value = mov.quantitaChiusa || '';
      inQtaC.placeholder = '0';
      inQtaC.title = 'Quantità chiusa. Può essere minore della q.tà aperta: il residuo resta aperto';
      inQtaC.addEventListener('input', e => {
        const v = e.target.value;
        const q = v === '' ? 0 : (parseFloat(v) || 0);
        scheda[col][idx].quantitaChiusa = Math.min(q, scheda[col][idx].quantita || 0);
        if (!scheda[col][idx].feeCloseManuale) {
          scheda[col][idx].feeClose = _feeStimataLato(tipo, scheda[col][idx].quantitaChiusa);
        }
        ricalcolaStatiScheda(scheda, col);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdQtaC.appendChild(inQtaC); tr.appendChild(tdQtaC);

      // Prezzo close
      const tdPrezzoC = document.createElement('td');
      tdPrezzoC.dataset.label = 'Prezzo Close';
      const inPrezzoC = document.createElement('input');
      inPrezzoC.type = 'number'; inPrezzoC.step = '0.25';
      inPrezzoC.className = 'prezzo-nominale';
      inPrezzoC.value = (mov.prezzoClose === 0 || mov.prezzoClose === undefined) ? '' : mov.prezzoClose;
      inPrezzoC.placeholder = '—';
      inPrezzoC.title = 'Prezzo di chiusura';
      inPrezzoC.addEventListener('input', e => {
        const v = e.target.value;
        scheda[col][idx].prezzoClose = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdPrezzoC.appendChild(inPrezzoC); tr.appendChild(tdPrezzoC);

      // Fee close
      const tdFeeC = document.createElement('td');
      tdFeeC.dataset.label = 'Fee';
      const inFeeC = document.createElement('input');
      inFeeC.type = 'number'; inFeeC.step = '0.01'; inFeeC.min = '0';
      inFeeC.className = 'in-fee';
      inFeeC.value = (mov.feeClose === 0 || mov.feeClose === undefined) ? '' : mov.feeClose;
      inFeeC.placeholder = '0';
      inFeeC.title = 'Fee di chiusura. Se non la modifichi viene stimata automaticamente. Entra nel P&L.';
      inFeeC.addEventListener('input', e => {
        const v = e.target.value;
        scheda[col][idx].feeClose = v === '' ? 0 : (parseFloat(v) || 0);
        scheda[col][idx].feeCloseManuale = true; // da ora non più auto-stimata
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdFeeC.appendChild(inFeeC); tr.appendChild(tdFeeC);

      // ---- RLZD (P&L realizzato della riga, fee incluse) ----
      const tdRlzd = document.createElement('td');
      tdRlzd.className = 'pnl-riga td-pnl';
      tdRlzd.dataset.label = 'RLZD';
      tdRlzd.title = 'P&L realizzato della chiusura: (prezzo close − prezzo open) × q.tà close − fee, fee open proporzionale alla parte chiusa';
      const { testo, classe } = _valoreRlzdRiga(info, !isOn);
      tdRlzd.textContent = testo;
      tdRlzd.classList.add(classe);
      tr.appendChild(tdRlzd);

      tbody.appendChild(tr);
    });
  }
