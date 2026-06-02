/**
 * Comprimă imaginea dacă depășește limita (evită eroarea Supabase "maximum allowed size").
 * Redimensionează la max 2048px și comprimă JPEG la calitate 0.85.
 */
export async function compressImageIfNeeded(file: File | Blob, maxBytes = 4 * 1024 * 1024): Promise<File | Blob> {
  const size = file.size ?? 0;
  if (size <= maxBytes) return file;

  const blob = file instanceof Blob ? file : (file as File);
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const maxDim = 2048;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((result) => resolve(result ?? file), "image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}
