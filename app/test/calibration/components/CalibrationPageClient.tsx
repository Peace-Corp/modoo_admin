'use client';

import { useState } from 'react';
import { useCalibrationState, parseOperationalIds } from '../hooks/useCalibrationState';
import { CalibrationTab } from './CalibrationTab';
import { AnchorRegistrar } from './AnchorRegistrar';
import { UserSimulator } from './UserSimulator';
import { ComparisonReport } from './ComparisonReport';
import { CalibTestErrorBoundary } from './ErrorBoundary';
import { clearState } from '../lib/storage';
import {
  fetchOperationalProducts,
  loadAllCalibPayloads,
  upsertCalibPayload,
} from '../lib/operationalDb';

type Tab = 'calibration' | 'anchors' | 'simulator' | 'report';

const TABS: { id: Tab; label: string; status: 'ready' | 'placeholder' }[] = [
  { id: 'calibration', label: '① 캘리브', status: 'ready' },
  { id: 'anchors', label: '② 앵커 등록', status: 'ready' },
  { id: 'simulator', label: '③ 사용자 시뮬레이션', status: 'ready' },
  { id: 'report', label: '④ 비교 리포트', status: 'ready' },
];

export function CalibrationPageClient() {
  const {
    state,
    selectedProduct,
    selectedSide,
    selectProduct,
    selectSide,
    addProduct,
    addSide,
    setMockupImage,
    upsertLine,
    removeLine,
    setActiveLine,
    upsertAnchor,
    removeAnchor,
    setApplicableAnchors,
    setLegacyProductWidthMm,
    upsertScenario,
    removeScenario,
    importOperationalProducts,
    applyCalibPayloads,
    addCustomAnchor,
    removeCustomAnchor,
  } = useCalibrationState();
  const [tab, setTab] = useState<Tab>('calibration');
  const [loadingOp, setLoadingOp] = useState(false);
  const [opStatus, setOpStatus] = useState<string | null>(null);

  const handleAddProduct = () => {
    const name = window.prompt('새 제품 이름', '신규 제품');
    if (name) addProduct(name);
  };

  const handleAddSide = () => {
    if (!selectedProduct) return;
    const name = window.prompt('새 면 이름 (front/back/left-sleeve/right-sleeve/hood 등)', 'front');
    if (name) addSide(selectedProduct.id, name);
  };

  const handleLoadOperational = async () => {
    if (loadingOp) return;
    if (!window.confirm('운영 DB에서 활성 제품 목록을 read-only로 불러옵니다. (운영 데이터 변경 없음)')) return;
    setLoadingOp(true);
    setOpStatus('운영 DB 조회 중...');
    try {
      const products = await fetchOperationalProducts();
      setOpStatus(`${products.length}개 제품 매핑 + mockup 이미지 로드 중...`);
      await importOperationalProducts(products);
      setOpStatus(`✅ ${products.length}개 제품 불러옴`);
    } catch (e: any) {
      setOpStatus(`❌ 실패: ${e?.message ?? e}`);
    } finally {
      setLoadingOp(false);
    }
  };

  const handleSaveSideToDb = async () => {
    if (!selectedProduct || !selectedSide) return;
    const ids = parseOperationalIds(selectedProduct.id, selectedSide.id);
    if (!ids) {
      alert('운영 DB에서 불러온 제품·면만 DB 저장이 가능합니다.');
      return;
    }
    setOpStatus('DB 저장 중...');
    try {
      await upsertCalibPayload(ids.productId, ids.sideId, {
        mockup: {
          legacyProductWidthMm: selectedSide.mockup.legacyProductWidthMm,
          lines: selectedSide.mockup.lines,
        },
        applicableAnchors: selectedSide.applicableAnchors,
        registeredAnchors: selectedSide.registeredAnchors,
        scenarios: selectedSide.scenarios ?? [],
      });
      setOpStatus(`✅ "${selectedProduct.name} / ${selectedSide.name}" 저장됨`);
    } catch (e: any) {
      setOpStatus(`❌ 저장 실패: ${e?.message ?? e}`);
    }
  };

  const handleLoadAllFromDb = async () => {
    setOpStatus('DB에서 캘리브 데이터 불러오는 중...');
    try {
      const rows = await loadAllCalibPayloads();
      applyCalibPayloads(rows);
      setOpStatus(`✅ DB에서 ${rows.length}건 적용됨`);
    } catch (e: any) {
      setOpStatus(`❌ 불러오기 실패: ${e?.message ?? e}`);
    }
  };

  const handleResetAll = () => {
    if (!window.confirm('테스트 페이지의 모든 localStorage 데이터를 삭제할까요? (운영 데이터 영향 없음)')) return;
    clearState();
    window.location.reload();
  };

  return (
    <CalibTestErrorBoundary>
      <div className="min-h-screen bg-yellow-50/40 p-4">
        <header className="mb-4 border-2 border-yellow-400 bg-yellow-100 p-3 rounded">
          <h1 className="text-lg font-bold text-yellow-900">
            🧪 캘리브레이션 테스트 페이지 (격리됨)
          </h1>
          <p className="text-xs text-yellow-800 mt-1">
            이 페이지는 운영 시스템·DB·스토어·라우트와 완전히 격리되어 있습니다.
            모든 데이터는 브라우저 localStorage(<code>__calib_test__/*</code>)에만
            저장되며, 어떤 운영 흐름에도 영향을 주지 않습니다.
          </p>
        </header>

        <div className="bg-white border rounded p-3 mb-4 flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2 text-sm">
            제품:
            <select
              className="border rounded px-2 py-1"
              value={state.selectedProductId ?? ''}
              onChange={(e) => selectProduct(e.target.value)}
            >
              {state.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleAddProduct}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            + 제품 추가
          </button>

          <span className="text-gray-300">|</span>

          <label className="flex items-center gap-2 text-sm">
            면:
            <select
              className="border rounded px-2 py-1"
              value={state.selectedSideId ?? ''}
              onChange={(e) => selectSide(e.target.value)}
            >
              {selectedProduct?.sides.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleAddSide}
            disabled={!selectedProduct}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            + 면 추가
          </button>

          <span className="ml-auto" />
          {opStatus && <span className="text-xs text-gray-600">{opStatus}</span>}
          <button
            type="button"
            onClick={handleLoadOperational}
            disabled={loadingOp}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 rounded disabled:opacity-50"
            title="운영 DB의 활성 제품을 read-only로 불러옴 (DB 변경 없음)"
          >
            {loadingOp ? '불러오는 중...' : '운영 제품 불러오기'}
          </button>
          <button
            type="button"
            onClick={handleLoadAllFromDb}
            className="px-2 py-1 text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded"
            title="calibration_test_data 테이블에서 저장된 캘리브/앵커를 모두 적용"
          >
            DB 캘리브 불러오기
          </button>
          <button
            type="button"
            onClick={handleSaveSideToDb}
            disabled={!selectedProduct?.id.startsWith('op-')}
            className="px-2 py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded disabled:opacity-40"
            title="현재 면의 캘리브/앵커/시나리오를 DB에 저장 (운영 제품만)"
          >
            현재 면 DB 저장
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded"
          >
            전체 초기화
          </button>
        </div>

        <nav className="flex gap-1 mb-4 border-b">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm rounded-t transition ${
                tab === t.id
                  ? 'bg-white border border-b-white border-gray-300 -mb-px font-semibold'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
              {t.status === 'placeholder' && (
                <span className="ml-1 text-[10px] text-gray-400">(예정)</span>
              )}
            </button>
          ))}
        </nav>

        <main>
          {tab === 'calibration' && selectedProduct && selectedSide && (
            <CalibrationTab
              productId={selectedProduct.id}
              side={selectedSide}
              setMockupImage={setMockupImage}
              upsertLine={upsertLine}
              removeLine={removeLine}
              setActiveLine={setActiveLine}
            />
          )}
          {tab === 'anchors' && selectedProduct && selectedSide && (
            <AnchorRegistrar
              productId={selectedProduct.id}
              side={selectedSide}
              customAnchors={state.customAnchors}
              upsertAnchor={upsertAnchor}
              removeAnchor={removeAnchor}
              setApplicableAnchors={setApplicableAnchors}
              addCustomAnchor={addCustomAnchor}
              removeCustomAnchor={removeCustomAnchor}
            />
          )}
          {tab === 'simulator' && selectedSide && (
            <UserSimulator side={selectedSide} customAnchors={state.customAnchors} />
          )}
          {tab === 'report' && selectedProduct && selectedSide && (
            <ComparisonReport
              productId={selectedProduct.id}
              side={selectedSide}
              setLegacyProductWidthMm={setLegacyProductWidthMm}
              upsertScenario={upsertScenario}
              removeScenario={removeScenario}
            />
          )}
        </main>
      </div>
    </CalibTestErrorBoundary>
  );
}

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div className="p-12 border border-dashed border-gray-300 rounded bg-white text-center text-gray-500">
      <div className="text-lg mb-2">{title}</div>
      <p className="text-xs">이 탭은 다음 단계에서 구현됩니다.</p>
    </div>
  );
}
