'use client';

interface EditorRightPanelProps {
  children: React.ReactNode;
}

export default function EditorRightPanel({ children }: EditorRightPanelProps) {
  return (
    <aside className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-y-auto shrink-0 text-xs">
      {children}
    </aside>
  );
}
