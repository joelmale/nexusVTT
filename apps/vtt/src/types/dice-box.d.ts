declare module '@3d-dice/dice-box' {
  export interface DiceBoxConfig {
    id?: string;
    assetPath: string;
    container?: string;
    theme?: string;
    themeColor?: string;
    preloadThemes?: string[];
    externalThemes?: Record<string, string>;
    offscreen?: boolean;
    scale?: number;
    gravity?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
    spinForce?: number;
    throwForce?: number;
    startingHeight?: number;
    settleTimeout?: number;
    delay?: number;
    enableShadows?: boolean;
    shadowTransparency?: number;
    lightIntensity?: number;
    suspendSimulation?: boolean;
    origin?: string;
  }

  export interface RollResult {
    rolls: Array<{
      qty: number;
      sides: number;
      value: number;
      groupId: number;
      rollId: number;
      type: string;
    }>;
    value: number;
  }

  export interface RollOptions {
    values?: number[];
    theme?: string;
    themeColor?: string;
    newStartPoint?: boolean;
  }

  export default class DiceBox {
    constructor(config: Partial<DiceBoxConfig>);

    config: DiceBoxConfig;

    init(): Promise<void>;
    roll(
      notation: string | string[],
      options?: RollOptions,
    ): Promise<RollResult>;
    add(
      notation: string | string[],
      options?: RollOptions,
    ): Promise<RollResult>;
    clear(): void;
    hide(): void;
    show(): void;
    updateConfig(config: Partial<DiceBoxConfig>): void;

    // Callbacks
    onBeforeRoll?: (notation: unknown) => void;
    onRollComplete?: (results: RollResult) => void;
    onDieComplete?: (result: RollResult['rolls'][0]) => void;
    onRemoveComplete?: () => void;
    onThemeConfigLoaded?: (themeData: unknown) => void;
    onThemeLoaded?: (theme: string) => void;
  }
}
