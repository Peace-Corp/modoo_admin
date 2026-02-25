'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { ChevronLeft, MessageSquare, ExternalLink, Link2, Eye, CheckCircle, XCircle, Clock, Pencil, Send } from 'lucide-react';
import { CoBuyRequest, CoBuyRequestComment, CoBuyRequestStatus } from '@/types/types';

const statusLabels: Record<CoBuyRequestStatus, string> = {
  pending: '대기중',
  in_progress: '작업중',
  design_shared: '디자인 공유됨',
  feedback: '피드백 대기',
  confirmed: '확정',
  session_created: '세션 생성됨',
  rejected: '거절',
};

const statusColors: Record<CoBuyRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  design_shared: 'bg-purple-100 text-purple-800',
  feedback: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800',
  session_created: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
});

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function CoBuyRequestsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const { data: requests, error, mutate } = useSWR<CoBuyRequest[]>(
    `/api/admin/cobuy/requests?status=${statusFilter}`,
    fetcher
  );

  const isLoading = !requests && !error;

  if (selectedRequestId) {
    return (
      <RequestDetail
        requestId={selectedRequestId}
        onBack={() => { setSelectedRequestId(null); mutate(); }}
      />
    );
  }

  return (
    <div>
      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'pending', 'in_progress', 'design_shared', 'feedback', 'confirmed', 'session_created', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === status ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? '전체' : statusLabels[status as CoBuyRequestStatus]}
          </button>
        ))}
      </div>

      {/* Request List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 text-sm">요청 목록을 불러올 수 없습니다.</div>
      ) : !requests?.length ? (
        <div className="text-center py-12 text-gray-400 text-sm">요청이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <button
              key={req.id}
              onClick={() => setSelectedRequestId(req.id)}
              className="w-full text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {req.freeform_preview_url && (
                    <div className="w-12 h-12 rounded-lg bg-gray-50 overflow-hidden shrink-0 border border-gray-100">
                      <img src={req.freeform_preview_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {(req as any).product?.title} · {(req as any).profiles?.email || (req as any).profiles?.name || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(req.created_at)}</p>
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[req.status]}`}>
                  {statusLabels[req.status]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Freeform Sketch Preview — renders each product side with objects overlaid
// ============================================================================

interface ProductLayerInfo {
  id: string;
  name: string;
  imageUrl: string;
  zIndex: number;
}

interface ProductSideInfo {
  id: string;
  name: string;
  imageUrl?: string;
  zoomScale?: number;
  layers?: ProductLayerInfo[];
}

// Original freeform canvas dimensions used during creation
const SRC_W = 340;
const SRC_H = 420;
// Preview dimensions (same aspect ratio)
const PREVIEW_W = 220;
const PREVIEW_H = 272;
const SCALE_FACTOR = PREVIEW_W / SRC_W;

function FreeformSketchPreview({
  canvasState,
  productSides,
  productColorHex,
}: {
  canvasState: Record<string, any>;
  productSides?: ProductSideInfo[];
  productColorHex?: string;
}) {
  const sideIds = productSides?.map(s => s.id) ?? Object.keys(canvasState);

  if (sideIds.length === 0) return <p className="text-xs text-gray-400">스케치 데이터 없음</p>;

  return (
    <div className="flex gap-3 flex-wrap">
      {sideIds.map(sideId => {
        const side = productSides?.find(s => s.id === sideId);
        return (
          <SketchSideCanvas
            key={sideId}
            sideId={sideId}
            side={side}
            stateValue={canvasState[sideId]}
            productColorHex={productColorHex}
          />
        );
      })}
    </div>
  );
}

function SketchSideCanvas({
  sideId,
  side,
  stateValue,
  productColorHex,
}: {
  sideId: string;
  side?: ProductSideInfo;
  stateValue?: any;
  productColorHex?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;

    const init = async () => {
      const fabric = await import('fabric');
      if (disposed) return;

      const canvas = new fabric.StaticCanvas(canvasRef.current!, {
        width: PREVIEW_W,
        height: PREVIEW_H,
        backgroundColor: '#EBEBEB',
      });
      fabricRef.current = canvas;

      try {
        // 1. Load product mockup — multi-layer or single imageUrl
        const hasLayers = side?.layers && side.layers.length > 0;
        const zoom = side?.zoomScale || 1.0;

        const applyColorFilter = (img: any) => {
          if (productColorHex && productColorHex !== '#FFFFFF') {
            img.filters = [new fabric.filters.BlendColor({ color: productColorHex, mode: 'multiply', alpha: 1 })];
            img.applyFilters();
          }
        };

        if (hasLayers) {
          // Multi-layer mode: load each layer sorted by zIndex
          const sorted = [...side!.layers!].sort((a, b) => a.zIndex - b.zIndex);
          for (const layer of sorted) {
            if (disposed) return;
            try {
              const img = await fabric.FabricImage.fromURL(layer.imageUrl, { crossOrigin: 'anonymous' });
              if (disposed) { canvas.dispose(); return; }
              const imgW = img.width || 1;
              const imgH = img.height || 1;
              const baseScale = Math.min(PREVIEW_W / imgW, PREVIEW_H / imgH);
              img.set({
                scaleX: baseScale * zoom,
                scaleY: baseScale * zoom,
                originX: 'center',
                originY: 'center',
                left: PREVIEW_W / 2,
                top: PREVIEW_H / 2,
              });
              applyColorFilter(img);
              canvas.add(img);
            } catch (e) {
              console.error('Failed to load layer', layer.id, e);
            }
          }
        } else if (side?.imageUrl) {
          // Legacy single-image mode
          try {
            const img = await fabric.FabricImage.fromURL(side.imageUrl, { crossOrigin: 'anonymous' });
            if (disposed) { canvas.dispose(); return; }
            const imgW = img.width || 1;
            const imgH = img.height || 1;
            const baseScale = Math.min(PREVIEW_W / imgW, PREVIEW_H / imgH);
            img.set({
              scaleX: baseScale * zoom,
              scaleY: baseScale * zoom,
              originX: 'center',
              originY: 'center',
              left: PREVIEW_W / 2,
              top: PREVIEW_H / 2,
            });
            applyColorFilter(img);
            canvas.add(img);
          } catch (e) {
            console.error('Failed to load mockup image for', sideId, e);
          }
        }

        // 2. Load user objects on top, scaled from original 340x420 to preview
        if (stateValue) {
          const sideData = typeof stateValue === 'string' ? JSON.parse(stateValue) : stateValue;
          if (sideData?.objects?.length) {
            const tempCanvas = new fabric.StaticCanvas(undefined, { width: SRC_W, height: SRC_H });
            await tempCanvas.loadFromJSON({ version: sideData.version || '6.0.0', objects: sideData.objects });
            if (disposed) { tempCanvas.dispose(); canvas.dispose(); return; }

            const objs = tempCanvas.getObjects();
            for (const obj of objs) {
              tempCanvas.remove(obj);
              obj.set({
                left: (obj.left ?? 0) * SCALE_FACTOR,
                top: (obj.top ?? 0) * SCALE_FACTOR,
                scaleX: (obj.scaleX || 1) * SCALE_FACTOR,
                scaleY: (obj.scaleY || 1) * SCALE_FACTOR,
              });
              canvas.add(obj);
            }
            tempCanvas.dispose();
          }
        }

        canvas.renderAll();
      } catch (e) {
        console.error('Error rendering sketch for side', sideId, e);
      }
    };

    init();

    return () => {
      disposed = true;
      if (fabricRef.current) { try { fabricRef.current.dispose(); } catch {} }
      fabricRef.current = null;
    };
  }, [sideId, side, stateValue]);

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} className="rounded-lg" />
      <p className="text-[10px] text-gray-400 mt-1">{side?.name || sideId}</p>
    </div>
  );
}

// ============================================================================
// Request Detail Component
// ============================================================================

function RequestDetail({ requestId, onBack }: { requestId: string; onBack: () => void }) {
  const { data: requests } = useSWR<CoBuyRequest[]>(`/api/admin/cobuy/requests?status=all`, fetcher);
  const request = requests?.find(r => r.id === requestId);

  const { data: comments, mutate: mutateComments } = useSWR<CoBuyRequestComment[]>(
    `/api/admin/cobuy/requests/${requestId}/comments`,
    fetcher
  );

  const [commentText, setCommentText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [designIdInput, setDesignIdInput] = useState('');
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [confirmPrice, setConfirmPrice] = useState('');
  const [confirmStartDate, setConfirmStartDate] = useState('');
  const [confirmEndDate, setConfirmEndDate] = useState('');
  const [confirmReceiveByDate, setConfirmReceiveByDate] = useState('');

  const updateRequest = async (updates: Record<string, unknown>) => {
    setIsUpdating(true);
    try {
      const res = await fetch('/api/admin/cobuy/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, ...updates }),
      });
      if (!res.ok) throw new Error('Update failed');
      // Revalidate
      window.location.reload();
    } catch (error) {
      console.error('Failed to update:', error);
      alert('업데이트에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await fetch(`/api/admin/cobuy/requests/${requestId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      setCommentText('');
      mutateComments();
    } catch { /* ignore */ }
  };

  if (!request) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ChevronLeft className="w-4 h-4" /> 목록으로
      </button>

      <div className="space-y-4">
        {/* Request Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{request.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {(request as any).profiles?.email} · {formatDate(request.created_at)}
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[request.status]}`}>
              {statusLabels[request.status]}
            </span>
          </div>

          {request.description && (
            <p className="text-sm text-gray-600 mb-3">{request.description}</p>
          )}

          {/* Selected Product Color */}
          {(request.freeform_color_selections as any)?._productColor && (
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-medium text-gray-500">선택 색상</p>
              <div
                className="w-5 h-5 rounded-full border border-gray-300"
                style={{ backgroundColor: (request.freeform_color_selections as any)._productColor.hex }}
              />
              <span className="text-xs text-gray-700">
                {(request.freeform_color_selections as any)._productColor.name}
                {(request.freeform_color_selections as any)._productColor.colorCode &&
                  ` (${(request.freeform_color_selections as any)._productColor.colorCode})`}
              </span>
            </div>
          )}

          {/* Freeform Sketch — all product sides with user objects overlaid */}
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 mb-1.5">사용자 스케치</p>
            <FreeformSketchPreview
              canvasState={request.freeform_canvas_state || {}}
              productSides={(request as any).product?.configuration}
              productColorHex={(request.freeform_color_selections as any)?._productColor?.hex}
            />
          </div>

          {/* Admin Design Preview */}
          {request.admin_design_preview_url && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">관리자 디자인</p>
              <div className="w-48 h-48 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden">
                <img src={request.admin_design_preview_url} alt="Admin design" className="w-full h-full object-contain" />
              </div>
            </div>
          )}

          {/* Request Details */}
          <div className="grid grid-cols-2 gap-3 text-xs mt-3 pt-3 border-t border-gray-100">
            <div>
              <p className="text-gray-500">제품</p>
              <p className="font-medium">{(request as any).product?.title || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">공개 여부</p>
              <p className="font-medium">{request.is_public ? '공개' : '비공개'}</p>
            </div>
            {request.confirmed_price && (
              <div>
                <p className="text-gray-500">확정 가격</p>
                <p className="font-medium">₩{Number(request.confirmed_price).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-900 mb-3">작업</p>
          <div className="flex flex-wrap gap-2">
            {request.status === 'pending' && (
              <button
                onClick={() => updateRequest({ status: 'in_progress' })}
                disabled={isUpdating}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" /> 작업 시작
              </button>
            )}

            {(request.status === 'in_progress' || request.status === 'feedback') && (
              <>
                <a
                  href={`/editor/${request.product_id}?mode=design&cobuyRequestId=${request.id}`}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> 에디터 열기
                </a>

                {/* Link Design */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={designIdInput}
                    onChange={e => setDesignIdInput(e.target.value)}
                    placeholder="디자인 ID"
                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg w-48"
                  />
                  <button
                    onClick={async () => {
                      if (!designIdInput.trim()) return;
                      // Fetch the design to get its preview
                      const res = await fetch(`/api/admin/designs/${designIdInput.trim()}`);
                      if (res.ok) {
                        const design = await res.json();
                        await updateRequest({
                          admin_design_id: designIdInput.trim(),
                          admin_design_preview_url: design.preview_url || null,
                        });
                      } else {
                        alert('디자인을 찾을 수 없습니다.');
                      }
                    }}
                    disabled={isUpdating}
                    className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Link2 className="w-3.5 h-3.5" /> 디자인 연결
                  </button>
                </div>
              </>
            )}

            {request.admin_design_id && request.status === 'in_progress' && (
              <button
                onClick={() => updateRequest({ status: 'design_shared' })}
                disabled={isUpdating}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> 사용자에게 공유
              </button>
            )}

            {(request.status === 'feedback' || request.status === 'design_shared') && request.admin_design_id && (
              <button
                onClick={() => setShowConfirmForm(true)}
                disabled={isUpdating}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" /> 디자인 확정 및 세션 생성
              </button>
            )}

            {request.status !== 'rejected' && request.status !== 'session_created' && (
              <button
                onClick={() => {
                  if (confirm('이 요청을 거절하시겠습니까?')) {
                    updateRequest({ status: 'rejected' });
                  }
                }}
                disabled={isUpdating}
                className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" /> 거절
              </button>
            )}
          </div>
        </div>

        {/* Confirm & Create Session Form */}
        {showConfirmForm && (
          <div className="bg-white border border-green-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-3">세션 생성 정보</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">확정 가격 (원) *</label>
                <input
                  type="number"
                  value={confirmPrice}
                  onChange={e => setConfirmPrice(e.target.value)}
                  placeholder="예: 25000"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">모집 시작일 *</label>
                  <input
                    type="date"
                    value={confirmStartDate}
                    onChange={e => setConfirmStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">모집 종료일 *</label>
                  <input
                    type="date"
                    value={confirmEndDate}
                    onChange={e => setConfirmEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">수령 예정일 (선택)</label>
                <input
                  type="date"
                  value={confirmReceiveByDate}
                  onChange={e => setConfirmReceiveByDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={async () => {
                    if (!confirmPrice || !confirmStartDate || !confirmEndDate) {
                      alert('가격, 시작일, 종료일은 필수입니다.');
                      return;
                    }
                    setIsUpdating(true);
                    try {
                      const res = await fetch(`/api/admin/cobuy/requests/${requestId}/confirm`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          confirmed_price: Number(confirmPrice),
                          start_date: new Date(confirmStartDate).toISOString(),
                          end_date: new Date(confirmEndDate).toISOString(),
                          receive_by_date: confirmReceiveByDate ? new Date(confirmReceiveByDate).toISOString() : null,
                        }),
                      });
                      if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || 'Failed');
                      }
                      alert('공동구매 세션이 생성되었습니다!');
                      window.location.reload();
                    } catch (err: any) {
                      alert(err.message || '세션 생성에 실패했습니다.');
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                  disabled={isUpdating}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {isUpdating ? '생성 중...' : '확정 및 세션 생성'}
                </button>
                <button
                  onClick={() => setShowConfirmForm(false)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Session Created Info */}
        {request.status === 'session_created' && request.cobuy_session_id && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-sm font-medium text-emerald-800 mb-1">공동구매 세션 생성됨</p>
            <p className="text-xs text-emerald-700">세션 ID: {request.cobuy_session_id}</p>
            {request.confirmed_price && (
              <p className="text-xs text-emerald-700">확정 가격: ₩{Number(request.confirmed_price).toLocaleString()}</p>
            )}
          </div>
        )}

        {/* Comments */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" /> 댓글 ({comments?.length || 0})
          </p>

          <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
            {comments?.map(comment => (
              <div key={comment.id} className={`p-2.5 rounded-lg text-xs ${comment.is_admin ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`font-medium ${comment.is_admin ? 'text-blue-700' : 'text-gray-700'}`}>
                    {comment.is_admin ? '관리자' : ((comment as any).profiles?.name || (comment as any).profiles?.email || '사용자')}
                  </span>
                  <span className="text-gray-400">{formatDate(comment.created_at)}</span>
                </div>
                <p className="text-gray-600">{comment.content}</p>
              </div>
            )) || null}
            {(!comments || comments.length === 0) && (
              <p className="text-xs text-gray-400 text-center py-4">댓글이 없습니다.</p>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
              placeholder="관리자 댓글 작성..."
              className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={addComment}
              disabled={!commentText.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <Send className="w-3 h-3" /> 전송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
