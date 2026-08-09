import { AlertTriangle } from 'lucide-react';

function ErrorState({ title = 'Something went wrong', message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-critical/20 bg-critical/5 px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-critical/10 text-critical">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-critical">{title}</p>
      {message && <p className="max-w-sm text-sm text-ink-secondary">{message}</p>}
    </div>
  );
}

export default ErrorState;
