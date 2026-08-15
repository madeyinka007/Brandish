// Reserved, labelled advertising slot. No creative is wired yet, so it renders an empty
// fixed-height well with the mandatory "Advertisement" caption (reserved height ⇒ no layout
// shift when a unit later fills it). Not fake sponsor content — an honest placeholder.
export default function AdSlot({
  size = "leaderboard",
}: {
  size?: "leaderboard" | "banner";
}) {
  const height = size === "leaderboard" ? "h-[130px]" : "h-[90px]";
  const width = size === "banner" ? "w-full max-w-[728px]" : "w-full";
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex ${height} ${width} items-center justify-center border border-line bg-surface-alt text-[11px] uppercase tracking-[0.06em] text-ink-400`}
        role="complementary"
        aria-label="Advertisement"
      >
        Ad space
      </div>
      <span className="text-[11px] uppercase tracking-[0.06em] text-ink-400">Advertisement</span>
    </div>
  );
}
