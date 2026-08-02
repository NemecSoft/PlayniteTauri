# 登录系统

## 目标

应用启动时可显示登录界面，支持两种方式：
- **微信扫码**（默认）
- **账号密码**

并可通过设置**配置是否显示登录**、**选择登录方式**。

## 配置字段（`AppSettings`）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `loginEnabled` | bool | 是否在启动时显示登录界面（默认 `false`） |
| `loginType` | string | 登录方式：`"wechat"` / `"account"` |
| `loggedIn` | bool | 当前会话是否已登录 |
| `username` | Option\<string\> | 已登录用户名（账号登录用） |

## 启动流程（`App.tsx`）

```
needsLogin = settings.loginEnabled && !settings.loggedIn
if (needsLogin) → 渲染 <LoginScreen/>
else            → 渲染主界面（TitleBar + AppBody + ToastContainer）
```

登录成功后 `save({ loggedIn: true, ... })` 更新 store → `needsLogin` 变 false → 自动进入主界面。

## 登录界面（`src/components/LoginScreen.tsx`）

- **微信扫码**：用 `qrcode.react` 渲染二维码。当前为绿色离线应用的**客户端演示流程**，
  二维码指向一个模拟的微信登录确认页 URL；点击二维码模拟"扫码并确认"后登录。
  真实部署时替换为微信开放平台 `qrconnect` 二维码 + 后端 OAuth 回调。
- **账号密码**：本地演示认证（非空校验通过即登录），绿色应用无后端。
- 支持"暂不登录"跳过（仅在 `loginEnabled` 时显示）。

## 设置入口

设置 → 登录 分区（`LoginSection.tsx`）：
- 勾选"启动时显示登录界面"（`loginEnabled`）
- 选择登录方式（`loginType`）
- 显示当前登录状态 + 退出登录按钮

## 依赖

- `qrcode.react`（^4.x）：二维码渲染。
