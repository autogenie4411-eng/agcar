/* 오토지니 유입 분석. 외부 전송 없이 기존 방문/견적 Apps Script 페이로드에 값을 추가합니다. */
(() => {
  'use strict';
  const KEY = 'autogenie_traffic_attribution_v1';
  const q = new URLSearchParams(location.search);
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
  const ref = (() => { try { return new URL(document.referrer).hostname.toLowerCase(); } catch (_) { return ''; } })();
  const clean = v => String(v || '').trim().slice(0, 180);
  const actual = clean(q.get('n_query'));
  const googleClick = q.has('gclid') || q.has('wbraid') || q.has('gbraid');
  const naverClick = q.has('n_click') || Boolean(actual);
  // Click identifiers take precedence when ad landing URLs lack UTM/referrer values.
  const source = clean(q.get('utm_source')).toLowerCase() || (googleClick ? 'google' : naverClick ? 'naver' : ref.includes('naver.') ? 'naver' : /(^|\.)google\./.test(ref) ? 'google' : ref ? 'referral' : 'direct');
  const medium = clean(q.get('utm_medium')).toLowerCase() || (googleClick || naverClick ? 'cpc' : 'unknown');
  const adKeyword = clean(q.get('utm_term'));
  // 최초로 확인된 실제 검색어만 영구 보존합니다. (브라우저별 저장)
  // 기존 세션에 이미 확인된 검색어가 있다면 업그레이드 시에도 유지합니다.
  const FIRST_KEY = 'autogenie_first_confirmed_search_term_v1';
  let firstTerm = '';
  try { firstTerm = clean(localStorage.getItem(FIRST_KEY)); } catch (_) {}
  if (!firstTerm && saved.trafficKeywordType === 'actual_naver_query') {
    const previousTerm = clean(saved.trafficSearchTerm);
    if (previousTerm && previousTerm !== '미확인') firstTerm = previousTerm;
  }
  if (!firstTerm && actual) firstTerm = actual;
  if (firstTerm) {
    try { localStorage.setItem(FIRST_KEY, firstTerm); } catch (_) {}
  }
  const searchTerm = firstTerm || '미확인';
  if (!saved.recordedAt || [...q.keys()].some(k => /^(utm_|n_query|gclid|wbraid|gbraid|n_click)/i.test(k))) {
    saved = {
      trafficSource: source,
      trafficMedium: medium,
      trafficCampaign: clean(q.get('utm_campaign')),
      trafficSearchTerm: searchTerm,
      trafficKeywordType: firstTerm ? 'actual_naver_query' : 'unknown',
      trafficAdKeyword: adKeyword,
      trafficReferrer: clean(ref),
      recordedAt: new Date().toISOString()
    };
    try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch (_) {}
  }
  // 새 파라미터 없이 방문했어도 이전에 확인한 최초 검색어를 복원합니다.
  if (firstTerm) {
    saved.trafficSearchTerm = firstTerm;
    saved.trafficKeywordType = 'actual_naver_query';
    try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch (_) {}
  }
  const fields = () => ({
    trafficSource: clean(saved.trafficSource),
    trafficMedium: clean(saved.trafficMedium),
    trafficCampaign: clean(saved.trafficCampaign),
    trafficSearchTerm: clean(saved.trafficSearchTerm || '미확인'),
    trafficKeywordType: clean(saved.trafficKeywordType),
    trafficAdKeyword: clean(saved.trafficAdKeyword),
    trafficReferrer: clean(saved.trafficReferrer)
  });
  window.AutoGenieTraffic = {
    getFields: fields,
    trackConversion: () => {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'traffic_estimate_submit', {
          traffic_search_term: fields().trafficSearchTerm,
          traffic_source: fields().trafficSource,
          traffic_medium: fields().trafficMedium
        });
      }
    }
  };
  // URL에 실제 검색어가 없는 경우 브라우저에서 추측하거나 referrer로 조작하지 않습니다.
})();
