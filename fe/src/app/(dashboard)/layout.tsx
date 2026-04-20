import DashboardHeader from "@/components/layouts/dashboard-header";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<section className="min-h-screen">
			<DashboardHeader />
			<main>{children}</main>
		</section>
	);
}
