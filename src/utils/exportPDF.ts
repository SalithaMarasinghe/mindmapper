import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BlockNoteEditor } from '@blocknote/core';
import type { MindmapMeta, MindmapNode, NodeContent } from '../types';

async function imageToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
}

function buildTree(nodes: MindmapNode[], parentId: string | null = null): any[] {
  return nodes
    .filter(n => n.parentId === parentId)
    .sort((a, b) => a.order - b.order)
    .map(n => ({ ...n, children: buildTree(nodes, n.id) }));
}

export async function exportMindmapToPDF(
  map: MindmapMeta,
  nodes: MindmapNode[],
  contentMap: Record<string, NodeContent>
) {
  const container = document.createElement('div');
  // Position offscreen so users don't see it
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px'; 
  container.style.backgroundColor = '#ffffff';
  document.body.appendChild(container);

  try {
    // 1. Build Base HTML
    let htmlString = `
      <style>
        .pdf-container {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #333;
          line-height: 1.6;
          background-color: #fff;
        }
        .page {
          page-break-after: always;
          padding: 40px;
        }
        h1, h2, h3 { color: #01696f; margin-bottom: 20px; }
        .cover-page {
          height: 1100px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }
        .cover-title { font-size: 48px; font-weight: bold; margin-bottom: 10px; }
        .cover-meta { font-size: 18px; color: #666; margin-bottom: 40px; }
        .stats-box {
          display: flex; gap: 40px; margin-top: 40px;
          border-top: 2px solid #eee; padding-top: 30px;
        }
        .stat { text-align: center; }
        .stat-value { font-size: 32px; font-weight: bold; color: #01696f; }
        .stat-label { font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
        
        .toc-list { list-style-type: none; padding-left: 20px; }
        .toc-item { margin: 8px 0; font-size: 16px; }
        .toc-branch { font-weight: bold; color: #01696f; margin-top: 15px; }

        .section {
          padding: 40px;
          page-break-before: always;
        }
        .section-header {
          border-left: 5px solid #01696f;
          padding-left: 20px;
          margin-bottom: 30px;
        }
        .breadcrumb { font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: 8px; }
        .section-title { font-size: 32px; margin: 0; padding: 0; display: inline-block; }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          vertical-align: middle;
          margin-left: 15px;
        }
        .badge-studied { background: #dcfce7; color: #166534; }
        .badge-not-studied { background: #f1f5f9; color: #475569; }
        
        .content img { width: 100%; max-width: 100%; height: auto; border-radius: 8px; margin: 20px 0; display: block; object-fit: contain; }
        .content pre { background: #1e293b; color: #f8fafc; padding: 15px; border-radius: 8px; font-family: monospace; white-space: pre-wrap; }
        .content table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .content th, .content td { border: 1px solid #ddd; padding: 12px; }
        .content th { background-color: #f8fafc; }
      </style>
      <div class="pdf-container">
    `;

    // 2. Cover Page
    const studiedCount = Object.values(contentMap).filter(c => c.isCompleted).length;
    const remainingCount = nodes.length - studiedCount;
    htmlString += `
      <div class="page cover-page">
        <div class="text-6xl mb-6">${map.emoji}</div>
        <h1 class="cover-title">${map.title}</h1>
        <div class="cover-meta">Generated on ${new Date().toLocaleDateString()}</div>
        ${map.description ? `<p style="max-width: 500px; color: #555; font-size: 18px;">${map.description}</p>` : ''}
        
        <div class="stats-box">
          <div class="stat"><div class="stat-value">${nodes.length}</div><div class="stat-label">Total Topics</div></div>
          <div class="stat"><div class="stat-value">${studiedCount}</div><div class="stat-label">Studied</div></div>
          <div class="stat"><div class="stat-value">${remainingCount}</div><div class="stat-label">Remaining</div></div>
        </div>
      </div>
    `;

    // 3. Table of Contents
    htmlString += `<div class="page shadow-none border-0"><h2>Table of Contents</h2>`;
    const generateTOC = (n: any) => {
      let html = `<ul class="toc-list">`;
      n.forEach((child: any) => {
        const isBranch = child.type === 'branch';
        html += `<li class="toc-item ${isBranch ? 'toc-branch' : ''}">${child.label}</li>`;
        if (child.children?.length) {
          html += generateTOC(child.children);
        }
      });
      html += `</ul>`;
      return html;
    };
    const tree = buildTree(nodes);
    htmlString += generateTOC(tree);
    htmlString += `</div>`;

    // 4. Content Sections (sorted by tree traversal order)
    const flattenTree = (n: any[], path: string = ''): any[] => {
      let flat: any[] = [];
      n.forEach((child: any) => {
        const p = path ? `${path} > ${child.label}` : child.label;
        flat.push({ ...child, breadcrumb: path });
        if (child.children?.length) {
          flat = flat.concat(flattenTree(child.children, p));
        }
      });
      return flat;
    };
    const flatNodes = flattenTree(tree);
    const editor = BlockNoteEditor.create();

    for (const node of flatNodes) {
      const content = contentMap[node.id];
      const isStudied = content?.isCompleted;
      
      let blockHTML = '<p style="color: #888; font-style: italic;">No notes added yet.</p>';
      if (content?.richContent && content.richContent.length > 0) {
        // Temporary set blocks to extract HTML
        editor.replaceBlocks(editor.document, content.richContent as any[]);
        blockHTML = await editor.blocksToHTMLLossy();
      }

      htmlString += `
        <div class="section">
          <div class="section-header">
            <div class="breadcrumb">${node.breadcrumb || 'Root'}</div>
            <h2 class="section-title">${node.label}</h2>
            <span class="badge ${isStudied ? 'badge-studied' : 'badge-not-studied'}">
              ${isStudied ? '✓ Studied' : '○ Not Studied'}
            </span>
          </div>
          <div class="content">
            ${blockHTML}
          </div>
        </div>
      `;
    }

    htmlString += `</div>`;
    container.innerHTML = htmlString;
    
    // Give DOM a split second to mount
    await new Promise(r => setTimeout(r, 100));

    // 5. Build Base64 Images to prevent Canvas CORS crashes
    const images = Array.from(container.querySelectorAll('img'));
    
    // Start fetch tasks
    await Promise.all(images.map(async (img) => {
      try {
        if (img.src && !img.src.startsWith('data:')) {
          img.crossOrigin = 'anonymous'; // Optional: allow explicit clear handling
          const dataUrl = await imageToBase64(img.src);
          img.src = dataUrl;
        }
      } catch (err) {
        console.warn('Could not load image to base64, canvas might fail to render it: ', img.src);
      }
    }));

    // Explicitly wait for all newly applied Base64 sources to finish decoding
    await Promise.all(images.map(img => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));

    // Minimal stabilization buffer against layout reflow
    await new Promise(r => setTimeout(r, 200));

    // 6. Capture
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // 7. Paginate & Generate PDF
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    const scaleFactor = pdfWidth / canvasWidth;
    const scaledImgHeight = canvasHeight * scaleFactor;
    
    let heightLeft = scaledImgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledImgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - scaledImgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledImgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(`${slugify(map.title)}-notes.pdf`);

  } finally {
    // Cleanup
    container.remove();
  }
}
