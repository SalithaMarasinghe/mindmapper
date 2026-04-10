import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

interface RichEditorProps {
  nodeId: string;
  mapId: string;
  initialContent?: unknown[];
  onSave: (content: unknown[]) => void;
  onDirty?: () => void;
  readOnly?: boolean;
}

export default function RichEditor({
  nodeId, initialContent, onSave, onDirty, readOnly = false,
}: RichEditorProps) {
  const user = useAuthStore((s) => s.user);
  // We only use dark theme if the root element specifically has the 'dark' class applied by AppHeader.
  const isDark = document.documentElement.classList.contains('dark');
  
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);
  const onSaveRef = useRef(onSave);
  const onDirtyRef = useRef(onDirty);

  useEffect(() => {
    onSaveRef.current = onSave;
    onDirtyRef.current = onDirty;
  }, [onSave, onDirty]);

  async function uploadFile(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const userId = user?.id ?? 'anonymous';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${userId}/${nodeId}/${uniqueName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('study-assets')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(uploadError.message);
    }

    const { data: urlData } = supabase.storage
      .from('study-assets')
      .getPublicUrl(uploadData.path);

    console.log('Uploaded to:', urlData.publicUrl);
    return urlData.publicUrl;
  }

  const editor = useCreateBlockNote({
    initialContent: initialContent?.length ? (initialContent as any) : undefined,
    uploadFile,
  });

  const handleSaveFlush = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!isDirty.current) return;
    const blocks = editor.document;
    onSaveRef.current(blocks as unknown[]);
    isDirty.current = false;
  }, [editor]);

  useEffect(() => {
    // Flush on unmount
    return () => {
      handleSaveFlush();
    };
  }, [handleSaveFlush]);

  function handleChange() {
    isDirty.current = true;
    if (onDirtyRef.current) onDirtyRef.current();
    
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      handleSaveFlush();
    }, 1500);
  }
  
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSaveFlush();
    }
  }

  return (
    <div
      className="rich-editor-wrapper nodrag nowheel nopan relative"
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        editable={!readOnly}
        theme={isDark ? 'dark' : 'light'}
      />
    </div>
  );
}
