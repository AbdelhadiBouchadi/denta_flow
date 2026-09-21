import ThemeToggle from "@/components/shared/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PatientSearch } from "@/modules/dashboard/ui/patient-search";
import { UserMenu } from "@/modules/dashboard/ui/user-menu";
import { WaitingRoomBadge } from "@/modules/dashboard/ui/waiting-room-badge";

/**
 * The navbar every dashboard route renders under. Structural: it reads no
 * domain data, and the session it shows comes from `authClient` inside
 * <UserMenu />, which keeps this file a Server Component.
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
        <WaitingRoomBadge />
        <ThemeToggle />
        <Separator orientation="vertical" />

        <UserMenu />
      </div>
    </header>
  );
};
