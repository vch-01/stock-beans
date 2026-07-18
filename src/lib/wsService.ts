import { getAlpacaKey, getAlpacaSecret } from './config';

type TradeCallback = (symbol: string, price: number, changePercent: number) => void;
type StatusCallback = (connected: boolean) => void;

interface TradeMessage {
  T: 't';
  S: string;
  p: number;
  s: number;
  t: string;
  c: string[];
  z: string;
}

interface AuthMessage {
  T: 'success' | 'error';
  msg: string;
}

type WsMessage = TradeMessage | AuthMessage | Record<string, unknown>;

export class StockWebSocket {
  private ws: WebSocket | null = null;
  private subscribers = new Set<TradeCallback>();
  private statusListeners = new Set<StatusCallback>();
  private subscribedSymbols = new Set<string>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private previousCloses = new Map<string, number>();

  private apiKey: string | undefined;
  private secretKey: string | undefined;
  private url: string;

  constructor() {
    this.apiKey = getAlpacaKey();
    this.secretKey = getAlpacaSecret();
    this.url = 'wss://stream.data.alpaca.markets/v2/iex';
  }

  setPreviousClose(symbol: string, close: number): void {
    this.previousCloses.set(symbol, close);
  }

  connect(): void {
    if (!this.apiKey || !this.secretKey) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.shouldReconnect = true;
    this.createConnection();
  }

  private createConnection(): void {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.authenticate();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const messages: WsMessage[] = JSON.parse(event.data);
        for (const msg of messages) {
          this.handleMessage(msg);
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.notifyStatus(false);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private authenticate(): void {
    this.send({
      action: 'auth',
      key: this.apiKey,
      secret: this.secretKey,
    });
  }

  private handleMessage(msg: WsMessage): void {
    if (msg.T === 'success') {
      this.notifyStatus(true);
      if (this.subscribedSymbols.size > 0) {
        this.sendSubscription();
      }
      return;
    }

    if (msg.T === 't') {
      const trade = msg as TradeMessage;
      const prevClose = this.previousCloses.get(trade.S);
      const changePercent =
        prevClose && prevClose > 0 ? ((trade.p - prevClose) / prevClose) * 100 : 0;

      for (const cb of this.subscribers) {
        cb(trade.S, trade.p, changePercent);
      }
    }
  }

  private sendSubscription(): void {
    this.send({
      action: 'subscribe',
      trades: [...this.subscribedSymbols],
    });
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.notifyStatus(false);
  }

  subscribe(symbols: string[]): void {
    for (const symbol of symbols) {
      this.subscribedSymbols.add(symbol);
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription();
    }
  }

  unsubscribe(symbols: string[]): void {
    for (const symbol of symbols) {
      this.subscribedSymbols.delete(symbol);
    }
    if (this.ws?.readyState === WebSocket.OPEN && symbols.length > 0) {
      this.send({
        action: 'unsubscribe',
        trades: symbols,
      });
    }
  }

  onTrade(callback: TradeCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatus(connected: boolean): void {
    for (const cb of this.statusListeners) {
      cb(connected);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
