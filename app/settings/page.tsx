import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center shadow-sm">
      <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">설정</h3>
      <p className="text-gray-500">설정 기능은 준비 중입니다.</p>
    </div>
  );
}
