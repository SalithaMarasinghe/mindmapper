import { useState, useEffect } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { WeekCalendar, type NewEventDraft } from './WeekCalendar';
import { EventModal } from './EventModal';
import { EventDetailView } from './EventDetailView';
import { ChainView } from './ChainView';
import { Sparkles } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { marked } from 'marked';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import type { TimelineEventFull } from '../../types';

export function WorkJournal() {
  const { eventsByDate, fetchWeek } = useTimelineStore();
  
  // Week start logic (Monday)
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(mon.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  });

  // Derived weekEnd
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Fetch events on week change
  useEffect(() => {
    const startStr = weekStart.toISOString().slice(0, 10);
    const endStr = weekEnd.toISOString().slice(0, 10);
    fetchWeek(startStr, endStr);
  }, [weekStart, fetchWeek]);

  // Modal states
  const [modalDraft, setModalDraft] = useState<NewEventDraft | undefined>();
  const [modalEvent, setModalEvent] = useState<TimelineEventFull | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState(false);

  // Derived fresh event (so the detail view updates immediately after saving an edit)
  const freshModalEvent = modalEvent 
    ? Object.values(eventsByDate).flat().find(e => e.id === modalEvent.id) || modalEvent 
    : undefined;

  // Chain state
  const [viewChainId, setViewChainId] = useState<string | null>(null);

  const handleNewEvent = (draft: NewEventDraft) => {
    setModalDraft(draft);
    setModalEvent(undefined);
    setIsEditingEvent(false);
    setIsModalOpen(true);
  };

  const handleEventClick = (event: TimelineEventFull) => {
    setModalEvent(event);
    setModalDraft(undefined);
    setIsEditingEvent(false);
    setIsModalOpen(true);
  };

  const handlePrevWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() - 7);
    setWeekStart(next);
  };

  const handleNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const handleToday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(mon.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    setWeekStart(mon);
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSummary = async () => {
    try {
      setIsGenerating(true);
      const toastId = toast.loading('Generating summary...');
      
      const startStr = weekStart.toISOString().slice(0, 10);
      
      // Get the current JWT to pass to the Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No active session');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const fnUrl = `${supabaseUrl}/functions/v1/generate-weekly-summary`;

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ week_start_date: startStr }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate summary');
      
      const text = json.summary?.generated_text || '';
      if (!text) throw new Error('Received empty summary');
      
      // Generate PDF
      const doc = new jsPDF();
      const margin = 15; // mm
      const pageWidth = doc.internal.pageSize.getWidth();
      const maxWidth = pageWidth - margin * 2;
      
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Weekly Summary', margin, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.setFont('helvetica', 'normal');
      const endStr = weekEnd.toISOString().slice(0, 10);
      doc.text(`${startStr} to ${endStr}`, margin, 28);
      
      doc.setTextColor(0);
      let y = 40;

      const checkPageBreak = (height = 10) => {
        if (y + height > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const unescape = (str: string) => str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

      const printInline = (inlineTokens: any[], startX: number, startY: number, lineH: number) => {
        let curX = startX;
        let curY = startY;
        for (const t of inlineTokens) {
          if (t.type === 'strong') doc.setFont('helvetica', 'bold');
          else if (t.type === 'em') doc.setFont('helvetica', 'italic');
          else doc.setFont('helvetica', 'normal');
          
          const rawText = unescape(t.text || t.raw || '');
          const words = rawText.split(/(\s+)/);
          
          for (const w of words) {
            if (!w) continue;
            const wWidth = doc.getTextWidth(w);
            if (curX + wWidth > margin + maxWidth && w.trim() !== '') {
              curY += lineH;
              curX = startX;
              checkPageBreak(lineH);
            }
            if (w.trim() === '' && curX === startX) continue;
            doc.text(w, curX, curY);
            curX += wWidth;
          }
        }
        return curY;
      };

      const tokens = marked.lexer(text);

      for (const token of tokens) {
        if (token.type === 'heading') {
          checkPageBreak(20);
          y += 5;
          doc.setFontSize(token.depth === 1 ? 16 : token.depth === 2 ? 14 : 12);
          doc.setFont('helvetica', 'bold');
          doc.text(unescape(token.text), margin, y);
          y += doc.getLineHeight() * 1.5;
        } 
        else if (token.type === 'paragraph') {
          checkPageBreak(15);
          doc.setFontSize(11);
          y = printInline(token.tokens || [{ type: 'text', text: token.text }], margin, y, doc.getLineHeight() * 1.3);
          y += doc.getLineHeight() * 1.5;
        }
        else if (token.type === 'list') {
          doc.setFontSize(11);
          for (const item of token.items) {
            checkPageBreak(15);
            doc.setFont('helvetica', 'normal');
            doc.text('•', margin, y);
            const bulletIndent = margin + 5;
            const itemTokens = item.tokens?.[0]?.type === 'text' ? item.tokens[0].tokens : [{ type: 'text', text: item.text }];
            y = printInline(itemTokens || [{ type: 'text', text: item.text }], bulletIndent, y, doc.getLineHeight() * 1.3);
            y += doc.getLineHeight() * 1.3;
          }
          y += 5;
        }
        else if (token.type === 'table') {
          checkPageBreak(30);
          const head = token.header.map((h: any) => unescape(h.text));
          const body = token.rows.map((row: any) => row.map((c: any) => unescape(c.text)));
          
          autoTable(doc, {
            startY: y,
            head: [head],
            body: body,
            margin: { left: margin, right: margin },
            theme: 'grid',
            headStyles: { fillColor: [15, 36, 51], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.1 },
          });
          y = (doc as any).lastAutoTable.finalY + 10;
        }
        else if (token.type === 'space') {
          continue;
        }
        else {
          checkPageBreak(15);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          const lines = doc.splitTextToSize(unescape(token.raw), maxWidth);
          doc.text(lines, margin, y);
          y += lines.length * doc.getLineHeight() * 1.3;
        }
      }
      
      doc.save(`weekly-summary-${startStr}.pdf`);
      toast.success('Summary downloaded!', { id: toastId });
      
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full min-h-0 flex-1">
      {/* Main Calendar View */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f1117] overflow-hidden">
        {/* Calendar Header / Nav */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2d3748] bg-[#1e2433] flex-shrink-0">
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrevWeek}
              className="p-1.5 hover:bg-[#2d3748] rounded-md transition text-slate-400 hover:text-slate-200"
            >
              &larr;
            </button>
            <button 
              onClick={handleToday}
              className="px-3 py-1 hover:bg-[#2d3748] rounded-md transition text-sm font-semibold text-slate-300"
            >
              Today
            </button>
            <button 
              onClick={handleNextWeek}
              className="p-1.5 hover:bg-[#2d3748] rounded-md transition text-slate-400 hover:text-slate-200"
            >
              &rarr;
            </button>
          </div>
          
          <button 
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition border ${
              isGenerating 
                ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed' 
                : 'bg-teal-900/40 text-teal-300 hover:bg-teal-900/60 hover:text-teal-200 border-teal-700/50'
            }`}
            onClick={handleGenerateSummary}
            disabled={isGenerating}
          >
            <Sparkles className="w-4 h-4" />
            Generate Summary
          </button>

          <span className="text-sm font-bold text-slate-200">
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* The Grid */}
        <div className="flex-1 overflow-hidden relative min-h-0">
          <WeekCalendar
            weekStart={weekStart}
            eventsByDate={eventsByDate}
            onNewEvent={handleNewEvent}
            onEventClick={handleEventClick}
            onViewChain={setViewChainId}
          />
        </div>
      </div>

      {/* Modals */}
      {isModalOpen && freshModalEvent && !isEditingEvent && (
        <EventDetailView
          event={freshModalEvent}
          onClose={() => setIsModalOpen(false)}
          onEdit={() => setIsEditingEvent(true)}
        />
      )}
      {isModalOpen && freshModalEvent && isEditingEvent && (
        <EventModal
          existingEvent={freshModalEvent}
          onClose={() => setIsEditingEvent(false)}
        />
      )}
      {isModalOpen && modalDraft && (
        <EventModal
          draft={modalDraft}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {viewChainId && (
        <ChainView
          chainId={viewChainId}
          onClose={() => setViewChainId(null)}
          onEditEvent={handleEventClick}
        />
      )}
    </div>
  );
}
