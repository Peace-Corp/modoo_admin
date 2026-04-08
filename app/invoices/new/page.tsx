'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Send, Eye, ArrowLeft, X, Paperclip } from 'lucide-react';
import type { InvoiceItem } from '@/types/types';
import {
  generateInvoiceEmailHtml,
} from '@/lib/invoice-email';

interface AdminDocument {
  id: string;
  doc_type: 'business_registration' | 'bank_account';
  file_name: string;
  file_url: string;
}

const DOC_LABELS: Record<string, string> = {
  business_registration: '사업자등록증',
  bank_account: '통장사본',
};

const SUGGESTED_ITEMS = ['의류', '프린트', '디자인', '자수', '배송비', '시안작업', '샘플'];

function emptyItem(): InvoiceItem {
  return { name: '', quantity: 1, unit_price: 0, amount: 0 };
}

export default function NewInvoicePage() {
  const router = useRouter();

  const [includeVat, setIncludeVat] = useState(true);
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [recipientOrg, setRecipientOrg] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [memo, setMemo] = useState('');
  const [sending, setSending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [attachBusinessReg, setAttachBusinessReg] = useState(false);
  const [attachBankAccount, setAttachBankAccount] = useState(false);

  useEffect(() => {
    fetch('/api/admin/documents')
      .then((res) => res.json())
      .then((result) => {
        if (result.data) setDocuments(result.data);
      })
      .catch(() => {});
  }, []);

  const hasDoc = (docType: string) => documents.some((d) => d.doc_type === docType);

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const vatAmount = includeVat ? Math.round(subtotal * 0.1) : 0;
  const totalAmount = subtotal + vatAmount;

  const updateItem = useCallback((index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };

      if (field === 'name') {
        item.name = value as string;
      } else if (field === 'quantity') {
        item.quantity = Math.max(1, Number(value) || 1);
        item.amount = item.quantity * item.unit_price;
      } else if (field === 'unit_price') {
        item.unit_price = Math.max(0, Number(value) || 0);
        item.amount = item.quantity * item.unit_price;
      }

      next[index] = item;
      return next;
    });
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem()]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const applySuggestion = useCallback((index: number, name: string) => {
    updateItem(index, 'name', name);
  }, [updateItem]);

  const handlePreview = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = generateInvoiceEmailHtml({
      invoiceNumber: 'INV-PREVIEW',
      date: dateStr,
      includeVat,
      items: items.filter((item) => item.name.trim()),
      subtotal,
      vatAmount,
      totalAmount,
      recipientOrg: recipientOrg.trim() || null,
      recipientName: recipientName.trim() || null,
      memo: memo.trim() || null,
    });
    setPreviewHtml(html);
  };

  const handleSubmit = async () => {
    const validItems = items.filter((item) => item.name.trim());
    if (validItems.length === 0) {
      alert('최소 1개 이상의 항목을 입력해주세요.');
      return;
    }
    if (!recipientEmail.trim()) {
      alert('이메일 주소를 입력해주세요.');
      return;
    }

    if (!confirm('거래명세서를 발송하시겠습니까?')) return;

    setSending(true);
    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_vat: includeVat,
          items: validItems,
          recipient_org: recipientOrg.trim() || undefined,
          recipient_name: recipientName.trim() || undefined,
          recipient_email: recipientEmail.trim(),
          memo: memo.trim() || undefined,
          attach_business_registration: attachBusinessReg,
          attach_bank_account: attachBankAccount,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.error || '발송에 실패했습니다.');
        return;
      }

      if (result.warning) {
        alert(result.warning);
      } else {
        alert('거래명세서가 성공적으로 발송되었습니다.');
      }

      router.push('/invoices');
    } catch {
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  const formatNumber = (n: number) => n.toLocaleString('ko-KR');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/invoices')}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">거래명세서 작성</h1>
      </div>

      <div className="space-y-6">
        {/* Supplier Info */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">공급자 정보</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-gray-500">서비스명</span>
              <p className="font-semibold text-gray-900">모두의 유니폼</p>
            </div>
            <div>
              <span className="text-gray-500">상호</span>
              <p className="font-semibold text-gray-900">피스코프</p>
            </div>
            <div>
              <span className="text-gray-500">사업자등록번호</span>
              <p className="font-semibold text-gray-900">118-08-15095</p>
            </div>
          </div>
        </section>

        {/* Recipient Info */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">받으시는 분</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">단체명</label>
              <input
                type="text"
                value={recipientOrg}
                onChange={(e) => setRecipientOrg(e.target.value)}
                placeholder="단체명 (선택)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">성함</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="성함 (선택)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일 주소 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* VAT Option */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">VAT 옵션</h2>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="vat"
                checked={includeVat}
                onChange={() => setIncludeVat(true)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">VAT 포함 (10%)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="vat"
                checked={!includeVat}
                onChange={() => setIncludeVat(false)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">VAT 미포함</span>
            </label>
          </div>
        </section>

        {/* Items */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">항목</h2>
            <button
              onClick={addItem}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              항목 추가
            </button>
          </div>

          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-[1fr_100px_140px_140px_36px] gap-2 mb-2 px-1">
            <span className="text-xs font-medium text-gray-500">품목</span>
            <span className="text-xs font-medium text-gray-500 text-right">수량</span>
            <span className="text-xs font-medium text-gray-500 text-right">단가 (원)</span>
            <span className="text-xs font-medium text-gray-500 text-right">금액 (원)</span>
            <span />
          </div>

          {/* Item Rows */}
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="group">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_140px_140px_36px] gap-2 items-start">
                  {/* Item name with suggestions */}
                  <div className="relative">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      placeholder="항목명"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {!item.name && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {SUGGESTED_ITEMS.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => applySuggestion(index, suggestion)}
                            className="px-2 py-0.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="sm:hidden text-xs text-gray-500 mb-0.5 block">수량</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="sm:hidden text-xs text-gray-500 mb-0.5 block">단가 (원)</label>
                    <input
                      type="number"
                      min="0"
                      value={item.unit_price || ''}
                      onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="sm:hidden text-xs text-gray-500 mb-0.5 block">금액 (원)</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-right font-medium text-gray-900">
                      {formatNumber(item.amount)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed self-start sm:self-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Summary */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">금액 요약</h2>
          <div className="space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">공급가액</span>
              <span className="text-gray-900">{formatNumber(subtotal)}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">세액 (VAT)</span>
              <span className="text-gray-900">{formatNumber(vatAmount)}원</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
              <span className="text-gray-900">합계금액</span>
              <span className="text-blue-700">{formatNumber(totalAmount)}원</span>
            </div>
          </div>
        </section>

        {/* Memo */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">비고</h2>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="비고 사항을 입력해주세요 (선택)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
        </section>

        {/* Attachments */}
        {documents.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Paperclip className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">첨부 문서</h2>
            </div>
            <p className="text-xs text-gray-400 mb-3">체크하면 거래명세서 이메일에 파일이 함께 첨부됩니다.</p>
            <div className="space-y-2">
              {hasDoc('business_registration') && (
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={attachBusinessReg}
                    onChange={(e) => setAttachBusinessReg(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">{DOC_LABELS.business_registration}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {documents.find((d) => d.doc_type === 'business_registration')?.file_name}
                    </span>
                  </div>
                </label>
              )}
              {hasDoc('bank_account') && (
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={attachBankAccount}
                    onChange={(e) => setAttachBankAccount(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">{DOC_LABELS.bank_account}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {documents.find((d) => d.doc_type === 'bank_account')?.file_name}
                    </span>
                  </div>
                </label>
              )}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            미리보기
          </button>
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? '발송 중...' : '발송하기'}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">이메일 미리보기</h3>
              <button
                onClick={() => setPreviewHtml(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
