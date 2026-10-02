/**
 * A4.1 benchmark target corpus.
 *
 * Eight deterministic, project-owned synthetic targets spanning different visual structures
 * (simple → letter-like → geometric → sparse → dense → asymmetrical). Each is defined as a
 * canonical 21×21 binary matrix so the normalized form is exact and reproducible across
 * browsers/environments; a 21×21 lossless PNG fixture is written from the same matrix.
 *
 * Loaded as a classic script; publishes on `StegoA4`.
 */

(function (global) {
  const StegoA4 = (global.StegoA4 = global.StegoA4 || {});
  const SIZE = 21;
  const C = (SIZE - 1) / 2; // 10

  function grid(fn) {
    const matrix = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) matrix[r][c] = fn(r, c) ? 1 : 0;
    }
    return matrix;
  }
  const dist = (r, c) => Math.hypot(r - C, c - C);

  const DEFINITIONS = [
    { id: 'T01', name: 'circle', category: 'simple', build: () => grid((r, c) => dist(r, c) <= 8.4) },
    {
      id: 'T02', name: 'g-like', category: 'letter-like',
      build: () => grid((r, c) => {
        const onRing = dist(r, c) <= 8.4 && dist(r, c) >= 5.4;
        const gap = c > C + 1 && r >= C - 1 && r <= C + 2; // right-side mouth
        const bar = r === C && c >= C && c <= C + 4;
        return (onRing && !gap) || bar;
      }),
    },
    { id: 'T03', name: 'diagonal', category: 'letter-like', build: () => grid((r, c) => Math.abs((r - 3) - (c - 3)) <= 1.4 && r >= 3 && r <= 17 && c >= 3 && c <= 13) },
    { id: 'T04', name: 'triangle', category: 'geometric', build: () => grid((r, c) => r >= 3 && Math.abs(c - C) <= ((r - 3) * 0.9) && r <= 17) },
    { id: 'T05', name: 'cross', category: 'geometric', build: () => grid((r, c) => (Math.abs(r - C) <= 1.5 && c >= 3 && c <= 17) || (Math.abs(c - C) <= 1.5 && r >= 3 && r <= 17)) },
    {
      id: 'T06', name: 'sparse', category: 'sparse',
      build: () => grid((r, c) => {
        const blocks = [[3, 3], [3, 15], [15, 3], [15, 15], [C, C]];
        return blocks.some(([br, bc]) => Math.abs(r - br) <= 1 && Math.abs(c - bc) <= 1);
      }),
    },
    { id: 'T07', name: 'dense', category: 'dense', build: () => grid((r, c) => (r + c) % 2 === 0 || (r % 3 === 0 && c % 3 === 0)) },
    {
      id: 'T08', name: 'asymmetric', category: 'asymmetrical',
      build: () => grid((r, c) => {
        const lShape = (c <= 6 && r >= 10 && r <= 18) || (r <= 6 && c >= 10 && c <= 18);
        const dot = Math.hypot(r - 16, c - 16) <= 2.2;
        return lShape || dot;
      }),
    },
  ];

  const TARGETS = DEFINITIONS.map((def) => ({
    id: def.id,
    name: def.name,
    category: def.category,
    size: SIZE,
    matrix: def.build(),
  }));

  function darkFraction(matrix) {
    let dark = 0;
    for (const row of matrix) for (const v of row) if (v) dark++;
    return dark / (matrix.length * matrix.length);
  }

  Object.assign(StegoA4, { TARGETS, TARGET_SIZE: SIZE, darkFraction });
})(typeof globalThis !== 'undefined' ? globalThis : this);
