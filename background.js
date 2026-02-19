/**
 * Select & Play - Background Service Worker
 * 后台服务脚本，管理扩展状态
 */

(function() {
  'use strict';

  // 默认状态
  const DEFAULT_STATE = {
    isEnabled: true
  };

  // ==================== 安装/更新 ====================
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Select & Play] 扩展已安装/更新:', details.reason);

    // 设置图标（无论安装还是更新都需要根据当前状态设置图标）
    chrome.storage.sync.get(['isEnabled'], (result) => {
      const isEnabled = result.isEnabled !== false;
      updateIcon(isEnabled);
      console.log('[Select & Play] 图标已初始化:', isEnabled ? '启用' : '禁用');
    });

    if (details.reason === 'install') {
      // 首次安装，初始化默认状态
      chrome.storage.sync.set(DEFAULT_STATE, () => {
        console.log('[Select & Play] 默认状态已设置');
        // 设置初始图标
        updateIcon(true);
      });

      // 打开设置页面
      chrome.runtime.openOptionsPage();
    }
  });

  // ==================== 消息监听 ====================
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleState') {
      chrome.storage.sync.get(['isEnabled'], (result) => {
        const newState = !result.isEnabled;
        chrome.storage.sync.set({ isEnabled: newState }, () => {
          console.log('[Select & Play] 状态已切换:', newState ? '启用' : '禁用');

          // 通知所有标签页
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'toggleState',
                  isEnabled: newState
                }).catch(() => {
                  // 忽略无法发送消息的标签页
                });
              }
            });
          });

          // 更新图标
          updateIcon(newState);

          // 响应popup
          sendResponse({ isEnabled: newState });
        });
      });
      return true; // 保持消息通道
    }

    if (message.action === 'getState') {
      chrome.storage.sync.get(['isEnabled'], (result) => {
        sendResponse({ isEnabled: result.isEnabled !== false });
      });
      return true;
    }
  });

  // ==================== 启动时更新图标 ====================
  function initializeIcon() {
    chrome.storage.sync.get(['isEnabled'], (result) => {
      const isEnabled = result.isEnabled !== false;
      updateIcon(isEnabled);
      console.log('[Select & Play] 图标已初始化:', isEnabled ? '启用' : '禁用');
    });
  }

  // Service Worker 启动时初始化
  initializeIcon();

  // Service Worker 被唤醒时也需要确保图标正确
  chrome.runtime.onStartup.addListener(() => {
    console.log('[Select & Play] 浏览器启动，初始化图标');
    initializeIcon();
  });

  /**
   * 更新扩展图标
   */
  function updateIcon(isEnabled) {
    const path = isEnabled
      ? {
          '16': 'icons/icon16.png',
          '48': 'icons/icon48.png',
          '128': 'icons/icon128.png'
        }
      : {
          '16': 'icons/icon16-disabled.png',
          '48': 'icons/icon48-disabled.png',
          '128': 'icons/icon128-disabled.png'
        };

    chrome.action.setIcon({ path });
  }

  // ==================== 存储变化监听 ====================
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.isEnabled) {
      const isEnabled = changes.isEnabled.newValue;
      console.log('[Select & Play] 启用状态已变化:', isEnabled);
      updateIcon(isEnabled);
    }
  });

  console.log('[Select & Play] Background script 已加载');
})();
