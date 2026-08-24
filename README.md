# dsh-time-prefix

在 dsh 中为每条用户消息自动添加当前时间前缀的小插件，可在设置页开关。

## 安装

```sh
dsh plugin --profile web add F:\path\to\dsh-time-prefix
```

## 功能

- 每条用户消息前自动插入 `【2026/08/23，22:36】` 这样的时间文本
- 设置页可开启/关闭
- 与 dsh-timegap-plugin 的区别：本插件是“每条消息都带时间”，适合需要持续时间感知的场景

## 许可

MIT