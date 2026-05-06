import { IconSearch } from "@tabler/icons-react";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

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
