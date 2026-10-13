"use client";

import {
  THUMBNAIL_CONTENT_TYPE,
  THUMBNAIL_QUALITY,
} from "../constants";
import { thumbnailSize } from "../files";

/**
 * Browser-only image work for the upload dialog: decode a picked file to read
 * its real pixel size, and draw its thumbnail (prompts/31, decision 8). The
 * original itself is never re-encoded — it is uploaded byte for byte.
 *
 * `imageOrientation: "from-image"` applies the EXIF rotation, so the stored
 * width / height and the thumbnail match what an `<img>` of the original
 * shows (browsers honour EXIF orientation on `<img>` by default).
 */

const decode = (file: Blob) =>
  createImageBitmap(file, { imageOrientation: "from-image" });

/** The decoded size, or `null` when the browser cannot read the file. */
export const readImageDimensions = async (file: Blob) => {
  try {
    const bitmap = await decode(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
};

/**
 * A JPEG at most THUMBNAIL_LONG_SIDE px on its long side, or `null` when it
 * cannot be made (memory on a huge image, an old browser). A missing
 * thumbnail never blocks an upload: the gallery shows a placeholder.
 */
export const makeThumbnail = async (file: Blob): Promise<Blob | null> => {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decode(file);
    const { width, height } = thumbnailSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    // A transparent PNG would turn black in a JPEG: paint the page colour.
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, THUMBNAIL_CONTENT_TYPE, THUMBNAIL_QUALITY),
    );
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
};
