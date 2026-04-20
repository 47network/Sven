/** Empty state placeholder for tables / lists with zero rows. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800/60 ring-1 ring-slate-700">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
