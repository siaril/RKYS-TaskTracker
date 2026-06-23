export type ChipTag = { name: string; color: string };

/** Small colored tag labels. */
export function TagChips({ tags }: { tags: ChipTag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t.name}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: `${t.color}22`, color: t.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
          {t.name}
        </span>
      ))}
    </div>
  );
}
