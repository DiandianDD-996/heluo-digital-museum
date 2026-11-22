// Render authored UI templates in one pass; inserted content is always literal.
export function formatGuideCopy(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (token, key: string) => Object.hasOwn(values, key) ? String(values[key]) : token)
}
