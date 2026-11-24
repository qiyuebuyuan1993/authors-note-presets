# 作者注释预设

在当前聊天的「作者注释」输入框上方保存和切换多段注释。适用于 SillyTavern、Luker 和 TauriTavern 的第三方前端扩展。

## 安装

1. 解压 ZIP，把 `authors-note-presets` 文件夹完整复制到下表对应的位置。打开复制后的文件夹，应当能直接看到 `manifest.json`。
2. 刷新网页或重开客户端。若扩展管理中显示「作者注释预设」已禁用，将它启用。
3. 打开一条聊天，从聊天输入框旁的菜单进入「作者注释」。

| 客户端 | 复制到 |
| --- | --- |
| SillyTavern 和 Luker 源码版 | 数据目录下的 `default-user/extensions/`。使用其他账户时，将 `default-user` 换成该账户的目录名。 |
| Luker 桌面端和 Android 版 | Luker 数据目录下的 `extensions/third-party/`。Windows 桌面端可从托盘菜单打开数据目录。 |
| TauriTavern | 数据目录下的 `default-user/extensions/`。以包含 `default-user` 的目录为准。 |

可以手动创建缺少的 `extensions` 或 `third-party` 文件夹。若设备上的应用数据目录无法直接访问，可以把扩展文件放在客户端可匿名拉取的 HTTPS Git 仓库根目录，通过「安装扩展」输入仓库地址。

[SillyTavern 扩展目录](https://docs.sillytavern.app/installation/st-1.12.0-migration-guide/) · [Luker 桌面端数据目录](https://luker.cups.moe/guide/desktop.html) · [Luker Android 扩展目录](https://luker.cups.moe/guide/migration-from-termux.html) · [TauriTavern 扩展目录](https://github.com/Darkatse/TauriTavern/blob/v2.4.0/ExtensionDEV.md)

## 使用

- 点「新建预设」，输入名称和内容，再点「保存预设」。当前注释会带入为草稿，预设保存在账号的扩展设置中，各聊天都能调用。
- 点某条预设旁的「填入」，就会把正文复制到当前聊天的作者注释。位置、深度、角色和频率由原面板的设置决定。
- 点「取消填入」恢复第一次填入前的文字。原来为空就清空。填入后手动改过注释会结束这次恢复操作，此后再填入时以修改后的文字为准。
- 点「编辑」即可改名、改正文或删除预设。编辑和删除作用于预设库，已经复制到聊天里的文字由聊天管理。

## 验证

浏览器集成测试使用了 SillyTavern 1.19.1、Luker 2.8.0 和 TauriTavern 2.4.0 的原生面板和作者注释处理代码，覆盖保存、填入、取消、切换聊天、群聊和重载。测试使用模拟的存储后端，完整客户端安装和移动端实机待验。
