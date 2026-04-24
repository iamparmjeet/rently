import { IconBuilding, IconHome, IconReceipt, IconSettings, IconUsers } from "@tabler/icons-react";

export const NavigationLinks = [
  { name: "Dashboard", href: "/dashboard", icon: IconHome },
  { name: "Properties", href: "/dashboard/properties", icon: IconBuilding },
  { name: "Tenants", href: "/dashboard/tenants", icon: IconUsers },
  { name: "Payments", href: "/dashboard/payments", icon: IconReceipt },
  { name: "Settings", href: "/dashboard/settings", icon: IconSettings },
]
