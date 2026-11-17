// Shown instantly on navigation while the next page loads.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="h-6 w-64 rounded bg-slate-200" />
      </div>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="h-12 border-b border-slate-100" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 border-b border-slate-100 px-4 py-3.5">
            <div className="h-3 w-1/5 rounded bg-slate-100" />
            <div className="h-3 w-1/4 rounded bg-slate-100" />
            <div className="h-3 w-1/6 rounded bg-slate-100" />
            <div className="ml-auto h-3 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
