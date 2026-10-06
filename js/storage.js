// storage.js — persistenza localStorage, strategie salvate (multi-save), migrazioni e stato di salvataggio
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // UTILITY
  // ============================================================
  let autosaveTimer = null;
  function autosalva() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => salva(true), 800);
  }
  // Flush immediato alla chiusura della pagina
  window.addEventListener('beforeunload', () => {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
      salva(true);
    }
  });

  function raccogliDati() {
    const dati = {
      prezzoSpot: parseFloat(el('prezzoSpot').value) || 0,
      riskFree: parseFloat(el('riskFree').value) || 0,
      volAtm: parseFloat(el('volAtm').value) || 0,
      divYield: parseFloat(el('divYield') && el('divYield').value) || 0,
      cash: parseFloat(el('cash').value) || 0,
      cashEscluso: !!stato.cashEscluso,
      commissioniOn: commissioniAttive(),
      dataAnalisi: el('dataAnalisi') ? (el('dataAnalisi').value || '') : '',
      tipoNES: el('tipoNES').value,
      tipoMES: el('tipoMES').value,
      attiva: stato.attiva,
      schede: stato.schede
    };
    return dati;
  }

  function salva(silent) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raccogliDati()));
      if (!silent) mostraStatus('✓ Salvato');
    } catch (e) { mostraStatus('Errore salvataggio', true); }
  }

  function carica() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      for (const k of STORAGE_KEYS_LEGACY) {
        if (raw) break;
        raw = localStorage.getItem(k);
      }
      if (!raw) return false;
      applicaDati(JSON.parse(raw));

      return true;
    } catch (e) { return false; }
  }

  // Applica un oggetto dati (corrente, salvato o importato) ai controlli della pagina
  function applicaDati(dati) {
      if (typeof dati.prezzoSpot === 'number') el('prezzoSpot').value = dati.prezzoSpot;
      if (typeof dati.riskFree === 'number') el('riskFree').value = dati.riskFree;
      if (typeof dati.volAtm === 'number') el('volAtm').value = dati.volAtm;
      if (typeof dati.divYield === 'number' && el('divYield')) el('divYield').value = dati.divYield;
      if (typeof dati.cash === 'number') { el('cash').value = dati.cash; stato.cash = dati.cash; aggiornaStileCash(); }
      stato.cashEscluso = dati.cashEscluso === true;
      if (el('cashEscludi')) el('cashEscludi').checked = stato.cashEscluso;
      if (el('commissioniOn')) el('commissioniOn').checked = dati.commissioniOn !== false;
      if (typeof dati.dataAnalisi === 'string' && dati.dataAnalisi) el('dataAnalisi').value = dati.dataAnalisi;
      if (dati.tipoNES) el('tipoNES').value = dati.tipoNES;
      if (dati.tipoMES) el('tipoMES').value = dati.tipoMES;
      if (Array.isArray(dati.schede) && dati.schede.length) {
        stato.schede = dati.schede.map(migraScheda);
      } else if (Array.isArray(dati.NES) || Array.isArray(dati.MES) || Array.isArray(dati.opzioni)) {
        // v18 e precedenti: una sola scheda → diventa la Matrice
        stato.schede = [migraScheda({
          nome: 'Matrice',
          tipoNES: dati.tipoNES || 'NES',
          tipoMES: dati.tipoMES || 'MES',
          NES: dati.NES, MES: dati.MES,
          opzioni: dati.opzioni,
          strumentoOpzioni: dati.strumentoOpzioni || 'MES'
        })];
      }
      stato.attiva = Math.max(0, Math.min(stato.schede.length - 1, dati.attiva || 0));
  }

  // ============================================================
  // SUPABASE — Step 1: solo connessione (nessun salvataggio cloud ancora)
  // ============================================================
  let _sbClient = null;

  function supabaseConfigurato() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY
      && SUPABASE_URL.indexOf('YOUR_') === -1
      && SUPABASE_ANON_KEY.indexOf('YOUR_') === -1
      && window.supabase && typeof window.supabase.createClient === 'function');
  }

  function getSupabase() {
    if (!supabaseConfigurato()) return null;
    if (!_sbClient) {
      _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return _sbClient;
  }

  // Prova una SELECT leggera sulla tabella strategie.
  // - non configurato → silenzioso
  // - ok → messaggio verde
  // - errore → messaggio rosso con dettaglio
  async function testaConnessioneSupabase() {
    if (!supabaseConfigurato()) return;
    const sb = getSupabase();
    if (!sb) return;
    try {
      const { error } = await sb.from('strategie').select('nome').limit(1);
      if (error) {
        mostraStatus('Supabase: ' + (error.message || 'errore'), true);
        return false;
      }
      mostraStatus('✓ Supabase collegato');
      return true;
    } catch (e) {
      mostraStatus('Supabase: rete o chiave non valide', true);
      return false;
    }
  }

  // ============================================================
  // STRATEGIE SALVATE: salvataggio multiplo con nome (es. AMZN, AAPL)
  // Ogni strategia è un "dato completo" indipendente: spot, parametri,
  // cash, schede (Matrice + comparazioni) e righe futures/opzioni.
  // (Step 1: ancora solo localStorage — cloud nello step successivo)
  // ============================================================
  const STORAGE_SALVATI = 'mastering_salvati_v1';

  function leggiSalvati() {
    try { return JSON.parse(localStorage.getItem(STORAGE_SALVATI)) || {}; }
    catch (e) { return {}; }
  }
  function scriviSalvati(map) {
    localStorage.setItem(STORAGE_SALVATI, JSON.stringify(map));
  }
  function listaSalvate() {
    return Object.keys(leggiSalvati()).sort((a, b) => a.localeCompare(b));
  }
  function renderListaSalvate() {
    const sel = el('listaSalvate');
    if (!sel) return;
    const nomi = listaSalvate();
    const corrente = el('nomeStrategia') ? el('nomeStrategia').value.trim() : '';
    sel.innerHTML = '';
    if (!nomi.length) {
      const o = document.createElement('option');
      o.value = ''; o.textContent = '— nessuna strategia salvata —';
      sel.appendChild(o);
      return;
    }
    nomi.forEach(n => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      if (n === corrente) o.selected = true;
      sel.appendChild(o);
    });
  }

  function salvaConNome(nome) {
    nome = (nome || '').trim();
    const input = el('nomeStrategia');
    if (!nome) { mostraStatus('Inserisci un nome (es. AMZN)', true); if (input) input.focus(); return; }
    const map = leggiSalvati();
    if (map[nome] && !confirm('Esiste già una strategia "' + nome + '".\nSovrascriverla con i dati correnti?')) return;
    map[nome] = { salvatoIl: new Date().toISOString(), dati: raccogliDati() };
    try {
      scriviSalvati(map);
      renderListaSalvate();
      mostraStatus('✓ Strategia "' + nome + '" salvata');
    } catch (e) { mostraStatus('Errore salvataggio', true); }
  }

  function caricaSalvato(nome) {
    const entry = leggiSalvati()[nome];
    if (!entry || !entry.dati) { mostraStatus('Strategia non trovata', true); return; }
    applicaDati(entry.dati);
    if (el('nomeStrategia')) el('nomeStrategia').value = nome;
    renderTabs(); renderScheda(); renderListaSalvate();
    mostraStatus('✓ "' + nome + '" caricata');
  }

  function eliminaSalvato(nome) {
    if (!nome) return;
    if (!confirm('Eliminare la strategia salvata "' + nome + '"?\n\n(Il lavoro corrente a video non cambia.)')) return;
    const map = leggiSalvati();
    delete map[nome];
    scriviSalvati(map);
    renderListaSalvate();
    mostraStatus('✓ "' + nome + '" eliminata');
  }

  // ============================================================
  // EXPORT / IMPORT FILE JSON (backup e spostamento tra browser/PC)
  // ============================================================
  function esportaFile() {
    const nome = (el('nomeStrategia') && el('nomeStrategia').value.trim()) || 'strategia';
    const payload = {
      formato: 'mastering-strategia', versione: 1,
      nome, esportatoIl: new Date().toISOString(),
      dati: raccogliDati()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const oggi = new Date().toISOString().slice(0, 10);
    a.download = 'mastering-' + nome.replace(/[^a-z0-9_-]+/gi, '_') + '-' + oggi + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    mostraStatus('✓ File esportato');
  }

  function importaDaJson(testo) {
    const obj = JSON.parse(testo);
    const dati = (obj && obj.formato === 'mastering-strategia') ? obj.dati : obj;
    if (!dati || !Array.isArray(dati.schede)) throw new Error('formato non riconosciuto');
    applicaDati(dati);
    if (el('nomeStrategia') && obj && obj.nome) el('nomeStrategia').value = obj.nome;
    renderTabs(); renderScheda(); renderListaSalvate();
    mostraStatus('✓ Strategia importata');
  }

  function importaDaInputFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try { importaDaJson(String(reader.result)); }
      catch (e) { mostraStatus('File non valido', true); }
    };
    reader.readAsText(file);
  }

  // Migrazione di una scheda (dati vecchi/corrotti non rompono nulla)
  function migraScheda(s) {
    return {
      nome: s.nome || 'Matrice',
      tipoNES: s.tipoNES || 'NES',
      tipoMES: s.tipoMES || 'MES',
      NES: Array.isArray(s.NES) ? s.NES.map(migraMov) : [],
      MES: Array.isArray(s.MES) ? s.MES.map(migraMov) : [],
      opzioni: Array.isArray(s.opzioni) ? s.opzioni.map(migraOpz) : [],
      strumentoOpzioni: s.strumentoOpzioni || 'MES'
    };
  }

  function migraMov(m) {
    if (m.prezzoPulito === undefined) m.prezzoPulito = m.prezzo || 0;
    delete m.prezzo;
    if (m.attivo === undefined) m.attivo = true;
    return m;
  }

  function migraOpz(o) {
    return {
      attivo: o.attivo !== false,
      strumento: o.strumento || 'MES',
      pos: o.pos || 'SELL',
      tipo: o.tipo || 'PUT',
      qta: o.qta || 0,
      assgn: !!o.assgn,
      strike: o.strike || 0,
      premio: o.premio || 0,
      vol: o.vol || 0,
      scadenza: o.scadenza || '',
      rlzd: (o.rlzd === undefined || o.rlzd === null) ? '' : o.rlzd,
      stato: o.stato === 'CHIUSA' ? 'CHIUSA' : 'APERTA'
    };
  }

  function reset() {
    if (!confirm('Vuoi davvero azzerare tutti i dati?\n\nIl foglio tornerà completamente vuoto, pronto per nuovi inserimenti.')) return;
    localStorage.removeItem(STORAGE_KEY);
    STORAGE_KEYS_LEGACY.forEach(k => localStorage.removeItem(k));
    stato.schede = [{
      nome: 'Matrice',
      tipoNES: '-', tipoMES: '-',
      NES: [], MES: [], opzioni: [],
      strumentoOpzioni: 'MES'
    }];
    stato.attiva = 0;
    el('prezzoSpot').value = '';
    el('riskFree').value = 0;
    el('volAtm').value = 0;
    if (el('divYield')) el('divYield').value = 0;
    el('cash').value = 0;
    stato.cash = 0;
    aggiornaStileCash();
    stato.cashEscluso = false;
    if (el('cashEscludi')) el('cashEscludi').checked = false;
    if (el('commissioniOn')) el('commissioniOn').checked = true;
    el('dataAnalisi').value = dataOggiIso();
    el('tipoNES').value = '-';
    el('tipoMES').value = '-';
    if (el('strumentoOpzioni')) el('strumentoOpzioni').value = 'MES';
    if (typeof chartView !== 'undefined') {
      chartView.xMin = null; chartView.xMax = null;
      chartView.baseMin = null; chartView.baseMax = null;
      chartView._sig = null;
    }
    renderTabs();
    renderScheda();
    mostraStatus('✓ Foglio azzerato');
  }

  let statusTimer = null;
  function mostraStatus(txt, err) {
    const s = el('saveStatus');
    s.textContent = txt;
    s.style.color = err ? 'var(--red)' : 'var(--green)';
    s.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => s.classList.remove('show'), 1800);
  }
