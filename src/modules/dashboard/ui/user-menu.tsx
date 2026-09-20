"use client";

import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";

import GeneratedAvatar from "@/components/shared/generated-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import {
  STAFF_ROLE_LABELS,
  UNKNOWN_STAFF_NAME,
} from "@/modules/dashboard/constants";

const roleLabel = (role: string | undefined) =>
  role && role in STAFF_ROLE_LABELS
    ? STAFF_ROLE_LABELS[role as keyof typeof STAFF_ROLE_LABELS]
    : "";

export const UserMenu = () => {
  const { data: session, isPending } = authClient.useSession();
  const { signOut, isSigningOut } = useSignOut();

  if (isPending || !session) {
    return <Skeleton className="h-8 w-8 rounded-full md:w-36 md:rounded-lg" />;
  }

  const { name, role } = session.user;
  const displayName = name?.trim() || UNKNOWN_STAFF_NAME;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-8 gap-2 px-1 py-2 md:pr-2"
            aria-label="Menu du compte"
          />
        }
      >
        <GeneratedAvatar seed={displayName} className="size-6" />
        <span className="hidden max-w-32 truncate text-sm font-medium md:inline">
          {displayName}
        </span>
        <ChevronsUpDownIcon className="text-muted-foreground hidden size-3.5 md:inline" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <div className="flex flex-col gap-0.5 px-1.5 py-1.5">
          <span className="truncate text-sm font-medium">{displayName}</span>
          <span className="text-muted-foreground truncate text-xs">
            {roleLabel(role)}
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          closeOnClick={false}
          onClick={signOut}
        >
          {isSigningOut ? <Spinner /> : <LogOutIcon />}
          {isSigningOut ? "Déconnexion…" : "Se déconnecter"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
