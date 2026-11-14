/* cine-tuning.js · 单招手调覆盖层（手写，生成器不会覆盖）
 * 格式：{ version:1, arts: { "sword_3": { tier:"burst", palette:"gold", trails:4 } } }
 * 可用键：tier(calm/standard/burst) skeleton(slash/pierce/aura/step)
 *         palette(auto/自定对象) motif trails arcs glow ghostLen len notes
 * 游戏内范围单招微调：gameScale(默认 0.48，0.25~1) 整招缩放；
 *                     gameRay(默认 0.55，0.2~1) 放射速度线保留比例。
 * 单招开关：enabled:false 让该招退回游戏原本的刀光（演武数据仍保留，可随时改回）。
 * 例：{ "sword_3": { "gameScale": 0.40, "gameRay": 0.45 } } 会更贴身、更收束。
 * 例：{ "mage_3": { "enabled": false } } 环身技改用原本刀光。
 * 只写要改的字段，其余沿用目录。改完刷新页面即可，不用重跑生成器。
 */
(function () {
  'use strict';
  // sword_1 是用户认可的首版样板（34 帧五阶亮芯），按 prof 本该是克制档，
  // 这里单招提到爆发档保住观感 —— 也正好演示覆盖层怎么用。
  var TUNING = { version: 1, arts: {
  "sword_1": {
    "tier": "burst",
    "dnaTweak": 3
  },
  "sword_2": {
    "dnaTweak": 10
  },
  "sword_3": {
    "dnaTweak": 10
  },
  "sword_4": {
    "dnaTweak": 6
  },
  "sword_5": {
    "dnaTweak": 5
  },
  "sword_6": {
    "dnaTweak": 1
  },
  "sword_7": {
    "dnaTweak": 9
  },
  "sword_8": {
    "dnaTweak": 10
  },
  "blade_1": {
    "dnaTweak": 8
  },
  "blade_2": {
    "dnaTweak": 7
  },
  "blade_3": {
    "dnaTweak": 7
  },
  "blade_4": {
    "dnaTweak": 8
  },
  "blade_6": {
    "dnaTweak": 2
  },
  "blade_7": {
    "dnaTweak": 1
  },
  "spear_1": {
    "dnaTweak": 3
  },
  "spear_2": {
    "dnaTweak": 8
  },
  "spear_3": {
    "dnaTweak": 11
  },
  "spear_4": {
    "dnaTweak": 7
  },
  "spear_5": {
    "dnaTweak": 7
  },
  "spear_6": {
    "dnaTweak": 5
  },
  "spear_7": {
    "dnaTweak": 1
  },
  "spear_8": {
    "dnaTweak": 2
  },
  "staff_2": {
    "dnaTweak": 11
  },
  "staff_3": {
    "dnaTweak": 9
  },
  "staff_4": {
    "dnaTweak": 2
  },
  "staff_5": {
    "dnaTweak": 8
  },
  "staff_6": {
    "dnaTweak": 1
  },
  "staff_7": {
    "dnaTweak": 9
  },
  "staff_8": {
    "dnaTweak": 5
  },
  "dual_1": {
    "dnaTweak": 3
  },
  "dual_2": {
    "dnaTweak": 3
  },
  "dual_3": {
    "dnaTweak": 7
  },
  "dual_4": {
    "dnaTweak": 2
  },
  "dual_6": {
    "dnaTweak": 3
  },
  "dual_7": {
    "dnaTweak": 2
  },
  "dual_8": {
    "dnaTweak": 5
  },
  "hammer_1": {
    "dnaTweak": 4
  },
  "hammer_3": {
    "dnaTweak": 5
  },
  "hammer_5": {
    "dnaTweak": 2
  },
  "hammer_6": {
    "dnaTweak": 6
  },
  "hammer_7": {
    "dnaTweak": 1
  },
  "hammer_8": {
    "dnaTweak": 5
  },
  "mage_1": {
    "dnaTweak": 4
  },
  "mage_2": {
    "dnaTweak": 5
  },
  "mage_3": {
    "dnaTweak": 5
  },
  "mage_4": {
    "dnaTweak": 7
  },
  "mage_5": {
    "dnaTweak": 9
  },
  "mage_6": {
    "dnaTweak": 3
  },
  "mage_7": {
    "dnaTweak": 3
  },
  "mage_8": {
    "dnaTweak": 10
  },
  "dart_1": {
    "dnaTweak": 1
  },
  "dart_2": {
    "dnaTweak": 8
  },
  "dart_3": {
    "dnaTweak": 3
  },
  "dart_4": {
    "dnaTweak": 3
  },
  "dart_5": {
    "dnaTweak": 8
  },
  "dart_6": {
    "dnaTweak": 9
  },
  "dart_7": {
    "dnaTweak": 5
  },
  "dart_8": {
    "dnaTweak": 4
  },
  "chain_2": {
    "dnaTweak": 9
  },
  "chain_3": {
    "dnaTweak": 7
  },
  "chain_4": {
    "dnaTweak": 3
  },
  "chain_5": {
    "dnaTweak": 3
  },
  "chain_6": {
    "dnaTweak": 3
  },
  "chain_7": {
    "dnaTweak": 3
  },
  "chain_8": {
    "dnaTweak": 7
  },
  "fan_1": {
    "dnaTweak": 11
  },
  "fan_2": {
    "dnaTweak": 5
  },
  "fan_3": {
    "dnaTweak": 9
  },
  "fan_4": {
    "dnaTweak": 3
  },
  "fan_5": {
    "dnaTweak": 5
  },
  "fan_6": {
    "dnaTweak": 7
  },
  "fan_7": {
    "dnaTweak": 6
  },
  "fan_8": {
    "dnaTweak": 3
  }
} };
  if (typeof globalThis !== 'undefined') globalThis.CINE_TUNING = TUNING;
  if (typeof window !== 'undefined') window.CINE_TUNING = TUNING;
  if (typeof module !== 'undefined' && module.exports) module.exports = TUNING;
})();
