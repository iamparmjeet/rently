import { X } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-border px-4 pb-14 pt-10">
      <div className="page-wrap flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-center text-sm text-muted-foreground sm:text-left">
          © {year} RentWise · All rights reserved ·{" "}
          <a
            href="https://parmjeetmishra.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Made with ♥ by Parm
          </a>
        </p>

        <a
          href="https://x.com/parmjeetmishra"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Follow on X"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </a>
      </div>
    </footer>
  );
}
