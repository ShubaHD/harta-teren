import { redirect } from "next/navigation";

/** Export e la /export (admin + echipe pe proiectele atribuite). */
export default function AdminExportRedirect() {
  redirect("/export");
}
