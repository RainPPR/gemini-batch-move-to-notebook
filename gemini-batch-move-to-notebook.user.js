// ==UserScript==
// @name         Gemini 对话批量移动到笔记本 (Batch Move to Notebook)
// @namespace    https://github.com/rainppr/gemini-batch-move-to-notebook
// @version      1.2
// @description  开启高级编辑模式后，可用 Shift/Ctrl 快速多选 Gemini 对话，并一键批量移动到指定笔记本。采用非阻塞式浮动提示框，无视 TrustedHTML 限制。
// @author       RainPPR
// @match        *://gemini.google.com/*
// @updateURL    https://raw.githubusercontent.com/rainppr/gemini-batch-move-to-notebook/main/gemini-batch-move-to-notebook.user.js
// @downloadURL  https://raw.githubusercontent.com/rainppr/gemini-batch-move-to-notebook/main/gemini-batch-move-to-notebook.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let advancedMode = false;
    let isProcessing = false;
    let selectedItems = new Set();
    let lastSelectedIndex = -1;

    function createElement(tag, attributes = {}, styles = {}, text = '') {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(attributes)) {
            el.setAttribute(key, value);
        }
        for (const [key, value] of Object.entries(styles)) {
            el.style[key] = value;
        }
        if (text) {
            el.appendChild(document.createTextNode(text));
        }
        return el;
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function waitForElement(selector, parent = document, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = parent.querySelector(selector);
            if (el) return el;
            await sleep(50);
        }
        return null;
    }

    // 1. 注入自定义样式
    function injectStyles() {
        if (document.getElementById('gemini-bulk-styles')) return;
        const styleText = `
            .bulk-selected > a {
                background-color: rgba(66, 133, 244, 0.25) !important;
                border: 2px solid #4285f4 !important;
                border-radius: 8px;
            }
            #gemini-bulk-toolbar {
                margin: 8px 16px;
                padding: 10px;
                display: flex;
                gap: 10px;
                border-radius: 8px;
                background-color: var(--gem-sys-color--surface, #1e1f20);
                border: 1px solid var(--gem-sys-color--outline, #444746);
                flex-wrap: wrap;
                align-items: center;
            }
            .gemini-bulk-btn {
                background: #8ab4f8;
                color: #202124;
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-family: inherit;
                font-weight: 600;
                font-size: 13px;
                transition: background 0.2s;
            }
            .gemini-bulk-btn:hover { background: #aecbfa; }
            .gemini-bulk-btn.off {
                background: #3c4043;
                color: #e8eaed;
            }
            .gemini-bulk-btn.off:hover { background: #5f6368; }
            #bulk-status {
                font-size: 13px;
                color: #e8eaed;
                font-weight: 500;
            }
            #gemini-toast-container {
                position: fixed;
                top: 20px;
                left: 20px;
                z-index: 999999;
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }
            .gemini-toast-item {
                background-color: var(--gem-sys-color--surface-container-high, #28292a);
                color: var(--gem-sys-color--on-surface, #e3e2e6);
                border: 1px solid var(--gem-sys-color--outline-variant, #444746);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
                padding: 12px 18px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 500;
                font-family: Google Sans, Roboto, sans-serif;
                pointer-events: auto;
                opacity: 0;
                transform: translateY(-10px);
                transition: opacity 0.3s ease, transform 0.3s ease;
                display: flex;
                align-items: center;
                max-width: 380px;
                line-height: 1.4;
            }
            .gemini-toast-item.show {
                opacity: 1;
                transform: translateY(0);
            }
            .gemini-toast-item.hide {
                opacity: 0;
                transform: translateY(-10px);
            }
        `;
        const styleEl = createElement('style', { id: 'gemini-bulk-styles' });
        styleEl.appendChild(document.createTextNode(styleText));
        document.head.appendChild(styleEl);
    }

    // 显示 Gemini 风格顶部非阻塞 Toast 提示
    function showToast(message, duration = 3500) {
        let container = document.getElementById('gemini-toast-container');
        if (!container) {
            container = createElement('div', { id: 'gemini-toast-container' });
            document.body.appendChild(container);
        }

        const toast = createElement('div', { class: 'gemini-toast-item' }, {}, message);
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    // 2. 初始化工具栏
    function initToolbar() {
        if (document.getElementById('gemini-bulk-toolbar')) return;
        const targetParent = document.querySelector('conversations-list');
        if (!targetParent) return;

        const toolbar = createElement('div', { id: 'gemini-bulk-toolbar' });
        const toggleBtn = createElement('button', { class: 'gemini-bulk-btn off' }, {}, '开启高级编辑');
        const moveBtn = createElement('button', { class: 'gemini-bulk-btn' }, { display: 'none' }, '批量移动到...');
        const statusTxt = createElement('span', { id: 'bulk-status' });

        toggleBtn.onclick = () => {
            if (isProcessing) return;
            advancedMode = !advancedMode;
            if (advancedMode) {
                toggleBtn.textContent = '退出高级编辑';
                toggleBtn.className = 'gemini-bulk-btn';
                moveBtn.style.display = 'block';
                statusTxt.textContent = '按住 Shift 或 Ctrl 批量点选';
            } else {
                toggleBtn.textContent = '开启高级编辑';
                toggleBtn.className = 'gemini-bulk-btn off';
                moveBtn.style.display = 'none';
                clearSelection();
            }
        };

        moveBtn.onclick = async () => {
            if (selectedItems.size === 0) {
                showToast('⚠️ 请先在下方列表中点选对话！');
                return;
            }
            await executeBatchMove();
        };

        toolbar.appendChild(toggleBtn);
        toolbar.appendChild(moveBtn);
        toolbar.appendChild(statusTxt);

        targetParent.parentElement.insertBefore(toolbar, targetParent);
    }

    // 3. 拦截点击事件
    document.addEventListener('click', (e) => {
        if (!advancedMode) return;
        if (!e.isTrusted) return; // 放行脚本代码产生的合成点击

        // 【关键修复】：放行所有的弹出层容器内的点击（比如操作菜单、选择笔记本对话框、背景遮罩）
        if (e.target.closest('.cdk-overlay-container')) {
            return;
        }

        // 如果在自动化中，阻断用户对背景页面的点击
        if (isProcessing) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
        }

        const item = e.target.closest('gem-nav-list-item[data-test-id="conversation"]');
        if (!item) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const allItems = Array.from(document.querySelectorAll('gem-nav-list-item[data-test-id="conversation"]'));
        const currentIndex = allItems.indexOf(item);

        if (e.shiftKey && lastSelectedIndex !== -1) {
            const start = Math.min(lastSelectedIndex, currentIndex);
            const end = Math.max(lastSelectedIndex, currentIndex);
            for (let i = start; i <= end; i++) {
                toggleSelection(allItems[i], true);
            }
        } else {
            const isSelected = item.classList.contains('bulk-selected');
            toggleSelection(item, !isSelected);
        }

        lastSelectedIndex = currentIndex;
        updateStatusText(`已选定 ${selectedItems.size} 个对话`);

    }, true);

    function toggleSelection(item, forceState) {
        const aTag = item.querySelector('a');
        if (!aTag) return;
        const href = aTag.getAttribute('href');

        if (forceState) {
            item.classList.add('bulk-selected');
            selectedItems.add(href);
        } else {
            item.classList.remove('bulk-selected');
            selectedItems.delete(href);
        }
    }

    function clearSelection() {
        selectedItems.clear();
        document.querySelectorAll('.bulk-selected').forEach(el => el.classList.remove('bulk-selected'));
        lastSelectedIndex = -1;
        updateStatusText('');
    }

    function updateStatusText(msg) {
        const statusTxt = document.getElementById('bulk-status');
        if (statusTxt) {
            statusTxt.textContent = msg;
        }
    }

    // 4. 执行自动化的批量移动
    async function executeBatchMove() {
        isProcessing = true;
        const itemsToProcess = Array.from(selectedItems);
        let targetNotebookName = null;

        for (let i = 0; i < itemsToProcess.length; i++) {
            const href = itemsToProcess[i];
            updateStatusText(`正在移动第 ${i + 1} / ${itemsToProcess.length} 个...`);

            const itemEl = document.querySelector(`a[href="${href}"]`)?.closest('gem-nav-list-item');
            if (!itemEl) continue;

            itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(300);

            const menuBtn = itemEl.querySelector('[data-test-id="actions-menu-button"]');
            if (!menuBtn) continue;
            menuBtn.click();

            const menuPanel = await waitForElement('.conversation-actions-menu');
            if (!menuPanel) continue;
            await sleep(200);

            const menuItems = Array.from(menuPanel.querySelectorAll('button[mat-menu-item]'));
            const addToNotebookBtn = menuItems.find(btn => {
                const icon = btn.querySelector('mat-icon');
                return (icon && icon.textContent.trim() === 'notebook') || btn.textContent.includes('添加至笔记本');
            });

            if (!addToNotebookBtn) {
                document.body.click();
                continue;
            }
            addToNotebookBtn.click();

            const dialog = await waitForElement('mat-dialog-container move-to-project-dialog');
            if (!dialog) continue;
            await sleep(300);

            const options = Array.from(dialog.querySelectorAll('mat-list-option'));

            if (i === 0) {
                const promptMsg = '👉 请在弹出的列表中，点击你要移动到的笔记本！';
                updateStatusText(promptMsg);
                showToast(promptMsg, 5000);

                // 【关键增强】：捕捉你选中的笔记本，加入定时器探测弹窗被强制关闭的情况
                targetNotebookName = await new Promise(resolve => {
                    let resolved = false;

                    const clickHandler = (e) => {
                        if (!e.isTrusted) return;
                        const option = e.target.closest('mat-list-option');
                        if (option) {
                            const name = option.querySelector('.gds-label-l')?.textContent?.trim();
                            resolved = true;
                            document.removeEventListener('click', clickHandler, true);
                            resolve(name);
                        }
                    };
                    document.addEventListener('click', clickHandler, true);

                    // 如果探测到弹窗由于点了其它地方被关闭，自动判定为取消
                    const checkInterval = setInterval(() => {
                        if (!document.querySelector('mat-dialog-container')) {
                            clearInterval(checkInterval);
                            if (!resolved) {
                                document.removeEventListener('click', clickHandler, true);
                                resolve(null);
                            }
                        }
                    }, 500);
                });

                if (!targetNotebookName) {
                    showToast('ℹ️ 批量移动已取消。');
                    break;
                }

                while (document.querySelector('mat-dialog-container')) {
                    await sleep(200);
                }
            } else {
                // 脚本代你点击指定的选项
                const targetOption = options.find(opt => opt.querySelector('.gds-label-l')?.textContent?.trim() === targetNotebookName);
                if (targetOption) {
                    targetOption.click();
                    while (document.querySelector('mat-dialog-container')) {
                        await sleep(200);
                    }
                } else {
                    document.querySelector('[mat-dialog-close]')?.click();
                    while (document.querySelector('mat-dialog-container')) {
                        await sleep(200);
                    }
                }
            }

            itemEl.classList.remove('bulk-selected');
            itemEl.style.opacity = '0.4';
        }

        isProcessing = false;
        showToast('🎉 批量移动完成！', 4000);
        clearSelection();
        if (advancedMode) {
            document.querySelector('#gemini-bulk-toolbar .gemini-bulk-btn').click();
        }
    }

    // 5. 守护进程
    const observer = new MutationObserver(() => {
        injectStyles();
        initToolbar();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
