function ErrorState({ title = 'Something went wrong', message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-critical/20 bg-critical/5 px-6 py-16 text-center">
      <div className="text-3xl" aria-hidden="true">⚠️</div>
      <p className="text-sm font-semibold text-critical">{title}</p>
      {message && <p className="max-w-sm text-sm text-slate-600">{message}</p>}
    </div>
  );
}

export default ErrorState;
