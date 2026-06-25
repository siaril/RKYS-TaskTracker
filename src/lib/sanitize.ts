import sanitizeHtml from "sanitize-html";

// Shared sanitizer for user-authored rich text (task descriptions + comments).
// Strips scripts/onerror/javascript: while keeping basic formatting, images, and
// links (including our relative /api/files attachment links).
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
    "h1", "h2", "h3", "blockquote", "code", "pre", "img", "span",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"],
    // @-mention chips: <span class="mention" data-type="mention" data-id data-label>
    span: ["class", "data-type", "data-id", "data-label"],
  },
  // Only allow our mention class on spans (no arbitrary styling injection).
  allowedClasses: { span: ["mention"] },
  // Links: only safe schemes (relative /api/files links have no scheme → allowed).
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

export function cleanHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTS);
}

/** True if the sanitized HTML has visible content (text, an image, or a link). */
export function hasHtmlContent(cleaned: string): boolean {
  if (/<img\b/i.test(cleaned) || /<a\b/i.test(cleaned)) return true;
  return sanitizeHtml(cleaned, { allowedTags: [], allowedAttributes: {} }).trim().length > 0;
}
