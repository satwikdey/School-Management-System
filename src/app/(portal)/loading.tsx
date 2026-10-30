export default function PortalLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-64 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-white border border-slate-200 p-5" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-white border border-slate-200 p-5" />
    </div>
  );
}
