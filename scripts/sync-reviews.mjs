import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const SOURCE = 'https://www.agautoplan.com/review';
// 매 실행마다 최신 12페이지(통상 최대 144건)만 점검합니다.
// 이전 후기는 reviews.json에 보존되어 있으므로 전체 연도를 매번 다시 방문할 필요가 없습니다.
// 아임웹 사이트에서 연속 수십 페이지 탐색 시 HTTP 403이 발생하는 현상을 방지합니다.
const MAX_PAGES = 12;
const MAX_CONSECUTIVE_ERRORS = 8;
// 매회 너무 많은 상세페이지 요청으로 GitHub Actions 시간 초과가 발생하지 않도록 제한합니다.
// 신규 글부터 처리하며 기존 글 상세 보강은 수동 모드에서만 수행합니다.
const MAX_DETAIL_FETCHES_PER_RUN = 70;
const OUTPUT = path.resolve('data/reviews.json');
const MODE = process.env.REVIEW_SYNC_MODE || 'incremental';
const TARGET_ID = String(process.env.REVIEW_SYNC_ID || '').trim();
if (!['incremental', 'repair', 'refresh'].includes(MODE)) throw new Error(`지원하지 않는 수집 모드: ${MODE}`);
if (MODE === 'refresh' && !/^\d+$/.test(TARGET_ID)) throw new Error('refresh 모드에서는 게시글 ID(idx)를 입력해야 합니다.');


// 후기 분류는 메이커 + 국내/수입 차종명을 함께 검사합니다.
// 차종명이 단독으로 나오는 E200, 아토3, 모델Y 등의 후기에도 적용합니다.
function reviewMarket(review = {}) {
  const titleModel = `${review.title || ''} ${review.model || ''}`.toLowerCase();
  const brand = String(review.brand || '').toLowerCase();
  const importNames = [
    '메르세데스', '벤츠', 'mercedes', 'maybach', '마이바흐', 'bmw', '비엠더블유',
    '아우디', 'audi', '볼보', 'volvo', '폭스바겐', 'volkswagen', '포르쉐', 'porsche',
    '랜드로버', '레인지로버', 'land rover', 'range rover', '재규어', 'jaguar',
    '렉서스', 'lexus', '토요타', '도요타', 'toyota', '테슬라', 'tesla', '폴스타', 'polestar',
    '지프', 'jeep', '포드', 'ford', '링컨', 'lincoln', '캐딜락', 'cadillac',
    '푸조', 'peugeot', '마세라티', 'maserati', '람보르기니', 'lamborghini',
    '페라리', 'ferrari', '벤틀리', 'bentley', '롤스로이스', 'rolls-royce',
    'rolls royce', 'byd', '비야디', '미니', 'mini'
  ];
  const importModels = [
    '올로드콰트로', '콰트로', '이트론', 'e-tron', 'etron', 'xc40', 'xc60', 'xc90', 'ex30', 'ex40',
    'ec40', 's60', 's90', 'v60', 'v90', '티구안', '아테온', '투아렉', '파사트', '제타',
    '카이엔', '마칸', '파나메라', '타이칸', '911 카레라', '디펜더', '디스커버리', '이보크',
    '랭글러', '체로키', '레니게이드', '글래디에이터', '익스플로러', '브롱코',
    '머스탱', '노틸러스', '에비에이터', '코세어', '에스컬레이드', '리릭',
    '그레칼레', '기블리', '르반떼', '벤테이가', '컨티넨탈', '플라잉스퍼',
    '컬리넌', '고스트', '팬텀', '스펙터', '우루스', '우라칸', '레부엘토',
    '아토3', '돌핀', '푸로산게', '라브4', '프리우스', '알파드', '시에나',
    '컨트리맨', '클럽맨', '에이스맨', '모델y', '모델 y', '모델3', '모델 3',
    '모델s', '모델 s', '모델x', '모델 x'
  ];
  const domesticNames = ['현대', '기아', '제네시스', '르노', 'kgm', 'kg모빌리티', '쉐보레', 'chevrolet'];
  const domesticModels = [
    '펠리세이드','pv5','pv7','qm6','sm6','그랜저','아반떼','쏘나타','소나타','싼타페','투싼','팰리세이드','코나',
    '캐스퍼','스타리아','아이오닉','포터','봉고','모닝','카니발','쏘렌토',
    '스포티지','셀토스','니로','토레스','액티언','티볼리','렉스턴','코란도',
    '아르카나','그랑 콜레오스','그랑콜레오스','트랙스','트레일블레이저',
    '트래버스','콜로라도','타호','이쿼녹스'
  ];
  const word = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 영문 짧은 모델명은 앞뒤 단어 경계를 검사해 오분류를 막는다.
  const has = (text, keyword) => {
    if (/[a-z0-9]/i.test(keyword) && keyword.length < 6) {
      return new RegExp(`(^|[^a-z0-9])${word(keyword)}(?=$|[^a-z0-9])`, 'i').test(text);
    }
    if (/^[가-힣]{1,2}$/.test(keyword)) {
      return new RegExp(`(^|[^가-힣])${word(keyword)}(?=$|[^가-힣])`).test(text);
    }
    return text.includes(keyword);
  };
  const importShort = [
    'e200','e220','e250','e300','e350','e450','s350','s400','s450','s500','s580',
    'c200','c220','c300','eqa','eqb','eqe','eqs','gle','glc','gls','cla','cls','cle','gla','glb','amg',
    '320i','330i','520i','530i','540i','740i','x1','x2','x3','x4','x5','x6','x7','xm','z4','i4','i5','i7','ix',
    'a3','a4','a5','a6','a7','a8','q3','q4','q5','q6','q7','q8',
    'es300','nx','rx','ux','lm','ls','id.4','id.5','atto 3','seal', '씰'
  ];
  const domesticShort = ['k3','k5','k8','k9','ev3','ev4','ev5','ev6','ev9','g70','g80','g90','gv60','gv70','gv80','레이'];
  if (importNames.some(name => has(titleModel, name)) || importModels.some(name => has(titleModel, name)) || importShort.some(name => has(titleModel, name))) return 'import';
  if (domesticNames.some(name => has(titleModel, name)) || domesticModels.some(name => has(titleModel, name)) || domesticShort.some(name => has(titleModel, name))) return 'domestic';
  if (importNames.some(name => has(brand, name))) return 'import';
  if (domesticNames.some(name => has(brand, name))) return 'domestic';
  return 'unknown';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// 매년 1~3월에는 전년도 후기까지 유지하고 4월 1일부터 당해 연도만 유지합니다.
function reviewRetentionStart() {
  const today = koreaToday();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return new Date(month <= 3 ? year - 1 : year, 0, 1);
}

async function previousReviews() {
  // 기존 아카이브를 읽지 못한 경우 빈 배열로 덮어쓰지 않습니다.
  const payload = JSON.parse(await fs.readFile(OUTPUT, 'utf8'));
  const reviews = Array.isArray(payload) ? payload : payload?.reviews;
  if (!Array.isArray(reviews) || !reviews.length) throw new Error('기존 후기 아카이브가 비어 있거나 올바르지 않습니다.');
  const ids = new Set();
  for (const review of reviews) {
    if (!review || !/^\d+$/.test(String(review.id)) || ids.has(String(review.id))) {
      throw new Error('기존 후기 아카이브에 누락/중복 ID가 있습니다. 기존 파일을 유지합니다.');
    }
    ids.add(String(review.id));
  }
  return { payload, reviews };
}

function needsRepair(review) {
  return Boolean(review.pendingFullSync || !review.image || !(review.articleHtml || review.body || review.contentBlocks?.length));
}

function koreaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const value = type => Number(parts.find(part => part.type === type)?.value || 0);
  return new Date(value('year'), value('month') - 1, value('day'));
}

function parseRelativeDate(text = '') {
  const value = clean(text);
  if (!value) return null;

  const today = koreaToday();

  if (/오늘|방금|\d+\s*(?:분|시간)\s*전/.test(value)) {
    return today;
  }

  if (/어제/.test(value)) {
    today.setDate(today.getDate() - 1);
    return today;
  }

  const daysAgo = value.match(/(\d+)\s*일\s*전/);
  if (daysAgo) {
    today.setDate(today.getDate() - Number(daysAgo[1]));
    return today;
  }

  return null;
}

function parseDate(text = '') {
  const value = String(text || '');
  const patterns = [
    { re: /(20\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/, shortYear: false },
    { re: /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/, shortYear: false },
    // 아임웹이 최신 글 날짜를 26.09.03처럼 2자리 연도로 표시하는 경우 대응
    { re: /(?:^|\D)(\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})(?:\D|$)/, shortYear: true }
  ];

  for (const { re, shortYear } of patterns) {
    const m = value.match(re);
    if (!m) continue;
    const year = shortYear ? 2000 + Number(m[1]) : Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const d = new Date(year, month - 1, day);
    if (
      !Number.isNaN(d.getTime()) &&
      d.getFullYear() === year &&
      d.getMonth() === month - 1 &&
      d.getDate() === day
    ) return d;
  }

  return parseRelativeDate(value);
}

function parseImageDate(url = '') {
  // 날짜 텍스트가 DOM에 없을 때 아임웹 업로드/썸네일 경로의 YYYYMMDD를 최후 보조값으로 사용한다.
  const m = String(url || '').match(/\/(?:upload|thumbnail)\/(20\d{2})(\d{2})(\d{2})\//i);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) return null;
  return d;
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function clean(s='') {
  return String(s).replace(/\s+/g, ' ').trim();
}

function labelValue(text, label) {
  const re = new RegExp(`${label}\\s*[:：]\\s*([^\\n\\r]{1,160})`, 'i');
  return clean(text.match(re)?.[1] || '');
}

function guessBrand(text='') {
  const brands = [
    '현대','기아','제네시스','르노','KGM','쉐보레','벤츠','메르세데스','BMW',
    '아우디','볼보','폭스바겐','포르쉐','랜드로버','레인지로버','렉서스','토요타',
    '미니','MINI','테슬라','폴스타','지프','포드','링컨','캐딜락','푸조','마세라티',
    '벤틀리','롤스로이스','BYD'
  ];
  const lower = String(text).toLowerCase();
  return brands.find(b => lower.includes(b.toLowerCase())) || '';
}

function isInvalidTitle(value='') {
  const title = clean(value);
  if (!title) return true;
  return /접속할\s*수\s*없|페이지를\s*찾을\s*수\s*없|찾을\s*수\s*없|오류|error|not\s*found|없어요/i.test(title);
}

function normalizeReviewTitle(value='') {
  const title = clean(value)
    .replace(/^(?:\[?공지\]?|NOTICE)\s*[:：-]?\s*/i, '')
    .trim();
  return isInvalidTitle(title) ? '' : title;
}

async function collectCurrentPageItems(page) {
  return await page.evaluate(() => {
    const result = [];
    const seen = new Set();
    const anchors = [...document.querySelectorAll('a[href*="bmode=view"][href*="idx="]')];

    const abs = raw => {
      if (!raw) return '';
      try { return new URL(raw, location.href).href; } catch { return String(raw); }
    };

    const pickTitle = (a, card) => {
      const candidates = [
        a.getAttribute('title'),
        a.getAttribute('aria-label'),
        ...[...card.querySelectorAll('h1,h2,h3,h4,h5,.title,[class*="title"],strong,b')].map(el => el.textContent),
        a.textContent
      ].filter(Boolean).map(s => String(s).replace(/\s+/g, ' ').trim());

      return candidates.find(t => /출고\s*후기/.test(t)) || '';
    };

    for (const a of anchors) {
      const href = (a.getAttribute('href') || '').replace(/&amp;/g, '&');
      const id = href.match(/[?&]idx=(\d+)/)?.[1];
      if (!id || seen.has(id)) continue;

      const style = getComputedStyle(a);
      const rect = a.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) continue;

      const card =
        a.closest('li,article,tr,.list-style,.board-list,.board_list,.card,.item,[class*="board_item"],[class*="list_item"]') ||
        a.parentElement ||
        a;

      const text = (card.innerText || '').trim();
      const title = pickTitle(a, card);
      const imageCandidates = [];
      const pushImage = (raw, score = 0) => {
        const url = abs(raw);
        if (!url) return;
        const lower = url.toLowerCase();
        if (/logo|icon|profile|avatar|favicon|loading|spinner|blank|transparent|placeholder/.test(lower)) return;
        if (/cdn\.imweb\.me\/upload|imweb\.me\/upload/.test(lower)) score += 300000;
        if (/thumbnail/.test(lower)) score -= 50000;
        imageCandidates.push({ url, score });
      };

      for (const img of card.querySelectorAll('img')) {
        const rect = img.getBoundingClientRect();
        const width = Math.max(img.naturalWidth || 0, rect.width || 0, Number(img.getAttribute('width')) || 0);
        const height = Math.max(img.naturalHeight || 0, rect.height || 0, Number(img.getAttribute('height')) || 0);

        if (width && height && (width < 160 || height < 90)) continue;

        let score = Math.min(width * height, 5_000_000);
        if (width >= 300) score += 250000;
        if (height >= 160) score += 200000;

        [
          img.currentSrc,
          img.getAttribute('data-src'),
          img.getAttribute('data-original'),
          img.getAttribute('data-lazy-src'),
          img.getAttribute('data-image'),
          img.getAttribute('src'),
          img.getAttribute('srcset')
        ].filter(Boolean).forEach(raw => pushImage(raw, score));
      }

      for (const el of card.querySelectorAll('[style*="background"]')) {
        const bg = getComputedStyle(el).backgroundImage || el.style.backgroundImage || '';
        const match = bg.match(/url\(["']?(.*?)["']?\)/i);
        if (!match?.[1]) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width && rect.height && (rect.width < 160 || rect.height < 90)) continue;

        let score = Math.min((rect.width || 0) * (rect.height || 0), 5_000_000) + 100000;
        pushImage(match[1], score);
      }

      imageCandidates.sort((a, b) => b.score - a.score);
      const image = imageCandidates[0]?.url || '';

      seen.add(id);
      result.push({ id, href: abs(href), text, title, image });
    }

    return result;
  });
}

// 아임웹 게시판은 링크의 page / q 쿼리로 페이지를 구분합니다.
// 화면의 숫자 버튼을 클릭하면 게시글 내부의 숫자를 잘못 누르거나,
// 페이지 전환 전에 같은 목록을 다시 읽을 수 있어 직접 주소를 이동합니다.
function sourceListUrl(pageNumber) {
  const query = Buffer.from('a:1:{s:12:"keyword_type";s:3:"all";}').toString('base64');
  const url = new URL(SOURCE + '/');
  url.searchParams.set('page', String(pageNumber));
  url.searchParams.set('q', query);
  url.searchParams.set('t', 'board');
  return url.href;
}

async function collectBoardOrder(page) {
  const ordered = [];
  const seen = new Set();
  const cutoff = reviewRetentionStart();
  let failedPages = 0;

  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const url = sourceListUrl(pageNo);
    let items = [];
    let loaded = false;
    let lastHttpStatus = null;

    // 일시적인 네트워크 응답/게시판 지연 시 같은 페이지를 한 번 더 요청합니다.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        lastHttpStatus = response?.status() ?? null;
        if (!response?.ok()) throw new Error(`HTTP ${lastHttpStatus || 'no response'}`);
        await page.locator('a[href*="idx="]').first().waitFor({ state: 'attached', timeout: 10000 });
        // 지연 로딩된 썸네일을 포함해 수집합니다.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(400);
        await page.evaluate(() => window.scrollTo(0, 0));
        items = await collectCurrentPageItems(page);
        if (!items.length) throw new Error('게시판 링크 0건');
        loaded = true;
        break;
      } catch (error) {
        console.warn(`후기 목록 ${pageNo}페이지 재시도 ${attempt}/2: ${error.message}`);
        // 403/429는 서버가 접근을 제한했다는 신호입니다. 같은 URL을
        // 즉시 반복 요청하면 차단이 길어질 수 있으므로 재시도하지 않습니다.
        if (lastHttpStatus === 403 || lastHttpStatus === 429) break;
        await sleep(900);
      }
    }

    if (!loaded) {
      if (pageNo === 1) throw new Error('첫 후기 목록 페이지를 가져오지 못했습니다. 기존 JSON은 유지됩니다.');
      if (lastHttpStatus === 403 || lastHttpStatus === 429) {
        // 최신 목록은 확보했습니다. 추가 페이지가 거부되어도 이미 확보한
        // 새 글은 반영하고, 수집하지 못한 이전 후기들은 기존 JSON에서 보존합니다.
        console.warn(`⚠ ${pageNo}페이지 HTTP ${lastHttpStatus}: 원본 사이트의 접근 제한으로 목록 탐색을 종료합니다. 수집한 ${ordered.length}건으로 최신 후기를 갱신하고 기존 후기를 유지합니다.`);
        break;
      }
      failedPages++;
      if (failedPages >= 2) {
        console.warn(`⚠ ${pageNo}페이지까지 목록 수집이 연속 실패했습니다. 이미 확인한 ${ordered.length}건만 처리하고, 기존 데이터는 유지합니다.`);
        break;
      }
      continue;
    }
    failedPages = 0;

    const freshItems = items.filter(item => !seen.has(item.id));
    console.log(`목록 ${pageNo}페이지: ${items.length}건 / 처음 발견 ${freshItems.length}건`);
    if (!freshItems.length) {
      // 끝 페이지를 지나 같은 페이지가 반복되는 아임웹 게시판 예외 처리
      console.log('앞서 읽은 게시물만 나타나 목록 탐색을 종료합니다.');
      break;
    }

    for (const item of freshItems) {
      seen.add(item.id);
      ordered.push({
        ...item,
        listDate: parseDate(item.text) || parseImageDate(item.image),
        sourceOrder: ordered.length
      });
    }

    const pageDates = freshItems.map(item => parseDate(item.text) || parseImageDate(item.image)).filter(Boolean);
    if (pageDates.length && pageDates.every(date => date < cutoff)) {
      console.log(`목록 ${pageNo}페이지에서 ${isoDate(cutoff)} 이전 도달, 탐색 종료`);
      break;
    }
  }
  return ordered;
}


function normalizeImageCandidate(raw = '') {
  let value = String(raw || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .trim();

  if (!value) return '';
  try { value = decodeURIComponent(value); } catch {}
  value = value.replace(/["'<>),;]+$/g, '');
  if (value.startsWith('//')) value = `https:${value}`;
  return value;
}

function isJunkImageUrl(raw = '') {
  const lower = normalizeImageCandidate(raw).toLowerCase();
  return !lower ||
    /logo|icon|profile|avatar|favicon|loading|spinner|blank|transparent|placeholder|og-image|screenshot|car-img-bg|vehicle-stage-bg/.test(lower) ||
    lower.startsWith('data:image/svg') || lower.startsWith('data:image/gif');
}

function scoreImageUrl(raw = '') {
  const url = normalizeImageCandidate(raw);
  if (!url || isJunkImageUrl(url)) return -Infinity;
  let score = 0;
  if (/cdn\.imweb\.me\/upload\//i.test(url)) score += 5000;
  else if (/cdn\.imweb\.me\/thumbnail\//i.test(url)) score += 3000;
  else if (/imweb|cdn|upload|files|image/i.test(url)) score += 900;
  if (/\.(?:jpe?g|png|webp|avif)(?:\?|$)/i.test(url)) score += 500;
  if (/thumbnail/i.test(url)) score -= 250;
  return score;
}

function pickBestImageUrl(candidates = []) {
  return [...new Set(candidates.map(normalizeImageCandidate).filter(Boolean))]
    .filter(url => !isJunkImageUrl(url))
    .map(url => ({ url, score: scoreImageUrl(url) }))
    .sort((a, b) => b.score - a.score)[0]?.url || '';
}

function extractImwebImagesFromHtml(html = '') {
  let source = String(html || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&');

  // URL encoded script/JSON 안의 CDN 주소도 한 번 더 펼친다.
  try { source += `\n${decodeURIComponent(source)}`; } catch {}

  const urls = [];
  const patterns = [
    /https?:\/\/cdn\.imweb\.me\/(?:upload|thumbnail)\/[^\s"'<>\\)]+/gi,
    /\/\/cdn\.imweb\.me\/(?:upload|thumbnail)\/[^\s"'<>\\)]+/gi,
    /https?%3A%2F%2Fcdn\.imweb\.me%2F(?:upload|thumbnail)%2F[^\s"'<>]+/gi,
    /https?:\/\/[^\s"'<>\\)]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>\\)]*)?/gi
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const url = normalizeImageCandidate(match[0]);
      if (!url || isJunkImageUrl(url)) continue;
      urls.push(url);
    }
  }
  return [...new Set(urls)];
}

function extractImwebImageFromHtml(html = '') {
  return pickBestImageUrl(extractImwebImagesFromHtml(html));
}

async function collectRuntimeImageCandidates(page) {
  return await page.evaluate(() => {
    const values = [];
    const add = raw => { if (raw) values.push(String(raw)); };

    for (const entry of performance.getEntriesByType('resource')) add(entry.name);

    for (const img of document.querySelectorAll('img')) {
      add(img.currentSrc); add(img.src); add(img.srcset);
      for (const attr of img.attributes || []) add(attr.value);
    }
    for (const source of document.querySelectorAll('picture source, source[srcset]')) {
      add(source.getAttribute('src')); add(source.getAttribute('srcset'));
      for (const attr of source.attributes || []) add(attr.value);
    }

    for (const el of document.querySelectorAll('*')) {
      for (const attr of el.attributes || []) add(attr.value);
      const style = getComputedStyle(el);
      add(style.backgroundImage);
      add(style.content);
      for (let i = 0; i < style.length; i += 1) {
        const name = style[i];
        if (name?.startsWith('--')) add(style.getPropertyValue(name));
      }
    }

    for (const script of document.scripts) add(script.textContent);
    return values;
  }).catch(() => []);
}

async function parseDetail(page, item) {
  const { id, sourceOrder } = item;
  const url = item.href || `${SOURCE}/?bmode=view&idx=${id}`;

  let data = { text: '', title: '', image: '', body: '', images: [], contentBlocks: [] };

  // DOM/HTML에 남지 않는 아임웹 지연 로딩 이미지도 실제 네트워크 요청에서 잡는다.
  const networkImages = new Set();
  const onRequest = request => {
    try {
      const requestUrl = request.url();
      if (/cdn\.imweb\.me\/(?:upload|thumbnail)\//i.test(requestUrl) && !isJunkImageUrl(requestUrl)) {
        networkImages.add(requestUrl);
      }
    } catch {}
  };
  const onResponse = response => {
    try {
      const responseUrl = response.url();
      const contentType = response.headers()['content-type'] || '';
      if (!/cdn\.imweb\.me\/(?:upload|thumbnail)\//i.test(responseUrl)) return;
      if (!/^image\//i.test(contentType) && !/\.(?:jpe?g|png|webp|gif)(?:\?|$)/i.test(responseUrl)) return;
      if (/logo|icon|profile|avatar|favicon|loading|spinner|blank|transparent|placeholder/i.test(responseUrl)) return;
      networkImages.add(responseUrl);
    } catch {}
  };
  page.on('request', onRequest);
  page.on('response', onResponse);

  try {
    const canonicalUrl = `${SOURCE}/?bmode=view&idx=${id}`;
    const targets = [...new Set([url, canonicalUrl])];

    // 목록 URL에 검색 파라미터가 붙어 있거나 첫 로딩이 불완전한 경우를 대비해 canonical URL까지 재시도한다.
    for (let attempt = 0; attempt < targets.length; attempt += 1) {
      const response = await page.goto(targets[attempt], { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!response?.ok()) throw new Error(`HTTP ${response?.status() || 'no response'}`);
      await page.waitForTimeout(attempt === 0 ? 850 : 1200);

      // 한 화면 단위로 실제 게시글 끝까지 이동해야 지연 로딩된 사진을 빠뜨리지 않는다.
      const metrics = await page.evaluate(() => ({
        height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        step: Math.max(600, Math.floor(innerHeight * 0.85))
      }));
      let visited = 0;
      for (let y = 0; y < metrics.height && visited < 80; y += metrics.step, visited++) {
        await page.evaluate(top => window.scrollTo(0, top), y);
        await page.waitForTimeout(110);
      }
      await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      if (attempt === targets.length - 1 || (await page.locator('.board_txt_area img, .board_view_body img, .fr-view img').count().catch(() => 0)) > 2) break;
    }

    data = await page.evaluate(() => {
      const pageText = document.body?.innerText || '';
      const trim = value => String(value || '').replace(/\s+/g, ' ').trim();
      const titleCandidates = [
        document.querySelector('.board_view .title')?.textContent,
        document.querySelector('.board_txt_area h1')?.textContent,
        document.querySelector('[class*="board_title"]')?.textContent,
        document.querySelector('h1')?.textContent,
        document.title
      ].filter(Boolean).map(trim);
      const title = titleCandidates.find(text => /출고\s*후기/.test(text)) || titleCandidates[0] || '';

      // 원본 게시글을 담은 편집기만 선택한다. .board_view 전체를 선택하면
      // 아임웹의 공통 푸터/결제인증/관련 위젯이 함께 들어오는 경우가 있다.
      const selectors = [
        '.board_txt_area .fr-view', '.board_view_body .fr-view',
        '.board_txt_area .board_view_body', '.board_view_body .board_txt_area',
        '.board_txt_area', '.board_view_body',
        '.board_view .fr-view', '.board_view .board-content',
        '[class*="board_view"] [class*="editor"]',
        '.board_view'
      ];
      const candidates = [...new Set(selectors.flatMap(sel => [...document.querySelectorAll(sel)]))]
        .filter(el => !el.closest('header,footer,nav') && el.getClientRects().length > 0)
        .map(el => ({
          el,
          text: trim(el.innerText),
          count: el.querySelectorAll('img,picture,figure').length,
          size: el.outerHTML.length,
          // 메인 글의 필수 키워드로 광고/메뉴 블록을 구분한다.
          detail: /담당자|차량\s*모델명|진행\s*방식/.test(el.innerText || '')
        }))
        .filter(item => item.text.length > 25 && (item.count > 0 || item.detail));
      const editorial = candidates.filter(item => !item.el.matches('.board_view'));
      // 편집기 영역 중 콘텐츠가 가장 많은 것을 먼저 고르되 같은 분량이면 좁은 영역 우선.
      // .board_view 최상위 요소는 더 정확한 편집기가 없을 때만 보조로 사용한다.
      const pool = editorial.length ? editorial : candidates;
      pool.sort((a, b) => Number(b.detail) - Number(a.detail) || b.count - a.count || b.text.length - a.text.length || a.size - b.size);
      const root = pool[0]?.el || document.querySelector('.board_txt_area,.board_view_body') || null;

      const urlOf = raw => {
        if (!raw) return '';
        const value = String(raw).trim().replace(/&amp;/gi, '&').replace(/\\\//g, '/');
        try {
          const result = new URL(value, location.href);
          return /^https?:$/.test(result.protocol) ? result.href : '';
        } catch { return ''; }
      };
      const urlKey = raw => {
        try {
          const url = new URL(raw);
          // 썸네일과 원본은 주소가 다를 수 있지만 같은 파일이다.
          const parts = url.pathname.split('/').filter(Boolean);
          return `${url.hostname}/${parts.slice(-2).join('/').toLowerCase()}`;
        } catch { return String(raw || ''); }
      };
      const junkImage = (url, img) => {
        const details = [url, img?.getAttribute('alt'), img?.getAttribute('title'),
          img?.closest('a')?.getAttribute('href'), img?.parentElement?.getAttribute('title')].join(' ').toLowerCase();
        if (/escrow|에스크로|kbes|kb-escrow|안심결제|결제인증|favicon|avatar|profile|placeholder|loading|spinner|blank\.gif|transparent|\/logo[\/_\.]/i.test(details)) return true;
        const rect = img?.getBoundingClientRect();
        const width = Math.max(img?.naturalWidth || 0, rect?.width || 0);
        const height = Math.max(img?.naturalHeight || 0, rect?.height || 0);
        // 원본 출고 사진은 본문 폭을 사용하는 반면 KB 에스크로 등의 마크는 작다.
        if (width && height && width < 145 && height < 145) return true;
        return false;
      };
      const findImage = img => {
        const srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset') || '';
        const values = [img.getAttribute('data-original'), img.getAttribute('data-original-src'),
          img.getAttribute('data-lazy-src'), img.getAttribute('data-src'),
          img.getAttribute('data-image'), img.getAttribute('src'), img.currentSrc,
          srcset.split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean).at(-1)];
        const candidates = values.map(urlOf).filter(Boolean);
        return candidates.find(url => !junkImage(url, img)) || '';
      };

      const allowed = new Set(['DIV','SECTION','ARTICLE','P','BR','SPAN','FONT','STRONG','B','EM','I','U','S','SUB','SUP','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','UL','OL','LI','FIGURE','IMG','HR','TABLE','TBODY','THEAD','TR','TD','TH']);
      const blocked = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','OBJECT','EMBED','SVG','BUTTON','FORM','INPUT','TEXTAREA','SELECT','VIDEO','AUDIO','CANVAS','HEADER','FOOTER','NAV','ASIDE']);
      const styleRules = [
        ['font-size', 'fontSize'], ['font-family','fontFamily'], ['font-weight','fontWeight'],
        ['font-style','fontStyle'], ['line-height','lineHeight'], ['letter-spacing','letterSpacing'],
        ['text-align','textAlign'], ['text-decoration','textDecorationLine'],
        ['color','color'], ['white-space','whiteSpace']
      ];
      const blockRules = [
        ['margin-top','marginTop'], ['margin-bottom','marginBottom'],
        ['padding-top','paddingTop'], ['padding-bottom','paddingBottom'],
        ['padding-left','paddingLeft'], ['padding-right','paddingRight']
      ];
      const safeStyle = (el, tag) => {
        const css = getComputedStyle(el);
        const styles = [];
        for (const [key, prop] of styleRules) {
          const value = css[prop];
          if (!value || /url\s*\(|expression\s*\(|javascript:|var\s*\(/i.test(value)) continue;
          if (key === 'font-family' && value.length > 180) continue;
          styles.push(`${key}:${value}`);
        }
        if (['DIV','SECTION','ARTICLE','P','H1','H2','H3','H4','H5','H6','FIGURE','LI','BLOCKQUOTE'].includes(tag)) {
          for (const [key, prop] of blockRules) {
            const value = css[prop];
            if (/^\d+(?:\.\d+)?px$/.test(value) && parseFloat(value) > 0 && parseFloat(value) < 300) styles.push(`${key}:${value}`);
          }
        }
        return styles.join(';');
      };
      const seenImages = new Set();
      const articleImages = [];
      let omittedImages = 0;
      let duplicates = 0;
      let visited = 0;

      // HTML을 생으로 저장하지 않고, 텍스트/문단/이미지와 안전한 서식만 복사한다.
      // <br>, 빈 문단, inline span 서식을 보존하므로 원본의 줄바꿈과 여백이 유지된다.
      const serialize = (node, outParent) => {
        if (++visited > 12000) return;
        if (node.nodeType === Node.TEXT_NODE) {
          outParent.appendChild(document.createTextNode(node.nodeValue || ''));
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName;
        if (blocked.has(tag) || node.matches('[aria-hidden="true"]')) return;
        if (node.closest('footer,header,nav,aside,.footer,#footer,.site-footer,.footer-wrap')) return;
        if (tag === 'IMG' || tag === 'SOURCE') {
          if (tag === 'SOURCE') return;
          const url = findImage(node);
          if (!url) { omittedImages++; return; }
          const key = urlKey(url);
          if (seenImages.has(key)) { duplicates++; return; }
          seenImages.add(key);
          articleImages.push(url);
          const image = document.createElement('img');
          image.setAttribute('src', url);
          image.setAttribute('alt', trim(node.getAttribute('alt')).slice(0, 180));
          image.setAttribute('loading', 'lazy');
          image.setAttribute('referrerpolicy', 'no-referrer');
          const css = getComputedStyle(node);
          const sourceWidth = Math.max(node.getBoundingClientRect().width || 0, Number(node.getAttribute('width')) || 0);
          if (sourceWidth >= 150 && sourceWidth <= 2400) image.style.width = `${Math.round(sourceWidth)}px`;
          if (css.display === 'block') image.style.display = 'block';
          outParent.appendChild(image);
          return;
        }
        const to = allowed.has(tag) ? document.createElement(tag.toLowerCase()) : document.createElement('span');
        const styles = safeStyle(node, tag);
        if (styles) to.setAttribute('style', styles);
        outParent.appendChild(to);
        for (const child of node.childNodes) serialize(child, to);
      };
      let articleHtml = '';
      let body = '';
      let selected = 'none';
      let rootTextStyle = '';
      if (root) {
        selected = `${root.tagName.toLowerCase()}${root.className && typeof root.className === 'string' ? '.' + root.className.trim().split(/\s+/).join('.') : ''}`.slice(0, 150);
        body = (root.innerText || '').replace(/\r/g, '').slice(0, 80000);
        const wrapper = document.createElement('div');
        wrapper.className = 'review-original-content';
        rootTextStyle = safeStyle(root, root.tagName);
        if (rootTextStyle) wrapper.setAttribute('style', rootTextStyle);
        // 본문 root 자체의 블록 요소 여백은 제외하고 자식 문단 여백을 보존한다.
        for (const child of root.childNodes) serialize(child, wrapper);
        articleHtml = wrapper.outerHTML;
      }
      return {
        text: pageText, title,
        image: articleImages[0] || '',
        body, images: articleImages,
        articleHtml: articleHtml.slice(0, 750000),
        contentBlocks: [],
        scrapeLog: { selected, count: articleImages.length, omittedImages, duplicates,
          textLength: body.length, htmlLength: articleHtml.length }
      };
    });
    console.log(`[본문 DOM] #${sourceOrder} id=${id} ${JSON.stringify(data.scrapeLog || {})}`);

    // DOM 밖의 picture/source, CSS 변수, script JSON, Performance Resource까지 한 번에 훑는다.
    if (!data.image) {
      const runtimeValues = await collectRuntimeImageCandidates(page);
      const runtimeUrls = runtimeValues.flatMap(value => extractImwebImagesFromHtml(value));
      data.image = pickBestImageUrl(runtimeUrls);
      if (data.image) console.log(`[이미지 RUNTIME fallback] #${sourceOrder} ${id}`);
    }

    // 렌더링 HTML/스크립트 원문에 남은 CDN URL 추출.
    if (!data.image) {
      const html = await page.content().catch(() => '');
      data.image = extractImwebImageFromHtml(html);
      if (data.image) console.log(`[이미지 HTML fallback] #${sourceOrder} ${id}`);
    }

    // 브라우저가 실제로 요청한 이미지. request + response를 모두 수집한다.
    if (!data.image && networkImages.size) {
      data.image = pickBestImageUrl([...networkImages]);
      if (data.image) console.log(`[이미지 NETWORK fallback] #${sourceOrder} ${id}`);
    }

    // 브라우저 DOM이 불완전해도 서버 원문에는 주소가 있을 수 있어 canonical 상세 HTML을 직접 한 번 더 읽는다.
    if (!data.image) {
      const canonicalUrl = `${SOURCE}/?bmode=view&idx=${id}`;
      try {
        const response = await page.context().request.get(canonicalUrl, { timeout: 15000 });
        if (response.ok()) {
          const rawHtml = await response.text();
          data.image = extractImwebImageFromHtml(rawHtml);
          if (data.image) console.log(`[이미지 DIRECT-HTML fallback] #${sourceOrder} ${id}`);
        }
      } catch {}
    }
  } catch (error) {
    console.warn(`[상세 보조] ${id} 상세페이지 로드 실패: ${error.message}`);
    return null;
  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
  }

  const combinedText = `${data.text || ''}\n${item.text || ''}`;

  let date =
    parseDate(data.text) ||
    item.listDate ||
    parseDate(item.text);

  if (!date) {
    date = parseImageDate(item.image) || parseImageDate(data.image);
    if (date) {
      console.warn(`[날짜 보조] #${sourceOrder} id=${id} 날짜 텍스트가 없어 이미지 경로 날짜 ${isoDate(date)} 사용`);
    }
  }

  if (!date) {
    console.warn(`[건너뜀] #${sourceOrder} id=${id} 날짜를 상세/목록/이미지 경로 어디에서도 찾지 못함`);
    return null;
  }

  const cutoff = reviewRetentionStart();
  if (date < cutoff) {
    return { tooOld: true, date };
  }

  const model =
    labelValue(combinedText, '차량 모델명') ||
    clean(item.title).replace(/\s*출고\s*후기.*$/,'').trim();

  const validDetailTitle = normalizeReviewTitle(data.title);
  const validListTitle = normalizeReviewTitle(item.title);

  let title =
    validDetailTitle ||
    validListTitle ||
    normalizeReviewTitle(combinedText.split(/\n+/).find(line => /출고\s*후기/.test(line)) || '');

  title = normalizeReviewTitle(title);
  if (isInvalidTitle(title) || !title) {
    title = model ? `${model} 출고 후기입니다.` : '오토지니 출고 후기입니다.';
  }

  // 목록 카드 썸네일을 우선 사용하고, 없거나 비정상일 때 상세페이지 이미지를 사용한다.
  const listImage = normalizeImageCandidate(item.image || '');
  const image = !isJunkImageUrl(listImage) ? listImage : (data.image || '');

  // 목록 썸네일만 확보한 불완전한 결과는 신규 완료로 저장하지 않습니다.
  // 원본 본문 또는 본문 이미지가 실제로 확보되어야 다음 실행에서 건너뜁니다.
  if (!image || !(clean(data.body) || data.images?.length || data.contentBlocks?.length)) {
    console.warn(`[상세 미완료] ${id}: 본문 또는 이미지 누락, 다음 실행에서 재시도`);
    return null;
  }

  return {
    id: String(id),
    title,
    brand: guessBrand(`${title} ${model}`),
    model,
    manager: labelValue(combinedText, '담당자'),
    color: labelValue(combinedText, '색상'),
    method: labelValue(combinedText, '진행 방식'),
    date: isoDate(date),
    image,
    body: data.body || '',
    images: data.images?.length ? data.images : (image ? [image] : []),
    contentBlocks: data.contentBlocks || [],
    articleHtml: data.articleHtml || '',
    url,
    sourceOrder
  };
}

// 예약 실행은 신규 ID만 상세 수집합니다. 원본의 연도별 보관 정책은 유지합니다.
const { payload: previousPayload, reviews: archivedReviews } = await previousReviews();
const cutoff = reviewRetentionStart();
const oldReviews = archivedReviews.filter(review => {
  const date = parseDate(review.date);
  // 날짜를 해석하지 못해도 기존 기록은 임의로 삭제하지 않습니다.
  return !date || date >= cutoff;
});
const oldById = new Map(oldReviews.map(review => [String(review.id), review]));
const allArchivedIds = new Set(archivedReviews.map(review => String(review.id)));
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    locale: 'ko-KR',
    viewport: { width: 1440, height: 1800 }
  });
  const listPage = await context.newPage();
  console.log(`후기 수집 모드: ${MODE} / 기존 보관 ${oldReviews.length}건`);
  const items = await collectBoardOrder(listPage);
  if (!items.length) throw new Error('후기 게시글을 찾지 못했습니다. 기존 파일을 유지합니다.');

  // 자동 실행에서는 상세 본문이 비어 있더라도 이미 보관된 ID는 절대 재수집하지 않습니다.
  const newItems = items.filter(item => !allArchivedIds.has(String(item.id)));
  const listedById = new Map(items.map(item => [String(item.id), item]));
  const toItem = review => listedById.get(String(review.id)) || {
    id: String(review.id), href: review.url, title: review.title,
    text: review.date, listDate: parseDate(review.date), image: review.image,
    sourceOrder: review.sourceOrder
  };
  let targets = newItems;
  if (MODE === 'repair') {
    targets = [...newItems, ...oldReviews.filter(needsRepair).map(toItem)];
  } else if (MODE === 'refresh') {
    const target = listedById.get(TARGET_ID) || (oldById.has(TARGET_ID) ? toItem(oldById.get(TARGET_ID)) : null);
    if (!target) throw new Error(`지정한 후기 ID ${TARGET_ID}를 찾지 못했습니다.`);
    targets = [target];
  }
  console.log(`목록 ${items.length}건 / 신규 후보 ${newItems.length}건 / 기존 건너뜀 ${items.length - newItems.length}건 / 상세 수집 대상 ${targets.length}건`);
  const fresh = [];
  const detailPage = targets.length ? await context.newPage() : null;
  const failed = [];
  let errors = 0;
  let detailFetches = 0;
  for (const item of targets) {
    if (detailFetches >= MAX_DETAIL_FETCHES_PER_RUN) {
      console.warn(`상세 수집 제한 ${MAX_DETAIL_FETCHES_PER_RUN}건 도달. 남은 후보는 다음 실행에서 처리합니다.`);
      break;
    }
    const id = String(item.id);
    const old = oldById.get(id);
    detailFetches++;
    const parsed = await parseDetail(detailPage, item);
    if (parsed?.tooOld) {
      console.log(`[보관 기간 이전] ${id}: ${isoDate(parsed.date)}`);
      errors = 0;
      continue;
    }
    if (!parsed || isInvalidTitle(parsed.title) || !parsed.image || !(parsed.body || parsed.articleHtml || parsed.contentBlocks?.length)) {
      failed.push(id);
      errors++;
      if (errors >= MAX_CONSECUTIVE_ERRORS) {
        console.warn(`연속 상세 수집 실패 ${errors}건. 기존 데이터를 보존하고 다음 실행에서 재시도합니다.`);
        break;
      }
      continue;
    }
    errors = 0;
    const market = reviewMarket(parsed);
    if (market === 'unknown') {
      failed.push(id);
      console.warn(`[분류 미확정] ${id}: ${parsed.title} — 저장하지 않고 다음 실행에서 재시도`);
      continue;
    }
    parsed.title = normalizeReviewTitle(parsed.title) || parsed.title;
    if (old) {
      const merged = { ...old, ...parsed, image: parsed.image || old.image, body: parsed.body || old.body,
        articleHtml: parsed.articleHtml || old.articleHtml || '',
        images: parsed.images?.length ? parsed.images : old.images,
        contentBlocks: parsed.contentBlocks?.length ? parsed.contentBlocks : old.contentBlocks };
      delete merged.pendingFullSync;
      fresh.push(merged);
    } else {
      fresh.push(parsed);
    }
    console.log(`[${old ? '수동 갱신' : '신규 추가'}][${market}] ${id} ${parsed.date} ${parsed.title}`);
    await sleep(180);
  }

  // 정상 수집된 신규 후기만 추가합니다. 실패한 ID는 아카이브에 없으므로 다음 번에 재시도됩니다.
  // 기존 후기 객체(sourceOrder 포함)는 자동 실행에서 변경하지 않습니다.
  const freshIds = new Set(fresh.map(review => String(review.id)));
  const siteReviews = fresh.length ? [...fresh, ...oldReviews.filter(review => !freshIds.has(String(review.id)))]
    .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0) ||
      (Number(a.sourceOrder ?? 999999) - Number(b.sourceOrder ?? 999999))) : oldReviews;
  if (!siteReviews.length) throw new Error('저장할 후기 데이터가 없습니다. 기존 파일을 유지합니다.');
  const added = fresh.filter(review => !oldById.has(String(review.id))).length;
  const updated = fresh.length - added;
  const removed = archivedReviews.length - oldReviews.length;
  const missingImages = siteReviews.filter(review => !review.image);
  if (missingImages.length) console.warn(`기존 이미지 누락 ${missingImages.length}건: 수동 repair 모드에서 보강할 수 있습니다.`);
  if (failed.length || detailFetches < targets.length) {
    console.warn(`::warning::상세 수집 미완료 ${failed.length}건, 미시도 ${targets.length - detailFetches}건. 다음 실행에서 다시 확인하세요. ID: ${failed.join(', ')}`);
  }
  // 신규/갱신/보관기간 정리 모두 없으면 generatedAt을 포함한 JSON 원본을 그대로 둡니다.
  if (JSON.stringify(archivedReviews) === JSON.stringify(siteReviews)) {
    console.log('후기 내용 변경 없음: 기존 JSON을 그대로 보존합니다.');
  } else {
    const metadata = Array.isArray(previousPayload) ? {} : previousPayload;
    await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
    await fs.writeFile(OUTPUT, JSON.stringify({
      ...metadata,
      source: SOURCE,
      generatedAt: new Date().toISOString(),
      retentionStart: isoDate(cutoff),
      order: 'date-descending-board-order-for-ties',
      count: siteReviews.length,
      reviews: siteReviews
    }, null, 2) + '\n', 'utf8');
  }
  console.log(`완료: 신규 ${added}건 / 수동 갱신 ${updated}건 / 보관 기간 정리 ${removed}건 / 총 ${siteReviews.length}건 / 상세 요청 ${detailFetches}건`);
  if (MODE === 'refresh' && !fresh.length) throw new Error(`지정한 후기 ${TARGET_ID} 갱신 실패. 기존 데이터를 유지했습니다.`);
  if (targets.length && !fresh.length && failed.length) throw new Error('상세 수집 대상 중 저장에 성공한 후기가 없습니다. 기존 데이터를 유지했습니다.');
} finally {
  await browser.close();
}
