/**
 * Tiny templating helper.
 *
 * Replaces {{ dotted.path }} placeholders in a string against a
 * supplied context object. Missing keys render as 'unknown' so the
 * memo prompt can degrade gracefully when a metric is unavailable
 * (e.g. squareFeet when the listing parser couldn't extract it).
 *
 * Intentionally minimal. We do NOT need a full templating engine —
 * we own both the templates and the context.
 */

type Context = Record<string, unknown>;

const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function lookup(context: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (typeof acc !== "object") return undefined;
    return (acc as Context)[key];
  }, context);
}

export function renderTemplate(template: string, context: Context): string {
  return template.replace(PLACEHOLDER_RE, (_match, path) => {
    const value = lookup(context, path);
    if (value === null || value === undefined) return "unknown";
    if (typeof value === "number") {
      // Money/percent rendering: keep up to 2 decimals so "12.93" stays
      // "12.93" but trailing zeros disappear ("450000.00" -> "450000").
      return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");
    }
    return String(value);
  });
}
