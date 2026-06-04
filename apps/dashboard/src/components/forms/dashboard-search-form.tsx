import { Button } from "@rently/ui/components/button";
import { Field } from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { IconSearch } from "@tabler/icons-react";

export default function DashboardSearchForm() {
	return (
		<form>
			<Field className="flex flex-row items-center">
				<Input id="input-demo-api-key" type="password" placeholder="search" />
				<Button variant="link" className="">
					<IconSearch />
				</Button>
			</Field>
		</form>
	);
}
