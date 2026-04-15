/** Skeleton placeholder components for perceived-instant loading. */

export function SkeletonLine({ className = 'h-4 w-full' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-800 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3" role="status" aria-label="Loading">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-800" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-3 w-24" />
          <SkeletonLine className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border" role="status" aria-label="Loading table">
      <table className="w-full text-sm">
        <thead className="border-b bg-slate-50 dark:bg-slate-800/50">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <SkeletonLine className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <SkeletonLine className={`h-4 ${c === 0 ? 'w-32' : 'w-20'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
