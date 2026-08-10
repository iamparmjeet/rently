/**
 * Human-friendly entity reference for places where names can be duplicated.
 * Keep the full UUID in the form value; only the short suffix is displayed.
 */
export function entityLabel(name: string, id: string): string {
	return `${name} · ID-${id.slice(-6).toUpperCase()}`;
}
