import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Exclude static assets, PWA (SW, workbox, manifest) so offline/install work reliably
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|workbox|worker-|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
