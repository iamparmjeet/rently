import { createDb } from "..";
import { betaAccessCodes } from "../schema";
import { generatedId } from "../utils/id";

const argv = process.argv.slice(2);

function getArg(flag: string, fallback: string): string {
	const i = argv.indexOf(flag);
	return i !== -1 && argv[i + 1] ? (argv[i + 1] as string) : fallback;
}

const count = Number.parseInt(getArg("--count", "5"), 10);
const planSlug = getArg("--plan", "pro");
const days = Number.parseInt(getArg("--days", "365"), 10);
const maxUses = Number.parseInt(getArg("--max-uses", "1"), 10);
const prefix = getArg("--prefix", "KEYHQ");

// Code Generator
function makeCode(): string {
	const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
	return `${prefix}-${seg()}-${seg()}`;
}

async function main() {
	const db = createDb();

	console.log("─────────────────────────────────────────");
	console.log("  KeyHQ Beta Code Generator");
	console.log("─────────────────────────────────────────");
	console.log(`  Plan      : ${planSlug}`);
	console.log(`  Period    : ${days} days`);
	console.log(`  Max uses  : ${maxUses}`);
	console.log(`  Count     : ${count}`);
	console.log(`  Prefix    : ${prefix}`);
	console.log("─────────────────────────────────────────\n");

	const generated: string[] = [];

	for (let i = 0; i < count; i++) {
		// WHY retry: extremely rare collision on the unique code column
		let code = makeCode();
		let inserted = false;
		let attempts = 0;

		while (!inserted && attempts < 5) {
			try {
				await db.insert(betaAccessCodes).values({
					id: generatedId(),
					code,
					grantsPlanSlug: planSlug,
					periodDays: days,
					maxUses,
				});
				inserted = true;
			} catch {
				// Likely a unique constraint violation — regenerate
				code = makeCode();
				attempts++;
			}
		}

		if (!inserted) {
			console.error(`  ✗  Failed to insert code after ${attempts} attempts.`);
			continue;
		}

		generated.push(code);
		console.log(`  ✓  ${code}`);
	}

	console.log(`\n  ${generated.length}/${count} code(s) inserted.\n`);
	process.exit(0);
}

main().catch((err) => {
	console.error("\nFailed:", err.message);
	process.exit(1);
});
