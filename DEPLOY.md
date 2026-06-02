# Rebuild și Deploy – Harta Teren

## 1. Rebuild (local)

```bash
npm run build
```

După build:
- Icoane PWA: `public/icon-180.png`, `icon-192.png`, `icon-512.png`
- Service worker: `public/sw.js`
- Aplicația de producție: folderul `.next/`

---

## 2. Test local (producție)

```bash
npm run start
```

Deschide http://localhost:3000 și verifică că totul merge (login, hartă, offline).

---

## 3. Deploy pe Vercel (recomandat pentru Next.js)

### Varianta A: din terminal (Vercel CLI)

1. **Login** (o singură dată):
   ```bash
   npx vercel login
   ```

2. **Variabile de mediu** – fie le pui în `.env.production` (Vercel le citește la build), fie le setezi în dashboard-ul Vercel după primul deploy (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Deploy în producție** (din folderul proiectului):
   ```bash
   npx vercel --prod
   ```
   - La prima rulare ți se pun câteva întrebări (proiect nou, setări). Poți apăsa Enter pentru default-uri.
   - După deploy primești un URL de tip `https://harta-teren-xxx.vercel.app`.

**Fără `--prod`** rulezi doar un preview (deployment de test). Cu **`--prod`** trimiți direct pe domeniul de producție.

### Varianta B: din site (Git)

1. Cont pe [vercel.com](https://vercel.com), conectezi repo-ul Git.
2. Setezi Environment Variables în Settings.
3. La fiecare push se face deploy automat (dacă ai activat).

**Notă:** Build Command pe Vercel trebuie să rămână `npm run build` (din package.json), care rulează și `pwa:icons` și `next build`.

---

## 4. Deploy pe alt server (Node.js)

Pe un VPS (Linux) sau mașină cu Node:

1. Copiază pe server întregul proiect (sau doar după build: `.next/`, `public/`, `package.json`, `node_modules` sau rulează `npm ci` pe server).
2. Variabile de mediu: setează `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ex. în `.env.production` sau în shell).
3. Rulează:
   ```bash
   npm ci --production=false
   npm run build
   npm run start
   ```
4. Expune portul 3000 prin nginx/apache sau un process manager (pm2):

   ```bash
   npx pm2 start npm --name "harta-teren" -- start
   ```

---

## 5. După deploy

- Deschide aplicația în browser și fă un test rapid: login → hartă → oprește internetul → „În lucru” / „Finalizat” → repornește internetul (sync automat).
- Pe telefon, dacă folosești PWA: instalează aplicația de pe noul URL, apoi testează același flow offline.

---

## 6. Dacă offline nu funcționează

1. **Reîmprospătează harta o dată când ești online**  
   După ce ai deschis harta (cu proiect selectat), apasă **F5** (sau refresh) o dată. Astfel service worker-ul pune pagina în cache și o poate servi și offline.

2. **Ordinea corectă**  
   - Cu **internet**: intră în aplicație → Login → Harta → alege proiectul → (opțional) apasă F5 pe hartă → apoi „Pregătește offline” dacă vrei și fișele.  
   - **Oprește internetul** (avion sau DevTools → Network → Offline).  
   - Deschide din nou aplicația sau tab-ul cu harta – ar trebui să se încarce din cache.

3. **Șterge cache-ul vechi**  
   După un deploy nou, uneori browserul ține un service worker vechi. În Chrome: F12 → Application → Service Workers → Unregister. Reîncarcă site-ul (poate de 2 ori) ca să se înregistreze noul SW.

4. **Verifică că SW e activ**  
   F12 → Application → Service Workers. Ar trebui să apară `sw.js` cu status „activated”.
