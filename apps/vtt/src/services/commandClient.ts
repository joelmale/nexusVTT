import type {
  DomainCommand,
  DomainCommandReceipt,
  DefinitionRef,
} from '@nexus/game-contracts';
import { useCharacterStore } from '@/stores/characterStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useGameStore } from '@/stores/gameStore';

export interface CommandExecutionResult {
  success: boolean;
  duplicate?: boolean;
  receipt?: DomainCommandReceipt;
  error?: string;
}

export class DomainCommandClient {
  private baseUrl = '/api';

  /**
   * Dispatch an ApplyDamage command to the server and synchronize UI stores
   */
  async applyDamage(
    campaignId: string,
    targetActorId: string,
    amount: number,
    options: {
      damageType?: string;
      sourceDescription?: string;
      expectedVersion?: number;
      issuerUserId?: string;
    } = {},
  ): Promise<CommandExecutionResult> {
    const { user } = useGameStore.getState();
    const commandId = crypto.randomUUID();
    const issuerUserId = options.issuerUserId || user?.id || 'anonymous';

    const command: DomainCommand = {
      commandId,
      protocolVersion: '1.0',
      campaignId,
      issuerUserId,
      timestamp: new Date().toISOString(),
      expectedActorVersions:
        options.expectedVersion !== undefined
          ? { [targetActorId]: options.expectedVersion }
          : {},
      payload: {
        type: 'ApplyDamage',
        targetActorId,
        amount,
        damageType: options.damageType || 'untyped',
        sourceDescription: options.sourceDescription,
      },
    };

    return this.dispatchCommand(campaignId, command);
  }

  /**
   * Dispatch a HealActor command to the server and synchronize UI stores
   */
  async healActor(
    campaignId: string,
    targetActorId: string,
    amount: number,
    options: {
      sourceDescription?: string;
      expectedVersion?: number;
      issuerUserId?: string;
    } = {},
  ): Promise<CommandExecutionResult> {
    const { user } = useGameStore.getState();
    const commandId = crypto.randomUUID();
    const issuerUserId = options.issuerUserId || user?.id || 'anonymous';

    const command: DomainCommand = {
      commandId,
      protocolVersion: '1.0',
      campaignId,
      issuerUserId,
      timestamp: new Date().toISOString(),
      expectedActorVersions:
        options.expectedVersion !== undefined
          ? { [targetActorId]: options.expectedVersion }
          : {},
      payload: {
        type: 'HealActor',
        targetActorId,
        amount,
        sourceDescription: options.sourceDescription,
      },
    };

    return this.dispatchCommand(campaignId, command);
  }

  /**
   * Admit a character into canonical campaign actors
   */
  async admitCharacter(
    campaignId: string,
    characterDefinitionRef: DefinitionRef,
    initialControllerUserIds: string[] = [],
  ): Promise<CommandExecutionResult> {
    const { user } = useGameStore.getState();
    const commandId = crypto.randomUUID();
    const issuerUserId = user?.id || 'anonymous';

    const command: DomainCommand = {
      commandId,
      protocolVersion: '1.0',
      campaignId,
      issuerUserId,
      timestamp: new Date().toISOString(),
      expectedActorVersions: {},
      payload: {
        type: 'AdmitCharacter',
        characterDefinitionRef,
        initialControllerUserIds,
      },
    };

    return this.dispatchCommand(campaignId, command);
  }

  /**
   * Deploy an encounter onto a scene with isolated multi-copy creature actors
   */
  async deployEncounter(
    campaignId: string,
    templateRef: DefinitionRef,
    sceneId: string,
    anchorPosition: { x: number; y: number },
    hiddenFromPlayers = false,
  ): Promise<CommandExecutionResult> {
    const { user } = useGameStore.getState();
    const commandId = crypto.randomUUID();
    const issuerUserId = user?.id || 'anonymous';

    const command: DomainCommand = {
      commandId,
      protocolVersion: '1.0',
      campaignId,
      issuerUserId,
      timestamp: new Date().toISOString(),
      expectedActorVersions: {},
      payload: {
        type: 'DeployEncounter',
        templateRef,
        sceneId,
        anchorPosition,
        hiddenFromPlayers,
      },
    };

    return this.dispatchCommand(campaignId, command);
  }

  /**
   * Start combat for an encounter run and roll initiatives
   */
  async startEncounter(
    campaignId: string,
    encounterRunId: string,
  ): Promise<CommandExecutionResult> {
    const { user } = useGameStore.getState();
    const commandId = crypto.randomUUID();
    const issuerUserId = user?.id || 'anonymous';

    const command: DomainCommand = {
      commandId,
      protocolVersion: '1.0',
      campaignId,
      issuerUserId,
      timestamp: new Date().toISOString(),
      expectedActorVersions: {},
      payload: {
        type: 'StartEncounter',
        encounterRunId,
      },
    };

    return this.dispatchCommand(campaignId, command);
  }

  /**
   * Advance the active turn or round in a combat encounter
   */
  async advanceCombatTurn(
    campaignId: string,
    encounterRunId: string,
  ): Promise<CommandExecutionResult> {
    const { user } = useGameStore.getState();
    const commandId = crypto.randomUUID();
    const issuerUserId = user?.id || 'anonymous';

    const command: DomainCommand = {
      commandId,
      protocolVersion: '1.0',
      campaignId,
      issuerUserId,
      timestamp: new Date().toISOString(),
      expectedActorVersions: {},
      payload: {
        type: 'AdvanceCombatTurn',
        encounterRunId,
      },
    };

    return this.dispatchCommand(campaignId, command);
  }

  /**
   * Post command envelope to the server and coordinate local projection updates
   */
  private async dispatchCommand(
    campaignId: string,
    command: DomainCommand,
  ): Promise<CommandExecutionResult> {
    try {
      const response = await fetch(`${this.baseUrl}/campaigns/${campaignId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Command execution rejected',
          receipt: data.receipt,
        };
      }

      const receipt = data.receipt as DomainCommandReceipt;

      // Synchronize local UI state across character, initiative, and tokens
      this.syncStoresFromReceipt(command, receipt);

      // Notify window listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('nexus-domain-command-executed', { detail: receipt }),
        );
      }

      return {
        success: true,
        duplicate: data.duplicate,
        receipt,
      };
    } catch (error) {
      console.error('Failed to dispatch domain command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error dispatching command',
      };
    }
  }

  /**
   * Update client stores from the committed domain command result
   */
  private syncStoresFromReceipt(
    command: DomainCommand,
    receipt: DomainCommandReceipt,
  ): void {
    if (!receipt.result.success) return;

    if (command.payload.type === 'ApplyDamage' || command.payload.type === 'HealActor') {
      const targetActorId = command.payload.targetActorId;

      // 1. Update Character Store
      const charStore = useCharacterStore.getState();
      const character = charStore.characters.find(
        (c) => c.id === targetActorId,
      );

      let currentHp = character ? character.hitPoints : 10;
      let tempHp = character?.temporaryHitPoints || 0;
      const maxHp = character?.maxHitPoints ?? currentHp;

      if (command.payload.type === 'ApplyDamage') {
        const damage = command.payload.amount;
        if (tempHp > 0) {
          const absorbed = Math.min(tempHp, damage);
          tempHp -= absorbed;
          const remaining = damage - absorbed;
          currentHp = Math.max(0, currentHp - remaining);
        } else {
          currentHp = Math.max(0, currentHp - damage);
        }
      } else if (command.payload.type === 'HealActor') {
        currentHp = Math.min(maxHp, currentHp + command.payload.amount);
      }

      if (character) {
        charStore.updateCharacterHP(character.id, currentHp, tempHp);
      }

      // 2. Update Initiative Store if entry exists
      const initStore = useInitiativeStore.getState();
      const entry = initStore.entries.find(
        (e) => e.characterId === targetActorId || e.id === targetActorId,
      );
      if (entry) {
        initStore.setHP(entry.id, currentHp);
        initStore.addTempHP(entry.id, tempHp - entry.tempHP);
      }

      // 3. Update Placed Tokens on Canvas
      const gameStore = useGameStore.getState();
      const { sceneState } = gameStore;
      const activeScene = sceneState.scenes.find((s) => s.id === sceneState.activeSceneId);
      if (activeScene && activeScene.placedTokens) {
        const token = activeScene.placedTokens.find(
          (t) => t.characterId === targetActorId,
        );
        if (token) {
          gameStore.updateToken(activeScene.id, token.id, {
            currentStats: {
              ...token.currentStats,
              hp: currentHp,
            },
          });
        }
      }
    }
  }
}

export const commandClient = new DomainCommandClient();
