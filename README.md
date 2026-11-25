# 作者注释快照

将酒馆原生作者注释的正文和插入设置保存为快照。适用于 SillyTavern、Luker 和 TauriTavern。

## 安装与更新

在酒馆顶部「扩展」里点「安装扩展」，填写仓库地址。已安装的用户可以在「管理扩展」里更新，然后刷新页面或重开客户端。 [扩展仓库](https://github.com/qiyuebuyuan1993/authors-note-presets.git)

手动安装时，把包含 `manifest.json` 的 `authors-note-presets` 文件夹复制到扩展目录。

| 客户端 | 复制到 |
| --- | --- |
| SillyTavern 和 Luker 源码版 | 数据目录下的 `default-user/extensions/`。使用其他账户时，将 `default-user` 换成该账户的目录名。 |
| Luker 桌面端和 Android 版 | Luker 数据目录下的 `extensions/third-party/`。Windows 桌面端可从托盘菜单打开数据目录。 |
| TauriTavern | 数据目录下的 `default-user/extensions/`。以包含 `default-user` 的目录为准。 |

[SillyTavern 扩展目录](https://docs.sillytavern.app/installation/st-1.12.0-migration-guide/) · [Luker 桌面端数据目录](https://luker.cups.moe/guide/desktop.html) · [Luker Android 扩展目录](https://luker.cups.moe/guide/migration-from-termux.html) · [TauriTavern 扩展目录](https://github.com/Darkatse/TauriTavern/blob/v2.4.0/ExtensionDEV.md)

## 使用

1. 打开一条聊天，在输入框旁的魔法棒菜单里选「作者注释快照」。也可以在顶部「扩展」中启用酒馆的「快速回复」，然后点击输入框上方自动添加的同名按钮。
2. 在酒馆原生「作者注释」面板填好正文和参数。打开插件，点「保存当前快照」，为快照命名并勾选要保存的范围。
3. 点击列表中任意快照即可载入。点「编辑」可以改名、改快照正文或删除快照。
4. 点「清空当前聊天注释」清空本聊天的正文。清空和载入后可在当前会话撤销。撤销以受影响的字段保持载入时的值为前提。

| 保存范围 | 内容和载入位置 |
| --- | --- |
| 当前聊天 | 正文、插入位置、深度、角色、频率，以及作者注释面板的全局世界信息扫描开关 |
| 人物作者注 | 正文、是否启用、替换或插入位置。载入时写入当前角色。群聊可以载入聊天与默认两项。 |
| 默认作者注 | 正文、插入位置、深度、角色和频率。应用到以后新建的聊天。 |

可保存正文为空的快照。旧版纯正文预设在列表中继续可用，载入时只写入当前聊天的正文。

## 验证

浏览器集成测试使用 SillyTavern 1.19.1、Luker 2.8.0 和 TauriTavern 2.4.0 的原生作者注释代码与快速回复 API。覆盖按钮导入、点击开窗、原有回复组保留、刷新去重和输入草稿保留。

千千结联测使用 1.3.3 的原始记忆比对和注入函数。验证内容包括聊天绑定、楼层锚点、备用回复元数据、前传和召回槽位，以及清空注释时模拟写入的新记忆回执。宿主存储在测试中模拟，完整客户端和移动端实机待验。 [千千结 1.3.3 源码](https://github.com/atonal519/ST-MyriadKnots/tree/30a4a40e10568e7085409cb84c51885803f6e177)
