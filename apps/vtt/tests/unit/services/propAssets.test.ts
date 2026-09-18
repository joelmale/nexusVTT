import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { propAssetManager } from '@/services/propAssets';
import type { Prop, PropCategory } from '@/types/prop';

describe('PropAssetManager', () => {
  beforeEach(async () => {
    localStorage.clear();
    await propAssetManager.initialize();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes default libraries and loads default props', () => {
    const allProps = propAssetManager.getAllProps();
    expect(allProps.length).toBeGreaterThan(0);

    const furniture = propAssetManager.getPropsByCategory('furniture');
    expect(furniture.length).toBeGreaterThan(0);
    expect(furniture.some((p: Prop) => p.name.includes('Table') || p.name.includes('Chair') || p.name.includes('Door'))).toBe(true);
  });

  it('retrieves prop by id and falls back to placeholder for unknown id', () => {
    const allProps = propAssetManager.getAllProps();
    const firstProp = allProps[0];

    const retrieved = propAssetManager.getPropById(firstProp.id);
    expect(retrieved.id).toBe(firstProp.id);
    expect(retrieved.name).toBe(firstProp.name);

    const unknown = propAssetManager.getPropById('non-existent-prop-id');
    expect(unknown.name).toBe('Missing Prop');
    expect(unknown.tags).toContain('missing');
  });

  it('searches props by query and tag', () => {
    const all = propAssetManager.getAllProps();
    const target = all[0];

    const results = propAssetManager.searchProps(target.name);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p: Prop) => p.id === target.id)).toBe(true);

    const emptySearch = propAssetManager.searchProps('   ');
    expect(emptySearch.length).toBe(all.length);
  });

  it('filters props by category', () => {
    const categories: PropCategory[] = ['furniture', 'treasure', 'decoration', 'traps', 'effects'];
    for (const category of categories) {
      const props = propAssetManager.getPropsByCategory(category);
      props.forEach((p: Prop) => expect(p.category).toBe(category));
    }
  });

  it('adds, retrieves, updates, and deletes custom props', async () => {
    const newCustom = await propAssetManager.addCustomProp({
      name: 'Enchanted Mirror',
      category: 'decoration',
      size: 'medium',
      tags: ['magic', 'mirror'],
      image: 'data:image/png;base64,123',
      isCustom: true,
      isPublic: true,
    });

    expect(newCustom.id).toContain('custom-prop-');
    expect(newCustom.name).toBe('Enchanted Mirror');

    // Retrieve custom prop
    const found = propAssetManager.getPropById(newCustom.id);
    expect(found.id).toBe(newCustom.id);
    expect(found.name).toBe('Enchanted Mirror');

    // Update custom prop
    await propAssetManager.updateProp(newCustom.id, { name: 'Shattered Mirror' });
    const updated = propAssetManager.getPropById(newCustom.id);
    expect(updated.name).toBe('Shattered Mirror');

    // Delete custom prop
    await propAssetManager.deleteProp(newCustom.id);
    const afterDelete = propAssetManager.getPropById(newCustom.id);
    expect(afterDelete.name).toBe('Missing Prop');
  });

  it('updates a default prop with override into custom library', async () => {
    const all = propAssetManager.getAllProps();
    const defaultProp = all.find((p: Prop) => !p.isCustom)!;

    await propAssetManager.updatePropWithOverride(defaultProp.id, {
      name: `${defaultProp.name} (Custom Edition)`,
    });

    const overridden = propAssetManager.getPropById(defaultProp.id);
    expect(overridden.name).toBe(`${defaultProp.name} (Custom Edition)`);
    expect(overridden.isCustom).toBe(true);
  });

  it('refreshes custom libraries from storage', async () => {
    const customLib = [
      {
        id: 'custom-props',
        name: 'Custom Props',
        description: 'Stored',
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: [
          {
            id: 'stored-prop-1',
            name: 'Stored Statue',
            category: 'decoration' as const,
            size: 'large' as const,
            tags: ['stone'],
            image: '',
            isCustom: true,
            isPublic: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      },
    ];
    localStorage.setItem('nexus_prop_libraries', JSON.stringify(customLib));

    await propAssetManager.refreshCustomLibraries();
    const prop = propAssetManager.getPropById('stored-prop-1');
    expect(prop.name).toBe('Stored Statue');
  });

  it('generates placeholder SVG image data URL', () => {
    const placeholder = propAssetManager.generatePlaceholderImage('Chest', '#ff5500');
    expect(placeholder).toContain('data:image/svg+xml;base64,');
    const decoded = atob(placeholder.replace('data:image/svg+xml;base64,', ''));
    expect(decoded).toContain('fill="#ff5500"');
    expect(decoded).toContain('CH');
  });
});
