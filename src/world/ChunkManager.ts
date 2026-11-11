/** Owns the active square window; generated data is not cached yet. */
export class ChunkManager<T> {
 constructor(public chunks: Map<string, T>, private load: (x: number, z: number, key: string) => void, private unload: (chunk: T) => void) {}
 sync(cx: number, cz: number, radius: number) {
  const needed = new Set<string>();
  for (let x = cx - radius; x <= cx + radius; x++) for (let z = cz - radius; z <= cz + radius; z++) needed.add(`${x},${z}`);
  for (const [key, chunk] of this.chunks) if (!needed.has(key)) { this.unload(chunk); this.chunks.delete(key); }
  for (let x = cx - radius; x <= cx + radius; x++) for (let z = cz - radius; z <= cz + radius; z++) {
   const key = `${x},${z}`; if (!this.chunks.has(key)) this.load(x,z,key);
  }
 }
 dispose() { for (const chunk of this.chunks.values()) this.unload(chunk); this.chunks.clear(); }
}
