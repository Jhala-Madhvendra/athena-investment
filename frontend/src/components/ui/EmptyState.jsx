function EmptyState({ title = 'Nothing here yet', message, icon = '📄' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center">
      <div className="text-3xl" aria-hidden="true">{icon}</div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {message && <p className="max-w-sm text-sm text-slate-500">{message}</p>}
    </div>
  );
}

export default EmptyState;
