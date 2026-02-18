/**
 * Select & Play - Content Script
 * 选中即播，简洁优雅
 */

(function() {
  'use strict';

  // ==================== 状态管理 ====================
  const state = {
    isEnabled: false,
    uiMode: 'mini',  // 'mini' | 'standard'
    panel: null,
    audio: null,
    text: '',
    lang: 'chinese',
    status: 'idle',
    isProcessing: false  // 防止重复触发
  };

  // ==================== 常量 ====================
  const LANG_INFO = {
    chinese: { label: '中文', class: 'zh', voice: 'zh-CN-XiaoxiaoNeural' },
    english: { label: 'English', class: 'en', voice: 'en-US-JennyNeural' },
    japanese: { label: '日本語', class: 'ja', voice: 'ja-JP-NanamiNeural' }
  };

  const ICONS = {
    speaker: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>',
    error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };

  // ==================== 语言检测 ====================
  function detectLanguage(text) {
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'japanese';
    if (/[\u4e00-\u9fa5]/.test(text)) return 'chinese';
    return 'english';
  }

  // ==================== 定位 ====================
  function getPosition() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const isMini = state.uiMode === 'mini';
    const panelW = isMini ? 140 : 280;
    const panelH = isMini ? 50 : 150;
    const gap = 8;
    const winW = window.innerWidth;

    let left = rect.left + rect.width / 2 - panelW / 2;
    let top = rect.bottom + gap;

    if (left < gap) left = gap;
    if (left + panelW > winW - gap) left = winW - panelW - gap;

    if (rect.bottom + panelH + gap > window.innerHeight && rect.top >= panelH + gap) {
      top = rect.top - panelH - gap;
    }

    if (top < gap) top = gap;

    return { top, left };
  }

  // ==================== 创建迷你面板 ====================
  function createMiniPanel() {
    const p = document.createElement('div');
    p.className = 'sasp-mini';
    p.innerHTML = `
      <span class="sasp-lang" id="sasp-lang"></span>
      <button class="sasp-btn" id="sasp-btn"></button>
      <button class="sasp-close" id="sasp-close">${ICONS.close}</button>
    `;
    return p;
  }

  // ==================== 创建标准面板 ====================
  function createStandardPanel() {
    const p = document.createElement('div');
    p.className = 'sasp-panel';
    p.innerHTML = `
      <div class="sasp-header">
        <div class="sasp-header-left">
          <span class="sasp-lang" id="sasp-lang"></span>
          <div class="sasp-title">${ICONS.speaker}语音朗读</div>
        </div>
        <div class="sasp-header-right">
          <div class="sasp-status" id="sasp-status"></div>
          <button class="sasp-close" id="sasp-close">${ICONS.close}</button>
        </div>
      </div>
      <div class="sasp-body">
        <div class="sasp-preview" id="sasp-preview"></div>
        <div class="sasp-controls" id="sasp-controls"></div>
      </div>
    `;
    return p;
  }

  // ==================== 创建面板 ====================
  function createPanel() {
    const p = state.uiMode === 'mini' ? createMiniPanel() : createStandardPanel();

    // 绑定关闭按钮事件
    const closeBtn = p.querySelector('#sasp-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        stopAudio();
        hidePanel();
      });
    }

    // 迷你面板的按钮事件
    if (state.uiMode === 'mini') {
      const btn = p.querySelector('.sasp-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'pause') {
            pauseAudio();
          } else if (action === 'resume') {
            resumeAudio();
          }
        });
      }
    }

    return p;
  }

  // ==================== 更新迷你面板 ====================
  function updateMiniPanel() {
    if (!state.panel) return;

    const langEl = state.panel.querySelector('#sasp-lang');
    const btnEl = state.panel.querySelector('#sasp-btn');

    const langInfo = LANG_INFO[state.lang];
    langEl.textContent = langInfo.label;
    langEl.className = 'sasp-lang sasp-lang-' + langInfo.class;

    state.panel.className = 'sasp-mini sasp-status-' + state.status;

    switch (state.status) {
      case 'loading':
        btnEl.innerHTML = '<span class="sasp-spinner"></span>';
        btnEl.disabled = true;
        btnEl.dataset.action = '';
        break;
      case 'playing':
        btnEl.innerHTML = ICONS.pause + '暂停';
        btnEl.disabled = false;
        btnEl.dataset.action = 'pause';
        break;
      case 'paused':
        btnEl.innerHTML = ICONS.play + '继续';
        btnEl.disabled = false;
        btnEl.dataset.action = 'resume';
        break;
      case 'idle':
        btnEl.innerHTML = ICONS.play + '播放';
        btnEl.disabled = false;
        btnEl.dataset.action = 'play';
        break;
    }
  }

  // ==================== 更新标准面板 ====================
  function updateStandardPanel() {
    if (!state.panel) return;

    const langEl = state.panel.querySelector('#sasp-lang');
    const statusEl = state.panel.querySelector('#sasp-status');
    const previewEl = state.panel.querySelector('#sasp-preview');
    const controlsEl = state.panel.querySelector('#sasp-controls');

    const langInfo = LANG_INFO[state.lang];
    langEl.textContent = langInfo.label;
    langEl.className = 'sasp-lang sasp-lang-' + langInfo.class;

    previewEl.textContent = state.text.length > 150 ? state.text.slice(0, 150) + '...' : state.text;

    // 状态指示器
    statusEl.className = 'sasp-status sasp-status-' + state.status;

    switch (state.status) {
      case 'loading':
        statusEl.innerHTML = '<span class="sasp-spinner"></span>';
        break;
      case 'playing':
        statusEl.innerHTML = '<div class="sasp-wave"><i></i><i></i><i></i></div>';
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
          <button class="sasp-btn sasp-btn-secondary" data-action="pause">${ICONS.pause}暂停</button>
          <button class="sasp-btn sasp-btn-danger" data-action="stop">${ICONS.stop}停止</button>
        `;
        break;
      case 'paused':
        controlsEl.innerHTML = `
          <button class="sasp-btn sasp-btn-primary" data-action="resume">${ICONS.play}继续</button>
          <button class="sasp-btn sasp-btn-danger" data-action="stop">${ICONS.stop}停止</button>
        `;
        break;
      default:
        controlsEl.innerHTML = `
          <button class="sasp-btn sasp-btn-primary" data-action="play">${ICONS.play}播放</button>
        `;
    }

    // 绑定按钮事件
    controlsEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'play') startTTS();
        else if (action === 'pause') pauseAudio();
        else if (action === 'resume') resumeAudio();
        else if (action === 'stop') { stopAudio(); hidePanel(); }
      });
    });
  }

  // ==================== 更新面板 ====================
  function updatePanel() {
    if (state.uiMode === 'mini') {
      updateMiniPanel();
    } else {
      updateStandardPanel();
    }
  }

  // ==================== 显示/隐藏 ====================
  function showPanel() {
    hidePanel();

    const pos = getPosition();
    if (!pos) return;

    state.panel = createPanel();
    state.panel.style.top = pos.top + 'px';
    state.panel.style.left = pos.left + 'px';
    document.body.appendChild(state.panel);

    updatePanel();
  }

  function hidePanel() {
    if (state.panel) {
      state.panel.remove();
      state.panel = null;
    }
  }

  // ==================== 音频控制 ====================
  function cleanupAudio() {
    if (state.audio) {
      state.audio.pause();
      state.audio.onended = null;
      state.audio.onerror = null;
      if (state.audio.src) URL.revokeObjectURL(state.audio.src);
      state.audio = null;
    }
  }

  function stopAudio() {
    cleanupAudio();
    state.status = 'idle';
    state.isProcessing = false;
    if (state.panel) updatePanel();
  }

  function pauseAudio() {
    if (state.audio && state.status === 'playing') {
      state.audio.pause();
      state.status = 'paused';
      updatePanel();
    }
  }

  function resumeAudio() {
    if (state.audio && state.status === 'paused') {
      state.audio.play();
      state.status = 'playing';
      updatePanel();
    }
  }

  // ==================== TTS ====================
  async function startTTS() {
    // 防止重复调用
    if (state.isProcessing) return;

    const config = await chrome.storage.sync.get('azureConfig');
    if (!config.azureConfig?.key || !config.azureConfig?.region) {
      console.log('[Select&Play] 未配置 Azure');
      return;
    }

    // 停止之前的音频
    cleanupAudio();
    state.status = 'loading';
    state.isProcessing = true;
    updatePanel();

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

      state.audio.onended = () => {
        state.status = 'idle';
        state.isProcessing = false;
        updatePanel();
        // 迷你模式播放完自动关闭
        if (state.uiMode === 'mini') {
          setTimeout(hidePanel, 500);
        }
      };

      state.audio.onerror = () => {
        stopAudio();
        if (state.uiMode === 'mini') {
          hidePanel();
        }
      };

      await state.audio.play();
      state.status = 'playing';
      state.isProcessing = false;
      updatePanel();

    } catch (err) {
      console.error('[TTS]', err);
      stopAudio();
      if (state.uiMode === 'mini') {
        hidePanel();
      }
    }
  }

  function escapeXml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  }

  // ==================== 事件监听 ====================
  async function handleSelect() {
    if (!state.isEnabled) return;

    // 每次选择时读取最新的 uiMode 设置
    const settings = await chrome.storage.sync.get('uiMode');
    state.uiMode = settings.uiMode || 'mini';

    const text = window.getSelection().toString().trim();
    if (!text) {
      if (state.status === 'idle') hidePanel();
      state.lastText = '';
      return;
    }

    // 避免重复选择相同文本
    if (text === state.lastText) return;

    state.lastText = text;
    state.text = text;
    state.lang = detectLanguage(text);
    showPanel();

    // 迷你模式自动播放，标准模式等待点击播放
    if (state.uiMode === 'mini') {
      startTTS();
    } else {
      state.status = 'idle';
      updatePanel();
    }
  }

  const debouncedSelect = () => {
    clearTimeout(state._timer);
    state._timer = setTimeout(handleSelect, 100);
  };

  document.addEventListener('mouseup', debouncedSelect);
  document.addEventListener('keyup', (e) => {
    if (!e.shiftKey && !e.ctrlKey && !e.altKey) debouncedSelect();
  });

  // 点击空白处处理
  document.addEventListener('mousedown', (e) => {
    if (state.panel && !state.panel.contains(e.target)) {
      if (state.uiMode === 'mini' || state.status === 'idle') {
        stopAudio();
        hidePanel();
      }
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
      if (!state.isEnabled) { stopAudio(); hidePanel(); }
    }
    if (msg.action === 'getState') send({ isEnabled: state.isEnabled });
    return true;
  });

  // ==================== 初始化 ====================
  chrome.storage.sync.get(['isEnabled', 'uiMode'], (r) => {
    state.isEnabled = r.isEnabled !== false;
    state.uiMode = r.uiMode || 'mini';
  });

})();
