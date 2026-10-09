import ThemeToggle from "@/components/shared/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { WaitingRoomButton } from "@/modules/appointments/ui/waiting-room-button";
import { PatientSearch } from "@/modules/dashboard/ui/patient-search";
import { UserMenu } from "@/modules/dashboard/ui/user-menu";

/**
 * The navbar every dashboard route renders under. Structural itself: the
 * session it shows comes from `authClient` inside <UserMenu />, and the one
 * piece of domain data — the «Salle d’attente» count — is read by the
 * appointments slice's <WaitingRoomButton /> from the query
 * `(dashboard)/layout.tsx` prefetches. This file stays a Server Component.
 */
export const SiteHeader = () => {
  // `md:rounded-t-xl` follows the inset panel's own corner: a square sticky
  // header would paint over it.
  return (
    <header className="bg-background sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b px-3 md:rounded-t-xl md:px-4">
      <SidebarTrigger aria-label="Afficher ou masquer le menu" />
      <Separator orientation="vertical" />
      <PatientSearch />

      <div className="ml-auto flex items-center gap-2">
        <WaitingRoomButton />
        <ThemeToggle />
        <Separator orientation="vertical" />

        <UserMenu />
      </div>
    </header>
  );
};
