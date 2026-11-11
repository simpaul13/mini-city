import type { PlacementResult } from '../shared/types';
import { definitions } from './BuildingCatalog';
import { WorldState } from '../world/WorldState';
import { tileKey } from '../world/Grid';
export function validatePlacement(state: WorldState, tool: string, x: number, z: number, elevation: (x: number, z: number) => number, sea: number): PlacementResult {
 const key = tileKey(x, z);
 if (tool === 'bulldoze') return { ok: true };
 if (!definitions[tool]) return { ok: false, reason: 'unknown tool' };
 if (state.placed.has(key)) return { ok: false, reason: 'occupied' };
 const h = elevation(x,z) * 5;
 if (h <= sea + 0.08) return { ok: false, reason: 'water' };
 if ([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz]) => Math.abs(elevation(x+dx,z+dz)*5-h) >= 0.8)) return { ok: false, reason: 'slope' };
 if (state.budget < definitions[tool].cost) return { ok: false, reason: 'insufficient funds' };
 return { ok: true };
}
