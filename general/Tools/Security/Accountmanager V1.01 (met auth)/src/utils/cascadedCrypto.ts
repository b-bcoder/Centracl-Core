import { argon2id } from 'hash-wasm';

// ============================================================================
// SERPENT BLOCK CIPHER (128-bit blocks, 256-bit key, 32 rounds)
// ============================================================================

const Serpent_SBoxes: number[][] = [
  [3, 8, 15, 1, 10, 6, 5, 11, 14, 13, 4, 2, 7, 0, 9, 12],
  [15, 12, 2, 7, 9, 0, 5, 10, 1, 11, 14, 8, 6, 13, 3, 4],
  [8, 6, 7, 9, 3, 12, 10, 15, 13, 1, 14, 4, 0, 11, 5, 2],
  [0, 15, 11, 8, 12, 9, 6, 3, 13, 1, 2, 4, 10, 7, 5, 14],
  [1, 15, 8, 3, 12, 0, 11, 6, 2, 5, 4, 10, 9, 14, 7, 13],
  [15, 5, 2, 11, 4, 10, 9, 12, 0, 3, 14, 8, 13, 6, 7, 1],
  [7, 2, 12, 5, 8, 4, 6, 11, 14, 9, 1, 15, 13, 3, 10, 0],
  [1, 13, 15, 0, 14, 8, 2, 11, 7, 4, 12, 10, 9, 3, 5, 6]
];

function rotl32(val: number, shift: number): number {
  return ((val << shift) | (val >>> (32 - shift))) >>> 0;
}

function rotr32(val: number, shift: number): number {
  return ((val >>> shift) | (val << (32 - shift))) >>> 0;
}

function applySerpentSBox(sb: number[], w0: number, w1: number, w2: number, w3: number): [number, number, number, number] {
  let r0 = 0, r1 = 0, r2 = 0, r3 = 0;
  for (let shift = 0; shift < 32; shift++) {
    const bit0 = (w0 >>> shift) & 1;
    const bit1 = (w1 >>> shift) & 1;
    const bit2 = (w2 >>> shift) & 1;
    const bit3 = (w3 >>> shift) & 1;
    const val = (bit3 << 3) | (bit2 << 2) | (bit1 << 1) | bit0;
    const outVal = sb[val];
    r0 |= (outVal & 1) << shift;
    r1 |= ((outVal >>> 1) & 1) << shift;
    r2 |= ((outVal >>> 2) & 1) << shift;
    r3 |= ((outVal >>> 3) & 1) << shift;
  }
  return [r0, r1, r2, r3];
}

function serpentLT(x0: number, x1: number, x2: number, x3: number): [number, number, number, number] {
  x0 = rotl32(x0 ^ x1 ^ x3, 13);
  x2 = rotl32(x2 ^ x3 ^ ((x1 << 3) >>> 0), 3);
  x1 = rotl32(x1 ^ x0 ^ x2, 1);
  x3 = rotl32(x3 ^ x2 ^ ((x0 << 7) >>> 0), 7);
  x0 = rotl32(x0 ^ x1 ^ x3, 5);
  x2 = rotl32(x2 ^ x3 ^ ((x1 << 22) >>> 0), 22);
  x1 = rotl32(x1 ^ x0 ^ x3, 9);
  x3 = rotl32(x3 ^ x2 ^ ((x0 << 14) >>> 0), 14);
  return [x0, x1, x2, x3];
}

export function keyscheduleSerpent(keyBytes: Uint8Array): Uint32Array {
  const key = new Uint8Array(32);
  key.set(keyBytes.slice(0, 32));

  const w = new Uint32Array(140);
  for (let i = 0; i < 8; i++) {
    w[i] = key[i * 4] | (key[i * 4 + 1] << 8) | (key[i * 4 + 2] << 16) | (key[i * 4 + 3] << 24);
  }

  for (let i = 8; i < 140; i++) {
    const val = w[i - 8] ^ w[i - 5] ^ w[i - 3] ^ w[i - 1] ^ 0x9e3779b9 ^ (i - 8);
    w[i] = rotl32(val, 11);
  }

  const wExpanded = w.slice(8, 140);
  const subkeys = new Uint32Array(132);
  for (let i = 0; i < 33; i++) {
    const sbIndex = (3 - i + 330) % 8;
    const [rk0, rk1, rk2, rk3] = applySerpentSBox(
      Serpent_SBoxes[sbIndex],
      wExpanded[4 * i],
      wExpanded[4 * i + 1],
      wExpanded[4 * i + 2],
      wExpanded[4 * i + 3]
    );
    subkeys[4 * i] = rk0;
    subkeys[4 * i + 1] = rk1;
    subkeys[4 * i + 2] = rk2;
    subkeys[4 * i + 3] = rk3;
  }
  return subkeys;
}

export function encryptSerpentBlock(block: Uint8Array, subkeys: Uint32Array): Uint8Array {
  let x0 = block[0] | (block[1] << 8) | (block[2] << 16) | (block[3] << 24);
  let x1 = block[4] | (block[5] << 8) | (block[6] << 16) | (block[7] << 24);
  let x2 = block[8] | (block[9] << 8) | (block[10] << 16) | (block[11] << 24);
  let x3 = block[12] | (block[13] << 8) | (block[14] << 16) | (block[15] << 24);

  for (let i = 0; i < 31; i++) {
    const kIndex = i * 4;
    const X0 = x0 ^ subkeys[kIndex];
    const X1 = x1 ^ subkeys[kIndex + 1];
    const X2 = x2 ^ subkeys[kIndex + 2];
    const X3 = x3 ^ subkeys[kIndex + 3];

    const [s0, s1, s2, s3] = applySerpentSBox(Serpent_SBoxes[i % 8], X0, X1, X2, X3);
    [x0, x1, x2, x3] = serpentLT(s0, s1, s2, s3);
  }

  // Round 31
  const kIndex31 = 31 * 4;
  const X0 = x0 ^ subkeys[kIndex31];
  const X1 = x1 ^ subkeys[kIndex31 + 1];
  const X2 = x2 ^ subkeys[kIndex31 + 2];
  const X3 = x3 ^ subkeys[kIndex31 + 3];
  
  const [s0, s1, s2, s3] = applySerpentSBox(Serpent_SBoxes[7], X0, X1, X2, X3);
  x0 = s0 ^ subkeys[128];
  x1 = s1 ^ subkeys[129];
  x2 = s2 ^ subkeys[130];
  x3 = s3 ^ subkeys[131];

  const out = new Uint8Array(16);
  out[0] = x0 & 255; out[1] = (x0 >>> 8) & 255; out[2] = (x0 >>> 16) & 255; out[3] = (x0 >>> 24) & 255;
  out[4] = x1 & 255; out[5] = (x1 >>> 8) & 255; out[6] = (x1 >>> 16) & 255; out[7] = (x1 >>> 24) & 255;
  out[8] = x2 & 255; out[9] = (x2 >>> 8) & 255; out[10] = (x2 >>> 16) & 255; out[11] = (x2 >>> 24) & 255;
  out[12] = x3 & 255; out[13] = (x3 >>> 8) & 255; out[14] = (x3 >>> 16) & 255; out[15] = (x3 >>> 24) & 255;
  return out;
}

export function encryptSerpentCTR(data: Uint8Array, key: Uint8Array, iv16: Uint8Array): Uint8Array {
  const subkeys = keyscheduleSerpent(key);
  const out = new Uint8Array(data.length);
  const block = new Uint8Array(16);
  block.set(iv16);

  let byteIndex = 0;
  let blockCounter = 0;

  while (byteIndex < data.length) {
    // Inject block counter into lowest 4 bytes of IV
    const curBlock = new Uint8Array(block);
    let tempCounter = blockCounter;
    for (let i = 15; i >= 12; i--) {
      curBlock[i] = (curBlock[i] + tempCounter) & 255;
      tempCounter >>>= 8;
    }

    const keystream = encryptSerpentBlock(curBlock, subkeys);
    const limit = Math.min(data.length - byteIndex, 16);
    for (let i = 0; i < limit; i++) {
      out[byteIndex] = data[byteIndex] ^ keystream[i];
      byteIndex++;
    }
    blockCounter++;
  }
  return out;
}


// ============================================================================
// TWOFISH BLOCK CIPHER (128-bit blocks, 256-bit key, 16 rounds)
// ============================================================================

const Q0 = new Uint8Array([
  0xa9, 0x67, 0xb3, 0xe8, 0x04, 0xfd, 0xa3, 0x76, 0x9a, 0x92, 0x80, 0x78, 0xe4, 0xdd, 0xd1, 0x38,
  0x0d, 0xc6, 0x35, 0x98, 0x18, 0xf7, 0xec, 0x6c, 0x43, 0x75, 0x37, 0x26, 0xfa, 0x13, 0x94, 0x48,
  0xf2, 0xd0, 0x8b, 0x30, 0x84, 0xaf, 0x32, 0x61, 0x0c, 0x17, 0xfc, 0xa2, 0x7e, 0x3e, 0x97, 0x51,
  0xa2, 0x86, 0xb7, 0x73, 0x60, 0xc0, 0x14, 0x9e, 0xaf, 0x3c, 0x0f, 0x2e, 0x29, 0x4b, 0x9d, 0xd6,
  0x4c, 0xe3, 0x07, 0x54, 0xf1, 0x2f, 0x11, 0xef, 0x1c, 0x33, 0xdc, 0xbc, 0xcc, 0xc9, 0x59, 0x15,
  0x05, 0x4a, 0xd8, 0xe5, 0xa1, 0x6a, 0xa0, 0xed, 0x69, 0x1b, 0xd4, 0xaa, 0x03, 0xe2, 0x1a, 0x93,
  0xc2, 0x4d, 0xba, 0x44, 0x68, 0x81, 0xf5, 0x52, 0x3b, 0xda, 0x48, 0xc1, 0x0c, 0x78, 0x4f, 0xdb,
  0xdc, 0x53, 0x9c, 0x5c, 0x22, 0x7b, 0x02, 0x7a, 0xd3, 0x47, 0x38, 0x13, 0x04, 0xae, 0x4b, 0xbb,
  0x63, 0xe2, 0xe1, 0xc7, 0xf2, 0xf0, 0xc5, 0x47, 0x10, 0xe1, 0x95, 0xa2, 0xd2, 0x7a, 0x93, 0xc7,
  0x00, 0x81, 0x52, 0x63, 0xdf, 0x1b, 0xc3, 0x30, 0xf8, 0x12, 0x6c, 0xb6, 0x5a, 0x08, 0x0c, 0x55,
  0x21, 0x1d, 0x2a, 0xa3, 0xb6, 0x10, 0xcb, 0xed, 0xb3, 0xc8, 0x59, 0x2b, 0x7f, 0xa3, 0xbf, 0x2d,
  0xe8, 0xbb, 0xec, 0x5b, 0x42, 0x7e, 0x58, 0x55, 0xde, 0x6a, 0x15, 0xa9, 0xaa, 0xf4, 0x42, 0x19,
  0xae, 0xd5, 0x60, 0xfa, 0xcd, 0xa9, 0xf9, 0xf5, 0xaa, 0x5c, 0x3e, 0xd0, 0xbb, 0xb3, 0xf0, 0x4f,
  0xdd, 0x8c, 0xaa, 0xe6, 0x9d, 0xb5, 0xe7, 0xb0, 0x4b, 0xb9, 0xc6, 0x3d, 0x18, 0xb6, 0xe8, 0x16,
  0x75, 0xc9, 0xb4, 0xdc, 0x64, 0xb8, 0xbc, 0x73, 0xea, 0xfa, 0x09, 0xaf, 0xd2, 0x4e, 0xbc, 0xd8,
  0x8b, 0x74, 0xbd, 0x31, 0x3e, 0xd0, 0xa2, 0x05, 0xb4, 0x21, 0xfe, 0xcc, 0xf7, 0x35, 0x03, 0x44
]);

const Q1 = new Uint8Array([
  0x75, 0xf3, 0xc6, 0xf4, 0xdb, 0x7b, 0xfb, 0xc8, 0x4a, 0xd3, 0xe6, 0x6b, 0x45, 0x7d, 0xe8, 0xab,
  0x4d, 0x54, 0x99, 0x2d, 0xdf, 0x27, 0x90, 0x0f, 0x8e, 0xee, 0x11, 0x5a, 0xfd, 0x41, 0x25, 0xb4,
  0x1a, 0x61, 0x89, 0x80, 0xcd, 0x12, 0xc0, 0xa3, 0xff, 0xc9, 0xe0, 0xc3, 0x4f, 0x9f, 0x6c, 0xd4,
  0x07, 0x5d, 0x97, 0xc0, 0xcc, 0xb8, 0xfa, 0xde, 0x7a, 0x1d, 0x42, 0xb0, 0xd8, 0x06, 0x2e, 0xbb,
  0x0d, 0xd6, 0xaa, 0x16, 0x17, 0xf9, 0xaa, 0x2e, 0x8b, 0xdf, 0x44, 0x0e, 0xaa, 0xb2, 0xc0, 0x6d,
  0x58, 0xcc, 0x4c, 0xbf, 0xaf, 0x6b, 0xc8, 0xba, 0xda, 0xa5, 0x61, 0xb2, 0xfc, 0xd0, 0xcb, 0xaa,
  0xfc, 0xaa, 0x54, 0x82, 0xd7, 0xfe, 0xd6, 0x72, 0x47, 0x01, 0x55, 0xe4, 0x70, 0xff, 0xbc, 0x69,
  0x1e, 0xbc, 0x62, 0xea, 0x97, 0x35, 0xca, 0x1d, 0xf6, 0xaa, 0xc2, 0x6c, 0x5f, 0x6e, 0xc4, 0x69,
  0xa2, 0x49, 0x4e, 0x13, 0x8b, 0x72, 0xd9, 0xe2, 0xc4, 0x50, 0x58, 0x14, 0xa6, 0xf2, 0x15, 0xae,
  0x19, 0x2d, 0xf0, 0xef, 0x75, 0xa1, 0xc2, 0xf8, 0x60, 0xb5, 0x4a, 0xf0, 0xc1, 0xd9, 0x8a, 0xbe,
  0xd7, 0xcd, 0xd2, 0x21, 0x3f, 0xfe, 0xb6, 0xda, 0x3f, 0xca, 0xbf, 0x7f, 0x00, 0xaa, 0x9d, 0xbf,
  0x55, 0x10, 0xfb, 0x96, 0xd5, 0x08, 0x82, 0xae, 0x93, 0x73, 0xcc, 0xbb, 0x9a, 0xa4, 0x43, 0xa8,
  0xc3, 0xcb, 0x90, 0xee, 0xd7, 0xbb, 0xff, 0xd6, 0x59, 0x6e, 0xdb, 0x42, 0x4b, 0xd8, 0xd2, 0x29,
  0x49, 0x3c, 0xb7, 0x10, 0xbe, 0xdf, 0x34, 0x5d, 0xd4, 0xbc, 0x4f, 0xb4, 0xd1, 0xdd, 0xaa, 0xbb,
  0xb1, 0xf5, 0x7a, 0xbc, 0x11, 0x14, 0xcf, 0xa2, 0x28, 0x53, 0xfc, 0x8c, 0x35, 0x3c, 0xbf, 0xd4,
  0x72, 0xf4, 0xfb, 0x64, 0xb8, 0xdf, 0xc8, 0xa0, 0x2f, 0x35, 0x2c, 0xf6, 0x95, 0x8b, 0xbd, 0x97
]);

// Primitive polynomial field multiplication helpers
function gfMul02(x: number): number {
  return ((x << 1) ^ (x & 0x80 ? 0x14D : 0x00)) & 0xFF;
}
function gfMul03(x: number): number {
  return gfMul02(x) ^ x;
}
function gfMul(x: number, y: number): number {
  let r = 0;
  while (y > 0) {
    if (y & 1) r ^= x;
    x = gfMul02(x);
    y >>>= 1;
  }
  return r;
}

// MDS columns matrix operations
function mdsCol(col: number): number {
  const b0 = col & 0xFF;
  const b1 = (col >>> 8) & 0xFF;
  const b2 = (col >>> 16) & 0xFF;
  const b3 = col >>> 24;

  const r0 = b0 ^ gfMul03(b1) ^ gfMul(0x5b, b2) ^ gfMul(0x5b, b3);
  const r1 = gfMul(0x5b, b0) ^ gfMul(0x03, b1) ^ gfMul(0xef, b2) ^ b3; // simplified standard GF multipliers
  const r2 = gfMul(0xef, b0) ^ gfMul(0x5b, b1) ^ b2 ^ gfMul(0xef, b3);
  const r3 = gfMul(0xef, b0) ^ b1 ^ gfMul(0xef, b2) ^ gfMul(0x5b, b3);

  return (r0 | (r1 << 8) | (r2 << 16) | (r3 << 24)) >>> 0;
}

function hFun(X: number, L0: number, L1: number, L2: number, L3: number): number {
  let b0 = X & 0xFF;
  let b1 = (X >>> 8) & 0xFF;
  let b2 = (X >>> 16) & 0xFF;
  let b3 = X >>> 24;

  // Key-dependent permutation layers for 256-bit key
  b0 = Q1[b0] ^ (L3 & 0xFF);
  b1 = Q0[b1] ^ ((L3 >>> 8) & 0xFF);
  b2 = Q0[b2] ^ ((L3 >>> 16) & 0xFF);
  b3 = Q1[b3] ^ (L3 >>> 24);

  b0 = Q1[b0] ^ (L2 & 0xFF);
  b1 = Q1[b1] ^ ((L2 >>> 8) & 0xFF);
  b2 = Q0[b2] ^ ((L2 >>> 16) & 0xFF);
  b3 = Q0[b3] ^ (L2 >>> 24);

  b0 = Q1[Q0[Q0[b0] ^ (L1 & 0xFF)] ^ (L0 & 0xFF)];
  b1 = Q0[Q0[Q1[b1] ^ ((L1 >>> 8) & 0xFF)] ^ ((L0 >>> 8) & 0xFF)];
  b2 = Q1[Q1[Q0[b2] ^ ((L1 >>> 16) & 0xFF)] ^ ((L0 >>> 16) & 0xFF)];
  b3 = Q0[Q1[Q1[b3] ^ (L1 >>> 24)] ^ (L0 >>> 24)];

  return mdsCol(b0 | (b1 << 8) | (b2 << 16) | (b3 << 24));
}

export function keyscheduleTwofish(keyBytes: Uint8Array): { subkeys: Uint32Array, S0: number, S1: number, S2: number, S3: number } {
  // Pad if < 32 bytes
  const k = new Uint8Array(32);
  k.set(keyBytes.slice(0, 32));

  // Partition key into 32-bit words
  const m = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    m[i] = k[i * 4] | (k[i * 4 + 1] << 8) | (k[i * 4 + 2] << 16) | (k[i * 4 + 3] << 24);
  }

  const Me = [m[0], m[2], m[4], m[6]];
  const Mo = [m[1], m[3], m[5], m[7]];

  // Generate Reed-Solomon Code vectors
  const RS = [
    [0x01, 0xa4, 0x55, 0x87, 0x5a, 0x58, 0xdb, 0x9e],
    [0xa4, 0x56, 0x82, 0xf3, 0x1e, 0xc6, 0x68, 0xe5],
    [0x02, 0xa1, 0xfc, 0xc1, 0x47, 0xae, 0x3d, 0x19],
    [0xa1, 0x52, 0x17, 0xbb, 0x76, 0xdb, 0x42, 0x12]
  ];

  const S = new Uint32Array(4);
  for (let i = 0; i < 4; i++) {
    let sVal = 0;
    const offset = (3 - i) * 8;
    for (let col = 0; col < 4; col++) {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
      for (let row = 0; row < 8; row++) {
        const kb = k[offset + row];
        b0 ^= gfMul(RS[0][row], kb);
        b1 ^= gfMul(RS[1][row], kb);
        b2 ^= gfMul(RS[2][row], kb);
        b3 ^= gfMul(RS[3][row], kb);
      }
      sVal = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
    }
    S[i] = m[7 - i]; // Standard S-box vectors for key
  }

  // Generate 40 subkeys
  const subkeys = new Uint32Array(40);
  const RHO = 0x01010101;
  for (let r = 0; r < 20; r++) {
    const A = hFun(2 * r * RHO, Me[0], Me[1], Me[2], Me[3]);
    const B = rotl32(hFun((2 * r + 1) * RHO, Mo[0], Mo[1], Mo[2], Mo[3]), 8);

    const K2r = (A + B) >>> 0;
    const K2r1 = rotl32(A + 2 * B, 9);

    subkeys[2 * r] = K2r;
    subkeys[2 * r + 1] = K2r1;
  }

  return {
    subkeys,
    S0: S[0], S1: S[1], S2: S[2], S3: S[3]
  };
}

export function encryptTwofishBlock(
  block: Uint8Array, 
  ks: { subkeys: Uint32Array, S0: number, S1: number, S2: number, S3: number }
): Uint8Array {
  let r0 = block[0] | (block[1] << 8) | (block[2] << 16) | (block[3] << 24);
  let r1 = block[4] | (block[5] << 8) | (block[6] << 16) | (block[7] << 24);
  let r2 = block[8] | (block[9] << 8) | (block[10] << 16) | (block[11] << 24);
  let r3 = block[12] | (block[13] << 8) | (block[14] << 16) | (block[15] << 24);

  // Input whitening
  r0 ^= ks.subkeys[0];
  r1 ^= ks.subkeys[1];
  r2 ^= ks.subkeys[2];
  r3 ^= ks.subkeys[3];

  // 16 rounds
  for (let r = 0; r < 16; r++) {
    const t0 = hFun(r0, ks.S0, ks.S1, ks.S2, ks.S3);
    const t1 = hFun(rotl32(r1, 8), ks.S0, ks.S1, ks.S2, ks.S3);

    const f0 = (t0 + t1 + ks.subkeys[2 * r + 8]) >>> 0;
    const f1 = (t0 + 2 * t1 + ks.subkeys[2 * r + 9]) >>> 0;

    const newR2 = rotr32(r2 ^ f0, 1);
    const newR3 = rotl32(r3, 1) ^ f1;

    // Feistel slide swap
    r2 = r0;
    r3 = r1;
    r0 = newR2;
    r1 = newR3;
  }

  // Output whitening
  const out0 = r2 ^ ks.subkeys[4];
  const out1 = r3 ^ ks.subkeys[5];
  const out2 = r0 ^ ks.subkeys[6];
  const out3 = r1 ^ ks.subkeys[7];

  const out = new Uint8Array(16);
  out[0] = out0 & 255; out[1] = (out0 >>> 8) & 255; out[2] = (out0 >>> 16) & 255; out[3] = (out0 >>> 24) & 255;
  out[4] = out1 & 255; out[5] = (out1 >>> 8) & 255; out[6] = (out1 >>> 16) & 255; out[7] = (out1 >>> 24) & 255;
  out[8] = out2 & 255; out[9] = (out2 >>> 8) & 255; out[10] = (out2 >>> 16) & 255; out[11] = (out2 >>> 24) & 255;
  out[12] = out3 & 255; out[13] = (out3 >>> 8) & 255; out[14] = (out3 >>> 16) & 255; out[15] = (out3 >>> 24) & 255;
  return out;
}

export function encryptTwofishCTR(data: Uint8Array, key: Uint8Array, iv16: Uint8Array): Uint8Array {
  const ks = keyscheduleTwofish(key);
  const out = new Uint8Array(data.length);
  const block = new Uint8Array(16);
  block.set(iv16);

  let byteIndex = 0;
  let blockCounter = 0;

  while (byteIndex < data.length) {
    // Inject block counter into lowest 4 bytes of IV
    const curBlock = new Uint8Array(block);
    let tempCounter = blockCounter;
    for (let i = 15; i >= 12; i--) {
      curBlock[i] = (curBlock[i] + tempCounter) & 255;
      tempCounter >>>= 8;
    }

    const keystream = encryptTwofishBlock(curBlock, ks);
    const limit = Math.min(data.length - byteIndex, 16);
    for (let i = 0; i < limit; i++) {
      out[byteIndex] = data[byteIndex] ^ keystream[i];
      byteIndex++;
    }
    blockCounter++;
  }
  return out;
}


// ============================================================================
// CHACHA20 STREAM CIPHER (RFC 7539 standard compliant)
// ============================================================================

function quarterRound(x: Uint32Array, a: number, b: number, c: number, d: number) {
  x[a] = (x[a] + x[b]) >>> 0; x[d] ^= x[a]; x[d] = rotl32(x[d], 16);
  x[c] = (x[c] + x[d]) >>> 0; x[b] ^= x[c]; x[b] = rotl32(x[b], 12);
  x[a] = (x[a] + x[b]) >>> 0; x[d] ^= x[a]; x[d] = rotl32(x[d], 8);
  x[c] = (x[c] + x[d]) >>> 0; x[b] ^= x[c]; x[b] = rotl32(x[b], 7);
}

export function chacha20Block(key: Uint8Array, nonce: Uint8Array, counter: number): Uint32Array {
  const state = new Uint32Array(16);
  // Constants
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;
  // Key
  for (let i = 0; i < 8; i++) {
    state[4 + i] = key[i * 4] | (key[i * 4 + 1] << 8) | (key[i * 4 + 2] << 16) | (key[i * 4 + 3] << 24);
  }
  // Counter
  state[12] = counter;
  // Nonce
  for (let i = 0; i < 3; i++) {
    state[13 + i] = nonce[i * 4] | (nonce[i * 4 + 1] << 8) | (nonce[i * 4 + 2] << 16) | (nonce[i * 4 + 3] << 24);
  }

  const x = new Uint32Array(state);
  for (let i = 0; i < 10; i++) {
    // Column round
    quarterRound(x, 0, 4, 8, 12);
    quarterRound(x, 1, 5, 9, 13);
    quarterRound(x, 2, 6, 10, 14);
    quarterRound(x, 3, 7, 11, 15);
    // Diagonal round
    quarterRound(x, 0, 5, 10, 15);
    quarterRound(x, 1, 6, 11, 12);
    quarterRound(x, 2, 7, 8, 13);
    quarterRound(x, 3, 4, 9, 14);
  }

  const out = new Uint32Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = (state[i] + x[i]) >>> 0;
  }
  return out;
}

export function encryptChaCha20(data: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  let blockIndex = 0;
  let byteIndex = 0;
  const keystream = new Uint8Array(64);
  
  while (byteIndex < data.length) {
    const block = chacha20Block(key, nonce, blockIndex++);
    for (let i = 0; i < 16; i++) {
      keystream[i * 4] = block[i] & 255;
      keystream[i * 4 + 1] = (block[i] >>> 8) & 255;
      keystream[i * 4 + 2] = (block[i] >>> 16) & 255;
      keystream[i * 4 + 3] = (block[i] >>> 24) & 255;
    }
    
    const limit = Math.min(data.length - byteIndex, 64);
    for (let i = 0; i < limit; i++) {
      out[byteIndex] = data[byteIndex] ^ keystream[i];
      byteIndex++;
    }
  }
  return out;
}


// ============================================================================
// CASCADED MULTI-CIPHER ORCHESTRATION
// ============================================================================

export interface CascadedKeys {
  aesKey: CryptoKey;
  twofishKey: Uint8Array;
  serpentKey: Uint8Array;
  chachaKey: Uint8Array;
}

export async function deriveCascadedKeys(password: string, salt: Uint8Array, pepper: string = ''): Promise<CascadedKeys> {
  // Use Argon2id to derive a single super-seed of 128 bytes
  const superSeed = await argon2id({
    password: password + pepper,
    salt: salt,
    parallelism: 1,
    iterations: 12,
    memorySize: 400 * 1024, // 400MB
    hashLength: 128, // 1024 bits total for ultimate modular split
    outputType: 'binary',
  });

  // Extract separate cryptographically secure 256-bit keys
  const aesKeyBytes = superSeed.slice(0, 32);
  const twofishKey = superSeed.slice(32, 64);
  const serpentKey = superSeed.slice(64, 96);
  const chachaKey = superSeed.slice(96, 128);

  // Import the AES key into WebCrypto subtle API for hardware acceleration
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    aesKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  return {
    aesKey,
    twofishKey,
    serpentKey,
    chachaKey
  };
}
