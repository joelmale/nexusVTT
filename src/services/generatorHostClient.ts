import type { GeneratorHostMessage, } from '../../shared/generator/protocol';

export class GeneratorHostClient {
  private targetWindow: Window | null = null;
  private targetOrigin: string;
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(targetOrigin: string) {
    this.targetOrigin = targetOrigin;
  }

  connect(targetWindow: Window) {
    this.targetWindow = targetWindow;
    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageHandler);
  }

  disconnect() {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.targetWindow = null;
  }

  private handleMessage(event: MessageEvent) {
    if (event.origin !== this.targetOrigin) {
      return;
    }
    const message = event.data as GeneratorHostMessage;
    
    // Implement message handling logic here
    console.log('[Host] Received message from generator:', message);
  }

  sendMessage(message: GeneratorHostMessage) {
    if (!this.targetWindow) {
      console.warn('[Host] Cannot send message: not connected to generator window');
      return;
    }
    this.targetWindow.postMessage(message, this.targetOrigin);
  }
}
