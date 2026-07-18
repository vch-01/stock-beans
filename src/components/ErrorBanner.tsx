type Props = {
  message: string | null;
  onDismiss: () => void;
};

export function ErrorBanner({ message, onDismiss }: Props) {
  if (!message) return null;

  return (
    <div className="error-banner">
      <p className="error-banner-message">{message}</p>
      <button className="error-banner-dismiss" onClick={onDismiss} type="button">
        Dismiss
      </button>
    </div>
  );
}
