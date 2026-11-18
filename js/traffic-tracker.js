/* 오토지니 유입 분석: 현재 방문의 확인된 검색어만 기록합니다.
 * 기존 방문로그/견적 Apps Script 필드명을 유지합니다.
 * 주의: 네이버 실제 검색어(n_query)와 광고 키워드(utm_term)는 서로 다릅니다.
 */
(() => {
  'use strict';

  // v1 및 테스트용 localStorage의 오래된 검색어는 의도적으로 사용하지 않습니다.
  const KEY = 'autogenie_traffic_attribution_v2';
  const clean = value => String(value == null ? '' : value).trim().slice(0, 180);
  const known = value => {
    const str = clean(value);
    return str && !['미확인', 'unknown', '(not set)', 'not set'].includes(str.toLowerCase());
  };
  const q = new URLSearchParams(location.search);
  const referrerUrl = (() => {
    try { return document.referrer ? new URL(document.referrer) : null; }
    catch (_) { return null; }
  })();
  const refHost = (referrerUrl?.hostname || '').toLowerCase();
  const isInternal = !!referrerUrl && referrerUrl.origin === location.origin;
  const isNaver = /(^|\.)naver\.com$/.test(refHost);
  const isGoogle = /(^|\.)google\.[a-z.]+$/.test(refHost);
  const currentHost = location.hostname.toLowerCase();
  const hasCampaignParams = [...q.keys()].some(k => /^(utm_|n_query|n_click|gclid|wbraid|gbraid)/i.test(k));

  function getReferrerSearch() {
    if (!referrerUrl) return null;
    const host = refHost;
    let term = '';
    let type = '';
    if (/(^|\.)search\.naver\.com$/.test(host)) {
      term = clean(referrerUrl.searchParams.get('query') || referrerUrl.searchParams.get('n_query'));
      type = 'naver_referrer_query';
    } else if (isGoogle) {
      term = clean(referrerUrl.searchParams.get('q'));
      type = 'google_referrer_query';
    }
    return known(term) ? {term, type} : null;
  }

  // 추적 URL에 직접 들어온 검색어를 우선합니다. 추측값은 저장하지 않습니다.
  const actual = clean(q.get('n_query'));
  const referralSearch = getReferrerSearch();
  const found = known(actual)
    ? {term: actual, type: 'actual_naver_query'}
    : referralSearch;

  let saved = null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (parsed && parsed.hostname === currentHost && parsed.data && parsed.recordedAt) saved = parsed;
  } catch (_) {}

  // 외부에서 새로 진입하면 이전 유입정보를 무효화합니다.
  // 내부 이동/새로고침에서는 현재 세션의 최초 유입값을 유지합니다.
  const isReload = (() => {
    try { return performance.getEntriesByType('navigation')[0]?.type === 'reload'; }
    catch (_) { return false; }
  })();
  const newEntry = !saved || hasCampaignParams || (!isInternal && !isReload);

  if (newEntry) {
    const explicitSource = clean(q.get('utm_source')).toLowerCase();
    const googlePaidClick = ['gclid', 'wbraid', 'gbraid'].some(k => known(q.get(k)));
    const naverPaidClick = known(q.get('n_click'));
    const source = explicitSource || (googlePaidClick ? 'google' : naverPaidClick || known(actual) || isNaver ? 'naver' : isGoogle ? 'google' : refHost ? 'referral' : 'direct');
    const medium = clean(q.get('utm_medium')).toLowerCase() || (googlePaidClick || naverPaidClick ? 'cpc' : 'unknown');
    saved = {
      hostname: currentHost,
      recordedAt: new Date().toISOString(),
      data: {
        trafficSource: source,
        trafficMedium: medium,
        trafficCampaign: clean(q.get('utm_campaign')),
        trafficSearchTerm: found?.term || '미확인',
        trafficKeywordType: found?.type || 'unknown',
        trafficAdKeyword: clean(q.get('utm_term')),
        trafficReferrer: clean(refHost)
      }
    };
  } else if (found && !known(saved.data.trafficSearchTerm)) {
    // 동일 방문에서 아직 검색어가 없었다면 확인된 검색어만 보완합니다.
    saved.data.trafficSearchTerm = found.term;
    saved.data.trafficKeywordType = found.type;
  }

  try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch (_) {}

  const getFields = () => ({
    trafficSource: clean(saved.data.trafficSource),
    trafficMedium: clean(saved.data.trafficMedium),
    trafficCampaign: clean(saved.data.trafficCampaign),
    trafficSearchTerm: clean(saved.data.trafficSearchTerm) || '미확인',
    trafficKeywordType: clean(saved.data.trafficKeywordType) || 'unknown',
    trafficAdKeyword: clean(saved.data.trafficAdKeyword),
    trafficReferrer: clean(saved.data.trafficReferrer)
  });

  window.AutoGenieTraffic = {
    getFields,
    trackConversion: () => {
      if (typeof window.gtag === 'function') {
        const fields = getFields();
        window.gtag('event', 'traffic_estimate_submit', {
          traffic_search_term: fields.trafficSearchTerm,
          traffic_source: fields.trafficSource,
          traffic_medium: fields.trafficMedium
        });
      }
    },
    getTestInfo: () => ({
      referrer: document.referrer || '없음',
      nQuery: actual || '없음',
      referrerKeyword: referralSearch?.term || '미확인',
      firstSearchKeyword: getFields().trafficSearchTerm,
      keywordType: getFields().trafficKeywordType,
      recordedAt: saved.recordedAt
    })
  };
})();
