/**
 * Select & Play - Content Script
 * 核心功能：文本选择检测、浮窗显示、TTS播放控制
 */

(function() {
  'use strict';

  // ==================== 状态管理 ====================
  const state = {
    isEnabled: false,           // 扩展是否启用
    currentPanel: null,         // 当前浮窗元素
    currentAudio: null,         // 当前音频实例
    selectedText: '',           // 当前选中的文本
    detectedLang: '',           // 检测到的语言
    isPlaying: false,           // 是否正在播放
    isPaused: false,            // 是否已暂停
    isLoading: false,           // 是否正在加载
    selectionRange: null,       // 选区范围
    lastSelectedText: ''        // 上次选中的文本
  };

  // 语言标签映射
  const langLabels = {
    'chinese': '中文',
    'english': 'English',
    'japanese': '日本語'
  };

  const langClasses = {
    'chinese': 'zh',
    'english': 'en',
    'japanese': 'ja'
  };

  // ==================== 工具函数 ====================

  /**
   * 防抖函数
   */
  function debounce(func, wait) {
    let timer = null;
    return function executedFunction(...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        func.apply(this, args);
      }, wait);
    };
  }

  /**
   * 检测文本语言
   */
  function detectLanguage(text) {
    const trimmedText = text.trim();
    const chineseChars = (trimmedText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const japaneseChars = (trimmedText.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    const kanjiChars = (trimmedText.match(/[\u4e00-\u9faf]/g) || []).length;
    const englishChars = (trimmedText.match(/[a-zA-Z]/g) || []).length;
    const totalLength = trimmedText.length;

    // 优先检查日文假名
    if (japaneseChars > 0) {
      return 'japanese';
    }

    // 检查中文特征
    const hasChineseMarkers = /[的了吗呢吧啊呀嘛着呢个们把给让在和与为]/.test(trimmedText);
    if (hasChineseMarkers && chineseChars > 0) {
      return 'chinese';
    }

    // 检查日文助词
    const hasJapaneseMarkers = /[はがのにをでへとやからまでだけ]/.test(trimmedText);
    if (hasJapaneseMarkers && !hasChineseMarkers) {
      return 'japanese';
    }

    // 英文检测
    if (englishChars > totalLength * 0.5 && japaneseChars === 0 && chineseChars === 0) {
      return 'english';
    }

    // 默认中文
    if (chineseChars > 0) {
      return 'chinese';
    }
    return 'english';
  }

  /**
   * 创建SVG图标
   */
  function createIcon(name, size = 16) {
    const icons = {
      close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
      play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
      pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
      stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>',
      loading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>',
      speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'
    };

    const svg = icons[name] || icons.play;
    return `<svg width="${size}" height="${size}" viewBox="${svg.match(/viewBox="([^"]+)"/)[1]}">${svg.substring(svg.indexOf('>') + 1)}</svg>`;
  }

  // ==================== 浮窗管理 ====================

  /**
   * 计算浮窗位置
   */
  function calculatePosition(selection) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const panelWidth = 320;
    const panelHeight = 200;
    const margin = 16;
    const arrowOffset = 20;

    let top = rect.bottom + window.scrollY + margin + 12;
    let left = rect.left + window.scrollX + (rect.width - panelWidth) / 2;

    // 边界检测
    if (left < margin) left = margin;
    if (left + panelWidth > window.innerWidth - margin) {
      left = window.innerWidth - panelWidth - margin;
    }

    // 下方空间不足时显示在选区上方
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < panelHeight + margin && rect.top > panelHeight + margin) {
      top = rect.top + window.scrollY - panelHeight - margin - 12;
    }

    return { top, left, arrowPosition: 'top' };
  }

  /**
   * 创建浮窗元素
   */
  function createPanel() {
    const panel = document.createElement('div');
    panel.className = 'sasp-float-panel';
    panel.innerHTML = `
      <div class="sasp-panel-header">
        <div class="sasp-header-left">
          <div class="sasp-header-title">
            ${createIcon('speaker', 16)}
            <span>语音朗读</span>
          </div>
          <span class="sasp-lang-badge" id="saspLangBadge"></span>
        </div>
        <button class="sasp-close-btn" id="saspCloseBtn" title="关闭">
          ${createIcon('close', 16)}
        </button>
      </div>
      <div class="sasp-panel-body">
        <div class="sasp-text-preview" id="saspTextPreview"></div>
        <div class="sasp-play-status" id="saspPlayStatus">
          <!-- 状态指示器 -->
        </div>
      </div>
    `;

    // 绑定事件
    panel.querySelector('#saspCloseBtn').addEventListener('click', hidePanel);
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('mouseup', (e) => e.stopPropagation());

    return panel;
  }

  /**
   * 更新浮窗状态显示
   */
  function updatePanelStatus() {
    const statusContainer = state.currentPanel.querySelector('#saspPlayStatus');

    // 状态优先级：加载中 > 播放中 > 已暂停 > 初始状态

    if (state.isLoading) {
      // 1. 加载中状态（最高优先级）
      statusContainer.innerHTML = `
        <div class="sasp-status-indicator loading">
          <div class="sasp-spinner"></div>
          <span>正在合成语音...</span>
        </div>
      `;
    } else if (state.isPlaying) {
      // 2. 播放中状态
      statusContainer.innerHTML = `
        <div class="sasp-status-indicator playing">
          <div class="sasp-wave-indicator">
            <div class="sasp-wave-bar"></div>
            <div class="sasp-wave-bar"></div>
            <div class="sasp-wave-bar"></div>
            <div class="sasp-wave-bar"></div>
            <div class="sasp-wave-bar"></div>
          </div>
          <span>正在播放...</span>
        </div>
        <div class="sasp-controls">
          <button class="sasp-btn sasp-btn-secondary" id="saspPauseBtn">
            ${createIcon('pause', 16)}
            暂停
          </button>
          <button class="sasp-btn sasp-btn-danger" id="saspStopBtn">
            ${createIcon('stop', 16)}
            停止
          </button>
        </div>
      `;
      state.currentPanel.querySelector('#saspPauseBtn').addEventListener('click', pauseAudio);
      state.currentPanel.querySelector('#saspStopBtn').addEventListener('click', stopAudio);
    } else if (state.isPaused && state.currentAudio) {
      // 3. 已暂停状态（有音频但暂停中）
      statusContainer.innerHTML = `
        <div class="sasp-controls">
          <button class="sasp-btn sasp-btn-primary" id="saspResumeBtn">
            ${createIcon('play', 16)}
            继续播放
          </button>
          <button class="sasp-btn sasp-btn-danger" id="saspStopBtn">
            ${createIcon('stop', 16)}
            停止
          </button>
        </div>
      `;
      state.currentPanel.querySelector('#saspResumeBtn').addEventListener('click', resumeAudio);
      state.currentPanel.querySelector('#saspStopBtn').addEventListener('click', stopAudio);
    } else {
      // 4. 初始状态（无音频或已停止）
      statusContainer.innerHTML = `
        <div class="sasp-controls">
          <button class="sasp-btn sasp-btn-primary" id="saspPlayBtn">
            ${createIcon('play', 16)}
            播放
          </button>
        </div>
      `;
      state.currentPanel.querySelector('#saspPlayBtn').addEventListener('click', startTTS);
    }
  }

  /**
   * 显示配置提示
   */
  function showConfigNotice() {
    const statusContainer = state.currentPanel.querySelector('#saspPlayStatus');
    statusContainer.innerHTML = `
      <div class="sasp-config-notice">
        ${createIcon('warning', 16)}
        <span>
          请先配置
          <a href="#" class="sasp-config-link" id="saspConfigLink">Azure TTS 服务</a>
        </span>
      </div>
    `;
    state.currentPanel.querySelector('#saspConfigLink').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  /**
   * 显示错误信息
   */
  function showError(message) {
    state.isLoading = false;
    state.isPlaying = false;
    state.isPaused = false;

    const statusContainer = state.currentPanel.querySelector('#saspPlayStatus');
    statusContainer.innerHTML = `
      <div class="sasp-error-message">
        ${createIcon('error', 16)}
        <span>${message}</span>
      </div>
      <div class="sasp-controls">
        <button class="sasp-btn sasp-btn-secondary" id="saspRetryBtn">
          ${createIcon('play', 16)}
          重试
        </button>
      </div>
    `;
    state.currentPanel.querySelector('#saspRetryBtn')?.addEventListener('click', () => {
      startTTS();
    });
  }

  /**
   * 显示浮窗
   */
  function showPanel() {
    // 移除旧浮窗
    if (state.currentPanel) {
      state.currentPanel.remove();
    }

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    // 检测语言
    state.detectedLang = detectLanguage(state.selectedText);

    // 创建新浮窗
    state.currentPanel = createPanel();
    document.body.appendChild(state.currentPanel);

    // 设置位置
    const position = calculatePosition(selection);
    state.currentPanel.style.top = position.top + 'px';
    state.currentPanel.style.left = position.left + 'px';

    // 更新内容
    const preview = state.currentPanel.querySelector('#saspTextPreview');
    preview.textContent = state.selectedText.length > 200
      ? state.selectedText.substring(0, 200) + '...'
      : state.selectedText;

    const langBadge = state.currentPanel.querySelector('#saspLangBadge');
    langBadge.textContent = langLabels[state.detectedLang] || state.detectedLang;
    langBadge.className = `sasp-lang-badge ${langClasses[state.detectedLang] || ''}`;

    // 更新状态
    updatePanelStatus();

    // 高亮选中的文本
    highlightSelection();
  }

  /**
   * 隐藏浮窗
   */
  function hidePanel() {
    if (state.currentPanel) {
      state.currentPanel.remove();
      state.currentPanel = null;
    }
    removeHighlight();
  }

  /**
   * 高亮选中的文本
   */
  function highlightSelection() {
    removeHighlight();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    try {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'sasp-text-highlight';
      range.surroundContents(span);
      state.selectionRange = range;
    } catch (e) {
      // 跨元素选择无法高亮，忽略
    }
  }

  /**
   * 移除高亮
   */
  function removeHighlight() {
    const highlights = document.querySelectorAll('.sasp-text-highlight');
    highlights.forEach(el => {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    });
    state.selectionRange = null;
  }

  // ==================== TTS 功能 ====================

  /**
   * 清理音频资源
   */
  function cleanupAudio() {
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.onended = null;
      state.currentAudio.onerror = null;
      state.currentAudio.onpause = null;
      if (state.currentAudio.audioUrl) {
        URL.revokeObjectURL(state.currentAudio.audioUrl);
      }
      state.currentAudio = null;
    }
  }

  /**
   * 停止当前音频
   */
  function stopAudio() {
    cleanupAudio();
    state.isPlaying = false;
    state.isPaused = false;
    state.isLoading = false;
    if (state.currentPanel) {
      updatePanelStatus();
    }
  }

  /**
   * 暂停音频
   */
  function pauseAudio() {
    if (state.currentAudio && state.isPlaying) {
      state.currentAudio.pause();
      state.isPlaying = false;
      state.isPaused = true;
      // 立即更新UI
      if (state.currentPanel) {
        updatePanelStatus();
      }
    }
  }

  /**
   * 恢复播放
   */
  function resumeAudio() {
    if (state.currentAudio && state.isPaused) {
      state.currentAudio.play();
      state.isPlaying = true;
      state.isPaused = false;
      // 立即更新UI
      if (state.currentPanel) {
        updatePanelStatus();
      }
    }
  }

  /**
   * 开始TTS合成和播放
   */
  async function startTTS() {
    if (!state.selectedText || state.isLoading) return;

    // 检查配置
    const config = await chrome.storage.sync.get('azureConfig');
    if (!config.azureConfig || !config.azureConfig.key || !config.azureConfig.region) {
      showConfigNotice();
      return;
    }

    // 清理之前的音频（但不调用stopAudio，避免重置UI状态）
    cleanupAudio();
    state.isPlaying = false;
    state.isPaused = false;
    state.isLoading = true;
    updatePanelStatus();

    try {
      const settings = await chrome.storage.sync.get('ttsSettings');
      const ttsSettings = settings.ttsSettings || {};

      // 默认语音配置（与 options.js 保持一致）
      const defaultVoices = {
        'chinese': { voice: 'zh-CN-XiaoxiaoNeural', speed: '1.0' },
        'english': { voice: 'en-US-JennyNeural', speed: '1.0' },
        'japanese': { voice: 'ja-JP-NanamiNeural', speed: '1.0' }
      };

      const voiceSettings = ttsSettings[state.detectedLang] || defaultVoices[state.detectedLang] || defaultVoices['chinese'];

      // 根据 XML lang 属性
      const langMap = {
        'chinese': 'zh-CN',
        'english': 'en-US',
        'japanese': 'ja-JP'
      };

      // 构建SSML
      let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${langMap[state.detectedLang] || 'zh-CN'}">
        <voice name="${voiceSettings.voice}">
          <prosody rate="${voiceSettings.speed}">${escapeXml(state.selectedText)}</prosody>
        </voice>
      </speak>`;

      // 调用Azure TTS API
      const response = await fetch(`https://${config.azureConfig.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': config.azureConfig.key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          'User-Agent': 'Select-and-Play-Extension'
        },
        body: ssml
      });

      if (!response.ok) {
        throw new Error(`TTS请求失败: ${response.status}`);
      }

      const audioContent = await response.arrayBuffer();
      const audioBlob = new Blob([audioContent], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // 创建新音频
      const audio = new Audio(audioUrl);
      audio.audioUrl = audioUrl;
      state.currentAudio = audio;

      // 设置事件监听器
      audio.onended = () => {
        state.isPlaying = false;
        state.isPaused = false;
        updatePanelStatus();
      };

      audio.onerror = () => {
        showError('音频播放失败，请重试');
      };

      // 开始播放
      await audio.play();
      state.isLoading = false;
      state.isPlaying = true;
      state.isPaused = false;
      updatePanelStatus();

    } catch (error) {
      console.error('[Select & Play] TTS错误:', error);
      showError(error.message || '语音合成失败，请稍后重试');
    }
  }

  /**
   * XML转义
   */
  function escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ==================== 事件处理 ====================

  /**
   * 处理文本选择
   */
  function handleTextSelection() {
    if (!state.isEnabled) return;

    const selectedText = window.getSelection().toString().trim();

    // 没有选中文本
    if (!selectedText) {
      if (state.currentPanel && !state.isPlaying && !state.isPaused) {
        hidePanel();
      }
      state.lastSelectedText = '';
      return;
    }

    // 与上次相同，忽略
    if (selectedText === state.lastSelectedText && state.currentPanel) {
      return;
    }

    state.selectedText = selectedText;
    state.lastSelectedText = selectedText;
    showPanel();
  }

  // 防抖处理
  const debouncedHandleSelection = debounce(handleTextSelection, 200);

  // 监听选择事件
  document.addEventListener('mouseup', debouncedHandleSelection);
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return;
    debouncedHandleSelection();
  });

  // 点击空白处隐藏浮窗
  document.addEventListener('mousedown', (e) => {
    if (state.currentPanel && !state.currentPanel.contains(e.target) && !state.isPlaying && !state.isPaused) {
      hidePanel();
    }
  });

  // ==================== 消息监听 ====================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleState') {
      state.isEnabled = message.isEnabled;
      if (!state.isEnabled) {
        stopAudio();
        hidePanel();
      }
    }
    if (message.action === 'getState') {
      sendResponse({ isEnabled: state.isEnabled });
    }
    return true;
  });

  // ==================== 初始化 ====================

  // 获取启用状态
  chrome.storage.sync.get(['isEnabled'], (result) => {
    state.isEnabled = result.isEnabled !== false;
    console.log('[Select & Play] 初始化完成，状态:', state.isEnabled ? '启用' : '禁用');
  });

})();
