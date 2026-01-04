'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Factory, MessageSquare, Package, Users } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

type DashboardCountsBase = {
  orders_total: number;
  orders_pending: number;
  orders_processing: number;
  orders_completed: number;
  orders_cancelled: number;
  orders_refunded: number;
};

type DashboardCountsAdmin = DashboardCountsBase & {
  orders_unassigned: number;
  products_total: number;
  products_active: number;
  users_total: number;
  users_admin: number;
  users_factory: number;
  users_customer: number;
  factories_total: number;
  inquiries_pending: number;
};

type DashboardOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  total_amount: number;
  order_status: string;
  payment_status: string;
};

type DashboardPayload =
  | {
      role: 'factory';
      counts: DashboardCountsBase;
      recentOrders: DashboardOrder[];
    }
  | {
      role: 'admin';
      counts: DashboardCountsAdmin;
      recentOrders: DashboardOrder[];
    };

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function Dashboard() {
  const { user } = useAuthStore();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchDashboard = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetch('/api/admin/dashboard');
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload?.error || '대시보드 데이터를 불러오지 못했습니다.');
        }
        const json = await response.json();
        if (!isActive) return;
        setPayload(json?.data ?? null);
      } catch (error) {
        if (!isActive) return;
        setPayload(null);
        setErrorMessage(error instanceof Error ? error.message : '대시보드 데이터를 불러오지 못했습니다.');
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    fetchDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  const cards = useMemo(() => {
    if (!payload) return [];

    if (payload.role === 'factory') {
      return [
        {
          label: '배정 주문',
          value: payload.counts.orders_total,
          hint: `대기 ${payload.counts.orders_pending} · 처리 ${payload.counts.orders_processing}`,
          href: '/orders',
          icon: BarChart3,
        },
        {
          label: '대기중',
          value: payload.counts.orders_pending,
          hint: '신규 주문 확인 필요',
          href: '/orders',
          icon: BarChart3,
        },
        {
          label: '처리중',
          value: payload.counts.orders_processing,
          hint: '제작/출고 진행중',
          href: '/orders',
          icon: BarChart3,
        },
        {
          label: '완료',
          value: payload.counts.orders_completed,
          hint: '완료된 주문',
          href: '/orders',
          icon: BarChart3,
        },
      ];
    }

    return [
      {
        label: '주문',
        value: payload.counts.orders_total,
        hint: `대기 ${payload.counts.orders_pending} · 처리 ${payload.counts.orders_processing}`,
        href: '/orders',
        icon: BarChart3,
      },
      {
        label: '미배정 주문',
        value: payload.counts.orders_unassigned,
        hint: '공장 배정이 필요합니다',
        href: '/orders',
        icon: Factory,
      },
      {
        label: '제품(활성)',
        value: payload.counts.products_active,
        hint: `전체 ${payload.counts.products_total}`,
        href: '/products',
        icon: Package,
      },
      {
        label: '문의(대기)',
        value: payload.counts.inquiries_pending,
        hint: '답변이 필요한 문의',
        href: '/content',
        icon: MessageSquare,
      },
      {
        label: '사용자',
        value: payload.counts.users_total,
        hint: `관리자 ${payload.counts.users_admin} · 공장 ${payload.counts.users_factory} · 고객 ${payload.counts.users_customer}`,
        href: '/users',
        icon: Users,
      },
      {
        label: '공장',
        value: payload.counts.factories_total,
        hint: '등록된 공장',
        href: '/factories',
        icon: Factory,
      },
    ];
  }, [payload]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">대시보드</h2>
          <p className="text-gray-500 mt-1">
            {user?.role === 'factory'
              ? '배정된 주문 현황을 빠르게 확인하세요.'
              : '관리 현황을 한눈에 확인하세요.'}
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <div className="font-medium text-gray-700">{user?.factory_name ?? '관리자'}</div>
          <div className="mt-1">{user?.email}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : errorMessage ? (
        <div className="bg-white border border-red-200 rounded-md p-3 shadow-sm">
          <p className="text-sm text-red-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="group bg-white border border-gray-200/60 rounded-md p-4 shadow-sm hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-600">{card.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">
                      {formatNumber(card.value)}
                    </p>
                    {card.hint && <p className="mt-1 text-xs text-gray-500">{card.hint}</p>}
                  </div>
                  <card.icon className="w-5 h-5 text-gray-400 group-hover:text-gray-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden lg:col-span-2">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">최근 주문</h3>
                <Link href="/orders" className="text-sm text-blue-600 hover:text-blue-700">
                  전체 보기
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 font-medium">주문 ID</th>
                      <th className="px-4 py-2 font-medium">고객</th>
                      <th className="px-4 py-2 font-medium">상태</th>
                      <th className="px-4 py-2 font-medium">금액</th>
                      <th className="px-4 py-2 font-medium">일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(payload?.recentOrders || []).map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-gray-700">
                          {order.id.slice(0, 8)}…
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {order.customer_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{order.order_status}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatNumber(order.total_amount)}원
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDateTime(order.created_at)}
                        </td>
                      </tr>
                    ))}
                    {(payload?.recentOrders || []).length === 0 && (
                      <tr>
                        <td className="px-4 py-8 text-sm text-gray-500 text-center" colSpan={5}>
                          최근 주문이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-gray-200/60 rounded-md shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900">빠른 이동</h3>
              <div className="mt-3 grid gap-2">
                <Link
                  href="/orders"
                  className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  주문 관리
                  <span className="text-gray-400">→</span>
                </Link>
                {user?.role === 'admin' && (
                  <>
                    <Link
                      href="/products"
                      className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      제품 관리
                      <span className="text-gray-400">→</span>
                    </Link>
                    <Link
                      href="/content"
                      className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      콘텐츠 관리
                      <span className="text-gray-400">→</span>
                    </Link>
                    <Link
                      href="/users"
                      className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      사용자 관리
                      <span className="text-gray-400">→</span>
                    </Link>
                    <Link
                      href="/factories"
                      className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      공장 관리
                      <span className="text-gray-400">→</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
