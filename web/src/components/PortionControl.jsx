// Full → Empty control for bulk items (a bag of spinach, a bottle of milk).
const STEPS = [
  { v: 1, label: 'Full' },
  { v: 0.75, label: '¾' },
  { v: 0.5, label: '½' },
  { v: 0.25, label: '¼' },
  { v: 0, label: 'Empty' },
];

export default function PortionControl({ value, onChange }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-ink/15">
      {STEPS.map((s, i) => {
        const active = Math.abs(value - s.v) < 0.0001;
        return (
          <button
            key={s.v}
            onClick={() => onChange(s.v)}
            className={`px-2.5 py-1 text-xs font-semibold transition ${
              i > 0 ? 'border-l border-ink/10' : ''
            } ${active ? 'bg-accent text-white' : 'bg-white text-ink/70'}`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
