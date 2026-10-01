import { VoiceDeck } from './VoiceDeck';
import { ConversationStream } from './ConversationStream';

/**
 * JarvisScreen — thin orchestrator that composes the two-panel layout.
 * Left panel: VoiceDeck (voice input + context).
 * Right panel: ConversationStream (messages + actions + composer).
 *
 * All state lives in jarvisStore and assistantStore — this component
 * adds no state of its own.
 */
export function JarvisScreen() {
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-bg">
      {/* Left: Voice & Control Deck (fixed width on desktop) */}
      <VoiceDeck />

      {/* Right: Conversation & Action Stream */}
      <ConversationStream />
    </div>
  );
}
