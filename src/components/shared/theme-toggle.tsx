"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Light / dark switch. `next-themes` owns the persistence (localStorage) and
 * the `.dark` class on <html>; every colour follows from the tokens in
 * globals.css, so nothing here knows a hex value.
 *
 * Both icons are rendered and the `dark:` variant picks one, so the markup is
 * identical on the server and on the first client render — the resolved theme
 * is unknowable during SSR, and branching on it would be a hydration mismatch.
 * The label stays theme-neutral for the same reason.
 *
 * The keyboard shortcut lives in ThemeProvider, not here.
 */
const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Basculer entre le thème clair et le thème sombre"
      title="Changer de thème"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
    </Button>
  );
};

export default ThemeToggle;
