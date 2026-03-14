# Harta Teren - Puncte de Foraj

Aplicație web pentru managementul punctelor de foraj pe teren. Next.js + Supabase + Leaflet.

## Cerințe

- Node.js 18+
- Cont Supabase

## Instalare

```bash
npm install
```

## Configurare Supabase

1. Creează un proiect pe [supabase.com](https://supabase.com).

2. Rulează schema în **SQL Editor** (în ordine):
   - `supabase/schema.sql`
   - `supabase/migrations/001_projects_and_teams.sql`

3. Activează Realtime pentru tabela `drill_points`:
   - Database → Replication → enable pentru `drill_points`

4. Creează fișierul `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Creare utilizatori

Rulează scriptul de seed (o singură dată):
```bash
npx tsx scripts/seed-users.ts
```

Conturi create:
- `echipa1@harta.local` / `echipa1`
- `echipa2@harta.local` / `echipa2`
- `echipa3@harta.local` / `echipa3`
- `admin@harta.local` / `admin`

## Puncte de test

```bash
npx tsx scripts/seed-points.ts
```

(Necesită SUPABASE_SERVICE_ROLE_KEY pentru insert.)

## Rulare

```bash
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000).

## Funcționalități

- **Proiecte** – Admin creează proiecte, fiecare cu punctele sale
- **Import CSV** – per proiect, format nr,n,e,h (+ observații)
- **Ștergere puncte** – Admin poate șterge puncte din proiect
- **Echipe** – Admin creează echipe cu nume și parolă (10+ echipe)
- **Hartă** – selectare proiect, puncte colorate, În lucru/Finalizat
- **Vizitatori** – pagină publică `/vizitatori/[projectId]` cu hartă live și export CSV foraje executate

## Offline (viitor)

Structura permite adăugarea suportului offline ulterior cu PWA + IndexedDB.
