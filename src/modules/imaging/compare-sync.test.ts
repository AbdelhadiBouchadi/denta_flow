import { describe, expect, it } from "vitest";

import {
  createTransformSync,
  fromRelativeView,
  mirrorTransform,
  toRelativeView,
  type PaneFrame,
  type PaneView,
  type TransformState,
} from "./compare-sync";

// A wide panoramique in a desktop pane, a small portrait rétro-alvéolaire
// (never upscaled) in a narrower one.
const PANO: PaneFrame = { wrapperWidth: 800, wrapperHeight: 600, naturalWidth: 3000, naturalHeight: 1500 };
const RETRO: PaneFrame = { wrapperWidth: 500, wrapperHeight: 700, naturalWidth: 300, naturalHeight: 400 };

const IDENTITY: TransformState = { scale: 1, positionX: 0, positionY: 0 };

describe("relative view", () => {
  it("at rest, both panes look at the image's centre", () => {
    expect(toRelativeView(IDENTITY, PANO)).toEqual({ scale: 1, x: 0.5, y: 0.5 });
    expect(toRelativeView(IDENTITY, RETRO)).toEqual({ scale: 1, x: 0.5, y: 0.5 });
  });

  it("round-trips a zoomed, panned view in one frame", () => {
    const state = { scale: 3.2, positionX: -910, positionY: -455 };
    const back = fromRelativeView(toRelativeView(state, PANO), PANO);
    expect(back.scale).toBeCloseTo(state.scale);
    expect(back.positionX).toBeCloseTo(state.positionX);
    expect(back.positionY).toBeCloseTo(state.positionY);
  });

  it("round-trips between two images of different sizes", () => {
    const pano: PaneView = { state: { scale: 2.5, positionX: -700, positionY: -300 }, frame: PANO };
    const onRetro = mirrorTransform(pano, RETRO);
    // Same zoom, same relative point under each pane's centre…
    const a = toRelativeView(pano.state, PANO);
    const b = toRelativeView(onRetro, RETRO);
    expect(b.scale).toBeCloseTo(a.scale);
    expect(b.x).toBeCloseTo(a.x);
    expect(b.y).toBeCloseTo(a.y);
    // …and mirrored back, the original transform.
    const back = mirrorTransform({ state: onRetro, frame: RETRO }, PANO);
    expect(back.positionX).toBeCloseTo(pano.state.positionX);
    expect(back.positionY).toBeCloseTo(pano.state.positionY);
  });
});

describe("createTransformSync", () => {
  /** Two fake panes wired the way the compare view wires the library. */
  const setup = () => {
    const sync = createTransformSync();
    const panes = {
      a: { state: { ...IDENTITY }, frame: PANO, applied: 0 },
      b: { state: { ...IDENTITY }, frame: RETRO, applied: 0 },
    };
    type Key = keyof typeof panes;
    const other = (key: Key): Key => (key === "a" ? "b" : "a");

    // The library calls `onTransformed` synchronously from `setTransform`.
    const onTransformed = (key: Key) => {
      const target = other(key);
      sync(panes[key], panes[target], (next) => setTransform(target, next));
    };
    const setTransform = (key: Key, next: TransformState) => {
      panes[key].state = next;
      panes[key].applied += 1;
      onTransformed(key);
    };
    return { panes, setTransform };
  };

  it("mirrors one move once, with no echo back", () => {
    const { panes, setTransform } = setup();
    setTransform("a", { scale: 2, positionX: -400, positionY: -300 });
    expect(panes.a.applied).toBe(1);
    expect(panes.b.applied).toBe(1);
    expect(panes.b.state.scale).toBe(2);
  });

  it("repeated identical updates do not loop or re-apply", () => {
    const { panes, setTransform } = setup();
    const move = { scale: 1.8, positionX: -200, positionY: -120 };
    setTransform("a", move);
    setTransform("a", { ...move });
    setTransform("a", { ...move });
    expect(panes.a.applied).toBe(3);
    // B already shows the mirrored view: nothing more to apply.
    expect(panes.b.applied).toBe(1);
  });

  it("works in both directions", () => {
    const { panes, setTransform } = setup();
    setTransform("b", { scale: 4, positionX: -800, positionY: -1000 });
    expect(panes.a.applied).toBe(1);
    expect(panes.a.state.scale).toBe(4);
  });
});
