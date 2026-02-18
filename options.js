/**
 * Select & Play - Options Script
 * 设置页面逻辑
 */

(function() {
  'use strict';

  // ==================== DOM 元素 ====================
  const elements = {
    modeMini: document.getElementById('modeMini'),
    modeStandard: document.getElementById('modeStandard'),
    azureForm: document.getElementById('azureForm'),
    azureRegion: document.getElementById('azureRegion'),
    azureKey: document.getElementById('azureKey'),
    toggleKeyBtn: document.getElementById('toggleKeyBtn'),
    saveAzureBtn: document.getElementById('saveAzureBtn'),
    testAzureBtn: document.getElementById('testAzureBtn'),
    azureStatus: document.getElementById('azureStatus'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    voiceForms: document.querySelectorAll('.voice-form'),
    toast: document.getElementById('toast')
  };

  // ==================== 状态管理 ====================
  let state = {
    uiMode: 'mini',  // 'mini' | 'standard'
    azureConfig: null,
    ttsSettings: {}
  };

  // ==================== 初始化 ====================
  async function init() {
    console.log('[Select & Play Options] 初始化');

    // 加载保存的配置
    await loadConfig();

    // 绑定事件
    bindEvents();

    // 更新UI状态
    updateUI();
  }

  /**
   * 加载配置
   */
  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get(['uiMode', 'azureConfig', 'ttsSettings']);
      state.uiMode = result.uiMode || 'mini';
      state.azureConfig = result.azureConfig || { region: '', key: '' };
      state.ttsSettings = result.ttsSettings || {
        chinese: { voice: 'zh-CN-XiaoxiaoNeural', speed: '1.0' },
        english: { voice: 'en-US-JennyNeural', speed: '1.0' },
        japanese: { voice: 'ja-JP-NanamiNeural', speed: '1.0' }
      };

      console.log('[Select & Play Options] 配置加载成功');
    } catch (error) {
      console.error('[Select & Play Options] 加载配置失败:', error);
    }
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    // UI 模式选择
    elements.modeMini.addEventListener('change', () => handleModeChange('mini'));
    elements.modeStandard.addEventListener('change', () => handleModeChange('standard'));

    // Azure 表单提交
    elements.azureForm.addEventListener('submit', handleAzureSave);

    // 密钥显示/隐藏
    elements.toggleKeyBtn.addEventListener('click', toggleKeyVisibility);

    // 测试连接
    elements.testAzureBtn.addEventListener('click', testConnection);

    // 选项卡切换
    elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 语音设置表单
    elements.voiceForms.forEach(form => {
      form.addEventListener('submit', handleVoiceSettingsSave);

      // 语速滑块实时更新
      const slider = form.querySelector('.speed-slider');
      if (slider) {
        slider.addEventListener('input', (e) => {
          const valueLabel = form.querySelector('.speed-value');
          if (valueLabel) {
            valueLabel.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
          }
        });
      }
    });
  }

  /**
   * 更新UI
   */
  function updateUI() {
    // 更新 UI 模式选择
    elements.modeMini.checked = state.uiMode === 'mini';
    elements.modeStandard.checked = state.uiMode === 'standard';

    // 更新 Azure 配置表单
    if (state.azureConfig) {
      elements.azureRegion.value = state.azureConfig.region || '';
      elements.azureKey.value = state.azureConfig.key || '';
      updateAzureStatus();
    }

    // 更新语音设置
    updateVoiceSettingsUI();
  }

  /**
   * 更新语音设置UI
   */
  function updateVoiceSettingsUI() {
    const languages = ['chinese', 'english', 'japanese'];

    languages.forEach(lang => {
      const settings = state.ttsSettings[lang] || {};
      const form = document.querySelector(`.voice-form[data-lang="${lang}"]`);
      if (!form) return;

      // 更新语音选择
      const voiceSelect = form.querySelector('.voice-select');
      if (voiceSelect && settings.voice) {
        voiceSelect.value = settings.voice;
      }

      // 更新语速
      const speedSlider = form.querySelector('.speed-slider');
      const speedValue = form.querySelector('.speed-value');
      if (speedSlider && settings.speed) {
        speedSlider.value = settings.speed;
      }
      if (speedValue && settings.speed) {
        speedValue.textContent = parseFloat(settings.speed).toFixed(1) + 'x';
      }
    });
  }

  /**
   * 更新Azure状态指示
   */
  function updateAzureStatus() {
    const hasConfig = state.azureConfig.region && state.azureConfig.key;

    if (hasConfig) {
      elements.azureStatus.innerHTML = '<span class="status-badge status-valid">已配置</span>';
    } else {
      elements.azureStatus.innerHTML = '<span class="status-badge status-unknown">未配置</span>';
    }
  }

  /**
   * 处理UI模式变更
   */
  async function handleModeChange(mode) {
    if (state.uiMode === mode) return;

    state.uiMode = mode;

    try {
      await chrome.storage.sync.set({ uiMode: mode });
      showToast(`已切换到${mode === 'mini' ? '简洁版' : '标准版'}模式`, 'success');
    } catch (error) {
      console.error('[Select & Play Options] 保存模式失败:', error);
      showToast('保存失败，请重试', 'error');
    }
  }

  /**
   * 切换密钥可见性
   */
  function toggleKeyVisibility() {
    const input = elements.azureKey;
    const eyeIcon = elements.toggleKeyBtn.querySelector('.eye-icon');
    const eyeOffIcon = elements.toggleKeyBtn.querySelector('.eye-off-icon');

    if (input.type === 'password') {
      input.type = 'text';
      eyeIcon.style.display = 'none';
      eyeOffIcon.style.display = 'block';
    } else {
      input.type = 'password';
      eyeIcon.style.display = 'block';
      eyeOffIcon.style.display = 'none';
    }
  }

  /**
   * 保存 Azure 配置
   */
  async function handleAzureSave(e) {
    e.preventDefault();

    const region = elements.azureRegion.value;
    const key = elements.azureKey.value;

    if (!region || !key) {
      showToast('请填写完整的配置信息', 'error');
      return;
    }

    // 更新状态
    state.azureConfig = { region, key };

    // 准备保存的数据
    const saveData = { azureConfig: state.azureConfig };

    // 如果语音设置还未保存过，保存默认值
    const existingSettings = await chrome.storage.sync.get('ttsSettings');
    if (!existingSettings.ttsSettings) {
      const defaultTtsSettings = {
        chinese: { voice: 'zh-CN-XiaoxiaoNeural', speed: '1.0' },
        english: { voice: 'en-US-JennyNeural', speed: '1.0' },
        japanese: { voice: 'ja-JP-NanamiNeural', speed: '1.0' }
      };
      saveData.ttsSettings = defaultTtsSettings;
      state.ttsSettings = defaultTtsSettings;
      updateVoiceSettingsUI();
    }

    // 保存到存储
    try {
      await chrome.storage.sync.set(saveData);
      updateAzureStatus();
      showToast('配置保存成功', 'success');
    } catch (error) {
      console.error('[Select & Play Options] 保存配置失败:', error);
      showToast('保存失败，请重试', 'error');
    }
  }

  /**
   * 测试连接
   */
  async function testConnection() {
    const region = elements.azureRegion.value;
    const key = elements.azureKey.value;

    if (!region || !key) {
      showToast('请先填写配置信息', 'error');
      return;
    }

    // 禁用按钮
    elements.testAzureBtn.disabled = true;
    elements.testAzureBtn.innerHTML = `
      <svg class="spinner" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
      测试中...
    `;

    try {
      const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
        },
        body: '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="zh-CN-XiaoxiaoNeural"><prosody rate="1.0">测试</prosody></voice></speak>'
      });

      if (response.ok) {
        showToast('连接测试成功！', 'success');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('[Select & Play Options] 测试连接失败:', error);
      showToast('连接测试失败，请检查配置', 'error');
    } finally {
      elements.testAzureBtn.disabled = false;
      elements.testAzureBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        测试连接
      `;
    }
  }

  /**
   * 切换选项卡
   */
  function switchTab(tabName) {
    // 更新按钮状态
    elements.tabBtns.forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 更新面板显示
    elements.tabPanes.forEach(pane => {
      if (pane.dataset.pane === tabName) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  }

  /**
   * 保存语音设置
   */
  async function handleVoiceSettingsSave(e) {
    e.preventDefault();

    const form = e.target;
    const lang = form.dataset.lang;

    if (!lang) return;

    const voice = form.querySelector('.voice-select')?.value;
    const speed = form.querySelector('.speed-slider')?.value;

    if (!voice || !speed) {
      showToast('请完整填写设置', 'error');
      return;
    }

    // 更新状态
    state.ttsSettings[lang] = { voice, speed };

    // 保存到存储
    try {
      await chrome.storage.sync.set({ ttsSettings: state.ttsSettings });
      showToast('语音设置已保存', 'success');
    } catch (error) {
      console.error('[Select & Play Options] 保存语音设置失败:', error);
      showToast('保存失败，请重试', 'error');
    }
  }

  /**
   * 显示通知
   */
  function showToast(message, type = 'success') {
    const toast = elements.toast;
    toast.textContent = message;
    toast.className = `toast ${type}`;

    // 强制重绘以触发动画
    void toast.offsetWidth;

    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // ==================== 启动 ====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
