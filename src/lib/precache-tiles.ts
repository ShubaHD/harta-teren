/**
 * Pre-cache map tiles for a bounding box so they work offline.
 * Fetches tile URLs to populate the service worker cache.
 */
export function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) /
      Math.PI) /
      2) *
      n
  );
  return { x: Math.max(0, Math.min(x, n - 1)), y: Math.max(0, Math.min(y, n - 1)), z: zoom };
}

export function getTileUrlsInBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  zoomLevels: number[] = [12, 13, 14, 15]
): string[] {
  const urls: string[] = [];
  const servers = ["a", "b", "c"];

  for (const z of zoomLevels) {
    const tl = latLngToTile(maxLat, minLng, z);
    const br = latLngToTile(minLat, maxLng, z);
    const minX = Math.min(tl.x, br.x);
    const maxX = Math.max(tl.x, br.x);
    const minY = Math.min(tl.y, br.y);
    const maxY = Math.max(tl.y, br.y);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const s = servers[(x + y) % 3];
        urls.push(`https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }

  return urls;
}

export async function precacheTileUrls(urls: string[], onProgress?: (done: number, total: number) => void): Promise<void> {
  const total = urls.length;
  let done = 0;

  const batchSize = 20;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await Promise.all(
      batch.map((url) =>
        fetch(url, { mode: "cors" })
          .then(() => {
            done++;
            onProgress?.(done, total);
          })
          .catch(() => {
            done++;
          })
      )
    );
  }
}
