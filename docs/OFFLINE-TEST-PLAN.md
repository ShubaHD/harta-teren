# Offline-first test plan (Chrome DevTools)

Testează funcționalitatea offline-first folosind **Chrome DevTools** în modul offline.

## Pregătire

1. **Build producție** (PWA este dezactivat în dev):
   ```bash
   npm run build && npm run start
   ```
2. Deschide aplicația în **Chrome** (ex: `http://localhost:3000`).
3. Deschide **DevTools** (F12) → tab **Application**.

---

## 1. Service worker și app shell

| Pas | Acțiune | Verificare |
|-----|---------|------------|
| 1.1 | Tab **Application** → **Service Workers** | Un service worker este înregistrat (ex: `worker-*.js` sau `sw.js`). |
| 1.2 | **Application** → **Cache Storage** | Există cache-uri (ex: workbox-precache, osm-tiles, foraj-pages). |
| 1.3 | **Console** – navighează pe hartă, apoi pe o fișă foraj | Mesaje `[Offline] [sw:fetch] document <url>` pentru requesturi de navigare. |

---

## 2. Modul offline (simulare)

| Pas | Acțiune | Verificare |
|-----|---------|------------|
| 2.1 | **Application** → **Service Workers** → bifează **Offline** | Rețeaua este simulată ca offline. |
| 2.2 | Reîncarcă pagina (F5) sau navighează la o rută neverizitată | Fie se încarcă din cache (dacă a fost vizitată), fie apare pagina **„Ești offline”** (`/~offline`) cu butonul „Încarcă harta”. |
| 2.3 | Dacă ai deschis harta online înainte: click pe „Încarcă harta” | Harta se deschide din cache; bannerul **„Mod offline”** apare în partea de sus. |
| 2.4 | **Console** | Mesaje `[Offline]` (idb:write, status:change, status:probe) când se scrie în IndexedDB sau se schimbă starea. |

---

## 3. IndexedDB și date citite

| Pas | Acțiune | Verificare |
|-----|---------|------------|
| 3.1 | Online: autentificare, deschide harta, alege un proiect | Punctele se încarcă. |
| 3.2 | **Application** → **IndexedDB** → `HartaTerenOffline` | Tabele: `pointsCache`, `profileCache`, `drillPointDetailCache`, etc. |
| 3.3 | **Console** | La încărcarea hărții: `[Offline] [idb:write] cachePoints` și `cacheProfile`. |
| 3.4 | Pornește **Offline** în Service Workers, reîncarcă harta | Harta afișează punctele din cache (fără rețea). |

---

## 4. Coada de scrieri (queue) offline

| Pas | Acțiune | Verificare |
|-----|---------|------------|
| 4.1 | Cu **Offline** activ: pe hartă, la un punct „De făcut”, apasă **În lucru** | Mesaj de tip „Salvat local” / „Mod offline”; punctul trece în „În lucru” în UI. |
| 4.2 | **IndexedDB** → `HartaTerenOffline` → `pendingUpdates` | Există o înregistrare nouă pentru acel punct. |
| 4.3 | **Console** | `[Offline] [idb:write] addPendingUpdate`. |
| 4.4 | Pe o fișă foraj (deschisă online înainte): modifică un câmp și salvează offline | `pendingDrillPointFields` sau `pendingFormOps` au intrări; în **Console**: `addPendingDrillPointFields` / `addPendingFormOp`. |

---

## 5. Marcare „nesincronizat” în UI

| Pas | Acțiune | Verificare |
|-----|---------|------------|
| 5.1 | Offline: pune un punct „În lucru” sau „Finalizat” | În popup-ul punctului apare badge-ul **„Nesincronizat”** (punct galben + text). |
| 5.2 | Offline: pe fișa foraj, modifică date și salvează | În headerul fișei apare **„Date nesincronizate”**. |
| 5.3 | Banner **Mod offline** | Textul include „X modificări nesincronizate” când există pending. |

---

## 6. Reconectare și retry (sync)

| Pas | Acțiune | Verificare |
|-----|---------|------------|
| 6.1 | Cu pending (ex: punct „În lucru” salvat offline), dezactivează **Offline** în Service Workers | Rețeaua revine. |
| 6.2 | **Console** | Mesaje `[Offline] [status:change] online`, `[status:probe] probe OK`, apoi `[sync:retry] processQueue start`, `[sync:result] map sync done` / `form sync done`. |
| 6.3 | După sync | Badge-urile „Nesincronizat” / „Date nesincronizate” dispar; `pendingUpdates` (și altele) se gozesc în IndexedDB. |
| 6.4 | La eșec (ex: server oprit): verifică **Console** | Mesaje `[sync:retry] backoff before next attempt` și relansări. |

---

## 7. Conectivitate (fără a depinde doar de navigator.onLine)

| Pas | Acțiune | Verificare |
|-----|---------|------------|
| 7.1 | Online: **Console** la ~30 s | `[Offline] [status:probe] probe OK` (HEAD la `/api/health`). |
| 7.2 | Oprește serverul (Ctrl+C la `npm run start`) păstrând browserul „online” | După timeout, probe eșuează; `[status:probe] probe error` sau `probe failed`; UI poate trece în mod offline. |
| 7.3 | Repornește serverul | Probe reușește din nou; status revine la online și sync-ul rulează. |

---

## Rezumat checklist

- [ ] Service worker înregistrat și cache-uri vizibile.
- [ ] Offline în DevTools → navigare fallback la `/~offline` sau pagini din cache.
- [ ] Date citite (puncte, profil, fișe) în IndexedDB și afișate offline.
- [ ] Scrieri offline în coadă (pendingUpdates, pendingFormOps, etc.) și loguri idb:write.
- [ ] Badge „Nesincronizat” pe hartă și „Date nesincronizate” pe fișă.
- [ ] La revenirea online: sync automat, loguri sync:retry / sync:result, badge-uri dispar.
- [ ] Probe la `/api/health` și status corect când serverul e oprit.

---

## Debug logging în producție

În build de producție, logurile `[Offline]` sunt dezactivate implicit. Pentru a le activa în consolă:

```js
window.__OFFLINE_DEBUG = true;
```

Apoi reîncarcă pagina; mesajele `[Offline]` vor apărea în Console.
