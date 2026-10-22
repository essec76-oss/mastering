// render-opzioni.js — render opzioni: greche, colonne extra e P&L combinato
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.

  function formatGreek(v, digits = 3) {
    if (!isFinite(v)) return '—';
    return v.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function formatGreekAuto(v, minDig, maxDig) {
    if (!isFinite(v)) return '—';
    return v.toLocaleString('it-IT', { minimumFractionDigits: minDig, maximumFractionDigits: maxDig });
  }

  function premioEffettivo(opz) {
    if (opz.premio && opz.premio !== 0) return opz.premio;
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    if (!(spot > 0)) return 0;
    const g = calcolaGrecheOpzione(opz);
    return isFinite(g.price) ? g.price : 0;
  }

  function aggiornaGiorniResidui(tr, opz) {
    const ggCell = tr.querySelector('[data-field="gg"]');
    if (!ggCell) return;
    const gg = giorniResiduiOpzione(opz);
    if (gg === null) {
      ggCell.textContent = '—';
      ggCell.style.color = '';
      return;
    }
    ggCell.textContent = String(gg);
    ggCell.style.color = gg < 0 ? 'var(--red)' : (gg <= 7 ? 'var(--yellow)' : 'var(--muted)');
  }

  function aggiornaExtraOpzione(tr, opz) {
    const setG = (f, val, dig) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (cell) cell.textContent = formatGreek(val, dig);
    };
    const setPct = (f, p) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (!cell) return;
      if (p === null || !isFinite(p)) { cell.textContent = '—'; return; }
      cell.textContent = (p * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    };

    if (opz.attivo === false || opz.stato === 'CHIUSA') {
      setG('intrinseco', NaN, 2);
      setG('temporale', NaN, 2);
      setPct('tocco', null);
      const sc = tr.querySelector('[data-field="pnlScad"]');
      if (sc) { sc.textContent = '—'; sc.classList.remove('green', 'red', 'muted'); sc.classList.add('muted'); }
      const dc = tr.querySelector('[data-field="debitcredit"]');
      if (dc) dc.textContent = '—';
      return;
    }

    const g = calcolaGrecheOpzione(opz);
    setG('intrinseco', g.intrinsic, 2);
    setG('temporale', (isFinite(g.price) && isFinite(g.intrinsic)) ? g.price - g.intrinsic : NaN, 2);

    const spot = parse
