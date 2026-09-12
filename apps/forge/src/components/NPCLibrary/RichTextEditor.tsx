import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, List, ListOrdered, Underline as UnderlineIcon } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter notes...',
}) => {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-[120px] p-3 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-theme-secondary rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-theme-tertiary p-2 flex gap-1 border-b border-theme-secondary">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-theme-secondary ${
            editor.isActive('bold') ? 'bg-theme-secondary text-accent-yellow-light' : 'text-white'
          }`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-theme-secondary ${
            editor.isActive('italic') ? 'bg-theme-secondary text-accent-yellow-light' : 'text-white'
          }`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded hover:bg-theme-secondary ${
            editor.isActive('underline') ? 'bg-theme-secondary text-accent-yellow-light' : 'text-white'
          }`}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-theme-secondary ${
            editor.isActive('bulletList') ? 'bg-theme-secondary text-accent-yellow-light' : 'text-white'
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-theme-secondary ${
            editor.isActive('orderedList') ? 'bg-theme-secondary text-accent-yellow-light' : 'text-white'
          }`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="min-h-[120px]"
        placeholder={placeholder}
      />
    </div>
  );
};
