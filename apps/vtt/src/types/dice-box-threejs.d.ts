declare module '@3d-dice/dice-box-threejs' {
  export interface DiceBoxConfig {
    /** Base URL for textures/sounds. Must end with a trailing slash. */
    assetPath: string;
    framerate?: number;
    sounds?: boolean;
    volume?: number;
    color_spotlight?: number;
    shadows?: boolean;
    theme_surface?: string;
    sound_dieMaterial?: string;
    theme_customColorset?: Record<string, unknown> | null;
    theme_colorset?: string;
    theme_texture?: string;
    theme_material?: 'none' | 'metal' | 'wood' | 'glass' | 'plastic';
    gravity_multiplier?: number;
    light_intensity?: number;
    baseScale?: number;
    /** Toss strength of the dice. */
    strength?: number;
    iterationLimit?: number;
    onRollComplete?: (results: RollResult) => void;
    onRerollComplete?: (results: DieResult[]) => void;
    onAddDiceComplete?: (results: DieResult[]) => void;
    onRemoveDiceComplete?: (results: DieResult[]) => void;
  }

  export interface DieResult {
    type: string;
    sides: number;
    id: number;
    value: number;
    reason: 'rolled' | 'forced' | 'reroll' | 'remove' | string;
  }

  export interface RollResultSet {
    num: number;
    type: string;
    sides: number;
    rolls: DieResult[];
    total: number;
  }

  export interface RollResult {
    notation: string;
    sets: RollResultSet[];
    modifier: number;
    total: number;
  }

  export default class DiceBox {
    /**
     * @param container CSS selector for the element the canvas mounts into.
     *   Resolved synchronously via `document.querySelector` — the element
     *   must already exist in the DOM.
     */
    constructor(container: string, config?: Partial<DiceBoxConfig>);

    /** The three.js WebGLRenderer this instance owns; no built-in dispose(). */
    renderer: { dispose: () => void; domElement: HTMLCanvasElement };
    container: HTMLElement;
    initialized: boolean;

    initialize(): Promise<void>;
    /**
     * Notation string, e.g. `'2d20'` or `'1d20+1d6'`. Append `@v1,v2,...` to
     * force each die (in spawn order) to land on that value, e.g.
     * `'1d20+1d6@17,4'`.
     */
    roll(notation: string): Promise<RollResult>;
    reroll(diceIds: number[]): Promise<DieResult[]>;
    add(notation: string): Promise<DieResult[]>;
    remove(diceIds: number[]): Promise<DieResult[]>;
    /** Removes all dice from the scene. Safe to call before initialize(). */
    clearDice(): void;
    getDiceResults(diceId?: number): RollResult | DieResult;
    updateConfig(config: Partial<DiceBoxConfig>): Promise<void>;
    enableShadows(): void;
    disableShadows(): void;

    onRollComplete?: (results: RollResult) => void;
    onRerollComplete?: (results: DieResult[]) => void;
    onAddDiceComplete?: (results: DieResult[]) => void;
    onRemoveDiceComplete?: (results: DieResult[]) => void;
  }
}
