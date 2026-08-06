import type { ComponentProps } from "react";

type AuthEntryLinkProps = Omit<ComponentProps<"a">, "href"> & {
	href: "/login" | "/register";
};

export function AuthEntryLink(props: AuthEntryLinkProps) {
	return <a {...props} />;
}
