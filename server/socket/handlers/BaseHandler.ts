import { SocketManager } from '../SocketManager.js';
import { DatabaseService } from '../../database.js';

export abstract class BaseHandler {
  constructor(
    protected socketManager: SocketManager,
    protected db: DatabaseService
  ) {
    this.setupListeners();
  }

  abstract setupListeners(): void;
}
