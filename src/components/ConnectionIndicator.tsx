type Props = {
  connected: boolean;
};

export function ConnectionIndicator(props: Props) {
  return (
    <span
      class="connection-indicator"
      title={props.connected ? 'Live updates active' : 'No live connection'}
    >
      <span class={`connection-dot ${props.connected ? 'connected' : 'disconnected'}`} />
      <span class="connection-label">{props.connected ? 'Live' : 'Offline'}</span>
    </span>
  );
}
