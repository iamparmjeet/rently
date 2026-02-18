import { Mail, MapIcon, PhoneCallIcon } from "lucide-react";

type ContactProp = {
  key: number;
  title: string;
  icon: React.ReactHTMLElement;
  link: HTMLAnchorElement;
};

export const CONTACT: ContactProp[] = [
  {
    key: 1,
    title: "+91 123 123 1234",
    icon: <PhoneCallIcon />,
    link: +911231231234,
  },
  {
    key: 2,
    title: "info@parmjeetmishra.com",
    icon: <Mail />,
    link: "info@parmjeetmishra.com",
  },
  {
    key: 3,
    title: "Ludhiana, Punjab",
    icon: <MapIcon />,
    link: "location",
  },
];
