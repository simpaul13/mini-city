/** Keep Three.js separate from application code so each can be cached independently. */
export function vendorChunk(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/");
  if (normalized.includes("/node_modules/three/")) return "three";
  return undefined;
}
