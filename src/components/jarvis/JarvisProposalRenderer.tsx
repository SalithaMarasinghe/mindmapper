import type { AssistantProposal } from '../../types';
import { CreateProjectCard } from '../assistant/cards/CreateProjectCard';
import { WorkJournalCard } from '../assistant/cards/WorkJournalCard';
import { TaskProposalCard } from '../assistant/cards/TaskProposalCard';
import { TransitionCard } from '../assistant/cards/TransitionCard';
import { SummaryAttachCard } from '../assistant/cards/SummaryAttachCard';
import { WrapUpCard } from '../assistant/cards/WrapUpCard';

interface JarvisProposalRendererProps {
  proposal: AssistantProposal;
  onApprove: (updated?: AssistantProposal) => void;
  onReject: () => void;
  isSubmitting?: boolean;
}

export function JarvisProposalRenderer({
  proposal,
  onApprove,
  onReject,
  isSubmitting,
}: JarvisProposalRendererProps) {
  switch (proposal.type) {
    case 'create_project':
      return (
        <CreateProjectCard
          proposal={proposal}
          onApprove={onApprove}
          onReject={onReject}
          isSubmitting={isSubmitting}
        />
      );

    case 'create_work_event':
    case 'create_meeting_event':
      return (
        <WorkJournalCard
          proposal={proposal}
          onApprove={onApprove}
          onReject={onReject}
          isSubmitting={isSubmitting}
        />
      );

    case 'create_tasks':
      return (
        <TaskProposalCard
          proposal={proposal}
          onApprove={onApprove}
          onReject={onReject}
          isSubmitting={isSubmitting}
        />
      );

    case 'start_task':
    case 'pause_task':
    case 'resume_task':
    case 'finish_task':
    case 'pause_all':
    case 'resume_last_paused':
      return (
        <TransitionCard
          proposal={proposal}
          onApprove={onApprove}
          onReject={onReject}
          isSubmitting={isSubmitting}
        />
      );

    case 'attach_work_summary':
      return (
        <SummaryAttachCard
          proposal={proposal}
          onApprove={onApprove}
          onReject={onReject}
          isSubmitting={isSubmitting}
        />
      );

    case 'daily_wrap_up':
    case 'carry_over_tasks':
      return (
        <WrapUpCard
          proposal={proposal}
          onApprove={onApprove}
          onReject={onReject}
          isSubmitting={isSubmitting}
        />
      );

    default:
      return null;
  }
}
