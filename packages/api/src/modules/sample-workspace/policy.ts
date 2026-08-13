import { ORPCError } from "@orpc/server";
import {
	ACCOUNT_MODES,
	WORKSPACE_MODES,
} from "@rently/db/constants/workspace-modes";

export type WorkspaceCapabilities = {
	outboundCommunication: boolean;
	privateDocuments: boolean;
	accountManagement: boolean;
	billingManagement: boolean;
};

type ExperienceUser = {
	accountMode?: string | null;
	workspaceMode?: string | null;
	role?: string | null;
};

export function workspaceCapabilities(
	user: ExperienceUser,
): WorkspaceCapabilities {
	const isPublicDemo = user.accountMode === ACCOUNT_MODES.PUBLIC_DEMO;
	const isSample = user.workspaceMode === WORKSPACE_MODES.SAMPLE;
	return {
		outboundCommunication: !isPublicDemo && !isSample,
		privateDocuments: !isPublicDemo && !isSample,
		accountManagement: !isPublicDemo,
		billingManagement: !isPublicDemo,
	};
}

export function isNonLiveWorkspace(user: ExperienceUser): boolean {
	return (
		user.accountMode === ACCOUNT_MODES.PUBLIC_DEMO ||
		user.workspaceMode === WORKSPACE_MODES.SAMPLE
	);
}

export function assertPrivateDocumentsAllowed(user: ExperienceUser): void {
	if (!workspaceCapabilities(user).privateDocuments) {
		throw new ORPCError("FORBIDDEN", {
			message: "Private document workflows are unavailable in demo workspaces.",
		});
	}
}
