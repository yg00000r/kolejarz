/**
 * Train badge: label + background color + text color
 * Logic based on carrier code and commercial category symbol.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function baseCategory(cat: string): string {
  // "EC/EIC" → "EC", "EN/IC" → "EN", "IR/R" → "IR", "K7/K7P" → "K7"
  return cat.split('/')[0].trim();
}

// ── Badge label ───────────────────────────────────────────────────────────────

export function trainBadgeLabel(cat: string): string {
  const base = baseCategory(cat);
  if (base === 'EC' || cat.startsWith('EC/')) return 'EC';
  if (base === 'EN' || cat.startsWith('EN/')) return 'EN';
  // KM: RE1, RE2, RE21 → "RE"; R1, R2, R21 → "R"; RL → "RL"
  if (/^RE\d+$/.test(base)) return 'RE';
  if (/^R\d+$/.test(base)) return 'R';
  // SKM: S1–S40 → "S"
  if (/^S\d+$/.test(base)) return 'S';
  // K*, K*P: K2→"K2", K52→"K52" — keep as-is (already short)
  return base;
}

// ── Badge colors ──────────────────────────────────────────────────────────────

type BadgeStyle = { bg: string; text: string };

export function trainBadgeStyle(cat: string, carrier: string): BadgeStyle {
  const base = baseCategory(cat);

  // ── Per-carrier overrides ──────────────────────────────────────────────────

  // Arriva (AR) — turkusowy
  if (carrier === 'AR') return { bg: '#0D9488', text: '#fff' };

  // RegioJet — żółty
  if (carrier === 'RJ') return { bg: '#EAB308', text: '#1a1a1a' };

  // Leo Express — pomarańczowo-czarny
  if (carrier === 'Leo Express') return { bg: '#EA580C', text: '#fff' };

  // ŁKA — koralowy
  if (carrier === 'ŁKA') return { bg: '#F4511E', text: '#fff' };

  // SKM Trójmiasto — niebiesko-żółta → niebieski badge
  if (carrier === 'SKM') return { bg: '#1D4ED8', text: '#fff' };

  // SKM Warszawa — czerwono-czarna → ciemnoczerwony
  if (carrier === 'SKMT') return { bg: '#7F1D1D', text: '#fff' };

  // Koleje Dolnośląskie — żółty
  if (carrier === 'KD') return { bg: '#CA8A04', text: '#fff' };

  // Koleje Małopolskie (pod Polregio) — czerwony
  if (carrier === 'KMŁ') return { bg: '#DC2626', text: '#fff' };

  // Polregio (PR) — czerwony
  if (carrier === 'PR') return { bg: '#DC2626', text: '#fff' };

  // Koleje Wielkopolskie — biało-czerwony → jasnoczerwony
  if (carrier === 'KW') return { bg: '#EF4444', text: '#fff' };

  // Koleje Mazowieckie — zielony (ich kolor marki)
  if (carrier === 'KM') return { bg: '#15803D', text: '#fff' };

  // Koleje Śląskie — fioletowy (ich kolor marki)
  if (carrier === 'KS') return { bg: '#7C3AED', text: '#fff' };

  // ── IC categories ─────────────────────────────────────────────────────────

  if (cat === 'EIP') return { bg: '#1E3A5F', text: '#fff' };          // granatowy
  if (cat === 'EIC') return { bg: '#475569', text: '#fff' };          // srebrny/łupkowy
  if (cat.startsWith('EC')) return { bg: '#6B7280', text: '#fff' };   // szary → "EC"
  if (cat.startsWith('EN')) return { bg: '#1E3A5F', text: '#fff' };   // granatowy → "EN"
  if (['IC', 'IC+', 'IC/MP', 'MP', 'TLK'].includes(cat)) return { bg: '#EA580C', text: '#fff' }; // pomarańczowy

  // ── Fallback ───────────────────────────────────────────────────────────────
  return { bg: '#6B7280', text: '#fff' };
}
