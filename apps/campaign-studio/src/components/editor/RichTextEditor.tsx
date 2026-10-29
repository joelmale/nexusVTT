import { EditorState } from 'lexical';
import { useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';

const theme = {
  paragraph: 'mb-2',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
  },
};

interface RichTextEditorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function onError(error: Error) {
  console.error(error);
}

// Plugin to set initial value
function InitialValuePlugin({ value }: { value?: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (value) {
      const editorState = editor.parseEditorState(value);
      editor.setEditorState(editorState);
    }
  }, [editor, value]);

  return null;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter text...',
  className = '',
}: RichTextEditorProps) {
  const initialConfig = {
    namespace: 'NexusCodexEditor',
    theme,
    onError,
  };

  const handleChange = (editorState: EditorState) => {
    const json = JSON.stringify(editorState.toJSON());
    onChange(json);
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={`relative rounded-md border bg-background ${className}`}
      >
        <PlainTextPlugin
          contentEditable={
            <ContentEditable className="min-h-[200px] resize-none overflow-auto p-3 outline-none" />
          }
          placeholder={
            <div className="pointer-events-none absolute left-3 top-3 text-muted-foreground">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} />
        {value && <InitialValuePlugin value={value} />}
      </div>
    </LexicalComposer>
  );
}
