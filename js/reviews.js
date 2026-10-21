(() => {
  const section = document.getElementById('reviewSection');
  const carousel = document.getElementById('reviewCarousel');
  const track = document.getElementById('reviewTrack');
  if (!section || !carousel || !track) return;

  const SOURCE = 'https://www.agautoplan.com/review';
  const READER_PREFIX = 'https://r.jina.ai/';
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

  const FALLBACK_REVIEWS = [
      {
          "id": "172466664",
          "title": "XC60 개인 리스 출고 후기입니다.",
          "brand": "볼보",
          "model": "볼보 XC60",
          "manager": "",
          "color": "",
          "method": "개인 / 리스",
          "date": "2026-07-15",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=172466664"
      },
      {
          "id": "172230646",
          "title": "그랜저 개인 렌트 출고 후기입니다.",
          "brand": "현대",
          "model": "그랜저",
          "manager": "",
          "color": "",
          "method": "개인 / 렌트",
          "date": "2026-07-03",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=172230646"
      },
      {
          "id": "172150868",
          "title": "테슬라 모델 Y 개인 리스 출고 후기입니다.",
          "brand": "테슬라",
          "model": "테슬라 모델 Y",
          "manager": "김진욱 차장",
          "color": "",
          "method": "개인 / 리스",
          "date": "2026-07-01",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=172150868"
      },
      {
          "id": "172150863",
          "title": "GV70 EV 법인 렌트 출고 후기입니다.",
          "brand": "제네시스",
          "model": "GV70 EV",
          "manager": "정원상 차장",
          "color": "(외장) 우유니 화이트 / (내장) 바닐라 베이지 투톤",
          "method": "법인 / 렌트",
          "date": "2026-07-01",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=172150863"
      },
      {
          "id": "172150866",
          "title": "모닝 개인사업자 렌트 출고 후기입니다.",
          "brand": "기아",
          "model": "모닝 가솔린 프레스티지",
          "manager": "엄세훈 차장",
          "color": "(외장) 스파클링 실버 / (내장) 브라운",
          "method": "개인사업자 / 렌트",
          "date": "2026-07-01",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=172150866"
      },
      {
          "id": "172108171",
          "title": "EV3 개인 출고 후기입니다.",
          "brand": "기아",
          "model": "EV3 롱레인지 에어",
          "manager": "이병수 차장",
          "color": "(외장) 스노우 화이트펄 / (내장) 미디움그레이",
          "method": "개인",
          "date": "2026-06-26",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=172108171"
      },
      {
          "id": "172108172",
          "title": "테슬라 모델 Y 법인 리스 출고 후기입니다.",
          "brand": "테슬라",
          "model": "모델YL",
          "manager": "박지석 팀장",
          "color": "(외장) 실버 / (내장) 젠그레이",
          "method": "법인 / 리스",
          "date": "2026-06-26",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=172108172"
      },
      {
          "id": "172108179",
          "title": "그랜저 개인 출고 후기입니다.",
          "brand": "현대",
          "model": "그랜저 가솔린",
          "manager": "강호진 차장",
          "color": "(외장) 어비스블랙 / (내장) 인디고 브라운",
          "method": "개인",
          "date": "2026-06-24",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=172108179"
      },
      {
          "id": "172108181",
          "title": "EV4 개인 출고 후기입니다.",
          "brand": "기아",
          "model": "EV4 GT라인",
          "manager": "강한석 차장",
          "color": "(외장) 모닝헤이즈 / (내장) 브라운",
          "method": "개인",
          "date": "2026-06-24",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=172108181"
      },
      {
          "id": "171879616",
          "title": "XC60 렌트 출고 후기입니다.",
          "brand": "볼보",
          "model": "볼보 XC60",
          "manager": "정철희 차장",
          "color": "(외장) 크리스탈 화이트 / (내장) 아이보리",
          "method": "개인 / 렌트",
          "date": "2026-06-17",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=171879616"
      },
      {
          "id": "171879625",
          "title": "EV4 렌트 출고 후기입니다.",
          "brand": "기아",
          "model": "EV4",
          "manager": "",
          "color": "",
          "method": "렌트",
          "date": "2026-06-17",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=171879625"
      },
      {
          "id": "171879626",
          "title": "G80 리스 출고 후기입니다.",
          "brand": "제네시스",
          "model": "G80",
          "manager": "강호진 차장",
          "color": "(외장) 비크블랙 / (내장) 에크루 카멜 모노톤",
          "method": "개인사업자 / 리스",
          "date": "2026-06-17",
          "image": "",
          "url": "https://www.agautoplan.com/review/?bmode=view&idx=171879626"
      }
  ];

  const SWIPER_DELAY = 2200; // 한 카드가 머무는 시간(ms)
  const SWIPER_SPEED = 1000; // 옆으로 스르륵 넘어가는 시간(ms)
  // 메인 슬라이더에는 최근 3개월만 사용하고, 전체보기에는 연도별 보관 데이터 전부 사용합니다.
  const MAX_REVIEWS = 2000;
  const MIN_LOCAL_REVIEWS = 20;
  const SOURCE_LIST_PAGES = 30;
  const SOURCE_MAX_DETAIL_FETCHES = 360;
  const SOURCE_CACHE_KEY = 'autogenie-all-reviews-weekly-v1';
  const SOURCE_CACHE_TTL = 30 * 60 * 1000;
  const LOCAL_FRESH_DAYS = 14; // 오래된 JSON을 최신 후기처럼 먼저 노출하지 않는다.

  let renderedReviews = [];
  let allReviews = [];
  let reviewDialogView = '';
  let reviewDetailFromList = false;
  let reviewListScrollTop = 0;
  let reviewDialog = null;
  let reviewDialogReturnFocus = null;
  let reviewHistoryActive = false;
  let reviewClosingFromPopstate = false;
  let reviewReturnScroll = null;
  let activeReviewImages = [];
  let activeReviewImageIndex = 0;
  let hiddenAfterBrandSelection = false;
  let sourceRefreshStarted = false;
  let reviewSwiper = null;

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  function cleanReviewTitle(value = '') {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(?:\[?공지\]?|NOTICE)\s*[:：-]?\s*/i, '')
      .trim();
  }

  function detectBrand(text = '') {
    const lower = String(text).toLowerCase();
    const market = reviewMarket({ title: text });
    if (market === 'import') return '수입차';
    if (market === 'domestic') return '국산차';
    return '';
  }

  function parseReviewDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    let match = raw.match(/(\d{2,4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
    if (!match) match = raw.match(/(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (!match) return null;
    let year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 100) year += 2000;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime())) return null;
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
  }

  const reviewTimestamp = review => parseReviewDate(review?.date)?.getTime() || 0;

  function newestReviewTimestamp(items = []) {
    return (items || []).reduce((latest, review) => Math.max(latest, reviewTimestamp(review)), 0);
  }

  function hasFreshLocalReviews(items = []) {
    const latest = newestReviewTimestamp(items);
    if (!latest) return false;
    return latest >= Date.now() - LOCAL_FRESH_DAYS * 24 * 60 * 60 * 1000;
  }

  function showReviewLoading() {
    section.hidden = false;
    destroyReviewSwiper();
    track.innerHTML = `<article class="review-card review-card--loading">
      <div class="review-card__body">
        <strong>최신 출고 후기를 불러오는 중입니다.</strong>
        <p>오토지니 후기 게시판의 최신 글을 확인하고 있습니다.</p>
      </div>
    </article>`;
  }

  function reviewKey(review) {
    if (review?.id) return `id:${String(review.id)}`;
    const idx = String(review?.url || '').match(/[?&]idx=(\d+)/)?.[1];
    if (idx) return `id:${idx}`;
    if (review?.url) return `url:${String(review.url)}`;
    return `title:${String(review?.title || '')}|${String(review?.date || '')}`;
  }

  function formatReviewDate(value) {
    const date = parseReviewDate(value);
    if (!date) return '';
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  // 한국 날짜 기준으로 연도 전환을 계산합니다. 1~3월은 전년도+당해 연도,
  // 4월부터는 당해 연도만 전체보기 목록에 유지합니다.
  function reviewPeriod(today = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(today);
    const part = type => Number(parts.find(item => item.type === type)?.value);
    const year = part('year');
    const month = part('month');
    const day = part('day');
    const firstYear = month <= 3 ? year - 1 : year;
    // setMonth()를 그대로 쓰면 31일 기준 월말이 다음 달로 넘어갈 수 있어 보정합니다.
    const targetMonthIndex = month - 1 - 3;
    const lastDayInTargetMonth = new Date(year, targetMonthIndex + 1, 0).getDate();
    return {
      year,
      firstYear,
      archiveStart: Date.UTC(firstYear, 0, 1),
      rollingStart: Date.UTC(year, targetMonthIndex, Math.min(day, lastDayInTargetMonth)),
      todayEnd: Date.UTC(year, month - 1, day, 23, 59, 59, 999)
    };
  }

  function prepareReviews(items) {
    const period = reviewPeriod();
    const prepared = (items || [])
      .filter(review => Boolean(review?.title))
      // 통합 견적서는 국산·수입차를 함께 보여주되 분류 불명 후기는 제외합니다.
      .filter(review => reviewMarket(review) !== 'unknown')
      .map((review, inputOrder) => ({ ...review, _inputOrder: inputOrder, _timestamp: reviewTimestamp(review) }))
      .filter(review => review._timestamp >= period.archiveStart && review._timestamp <= period.todayEnd)
      .sort((a, b) => b._timestamp - a._timestamp ||
        (Number.isFinite(+a.sourceOrder) ? +a.sourceOrder : a._inputOrder) -
        (Number.isFinite(+b.sourceOrder) ? +b.sourceOrder : b._inputOrder));

    const seen = new Set();
    const unique = [];
    for (const review of prepared) {
      const key = reviewKey(review);
      if (seen.has(key)) continue;
      seen.add(key);
      const { _timestamp, _inputOrder, ...cleanReview } = review;
      unique.push(cleanReview);
      if (unique.length >= MAX_REVIEWS) break;
    }
    return unique;
  }

  function rollingReviews(items) {
    const cutoff = reviewPeriod().rollingStart;
    return (items || []).filter(review => reviewTimestamp(review) >= cutoff);
  }

  function detailLines(review) {
    const lines = [];
    if (review.manager) lines.push(`💕💕 담당자 : ${review.manager} 💕💕`);
    if (review.model) lines.push(`차량 모델명 : ${review.model}`);
    if (review.color) lines.push(`색상 : ${review.color}`);
    if (review.method) lines.push(`진행 방식 : ${review.method}`);
    return lines.slice(0, 4);
  }

  function imageMarkup(review) {
    const primary = String(review.image || '').trim();
    if (!primary) {
      return `<div class="review-card__image review-card__image--empty" data-review-image-slot="${escapeHtml(review.id)}"><span>후기 이미지 준비 중</span></div>`;
    }
    return `<div class="review-card__image" data-review-image-slot="${escapeHtml(review.id)}">
      <img src="${escapeHtml(primary)}" alt="${escapeHtml(cleanReviewTitle(review.title))}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
    </div>`;
  }

  function cardTemplate(review) {
    const lines = detailLines(review);
    const formattedDate = formatReviewDate(review.date);
    return `<article class="swiper-slide review-card" data-review-id="${escapeHtml(review.id)}">
      <a class="review-card__link" href="#review-detail" data-review-open="${escapeHtml(review.id)}">
        ${imageMarkup(review)}
        <div class="review-card__body">
          <strong class="review-card__title">${escapeHtml(cleanReviewTitle(review.title))}</strong>
          ${formattedDate ? `<time class="review-card__date" datetime="${escapeHtml(review.date)}">${escapeHtml(formattedDate)}</time>` : ''}
          ${lines.length ? `<div class="review-card__details">${lines.map(line => `<p>${escapeHtml(line)}</p>`).join('')}</div>` : ''}
          <span class="review-card__cta">후기 보기</span>
        </div>
      </a>
    </article>`;
  }

  function validReviewImages(review) {
    return [...new Set([...(Array.isArray(review.images) ? review.images : []), review.image].filter(url =>
      typeof url === 'string' && /^https?:\/\//i.test(url) && !/javascript:/i.test(url)
    ))].slice(0, 150);
  }

  function showReviewImage(index) {
    if (!activeReviewImages.length || !reviewDialog) return;
    activeReviewImageIndex = (index + activeReviewImages.length) % activeReviewImages.length;
    const image = reviewDialog.querySelector('[data-review-main-image]');
    image.src = activeReviewImages[activeReviewImageIndex];
    image.alt = `출고 후기 사진 ${activeReviewImageIndex + 1}`;
    reviewDialog.querySelector('[data-review-image-count]').textContent = `${activeReviewImageIndex + 1} / ${activeReviewImages.length}`;
    reviewDialog.querySelectorAll('[data-review-thumb]').forEach((el, i) => {
      el.classList.toggle('is-selected', i === activeReviewImageIndex);
      el.setAttribute('aria-pressed', String(i === activeReviewImageIndex));
    });
  }

  // 팝업을 열기 전 위치를 기억하고 닫힐 때 동일한 위치로 복원한다.
  // popstate에서 메인 견적 단계의 스크롤 이동 코드가 실행되지 않도록
  // 후기 전용 히스토리 이벤트는 캡처 단계에서 먼저 처리한다.
  function restoreReviewScroll() {
    if (!reviewReturnScroll) return;
    const { x, y } = reviewReturnScroll;
    window.scrollTo(x, y);
    requestAnimationFrame(() => window.scrollTo(x, y));
  }

  function ensureReviewDialog() {
    if (reviewDialog) return reviewDialog;
    reviewDialog = document.createElement('dialog');
    reviewDialog.className = 'autogenie-review-dialog';
    reviewDialog.setAttribute('aria-label', '오토지니 출고 후기 상세');
    document.body.appendChild(reviewDialog);
    reviewDialog.addEventListener('click', event => {
      if (event.target === reviewDialog || event.target.closest('[data-review-close]')) {
        closeReviewDialog();
        return;
      }
      if (event.target.closest('[data-review-back-list]')) {
        showAllReviews(true);
        return;
      }
      const link = event.target.closest('[data-review-open]');
      if (link) {
        event.preventDefault();
        const review = allReviews.find(item => reviewKey(item) === link.dataset.reviewOpen);
        if (review) {
          reviewListScrollTop = reviewDialog.querySelector('.review-all-scroll')?.scrollTop || 0;
          reviewDetailFromList = true;
          openReview(review);
        }
        return;
      }
      const direction = event.target.closest('[data-review-image-shift]');
      if (direction) showReviewImage(activeReviewImageIndex + Number(direction.dataset.reviewImageShift));
      const thumb = event.target.closest('[data-review-thumb]');
      if (thumb) showReviewImage(Number(thumb.dataset.reviewThumb));
    });
    reviewDialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeReviewDialog();
    });
    reviewDialog.addEventListener('close', () => {
      document.body.classList.remove('review-dialog-open');
      if (reviewDialogReturnFocus?.isConnected) reviewDialogReturnFocus.focus({ preventScroll: true });
      restoreReviewScroll();
      // X/ESC/바깥 클릭: 후기 전용 히스토리만 되돌린다.
      // reviewHistoryActive는 popstate에서 해제해야 견적 단계 변경을 막을 수 있다.
      if (reviewHistoryActive && !reviewClosingFromPopstate) history.back();
      reviewClosingFromPopstate = false;
    });
    return reviewDialog;
  }

  function showReviewDialog(dialog) {
    if (!dialog.open) {
      reviewReturnScroll = { x: window.scrollX, y: window.scrollY };
      reviewDialogReturnFocus = document.activeElement;
      history.pushState({ ...((history.state && typeof history.state === 'object') ? history.state : {}), autogenieReviewDialog: true }, '', location.href);
      reviewHistoryActive = true;
      dialog.showModal();
    }
    document.body.classList.add('review-dialog-open');
    // 열릴 때 자동 포커스가 닫기 버튼에 걸려 검은 원형 테두리가 생기지 않도록
    // 후기 제목으로 포커스를 이동합니다. 탭 키로 닫기 버튼에 접근할 수 있습니다.
    const heading = dialog.querySelector('.review-detail-head h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  function allReviewCard(review) {
    const title = escapeHtml(cleanReviewTitle(review.title));
    const date = escapeHtml(formatReviewDate(review.date));
    const photo = String(review.image || '').trim();
    return `<a class="review-all-card" href="#review-detail" data-review-open="${escapeHtml(reviewKey(review))}">
      <span class="review-all-card__photo">${photo ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="review-all-card__empty">후기 이미지 준비 중</span>'}</span>
      <span class="review-all-card__info"><strong>${title}</strong><time>${date}</time></span>
    </a>`;
  }

  // 전체 후기 목록의 스크롤 영역에만 적용: 상세 페이지/메인 화면 스크롤은 변경하지 않음.
  function setupReviewScrollTop(dialog, scrollSelector) {
    const scrollArea = dialog.querySelector(scrollSelector);
    const topButton = dialog.querySelector('[data-review-scroll-top]');
    if (!scrollArea || !topButton) return;

    const updateVisibility = () => {
      topButton.hidden = scrollArea.scrollTop < 280 ||
        scrollArea.scrollHeight <= scrollArea.clientHeight + 1;
    };
    scrollArea.addEventListener('scroll', updateVisibility, { passive: true });

    // 모바일 브라우저마다 scrollTo({ behavior: 'smooth' })의 속도/동작이 달라
    // 후기 목록 내부의 scrollTop을 프레임별로 직접 보간한다.
    let scrollAnimationId = null;
    const stopScrollAnimation = () => {
      if (scrollAnimationId !== null) {
        cancelAnimationFrame(scrollAnimationId);
        scrollAnimationId = null;
      }
    };
    // 스크롤 중 사용자가 직접 조작하면 애니메이션을 중단한다.
    scrollArea.addEventListener('touchstart', stopScrollAnimation, { passive: true });
    scrollArea.addEventListener('wheel', stopScrollAnimation, { passive: true });
    scrollArea.addEventListener('pointerdown', stopScrollAnimation, { passive: true });

    topButton.addEventListener('click', () => {
      stopScrollAnimation();
      const startTop = scrollArea.scrollTop;
      if (startTop <= 0) return;

      const duration = Math.min(1200, Math.max(800, startTop * 0.075));
      let startTime = null;
      const animateToTop = timestamp => {
        if (!scrollArea.isConnected) {
          scrollAnimationId = null;
          return;
        }
        if (startTime === null) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        // easeInOutCubic: 천천히 출발해 가속하고 도착할 때 감속한다.
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        scrollArea.scrollTop = startTop * (1 - eased);
        if (progress < 1) scrollAnimationId = requestAnimationFrame(animateToTop);
        else {
          scrollArea.scrollTop = 0;
          scrollAnimationId = null;
        }
      };
      scrollAnimationId = requestAnimationFrame(animateToTop);
    });
    updateVisibility();
  }

  function showAllReviews(restoreScroll = false) {
    const dialog = ensureReviewDialog();
    const { year, firstYear } = reviewPeriod();
    const periodTitle = firstYear < year ? `${firstYear}~${year}년 출고 후기` : `${year}년 출고 후기`;
    if (!restoreScroll) {
      reviewListScrollTop = 0;
      reviewDetailFromList = false;
    }
    reviewDialogView = 'list';
    dialog.setAttribute('aria-label', '오토지니 전체 출고 후기 목록');
    dialog.innerHTML = `<div class="review-detail-panel review-all-panel">
      <header class="review-detail-head"><div><span class="review-detail-eyebrow">REAL DELIVERY REVIEW</span>
      <h2>오토지니 실제 출고 후기</h2><p class="review-all-count">${escapeHtml(periodTitle)} · 원하는 후기를 선택해 주세요.</p></div>
      <button type="button" class="review-detail-close" data-review-close aria-label="전체 후기 닫기">×</button></header>
      <div class="review-detail-scroll review-all-scroll">
        ${allReviews.length ? `<div class="review-all-grid">${allReviews.map(allReviewCard).join('')}</div>` : '<p class="review-all-empty">해당 기간에 등록된 출고 후기가 없습니다.</p>'}
      </div>
      <button type="button" class="review-scroll-top" data-review-scroll-top aria-label="후기 목록 맨 위로 이동" title="맨 위로" hidden><span aria-hidden="true">↑</span></button>
    </div>`;
    showReviewDialog(dialog);
    dialog.querySelector('.review-all-scroll').scrollTop = restoreScroll ? reviewListScrollTop : 0;
    setupReviewScrollTop(dialog, '.review-all-scroll');
    dialog.querySelectorAll('.review-all-card__photo img').forEach(img => {
      img.addEventListener('error', () => {
        const slot = img.closest('.review-all-card__photo');
        if (slot) slot.innerHTML = '<span class="review-all-card__empty">후기 이미지 준비 중</span>';
      }, { once: true });
    });
  }

  function closeReviewDialog() {
    if (reviewDialog?.open) reviewDialog.close();
  }

  window.addEventListener('popstate', event => {
    if (!reviewHistoryActive) return;
    // 견적 스크립트의 popstate가 render() / scrollToEstimate()를 호출하지 않게 차단.
    event.stopImmediatePropagation();
    reviewHistoryActive = false;
    reviewClosingFromPopstate = true;
    if (reviewDialog?.open) reviewDialog.close();
    else {
      reviewClosingFromPopstate = false;
      restoreReviewScroll();
    }
  }, true);

  // GitHub Actions가 저장한 원본 후기 HTML을 브라우저에서도 한 번 더 제한적으로 정제한다.
  // 텍스트 서식과 빈 줄은 살리되 실행 가능한 태그/속성은 허용하지 않는다.
  function safeOriginalReviewHtml(html) {
    if (typeof html !== 'string' || !html.trim()) return '';
    const template = document.createElement('template');
    template.innerHTML = html;
    const keepTags = new Set(['DIV','SECTION','ARTICLE','P','BR','SPAN','FONT','STRONG','B','EM','I','U','S','SUB','SUP',
      'H1','H2','H3','H4','H5','H6','BLOCKQUOTE','UL','OL','LI','FIGURE','IMG','HR','TABLE','TBODY','THEAD','TR','TD','TH']);
    const denyTags = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','OBJECT','EMBED','SVG','BUTTON','FORM','INPUT','TEXTAREA',
      'SELECT','VIDEO','AUDIO','CANVAS','HEADER','FOOTER','NAV','ASIDE']);
    const keepCss = new Set(['font-size','font-family','font-weight','font-style','line-height','letter-spacing',
      'text-align','text-decoration','color','white-space','margin-top','margin-bottom',
      'padding-top','padding-bottom','padding-left','padding-right','width','display']);
    const cleanNode = node => {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
      if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
      const tag = node.tagName;
      if (denyTags.has(tag)) return document.createDocumentFragment();
      const out = keepTags.has(tag) ? document.createElement(tag.toLowerCase()) : document.createElement('span');
      if (tag === 'IMG') {
        const url = node.getAttribute('src') || '';
        if (!/^https?:\/\//i.test(url) || /escrow|에스크로|kbes|favicon|avatar|placeholder|\/logo[\/_\.]/i.test(url)) {
          return document.createDocumentFragment();
        }
        out.setAttribute('src', url);
        out.setAttribute('alt', String(node.getAttribute('alt') || '').slice(0, 180));
        out.setAttribute('loading', 'lazy');
        out.setAttribute('decoding', 'async');
        out.setAttribute('referrerpolicy', 'no-referrer');
      }
      if (tag === 'DIV' && node.classList.contains('review-original-content')) out.className = 'review-original-content';
      const style = document.createElement('span').style;
      style.cssText = node.getAttribute('style') || '';
      const allowedStyle = [];
      for (const property of [...style]) {
        const value = style.getPropertyValue(property);
        if (!keepCss.has(property) || !value || /url\s*\(|expression\s*\(|javascript:|var\s*\(/i.test(value)) continue;
        if (value.length > 200) continue;
        allowedStyle.push(`${property}:${value}`);
      }
      if (allowedStyle.length) out.setAttribute('style', allowedStyle.join(';'));
      if (tag !== 'IMG') for (const child of node.childNodes) out.appendChild(cleanNode(child));
      return out;
    };
    const host = document.createElement('div');
    for (const child of [...template.content.childNodes]) host.appendChild(cleanNode(child));
    return host.innerHTML;
  }

  // 원본 후기 첫 사진 위에 남아 있는 빈 줄/빈 래퍼와 상단 마진만 제거한다.
  // 후기에 포함된 다른 문단과 사진 사이 간격은 건드리지 않는다.
  function normalizeReviewArticleStart(html) {
    if (!html || !html.trim()) return html;
    const host = document.createElement('div');
    host.innerHTML = html;
    const isBlank = node => {
      if (node.nodeType === Node.TEXT_NODE) return !(node.textContent || '').replace(/[\u00a0\u200b\ufeff]/g, ' ').trim();
      if (node.nodeType !== Node.ELEMENT_NODE) return true;
      if (node.matches('img, hr, iframe, video, svg') || node.querySelector('img, hr, iframe, video, svg')) return false;
      return !(node.textContent || '').replace(/[\u00a0\u200b\ufeff]/g, ' ').trim();
    };
    const trimBeginning = (parent, depth = 0) => {
      if (depth > 15) return;
      while (parent.firstChild && isBlank(parent.firstChild)) parent.firstChild.remove();
      const first = parent.firstChild;
      if (first?.nodeType === Node.ELEMENT_NODE && /^(DIV|SECTION|ARTICLE|P|SPAN|FIGURE|TABLE|TBODY|TR|TD)$/i.test(first.tagName)) {
        trimBeginning(first, depth + 1);
      }
    };
    trimBeginning(host);
    // 가장 먼저 보이는 콘텐츠가 이미지일 때만 해당 이미지와 그 위쪽 래퍼의 마진을 해제.
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node, leadingImage = null;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE && (node.textContent || '').replace(/[\u00a0\u200b\ufeff]/g, ' ').trim()) break;
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') { leadingImage = node; break; }
    }
    if (leadingImage) {
      for (let el = leadingImage; el && el !== host; el = el.parentElement) {
        el.classList.add('review-leading-media');
      }
    }
    return host.innerHTML;
  }

  function openReview(review) {
    const dialog = ensureReviewDialog();
    reviewDialogView = 'detail';
    dialog.setAttribute('aria-label', '오토지니 출고 후기 상세');
    const details = detailLines(review);
    const blocks = Array.isArray(review.contentBlocks) ? review.contentBlocks : [];
    const validBlocks = blocks.filter(block => block && (block.type === 'text' && typeof block.text === 'string' || block.type === 'image' && typeof block.url === 'string' && /^https?:\/\//i.test(block.url)));
    // 이전 수집 데이터나 혼합형 게시물은 images에만 있는 추가 사진도 빠짐없이 표시.
    const blockImageUrls = new Set(validBlocks.filter(block => block.type === 'image').map(block => block.url));
    const extraImages = validReviewImages(review).filter(url => !blockImageUrls.has(url));
    const body = String(review.body || '').trim();
    const images = validReviewImages(review);
    let articleHtml = safeOriginalReviewHtml(review.articleHtml);
    if (!articleHtml) {
      // 자동 갱신 전 JSON의 구형 블록은 임시로 보여주되, 인증 배지는 표시하지 않는다.
      const seen = new Set();
      const isUnwanted = url => /escrow|에스크로|kbes|favicon|avatar|placeholder|\/logo[\/_\.]/i.test(url || '');
      const identity = url => {
        try { const u = new URL(url); return `${u.hostname}/${u.pathname.split('/').filter(Boolean).slice(-2).join('/')}`.toLowerCase(); }
        catch { return String(url || '').toLowerCase(); }
      };
      const addPhoto = url => {
        if (!url || !/^https?:\/\//i.test(url) || isUnwanted(url) || seen.has(identity(url))) return '';
        seen.add(identity(url));
        return `<figure class="review-blog-photo"><img src="${escapeHtml(url)}" alt="출고 후기 사진" loading="lazy" referrerpolicy="no-referrer"></figure>`;
      };
      if (validBlocks.length) {
        articleHtml = validBlocks.map(block => block.type === 'image' ? addPhoto(block.url) :
          `<p>${escapeHtml(block.text).replace(/\n/g, '<br>')}</p>`).join('');
        // 사진이 하나라도 있으면 목록 썸네일을 마지막에 다시 붙이지 않는다.
        if (!seen.size) articleHtml = addPhoto(review.image) + articleHtml;
      } else {
        const paragraphs = body ? body.split(/\n{2,}/).map(line => line.trim()).filter(Boolean) : [];
        const mainText = paragraphs.length ? paragraphs.map(line => `<p>${escapeHtml(line).replace(/\n/g, '<br>')}</p>`).join('') :
          `<p>출고 차량과 상담 내용을 소개합니다.</p>${details.map(line => `<p>${escapeHtml(line)}</p>`).join('')}`;
        articleHtml = addPhoto(images[0]) + mainText + images.slice(1).map(addPhoto).join('');
      }
    }

    articleHtml = normalizeReviewArticleStart(articleHtml);

    dialog.innerHTML = `<div class="review-detail-panel review-detail-panel--blog">
      <header class="review-detail-head"><div>${reviewDetailFromList ? '<button type="button" class="review-back-list" data-review-back-list>← 후기 목록</button>' : ''}<span class="review-detail-eyebrow">REAL DELIVERY REVIEW</span>
      <h2>${escapeHtml(cleanReviewTitle(review.title))}</h2><time>${escapeHtml(formatReviewDate(review.date))}</time></div>
      <button type="button" class="review-detail-close" data-review-close aria-label="후기 닫기">×</button></header>
      <div class="review-detail-scroll review-blog-scroll"><article class="review-blog-article">${articleHtml}</article></div>
    </div>`;
    showReviewDialog(dialog);
    dialog.querySelector('.review-detail-scroll')?.scrollTo(0, 0);
  }

  track.addEventListener('click', event => {
    const link = event.target.closest('[data-review-open]');
    if (!link || carousel.classList.contains('is-dragging')) return;
    event.preventDefault();
    const review = allReviews.find(item => String(item.id) === link.dataset.reviewOpen);
    if (review) {
      reviewDetailFromList = false;
      openReview(review);
    }
  });
  document.querySelector('.review-section__more')?.addEventListener('click', event => {
    event.preventDefault();
    showAllReviews();
  });

  function destroyReviewSwiper() {
    if (!reviewSwiper) return;
    try { reviewSwiper.destroy(true, true); } catch {}
    reviewSwiper = null;
  }

  function initReviewSwiper() {
    destroyReviewSwiper();
    if (!renderedReviews.length || hiddenAfterBrandSelection) return;

    // Swiper가 외부 스크립트 로딩 문제로 없을 경우 카드 목록은 그대로 보이게 둔다.
    if (typeof window.Swiper !== 'function') {
      console.warn('Swiper를 불러오지 못해 후기 카드를 정적으로 표시합니다.');
      return;
    }

    const canMove = renderedReviews.length > 1;
    reviewSwiper = new window.Swiper(carousel, {
      slidesPerView: 'auto',
      spaceBetween: 14,
      slidesOffsetBefore: 26,
      slidesOffsetAfter: 26,
      loop: canMove,
      rewind: false,
      loopAdditionalSlides: 6,
      loopPreventsSliding: false,
      speed: SWIPER_SPEED,
      grabCursor: canMove,
      allowTouchMove: canMove,
      simulateTouch: true,
      followFinger: true,
      threshold: 3,
      touchRatio: 1,
      resistance: true,
      resistanceRatio: 0.72,
      shortSwipes: true,
      longSwipes: true,
      longSwipesRatio: 0.28,
      longSwipesMs: 220,
      watchSlidesProgress: true,
      observer: true,
      observeParents: true,
      autoplay: canMove ? {
        delay: SWIPER_DELAY,
        disableOnInteraction: false,
        pauseOnMouseEnter: false,
        waitForTransition: true,
        stopOnLastSlide: false
      } : false,
      breakpoints: {
        0: {
          spaceBetween: 10,
          slidesOffsetBefore: 14,
          slidesOffsetAfter: 14
        },
        561: {
          spaceBetween: 12,
          slidesOffsetBefore: 18,
          slidesOffsetAfter: 18
        },
        821: {
          spaceBetween: 14,
          slidesOffsetBefore: 26,
          slidesOffsetAfter: 26
        }
      },
      on: {
        init(swiper) {
          swiper.wrapperEl.style.setProperty('--review-swiper-speed', `${SWIPER_SPEED}ms`);
        }
      }
    });
  }

  function restoreReviewSection() {
    hiddenAfterBrandSelection = false;

    // 후기가 아직 로드되기 전이라면 loadReviews()가 이후 정상적으로 표시합니다.
    if (!renderedReviews.length) {
      section.hidden = false;
      return;
    }

    section.hidden = false;

    // 브랜드 선택 시 파괴했던 Swiper를 초기 화면으로 돌아올 때 다시 생성합니다.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        initReviewSwiper();
        reviewSwiper?.slideToLoop?.(0, 0, false);
        reviewSwiper?.autoplay?.start?.();
      });
    });
  }

  function renderReviewList(items) {
    allReviews = prepareReviews(items);
    const reviews = rollingReviews(allReviews);
    renderedReviews = reviews;


    if (hiddenAfterBrandSelection) {
      section.hidden = true;
      destroyReviewSwiper();
      return;
    }

    section.hidden = false;
    track.innerHTML = reviews.length ? reviews.map(cardTemplate).join('') : `<article class="review-card review-card--loading"><div class="review-card__body"><strong>최근 3개월 동안 등록된 출고 후기가 없습니다.</strong><p>전체 후기 보기에서 이전 출고 사례를 확인해 보세요.</p></div></article>`;
    bindImageFallbacks();

    // DOM 크기가 계산된 다음 Swiper를 초기화해야 slidesPerView:auto가 정확하게 작동한다.
    requestAnimationFrame(() => requestAnimationFrame(initReviewSwiper));
  }

  function bindImageFallbacks() {
    track.querySelectorAll('.review-card__image img').forEach(img => {
      img.addEventListener('load', () => {
        img.closest('.review-card__image')?.classList.add('is-loaded');
      }, { once: true });

      img.addEventListener('error', () => {
        const slot = img.closest('.review-card__image');
        if (!slot) return;
        slot.classList.add('review-card__image--empty');
        slot.innerHTML = '<span>후기 이미지 준비 중</span>';
      }, { once: true });
    });
  }

  function extractIds(text = '') {
    const ids = new Set();
    const decoded = String(text).replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
    for (const m of decoded.matchAll(/[?&]idx=(\d+)/g)) ids.add(m[1]);
    for (const m of decoded.matchAll(/idx%3D(\d+)/gi)) ids.add(m[1]);
    return [...ids];
  }

  function extractLabel(text, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = String(text).match(new RegExp(`${escaped}\\s*[:：]\\s*([^\\n]{1,180})`, 'i'));
    return match ? match[1].replace(/[*_#]/g, '').trim() : '';
  }

  function findTitle(text = '') {
    const lines = String(text).split(/\n+/).map(line => line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim());
    return lines.find(line => /출고\s*후기입니다\.?$/i.test(line)) || '';
  }

  function readerUrl(url) {
    return `${READER_PREFIX}${url}`;
  }

  // 실제 아임웹 목록 페이지는 page=N이 별도 쿼리로 붙는다.
  function baseBoardQuery() {
    return btoa(unescape(encodeURIComponent('a:1:{s:12:"keyword_type";s:3:"all";}')));
  }

  function sourceListUrl(pageNumber = 1) {
    const page = Math.max(1, Number(pageNumber) || 1);
    return `${SOURCE}/?page=${page}&q=${encodeURIComponent(baseBoardQuery())}&t=board`;
  }

  async function fetchText(url, timeoutMs = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'text/plain,text/markdown,*/*' } });
      if (!response.ok) return '';
      return await response.text();
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  function parseSourceReview(id, text) {
    const title = findTitle(text);
    const dateMatch = String(text).match(/20\d{2}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{1,2}/) || String(text).match(/20\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/);
    const date = dateMatch ? formatReviewDate(dateMatch[0]).replace(/\./g, '-') : '';
    const model = extractLabel(text, '차량 모델명') || title.replace(/\s*출고\s*후기입니다\.?$/i, '').trim();
    const brand = detectBrand(`${title}\n${model}\n${text}`);
    if (!title || !date) return null;
    return {
      id: String(id), title, brand, model,
      manager: extractLabel(text, '담당자'), color: extractLabel(text, '색상'), method: extractLabel(text, '진행 방식'),
      date, image: '', url: `${SOURCE}/?bmode=view&idx=${id}`
    };
  }

  function readSourceCache() {
    try {
      const raw = sessionStorage.getItem(SOURCE_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > SOURCE_CACHE_TTL) return [];
      return Array.isArray(parsed.reviews) ? parsed.reviews : [];
    } catch {
      return [];
    }
  }

  function writeSourceCache(reviews) {
    try {
      sessionStorage.setItem(SOURCE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), reviews }));
    } catch { /* storage 사용 불가 환경은 무시 */ }
  }

  async function discoverSourceReviews(seedItems = []) {
    const cached = prepareReviews(readSourceCache());
    if (cached.length >= MIN_LOCAL_REVIEWS) return cached;

    const ids = new Set();
    for (const review of seedItems) {
      const id = String(review?.id || review?.url?.match(/[?&]idx=(\d+)/)?.[1] || '');
      if (id) ids.add(id);
    }

    // 최신 1페이지부터 실제 아임웹 q 페이지네이션을 순서대로 읽는다.
    // 오래된 &page=N 주소를 사용하면 같은 과거 구간만 반복해서 읽는 문제가 생긴다.
    const listTasks = [];
    for (let page = 1; page <= SOURCE_LIST_PAGES; page += 1) {
      const fresh = `${sourceListUrl(page)}&review_sync=${Date.now()}_${page}`;
      listTasks.push(fetchText(readerUrl(fresh), 12000));
    }
    // 1페이지 스킨/리다이렉트 대응용 루트 주소도 한 번 확인한다.
    listTasks.push(fetchText(readerUrl(`${SOURCE}/?review_sync=${Date.now()}`), 12000));

    const listTexts = await Promise.all(listTasks);
    listTexts.forEach(text => extractIds(text).forEach(id => ids.add(id)));

    // ID가 적게 잡힌 경우, 이미 알고 있는 상세글에서 이전/다음 게시글 링크를 연쇄적으로 확장한다.
    const queue = [...ids].sort((a, b) => Number(b) - Number(a));
    const visited = new Set();
    const collected = new Map();
    let cursor = 0;

    while (cursor < queue.length && visited.size < SOURCE_MAX_DETAIL_FETCHES && collected.size < MAX_REVIEWS) {
      const batch = [];
      while (cursor < queue.length && batch.length < 5 && visited.size + batch.length < SOURCE_MAX_DETAIL_FETCHES) {
        const id = queue[cursor++];
        if (!id || visited.has(id)) continue;
        visited.add(id);
        batch.push(id);
      }
      if (!batch.length) continue;

      const pages = await Promise.all(batch.map(id => fetchText(readerUrl(`${SOURCE}/?bmode=view&idx=${id}&t=board`), 10000)));
      pages.forEach((text, index) => {
        const id = batch[index];
        if (!text) return;
        extractIds(text).forEach(linkedId => {
          if (!visited.has(linkedId) && !ids.has(linkedId)) {
            ids.add(linkedId);
            queue.push(linkedId);
          }
        });
        const parsed = parseSourceReview(id, text);
        if (parsed) collected.set(reviewKey(parsed), parsed);
      });
    }

    const merged = prepareReviews([...seedItems, ...collected.values()]);
    if (merged.length) writeSourceCache(merged);
    return merged;
  }

  async function refreshFromSource(localItems, renderLocalIfUnchanged = false) {
    if (sourceRefreshStarted) return;
    sourceRefreshStarted = true;
    try {
      const sourceReviews = await discoverSourceReviews(localItems);
      const merged = prepareReviews([...(localItems || []), ...sourceReviews]);
      const before = prepareReviews(localItems || []);
      const beforeSignature = before.slice(0, 8).map(item => `${item.id}:${item.date}`).join('|');
      const afterSignature = merged.slice(0, 8).map(item => `${item.id}:${item.date}`).join('|');

      // 개수가 같더라도 더 최신 글이 발견되면 반드시 다시 그린다.
      if (merged.length !== before.length || beforeSignature !== afterSignature) {
        renderReviewList(merged);
      } else if (renderLocalIfUnchanged && before.length) {
        renderReviewList(before);
      }
    } catch (error) {
      console.warn('오토지니 후기 원본 보충을 건너뜁니다.', error);
      if (renderLocalIfUnchanged) {
        const fallback = prepareReviews(localItems || []);
        if (fallback.length) renderReviewList(fallback);
      }
    }
  }

  async function loadReviews() {
    let localItems = [];
    try {
      const response = await fetch(`data/reviews.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      localItems = Array.isArray(payload) ? payload : payload.reviews || [];
    } catch (error) {
      console.warn('reviews.json을 불러오지 못했습니다.', error);
    }

    // GitHub Actions가 갱신한 reviews.json을 최우선으로 표시한다.
    // 다만 첫 배포/네트워크 오류/Actions 실행 전처럼 JSON을 읽지 못한 경우에도
    // 후기 영역 자체가 사라지지 않도록 기존 확보 후기(FALLBACK)를 즉시 표시한다.
    const localReviews = prepareReviews(localItems);
    const reviews = localReviews.length ? localReviews : prepareReviews(FALLBACK_REVIEWS);

    if (reviews.length) {
      renderReviewList(reviews);
    } else {
      section.hidden = false;
      allReviews = [];
      destroyReviewSwiper();
      track.innerHTML = `<article class="review-card review-card--loading">
        <div class="review-card__body">
          <strong>출고 후기를 준비하고 있습니다.</strong>
          <p>다음 자동 갱신에서 최신 후기가 표시됩니다.</p>
        </div>
      </article>`;
    }
  }

  document.addEventListener('click', event => {
    const marketButton = event.target.closest?.('.segment-control[data-group="market"] button[data-value]');
    const searchVehicle = event.target.closest?.('[data-global-car]');
    if (!marketButton && !searchVehicle) return;
    hiddenAfterBrandSelection = true;
    section.hidden = true;
    if (reviewSwiper?.autoplay) reviewSwiper.autoplay.stop();
    destroyReviewSwiper();
  }, true);

  // 로고 클릭/처음부터 다시하기 등 견적이 초기 상태로 돌아가면 후기도 다시 노출한다.
  document.addEventListener('autogenie:wizard-reset', restoreReviewSection);

  // 탭이 다시 활성화됐을 때 자동재생이 자연스럽게 이어지도록 한다.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || hiddenAfterBrandSelection || !reviewSwiper?.autoplay) return;
    reviewSwiper.autoplay.start();
  });

  loadReviews();
})();
