# Deploy Harta Teren pe Vercel

## Variante de deploy

- **A)** Cu Git + GitHub – deploy automat la fiecare push (recomandat)
- **B)** Cu Vercel CLI – fără Git, deploy manual din folder

---

## 1. Pregătire Supabase (producție)

În [Supabase Dashboard](https://supabase.com/dashboard) → proiectul tău:

1. **Authentication → URL Configuration**
   - **Site URL**: `https://harta-teren-xxx.vercel.app` (vei pune URL-ul real după primul deploy)
   - **Redirect URLs**: adaugă:
     - `https://harta-teren-xxx.vercel.app/**`
     - `https://*.vercel.app/**` (pentru preview-uri)

## 2. Pregătire Git (obligatoriu pentru Vercel)

Vercel deployează din GitHub. Dacă nu ai Git:

1. Instalează [Git for Windows](https://git-scm.com/download/win)
2. Restartează terminalul după instalare

Inițializează repo și fă push pe GitHub:

```powershell
cd "c:\Users\Shuba\Desktop\HartaTeren"
git init
git add .
git commit -m "Initial commit"
```

Creează un repo nou pe [github.com](https://github.com/new), apoi:

```powershell
git remote add origin https://github.com/TU_USERNAME/harta-teren.git
git branch -M main
git push -u origin main
```

## 3. Deploy pe Vercel

1. Mergi la [vercel.com](https://vercel.com) și autentifică-te (cu GitHub)
2. **Add New** → **Project**
3. Importă repo-ul `harta-teren`
4. **Configure Project**:
   - **Framework Preset**: Next.js (detectat automat)
   - **Root Directory**: `.` (lasă gol)
   - **Build Command**: `npm run build` (implicit)
   - **Output Directory**: `.next` (implicit)

5. **Environment Variables** – adaugă:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL-ul proiectului Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cheia anon (public) Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key (secret!) |
   | `NEXT_PUBLIC_SITE_URL` | `https://numele-proiectului.vercel.app` |

   Găsești valorile în Supabase → **Settings** → **API**.

6. Click **Deploy**

## 4. După primul deploy

1. Copiază URL-ul live (ex: `https://harta-teren-abc123.vercel.app`)
2. În Supabase → **Authentication** → **URL Configuration**:
   - Actualizează **Site URL** cu URL-ul Vercel
   - Asigură-te că redirect URL-urile includ `https://*.vercel.app/**`

## 5. Actualizări viitoare

După fiecare push pe `main`:

```powershell
git add .
git commit -m "Descriere modificare"
git push
```

Vercel va face deploy automat. Poți adăuga taburi, funcții noi etc. – totul se actualizează la fiecare push.

---

## Variantă B: Deploy cu Vercel CLI (fără Git)

Dacă nu folosești Git, poți deploya direct din folder:

```powershell
cd "c:\Users\Shuba\Desktop\HartaTeren"
npx vercel
```

La prima rulare vei fi întrebat de login și config. Pentru producție:

```powershell
npx vercel --prod
```

**Variabile de mediu**: După `vercel link`, adaugă-le în [vercel.com](https://vercel.com) → proiectul → **Settings** → **Environment Variables**.

**Actualizări**: rulezi din nou `npx vercel --prod` după modificări.

---

**Notă**: Fișierul `.env.local` nu se uploadează. Variabilele de mediu se setează în Vercel (GitHub sau CLI).
