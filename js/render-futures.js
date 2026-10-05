// render-futures.js — render tabelle futures e righe totali
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // RENDER
  // ============================================================
  function renderRigaTotale(col, res) {
    const rt = el('rt' + col);
    const qtaEl = rt.querySelector('.rt-qta');
    const prezzoEl = rt.querySelector('.rt-prezzo strong');

    if (res.qtaNetta === 0) {
      qtaEl.innerHTML = '<span class="dir-flat">—</span>';
      prezzoEl.textContent = '—';
    } else {
      const dir = res.qtaNetta > 0 ? 'LONG' : 'SHORT';
      const dirClsName = res.qtaNetta > 0 ? 'dir-long' : 'dir-short';
      qtaEl.innerHTML = `${Math.abs(res.qtaNetta)} <span class="${dirClsName}">${dir}</span>`;
      prezzoEl.textContent = isNaN(res.mediaPulita) ? '—' : formatPrezzo(res.mediaPulita);
    }

    const setVal = (id, val) => {
      const e = el(id);
      e.textContent = formatEuro(val);
      e.classList.remove('green', 'red', 'muted');
      if (!isFinite(val) || val === 0) e.classList.add('muted');
      else e.classList.add(val >= 0 ? 'green' : 'red');
    };
    setVal('rtAperto' + col, res.pnlAperto);
    setVal('rtTot' + col, res.pnlTotale);
  }

  function aggiornaCalcolati(col) {
    const res = calcolaColonna(schedaAttiva(), col);
    renderRigaTotale(col, res);

    const tbody = el('body' + col);
    const trs = tbody.querySelectorAll('tr');
    trs.forEach((tr, idx) => {
      const info = res.righe[idx];
      if (!info) return;
      const tdPnl = tr.querySelector('.pnl-riga');
      if (tdPnl) {
        const pnlVal = info.pnlTotale || 0;
        tdPnl.textContent = formatEuro(pnlVal);
        tdPnl.classList.remove('green', 'red', 'muted');
        if (pnlVal === 0 && info.tipo === 'vuota') tdPnl.classList.add('muted');
        else tdPnl.classList.add(pnlVal >= 0 ? 'green' : 'red');
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

      // Attivo (toggle)
      const tdAtt = document.createElement('td');
      tdAtt.dataset.label = '';
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

      // Dir
      const tdDir = document.createElement('td');
      tdDir.dataset.label = 'Dir';
      const selDir = document.createElement('select');
      selDir.innerHTML = '<option value="LONG">LONG</option><option value="SHORT">SHORT</option>';
      selDir.value = mov.direzione;
      selDir.addEventListener('change', e => {
        scheda[col][idx].direzione = e.target.value;
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdDir.appendChild(selDir); tr.appendChild(tdDir);

      // Q.tà (il totale delle posizioni aperte è nella riga di intestazione)
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
      tdPrezzo.dataset.label = 'Prezzo nominale';
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

      // DEL
      const tdDel = document.createElement('td');
      tdDel.className = 'td-del';
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-del'; btnDel.textContent = 'DEL';
      btnDel.title = 'Elimina riga';
      btnDel.addEventListener('click', () => {
        if (!confirm('Eliminare questa riga di movimento?')) return;
        scheda[col].splice(idx, 1);
        renderMovimenti(col); calcolaTutto();
      });
      tdDel.appendChild(btnDel); tr.appendChild(tdDel);

      // P&L
      const tdPnl = document.createElement('td');
      tdPnl.className = 'pnl-riga td-pnl';
      tdPnl.dataset.label = 'P&L';
      if (!isOn) {
        tdPnl.textContent = '—';
        tdPnl.classList.add('muted');
      } else {
        const pnlVal = info.pnlTotale || 0;
        tdPnl.textContent = formatEuro(pnlVal);
        if (pnlVal === 0 && info.tipo === 'vuota') tdPnl.classList.add('muted');
        else tdPnl.classList.add(pnlVal >= 0 ? 'green' : 'red');
      }
      tr.appendChild(tdPnl);

      tbody.appendChild(tr);
    });
  }
