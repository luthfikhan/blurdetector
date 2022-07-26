const Filters = require("./canvasfilters");

/**
 * I forgot why exactly I was doing this.
 * It somehow improves edge detection to blur the image a bit beforehand.
 * But we don't want to do this for very small images.
 */
const BLUR_BEFORE_EDGE_DETECTION_MIN_WIDTH = 360; // pixels
const BLUR_BEFORE_EDGE_DETECTION_DIAMETER = 5.0; // pixels

/**
 * Only count edges that reach a certain intensity.
 * I forgot which unit this was. But it's not pixels.
 */
const MIN_EDGE_INTENSITY = 20;

const detectEdges = (imageData) => {
  const preBlurredImageData =
    imageData.width >= BLUR_BEFORE_EDGE_DETECTION_MIN_WIDTH
      ? Filters.gaussianBlur(imageData, BLUR_BEFORE_EDGE_DETECTION_DIAMETER)
      : imageData;

  const greyscaled = Filters.luminance(preBlurredImageData);
  const sobelKernel = Filters.getFloat32Array([1, 0, -1, 2, 0, -2, 1, 0, -1]);
  return Filters.convolve(greyscaled, sobelKernel, true);
};

/**
 * Reduce imageData from RGBA to only one channel (Y/luminance after conversion
 * to greyscale) since RGB all have the same values and Alpha was ignored.
 */
const reducedPixels = (imageData) => {
  const { data: pixels, width } = imageData;
  const rowLen = width * 4;
  let i,
    x,
    y,
    row,
    rows = [];

  for (y = 0; y < pixels.length; y += rowLen) {
    row = new Uint8ClampedArray(imageData.width);
    x = 0;
    for (i = y; i < y + rowLen; i += 4) {
      row[x] = pixels[i];
      x += 1;
    }
    rows.push(row);
  }
  return rows;
};

/**
 * @param pixels Array of Uint8ClampedArrays (row in original image)
 */
const detectBlur = (pixels) => {
  const width = pixels[0].length;
  const height = pixels.length;

  let x,
    y,
    value,
    oldValue,
    edgeStart,
    edgeWidth,
    bm,
    percWidth,
    numEdges = 0,
    sumEdgeWidths = 0;

  for (y = 0; y < height; y += 1) {
    // Reset edge marker, none found yet
    edgeStart = -1;
    for (x = 0; x < width; x += 1) {
      value = pixels[y][x];
      // Edge is still open
      if (edgeStart >= 0 && x > edgeStart) {
        oldValue = pixels[y][x - 1];
        // Value stopped increasing => edge ended
        if (value < oldValue) {
          // Only count edges that reach a certain intensity
          if (oldValue >= MIN_EDGE_INTENSITY) {
            edgeWidth = x - edgeStart - 1;
            numEdges += 1;
            sumEdgeWidths += edgeWidth;
          }
          edgeStart = -1; // Reset edge marker
        }
      }
      // Edge starts
      if (value == 0) {
        edgeStart = x;
      }
    }
  }

  if (numEdges === 0) {
    bm = 0;
    percWidth = 0;
  } else {
    bm = sumEdgeWidths / numEdges;
    percWidth = (bm / width) * 100;
  }

  return {
    width: width,
    height: height,
    numEdges,
    avgEdgeWidth: bm,
    avgEdgeWidthPerc: percWidth,
    blurScore: Math.round(percWidth * 100) / 100,
  };
};

const measureBlur = (imageData) => {
  return detectBlur(reducedPixels(detectEdges(imageData)));
};

module.exports = measureBlur;
