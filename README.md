# 💈 美发会员管理系统

美发店专用桌面应用 —— 收银、会员管理、等级升级、数据统计，一个软件全搞定。

**无需联网，本地运行，数据私有。**

---

## 📸 功能概览

| 模块 | 功能 |
|------|------|
| 💰 收银 | 手机号搜索会员 → 多服务结账 → 会员折扣 → 余额/现金支付 |
| 👥 会员 | 增删改查、Excel 批量导入、充值、消费记录 |
| ✂️ 服务 | 自定义服务项目（剪发/烫染/护理），分类管理 |
| 📊 统计 | 今日收入、会员等级分布、消费趋势图 |
| ⚙️ 设置 | 店铺名称、会员等级折扣、自动备份、数据导出/清空 |
| ⬆️ 等级升级 | 根据累计消费自动升级（普通→银卡→金卡→钻石），享受不同折扣 |

---

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | [Tauri v2](https://tauri.app) |
| 前端 | React 18 + TypeScript + Vite |
| 后端 | Rust |
| 数据库 | SQLite（本地文件，无需安装） |
| 安装包 | NSIS（Windows 安装程序） |
| CI/CD | GitHub Actions（推送自动构建） |

---

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/) stable
- Windows / macOS / Linux

### 开发模式

```bash
# 安装依赖
npm install

# 启动开发服务器（热重载）
npm run tauri dev
```

### 生产构建

```bash
# 打包为安装程序
npm run tauri build
```

构建产物在 `src-tauri/target/release/bundle/`。

---

## 📦 安装使用

1. 下载安装包 `美发管理系统_Setup.exe`
2. 双击安装，无需额外配置
3. 首次打开默认显示"美发管理系统"
4. 进入「设置 → 店铺名称」改成自己的店名
5. 开始使用！

> 💡 数据存储在本地 `%APPDATA%\美发管理系统\xiaofeng.db`，定期自动备份为 Excel。

---

## 📊 自动备份

系统每日自动备份会员数据为 `.xlsx` 格式，可在设置中配置：

- 备份目录（默认为系统数据目录下的 `backups` 文件夹）
- 保留天数（默认 30 天）
- 备份时间（默认凌晨 2 点）
- 支持手动立即备份

---

## 🏷 定制与购买

本产品为通用版美发店管理系统，开箱即用。

如需定制功能（增加门店、员工管理、小程序端等），请联系开发者。

---

## 📄 许可

仅供授权用户使用。禁止逆向工程、二次分发或转售。

---

## 👨‍💻 开发者

**Wushange** · [GitHub](https://github.com/wushange)

---

## 🔗 相关链接

- 技术文档：[Tauri v2](https://v2.tauri.app/) · [React](https://react.dev/) · [Rust](https://www.rust-lang.org/) · [SQLite](https://www.sqlite.org/)
