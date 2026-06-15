import type { MindmapNode, NodeContent } from '../types';

// ── BlockNote content types (mirrored from exportBranchToPdf) ─────────────────
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

// ── Inline helpers ─────────────────────────────────────────────────────────────
function getInlines(block: Block): InlineContent[] {
  const raw = block.content;
  if (!Array.isArray(raw)) return [];
  const first = raw[0] as InlineContent | undefined;
  if (!first) return [];
  if (first.type === 'text' || first.type === 'link') return raw as InlineContent[];
  return [];
}

function inlineToMd(items: InlineContent[]): string {
  return items.map((it) => {
    if (it.type === 'link') {
      const txt = it.content ? inlineToMd(it.content) : (it.text ?? '');
      const href = it.href ?? '';
      return href ? `[${txt}](${href})` : txt;
    }
    let txt = it.text ?? '';
    const s = it.styles ?? {};
    if (s.code) return `\`${txt}\``;
    if (s.bold && s.italic) return `***${txt}***`;
    if (s.bold) return `**${txt}**`;
    if (s.italic) return `*${txt}*`;
    if (s.strike) return `~~${txt}~~`;
    return txt;
  }).join('');
}

// ── Table helpers ──────────────────────────────────────────────────────────────
interface TableRow { cells: InlineContent[][]; }

function getTableRows(block: Block): TableRow[] {
  const content = block.content as { type: string; rows?: { cells: { content: InlineContent[] }[][] }[] } | undefined;
  if (!content || !Array.isArray(content.rows)) return [];
  return content.rows.map((r) => ({
    cells: r.cells.map((cell: { content: InlineContent[] }[]) =>
      Array.isArray(cell) ? (cell as { content: InlineContent[] }[]).flatMap(c => c.content ?? []) : (cell as unknown as { content: InlineContent[] }).content ?? []
    ),
  }));
}

function flatInlineText(items: InlineContent[]): string {
  return items.map(it =>
    it.type === 'link'
      ? (it.content ? flatInlineText(it.content) : (it.text ?? ''))
      : (it.text ?? '')
  ).join('');
}

// ── Block → Markdown ───────────────────────────────────────────────────────────
function blockToMd(block: Block, depth = 0): string {
  const props = block.props ?? {};
  const items = getInlines(block);
  const children = block.children ?? [];
  const indent = '  '.repeat(depth);

  switch (block.type) {

    case 'heading': {
      const level = (props.level as number) ?? 1;
      const hashes = '#'.repeat(Math.min(level, 6));
      const childrenMd = children.map(c => blockToMd(c, depth)).join('\n');
      return `${hashes} ${inlineToMd(items)}\n${childrenMd}`;
    }

    case 'paragraph': {
      if (items.length === 0) return '';
      const childrenMd = children.map(c => blockToMd(c, depth)).join('\n');
      return `${inlineToMd(items)}\n${childrenMd}`;
    }

    case 'bulletListItem': {
      const line = `${indent}- ${inlineToMd(items)}`;
      const childrenMd = children.map(c => blockToMd(c, depth + 1)).join('\n');
      return childrenMd ? `${line}\n${childrenMd}` : line;
    }

    case 'numberedListItem': {
      const num = (props.start as number) ?? 1;
      const line = `${indent}${num}. ${inlineToMd(items)}`;
      const childrenMd = children.map(c => blockToMd(c, depth + 1)).join('\n');
      return childrenMd ? `${line}\n${childrenMd}` : line;
    }

    case 'checkListItem': {
      const checked = !!props.checked;
      const marker = checked ? '[x]' : '[ ]';
      const line = `${indent}- ${marker} ${inlineToMd(items)}`;
      const childrenMd = children.map(c => blockToMd(c, depth + 1)).join('\n');
      return childrenMd ? `${line}\n${childrenMd}` : line;
    }

    case 'codeBlock': {
      const lang = ((props.language as string) ?? 'python').toLowerCase();
      let code = '';
      if (Array.isArray(block.content)) {
        code = (block.content as InlineContent[]).map(it => it.text ?? '').join('');
      } else if (typeof block.content === 'string') {
        code = block.content as string;
      }
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case 'table': {
      const rows = getTableRows(block);
      if (!rows.length) return '';
      const lines: string[] = [];
      rows.forEach((row, ri) => {
        const cells = row.cells.map(c => flatInlineText(c).replace(/\|/g, '\\|'));
        lines.push(`| ${cells.join(' | ')} |`);
        if (ri === 0) {
          lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
        }
      });
      return lines.join('\n');
    }

    case 'quote':
    case 'blockquote': {
      const txt = inlineToMd(items);
      const quoted = txt.split('\n').map(l => `> ${l}`).join('\n');
      const childrenMd = children.map(c => blockToMd(c, depth)).join('\n');
      return childrenMd ? `${quoted}\n${childrenMd}` : quoted;
    }

    case 'horizontalRule':
    case 'divider':
      return '---';

    case 'image': {
      const url = (props.url as string) ?? '';
      const caption = (props.caption as string) ?? '';
      if (!url) return '';
      return caption ? `![${caption}](${url})` : `![image](${url})`;
    }

    default: {
      if (items.length > 0) return inlineToMd(items);
      const childrenMd = children.map(c => blockToMd(c, depth)).join('\n');
      return childrenMd;
    }
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export function exportBranchToMarkdown(
  node: MindmapNode,
  nodeContent: NodeContent,
  mapTitle: string,
  parentLabel?: string,
): void {
  const blocks = (nodeContent.richContent ?? []) as Block[];

  const lines: string[] = [];

  // ── Front matter / title ───────────────────────────────────────────────────
  const crumbs = [mapTitle, parentLabel, node.label].filter(Boolean).join(' > ');
  lines.push(`# ${node.label}`);
  lines.push('');
  lines.push(`> **Map:** ${crumbs}`);
  lines.push(`> **Exported:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  if (nodeContent.isCompleted) lines.push(`> **Status:** Studied ✓`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Rich content ───────────────────────────────────────────────────────────
  for (const block of blocks) {
    const md = blockToMd(block);
    if (md.trim()) {
      lines.push(md);
      lines.push('');
    }
  }

  // ── Key points ─────────────────────────────────────────────────────────────
  if (nodeContent.keyPoints?.length) {
    lines.push('---');
    lines.push('');
    lines.push('## Key Points');
    lines.push('');
    for (const kp of nodeContent.keyPoints) {
      lines.push(`- ${kp.text}`);
    }
    lines.push('');
  }

  // ── Resources ──────────────────────────────────────────────────────────────
  if (nodeContent.resources?.length) {
    lines.push('---');
    lines.push('');
    lines.push('## Resources');
    lines.push('');
    for (const res of nodeContent.resources) {
      if (res.url) {
        lines.push(`- [${res.title}](${res.url})${res.note ? ` — ${res.note}` : ''}`);
      } else {
        lines.push(`- **${res.title}**${res.note ? ` — ${res.note}` : ''}`);
      }
    }
    lines.push('');
  }

  // ── Download ───────────────────────────────────────────────────────────────
  const markdown = lines.join('\n');
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${node.label.replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-') || 'export'}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
