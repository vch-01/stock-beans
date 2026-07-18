type Props = {
  connected: boolean;
};

export function ConnectionIndicator({ connected }: Props) {
  return (
    <span
      className="connection-indicator"
      title={connected ? 'Live updates active' : 'No live connection'}
    >
      <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
      <span className="connection-label">{connected ? 'Live' : 'Offline'}</span>
    </span>
  );
}
