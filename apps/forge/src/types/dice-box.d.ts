declare module '@3d-dice/dice-box' {
  export interface DiceBoxConfig {
    id?: string;
    container?: string;
    assetPath?: string;
    theme?: string;
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
    lightIntensity?: number;
  }

  export interface DiceRollResult {
    qty: number;
    sides: number;
    value: number;
    groupId: number;
    rollId: string;
    theme: string;
  }

  export interface RollOptions {
    values?: number[];
    theme?: string;
    newStartPoint?: boolean;
  }

  export default class DiceBox {
    // v1.1.x API - constructor with container and config
    constructor(container: string, config?: Partial<DiceBoxConfig>);
    // v1.2+ API - constructor with config only
    constructor(config: Partial<DiceBoxConfig>);

    init(): Promise<void>;

    roll(
      notation: string | string[],
      options?: RollOptions
    ): Promise<DiceRollResult[]>;

    clear(): void;

    updateConfig(config: Partial<DiceBoxConfig>): void;

    onRollComplete?: (results: DiceRollResult[]) => void;

    hide(): DiceBox;

    show(): DiceBox;
  }
}

declare module '@3d-dice/dice-parser-interface' {
  export interface ParsedRoll {
    notation: string;
    dice: Array<{
      qty: number;
      sides: number;
      modifier?: number;
    }>;
  }

  export interface RerollData {
    notation: string;
    condition: string;
  }

  export interface FinalResult {
    total: number;
    dice: DiceRollResult[];
    modifier?: number;
  }

  export default class DiceParser {
    parseNotation(notation: string): ParsedRoll;

    handleRerolls(results: DiceRollResult[]): RerollData[];

    parseFinalResults(results: DiceRollResult[]): FinalResult;
  }
}

declare module '@3d-dice/dice-ui/src/displayResults' {
  export interface DisplayResult {
    total: number;
    dice: Array<{
      value: number;
      sides: number;
      success?: boolean;
      critical?: boolean;
    }>;
  }

  export default class DisplayResults {
    constructor(container: string);

    showResults(results: DisplayResult | DisplayResult[]): void;

    clear(): void;
  }
}
