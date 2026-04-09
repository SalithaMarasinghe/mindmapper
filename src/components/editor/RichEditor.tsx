import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import {
  defaultBlockSpecs,
  BlockNoteSchema,
} from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

interface RichEditorProps {
  nodeId: string;
  mapId: string;
  initialContent?: unknown[];
  onSave: (content: unknown[]) => void;
  readOnly?: boolean;
}

export default function RichEditor({
  nodeId, mapId, initialContent, onSave, readOnly = false,
}: RichEditorProps) {
  const user = useAuthStore((s) => s.user);
  const theme = useSettingsStore((s) => s.theme);
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && systemDark);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      image: {
        ...defaultBlockSpecs.image,
        config: {
          ...defaultBlockSpecs.image.config,
          propSchema: {
            ...defaultBlockSpecs.image.config.propSchema,
            previewWidth: {
              default: '100%',
            },
          },
        },
      },
    },
  });

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
    schema,
    initialContent: initialContent?.length ? initialContent : undefined,
    uploadFile,
  });

  useEffect(() => {
    async function testStorage() {
      const { data } = supabase.storage.from('study-assets').getPublicUrl('test');
      console.log('Storage base URL:', data.publicUrl, 'map:', mapId);
    }
    testStorage();
  }, [mapId]);

  function handleChange() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const blocks = editor.document;
      onSave(blocks as unknown[]);
    }, 800);
  }

  return (
    <div
      className="rich-editor-wrapper nodrag nowheel nopan"
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
