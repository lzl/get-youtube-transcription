// YouTube Transcription Extractor Content Script
class YouTubeTranscriptionExtractor {
  constructor() {
    this.button = null;
    this.isProcessing = false;
    this.buttonContainerObserver = null;
    this.init();
  }

  init() {
    // 设置全局调试方法
    this.setupGlobalDebugMethod();
    // 监听页面变化，因为 YouTube 是单页应用
    this.observePageChanges();
    // 立即尝试添加按钮
    this.startButtonContainerObserver();
  }

  observePageChanges() {
    // 监听 URL 变化
    let lastUrl = location.href;
    
    const handlePageChange = () => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('检测到页面变化:', url);
        
        // 清理旧的按钮引用和监听器
        this.cleanupButton();
        
        // 立即开始监听按钮容器的出现
        this.startButtonContainerObserver();
      }
    };

    // 使用多种方式监听页面变化
    new MutationObserver(handlePageChange).observe(document, { 
      subtree: true, 
      childList: true 
    });

    // 监听浏览器历史变化
    window.addEventListener('popstate', handlePageChange);
    
    // 监听YouTube的自定义事件
    window.addEventListener('yt-navigate-finish', handlePageChange);
    window.addEventListener('yt-page-data-updated', handlePageChange);
  }

  cleanupButton() {
    // 断开之前的观察器
    if (this.buttonContainerObserver) {
      this.buttonContainerObserver.disconnect();
      this.buttonContainerObserver = null;
    }
    
    // 清理按钮引用
    this.button = null;
  }

  startButtonContainerObserver() {
    if (!this.isVideoPage()) {
      return;
    }

    console.log('开始监听按钮容器出现...');
    
    // 立即尝试一次
    this.tryAddButton();
    
    // 创建专门监听按钮容器区域的观察器
    this.buttonContainerObserver = new MutationObserver((mutations) => {
      // 检查是否有相关的DOM变化
      const hasRelevantChanges = mutations.some(mutation => {
        // 检查添加的节点
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // 检查是否包含我们关注的按钮容器
              if (this.containsButtonContainer(node)) {
                return true;
              }
            }
          }
        }
        return false;
      });
      
      if (hasRelevantChanges) {
        console.log('检测到按钮容器相关变化，尝试添加按钮');
        this.tryAddButton();
      }
    });

    // 观察整个视频页面的主要内容区域
    const mainContent = document.querySelector('#primary, #page-manager, ytd-app') || document.body;
    this.buttonContainerObserver.observe(mainContent, {
      childList: true,
      subtree: true,
      attributeFilter: ['class', 'id'] // 只关注class和id变化
    });

    // 额外监听特定的YouTube事件
    this.listenToYouTubeEvents();
  }

  containsButtonContainer(element) {
    // 检查元素或其子元素是否包含按钮容器
    const containerSelectors = [
      '#actions-inner',
      '#top-level-buttons-computed', 
      '#menu-container',
      '.ytd-menu-renderer',
      '[class*="actions"]',
      '[id*="actions"]'
    ];
    
    return containerSelectors.some(selector => {
      return element.matches && element.matches(selector) || 
             element.querySelector && element.querySelector(selector);
    });
  }

  listenToYouTubeEvents() {
    // 监听YouTube的内部事件
    const youtubeEvents = [
      'yt-navigate-finish',
      'yt-page-data-updated', 
      'yt-player-updated',
      'yt-action-panel-update',
      'yt-watch-comments-loaded'
    ];
    
    youtubeEvents.forEach(eventName => {
      window.addEventListener(eventName, () => {
        console.log(`检测到YouTube事件: ${eventName}`);
        // 延迟很短的时间让DOM更新完成
        setTimeout(() => this.tryAddButton(), 100);
      });
    });
  }

  tryAddButton() {
    // 检查是否已有按钮且仍在DOM中
    if (this.button && document.contains(this.button)) {
      return;
    }

    // 清理失效的按钮引用
    if (this.button && !document.contains(this.button)) {
      this.button = null;
    }

    // 检查是否是视频页面
    if (!this.isVideoPage()) {
      return;
    }

    // 尝试找到容器并添加按钮
    const container = this.findButtonContainer();
    if (container && this.isValidButtonContainer(container)) {
      console.log('找到有效容器，添加按钮');
      this.createAndInsertButtonToContainer(container);
    }
  }

  isVideoPage() {
    // 支持普通视频页面：/watch?v=videoId
    const isWatchPage = location.pathname === '/watch' && location.search.includes('v=');
    
    // 支持直播页面：/live/videoId
    const isLivePage = location.pathname.startsWith('/live/');
    
    return isWatchPage || isLivePage;
  }

  findButtonContainer() {
    // 按优先级查找容器
    const selectors = [
      '#actions-inner #top-level-buttons-computed',
      '#top-level-buttons-computed',
      '#actions-inner',
      '#actions #menu-container',
      '#menu-container'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && this.isValidButtonContainer(element)) {
        return element;
      }
    }

    // 通过已存在的按钮查找容器
    const existingButtons = [
      'button[aria-label*="like" i]',
      'button[aria-label*="Share" i]', 
      'button[aria-label*="Save" i]'
    ];

    for (const buttonSelector of existingButtons) {
      const button = document.querySelector(buttonSelector);
      if (button) {
        const container = button.closest('#top-level-buttons-computed, #actions-inner, #menu-container');
        if (container && this.isValidButtonContainer(container)) {
          return container;
        }
      }
    }

    return null;
  }

  createAndInsertButtonToContainer(targetContainer) {
    // 避免重复添加
    if (this.button && document.contains(this.button)) {
      return;
    }

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
    
    // 监听按钮是否被意外移除
    this.monitorButtonPresence();
  }

  monitorButtonPresence() {
    if (!this.button) return;
    
    // 创建观察器监听按钮是否被移除
    const buttonObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.removedNodes.length > 0) {
          for (const node of mutation.removedNodes) {
            if (node === this.button || (node.contains && node.contains(this.button))) {
              console.log('检测到按钮被移除，尝试重新添加');
              this.button = null;
              buttonObserver.disconnect();
              // 立即尝试重新添加
              setTimeout(() => this.tryAddButton(), 100);
              return;
            }
          }
        }
      });
    });

    // 观察按钮的父容器
    const buttonContainer = this.button.closest('#top-level-buttons-computed, #actions-inner, #menu-container') || this.button.parentElement;
    if (buttonContainer) {
      buttonObserver.observe(buttonContainer, {
        childList: true,
        subtree: true
      });
    }
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
    // 普通视频页面：从查询参数获取 videoId
    if (location.pathname === '/watch') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('v');
    }
    
    // 直播页面：从路径获取 videoId
    if (location.pathname.startsWith('/live/')) {
      return location.pathname.split('/live/')[1];
    }
    
    return null;
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
            const segments = [];
            
            for (const element of elements) {
              const text = this.decodeHTMLEntities(element.textContent.trim());
              const startTime = element.getAttribute('start') || element.getAttribute('t');
              
              if (text.length > 0) {
                if (startTime) {
                  segments.push(`${this.formatTime(startTime)}: ${text}`);
                } else {
                  segments.push(text);
                }
              }
            }
            
            if (segments.length > 0) {
              // 去重并返回结果
              return [...new Set(segments)].join('\n');
            }
          }
        }
        return null;
      }
      
      const segments = [];
      
      for (const element of textElements) {
        // 解码 HTML 实体
        const text = this.decodeHTMLEntities(element.textContent.trim());
        const startTime = element.getAttribute('start') || element.getAttribute('t');
        
        if (text.length > 0) {
          if (startTime) {
            segments.push(`${this.formatTime(startTime)}: ${text}`);
          } else {
            segments.push(text);
          }
        }
      }

      if (segments.length > 0) {
        // 去重并返回结果
        const uniqueSegments = [...new Set(segments)];
        console.log('解析完成，转录段落数:', uniqueSegments.length);
        return uniqueSegments.join('\n');
      }
      
      return null;
      
    } catch (error) {
      console.error('XML 解析失败:', error);
      return null;
    }
  }

  // 修改格式化时间戳的方法，确保格式正确
  formatTime(seconds) {
    const sec = parseFloat(seconds);
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const remainingSeconds = Math.floor(sec % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
    console.log('开始提取转录内容...');
    
    // 尝试多种选择器来获取转录内容
    const contentSelectors = [
      // 新的转录面板选择器
      'ytd-transcript-renderer',
      'ytd-transcript-segment-list-renderer',
      '#segments.ytd-transcript-segment-list-renderer',
      // 转录段落选择器
      'ytd-transcript-body-renderer'
    ];

    for (const selector of contentSelectors) {
      console.log('尝试选择器:', selector);
      const container = document.querySelector(selector);
      
      if (container) {
        console.log('找到容器:', selector);
        
        // 查找所有转录段落元素
        const segmentElements = container.querySelectorAll('ytd-transcript-segment-renderer');
        
        if (segmentElements.length > 0) {
          console.log('找到转录段落:', segmentElements.length);
          
          const transcriptSegments = [];
          
          for (const segment of segmentElements) {
            try {
              // 获取时间戳 - 从子元素中查找
              const timestampElement = segment.querySelector('[data-start-time]');
              const timestamp = timestampElement?.getAttribute('data-start-time');
              
              // 获取文本内容 - 从段落的文本部分获取
              const textElement = segment.querySelector('.segment-text, ytd-transcript-segment-renderer .text, .ytd-transcript-segment-renderer');
              let textContent = '';
              
              if (textElement) {
                textContent = this.cleanTranscriptText(textElement.textContent || textElement.innerText || '');
              } else {
                // 如果没有找到特定的文本元素，从整个段落获取
                textContent = this.cleanTranscriptText(segment.textContent || segment.innerText || '');
                // 移除可能包含的时间戳文本
                textContent = textContent.replace(/^\d+:\d+\s*/, '').trim();
              }
              
              console.log('段落处理:', {
                timestamp,
                textLength: textContent.length,
                textPreview: textContent.substring(0, 50) + '...'
              });
              
              if (textContent && textContent.length > 0) {
                if (timestamp) {
                  const formattedTime = this.formatTime(timestamp);
                  transcriptSegments.push(`${formattedTime}: ${textContent}`);
                } else {
                  transcriptSegments.push(textContent);
                }
              }
            } catch (error) {
              console.log('处理段落时出错:', error);
              continue;
            }
          }
          
          if (transcriptSegments.length > 0) {
            console.log('成功提取转录段落:', transcriptSegments.length);
            return transcriptSegments.join('\n');
          }
        }
        
        // 如果没有找到标准的segment元素，尝试其他方式
        console.log('尝试其他提取方式...');
        const allTimestampElements = container.querySelectorAll('[data-start-time]');
        
        if (allTimestampElements.length > 0) {
          console.log('找到时间戳元素:', allTimestampElements.length);
          
          const transcriptSegments = [];
          
          for (const timestampElement of allTimestampElements) {
            try {
              const timestamp = timestampElement.getAttribute('data-start-time');
              
              // 查找对应的文本内容
              let textContent = '';
              
              // 尝试从父元素或兄弟元素中获取文本
              const parentElement = timestampElement.closest('ytd-transcript-segment-renderer');
              if (parentElement) {
                textContent = this.cleanTranscriptText(parentElement.textContent || parentElement.innerText || '');
                // 移除时间戳文本
                textContent = textContent.replace(/^\d+:\d+\s*/, '').trim();
              } else {
                // 尝试从下一个兄弟元素获取
                const nextSibling = timestampElement.nextElementSibling;
                if (nextSibling) {
                  textContent = this.cleanTranscriptText(nextSibling.textContent || nextSibling.innerText || '');
                }
              }
              
              if (textContent && textContent.length > 0) {
                const formattedTime = this.formatTime(timestamp);
                transcriptSegments.push(`${formattedTime}: ${textContent}`);
              }
            } catch (error) {
              console.log('处理时间戳元素时出错:', error);
              continue;
            }
          }
          
          if (transcriptSegments.length > 0) {
            console.log('通过时间戳元素提取成功:', transcriptSegments.length);
            return transcriptSegments.join('\n');
          }
        }
      }
    }

    console.log('所有提取方式都失败了');
    return null;
  }

  cleanTranscriptText(text) {
    if (!text) return '';
    
    // 清理转录文本，但保留现有的时间戳格式
    return text
      .replace(/\s+/g, ' ') // 合并空格
      .trim()
      .replace(/^\s*-\s*/, ''); // 移除开头的短横线
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