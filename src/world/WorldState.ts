import type { Building } from '../shared/types';
import { definitions } from '../systems/BuildingCatalog';
export class WorldState {
 placed = new Map<string, Building>();
 deleted = new Set<string>();
 get budget() { return 12400 - [...this.placed.values()].reduce((n, b) => n + (definitions[b.type]?.cost ?? 0), 0); }
 get population() { return [...this.placed.values()].reduce((n, b) => n + (definitions[b.type]?.pop ?? 0), 0); }
}
