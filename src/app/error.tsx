"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isWebpackCall = error?.message?.includes("reading 'call'");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold text-slate-800">
          {isWebpackCall ? "Cache vechi sau versiune actualizată" : "Ceva nu a mers bine"}
        </h1>
        <p className="text-slate-600 text-sm">
          {isWebpackCall
            ? "Aplicația a fost actualizată sau cache-ul este învechit. Reîncarcă pagina pentru a încărca ultima versiune."
            : "A apărut o eroare neașteptată."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Reîncarcă pagina
          </button>
          {!isWebpackCall && (
            <button
              onClick={reset}
              className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300"
            >
              Încearcă din nou
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
