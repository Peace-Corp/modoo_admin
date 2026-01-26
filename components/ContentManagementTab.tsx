'use client';

import { useState } from 'react';
import {
  ReviewsSection,
  ExamplesSection,
  HeroBannersSection,
  AnnouncementsSection,
  FaqsSection,
  InquiriesSection,
  ChatbotInquiriesSection,
} from './content-management';

type SectionKey = 'reviews' | 'examples' | 'heroBanners' | 'announcements' | 'faqs' | 'inquiries' | 'chatbotInquiries';

const sectionTabs: { key: SectionKey; label: string }[] = [
  { key: 'reviews', label: '리뷰' },
  { key: 'examples', label: '제작 사례' },
  { key: 'heroBanners', label: '히어로 배너' },
  { key: 'announcements', label: '공지' },
  { key: 'faqs', label: 'FAQ' },
  { key: 'inquiries', label: '문의' },
  { key: 'chatbotInquiries', label: '챗봇 문의' },
];

export default function ContentManagementTab() {
  const [activeSection, setActiveSection] = useState<SectionKey>('reviews');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">콘텐츠 관리</h2>
          <p className="text-sm text-gray-500 mt-1">
            리뷰, 제작 사례, 배너, 공지, FAQ, 문의, 챗봇 문의를 한 곳에서 관리합니다.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200/60 rounded-md p-3 shadow-sm">
        <div className="flex gap-2 flex-wrap">
          {sectionTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeSection === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'reviews' && <ReviewsSection />}
      {activeSection === 'examples' && <ExamplesSection />}
      {activeSection === 'heroBanners' && <HeroBannersSection />}
      {activeSection === 'announcements' && <AnnouncementsSection />}
      {activeSection === 'faqs' && <FaqsSection />}
      {activeSection === 'inquiries' && <InquiriesSection />}
      {activeSection === 'chatbotInquiries' && <ChatbotInquiriesSection />}
    </div>
  );
}
