'use client';

import { useState } from 'react';
import CoBuyTab from '@/components/CoBuyTab';
import CoBuyRequestsTab from '@/components/cobuy/CoBuyRequestsTab';

export default function CoBuyPage() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'requests'>('requests');

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'requests' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          요청 관리
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'sessions' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          세션 관리
        </button>
      </div>

      {activeTab === 'requests' ? <CoBuyRequestsTab /> : <CoBuyTab />}
    </div>
  );
}
