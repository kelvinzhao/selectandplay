/**
 * Select & Play - Popup Script
 * 弹窗页面逻辑
 */

(function() {
  'use strict';

  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusIndicator = document.getElementById('statusIndicator');
  const openOptionsBtn = document.getElementById('openOptions');

  // 更新UI
  function updateUI(isEnabled) {
    if (isEnabled) {
      toggleSwitch.classList.add('active');
      statusIndicator.classList.add('active');
    } else {
      toggleSwitch.classList.remove('active');
      statusIndicator.classList.remove('active');
    }
  }

  // 加载状态
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (response) {
      updateUI(response.isEnabled);
    }
  });

  // 切换状态
  toggleSwitch.addEventListener('click', () => {
    toggleSwitch.disabled = true;
    chrome.runtime.sendMessage({ action: 'toggleState' }, (response) => {
      toggleSwitch.disabled = false;
      if (response) {
        updateUI(response.isEnabled);
      }
    });
  });

  // 打开设置
  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

})();
