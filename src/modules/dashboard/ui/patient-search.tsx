"use client";

import { SearchIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

/**
 * The global patient search slot.
 *
 * Deliberately inert and disabled on this branch: the `patients` slice does not
 * exist yet, and a box that accepts typing but can never answer is worse than
 * one that plainly says it is not ready. Branch 10 wires it to
 * `patients.getMany` through CommandSelect.
 */
export const PatientSearch = () => {
  return (
    <InputGroup className="h-8 w-full max-w-72">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        disabled
        aria-label="Rechercher un patient"
        placeholder="Rechercher un patient…"
      />
    </InputGroup>
  );
};
