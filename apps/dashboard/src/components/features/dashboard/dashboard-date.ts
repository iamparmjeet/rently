export function formatDashboardDate(date: Date): string {
	return date.toLocaleDateString("en-IN", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "Asia/Kolkata",
	});
}
