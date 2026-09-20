"use client";

import { useState } from "react";
import Image from "next/image";
import { CirclePlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * The clinic's own mark from `public/logo.svg`, replaced per deployment.
 * When the file is absent the design system's 40×40 Lucide mark on teal takes
 * over (prompt_material/01-dentaflow-design-system.png, «MARQUE»), which is why
 * this is a client component: only the browser can tell us the file 404'd.
 *
 * `unoptimized` on purpose — the image optimizer refuses SVG unless
 * `dangerouslyAllowSVG` is set, and the file is ours anyway.
 */
export const ClinicLogo = ({ className }: Props) => {
  const [hasLogoFile, setHasLogoFile] = useState(true);

  if (!hasLogoFile) {
    return (
      <span
        aria-hidden
        className={cn(
          "bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg",
          className,
        )}
      >
        <CirclePlusIcon className="size-5" />
      </span>
    );
  }

  return (
    <Image
      src="/logo.svg"
      alt=""
      width={40}
      height={40}
      unoptimized
      onError={() => setHasLogoFile(false)}
      className={cn("size-8 shrink-0 rounded-lg object-contain", className)}
    />
  );
};
