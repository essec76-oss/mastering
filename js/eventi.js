// eventi.js — binding degli eventi interfaccia
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.

// ============================================================
// CATALOGO COMMODITIES (moltiplicatori inclusi)
// ============================================================
const COMMODITIES = {
  // Agricoli
  ZM: { nome: 'Soybean Meal', molt: 100 },
  ZW: { nome: 'Wheat', molt: 50 },
  ZC: { nome: 'Corn', molt: 50 },
  ZL: { nome: 'Soybean Oil', molt: 600 },
  ZS: { nome: 'Soybean', molt: 50 },
  KE: { nome: 'KC Wheat', molt: 50 },
  // Carni
  LE: { nome: 'Live Cattle', molt: 400 },
  GF: { nome: 'Feeder Cattle', molt: 500 },
  HE: { nome: 'Lean Hogs', molt: 400 },
  // Energetici
  RB: { nome: 'RBOB Gasoline', molt: 42000 },
  NG: { nome: 'Natural Gas', molt: 10000 },
  HO: { nome: 'Heating Oil', molt: 42000 },
  CL: { nome: 'Crude Oil', molt: 1000 },
  // Metalli
  SI: { nome: 'Silver', molt: 5000 },
  GC: { nome: 'Gold', molt: 100 },
  PL: { nome: 'Platinum', molt: 50 },
  HG: { nome: 'Copper', molt: 25000 },
  // Softs / Altri
  CC: { nome: 'Cocoa', molt: 10 },
  KC: { nome: 'Coffee', molt: 375 },
  CT: { nome: 'Cotton', molt: 500 },
  OJ: { nome: 'Orange Juice', molt: 150 },
  SB: { nome: 'Sugar', molt: 1120 }
};

// Popola MOLTIPLICATORI (definito in config.js) con i ticker commodities
// per compatibilità con futures.js e opzioni.js
if (typeof MOLTIPLICATORI !== 'undefined') {
  Object.entries(COMMODITIES).forEach(([k, v]) => {
    MOLTIPLICATORI[k] = v.molt;
  });
}

// ============================================================
// EVENTI BASE
// ============================================================
el('prezzoSpot').addEventListener('input', () => {
  aggiornaCalcolati('NES');
  aggiornaCalcolati('MES');
  calcolaTutto();
});
el('riskFree').addEventListener('input', () => {
  calcolaTutto();
});
if (el('volAtm')) el('volAtm').addEventListener('input', () => {
  calcolaTutto();
});
if (el('divYield')) el('divYield').addEventListener('input', () => {
  calcolaTutto();
});
if (el('cash')) el('cash').addEventListener('input', () => {
  stato.cash = parseFloat(el('cash').value) || 0;
  aggiornaStileCash();
  calcolaTutto();
});
if (el('cashEscludi')) el('cashEscludi').addEventListener('change', () => {
  stato.cashEscluso = el('cashEscludi').checked;
  calcolaTutto();
});
if (el('dataAnalisi')) el('dataAnalisi').addEventListener('change', () => {
  calcolaTutto();
});

if (el('showExpiryCorrente'))   el('showExpiryCorrente').addEventListener('change',   () => redrawChartFromView());
if (el('showNowCorrente'))      el('showNowCorrente').addEventListener('change',      () => redrawChartFromView());
if (el('showExpiryPrecedente')) el('showExpiryPrecedente').addEventListener('change', () => redrawChartFromView());
if (el('showNowPrecedente'))    el('showNowPrecedente').addEventListener('change',    () => redrawChartFromView());
if (el('showBE'))     el('showBE').addEventListener('change', () => redrawChartFromView());
if (el('showSigma'))  el('showSigma').addEventListener('change', () => redrawChartFromView());
if (el('nSD'))        el('nSD').addEventListener('change', () => redrawChartFromView());

// ============================================================
// GESTIONE TICKER / SOTTOTITOLO
// ============================================================
function descriviCommodity(ticker) {
  const c = COMMODITIES[ticker];
  if (!c) return ticker + ' futures — metodo prezzo medio (IBKR)';
  return ticker + ' — ' + c.nome + ' futures (×' + c.molt + ') — metodo prezzo medio (IBKR)';
}

function propagaTickerCommodity(ticker, sourceCol) {
  const scheda = schedaAttiva();
  scheda.tipoNES = ticker;
  scheda.tipoMES = ticker;
  scheda.strumentoOpzioni = ticker;

  // Aggiorna visivamente i select
  if (sourceCol !== 'NES' && el('tipoNES')) el('tipoNES').value = ticker;
  if (sourceCol !== 'MES' && el('tipoMES')) el('tipoMES').value = ticker;
  if (sourceCol !== 'OPZ' && el('strumentoOpzioni')) el('strumentoOpzioni').value = ticker;

  const sub = el('subtitle');
  if (sub) sub.textContent = descriviCommodity(ticker);
}

el('tipoNES').addEventListener('change', e => {
  schedaAttiva().tipoNES = e.target.value;
  if (stato.modalita === 'futures-commodities') {
    propagaTickerCommodity(e.target.value, 'NES');
  }
  renderMovimenti('NES'); calcolaTutto();
});

el('tipoMES').addEventListener('change', e => {
  schedaAttiva().tipoMES = e.target.value;
  if (stato.modalita === 'futures-commodities') {
    propagaTickerCommodity(e.target.value, 'MES');
  }
  renderMovimenti('MES'); calcolaTutto();
});

el('strumentoOpzioni').addEventListener('change', e => {
  schedaAttiva().strumentoOpzioni = e.target.value;
  if (stato.modalita === 'futures-commodities') {
    propagaTickerCommodity(e.target.value, 'OPZ');
  }
  renderOpzioni();
  calcolaTutto();
});

// ============================================================
// SELETTORE MODALITÀ GLOBALE
// ============================================================
function _riempiSelectTipo(sel, opzioni, valore) {
  if (!sel) return;
  sel.innerHTML = '';
  opzioni.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  });
  const esiste = opzioni.some(o => o.value === valore);
  sel.value = esiste ? valore : (opzioni[0] ? opzioni[0].value : '');
}

function applicaModalita(mod) {
  stato.modalita = mod || MODALITA_DEFAULT;
  const selNES = el('tipoNES');
  const selMES = el('tipoMES');
  const selOpz = el('strumentoOpzioni');
  const sub = el('subtitle');
  const scheda = schedaAttiva();

  if (stato.modalita === 'azioni') {
    _riempiSelectTipo(selNES, [{ value: 'X', label: 'AZIONI' }], 'X');
    _riempiSelectTipo(selMES, [{ value: 'X', label: 'AZIONI' }], 'X');
    if (selNES) selNES.disabled = true;
    if (selMES) selMES.disabled = true;
    if (selOpz) {
      selOpz.innerHTML = '<option value="AZIONI">AZIONI</option>';
      selOpz.value = 'AZIONI';
      selOpz.disabled = true;
    }
    scheda.tipoNES = 'X';
    scheda.tipoMES = 'X';
    scheda.strumentoOpzioni = 'AZIONI';
    stato.schede.forEach(s => {
      s.tipoNES = 'X';
      s.tipoMES = 'X';
      s.strumentoOpzioni = 'AZIONI';
    });
    if (sub) sub.textContent = 'Azioni — simulatore azioni + opzioni su azioni — metodo prezzo medio (IBKR)';

  } else if (stato.modalita === 'futures-indici') {
    const optsIndici = [
      { value: '-', label: '-' },
      { value: 'NES', label: 'NES' },
      { value: 'MES', label: 'MES' },
      { value: 'ES', label: 'ES' }
    ];
    const curNES = (scheda.tipoNES === 'X' || COMMODITIES[scheda.tipoNES]) ? 'NES' : (scheda.tipoNES || 'NES');
    const curMES = (scheda.tipoMES === 'X' || COMMODITIES[scheda.tipoMES]) ? 'MES' : (scheda.tipoMES || 'MES');
    _riempiSelectTipo(selNES, optsIndici, curNES);
    _riempiSelectTipo(selMES, optsIndici, curMES);
    if (selNES) selNES.disabled = false;
    if (selMES) selMES.disabled = false;
    if (selOpz) {
      selOpz.innerHTML = '<option value="MES">MES</option><option value="ES">ES</option>';
      const curOpz = (scheda.strumentoOpzioni === 'AZIONI') ? 'MES' : (scheda.strumentoOpzioni || 'MES');
      selOpz.value = (curOpz === 'ES') ? 'ES' : 'MES';
      selOpz.disabled = false;
    }
    scheda.tipoNES = selNES ? selNES.value : 'NES';
    scheda.tipoMES = selMES ? selMES.value : 'MES';
    scheda.strumentoOpzioni = selOpz ? selOpz.value : 'MES';
    if (sub) sub.textContent = 'NES / MES / ES — Nano, Micro & E-mini futures ES500 — metodo prezzo medio (IBKR)';

  } else if (stato.modalita === 'futures-commodities') {
    const optsComm = Object.keys(COMMODITIES).map(k => ({
      value: k, label: k + ' (×' + COMMODITIES[k].molt + ')'
    }));

    // Se il ticker corrente non è una commodity valida, fallback a ZW
    const curTicker = (COMMODITIES[scheda.tipoNES] && scheda.tipoNES !== 'X') ? scheda.tipoNES : 'ZW';

    _riempiSelectTipo(selNES, optsComm, curTicker);
    _riempiSelectTipo(selMES, optsComm, curTicker);
    _riempiSelectTipo(selOpz, optsComm, curTicker);

    if (selNES) selNES.disabled = false;
    if (selMES) selMES.disabled = false;
    if (selOpz) selOpz.disabled = false;

    scheda.tipoNES = curTicker;
    scheda.tipoMES = curTicker;
    scheda.strumentoOpzioni = curTicker;

    // Aggiorna tutte le schede per evitare mix
    stato.schede.forEach(s => {
      if (!COMMODITIES[s.tipoNES]) s.tipoNES = curTicker;
      if (!COMMODITIES[s.tipoMES]) s.tipoMES = curTicker;
      if (!COMMODITIES[s.strumentoOpzioni]) s.strumentoOpzioni = curTicker;
    });

    if (sub) sub.textContent = descriviCommodity(curTicker);
  }

  renderMovimenti('NES');
  renderMovimenti('MES');
  renderOpzioni();
  calcolaTutto();
}

if (el('modalitaGlobale')) {
  el('modalitaGlobale').addEventListener('change', e => {
    applicaModalita(e.target.value);
  });
  applicaModalita(el('modalitaGlobale').value || MODALITA_DEFAULT);
}

// ============================================================
// ALTRI EVENTI
// ============================================================
document.querySelectorAll('.btn-add[data-col]').forEach(btn => {
  btn.addEventListener('click', () => {
    const col = btn.dataset.col;
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    schedaAttiva()[col].push({ direzione: 'LONG', quantita: 1, prezzoPulito: spot, attivo: true });
    renderMovimenti(col); calcolaTutto();
  });
});

el('btnAddOpzione').addEventListener('click', () => {
  const defaultScad = dataAnalisiDate();
  defaultScad.setDate(defaultScad.getDate() + 30);
  const yyyy = defaultScad.getFullYear();
  const mm = String(defaultScad.getMonth() + 1).padStart(2, '0');
  const dd = String(defaultScad.getDate()).padStart(2, '0');
  schedaAttiva().opzioni.push({
    attivo: true, strumento: strumentoOpzSelezionato(),
    pos: 'SELL', tipo: 'PUT', qta: 1, assgn: false,
    strike: 0, rlzd: '', premio: 0, vol: 15, scadenza: `${yyyy}-${mm}-${dd}`,
    stato: 'APERTA'
  });
  renderOpzioni(); calcolaTutto();
});

el('btnCreaComp').addEventListener('click', creaComparazione);
el('btnReset').addEventListener('click', reset);

if (el('btnSalvaCome')) el('btnSalvaCome').addEventListener('click', () => salvaConNome(el('nomeStrategia').value));
if (el('nomeStrategia')) el('nomeStrategia').addEventListener('input', e => {
  const inp = e.target;
  const pos = inp.selectionStart;
  inp.value = inp.value.toUpperCase();
  inp.setSelectionRange(pos, pos);
});

// ============================================================
// MODALE SCELTA STRATEGIA (carica / elimina)
// ============================================================
// Il menu a tendina è stato rimosso: il pulsante «Carica da cloud»
// apre una finestra di scelta; la conferma carica la strategia
// selezionata. Anche «Elimina» usa la stessa finestra (conferma: Elimina).
let _modaleStrategieModo = 'carica';
let _modaleStrategieSelezione = null;

function apriModaleStrategie(modo) {
  _modaleStrategieModo = modo || 'carica';
  _modaleStrategieSelezione = null;
  const ov = el('modalStrategieOverlay');
  if (!ov) return;

  const titolo = el('modalStrategieTitolo');
  if (titolo) titolo.textContent = _modaleStrategieModo === 'elimina'
    ? 'Elimina strategia salvata'
    : 'Carica strategia da cloud';

  const conferma = el('modalStrategieConferma');
  if (conferma) {
    conferma.textContent = _modaleStrategieModo === 'elimina' ? 'Elimina' : 'Carica';
    conferma.disabled = true;
  }

  const cerca = el('modalStrategieCerca');
  if (cerca) cerca.value = '';

  ov.style.display = 'flex';
  renderListaSalvate('').then(() => {
    _modaleEvidenziaSelezione();
    if (cerca) cerca.focus();
  });
}

function chiudiModaleStrategie() {
  const ov = el('modalStrategieOverlay');
  if (ov) ov.style.display = 'none';
  _modaleStrategieSelezione = null;
}

function _modaleEvidenziaSelezione() {
  const box = el('modalListaStrategie');
  if (box) {
    box.querySelectorAll('.strategia-row').forEach(r => {
      const sel = r.dataset.nome === _modaleStrategieSelezione;
      r.classList.toggle('selected', sel);
      // Feedback visivo diretto (inline style, immune a conflitti CSS)
      r.style.background = sel ? 'rgba(79,140,255,.22)' : '';
      r.style.borderLeft = sel ? '4px solid var(--accent, #4f8cff)' : '4px solid transparent';
      r.style.color = sel ? 'var(--text, #e6e8ee)' : '';
      r.style.fontWeight = sel ? '700' : '';
      // Aggiorna solo il nome (la sparkline nella riga non viene toccata)
      const nm = r.querySelector('.strategia-nome');
      if (nm) nm.textContent = (sel ? '✓ ' : '') + r.dataset.nome;
      else r.textContent = (sel ? '✓ ' : '') + r.dataset.nome;
    });
  }
  const conferma = el('modalStrategieConferma');
  if (conferma) conferma.disabled = !_modaleStrategieSelezione;
}

async function _modaleConfermaAzione() {
  const nome = _modaleStrategieSelezione;
  if (!nome) return;
  if (_modaleStrategieModo === 'elimina') {
    await eliminaSalvato(nome);
    chiudiModaleStrategie();
    // azzera la pagina di lavoro come «Reset», senza una seconda conferma
    reset(true);
  } else {
    chiudiModaleStrategie();
    await caricaSalvato(nome);
  }
}

if (el('btnCaricaSalvato')) el('btnCaricaSalvato').addEventListener('click', () => apriModaleStrategie('carica'));
if (el('btnEliminaSalvato')) el('btnEliminaSalvato').addEventListener('click', () => apriModaleStrategie('elimina'));
if (el('modalStrategieAnnulla')) el('modalStrategieAnnulla').addEventListener('click', chiudiModaleStrategie);
if (el('modalStrategieOverlay')) el('modalStrategieOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) chiudiModaleStrategie();
});
if (el('modalStrategieConferma')) el('modalStrategieConferma').addEventListener('click', _modaleConfermaAzione);
if (el('modalStrategieCerca')) el('modalStrategieCerca').addEventListener('input', e => {
  renderListaSalvate(e.target.value).then(_modaleEvidenziaSelezione);
});
const _boxModaleStrategie = el('modalListaStrategie');
if (_boxModaleStrategie) {
  _boxModaleStrategie.addEventListener('click', e => {
    const r = e.target.closest('.strategia-row');
    if (!r) return;
    _modaleStrategieSelezione = r.dataset.nome;
    _modaleEvidenziaSelezione();
  });
  _boxModaleStrategie.addEventListener('dblclick', e => {
    const r = e.target.closest('.strategia-row');
    if (!r) return;
    _modaleStrategieSelezione = r.dataset.nome;
    _modaleConfermaAzione();
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') chiudiModaleStrategie();
});

if (el('btnEsporta')) el('btnEsporta').addEventListener('click', esportaFile);
if (el('btnImporta')) el('btnImporta').addEventListener('click', () => el('fileImporta').click());
if (el('fileImporta')) el('fileImporta').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (f) importaDaInputFile(f);
  e.target.value = '';
});

renderListaSalvate('');
