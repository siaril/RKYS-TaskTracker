// Pull the user ids of @-mentions out of saved rich-text HTML. Mention chips are
// <span data-type="mention" data-id="<userId>" …> (attribute order may vary, so we
// scan each span tag). Returns unique ids.
export function extractMentionIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  const spanTag = /<span\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = spanTag.exec(html)) !== null) {
    const tag = m[0];
    if (/data-type="mention"/.test(tag)) {
      const id = tag.match(/data-id="([^"]+)"/);
      if (id) ids.add(id[1]);
    }
  }
  return [...ids];
}
