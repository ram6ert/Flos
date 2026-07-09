/**
 * strEnc.ts — 可读版
 *
 * 这是对原 main.min.js 里 strEnc 的逐行还原重写，输出与原版完全一致。
 * 本质：一个魔改版 DES，用三个硬编码的单字符密钥 "1"、"2"、"3" 依次对
 * 输入字符串做三次 DES 加密（不是标准 3DES 的"加密-解密-加密"，而是三次都加密），
 * 每次处理 4 个字符（用字符的 16 位编码拼成 64 位分组，而不是标准 DES 的 8 字节分组），
 * 最终每个分组输出 16 位十六进制字符串，拼接后作为结果返回。
 *
 * ⚠️ 安全性提示：密钥硬编码在前端、且只有 3 个字符，任何人都能读到源码并解密，
 * 这套东西只能防"裸眼看到明文"，挡不住真正的攻击者，不要当作安全加密使用。
 */

// ---------- DES 用到的各种置换表 ----------
// 这些表的形状和标准 DES 一模一样，只是作用在 64 位（4 个字符 × 16 位）分组上，
// 而不是标准 DES 的 64 位（8 字节）分组。

// 初始置换 IP：64位输入 -> 64位（顺序打乱）
const IP_TABLE = [
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37,
  29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7, 56, 48, 40, 32, 24, 16, 8, 0,
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38,
  30, 22, 14, 6,
];

// 逆初始置换 FP（即 IP^-1）：最后一轮结束后的置换
const FP_TABLE = [
  39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13,
  53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25, 32, 0, 40, 8,
  48, 16, 56, 24,
];

// 扩展置换 E：把右半部分 32 位扩展成 48 位（供轮函数使用）
const E_TABLE = [
  31, 0, 1, 2, 3, 4, 3, 4, 5, 6, 7, 8, 7, 8, 9, 10, 11, 12, 11, 12, 13, 14, 15,
  16, 15, 16, 17, 18, 19, 20, 19, 20, 21, 22, 23, 24, 23, 24, 25, 26, 27, 28,
  27, 28, 29, 30, 31, 0,
];

// P 置换：S 盒输出的 32 位再打乱一次
const P_TABLE = [
  15, 6, 19, 20, 28, 11, 27, 16, 0, 14, 22, 25, 4, 17, 30, 9, 1, 7, 23, 13, 31,
  26, 2, 8, 18, 12, 29, 5, 21, 10, 3, 24,
];

// 密钥的"初始置换"：64 位密钥分组 -> 56 位（本质等价标准 DES 的 PC1，
// 只是标准 PC1 输入 64 位含 8 位奇偶校验位，这里输入本身就是纯 64 位）
const KEY_PC1_TABLE = [
  56, 48, 40, 32, 24, 16, 8, 0, 57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34,
  26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 28, 20, 12, 4,
  61, 53, 45, 37, 29, 21, 13, 5, 62, 54, 46, 38, 30, 22, 14, 6,
];

// 每轮从 56 位中选出 48 位作为该轮子密钥（等价标准 DES 的 PC2）
const KEY_PC2_TABLE = [
  13, 16, 10, 23, 0, 4, 2, 27, 14, 5, 20, 9, 22, 18, 11, 3, 25, 7, 15, 6, 26,
  19, 12, 1, 40, 51, 30, 36, 46, 54, 29, 39, 50, 44, 32, 47, 43, 48, 38, 55,
  33, 52, 45, 41, 49, 35, 28, 31,
];

// 每轮循环左移的位数（16 轮），标准 DES 的移位表
const LEFT_SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

// 8 个 S 盒，每个 4 行 × 16 列
const S_BOXES: number[][][] = [
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  ],
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  ],
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  ],
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  ],
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  ],
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  ],
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  ],
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
  ],
];

// ---------- 工具函数 ----------

/** 按给定的置换表 table，从 input 里挑位组成新数组：output[i] = input[table[i]] */
function permute(input: number[], table: number[]): number[] {
  return table.map((idx) => input[idx]);
}

/** 两个等长 0/1 数组按位异或 */
function xorBits(a: number[], b: number[]): number[] {
  return a.map((bit, i) => bit ^ b[i]);
}

/** 把一个整数（0~15）转成 4 位二进制数组，如 5 -> [0,1,0,1] */
function intTo4Bits(n: number): number[] {
  return [(n >> 3) & 1, (n >> 2) & 1, (n >> 1) & 1, n & 1];
}

/**
 * 把最多 4 个字符编码成 64 位（0/1）数组。
 * 每个字符用它的 charCode 展开成 16 位（高位在前）；不足 4 个字符时用 0 补齐。
 * 这是与标准 DES 最大的不同点：标准 DES 一个分组是 8 字节 = 64 位，
 * 这里是 4 个字符 × 16 位 = 64 位。
 */
function charsToBits64(chars: string): number[] {
  const bits: number[] = [];
  for (let i = 0; i < 4; i++) {
    const code = i < chars.length ? chars.charCodeAt(i) : 0;
    for (let b = 15; b >= 0; b--) {
      bits.push((code >> b) & 1);
    }
  }
  return bits;
}

/** 把密钥字符串按每 4 个字符切成若干块，每块转换成 64 位数组 */
function keyStringToBlocks(key: string): number[][] {
  const blocks: number[][] = [];
  for (let i = 0; i < key.length; i += 4) {
    blocks.push(charsToBits64(key.substring(i, i + 4)));
  }
  return blocks;
}

/** 把 64 位数组转成 16 位十六进制字符串 */
function bits64ToHex(bits: number[]): string {
  let hex = "";
  for (let i = 0; i < 16; i++) {
    const nibble =
      bits[i * 4] * 8 + bits[i * 4 + 1] * 4 + bits[i * 4 + 2] * 2 + bits[i * 4 + 3];
    hex += nibble.toString(16).toUpperCase();
  }
  return hex;
}

// ---------- DES 核心 ----------

/** 由 64 位密钥分组生成 16 轮子密钥，每个子密钥 48 位 */
function generateSubkeys(keyBits64: number[]): number[][] {
  const key56 = permute(keyBits64, KEY_PC1_TABLE);
  let left = key56.slice(0, 28);
  let right = key56.slice(28, 56);

  const subkeys: number[][] = [];
  for (let round = 0; round < 16; round++) {
    const shift = LEFT_SHIFTS[round];
    left = left.slice(shift).concat(left.slice(0, shift));
    right = right.slice(shift).concat(right.slice(0, shift));
    subkeys.push(permute(left.concat(right), KEY_PC2_TABLE));
  }
  return subkeys;
}

/** S 盒代换：48 位输入 -> 32 位输出 */
function sBoxSubstitute(bits48: number[]): number[] {
  const output: number[] = [];
  for (let box = 0; box < 8; box++) {
    const chunk = bits48.slice(box * 6, box * 6 + 6);
    const row = chunk[0] * 2 + chunk[5];
    const col = chunk[1] * 8 + chunk[2] * 4 + chunk[3] * 2 + chunk[4];
    const value = S_BOXES[box][row][col];
    output.push(...intTo4Bits(value));
  }
  return output;
}

/** 轮函数 f：右半部分(32位) + 本轮子密钥(48位) -> 32位 */
function feistelFunction(right32: number[], subkey48: number[]): number[] {
  const expanded = permute(right32, E_TABLE); // 32 -> 48
  const mixed = xorBits(expanded, subkey48); // 与子密钥异或
  const substituted = sBoxSubstitute(mixed); // 48 -> 32 (S盒)
  return permute(substituted, P_TABLE); // P 置换
}

/**
 * 用一个 64 位密钥分组对一个 64 位明文分组做一次完整 DES 加密，
 * 返回 64 位密文分组。
 */
function desEncryptBlock(plainBits64: number[], keyBits64: number[]): number[] {
  const subkeys = generateSubkeys(keyBits64);
  const initial = permute(plainBits64, IP_TABLE);

  let left = initial.slice(0, 32);
  let right = initial.slice(32, 64);

  for (let round = 0; round < 16; round++) {
    const newRight = xorBits(feistelFunction(right, subkeys[round]), left);
    left = right;
    right = newRight;
  }

  // 注意：标准 DES 最后一轮交换 (R16, L16)，这里保持一致
  return permute(right.concat(left), FP_TABLE);
}

/**
 * strEnc 主函数
 * @param text - 待加密的原文
 * @param keys - 依次使用的密钥列表，默认为原版的 ["1","2","3"]
 * @returns 十六进制密文
 */
export function strEnc(text: string, keys: string[] = ["1", "2", "3"]): string {
  const keyBlocksList = keys
    .filter((k) => k != null && k !== "")
    .map((k) => keyStringToBlocks(k));

  let result = "";
  for (let i = 0; i < text.length; i += 4) {
    let block = charsToBits64(text.substring(i, i + 4));
    // 依次用每个密钥的每个 4 字符分块加密（原版行为：密钥再短也会被当一个分块用）
    for (const blocks of keyBlocksList) {
      for (const keyBlock of blocks) {
        block = desEncryptBlock(block, keyBlock);
      }
    }
    result += bits64ToHex(block);
  }
  return result;
}
