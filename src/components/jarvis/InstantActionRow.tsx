import type { AssistantProposal } from '../../types';
import { ActionEchoCard } from '../assistant/cards/ActionEchoCard';

interface InstantActionRowProps {
  proposal: AssistantProposal;
  messageId: string;
}

export function InstantActionRow({ proposal, messageId }: InstantActionRowProps) {
  return (
    <div className="border-b border-border py-1">
      <ActionEchoCard proposal={proposal} messageId={messageId} />
    </div>
  );
}
