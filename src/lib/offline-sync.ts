"use client";

import { createClient } from "@/lib/supabase/client";
import { getPendingUpdates, removePendingUpdate, cachePoints } from "./offline-store";
import type { DrillPoint } from "./types";

export async function syncPendingUpdates(): Promise<{ synced: number; failed: number }> {
  const supabase = createClient();
  const pending = await getPendingUpdates();
  let synced = 0;
  let failed = 0;

  for (const u of pending) {
    try {
      if (u.action === "claim") {
        const { data, error } = await supabase
          .from("drill_points")
          .update({
            status: "in_lucru",
            assigned_team: u.teamName,
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", u.pointId)
          .in("status", ["de_facut"])
          .select("id");

        if (error || !data?.length) {
          failed++;
          continue;
        }
      } else {
        const { data, error } = await supabase
          .from("drill_points")
          .update({
            status: "finalizat",
            completed_at: new Date().toISOString(),
            completed_by: u.userId,
            final_depth: u.finalDepth?.trim() || null,
            updated_at: new Date().toISOString(),
            ...(u.teamName != null && { assigned_team: u.teamName }),
          })
          .eq("id", u.pointId)
          .in("status", ["in_lucru"])
          .select("id");

        if (error || !data?.length) {
          failed++;
          continue;
        }
      }

      if (u.id != null) await removePendingUpdate(u.id);
      synced++;
    } catch {
      failed++;
    }
  }

  if (synced > 0) {
    const projectIds = [...new Set(pending.map((p) => p.projectId))];
    for (const projectId of projectIds) {
      const { data } = await supabase
        .from("drill_points")
        .select("*")
        .eq("project_id", projectId)
        .order("code");
      if (data) await cachePoints(projectId, data as DrillPoint[]);
    }
  }

  return { synced, failed };
}
