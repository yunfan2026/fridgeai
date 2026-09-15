import { useState } from 'react';
import PortionControl from './PortionControl.jsx';
import { expiryLabel, expiryTone, TONE_CLASSES } from '../lib/expiry.js';
import { isAlcohol } from '../lib/alcohol.js';

// One inventory item. Consumption model:
//  • every card: one-tap "Used up" (whole item) with Undo handled by the parent
//  • count items: −/+ stepper
//  • portion items: Full→Empty control
//  • overflow: "Threw away" (waste), for the food-waste stat
export default function ItemCard({ item, onUsedUp, onThrewAway, onStep, onSetPortion }) {
  const [showThrow, setShowThrow] = useState(false);
  const tone = expiryTone(item.expires_at);
  const alcohol = isAlcohol(item);

  return (
    <div className="rounded-xl bg-white p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{item.name}</span>
            {alcohol && <span title="alcohol" className="text-xs">🍷</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {!alcohol && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
                {expiryLabel(item.expires_at)}
              </span>
            )}
            <span className="text-xs text-ink/50">
              {item.tracking_type === 'portion'
                ? `${Math.round(item.portion_remaining * 100)}% left`
                : `× ${item.quantity}${item.unit ? ' ' + item.unit : ''}`}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onUsedUp}
            className="rounded-lg bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent transition active:scale-95"
            title="Used it up"
          >
            ✓ Used up
          </button>
          <button
            onClick={() => setShowThrow((s) => !s)}
            className="rounded-lg px-1.5 py-1.5 text-ink/40 transition hover:text-ink"
            title="More"
          >
            ⋯
          </button>
        </div>
      </div>

      {/* Granular consumption controls */}
      <div className="mt-2.5 flex items-center justify-between">
        {item.tracking_type === 'portion' ? (
          <PortionControl value={item.portion_remaining} onChange={onSetPortion} />
        ) : (
          <div className="flex items-center overflow-hidden rounded-lg border border-ink/15">
            <button
              onClick={() => onStep(-1)}
              className="px-3 py-1 text-lg leading-none text-ink/70 transition active:bg-ink/5"
            >
              −
            </button>
            <span className="min-w-[2rem] border-x border-ink/10 px-2 py-1 text-center text-sm font-medium">
              {item.quantity}
            </span>
            <button
              onClick={() => onStep(1)}
              className="px-3 py-1 text-lg leading-none text-ink/70 transition active:bg-ink/5"
            >
              +
            </button>
          </div>
        )}

        {showThrow && (
          <button
            onClick={() => {
              setShowThrow(false);
              onThrewAway();
            }}
            className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger"
          >
            🗑 Threw away
          </button>
        )}
      </div>
    </div>
  );
}
