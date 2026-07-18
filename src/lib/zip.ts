// Bundle converted files into a single .zip on-device (fflate).
import { zip, type Zippable } from 'fflate'

export async function zipBlobs(entries: { name: string; blob: Blob }[]): Promise<Blob> {
  const files: Zippable = {}
  const seen = new Map<string, number>()
  for (const { name, blob } of entries) {
    // De-dupe repeated filenames: foo.jpg, foo (1).jpg, …
    let out = name
    const n = seen.get(name) ?? 0
    if (n > 0) {
      const dot = name.lastIndexOf('.')
      out = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`
    }
    seen.set(name, n + 1)
    // Already-compressed formats (png/jpeg/webp) → store, level 0.
    files[out] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
  }
  return new Promise((resolve, reject) => {
    zip(files, (err, data) => {
      if (err) reject(err)
      else resolve(new Blob([data as unknown as BlobPart], { type: 'application/zip' }))
    })
  })
}
