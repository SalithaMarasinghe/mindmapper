import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { BlockNoteSchema, createCodeBlockSpec } from '@blocknote/core';
import {
  codeBlockOptions,
} from '@blocknote/code-block';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

// Custom code block options: Python (default) + SQL only
const customCodeBlockOptions = {
  ...codeBlockOptions,
  defaultLanguage: 'python',
  supportedLanguages: {
    python: {
      name: 'Python',
      aliases: ['py', 'python3'],
    },
    sql: {
      name: 'SQL',
      aliases: ['sql'],
    },
  },
};

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...BlockNoteSchema.create().blockSpecs,
    codeBlock: createCodeBlockSpec(customCodeBlockOptions),
  },
});

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
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [copyButtonState, setCopyButtonState] = useState<{
    top: number;
    right: number;
    block: HTMLElement;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    onSaveRef.current = onSave;
    onDirtyRef.current = onDirty;
  }, [onSave, onDirty]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.code-copy-btn')) return;

      const codeBlock = target.closest('[data-content-type="codeBlock"]') as HTMLElement;
      if (codeBlock) {
        const rect = codeBlock.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        
        let top = rect.top - wrapperRect.top;
        let right = wrapperRect.right - rect.right;
        
        top += wrapper.scrollTop;

        setCopyButtonState(prev => {
          const newTop = top + 12;
          const newRight = right + 12;
          if (prev && prev.block === codeBlock && Math.abs(prev.top - newTop) < 2 && Math.abs(prev.right - newRight) < 2) {
            return prev;
          }
          return { top: newTop, right: newRight, block: codeBlock };
        });
      } else {
        setCopyButtonState(null);
        setCopied(false);
      }
    };

    const handleMouseLeave = () => {
      setCopyButtonState(null);
      setCopied(false);
    };

    wrapper.addEventListener('mousemove', handleMouseMove);
    wrapper.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      wrapper.removeEventListener('mousemove', handleMouseMove);
      wrapper.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleCopyClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!copyButtonState) return;
    
    const codeElement = copyButtonState.block.querySelector('code');
    const textToCopy = codeElement ? codeElement.textContent : copyButtonState.block.textContent;
    
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error('Failed to copy');
      }
    }
  };

  // ── WebP conversion ─────────────────────────────────────────────────────────
  async function convertToWebP(file: File, quality = 0.85): Promise<File> {
    if (!file.type.startsWith('image/')) return file;     // non-image, skip
    if (file.type === 'image/webp') return file;          // already WebP

    return new Promise<File>((resolve) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        URL.revokeObjectURL(objUrl);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newName = file.name.replace(/\.[^.]+$/, '.webp');
              resolve(new File([blob], newName, { type: 'image/webp' }));
            } else {
              resolve(file); // fallback
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
      img.src = objUrl;
    });
  }

  async function uploadFile(file: File): Promise<string> {
    // Convert to WebP for efficient storage (reduces size 30–70%)
    const processed = await convertToWebP(file);
    const ext = processed.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const userId = user?.id ?? 'anonymous';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${userId}/${nodeId}/${uniqueName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('study-assets')
      .upload(storagePath, processed, {
        cacheControl: '3600',
        upsert: false,
        contentType: processed.type,
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
    
    // Auto-format pasted code blocks to Python if they are not SQL or already Python
    const fixBlocks = (blocksToFix: typeof editor.document) => {
      for (const block of blocksToFix) {
        if (block.type === 'codeBlock') {
          const lang = block.props.language?.toLowerCase();
          if (lang !== 'python' && lang !== 'py' && lang !== 'python3' && lang !== 'sql') {
            editor.updateBlock(block.id, {
              type: 'codeBlock',
              props: { ...block.props, language: 'python' }
            });
          }
        }
        if (block.children && block.children.length > 0) {
          fixBlocks(block.children);
        }
      }
    };
    fixBlocks(editor.document);

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
      ref={wrapperRef}
    >
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        editable={!readOnly}
        theme={isDark ? 'dark' : 'light'}
      />
      {copyButtonState && (
        <button
          className="code-copy-btn absolute z-10 p-1.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          style={{ top: copyButtonState.top, right: copyButtonState.right }}
          onClick={handleCopyClick}
          title="Copy code"
        >
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
        </button>
      )}
    </div>
  );
}
