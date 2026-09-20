import { CirclePlusIcon } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

/**
 * The chrome shared by /connexion and /inscription: no navbar, no sidebar, a
 * single centred column on the app background.
 *
 * It lives in the slice rather than in `(auth)/layout.tsx` because a file under
 * `src/app/` is a routing shell and carries no layout JSX of its own
 * (AGENTS.md §1.1). Server Component — nothing here is interactive, so the
 * client boundary stays inside the two forms (06-ui.md §9).
 */
const AuthShell = ({ children }: Props) => {
  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex items-center gap-3">
        {/* The design system specifies a 40x40 Lucide mark on teal, swapped for
            the clinic's own logo per deployment. No hardcoded colour: the teal
            is the `primary` token. */}
        <span
          aria-hidden
          className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl"
        >
          <CirclePlusIcon className="size-6" />
        </span>
        <span className="font-heading text-h2 text-foreground">DentaFlow</span>
      </div>

      <div className="w-full max-w-sm">{children}</div>

      <p className="text-label text-muted-foreground">
        Espace réservé au personnel du cabinet
      </p>
    </main>
  );
};

export default AuthShell;
