#!/usr/bin/env node
/**
 * 美发管理系统 - 激活码生成工具
 * 用法: node keygen.js <机器码>
 * 示例: node keygen.js A1B2C3D4E5F6
 */

const crypto = require("crypto");

const LICENSE_SECRET = "xfhair-2026!";

function hash12(input) {
  return crypto.createHash("sha256").update(input).digest("hex")
    .substring(0, 12).toUpperCase();
}

function generateKey(machineId) {
  const input = machineId.toUpperCase().replace(/[^A-F0-9]/g, "");
  if (input.length !== 12) {
    console.error("错误: 机器码应为 12 位十六进制字符");
    process.exit(1);
  }
  return hash12(input + LICENSE_SECRET);
}

const machineId = process.argv[2];

if (!machineId) {
  console.log("用途: 根据客户机器码生成对应的激活码");
  console.log("用法: node keygen.js <机器码>");
  console.log("示例: node keygen.js A1B2C3D4E5F6\n");
  process.exit(0);
}

const key = generateKey(machineId);
console.log(`机器码: ${machineId.toUpperCase()}`);
console.log(`激活码: ${key}`);
console.log("");
console.log("将以上激活码发给客户即可");
