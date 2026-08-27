# 发布与 OTA 自动更新说明

本文档说明如何发布新版本,以及 OTA 自动更新机制的工作原理。

## 自动更新机制

- 应用内置 Tauri updater 插件,启动时和设置页"检查更新"按钮会查询
  `https://github.com/wushange/meifabao/releases/latest/download/latest.json`
- 发现新版本后弹窗,用户确认后下载安装包并自动重启
- 更新包用 minisign 签名,应用内嵌公钥校验,防止被篡改

## 发版流程(每次发新版本)

1. 升版本号:三个文件的 `version` 保持一致(推荐递增次版本,如 0.2.0 → 0.3.0)
   - `src-tauri/tauri.conf.json`
   - `package.json`
   - `src-tauri/Cargo.toml`(`Cargo.lock` 会在构建时自动同步)
2. 提交并推送:
   ```bash
   git add src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml src-tauri/Cargo.lock
   git commit -m "chore: 版本号升级到 X.Y.Z"
   git push origin main
   ```
3. 打标签并推送(触发 GitHub Actions 的 `Release` 工作流自动构建发布):
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
4. Actions 在 Windows 上构建并发布 GitHub Release,包含:
   - 安装包(`.exe`,NSIS)
   - 签名文件(`.exe.sig`)
   - 更新清单(`latest.json`,即 OTA 检查的清单)

## 关键前置条件

- **仓库必须保持公开**。OTA 下载没有登录态,私有仓库的 Release 文件无法匿名下载,更新会失败。
  (曾因仓库误设为私有导致下载全部 404,排查后改为公开解决。)
- GitHub Secrets(仓库 → Settings → Secrets and variables → Actions):
  - `TAURI_SIGNING_PRIVATE_KEY`:minisign 私钥内容(位于 `~/.tauri/xiaofeng.key`)
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`:留空/不创建(密钥无密码)
- **私钥务必离线备份**,丢失后将无法再签名发布更新。

## 首次安装

老版本(0.1.x)没有内置 updater 插件,不会自我更新。第一次需手动下载安装一次新版本,之后才走 OTA。
