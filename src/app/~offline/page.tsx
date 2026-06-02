import OfflinePageActions from "./OfflinePageActions";

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-100">
      <div className="max-w-sm w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
        <div className="text-4xl mb-3" aria-hidden>📴</div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">
          Ești offline
        </h1>
        <p className="text-sm text-slate-600 mb-4">
          Această pagină nu este disponibilă în cache. Poți încerca să încarci
          harta dacă ai deschis-o când erai online.
        </p>
        <OfflinePageActions />
        <p className="text-xs text-slate-500 mt-4">
          Dacă harta nu se încarcă: deschide aplicația când ești online, mergi
          pe hartă o dată, apoi funcționează și offline.
        </p>
      </div>
    </main>
  );
}
