import jsPDF from 'jspdf';
import type { MindmapNode, NodeContent } from '../types';

// ── BlockNote content types ────────────────────────────────────────────────────
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

// ── Pre-fetched image cache ─────────────────────────────────────────────────────────
interface ImgData { dataUrl: string; width: number; height: number; }

async function fetchAndConvertImage(url: string): Promise<ImgData | null> {
  try {
    return await new Promise<ImgData>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Scale down to max 1400px wide so embedded images don't bloat the PDF
        const MAX_PX = 1400;
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > MAX_PX) { h = Math.round(h * MAX_PX / w); w = MAX_PX; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        // Use JPEG (quality 0.82) for photos; jsPDF handles it natively
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ dataUrl, width: w, height: h });
      };
      img.onerror = () => reject(new Error('load failed'));
      // Try with the URL directly; CORS headers from Supabase storage should allow this
      img.src = url;
    });
  } catch {
    return null;
  }
}

function collectImageUrls(blocks: Block[]): string[] {
  const urls: string[] = [];
  for (const b of blocks) {
    if (b.type === 'image' && b.props?.url) urls.push(b.props.url as string);
    if (b.children?.length) urls.push(...collectImageUrls(b.children));
  }
  return urls;
}

// ── Page layout (mm) ──────────────────────────────────────────────────────────
const PW = 210;           // A4 width
const PH = 297;           // A4 height
const MX = 18;            // horizontal margin
const MY = 18;            // vertical margin
const CW = PW - MX * 2;  // 174mm content width

// ── Colours ───────────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  text:    [30,  41,  59]  as RGB,
  heading: [15,  23,  42]  as RGB,
  muted:   [100, 116, 139] as RGB,
  border:  [226, 232, 240] as RGB,
  codeBg:  [240, 247, 251] as RGB,
  codeBar: [216, 234, 244] as RGB,
  codeBrd: [184, 217, 237] as RGB,
  tblHead: [248, 250, 252] as RGB,
  tblBrd:  [226, 232, 240] as RGB,
  altRow:  [250, 250, 250] as RGB,
  quote:   [240, 253, 250] as RGB,
  // Syntax colours
  kw:  [124,  58, 237] as RGB,
  str: [ 22, 163,  74] as RGB,
  cmt: [107, 114, 128] as RGB,
  num: [217, 119,   6] as RGB,
  op:  [180,  83,   9] as RGB,
};

// ── Render context ────────────────────────────────────────────────────────────
interface Ctx {
  pdf: jsPDF;
  y: number;            // current Y (baseline for text in jsPDF)
  accent: RGB;
}

function newPage(ctx: Ctx): void {
  ctx.pdf.addPage();
  ctx.y = MY + 4;
}

/** Ensure there is at least `need` mm before the bottom margin; if not, new page. */
function guard(ctx: Ctx, need: number): void {
  if (ctx.y + need > PH - MY) newPage(ctx);
}

// ── Tokeniser ─────────────────────────────────────────────────────────────────
type TokKind = 'kw' | 'str' | 'cmt' | 'num' | 'op' | 'plain';
interface Tok { k: TokKind; v: string; }

const PY_KW = new Set([
  'False','None','True','and','as','assert','async','await','break','class',
  'continue','def','del','elif','else','except','finally','for','from','global',
  'if','import','in','is','lambda','nonlocal','not','or','pass','raise','return',
  'try','while','with','yield','self','super','print','range','len','type',
  'int','str','float','list','dict','set','tuple','bool',
]);

const SQL_KW = new Set([
  'SELECT','FROM','WHERE','JOIN','LEFT','RIGHT','INNER','OUTER','ON','AND','OR',
  'NOT','IN','IS','NULL','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE',
  'TABLE','DROP','ALTER','VIEW','GROUP','BY','ORDER','HAVING','LIMIT','OFFSET',
  'UNION','ALL','DISTINCT','AS','CASE','WHEN','THEN','ELSE','END','WITH',
  'COUNT','SUM','AVG','MIN','MAX','PRIMARY','KEY','FOREIGN','DEFAULT','UNIQUE',
  'COALESCE','CAST','NULLIF','EXISTS','BETWEEN','LIKE','COMMIT','ROLLBACK',
]);

function tokenizePython(code: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < code.length) {
    if (code[i] === '#') {
      let j = i; while (j < code.length && code[j] !== '\n') j++;
      toks.push({ k: 'cmt', v: code.slice(i, j) }); i = j; continue;
    }
    if (code.startsWith('"""', i) || code.startsWith("'''", i)) {
      const q = code.slice(i, i + 3); let j = i + 3;
      while (j < code.length && !code.startsWith(q, j)) j++;
      j += 3; toks.push({ k: 'str', v: code.slice(i, j) }); i = j; continue;
    }
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i]; let j = i + 1;
      while (j < code.length && code[j] !== q && code[j] !== '\n') { if (code[j] === '\\') j++; j++; }
      j++; toks.push({ k: 'str', v: code.slice(i, j) }); i = j; continue;
    }
    if (/[0-9]/.test(code[i])) {
      let j = i; while (j < code.length && /[0-9._xXa-fA-F]/.test(code[j])) j++;
      toks.push({ k: 'num', v: code.slice(i, j) }); i = j; continue;
    }
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i; while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      const w = code.slice(i, j);
      toks.push({ k: PY_KW.has(w) ? 'kw' : 'plain', v: w }); i = j; continue;
    }
    if (/[+\-*/%=<>!&|^~@]/.test(code[i])) {
      toks.push({ k: 'op', v: code[i] }); i++; continue;
    }
    toks.push({ k: 'plain', v: code[i] }); i++;
  }
  return toks;
}

function tokenizeSQL(code: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < code.length) {
    if (code.startsWith('--', i)) {
      let j = i; while (j < code.length && code[j] !== '\n') j++;
      toks.push({ k: 'cmt', v: code.slice(i, j) }); i = j; continue;
    }
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      const j = end === -1 ? code.length : end + 2;
      toks.push({ k: 'cmt', v: code.slice(i, j) }); i = j; continue;
    }
    if (code[i] === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== "'") { if (code[j] === '\\') j++; j++; }
      j++; toks.push({ k: 'str', v: code.slice(i, j) }); i = j; continue;
    }
    if (/[0-9]/.test(code[i])) {
      let j = i; while (j < code.length && /[0-9.]/.test(code[j])) j++;
      toks.push({ k: 'num', v: code.slice(i, j) }); i = j; continue;
    }
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i; while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      const w = code.slice(i, j);
      toks.push({ k: SQL_KW.has(w.toUpperCase()) ? 'kw' : 'plain', v: w }); i = j; continue;
    }
    toks.push({ k: 'plain', v: code[i] }); i++;
  }
  return toks;
}

// ── Inline content helpers ────────────────────────────────────────────────────
function flatText(items: InlineContent[]): string {
  return items.map(it =>
    it.type === 'link'
      ? (it.content ? flatText(it.content) : (it.text ?? ''))
      : (it.text ?? '')
  ).join('');
}

interface Segment {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  link: boolean;
}

function toSegments(items: InlineContent[]): Segment[] {
  return items.flatMap((it): Segment[] => {
    if (it.type === 'link') {
      const inner = it.content ? flatText(it.content) : (it.text ?? '');
      return inner ? [{ text: inner, bold: false, italic: false, code: false, link: true }] : [];
    }
    const s = it.styles ?? {};
    const txt = it.text ?? '';
    if (!txt) return [];
    return [{ text: txt, bold: !!s.bold, italic: !!s.italic, code: !!s.code, link: false }];
  });
}

// Apply font from segment styles to the current jsPDF instance
function applySegFont(pdf: jsPDF, seg: Segment, baseSize: number): void {
  if (seg.code) {
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(baseSize * 0.85);
  } else {
    const st = seg.bold && seg.italic ? 'bolditalic' : seg.bold ? 'bold' : seg.italic ? 'italic' : 'normal';
    pdf.setFont('helvetica', st);
    pdf.setFontSize(baseSize);
  }
}

/**
 * Render a run of inline content with word-wrapping.
 * Returns the final y (same as ctx.y after rendering).
 * The caller must advance ctx.y by lineHeight AFTER the call.
 */
function renderInline(ctx: Ctx, items: InlineContent[], x0: number, cw: number, fontSize: number, lineHeight: number): void {
  const { pdf } = ctx;
  const maxX = x0 + cw;
  let cx = x0;

  const segs = toSegments(items);

  for (const seg of segs) {
    applySegFont(pdf, seg, fontSize);
    if (seg.link) pdf.setTextColor(...C.muted);
    else if (seg.code) pdf.setTextColor(15, 76, 117);
    else pdf.setTextColor(...C.text);

    // Split segment text on newlines
    const nlParts = seg.text.split('\n');
    for (let ni = 0; ni < nlParts.length; ni++) {
      if (ni > 0) { cx = x0; ctx.y += lineHeight; guard(ctx, lineHeight); }
      const part = nlParts[ni];
      if (!part) continue;

      // Word-wrap within the line
      const words = part.split(/(\s+)/); // keep delimiters
      for (const chunk of words) {
        if (!chunk) continue;
        applySegFont(pdf, seg, fontSize);
        const w = pdf.getTextWidth(chunk);
        if (cx + w > maxX && cx > x0) { cx = x0; ctx.y += lineHeight; guard(ctx, lineHeight); }
        pdf.text(chunk, cx, ctx.y);
        cx += w;
      }
    }
  }
  // Don't advance here; caller does it
}

// ── Block content helpers ─────────────────────────────────────────────────────
function getInlines(block: Block): InlineContent[] {
  const raw = block.content;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0] as { type?: string };
  if (first.type === 'text' || first.type === 'link') return raw as InlineContent[];
  return [];
}

// ── Block renderer ────────────────────────────────────────────────────────────
function renderBlock(ctx: Ctx, block: Block, imageCache: Map<string, ImgData>, depth = 0): void {
  const { pdf } = ctx;
  const props = block.props ?? {};
  const children = block.children ?? [];
  const items = getInlines(block);
  const indentMM = depth * 5;
  const x0 = MX + indentMM;
  const cw = CW - indentMM;

  switch (block.type) {

    // ── Headings ──────────────────────────────────────────────────────────────
    case 'heading': {
      const level = (props.level as number) ?? 1;
      const [fs, lh, spaceBefore] = level === 1 ? [20, 9, 7] : level === 2 ? [15, 7, 5] : [12.5, 6, 4];
      ctx.y += spaceBefore;
      guard(ctx, lh + 4);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(fs);
      pdf.setTextColor(...C.heading);

      const txt = flatText(items);
      const wrapped = pdf.splitTextToSize(txt, cw);
      for (let i = 0; i < wrapped.length; i++) {
        guard(ctx, lh);
        pdf.text(wrapped[i] as string, x0, ctx.y);
        if (i < wrapped.length - 1) ctx.y += lh;
      }
      ctx.y += lh * 0.3;

      if (level <= 2) {
        pdf.setDrawColor(...C.border);
        pdf.setLineWidth(level === 1 ? 0.5 : 0.25);
        pdf.line(x0, ctx.y, MX + CW, ctx.y);
        ctx.y += 2;
      } else {
        ctx.y += 2;
      }
      break;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────────
    case 'paragraph': {
      if (items.length === 0) { ctx.y += 2.5; break; }
      guard(ctx, 6);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...C.text);
      renderInline(ctx, items, x0, cw, 10, 5.5);
      ctx.y += 5.5 + 1.5;
      break;
    }

    // ── Bullet list ───────────────────────────────────────────────────────────
    case 'bulletListItem': {
      guard(ctx, 6);
      // bullet dot
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(...ctx.accent);
      pdf.text('•', x0, ctx.y);
      // text
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...C.text);
      renderInline(ctx, items, x0 + 5, cw - 5, 10, 5.5);
      ctx.y += 5.5 + 1;
      break;
    }

    // ── Numbered list ─────────────────────────────────────────────────────────
    case 'numberedListItem': {
      const num = (props.start as number) ?? 1;
      guard(ctx, 6);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...ctx.accent);
      pdf.text(`${num}.`, x0, ctx.y);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...C.text);
      renderInline(ctx, items, x0 + 6, cw - 6, 10, 5.5);
      ctx.y += 5.5 + 1;
      break;
    }

    // ── Checklist ─────────────────────────────────────────────────────────────
    case 'checkListItem': {
      const checked = !!props.checked;
      guard(ctx, 6);
      const cbSize = 3.2;
      const cbTop = ctx.y - cbSize + 0.5;
      if (checked) {
        pdf.setFillColor(...ctx.accent);
        pdf.rect(x0, cbTop, cbSize, cbSize, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        pdf.text('✓', x0 + 0.4, cbTop + cbSize - 0.5);
      } else {
        pdf.setDrawColor(...C.muted);
        pdf.setLineWidth(0.25);
        pdf.rect(x0, cbTop, cbSize, cbSize, 'D');
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(checked ? C.muted[0] : C.text[0], checked ? C.muted[1] : C.text[1], checked ? C.muted[2] : C.text[2]);
      renderInline(ctx, items, x0 + 5.5, cw - 5.5, 10, 5.5);
      ctx.y += 5.5 + 1;
      break;
    }

    // ── Code block ────────────────────────────────────────────────────────────
    case 'codeBlock': {
      const lang = ((props.language as string) ?? 'python').toLowerCase();
      let rawCode = '';
      if (Array.isArray(block.content)) {
        rawCode = (block.content as InlineContent[]).map(it => it.text ?? '').join('');
      } else if (typeof block.content === 'string') {
        rawCode = block.content as string;
      }

      const codeLines = rawCode.split('\n');
      const codeLH = 4.6;
      const padH = 3;
      const labelH = 5;

      // Pre-calculate total visual lines (accounting for long-line wraps)
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(8.5);
      let totalVisLines = 0;
      for (const ln of codeLines) {
        if (!ln) { totalVisLines++; continue; }
        const w = pdf.getTextWidth(ln);
        totalVisLines += Math.max(1, Math.ceil(w / (CW - padH * 2)));
      }
      const blockH = labelH + totalVisLines * codeLH + 2;

      ctx.y += 4;
      // If the whole block fits on remaining page, no split; otherwise new page if > 60mm
      if (blockH > PH - MY - ctx.y && blockH <= PH - MY * 2) newPage(ctx);
      else guard(ctx, labelH + codeLH + 4);

      const blockTop = ctx.y;

      // Language label bar
      pdf.setFillColor(...C.codeBar);
      pdf.setDrawColor(...C.codeBrd);
      pdf.setLineWidth(0.3);
      pdf.rect(MX, ctx.y, CW, labelH, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(15, 76, 117);
      const langLabel = lang.charAt(0).toUpperCase() + lang.slice(1);
      pdf.text(langLabel, MX + padH, ctx.y + labelH - 1.5);
      ctx.y += labelH;

      // Tokenise
      const tokens = lang === 'sql' ? tokenizeSQL(rawCode) : tokenizePython(rawCode);

      // Split tokens into visual lines
      type TokLine = Tok[];
      const tokLines: TokLine[] = [[]];
      for (const tok of tokens) {
        const parts = tok.v.split('\n');
        for (let pi = 0; pi < parts.length; pi++) {
          if (pi > 0) tokLines.push([]);
          if (parts[pi] !== '') tokLines[tokLines.length - 1].push({ k: tok.k, v: parts[pi] });
        }
      }

      // Render each token line
      for (let li = 0; li < tokLines.length; li++) {
        const tokLine = tokLines[li];

        // Page break mid-block
        if (ctx.y + codeLH > PH - MY) {
          // Close left/right borders of current section
          pdf.setDrawColor(...C.codeBrd);
          pdf.setLineWidth(0.3);
          pdf.line(MX, blockTop + labelH, MX, ctx.y);
          pdf.line(MX + CW, blockTop + labelH, MX + CW, ctx.y);

          newPage(ctx);

          // Re-draw label on new page
          pdf.setFillColor(...C.codeBar);
          pdf.setDrawColor(...C.codeBrd);
          pdf.rect(MX, ctx.y, CW, labelH, 'FD');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7);
          pdf.setTextColor(15, 76, 117);
          pdf.text(`${langLabel} (cont.)`, MX + padH, ctx.y + labelH - 1.5);
          ctx.y += labelH;
        }

        // Alternating row background
        pdf.setFillColor(li % 2 === 0 ? 240 : 235, li % 2 === 0 ? 247 : 243, li % 2 === 0 ? 251 : 248);
        pdf.rect(MX, ctx.y, CW, codeLH, 'F');

        // Render tokens left-to-right
        let cx = MX + padH;
        pdf.setFontSize(8.5);
        const SYNTOK: Record<TokKind, RGB> = { kw: C.kw, str: C.str, cmt: C.cmt, num: C.num, op: C.op, plain: C.text };

        for (const tok of tokLine) {
          pdf.setFont('courier', tok.k === 'kw' ? 'bold' : tok.k === 'cmt' ? 'italic' : 'normal');
          pdf.setTextColor(...SYNTOK[tok.k]);
          const tw = pdf.getTextWidth(tok.v);
          if (cx + tw > MX + CW - 1) break; // prevent overflow
          pdf.text(tok.v, cx, ctx.y + codeLH - 1.4);
          cx += tw;
        }

        ctx.y += codeLH;
      }

      // Bottom + side borders
      pdf.setDrawColor(...C.codeBrd);
      pdf.setLineWidth(0.3);
      pdf.line(MX, ctx.y, MX + CW, ctx.y);
      pdf.line(MX, blockTop + labelH, MX, ctx.y);
      pdf.line(MX + CW, blockTop + labelH, MX + CW, ctx.y);

      ctx.y += 4;
      break;
    }

    // ── Table ─────────────────────────────────────────────────────────────────
    case 'table': {
      const tc = block.content as unknown as { rows: { cells: InlineContent[][] }[] } | null;
      if (!tc?.rows?.length) break;
      const rows = tc.rows;
      const nCols = rows[0]?.cells?.length ?? 1;
      const colW = CW / nCols;
      const rowH = 6.5;
      const cellPad = 2;

      ctx.y += 3;
      guard(ctx, rowH * Math.min(rows.length, 4) + 4);

      for (let ri = 0; ri < rows.length; ri++) {
        const isHdr = ri === 0;
        guard(ctx, rowH);

        // Row background
        if (isHdr) pdf.setFillColor(...C.tblHead);
        else if (ri % 2 === 1) pdf.setFillColor(...C.altRow);
        else pdf.setFillColor(255, 255, 255);
        pdf.rect(MX, ctx.y - rowH + cellPad * 0.6, CW, rowH, 'F');

        // Row border
        pdf.setDrawColor(...C.tblBrd);
        pdf.setLineWidth(0.2);
        pdf.rect(MX, ctx.y - rowH + cellPad * 0.6, CW, rowH, 'D');

        // Cells
        for (let ci = 0; ci < rows[ri].cells.length; ci++) {
          const cellX = MX + ci * colW;
          if (ci > 0) {
            pdf.setDrawColor(...C.tblBrd);
            pdf.line(cellX, ctx.y - rowH + cellPad * 0.6, cellX, ctx.y + cellPad * 0.6);
          }
          const cellTxt = flatText(rows[ri].cells[ci]);
          const truncated = cellTxt.length > 32 ? cellTxt.slice(0, 30) + '…' : cellTxt;
          pdf.setFont('helvetica', isHdr ? 'bold' : 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(...(isHdr ? C.heading : C.text));
          pdf.text(truncated, cellX + cellPad, ctx.y);
        }
        ctx.y += rowH;
      }
      ctx.y += 3;
      break;
    }

    // ── Blockquote / callout ──────────────────────────────────────────────────
    case 'quote':
    case 'blockquote': {
      guard(ctx, 8);
      const txt = flatText(items);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const wrapped = pdf.splitTextToSize(txt, CW - 8);
      const blockH = (wrapped as string[]).length * 5.5 + 4;
      const top = ctx.y - 3.5;
      pdf.setFillColor(...C.quote);
      pdf.rect(MX, top, CW, blockH, 'F');
      pdf.setFillColor(...ctx.accent);
      pdf.rect(MX, top, 2.5, blockH, 'F');
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(19, 78, 74);
      ctx.y = top + 3.5;
      for (const line of wrapped as string[]) {
        guard(ctx, 5.5);
        pdf.text(line, MX + 6, ctx.y);
        ctx.y += 5.5;
      }
      ctx.y += 3;
      break;
    }

    // ── Divider ───────────────────────────────────────────────────────────────
    case 'horizontalRule':
    case 'divider': {
      guard(ctx, 6);
      ctx.y += 2;
      pdf.setDrawColor(...C.border);
      pdf.setLineWidth(0.3);
      pdf.line(MX, ctx.y, MX + CW, ctx.y);
      ctx.y += 5;
      break;
    }

    // ── Image ───────────────────────────────────────────────────────────────
    case 'image': {
      const url = (props.url as string) ?? '';
      const caption = (props.caption as string) ?? '';
      const imgData = imageCache.get(url);

      ctx.y += 4;

      if (imgData) {
        // Convert pixel dimensions to mm (96dpi: 1px = 0.264583mm)
        const MM_PER_PX = 0.264583;
        let w = imgData.width * MM_PER_PX;
        let h = imgData.height * MM_PER_PX;

        // Fit within content width
        if (w > CW) { h = h * CW / w; w = CW; }
        // Cap height at 55% of page to avoid a single image consuming the whole page
        const maxH = (PH - MY * 2) * 0.55;
        if (h > maxH) { w = w * maxH / h; h = maxH; }

        guard(ctx, h + 10);

        const imgX = MX + (CW - w) / 2; // centre horizontally
        pdf.addImage(imgData.dataUrl, 'JPEG', imgX, ctx.y, w, h);
        ctx.y += h + 2;

        if (caption) {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(8);
          pdf.setTextColor(...C.muted);
          pdf.text(caption, PW / 2, ctx.y, { align: 'center' });
          ctx.y += 5;
        }
      } else {
        // Fetch failed – show a graceful placeholder box
        guard(ctx, 10);
        pdf.setFillColor(...C.tblHead);
        pdf.setDrawColor(...C.border);
        pdf.setLineWidth(0.25);
        pdf.rect(MX, ctx.y - 3, CW, 10, 'FD');
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(...C.muted);
        pdf.text(`[Image${caption ? ': ' + caption : ''}]`, PW / 2, ctx.y + 3, { align: 'center' });
        ctx.y += 12;
      }

      ctx.y += 4;
      break;
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    default: {
      if (items.length > 0) {
        guard(ctx, 6);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(...C.text);
        renderInline(ctx, items, x0, cw, 10, 5.5);
        ctx.y += 5.5 + 1.5;
      }
      break;
    }
  }

  // Recurse into children
  for (const child of children) {
    renderBlock(ctx, child, imageCache, depth + 1);
  }
}

// ── Header section ────────────────────────────────────────────────────────────
function renderHeader(ctx: Ctx, node: MindmapNode, nodeContent: NodeContent, mapTitle: string, parentLabel?: string): void {
  const { pdf } = ctx;
  const accent = ctx.accent;

  // Accent bar on left
  pdf.setFillColor(...accent);
  pdf.rect(MX, ctx.y, 3.5, 16, 'F');

  // Breadcrumb
  const crumbs = [mapTitle, parentLabel, node.label].filter(Boolean).join(' › ');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...C.muted);
  pdf.text(crumbs, MX + 7, ctx.y + 4.5);

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(...C.heading);
  const titleTxt = `${node.emoji ? node.emoji + ' ' : ''}${node.label}`;
  const titleWrapped = pdf.splitTextToSize(titleTxt, CW - 8) as string[];
  pdf.text(titleWrapped[0], MX + 7, ctx.y + 13);
  ctx.y += 18;
  if (titleWrapped.length > 1) {
    for (let i = 1; i < titleWrapped.length; i++) {
      pdf.text(titleWrapped[i], MX + 7, ctx.y);
      ctx.y += 9;
    }
  }

  // Metadata row
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...C.muted);
  const dateTxt = `Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  pdf.text(dateTxt, MX + 7, ctx.y);
  if (nodeContent.isCompleted) {
    pdf.setTextColor(...accent);
    pdf.text('  ✓ Studied', MX + 7 + pdf.getTextWidth(dateTxt) + 2, ctx.y);
  }
  ctx.y += 5;

  // Divider
  pdf.setDrawColor(...C.border);
  pdf.setLineWidth(0.5);
  pdf.line(MX, ctx.y, MX + CW, ctx.y);
  ctx.y += 7;
}

// ── Key points & Resources ────────────────────────────────────────────────────
function renderKeyPoints(ctx: Ctx, points: { text: string }[]): void {
  if (!points.length) return;
  const { pdf } = ctx;
  ctx.y += 4;
  guard(ctx, 14);

  // Section heading
  pdf.setFillColor(...ctx.accent);
  pdf.rect(MX, ctx.y - 3.5, 2.5, 6, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...C.heading);
  pdf.text('KEY POINTS', MX + 5, ctx.y);
  ctx.y += 5;
  pdf.setDrawColor(...C.border);
  pdf.setLineWidth(0.25);
  pdf.line(MX, ctx.y, MX + CW, ctx.y);
  ctx.y += 4;

  for (const kp of points) {
    guard(ctx, 7);
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(...ctx.accent);
    pdf.setLineWidth(0.25);
    const wrapped = pdf.splitTextToSize(kp.text, CW - 10) as string[];
    const bh = wrapped.length * 5 + 3;
    pdf.rect(MX, ctx.y - 3.5, CW, bh, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...ctx.accent);
    pdf.text('✦', MX + 2.5, ctx.y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...C.text);
    for (let i = 0; i < wrapped.length; i++) {
      pdf.text(wrapped[i], MX + 7, ctx.y);
      if (i < wrapped.length - 1) ctx.y += 5;
    }
    ctx.y += bh - 2;
  }
}

function renderResources(ctx: Ctx, resources: { title: string; url?: string; note?: string }[]): void {
  if (!resources.length) return;
  const { pdf } = ctx;
  ctx.y += 4;
  guard(ctx, 14);

  pdf.setFillColor(...ctx.accent);
  pdf.rect(MX, ctx.y - 3.5, 2.5, 6, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...C.heading);
  pdf.text('RESOURCES', MX + 5, ctx.y);
  ctx.y += 5;
  pdf.setDrawColor(...C.border);
  pdf.setLineWidth(0.25);
  pdf.line(MX, ctx.y, MX + CW, ctx.y);
  ctx.y += 4;

  for (const res of resources) {
    guard(ctx, 10);
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.2);
    pdf.rect(MX, ctx.y - 3.5, CW, 10, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(...C.heading);
    pdf.text(res.title, MX + 3, ctx.y);
    if (res.url) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...C.muted);
      const truncUrl = res.url.length > 80 ? res.url.slice(0, 78) + '…' : res.url;
      pdf.text(truncUrl, MX + 3, ctx.y + 4);
    }
    ctx.y += 12;
  }
}

// ── Footer ────────────────────────────────────────────────────────────────────
function renderFooter(pdf: jsPDF, mapTitle: string, pageNum: number): void {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...C.muted);
  pdf.text(mapTitle, MX, PH - MY + 6);
  pdf.text('MindMap Study Tool', MX + CW, PH - MY + 6, { align: 'right' });
  pdf.text(`Page ${pageNum}`, PW / 2, PH - MY + 6, { align: 'center' });
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function exportBranchToPdf(
  node: MindmapNode,
  nodeContent: NodeContent,
  mapTitle: string,
  parentLabel?: string
): Promise<void> {
  const blocks = (nodeContent.richContent ?? []) as Block[];
  const accentHex = node.color || '#0d9488';

  // Pre-fetch all images referenced in the content
  const imageUrls = collectImageUrls(blocks);
  const imageCache = new Map<string, ImgData>();
  await Promise.all(
    imageUrls.map(async (url) => {
      const data = await fetchAndConvertImage(url);
      if (data) imageCache.set(url, data);
    })
  );

  // Parse hex accent to RGB
  const hexToRgb = (h: string): RGB => {
    const clean = h.replace('#', '');
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  };

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const ctx: Ctx = { pdf, y: MY + 4, accent: hexToRgb(accentHex) };

  // ── Page 1 header ──────────────────────────────────────────────────────────
  renderHeader(ctx, node, nodeContent, mapTitle, parentLabel);

  // ── Rich content ──────────────────────────────────────────────────────────────
  if (blocks.length > 0) {
    for (const block of blocks) {
      renderBlock(ctx, block, imageCache);
    }
  }

  // ── Key points ─────────────────────────────────────────────────────────────
  renderKeyPoints(ctx, nodeContent.keyPoints ?? []);

  // ── Resources ──────────────────────────────────────────────────────────────
  renderResources(ctx, nodeContent.resources ?? []);

  // ── Empty state ────────────────────────────────────────────────────────────
  const hasContent = blocks.length || (nodeContent.keyPoints?.length ?? 0) || (nodeContent.resources?.length ?? 0);
  if (!hasContent) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(...C.muted);
    pdf.text('No content added yet.', PW / 2, ctx.y + 10, { align: 'center' });
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    renderFooter(pdf, mapTitle, p);
  }

  // ── Metadata & save ────────────────────────────────────────────────────────
  pdf.setProperties({
    title: node.label,
    subject: `${mapTitle} › ${node.label}`,
    creator: 'MindMap Study Tool',
  });

  const fileName = `${node.label.replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-') || 'export'}.pdf`;
  pdf.save(fileName);
}
