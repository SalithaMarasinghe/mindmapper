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
  content?: InlineContent[] | Block[] | unknown;
  children?: Block[];
}

// ─── HTML escape ──────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
    return url;
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
    if (s.code)      html = `<code style="font-family:'Courier New',monospace;background:#e8f4f8;color:#0f4c75;padding:1px 5px;border-radius:3px;font-size:0.85em;border:1px solid #b8d9ed;">${html}</code>`;
    if (s.bold)      html = `<strong>${html}</strong>`;
    if (s.italic)    html = `<em>${html}</em>`;
    if (s.underline) html = `<u>${html}</u>`;
    if (s.strike)    html = `<s>${html}</s>`;
    return html;
  }).join('');
}

// ─── Syntax highlighting for code blocks ─────────────────────────────────────
// Lightweight token-based highlighter for Python and SQL

const pythonKeywords = new Set([
  'False','None','True','and','as','assert','async','await','break','class',
  'continue','def','del','elif','else','except','finally','for','from',
  'global','if','import','in','is','lambda','nonlocal','not','or','pass',
  'raise','return','try','while','with','yield','print','range','len',
  'type','self','super','int','str','float','list','dict','set','tuple',
  'bool','object','open','input','print','isinstance','hasattr','getattr',
]);

const sqlKeywords = new Set([
  'SELECT','FROM','WHERE','JOIN','LEFT','RIGHT','INNER','OUTER','FULL',
  'ON','AND','OR','NOT','IN','EXISTS','BETWEEN','LIKE','IS','NULL',
  'INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE',
  'DROP','ALTER','ADD','COLUMN','INDEX','VIEW','DATABASE','SCHEMA',
  'GROUP','BY','ORDER','HAVING','LIMIT','OFFSET','UNION','ALL',
  'DISTINCT','AS','CASE','WHEN','THEN','ELSE','END','WITH','CTE',
  'COALESCE','NULLIF','CAST','CONVERT','COUNT','SUM','AVG','MIN','MAX',
  'PRIMARY','KEY','FOREIGN','REFERENCES','CONSTRAINT','DEFAULT','UNIQUE',
  'TRUNCATE','COMMIT','ROLLBACK','TRANSACTION','BEGIN','EXPLAIN',
]);

interface Token { type: 'keyword'|'string'|'comment'|'number'|'builtin'|'operator'|'plain'; value: string; }

function tokenizePython(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    // Comment
    if (code[i] === '#') {
      let j = i;
      while (j < code.length && code[j] !== '\n') j++;
      tokens.push({ type: 'comment', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // Triple-quoted string
    if (code.startsWith('"""', i) || code.startsWith("'''", i)) {
      const q = code.slice(i, i + 3);
      let j = i + 3;
      while (j < code.length && !code.startsWith(q, j)) j++;
      j += 3;
      tokens.push({ type: 'string', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // Single-quoted string
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== q && code[j] !== '\n') {
        if (code[j] === '\\') j++;
        j++;
      }
      j++;
      tokens.push({ type: 'string', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // Number
    if (/[0-9]/.test(code[i]) || (code[i] === '.' && /[0-9]/.test(code[i+1] ?? ''))) {
      let j = i;
      while (j < code.length && /[0-9._xXa-fA-FoObB]/.test(code[j])) j++;
      tokens.push({ type: 'number', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // Identifier or keyword
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      tokens.push({ type: pythonKeywords.has(word) ? 'keyword' : 'plain', value: word });
      i = j;
      continue;
    }
    // Operator
    if (/[+\-*/%=<>!&|^~@]/.test(code[i])) {
      tokens.push({ type: 'operator', value: code[i] });
      i++;
      continue;
    }
    tokens.push({ type: 'plain', value: code[i] });
    i++;
  }
  return tokens;
}

function tokenizeSQL(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    // Line comment
    if (code.startsWith('--', i)) {
      let j = i;
      while (j < code.length && code[j] !== '\n') j++;
      tokens.push({ type: 'comment', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // Block comment
    if (code.startsWith('/*', i)) {
      const j = code.indexOf('*/', i + 2);
      const end = j === -1 ? code.length : j + 2;
      tokens.push({ type: 'comment', value: code.slice(i, end) });
      i = end;
      continue;
    }
    // String (single-quoted)
    if (code[i] === "'") {
      let j = i + 1;
      while (j < code.length && !(code[j] === "'" && code[j-1] !== '\\')) j++;
      j++;
      tokens.push({ type: 'string', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // Number
    if (/[0-9]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[0-9.]/.test(code[j])) j++;
      tokens.push({ type: 'number', value: code.slice(i, j) });
      i = j;
      continue;
    }
    // Identifier / keyword
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      tokens.push({ type: sqlKeywords.has(word.toUpperCase()) ? 'keyword' : 'plain', value: word });
      i = j;
      continue;
    }
    tokens.push({ type: 'plain', value: code[i] });
    i++;
  }
  return tokens;
}

// PDF-safe syntax colour palette (light bg, WCAG-readable colours)
const SYNTAX_COLORS: Record<Token['type'], string> = {
  keyword:  '#7c3aed',  // violet
  string:   '#16a34a',  // green
  comment:  '#6b7280',  // gray (italic)
  number:   '#d97706',  // amber
  builtin:  '#0891b2',  // cyan
  operator: '#b45309',  // dark amber
  plain:    '#1e293b',  // near-black
};

function renderTokens(tokens: Token[]): string {
  return tokens.map(t => {
    const escaped = escapeHtml(t.value);
    const color = SYNTAX_COLORS[t.type];
    const italic = t.type === 'comment' ? 'font-style:italic;' : '';
    const bold = t.type === 'keyword' ? 'font-weight:700;' : '';
    return `<span style="color:${color};${italic}${bold}">${escaped}</span>`;
  }).join('');
}

function highlightCode(code: string, language: string): string {
  const lang = (language ?? '').toLowerCase();
  if (lang === 'python' || lang === 'py' || lang === 'python3') {
    return renderTokens(tokenizePython(code));
  }
  if (lang === 'sql') {
    return renderTokens(tokenizeSQL(code));
  }
  // Fallback: plain escaped
  return escapeHtml(code);
}

// ─── Block → HTML ─────────────────────────────────────────────────────────────

function blockToHtml(block: Block, imageMap: Map<string, string>, depth = 0): string {
  const rawContent = block.content;
  const children = block.children ?? [];
  const props = block.props ?? {};
  const indent = depth > 0 ? `margin-left:${depth * 20}px;` : '';

  // Determine if content is an array of inline items
  const contentArr = Array.isArray(rawContent) ? rawContent : [];
  const isInlineArray =
    contentArr.length === 0 ||
    (contentArr[0] &&
      typeof contentArr[0] === 'object' &&
      'type' in (contentArr[0] as object) &&
      ((contentArr[0] as InlineContent).type === 'text' ||
        (contentArr[0] as InlineContent).type === 'link'));

  const innerHtml = isInlineArray ? inlineToHtml(contentArr as InlineContent[]) : '';
  const childrenHtml = children.map(c => blockToHtml(c, imageMap, depth + 1)).join('');

  switch (block.type) {
    // ── Headings ──────────────────────────────────────────────────────────────
    case 'heading': {
      const level = (props.level as number) ?? 1;
      const color = props.textColor && props.textColor !== 'default' ? `color:${props.textColor};` : '';
      const sizes: Record<number, string> = { 1: '1.7em', 2: '1.35em', 3: '1.1em' };
      const margins: Record<number, string> = { 1: '28px 0 10px', 2: '22px 0 8px', 3: '18px 0 5px' };
      const borders: Record<number, string> = {
        1: 'border-bottom:2px solid #e2e8f0;padding-bottom:6px;',
        2: 'border-bottom:1px solid #f1f5f9;padding-bottom:4px;',
        3: '',
      };
      return `<h${level} style="font-size:${sizes[level] ?? '1.1em'};font-weight:700;margin:${margins[level] ?? '14px 0 4px'};${color}${borders[level] ?? ''}${indent}">${innerHtml}</h${level}>${childrenHtml}`;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────────
    case 'paragraph': {
      if (!innerHtml && !childrenHtml) return '';
      const textAlign = (props.textAlignment as string) ?? 'left';
      const color = props.textColor && props.textColor !== 'default' ? `color:${props.textColor};` : '';
      const bg = props.backgroundColor && props.backgroundColor !== 'default' ? `background:${props.backgroundColor};padding:2px 6px;border-radius:3px;` : '';
      return `<p style="margin:6px 0;line-height:1.75;color:#1e293b;text-align:${textAlign};${color}${bg}${indent}">${innerHtml}</p>${childrenHtml}`;
    }

    // ── Lists ─────────────────────────────────────────────────────────────────
    case 'bulletListItem':
      return `<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;${indent}"><span style="color:#0d9488;font-size:1.2em;line-height:1.5;flex-shrink:0;margin-top:1px;">•</span><div style="flex:1;line-height:1.7;color:#1e293b;">${innerHtml}${childrenHtml}</div></div>`;

    case 'numberedListItem': {
      // BlockNote stores the actual rendered number in props.start when multiple items exist
      const num = (props.start as number) ?? 1;
      return `<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;${indent}"><span style="color:#0d9488;font-size:0.9em;line-height:1.7;flex-shrink:0;min-width:20px;font-weight:600;">${num}.</span><div style="flex:1;line-height:1.7;color:#1e293b;">${innerHtml}${childrenHtml}</div></div>`;
    }

    case 'checkListItem': {
      const checked = !!props.checked;
      const boxStyle = checked
        ? 'background:#0d9488;border-color:#0d9488;'
        : 'background:#fff;border-color:#cbd5e1;';
      return `<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;${indent}">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:3px;border:1.5px solid;flex-shrink:0;margin-top:3px;font-size:9px;color:#fff;${boxStyle}">${checked ? '✓' : ''}</span>
        <div style="flex:1;${checked ? 'text-decoration:line-through;color:#94a3b8;' : 'color:#1e293b;'}line-height:1.7;">${innerHtml}${childrenHtml}</div>
      </div>`;
    }

    // ── Code block (the main fix) ─────────────────────────────────────────────
    case 'codeBlock': {
      // BlockNote's @blocknote/code-block stores the code text inside the content array
      const language = (props.language as string) ?? 'python';
      // Extract raw text from content (may be InlineContent[] or plain string)
      let rawCode = '';
      if (Array.isArray(rawContent)) {
        rawCode = (rawContent as InlineContent[]).map(item => item.text ?? '').join('');
      } else if (typeof rawContent === 'string') {
        rawCode = rawContent;
      }
      const highlighted = highlightCode(rawCode, language);
      const langLabel = language.charAt(0).toUpperCase() + language.slice(1);
      return `<div style="margin:14px 0;${indent}">
        <div style="display:flex;align-items:center;justify-content:space-between;background:#e8f4f8;border:1px solid #b8d9ed;border-bottom:none;border-radius:8px 8px 0 0;padding:5px 14px;">
          <span style="font-size:0.72em;font-weight:700;color:#0f4c75;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(langLabel)}</span>
        </div>
        <pre style="background:#f0f7fb;border:1px solid #b8d9ed;border-radius:0 0 8px 8px;padding:14px 16px;font-family:'Courier New',Courier,monospace;font-size:0.82em;line-height:1.65;overflow:auto;margin:0;white-space:pre-wrap;word-break:break-word;">${highlighted}</pre>
      </div>${childrenHtml}`;
    }

    // ── Legacy inline code block (type 'code') ────────────────────────────────
    case 'code': {
      const rawCode = ((contentArr[0] as InlineContent)?.text) ?? '';
      return `<pre style="background:#f0f7fb;border:1px solid #b8d9ed;border-radius:8px;padding:14px 16px;font-family:'Courier New',Courier,monospace;font-size:0.82em;line-height:1.65;overflow:auto;margin:12px 0;white-space:pre-wrap;word-break:break-word;${indent}"><code style="color:#1e293b;">${escapeHtml(rawCode)}</code></pre>${childrenHtml}`;
    }

    // ── Quote / callout ───────────────────────────────────────────────────────
    case 'quote':
    case 'blockquote':
      return `<blockquote style="border-left:4px solid #0d9488;background:#f0fdf9;margin:10px 0;padding:10px 16px;border-radius:0 6px 6px 0;color:#134e4a;font-style:italic;${indent}">${innerHtml}${childrenHtml}</blockquote>`;

    case 'callout': {
      const emoji = (props.emoji as string) ?? 'ℹ️';
      return `<div style="display:flex;gap:12px;background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:10px 0;${indent}">
        <span style="font-size:1.2em;flex-shrink:0;">${emoji}</span>
        <div style="color:#334155;line-height:1.7;">${innerHtml}${childrenHtml}</div>
      </div>`;
    }

    // ── Divider ───────────────────────────────────────────────────────────────
    case 'horizontalRule':
    case 'divider':
      return `<hr style="border:none;border-top:1.5px solid #e2e8f0;margin:18px 0;" />${childrenHtml}`;

    // ── Image ─────────────────────────────────────────────────────────────────
    case 'image': {
      const url = (props.url as string) ?? '';
      const caption = (props.caption as string) ?? '';
      const resolvedUrl = imageMap.get(url) ?? url;
      if (!resolvedUrl) return childrenHtml;
      return `<div style="margin:14px 0;text-align:center;${indent}">
        <img src="${resolvedUrl}" alt="${escapeHtml(caption)}" style="max-width:100%;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.12);" />
        ${caption ? `<p style="font-size:0.78em;color:#64748b;margin-top:6px;">${escapeHtml(caption)}</p>` : ''}
      </div>${childrenHtml}`;
    }

    // ── Table ─────────────────────────────────────────────────────────────────
    case 'table': {
      const tableContent = block.content as unknown as { type: 'tableContent'; rows: { cells: InlineContent[][] }[] };
      if (!tableContent?.rows) return childrenHtml;
      const rows = tableContent.rows.map((row, rIdx) => {
        const cells = row.cells.map(cell => {
          const cellHtml = inlineToHtml(cell);
          const tag = rIdx === 0 ? 'th' : 'td';
          const isHeader = rIdx === 0;
          return `<${tag} style="border:1px solid #e2e8f0;padding:8px 12px;text-align:left;${isHeader ? 'background:#f8fafc;font-weight:700;color:#0f172a;' : 'color:#334155;'}">${cellHtml}</${tag}>`;
        }).join('');
        const rowBg = rIdx % 2 === 1 ? 'background:#fafafa;' : '';
        return `<tr style="${rowBg}">${cells}</tr>`;
      }).join('');
      return `<div style="overflow:auto;margin:14px 0;${indent}"><table style="border-collapse:collapse;width:100%;font-size:0.9em;">${rows}</table></div>${childrenHtml}`;
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    default: {
      if (!innerHtml && !childrenHtml) return '';
      return `<p style="margin:6px 0;line-height:1.75;color:#1e293b;${indent}">${innerHtml}</p>${childrenHtml}`;
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
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">
          <span style="width:4px;height:22px;border-radius:2px;background:${accentColor};flex-shrink:0;display:inline-block;"></span>
          <h2 style="margin:0;font-size:1.05em;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">Key Points</h2>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${keyPoints.map(kp => `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:#f8fafc;border-radius:6px;border-left:3px solid ${accentColor};">
              <span style="color:${accentColor};font-weight:700;font-size:0.85em;flex-shrink:0;padding-top:2px;">✦</span>
              <span style="color:#334155;line-height:1.6;font-size:0.92em;">${escapeHtml(kp.text)}</span>
            </div>`).join('')}
        </div>
      </section>`
    : '';

  const resourcesHtml = resources.length > 0
    ? `<section style="margin-top:28px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">
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
        <div style="color:#1e293b;line-height:1.75;">${richHtml}</div>
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
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
      font-size: 13px;
      color: #1e293b;
      background: #ffffff;
    }
    .page {
      padding: 40px 48px 56px;
      max-width: 820px;
    }
    h1,h2,h3,h4,h5,h6 { font-weight: 700; color: #0f172a; }
    pre { font-family: 'Courier New', Courier, monospace; }
    code { font-family: 'Courier New', Courier, monospace; }
    table { border-collapse: collapse; }
    a { color: #0d9488; }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div style="border-left:5px solid ${accentColor};padding-left:18px;margin-bottom:10px;">
    <div style="font-size:0.7em;color:#94a3b8;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:5px;">${escapeHtml(breadcrumb)}</div>
    <h1 style="font-size:2em;font-weight:800;color:#0f172a;line-height:1.2;letter-spacing:-0.01em;">
      ${node.emoji ? `${node.emoji} ` : ''}${escapeHtml(node.label)}
    </h1>
    <div style="margin-top:10px;display:flex;align-items:center;gap:8px;">
      ${completedBadge}
      <span style="font-size:0.7em;color:#94a3b8;font-weight:500;">Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
    </div>
  </div>

  <hr style="border:none;border-top:1.5px solid #e2e8f0;margin:20px 0;" />

  ${richSection}
  ${keyPointsHtml}
  ${resourcesHtml}
  ${emptyMessage}

  <!-- Footer -->
  <div style="margin-top:48px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
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

  // 2. Convert BlockNote blocks → HTML
  const richHtml = blocks.map(b => blockToHtml(b, imageMap)).join('');

  // 3. Build full HTML document string
  const htmlString = buildHtmlDocument(node, nodeContent, mapTitle, parentLabel, richHtml);

  // 4. Render to off-screen iframe for full CSS
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:820px;height:1px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument!;
  iframeDoc.open();
  iframeDoc.write(htmlString);
  iframeDoc.close();

  // Wait for images to load
  await new Promise<void>(resolve => {
    const imgs = iframeDoc.querySelectorAll('img');
    if (imgs.length === 0) { resolve(); return; }
    let loaded = 0;
    const onLoad = () => { if (++loaded >= imgs.length) resolve(); };
    imgs.forEach(img => {
      if (img.complete) loaded++;
      else { img.addEventListener('load', onLoad); img.addEventListener('error', onLoad); }
    });
    if (loaded >= imgs.length) resolve();
  });

  // Give layout time to settle
  await new Promise(r => setTimeout(r, 300));

  const pageEl = iframeDoc.querySelector('.page') as HTMLElement;
  const renderTarget = pageEl ?? iframeDoc.body;

  // Expand iframe to full content height
  iframe.style.height = `${renderTarget.scrollHeight + 40}px`;
  await new Promise(r => setTimeout(r, 100));

  // 5. Capture with html2canvas
  const canvas = await html2canvas(renderTarget, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    windowWidth: 820,
    logging: false,
  });

  document.body.removeChild(iframe);

  // 6. Build jsPDF and paginate
  const pdfWidth = 210;  // A4 mm
  const pdfHeight = 297; // A4 mm
  const margin = 10;     // mm

  const usableWidth = pdfWidth - margin * 2;
  const pixelsPerMm = canvas.width / usableWidth;
  const usableHeightPx = (pdfHeight - margin * 2) * pixelsPerMm;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const totalPages = Math.ceil(canvas.height / usableHeightPx);
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    const srcY = page * usableHeightPx;
    const srcH = Math.min(usableHeightPx, canvas.height - srcY);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = srcH;
    const ctx = pageCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    const imgHeightMm = srcH / pixelsPerMm;
    pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, usableWidth, imgHeightMm);
  }

  pdf.setProperties({
    title: node.label,
    subject: `${mapTitle} › ${node.label}`,
    creator: 'MindMap Study Tool',
  });

  const fileName = `${node.label.replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-')}.pdf`;
  pdf.save(fileName);
}
