import type { CompiledLedger } from '../services/ledgerCompiler';

export interface MarkdownCompilerOptions {
  engineerName?: string;
  engineerRole?: string;
  includeStorylines?: boolean;
  includeChronological?: boolean;
  includeStandalone?: boolean;
}

export function compileLedgerToMarkdown(
  ledger: CompiledLedger,
  options: MarkdownCompilerOptions = {}
): string {
  const {
    engineerName = 'Salitha Marasinghe',
    engineerRole = 'Trainee Associate Software Engineer',
    includeStorylines = true,
    includeChronological = true,
    includeStandalone = true,
  } = options;

  const lines: string[] = [];

  // ── Header / Metadata ───────────────────────────────────────────────────────
  lines.push('# Engineering Work & Career Ledger');
  lines.push(`**Engineer:** ${engineerName}  `);
  lines.push(`**Role:** ${engineerRole}  `);
  lines.push(`**Reporting Period:** ${ledger.startDate} to ${ledger.endDate}  `);
  lines.push(
    `**Tracked Activity:** ${ledger.workEventsCount} Work Sessions | ${ledger.meetingEventsCount} Meetings Logged | ${ledger.storylines.length} Chained Storylines  `
  );
  if (ledger.projectTags.length > 0) {
    lines.push(`**Active Project Initiatives:** ${ledger.projectTags.map((t) => `\`#${t}\``).join(', ')}  `);
  }
  lines.push('\n---\n');

  // ── Executive Overview ─────────────────────────────────────────────────────
  lines.push('## 🎯 Executive Overview & Initiatives');
  lines.push(
    `This ledger compiles hands-on engineering execution, strategic technical alignments, and verified business outcomes over ${ledger.startDate} to ${ledger.endDate}. All entries are structured using the Google XYZ result-oriented formula (*"Accomplished [X] as measured by [Y], by doing [Z]"*).`
  );
  lines.push('');

  // ── Part 1: Storylines / Chained Initiatives ───────────────────────────────
  if (includeStorylines && ledger.storylines.length > 0) {
    lines.push('## 🌟 Part 1: High-Impact Storylines & Chained Initiatives\n');
    lines.push(
      '> The following multi-session initiative threads trace end-to-end delivery from strategic problem alignment to architectural trade-offs and verified shipping results.\n'
    );

    ledger.storylines.forEach((storyline, idx) => {
      lines.push(`### ${idx + 1}. ${storyline.title}`);
      if (storyline.projectCreatedAt) {
        lines.push(`* **Project Inception:** \`${storyline.projectCreatedAt.slice(0, 10)}\` | **Status:** \`${storyline.projectStatus?.toUpperCase() || 'ACTIVE'}\``);
      }
      lines.push(
        `* **Execution Window:** ${storyline.startDate} – ${storyline.endDate} | **Events:** ${storyline.events.length} sessions (${storyline.meetings.length} meetings, ${storyline.workSessions.length} work logs)`
      );
      if (storyline.projectTag) {
        lines.push(`* **Project Tag:** \`#${storyline.projectTag}\``);
      }
      lines.push(`* **Thread ID:** \`${storyline.chainId}\`\n`);

      lines.push('#### 🔄 Interleaved Storyline & Causal Execution Chain');
      storyline.events.forEach((ev, evIdx) => {
        const timeWindow = ev.startTime && ev.endTime ? ` (${ev.startTime} – ${ev.endTime})` : '';
        if (ev.type === 'meeting') {
          lines.push(`\n##### Step ${evIdx + 1}: 🤝 [MEETING] ${ev.title} — ${ev.date}${timeWindow}`);
          if (ev.discussionSummary) {
            lines.push(ev.discussionSummary);
          }
          if (ev.decisions && !ev.discussionSummary?.includes('Agreed Decisions')) {
            lines.push(`\n> **⚖️ Agreed Decisions & Direction:**\n>\n>${indentText(ev.decisions, '> ')}`);
          }
          if (ev.tasksAssigned && ev.tasksAssigned.length > 0 && !ev.discussionSummary?.includes('Action Items')) {
            lines.push('\n**Action Items / To-Dos:**');
            ev.tasksAssigned.forEach((t) => {
              lines.push(`- [${t.done ? 'x' : ' '}] ${t.text}`);
            });
          }
          if (ev.links && ev.links.length > 0) {
            lines.push('\n**Reference Links:**');
            ev.links.forEach((l) => {
              lines.push(`- [${l.label || l.url}](${l.url})`);
            });
          }
        } else {
          lines.push(`\n##### Step ${evIdx + 1}: 🛠️ [WORK] ${ev.title} — ${ev.date}${timeWindow}`);
          if (ev.description) {
            lines.push(ev.description);
          }
          if (ev.implementationNotes) {
            lines.push(`\n*Technical Details / Notes:*\n\`\`\`\n${ev.implementationNotes}\n\`\`\``);
          }
          if (ev.links && ev.links.length > 0) {
            lines.push('\n**Deliverables & Links:**');
            ev.links.forEach((l) => {
              lines.push(`- [${l.label || l.url}](${l.url})`);
            });
          }
        }
      });

      lines.push('\n---\n');
    });
  }

  // ── Standalone Accomplishments ─────────────────────────────────────────────
  if (includeStandalone && ledger.standaloneEvents.length > 0) {
    lines.push('## 🔧 Standalone Engineering Tasks & Fixes\n');
    ledger.standaloneEvents.forEach((ev) => {
      const timeWindow = ev.startTime && ev.endTime ? ` (${ev.startTime} – ${ev.endTime})` : '';
      const tagStr = ev.projectTag ? ` \`#${ev.projectTag}\`` : '';
      lines.push(`* **[${ev.date}] [${ev.type.toUpperCase()}] ${ev.title}${timeWindow}${tagStr}**`);
      if (ev.type === 'work' && ev.description) {
        lines.push(indentText(ev.description, '  '));
      } else if (ev.type === 'meeting' && ev.discussionSummary) {
        lines.push(indentText(ev.discussionSummary, '  '));
      }
    });
    lines.push('\n---\n');
  }

  // ── Part 2: Chronological Weekly Audit Trail ───────────────────────────────
  if (includeChronological && ledger.weeks.length > 0) {
    lines.push('## 📅 Part 2: Chronological Weekly Audit Trail\n');
    lines.push(
      '> Granular, verified log of all daily engineering sessions and discussions, formatted chronologically with inline causal links.\n'
    );

    // Map chainId to storyline title for quick inline lookup
    const chainTitleMap = new Map<string, string>();
    for (const st of ledger.storylines) {
      chainTitleMap.set(st.chainId, st.title);
    }

    ledger.weeks.forEach((week) => {
      lines.push(`### ${week.weekLabel}`);
      lines.push(`*Total Activity: ${week.totalEvents} events*\n`);

      week.days.forEach((day) => {
        lines.push(`#### ${day.dayOfWeek}, ${day.date}`);

        day.events.forEach((ev) => {
          const timeWindow = ev.startTime && ev.endTime ? `${ev.startTime} – ${ev.endTime}` : ev.startTime || 'Scheduled';
          const typeBadge = ev.type === 'meeting' ? '[MEETING]' : '[WORK]';
          const tagBadge = ev.projectTag ? ` \`#${ev.projectTag}\`` : '';
          const chainLink = ev.chainId && chainTitleMap.has(ev.chainId)
            ? ` *(🔗 Storyline: ${chainTitleMap.get(ev.chainId)})*`
            : '';

          lines.push(`* **${timeWindow} ${typeBadge}**: ${ev.title}${tagBadge}${chainLink}`);

          if (ev.type === 'work' && ev.description) {
            lines.push(indentText(ev.description, '  '));
            if (ev.links && ev.links.length > 0) {
              lines.push(indentText('**Links:**', '  '));
              ev.links.forEach((l) => {
                lines.push(indentText(`- [${l.label || l.url}](${l.url})`, '  '));
              });
            }
          } else if (ev.type === 'meeting') {
            if (ev.discussionSummary) {
              lines.push(indentText(ev.discussionSummary, '  '));
            }
            if (ev.decisions) {
              lines.push(indentText(`**Decisions:**\n${ev.decisions}`, '  '));
            }
            if (ev.tasksAssigned && ev.tasksAssigned.length > 0) {
              lines.push(indentText('**Action Items:**', '  '));
              ev.tasksAssigned.forEach((t) => {
                lines.push(indentText(`- [${t.done ? 'x' : ' '}] ${t.text}`, '  '));
              });
            }
            if (ev.links && ev.links.length > 0) {
              lines.push(indentText('**Links:**', '  '));
              ev.links.forEach((l) => {
                lines.push(indentText(`- [${l.label || l.url}](${l.url})`, '  '));
              });
            }
          }
        });

        lines.push('');
      });

      lines.push('---\n');
    });
  }

  lines.push('\n_Generated autonomously by MindMapper Engineering Assistant._');
  return lines.join('\n');
}

function indentText(text: string, prefix = '  '): string {
  return text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}
