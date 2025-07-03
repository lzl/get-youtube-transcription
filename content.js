// YouTube Transcription Extractor Content Script
class YouTubeTranscriptionExtractor {
  constructor() {
    this.button = null;
    this.isProcessing = false;
    this.init();
  }

  init() {
    // 设置全局调试方法
    this.setupGlobalDebugMethod();
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

  async addButton() {
    // 检查是否是视频页面
    if (!this.isVideoPage()) {
      return;
    }

    // 避免重复添加按钮
    if (this.button && document.contains(this.button)) {
      return;
    }

    // 使用更可靠的等待机制
    await this.waitForButtonContainerAndInsert();
  }

  async waitForButtonContainerAndInsert() {
    console.log('开始等待按钮容器出现...');
    
    // 定义要等待的选择器，按优先级排序
    const selectors = [
      '#actions-inner #top-level-buttons-computed',
      '#top-level-buttons-computed',
      '#actions-inner',
      '#actions #menu-container',
      '#menu-container'
    ];

    // 尝试等待每个选择器，直到找到合适的容器
    for (const selector of selectors) {
      try {
        console.log('等待容器:', selector);
        const element = await this.waitForElement(selector, 3000);
        
        if (element && this.isValidButtonContainer(element)) {
          console.log('找到有效容器，开始插入按钮');
          this.createAndInsertButtonToContainer(element);
          return;
        } else {
          console.log('容器无效，尝试下一个');
        }
      } catch (error) {
        console.log(`等待 ${selector} 超时，尝试下一个`);
        continue;
      }
    }

    // 如果所有选择器都失败，使用备用策略
    console.log('主要策略失败，使用备用策略');
    await this.fallbackButtonInsertion();
  }

  async fallbackButtonInsertion() {
    try {
      // 等待至少有一个操作按钮出现
      const existingButtonSelectors = [
        'button[aria-label*="like" i]',
        'button[aria-label*="Share" i]',
        'button[aria-label*="Save" i]'
      ];

      for (const buttonSelector of existingButtonSelectors) {
        try {
          const existingButton = await this.waitForElement(buttonSelector, 2000);
          if (existingButton) {
            const container = existingButton.closest('#top-level-buttons-computed, #actions-inner, #menu-container, .style-scope.ytd-menu-renderer');
            if (container) {
              console.log('通过已存在按钮找到容器，插入按钮');
              this.createAndInsertButtonToContainer(container);
              return;
            }
          }
        } catch (error) {
          continue;
        }
      }

      // 最后的备用方案：简单的定时重试
      console.log('使用最后的备用方案');
      setTimeout(() => {
        this.createAndInsertButton();
      }, 1000);
      
    } catch (error) {
      console.log('备用策略也失败了:', error);
    }
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

    this.createAndInsertButtonToContainer(targetContainer);
  }

  createAndInsertButtonToContainer(targetContainer) {
    // 创建按钮
    this.button = document.createElement('button');
    this.button.className = 'yt-transcript-extractor-btn';
    this.button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
      </svg>
      <span>Transcript</span>
    `;
    
    this.button.title = 'Get video transcript';
    this.button.addEventListener('click', () => this.extractTranscription());

    // 插入按钮
    targetContainer.appendChild(this.button);
    console.log('按钮成功插入到容器中');
  }

  findButtonContainer() {
    console.log('开始查找合适的按钮容器...');
    
    // 更精确的选择器，专门针对操作按钮区域
    const selectors = [
      // YouTube 2023+ 版本的操作按钮区域
      '#actions-inner #top-level-buttons-computed',
      '#top-level-buttons-computed',
      
      // 备用选择器
      '#actions-inner',
      '#actions #menu-container',
      
      // 通过寻找已知的操作按钮来定位容器
      '.yt-spec-button-shape-next--icon-only-default', // 点赞按钮的父容器
      '.ytd-menu-renderer[button-renderer] #top-level-buttons-computed',
      
      // 更通用的备用方案
      '#menu-container',
      '.style-scope.ytd-menu-renderer'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('找到合适的容器:', selector);
        
        // 验证这是正确的操作按钮区域
        if (this.isValidButtonContainer(element)) {
          return element;
        }
      }
    }

    // 如果上述方法都失败，尝试通过已存在的按钮来找到容器
    console.log('尝试通过已存在的按钮查找容器...');
    const existingButtons = [
      'button[aria-label*="like" i]', // 点赞按钮
      'button[aria-label*="Share" i]', // 分享按钮
      'button[aria-label*="Save" i]', // 保存按钮
      'button[aria-label*="Thanks" i]' // 感谢按钮
    ];

    for (const buttonSelector of existingButtons) {
      const button = document.querySelector(buttonSelector);
      if (button) {
        const container = button.closest('#top-level-buttons-computed, #actions-inner, #menu-container');
        if (container) {
          console.log('通过已存在按钮找到容器:', buttonSelector);
          return container;
        }
      }
    }

    console.log('未找到合适的按钮容器');
    return null;
  }

  isValidButtonContainer(element) {
    // 检查容器是否包含其他操作按钮
    const hasActionButtons = element.querySelector('button[aria-label*="like" i], button[aria-label*="Share" i], button[aria-label*="Save" i]');
    
    // 检查容器是否在正确的区域（不是标题区域）
    const isInTitleArea = element.closest('#title, .title, ytd-video-primary-info-renderer #container');
    
    console.log('容器验证:', {
      hasActionButtons: !!hasActionButtons,
      isInTitleArea: !!isInTitleArea,
      valid: !!hasActionButtons && !isInTitleArea
    });
    
    return !!hasActionButtons && !isInTitleArea;
  }

  async extractTranscription() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.updateButtonState('processing');

    console.log('=== 开始获取转录 ===');
    console.log('视频URL:', window.location.href);

    try {
      const transcription = await this.getTranscription();
      
      if (transcription) {
        console.log('成功获取转录，字符数:', transcription.length);
        await this.copyToClipboard(transcription);
        this.showNotification(`Transcript copied to clipboard! (${transcription.length} characters)`, 'success');
      } else {
        console.log('获取转录失败');
        this.showNotification('No transcript found. Please ensure the video has captions/transcript available.', 'error');
        
        // 提供额外的诊断信息
        this.showDebugInfo();
      }
    } catch (error) {
      console.error('获取转录时出错:', error);
      this.showNotification('Failed to get transcript: ' + error.message, 'error');
    } finally {
      this.isProcessing = false;
      this.updateButtonState('normal');
      console.log('=== 转录获取流程结束 ===');
    }
  }

  showDebugInfo() {
    console.log('=== 调试信息 ===');
    console.log('ytInitialPlayerResponse 存在:', !!window.ytInitialPlayerResponse);
    console.log('captions 数据:', window.ytInitialPlayerResponse?.captions);
    
    // 检查页面上是否有转录按钮
    const transcriptButtons = document.querySelectorAll('[aria-label*="Transcript"], [aria-label*="转录"], button');
    console.log('页面上找到的可能的转录按钮数量:', transcriptButtons.length);
    
    transcriptButtons.forEach((btn, index) => {
      if (btn.textContent?.toLowerCase().includes('transcript') || 
          btn.textContent?.includes('转录') ||
          btn.getAttribute('aria-label')?.toLowerCase().includes('transcript')) {
        console.log(`转录按钮 ${index}:`, {
          text: btn.textContent,
          ariaLabel: btn.getAttribute('aria-label'),
          visible: btn.offsetParent !== null
        });
      }
    });
    
    // 检查是否有转录面板
    const transcriptPanels = document.querySelectorAll('[class*="transcript"], [id*="transcript"]');
    console.log('页面上的转录相关元素数量:', transcriptPanels.length);
    
         console.log('如果问题持续，请打开浏览器开发者工具查看详细日志');
     console.log('你也可以在控制台运行 window.ytTranscriptDebug() 来手动检查转录面板');
   }

   // 添加全局调试方法
   setupGlobalDebugMethod() {
     window.ytTranscriptDebug = () => {
       console.log('=== YouTube 转录调试工具 ===');
       
       // 检查转录面板
       const transcriptPanel = document.querySelector('ytd-transcript-renderer');
       if (transcriptPanel) {
         console.log('找到转录面板:', transcriptPanel);
         console.log('面板内容:', transcriptPanel.innerHTML.substring(0, 500) + '...');
         
         const segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
         console.log('转录段落数量:', segments.length);
         
         if (segments.length > 0) {
           console.log('前几个段落内容:');
           Array.from(segments).slice(0, 5).forEach((segment, index) => {
             console.log(`段落 ${index + 1}:`, segment.textContent?.trim());
           });
         }
       } else {
         console.log('未找到转录面板');
       }
       
       // 检查所有可能的转录相关元素
       const transcriptElements = document.querySelectorAll('[class*="transcript"], [id*="transcript"], [data-start-time]');
       console.log('所有转录相关元素:', transcriptElements);
       
       // 检查字幕数据
       console.log('页面字幕数据:', window.ytInitialPlayerResponse?.captions);
       
       return {
         transcriptPanel,
         transcriptElements,
         captionData: window.ytInitialPlayerResponse?.captions
       };
     };
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
    console.log('尝试从 API 获取转录，视频ID:', videoId);
    
    try {
      // 获取页面上的必要信息
      const ytInitialData = window.ytInitialData;
      const ytInitialPlayerResponse = window.ytInitialPlayerResponse;
      
      console.log('ytInitialPlayerResponse 存在:', !!ytInitialPlayerResponse);
      console.log('captions 存在:', !!(ytInitialPlayerResponse?.captions));

      if (ytInitialPlayerResponse && ytInitialPlayerResponse.captions) {
        const captionTracks = ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer?.captionTracks;
        
        console.log('找到的字幕轨道数量:', captionTracks?.length || 0);
        
        if (captionTracks && captionTracks.length > 0) {
          // 打印所有可用的字幕轨道信息
          captionTracks.forEach((track, index) => {
            console.log(`字幕轨道 ${index}:`, {
              language: track.languageCode,
              name: track.name?.simpleText,
              kind: track.kind,
              isTranslatable: track.isTranslatable
            });
          });
          
          // 选择字幕轨道的策略：
          // 1. 优先选择非翻译的原始字幕（kind 为 undefined 或 null）
          // 2. 如果没有原始字幕，选择第一个可用的
          let selectedTrack = captionTracks.find(track => !track.kind && !track.isTranslatable) || 
                             captionTracks.find(track => !track.kind) || 
                             captionTracks[0];
          
          console.log('选择的字幕轨道:', {
            language: selectedTrack.languageCode,
            name: selectedTrack.name?.simpleText,
            kind: selectedTrack.kind,
            hasBaseUrl: !!selectedTrack.baseUrl
          });
          
          if (selectedTrack && selectedTrack.baseUrl) {
            console.log('开始获取字幕内容...');
            const response = await fetch(selectedTrack.baseUrl);
            
            if (!response.ok) {
              console.error('字幕请求失败:', response.status, response.statusText);
              return null;
            }
            
            const xmlText = await response.text();
            console.log('获取到 XML 内容长度:', xmlText.length);
            
            const transcription = this.parseTranscriptionXML(xmlText);
            if (transcription) {
              console.log('API 方法成功获取转录，长度:', transcription.length);
              return transcription;
            }
          }
        } else {
          console.log('未找到字幕轨道');
        }
      } else {
        console.log('页面数据中未找到字幕信息');
      }
    } catch (error) {
      console.error('API 获取失败:', error);
    }

    return null;
  }

  parseTranscriptionXML(xmlText) {
    try {
      console.log('开始解析 XML 转录内容...');
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // 检查是否有解析错误
      const errorNode = xmlDoc.querySelector('parsererror');
      if (errorNode) {
        console.error('XML 解析错误:', errorNode.textContent);
        return null;
      }
      
      const textElements = xmlDoc.querySelectorAll('text');
      console.log('找到的文本元素数量:', textElements.length);
      
      if (textElements.length === 0) {
        console.log('未找到 text 元素，尝试其他标签...');
        // 尝试其他可能的标签名
        const alternativeTags = ['p', 'span', 'div', 'caption'];
        for (const tag of alternativeTags) {
          const elements = xmlDoc.querySelectorAll(tag);
          if (elements.length > 0) {
            console.log(`找到 ${elements.length} 个 ${tag} 元素`);
            const transcription = Array.from(elements)
              .map(element => this.decodeHTMLEntities(element.textContent.trim()))
              .filter(text => text.length > 0)
              .join(' ');
            
            if (transcription.length > 0) {
              return transcription;
            }
          }
        }
        return null;
      }
      
      const transcription = Array.from(textElements)
        .map(element => {
          // 解码 HTML 实体
          const text = this.decodeHTMLEntities(element.textContent.trim());
          return text;
        })
        .filter(text => text.length > 0)
        .join(' ');

      console.log('解析完成，转录长度:', transcription.length);
      return transcription.length > 0 ? transcription : null;
      
    } catch (error) {
      console.error('XML 解析失败:', error);
      return null;
    }
  }

  decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  async getTranscriptionFromPage() {
    // 尝试打开转录面板并获取转录
    console.log('开始尝试从页面获取转录...');
    
    // 更全面的转录按钮选择器
    const transcriptSelectors = [
      '[aria-label*="Transcript"]',
      '[aria-label*="转录"]', 
      '[aria-label*="字幕"]',
      'button[aria-label*="transcript" i]',
      'button[aria-label*="show transcript" i]',
      'ytd-button-renderer[aria-label*="transcript" i]',
      // 新增：通过图标和文本内容查找
      'button:has(span:contains("Transcript"))',
      'button:has(span:contains("转录"))',
      // 通过 yt-formatted-string 查找
      'yt-formatted-string:contains("Transcript")',
      'yt-formatted-string:contains("转录")'
    ];
    
    let transcriptButton = null;
    for (const selector of transcriptSelectors) {
      transcriptButton = document.querySelector(selector);
      if (transcriptButton) {
        console.log('找到转录按钮:', selector);
        break;
      }
    }
    
    // 如果没找到转录按钮，尝试通过文本内容查找
    if (!transcriptButton) {
      const allButtons = document.querySelectorAll('button, yt-button-renderer, ytd-button-renderer');
      for (const button of allButtons) {
        const text = button.textContent?.toLowerCase() || '';
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        if (text.includes('transcript') || text.includes('转录') || 
            ariaLabel.includes('transcript') || ariaLabel.includes('转录')) {
          transcriptButton = button;
          console.log('通过文本内容找到转录按钮');
          break;
        }
      }
    }
    
    if (transcriptButton) {
      console.log('点击转录按钮...');
      // 点击转录按钮
      transcriptButton.click();
      
      // 等待转录面板加载 - 增加等待时间
      console.log('等待转录面板加载...');
      await this.sleep(2000); // 等待2秒让面板加载
      
      // 尝试多种方式获取转录内容
      let transcription = await this.extractTranscriptionContent();
      
      if (transcription) {
        console.log('成功获取转录:', transcription.substring(0, 100) + '...');
        return transcription;
      } else {
        console.log('转录面板已打开，但未能获取内容');
      }
    } else {
      console.log('未找到转录按钮');
    }

    return null;
  }

  async extractTranscriptionContent() {
    // 尝试多种选择器来获取转录内容
    const contentSelectors = [
      // 新的转录面板选择器
      'ytd-transcript-renderer',
      'ytd-transcript-segment-list-renderer',
      '#segments.ytd-transcript-segment-list-renderer',
      '.ytd-transcript-segment-renderer',
      '[data-start-time]',
      // 转录段落选择器
      'ytd-transcript-body-renderer',
      '.segment-text',
      '.segment.style-scope.ytd-transcript-segment-renderer',
      // 备用选择器
      '[role="presentation"] [data-start-time]',
      '.cue-group',
      '.caption-line'
    ];

    for (const selector of contentSelectors) {
      console.log('尝试选择器:', selector);
      const container = document.querySelector(selector);
      
      if (container) {
        console.log('找到容器:', selector);
        
        // 如果是段落容器，获取所有文本段
        if (selector.includes('segment') || selector === '[data-start-time]') {
          const segments = container.querySelectorAll ? 
            container.querySelectorAll('*') : [container];
          
          const texts = [];
          for (const segment of segments) {
            // 获取文本内容，排除时间戳
            const textContent = this.cleanTranscriptText(segment.textContent || segment.innerText || '');
            if (textContent) {
              texts.push(textContent);
            }
          }
          
          if (texts.length > 0) {
            return texts.join(' ');
          }
        }
        
        // 如果是整个容器，直接获取文本内容
        const allText = this.cleanTranscriptText(container.textContent || container.innerText || '');
        if (allText) {
          return allText;
        }
      }
    }

    // 最后的备用方案：查找所有可能包含转录的元素
    console.log('使用备用方案搜索转录内容...');
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      if (element.getAttribute('data-start-time') || 
          element.className.includes('transcript') ||
          element.className.includes('segment')) {
        const text = this.cleanTranscriptText(element.textContent || '');
        if (text && text.length > 20) { // 假设转录文本应该比较长
          console.log('找到可能的转录内容');
          return text;
        }
      }
    }

    return null;
  }

  cleanTranscriptText(text) {
    if (!text) return '';
    
    // 清理转录文本
    return text
      .replace(/^\d+:\d+:\d+|\d+:\d+/g, '') // 移除时间戳
      .replace(/\s+/g, ' ') // 合并空格
      .trim();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      span.textContent = 'Loading...';
      this.button.disabled = true;
    } else {
      span.textContent = 'Transcript';
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