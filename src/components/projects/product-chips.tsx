type ChipProduct = { name: string; color: string };

/** Small colored pills showing the products a project uses. */
export function ProductChips({ products }: { products: ChipProduct[] }) {
  if (products.length === 0) {
    return <span className="text-xs text-muted">No products</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {products.map((p) => (
        <span
          key={p.name}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: p.color }}
        >
          {p.name}
        </span>
      ))}
    </div>
  );
}
