import type { WebSocketMessage } from './game';

export interface WebSocketCustomEvent extends Event {
  detail?: {
    type: string;
    data: WebSocketMessage['data'];
  };
}
