import { NextResponse } from "next/server";
import { manifestData } from "@/app/manifest";

/**
 * Route handler pentru manifest PWA – evită 500 de la metadata route.
 * Răspunde la GET /manifest.webmanifest
 */
export async function GET() {
  return NextResponse.json(manifestData, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
