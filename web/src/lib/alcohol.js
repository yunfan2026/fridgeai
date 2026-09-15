// Detect alcoholic items so they can be marked (🍷) and skip expiry nudging.
// Uses the stored `alcohol` flag when present, and falls back to name keywords
// so items saved before flagging (and anything the model misses) still register.
// Word-boundary matching avoids false hits like "kale" (ale) or "ginger" (gin).
const ALCOHOL_WORDS = [
  'wine', 'beer', 'soju', 'sake', 'vodka', 'whisky', 'whiskey', 'tequila', 'rum',
  'gin', 'brandy', 'cognac', 'liqueur', 'champagne', 'prosecco', 'ale', 'lager',
  'stout', 'bourbon', 'sangria', 'vermouth', 'baijiu', 'makgeolli', 'cocktail',
  'seltzer', 'chamisul', 'cabernet', 'sauvignon', 'merlot', 'chardonnay', 'ipa',
];
const ALCOHOL_RE = new RegExp(`\\b(${ALCOHOL_WORDS.join('|')})\\b`, 'i');

export function isAlcohol(item) {
  if (item?.flags?.includes('alcohol')) return true;
  return ALCOHOL_RE.test(item?.name || '');
}

export function nameIsAlcohol(name) {
  return ALCOHOL_RE.test(name || '');
}
