/**
 * Select & Play - Content Script
 * 核心功能：文本选择检测、浮窗显示、TTS播放控制
 */

(function() {
  'use strict';

  // ==================== 状态管理 ====================
  const state = {
    isEnabled: false,
    panel: null,
    audio: null,
    text: '',
    lang: 'chinese',
    status: 'idle', // 'idle' | 'loading' | 'playing' | 'paused'
    lastText: ''
  };

  // ==================== 常量定义 ====================
  const LANG_INFO = {
    chinese: { label: '中文', class: 'zh', voice: 'zh-CN-XiaoxiaoNeural' },
    english: { label: 'English', class: 'en', voice: 'en-US-JennyNeural' },
    japanese: { label: '日本語', class: 'ja', voice: 'ja-JP-NanamiNeural' }
  };

  const SVG_ICONS = {
    speaker: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>'
  };

  // ==================== 工具函数 ====================

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function detectLanguage(text) {
    const t = text.trim();
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(t)) return 'japanese';
    if (/[\u4e00-\u9fa5]/.test(t)) return 'chinese';
    if (/[a-zA-Z]/.test(t) && !/[\u4e00-\u9fa5]/.test(t)) return 'english';
    return 'chinese';
  }

  // ==================== 定位计算 ====================

  function getPosition() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const panelW = 300, panelH = 220, gap = 16;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // 注意：CSS 使用 position: fixed，所以 top/left 是相对于视口的
    // 不需要加 scrollX/scrollY

    // 默认位置：选区下方居中
    let left = rect.left + rect.width / 2 - panelW / 2;
    let top = rect.bottom + gap;

    // 计算可用空间
    const spaceBelow = winH - rect.bottom;
    const spaceAbove = rect.top;

    // 如果下方空间不足且上方空间足够，放上方
    if (spaceBelow < panelH + gap && spaceAbove >= panelH + gap) {
      top = rect.top - panelH - gap;
    }

    // 水平边界
    if (left < gap) left = gap;
    if (left + panelW > winW - gap) left = winW - panelW - gap;

    // 垂直边界：至少保留顶部边距
    if (top < gap) top = gap;

    console.log('[Select&Play] 定位:', {
      rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left) },
      viewport: { width: winW, height: winH },
      space: { above: Math.round(spaceAbove), below: Math.round(spaceBelow) },
      result: { top: Math.round(top), left: Math.round(left) }
    });

    return { top, left };
  }

  // ==================== 浮窗创建 ====================

  function createPanel() {
    const p = document.createElement('div');
    p.className = 'sasp-panel';
    p.innerHTML = `
      <div class="sasp-header">
        <div class="sasp-header-left">
          <span class="sasp-title">${SVG_ICONS.speaker}语音朗读</span>
          <span class="sasp-lang" id="sasp-lang"></span>
        </div>
        <div class="sasp-header-right">
          <span class="sasp-status" id="sasp-status"></span>
          <button class="sasp-close" id="sasp-close">${SVG_ICONS.close}</button>
        </div>
      </div>
      <div class="sasp-body">
        <div class="sasp-preview" id="sasp-preview"></div>
        <div class="sasp-controls" id="sasp-controls"></div>
      </div>
    `;
    return p;
  }

  // ==================== UI 更新 ====================

  function updateStatus() {
    const statusEl = state.panel?.querySelector('#sasp-status');
    const controlsEl = state.panel?.querySelector('#sasp-controls');

    if (!statusEl || !controlsEl) return;

    // 状态指示器
    statusEl.className = 'sasp-status sasp-status-' + state.status;

    switch (state.status) {
      case 'loading':
        statusEl.innerHTML = '<span class="sasp-spinner"></span>';
        break;
      case 'playing':
        statusEl.innerHTML = '<span class="sasp-wave"><i></i><i></i><i></i></span>';
        break;
      case 'paused':
        statusEl.innerHTML = '<span class="sasp-paused">||</span>';
        break;
      default:
        statusEl.innerHTML = '';
    }

    // 控制按钮
    switch (state.status) {
      case 'playing':
        controlsEl.innerHTML = `
          <button class="sasp-btn sasp-btn-secondary" data-action="pause">${SVG_ICONS.pause}暂停</button>
          <button class="sasp-btn sasp-btn-danger" data-action="stop">${SVG_ICONS.stop}停止</button>
        `;
        break;
      case 'paused':
        controlsEl.innerHTML = `
          <button class="sasp-btn sasp-btn-primary" data-action="resume">${SVG_ICONS.play}继续</button>
          <button class="sasp-btn sasp-btn-danger" data-action="stop">${SVG_ICONS.stop}停止</button>
        `;
        break;
      default:
        controlsEl.innerHTML = `
          <button class="sasp-btn sasp-btn-primary" data-action="play">${SVG_ICONS.play}播放</button>
        `;
    }

    // 绑定按钮事件
    controlsEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'play') startTTS();
        else if (action === 'pause') pause();
        else if (action === 'resume') resume();
        else if (action === 'stop') stop();
      });
    });
  }

  function showError(msg) {
    state.status = 'idle';
    const controlsEl = state.panel?.querySelector('#sasp-controls');
    if (controlsEl) {
      controlsEl.innerHTML = `
        <div class="sasp-error">${SVG_ICONS.error}${msg}</div>
        <button class="sasp-btn sasp-btn-secondary" data-action="retry">${SVG_ICONS.play}重试</button>
      `;
      controlsEl.querySelector('button').addEventListener('click', () => startTTS());
    }
    updateStatus();
  }

  function showConfigNotice() {
    const controlsEl = state.panel?.querySelector('#sasp-controls');
    if (controlsEl) {
      controlsEl.innerHTML = `
        <div class="sasp-notice">${SVG_ICONS.warning}请先配置 <a href="#" id="sasp-config-link">Azure TTS</a></div>
      `;
      controlsEl.querySelector('#sasp-config-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
    }
  }

  // ==================== 浮窗显示/隐藏 ====================

  function showPanel() {
    hidePanel();

    const pos = getPosition();
    if (!pos) return;

    state.panel = createPanel();
    state.panel.style.top = pos.top + 'px';
    state.panel.style.left = pos.left + 'px';
    document.body.appendChild(state.panel);

    // 设置内容
    state.panel.querySelector('#sasp-preview').textContent =
      state.text.length > 150 ? state.text.slice(0, 150) + '...' : state.text;

    const langInfo = LANG_INFO[state.lang];
    const langEl = state.panel.querySelector('#sasp-lang');
    langEl.textContent = langInfo.label;
    langEl.className = 'sasp-lang sasp-lang-' + langInfo.class;

    // 绑定关闭
    state.panel.querySelector('#sasp-close').addEventListener('click', hidePanel);

    // 更新状态
    state.status = 'idle';
    updateStatus();
  }

  function hidePanel() {
    if (state.panel) {
      state.panel.remove();
      state.panel = null;
    }
  }

  // ==================== 音频控制 ====================

  function cleanup() {
    if (state.audio) {
      state.audio.pause();
      state.audio.onended = null;
      state.audio.onerror = null;
      if (state.audio.src) URL.revokeObjectURL(state.audio.src);
      state.audio = null;
    }
  }

  function stop() {
    cleanup();
    state.status = 'idle';
    updateStatus();
  }

  function pause() {
    if (state.audio) {
      state.audio.pause();
      state.status = 'paused';
      updateStatus();
    }
  }

  function resume() {
    if (state.audio) {
      state.audio.play();
      state.status = 'playing';
      updateStatus();
    }
  }

  async function startTTS() {
    if (!state.text) return;

    const config = await chrome.storage.sync.get('azureConfig');
    if (!config.azureConfig?.key || !config.azureConfig?.region) {
      showConfigNotice();
      return;
    }

    cleanup();
    state.status = 'loading';
    updateStatus();

    try {
      const settings = await chrome.storage.sync.get('ttsSettings');
      const ttsSettings = settings.ttsSettings || {};
      const langInfo = LANG_INFO[state.lang];
      const voiceSetting = ttsSettings[state.lang] || { voice: langInfo.voice, speed: '1.0' };

      const langMap = { chinese: 'zh-CN', english: 'en-US', japanese: 'ja-JP' };
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${langMap[state.lang]}">
        <voice name="${voiceSetting.voice}">
          <prosody rate="${voiceSetting.speed}">${escapeXml(state.text)}</prosody>
        </voice>
      </speak>`;

      const res = await fetch(`https://${config.azureConfig.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': config.azureConfig.key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
        },
        body: ssml
      });

      if (!res.ok) throw new Error(`TTS错误: ${res.status}`);

      const blob = new Blob([await res.arrayBuffer()], { type: 'audio/mp3' });
      state.audio = new Audio(URL.createObjectURL(blob));
      state.audio.onended = () => { state.status = 'idle'; updateStatus(); };
      state.audio.onerror = () => showError('播放失败');

      await state.audio.play();
      state.status = 'playing';
      updateStatus();

    } catch (err) {
      console.error('[TTS]', err);
      showError(err.message || '请求失败');
    }
  }

  function escapeXml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  }

  // ==================== 事件监听 ====================

  function handleSelect() {
    if (!state.isEnabled) return;

    const text = window.getSelection().toString().trim();
    if (!text) {
      if (state.status === 'idle') hidePanel();
      state.lastText = '';
      return;
    }

    if (text === state.lastText) return;

    state.text = text;
    state.lastText = text;
    state.lang = detectLanguage(text);
    showPanel();
  }

  const debouncedSelect = debounce(handleSelect, 150);

  document.addEventListener('mouseup', debouncedSelect);
  document.addEventListener('keyup', (e) => {
    if (!e.shiftKey && !e.ctrlKey && !e.altKey) debouncedSelect();
  });

  document.addEventListener('mousedown', (e) => {
    if (state.panel && !state.panel.contains(e.target) && state.status === 'idle') {
      hidePanel();
    }
  });

  // 阻止面板内事件冒泡
  document.addEventListener('mousedown', (e) => {
    if (state.panel?.contains(e.target)) e.stopPropagation();
  }, true);

  // ==================== 消息监听 ====================

  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    if (msg.action === 'toggleState') {
      state.isEnabled = msg.isEnabled;
      if (!state.isEnabled) { stop(); hidePanel(); }
    }
    if (msg.action === 'getState') send({ isEnabled: state.isEnabled });
    return true;
  });

  // ==================== 初始化 ====================

  chrome.storage.sync.get(['isEnabled'], (r) => {
    state.isEnabled = r.isEnabled !== false;
  });

})();
