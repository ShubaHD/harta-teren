# Plan de migrare: Fișa Foraj (Flutter) → Harta Teren (Web)

## 1. Analiza proiectului Flutter (Fișa Foraj)

### Ecrane
| Ecran | Descriere |
|-------|-----------|
| **ProjectsScreen** | Listă proiecte, selectare proiect curent |
| **BoreholesScreen** | Listă foraje per proiect, creare foraj nou |
| **BoreholeDetailScreen** | Fișă detaliată foraj – 7 taburi |
| **LocationScreen** | Hartă Google Maps cu foraje, navigare |
| **ExportScreen** | Export Excel, PDF, backup, restore |
| **SettingsScreen** | Font scale, culori |
| **RqdScreen / RqdSectionScreen** | Citiri RQD (Rock Quality Designation) |
| **VstScreen** | Citiri VST (Vane Shear Test) |
| **PocketPenetrometerScreen** | Citiri penetrometru portabil |

### Funcționalități
- Proiecte: CRUD, topic, location, client, description
- Foraje: CRUD, coordonate, adâncime, kilometraj, tip instalație, categorie
- Litologie: intervale (fromM, toM), tip, consistență, culoare, compactare nisip
- Probe: adâncime, tip (Tulburată, SPT etc.), valori SPT
- Nivel apă: during, after24h
- Echipament: tubaj protecție, piezometric, inclinometric (fromM, toM)
- Fotografii: atașate la foraj (path local)
- RQD: depthFrom/To, RQD%, TCR%, SCR%, bucăți cm
- VST: mărime vană, adâncime, valoare kg/cm²
- Pocket penetrometru: plunger, adâncime, valori multiple
- Export: Excel, PDF complet, backup ZIP
- Locație: hartă, GPS

### Modele de date (Flutter)
- **Project**: id, name, topic, location, client, description
- **Borehole**: id, projectId, depthMeters, lat, lng, kilometraj, tipInstalatie, intocmit, categorieForaj
- **LithologyInterval**: id, boreholeId, fromM, toM, type, consistency, color, sandCompaction, waterDuring, waterAfter24h
- **SampleRecord**: id, boreholeId, depthM, type, sptValues, notes
- **WaterLevel**: id, boreholeId, during, after24h, notes, date
- **Photo**: id, boreholeId, name, path
- **Equipment**: id, boreholeId, type, fromM, toM
- **RqdReading**: id, boreholeId, depthFrom, depthTo, rqdPercent, tcrPercent, scrPercent, rqdPiecesCm, tcrPiecesCm, scrPiecesCm, scrRule
- **VstReading**: id, boreholeId, vaneSize, depthFrom, depthTo, valueKgCm2
- **PocketPenetrometerReading**: id, boreholeId, plunger, depthFrom, depthTo, values[]

### API / Storage
- **SharedPreferences** (JSON) – totul local, fără backend
- Fără autentificare, fără sync cloud

---

## 2. Comparație cu aplicația web (Harta Teren)

### Ce există deja
| Web | Flutter echivalent |
|-----|--------------------|
| Projects (id, name) | Project (cu mai puține câmpuri) |
| DrillPoints (code, lat, lng, status, assigned_team, final_depth, notes) | Borehole (parțial – lat, lng, depth) |
| Hartă Leaflet | LocationScreen (Google Maps) |
| Echipe, Admin | – (nou) |
| Import CSV | – |
| Export CSV foraje finalizate | Export Excel (mai complet) |
| Anotații hartă | – |
| PWA, offline | – |
| Autentificare Supabase | – |

### Ce lipsește
- Câmpuri foraj: kilometraj, tipInstalatie, intocmit, categorieForaj
- Litologie
- Probe
- Nivel apă
- Echipament
- Fotografii
- RQD, VST, Pocket penetrometru
- Export Excel/PDF detaliat
- Setări (font, culori)

### Ce trebuie rescris
- Storage: SharedPreferences → Supabase (PostgreSQL)
- UI: Flutter Widgets → React + Tailwind
- Export PDF: pdf package → @react-pdf/renderer sau jsPDF
- Export Excel: excel package → xlsx sau SheetJS
- Fotografii: path local → Supabase Storage
- GPS: geolocator → navigator.geolocation

---

## 3. Plan de migrare (pași mici)

### Faza 1 – Extindere foraje de bază
1. Adaugă la `drill_points`: kilometraj, tip_instalatie, intocmit, categorie_foraj
2. Adaugă la `projects`: topic, location, client, description
3. Actualizează formulare Admin/ProjectDetail

### Faza 2 – Fișă detaliată (tab general)
4. Pagină `/mapa/foraj/[id]` sau modal/drawer
5. Formular: adâncime, kilometraj, tip instalație, categorie, întocmit

### Faza 3 – Litologie
6. Tabel `lithology_intervals` în Supabase
7. UI listă + formular intervale litologie

### Faza 4 – Probe
8. Tabel `samples`
9. UI listă + formular probe

### Faza 5 – RQD, VST, Pocket penetrometru
10. Tabele `rqd_readings`, `vst_readings`, `pocket_penetrometer_readings`
11. Ecrane echivalente

### Faza 6 – Nivel apă, Echipament, Fotografii
12. Tabele + UI

### Faza 7 – Export
13. Export Excel (xlsx)
14. Export PDF

---

## 4. Implementare – funcționalitate prioritară

**Prioritate 1**: Extindere `drill_points` + fișă detaliată foraj (tab general).

Motive:
- Conectează direct Flutter Borehole cu Web DrillPoint
- Permite completarea datelor tehnice de bază
- Baza pentru litologie, probe etc.
