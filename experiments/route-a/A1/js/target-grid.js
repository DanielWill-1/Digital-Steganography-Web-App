/**
 * Deterministic target normalisation for Experiment A1.
 *
 * Loaded as a plain script (no ES modules) so the experiment works from the filesystem as
 * well as over http. Publishes its API on the shared `StegoA1` namespace.
 *
 * An uploaded image (or a built-in synthetic target) becomes a 21 × 21 binary matrix so
 * it is directly comparable to a QR matrix.
 *
 * Normalisation pipeline (recorded in the manifest, applied in this order):
 *
 *   source pixels
 *     → centre-crop to a square
 *     → grayscale as Rec. 601 luma
 *     → box-average downsample to 21 × 21
 *     → threshold: luma < 128 → dark (1), luma >= 128 → light (0)
 *
 * Convention: 1 means "the target wants a dark module here", matching a dark QR module.
 * The methods are deliberately simple; the point is reproducibility, not image quality.
 * No adaptive thresholding is used.
 *
 * The repo ships no image assets, so a small set of synthetic targets is defined here in
 * code. They make the default experiment reproducible without a binary fixture.
 */

(function (global) {
  const StegoA1 = (global.StegoA1 = global.StegoA1 || {});

  const TARGET_SIZE = 21;
  const DARK_THRESHOLD = 128;
  const FIT_METHOD = 'center-crop to square';
  const GRAYSCALE_METHOD = 'Rec. 601 luma: (299R + 587G + 114B) / 1000';
  const DOWNSAMPLE_METHOD = 'box average';
  const THRESHOLD_METHOD = `luma < ${DARK_THRESHOLD} → dark (1), luma >= ${DARK_THRESHOLD} → light (0)`;

  /** Metadata describing the normalisation, for the experiment manifest. */
  function normalizationMetadata(size = TARGET_SIZE) {
    return {
      size,
      fit_method: FIT_METHOD,
      grayscale_method: GRAYSCALE_METHOD,
      downsample_method: DOWNSAMPLE_METHOD,
      threshold: DARK_THRESHOLD,
      threshold_method: THRESHOLD_METHOD,
      matrix_convention: '1 = target dark module, 0 = target light module',
    };
  }

  /**
   * Rec. 601 luma of an RGB triple, using integer coefficients so the 128 threshold is
   * exact (0.299 + 0.587 + 0.114 in floating point is 0.9999999999999999).
   */
  function luma(r, g, b) {
    return (299 * r + 587 * g + 114 * b) / 1000;
  }

  /**
   * Normalise RGBA pixel data to a 21 × 21 binary target matrix.
   *
   * @param {{data: Uint8ClampedArray|Uint8Array, width: number, height: number}} imageData
   * @returns {number[][]} target[row][column] ∈ {0,1}
   */
  function imageDataToTargetMatrix(imageData, options = {}) {
    const size = options.size ?? TARGET_SIZE;
    const threshold = options.threshold ?? DARK_THRESHOLD;
    const { data, width, height } = imageData;
    if (!width || !height) throw new Error('Image has no pixels.');

    const side = Math.min(width, height);
    const originX = (width - side) / 2;
    const originY = (height - side) / 2;
    const target = Array.from({ length: size }, () => Array(size).fill(0));

    for (let row = 0; row < size; row++) {
      const sy0 = originY + (row * side) / size;
      const sy1 = originY + ((row + 1) * side) / size;
      const iy0 = Math.max(0, Math.floor(sy0));
      const iy1 = Math.max(iy0 + 1, Math.min(height, Math.ceil(sy1)));
      for (let column = 0; column < size; column++) {
        const sx0 = originX + (column * side) / size;
        const sx1 = originX + ((column + 1) * side) / size;
        const ix0 = Math.max(0, Math.floor(sx0));
        const ix1 = Math.max(ix0 + 1, Math.min(width, Math.ceil(sx1)));

        let sum = 0;
        let count = 0;
        for (let y = iy0; y < iy1; y++) {
          for (let x = ix0; x < ix1; x++) {
            const index = (y * width + x) * 4;
            sum += luma(data[index], data[index + 1], data[index + 2]);
            count++;
          }
        }
        const average = count ? sum / count : 0;
        target[row][column] = average < threshold ? 1 : 0;
      }
    }
    return target;
  }

  /** Built-in synthetic targets, deterministic and defined in code. */
  const SYNTHETIC_TARGETS = ['circle', 'ring', 'checkerboard', 'diagonal-cross', 'corner-blocks'];

  /** Labels for the UI. */
  const SYNTHETIC_TARGET_LABELS = {
    circle: 'Circle (disc)',
    ring: 'Ring (annulus)',
    checkerboard: 'Checkerboard',
    'diagonal-cross': 'Diagonal cross',
    'corner-blocks': 'Corner blocks',
  };

  /** Build a synthetic target matrix by name. */
  function syntheticTarget(name, size = TARGET_SIZE) {
    const centre = (size - 1) / 2;
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));
    const distance = (row, column) => Math.hypot(row - centre, column - centre);
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        let dark = false;
        switch (name) {
          case 'circle':
            dark = distance(row, column) <= size * 0.4;
            break;
          case 'ring':
            dark = distance(row, column) <= size * 0.42 && distance(row, column) >= size * 0.26;
            break;
          case 'checkerboard':
            dark = (row + column) % 2 === 0;
            break;
          case 'diagonal-cross':
            dark = Math.abs(row - centre) < 1.6 || Math.abs(column - centre) < 1.6;
            break;
          case 'corner-blocks':
            dark = (row < size / 2) === (column < size / 2);
            break;
          default:
            throw new Error(`Unknown synthetic target: ${name}`);
        }
        matrix[row][column] = dark ? 1 : 0;
      }
    }
    return matrix;
  }

  /** Human-readable description of a synthetic target, for the manifest. */
  function syntheticTargetDescription(name) {
    return `built-in synthetic target "${name}" (defined in js/target-grid.js)`;
  }

  /**
   * Browser-only: decode a user-selected image file to ImageData without any network or
   * upload. Not called from Node. Returns a promise of { data, width, height }.
   */
  function loadImageFileToImageData(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(imageData);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('The image could not be decoded. Use a PNG, JPEG, or WebP file.'));
      };
      image.src = url;
    });
  }

  Object.assign(StegoA1, {
    TARGET_SIZE,
    DARK_THRESHOLD,
    FIT_METHOD,
    GRAYSCALE_METHOD,
    DOWNSAMPLE_METHOD,
    THRESHOLD_METHOD,
    normalizationMetadata,
    luma,
    imageDataToTargetMatrix,
    SYNTHETIC_TARGETS,
    SYNTHETIC_TARGET_LABELS,
    syntheticTarget,
    syntheticTargetDescription,
    loadImageFileToImageData,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
