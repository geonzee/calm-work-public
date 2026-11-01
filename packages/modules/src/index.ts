export const featureIds = [
  'tasks', 'tracking', 'projects', 'blocking', 'calendars', 'sync',
  'booking', 'polls', 'team', 'reports', 'automation',
] as const;
export type FeatureId = typeof featureIds[number];
export type Platform = 'desktop' | 'mobile' | 'web';

export interface ModuleDefinition {
  readonly id: FeatureId;
  readonly dependencies: readonly FeatureId[];
  readonly mode: 'local' | 'optional-network';
}

export const modules: readonly ModuleDefinition[] = [
  { id: 'tasks', dependencies: [], mode: 'local' },
  { id: 'tracking', dependencies: ['tasks'], mode: 'local' },
  { id: 'projects', dependencies: ['tasks'], mode: 'local' },
  { id: 'blocking', dependencies: ['tasks'], mode: 'local' },
  { id: 'calendars', dependencies: ['blocking'], mode: 'optional-network' },
  { id: 'sync', dependencies: ['tasks'], mode: 'optional-network' },
  { id: 'booking', dependencies: ['calendars'], mode: 'optional-network' },
  { id: 'polls', dependencies: ['tasks'], mode: 'optional-network' },
  { id: 'team', dependencies: ['projects', 'sync'], mode: 'optional-network' },
  { id: 'reports', dependencies: ['tracking'], mode: 'local' },
  { id: 'automation', dependencies: ['tasks'], mode: 'local' },
];

export const defaultFeatures: readonly FeatureId[] = ['tasks', 'tracking'];

/** Returns dependency order only. Runtime hosts must lazy-load these features. */
export function resolveFeatures(requested: readonly FeatureId[]): readonly FeatureId[] {
  const enabled = new Set<FeatureId>();
  const visiting = new Set<FeatureId>();
  function visit(id: FeatureId): void {
    if (enabled.has(id)) return;
    if (visiting.has(id)) throw new Error(`Module dependency cycle: ${id}`);
    const module = modules.find(item => item.id === id);
    if (!module) throw new Error(`Unknown module: ${id}`);
    visiting.add(id);
    module.dependencies.forEach(visit);
    visiting.delete(id);
    enabled.add(id);
  }
  visit('tasks');
  requested.forEach(visit);
  return [...enabled];
}

export function primaryFeatures(platform: Platform): readonly FeatureId[] {
  return platform === 'mobile' ? ['tasks', 'tracking'] : ['tasks', 'tracking', 'blocking'];
}
