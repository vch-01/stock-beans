type Props = {
  message: string | null;
  onDismiss: () => void;
};

export function ErrorBanner(props: Props) {
  if (!props.message) return null;

  return (
    <div class="error-banner">
      <p class="error-banner-message">{props.message}</p>
      <button class="error-banner-dismiss" onClick={props.onDismiss} type="button">
        Dismiss
      </button>
    </div>
  );
}
