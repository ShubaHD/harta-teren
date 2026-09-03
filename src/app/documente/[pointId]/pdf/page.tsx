import FieldSiteDocumentsClient from "@/components/FieldSiteDocumentsClient";

export default async function FieldPdfPage({
  params,
}: {
  params: Promise<{ pointId: string }>;
}) {
  const { pointId } = await params;
  return <FieldSiteDocumentsClient pointId={pointId} />;
}
