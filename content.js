// YouTube Transcription Extractor Content Script
class YouTubeTranscriptionExtractor {
  constructor() {
    this.button = null;
    this.isProcessing = false;
    this.buttonContainerObserver = null;
    this.capturedData = null;
    this.setupDataCapture();
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
  
  setupDataCapture() {
    console.log('设置数据捕获机制...');
    
    // 方法1: 监听 DOM 变化以捕获脚本注入的数据
    const scriptObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeName === 'SCRIPT' && node.textContent) {
              this.extractDataFromScript(node.textContent);
            }
          }
        }
      }
    });
    
    scriptObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    
    // 方法2: 定期检查 window 对象
    const checkInterval = setInterval(() => {
      if (window.ytInitialPlayerResponse && !this.capturedData) {
        this.capturedData = window.ytInitialPlayerResponse;
        console.log('从 window 对象捕获到 ytInitialPlayerResponse');
        clearInterval(checkInterval);
      }
    }, 100);
    
    // 10秒后停止检查
    setTimeout(() => clearInterval(checkInterval), 10000);
  }
  
  extractDataFromScript(scriptContent) {
    // 提取 ytInitialPlayerResponse
    if (scriptContent.includes('ytInitialPlayerResponse') && !window.ytInitialPlayerResponse) {
      const patterns = [
        /window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/,
        /ytInitialPlayerResponse\s*=\s*({.+?});/,
        /var\s+ytInitialPlayerResponse\s*=\s*({.+?});/
      ];
      
      for (const pattern of patterns) {
        const match = scriptContent.match(pattern);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            window.ytInitialPlayerResponse = data;
            this.capturedData = data;
            console.log('成功从脚本中提取 ytInitialPlayerResponse');
            break;
          } catch (e) {
            console.error('解析 ytInitialPlayerResponse 失败:', e);
          }
        }
      }
    }
    
    // 提取 ytInitialData
    if (scriptContent.includes('ytInitialData') && !window.ytInitialData) {
      const patterns = [
        /window\["ytInitialData"\]\s*=\s*({.+?});/,
        /ytInitialData\s*=\s*({.+?});/,
        /var\s+ytInitialData\s*=\s*({.+?});/
      ];
      
      for (const pattern of patterns) {
        const match = scriptContent.match(pattern);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            window.ytInitialData = data;
            console.log('成功从脚本中提取 ytInitialData');
            break;
          } catch (e) {
            console.error('解析 ytInitialData 失败:', e);
          }
        }
      }
    }
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
    
    // 1. 检查 YouTube 数据
    console.log('--- YouTube 数据检查 ---');
    console.log('ytInitialPlayerResponse 存在:', !!window.ytInitialPlayerResponse);
    console.log('ytInitialData 存在:', !!window.ytInitialData);
    console.log('ytplayer 存在:', !!window.ytplayer);
    
    if (window.ytInitialPlayerResponse?.captions) {
      const tracks = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer?.captionTracks;
      console.log('字幕轨道数量:', tracks?.length || 0);
      if (tracks) {
        tracks.forEach((track, i) => {
          console.log(`  轨道 ${i + 1}: ${track.languageCode} - ${track.name?.simpleText || '未命名'}`);
        });
      }
    } else {
      console.log('没有找到字幕数据');
    }
    
    // 2. 检查转录按钮
    console.log('\n--- 转录按钮检查 ---');
    const transcriptButtons = document.querySelectorAll('[aria-label*="Transcript"], [aria-label*="转录"], [aria-label*="transcript"]');
    console.log('找到的转录按钮数量:', transcriptButtons.length);
    
    transcriptButtons.forEach((btn, index) => {
      const ariaLabel = btn.getAttribute('aria-label') || '';
      const text = btn.textContent?.trim() || '';
      if (ariaLabel.toLowerCase().includes('transcript') || text.toLowerCase().includes('transcript')) {
        console.log(`  按钮 ${index + 1}:`, {
          text: text.substring(0, 50),
          ariaLabel: ariaLabel,
          visible: btn.offsetParent !== null,
          className: btn.className
        });
      }
    });
    
    // 3. 检查转录面板
    console.log('\n--- 转录面板检查 ---');
    const transcriptPanels = document.querySelectorAll('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]');
    console.log('转录面板存在:', transcriptPanels.length > 0);
    
    const transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
    console.log('转录段落数量:', transcriptSegments.length);
    
    if (transcriptSegments.length > 0) {
      console.log('前 3 个段落内容:');
      Array.from(transcriptSegments).slice(0, 3).forEach((seg, i) => {
        const text = seg.textContent?.trim().substring(0, 100);
        console.log(`  段落 ${i + 1}: ${text}...`);
      });
    }
    
    // 4. 检查可能的错误
    console.log('\n--- 可能的问题 ---');
    const hasAdBlocker = !!document.querySelector('.adblock-whitelist-messagebox');
    console.log('广告拦截器干扰:', hasAdBlocker);
    
    const isMiniplayer = !!document.querySelector('ytd-miniplayer[active]');
    console.log('迷你播放器模式:', isMiniplayer);
    
    const isEmbedded = window.location.pathname.includes('embed');
    console.log('嵌入式播放器:', isEmbedded);
    
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
    try {
      console.log('开始获取转录...');
      const transcription = await this.quickExtractTranscript();
      if (transcription) {
        return transcription;
      }
    } catch (error) {
      console.log('获取转录失败:', error);
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




  


  async extractTranscriptionContent() {
    console.log('开始提取转录内容...');
    
    // 等待内容加载
    await this.sleep(1000);
    
    // 检查转录面板是否已打开
    const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]');
    if (transcriptPanel) {
      console.log('找到转录面板');
    }
    
    // 尝试多种选择器来获取转录内容
    const contentSelectors = [
      // 最新的 YouTube 转录选择器
      'ytd-transcript-segment-list-renderer ytd-transcript-segment-renderer',
      'ytd-transcript-renderer ytd-transcript-segment-renderer',
      // 旧版选择器
      'ytd-transcript-body-renderer ytd-transcript-segment-renderer',
      // 备用选择器
      '.ytd-transcript-segment-renderer'
    ];

    // 直接查找所有转录段落元素
    let segmentElements = document.querySelectorAll('ytd-transcript-segment-renderer');
    console.log(`在整个页面找到 ${segmentElements.length} 个转录段落元素`);
    
    if (segmentElements.length > 0) {
      const transcriptSegments = [];
      
      for (const segment of segmentElements) {
        try {
          // 方法1: 查找 segment-text 类
          let textContent = '';
          const segmentText = segment.querySelector('.segment-text');
          if (segmentText) {
            textContent = segmentText.textContent || segmentText.innerText || '';
            console.log('从 .segment-text 获取文本');
          }
          
          // 方法2: 查找包含文本的 span
          if (!textContent) {
            const spans = segment.querySelectorAll('span');
            for (const span of spans) {
              const text = span.textContent || span.innerText || '';
              // 过滤时间戳文本
              if (text && !text.match(/^\d+:\d+$/)) {
                textContent = text;
                console.log('从 span 获取文本');
                break;
              }
            }
          }
          
          // 方法3: 获取整个 segment 的文本
          if (!textContent) {
            textContent = segment.textContent || segment.innerText || '';
            // 移除时间戳
            textContent = textContent.replace(/^\d+:\d+\s*/, '').trim();
            console.log('从整个 segment 获取文本');
          }
          
          // 清理文本
          textContent = this.cleanTranscriptText(textContent);
          
          // 获取时间戳
          let timestamp = null;
          
          // 尝试多种方式查找时间戳元素
          const timestampSelectors = [
            '[data-start-time]',
            '.segment-timestamp',
            'ytd-transcript-segment-renderer [role="button"]',
            'ytd-transcript-segment-renderer button',
            '.ytd-transcript-segment-renderer [tabindex]',
            '.segment-start-offset'
          ];
          
          let timestampElement = null;
          let startTime = null;
          
          for (const selector of timestampSelectors) {
            timestampElement = segment.querySelector(selector);
            if (timestampElement) {
              console.log(`找到时间戳元素，使用选择器: ${selector}`);
              // 尝试从不同属性获取时间戳
              startTime = timestampElement.getAttribute('data-start-time') ||
                         timestampElement.getAttribute('data-start') ||
                         timestampElement.getAttribute('aria-label') ||
                         timestampElement.textContent;
              
              if (startTime) {
                startTime = startTime.trim(); // 去掉前后空格和换行符
                console.log('原始时间戳数据:', startTime);
                break;
              }
            }
          }
          
          if (startTime) {
            // 如果是 aria-label，可能需要从中提取时间
            if (startTime.includes('秒') || startTime.includes('分') || startTime.includes('时')) {
              // 处理中文时间格式
              const timeMatch = startTime.match(/(\d+)分(\d+)秒/);
              if (timeMatch) {
                const minutes = parseInt(timeMatch[1]);
                const seconds = parseInt(timeMatch[2]);
                timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
              }
            } else if (startTime.includes(':')) {
              // 已经是格式化的时间戳
              timestamp = startTime;
            } else {
              // 数字秒数
              timestamp = this.formatTimestamp(startTime);
            }
          }
          
          // 如果还是没找到，尝试从文本中提取时间戳
          if (!timestamp) {
            const timeMatch = segment.textContent.match(/^(\d+:\d+)/);
            if (timeMatch) {
              timestamp = timeMatch[1];
            }
          }
          
          console.log(`段落时间戳结果: ${timestamp}`)
          
          console.log(`段落: 时间=${timestamp}, 文本长度=${textContent.length}`);
          
          if (textContent && textContent.length > 0) {
            if (timestamp) {
              transcriptSegments.push(`${timestamp}: ${textContent}`);
            } else {
              transcriptSegments.push(textContent);
            }
          }
        } catch (error) {
          console.error('处理段落时出错:', error);
          continue;
        }
      }
      
      if (transcriptSegments.length > 0) {
        console.log(`成功提取 ${transcriptSegments.length} 个转录段落`);
        return transcriptSegments.join('\n');
      }
    }
    
    // 如果没有找到标准的 segment 元素，尝试其他方法
    console.log('尝试备用提取方法...');
    
    for (const selector of contentSelectors) {
      console.log(`尝试选择器: ${selector}`);
      const elements = document.querySelectorAll(selector);
      
      if (elements.length > 0) {
        console.log(`找到 ${elements.length} 个元素`);
        const transcriptSegments = [];
        
        for (const element of elements) {
          const text = this.cleanTranscriptText(element.textContent || element.innerText || '');
          if (text && text.length > 0) {
            transcriptSegments.push(text);
          }
        }
        
        // 如果没有找到标准的segment元素，尝试其他方式
        console.log('尝试其他提取方式...');
        
        // 使用多种选择器查找时间戳元素
        const timestampSelectors = [
          '[data-start-time]',
          '.segment-timestamp',
          'ytd-transcript-segment-renderer [role="button"]',
          'ytd-transcript-segment-renderer button',
          '.ytd-transcript-segment-renderer [tabindex]',
          '.segment-start-offset'
        ];
        
        const allTimestampElements = [];
        for (const selector of timestampSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`找到时间戳元素 ${elements.length} 个，使用选择器: ${selector}`);
            allTimestampElements.push(...elements);
            break; // 找到一种有效的选择器就使用它
          }
        }
        
        if (allTimestampElements.length > 0) {
          console.log('总共找到时间戳元素:', allTimestampElements.length);
          
          const transcriptSegments = [];
          
          for (const timestampElement of allTimestampElements) {
            try {
              // 尝试从多个属性获取时间戳
              let startTime = timestampElement.getAttribute('data-start-time') ||
                             timestampElement.getAttribute('data-start') ||
                             timestampElement.getAttribute('aria-label') ||
                             timestampElement.textContent;
              
              if (startTime) {
                startTime = startTime.trim(); // 去掉前后空格和换行符
              }
              
              let timestamp = null;
              if (startTime) {
                if (startTime.includes('秒') || startTime.includes('分') || startTime.includes('时')) {
                  // 处理中文时间格式
                  const timeMatch = startTime.match(/(\d+)分(\d+)秒/);
                  if (timeMatch) {
                    const minutes = parseInt(timeMatch[1]);
                    const seconds = parseInt(timeMatch[2]);
                    timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                  }
                } else if (startTime.includes(':')) {
                  // 已经是格式化的时间戳
                  timestamp = startTime;
                } else {
                  // 数字秒数
                  timestamp = this.formatTimestamp(startTime);
                }
              }
              
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
                if (timestamp) {
                  transcriptSegments.push(`${timestamp}: ${textContent}`);
                } else {
                  transcriptSegments.push(textContent);
                }
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

  formatTimestamp(seconds) {
    if (!seconds) return null;
    
    // 如果已经是格式化的时间戳，直接返回
    if (typeof seconds === 'string' && seconds.includes(':')) {
      return seconds;
    }
    
    // 转换秒数为 mm:ss 格式
    const totalSeconds = parseInt(seconds, 10);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async quickExtractTranscript() {
    console.log('开始快速提取转录...');
    
    // 先尝试打开描述区域，转录按钮可能在那里
    await this.expandDescription();
    
    // 查找所有可能的转录按钮
    const transcriptButton = await this.findVisibleTranscriptButton();
    
    if (!transcriptButton) {
      console.log('未找到可见的转录按钮');
      return null;
    }
    
    console.log('找到转录按钮，点击...');
    transcriptButton.click();
    
    // 等待面板加载
    await this.sleep(2000);
    
    // 提取转录内容
    return await this.extractTranscriptionContent();
  }
  
  async expandDescription() {
    console.log('展开视频描述...');
    
    // 查找展开描述的按钮
    const expandButtons = [
      'tp-yt-paper-button#expand',
      'tp-yt-paper-button.ytd-video-secondary-info-renderer',
      '#description tp-yt-paper-button',
      '[id="more"]:not([hidden])',
      'ytd-text-inline-expander #expand'
    ];
    
    for (const selector of expandButtons) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null && !button.hidden) {
        console.log(`点击展开按钮: ${selector}`);
        button.click();
        await this.sleep(500);
        break;
      }
    }
  }
  
  async findVisibleTranscriptButton() {
    console.log('查找可见的转录按钮...');
    
    // 多种查找策略
    const strategies = [
      // 策略1: 在描述区域查找
      () => {
        const descButtons = document.querySelectorAll('#description button, #description-inner button');
        for (const btn of descButtons) {
          if (this.isTranscriptButton(btn) && this.isElementVisible(btn)) {
            console.log('在描述区域找到转录按钮');
            return btn;
          }
        }
        return null;
      },
      
      // 策略2: 在视频下方的按钮区域查找
      () => {
        const actionButtons = document.querySelectorAll('ytd-video-primary-info-renderer button');
        for (const btn of actionButtons) {
          if (this.isTranscriptButton(btn) && this.isElementVisible(btn)) {
            console.log('在主要信息区找到转录按钮');
            return btn;
          }
        }
        return null;
      },
      
      // 策略3: 全局查找
      () => {
        const allButtons = document.querySelectorAll('button:not([aria-label*="Close"]):not([aria-label*="关闭"])');
        for (const btn of allButtons) {
          if (this.isTranscriptButton(btn) && this.isElementVisible(btn)) {
            console.log('在页面中找到转录按钮');
            return btn;
          }
        }
        return null;
      }
    ];
    
    // 依次尝试每种策略
    for (const strategy of strategies) {
      const button = strategy();
      if (button) {
        return button;
      }
    }
    
    return null;
  }
  
  isTranscriptButton(button) {
    const text = (button.textContent || '').toLowerCase();
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    
    return (text.includes('transcript') || 
            text.includes('转录') || 
            text.includes('字幕') ||
            ariaLabel.includes('transcript') ||
            ariaLabel.includes('转录') ||
            ariaLabel.includes('字幕'));
  }
  
  isElementVisible(element) {
    if (!element) return false;
    
    // 检查元素是否可见
    if (element.offsetParent === null) return false;
    if (element.offsetWidth === 0 || element.offsetHeight === 0) return false;
    if (window.getComputedStyle(element).display === 'none') return false;
    if (window.getComputedStyle(element).visibility === 'hidden') return false;
    
    // 检查元素是否在视口内
    const rect = element.getBoundingClientRect();
    const inViewport = rect.top >= 0 && 
                       rect.left >= 0 && 
                       rect.bottom <= window.innerHeight && 
                       rect.right <= window.innerWidth;
    
    // 元素可能在视口下方，但仍然可用
    return element.offsetParent !== null && (inViewport || rect.top > 0);
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