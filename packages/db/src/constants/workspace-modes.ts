/**
 * Identity and workspace state are intentionally separate. A registered owner
 * stays a standard account while exploring their disposable sample data.
 */
export const ACCOUNT_MODES = {
	STANDARD: "standard",
	PUBLIC_DEMO: "public_demo",
	SAMPLE_IDENTITY: "sample_identity",
} as const;

export type AccountMode = (typeof ACCOUNT_MODES)[keyof typeof ACCOUNT_MODES];
export const ACCOUNT_MODE_VALUES = Object.values(ACCOUNT_MODES) as [
	AccountMode,
	...AccountMode[],
];

export const WORKSPACE_MODES = {
	LIVE: "live",
	SAMPLE: "sample",
} as const;

export type WorkspaceMode =
	(typeof WORKSPACE_MODES)[keyof typeof WORKSPACE_MODES];
export const WORKSPACE_MODE_VALUES = Object.values(WORKSPACE_MODES) as [
	WorkspaceMode,
	...WorkspaceMode[],
];
