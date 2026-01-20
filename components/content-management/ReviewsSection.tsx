'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ReviewRecord } from './types';
import { formatDate } from './utils';

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/reviews');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '리뷰 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setReviews(payload?.data || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setReviews([]);
      setError(err instanceof Error ? err.message : '리뷰 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    const confirmed = window.confirm('이 리뷰를 삭제할까요?');
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(`/api/admin/reviews?id=${reviewId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '리뷰 삭제에 실패했습니다.');
      }

      setReviews((prev) => prev.filter((review) => review.id !== reviewId));
    } catch (err) {
      console.error('Error deleting review:', err);
      setError(err instanceof Error ? err.message : '리뷰 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center text-gray-500">
          등록된 리뷰가 없습니다.
        </div>
      ) : (
        <div className="grid gap-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white border border-gray-200/60 rounded-md shadow-sm p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500">제품</p>
                  <p className="text-sm font-medium text-gray-900">
                    {review.product?.title || review.product_id}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">평점 {review.rating}</p>
                  {review.is_verified_purchase && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                      구매 인증
                    </span>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">{review.title}</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.content}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{review.author_name}</span>
                <span>{formatDate(review.created_at)}</span>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => handleDeleteReview(review.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
