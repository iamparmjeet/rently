// server Page

// error States

import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import {
	IconBuilding,
	IconCheck,
	IconClockOff,
	IconMailOff,
} from "@tabler/icons-react";
import Link from "next/link";
import { AcceptInviteForm } from "@/components/forms/accept-invite-form";
import { client } from "@/utils/orpc";

function InviteNotFound() {
	return (
		<div className="flex flex-col items-center gap-4 py-8 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
				<IconMailOff className="h-8 w-8 text-muted-foreground" />
			</div>
			<div>
				<h3 className="font-semibold text-lg">Invalid Invite Link</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					This invitation link is invalid or has already been used.
				</p>
			</div>
			<Button variant="outline" className="mt-2">
				<Link href="/login">Go to Login</Link>
			</Button>
		</div>
	);
}

function InviteExpired() {
	return (
		<div className="flex flex-col items-center gap-4 py-8 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
				<IconClockOff className="h-8 w-8 text-orange-500" />
			</div>
			<div>
				<h3 className="font-semibold text-lg">Invite Expired</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					This invite link has expired. Please ask your landlord to send a new
					invitation.
				</p>
			</div>
			<Button variant="outline" className="mt-2">
				<Link href="/login">Go to Login</Link>
			</Button>
		</div>
	);
}

function InviteAlreadyAccepted() {
	return (
		<div className="flex flex-col items-center gap-4 py-8 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
				<IconCheck className="h-8 w-8 text-green-600" />
			</div>
			<div>
				<h3 className="font-semibold text-lg">Already Accepted</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					You have already accepted this invitation. Please log in.
				</p>
			</div>
			<Button className="mt-2 w-full">
				<Link href="/login">Go to Login</Link>
			</Button>
		</div>
	);
}

interface PageProps {
	params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
	const { token } = await params;
	// Determin which uI to show
	// No Loading flash, no client side fetch waterfall
	type InviteState =
		| {
				type: "valid";
				data: { name: string | null; email: string; phone: string | null };
		  }
		| { type: "not_found" }
		| { type: "expired" }
		| { type: "accepted" };

	let state: InviteState;

	try {
		const { invite } = await client.rent.invite.getInviteByToken({ token });
		state = { type: "valid", data: invite };
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Unknown error";
		if (message.includes("expired")) {
			state = { type: "expired" };
		} else if (message.includes("already been accepted")) {
			state = { type: "accepted" };
		} else {
			state = { type: "not_found" };
		}
	}

	return (
		<div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
			<div className="w-full max-w-md">
				{/* Brand mark */}
				<div className="mb-8 flex flex-col items-center gap-2">
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
						<IconBuilding className="h-6 w-6 text-primary" />
					</div>
					<span className="font-semibold text-xl tracking-tight">RentWise</span>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-center text-xl">
						{state.type === "valid"
							? "Accept Your Invitation"
							: "Invitation Unavailable"}
					</CardTitle>
				</CardHeader>
				<CardContent>
					{state.type === "not_found" && <InviteNotFound />}
					{state.type === "expired" && <InviteExpired />}
					{state.type === "accepted" && <InviteAlreadyAccepted />}
					{state.type === "valid" && (
						<AcceptInviteForm
							token={token}
							email={state.data.email ?? ""}
							name={state.data.name ?? ""}
							phone={state.data.phone ?? ""}
							ownerName={state.data.ownerName}
						/>
					)}
				</CardContent>
			</Card>
			{/* Footer note */}
			<p className="mt-6 text-center text-muted-foreground text-xs">
				Already have an account?{" "}
				<Link href="/login" className="text-primary hover:underline">
					Sign in
				</Link>
			</p>
		</div>
	);
}
