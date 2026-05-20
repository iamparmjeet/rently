import { uuidv7 } from "uuidv7";

/**
 * Application-generated UUIDv7
 * - Sequential: always greater than any previously generated ID
 * - Time-ordered: first 48 bits = Unix ms timestamp
 * - Unique: remaining 74 bits = random
 * - B-tree friendly: inserts go to rightmost leaf page
 */
export const generatedId = () => uuidv7();

export const getIdTimestamp = (id: string): Date => {
	// First 12 hex chars (48 bits) = Unix timestamp in ms
	const tsMsHex = id.replace(/-/g, "").slice(0, 12);
	const tsMS = Number.parseInt(tsMsHex, 16);
	return new Date(tsMS);
};
