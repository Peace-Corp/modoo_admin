'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase-client';
import { uploadFileToStorage } from '@/lib/supabase-storage';
import { Edit2, Plus, Star, Trash2, X, Award } from 'lucide-react';
import type { ReviewRecord, ProductSummary, ReviewFormState } from './types';
import {
  REVIEW_IMAGE_BUCKET,
  REVIEW_IMAGE_FOLDER,
  emptyReviewForm,
  sortReviews,
  formatDate,
} from './utils';

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(emptyReviewForm);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewFormError, setReviewFormError] = useState<string | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchReviews();
    fetchProducts();
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
      setReviews(sortReviews(payload?.data || []));
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setReviews([]);
      setError(err instanceof Error ? err.message : '리뷰 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, title')
        .order('title', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      setProducts([]);
    }
  };

  const handleFormToggle = () => {
    setReviewFormOpen((prev) => !prev);
    setReviewFormError(null);
    if (reviewFormOpen) {
      setReviewForm(emptyReviewForm);
    }
  };

  const handleEdit = (review: ReviewRecord) => {
    setReviewForm({
      id: review.id,
      product_id: review.product_id,
      rating: review.rating,
      title: review.title,
      content: review.content,
      author_name: review.author_name,
      is_verified_purchase: Boolean(review.is_verified_purchase),
      is_best: Boolean(review.is_best),
      review_image_urls: review.review_image_urls || [],
    });
    setReviewFormOpen(true);
    setReviewFormError(null);
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setReviewFormError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setUploadingImage(true);
    setReviewFormError(null);

    try {
      const supabase = createClient();
      const uploadResult = await uploadFileToStorage(
        supabase,
        file,
        REVIEW_IMAGE_BUCKET,
        REVIEW_IMAGE_FOLDER
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || '이미지 업로드에 실패했습니다.');
      }

      setReviewForm((prev) => ({
        ...prev,
        review_image_urls: [...prev.review_image_urls, uploadResult.url!],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.';
      setReviewFormError(message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      handleImageUpload(file);
    });
    event.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setReviewForm((prev) => ({
      ...prev,
      review_image_urls: prev.review_image_urls.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setReviewFormError(null);

    if (uploadingImage) {
      setReviewFormError('이미지 업로드가 완료될 때까지 기다려주세요.');
      return;
    }

    if (!reviewForm.product_id) {
      setReviewFormError('제품을 선택해주세요.');
      return;
    }

    if (!reviewForm.title.trim()) {
      setReviewFormError('제목을 입력해주세요.');
      return;
    }

    if (!reviewForm.content.trim()) {
      setReviewFormError('내용을 입력해주세요.');
      return;
    }

    if (!reviewForm.author_name.trim()) {
      setReviewFormError('작성자명을 입력해주세요.');
      return;
    }

    setSavingReview(true);
    setError(null);

    const payload = {
      id: reviewForm.id ?? undefined,
      product_id: reviewForm.product_id,
      rating: reviewForm.rating,
      title: reviewForm.title.trim(),
      content: reviewForm.content.trim(),
      author_name: reviewForm.author_name.trim(),
      is_verified_purchase: reviewForm.is_verified_purchase,
      is_best: reviewForm.is_best,
      review_image_urls: reviewForm.review_image_urls,
    };

    try {
      const response = await fetch('/api/admin/reviews', {
        method: reviewForm.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '리뷰 저장에 실패했습니다.');
      }

      const responsePayload = await response.json();
      const savedReview = responsePayload?.data as ReviewRecord;

      setReviews((prev) => {
        const updated = reviewForm.id
          ? prev.map((review) => (review.id === savedReview.id ? savedReview : review))
          : [savedReview, ...prev];
        return sortReviews(updated);
      });

      setReviewForm(emptyReviewForm);
      setReviewFormOpen(false);
    } catch (err) {
      console.error('Error saving review:', err);
      setError(err instanceof Error ? err.message : '리뷰 저장에 실패했습니다.');
    } finally {
      setSavingReview(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
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

  const handleToggleBest = async (review: ReviewRecord) => {
    setError(null);
    try {
      const response = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: review.id,
          is_best: !review.is_best,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'BEST 상태 변경에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedReview = payload?.data as ReviewRecord;
      setReviews((prev) =>
        sortReviews(prev.map((item) => (item.id === updatedReview.id ? updatedReview : item)))
      );
    } catch (err) {
      console.error('Error toggling best review:', err);
      setError(err instanceof Error ? err.message : 'BEST 상태 변경에 실패했습니다.');
    }
  };

  const renderStars = (rating: number, interactive = false) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && setReviewForm((prev) => ({ ...prev, rating: star }))}
            className={interactive ? 'cursor-pointer' : 'cursor-default'}
          >
            <Star
              className={`w-5 h-5 ${
                star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">리뷰 관리</h3>
            <p className="text-sm text-gray-500">리뷰를 직접 등록하고 관리하세요. BEST 리뷰는 홈페이지에 노출됩니다.</p>
          </div>
          <button
            onClick={handleFormToggle}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {reviewFormOpen ? '입력 닫기' : '새 리뷰 추가'}
          </button>
        </div>

        {reviewFormOpen && (
          <div className="bg-gray-50 rounded-md p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                제품 선택 *
                <select
                  value={reviewForm.product_id}
                  onChange={(event) =>
                    setReviewForm((prev) => ({ ...prev, product_id: event.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                >
                  <option value="">제품 선택</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                작성자명 *
                <input
                  type="text"
                  value={reviewForm.author_name}
                  onChange={(event) =>
                    setReviewForm((prev) => ({ ...prev, author_name: event.target.value }))
                  }
                  placeholder="홍길동"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm text-gray-700">
                <span>평점 *</span>
                {renderStars(reviewForm.rating, true)}
              </div>
              <label className="space-y-2 text-sm text-gray-700">
                제목 *
                <input
                  type="text"
                  value={reviewForm.title}
                  onChange={(event) =>
                    setReviewForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="리뷰 제목"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </label>
            </div>
            <label className="space-y-2 text-sm text-gray-700">
              내용 *
              <textarea
                value={reviewForm.content}
                onChange={(event) =>
                  setReviewForm((prev) => ({ ...prev, content: event.target.value }))
                }
                placeholder="리뷰 내용을 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={4}
              />
            </label>

            {/* Image Upload */}
            <div className="space-y-3 text-sm text-gray-700">
              <label className="space-y-2">
                이미지 업로드
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageInputChange}
                  disabled={uploadingImage}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                />
                {uploadingImage && (
                  <span className="text-xs text-gray-500">업로드 중...</span>
                )}
              </label>
              {reviewForm.review_image_urls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {reviewForm.review_image_urls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`리뷰 이미지 ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-md border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkboxes */}
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={reviewForm.is_verified_purchase}
                  onChange={(event) =>
                    setReviewForm((prev) => ({ ...prev, is_verified_purchase: event.target.checked }))
                  }
                  className="rounded border-gray-300"
                />
                구매 인증
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={reviewForm.is_best}
                  onChange={(event) =>
                    setReviewForm((prev) => ({ ...prev, is_best: event.target.checked }))
                  }
                  className="rounded border-gray-300"
                />
                <span className="flex items-center gap-1">
                  <Award className="w-4 h-4 text-yellow-500" />
                  BEST 리뷰
                </span>
              </label>
            </div>

            {reviewFormError && (
              <p className="text-sm text-red-600">{reviewFormError}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setReviewForm(emptyReviewForm);
                  setReviewFormOpen(false);
                  setReviewFormError(null);
                }}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={savingReview || uploadingImage}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {savingReview
                  ? '저장 중...'
                  : uploadingImage
                    ? '이미지 업로드 중...'
                    : '저장'}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center text-gray-500">
          등록된 리뷰가 없습니다.
        </div>
      ) : (
        <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이미지
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    제품
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    제목 / 내용
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    평점
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작성자
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reviews.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {review.review_image_urls && review.review_image_urls.length > 0 ? (
                        <div className="flex -space-x-2">
                          {review.review_image_urls.slice(0, 3).map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`리뷰 이미지 ${idx + 1}`}
                              className="w-12 h-12 object-cover rounded-md border-2 border-white"
                            />
                          ))}
                          {review.review_image_urls.length > 3 && (
                            <div className="w-12 h-12 rounded-md bg-gray-200 flex items-center justify-center text-xs text-gray-600 border-2 border-white">
                              +{review.review_image_urls.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 text-xs">
                          없음
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {review.product?.title || review.product_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{review.title}</div>
                      <div className="text-xs text-gray-500 max-w-xs truncate">
                        {review.content}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {renderStars(review.rating)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{review.author_name}</div>
                      <div className="text-xs text-gray-500">{formatDate(review.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {review.is_verified_purchase && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                            구매 인증
                          </span>
                        )}
                        <button
                          onClick={() => handleToggleBest(review)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            review.is_best
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <Award className="w-3 h-3" />
                          {review.is_best ? 'BEST' : 'BEST 지정'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(review)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          편집
                        </button>
                        <button
                          onClick={() => handleDelete(review.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
