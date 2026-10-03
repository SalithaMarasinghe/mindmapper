import { VoiceDeck } from './VoiceDeck';
import { ConversationStream } from './ConversationStream';
import { isVoiceInputEnabled } from '../../lib/jarvisFlags';

/**
 * JarvisScreen — orchestrator that composes the layout.
 * Left panel: VoiceDeck (voice input + context, rendered only when voice input is enabled).
 * Main panel: ConversationStream (messages + actions + composer).
 *
 * All state lives in jarvisStore and assistantStore — this component
 * adds no state of its own.
 */
export function JarvisScreen() {
  const showVoiceDeck = isVoiceInputEnabled();

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-bg">
      {/* Left: Voice & Control Deck (rendered only when voice input is enabled) */}
      {showVoiceDeck && <VoiceDeck />}

      {/* Main: Conversation & Action Stream */}
      <ConversationStream />
    </div>
  );
}
