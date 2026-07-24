# Gemini 对话批量移动到笔记本 (Gemini Batch Move to Notebook)

一个用于 [Google Gemini](https://gemini.google.com/) 的 Tampermonkey（篡改猴）脚本。开启“高级编辑模式”后，即可通过 `Shift` / `Ctrl` 快捷键批量选中多条对话，并一键将其批量移动到指定笔记本中。

---

## 🚀 快速安装

请确保你的浏览器已安装 **Tampermonkey（篡改猴）** 或 **Violentmonkey（暴力猴）** 扩展。

点击下方链接直接安装：

👉 **[点击此处一键安装油猴脚本 (GitHub Raw)](https://raw.githubusercontent.com/rainppr/gemini-batch-move-to-notebook/main/gemini-batch-move-to-notebook.user.js)**

*(备用 GitHub Raw 链接: `https://github.com/rainppr/gemini-batch-move-to-notebook/raw/main/gemini-batch-move-to-notebook.user.js`)*

### 安装步骤

1. 打开浏览器并安装 [Tampermonkey 扩展](https://www.tampermonkey.net/)。
2. 点击上方的 **GitHub Raw 安装链接**。
3. Tampermonkey 会自动识别并弹窗，点击 **“安装”** 或 **“更新”** 按钮即可。
4. 刷新 Gemini 页面（`https://gemini.google.com/`）即可生效。

---

## ✨ 功能特性

* 🎨 **Gemini 风格非阻塞 Toast 提示框**：抛弃传统浏览器 `alert()` 弹窗，采用完美契合 Gemini 官方设计风格的左上角悬浮提示框。自动显示与隐去，**绝不阻塞网页主线程 JS 运行**，有效避免因弹窗造成的移动失败或中断。
* 🖱️ **灵活的多选操作**：支持按住 `Shift` 进行多条对话区间选定，以及使用 `Ctrl` 或鼠标点击单个进行自由加选/退选。
* 🤖 **智能化批量移动**：批量触发后，仅需在弹出的第一个窗口中手动选择一次目标笔记本，后续所有选中对话均由脚本自动识别并连续移动。
* 🛡️ **无缝兼容 TrustedHTML**：采用事件捕获与纯原生 DOM 派发，无视 TrustedHTML 架构限制。

---

## 📖 使用说明

1. 登录 [Google Gemini](https://gemini.google.com/) 网页版。
2. 侧边栏对话列表顶部会自动注入控制工具栏，点击 **【开启高级编辑】**。
3. 此时侧边栏进入多选模式：
   * 按住 `Shift` 键点击两条对话，可快速选择区间内的所有对话。
   * 直接点击对话可进行单选切换。
4. 选定所需对话后，点击工具栏中的 **【批量移动到...】** 按钮。
5. 在左上角 Toast 提示和弹出的“移动到笔记本”列表中，**点击选择你想要移入的目标笔记本**。
6. 脚本将自动处理所有剩余对话的移动工作，完成后会弹出“🎉 批量移动完成！”提示。

---

## 📄 开源协议

[MIT License](LICENSE)
