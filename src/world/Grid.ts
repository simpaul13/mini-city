export const chunkCoordinate = (value: number, size = 32) => Math.floor(value / size);
export const tileKey = (x: number, z: number) => `${x},${z}`;
