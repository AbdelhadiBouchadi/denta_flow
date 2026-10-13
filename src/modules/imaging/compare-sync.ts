/**
 * «Synchroniser le zoom» (prompts/32, decision 5), free of React and of the
 * zoom library so Vitest covers it.
 *
 * Each compare pane is a `react-zoom-pan-pinch` wrapper whose content box is
 * the wrapper's size, with the image centred in it, `object-contain` and
 * never upscaled (`max-w-full max-h-full`). A pane's transform is
 * `screen = position + scale × content`.
 *
 * Two images of different sizes cannot share PIXEL positions, so sync mirrors
 * the zoom factor and the RELATIVE point of the image under the pane's centre
 * (0–1 on each axis of the image, outside that range when panned past an
 * edge). The other pane is then moved so the same relative point sits under
 * its own centre.
 */

export interface TransformState {
  scale: number;
  positionX: number;
  positionY: number;
}

/** What a pane looks like at scale 1: its box and its image's natural size. */
export interface PaneFrame {
  wrapperWidth: number;
  wrapperHeight: number;
  naturalWidth: number;
  naturalHeight: number;
}

export interface PaneView {
  state: TransformState;
  frame: PaneFrame;
}

/** The view a pane shows, independent of pixel sizes. */
export interface RelativeView {
  scale: number;
  /** The image point under the pane's centre, as fractions of the image. */
  x: number;
  y: number;
}

/** The image's rectangle inside the content box at scale 1. */
export const containedRect = ({
  wrapperWidth,
  wrapperHeight,
  naturalWidth,
  naturalHeight,
}: PaneFrame) => {
  const fit = Math.min(
    1,
    wrapperWidth / naturalWidth,
    wrapperHeight / naturalHeight,
  );
  const width = naturalWidth * fit;
  const height = naturalHeight * fit;
  return {
    left: (wrapperWidth - width) / 2,
    top: (wrapperHeight - height) / 2,
    width,
    height,
  };
};

export const toRelativeView = (
  state: TransformState,
  frame: PaneFrame,
): RelativeView => {
  const rect = containedRect(frame);
  const centreX = (frame.wrapperWidth / 2 - state.positionX) / state.scale;
  const centreY = (frame.wrapperHeight / 2 - state.positionY) / state.scale;
  return {
    scale: state.scale,
    x: (centreX - rect.left) / rect.width,
    y: (centreY - rect.top) / rect.height,
  };
};

export const fromRelativeView = (
  view: RelativeView,
  frame: PaneFrame,
): TransformState => {
  const rect = containedRect(frame);
  const centreX = rect.left + view.x * rect.width;
  const centreY = rect.top + view.y * rect.height;
  return {
    scale: view.scale,
    positionX: frame.wrapperWidth / 2 - view.scale * centreX,
    positionY: frame.wrapperHeight / 2 - view.scale * centreY,
  };
};

/** `source`'s view, expressed in `target`'s frame. */
export const mirrorTransform = (source: PaneView, target: PaneFrame) =>
  fromRelativeView(toRelativeView(source.state, source.frame), target);

/** Sub-pixel and 1/1000 of zoom differences are not a move. */
const EPSILON = 1e-3;

export const sameTransform = (a: TransformState, b: TransformState) =>
  Math.abs(a.scale - b.scale) < EPSILON &&
  Math.abs(a.positionX - b.positionX) < 0.5 &&
  Math.abs(a.positionY - b.positionY) < 0.5;

/**
 * The feedback-loop guard. The library reports a transform synchronously
 * from `setTransform(…, 0)`, so applying pane B's mirror fires B's own
 * callback, which would mirror back onto A, and so on. While one
 * propagation runs, every other one is ignored; and a target already at the
 * mirrored transform is left alone, so repeated identical updates are no-ops.
 *
 * Returns `true` when `apply` was called.
 */
export const createTransformSync = () => {
  let applying = false;
  return (
    source: PaneView,
    target: PaneView,
    apply: (state: TransformState) => void,
  ) => {
    if (applying) return false;
    const next = mirrorTransform(source, target.frame);
    if (sameTransform(next, target.state)) return false;
    applying = true;
    try {
      apply(next);
    } finally {
      applying = false;
    }
    return true;
  };
};
