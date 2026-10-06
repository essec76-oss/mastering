// render-futures.js — render righe futures/azioni: come le opzioni, senza header
// Ogni ingrediente è una riga auto-descritta: nascondi, DEL, BUY/SELL, Q.tà,
// Prezzo, Delta. Sotto le righe, il Delta totale della colonna ($/pt).
// Parte di Mastering (già app.js): l'ordine di caricamento è definito in index.html.

  // ============================================================
  // RENDER
  // ============================================================
  // Delta di posizione della singola riga ($/pt): segno × q.tà aperta × molt.
  function deltaRiga(info, tipo) {
    if (!info || !(info.qAperta > 0)) return NaN;
    const molt = MOLTIPLICATORI[tipo] || 0;
    if (!molt) return NaN;
    const segno = info.direzione === 'LONG' ? 1 : -1;
    return segno * info.qAperta * molt;
  }

  // Delta totale della colonna ($/pt): q.tà netta × moltiplicatore.
  // Manteniamo la firma renderRigaTotale(col, res) usata da calcola-tutto.js.
  function renderRigaTotale(col, res) {
    const dEl = el('deltaTot' + col);
    if (!dEl) return;
    let d = 0;
    if (res.tipo && res.tipo !== '-' && res.qtaNetta !== 0) {
      d = res.qtaNetta * (MOLTIPLICATORI[res.tipo] || 0);
    }
    if (d === 0) {
      dEl.textContent = '—';
      dEl.className = 'value muted';
    } else {
      dEl.textContent = formatGreekAuto(d, 2, 3);
      dEl.className = 'value ' + (d >= 0 ? 'green' : 'red');
    }
  }

  // Aggiorna le celle Delta delle righe e il Delta totale (senza re-render,
  // per non perdere il focus sugli input mentre si digita)
  function aggiornaCalcolati(col) {
    const scheda = schedaAttiva();
    const res = calcolaColonna(scheda, col);
    renderRigaTotale(col, res);

    const tbody = el('body' + col);
    tbody.querySelectorAll('tr').forEach((tr, idx) => {
      const info = res.righe[idx];
      if (!info) return;
      const tdDelta = tr.querySelector('.delta-riga');
      if (!tdDelta) return;
      if (scheda[col][idx].attivo === false) {
        tdDelta.textContent = '—';
        tdDelta.className = 'delta-riga muted';
        return;
      }
      const d = deltaRiga(info, res.tipo);
      if (!isFinite(d) || d === 0) {
        tdDelta.textContent = '—';
        tdDelta.className = 'delta-riga muted';
      } else {
        tdDelta.textContent = formatGreekAuto(d, 2, 3);
        tdDelta.className = 'delta-riga ' + (d >= 0 ? 'green' : 'red');
      }
    });
  }

  function renderMovimenti(col) {
    const scheda = schedaAttiva();
    const res = calcolaColonna(scheda, col);
    renderRigaTotale(col, res);

    const tbody = el('body' + col);
    tbody.innerHTML = '';

    scheda[col].forEach((mov, idx) => {
      const info = res.righe[idx] || { tipo: 'vuota', qAperta: 0, qChiusa: 0, pnlTotale: 0 };
      const tr = document.createElement('tr');
      if (info.tipo === 'chiusura') tr.classList.add('row-chiusura');
      const isOn = mov.attivo !== false;
      if (!isOn) tr.classList.add('row-off');

      // Nascondi (toggle): esclude la riga dai conteggi
      const tdAtt = document.createElement('td');
      tdAtt.dataset.label = 'Nascondi';
      const inAtt = document.createElement('input');
      inAtt.type = 'checkbox';
      inAtt.className = 'toggle-on';
      inAtt.checked = !isOn;
      inAtt.title = 'Spunta per escludere dai conteggi (riga oscurata)';
      inAtt.addEventListener('change', e => {
        scheda[col][idx].attivo = !e.target.checked;
        renderMovimenti(col);
        calcolaTutto();
      });
      tdAtt.appendChild(inAtt); tr.appendChild(tdAtt);

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

      // Pos (BUY / SELL) — internamente resta LONG/SHORT
      const tdPos = document.createElement('td');
      tdPos.dataset.label = 'Pos';
      const selPos = document.createElement('select');
      selPos.innerHTML = '<option value="LONG">BUY</option><option value="SHORT">SELL</option>';
      selPos.value = mov.direzione;
      selPos.addEventListener('change', e => {
        scheda[col][idx].direzione = e.target.value;
        renderMovimenti(col); calcolaTutto();
      });
      tdPos.appendChild(selPos); tr.appendChild(tdPos);

      // Q.tà
      const tdQta = document.createElement('td');
      tdQta.dataset.label = 'Q.tà';
      const inQta = document.createElement('input');
      inQta.type = 'number'; inQta.step = '1'; inQta.min = '0';
      inQta.value = mov.quantita;
      inQta.addEventListener('input', e => {
        const v = e.target.value;
        scheda[col][idx].quantita = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdQta.appendChild(inQta); tr.appendChild(tdQta);

      // Prezzo nominale
      const tdPrezzo = document.createElement('td');
      tdPrezzo.dataset.label = 'Prezzo';
      const inPrezzo = document.createElement('input');
      inPrezzo.type = 'number'; inPrezzo.step = '0.25';
      inPrezzo.className = 'prezzo-nominale';
      inPrezzo.value = (mov.prezzoPulito === 0 || mov.prezzoPulito === undefined) ? '' : mov.prezzoPulito;
      inPrezzo.placeholder = '—';
      inPrezzo.addEventListener('input', e => {
        const v = e.target.value;
        scheda[col][idx].prezzoPulito = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdPrezzo.appendChild(inPrezzo); tr.appendChild(tdPrezzo);

      // Delta ($/pt)
      const tdDelta = document.createElement('td');
      tdDelta.className = 'delta-riga td-delta';
      tdDelta.dataset.label = 'Delta';
      tdDelta.title = 'Delta di posizione: $ per punto (q.tà × moltiplicatore)';
      if (!isOn) {
        tdDelta.textContent = '—';
        tdDelta.classList.add('muted');
      } else {
        const d = deltaRiga(info, res.tipo);
        if (!isFinite(d) || d === 0) {
          tdDelta.textContent = '—';
          tdDelta.classList.add('muted');
        } else {
          tdDelta.textContent = formatGreekAuto(d, 2, 3);
          tdDelta.classList.add(d >= 0 ? 'green' : 'red');
        }
      }
      tr.appendChild(tdDelta);

      tbody.appendChild(tr);
    });
  }
