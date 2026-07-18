import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { StockWebSocket } from './wsService';

vi.mock('./config', () => ({
  getAlpacaKey: () => 'test-key',
  getAlpacaSecret: () => 'test-secret',
}));

function createMockWs() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  return {
    readyState: 0,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    set onopen(fn: unknown) {
      listeners['open'] = [fn as () => void];
    },
    set onclose(fn: unknown) {
      listeners['close'] = [fn as () => void];
    },
    set onmessage(fn: unknown) {
      listeners['message'] = [fn as (e: MessageEvent) => void];
    },
    set onerror(fn: unknown) {
      listeners['error'] = [fn as () => void];
    },
    get onopen() { return listeners['open']?.[0]; },
    get onclose() { return listeners['close']?.[0]; },
    get onmessage() { return listeners['message']?.[0]; },
    get onerror() { return listeners['error']?.[0]; },
    trigger(event: string, data?: unknown) {
      if (event === 'open' && listeners['open']?.[0]) listeners['open'][0]();
      if (event === 'close' && listeners['close']?.[0]) listeners['close'][0]();
      if (event === 'message' && listeners['message']?.[0]) {
        listeners['message'][0]({ data: JSON.stringify(data) } as unknown as MessageEvent);
      }
      if (event === 'error' && listeners['error']?.[0]) listeners['error'][0]();
    },
    _listeners: listeners,
  };
}

let mockWsInstance: ReturnType<typeof createMockWs>;

function setupMockWebSocket() {
  mockWsInstance = createMockWs();
  const MockWebSocket = vi.fn().mockImplementation(() => {
    mockWsInstance.readyState = 1;
    return mockWsInstance;
  });
  Object.assign(MockWebSocket, {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  });
  globalThis.WebSocket = MockWebSocket as unknown as typeof globalThis.WebSocket;
}

describe('StockWebSocket', () => {
  let ws: StockWebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    setupMockWebSocket();
    ws = new StockWebSocket();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a WebSocket connection on connect()', () => {
    ws.connect();
    expect(globalThis.WebSocket).toHaveBeenCalledWith(
      'wss://stream.data.alpaca.markets/v2/iex',
    );
  });

  it('does not create duplicate connections when already open', () => {
    ws.connect();
    ws.connect();
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(1);
  });

  it('sends auth on open', () => {
    ws.connect();
    mockWsInstance.trigger('open');
    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ action: 'auth', key: 'test-key', secret: 'test-secret' }),
    );
  });

  it('notifies connected status on auth success', () => {
    const statusCb = vi.fn();
    ws.onStatusChange(statusCb);
    ws.connect();
    mockWsInstance.trigger('message', [{ T: 'success', msg: 'connected' }]);
    expect(statusCb).toHaveBeenCalledWith(true);
  });

  it('resubscribes after auth success', () => {
    ws.connect();
    ws.subscribe(['AAPL']);
    mockWsInstance.trigger('message', [{ T: 'success', msg: 'connected' }]);
    expect(mockWsInstance.send).toHaveBeenLastCalledWith(
      JSON.stringify({ action: 'subscribe', trades: ['AAPL'] }),
    );
  });

  it('notifies trade subscribers with price and change percent', () => {
    const tradeCb = vi.fn();
    ws.onTrade(tradeCb);
    ws.setPreviousClose('AAPL', 100);
    ws.connect();
    mockWsInstance.trigger('message', [
      { T: 't', S: 'AAPL', p: 110, s: 10, t: '2024-01-01', c: [], z: 'C' },
    ]);
    expect(tradeCb).toHaveBeenCalledWith('AAPL', 110, 10);
  });

  it('calculates changePercent as 0 when no previous close', () => {
    const tradeCb = vi.fn();
    ws.onTrade(tradeCb);
    ws.connect();
    mockWsInstance.trigger('message', [
      { T: 't', S: 'AAPL', p: 110, s: 10, t: '2024-01-01', c: [], z: 'C' },
    ]);
    expect(tradeCb).toHaveBeenCalledWith('AAPL', 110, 0);
  });

  it('ignores malformed messages silently', () => {
    const tradeCb = vi.fn();
    ws.onTrade(tradeCb);
    ws.connect();
    expect(() => {
      mockWsInstance.trigger('message', 'not json');
    }).not.toThrow();
    expect(tradeCb).not.toHaveBeenCalled();
  });

  it('schedules reconnect on close when shouldReconnect is true', () => {
    ws.connect();
    mockWsInstance.trigger('close');
    vi.advanceTimersByTime(1000);
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(2);
  });

  it('progressively increases reconnect delay', () => {
    ws.connect();
    // First close → delay = min(1000 * 2^0, 30000) = 1000
    mockWsInstance.trigger('close');
    vi.advanceTimersByTime(999);
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(2);

    // Second close → delay = min(1000 * 2^1, 30000) = 2000
    mockWsInstance.trigger('close');
    vi.advanceTimersByTime(1999);
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(3);
  });

  it('caps reconnect delay at 30 seconds', () => {
    ws.connect();
    // After 5 reconnects, delay = min(1000 * 2^5, 30000) = min(32000, 30000) = 30000
    for (let i = 0; i < 5; i++) {
      mockWsInstance.trigger('close');
      vi.advanceTimersByTime(31000);
    }
    // Next attempt should still be capped at 30000
    mockWsInstance.trigger('close');
    vi.advanceTimersByTime(29999);
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(6);
    vi.advanceTimersByTime(1);
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(7);
  });

  it('does not reconnect after disconnect()', () => {
    ws.connect();
    ws.disconnect();
    mockWsInstance.trigger('close');
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(1);
  });

  it('notifies disconnected status on close', () => {
    const statusCb = vi.fn();
    ws.onStatusChange(statusCb);
    ws.connect();
    mockWsInstance.trigger('close');
    expect(statusCb).toHaveBeenCalledWith(false);
  });

  it('calls ws.close() on error', () => {
    ws.connect();
    mockWsInstance.trigger('error');
    expect(mockWsInstance.close).toHaveBeenCalled();
  });

  it('subscribe adds symbols and sends when open', () => {
    ws.connect();
    ws.subscribe(['AAPL', 'TSLA']);
    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ action: 'subscribe', trades: ['AAPL', 'TSLA'] }),
    );
  });

  it('unsubscribe removes symbols', () => {
    ws.connect();
    ws.subscribe(['AAPL', 'TSLA']);
    ws.unsubscribe(['AAPL']);
    expect(mockWsInstance.send).toHaveBeenLastCalledWith(
      JSON.stringify({ action: 'unsubscribe', trades: ['AAPL'] }),
    );
  });

  it('onTrade returns an unsubscribe function', () => {
    const cb = vi.fn();
    const unsub = ws.onTrade(cb);
    unsub();
    ws.connect();
    mockWsInstance.trigger('message', [
      { T: 't', S: 'AAPL', p: 110, s: 10, t: '2024-01-01', c: [], z: 'C' },
    ]);
    expect(cb).not.toHaveBeenCalled();
  });

  it('disconnect clears reconnect timer and nullifies onclose', () => {
    ws.connect();
    ws.disconnect();
    expect(mockWsInstance.close).toHaveBeenCalled();
    expect(mockWsInstance.onclose).toBeNull();
  });

  it('isConnected returns true when socket is open', () => {
    ws.connect();
    expect(ws.isConnected()).toBe(true);
  });
});
