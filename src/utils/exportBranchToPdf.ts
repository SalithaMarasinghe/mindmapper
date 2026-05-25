import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { MindmapNode, NodeContent } from '../types';

// ─── BlockNote content types ──────────────────────────────────────────────────

type InlineStyle = 'bold' | 'italic' | 'underline' | 'strike' | 'code';

interface InlineContent {
  type: 'text' | 'link';
  text?: string;
  href?: string;
  content?: InlineContent[];
  styles?: Partial<Record<InlineStyle, boolean>>;
}

interface Block {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: InlineContent[] | Block[];
  children?: Block[];
}

// ─── Image fetching ───────────────────────────────────────────────────────────

async function fetchImageAsDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url; // fall back to original URL if fetch fails
  }
}

// ─── Inline content → HTML ───────────────────────────────────────────────────

function inlineToHtml(items: InlineContent[]): string {
  return items.map(item => {
    if (item.type === 'link') {
      const inner = item.content ? inlineToHtml(item.content) : (item.text ?? '');
      return `<a href="${item.href ?? '#'}" style="color:#0d9488;text-decoration:underline;">${inner}</a>`;
    }
    let html = escapeHtml(item.text ?? '');
    const s = item.styles ?? {};
    if (s.code)      html = `<code style="font-family:monospace;background:#f1f5f9;padding:1px 5px;border-radius:3px;font-size:0.85em;">${html}</code>`;
    if (s.bold)      html = `<strong>${html}</strong>`;
    if (s.italic)    html = `<em>${html}</em>`;
    if (s.underline) html = `<u>${html}</u>`;
    if (s.strike)    html = `<s>${html}</s>`;
    return html;
  }).join('');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Block → HTML ─────────────────────────────────────────────────────────────

function blockToHtml(block: Block, imageMap: Map<string, string>, depth = 0): string {
  const content = Array.isArray(block.content) ? block.content : [];
  const children = block.children ?? [];
  const props = block.props ?? {};
  const indent = depth > 0 ? `margin-left:${depth * 20}px;` : '';

  // Flatten inline content (when content is array of inline items)
  const isInlineArray = content.length === 0 || (content[0] && 'type' in content[0] && ((content[0] as InlineContent).type === 'text' || (content[0] as InlineContent).type === 'link'));
  const innerHtml = isInlineArray ? inlineToHtml(content as InlineContent[]) : '';

  const childrenHtml = children.map(c => blockToHtml(c, imageMap, depth + 1)).join('');

  switch (block.type) {
    case 'heading': {
      const level = (props.level as number) ?? 1;
      const sizes: Record<number, string> = { 1: '1.6em', 2: '1.3em', 3: '1.1em' };
      const margins: Record<number, string> = { 1: '24px 0 8px', 2: '20px 0 6px', 3: '16px 0 4px' };
      return `<h${level} style="font-size:${sizes[level] ?? '1.1em'};font-weight:700;margin:${margins[level] ?? '14px 0 4px'};color:#0f172a;${indent}">${innerHtml}</h${level}>${childrenHtml}`;
    }

    case 'bulletListItem':
      return `<div style="display:flex;align-items:flex-start;gap:8px;margin:3px 0;${indent}"><span style="color:#0d9488;font-size:1.1em;line-height:1.5;flex-shrink:0;">•</span><div>${innerHtml}${childrenHtml}</div></div>`;

    case 'numberedListItem': {
      const start = (props.start as number) ?? 1;
      return `<div style="display:flex;align-items:flex-start;gap:8px;margin:3px 0;${indent}"><span style="color:#0d9488;font-size:0.9em;line-height:1.6;flex-shrink:0;min-width:18px;">${start}.</span><div>${innerHtml}${childrenHtml}</div></div>`;
    }

    case 'checkListItem': {
      const checked = props.checked as boolean;
      const checkStyle = checked
        ? 'background:#0d9488;border-color:#0d9488;'
        : 'background:#fff;border-color:#cbd5e1;';
      const checkMark = checked ? '✓' : '';
      return `<div style="display:flex;align-items:flex-start;gap:8px;margin:3px 0;${indent}">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:3px;border:1.5px solid;flex-shrink:0;margin-top:3px;font-size:10px;color:#fff;${checkStyle}">${checkMark}</span>
        <div style="${checked ? 'text-decoration:line-through;color:#94a3b8;' : ''}">${innerHtml}${childrenHtml}</div>
      </div>`;
    }

    case 'code': {
      const code = escapeHtml(((content[0] as InlineContent)?.text) ?? '');
      return `<pre style="background:#1e293b;color:#e2e8f0;padding:14px 16px;border-radius:8px;font-family:monospace;font-size:0.82em;overflow:auto;margin:10px 0;white-space:pre-wrap;word-break:break-word;${indent}"><code>${code}</code></pre>${childrenHtml}`;
    }

    case 'image': {
      const url = (props.url as string) ?? '';
      const caption = (props.caption as string) ?? '';
      const resolvedUrl = imageMap.get(url) ?? url;
      if (!resolvedUrl) return childrenHtml;
      return `<div style="margin:12px 0;text-align:center;${indent}">
        <img src="${resolvedUrl}" alt="${escapeHtml(caption)}" style="max-width:100%;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.12);" />
        ${caption ? `<p style="font-size:0.78em;color:#64748b;margin-top:4px;">${escapeHtml(caption)}</p>` : ''}
      </div>${childrenHtml}`;
    }

    case 'table': {
      const tableContent = block.content as unknown as { type: 'tableContent'; rows: { cells: InlineContent[][] }[] };
      if (!tableContent || !tableContent.rows) return childrenHtml;
      const rows = tableContent.rows.map((row, rIdx) => {
        const cells = row.cells.map(cell => {
          const cellHtml = inlineToHtml(cell);
          const tag = rIdx === 0 ? 'th' : 'td';
          return `<${tag} style="border:1px solid #e2e8f0;padding:6px 10px;text-align:left;${rIdx === 0 ? 'background:#f8fafc;font-weight:600;' : ''}">${cellHtml}</${tag}>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<div style="overflow:auto;margin:10px 0;${indent}"><table style="border-collapse:collapse;width:100%;font-size:0.9em;">${rows}</table></div>${childrenHtml}`;
    }

    case 'paragraph':
    default: {
      if (!innerHtml && !childrenHtml) return '';
      return `<p style="margin:6px 0;line-height:1.7;color:#1e293b;${indent}">${innerHtml}</p>${childrenHtml}`;
    }
  }
}

// ─── Collect all image URLs from blocks ───────────────────────────────────────

function collectImageUrls(blocks: Block[]): string[] {
  const urls: string[] = [];
  for (const block of blocks) {
    if (block.type === 'image' && block.props?.url) {
      urls.push(block.props.url as string);
    }
    if (block.children?.length) {
      urls.push(...collectImageUrls(block.children));
    }
  }
  return urls;
}

// ─── Build PDF HTML document ─────────────────────────────────────────────────

function buildHtmlDocument(
  node: MindmapNode,
  nodeContent: NodeContent,
  mapTitle: string,
  parentLabel: string | undefined,
  richHtml: string
): string {
  const accentColor = node.color || '#0d9488';
  const keyPoints = nodeContent.keyPoints ?? [];
  const resources = nodeContent.resources ?? [];

  const keyPointsHtml = keyPoints.length > 0
    ? `<section style="margin-top:28px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;border-bottom:2px solid #f1f5f9;padding-bottom:8px;">
          <span style="width:4px;height:22px;border-radius:2px;background:${accentColor};flex-shrink:0;display:inline-block;"></span>
          <h2 style="margin:0;font-size:1.05em;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">Key Points</h2>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${keyPoints.map(kp => `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:#f8fafc;border-radius:6px;border-left:3px solid ${accentColor};">
              <span style="color:${accentColor};font-weight:700;font-size:0.85em;flex-shrink:0;padding-top:1px;">✦</span>
              <span style="color:#334155;line-height:1.6;font-size:0.92em;">${escapeHtml(kp.text)}</span>
            </div>`).join('')}
        </div>
      </section>`
    : '';

  const resourcesHtml = resources.length > 0
    ? `<section style="margin-top:28px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;border-bottom:2px solid #f1f5f9;padding-bottom:8px;">
          <span style="width:4px;height:22px;border-radius:2px;background:${accentColor};flex-shrink:0;display:inline-block;"></span>
          <h2 style="margin:0;font-size:1.05em;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">Resources</h2>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${resources.map(res => `
            <div style="padding:8px 14px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">
              <div style="font-weight:600;color:#0f172a;font-size:0.92em;">${escapeHtml(res.title)}</div>
              ${res.url ? `<a href="${res.url}" style="font-size:0.8em;color:#0d9488;text-decoration:none;word-break:break-all;">${escapeHtml(res.url)}</a>` : ''}
              ${res.note ? `<div style="font-size:0.82em;color:#64748b;margin-top:3px;">${escapeHtml(res.note)}</div>` : ''}
            </div>`).join('')}
        </div>
      </section>`
    : '';

  const breadcrumb = [mapTitle, parentLabel, node.label].filter(Boolean).join(' › ');
  const completedBadge = nodeContent.isCompleted
    ? `<span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:0.72em;font-weight:700;padding:2px 10px;border-radius:99px;border:1px solid #bbf7d0;letter-spacing:0.05em;text-transform:uppercase;">✓ Studied</span>`
    : '';

  const richSection = richHtml.trim()
    ? `<section style="margin-top:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;border-bottom:2px solid #f1f5f9;padding-bottom:8px;">
          <span style="width:4px;height:22px;border-radius:2px;background:${accentColor};flex-shrink:0;display:inline-block;"></span>
          <h2 style="margin:0;font-size:1.05em;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">Notes</h2>
        </div>
        <div style="color:#334155;line-height:1.7;font-size:0.92em;">${richHtml}</div>
      </section>`
    : '';

  const hasContent = richHtml.trim() || keyPoints.length > 0 || resources.length > 0;
  const emptyMessage = !hasContent
    ? `<p style="color:#94a3b8;font-style:italic;margin-top:24px;text-align:center;">No content added yet.</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
      font-size: 13px;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .page {
      padding: 36px 40px 48px;
      max-width: 800px;
    }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div style="border-left:5px solid ${accentColor};padding-left:16px;margin-bottom:8px;">
    <div style="font-size:0.72em;color:#94a3b8;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(breadcrumb)}</div>
    <h1 style="margin:0;font-size:1.9em;font-weight:800;color:#0f172a;line-height:1.2;letter-spacing:-0.01em;">
      ${node.emoji ? `${node.emoji} ` : ''}${escapeHtml(node.label)}
    </h1>
    <div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
      ${completedBadge}
      <span style="font-size:0.72em;color:#94a3b8;font-weight:500;">Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
    </div>
  </div>

  <hr style="border:none;border-top:1.5px solid #f1f5f9;margin:20px 0;" />

  ${richSection}
  ${keyPointsHtml}
  ${resourcesHtml}
  ${emptyMessage}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:14px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:0.7em;color:#cbd5e1;font-weight:500;">${escapeHtml(mapTitle)}</span>
    <span style="font-size:0.7em;color:#cbd5e1;font-weight:500;">MindMap Study Tool</span>
  </div>
</div>
</body>
</html>`;
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function exportBranchToPdf(
  node: MindmapNode,
  nodeContent: NodeContent,
  mapTitle: string,
  parentLabel?: string
): Promise<void> {
  const blocks = (nodeContent.richContent ?? []) as Block[];

  // 1. Collect and pre-fetch all images
  const imageUrls = collectImageUrls(blocks);
  const imageMap = new Map<string, string>();
  await Promise.all(
    imageUrls.map(async url => {
      const dataUrl = await fetchImageAsDataUrl(url);
      imageMap.set(url, dataUrl);
    })
  );

  // 2. Convert BlockNote blocks to HTML
  const richHtml = blocks.map(b => blockToHtml(b, imageMap)).join('');

  // 3. Build full HTML document string
  const htmlString = buildHtmlDocument(node, nodeContent, mapTitle, parentLabel, richHtml);

  // 4. Render to off-screen iframe (for full CSS support)
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:1px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument!;
  iframeDoc.open();
  iframeDoc.write(htmlString);
  iframeDoc.close();

  // Wait for images to load
  await new Promise<void>(resolve => {
    const imgs = iframeDoc.querySelectorAll('img');
    if (imgs.length === 0) {
      resolve();
      return;
    }
    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded >= imgs.length) resolve();
    };
    imgs.forEach(img => {
      if (img.complete) {
        loaded++;
      } else {
        img.addEventListener('load', onLoad);
        img.addEventListener('error', onLoad);
      }
    });
    if (loaded >= imgs.length) resolve();
  });

  // Give layout a moment to settle
  await new Promise(r => setTimeout(r, 200));

  const pageEl = iframeDoc.querySelector('.page') as HTMLElement;
  const renderTarget = pageEl ?? iframeDoc.body;

  // Expand iframe height to match content
  iframe.style.height = `${renderTarget.scrollHeight + 20}px`;

  // 5. Capture with html2canvas
  const canvas = await html2canvas(renderTarget, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    windowWidth: 800,
    logging: false,
  });

  document.body.removeChild(iframe);

  // 6. Build jsPDF and paginate
  const pdfWidth = 210; // A4 mm
  const pdfHeight = 297; // A4 mm
  const margin = 10; // mm

  const usableWidth = pdfWidth - margin * 2;
  const pixelsPerMm = canvas.width / usableWidth;
  const usableHeightPx = (pdfHeight - margin * 2) * pixelsPerMm;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const totalPages = Math.ceil(canvas.height / usableHeightPx);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    const srcY = page * usableHeightPx;
    const srcH = Math.min(usableHeightPx, canvas.height - srcY);

    // Slice the canvas for this page
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = srcH;
    const ctx = pageCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    const pageImgData = pageCanvas.toDataURL('image/png');
    const imgHeightMm = (srcH / pixelsPerMm);

    pdf.addImage(pageImgData, 'PNG', margin, margin, usableWidth, imgHeightMm);
  }

  // 7. Add document metadata
  pdf.setProperties({
    title: node.label,
    subject: `${mapTitle} › ${node.label}`,
    creator: 'MindMap Study Tool',
  });

  // 8. Download
  const fileName = `${node.label.replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-')}.pdf`;
  pdf.save(fileName);
}
