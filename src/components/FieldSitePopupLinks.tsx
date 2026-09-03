"use client";

import Link from "next/link";
import type { FieldSiteIndexEntry } from "@/lib/field-site-files";

interface FieldSitePopupLinksProps {
  pointId: string;
  files?: FieldSiteIndexEntry;
  alwaysShow?: boolean;
}

export default function FieldSitePopupLinks({
  pointId,
  files,
  alwaysShow = false,
}: FieldSitePopupLinksProps) {
  const showPdf = alwaysShow || !!files?.hasPdf;
  if (!showPdf) return null;

  return (
    <Link
      href={`/documente/${pointId}/pdf`}
      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline min-h-[44px] touch-manipulation"
      title="Fișă de foraj PDF"
    >
      📄 PDF
    </Link>
  );
}
