"use client";

import { PlusIcon } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHIP_DESCRIPTIONS,
  CHIP_LABELS,
  CHIP_VALUES,
  WHATSAPP_COPY as COPY,
} from "../constants";
import { isChip, normalizeSegments } from "../template-body";
import type { BodySegment, MessageChip } from "../types";

/**
 * The message editor (prompts/33b, decision 5): one line of text in which
 * the appointment's values sit as readable tags — «Prénom», «Date», «Heure»,
 * «Cabinet», «Téléphone». The admin never types or sees a placeholder.
 *
 * A `contentEditable` line, uncontrolled: the DOM is built ONCE from `value`
 * (remount with a new `key` to reset it) and every edit is read back into
 * segments for the form. Re-rendering it from React state on each keystroke
 * would move the caret. Tags are `contenteditable="false"` spans, deleted
 * whole with Backspace like a character. Enter, line breaks and rich paste
 * are refused: WhatsApp templates are single-line here, plain text only.
 */

const CHIP_CLASS =
  "bg-primary/10 text-primary mx-0.5 inline-block rounded-md px-1.5 align-baseline text-[0.8125rem] leading-6 font-medium select-none";

/** Kept after a trailing tag so the caret can land behind it; never read. */
const CARET_GUARD = "​";

const chipElement = (chip: MessageChip) => {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.chip = chip;
  span.className = CHIP_CLASS;
  span.textContent = CHIP_LABELS[chip];
  return span;
};

const render = (element: HTMLElement, segments: readonly BodySegment[]) => {
  element.replaceChildren(
    ...segments.map((segment) =>
      segment.type === "text"
        ? document.createTextNode(segment.text)
        : chipElement(segment.chip),
    ),
  );
  if (element.lastChild?.nodeType !== Node.TEXT_NODE) {
    element.append(document.createTextNode(CARET_GUARD));
  }
};

/** The DOM, back into segments. Browsers may wrap text in <div>/<span>. */
const read = (element: HTMLElement): BodySegment[] => {
  const segments: BodySegment[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "")
        .replaceAll(CARET_GUARD, "")
        .replace(/ /g, " ")
        .replace(/[\r\n\t]+/g, " ");
      segments.push({ type: "text", text });
      return;
    }
    if (node instanceof HTMLElement) {
      const chip = node.dataset.chip;
      if (chip !== undefined) {
        if (isChip(chip)) segments.push({ type: "chip", chip });
        return;
      }
      if (node.tagName === "BR") return;
      node.childNodes.forEach(walk);
    }
  };
  element.childNodes.forEach(walk);
  return normalizeSegments(segments);
};

/** Inserts a node at the caret (or at the end), the caret after it. */
const insertAtCaret = (element: HTMLElement, node: Node) => {
  const selection = window.getSelection();
  let range: Range;
  if (selection && selection.rangeCount > 0 && element.contains(selection.anchorNode)) {
    range = selection.getRangeAt(0);
    range.deleteContents();
  } else {
    range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
  }
  range.insertNode(node);
  if (!node.nextSibling) element.append(document.createTextNode(CARET_GUARD));
  range.setStartAfter(node);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
};

interface MessageEditorProps {
  id: string;
  /** Read once, at mount. Change the component's `key` to reset it. */
  value: readonly BodySegment[];
  onChange: (segments: BodySegment[]) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

export const MessageEditor = ({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
}: MessageEditorProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const initial = useRef(value);

  useLayoutEffect(() => {
    if (ref.current) render(ref.current, initial.current);
  }, []);

  const emit = () => {
    if (ref.current) onChange(read(ref.current));
  };

  const insertChip = (chip: MessageChip) => {
    const element = ref.current;
    if (!element || disabled) return;
    element.focus();
    insertAtCaret(element, chipElement(chip));
    emit();
  };

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={COPY.insertChip} className="flex flex-wrap gap-1.5">
        {CHIP_VALUES.map((chip) => (
          <Button
            key={chip}
            type="button"
            size="xs"
            variant="outline"
            className="rounded-full"
            title={CHIP_DESCRIPTIONS[chip]}
            aria-label={COPY.insertChipLabel(CHIP_LABELS[chip])}
            disabled={disabled}
            // Keep the editor's caret where it is while clicking.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertChip(chip)}
          >
            <PlusIcon />
            {CHIP_LABELS[chip]}
          </Button>
        ))}
      </div>
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="false"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-disabled={disabled || undefined}
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck
        lang="fr"
        className={cn(
          "border-input dark:bg-input/30 min-h-24 w-full min-w-0 rounded-lg border bg-transparent px-3 py-2 text-sm leading-7 break-words whitespace-pre-wrap outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          disabled && "cursor-not-allowed opacity-50",
        )}
        onInput={emit}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain").replace(/[\r\n\t]+/g, " ");
          if (text && ref.current) {
            insertAtCaret(ref.current, document.createTextNode(text));
            emit();
          }
        }}
        onDrop={(event) => event.preventDefault()}
      />
    </div>
  );
};
