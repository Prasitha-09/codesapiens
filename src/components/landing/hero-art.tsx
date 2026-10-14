/**
 * Decorative hero composition: geometric blocks, a coin and stickers.
 * Purely visual (aria-hidden) — it contains no data.
 */
export function HeroArt() {
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[26rem] select-none">
      {/* back slab */}
      <div className="absolute right-0 top-6 h-[72%] w-[72%] border-[3px] border-ink bg-surface shadow-brutal-lg" />
      <div className="bg-lines absolute right-0 top-6 h-[72%] w-[72%]" />

      {/* lime block with code glyph */}
      <div className="absolute left-0 top-0 flex h-[54%] w-[54%] -rotate-3 items-center justify-center border-[3px] border-ink bg-mint shadow-brutal-lg">
        <span className="font-display text-[5.5rem] leading-none text-on-accent sm:text-[7rem]">{"</>"}</span>
      </div>

      {/* coin */}
      <div className="absolute bottom-[6%] left-[14%] flex size-[38%] items-center justify-center rounded-full border-[3px] border-ink bg-sun shadow-brutal">
        <div className="flex size-[74%] items-center justify-center rounded-full border-[3px] border-dashed border-on-accent">
          <span className="font-display text-4xl text-on-accent sm:text-5xl">CS</span>
        </div>
      </div>

      {/* bars: a tiny "leaderboard" glyph */}
      <div className="absolute bottom-[14%] right-[6%] flex h-[30%] items-end gap-2">
        <span className="h-[55%] w-6 border-[3px] border-ink bg-pink sm:w-8" />
        <span className="h-full w-6 border-[3px] border-ink bg-mint sm:w-8" />
        <span className="h-[38%] w-6 border-[3px] border-ink bg-sky sm:w-8" />
      </div>

      {/* stickers */}
      <span className="absolute right-[2%] top-0 rotate-6 border-[3px] border-ink bg-pink px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-on-accent shadow-brutal-sm">
        Ranked live
      </span>
      <span className="absolute left-[46%] top-[46%] -rotate-6 border-[3px] border-ink bg-sky px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-on-accent shadow-brutal-sm">
        +coins on approval
      </span>
    </div>
  );
}
