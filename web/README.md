# dsh-time-prefix（web 版）

在 dsh 中为每条用户消息自动添加当前时间前缀（`【2026/10/05，00:27】`，精确到分钟），**在设置页里可开关**。

> 桌面版用户请用 [`../desktop/`](../desktop/)：dsh 桌面版官方自带对所有第三方插件的启用/停用开关，那个版本不需要自己的设置卡片，而且零运行时依赖。**两个版本只装一个。**

## 安装

本插件没有发布到 npm，所以**下载 zip 就是标准安装方式**。

### 1. 下载并解压

在仓库页面点绿色的 **Code** 按钮 → **Download ZIP**，下载后解压。

解压出来是一个 `dsh-time-prefix-main` 目录（`main` 是仓库默认分支名），里面同时装着两个版本：

```
dsh-time-prefix-main/
  desktop/            ← 桌面版，本包不需要
    package.json
    cordis.patch.yml
    lib/
    locale/
  web/                ← 本插件在这层，装它
    package.json
    cordis.patch.yml
    lib/
    locale/
```

**要填的安装路径是 `web` 这一层**，也就是包含 `package.json`、`cordis.patch.yml` 的那一层。

建议把它复制出来、改名成 `dsh-time-prefix-web` 再安装，路径短一些，以后也不容易被误删。在 PowerShell 里跑一行就够（把前面那段换成你的实际解压路径）：

```sh
xcopy /E /I "%USERPROFILE%\Downloads\dsh-time-prefix-main\web" "$env:USERPROFILE\Downloads\dsh-time-prefix-web"
```

这样插件就在 `C:\Users\<你的用户名>\Downloads\dsh-time-prefix-web`。**记下这个路径，后面两步都要用。**

### 2. 装依赖

本版本依赖 `@deepseek-ai/schemastery`（`.volatile()` 从 3.18.4 起才有），装插件之前需要在该目录里装一次依赖：

```sh
cd "$env:USERPROFILE\Downloads\dsh-time-prefix-web"
npm install
```

桌面版没有这一步（零依赖），这也是桌面版更省事的原因之一。

### 3. 安装插件

**方式一：dsh 官方插件安装器（图形界面）**

在 dsh 的侧边栏点「插件」→ 右上角「+ 添加插件」→ 在对话框里填入**上面那个目录的完整路径**（对话框那行小字写的是"输入插件的包名、GitHub 仓库地址或本地目录路径"），点「安装」。桌面版有同样的图文步骤，见 [`../desktop/README.md`](../desktop/README.md)。

> 不要填仓库地址：本仓库根目录没有 `package.json`，两个版本分别在 `web/` 和 `desktop/` 子目录里，仓库根不是一个可安装的包。

**方式二：命令行**

```sh
dsh plugin --profile web add "$env:USERPROFILE\Downloads\dsh-time-prefix-web"
```

换成你自己的路径，两种办法：

- 把 `Lenovo` 换成你自己的 Windows 用户名（不确定就在文件资源管理器地址栏输入 `%USERPROFILE%` 回车看名字）。
- 或者用变量，在 PowerShell 里不管用户名是什么都能用（如上）。

> 上面是 PowerShell 写法。cmd 里把 `"$env:USERPROFILE\..."` 换成 `"%USERPROFILE%\..."`。

**无论用哪种方式，装完之后插件都是从那个目录加载的，别挪走或删掉，否则插件失效。**

## 开关

装好后在 dsh 的设置页找到「时间前缀」，里面有一个开关，可随时启用或停用。

开关是插件自己的 Config 字段 `enabled`，声明为 `.volatile()`：设置服务只把 volatile 字段投影成设置表单，也只有这些字段能通过表单写回。设置命名空间就是 profile 条目 id `dsh-time-prefix`，这也是为什么 `cordis.patch.yml` 里的行 `id` 必须和插件的 `name` 一致。

## 实现

只提供宿主侧行为：在 `agent/pre-step` 这个 waterfall 上，给本步要提交的用户消息文本前面拼上当前时间。

`agent/pre-step` 返回的消息就是 agent loop 会写进会话的 `user/message`，所以聊天记录、会话日志和模型看到的请求三者完全一致——不是只在浏览器里改写发送文本。

- **前缀里只有时间读数本身**，不带任何隐藏标记：写进 `text` 的每个字符都会被看到、也会发给模型。
- 读数是**直接拼在你写的文字前面**的，并且**后面跟一个换行**，所以整条消息读起来清爽（时间单独一行，你的话另起一行）：

  ```
  【2026/10/05，01:40】
  你的话
  ```

  消息里的图片不影响这一点——只要有文字，读数就贴在文字上。
- 只发图片、没有任何文字时，读数会作为一个独立的文本块放在图片前，且**不带尾随换行**（那种情况没有文字可拼，多一个换行只会平白空一行）。
- 已经带前缀的消息，旧前缀会被**剥掉换成当前时间**，而不是让开。草稿里带着上一次的前缀时，如果直接跳过，那个旧前缀（以及 0.1 版写在里面的隐形标记）就会被永久固化到之后每一条消息里。
- 只处理 `role === 'user'` 的消息；其他插件追加的上下文消息原样通过。
- 原消息对象不被修改（事件契约里它是不可变的）。

> **升级提示（0.1 → 0.2）**：0.1 版把隐形标记 `U+2063dsh-time-prefix` 写进了消息文本，并依赖 `@deepseek-ai/dsh-settings` 里已被删除的 `installSettingsSection`（导致宿主半边无法加载）。0.2 版修掉了这两点。如果你的输入框草稿里还残留着那个标记，不用手动清理——发一次就会被剥掉。

## 许可

MIT
