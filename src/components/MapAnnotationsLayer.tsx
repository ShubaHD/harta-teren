"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    L: typeof L;
  }
}

export type AnnotationType = "line" | "arrow" | "marker" | "text";

export interface MapAnnotation {
  id: string;
  project_id: string;
  type: AnnotationType;
  geom: GeoJSON.Geometry;
  properties: Record<string, unknown>;
  created_by: string | null;
}

function getStringProp(props: Record<string, unknown>, key: string): string | null {
  const v = props?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function getColorProp(props: Record<string, unknown>, key: string): string | null {
  const v = getStringProp(props, key);
  if (!v) return null;
  // Accept #RRGGBB or css color names; we mainly use hex.
  return v;
}

function createArrowIcon(angleDeg = 0) {
  return L.divIcon({
    className: "arrow-marker",
    html: `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:12px solid #dc2626;margin-left:-6px;margin-top:-12px;transform:rotate(${angleDeg}deg)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 12],
  });
}

function createAttentionIcon() {
  return L.divIcon({
    className: "attention-marker",
    html: `<div style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:18px solid #eab308;margin-left:-10px;margin-top:-18px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))"></div>`,
    iconSize: [20, 18],
    iconAnchor: [10, 18],
  });
}

function createTextIcon(text: string) {
  return L.divIcon({
    className: "text-annotation",
    html: `<div style="background:white;padding:2px 6px;border:1px solid #94a3b8;border-radius:4px;font-size:12px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2)">${escapeHtml(text)}</div>`,
    iconSize: [100, 24],
    iconAnchor: [5, 12],
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

interface MapAnnotationsLayerProps {
  projectId: string | undefined;
  onRefresh?: () => void;
  /** Dacă e setat, doar aceste instrumente sunt afișate. Ex: ['marker','text'] pentru vizitatori */
  allowedTools?: AnnotationType[];
}

export default function MapAnnotationsLayer({
  projectId,
  onRefresh,
  allowedTools,
}: MapAnnotationsLayerProps) {
  const tools = allowedTools ?? (["line", "arrow", "marker", "text"] as AnnotationType[]);
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const geomanInitialized = useRef(false);
  const drawModeRef = useRef<AnnotationType | null>(null);
  const [drawMode, setDrawMode] = useState<AnnotationType | null>(null);
  const pendingTextClickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const isAdminRef = useRef(false);

  const loadAnnotationsRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!cancelled) setIsAdmin(profile?.role === "admin");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectId || !map) return;

    const supabase = createClient();

    const openEditPopup = (layer: L.Layer, ann: MapAnnotation) => {
      const props = (ann.properties || {}) as Record<string, unknown>;
      const currentName = getStringProp(props, "name") ?? getStringProp(props, "label") ?? "";
      const currentColor = getColorProp(props, "color") ?? "";

      const container = document.createElement("div");
      container.style.minWidth = "220px";

      const title = document.createElement("div");
      title.textContent = "Editare linie";
      title.style.fontWeight = "600";
      title.style.marginBottom = "8px";
      container.appendChild(title);

      const nameRow = document.createElement("div");
      nameRow.style.display = "flex";
      nameRow.style.flexDirection = "column";
      nameRow.style.gap = "4px";
      nameRow.style.marginBottom = "10px";

      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Nume (ex. GAZ)";
      nameLabel.style.fontSize = "12px";
      nameLabel.style.color = "#475569";
      nameRow.appendChild(nameLabel);

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = currentName;
      nameInput.placeholder = "GAZ";
      nameInput.style.border = "1px solid #cbd5e1";
      nameInput.style.borderRadius = "8px";
      nameInput.style.padding = "6px 8px";
      nameInput.style.fontSize = "13px";
      nameRow.appendChild(nameInput);
      container.appendChild(nameRow);

      const colorRow = document.createElement("div");
      colorRow.style.display = "flex";
      colorRow.style.alignItems = "center";
      colorRow.style.justifyContent = "space-between";
      colorRow.style.gap = "10px";
      colorRow.style.marginBottom = "12px";

      const colorLabel = document.createElement("label");
      colorLabel.textContent = "Culoare";
      colorLabel.style.fontSize = "12px";
      colorLabel.style.color = "#475569";
      colorRow.appendChild(colorLabel);

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      // default if missing
      const fallback = ann.type === "arrow" ? "#dc2626" : "#2563eb";
      colorInput.value = currentColor && currentColor.startsWith("#") ? currentColor : fallback;
      colorInput.style.width = "48px";
      colorInput.style.height = "30px";
      colorInput.style.border = "0";
      colorInput.style.background = "transparent";
      colorRow.appendChild(colorInput);
      container.appendChild(colorRow);

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.flexWrap = "wrap";

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.textContent = "Salvează";
      saveBtn.style.flex = "1 1 90px";
      saveBtn.style.background = "#2563eb";
      saveBtn.style.color = "white";
      saveBtn.style.border = "0";
      saveBtn.style.borderRadius = "10px";
      saveBtn.style.padding = "8px 10px";
      saveBtn.style.fontSize = "13px";
      saveBtn.style.cursor = "pointer";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.textContent = "Închide";
      cancelBtn.style.flex = "1 1 90px";
      cancelBtn.style.background = "#e2e8f0";
      cancelBtn.style.color = "#0f172a";
      cancelBtn.style.border = "0";
      cancelBtn.style.borderRadius = "10px";
      cancelBtn.style.padding = "8px 10px";
      cancelBtn.style.fontSize = "13px";
      cancelBtn.style.cursor = "pointer";

      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);

      let deleteBtn: HTMLButtonElement | null = null;
      if (isAdminRef.current) {
        deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.textContent = "Șterge";
        deleteBtn.style.flex = "1 1 100%";
        deleteBtn.style.background = "#dc2626";
        deleteBtn.style.color = "white";
        deleteBtn.style.border = "0";
        deleteBtn.style.borderRadius = "10px";
        deleteBtn.style.padding = "8px 10px";
        deleteBtn.style.fontSize = "13px";
        deleteBtn.style.cursor = "pointer";
        deleteBtn.style.marginTop = "6px";
        actions.appendChild(deleteBtn);
      }
      container.appendChild(actions);

      const getPopupLatLng = (): L.LatLng => {
        if ((layer as L.Marker).getLatLng) return (layer as L.Marker).getLatLng();
        if ((layer as L.Polyline).getBounds) return (layer as L.Polyline).getBounds().getCenter();
        return map.getCenter();
      };

      const popup = L.popup({ closeButton: true, autoClose: true, closeOnClick: true })
        .setLatLng(getPopupLatLng())
        .setContent(container);

      const close = () => {
        map.closePopup(popup);
      };

      cancelBtn.onclick = (ev) => {
        ev.preventDefault();
        close();
      };

      saveBtn.onclick = async (ev) => {
        ev.preventDefault();
        const name = nameInput.value.trim();
        const color = colorInput.value;
        saveBtn.textContent = "Salvez...";
        (saveBtn as unknown as { disabled?: boolean }).disabled = true;
        if (deleteBtn) (deleteBtn as unknown as { disabled?: boolean }).disabled = true;

        const nextProps: Record<string, unknown> = { ...(props ?? {}) };
        if (name) nextProps.name = name;
        else delete nextProps.name;
        nextProps.color = color;

        const { error } = await supabase
          .from("map_annotations")
          .update({ properties: nextProps })
          .eq("id", ann.id);

        if (error) {
          alert(`Nu s-a putut salva: ${error.message}`);
          saveBtn.textContent = "Salvează";
          (saveBtn as unknown as { disabled?: boolean }).disabled = false;
          if (deleteBtn) (deleteBtn as unknown as { disabled?: boolean }).disabled = false;
          return;
        }
        await loadAnnotationsRef.current?.();
        onRefresh?.();
        close();
      };

      if (deleteBtn) {
        deleteBtn.onclick = async (ev) => {
          ev.preventDefault();
          const ok = window.confirm("Sigur vrei să ștergi această conductă/linie?");
          if (!ok) return;
          deleteBtn.textContent = "Șterg...";
          (deleteBtn as unknown as { disabled?: boolean }).disabled = true;
          (saveBtn as unknown as { disabled?: boolean }).disabled = true;

          const { error } = await supabase.from("map_annotations").delete().eq("id", ann.id);
          if (error) {
            alert(`Nu s-a putut șterge: ${error.message}`);
            deleteBtn.textContent = "Șterge";
            (deleteBtn as unknown as { disabled?: boolean }).disabled = false;
            (saveBtn as unknown as { disabled?: boolean }).disabled = false;
            return;
          }
          await loadAnnotationsRef.current?.();
          onRefresh?.();
          close();
        };
      }

      map.openPopup(popup);
      setTimeout(() => nameInput.focus(), 50);
    };

    const renderAnnotations = (annotations: MapAnnotation[]) => {
      if (!layerGroupRef.current) return;
      layerGroupRef.current.clearLayers();
      for (const ann of annotations) {
        if (ann.type === "line" && ann.geom.type === "LineString") {
          const latlngs = ann.geom.coordinates.map(
            (c) => [c[1], c[0]] as [number, number]
          );
          const props = (ann.properties || {}) as Record<string, unknown>;
          const color = getColorProp(props, "color") ?? "#2563eb";
          const line = L.polyline(latlngs, {
            color,
            weight: 3,
          });
          (line as L.Polyline & { _annotationId?: string })._annotationId = ann.id;
          const name = getStringProp(props, "name") ?? getStringProp(props, "label");
          if (name) line.bindTooltip(name, { permanent: true, direction: "center", className: "pipeline-label" });
          line.on("click", () => openEditPopup(line, ann));
          layerGroupRef.current.addLayer(line);
        } else if (ann.type === "arrow" && ann.geom.type === "LineString") {
          const latlngs = ann.geom.coordinates.map(
            (c) => [c[1], c[0]] as [number, number]
          );
          const props = (ann.properties || {}) as Record<string, unknown>;
          const color = getColorProp(props, "color") ?? "#dc2626";
          const line = L.polyline(latlngs, {
            color,
            weight: 3,
          });
          (line as L.Polyline & { _annotationId?: string })._annotationId = ann.id;
          const name = getStringProp(props, "name") ?? getStringProp(props, "label");
          if (name) line.bindTooltip(name, { permanent: true, direction: "center", className: "pipeline-label" });
          line.on("click", () => openEditPopup(line, ann));
          layerGroupRef.current.addLayer(line);
          if (latlngs.length >= 2) {
            const end = latlngs[latlngs.length - 1];
            const prev = latlngs[latlngs.length - 2];
            const angle =
              (Math.atan2(end[1] - prev[1], end[0] - prev[0]) * 180) / Math.PI +
              90;
            const arrowMarker = L.marker(end, {
              icon: createArrowIcon(angle),
            });
            (arrowMarker as L.Marker & { _annotationId?: string })._annotationId =
              ann.id;
            layerGroupRef.current.addLayer(arrowMarker);
          }
        } else if (ann.type === "marker" && ann.geom.type === "Point") {
          const [lng, lat] = ann.geom.coordinates;
          const marker = L.marker([lat, lng], {
            icon: createAttentionIcon(),
          });
          (marker as L.Marker & { _annotationId?: string })._annotationId =
            ann.id;
          const props = (ann.properties || {}) as { text?: string };
          if (props.text) {
            marker.bindTooltip(props.text, { permanent: true });
          }
          layerGroupRef.current.addLayer(marker);
        } else if (ann.type === "text" && ann.geom.type === "Point") {
          const [lng, lat] = ann.geom.coordinates;
          const text = ((ann.properties || {}) as { text?: string }).text || "";
          const marker = L.marker([lat, lng], {
            icon: createTextIcon(text),
          });
          (marker as L.Marker & { _annotationId?: string })._annotationId =
            ann.id;
          marker.bindPopup(text);
          layerGroupRef.current.addLayer(marker);
        }
      }
    };

    const loadAnnotations = async () => {
      if (!layerGroupRef.current) {
        layerGroupRef.current = L.layerGroup().addTo(map);
      }
      const { data, error } = await supabase
        .from("map_annotations")
        .select("*")
        .eq("project_id", projectId);

      if (!error && data && data.length >= 0) {
        renderAnnotations(data as MapAnnotation[]);
        return;
      }
      try {
        const res = await fetch(`/api/vizitatori/${projectId}/annotations`);
        if (res.ok) {
          const json = await res.json();
          const list = (json.annotations ?? []) as MapAnnotation[];
          renderAnnotations(list);
        }
      } catch {
        // Offline sau API indisponibil
      }
    };

    loadAnnotationsRef.current = loadAnnotations;
    loadAnnotations();

    const sub = supabase
      .channel("map_annotations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "map_annotations",
          filter: `project_id=eq.${projectId}`,
        },
        loadAnnotations
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
    };
  }, [map, projectId]);

  useEffect(() => {
    if (!map || !projectId || geomanInitialized.current) return;

    if (typeof window !== "undefined" && !(window as unknown as { L_PM?: boolean }).L_PM) {
      try {
        require("@geoman-io/leaflet-geoman-free");
      } catch {
        // Geoman might already be loaded
      }
    }

    map.pm?.addControls({
      position: "bottomleft",
      drawMarker: false,
      drawPolyline: false,
      drawCircle: false,
      drawRectangle: false,
      drawPolygon: false,
      drawCircleMarker: false,
      // Butonul Geoman „Text” are probleme de input în unele browsere;
      // folosim instrumentul nostru „Text” (stânga sus) care salvează în DB.
      drawText: false,
      editMode: true,
      dragMode: true,
      cutPolygon: false,
      removalMode: true,
    });

    geomanInitialized.current = true;

    const supabase = createClient();

    const handleCreate = async (e: L.LeafletEvent & { layer: L.Layer; shape?: string }) => {
      const layer = e.layer;
      let type: AnnotationType = "line";
      let geom: GeoJSON.Geometry;
      let properties: Record<string, unknown> = {};

      if (layer instanceof L.Marker) {
        const latlng = layer.getLatLng();
        const opts = (layer as L.Marker & { options?: { textMarker?: boolean; text?: string } }).options;
        const isTextMarker = opts?.textMarker === true;
        geom = {
          type: "Point",
          coordinates: [latlng.lng, latlng.lat],
        };
        if (isTextMarker && opts?.text) {
          type = "text";
          properties = { text: opts.text };
        } else {
          type = "marker";
        }
      } else if (layer instanceof L.Polyline) {
        const geo = (layer as unknown as { toGeoJSON?: () => { geometry?: GeoJSON.Geometry } }).toGeoJSON?.();
        geom = geo?.geometry ?? {
          type: "LineString",
          coordinates: (layer.getLatLngs() as L.LatLng[]).map((ll) => [ll.lng, ll.lat]),
        };
        type = drawModeRef.current === "arrow" ? "arrow" : "line";
      } else {
        map.removeLayer(layer);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("map_annotations")
        .insert({
          project_id: projectId,
          type,
          geom,
          properties,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Eroare la salvare annotație:", error);
        alert(`Nu s-a putut salva: ${error.message}`);
        return;
      }
      map.removeLayer(layer);
      if (inserted) loadAnnotationsRef.current?.();
    };

    const handleRemove = async (e: L.LeafletEvent) => {
      const layer = (e as L.LeafletEvent & { layer: L.Layer }).layer;
      const id = (layer as L.Layer & { _annotationId?: string })._annotationId;
      if (id) {
        await supabase.from("map_annotations").delete().eq("id", id);
      }
    };

    map.on("pm:create", handleCreate);
    map.on("pm:remove", handleRemove);

    return () => {
      map.off("pm:create", handleCreate);
      map.off("pm:remove", handleRemove);
      map.pm?.removeControls();
      geomanInitialized.current = false;
    };
  }, [map, projectId, onRefresh]);

  useEffect(() => {
    if (!map) return;
    return () => {
      if (pendingTextClickHandlerRef.current) {
        map.off("click", pendingTextClickHandlerRef.current);
        pendingTextClickHandlerRef.current = null;
      }
    };
  }, [map]);

  const startTextPlacement = () => {
    if (!map || !projectId) return;

    if (pendingTextClickHandlerRef.current) {
      map.off("click", pendingTextClickHandlerRef.current);
      pendingTextClickHandlerRef.current = null;
    }

    const handler = async (e: L.LeafletMouseEvent) => {
      // one-shot
      if (pendingTextClickHandlerRef.current) {
        map.off("click", pendingTextClickHandlerRef.current);
        pendingTextClickHandlerRef.current = null;
      }
      setMode(null);

      const raw = window.prompt("Text pe hartă:");
      if (raw == null) return;
      const text = raw.trim();
      if (!text) return;

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const geom: GeoJSON.Point = {
        type: "Point",
        coordinates: [e.latlng.lng, e.latlng.lat],
      };

      const { error } = await supabase.from("map_annotations").insert({
        project_id: projectId,
        type: "text",
        geom,
        properties: { text },
        created_by: user?.id ?? null,
      });

      if (error) {
        console.error("Eroare la salvare text:", error);
        alert(`Nu s-a putut salva textul: ${error.message}`);
        return;
      }
      await loadAnnotationsRef.current?.();
      onRefresh?.();
    };

    pendingTextClickHandlerRef.current = handler;
    map.on("click", handler);
  };

  const setMode = (mode: AnnotationType | null) => {
    drawModeRef.current = mode;
    setDrawMode(mode);

    if (pendingTextClickHandlerRef.current && mode !== "text") {
      map?.off("click", pendingTextClickHandlerRef.current);
      pendingTextClickHandlerRef.current = null;
    }

    if (mode === "text") {
      // Nu depinde de Geoman: doar click pe hartă + prompt.
      startTextPlacement();
      map?.pm?.disableDraw();
      return;
    }

    if (map?.pm) {
      map.pm.disableDraw();
      if (mode === "line" || mode === "arrow") {
        map.pm.enableDraw("Line");
      } else if (mode === "marker") {
        map.pm.enableDraw("Marker");
      } else {
        map.pm.disableDraw();
      }
    }
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasMultipleTools = [tools.includes("line"), tools.includes("arrow"), tools.includes("marker"), tools.includes("text")].filter(Boolean).length > 1;

  return (
    <div className="absolute top-20 sm:top-24 left-2 sm:left-4 z-[1100] bg-white/95 rounded-lg shadow-lg border">
      {/* Pe mobil: un singur buton „Desen” care deschide meniul */}
      {hasMultipleTools ? (
        <>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden px-3 py-2 text-xs font-medium rounded-t-lg w-full flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 touch-manipulation"
            aria-expanded={mobileMenuOpen}
          >
            ✏️ Desen {mobileMenuOpen ? "▲" : "▼"}
          </button>
          <div
            className={`flex flex-row flex-wrap gap-1 p-1 ${mobileMenuOpen ? "flex" : "hidden"} md:!flex md:!flex-col`}
          >
            {tools.includes("line") && (
              <button
                type="button"
                onClick={() => { setMode(drawMode === "line" ? null : "line"); setMobileMenuOpen(false); }}
                className={`px-2 py-1 text-xs rounded touch-manipulation ${drawMode === "line" ? "bg-blue-100" : "hover:bg-slate-100"}`}
                title="Linie"
              >
                Linie
              </button>
            )}
            {tools.includes("arrow") && (
              <button
                type="button"
                onClick={() => { setMode(drawMode === "arrow" ? null : "arrow"); setMobileMenuOpen(false); }}
                className={`px-2 py-1 text-xs rounded touch-manipulation ${drawMode === "arrow" ? "bg-blue-100" : "hover:bg-slate-100"}`}
                title="Săgeată"
              >
                Săgeată
              </button>
            )}
            {tools.includes("marker") && (
              <button
                type="button"
                onClick={() => { setMode(drawMode === "marker" ? null : "marker"); setMobileMenuOpen(false); }}
                className={`px-2 py-1 text-xs rounded touch-manipulation ${drawMode === "marker" ? "bg-blue-100" : "hover:bg-slate-100"}`}
                title="Semn atenționare"
              >
                Semn
              </button>
            )}
            {tools.includes("text") && (
              <button
                type="button"
                onClick={() => { setMode(drawMode === "text" ? null : "text"); setMobileMenuOpen(false); }}
                className={`px-2 py-1 text-xs rounded touch-manipulation ${drawMode === "text" ? "bg-blue-100" : "hover:bg-slate-100"}`}
                title="Text"
              >
                Text
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1 p-1">
          {tools.includes("line") && (
            <button type="button" onClick={() => setMode(drawMode === "line" ? null : "line")} className={`px-2 py-1 text-xs rounded ${drawMode === "line" ? "bg-blue-100" : "hover:bg-slate-100"}`} title="Linie">Linie</button>
          )}
          {tools.includes("arrow") && (
            <button type="button" onClick={() => setMode(drawMode === "arrow" ? null : "arrow")} className={`px-2 py-1 text-xs rounded ${drawMode === "arrow" ? "bg-blue-100" : "hover:bg-slate-100"}`} title="Săgeată">Săgeată</button>
          )}
          {tools.includes("marker") && (
            <button type="button" onClick={() => setMode(drawMode === "marker" ? null : "marker")} className={`px-2 py-1 text-xs rounded ${drawMode === "marker" ? "bg-blue-100" : "hover:bg-slate-100"}`} title="Semn atenționare">Semn</button>
          )}
          {tools.includes("text") && (
            <button type="button" onClick={() => setMode(drawMode === "text" ? null : "text")} className={`px-2 py-1 text-xs rounded ${drawMode === "text" ? "bg-blue-100" : "hover:bg-slate-100"}`} title="Text">Text</button>
          )}
        </div>
      )}
    </div>
  );
}
