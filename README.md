# dsh-time-prefix

在 dsh 中为每条用户消息自动添加当前时间前缀的小插件，可在设置页开关。

## 安装

### 懒人方式

对你的 dsh 说：

> 安装这个 GitHub 仓库里的插件：https://github.com/2522669008-zcy/dsh-time-prefix

### 手动方式

```sh
git clone https://github.com/2522669008-zcy/dsh-time-prefix
dsh plugin --profile web add ./dsh-time-prefix
```

如果你的 `dsh` 命令不在 PATH 里，用：

```sh
npx @deepseek-ai/dsh plugin --profile web add ./dsh-time-prefix
```

安装后重启 dsh Web UI 即可。
## 功能

- 每条用户消息前自动插入 `【2026/08/23，22:36】` 这样的时间文本
- 设置页可开启/关闭
- 与 dsh-timegap-plugin 的区别：本插件是“每条消息都带时间”，适合需要持续时间感知的场景

## 许可

MIT
