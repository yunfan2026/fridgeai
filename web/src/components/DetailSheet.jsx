// Slide-up sheet listing the rows behind a tapped stat.
// rows: [{ left, right, tone? }]
export default function DetailSheet({ title, subtitle, rows, emptyText, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[75vh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-shell p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/20" />
        <div className="mb-3">
          <h2 className="text-xl font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-ink/50">{subtitle}</p>}
        </div>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-ink/50">{emptyText}</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2.5 text-sm shadow-card"
              >
                <span className="min-w-0 truncate">{r.left}</span>
                <span
                  className={`shrink-0 pl-3 text-xs font-medium ${
                    r.tone === 'danger'
                      ? 'text-danger'
                      : r.tone === 'warn'
                        ? 'text-[#8a5a00]'
                        : 'text-ink/50'
                  }`}
                >
                  {r.right}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
