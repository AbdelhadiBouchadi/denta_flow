"use client";

import { useState } from "react";
import Image from "next/image";
import { CirclePlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  /** The uploaded logo from `clinic.get`, or `null` when none is saved. */
  logoUrl?: string | null;
  className?: string;
}

/** The deployment-level fallback, used only while no logo is uploaded. */
const FALLBACK_LOGO_SRC = "/logo.svg";

/**
 * The clinic's mark, in this order: the logo uploaded in /parametres
 * (`clinicSettings.logoUrl`), then `public/logo.svg`, then the design system's
 * Lucide mark on teal (prompt_material/01-dentaflow-design-system.png,
 * «MARQUE»). A client component because only the browser can tell us a file
 * 404'd.
 *
 * `unoptimized` on purpose — the optimizer refuses SVG unless
 * `dangerouslyAllowSVG` is set, and the uploaded logo is a public blob URL
 * already sized by the store. Every branch fills the same slot, so a logo
 * change never shifts the clinic name beside it.
 */
export const ClinicLogo = ({ logoUrl, className }: Props) => {
  const src = logoUrl || FALLBACK_LOGO_SRC;
  // Keyed on `src`: a new upload after a broken one must get its own attempt.
  return <ClinicLogoImage key={src} src={src} className={className} />;
};

const ClinicLogoImage = ({
  src,
  className,
}: {
  src: string;
  className?: string;
}) => {
  const [hasFailed, setHasFailed] = useState(false);

  if (hasFailed) {
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
      src={src}
      alt=""
      width={40}
      height={40}
      unoptimized
      onError={() => setHasFailed(true)}
      className={cn("size-8 shrink-0 rounded-lg object-contain", className)}
    />
  );
};
