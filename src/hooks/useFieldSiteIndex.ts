"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildFieldSiteIndex, type FieldSiteIndexEntry } from "@/lib/field-site-files";

export function useFieldSiteIndex(pointIds: string[]): Map<string, FieldSiteIndexEntry> {
  const [index, setIndex] = useState<Map<string, FieldSiteIndexEntry>>(new Map());
  const idsKey = pointIds.join("|");

  useEffect(() => {
    if (pointIds.length === 0) {
      setIndex(new Map());
      return;
    }
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const map = new Map<string, FieldSiteIndexEntry>();
      const chunkSize = 100;
      for (let i = 0; i < pointIds.length; i += chunkSize) {
        const chunk = pointIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("field_site_files")
          .select("drill_point_id")
          .in("drill_point_id", chunk);
        if (cancelled) return;
        if (error) return;
        const part = buildFieldSiteIndex(data ?? []);
        for (const [id, entry] of part) map.set(id, entry);
      }
      if (!cancelled) setIndex(map);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return index;
}

export function useIsAdminClient(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsAdmin(data?.role === "admin");
    });
  }, []);
  return isAdmin;
}
