function getNotes() {
  console.log('尝试获取笔记');
  
  // 获取书名
  const bookNameElement = document.querySelector('.readerTopBar_title_link');
  const bookName = bookNameElement ? bookNameElement.textContent.trim() : '未知书名';
  
  // 获取所有章节
  const chapterElements = document.querySelectorAll('.readerCatalog_list_item');
  let allNotes = '';

  chapterElements.forEach((chapterElement, index) => {
    const chapterTitle = chapterElement.textContent.trim();
    console.log(`处理章节: ${chapterTitle}`);

    // 点击章节以加载笔记
    chapterElement.click();

    // 等待笔记加载
    setTimeout(() => {
      // 获取该章节的笔记
      const noteElements = document.querySelectorAll('.readerNoteList');
      
      if (noteElements.length > 0) {
        const chapterNotes = Array.from(noteElements).map(el => {
          const contentElement = el.querySelector('.text');
          const content = contentElement ? contentElement.textContent.trim() : '';
          return content;
        }).join('\n');
        
        allNotes += `${chapterTitle}\n${chapterNotes}\n\n`;
      }

      // 如果是最后一个章节，发送所有笔记
      if (index === chapterElements.length - 1) {
        console.log('所有笔记获取完成');
        chrome.runtime.sendMessage({
          action: "notesCollected",
          notes: `${bookName}\n\n${allNotes}`
        });
      }
    }, 1000); // 等待1秒让笔记加载
  });

  return '正在获取所有章节的笔记，请稍候...';
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('content.js 收到消息', request);
  if (request.action === "getNotes") {
    const message = getNotes();
    console.log(message);
    sendResponse({notes: message});
  }
  return true; // 保持消息通道开放
});

console.log('content.js 已加载，当前URL:', window.location.href);