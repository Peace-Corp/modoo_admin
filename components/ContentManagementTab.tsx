'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase-client';
import { uploadFileToStorage } from '@/lib/supabase-storage';
import { ChevronDown, ChevronUp, Edit2, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';

type SectionKey = 'reviews' | 'examples' | 'heroBanners' | 'announcements' | 'faqs' | 'inquiries';

type ProductSummary = {
  id: string;
  title: string;
};

type ReviewRecord = {
  id: string;
  product_id: string;
  rating: number;
  title: string;
  content: string;
  author_name: string;
  is_verified_purchase: boolean | null;
  helpful_count: number | null;
  created_at: string;
  product?: ProductSummary | null;
};

type ProductionExampleRecord = {
  id: string;
  product_id: string;
  title: string;
  description: string;
  image_url: string;
  sort_order: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  product?: ProductSummary | null;
};

type HeroBannerRecord = {
  id: string;
  title: string;
  subtitle: string;
  image_link: string | null;
  redirect_link: string | null;
  sort_order: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

type AnnouncementRecord = {
  id: string;
  title: string;
  content: string;
  is_published: boolean | null;
  image_links: string[] | null;
  created_at: string;
  updated_at: string;
};

type FaqRecord = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  tags: string[] | null;
  sort_order: number;
  is_published: boolean | null;
  created_at: string;
  updated_at: string;
};

type InquiryStatus = 'pending' | 'ongoing' | 'completed';

type InquiryProductRecord = {
  id: string;
  product_id: string;
  product?: ProductSummary | null;
};

type InquiryReplyRecord = {
  id: string;
  content: string;
  admin_id: string | null;
  created_at: string;
};

type InquiryRecord = {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
  inquiry_products?: InquiryProductRecord[] | null;
  inquiry_replies?: InquiryReplyRecord[] | null;
};

type ExampleFormState = {
  id?: string | null;
  product_id: string;
  title: string;
  description: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
};

type AnnouncementFormState = {
  id?: string | null;
  title: string;
  content: string;
  is_published: boolean;
  image_links: string[];
};

type HeroBannerFormState = {
  id?: string | null;
  title: string;
  subtitle: string;
  image_link: string;
  redirect_link: string;
  sort_order: number;
  is_active: boolean;
};

type FaqFormState = {
  id?: string | null;
  question: string;
  answer: string;
  category: string;
  tags: string;
  sort_order: number;
  is_published: boolean;
};

const emptyExampleForm: ExampleFormState = {
  product_id: '',
  title: '',
  description: '',
  image_url: '',
  sort_order: 0,
  is_active: true,
};

const emptyHeroBannerForm: HeroBannerFormState = {
  title: '',
  subtitle: '',
  image_link: '',
  redirect_link: '',
  sort_order: 0,
  is_active: true,
};

const emptyAnnouncementForm: AnnouncementFormState = {
  title: '',
  content: '',
  is_published: true,
  image_links: [],
};

const emptyFaqForm: FaqFormState = {
  question: '',
  answer: '',
  category: '',
  tags: '',
  sort_order: 0,
  is_published: true,
};

const EXAMPLE_IMAGE_BUCKET = 'products';
const EXAMPLE_IMAGE_FOLDER = 'production-examples';
const BANNER_IMAGE_BUCKET = 'products';
const BANNER_IMAGE_FOLDER = 'hero-banners';
const ANNOUNCEMENT_IMAGE_BUCKET = 'products';
const ANNOUNCEMENT_IMAGE_FOLDER = 'announcements';

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const sortExamples = (examples: ProductionExampleRecord[]) => {
  return [...examples].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

const sortHeroBanners = (banners: HeroBannerRecord[]) => {
  return [...banners].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

const sortAnnouncements = (announcements: AnnouncementRecord[]) => {
  return [...announcements].sort((a, b) => {
    if (a.created_at === b.created_at) return 0;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

const sortFaqs = (faqs: FaqRecord[]) => {
  return [...faqs].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

export default function ContentManagementTab() {
  const [activeSection, setActiveSection] = useState<SectionKey>('reviews');
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [productionExamples, setProductionExamples] = useState<ProductionExampleRecord[]>([]);
  const [heroBanners, setHeroBanners] = useState<HeroBannerRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [faqs, setFaqs] = useState<FaqRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState<Record<SectionKey, boolean>>({
    reviews: true,
    examples: true,
    heroBanners: true,
    announcements: true,
    faqs: true,
    inquiries: true,
  });
  const [errors, setErrors] = useState<Record<SectionKey, string | null>>({
    reviews: null,
    examples: null,
    heroBanners: null,
    announcements: null,
    faqs: null,
    inquiries: null,
  });
  const [exampleForm, setExampleForm] = useState<ExampleFormState>(emptyExampleForm);
  const [exampleFormOpen, setExampleFormOpen] = useState(false);
  const [exampleFormError, setExampleFormError] = useState<string | null>(null);
  const [savingExample, setSavingExample] = useState(false);
  const [uploadingExampleImage, setUploadingExampleImage] = useState(false);
  const [bannerForm, setBannerForm] = useState<HeroBannerFormState>(emptyHeroBannerForm);
  const [bannerFormOpen, setBannerFormOpen] = useState(false);
  const [bannerFormError, setBannerFormError] = useState<string | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementFormState>(emptyAnnouncementForm);
  const [announcementFormOpen, setAnnouncementFormOpen] = useState(false);
  const [announcementFormError, setAnnouncementFormError] = useState<string | null>(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [uploadingAnnouncementImages, setUploadingAnnouncementImages] = useState(0);
  const [faqForm, setFaqForm] = useState<FaqFormState>(emptyFaqForm);
  const [faqFormOpen, setFaqFormOpen] = useState(false);
  const [faqFormError, setFaqFormError] = useState<string | null>(null);
  const [savingFaq, setSavingFaq] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
    fetchProductionExamples();
    fetchHeroBanners();
    fetchAnnouncements();
    fetchFaqs();
    fetchInquiries();
    fetchProducts();
  }, []);

  const fetchReviews = async () => {
    setLoading((prev) => ({ ...prev, reviews: true }));
    setErrors((prev) => ({ ...prev, reviews: null }));
    try {
      const response = await fetch('/api/admin/reviews');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '리뷰 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setReviews(payload?.data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
      setErrors((prev) => ({
        ...prev,
        reviews: error instanceof Error ? error.message : '리뷰 데이터를 불러오지 못했습니다.',
      }));
    } finally {
      setLoading((prev) => ({ ...prev, reviews: false }));
    }
  };

  const fetchProductionExamples = async () => {
    setLoading((prev) => ({ ...prev, examples: true }));
    setErrors((prev) => ({ ...prev, examples: null }));
    try {
      const response = await fetch('/api/admin/production-examples');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '제작 사례 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setProductionExamples(sortExamples(payload?.data || []));
    } catch (error) {
      console.error('Error fetching production examples:', error);
      setProductionExamples([]);
      setErrors((prev) => ({
        ...prev,
        examples: error instanceof Error ? error.message : '제작 사례 데이터를 불러오지 못했습니다.',
      }));
    } finally {
      setLoading((prev) => ({ ...prev, examples: false }));
    }
  };

  const fetchHeroBanners = async () => {
    setLoading((prev) => ({ ...prev, heroBanners: true }));
    setErrors((prev) => ({ ...prev, heroBanners: null }));
    try {
      const response = await fetch('/api/admin/hero-banners');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '히어로 배너 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setHeroBanners(sortHeroBanners(payload?.data || []));
    } catch (error) {
      console.error('Error fetching hero banners:', error);
      setHeroBanners([]);
      setErrors((prev) => ({
        ...prev,
        heroBanners:
          error instanceof Error ? error.message : '히어로 배너 데이터를 불러오지 못했습니다.',
      }));
    } finally {
      setLoading((prev) => ({ ...prev, heroBanners: false }));
    }
  };

  const fetchAnnouncements = async () => {
    setLoading((prev) => ({ ...prev, announcements: true }));
    setErrors((prev) => ({ ...prev, announcements: null }));
    try {
      const response = await fetch('/api/admin/announcements');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공지 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setAnnouncements(sortAnnouncements(payload?.data || []));
    } catch (error) {
      console.error('Error fetching announcements:', error);
      setAnnouncements([]);
      setErrors((prev) => ({
        ...prev,
        announcements:
          error instanceof Error ? error.message : '공지 데이터를 불러오지 못했습니다.',
      }));
    } finally {
      setLoading((prev) => ({ ...prev, announcements: false }));
    }
  };

  const fetchFaqs = async () => {
    setLoading((prev) => ({ ...prev, faqs: true }));
    setErrors((prev) => ({ ...prev, faqs: null }));
    try {
      const response = await fetch('/api/admin/faqs');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'FAQ 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setFaqs(sortFaqs(payload?.data || []));
    } catch (error) {
      console.error('Error fetching faqs:', error);
      setFaqs([]);
      setErrors((prev) => ({
        ...prev,
        faqs: error instanceof Error ? error.message : 'FAQ 데이터를 불러오지 못했습니다.',
      }));
    } finally {
      setLoading((prev) => ({ ...prev, faqs: false }));
    }
  };

  const fetchInquiries = async () => {
    setLoading((prev) => ({ ...prev, inquiries: true }));
    setErrors((prev) => ({ ...prev, inquiries: null }));
    try {
      const response = await fetch('/api/admin/inquiries');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '문의 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setInquiries(payload?.data || []);
    } catch (error) {
      console.error('Error fetching inquiries:', error);
      setInquiries([]);
      setErrors((prev) => ({
        ...prev,
        inquiries: error instanceof Error ? error.message : '문의 데이터를 불러오지 못했습니다.',
      }));
    } finally {
      setLoading((prev) => ({ ...prev, inquiries: false }));
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
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

  const sectionTabs = useMemo(
    () => [
      { key: 'reviews', label: '리뷰', count: reviews.length },
      { key: 'examples', label: '제작 사례', count: productionExamples.length },
      { key: 'heroBanners', label: '히어로 배너', count: heroBanners.length },
      { key: 'announcements', label: '공지', count: announcements.length },
      { key: 'faqs', label: 'FAQ', count: faqs.length },
      { key: 'inquiries', label: '문의', count: inquiries.length },
    ],
    [
      reviews.length,
      productionExamples.length,
      heroBanners.length,
      announcements.length,
      faqs.length,
      inquiries.length,
    ]
  );

  const handleDeleteReview = async (reviewId: string) => {
    const confirmed = window.confirm('이 리뷰를 삭제할까요?');
    if (!confirmed) return;

    setErrors((prev) => ({ ...prev, reviews: null }));
    try {
      const response = await fetch(`/api/admin/reviews?id=${reviewId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '리뷰 삭제에 실패했습니다.');
      }

      setReviews((prev) => prev.filter((review) => review.id !== reviewId));
    } catch (error) {
      console.error('Error deleting review:', error);
      setErrors((prev) => ({
        ...prev,
        reviews: error instanceof Error ? error.message : '리뷰 삭제에 실패했습니다.',
      }));
    }
  };

  const handleExampleFormToggle = () => {
    setExampleFormOpen((prev) => !prev);
    setExampleFormError(null);
    if (exampleFormOpen) {
      setExampleForm(emptyExampleForm);
    }
  };

  const handleExampleEdit = (example: ProductionExampleRecord) => {
    setExampleForm({
      id: example.id,
      product_id: example.product_id,
      title: example.title,
      description: example.description ?? '',
      image_url: example.image_url ?? '',
      sort_order: example.sort_order ?? 0,
      is_active: Boolean(example.is_active),
    });
    setExampleFormOpen(true);
    setExampleFormError(null);
  };

  const handleExampleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setExampleFormError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setUploadingExampleImage(true);
    setExampleFormError(null);

    try {
      const supabase = createClient();
      const uploadResult = await uploadFileToStorage(
        supabase,
        file,
        EXAMPLE_IMAGE_BUCKET,
        EXAMPLE_IMAGE_FOLDER
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || '이미지 업로드에 실패했습니다.');
      }

      setExampleForm((prev) => ({ ...prev, image_url: uploadResult.url ?? '' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.';
      setExampleFormError(message);
    } finally {
      setUploadingExampleImage(false);
    }
  };

  const handleExampleImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleExampleImageUpload(file);
    event.target.value = '';
  };

  const handleExampleSave = async () => {
    setExampleFormError(null);

    if (uploadingExampleImage) {
      setExampleFormError('이미지 업로드가 완료될 때까지 기다려주세요.');
      return;
    }

    if (!exampleForm.product_id) {
      setExampleFormError('제품을 선택해주세요.');
      return;
    }

    if (!exampleForm.title.trim()) {
      setExampleFormError('제목을 입력해주세요.');
      return;
    }

    if (!exampleForm.image_url.trim()) {
      setExampleFormError('이미지 URL을 입력하거나 이미지를 업로드해주세요.');
      return;
    }

    setSavingExample(true);
    setErrors((prev) => ({ ...prev, examples: null }));

    const payload = {
      id: exampleForm.id ?? undefined,
      product_id: exampleForm.product_id,
      title: exampleForm.title.trim(),
      description: exampleForm.description.trim(),
      image_url: exampleForm.image_url.trim(),
      sort_order: exampleForm.sort_order,
      is_active: exampleForm.is_active,
    };

    try {
      const response = await fetch('/api/admin/production-examples', {
        method: exampleForm.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '제작 사례 저장에 실패했습니다.');
      }

      const responsePayload = await response.json();
      const savedExample = responsePayload?.data as ProductionExampleRecord;

      setProductionExamples((prev) => {
        const updated = exampleForm.id
          ? prev.map((example) => (example.id === savedExample.id ? savedExample : example))
          : [savedExample, ...prev];
        return sortExamples(updated);
      });

      setExampleForm(emptyExampleForm);
      setExampleFormOpen(false);
    } catch (error) {
      console.error('Error saving production example:', error);
      setErrors((prev) => ({
        ...prev,
        examples: error instanceof Error ? error.message : '제작 사례 저장에 실패했습니다.',
      }));
    } finally {
      setSavingExample(false);
    }
  };

  const handleExampleDelete = async (exampleId: string) => {
    const confirmed = window.confirm('이 제작 사례를 삭제할까요?');
    if (!confirmed) return;

    setErrors((prev) => ({ ...prev, examples: null }));
    try {
      const response = await fetch(`/api/admin/production-examples?id=${exampleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '제작 사례 삭제에 실패했습니다.');
      }

      setProductionExamples((prev) => prev.filter((example) => example.id !== exampleId));
    } catch (error) {
      console.error('Error deleting production example:', error);
      setErrors((prev) => ({
        ...prev,
        examples: error instanceof Error ? error.message : '제작 사례 삭제에 실패했습니다.',
      }));
    }
  };

  const handleExampleToggle = async (example: ProductionExampleRecord) => {
    setErrors((prev) => ({ ...prev, examples: null }));
    try {
      const response = await fetch('/api/admin/production-examples', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: example.id,
          is_active: !example.is_active,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '활성 상태 변경에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedExample = payload?.data as ProductionExampleRecord;
      setProductionExamples((prev) =>
        sortExamples(prev.map((item) => (item.id === updatedExample.id ? updatedExample : item)))
      );
    } catch (error) {
      console.error('Error toggling production example:', error);
      setErrors((prev) => ({
        ...prev,
        examples: error instanceof Error ? error.message : '활성 상태 변경에 실패했습니다.',
      }));
    }
  };

  const handleBannerFormToggle = () => {
    setBannerFormOpen((prev) => !prev);
    setBannerFormError(null);
    if (bannerFormOpen) {
      setBannerForm(emptyHeroBannerForm);
    }
  };

  const handleBannerEdit = (banner: HeroBannerRecord) => {
    setBannerForm({
      id: banner.id,
      title: banner.title ?? '',
      subtitle: banner.subtitle ?? '',
      image_link: banner.image_link ?? '',
      redirect_link: banner.redirect_link ?? '',
      sort_order: banner.sort_order ?? 0,
      is_active: Boolean(banner.is_active),
    });
    setBannerFormOpen(true);
    setBannerFormError(null);
  };

  const handleBannerImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setBannerFormError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setUploadingBannerImage(true);
    setBannerFormError(null);

    try {
      const supabase = createClient();
      const uploadResult = await uploadFileToStorage(
        supabase,
        file,
        BANNER_IMAGE_BUCKET,
        BANNER_IMAGE_FOLDER
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || '이미지 업로드에 실패했습니다.');
      }

      setBannerForm((prev) => ({ ...prev, image_link: uploadResult.url ?? '' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.';
      setBannerFormError(message);
    } finally {
      setUploadingBannerImage(false);
    }
  };

  const handleBannerImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleBannerImageUpload(file);
    event.target.value = '';
  };

  const handleBannerSave = async () => {
    setBannerFormError(null);

    if (uploadingBannerImage) {
      setBannerFormError('이미지 업로드가 완료될 때까지 기다려주세요.');
      return;
    }

    if (!bannerForm.title.trim()) {
      setBannerFormError('제목을 입력해주세요.');
      return;
    }

    if (!bannerForm.subtitle.trim()) {
      setBannerFormError('부제목을 입력해주세요.');
      return;
    }

    if (!bannerForm.image_link.trim()) {
      setBannerFormError('이미지 URL을 입력하거나 이미지를 업로드해주세요.');
      return;
    }

    setSavingBanner(true);
    setErrors((prev) => ({ ...prev, heroBanners: null }));

    const payload = {
      id: bannerForm.id ?? undefined,
      title: bannerForm.title.trim(),
      subtitle: bannerForm.subtitle.trim(),
      image_link: bannerForm.image_link.trim(),
      redirect_link: bannerForm.redirect_link.trim() || null,
      sort_order: bannerForm.sort_order,
      is_active: bannerForm.is_active,
    };

    try {
      const response = await fetch('/api/admin/hero-banners', {
        method: bannerForm.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '히어로 배너 저장에 실패했습니다.');
      }

      const responsePayload = await response.json();
      const savedBanner = responsePayload?.data as HeroBannerRecord;

      setHeroBanners((prev) => {
        const updated = bannerForm.id
          ? prev.map((banner) => (banner.id === savedBanner.id ? savedBanner : banner))
          : [savedBanner, ...prev];
        return sortHeroBanners(updated);
      });

      setBannerForm(emptyHeroBannerForm);
      setBannerFormOpen(false);
    } catch (error) {
      console.error('Error saving hero banner:', error);
      setErrors((prev) => ({
        ...prev,
        heroBanners: error instanceof Error ? error.message : '히어로 배너 저장에 실패했습니다.',
      }));
    } finally {
      setSavingBanner(false);
    }
  };

  const handleBannerDelete = async (bannerId: string) => {
    const confirmed = window.confirm('이 히어로 배너를 삭제할까요?');
    if (!confirmed) return;

    setErrors((prev) => ({ ...prev, heroBanners: null }));
    try {
      const response = await fetch(`/api/admin/hero-banners?id=${bannerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '히어로 배너 삭제에 실패했습니다.');
      }

      setHeroBanners((prev) => prev.filter((banner) => banner.id !== bannerId));
    } catch (error) {
      console.error('Error deleting hero banner:', error);
      setErrors((prev) => ({
        ...prev,
        heroBanners: error instanceof Error ? error.message : '히어로 배너 삭제에 실패했습니다.',
      }));
    }
  };

  const handleBannerToggle = async (banner: HeroBannerRecord) => {
    setErrors((prev) => ({ ...prev, heroBanners: null }));
    try {
      const response = await fetch('/api/admin/hero-banners', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: banner.id,
          is_active: !banner.is_active,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '활성 상태 변경에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedBanner = payload?.data as HeroBannerRecord;
      setHeroBanners((prev) =>
        sortHeroBanners(prev.map((item) => (item.id === updatedBanner.id ? updatedBanner : item)))
      );
    } catch (error) {
      console.error('Error toggling hero banner:', error);
      setErrors((prev) => ({
        ...prev,
        heroBanners: error instanceof Error ? error.message : '활성 상태 변경에 실패했습니다.',
      }));
    }
  };

  const handleAnnouncementFormToggle = () => {
    setAnnouncementFormOpen((prev) => !prev);
    setAnnouncementFormError(null);
    if (announcementFormOpen) {
      setAnnouncementForm(emptyAnnouncementForm);
    }
  };

  const handleAnnouncementEdit = (announcement: AnnouncementRecord) => {
    setAnnouncementForm({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      is_published: Boolean(announcement.is_published),
      image_links: announcement.image_links || [],
    });
    setAnnouncementFormOpen(true);
    setAnnouncementFormError(null);
  };

  const handleAnnouncementImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setAnnouncementFormError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setUploadingAnnouncementImages((prev) => prev + 1);
    setAnnouncementFormError(null);

    try {
      const supabase = createClient();
      const uploadResult = await uploadFileToStorage(
        supabase,
        file,
        ANNOUNCEMENT_IMAGE_BUCKET,
        ANNOUNCEMENT_IMAGE_FOLDER
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || '이미지 업로드에 실패했습니다.');
      }

      setAnnouncementForm((prev) => ({
        ...prev,
        image_links: [...prev.image_links, uploadResult.url ?? ''],
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.';
      setAnnouncementFormError(message);
    } finally {
      setUploadingAnnouncementImages((prev) => Math.max(prev - 1, 0));
    }
  };

  const handleAnnouncementImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.forEach((file) => handleAnnouncementImageUpload(file));
    event.target.value = '';
  };

  const handleRemoveAnnouncementImage = (imageLink: string) => {
    setAnnouncementForm((prev) => ({
      ...prev,
      image_links: prev.image_links.filter((link) => link !== imageLink),
    }));
  };

  const handleAnnouncementSave = async () => {
    setAnnouncementFormError(null);

    if (uploadingAnnouncementImages > 0) {
      setAnnouncementFormError('이미지 업로드가 완료될 때까지 기다려주세요.');
      return;
    }

    if (!announcementForm.title.trim()) {
      setAnnouncementFormError('제목을 입력해주세요.');
      return;
    }

    if (!announcementForm.content.trim()) {
      setAnnouncementFormError('내용을 입력해주세요.');
      return;
    }

    setSavingAnnouncement(true);
    setErrors((prev) => ({ ...prev, announcements: null }));

    const payload = {
      id: announcementForm.id ?? undefined,
      title: announcementForm.title.trim(),
      content: announcementForm.content.trim(),
      is_published: announcementForm.is_published,
      image_links: announcementForm.image_links,
    };

    try {
      const response = await fetch('/api/admin/announcements', {
        method: announcementForm.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '공지 저장에 실패했습니다.');
      }

      const responsePayload = await response.json();
      const savedAnnouncement = responsePayload?.data as AnnouncementRecord;

      setAnnouncements((prev) => {
        const updated = announcementForm.id
          ? prev.map((item) => (item.id === savedAnnouncement.id ? savedAnnouncement : item))
          : [savedAnnouncement, ...prev];
        return sortAnnouncements(updated);
      });

      setAnnouncementForm(emptyAnnouncementForm);
      setAnnouncementFormOpen(false);
    } catch (error) {
      console.error('Error saving announcement:', error);
      setErrors((prev) => ({
        ...prev,
        announcements: error instanceof Error ? error.message : '공지 저장에 실패했습니다.',
      }));
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleAnnouncementDelete = async (announcementId: string) => {
    const confirmed = window.confirm('이 공지를 삭제할까요?');
    if (!confirmed) return;

    setErrors((prev) => ({ ...prev, announcements: null }));
    try {
      const response = await fetch(`/api/admin/announcements?id=${announcementId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공지 삭제에 실패했습니다.');
      }

      setAnnouncements((prev) => prev.filter((item) => item.id !== announcementId));
    } catch (error) {
      console.error('Error deleting announcement:', error);
      setErrors((prev) => ({
        ...prev,
        announcements: error instanceof Error ? error.message : '공지 삭제에 실패했습니다.',
      }));
    }
  };

  const handleAnnouncementToggle = async (announcement: AnnouncementRecord) => {
    setErrors((prev) => ({ ...prev, announcements: null }));
    try {
      const response = await fetch('/api/admin/announcements', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: announcement.id,
          is_published: !announcement.is_published,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '활성 상태 변경에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedAnnouncement = payload?.data as AnnouncementRecord;
      setAnnouncements((prev) =>
        sortAnnouncements(prev.map((item) => (item.id === updatedAnnouncement.id ? updatedAnnouncement : item)))
      );
    } catch (error) {
      console.error('Error toggling announcement:', error);
      setErrors((prev) => ({
        ...prev,
        announcements: error instanceof Error ? error.message : '활성 상태 변경에 실패했습니다.',
      }));
    }
  };

  const parseFaqTags = (value: string) => {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  };

  const handleFaqFormToggle = () => {
    setFaqFormOpen((prev) => !prev);
    setFaqFormError(null);
    if (faqFormOpen) {
      setFaqForm(emptyFaqForm);
    }
  };

  const handleFaqEdit = (faq: FaqRecord) => {
    setFaqForm({
      id: faq.id,
      question: faq.question ?? '',
      answer: faq.answer ?? '',
      category: faq.category ?? '',
      tags: (faq.tags ?? []).join(', '),
      sort_order: faq.sort_order ?? 0,
      is_published: Boolean(faq.is_published),
    });
    setFaqFormOpen(true);
    setFaqFormError(null);
  };

  const handleFaqSave = async () => {
    setFaqFormError(null);

    if (!faqForm.question.trim()) {
      setFaqFormError('질문을 입력해주세요.');
      return;
    }

    if (!faqForm.answer.trim()) {
      setFaqFormError('답변을 입력해주세요.');
      return;
    }

    setSavingFaq(true);
    setErrors((prev) => ({ ...prev, faqs: null }));

    const payload = {
      id: faqForm.id ?? undefined,
      question: faqForm.question.trim(),
      answer: faqForm.answer.trim(),
      category: faqForm.category.trim() || null,
      tags: parseFaqTags(faqForm.tags),
      sort_order: faqForm.sort_order,
      is_published: faqForm.is_published,
    };

    try {
      const response = await fetch('/api/admin/faqs', {
        method: faqForm.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || 'FAQ 저장에 실패했습니다.');
      }

      const responsePayload = await response.json();
      const savedFaq = responsePayload?.data as FaqRecord;

      setFaqs((prev) => {
        const updated = faqForm.id
          ? prev.map((item) => (item.id === savedFaq.id ? savedFaq : item))
          : [savedFaq, ...prev];
        return sortFaqs(updated);
      });

      setFaqForm(emptyFaqForm);
      setFaqFormOpen(false);
    } catch (error) {
      console.error('Error saving faq:', error);
      setErrors((prev) => ({
        ...prev,
        faqs: error instanceof Error ? error.message : 'FAQ 저장에 실패했습니다.',
      }));
    } finally {
      setSavingFaq(false);
    }
  };

  const handleFaqDelete = async (faqId: string) => {
    const confirmed = window.confirm('이 FAQ를 삭제할까요?');
    if (!confirmed) return;

    setErrors((prev) => ({ ...prev, faqs: null }));
    try {
      const response = await fetch(`/api/admin/faqs?id=${faqId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'FAQ 삭제에 실패했습니다.');
      }

      setFaqs((prev) => prev.filter((item) => item.id !== faqId));
    } catch (error) {
      console.error('Error deleting faq:', error);
      setErrors((prev) => ({
        ...prev,
        faqs: error instanceof Error ? error.message : 'FAQ 삭제에 실패했습니다.',
      }));
    }
  };

  const handleFaqToggle = async (faq: FaqRecord) => {
    setErrors((prev) => ({ ...prev, faqs: null }));
    try {
      const response = await fetch('/api/admin/faqs', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: faq.id,
          is_published: !faq.is_published,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공개 상태 변경에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedFaq = payload?.data as FaqRecord;
      setFaqs((prev) => sortFaqs(prev.map((item) => (item.id === updatedFaq.id ? updatedFaq : item))));
    } catch (error) {
      console.error('Error toggling faq:', error);
      setErrors((prev) => ({
        ...prev,
        faqs: error instanceof Error ? error.message : '공개 상태 변경에 실패했습니다.',
      }));
    }
  };

  const handleReplySubmit = async (inquiryId: string) => {
    const content = replyDrafts[inquiryId]?.trim();
    if (!content) return;

    setSubmittingReplyId(inquiryId);
    setErrors((prev) => ({ ...prev, inquiries: null }));

    try {
      const response = await fetch('/api/admin/inquiries/replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inquiryId, content }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '답변 등록에 실패했습니다.');
      }

      const payload = await response.json();
      const reply = payload?.data as InquiryReplyRecord;

      setInquiries((prev) =>
        prev.map((inquiry) => {
          if (inquiry.id !== inquiryId) return inquiry;
          const replies = inquiry.inquiry_replies ? [...inquiry.inquiry_replies, reply] : [reply];
          return { ...inquiry, inquiry_replies: replies };
        })
      );

      setReplyDrafts((prev) => ({ ...prev, [inquiryId]: '' }));
    } catch (error) {
      console.error('Error submitting reply:', error);
      setErrors((prev) => ({
        ...prev,
        inquiries: error instanceof Error ? error.message : '답변 등록에 실패했습니다.',
      }));
    } finally {
      setSubmittingReplyId(null);
    }
  };

  const handleStatusChange = async (inquiryId: string, status: InquiryStatus) => {
    setUpdatingStatusId(inquiryId);
    setErrors((prev) => ({ ...prev, inquiries: null }));

    try {
      const response = await fetch('/api/admin/inquiries', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inquiryId, status }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '상태 업데이트에 실패했습니다.');
      }

      const payload = await response.json();
      const updated = payload?.data as { id: string; status: InquiryStatus };

      setInquiries((prev) =>
        prev.map((inquiry) =>
          inquiry.id === updated.id ? { ...inquiry, status: updated.status } : inquiry
        )
      );
    } catch (error) {
      console.error('Error updating inquiry status:', error);
      setErrors((prev) => ({
        ...prev,
        inquiries: error instanceof Error ? error.message : '상태 업데이트에 실패했습니다.',
      }));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const getStatusStyle = (status: InquiryStatus) => {
    const styles: Record<InquiryStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      ongoing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
    };
    return styles[status];
  };

  const getStatusLabel = (status: InquiryStatus) => {
    const labels: Record<InquiryStatus, string> = {
      pending: '대기중',
      ongoing: '진행중',
      completed: '완료',
    };
    return labels[status];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">콘텐츠 관리</h2>
          <p className="text-sm text-gray-500 mt-1">
            리뷰, 제작 사례, 배너, 공지, FAQ, 문의를 한 곳에서 관리합니다.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200/60 rounded-md p-3 shadow-sm">
        <div className="flex gap-2 flex-wrap">
          {sectionTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key as SectionKey)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeSection === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'reviews' && (
        <div className="space-y-4">
          {errors.reviews && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
              {errors.reviews}
            </div>
          )}
          {loading.reviews ? (
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
      )}

      {activeSection === 'examples' && (
        <div className="space-y-4">
          {errors.examples && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
              {errors.examples}
            </div>
          )}

          <div className="bg-white border border-gray-200/60 rounded-md shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">제작 사례 관리</h3>
                <p className="text-sm text-gray-500">홈페이지에 노출할 사례를 등록하세요.</p>
              </div>
              <button
                onClick={handleExampleFormToggle}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {exampleFormOpen ? '입력 닫기' : '새 사례 추가'}
              </button>
            </div>

            {exampleFormOpen && (
              <div className="bg-gray-50 rounded-md p-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-gray-700">
                    제품 선택
                    <select
                      value={exampleForm.product_id}
                      onChange={(event) =>
                        setExampleForm((prev) => ({ ...prev, product_id: event.target.value }))
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
                    제목
                    <input
                      type="text"
                      value={exampleForm.title}
                      onChange={(event) =>
                        setExampleForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </label>
                </div>
                <label className="space-y-2 text-sm text-gray-700">
                  설명
                  <textarea
                    value={exampleForm.description}
                    onChange={(event) =>
                      setExampleForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-3 text-sm text-gray-700 md:col-span-2">
                    <label className="space-y-2 text-sm text-gray-700">
                      이미지 URL
                      <input
                        type="text"
                        value={exampleForm.image_url}
                        onChange={(event) =>
                          setExampleForm((prev) => ({ ...prev, image_url: event.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-gray-700">
                      이미지 업로드
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleExampleImageInputChange}
                        disabled={uploadingExampleImage}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                      />
                      {uploadingExampleImage && (
                        <span className="text-xs text-gray-500">업로드 중...</span>
                      )}
                    </label>
                  </div>
                  <label className="space-y-2 text-sm text-gray-700">
                    정렬 순서
                    <input
                      type="number"
                      value={exampleForm.sort_order}
                      onChange={(event) =>
                        setExampleForm((prev) => ({
                          ...prev,
                          sort_order: Number(event.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </label>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={exampleForm.is_active}
                    onChange={(event) =>
                      setExampleForm((prev) => ({ ...prev, is_active: event.target.checked }))
                    }
                    className="rounded border-gray-300"
                  />
                  활성 상태로 노출
                </label>

                {exampleFormError && (
                  <p className="text-sm text-red-600">{exampleFormError}</p>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setExampleForm(emptyExampleForm);
                      setExampleFormOpen(false);
                      setExampleFormError(null);
                    }}
                    className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleExampleSave}
                    disabled={savingExample || uploadingExampleImage}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingExample
                      ? '저장 중...'
                      : uploadingExampleImage
                        ? '이미지 업로드 중...'
                        : '저장'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {loading.examples ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : productionExamples.length === 0 ? (
            <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center text-gray-500">
              등록된 제작 사례가 없습니다.
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
                        제목
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        제품
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        정렬
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
                    {productionExamples.map((example) => (
                      <tr key={example.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <img
                            src={example.image_url}
                            alt={example.title}
                            className="w-16 h-16 object-cover rounded-md border border-gray-200"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{example.title}</div>
                          <div className="text-xs text-gray-500 max-w-xs truncate">
                            {example.description}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {example.product?.title || example.product_id}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{example.sort_order}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => handleExampleToggle(example)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              example.is_active
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {example.is_active ? (
                              <>
                                <Eye className="w-3 h-3" />
                                활성
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" />
                                비활성
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleExampleEdit(example)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                              편집
                            </button>
                            <button
                              onClick={() => handleExampleDelete(example.id)}
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
      )}

      {activeSection === 'heroBanners' && (
        <div className="space-y-4">
          {errors.heroBanners && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
              {errors.heroBanners}
            </div>
          )}

          <div className="bg-white border border-gray-200/60 rounded-md shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">히어로 배너 관리</h3>
                <p className="text-sm text-gray-500">홈 화면에 노출할 배너를 등록하세요.</p>
              </div>
              <button
                onClick={handleBannerFormToggle}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {bannerFormOpen ? '입력 닫기' : '새 배너 추가'}
              </button>
            </div>

            {bannerFormOpen && (
              <div className="bg-gray-50 rounded-md p-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-gray-700">
                    제목
                    <input
                      type="text"
                      value={bannerForm.title}
                      onChange={(event) =>
                        setBannerForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    부제목
                    <input
                      type="text"
                      value={bannerForm.subtitle}
                      onChange={(event) =>
                        setBannerForm((prev) => ({ ...prev, subtitle: event.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </label>
                </div>
                <label className="space-y-2 text-sm text-gray-700">
                  링크 URL
                  <input
                    type="text"
                    value={bannerForm.redirect_link}
                    onChange={(event) =>
                      setBannerForm((prev) => ({ ...prev, redirect_link: event.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-3 text-sm text-gray-700 md:col-span-2">
                    <label className="space-y-2 text-sm text-gray-700">
                      이미지 URL
                      <input
                        type="text"
                        value={bannerForm.image_link}
                        onChange={(event) =>
                          setBannerForm((prev) => ({ ...prev, image_link: event.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-gray-700">
                      이미지 업로드
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerImageInputChange}
                        disabled={uploadingBannerImage}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                      />
                      {uploadingBannerImage && (
                        <span className="text-xs text-gray-500">업로드 중...</span>
                      )}
                    </label>
                  </div>
                  <label className="space-y-2 text-sm text-gray-700">
                    정렬 순서
                    <input
                      type="number"
                      value={bannerForm.sort_order}
                      onChange={(event) =>
                        setBannerForm((prev) => ({
                          ...prev,
                          sort_order: Number(event.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </label>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={bannerForm.is_active}
                    onChange={(event) =>
                      setBannerForm((prev) => ({ ...prev, is_active: event.target.checked }))
                    }
                    className="rounded border-gray-300"
                  />
                  활성 상태로 노출
                </label>

                {bannerFormError && <p className="text-sm text-red-600">{bannerFormError}</p>}

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setBannerForm(emptyHeroBannerForm);
                      setBannerFormOpen(false);
                      setBannerFormError(null);
                    }}
                    className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleBannerSave}
                    disabled={savingBanner || uploadingBannerImage}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingBanner
                      ? '저장 중...'
                      : uploadingBannerImage
                        ? '이미지 업로드 중...'
                        : '저장'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {loading.heroBanners ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : heroBanners.length === 0 ? (
            <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center text-gray-500">
              등록된 히어로 배너가 없습니다.
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
                        제목
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        링크
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        정렬
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
                    {heroBanners.map((banner) => (
                      <tr key={banner.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {banner.image_link ? (
                            <img
                              src={banner.image_link}
                              alt={banner.title}
                              className="w-16 h-16 object-cover rounded-md border border-gray-200"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-md border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                              이미지 없음
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{banner.title}</div>
                          <div className="text-xs text-gray-500 max-w-xs truncate">
                            {banner.subtitle}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {banner.redirect_link ? (
                            <a
                              href={banner.redirect_link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              링크 열기
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">링크 없음</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{banner.sort_order}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => handleBannerToggle(banner)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              banner.is_active
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {banner.is_active ? (
                              <>
                                <Eye className="w-3 h-3" />
                                활성
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" />
                                비활성
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleBannerEdit(banner)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                              편집
                            </button>
                            <button
                              onClick={() => handleBannerDelete(banner.id)}
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
      )}

      {activeSection === 'announcements' && (
        <div className="space-y-4">
          {errors.announcements && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
              {errors.announcements}
            </div>
          )}

          <div className="bg-white border border-gray-200/60 rounded-md shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">공지 관리</h3>
                <p className="text-sm text-gray-500">여러 이미지를 포함한 공지를 등록하세요.</p>
              </div>
              <button
                onClick={handleAnnouncementFormToggle}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {announcementFormOpen ? '입력 닫기' : '새 공지 추가'}
              </button>
            </div>

            {announcementFormOpen && (
              <div className="bg-gray-50 rounded-md p-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-gray-700">
                    제목
                    <input
                      type="text"
                      value={announcementForm.title}
                      onChange={(event) =>
                        setAnnouncementForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                    내용
                    <textarea
                      value={announcementForm.content}
                      onChange={(event) =>
                        setAnnouncementForm((prev) => ({ ...prev, content: event.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={3}
                    />
                  </label>
                </div>

                <div className="space-y-2 text-sm text-gray-700">
                  <label className="space-y-2">
                    이미지 업로드
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleAnnouncementImageInputChange}
                      disabled={uploadingAnnouncementImages > 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    />
                  </label>
                  {uploadingAnnouncementImages > 0 && (
                    <span className="text-xs text-gray-500">
                      이미지 {uploadingAnnouncementImages}개 업로드 중...
                    </span>
                  )}
                  {announcementForm.image_links.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {announcementForm.image_links.map((link, index) => (
                        <div
                          key={`${link}-${index}`}
                          className="relative w-20 h-20 overflow-hidden rounded-md border border-gray-200"
                        >
                          <img src={link} alt="공지 이미지" className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleRemoveAnnouncementImage(link)}
                            type="button"
                            className="absolute top-1 right-1 bg-white/80 rounded-full p-0.5 text-xs text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={announcementForm.is_published}
                    onChange={(event) =>
                      setAnnouncementForm((prev) => ({
                        ...prev,
                        is_published: event.target.checked,
                      }))
                    }
                    className="rounded border-gray-300"
                  />
                  공개 상태로 노출
                </label>

                {announcementFormError && (
                  <p className="text-sm text-red-600">{announcementFormError}</p>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setAnnouncementForm(emptyAnnouncementForm);
                      setAnnouncementFormOpen(false);
                      setAnnouncementFormError(null);
                    }}
                    className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAnnouncementSave}
                    disabled={savingAnnouncement || uploadingAnnouncementImages > 0}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingAnnouncement
                      ? '저장 중...'
                      : uploadingAnnouncementImages > 0
                        ? '이미지 업로드 중...'
                        : '저장'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {loading.announcements ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : announcements.length === 0 ? (
            <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center text-gray-500">
              등록된 공지가 없습니다.
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
                        제목/내용
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        작성일
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {announcements.map((announcement) => (
                      <tr key={announcement.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          {announcement.image_links && announcement.image_links.length > 0 ? (
                            <img
                              src={announcement.image_links[0]}
                              alt={announcement.title}
                              className="w-16 h-16 object-cover rounded-md border border-gray-200"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-md border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                              이미지 없음
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{announcement.title}</div>
                          <div className="text-xs text-gray-500 max-w-xs truncate">
                            {announcement.content}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => handleAnnouncementToggle(announcement)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              announcement.is_published
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {announcement.is_published ? (
                              <>
                                <Eye className="w-3 h-3" />
                                공개
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" />
                                비공개
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(announcement.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleAnnouncementEdit(announcement)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                              편집
                            </button>
                            <button
                              onClick={() => handleAnnouncementDelete(announcement.id)}
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
      )}

      {activeSection === 'faqs' && (
        <div className="space-y-4">
          {errors.faqs && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
              {errors.faqs}
            </div>
          )}

          <div className="bg-white border border-gray-200/60 rounded-md shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">FAQ 관리</h3>
                <p className="text-sm text-gray-500">자주 묻는 질문을 등록/수정하세요.</p>
              </div>
              <button
                onClick={handleFaqFormToggle}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {faqFormOpen ? '입력 닫기' : '새 FAQ 추가'}
              </button>
            </div>

            {faqFormOpen && (
              <div className="bg-gray-50 rounded-md p-4 space-y-4">
                <label className="space-y-2 text-sm text-gray-700">
                  질문
                  <input
                    type="text"
                    value={faqForm.question}
                    onChange={(event) =>
                      setFaqForm((prev) => ({ ...prev, question: event.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </label>
                <label className="space-y-2 text-sm text-gray-700">
                  답변
                  <textarea
                    value={faqForm.answer}
                    onChange={(event) =>
                      setFaqForm((prev) => ({ ...prev, answer: event.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={4}
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2 text-sm text-gray-700">
                    카테고리
                    <input
                      type="text"
                      value={faqForm.category}
                      onChange={(event) =>
                        setFaqForm((prev) => ({ ...prev, category: event.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                    태그 (쉼표로 구분)
                    <input
                      type="text"
                      value={faqForm.tags}
                      onChange={(event) => setFaqForm((prev) => ({ ...prev, tags: event.target.value }))}
                      placeholder="예: 결제, 배송, 디자인"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2 items-end">
                  <label className="space-y-2 text-sm text-gray-700">
                    정렬 순서
                    <input
                      type="number"
                      value={faqForm.sort_order}
                      onChange={(event) =>
                        setFaqForm((prev) => ({
                          ...prev,
                          sort_order: Number(event.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={faqForm.is_published}
                      onChange={(event) =>
                        setFaqForm((prev) => ({ ...prev, is_published: event.target.checked }))
                      }
                      className="rounded border-gray-300"
                    />
                    공개 상태로 노출
                  </label>
                </div>

                {faqFormError && <p className="text-sm text-red-600">{faqFormError}</p>}

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setFaqForm(emptyFaqForm);
                      setFaqFormOpen(false);
                      setFaqFormError(null);
                    }}
                    className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleFaqSave}
                    disabled={savingFaq}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingFaq ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {loading.faqs ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : faqs.length === 0 ? (
            <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center text-gray-500">
              등록된 FAQ가 없습니다.
            </div>
          ) : (
            <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        질문/답변
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        카테고리
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        태그
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        정렬
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        업데이트
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {faqs.map((faq) => (
                      <tr key={faq.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 max-w-50">
                          <div className="text-sm font-medium text-gray-900">{faq.question}</div>
                          <div className="text-xs text-gray-500 max-w-xl truncate">
                            {faq.answer}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {faq.category || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {faq.tags && faq.tags.length > 0 ? faq.tags.join(', ') : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {faq.sort_order}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => handleFaqToggle(faq)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              faq.is_published
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {faq.is_published ? (
                              <>
                                <Eye className="w-3 h-3" />
                                공개
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" />
                                비공개
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(faq.updated_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleFaqEdit(faq)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                              편집
                            </button>
                            <button
                              onClick={() => handleFaqDelete(faq.id)}
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
      )}

      {activeSection === 'inquiries' && (
        <div className="space-y-4">
          {errors.inquiries && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
              {errors.inquiries}
            </div>
          )}
          {loading.inquiries ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : inquiries.length === 0 ? (
            <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center text-gray-500">
              등록된 문의가 없습니다.
            </div>
          ) : (
            <div className="grid gap-4">
              {inquiries.map((inquiry) => {
                const productNames = Array.from(
                  new Set(
                    (inquiry.inquiry_products || []).map(
                      (product) => product.product?.title || product.product_id
                    )
                  )
                );
                const isExpanded = expandedInquiryId === inquiry.id;
                const detailsId = `inquiry-details-${inquiry.id}`;

                return (
                  <div key={inquiry.id} className="bg-white border border-gray-200/60 rounded-md shadow-sm">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedInquiryId((prev) => (prev === inquiry.id ? null : inquiry.id))
                      }
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      className="w-full px-4 py-3 flex flex-wrap items-start justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{inquiry.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(inquiry.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(
                            inquiry.status
                          )}`}
                        >
                          {getStatusLabel(inquiry.status)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div id={detailsId} className="px-4 pb-4 space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700">문의 내용</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {inquiry.content}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700">관련 제품</p>
                          {productNames.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {productNames.map((name) => (
                                <span
                                  key={name}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">연결된 제품이 없습니다.</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="text-sm text-gray-700">상태 변경</label>
                          <select
                            value={inquiry.status}
                            onChange={(event) =>
                              handleStatusChange(inquiry.id, event.target.value as InquiryStatus)
                            }
                            disabled={updatingStatusId === inquiry.id}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white disabled:opacity-50"
                          >
                            <option value="pending">대기중</option>
                            <option value="ongoing">진행중</option>
                            <option value="completed">완료</option>
                          </select>
                          {updatingStatusId === inquiry.id && (
                            <span className="text-xs text-gray-500">업데이트 중...</span>
                          )}
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-700">답변</p>
                          {inquiry.inquiry_replies && inquiry.inquiry_replies.length > 0 ? (
                            <div className="space-y-3">
                              {inquiry.inquiry_replies.map((reply) => (
                                <div key={reply.id} className="border-l-2 border-blue-200 pl-3">
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>
                                      관리자 {reply.admin_id ? reply.admin_id.slice(0, 8) : ''}
                                    </span>
                                    <span>{formatDate(reply.created_at)}</span>
                                  </div>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {reply.content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">등록된 답변이 없습니다.</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <textarea
                            placeholder="답변을 입력하세요."
                            value={replyDrafts[inquiry.id] || ''}
                            onChange={(event) =>
                              setReplyDrafts((prev) => ({
                                ...prev,
                                [inquiry.id]: event.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            rows={3}
                          />
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleReplySubmit(inquiry.id)}
                              disabled={
                                submittingReplyId === inquiry.id ||
                                !(replyDrafts[inquiry.id] || '').trim()
                              }
                              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              {submittingReplyId === inquiry.id ? '전송 중...' : '답변 전송'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
