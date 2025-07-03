// YouTube Transcription Extractor Content Script
class YouTubeTranscriptionExtractor {
  constructor() {
    this.button = null;
    this.isProcessing = false;
    this.init();
  }

  init() {
    // 监听页面变化，因为 YouTube 是单页应用
    this.observePageChanges();
    // 立即尝试添加按钮
    this.addButton();
  }

  observePageChanges() {
    // 监听 URL 变化
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        // URL 改变时重新添加按钮
        setTimeout(() => this.addButton(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  addButton() {
    // 检查是否是视频页面
    if (!this.isVideoPage()) {
      return;
    }

    // 避免重复添加按钮
    if (this.button && document.contains(this.button)) {
      return;
    }

    // 等待页面元素加载
    setTimeout(() => {
      this.createAndInsertButton();
    }, 2000);
  }

  isVideoPage() {
    return location.pathname === '/watch' && location.search.includes('v=');
  }

  createAndInsertButton() {
    // 寻找合适的位置插入按钮
    const targetContainer = this.findButtonContainer();
    if (!targetContainer) {
      console.log('YouTube Transcription Extractor: 无法找到合适的容器');
      return;
    }

    // 创建按钮
    this.button = document.createElement('button');
    this.button.className = 'yt-transcript-extractor-btn';
    this.button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
      </svg>
      <span>获取转录</span>
    `;
    
    this.button.title = '获取当前视频的转录文本';
    this.button.addEventListener('click', () => this.extractTranscription());

    // 插入按钮
    targetContainer.appendChild(this.button);
  }

  findButtonContainer() {
    // 尝试多个可能的容器位置
    const selectors = [
      '#actions-inner', // 新版 YouTube 的操作按钮区域
      '#menu-container #top-level-buttons-computed', // 操作按钮容器
      '#actions #menu-container', // 另一个可能的位置
      '.style-scope.ytd-menu-renderer', // 菜单渲染器
      '#owner' // 作为后备选项
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }

    return null;
  }

  async extractTranscription() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.updateButtonState('processing');

    try {
      const transcription = await this.getTranscription();
      
      if (transcription) {
        await this.copyToClipboard(transcription);
        this.showNotification('转录已复制到剪贴板！', 'success');
      } else {
        this.showNotification('未找到转录文本', 'error');
      }
    } catch (error) {
      console.error('获取转录时出错:', error);
      this.showNotification('获取转录失败', 'error');
    } finally {
      this.isProcessing = false;
      this.updateButtonState('normal');
    }
  }

  async getTranscription() {
    // 方法1：尝试从 YouTube 的内部 API 获取转录
    try {
      const videoId = this.getVideoId();
      const transcription = await this.fetchTranscriptionFromAPI(videoId);
      if (transcription) {
        return transcription;
      }
    } catch (error) {
      console.log('API 方法失败，尝试其他方法:', error);
    }

    // 方法2：尝试从页面中的转录面板获取
    try {
      const transcription = await this.getTranscriptionFromPage();
      if (transcription) {
        return transcription;
      }
    } catch (error) {
      console.log('页面方法失败:', error);
    }

    return null;
  }

  getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  async fetchTranscriptionFromAPI(videoId) {
    // 尝试访问 YouTube 的内部 API
    try {
      // 获取页面上的一些必要信息
      const ytInitialData = window.ytInitialData;
      const ytInitialPlayerResponse = window.ytInitialPlayerResponse;

      if (ytInitialPlayerResponse && ytInitialPlayerResponse.captions) {
        const captionTracks = ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer?.captionTracks;
        
        if (captionTracks && captionTracks.length > 0) {
          // 优先选择原始语言的字幕
          let selectedTrack = captionTracks.find(track => !track.kind) || captionTracks[0];
          
          if (selectedTrack && selectedTrack.baseUrl) {
            const response = await fetch(selectedTrack.baseUrl);
            const xmlText = await response.text();
            return this.parseTranscriptionXML(xmlText);
          }
        }
      }
    } catch (error) {
      console.log('API 获取失败:', error);
    }

    return null;
  }

  parseTranscriptionXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const textElements = xmlDoc.querySelectorAll('text');
    
    const transcription = Array.from(textElements)
      .map(element => element.textContent.trim())
      .filter(text => text.length > 0)
      .join(' ');

    return transcription;
  }

  async getTranscriptionFromPage() {
    // 尝试打开转录面板并获取转录
    const transcriptButton = document.querySelector('[aria-label*="转录"], [aria-label*="Transcript"], [aria-label*="字幕"]');
    
    if (transcriptButton) {
      // 点击转录按钮
      transcriptButton.click();
      
      // 等待转录面板加载
      await this.waitForElement('[aria-label*="转录"], [aria-label*="transcript"]', 5000);
      
      // 获取转录文本
      const transcriptContainer = document.querySelector('[aria-label*="转录"] [role="presentation"], [aria-label*="transcript"] [role="presentation"]');
      
      if (transcriptContainer) {
        const transcriptElements = transcriptContainer.querySelectorAll('[data-start-time]');
        const transcription = Array.from(transcriptElements)
          .map(element => element.textContent.trim())
          .filter(text => text.length > 0)
          .join(' ');
        
        return transcription;
      }
    }

    return null;
  }

  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error('Element not found within timeout'));
      }, timeout);
    });
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      // 如果现代 API 失败，使用传统方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  updateButtonState(state) {
    if (!this.button) return;

    const span = this.button.querySelector('span');
    if (state === 'processing') {
      span.textContent = '处理中...';
      this.button.disabled = true;
    } else {
      span.textContent = '获取转录';
      this.button.disabled = false;
    }
  }

  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `yt-transcript-notification yt-transcript-notification-${type}`;
    notification.textContent = message;

    // 添加到页面
    document.body.appendChild(notification);

    // 显示动画
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    // 自动隐藏
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// 初始化扩展
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeTranscriptionExtractor();
  });
} else {
  new YouTubeTranscriptionExtractor();
} 