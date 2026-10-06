# Mastering

Gestione simultanea di futures NES / MES / ES / X e opzioni (MES, ES, AZIONI) — metodo prezzo medio (IBKR):
payoff combinato a scadenza e Now, breakeven, POP, bande sigma, greche di posizione e schede multi-scenario (Matrice + comparazioni).

## Struttura

- `index.html` — interfaccia e ordine di caricamento degli script
- `css/style.css` — stili
- `js/` — moduli JavaScript (nessun bundler: script classici caricati in ordine da `index.html`)
- `supabase/schema.sql` — tabella `strategie` e RLS per il salvataggio cloud

## Moduli (ordine di caricamento)

1. `config.js` — costanti, moltiplicatori, stato iniziale, helper DOM, **credenziali Supabase**
2. `matematica.js` — modelli Black-76 / Black-Scholes, probabilità e helper data
3. `futures.js` — calcolo colonna futures: prezzo medio e P&L
4. `opzioni.js` — P&L opzioni: valore nominale, singola riga, totale
5. `render-futures.js` — render tabelle futures e righe totali
6. `render-opzioni.js` — render opzioni: greche, colonne extra e P&L combinato
7. `grafico.js` — grafico payoff: range, breakeven, POP, zoom e touch
8. `calcola-tutto.js` — ricalcolo globale e header di riepilogo
9. `schede.js` — schede multi-scenario: Matrice e comparazioni
10. `storage.js` — localStorage + **strategie cloud Supabase**, migrazioni
11. `eventi.js` — binding degli eventi interfaccia
12. `main.js` — avvio: valori di default e primo render

Prima dei moduli viene caricato `@supabase/supabase-js` da CDN.

## Strategie salvate (localStorage + Supabase)

- **Autosave** del lavoro corrente → sempre in `localStorage` (chiave `mastering_v20`).
- **Salva come… / Carica / Elimina** → se Supabase è configurato, le strategie nominate vivono in cloud; `localStorage` resta cache e fallback offline.
- **Esporta / Importa file** JSON → indipendente dal cloud (backup tra PC).

### Setup cloud (una tantum)

1. Crea un **progetto Supabase nuovo** su [supabase.com](https://supabase.com) (dedicato a Mastering).
2. Nel **SQL Editor** esegui il contenuto di `supabase/schema.sql`.
3. In **Settings → API** copia:
   - **Project URL**
   - **anon public** key
4. Incollali in `js/config.js`:

```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

5. Commit e push (o modifica e merge della PR). Finché restano i placeholder `YOUR_…`, l’app usa **solo localStorage**.

### Sicurezza (uso personale ora)

La policy RLS attuale consente lettura/scrittura a chiunque abbia URL + anon key dell’app (uso personale). Quando passerai a multi-utente, in `schema.sql` ci sono le policy commentate basate su `auth.uid()` / `user_id`.

## Nota tecnica

I moduli derivano dalla suddivisione del vecchio `js/app.js` lungo le sezioni originali del file.
Si usano script classici (non ES module) e nessun bundler: la pagina funziona anche aprendo
`index.html` direttamente da disco (`file://`), con il solo limite che il cloud richiede rete.

## Deploy automatico (Vercel)

Il sito è pubblicato su Vercel tramite l’**integrazione nativa Git**: push su `main` → produzione; ogni PR → URL di anteprima.

### Setup una tantum (~2 minuti)

1. Apri [vercel.com/new](https://vercel.com/new) e importa la repo `mastering`.
2. Nessuna impostazione da cambiare (`vercel.json` dichiara sito statico puro).
3. **Deploy**. Fatto.

La CI (`ci.yml`) valida i moduli su ogni PR e push, indipendente dal deploy.
