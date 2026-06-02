"use client";

export default function OfflinePageActions() {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = "/mapa";
      }}
      className="inline-block px-4 py-2.5 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
    >
      Încarcă harta
    </button>
  );
}
