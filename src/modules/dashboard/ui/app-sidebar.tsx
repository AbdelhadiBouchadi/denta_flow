"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { ADMIN_ROLE, DASHBOARD_NAV_ITEMS } from "@/modules/dashboard/constants";
import { ClinicBrand } from "@/modules/dashboard/ui/clinic-brand";

/** `/patients` stays active on `/patients/abc`, but never on `/patientsX`. */
const isActiveHref = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const AppSidebar = ({
  ...props
}: React.ComponentProps<typeof Sidebar>) => {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  // The navbar and the sidebar both read the session from `authClient`: the
  // layout is structural and performs no session check of its own
  // (prompts/09-shell.md), and the pages do the authoritative redirect.
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === ADMIN_ROLE;

  // Admin-only entries stay hidden while the session is still loading rather
  // than appearing and being pulled away a moment later.
  const items = DASHBOARD_NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  // The mobile drawer does not unmount on navigation, so close it ourselves.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              // Grows past h-12 when the name wraps to a second line.
              className="h-auto min-h-12 group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:p-1.5!"
              render={<Link href="/tableau-de-bord" onClick={closeOnMobile} />}
            >
              {/* The clinic row, suspended in its own boundary so the
                  server and the browser render the same name. */}
              <ClinicBrand />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = isActiveHref(pathname, item.href);

                return (
                  <SidebarMenuItem key={item.href} className="py-1">
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={
                        <Link
                          href={item.href}
                          onClick={closeOnMobile}
                          aria-current={isActive ? "page" : undefined}
                        />
                      }
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
};
