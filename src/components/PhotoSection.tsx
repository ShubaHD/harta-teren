"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BoreholePhoto } from "@/lib/types";
import {
  addPendingPhoto,
  getPendingPhotos,
  removePendingPhoto,
  updatePendingPhotoRotation,
  addPendingFormOp,
} from "@/lib/offline-store";
import type { PendingPhoto } from "@/lib/offline-store";

import { compressImageIfNeeded } from "@/lib/compress-image";

const BUCKET = "borehole-photos";

/** Poza afișată: fie din Supabase, fie pending (blob local) */
type DisplayPhoto =
  | (BoreholePhoto & { isPending?: false })
  | (PendingPhoto & { isPending: true });

interface PhotoSectionProps {
  drillPointId: string;
  initialPhotos?: BoreholePhoto[];
  isOffline?: boolean;
}

export default function PhotoSection({ drillPointId, initialPhotos, isOffline = false }: PhotoSectionProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<DisplayPhoto[]>([]);
  const [loading, setLoading] = useState(!isOffline);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [title, setTitle] = useState("");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [editingPhoto, setEditingPhoto] = useState<DisplayPhoto | null>(null);
  const [editRotation, setEditRotation] = useState(0);

  useEffect(() => {
    if (isOffline) {
      (async () => {
        const base = (initialPhotos ?? []).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const pending = await getPendingPhotos(drillPointId);
        const baseWithPending: DisplayPhoto[] = [
          ...base.map((p) => ({ ...p, isPending: false as const })),
          ...pending.map((p) => ({ ...p, isPending: true as const })),
        ];
        setPhotos(baseWithPending);
        setLoading(false);
      })();
      return;
    }
    loadPhotos();
  }, [drillPointId, initialPhotos, isOffline]);

  async function loadPhotos() {
    const { data, error } = await supabase
      .from("borehole_photos")
      .select("*")
      .eq("drill_point_id", drillPointId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Eroare încărcare poze:", error);
      setMessage({
        type: "error",
        text: `Tabelul borehole_photos nu există. Rulează migrarea 017_borehole_photos.sql în Supabase: ${error.message}`,
      });
    }
    setPhotos((data as BoreholePhoto[]) ?? []);
    setLoading(false);
  }

  function getPhotoSrc(p: DisplayPhoto): string {
    if (p.isPending) {
      return URL.createObjectURL(p.blob);
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(p.storage_path);
    return data.publicUrl;
  }

  function getPublicUrl(path: string) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  function getPhotoId(p: DisplayPhoto): string {
    return p.isPending ? p.tempId : p.id;
  }

  function getPhotoRotation(p: DisplayPhoto): number {
    return p.rotation ?? 0;
  }

  function handleCaptureClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setPreviewFile(file);
      setPreviewRotation(0);
    }
    e.target.value = "";
  }

  async function handleAddPhoto() {
    if (!previewFile || !title.trim()) {
      setMessage({ type: "error", text: "Introdu un titlu și fă/alege o poză." });
      return;
    }
    setUploading(true);
    setMessage(null);
    const rotation = ((previewRotation % 360) + 360) % 360;

    if (isOffline) {
      const tempId = crypto.randomUUID();
      await addPendingPhoto({
        drillPointId,
        title: title.trim(),
        rotation,
        blob: previewFile,
        tempId,
      });
      setPhotos((prev) => [
        { drillPointId, title: title.trim(), rotation, blob: previewFile, tempId, createdAt: Date.now(), isPending: true },
        ...prev,
      ]);
      setPreviewFile(null);
      setTitle("");
      setPreviewRotation(0);
      setMessage({ type: "success", text: "Poză salvată local. Se va încărca la revenirea online." });
      setTimeout(() => setMessage(null), 3000);
      setUploading(false);
      return;
    }

    const toUpload = await compressImageIfNeeded(previewFile);
    const ext = previewFile.name.split(".").pop() || "jpg";
    const finalExt = toUpload instanceof Blob && !(toUpload instanceof File) ? "jpg" : ext;
    const storagePath = `${drillPointId}/${crypto.randomUUID()}.${finalExt}`;
    const opts = { upsert: false } as { upsert: boolean; contentType?: string };
    if (toUpload instanceof Blob && !(toUpload instanceof File)) opts.contentType = "image/jpeg";

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, toUpload, opts);

    if (uploadError) {
      setMessage({ type: "error", text: `Eroare upload: ${uploadError.message}` });
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("borehole_photos").insert({
      drill_point_id: drillPointId,
      title: title.trim(),
      storage_path: storagePath,
      rotation,
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      setMessage({ type: "error", text: `Eroare salvare: ${insertError.message}` });
      setUploading(false);
      return;
    }

    setPreviewFile(null);
    setTitle("");
    setPreviewRotation(0);
    setMessage({ type: "success", text: "Poză adăugată." });
    setTimeout(() => setMessage(null), 3000);
    loadPhotos();
    setUploading(false);
  }

  function cancelPreview() {
    setPreviewFile(null);
    setTitle("");
    setPreviewRotation(0);
  }

  function rotatePreview(delta: number) {
    setPreviewRotation((r) => (r + delta + 360) % 360);
  }

  function rotateEdit(delta: number) {
    setEditRotation((r) => (r + delta + 360) % 360);
  }

  async function saveRotation() {
    if (!editingPhoto) return;
    const stored = ((editRotation % 360) + 360) % 360;

    if (isOffline) {
      if (editingPhoto.isPending) {
        await updatePendingPhotoRotation(drillPointId, editingPhoto.tempId, stored);
        setPhotos((prev) =>
          prev.map((p) =>
            p.isPending && p.tempId === editingPhoto.tempId
              ? { ...p, rotation: stored }
              : p
          )
        );
        setEditingPhoto(null);
        setMessage({ type: "success", text: "Rotație salvată local." });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
      await addPendingFormOp({
        drillPointId,
        table: "borehole_photos",
        action: "update",
        recordId: editingPhoto.id,
        data: { rotation: stored },
      });
      setPhotos((prev) =>
        prev.map((p) => (!p.isPending && p.id === editingPhoto.id ? { ...p, rotation: stored } : p))
      );
      setEditingPhoto(null);
      setMessage({ type: "success", text: "Rotație salvată local. Se va sincroniza la revenirea online." });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const { error } = await supabase
      .from("borehole_photos")
      .update({ rotation: stored, updated_at: new Date().toISOString() })
      .eq("id", editingPhoto.id);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setPhotos((prev) =>
        prev.map((p) => (!p.isPending && p.id === editingPhoto.id ? { ...p, rotation: stored } : p))
      );
      setEditingPhoto(null);
      setMessage({ type: "success", text: "Rotație salvată." });
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function handleDelete(photo: DisplayPhoto) {
    if (!confirm("Ștergi această poză?")) return;
    if (isOffline) {
      if (photo.isPending) {
        const pending = await getPendingPhotos(drillPointId);
        const toRemove = pending.find((p) => p.tempId === photo.tempId);
        if (toRemove?.id) await removePendingPhoto(toRemove.id);
        setPhotos((prev) => prev.filter((p) => !(p.isPending && p.tempId === photo.tempId)));
      } else {
        await addPendingFormOp({
          drillPointId,
          table: "borehole_photos",
          action: "delete",
          recordId: photo.id,
        });
        setPhotos((prev) => prev.filter((p) => !(!p.isPending && p.id === photo.id)));
      }
      if (editingPhoto && getPhotoId(editingPhoto) === getPhotoId(photo)) setEditingPhoto(null);
      return;
    }
    if (!photo.isPending) {
      await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      await supabase.from("borehole_photos").delete().eq("id", photo.id);
    }
    setPhotos((prev) => prev.filter((p) => getPhotoId(p) !== getPhotoId(photo)));
    if (editingPhoto && getPhotoId(editingPhoto) === getPhotoId(photo)) setEditingPhoto(null);
  }

  if (loading) {
    return (
      <section className="bg-white rounded-lg border shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-4">Poze</h2>
        <p className="text-sm text-slate-500">Se încarcă...</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm p-4">
      <h2 className="font-semibold text-slate-800 mb-4">Poze</h2>
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-green-50 text-green-800 border border-green-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Formular: titlu + buton cameră */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Adaugă poză</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titlu *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: Carotă 30-31m"
            />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCaptureClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            📷 Fă poza / Alege din galerie
          </button>
        </div>
      </div>

      {/* Preview înainte de salvare */}
      {previewFile && (
        <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Preview — adaugă sau anulează</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-shrink-0">
              <div className="w-64 h-48 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                <img
                  src={URL.createObjectURL(previewFile)}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain transition-transform"
                  style={{ transform: `rotate(${previewRotation}deg)` }}
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => rotatePreview(-90)}
                  className="px-3 py-1.5 bg-slate-200 rounded text-sm hover:bg-slate-300"
                >
                  ↶ -90°
                </button>
                <button
                  type="button"
                  onClick={() => rotatePreview(90)}
                  className="px-3 py-1.5 bg-slate-200 rounded text-sm hover:bg-slate-300"
                >
                  ↷ +90°
                </button>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-2">
                Titlu: <strong>{title || "(gol)"}</strong>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddPhoto}
                  disabled={uploading || !title.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {uploading ? "Se uploadează..." : "Adaugă în listă"}
                </button>
                <button
                  type="button"
                  onClick={cancelPreview}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
                >
                  Anulează
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal editare rotație */}
      {editingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-4 max-h-[90vh] overflow-auto">
            <h3 className="font-medium text-slate-800 mb-3">Editează poza — rotație</h3>
            <div className="flex justify-center bg-slate-100 rounded-lg p-4 mb-4">
              <img
                src={editingPhoto.isPending ? URL.createObjectURL(editingPhoto.blob) : getPublicUrl(editingPhoto.storage_path)}
                alt={editingPhoto.title}
                className="max-h-64 object-contain transition-transform"
                style={{ transform: `rotate(${editRotation}deg)` }}
              />
            </div>
            <div className="flex gap-2 justify-center mb-4">
              <button
                type="button"
                onClick={() => rotateEdit(-90)}
                className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-medium hover:bg-slate-300"
              >
                ↶ -90°
              </button>
              <button
                type="button"
                onClick={() => rotateEdit(90)}
                className="px-4 py-2 bg-slate-200 rounded-lg text-sm font-medium hover:bg-slate-300"
              >
                ↷ +90°
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveRotation}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Salvează rotația
              </button>
              <button
                type="button"
                onClick={() => setEditingPhoto(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista poze */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">Lista poze</h3>
        {photos.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Nicio poză adăugată.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p) => (
              <div
                key={getPhotoId(p)}
                className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <div
                  className="aspect-video bg-slate-100 flex items-center justify-center cursor-pointer"
                  onClick={() => {
                    setEditingPhoto(p);
                    setEditRotation(getPhotoRotation(p));
                  }}
                >
                  <img
                    src={getPhotoSrc(p)}
                    alt={p.title}
                    className="w-full h-full object-contain transition-transform"
                    style={{ transform: `rotate(${getPhotoRotation(p)}deg)` }}
                  />
                </div>
                <div className="p-3">
                  <p className="font-medium text-slate-800 truncate" title={p.title}>
                    {p.title}
                    {p.isPending && (
                      <span className="ml-1 text-xs text-amber-600">(local)</span>
                    )}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPhoto(p);
                        setEditRotation(getPhotoRotation(p));
                      }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Editează (rotație)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Șterge
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
