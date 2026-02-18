'use client';

interface EditorRightPanelProps {
  children: React.ReactNode;
  wide?: boolean;
}

export default function EditorRightPanel({ children, wide = false }: EditorRightPanelProps) {
  return (
    <aside className={`${wide ? 'w-96' : 'w-72'} h-full bg-white/95 backdrop-blur-sm border-l border-gray-200 flex flex-col overflow-y-auto shrink-0 text-xs transition-[width] duration-200`}>
      {children}
    </aside>
  );
}
