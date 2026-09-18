// Dev-only design-token showcase, compared side by side with
// prompt_material/01-dentaflow-design-system.png. Deleted before v1 ships.
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { CirclePlusIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Jetons de design",
};

type Swatch = { name: string; token: string; className: string };

const PRIMARY_SWATCHES: Swatch[] = [
  { name: "Teal primaire", token: "teal", className: "bg-teal" },
  { name: "Teal foncé", token: "teal-dark", className: "bg-teal-dark" },
  { name: "Teal clair", token: "teal-light", className: "bg-teal-light" },
  { name: "Bleu ardoise", token: "slate-blue", className: "bg-slate-blue" },
];

const SEMANTIC_SWATCHES: Swatch[] = [
  { name: "Succès", token: "success", className: "bg-success" },
  { name: "Avertissement", token: "warning", className: "bg-warning" },
  { name: "Danger", token: "danger", className: "bg-danger" },
  { name: "Information", token: "info", className: "bg-info" },
];

const NEUTRAL_SWATCHES: Swatch[] = [
  { name: "Texte / 1", token: "ink", className: "bg-foreground" },
  {
    name: "Texte / 2",
    token: "ink-secondary",
    className: "bg-foreground-secondary",
  },
  { name: "Discret", token: "subtle", className: "bg-subtle" },
  { name: "Bordure", token: "line", className: "bg-border" },
  { name: "Fond", token: "app-bg", className: "border bg-background" },
];

const TYPE_SCALE = [
  {
    role: "H1",
    use: "Titre de page",
    size: "32px",
    weight: "Bold",
    lh: "1.2",
    className: "font-heading text-h1",
  },
  {
    role: "H2",
    use: "Titre de section",
    size: "24px",
    weight: "SemiBold",
    lh: "1.3",
    className: "font-heading text-h2",
  },
  {
    role: "H3",
    use: "Titre de carte",
    size: "20px",
    weight: "SemiBold",
    lh: "1.3",
    className: "font-heading text-h3",
  },
  {
    role: "H4",
    use: "Sous-titre",
    size: "16px",
    weight: "Medium",
    lh: "1.4",
    className: "font-heading text-h4",
  },
  {
    role: "Corps large",
    use: "Contenu important",
    size: "16px",
    weight: "Regular",
    lh: "1.6",
    className: "text-body-lg",
  },
  {
    role: "Corps",
    use: "Texte courant",
    size: "14px",
    weight: "Regular",
    lh: "1.6",
    className: "text-body",
  },
  {
    role: "Interface",
    use: "Boutons, champs",
    size: "13px",
    weight: "Medium",
    lh: "1.4",
    className: "text-ui",
  },
  {
    role: "Étiquette",
    use: "Libellés, méta",
    size: "11px",
    weight: "SemiBold",
    lh: "1.4",
    className: "text-label text-muted-foreground",
  },
];

const PAYMENT_BADGES = [
  {
    label: "Payé",
    className: "bg-success-subtle text-success-strong",
    dot: "bg-success",
  },
  {
    label: "Reste à payer",
    className: "bg-warning-subtle text-warning-strong",
    dot: "bg-warning",
  },
  {
    label: "Impayé",
    className: "bg-danger-subtle text-danger-strong",
    dot: "bg-danger",
  },
  {
    label: "En cours",
    className: "bg-info-subtle text-info-strong",
    dot: "bg-info",
  },
];

const APPOINTMENT_BADGES = [
  { label: "Confirmé", className: "bg-success-subtle text-success-strong" },
  { label: "En attente", className: "bg-warning-subtle text-warning-strong" },
  { label: "Annulé", className: "bg-danger-subtle text-danger-strong" },
  { label: "Terminé", className: "bg-neutral-subtle text-neutral-strong" },
];

const COVERAGE_BADGES = [
  { label: "CNSS", className: "bg-teal-light text-teal-dark" },
  { label: "CNOPS", className: "bg-teal-light text-teal-dark" },
  { label: "Mutuelle", className: "bg-teal-light text-teal-dark" },
  {
    label: "Sans couverture",
    className: "bg-neutral-subtle text-neutral-strong",
  },
];

const FORMATS = [
  { label: "Montant", value: "1 250,00 DH" },
  { label: "Date", value: "12/03/2026" },
  { label: "Heure", value: "14 h 30" },
  { label: "Téléphone", value: "+212 6 61 23 45 67" },
  { label: "Dent", value: "FDI — 11 à 48" },
  { label: "Espacement", value: "base 4 px" },
];

// Displayed hex values are read from the light palette in globals.css, so
// the labels can never drift from the tokens and no hex lives in this file.
async function readLightPalette() {
  const css = await readFile(
    path.join(process.cwd(), "src/app/globals.css"),
    "utf8",
  );
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const palette = new Map<string, string>();
  for (const [, name, value] of root.matchAll(
    /--([\w-]+):\s*(#[0-9a-f]+);/gi,
  )) {
    palette.set(name, value.toUpperCase());
  }
  return palette;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-6">
      <h2 className="text-primary font-sans text-sm font-semibold tracking-[0.12em] uppercase">
        {children}
      </h2>
      <Separator className="flex-1" />
    </div>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-label text-foreground-secondary tracking-[0.08em] uppercase">
      {children}
    </p>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-card text-card-foreground flex flex-col gap-6 rounded-2xl border p-8">
      {children}
    </section>
  );
}

function SwatchGrid({
  swatches,
  palette,
  columns,
  height,
}: {
  swatches: Swatch[];
  palette: Map<string, string>;
  columns: string;
  height: string;
}) {
  return (
    <div className={cn("grid gap-4", columns)}>
      {swatches.map((swatch) => (
        <div key={swatch.token} className="flex flex-col gap-2">
          <div className={cn("w-full rounded-xl", height, swatch.className)} />
          <div>
            <p className="text-label text-foreground tracking-[0.06em] uppercase">
              {swatch.name}
            </p>
            <p className="text-ui text-muted-foreground font-normal tabular-nums">
              {palette.get(swatch.token)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({
  label,
  className,
  dot,
  shape = "pill",
}: {
  label: string;
  className: string;
  dot?: string;
  shape?: "pill" | "tag";
}) {
  return (
    <Badge
      className={cn(
        "h-7 gap-1.5 px-3",
        shape === "pill" ? "rounded-full" : "rounded-md",
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dot)} /> : null}
      <span className="text-ui">{label}</span>
    </Badge>
  );
}

export default async function TokensPage() {
  const palette = await readLightPalette();

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 p-6 lg:grid-cols-2 lg:p-10">
      <div className="flex flex-col gap-6">
        <Panel>
          <SectionTitle>Marque</SectionTitle>
          <div className="flex flex-col items-center gap-6 py-2">
            <div className="flex items-center gap-4">
              <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl">
                <CirclePlusIcon className="size-10" strokeWidth={1.75} />
              </div>
              <p className="font-heading text-h2 leading-tight">
                Cabinet Dentaire
                <br />
                <span className="text-primary">[Nom]</span>
              </p>
            </div>
            <p className="text-body text-muted-foreground">
              Emplacement logo — icône Lucide 40×40, remplacée par le logo du
              client
            </p>
          </div>
        </Panel>

        <Panel>
          <SectionTitle>Couleurs</SectionTitle>
          <GroupTitle>Primaire</GroupTitle>
          <SwatchGrid
            swatches={PRIMARY_SWATCHES}
            palette={palette}
            columns="grid-cols-2 sm:grid-cols-4"
            height="h-24"
          />
          <GroupTitle>Sémantique</GroupTitle>
          <SwatchGrid
            swatches={SEMANTIC_SWATCHES}
            palette={palette}
            columns="grid-cols-2 sm:grid-cols-4"
            height="h-20"
          />
          <GroupTitle>Neutres</GroupTitle>
          <SwatchGrid
            swatches={NEUTRAL_SWATCHES}
            palette={palette}
            columns="grid-cols-3 sm:grid-cols-5"
            height="h-16"
          />
        </Panel>

        <Panel>
          <SectionTitle>Champs et formats</SectionTitle>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tokens-name">Nom du patient</Label>
              <Input
                id="tokens-name"
                defaultValue="Karim Alaoui"
                className="bg-card text-body h-11 px-4"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tokens-focus">Focus</Label>
              <Input
                id="tokens-focus"
                defaultValue="Fatima Zahra Bennani"
                className="border-ring bg-card text-body ring-ring/20 h-11 px-4 ring-3"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tokens-amount">Montant</Label>
              <InputGroup className="bg-card h-11">
                <InputGroupInput
                  id="tokens-amount"
                  defaultValue="1 250,00"
                  inputMode="decimal"
                  className="text-body px-4 tabular-nums"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="bg-muted h-full border-l px-4"
                >
                  <InputGroupText>DH</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tokens-error" className="text-destructive">
                Erreur
              </Label>
              <Input
                id="tokens-error"
                defaultValue="0000"
                aria-invalid
                className="bg-card text-body h-11 px-4"
              />
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {FORMATS.map((format) => (
              <div
                key={format.label}
                className="text-body grid grid-cols-[6rem_1fr]"
              >
                <dt className="text-muted-foreground">{format.label}</dt>
                <dd className="tabular-nums">{format.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <div className="flex flex-col gap-6">
        <Panel>
          <SectionTitle>Typographie</SectionTitle>
          <GroupTitle>Polices</GroupTitle>
          <p className="flex items-baseline gap-4">
            <span className="font-heading text-6xl font-semibold tracking-tight">
              Poppins
            </span>
            <span className="text-muted-foreground font-sans text-4xl font-medium">
              Inter
            </span>
          </p>
          <p className="text-body-lg text-foreground-secondary">
            Poppins pour les titres, Inter pour l’interface et les données
            chiffrées. Chiffres tabulaires activés partout où des montants sont
            alignés.
          </p>
          <div className="flex flex-col">
            {TYPE_SCALE.map((row) => (
              <div
                key={row.role}
                className="grid grid-cols-[7rem_1fr_4rem_5.5rem_2.5rem] items-center gap-4 py-2.5"
              >
                <span className={row.className}>{row.role}</span>
                <span className="text-body-lg text-foreground-secondary">
                  {row.use}
                </span>
                <span className="text-body-lg text-foreground-secondary tabular-nums">
                  {row.size}
                </span>
                <span className="text-body-lg text-foreground-secondary">
                  {row.weight}
                </span>
                <span className="text-body-lg text-muted-foreground tabular-nums">
                  {row.lh}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle>Badges de statut</SectionTitle>
          <GroupTitle>Paiement</GroupTitle>
          <div className="flex flex-wrap gap-3">
            {PAYMENT_BADGES.map((badge) => (
              <StatusBadge key={badge.label} {...badge} />
            ))}
          </div>
          <GroupTitle>Rendez-vous</GroupTitle>
          <div className="flex flex-wrap gap-3">
            {APPOINTMENT_BADGES.map((badge) => (
              <StatusBadge key={badge.label} {...badge} />
            ))}
          </div>
          <GroupTitle>Couverture</GroupTitle>
          <div className="flex flex-wrap gap-3">
            {COVERAGE_BADGES.map((badge) => (
              <StatusBadge key={badge.label} {...badge} shape="tag" />
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle>Boutons</SectionTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="hover:bg-teal-dark h-11 gap-2 px-5">
              <PlusIcon />
              <span className="text-ui">Nouveau rendez-vous</span>
            </Button>
            <Button variant="outline" className="bg-card h-11 px-5">
              <span className="text-ui">Secondaire</span>
            </Button>
            <Button variant="secondary" className="h-11 px-5">
              <span className="text-ui">Discret</span>
            </Button>
            <Button
              variant="outline"
              className="border-destructive bg-card text-destructive hover:bg-danger-subtle hover:text-destructive h-11 px-5"
            >
              <span className="text-ui">Supprimer</span>
            </Button>
            <Button variant="secondary" disabled className="h-11 px-5">
              <span className="text-ui">Désactivé</span>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="h-8 px-3">
              <span className="text-ui">sm · 32</span>
            </Button>
            <Button className="h-9.5 px-4">
              <span className="text-ui">md · 38</span>
            </Button>
            <Button className="h-11 px-5">
              <span className="text-ui">lg · 44</span>
            </Button>
          </div>
          <p className="text-body text-muted-foreground">
            Hauteurs : sm 32 · md 38 · lg 44{" "}
            <span className="ml-6">Rayon 8–9 px</span>
          </p>
        </Panel>
      </div>
    </main>
  );
}
