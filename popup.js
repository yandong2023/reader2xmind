console.log('jsMind 版本:', jsMind.version);
console.log('jsMind 支持的格式:', jsMind.format);
console.log('jsMind 支持的主题:', jsMind.theme);
console.log('jsMind 对象:', jsMind);

let notesContent = '';
let jm = null;
let mindmapSVG = null;

document.addEventListener('DOMContentLoaded', function() {
  if (typeof jsMind === 'undefined') {
    console.error('jsMind 库未正确加载');
    alert('jsMind 库未正确加载，请检查文件路径');
  }

  document.getElementById('getNotesBtn').addEventListener('click', getNotes);
  document.getElementById('generateMindmapBtn').addEventListener('click', generateMindMap);
  document.getElementById('downloadMindmapBtn').addEventListener('click', downloadMindMap);
});

function getNotes() {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs[0].url.includes('weread.qq.com')) {s
      alert('请在微信读书页面使用此扩展。');
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {action: "getNotes"}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送消息时出错:', chrome.runtime.lastError);
        alert('发生错误' + chrome.runtime.lastError.message);
        return;
      }
      if (response && response.notes) {
        document.getElementById('notes-preview').innerText = response.notes;
        document.getElementById('generateMindmapBtn').disabled = true;
      } else {
        console.error('无法获取笔记');
        document.getElementById('notes-preview').innerText = '无法获取笔记，请确保您已经做了笔记，并刷新页面后重试。';
      }
    });
  });
}

// 添加一个新的监听器来接收完整的笔记
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "notesCollected") {
    notesContent = request.notes;
    document.getElementById('notes-preview').innerText = notesContent;
    document.getElementById('generateMindmapBtn').disabled = false;
    console.log('获取到的笔记（前100字符）：', notesContent.substring(0, 100));
  }
});

function generateMindMap() {
    console.log('开始生成思维导图');
    const mindmapData = parseMindMapData(notesContent);
    
    const options = {
      container: 'mindmap',
      theme: 'orange',
      editable: true,
      view: {
        engine: 'svg',  // 强制使用 SVG 渲染
        hmargin: 100,
        vmargin: 50,
        line_width: 2,
        line_color: '#555'
      },
      layout: {
        hspace: 30,
        vspace: 20,
        pspace: 13
      }
    };
    
    jm = new jsMind(options);
    jm.show(mindmapData);
  
    // 调整长文本的显示
    adjustLongText();
  
    // 给 jsMind 一些时间来渲染 SVG
    setTimeout(() => {
      const svgElement = document.querySelector('#mindmap svg');
      if (svgElement) {
        console.log('SVG 元素已生成');
        // 添加样式到 SVG
        const style = document.createElement('style');
        style.textContent = `
          .jsmind-node {
            font-family: Arial, sans-serif;
          }
          .jsmind-node.root {
            font-weight: bold;
          }
        `;
        svgElement.insertBefore(style, svgElement.firstChild);

        document.getElementById('downloadMindmapBtn').disabled = false;
      } else {
        console.error('SVG 元素未生成');
        console.log('mindmap 元素的内容:', document.getElementById('mindmap').innerHTML);
        alert('生成思维导图时出现问题，SVG 元素未创建');
      }
    }, 1000);  // 等待 1 秒
}

function parseMindMapData(notes) {
  const lines = notes.split('\n').filter(line => line.trim() !== '');
  const bookName = lines[0].trim(); // 第一行是书名
  const root = {id: 'root', topic: bookName, isroot: true, children: []};

  let currentChapter = null;
  let currentNote = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('第') && (line.includes('章') || line.includes('节'))) {
      // 新章节
      currentChapter = {id: `chapter_${Math.random().toString(36).substr(2, 9)}`, topic: line, children: []};
      root.children.push(currentChapter);
      currentNote = null;
    } else if (line.length > 0) {
      // 笔记内容
      if (!currentNote) {
        currentNote = {id: `note_${Math.random().toString(36).substr(2, 9)}`, topic: formatLongText(line), children: []};
        if (currentChapter) {
          currentChapter.children.push(currentNote);
        } else {
          root.children.push(currentNote);
        }
      } else {
        // 如果经有一个笔记，就将这行添加为子节点
        currentNote.children.push({id: `subnote_${Math.random().toString(36).substr(2, 9)}`, topic: formatLongText(line)});
      }
    }
  }

  return {
    meta: {
      name: bookName,
      author: 'Extension User',
      version: '1.0',
    },
    format: 'node_tree',
    data: root
  };
}

function formatLongText(text) {
  if (text.length <= 500) {
    return text;
  }
  return text.substring(0, 497) + '...';
}

function adjustLongText() {
  const nodes = document.querySelectorAll('#mindmap .jsmind-node');
  nodes.forEach(node => {
    const topic = node.querySelector('.topic');
    if (topic) {
      const fullText = topic.textContent;
      topic.style.whiteSpace = 'normal';
      topic.style.wordBreak = 'break-word';
      topic.style.maxWidth = '500px'; // 增加最大宽度
      topic.title = fullText; // 添加完整文本作为提示
      
      if (fullText.length > 500) {
        topic.textContent = fullText.substring(0, 497) + '...';
      }
    }
  });
}

function groupUnclassifiedNotes(notes) {
  const groups = {};
  notes.forEach(note => {
    const words = note.topic.split(/\s+/);
    const key = words.slice(0, 3).join(' '); // 使用前三个词作为分组关键字
    if (!groups[key]) {
      groups[key] = {id: `group_${Math.random().toString(36).substr(2, 9)}`, topic: key, children: []};
    }
    groups[key].children.push(note);
  });
  return Object.values(groups);
}

function downloadMindMap() {
  if (!jm) {
    alert('请先生成思维导图');
    return;
  }

  const format = document.getElementById('downloadFormat').value;
  switch (format) {
    case 'svg':
      downloadSVG();
      break;
    case 'xmind':
      downloadXMind(jm.get_data());
      break;
    default:
      alert('不支持的格式');
  }
}

function downloadSVG() {
  console.log('开始下载 SVG');
  const mindmapElement = document.getElementById('mindmap');
  if (!mindmapElement) {
    console.error('找不到 mindmap 元素');
    alert('无法找到思维导图元素，请重新生成思维导图');
    return;
  }

  const svgElement = mindmapElement.querySelector('svg');
  if (!svgElement) {
    console.error('在 mindmap 元素中找不到 SVG');
    alert('无法生成 SVG，请重新生成思维导图');
    return;
  }

  try {
    // 克隆 SVG 元素以避免修改原始元素
    const clonedSvg = svgElement.cloneNode(true);
    
    // 获取 SVG 的尺寸
    const bbox = svgElement.getBBox();
    const width = bbox.width + bbox.x * 2;
    const height = bbox.height + bbox.y * 2;

    // 设置 SVG 的属性
    clonedSvg.setAttribute('width', width);
    clonedSvg.setAttribute('height', height);
    clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    // 添加 xmlns 属性，确保 SVG 可以独立使用
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    // 添加样式到 SVG
    const style = document.createElement('style');
    style.textContent = `
      .jsmind-node {
        font-family: Arial, sans-serif;
      }
      .jsmind-node.root {
        font-weight: bold;
      }
    `;
    clonedSvg.insertBefore(style, clonedSvg.firstChild);

    const serializedSvg = new XMLSerializer().serializeToString(clonedSvg);
    
    // 添加 XML 声明
    const svgContent = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + serializedSvg;

    const blob = new Blob([svgContent], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mindmap.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('SVG 下载成功');
  } catch (error) {
    console.error('生成 SVG 时发生错误:', error);
    alert('生成 SVG 时发生错误，请查看控制台以获取更多信息。');
  }
}

function downloadXMind(data) {
  const xmindData = {
    format: "xmind",
    version: "1.0",
    sheet: {
      title: data.meta.name,
      topic: convertToXMindFormat(data.data),
      structure: "org.xmind.ui.map.unbalanced"
    }
  };
  
  const jsonString = JSON.stringify(xmindData, null, 2);
  const blob = new Blob([jsonString], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mindmap.xmind';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function convertToXMindFormat(node) {
  const xmindNode = {
    title: node.topic,
    structure: "org.xmind.ui.logic.right"
  };

  if (node.children && node.children.length > 0) {
    xmindNode.children = node.children.map(child => convertToXMindFormat(child));
  }

  return xmindNode;
}