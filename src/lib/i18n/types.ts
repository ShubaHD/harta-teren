export type Locale = "ro" | "en" | "es";

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "ro", label: "RO" },
  { id: "en", label: "EN" },
  { id: "es", label: "ES" },
];

export const LANG_STORAGE_KEY = "harta-lang";
