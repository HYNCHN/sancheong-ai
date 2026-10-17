/**
 * 산청아이(AI) 중계 서버
 *
 * 학생 휴대폰의 앱은 이 서버에만 요청하고,
 * 이 서버가 나이스·기상청·에어코리아·관리 시트를 대신 불러와 잠시 저장해 둡니다.
 * 인증키는 코드에 없고, Cloudflare 설정(비밀 값)에만 들어 있습니다.
 *
 * 필요한 비밀 값 (Cloudflare → Worker → 설정 → 변수 및 비밀)
 *   NEIS_KEY   : 나이스 교육정보 개방포털 인증키
 *   DATA_KEY   : 공공데이터포털 일반 인증키 (Decoding 키 권장, Encoding 키도 동작)
 *   SHEET_URL  : 관리 시트 읽기용 Apps Script 웹 앱 주소
 */

const NEIS = 'https://open.neis.go.kr/hub/';
const OFFICE = 'S10'; // 경상남도교육청

// 산청군 1읍 10면 (읍·면사무소 부근 대략 좌표 → 기상청 격자로 변환)
export const TOWNS = {
  산청읍: [35.4155, 127.8735],
  차황면: [35.4850, 127.9150],
  오부면: [35.4400, 127.9350],
  생초면: [35.4970, 127.8280],
  금서면: [35.4300, 127.8320],
  삼장면: [35.3200, 127.8100],
  시천면: [35.2760, 127.7870],
  단성면: [35.3350, 127.9350],
  신안면: [35.3580, 127.9400],
  생비량면: [35.3730, 128.0300],
  신등면: [35.4000, 127.9900],
};

/* ---------------- 공통 도구 ---------------- */

const memo = new Map();

/** 같은 요청은 ttl초 동안 저장해 두었다가 다시 씁니다. 실패하면 예전 값을 씁니다. */
async function cached(key, ttlSec, fn) {
  const hit = memo.get(key);
  const now = Date.now();
  if (hit && hit.exp > now) return hit.val;
  try {
    const val = await fn();
    memo.set(key, { val, exp: now + ttlSec * 1000 });
    if (memo.size > 500) memo.delete(memo.keys().next().value);
    return val;
  } catch (e) {
    if (hit) return hit.val;
    throw e;
  }
}

/** 한국 시각 기준 날짜 정보 */
export function kstNow(ms = Date.now()) {
  const d = new Date(ms + 9 * 3600 * 1000);
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
    h: d.getUTCHours(), min: d.getUTCMinutes(), dow: d.getUTCDay(),
    ymd: ymd(d),
  };
}

export function ymd(d) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' 또는 'YYYYMMDD' → UTC 자정 Date */
export function parseDate(s) {
  const t = String(s || '').replace(/[^0-9]/g, '');
  if (t.length !== 8) return null;
  const d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8)));
  return isNaN(d) ? null : d;
}

const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

function json(data, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? `public, max-age=${maxAge}` : 'no-store',
    },
  });
}

/* ---------------- 나이스 ---------------- */

async function neis(env, service, params) {
  if (!env.NEIS_KEY) throw new Error('NEIS_KEY 없음');
  const q = new URLSearchParams({ KEY: env.NEIS_KEY, Type: 'json', pIndex: '1', pSize: '1000', ...params });
  const res = await fetch(`${NEIS}${service}?${q}`);
  const data = await res.json();
  if (data.RESULT) {
    if (data.RESULT.CODE === 'INFO-200') return []; // 데이터 없음
    throw new Error(`나이스 오류 ${data.RESULT.CODE}`);
  }
  const block = data[service];
  const head = block?.[0]?.head?.[1]?.RESULT;
  if (head && head.CODE !== 'INFO-000') throw new Error(`나이스 오류 ${head.CODE}`);
  return block?.[1]?.row || [];
}

export function townOf(address) {
  const m = String(address || '').match(/산청군\s*([가-힣]+[읍면])/);
  return m ? m[1] : '';
}

async function getSchools(env) {
  return cached('schools', 86400, async () => {
    const rows = await neis(env, 'schoolInfo', {
      ATPT_OFCDC_SC_CODE: OFFICE,
      SCHUL_KND_SC_NM: '초등학교',
    });
    return rows
      .filter((r) => String(r.ORG_RDNMA || '').includes('산청군'))
      .map((r) => ({
        code: r.SD_SCHUL_CODE,
        name: r.SCHUL_NM,
        address: `${r.ORG_RDNMA || ''} ${r.ORG_RDNDA || ''}`.trim(),
        tel: r.ORG_TELNO || '',
        homepage: r.HMPG_ADRES || '',
        town: townOf(r.ORG_RDNMA),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  });
}

/** 학년도: 3월에 시작 */
export function schoolYear(k = kstNow()) {
  return k.m >= 3 ? k.y : k.y - 1;
}

async function getClasses(env, school, grade) {
  return cached(`classes:${school}:${grade}`, 86400, async () => {
    const rows = await neis(env, 'classInfo', {
      ATPT_OFCDC_SC_CODE: OFFICE, SD_SCHUL_CODE: school,
      AY: String(schoolYear()), GRADE: String(grade),
    });
    const names = [...new Set(rows.map((r) => String(r.CLASS_NM)))];
    return names.sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  });
}

/** '쌀밥(5.6)' 같은 급식 메뉴 → 이름과 알레르기 번호 */
export function parseDish(raw) {
  let s = String(raw).replace(/<[^>]*>/g, '').trim();
  const allergies = [];
  s = s.replace(/\(([\d.\s]+)\)/g, (_, nums) => {
    nums.split('.').map((n) => parseInt(n)).filter((n) => n >= 1 && n <= 19).forEach((n) => allergies.push(n));
    return '';
  });
  // 끝에 붙은 '5.6.' 같은 번호 형식도 처리
  s = s.replace(/\s([\d]+\.)+\d*\s*$/g, (m) => {
    m.split('.').map((n) => parseInt(n)).filter((n) => n >= 1 && n <= 19).forEach((n) => allergies.push(n));
    return '';
  });
  s = s.replace(/[*#]+/g, '').replace(/\s+/g, ' ').trim();
  return { name: s, allergies: [...new Set(allergies)].sort((a, b) => a - b) };
}

async function getMeals(env, school, from, to) {
  return cached(`meals:${school}:${from}:${to}`, 10800, async () => {
    const rows = await neis(env, 'mealServiceDietInfo', {
      ATPT_OFCDC_SC_CODE: OFFICE, SD_SCHUL_CODE: school,
      MLSV_FROM_YMD: from, MLSV_TO_YMD: to,
    });
    return rows.map((r) => ({
      date: r.MLSV_YMD,
      type: r.MMEAL_SC_NM,
      dishes: String(r.DDISH_NM || '').split(/<br\s*\/?>/i).map(parseDish).filter((d) => d.name),
      cal: r.CAL_INFO || '',
    })).sort((a, b) => a.date.localeCompare(b.date));
  });
}

async function getTimetable(env, school, grade, cls, from, to) {
  return cached(`tt:${school}:${grade}:${cls}:${from}:${to}`, 10800, async () => {
    const rows = await neis(env, 'elsTimetable', {
      ATPT_OFCDC_SC_CODE: OFFICE, SD_SCHUL_CODE: school,
      AY: String(schoolYear()), GRADE: String(grade), CLASS_NM: String(cls),
      TI_FROM_YMD: from, TI_TO_YMD: to,
    });
    const days = {};
    for (const r of rows) {
      const list = (days[r.ALL_TI_YMD] ||= []);
      const subject = String(r.ITRT_CNTNT || '').replace(/^-/, '').trim();
      const period = parseInt(r.PERIO) || list.length + 1;
      if (!list.some((x) => x.period === period)) list.push({ period, subject });
    }
    for (const k in days) days[k].sort((a, b) => a.period - b.period);
    return days;
  });
}

/* ---------------- 기상청 단기예보 ---------------- */

/** 위경도 → 기상청 격자 (기상청 제공 람베르트 정각원추도법 공식) */
export function toGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD, olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

function serviceKey(env) {
  if (!env.DATA_KEY) throw new Error('DATA_KEY 없음');
  const k = env.DATA_KEY.trim();
  return k.includes('%') ? k : encodeURIComponent(k); // Encoding 키는 그대로, Decoding 키는 인코딩
}

/** 오늘 최저·최고기온이 들어 있는 발표 시각 고르기: 02시 발표(02:15 이후) 또는 전날 23시 발표 */
export function baseTime(k = kstNow()) {
  if (k.h * 60 + k.min >= 2 * 60 + 15) return { date: k.ymd, time: '0200' };
  const y = addDays(parseDate(k.ymd), -1);
  return { date: ymd(y), time: '2300' };
}

export function summarizeForecast(items, today) {
  const byDate = {};
  for (const it of items) {
    const d = (byDate[it.fcstDate] ||= { hours: {}, min: null, max: null });
    const v = it.fcstValue;
    if (it.category === 'TMN') d.min = parseFloat(v);
    else if (it.category === 'TMX') d.max = parseFloat(v);
    else (d.hours[it.fcstTime] ||= {})[it.category] = v;
  }
  const out = {};
  for (const [date, d] of Object.entries(byDate)) {
    const hours = Object.entries(d.hours).sort(([a], [b]) => a.localeCompare(b)).map(([t, c]) => ({
      time: t,
      tmp: c.TMP != null ? parseFloat(c.TMP) : null,
      sky: c.SKY != null ? parseInt(c.SKY) : null, // 1 맑음, 3 구름많음, 4 흐림
      pty: c.PTY != null ? parseInt(c.PTY) : 0, // 0 없음, 1 비, 2 비/눈, 3 눈, 4 소나기
      pop: c.POP != null ? parseInt(c.POP) : 0,
      reh: c.REH != null ? parseInt(c.REH) : null,
      wsd: c.WSD != null ? parseFloat(c.WSD) : null,
    }));
    const temps = hours.map((h) => h.tmp).filter((t) => t != null);
    const day = hours.filter((h) => h.time >= '0700' && h.time <= '1800');
    const span = day.length ? day : hours;
    out[date] = {
      date,
      min: d.min ?? (temps.length ? Math.min(...temps) : null),
      max: d.max ?? (temps.length ? Math.max(...temps) : null),
      pop: span.length ? Math.max(...span.map((h) => h.pop)) : 0,
      rain: span.some((h) => [1, 2, 4].includes(h.pty)),
      snow: span.some((h) => [2, 3].includes(h.pty)),
      sky: span.length ? mode(span.map((h) => h.sky).filter((s) => s != null)) : null,
      hours,
    };
  }
  return out;
}

function mode(arr) {
  const c = {};
  let best = null;
  for (const x of arr) { c[x] = (c[x] || 0) + 1; if (best == null || c[x] > c[best]) best = x; }
  return best == null ? null : Number(best);
}

async function getWeather(env, town) {
  const ll = TOWNS[town] || TOWNS['산청읍'];
  const { nx, ny } = toGrid(ll[0], ll[1]);
  const base = baseTime();
  return cached(`wx:${nx}:${ny}:${base.date}${base.time}`, 3600, async () => {
    const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${serviceKey(env)}`
      + `&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${base.date}&base_time=${base.time}&nx=${nx}&ny=${ny}`;
    const text = await (await fetch(url)).text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('기상청 응답 오류 (인증키 확인 필요)'); }
    const code = data?.response?.header?.resultCode;
    if (code !== '00') throw new Error(`기상청 오류 ${code} ${data?.response?.header?.resultMsg || ''}`);
    const items = data.response.body.items.item || [];
    const k = kstNow();
    const days = summarizeForecast(items, k.ymd);
    const tomorrow = ymd(addDays(parseDate(k.ymd), 1));
    const nowKey = `${String(k.h).padStart(2, '0')}00`;
    const now = days[k.ymd]?.hours.find((h) => h.time === nowKey) || days[k.ymd]?.hours[0] || null;
    return { town: TOWNS[town] ? town : '산청읍', grid: { nx, ny }, base, now, today: days[k.ymd] || null, tomorrow: days[tomorrow] || null };
  });
}

/* ---------------- 에어코리아 미세먼지 ---------------- */

export function dustGrade(kind, v) {
  if (v == null || isNaN(v)) return 0;
  const cut = kind === 'pm10' ? [30, 80, 150] : [15, 35, 75];
  return v <= cut[0] ? 1 : v <= cut[1] ? 2 : v <= cut[2] ? 3 : 4; // 1좋음 2보통 3나쁨 4매우나쁨
}

async function getAir(env, station) {
  return cached(`air:${station}`, 1800, async () => {
    const url = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${serviceKey(env)}`
      + `&returnType=json&numOfRows=5&pageNo=1&stationName=${encodeURIComponent(station)}&dataTerm=DAILY&ver=1.0`;
    const text = await (await fetch(url)).text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('에어코리아 응답 오류 (인증키 확인 필요)'); }
    const code = data?.response?.header?.resultCode;
    if (code !== '00') throw new Error(`에어코리아 오류 ${code}`);
    const list = data.response.body.items || [];
    const row = list.find((r) => r.pm10Value !== '-' || r.pm25Value !== '-') || list[0];
    if (!row) return null;
    const pm10 = parseInt(row.pm10Value), pm25 = parseInt(row.pm25Value);
    return {
      station, time: row.dataTime,
      pm10: isNaN(pm10) ? null : pm10, pm25: isNaN(pm25) ? null : pm25,
      pm10Grade: parseInt(row.pm10Grade) || dustGrade('pm10', pm10),
      pm25Grade: parseInt(row.pm25Grade) || dustGrade('pm25', pm25),
    };
  });
}

/* ---------------- 관리 시트 ---------------- */

// 각 탭의 제목 줄을 찾는 기준 (첫 칸 이름)
const HEADERS = ['항목', '번호', '날짜', '최고기온 이상(℃)', '조건코드', '학교명', '순서'];

/** 탭(2차원 배열) → 제목 줄을 찾아 객체 목록으로 */
export function tableToRows(table) {
  if (!Array.isArray(table)) return [];
  const hi = table.findIndex((r) => HEADERS.includes(String(r?.[0] ?? '').trim()));
  if (hi < 0) return [];
  const head = table[hi].map((h) => String(h).trim());
  return table.slice(hi + 1)
    .filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? '').trim()])));
}

async function getSheet(env) {
  if (!env.SHEET_URL) throw new Error('SHEET_URL 없음');
  return cached('sheet', 1800, async () => {
    const res = await fetch(env.SHEET_URL, { redirect: 'follow' });
    const data = await res.json();
    if (!data || !data.tabs) throw new Error('시트 응답 형식 오류');
    const rows = {};
    for (const [name, table] of Object.entries(data.tabs)) rows[name] = tableToRows(table);
    return rows;
  });
}

const useOk = (r) => (r['사용'] || 'Y').toUpperCase() !== 'N';
export const normDate = (s) => String(s || '').replace(/[^0-9]/g, '').slice(0, 8);

export function gradeBand(grade) {
  const g = parseInt(grade);
  return g <= 2 ? '저학년' : g <= 4 ? '중학년' : '고학년';
}

/** 주말이면 바로 앞 금요일 */
export function studyDate(d) {
  const dow = d.getUTCDay();
  return dow === 6 ? addDays(d, -1) : dow === 0 ? addDays(d, -2) : d;
}

/** 오늘 보여줄 한 줄 고르기: 날짜가 맞는 줄 → 없으면 순서대로 돌아가며 */
export function pickRow(rows, band, date) {
  const list = rows.filter((r) => useOk(r) && (!band || !r['학년구분'] || r['학년구분'] === '전체' || r['학년구분'] === band));
  if (!list.length) return null;
  const key = ymd(date);
  const exact = list.find((r) => normDate(r['날짜']) === key);
  if (exact) return exact;
  const undated = list.filter((r) => !normDate(r['날짜']));
  const pool = undated.length ? undated : list;
  pool.sort((a, b) => (parseInt(a['번호']) || 0) - (parseInt(b['번호']) || 0));
  const dayNo = Math.floor(date.getTime() / 86400000);
  return pool[((dayNo % pool.length) + pool.length) % pool.length];
}

export function buildDaily(sheet, dateStr, grade) {
  const today = parseDate(dateStr) || parseDate(kstNow().ymd);
  const band = gradeBand(grade);
  const sd = studyDate(today);
  const pick = (tab, b) => pickRow(sheet[tab] || [], b, sd);

  const study = {
    word: pick('공부_영단어', band),
    hanja: pick('공부_한자', band),
    proverb: pick('공부_속담', band),
    math: pick('공부_수학', band),
    fact: pick('공부_상식', band),
    local: pick('우리고장', band),
  };

  // 절기: 그날부터 3일 동안 보여 줌
  const t = today.getTime();
  const term = (sheet['절기'] || []).filter(useOk).find((r) => {
    const d = parseDate(r['날짜']);
    return d && t >= d.getTime() && t < d.getTime() + 3 * 86400000;
  }) || null;

  // 계기교육: 그날, 그리고 금요일에는 그 주말 것까지
  const ahead = today.getUTCDay() === 5 ? 2 : 0;
  const events = (sheet['계기교육'] || []).filter(useOk).filter((r) => {
    const d = parseDate(r['날짜']);
    if (!d) return false;
    const diff = Math.round((d.getTime() - t) / 86400000);
    const okBand = !r['학년구분'] || r['학년구분'] === '전체' || r['학년구분'] === band;
    return okBand && diff >= 0 && diff <= ahead;
  });

  return { date: ymd(today), band, studyDate: ymd(sd), study, term, events };
}

export function buildConfig(sheet, k = kstNow()) {
  const settings = {};
  for (const r of sheet['설정'] || []) if (r['항목']) settings[r['항목']] = r['값'] || '';
  const today = parseDate(k.ymd).getTime();
  let notice = settings['공지_내용'] || '';
  const ns = parseDate(settings['공지_시작일']), ne = parseDate(settings['공지_종료일']);
  if ((ns && today < ns.getTime()) || (ne && today > ne.getTime())) notice = '';
  const on = (key, def) => ((settings[key] || def).toUpperCase() !== 'N');
  const outfit = (sheet['옷차림'] || []).map((r) => ({
    from: parseFloat(r['최고기온 이상(℃)']), to: parseFloat(r['최고기온 미만(℃)']),
    clothes: r['추천 옷'], say: r['캐릭터 문구'],
  })).filter((o) => !isNaN(o.from) && !isNaN(o.to));
  const tips = {};
  for (const r of sheet['날씨_추가안내'] || []) if (useOk(r) && r['조건코드']) tips[r['조건코드']] = r['문구'];
  const schools = {};
  for (const r of sheet['학교추가정보'] || []) if (useOk(r) && r['학교명']) schools[r['학교명']] = { intro: r['소개'], pride: r['자랑거리·특색 활동'] };
  return {
    notice,
    contact: settings['문의_연락처'] || '',
    feedbackUrl: settings['의견_주소'] || '',
    airStation: settings['미세먼지_측정소'] || '산청읍',
    menus: {
      school: on('메뉴_학교', 'Y'), weather: on('메뉴_날씨', 'Y'), study: on('메뉴_공부', 'Y'),
    },
    outfit, tips, schools,
  };
}

/* ---------------- 주소 처리 ---------------- */

async function handleApi(url, env) {
  const p = url.searchParams;
  const path = url.pathname.replace(/\/+$/, '');
  const need = (...names) => {
    for (const n of names) if (!p.get(n)) throw Object.assign(new Error(`${n} 값이 필요해요`), { status: 400 });
  };
  const ymdParam = (n) => {
    const d = parseDate(p.get(n));
    if (!d) throw Object.assign(new Error(`${n} 날짜 형식 오류`), { status: 400 });
    return ymd(d);
  };

  switch (path) {
    case '/api/health':
      return json({ ok: true, neis: !!env.NEIS_KEY, data: !!env.DATA_KEY, sheet: !!env.SHEET_URL, now: kstNow() }, 200, 0);
    case '/api/towns':
      return json(Object.keys(TOWNS), 200, 86400);
    case '/api/schools':
      return json(await getSchools(env), 200, 3600);
    case '/api/classes':
      need('school', 'grade');
      return json(await getClasses(env, p.get('school'), p.get('grade')), 200, 3600);
    case '/api/meals':
      need('school', 'from', 'to');
      return json(await getMeals(env, p.get('school'), ymdParam('from'), ymdParam('to')), 200, 1800);
    case '/api/timetable':
      need('school', 'grade', 'class', 'from', 'to');
      return json(await getTimetable(env, p.get('school'), p.get('grade'), p.get('class'), ymdParam('from'), ymdParam('to')), 200, 1800);
    case '/api/weather':
      return json(await getWeather(env, p.get('town') || '산청읍'), 200, 600);
    case '/api/air': {
      const cfg = env.SHEET_URL ? buildConfig(await getSheet(env).catch(() => ({}))) : { airStation: '산청읍' };
      return json(await getAir(env, p.get('station') || cfg.airStation), 200, 600);
    }
    case '/api/config':
      return json(buildConfig(await getSheet(env)), 200, 600);
    case '/api/daily':
      return json(buildDaily(await getSheet(env), p.get('date'), p.get('grade') || '3'), 200, 600);
    default:
      return json({ error: '없는 주소예요' }, 404);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(url, env);
      } catch (e) {
        return json({ error: e.message || '오류가 났어요' }, e.status || 502);
      }
    }
    // 그 밖의 주소는 public 폴더의 화면 파일
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
};
