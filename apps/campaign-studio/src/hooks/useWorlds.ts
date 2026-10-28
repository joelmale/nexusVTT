import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { World } from '@/types/world';
import { generateId } from '@/lib/utils';

export interface WorldFormData {
  name: string;
  description?: string;
  type: 'continent' | 'region' | 'kingdom' | 'city' | 'town' | 'village' | 'location' | 'dungeon' | 'plane' | 'other';
  parentWorldId?: string;
  geography?: string;
  climate?: string;
  population?: number;
  government?: string;
  factions?: string[];
  points_of_interest?: string[];
  map_url?: string;
  notes?: string;
}

export function useWorlds(campaignId?: string) {
  // Get all worlds for a campaign
  const worlds = useLiveQuery(
    () => {
      if (!campaignId) return [];
      return db.worlds.where('campaignId').equals(campaignId).toArray();
    },
    [campaignId]
  );

  // Get root worlds (no parent)
  const rootWorlds = useLiveQuery(
    () => {
      if (!campaignId) return [];
      return db.worlds
        .where('campaignId')
        .equals(campaignId)
        .and((world) => !world.parentWorldId)
        .toArray();
    },
    [campaignId]
  );

  // Get child worlds for a parent
  const getChildWorlds = async (parentWorldId: string): Promise<World[]> => {
    return db.worlds.where('parentWorldId').equals(parentWorldId).toArray();
  };

  // Create world
  const createWorld = async (
    campaignId: string,
    data: WorldFormData
  ): Promise<World> => {
    const world: World = {
      id: generateId(),
      campaignId,
      name: data.name,
      description: data.description,
      type: data.type,
      parentWorldId: data.parentWorldId,
      geography: data.geography,
      climate: data.climate,
      population: data.population,
      government: data.government,
      factions: data.factions || [],
      points_of_interest: data.points_of_interest || [],
      map_url: data.map_url,
      mapUrl: data.map_url, // Also set mapUrl for compatibility
      notes: data.notes,
      properties: {}, // Initialize empty properties object
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.worlds.add(world);
    return world;
  };

  // Update world
  const updateWorld = async (id: string, data: Partial<WorldFormData>): Promise<void> => {
    await db.worlds.update(id, {
      ...data,
      updatedAt: Date.now(),
    });
  };

  // Delete world (cascade delete children)
  const deleteWorld = async (id: string): Promise<void> => {
    await db.transaction('rw', [db.worlds, db.sessions, db.encounters, db.npcs], async () => {
      // Get all descendant worlds recursively
      const getAllDescendants = async (worldId: string): Promise<string[]> => {
        const children = await db.worlds.where('parentWorldId').equals(worldId).toArray();
        const childIds = children.map((c) => c.id);

        const allDescendants: string[] = [...childIds];
        for (const childId of childIds) {
          const descendants = await getAllDescendants(childId);
          allDescendants.push(...descendants);
        }
        return allDescendants;
      };

      const descendantIds = await getAllDescendants(id);
      const allWorldIds = [id, ...descendantIds];

      // Delete all descendant worlds
      await db.worlds.bulkDelete(allWorldIds);

      // Clean up references in other entities
      for (const worldId of allWorldIds) {
        await db.sessions.where('worldId').equals(worldId).modify({ worldId: undefined });
        await db.encounters.where('worldId').equals(worldId).modify({ worldId: undefined });
        await db.npcs.where('homeWorldId').equals(worldId).modify({ homeWorldId: undefined });
      }
    });
  };

  // Move world to new parent
  const moveWorld = async (id: string, newParentId?: string): Promise<void> => {
    await db.worlds.update(id, {
      parentWorldId: newParentId,
      updatedAt: Date.now(),
    });
  };

  // Duplicate world (without children)
  const duplicateWorld = async (id: string): Promise<World> => {
    const original = await db.worlds.get(id);
    if (!original) throw new Error('World not found');

    const duplicate: World = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      parentWorldId: original.parentWorldId, // Keep same parent
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.worlds.add(duplicate);
    return duplicate;
  };

  // Build hierarchical tree structure
  const buildWorldTree = (worlds: World[]): World[] => {
    const worldMap = new Map<string, World & { children?: World[] }>();
    const roots: World[] = [];

    // Create map of all worlds
    worlds.forEach((world) => {
      worldMap.set(world.id, { ...world, children: [] });
    });

    // Build tree structure
    worlds.forEach((world) => {
      const node = worldMap.get(world.id)!;
      if (world.parentWorldId) {
        const parent = worldMap.get(world.parentWorldId);
        if (parent) {
          parent.children!.push(node);
        } else {
          // Parent not found, treat as root
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  return {
    worlds: worlds || [],
    rootWorlds: rootWorlds || [],
    createWorld,
    updateWorld,
    deleteWorld,
    moveWorld,
    duplicateWorld,
    getChildWorlds,
    buildWorldTree,
  };
}
