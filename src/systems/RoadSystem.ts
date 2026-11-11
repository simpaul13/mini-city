import type { Building } from '../shared/types';
import { tileKey } from '../world/Grid';
export { roadLine } from '../roads';
export function roadConnections(placed: ReadonlyMap<string, Building>, x: number, z: number) {
 return { north: placed.get(tileKey(x,z-1))?.type === 'road', east: placed.get(tileKey(x+1,z))?.type === 'road', south: placed.get(tileKey(x,z+1))?.type === 'road', west: placed.get(tileKey(x-1,z))?.type === 'road' };
}
