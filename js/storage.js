// storage.js — persistenza localStorage + strategie cloud Supabase
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
// v27 — P&L lordo + indicatore cloud persistente (pallino + badge ultimo salvataggio).

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
      dataAnalisi: el('dataAnalisi') ? (el('dataAnalisi').value || '') : '',
      tipoNES: el('tipoNES').value,
      tipoMES: el('tipoMES').value,
      modalita: stato.modalita,
      ticker: stato.ticker,
      molt: stato.molt,
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
      // v27 — il campo `commissioniOn` non esiste più: le commissioni non
      // entrano nei calcoli. Eventuali valori salvati in precedenza sono
      // ignorati (retrocompatibilità con i salvataggi vecchi).
      if (typeof dati.dataAnalisi === 'string' && dati.dataAnalisi) el('dataAnalisi').value = dati.dataAnalisi;
      if (dati.tipoNES) el('tipoNES').value = dati.tipoNES;
      if (dati.tipoMES) el('tipoMES').value = dati.tipoMES;
      // Modalità globale + ticker/moltiplicatore commodities. Per i salvataggi
      // vecchi (senza modalità) la modalità si deduce dal tipo della prima scheda.
      if (typeof dati.ticker === 'string' && dati.ticker) stato.ticker = dati.ticker;
      if (typeof dati.molt === 'number') stato.molt = dati.molt;
      let modRip = dati.modalita;
      if (!modRip) {
        const t0 = (Array.isArray(dati.schede) && dati.schede[0] && dati.schede[0].tipoNES) || dati.tipoNES;
        if (t0 === 'X') modRip = 'azioni';
        else if (t0 === 'NES' || t0 === 'MES' || t0 === 'ES' || t0 === '-') modRip = 'futures-indici';
        else if (t0) {
          modRip = 'futures-commodities';
          if (!dati.ticker && _tickerValido(t0)) stato.ticker = t0;
        }
      }
      if (modRip === 'azioni' || modRip === 'futures-indici' || modRip === 'futures-commodities') {
        stato.modalita = modRip;
        if (el('modalitaGlobale')) el('modalitaGlobale').value = modRip;
      }
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
  // SUPABASE — client + test connessione
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

  // ============================================================
  // INDICATORE STATO CLOUD (v27)
  // ============================================================
  // Aggiorna il badge "Cloud: ..." nella salvati-bar.
  // stati: 'checking' | 'ok' | 'err'
  function setCloudStatus(statoCloud, msg) {
    const wrap = el('cloudStatus');
    const label = el('cloudStatusLabel');
    if (!wrap || !label) return;
    wrap.classList.remove('ok', 'err', 'checking');
    wrap.classList.add(statoCloud);
    if (msg) {
      label.textContent = msg;
    } else {
      label.textContent = statoCloud === 'ok' ? 'Cloud connesso'
                       : statoCloud === 'err' ? 'Cloud non raggiungibile'
                       : 'Cloud: verifica…';
    }
  }

  // Mostra il badge "Ultimo salvataggio cloud: NOME · ora"
  function setCloudSaved(nome) {
    const wrap = el('cloudSaved');
    const nomeEl = el('cloudSavedNome');
    const oraEl = el('cloudSavedOra');
    if (!wrap || !nomeEl || !oraEl) return;
    if (!nome) { wrap.style.display = 'none'; return; }
    nomeEl.textContent = nome;
    const ora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    oraEl.textContent = '· ' + ora;
    wrap.style.display = 'inline-flex';
  }

  // Aggiorna lo stato cloud combinando "connesso" + "ultimo salvataggio"
  function aggiornaIndicatoreCloud() {
    if (!supabaseConfigurato()) {
      setCloudStatus('err', 'Cloud non configurato');
      return;
    }
    setCloudStatus('checking', 'Cloud: verifica…');
    testaConnessioneSupabase().then(ok => {
      setCloudStatus(ok ? 'ok' : 'err');
    });
  }

  async function testaConnessioneSupabase() {
    if (!supabaseConfigurato()) {
      setCloudStatus('err', 'Cloud non configurato');
      return false;
    }
    const sb = getSupabase();
    if (!sb) {
      setCloudStatus('err', 'Cloud non configurato');
      return false;
    }
    try {
      const { error } = await sb.from('strategie').select('nome').limit(1);
      if (error) {
        setCloudStatus('err', 'Cloud: ' + (error.message || 'errore'));
        mostraStatus('Supabase: ' + (error.message || 'errore'), true);
        return false;
      }
      setCloudStatus('ok', 'Cloud connesso');
      mostraStatus('✓ Supabase collegato');
      return true;
    } catch (e) {
      setCloudStatus('err', 'Cloud non raggiungibile');
      mostraStatus('Supabase: rete o chiave non valide', true);
      return false;
    }
  }

  // ============================================================
  // STRATEGIE SALVATE — cloud Supabase + cache localStorage
  // ============================================================
  const STORAGE_SALVATI = 'mastering_salvati_v1';

  function leggiSalvatiLocal() {
    try { return JSON.parse(localStorage.getItem(STORAGE_SALVATI)) || {}; }
    catch (e) { return {}; }
  }
  function scriviSalvatiLocal(map) {
    localStorage.setItem(STORAGE_SALVATI, JSON.stringify(map));
  }

  async function listaSalvate() {
    const sb = getSupabase();
    if (sb) {
      try {
        const { data, error } = await sb
          .from('strategie')
          .select('nome')
          .order('nome', { ascending: true });
        if (error) throw error;
        return (data || []).map(r => r.nome);
      } catch (e) {
        return Object.keys(leggiSalvatiLocal()).sort((a, b) => a.localeCompare(b));
      }
    }
    return Object.keys(leggiSalvatiLocal()).sort((a, b) => a.localeCompare(b));
  }

  async function renderListaSalvate() {
    const sel = el('listaSalvate');
    if (!sel) return;
    const nomi = await listaSalvate();
    const corrente = el('nomeStrategia') ? el('nomeStrategia').value.trim() : '';
    sel.innerHTML = '';
    if (!nomi.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = getSupabase()
        ? '— nessuna strategia in cloud —'
        : '— nessuna strategia salvata —';
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

  async function salvaConNome(nome) {
    nome = (nome || '').trim();
    const input = el('nomeStrategia');
    if (!nome) { mostraStatus('Inserisci un nome (es. AMZN)', true); if (input) input.focus(); return; }

    const dati = raccogliDati();
    const salvatoIl = new Date().toISOString();

    // Cache locale
    const map = leggiSalvatiLocal();
    const esisteLocale = !!(map[nome] && map[nome].dati);
    let esisteCloud = false;
    const sb = getSupabase();
    if (sb) {
      try {
        const { data } = await sb.from('strategie').select('nome').eq('nome', nome).maybeSingle();
        esisteCloud = !!(data && data.nome);
      } catch (e) { /* ignore */ }
    }
    if ((esisteLocale || esisteCloud) && !confirm('Esiste già una strategia "' + nome + '".\nSovrascriverla con i dati correnti?')) return;

    map[nome] = { salvatoIl: salvatoIl, dati: dati };
    try { scriviSalvatiLocal(map); }
    catch (e) { mostraStatus('Errore salvataggio locale', true); return; }

    if (sb) {
      setCloudStatus('checking', 'Salvataggio in cloud…');
      try {
        const { error } = await sb
          .from('strategie')
          .upsert({ nome: nome, dati: dati, salvato_il: salvatoIl }, { onConflict: 'nome' });
        if (error) throw error;
        setCloudStatus('ok', 'Cloud connesso');
        setCloudSaved(nome);
        mostraStatus('✓ "' + nome + '" salvata in cloud');
      } catch (e) {
        setCloudStatus('err', 'Cloud non raggiungibile');
        mostraStatus('Salvata in locale; cloud non raggiungibile', true);
      }
    } else {
      setCloudStatus('err', 'Cloud non configurato');
      mostraStatus('✓ Strategia "' + nome + '" salvata solo in locale');
    }
    await renderListaSalvate();
  }

  async function caricaSalvato(nome) {
    const sb = getSupabase();
    if (sb) {
      try {
        const { data, error } = await sb
          .from('strategie')
          .select('nome, dati, salvato_il')
          .eq('nome', nome)
          .maybeSingle();
        if (error) throw error;
        if (data && data.dati) {
          applicaDati(data.dati);
          const map = leggiSalvatiLocal();
          map[nome] = { salvatoIl: data.salvato_il || new Date().toISOString(), dati: data.dati };
          scriviSalvatiLocal(map);
          if (el('nomeStrategia')) el('nomeStrategia').value = nome;
          renderTabs(); renderScheda();
          await renderListaSalvate();
          setCloudStatus('ok', 'Cloud connesso');
          setCloudSaved(nome);
          mostraStatus('✓ "' + nome + '" caricata da cloud');
          return;
        }
      } catch (e) {
        // fallback locale
      }
    }

    const entry = leggiSalvatiLocal()[nome];
    if (!entry || !entry.dati) { mostraStatus('Strategia non trovata', true); return; }
    applicaDati(entry.dati);
    if (el('nomeStrategia')) el('nomeStrategia').value = nome;
    renderTabs(); renderScheda();
    await renderListaSalvate();
    mostraStatus('✓ "' + nome + '" caricata (locale)');
  }

  async function eliminaSalvato(nome) {
    if (!nome) return;
    if (!confirm('Eliminare la strategia salvata "' + nome + '"?\n\n(Il lavoro corrente a video non cambia.)')) return;

    const map = leggiSalvatiLocal();
    delete map[nome];
    scriviSalvatiLocal(map);

    const sb = getSupabase();
    if (sb) {
      try {
        const { error } = await sb.from('strategie').delete().eq('nome', nome);
        if (error) throw error;
        setCloudStatus('ok', 'Cloud connesso');
        setCloudSaved(null);
        mostraStatus('✓ "' + nome + '" eliminata da cloud');
      } catch (e) {
        setCloudStatus('err', 'Cloud non raggiungibile');
        mostraStatus('Eliminata in locale; cloud non aggiornato', true);
      }
    } else {
      setCloudStatus('err', 'Cloud non configurato');
      mostraStatus('✓ "' + nome + '" eliminata');
    }
    await renderListaSalvate();
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
    // Rispetta la modalità globale corrente
    const mod = stato.modalita || MODALITA_DEFAULT;
    let tNES = '-', tMES = '-', sOpz = 'MES';
    if (mod === 'azioni') {
      tNES = 'X'; tMES = 'X'; sOpz = 'AZIONI';
    } else if (mod === 'futures-commodities') {
      tNES = stato.ticker; tMES = stato.ticker; sOpz = stato.ticker;
    }
    stato.schede = [{
      nome: 'Matrice',
      tipoNES: tNES, tipoMES: tMES,
      NES: [], MES: [], opzioni: [],
      strumentoOpzioni: sOpz
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
    // v27 — il toggle commissioni è stato rimosso
    el('dataAnalisi').value = dataOggiIso();
    if (typeof chartView !== 'undefined') {
      chartView.xMin = null; chartView.xMax = null;
      chartView.baseMin = null; chartView.baseMax = null;
      chartView._sig = null;
    }
    // Svuota il campo nome strategia
    if (el('nomeStrategia')) el('nomeStrategia').value = '';
    // La lista delle strategie salvate resta disponibile; solo la cella di selezione torna vuota
    renderListaSalvate().then(() => {
      if (el('listaSalvate')) el('listaSalvate').selectedIndex = -1;
    });
    renderTabs();
    renderScheda(); // applicaModalita ricostruisce i select
    setCloudSaved(null);
    mostraStatus('✓ Foglio azzerato');
  }

  let statusTimer = null;
  function mostraStatus(txt, err) {
    const s = el('saveStatus');
    if (!s) return;
    s.textContent = txt;
    s.style.color = err ? 'var(--red)' : 'var(--green)';
    s.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => s.classList.remove('show'), 1800);
  }
