import { NextResponse } from "next/server";

/**
 * Lightweight health check for offline-status probe.
 * HEAD/GET returns 200 when the app is reachable.
 */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
