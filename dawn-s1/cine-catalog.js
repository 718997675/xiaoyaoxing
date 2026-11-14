/* cine-catalog.js · 自动生成，别手改。改规则请跑 tools/gen-cine-catalog.js
 * 手调单招请写进 cine-tuning.js（覆盖层），重跑生成器不会丢。
 * 经典脚本 / CommonJS 双兼容：浏览器挂全局，Node 走 module.exports。
 */
(function () {
  'use strict';
  var CATALOG = {
 "version": 1,
 "count": 80,
 "arts": {
  "sword_1": {
   "id": "sword_1",
   "name": "破锋式",
   "fam": "sword",
   "fx": "melee",
   "slot": "dmg",
   "prof": 1,
   "shape": "arc",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "lunge",
    "a0": -2.45,
    "a1": -0.95,
    "dur": 0.28,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#E8DFC8",
    "#C9BFA3"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 2574359709
  },
  "sword_2": {
   "id": "sword_2",
   "name": "连环刺",
   "fam": "sword",
   "fx": "melee",
   "slot": "dmg",
   "prof": 2,
   "shape": "thrust",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "thrust",
    "a0": -1.95,
    "a1": -0.65,
    "dur": 0.22,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#9BD4CC",
    "#5FA8A0"
   ],
   "reach": 38,
   "arc": 1,
   "hits": 3,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 1941896119
  },
  "sword_3": {
   "id": "sword_3",
   "name": "剑气斩",
   "fam": "sword",
   "fx": "proj",
   "slot": "aoe",
   "prof": 3,
   "shape": "ring",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "swing",
    "a0": -1.06,
    "a1": -0.25,
    "dur": 0.3,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#FFFFFF",
    "#5FA8A0"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "pierce",
   "seed": 297499273
  },
  "sword_4": {
   "id": "sword_4",
   "name": "剑雨",
   "fam": "sword",
   "fx": "bolt",
   "slot": "aoe",
   "prof": 5,
   "shape": "lanceLong",
   "shapeK": "lance",
   "shapeSpec": {
    "k": "lance",
    "len": 1.35,
    "w": 2.4
   },
   "pose": {
    "mode": "lungeHigh",
    "a0": -0.28,
    "a1": 0.3,
    "dur": 0.44,
    "ease": "in"
   },
   "poseK": "lunge",
   "poseSpec": {
    "k": "lunge",
    "off": 18
   },
   "color": [
    "#C0A8E0",
    "#8A6FC4"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 8,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "pierce",
   "seed": 973256686
  },
  "sword_5": {
   "id": "sword_5",
   "name": "御剑突进",
   "fam": "sword",
   "fx": "dash",
   "slot": "move",
   "prof": 6,
   "shape": "lanceShort",
   "shapeK": "lance",
   "shapeSpec": {
    "k": "lance",
    "len": 0.7,
    "w": 2
   },
   "pose": {
    "mode": "lungeLow",
    "a0": 0.1,
    "a1": 0.1,
    "dur": 0.26,
    "ease": "out"
   },
   "poseK": "lunge",
   "poseSpec": {
    "k": "lunge",
    "off": 8,
    "angAdd": 0.416
   },
   "color": [
    "#F2D089",
    "#D9A441"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "step",
   "seed": 493742502
  },
  "sword_6": {
   "id": "sword_6",
   "name": "定身剑",
   "fam": "sword",
   "fx": "melee",
   "slot": "ctrl",
   "prof": 8,
   "shape": "lanceWide",
   "shapeK": "lance",
   "shapeSpec": {
    "k": "lance",
    "len": 1,
    "w": 3.4
   },
   "pose": {
    "mode": "thrustLong",
    "a0": 0.6,
    "a1": 1.1,
    "dur": 0.32,
    "ease": "out"
   },
   "poseK": "thrust",
   "poseSpec": {
    "k": "thrust",
    "off": 14,
    "angAdd": 0.344
   },
   "color": [
    "#5FA8A0",
    "#2F6E6A"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "slash",
   "seed": 507346028
  },
  "sword_7": {
   "id": "sword_7",
   "name": "剑心通明",
   "fam": "sword",
   "fx": "buff",
   "slot": "buff",
   "prof": 10,
   "shape": "arcUp",
   "shapeK": "arc",
   "shapeSpec": {
    "k": "arc",
    "tilt": -0.55,
    "wide": 0.95,
    "r": 1,
    "rays": 3
   },
   "pose": {
    "mode": "thrustShort",
    "a0": 1.15,
    "a1": 1.5,
    "dur": 0.4,
    "ease": "in"
   },
   "poseK": "thrust",
   "poseSpec": {
    "k": "thrust",
    "off": 5,
    "angAdd": 0.172
   },
   "color": [
    "#D9A441",
    "#8A6520"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "burst",
   "skeleton": "aura",
   "seed": 547495558
  },
  "sword_8": {
   "id": "sword_8",
   "name": "万剑归宗",
   "fam": "sword",
   "fx": "orbit",
   "slot": "special",
   "prof": 4,
   "shape": "arcDown",
   "shapeK": "arc",
   "shapeSpec": {
    "k": "arc",
    "tilt": 0.55,
    "wide": 0.95,
    "r": 1,
    "rays": 3
   },
   "pose": {
    "mode": "sweepHigh",
    "a0": -0.95,
    "a1": 0.4,
    "dur": 0.62,
    "ease": "in"
   },
   "poseK": "swing",
   "poseSpec": {
    "k": "swing",
    "off": 3
   },
   "color": [
    "#E8806F",
    "#C8453B"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 12,
   "dur": 6,
   "tier": "calm",
   "skeleton": "aura",
   "seed": 1907813139
  },
  "blade_1": {
   "id": "blade_1",
   "name": "力劈",
   "fam": "blade",
   "fx": "melee",
   "slot": "dmg",
   "prof": 2,
   "shape": "overheadArc",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "overhead",
    "a0": -1.9,
    "a1": -0.3,
    "dur": 0.34,
    "ease": "in"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#FFFFFF",
    "#12161F"
   ],
   "reach": 36,
   "arc": 1.8,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 429153672
  },
  "blade_2": {
   "id": "blade_2",
   "name": "血刃",
   "fam": "blade",
   "fx": "melee",
   "slot": "dmg",
   "prof": 1,
   "shape": "cleave",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "sideSwing",
    "a0": -2.45,
    "a1": -0.85,
    "dur": 0.26,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#C8453B",
    "#7A2420"
   ],
   "reach": 36,
   "arc": 2.4,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 151823696
  },
  "blade_3": {
   "id": "blade_3",
   "name": "横扫千军",
   "fam": "blade",
   "fx": "melee",
   "slot": "aoe",
   "prof": 3,
   "shape": "sideArc",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "reverse",
    "a0": -1.45,
    "a1": 0.1,
    "dur": 0.3,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#FFFFFF",
    "#2A3140"
   ],
   "reach": 44,
   "arc": 6.28,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 2843888075
  },
  "blade_4": {
   "id": "blade_4",
   "name": "旋风斩",
   "fam": "blade",
   "fx": "spin",
   "slot": "aoe",
   "prof": 5,
   "shape": "cleaveTwin",
   "shapeK": "cleave",
   "shapeSpec": {
    "k": "cleave",
    "len": 1.25,
    "w": 4,
    "twin": 1
   },
   "pose": {
    "mode": "overheadSlow",
    "a0": -0.56,
    "a1": 0.8,
    "dur": 0.36,
    "ease": "both"
   },
   "poseK": "over",
   "poseSpec": {
    "k": "over",
    "up": 5,
    "down": 9
   },
   "color": [
    "#FFFFFF",
    "#4A5568"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 1.5,
   "tier": "standard",
   "skeleton": "aura",
   "seed": 2782808418
  },
  "blade_5": {
   "id": "blade_5",
   "name": "疾风步",
   "fam": "blade",
   "fx": "dash",
   "slot": "move",
   "prof": 6,
   "shape": "cleaveThin",
   "shapeK": "cleave",
   "shapeSpec": {
    "k": "cleave",
    "len": 1.35,
    "w": 1.6
   },
   "pose": {
    "mode": "overheadFast",
    "a0": 0.05,
    "a1": 0.93,
    "dur": 0.24,
    "ease": "out"
   },
   "poseK": "over",
   "poseSpec": {
    "k": "over",
    "up": 2.5,
    "down": 5
   },
   "color": [
    "#FFFFFF",
    "#C9BFA3"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "step",
   "seed": 3794444652
  },
  "blade_6": {
   "id": "blade_6",
   "name": "断筋",
   "fam": "blade",
   "fx": "melee",
   "slot": "ctrl",
   "prof": 8,
   "shape": "cleaveWide",
   "shapeK": "cleave",
   "shapeSpec": {
    "k": "cleave",
    "len": 1.1,
    "w": 6
   },
   "pose": {
    "mode": "sideHigh",
    "a0": 0.6,
    "a1": 1.46,
    "dur": 0.2,
    "ease": "out"
   },
   "poseK": "side",
   "poseSpec": {
    "k": "side",
    "a": 4,
    "b": -2,
    "angAdd": -0.1007
   },
   "color": [
    "#FFFFFF",
    "#8A8268"
   ],
   "reach": 38,
   "arc": 2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "slash",
   "seed": 1531127787
  },
  "blade_7": {
   "id": "blade_7",
   "name": "狂怒",
   "fam": "blade",
   "fx": "buff",
   "slot": "buff",
   "prof": 10,
   "shape": "arcThin",
   "shapeK": "arc",
   "shapeSpec": {
    "k": "arc",
    "tilt": 0,
    "wide": 0.42,
    "r": 1.12,
    "rays": 2
   },
   "pose": {
    "mode": "sideLow",
    "a0": 1.23,
    "a1": 1.7,
    "dur": 0.44,
    "ease": "in"
   },
   "poseK": "side",
   "poseSpec": {
    "k": "side",
    "a": -3,
    "b": 1.5,
    "angAdd": -0.119
   },
   "color": [
    "#E8806F",
    "#7A2420"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "burst",
   "skeleton": "aura",
   "seed": 158262672
  },
  "blade_8": {
   "id": "blade_8",
   "name": "血战八方",
   "fam": "blade",
   "fx": "spin",
   "slot": "special",
   "prof": 4,
   "shape": "arcTall",
   "shapeK": "arc",
   "shapeSpec": {
    "k": "arc",
    "tilt": -0.25,
    "wide": 0.7,
    "r": 1.3,
    "rays": 5
   },
   "pose": {
    "mode": "reverseHigh",
    "a0": -0.95,
    "a1": 0.4,
    "dur": 0.42,
    "ease": "in"
   },
   "poseK": "rev",
   "poseSpec": {
    "k": "rev",
    "t": 0.85,
    "off": 4
   },
   "color": [
    "#D9A441",
    "#C8453B"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 2,
   "tier": "calm",
   "skeleton": "aura",
   "seed": 3362983397
  },
  "spear_1": {
   "id": "spear_1",
   "name": "贯甲刺",
   "fam": "spear",
   "fx": "cleave",
   "slot": "dmg",
   "prof": 1,
   "shape": "point",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "flick",
    "a0": -2.4,
    "a1": -0.9,
    "dur": 0.3,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#FFFFFF",
    "#2F6E6A"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 916649419
  },
  "spear_2": {
   "id": "spear_2",
   "name": "枪阵",
   "fam": "spear",
   "fx": "melee",
   "slot": "dmg",
   "prof": 2,
   "shape": "rain",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "charge",
    "a0": -1.95,
    "a1": -0.83,
    "dur": 0.22,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#FFFFFF",
    "#7A2420"
   ],
   "reach": 46,
   "arc": 1,
   "hits": 3,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 1010960285
  },
  "spear_3": {
   "id": "spear_3",
   "name": "回马枪",
   "fam": "spear",
   "fx": "melee",
   "slot": "aoe",
   "prof": 3,
   "shape": "trail",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "cast",
    "a0": -1.45,
    "a1": -0.35,
    "dur": 0.26,
    "ease": "both"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#FFFFFF",
    "#8A6520"
   ],
   "reach": 44,
   "arc": 1.6,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 107597299
  },
  "spear_4": {
   "id": "spear_4",
   "name": "天狼啸月",
   "fam": "spear",
   "fx": "melee",
   "slot": "aoe",
   "prof": 5,
   "shape": "lanceTwin",
   "shapeK": "lance",
   "shapeSpec": {
    "k": "lance",
    "len": 1.05,
    "w": 2,
    "twin": 1
   },
   "pose": {
    "mode": "thrustUp",
    "a0": -0.45,
    "a1": 0.7,
    "dur": 0.5,
    "ease": "in"
   },
   "poseK": "thrust",
   "poseSpec": {
    "k": "thrust",
    "off": 9,
    "tilt": -0.35,
    "angAdd": 0.1716
   },
   "color": [
    "#FFFFFF",
    "#F2D089"
   ],
   "reach": 90,
   "arc": 6.28,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "slash",
   "seed": 2004813396
  },
  "spear_5": {
   "id": "spear_5",
   "name": "游龙步",
   "fam": "spear",
   "fx": "dash",
   "slot": "move",
   "prof": 6,
   "shape": "lanceSpin",
   "shapeK": "lance",
   "shapeSpec": {
    "k": "lance",
    "len": 1,
    "w": 2.2,
    "spin": 1
   },
   "pose": {
    "mode": "thrustDown",
    "a0": 0.05,
    "a1": 1,
    "dur": 0.28,
    "ease": "out"
   },
   "poseK": "thrust",
   "poseSpec": {
    "k": "thrust",
    "off": 9,
    "tilt": 0.35
   },
   "color": [
    "#FFFFFF",
    "#4A3A6B"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "step",
   "seed": 948465298
  },
  "spear_6": {
   "id": "spear_6",
   "name": "定军",
   "fam": "spear",
   "fx": "zone",
   "slot": "ctrl",
   "prof": 8,
   "shape": "arcWide",
   "shapeK": "arc",
   "shapeSpec": {
    "k": "arc",
    "tilt": 0,
    "wide": 1.55,
    "r": 0.92,
    "rays": 4
   },
   "pose": {
    "mode": "lungeFar",
    "a0": 0.55,
    "a1": 1.2,
    "dur": 0.32,
    "ease": "in"
   },
   "poseK": "lunge",
   "poseSpec": {
    "k": "lunge",
    "off": 12,
    "arcMul": 1.3
   },
   "color": [
    "#C9BFA3",
    "#8A8268"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "aura",
   "seed": 2857736897
  },
  "spear_7": {
   "id": "spear_7",
   "name": "枪势",
   "fam": "spear",
   "fx": "buff",
   "slot": "buff",
   "prof": 10,
   "shape": "rainSparse",
   "shapeK": "rain",
   "shapeSpec": {
    "k": "rain",
    "n": 4,
    "spacing": 26,
    "len": 22
   },
   "pose": {
    "mode": "lungeSpin",
    "a0": 1.1,
    "a1": 1.6,
    "dur": 0.4,
    "ease": "out"
   },
   "poseK": "lunge",
   "poseSpec": {
    "k": "lunge",
    "off": 14,
    "angAdd": 0.5
   },
   "color": [
    "#FFFFFF",
    "#000000"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "burst",
   "skeleton": "aura",
   "seed": 32603505
  },
  "spear_8": {
   "id": "spear_8",
   "name": "挑飞",
   "fam": "spear",
   "fx": "melee",
   "slot": "special",
   "prof": 4,
   "shape": "trailThin",
   "shapeK": "trail",
   "shapeSpec": {
    "k": "trail",
    "n": 5,
    "len": 0.8,
    "spread": 0.1
   },
   "pose": {
    "mode": "sweepThin",
    "a0": -0.86,
    "a1": 0.2,
    "dur": 0.34,
    "ease": "in"
   },
   "poseK": "swing",
   "poseSpec": {
    "k": "swing",
    "off": 0.4,
    "arcMul": 0.6,
    "angAdd": -0.0956
   },
   "color": [
    "#FFFFFF",
    "#C8453B"
   ],
   "reach": 44,
   "arc": 1.6,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 1027510948
  },
  "staff_1": {
   "id": "staff_1",
   "name": "扫棍",
   "fam": "staff",
   "fx": "melee",
   "slot": "dmg",
   "prof": 1,
   "shape": "sigil",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "channel",
    "a0": -2.45,
    "a1": -0.75,
    "dur": 0.24,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#FFFFFF",
    "#D9A441"
   ],
   "reach": 42,
   "arc": 3.4,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 1563433097
  },
  "staff_2": {
   "id": "staff_2",
   "name": "崩棍",
   "fam": "staff",
   "fx": "melee",
   "slot": "dmg",
   "prof": 2,
   "shape": "spiral",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "spin",
    "a0": -1.95,
    "a1": -0.61,
    "dur": 0.2,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#FFFFFF",
    "#8A6FC4"
   ],
   "reach": 40,
   "arc": 1.3,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 1583415731
  },
  "staff_3": {
   "id": "staff_3",
   "name": "捅棍",
   "fam": "staff",
   "fx": "proj",
   "slot": "aoe",
   "prof": 3,
   "shape": "chargeLine",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "ring",
    "a0": -1.45,
    "a1": -0.15,
    "dur": 0.28,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#FFFFFF",
    "#9BD4CC"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "pierce",
   "seed": 2355924950
  },
  "staff_4": {
   "id": "staff_4",
   "name": "跃棍",
   "fam": "staff",
   "fx": "shockwave",
   "slot": "aoe",
   "prof": 5,
   "shape": "sigilHex",
   "shapeK": "sigil",
   "shapeSpec": {
    "k": "sigil",
    "r": 0.85,
    "spokes": 6,
    "layers": 2,
    "hex": 1
   },
   "pose": {
    "mode": "castHigh",
    "a0": -0.29,
    "a1": 0.7,
    "dur": 0.42,
    "ease": "in"
   },
   "poseK": "cast",
   "poseSpec": {
    "k": "cast",
    "tilt": -0.9,
    "sweep": 0.6,
    "off": 4,
    "angAdd": 0.0748
   },
   "color": [
    "#FFFFFF",
    "#C0A8E0"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.5,
   "tier": "standard",
   "skeleton": "slash",
   "seed": 4085610535
  },
  "staff_5": {
   "id": "staff_5",
   "name": "疾风棍",
   "fam": "staff",
   "fx": "dash",
   "slot": "move",
   "prof": 6,
   "shape": "sigilRune",
   "shapeK": "sigil",
   "shapeSpec": {
    "k": "sigil",
    "r": 0.95,
    "spokes": 4,
    "layers": 3
   },
   "pose": {
    "mode": "castLow",
    "a0": 0.1,
    "a1": 0.12,
    "dur": 0.26,
    "ease": "out"
   },
   "poseK": "cast",
   "poseSpec": {
    "k": "cast",
    "tilt": -0.3,
    "sweep": 0.25,
    "off": 2
   },
   "color": [
    "#FFFFFF",
    "#E8806F"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "step",
   "seed": 263228725
  },
  "staff_6": {
   "id": "staff_6",
   "name": "缠棍",
   "fam": "staff",
   "fx": "pull",
   "slot": "ctrl",
   "prof": 8,
   "shape": "sigilStar",
   "shapeK": "sigil",
   "shapeSpec": {
    "k": "sigil",
    "r": 0.9,
    "spokes": 8,
    "layers": 2,
    "star": 1
   },
   "pose": {
    "mode": "castSpin",
    "a0": 0.6,
    "a1": 1.2,
    "dur": 0.3,
    "ease": "out"
   },
   "poseK": "cast",
   "poseSpec": {
    "k": "cast",
    "tilt": -0.6,
    "sweep": 0.9,
    "off": 5
   },
   "color": [
    "#FFFFFF",
    "#E8DFC8"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "slash",
   "seed": 3268602211
  },
  "staff_7": {
   "id": "staff_7",
   "name": "铁布衫",
   "fam": "staff",
   "fx": "buff",
   "slot": "buff",
   "prof": 10,
   "shape": "spiralTight",
   "shapeK": "spiral",
   "shapeSpec": {
    "k": "spiral",
    "r": 0.7,
    "turns": 2.2,
    "wide": 0.8
   },
   "pose": {
    "mode": "channelHigh",
    "a0": 1.15,
    "a1": 1.6,
    "dur": 0.34,
    "ease": "in"
   },
   "poseK": "chan",
   "poseSpec": {
    "k": "chan",
    "off": -8
   },
   "color": [
    "#E8DFC8",
    "#12161F"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "burst",
   "skeleton": "aura",
   "seed": 1584274708
  },
  "staff_8": {
   "id": "staff_8",
   "name": "舞棍",
   "fam": "staff",
   "fx": "spin",
   "slot": "special",
   "prof": 4,
   "shape": "spiralWide",
   "shapeK": "spiral",
   "shapeSpec": {
    "k": "spiral",
    "r": 1.2,
    "turns": 1.4,
    "wide": 1.2
   },
   "pose": {
    "mode": "channelLong",
    "a0": -0.95,
    "a1": 0.4,
    "dur": 0.36,
    "ease": "both"
   },
   "poseK": "chan",
   "poseSpec": {
    "k": "chan",
    "off": -11
   },
   "color": [
    "#E8DFC8",
    "#2A3140"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 2,
   "tier": "calm",
   "skeleton": "aura",
   "seed": 297879460
  },
  "dual_1": {
   "id": "dual_1",
   "name": "双牙",
   "fam": "dual",
   "fx": "melee",
   "slot": "dmg",
   "prof": 1,
   "shape": "fan",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "slam",
    "a0": -2.45,
    "a1": -1.05,
    "dur": 0.2,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#E8DFC8",
    "#4A5568"
   ],
   "reach": 32,
   "arc": 1.8,
   "hits": 2,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 2895296112
  },
  "dual_2": {
   "id": "dual_2",
   "name": "十字斩",
   "fam": "dual",
   "fx": "melee",
   "slot": "dmg",
   "prof": 2,
   "shape": "cross",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "slamLow",
    "a0": -1.95,
    "a1": -0.55,
    "dur": 0.28,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#E8DFC8",
    "#8A8268"
   ],
   "reach": 34,
   "arc": 2.2,
   "hits": 2,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 247045672
  },
  "dual_3": {
   "id": "dual_3",
   "name": "乱舞",
   "fam": "dual",
   "fx": "melee",
   "slot": "aoe",
   "prof": 3,
   "shape": "hook",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "throw",
    "a0": -0.95,
    "a1": 0.3,
    "dur": 0.34,
    "ease": "both"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#E8DFC8",
    "#2F6E6A"
   ],
   "reach": 56,
   "arc": 6.28,
   "hits": 6,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 3544841406
  },
  "dual_4": {
   "id": "dual_4",
   "name": "千刃",
   "fam": "dual",
   "fx": "zone",
   "slot": "aoe",
   "prof": 5,
   "shape": "fanNarrow",
   "shapeK": "fan",
   "shapeSpec": {
    "k": "fan",
    "n": 3,
    "spread": 0.16,
    "len": 0.85
   },
   "pose": {
    "mode": "flickHigh",
    "a0": -0.53,
    "a1": 0.4,
    "dur": 0.46,
    "ease": "in"
   },
   "poseK": "flick",
   "poseSpec": {
    "k": "flick",
    "off": 5,
    "angAdd": -0.1686
   },
   "color": [
    "#E8DFC8",
    "#7A2420"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "aura",
   "seed": 3972931805
  },
  "dual_5": {
   "id": "dual_5",
   "name": "影袭",
   "fam": "dual",
   "fx": "dash",
   "slot": "move",
   "prof": 6,
   "shape": "fanWide",
   "shapeK": "fan",
   "shapeSpec": {
    "k": "fan",
    "n": 7,
    "spread": 0.26,
    "len": 0.95
   },
   "pose": {
    "mode": "flickLow",
    "a0": 0.05,
    "a1": 0.9,
    "dur": 0.26,
    "ease": "out"
   },
   "poseK": "flick",
   "poseSpec": {
    "k": "flick",
    "off": 0.5
   },
   "color": [
    "#E8DFC8",
    "#8A6520"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "step",
   "seed": 97261614
  },
  "dual_6": {
   "id": "dual_6",
   "name": "割喉",
   "fam": "dual",
   "fx": "melee",
   "slot": "ctrl",
   "prof": 8,
   "shape": "fanArc",
   "shapeK": "fan",
   "shapeSpec": {
    "k": "fan",
    "n": 5,
    "spread": 0.22,
    "len": 1.05,
    "arc": 1
   },
   "pose": {
    "mode": "flickTurn",
    "a0": 0.26,
    "a1": 1.2,
    "dur": 0.3,
    "ease": "out"
   },
   "poseK": "flick",
   "poseSpec": {
    "k": "flick",
    "off": 3,
    "angAdd": 0.5257
   },
   "color": [
    "#E8DFC8",
    "#4A3A6B"
   ],
   "reach": 32,
   "arc": 1,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "slash",
   "seed": 1410694226
  },
  "dual_7": {
   "id": "dual_7",
   "name": "杀意",
   "fam": "dual",
   "fx": "buff",
   "slot": "buff",
   "prof": 10,
   "shape": "crossThin",
   "shapeK": "cross",
   "shapeSpec": {
    "k": "cross",
    "n": 2,
    "spread": 0.55,
    "len": 0.95,
    "w": 1.6
   },
   "pose": {
    "mode": "sideWide",
    "a0": 1.23,
    "a1": 1.7,
    "dur": 0.4,
    "ease": "in"
   },
   "poseK": "side",
   "poseSpec": {
    "k": "side",
    "a": 5,
    "b": -3,
    "arcMul": 1.3,
    "angAdd": 0.0361
   },
   "color": [
    "#8A6FC4",
    "#4A3A6B"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "burst",
   "skeleton": "aura",
   "seed": 3532081555
  },
  "dual_8": {
   "id": "dual_8",
   "name": "疾影",
   "fam": "dual",
   "fx": "blink",
   "slot": "special",
   "prof": 4,
   "shape": "crossThick",
   "shapeK": "cross",
   "shapeSpec": {
    "k": "cross",
    "n": 2,
    "spread": 0.55,
    "len": 0.95,
    "w": 3.2
   },
   "pose": {
    "mode": "spinTight",
    "a0": -1.45,
    "a1": -0.17,
    "dur": 0.24,
    "ease": "out"
   },
   "poseK": "spin",
   "poseSpec": {
    "k": "spin",
    "t": 0.6
   },
   "color": [
    "#E8DFC8",
    "#000000"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "step",
   "seed": 1047425085
  },
  "hammer_1": {
   "id": "hammer_1",
   "name": "碎骨锤",
   "fam": "hammer",
   "fx": "melee",
   "slot": "dmg",
   "prof": 1,
   "shape": "shockwave",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "overheadBig",
    "a0": -1.9,
    "a1": 0.45,
    "dur": 0.34,
    "ease": "in"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#E8DFC8",
    "#5FA8A0"
   ],
   "reach": 34,
   "arc": 0.55,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 2160556247
  },
  "hammer_2": {
   "id": "hammer_2",
   "name": "回旋锤",
   "fam": "hammer",
   "fx": "boomerang",
   "slot": "dmg",
   "prof": 2,
   "shape": "crack",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "plant",
    "a0": -1.2,
    "a1": 0.9,
    "dur": 0.22,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#E8DFC8",
    "#C8453B"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "pierce",
   "seed": 3788936392
  },
  "hammer_3": {
   "id": "hammer_3",
   "name": "震地",
   "fam": "hammer",
   "fx": "shockwave",
   "slot": "aoe",
   "prof": 3,
   "shape": "plant",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "guard",
    "a0": -2.6,
    "a1": 1,
    "dur": 0.42,
    "ease": "in"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#E8DFC8",
    "#D9A441"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.6,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 3130385276
  },
  "hammer_4": {
   "id": "hammer_4",
   "name": "地裂",
   "fam": "hammer",
   "fx": "zone",
   "slot": "aoe",
   "prof": 5,
   "shape": "boomerang",
   "shapeK": "legacy",
   "shapeSpec": null,
   "pose": {
    "mode": "leap",
    "a0": -1.5,
    "a1": 0.8,
    "dur": 0.3,
    "ease": "in"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#E8DFC8",
    "#8A6FC4"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "aura",
   "seed": 1683293480
  },
  "hammer_5": {
   "id": "hammer_5",
   "name": "冲锋锤",
   "fam": "hammer",
   "fx": "charge",
   "slot": "move",
   "prof": 6,
   "shape": "shockThin",
   "shapeK": "shock",
   "shapeSpec": {
    "k": "shock",
    "r": 0.95,
    "count": 8,
    "w": 1
   },
   "pose": {
    "mode": "sweepLow",
    "a0": 0,
    "a1": 0,
    "dur": 0.26,
    "ease": "out"
   },
   "poseK": "legacy",
   "poseSpec": null,
   "color": [
    "#E8DFC8",
    "#9BD4CC"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "slash",
   "seed": 3971453891
  },
  "hammer_6": {
   "id": "hammer_6",
   "name": "眩晕击",
   "fam": "hammer",
   "fx": "melee",
   "slot": "ctrl",
   "prof": 8,
   "shape": "shockThick",
   "shapeK": "shock",
   "shapeSpec": {
    "k": "shock",
    "r": 0.85,
    "count": 8,
    "w": 2.6
   },
   "pose": {
    "mode": "slamSlow",
    "a0": -2.2,
    "a1": 0.25,
    "dur": 0.3,
    "ease": "in"
   },
   "poseK": "over",
   "poseSpec": {
    "k": "over",
    "up": 6,
    "down": 10
   },
   "color": [
    "#E8DFC8",
    "#F2D089"
   ],
   "reach": 36,
   "arc": 1,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "slash",
   "seed": 3978275256
  },
  "hammer_7": {
   "id": "hammer_7",
   "name": "铁壁",
   "fam": "hammer",
   "fx": "buff",
   "slot": "buff",
   "prof": 10,
   "shape": "shockDouble",
   "shapeK": "shock",
   "shapeSpec": {
    "k": "shock",
    "r": 1.15,
    "count": 12,
    "w": 1.2,
    "double": 1
   },
   "pose": {
    "mode": "slamFast",
    "a0": -0.9,
    "a1": 0.1,
    "dur": 0.28,
    "ease": "in"
   },
   "poseK": "over",
   "poseSpec": {
    "k": "over",
    "up": 3,
    "down": 6
   },
   "color": [
    "#E8DFC8",
    "#C0A8E0"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "burst",
   "skeleton": "aura",
   "seed": 2735638070
  },
  "hammer_8": {
   "id": "hammer_8",
   "name": "开天辟地",
   "fam": "hammer",
   "fx": "cleave",
   "slot": "special",
   "prof": 4,
   "shape": "crackBranch",
   "shapeK": "crack",
   "shapeSpec": {
    "k": "crack",
    "n": 4,
    "step": 0.8,
    "branch": 1
   },
   "pose": {
    "mode": "slamWide",
    "a0": -2.7,
    "a1": 1.2,
    "dur": 0.62,
    "ease": "in"
   },
   "poseK": "over",
   "poseSpec": {
    "k": "over",
    "up": 7,
    "down": 12,
    "arcMul": 1.15
   },
   "color": [
    "#E8DFC8",
    "#E8806F"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 926377331
  },
  "mage_1": {
   "id": "mage_1",
   "name": "灵珠",
   "fam": "mage",
   "fx": "proj",
   "slot": "dmg",
   "prof": 1,
   "shape": "sigilWheel",
   "shapeK": "sigil",
   "shapeSpec": {
    "k": "sigil",
    "r": 1.05,
    "spokes": 12,
    "layers": 3,
    "wheel": 1
   },
   "pose": {
    "mode": "ringHalf",
    "a0": -2.45,
    "a1": -1.6,
    "dur": 0.22,
    "ease": "out"
   },
   "poseK": "ring",
   "poseSpec": {
    "k": "ring",
    "t1": 0.55,
    "t2": 1.1
   },
   "color": [
    "#9BD4CC",
    "#12161F"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "pierce",
   "seed": 1270373725
  },
  "mage_2": {
   "id": "mage_2",
   "name": "三珠连爆",
   "fam": "mage",
   "fx": "proj",
   "slot": "dmg",
   "prof": 2,
   "shape": "sigilNotch",
   "shapeK": "sigil",
   "shapeSpec": {
    "k": "sigil",
    "r": 0.8,
    "spokes": 5,
    "layers": 2,
    "notch": 1
   },
   "pose": {
    "mode": "ringFull",
    "a0": -1.95,
    "a1": -0.95,
    "dur": 0.3,
    "ease": "out"
   },
   "poseK": "ring",
   "poseSpec": {
    "k": "ring",
    "t1": 1.1,
    "t2": 2.2
   },
   "color": [
    "#9BD4CC",
    "#2A3140"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 3,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "pierce",
   "seed": 1991270661
  },
  "mage_3": {
   "id": "mage_3",
   "name": "火雨",
   "fam": "mage",
   "fx": "zone",
   "slot": "aoe",
   "prof": 3,
   "shape": "rainDense",
   "shapeK": "rain",
   "shapeSpec": {
    "k": "rain",
    "n": 9,
    "spacing": 15,
    "len": 26
   },
   "pose": {
    "mode": "ringWide",
    "a0": -1.45,
    "a1": -0.45,
    "dur": 0.42,
    "ease": "in"
   },
   "poseK": "ring",
   "poseSpec": {
    "k": "ring",
    "t1": 0.8,
    "t2": 1.6
   },
   "color": [
    "#9BD4CC",
    "#4A5568"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "aura",
   "seed": 223390657
  },
  "mage_4": {
   "id": "mage_4",
   "name": "雷链",
   "fam": "mage",
   "fx": "bolt",
   "slot": "aoe",
   "prof": 5,
   "shape": "rainAngle",
   "shapeK": "rain",
   "shapeSpec": {
    "k": "rain",
    "n": 6,
    "spacing": 19,
    "len": 30,
    "angle": 0.45
   },
   "pose": {
    "mode": "ringTight",
    "a0": -0.45,
    "a1": 0.2,
    "dur": 0.26,
    "ease": "out"
   },
   "poseK": "ring",
   "poseSpec": {
    "k": "ring",
    "t1": 1.4,
    "t2": 2.8
   },
   "color": [
    "#9BD4CC",
    "#8A8268"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 3,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "pierce",
   "seed": 259179939
  },
  "mage_5": {
   "id": "mage_5",
   "name": "瞬闪",
   "fam": "mage",
   "fx": "dash",
   "slot": "move",
   "prof": 6,
   "shape": "ringThin",
   "shapeK": "ring",
   "shapeSpec": {
    "k": "ring",
    "r": 1,
    "count": 1,
    "w": 0.8
   },
   "pose": {
    "mode": "channelSpin",
    "a0": 0.05,
    "a1": 0.88,
    "dur": 0.24,
    "ease": "out"
   },
   "poseK": "chan",
   "poseSpec": {
    "k": "chan",
    "off": -7,
    "angAdd": 0.5
   },
   "color": [
    "#9BD4CC",
    "#2F6E6A"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "step",
   "seed": 3207377600
  },
  "mage_6": {
   "id": "mage_6",
   "name": "冰封",
   "fam": "mage",
   "fx": "melee",
   "slot": "ctrl",
   "prof": 8,
   "shape": "ringThick",
   "shapeK": "ring",
   "shapeSpec": {
    "k": "ring",
    "r": 0.86,
    "count": 1,
    "w": 2.2
   },
   "pose": {
    "mode": "sweepRise",
    "a0": 0.51,
    "a1": 1.1,
    "dur": 0.34,
    "ease": "in"
   },
   "poseK": "swing",
   "poseSpec": {
    "k": "swing",
    "off": 2,
    "angAdd": -0.3
   },
   "color": [
    "#9BD4CC",
    "#7A2420"
   ],
   "reach": 44,
   "arc": 1.6,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "slash",
   "seed": 2062446577
  },
  "mage_7": {
   "id": "mage_7",
   "name": "灵护",
   "fam": "mage",
   "fx": "buff",
   "slot": "buff",
   "prof": 10,
   "shape": "ringDouble",
   "shapeK": "ring",
   "shapeSpec": {
    "k": "ring",
    "r": 1.05,
    "count": 2,
    "w": 1
   },
   "pose": {
    "mode": "sweepFall",
    "a0": 1.15,
    "a1": 1.6,
    "dur": 0.4,
    "ease": "out"
   },
   "poseK": "swing",
   "poseSpec": {
    "k": "swing",
    "off": -1,
    "angAdd": 0.3
   },
   "color": [
    "#9BD4CC",
    "#8A6520"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "burst",
   "skeleton": "aura",
   "seed": 1397352710
  },
  "mage_8": {
   "id": "mage_8",
   "name": "天雷引",
   "fam": "mage",
   "fx": "bolt",
   "slot": "special",
   "prof": 4,
   "shape": "ringSpiral",
   "shapeK": "ring",
   "shapeSpec": {
    "k": "ring",
    "r": 0.95,
    "count": 2,
    "w": 1,
    "spiral": 1
   },
   "pose": {
    "mode": "sweepTurn",
    "a0": -0.95,
    "a1": 0.3,
    "dur": 0.62,
    "ease": "in"
   },
   "poseK": "swing",
   "poseSpec": {
    "k": "swing",
    "off": 2.2,
    "angAdd": 0.4
   },
   "color": [
    "#9BD4CC",
    "#4A3A6B"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 5,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "pierce",
   "seed": 1601117822
  },
  "dart_1": {
   "id": "dart_1",
   "name": "飞蝗",
   "fam": "dart",
   "fx": "proj",
   "slot": "dmg",
   "prof": 1,
   "shape": "pointStar",
   "shapeK": "point",
   "shapeSpec": {
    "k": "point",
    "n": 6,
    "r": 16,
    "star": 1
   },
   "pose": {
    "mode": "sweepBack",
    "a0": -2.45,
    "a1": -1.25,
    "dur": 0.2,
    "ease": "out"
   },
   "poseK": "swing",
   "poseSpec": {
    "k": "swing",
    "off": -1.5,
    "arcMul": -0.6
   },
   "color": [
    "#9BD4CC",
    "#000000"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "pierce",
   "seed": 3381682018
  },
  "dart_2": {
   "id": "dart_2",
   "name": "三叠浪",
   "fam": "dart",
   "fx": "proj",
   "slot": "dmg",
   "prof": 2,
   "shape": "pointBurst",
   "shapeK": "point",
   "shapeSpec": {
    "k": "point",
    "n": 10,
    "r": 22
   },
   "pose": {
    "mode": "sweepWide",
    "a0": -1.95,
    "a1": -0.85,
    "dur": 0.24,
    "ease": "out"
   },
   "poseK": "swing",
   "poseSpec": {
    "k": "swing",
    "off": 1.5,
    "arcMul": 1.4
   },
   "color": [
    "#9BD4CC",
    "#C9BFA3"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 3,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "pierce",
   "seed": 3069596849
  },
  "dart_3": {
   "id": "dart_3",
   "name": "满天花雨",
   "fam": "dart",
   "fx": "proj",
   "slot": "aoe",
   "prof": 3,
   "shape": "pointCross",
   "shapeK": "point",
   "shapeSpec": {
    "k": "point",
    "n": 4,
    "r": 18,
    "cross": 1
   },
   "pose": {
    "mode": "sweepPush",
    "a0": -0.54,
    "a1": 0.1,
    "dur": 0.28,
    "ease": "out"
   },
   "poseK": "swing",
   "poseSpec": {
    "k": "swing",
    "off": 4.5,
    "angAdd": 0.0781
   },
   "color": [
    "#9BD4CC",
    "#C8453B"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 12,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "pierce",
   "seed": 69150644
  },
  "dart_4": {
   "id": "dart_4",
   "name": "万箭穿心",
   "fam": "dart",
   "fx": "proj",
   "slot": "aoe",
   "prof": 5,
   "shape": "fanStar",
   "shapeK": "fan",
   "shapeSpec": {
    "k": "fan",
    "n": 8,
    "spread": 0.4,
    "len": 0.8,
    "star": 1
   },
   "pose": {
    "mode": "spinWide",
    "a0": -0.53,
    "a1": 0.6,
    "dur": 0.44,
    "ease": "in"
   },
   "poseK": "spin",
   "poseSpec": {
    "k": "spin",
    "t": 1.4
   },
   "color": [
    "#9BD4CC",
    "#D9A441"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 24,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "pierce",
   "seed": 2770735999
  },
  "dart_5": {
   "id": "dart_5",
   "name": "缩地",
   "fam": "dart",
   "fx": "dash",
   "slot": "move",
   "prof": 6,
   "shape": "fanSplit",
   "shapeK": "fan",
   "shapeSpec": {
    "k": "fan",
    "n": 6,
    "spread": 0.3,
    "len": 0.9,
    "split": 1
   },
   "pose": {
    "mode": "spinReverse",
    "a0": 0.05,
    "a1": 0.8,
    "dur": 0.26,
    "ease": "out"
   },
   "poseK": "spin",
   "poseSpec": {
    "k": "spin",
    "t": -0.6,
    "angAdd": -0.0431
   },
   "color": [
    "#9BD4CC",
    "#8A6FC4"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "step",
   "seed": 1902567758
  },
  "dart_6": {
   "id": "dart_6",
   "name": "铁蒺藜",
   "fam": "dart",
   "fx": "zone",
   "slot": "ctrl",
   "prof": 8,
   "shape": "trailThick",
   "shapeK": "trail",
   "shapeSpec": {
    "k": "trail",
    "n": 4,
    "len": 0.95,
    "spread": 0.14,
    "w": 2.6
   },
   "pose": {
    "mode": "sideTurn",
    "a0": 0.6,
    "a1": 1.2,
    "dur": 0.32,
    "ease": "out"
   },
   "poseK": "side",
   "poseSpec": {
    "k": "side",
    "a": 3.5,
    "b": -1.5,
    "angAdd": 0.35
   },
   "color": [
    "#9BD4CC",
    "#C0A8E0"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "aura",
   "seed": 2002725764
  },
  "dart_7": {
   "id": "dart_7",
   "name": "淬毒",
   "fam": "dart",
   "fx": "buff",
   "slot": "buff",
   "prof": 10,
   "shape": "trailArc",
   "shapeK": "trail",
   "shapeSpec": {
    "k": "trail",
    "n": 6,
    "len": 0.9,
    "spread": 0.18,
    "arc": 1
   },
   "pose": {
    "mode": "sidePush",
    "a0": 1.15,
    "a1": 1.7,
    "dur": 0.4,
    "ease": "in"
   },
   "poseK": "side",
   "poseSpec": {
    "k": "side",
    "a": 2,
    "b": -4
   },
   "color": [
    "#9BD4CC",
    "#E8806F"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "burst",
   "skeleton": "aura",
   "seed": 3383705467
  },
  "dart_8": {
   "id": "dart_8",
   "name": "毒镖",
   "fam": "dart",
   "fx": "proj",
   "slot": "special",
   "prof": 4,
   "shape": "trailZig",
   "shapeK": "trail",
   "shapeSpec": {
    "k": "trail",
    "n": 7,
    "len": 0.7,
    "spread": 0.22,
    "zig": 1
   },
   "pose": {
    "mode": "plantDeep",
    "a0": -1.45,
    "a1": -0.6,
    "dur": 0.3,
    "ease": "out"
   },
   "poseK": "plant",
   "poseSpec": {
    "k": "plant",
    "off": 6
   },
   "color": [
    "#F2D089",
    "#12161F"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "pierce",
   "seed": 3686889604
  },
  "chain_1": {
   "id": "chain_1",
   "name": "锁喉",
   "fam": "chain",
   "fx": "melee",
   "slot": "dmg",
   "prof": 1,
   "shape": "trailDot",
   "shapeK": "trail",
   "shapeSpec": {
    "k": "trail",
    "n": 6,
    "len": 0.85,
    "spread": 0.16,
    "dot": 1
   },
   "pose": {
    "mode": "plantWide",
    "a0": -2.45,
    "a1": -0.93,
    "dur": 0.28,
    "ease": "out"
   },
   "poseK": "plant",
   "poseSpec": {
    "k": "plant",
    "off": 3,
    "arcMul": 1.25
   },
   "color": [
    "#F2D089",
    "#2A3140"
   ],
   "reach": 46,
   "arc": 1,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 2845423899
  },
  "chain_2": {
   "id": "chain_2",
   "name": "缠身",
   "fam": "chain",
   "fx": "melee",
   "slot": "dmg",
   "prof": 2,
   "shape": "hookUp",
   "shapeK": "hook",
   "shapeSpec": {
    "k": "hook",
    "len": 0.95,
    "turn": 1.95,
    "up": 1
   },
   "pose": {
    "mode": "plantTurn",
    "a0": -1.95,
    "a1": -0.65,
    "dur": 0.2,
    "ease": "out"
   },
   "poseK": "plant",
   "poseSpec": {
    "k": "plant",
    "off": 4,
    "angAdd": 0.3
   },
   "color": [
    "#F2D089",
    "#4A5568"
   ],
   "reach": 42,
   "arc": 1.4,
   "hits": 3,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 1022611539
  },
  "chain_3": {
   "id": "chain_3",
   "name": "扫链",
   "fam": "chain",
   "fx": "melee",
   "slot": "aoe",
   "prof": 3,
   "shape": "hookDown",
   "shapeK": "hook",
   "shapeSpec": {
    "k": "hook",
    "len": 0.95,
    "turn": -1.95
   },
   "pose": {
    "mode": "guardHigh",
    "a0": -2.8,
    "a1": -0.8,
    "dur": 0.36,
    "ease": "both"
   },
   "poseK": "guard",
   "poseSpec": {
    "k": "guard",
    "off": -6
   },
   "color": [
    "#F2D089",
    "#8A8268"
   ],
   "reach": 50,
   "arc": 6.28,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 4216937998
  },
  "chain_4": {
   "id": "chain_4",
   "name": "回旋索",
   "fam": "chain",
   "fx": "boomerang",
   "slot": "aoe",
   "prof": 5,
   "shape": "hookLong",
   "shapeK": "hook",
   "shapeSpec": {
    "k": "hook",
    "len": 1.35,
    "turn": 1.95
   },
   "pose": {
    "mode": "guardLow",
    "a0": -1.2,
    "a1": 0.92,
    "dur": 0.22,
    "ease": "out"
   },
   "poseK": "guard",
   "poseSpec": {
    "k": "guard",
    "off": -2
   },
   "color": [
    "#F2D089",
    "#2F6E6A"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "pierce",
   "seed": 3410752966
  },
  "chain_5": {
   "id": "chain_5",
   "name": "曳影",
   "fam": "chain",
   "fx": "dash",
   "slot": "move",
   "prof": 6,
   "shape": "spiralDouble",
   "shapeK": "spiral",
   "shapeSpec": {
    "k": "spiral",
    "r": 0.9,
    "turns": 2.6,
    "wide": 0.9,
    "double": 1
   },
   "pose": {
    "mode": "guardTurn",
    "a0": 0.1,
    "a1": 0.14,
    "dur": 0.26,
    "ease": "out"
   },
   "poseK": "guard",
   "poseSpec": {
    "k": "guard",
    "off": -4,
    "angAdd": 0.35
   },
   "color": [
    "#F2D089",
    "#7A2420"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "step",
   "seed": 2452767743
  },
  "chain_6": {
   "id": "chain_6",
   "name": "缚龙",
   "fam": "chain",
   "fx": "pull",
   "slot": "ctrl",
   "prof": 8,
   "shape": "spiralReverse",
   "shapeK": "spiral",
   "shapeSpec": {
    "k": "spiral",
    "r": 1,
    "turns": 1.8,
    "wide": 1,
    "reverse": 1
   },
   "pose": {
    "mode": "leapHigh",
    "a0": -1.45,
    "a1": -0.35,
    "dur": 0.3,
    "ease": "in"
   },
   "poseK": "leap",
   "poseSpec": {
    "k": "leap",
    "off": -12
   },
   "color": [
    "#F2D089",
    "#8A6520"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "slash",
   "seed": 2449802303
  },
  "chain_7": {
   "id": "chain_7",
   "name": "链势",
   "fam": "chain",
   "fx": "buff",
   "slot": "buff",
   "prof": 10,
   "shape": "ringDash",
   "shapeK": "ring",
   "shapeSpec": {
    "k": "ring",
    "r": 1,
    "count": 3,
    "w": 1,
    "dash": 1
   },
   "pose": {
    "mode": "leapFar",
    "a0": 1.15,
    "a1": 1.8,
    "dur": 0.34,
    "ease": "in"
   },
   "poseK": "leap",
   "poseSpec": {
    "k": "leap",
    "off": -6,
    "arcMul": 1.25
   },
   "color": [
    "#F2D089",
    "#4A3A6B"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "burst",
   "skeleton": "aura",
   "seed": 445092023
  },
  "chain_8": {
   "id": "chain_8",
   "name": "万链归墟",
   "fam": "chain",
   "fx": "orbit",
   "slot": "special",
   "prof": 4,
   "shape": "ringWide",
   "shapeK": "ring",
   "shapeSpec": {
    "k": "ring",
    "r": 1.3,
    "count": 2,
    "w": 1.2
   },
   "pose": {
    "mode": "throwHigh",
    "a0": -2.7,
    "a1": 1.22,
    "dur": 0.62,
    "ease": "in"
   },
   "poseK": "throw",
   "poseSpec": {
    "k": "throw",
    "off": 6
   },
   "color": [
    "#F2D089",
    "#000000"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 10,
   "dur": 5,
   "tier": "calm",
   "skeleton": "aura",
   "seed": 5109661
  },
  "fan_1": {
   "id": "fan_1",
   "name": "点穴",
   "fam": "fan",
   "fx": "melee",
   "slot": "dmg",
   "prof": 1,
   "shape": "crossStar",
   "shapeK": "cross",
   "shapeSpec": {
    "k": "cross",
    "n": 3,
    "spread": 0.42,
    "len": 0.9,
    "w": 1.8
   },
   "pose": {
    "mode": "overheadWide",
    "a0": -2.45,
    "a1": -1.15,
    "dur": 0.2,
    "ease": "out"
   },
   "poseK": "over",
   "poseSpec": {
    "k": "over",
    "up": 6,
    "down": 11,
    "arcMul": 1.2
   },
   "color": [
    "#F2D089",
    "#C9BFA3"
   ],
   "reach": 32,
   "arc": 0.9,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 4161222148
  },
  "fan_2": {
   "id": "fan_2",
   "name": "折影",
   "fam": "fan",
   "fx": "melee",
   "slot": "dmg",
   "prof": 2,
   "shape": "crossSplit",
   "shapeK": "cross",
   "shapeSpec": {
    "k": "cross",
    "n": 2,
    "spread": 0.8,
    "len": 0.85,
    "w": 2,
    "split": 1
   },
   "pose": {
    "mode": "overheadLeft",
    "a0": -1.95,
    "a1": 0.25,
    "dur": 0.28,
    "ease": "in"
   },
   "poseK": "over",
   "poseSpec": {
    "k": "over",
    "up": 4,
    "down": 8,
    "angAdd": -0.3
   },
   "color": [
    "#F2D089",
    "#5FA8A0"
   ],
   "reach": 34,
   "arc": 1.6,
   "hits": 2,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 2065017794
  },
  "fan_3": {
   "id": "fan_3",
   "name": "扇风",
   "fam": "fan",
   "fx": "shockwave",
   "slot": "aoe",
   "prof": 3,
   "shape": "boomerangFlat",
   "shapeK": "boom",
   "shapeSpec": {
    "k": "boom",
    "flat": 1,
    "wide": 1
   },
   "pose": {
    "mode": "throwFar",
    "a0": -2.2,
    "a1": -0.8,
    "dur": 0.3,
    "ease": "in"
   },
   "poseK": "throw",
   "poseSpec": {
    "k": "throw",
    "off": 3,
    "arcMul": 1.2,
    "angAdd": 0.1016
   },
   "color": [
    "#F2D089",
    "#C8453B"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.5,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 1857002782
  },
  "fan_4": {
   "id": "fan_4",
   "name": "落符",
   "fam": "fan",
   "fx": "bolt",
   "slot": "aoe",
   "prof": 5,
   "shape": "boomerangHigh",
   "shapeK": "boom",
   "shapeSpec": {
    "k": "boom",
    "high": 1,
    "wide": 0.7
   },
   "pose": {
    "mode": "chargeHigh",
    "a0": -0.71,
    "a1": 0.59,
    "dur": 0.42,
    "ease": "in"
   },
   "poseK": "charge",
   "poseSpec": {
    "k": "charge",
    "off": 14
   },
   "color": [
    "#F2D089",
    "#8A6FC4"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 6,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "pierce",
   "seed": 2766571646
  },
  "fan_5": {
   "id": "fan_5",
   "name": "随风",
   "fam": "fan",
   "fx": "dash",
   "slot": "move",
   "prof": 6,
   "shape": "chargeWide",
   "shapeK": "charge",
   "shapeSpec": {
    "k": "charge",
    "len": 1.25,
    "w": 1.8
   },
   "pose": {
    "mode": "chargeLong",
    "a0": -0.9,
    "a1": 0,
    "dur": 0.24,
    "ease": "out"
   },
   "poseK": "charge",
   "poseSpec": {
    "k": "charge",
    "off": 10,
    "arcMul": 1.2
   },
   "color": [
    "#F2D089",
    "#9BD4CC"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "step",
   "seed": 3286496713
  },
  "fan_6": {
   "id": "fan_6",
   "name": "引风",
   "fam": "fan",
   "fx": "zone",
   "slot": "ctrl",
   "prof": 8,
   "shape": "chargeDust",
   "shapeK": "charge",
   "shapeSpec": {
    "k": "charge",
    "len": 1,
    "w": 1.2,
    "dust": 8
   },
   "pose": {
    "mode": "chargeTurn",
    "a0": 0.29,
    "a1": 0.99,
    "dur": 0.32,
    "ease": "in"
   },
   "poseK": "charge",
   "poseSpec": {
    "k": "charge",
    "off": 12,
    "angAdd": 0.25
   },
   "color": [
    "#F2D089",
    "#C0A8E0"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "standard",
   "skeleton": "aura",
   "seed": 3507059280
  },
  "fan_7": {
   "id": "fan_7",
   "name": "凝神",
   "fam": "fan",
   "fx": "buff",
   "slot": "buff",
   "prof": 10,
   "shape": "crackStraight",
   "shapeK": "crack",
   "shapeSpec": {
    "k": "crack",
    "n": 5,
    "step": 0.9,
    "straight": 1
   },
   "pose": {
    "mode": "reverseTurn",
    "a0": 0.84,
    "a1": 1.44,
    "dur": 0.4,
    "ease": "in"
   },
   "poseK": "rev",
   "poseSpec": {
    "k": "rev",
    "t": 0.35,
    "off": 3,
    "angAdd": 0.3
   },
   "color": [
    "#F2D089",
    "#E8806F"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "burst",
   "skeleton": "aura",
   "seed": 2533221697
  },
  "fan_8": {
   "id": "fan_8",
   "name": "风雷引",
   "fam": "fan",
   "fx": "cleave",
   "slot": "special",
   "prof": 4,
   "shape": "crackWide",
   "shapeK": "crack",
   "shapeSpec": {
    "k": "crack",
    "n": 3,
    "step": 1.1,
    "wide": 1
   },
   "pose": {
    "mode": "spinStar",
    "a0": -2.73,
    "a1": 1.17,
    "dur": 0.62,
    "ease": "in"
   },
   "poseK": "spin",
   "poseSpec": {
    "k": "spin",
    "t": 2
   },
   "color": [
    "#C0A8E0",
    "#12161F"
   ],
   "reach": 40,
   "arc": 1.2,
   "hits": 1,
   "count": 1,
   "dur": 0.25,
   "tier": "calm",
   "skeleton": "slash",
   "seed": 3753523136
  }
 }
};
  if (typeof globalThis !== 'undefined') globalThis.CINE_CATALOG = CATALOG;
  if (typeof window !== 'undefined') window.CINE_CATALOG = CATALOG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOG;
})();
