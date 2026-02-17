'use strict';

/**
 * Perceptual dHash (difference hash) for NativeImage objects.
 *
 * Algorithm:
 *   1. Resize to 9×8 pixels (9 wide gives 8 left-right pairs per row = 64 bits total)
 *   2. For each row, compare each pixel's grayscale to its right neighbour
 *   3. Encode comparisons as a 64-bit BigInt
 *
 * Hamming distance between two hashes:
 *   0        = identical frames
 *   1–5      = imperceptible change (cursor blink, minor animation)
 *   6–15     = small change (one-line scroll, tooltip)
 *   16+      = meaningful content change
 *   64       = completely different or one hash is null
 *
 * @see https://www.hackerfactor.com/blog/index.php?/archives/529-Kind-of-Like-That.html
 */

const HASH_WIDTH = 9;   // gives 8 column-pairs
const HASH_HEIGHT = 8;

const DEFAULT_DEDUP_THRESHOLD = 10; // skip frame if hamming distance < this

/**
 * Compute dHash from an Electron NativeImage.
 * Returns a BigInt (64-bit hash) or null on failure.
 *
 * @param {Electron.NativeImage} nativeImage
 * @returns {BigInt|null}
 */
function computeDHash(nativeImage) {
  if (!nativeImage || typeof nativeImage.resize !== 'function') {
    return null;
  }
  try {
    // Resize to 9×8; quality doesn't matter — we need tiny + fast
    const small = nativeImage.resize({ width: HASH_WIDTH, height: HASH_HEIGHT });
    const bitmap = small.toBitmap(); // raw BGRA bytes, row-major

    const expectedBytes = HASH_WIDTH * HASH_HEIGHT * 4;
    if (!bitmap || bitmap.length < expectedBytes) {
      return null;
    }

    let hash = BigInt(0);
    let bit = BigInt(0);

    for (let row = 0; row < HASH_HEIGHT; row++) {
      for (let col = 0; col < HASH_WIDTH - 1; col++) {
        // BGRA layout: blue=offset+0, green=+1, red=+2, alpha=+3
        const iLeft = (row * HASH_WIDTH + col) * 4;
        const iRight = iLeft + 4;

        // Luminance: ITU-R BT.601 weights
        const gLeft  = bitmap[iLeft  + 2] * 0.299 + bitmap[iLeft  + 1] * 0.587 + bitmap[iLeft]  * 0.114;
        const gRight = bitmap[iRight + 2] * 0.299 + bitmap[iRight + 1] * 0.587 + bitmap[iRight] * 0.114;

        if (gLeft > gRight) {
          hash |= (BigInt(1) << bit);
        }
        bit++;
      }
    }

    return hash;
  } catch (_err) {
    return null;
  }
}

/**
 * Hamming distance between two dHash values.
 * Returns 64 if either hash is null (treat as maximally different).
 *
 * @param {BigInt|null} h1
 * @param {BigInt|null} h2
 * @returns {number} 0–64
 */
function hammingDistance(h1, h2) {
  if (h1 === null || h2 === null) {
    return 64;
  }
  let xor = h1 ^ h2;
  let count = 0;
  while (xor !== BigInt(0)) {
    count += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }
  return count;
}

/**
 * Returns true if two frames are visually similar enough to skip saving.
 *
 * @param {BigInt|null} prevHash
 * @param {BigInt|null} nextHash
 * @param {number} threshold  Hamming bits threshold (default DEFAULT_DEDUP_THRESHOLD)
 * @returns {boolean}
 */
function isSimilarFrame(prevHash, nextHash, threshold = DEFAULT_DEDUP_THRESHOLD) {
  return hammingDistance(prevHash, nextHash) < threshold;
}

module.exports = {
  computeDHash,
  hammingDistance,
  isSimilarFrame,
  DEFAULT_DEDUP_THRESHOLD,
};
