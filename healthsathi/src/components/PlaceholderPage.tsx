interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-navy">{title}</h2>
      {description && (
        <p className="text-slate-600 text-sm max-w-2xl">{description}</p>
      )}
      <div className="mt-8 p-8 border border-slate-200 rounded-lg bg-slate-50 shadow-soft">
        <p className="text-slate-500 text-sm">
          This module is under development. Content will be available soon.
        </p>
      </div>
    </div>
  );
}
