/* 산청아이(AI) 앱
 * 학생 정보는 이 휴대폰 안에만 저장됩니다. 서버로 보내는 것은 학교 코드·학년·반·읍면뿐이에요.
 */
'use strict';

const VERSION = '1.2.0';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- 저장 (휴대폰 안) ---------------- */
const store = {
  get(k, d = null) { try { const v = localStorage.getItem('sa:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sa:' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('sa:' + k); } catch {} },
};
let profile = store.get('profile'); // { school:{code,name,town,...}, grade, cls, town }
let prefs = store.get('prefs', { large: false, allergies: [] });

/* ---------------- 날짜 (한국 시각) ---------------- */
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function kst() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return { date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), h: d.getUTCHours(), m: d.getUTCMinutes() };
}
const ymd = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const isWeekday = (d) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
const nextWeekday = (d) => { let x = addDays(d, 1); while (!isWeekday(x)) x = addDays(x, 1); return x; };
const fromYmd = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
const mdLabel = (d) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${DOW[d.getUTCDay()]}요일`;
const mondayOf = (d) => addDays(d, -((d.getUTCDay() + 6) % 7));

/** 홈에 보여 줄 '학교 가는 날': 평일 오후 3시 전이면 오늘, 아니면 다음 평일 */
function targetSchoolDay() {
  const { date, h } = kst();
  if (isWeekday(date) && h < 15) return { date, label: '오늘' };
  const n = nextWeekday(date);
  const diff = Math.round((n - date) / 86400000);
  return { date: n, label: diff === 1 ? '내일' : `${DOW[n.getUTCDay()]}요일` };
}

/* ---------------- 서버 요청 ---------------- */
async function api(path, { cacheKey, maxAgeMin = 30 } = {}) {
  const key = 'api:' + (cacheKey || path);
  const old = store.get(key);
  if (old && Date.now() - old.t < maxAgeMin * 60000) return old.v;
  try {
    const res = await fetch(path, { headers: { accept: 'application/json' } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '불러오지 못했어요');
    store.set(key, { t: Date.now(), v: data });
    return data;
  } catch (e) {
    if (old) return old.v; // 인터넷이 안 될 때는 예전에 받은 내용을 보여 줌
    throw e;
  }
}

let config = store.get('config:last', { notice: '', menus: { school: true, weather: true, study: true }, outfit: [], tips: {}, schools: {} });
async function loadConfig() {
  try { config = await api('/api/config', { maxAgeMin: 20 }); store.set('config:last', config); } catch {}
  const n = $('#notice');
  n.innerHTML = config.notice ? ic('bell') + `<span>${esc(config.notice)}</span>` : '';
  n.hidden = !config.notice;
}

/* ---------------- 소리로 읽기 ---------------- */
function speak(text, lang = 'ko-KR') {
  if (!('speechSynthesis' in window)) { toast('이 휴대폰은 읽어 주기를 지원하지 않아요'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = lang.startsWith('en') ? 0.85 : 0.95;
  speechSynthesis.speak(u);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-speak]');
  if (b) speak(b.dataset.speak, b.dataset.lang || 'ko-KR');
  const r = e.target.closest('[data-reveal]');
  if (r) {
    const box = document.getElementById(r.dataset.reveal);
    box.hidden = !box.hidden;
    r.textContent = box.hidden ? r.dataset.show : '정답 숨기기';
  }
});

function toast(msg) {
  showSheet(`<h3>${esc(msg)}</h3><button class="btn wide" data-close>확인</button>`);
}

/* ---------------- 계절 꾸밈 ---------------- */
function applySeason() {
  document.documentElement.dataset.size = prefs.large ? 'large' : 'normal';
}

let sceneKey = '';
function renderTop(compact = false) {
  const { date, h } = kst();
  const month = date.getUTCMonth() + 1;
  const key = `${timeOfDay(h)}:${month}`;
  if (key !== sceneKey) { $('#scene').innerHTML = jirisan({ hour: h, month, uid: 'top' }); sceneKey = key; }
  const top = $('#top');
  top.classList.toggle('night', timeOfDay(h) === 'night');
  top.classList.toggle('compact', compact);
  $('#topDate').textContent = mdLabel(date);
  $('#topHello').textContent = profile
    ? `안녕! ${profile.school.name.replace('초등학교', '초')} ${profile.grade}학년${profile.cls ? ' ' + profile.cls + '반' : ''}`
    : '산청아이';
}

/* ---------------- 날씨 도구 ---------------- */
function skyIcon(h, hour = 12) { return wxArt(wxKind(h, hour)); }
function skyIconOld(h, hour = 12) {
  if (!h) return '';
  const night = hour < 6 || hour >= 19;
  if (h.pty === 1) return '🌧️';
  if (h.pty === 2) return '🌨️';
  if (h.pty === 3) return '❄️';
  if (h.pty === 4) return '🌦️';
  if (h.sky === 4) return '☁️';
  if (h.sky === 3) return night ? '☁️' : '⛅';
  return night ? '🌙' : '☀️';
}
function skyWord(d) {
  if (!d) return '';
  if (d.snow) return '눈';
  if (d.rain) return '비';
  return { 1: '맑음', 3: '구름 많음', 4: '흐림' }[d.sky] || '';
}
function outfitFor(max) {
  if (max == null) return null;
  return (config.outfit || []).find((o) => max >= o.from && max < o.to) || null;
}
const GRADE = ['', '좋음', '보통', '나쁨', '매우 나쁨'];
function weatherTips(day, air) {
  const t = config.tips || {};
  const out = [];
  if (!day) return out;
  if (day.pop >= 60 && t.rain) out.push(t.rain);
  if (day.snow && t.snow) out.push(t.snow);
  if (air && Math.max(air.pm10Grade || 0, air.pm25Grade || 0) >= 3 && t.dust_bad) out.push(t.dust_bad);
  if (day.max != null && day.min != null && day.max - day.min >= 10 && t.big_gap) out.push(t.big_gap);
  if (day.max != null && day.max >= 33 && t.heat) out.push(t.heat);
  return out;
}
const friendImg = `<img class="friend" src="img/friend.png" alt="" onerror="this.remove()">${ic('shirt', 'shirt')}`;

/* ---------------- 알레르기 ---------------- */
const ALLERGY = ['', '난류', '우유', '메밀', '땅콩', '대두', '밀', '고등어', '게', '새우', '돼지고기', '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣'];
function dishesHtml(meal) {
  const mine = prefs.allergies || [];
  return `<ul class="dishes">${meal.dishes.map((d) => {
    const warn = d.allergies.some((a) => mine.includes(a));
    return `<li class="${warn ? 'warn' : ''}">${esc(d.name)}${d.allergies.length ? `<span class="alg">${d.allergies.map((a) => `<i title="${ALLERGY[a]}">${a}</i>`).join('')}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}
const lunchOf = (meals, key) => meals.find((m) => m.date === key && m.type === '중식') || meals.find((m) => m.date === key);

/* ---------------- 화면: 홈 ---------------- */
async function viewHome(el) {
  const target = targetSchoolDay();
  const tKey = ymd(target.date);
  const g = profile.grade;
  el.innerHTML = `
    ${config.menus.weather ? `<a class="card" href="#/weather" id="cWx"><h2 class="card-h">${ib('cloudSun', 'sky')}오늘 날씨<span class="more">자세히${ic('chev')}</span></h2><div class="skeleton"></div><div class="skeleton" style="width:60%"></div></a>` : ''}
    <div id="cEvent"></div>
    ${config.menus.school ? `
    <a class="card" href="#/school/tt" id="cTt"><h2 class="card-h">${ib('book', 'forest')}${target.label} 시간표<span class="more">이번 주${ic('chev')}</span></h2><div class="skeleton"></div></a>
    <div class="card" id="cMeal"><h2 class="card-h">${ib('bowl', 'gam')}${target.label} 급식<a class="more" href="#/school/meal">이번 주${ic('chev')}</a></h2><div class="skeleton"></div><div class="skeleton" style="width:70%"></div></div>` : ''}
    ${config.menus.study ? `<a class="card" href="#/study" id="cStudy"><h2 class="card-h">${ib('pencil', 'ridge')}오늘의 공부<span class="more">모두 보기${ic('chev')}</span></h2><div class="skeleton"></div></a>` : ''}
  `;

  // 날씨
  if (config.menus.weather) {
    Promise.all([api(`/api/weather?town=${encodeURIComponent(profile.town)}`, { maxAgeMin: 30 }), api('/api/air', { maxAgeMin: 30 }).catch(() => null)])
      .then(([w, air]) => {
        const day = w.today || w.tomorrow;
        const o = outfitFor(day?.max);
        const tips = weatherTips(day, air);
        $('#cWx').innerHTML = `
          <h2 class="card-h">${ib('cloudSun', 'sky')}${esc(w.town)} 날씨<span class="more">자세히${ic('chev')}</span></h2>
          <div class="wx">
            <div class="wx-ico">${skyIcon(w.now, kst().h)}</div>
            <div><div class="wx-temp">${w.now?.tmp ?? '-'}°</div>
            <div class="wx-range">${esc(skyWord(day))} · <span class="lo">${fmtT(day?.min)}°</span> / <span class="hi">${fmtT(day?.max)}°</span> · 비 ${day?.pop ?? 0}%</div></div>
          </div>
          ${o ? `<div class="outfit">${friendImg}<div class="outfit-text"><b>${esc(o.clothes)}</b>${esc(o.say)}</div></div>` : ''}
          ${tips.length ? `<ul class="tips">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          ${air ? `<div class="dust"><span class="g${air.pm10Grade}">미세먼지 ${GRADE[air.pm10Grade] || '-'}</span><span class="g${air.pm25Grade}">초미세먼지 ${GRADE[air.pm25Grade] || '-'}</span></div>` : ''}`;
      })
      .catch((e) => { $('#cWx').innerHTML = `<h2 class="card-h">${ib('cloudSun', 'sky')}날씨</h2><p class="err">날씨를 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.</p>`; console.warn(e); });
  }

  // 시간표
  if (config.menus.school) {
    api(`/api/timetable?school=${profile.school.code}&grade=${g}&class=${encodeURIComponent(profile.cls)}&from=${tKey}&to=${tKey}`, { maxAgeMin: 60 })
      .then((tt) => {
        const list = tt[tKey] || [];
        $('#cTt').innerHTML = `<h2 class="card-h">${ib('book', 'forest')}${target.label} 시간표<span class="more">이번 주${ic('chev')}</span></h2>
          ${list.length ? `<ol class="periods">${list.map((p) => `<li><small>${p.period}</small>${esc(p.subject)}</li>`).join('')}</ol>` : `<p class="empty">시간표가 아직 없어요. 담임 선생님께 확인해요.</p>`}`;
      })
      .catch(() => { $('#cTt').querySelector('.skeleton')?.replaceWith(Object.assign(document.createElement('p'), { className: 'err', textContent: '시간표를 불러오지 못했어요.' })); });

    const mon = mondayOf(kst().date);
    api(`/api/meals?school=${profile.school.code}&from=${ymd(mon)}&to=${ymd(addDays(mon, 13))}`, { maxAgeMin: 120 })
      .then((meals) => {
        const meal = lunchOf(meals, tKey);
        const text = meal ? meal.dishes.map((d) => d.name).join(', ') : '';
        $('#cMeal').innerHTML = `<h2 class="card-h">${ib('bowl', 'gam')}${target.label} 급식<a class="more" href="#/school/meal">이번 주${ic('chev')}</a></h2>
          ${meal ? dishesHtml(meal) + `<div class="row"><button class="speak" data-speak="${esc(target.label + ' 급식은 ' + text + '이에요')}">${ic('speaker')}읽어 주기</button></div>` : `<p class="empty">급식이 없는 날이에요.</p>`}`;
      })
      .catch(() => { $('#cMeal').querySelector('.skeleton')?.replaceWith(Object.assign(document.createElement('p'), { className: 'err', textContent: '급식을 불러오지 못했어요.' })); });
  }

  // 오늘의 공부 + 절기·계기교육
  api(`/api/daily?date=${ymd(kst().date)}&grade=${g}`, { maxAgeMin: 60, cacheKey: `daily:${ymd(kst().date)}:${g}` })
    .then((d) => {
      const ev = [];
      if (d.term) ev.push(`<span class="tag tag-term">절기</span><p class="q-main">${esc(d.term['절기'])}</p><p class="q-sub">${esc(d.term['설명'])}</p>`);
      for (const e of d.events || []) ev.push(`<span class="tag tag-event">${esc(dayWord(e['날짜']))}</span><p class="q-main">${esc(e['제목'])}</p><p class="q-sub">${esc(e['설명'])}</p>`);
      $('#cEvent').innerHTML = ev.map((h) => `<div class="card qcard">${h}</div>`).join('');
      if (config.menus.study) {
        const w = d.study.word;
        $('#cStudy').innerHTML = `<h2 class="card-h">${ib('pencil', 'ridge')}오늘의 공부<span class="more">모두 보기${ic('chev')}</span></h2>
          ${w ? `<div class="study-peek"><span class="big">${esc(w['단어'])}</span><span class="muted">${esc(w['뜻'])}</span></div><p class="small muted" style="margin:6px 0 0">한자 · 속담 · 수학 · 상식 · 우리 고장 문제도 있어요!</p>` : '<p class="empty">오늘의 공부를 준비하고 있어요.</p>'}`;
      }
    })
    .catch(() => { if ($('#cStudy')) $('#cStudy').innerHTML = `<h2 class="card-h">${ib('pencil', 'ridge')}오늘의 공부</h2><p class="err">공부 내용을 불러오지 못했어요.</p>`; });
}
const fmtT = (t) => (t == null || isNaN(t) ? '-' : Math.round(t));
function dayWord(s) {
  const d = fromYmd(String(s).replace(/[^0-9]/g, ''));
  const diff = Math.round((d - kst().date) / 86400000);
  return diff === 0 ? '오늘' : diff === 1 ? '내일' : `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

/* ---------------- 화면: 학교 ---------------- */
let schoolWeek = 0;
let mealDay = null;
async function viewSchool(el, sub = 'tt') {
  el.innerHTML = `
    <div class="seg" role="tablist">
      <button role="tab" aria-selected="${sub === 'tt'}" data-sub="tt">시간표</button>
      <button role="tab" aria-selected="${sub === 'meal'}" data-sub="meal">급식</button>
      <button role="tab" aria-selected="${sub === 'info'}" data-sub="info">우리 학교</button>
    </div>
    <div id="schoolBody"></div>`;
  el.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/school/${b.dataset.sub}`; }));
  const body = $('#schoolBody');
  if (sub === 'meal') return schoolMeal(body);
  if (sub === 'info') return schoolInfo(body);
  return schoolTimetable(body);
}

async function schoolTimetable(body) {
  const mon = addDays(mondayOf(kst().date), schoolWeek * 7);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
  const todayKey = ymd(kst().date);
  body.innerHTML = `
    <div class="daynav"><button aria-label="지난주" id="wPrev">${ic('chevL')}</button><b>${mon.getUTCMonth() + 1}월 ${mon.getUTCDate()}일 주</b><button aria-label="다음 주" id="wNext">${ic('chev')}</button></div>
    <div class="card" id="ttCard"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
  $('#wPrev').onclick = () => { schoolWeek--; schoolTimetable(body); };
  $('#wNext').onclick = () => { schoolWeek++; schoolTimetable(body); };
  try {
    const tt = await api(`/api/timetable?school=${profile.school.code}&grade=${profile.grade}&class=${encodeURIComponent(profile.cls)}&from=${ymd(days[0])}&to=${ymd(days[4])}`, { maxAgeMin: 60 });
    const max = Math.max(0, ...days.map((d) => (tt[ymd(d)] || []).length));
    if (!max) { $('#ttCard').innerHTML = '<p class="empty">이번 주 시간표가 아직 없어요.</p>'; return; }
    let html = '<table class="week"><thead><tr>';
    html += days.map((d) => `<th class="${ymd(d) === todayKey ? 'today' : ''}">${DOW[d.getUTCDay()]}<br><small>${d.getUTCDate()}</small></th>`).join('') + '</tr></thead><tbody>';
    for (let p = 1; p <= max; p++) {
      html += '<tr>' + days.map((d) => {
        const it = (tt[ymd(d)] || []).find((x) => x.period === p);
        return `<td class="${!it ? 'none' : ymd(d) === todayKey ? 'today' : ''}">${it ? esc(it.subject) : ''}</td>`;
      }).join('') + '</tr>';
    }
    $('#ttCard').innerHTML = html + '</tbody></table>';
  } catch { $('#ttCard').innerHTML = '<p class="err">시간표를 불러오지 못했어요.</p>'; }
}

async function schoolMeal(body) {
  if (!mealDay) mealDay = targetSchoolDay().date;
  const key = ymd(mealDay);
  body.innerHTML = `
    <div class="daynav"><button aria-label="이전 날" id="mPrev">${ic('chevL')}</button><b>${mdLabel(mealDay)}</b><button aria-label="다음 날" id="mNext">${ic('chev')}</button></div>
    <div class="card" id="mealCard"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  const step = (n) => { let d = addDays(mealDay, n); while (!isWeekday(d)) d = addDays(d, n); mealDay = d; schoolMeal(body); };
  $('#mPrev').onclick = () => step(-1);
  $('#mNext').onclick = () => step(1);
  const mon = mondayOf(mealDay);
  try {
    const meals = await api(`/api/meals?school=${profile.school.code}&from=${ymd(mon)}&to=${ymd(addDays(mon, 13))}`, { maxAgeMin: 120 });
    const list = meals.filter((m) => m.date === key);
    $('#mealCard').innerHTML = list.length ? list.map((m) => `
      <h2 class="card-h">${ib('bowl', 'gam')}${esc(m.type)}</h2>${dishesHtml(m)}
      ${m.cal ? `<div class="cal">${esc(m.cal)}</div>` : ''}
      <div class="row"><button class="speak" data-speak="${esc(m.dishes.map((d) => d.name).join(', '))}">${ic('speaker')}읽어 주기</button></div>`).join('<hr style="border:0;border-top:1.5px dashed var(--edge);margin:16px 0">')
      : '<p class="empty">이날은 급식이 없어요.</p>';
    $('#mealCard').insertAdjacentHTML('beforeend', `<p class="small muted" style="margin:12px 0 0">작은 숫자는 알레르기 번호예요. <a href="#/more" style="color:var(--green)">더보기</a>에서 내 알레르기를 고르면 빨갛게 알려 줘요.</p>`);
  } catch { $('#mealCard').innerHTML = '<p class="err">급식을 불러오지 못했어요.</p>'; }
}

function schoolInfo(body) {
  const s = profile.school;
  const extra = (config.schools || {})[s.name] || {};
  body.innerHTML = `
    <div class="card info">
      <h2 class="card-h">${ib('school', 'forest')}${esc(s.name)}</h2>
      ${extra.intro ? `<p style="margin:0 0 12px">${esc(extra.intro)}</p>` : ''}
      <dl>
        <dt>주소</dt><dd>${esc(s.address || '-')}</dd>
        <dt>전화</dt><dd>${s.tel ? `<a href="tel:${esc(s.tel)}">${esc(s.tel)}</a>` : '-'}</dd>
        ${s.homepage ? `<dt>누리집</dt><dd><a href="${esc(/^https?:/.test(s.homepage) ? s.homepage : 'http://' + s.homepage)}" target="_blank" rel="noopener">바로 가기</a></dd>` : ''}
      </dl>
    </div>
    ${extra.pride ? `<div class="card"><h2 class="card-h">${ib('star', 'gam')}우리 학교 자랑</h2><p style="margin:0">${esc(extra.pride)}</p></div>` : ''}`;
}

/* ---------------- 화면: 날씨 ---------------- */
async function viewWeather(el) {
  el.innerHTML = '<div class="card"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
  try {
    const [w, air] = await Promise.all([
      api(`/api/weather?town=${encodeURIComponent(profile.town)}`, { maxAgeMin: 30 }),
      api('/api/air', { maxAgeMin: 30 }).catch(() => null),
    ]);
    const nowH = kst().h;
    const day = w.today || w.tomorrow;
    const o = outfitFor(day?.max);
    const tips = weatherTips(day, air);
    const hours = (w.today?.hours || []).filter((h) => parseInt(h.time) / 100 >= nowH).concat(w.tomorrow?.hours || []).slice(0, 24);
    const dayCard = (label, d) => d ? `
      <div class="dayrow"><div class="wx-ico">${skyIcon({ sky: d.sky, pty: d.snow ? 3 : d.rain ? 1 : 0 })}</div>
      <div><b>${label}</b> ${esc(skyWord(d))}<div class="wx-range"><span class="lo">${fmtT(d.min)}°</span> / <span class="hi">${fmtT(d.max)}°</span> · 비 올 확률 ${d.pop}%</div></div></div>` : '';
    el.innerHTML = `
      <div class="card">
        <h2 class="card-h">${ib('pin', 'sky')}${esc(w.town)} 지금</h2>
        <div class="wx"><div class="wx-ico">${skyIcon(w.now, nowH)}</div>
          <div><div class="wx-temp">${w.now?.tmp ?? '-'}°</div><div class="wx-range"><span class="lo">${fmtT(day?.min)}°</span> / <span class="hi">${fmtT(day?.max)}°</span>${w.now?.reh != null ? ` · 습도 ${w.now.reh}%` : ''}</div></div></div>
        ${o ? `<div class="outfit">${friendImg}<div class="outfit-text"><b>${esc(o.clothes)}</b>${esc(o.say)}</div></div>` : ''}
        ${tips.length ? `<ul class="tips">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${o ? `<div class="row"><button class="speak" data-speak="${esc(`오늘 ${w.town} 최고 기온은 ${fmtT(day?.max)}도예요. ${o.clothes}를 추천해요. ${tips.join(' ')}`)}">${ic('speaker')}읽어 주기</button></div>` : ''}
      </div>
      <div class="card"><h2 class="card-h">${ib('clock', 'ridge')}시간별</h2>
        <div class="hours">${hours.map((h) => `<div><small>${parseInt(h.time) / 100}시</small>${skyIcon(h, parseInt(h.time) / 100)}<b>${fmtT(h.tmp)}°</b>${h.pop ? `<small style="color:#2f78b5">${h.pop}%</small>` : ''}</div>`).join('')}</div>
      </div>
      <div class="card">${dayCard('오늘', w.today)}${dayCard('내일', w.tomorrow)}</div>
      ${air ? `<div class="card"><h2 class="card-h">${ib('wind', 'forest')}미세먼지 <span class="note">${esc(air.station)} 측정소</span></h2>
        <div class="dust"><span class="g${air.pm10Grade}">미세먼지<br>${GRADE[air.pm10Grade] || '-'}${air.pm10 != null ? ` (${air.pm10})` : ''}</span><span class="g${air.pm25Grade}">초미세먼지<br>${GRADE[air.pm25Grade] || '-'}${air.pm25 != null ? ` (${air.pm25})` : ''}</span></div>
        <p class="small muted" style="margin:8px 0 0">${esc(air.time || '')} 측정 · 에어코리아</p></div>` : ''}
      <p class="small muted" style="text-align:center">기상청 단기예보 · ${esc(w.base.date.slice(4, 6))}월 ${esc(w.base.date.slice(6))}일 ${esc(w.base.time.slice(0, 2))}시 발표</p>`;
  } catch {
    el.innerHTML = '<div class="card"><p class="err">날씨를 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.</p></div>';
  }
}

/* ---------------- 화면: 공부 ---------------- */
async function viewStudy(el) {
  const g = profile.grade;
  el.innerHTML = '<div class="card"><div class="skeleton"></div><div class="skeleton"></div></div>';
  try {
    const d = await api(`/api/daily?date=${ymd(kst().date)}&grade=${g}`, { maxAgeMin: 60, cacheKey: `daily:${ymd(kst().date)}:${g}` });
    const s = d.study;
    const cards = [];
    let n = 0;
    const qa = (tag, cls, q, a, ex) => {
      const id = 'ans' + n++;
      return `<div class="card qcard"><span class="tag ${cls}">${tag}</span><p class="q-main">${esc(q)}</p>
        <div class="row"><button class="btn ghost" data-reveal="${id}" data-show="정답 보기">정답 보기</button><button class="speak" data-speak="${esc(q)}" aria-label="문제 읽어 주기">${ic('speaker')}</button></div>
        <div class="answer" id="${id}" hidden><b>정답: ${esc(a)}</b>${ex ? `<br>${esc(ex)}` : ''}</div></div>`;
    };
    if (s.word) cards.push(`<div class="card qcard"><span class="tag tag-word">오늘의 영단어</span>
      <p class="q-big">${esc(s.word['단어'])}</p><p class="q-sub"><b>${esc(s.word['뜻'])}</b></p>
      ${s.word['예문'] ? `<p class="q-sub">${esc(s.word['예문'])}<br><span class="small">${esc(s.word['예문 뜻'])}</span></p>` : ''}
      <div class="row"><button class="speak" data-lang="en-US" data-speak="${esc(s.word['단어'])}">${ic('speaker')}단어</button>${s.word['예문'] ? `<button class="speak" data-lang="en-US" data-speak="${esc(s.word['예문'])}">${ic('speaker')}예문</button>` : ''}</div></div>`);
    if (s.hanja) cards.push(`<div class="card qcard"><span class="tag tag-hanja">오늘의 한자</span>
      <div style="display:flex;gap:16px;align-items:center"><p class="q-big" style="font-size:3.2rem">${esc(s.hanja['한자'])}</p>
      <div><p class="q-main" style="margin:0">${esc(s.hanja['훈음'])}</p><p class="q-sub">${esc(s.hanja['예시 낱말'])}</p></div></div>
      <div class="row"><button class="speak" data-speak="${esc(s.hanja['훈음'])}">${ic('speaker')}읽어 주기</button></div></div>`);
    if (s.proverb) cards.push(`<div class="card qcard"><span class="tag tag-proverb">오늘의 속담</span>
      <p class="q-main">${esc(s.proverb['속담'])}</p><p class="q-sub">${esc(s.proverb['뜻'])}</p>
      <div class="row"><button class="speak" data-speak="${esc(s.proverb['속담'] + '. ' + s.proverb['뜻'])}">${ic('speaker')}읽어 주기</button></div></div>`);
    if (s.math) cards.push(qa('오늘의 수학', 'tag-math', s.math['문제'], s.math['정답'], s.math['풀이']));
    if (s.fact) cards.push(qa('오늘의 상식', 'tag-fact', s.fact['질문'], s.fact['정답'], s.fact['설명']));
    if (s.local) cards.push(qa('우리 고장 산청', 'tag-local', s.local['질문'], s.local['정답'], s.local['설명']));
    if (d.term) cards.unshift(`<div class="card qcard"><span class="tag tag-term">절기</span><p class="q-main">${esc(d.term['절기'])}</p><p class="q-sub">${esc(d.term['설명'])}</p></div>`);
    for (const e of (d.events || []).slice().reverse()) cards.unshift(`<div class="card qcard"><span class="tag tag-event">${esc(dayWord(e['날짜']))}</span><p class="q-main">${esc(e['제목'])}</p><p class="q-sub">${esc(e['설명'])}</p></div>`);
    el.innerHTML = cards.length ? cards.join('') : '<div class="card"><p class="empty">오늘의 공부를 준비하고 있어요.</p></div>';
  } catch {
    el.innerHTML = '<div class="card"><p class="err">공부 내용을 불러오지 못했어요.</p></div>';
  }
}

/* ---------------- 화면: 더보기 ---------------- */
function viewMore(el) {
  el.innerHTML = `
    <div class="card"><ul class="list">
      <li><button id="mProfile">${ib('school', 'forest')}<span class="lbl">${esc(profile.school.name)} ${profile.grade}학년 ${esc(profile.cls)}반<br><span class="small muted">${esc(profile.town)}에 살아요</span></span><span class="chev">바꾸기${ic('chev')}</span></button></li>
      <li><button id="mLarge">${ib('text', 'ridge')}<span class="lbl">글자 크게 보기</span><span class="switch ${prefs.large ? 'on' : ''}" role="switch" aria-checked="${prefs.large}"></span></button></li>
      <li><button id="mAllergy">${ib('alert', 'gam')}<span class="lbl">내 알레르기 표시</span><span class="chev">${(prefs.allergies || []).length ? prefs.allergies.length + '개' : ''}${ic('chev')}</span></button></li>
    </ul></div>
    <div class="card"><ul class="list">
      <li><button id="mTour">${ib('guide', 'sky')}<span class="lbl">사용법 다시 보기</span><span class="chev">${ic('chev')}</span></button></li>
      ${config.feedbackUrl ? `<li><a href="${esc(feedbackLink())}" target="_blank" rel="noopener">${ib('mail', 'gam')}<span class="lbl">의견 보내기</span><span class="chev">${ic('chev')}</span></a></li>` : ''}
      <li><button id="mPrivacy">${ib('lock', 'forest')}<span class="lbl">개인정보 안내</span><span class="chev">${ic('chev')}</span></button></li>
      ${config.contact ? `<li><a href="tel:${esc(config.contact)}">${ib('phone', 'ridge')}<span class="lbl">문의 ${esc(config.contact)}</span><span class="chev">${ic('chev')}</span></a></li>` : ''}
    </ul></div>
    <p class="foot">산청아이 ${VERSION} · 정보 출처: 나이스 교육정보 개방포털, 기상청, 에어코리아</p>`;
  $('#mProfile').onclick = () => startOnboarding(1);
  $('#mLarge').onclick = () => { prefs.large = !prefs.large; store.set('prefs', prefs); applySeason(); viewMore(el); };
  $('#mAllergy').onclick = pickAllergies;
  $('#mTour').onclick = () => startOnboarding(0, true);
  $('#mPrivacy').onclick = () => showSheet(`<h3>개인정보 안내</h3>
    <p>산청아이는 이름, 전화번호, 위치 같은 개인정보를 받지 않아요.</p>
    <p>고른 학교·학년·반·읍면, 글자 크기, 알레르기 표시는 <b>이 휴대폰 안에만</b> 저장돼요. 앱을 지우거나 브라우저 기록을 지우면 함께 지워져요.</p>
    <p>시간표·급식·날씨를 불러올 때 학교·학년·반·읍면 정보만 서버로 보내고, 서버는 이것을 따로 저장하지 않아요.</p>
    <p>앱을 더 좋게 만들기 위해 '날짜·학교·학년별로 오늘 앱을 연 휴대폰 수'만 숫자로 세요. 누구의 휴대폰인지는 알 수 없어요.</p>
    ${config.contact ? `<p>문의: ${esc(config.contact)}</p>` : ''}
    <button class="btn wide" data-close>확인</button>`);
}
function feedbackLink() {
  return config.feedbackUrl.replace('SCHOOL_NAME', encodeURIComponent(profile.school.name));
}
function pickAllergies() {
  const mine = new Set(prefs.allergies || []);
  showSheet(`<h3>내 알레르기 고르기</h3><p class="small">고른 음식이 들어간 급식 메뉴를 빨갛게 알려 줘요. 이 휴대폰에만 저장돼요.</p>
    <div class="choices cols3" id="algBox">${ALLERGY.slice(1).map((n, i) => `<button class="choice" style="font-size:.95rem" aria-pressed="${mine.has(i + 1)}" data-a="${i + 1}">${n}</button>`).join('')}</div>
    <div class="row"><button class="btn wide" id="algSave">저장</button></div>`);
  $('#algBox').onclick = (e) => { const b = e.target.closest('[data-a]'); if (b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); };
  $('#algSave').onclick = () => {
    prefs.allergies = [...document.querySelectorAll('#algBox [aria-pressed="true"]')].map((b) => +b.dataset.a);
    store.set('prefs', prefs); hideSheet(); route();
  };
}

/* ---------------- 아래에서 올라오는 창 ---------------- */
function showSheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sheet-box" role="dialog" aria-modal="true">${html}</div>`;
  s.hidden = false;
  s.onclick = (e) => { if (e.target === s || e.target.closest('[data-close]')) hideSheet(); };
}
function hideSheet() { $('#sheet').hidden = true; }

/* ---------------- 처음 설정 ---------------- */
const SLIDES = [
  { art: 'school', title: '우리 학교 소식을 한눈에', text: '오늘 시간표와 급식을 바로 볼 수 있어요.' },
  { art: 'weather', title: '산청 날씨와 옷차림', text: '우리 동네 날씨를 보고 무엇을 입을지 알려 줘요.' },
  { art: 'study', title: '매일 바뀌는 오늘의 공부', text: '영단어, 한자, 속담, 수학, 우리 고장 퀴즈가 매일 새로 나와요.' },
];
let ob = {};
function slideArt(i) {
  const k = kst();
  const scene = jirisan({ hour: i === 0 ? k.h : 10, month: k.date.getUTCMonth() + 1, uid: 'ob' + i, sky: i === 0 });
  if (i === 0) return scene;
  const big = i === 1 ? wxArt('partly') : `<svg viewBox="0 0 24 24" fill="none" stroke="#2e7d5b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[SLIDES[i].art === 'study' ? 'pencil' : 'school']}</svg>`;
  const plate = i === 1 ? '' : '<circle cx="200" cy="112" r="64" fill="#fff" opacity=".9"/>';
  return scene.replace('</svg>', `${plate}</svg>`) + `<div class="big-ico">${big}</div>`;
}
const TOWN_ORDER = ['산청읍', '차황면', '오부면', '생초면', '금서면', '삼장면', '시천면', '단성면', '신안면', '생비량면', '신등면'];
function startOnboarding(step = 0, tourOnly = false) {
  ob = { step, tourOnly, slide: 0, school: profile?.school || null, grade: profile?.grade || null, cls: profile?.cls || null, town: profile?.town || null };
  $('#onboard').hidden = false;
  document.body.style.overflow = 'hidden';
  renderOnboarding();
}
function endOnboarding() {
  $('#onboard').hidden = true;
  document.body.style.overflow = '';
  renderTop();
  route();
}
async function renderOnboarding() {
  const box = $('#onboard');
  if (ob.step === 0) {
    const s = SLIDES[ob.slide];
    const last = ob.slide === SLIDES.length - 1;
    box.innerHTML = `<div class="ob">
      <button class="ob-skip" id="obSkip">${ob.tourOnly ? '닫기' : '건너뛰기'}</button>
      <div class="ob-slide"><div class="ob-art">${slideArt(ob.slide)}</div>
        <h2>${ob.slide === 0 ? '산청아이에 온 걸 환영해!' : esc(s.title)}</h2><p>${ob.slide === 0 ? '지리산 아래 우리 동네 친구들을 위한 앱이에요. ' + esc(s.text) : esc(s.text)}</p></div>
      <div class="dots">${SLIDES.map((_, i) => `<i class="${i === ob.slide ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn wide" id="obNext">${last ? (ob.tourOnly ? '다 봤어요' : '시작하기') : '다음'}</button></div>`;
    const done = () => (ob.tourOnly ? endOnboarding() : (ob.step = 1, renderOnboarding()));
    $('#obSkip').onclick = done;
    $('#obNext').onclick = () => (last ? done() : (ob.slide++, renderOnboarding()));
    return;
  }
  if (ob.step === 1) {
    box.innerHTML = `<div class="ob"><h2 class="step">우리 학교를 골라 주세요</h2><p class="help">1/4 단계</p>
      <input class="search" id="obSearch" placeholder="학교 이름 찾기" autocomplete="off">
      <div id="obList"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
      <div class="ob-foot">${profile ? '<button class="btn line" id="obCancel">취소</button>' : ''}<button class="btn" id="obNext" ${ob.school ? '' : 'disabled'}>다음</button></div></div>`;
    if ($('#obCancel')) $('#obCancel').onclick = endOnboarding;
    $('#obNext').onclick = () => { ob.step = 2; renderOnboarding(); };
    let schools;
    try { schools = await api('/api/schools', { maxAgeMin: 24 * 60 }); }
    catch { $('#obList').innerHTML = '<p class="err">학교 목록을 불러오지 못했어요.</p><button class="btn ghost" id="obRetry">다시 시도</button>'; $('#obRetry').onclick = renderOnboarding; return; }
    const draw = (q) => {
      const list = schools.filter((s) => !q || s.name.includes(q));
      const groups = {};
      for (const s of list) (groups[s.town || '기타'] ||= []).push(s);
      const order = (t) => { const i = TOWN_ORDER.indexOf(t); return i < 0 ? 99 : i; };
      $('#obList').innerHTML = Object.entries(groups).sort(([a], [b]) => order(a) - order(b)).map(([t, arr]) => `<div class="grouph">${esc(t)}</div><div class="choices">${arr.map((s) =>
        `<button class="choice" data-code="${esc(s.code)}" aria-pressed="${ob.school?.code === s.code}">${esc(s.name)}</button>`).join('')}</div>`).join('') || '<p class="empty">찾는 학교가 없어요.</p>';
    };
    draw('');
    $('#obSearch').oninput = (e) => draw(e.target.value.trim());
    $('#obList').onclick = (e) => {
      const b = e.target.closest('[data-code]');
      if (!b) return;
      const s = schools.find((x) => x.code === b.dataset.code);
      if (ob.school?.code !== s.code) { ob.cls = null; }
      ob.school = s;
      if (s.town) ob.town = s.town;
      ob.step = 2; renderOnboarding();
    };
    return;
  }
  if (ob.step === 2) {
    box.innerHTML = `<div class="ob"><h2 class="step">몇 학년이에요?</h2><p class="help">2/4 단계 · ${esc(ob.school.name)}</p>
      <div class="choices cols3">${[1, 2, 3, 4, 5, 6].map((g) => `<button class="choice" data-g="${g}" aria-pressed="${ob.grade == g}">${g}학년</button>`).join('')}</div>
      <div class="ob-foot"><button class="btn line" id="obBack">이전</button></div></div>`;
    $('#obBack').onclick = () => { ob.step = 1; renderOnboarding(); };
    box.querySelector('.choices').onclick = (e) => {
      const b = e.target.closest('[data-g]');
      if (!b) return;
      if (ob.grade != b.dataset.g) ob.cls = null;
      ob.grade = +b.dataset.g; ob.step = 3; renderOnboarding();
    };
    return;
  }
  if (ob.step === 3) {
    box.innerHTML = `<div class="ob"><h2 class="step">몇 반이에요?</h2><p class="help">3/4 단계 · ${esc(ob.school.name)} ${ob.grade}학년</p>
      <div id="obCls"><div class="skeleton"></div></div>
      <div class="ob-foot"><button class="btn line" id="obBack">이전</button></div></div>`;
    $('#obBack').onclick = () => { ob.step = 2; renderOnboarding(); };
    let classes = [];
    try { classes = await api(`/api/classes?school=${ob.school.code}&grade=${ob.grade}`, { maxAgeMin: 24 * 60 }); } catch {}
    if (!classes.length) classes = ['1', '2', '3'];
    if (classes.length === 1) { ob.cls = classes[0]; ob.step = 4; renderOnboarding(); return; }
    $('#obCls').innerHTML = `<div class="choices cols3">${classes.map((c) => `<button class="choice" data-c="${esc(c)}" aria-pressed="${ob.cls == c}">${esc(c)}반</button>`).join('')}</div>`;
    $('#obCls').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) { ob.cls = b.dataset.c; ob.step = 4; renderOnboarding(); } };
    return;
  }
  if (ob.step === 4) {
    let towns = [];
    try { towns = await api('/api/towns', { maxAgeMin: 24 * 60 * 7 }); } catch { towns = TOWN_ORDER; }
    box.innerHTML = `<div class="ob"><h2 class="step">어느 동네에 살아요?</h2><p class="help">4/4 단계 · 이 동네 날씨를 보여 줄게요.</p>
      <div class="choices cols2">${towns.map((t) => `<button class="choice" data-t="${esc(t)}" aria-pressed="${ob.town === t}">${esc(t)}</button>`).join('')}</div>
      <div class="ob-foot"><button class="btn line" id="obBack">이전</button><button class="btn" id="obDone" ${ob.town ? '' : 'disabled'}>다 됐어요!</button></div></div>`;
    $('#obBack').onclick = () => { ob.step = 3; renderOnboarding(); };
    box.querySelector('.choices').onclick = (e) => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      ob.town = b.dataset.t;
      box.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      $('#obDone').disabled = false;
    };
    $('#obDone').onclick = () => {
      profile = { school: ob.school, grade: ob.grade, cls: ob.cls, town: ob.town };
      store.set('profile', profile);
      // 학년·반이 바뀌면 예전 공부·시간표 저장분 정리
      Object.keys(localStorage).filter((k) => k.startsWith('sa:api:/api/timetable') || k.startsWith('sa:api:daily')).forEach((k) => localStorage.removeItem(k));
      mealDay = null; schoolWeek = 0;
      location.hash = '#/home';
      endOnboarding();
      sendHit();
    };
  }
}

/* ---------------- 화면 바꾸기 ---------------- */
function route() {
  if (!profile) { startOnboarding(0); return; }
  const [, tab = 'home', sub] = (location.hash || '#/home').split('/');
  const el = $('#view');
  document.querySelectorAll('#tabbar a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tab === tab || (tab === 'weather' && a.dataset.tab === 'home')));
  document.querySelectorAll('#tabbar a').forEach((a) => { if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page'); });
  $('#tabbar [data-tab="school"]').hidden = !config.menus.school;
  $('#tabbar [data-tab="study"]').hidden = !config.menus.study;
  window.scrollTo(0, 0);
  renderTop(tab !== 'home');
  if (tab === 'school' && config.menus.school) return viewSchool(el, sub || 'tt');
  if (tab === 'weather' && config.menus.weather) return viewWeather(el);
  if (tab === 'study' && config.menus.study) return viewStudy(el);
  if (tab === 'more') return viewMore(el);
  return viewHome(el);
}

window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden && profile) { sendHit(); } });

/** 익명 이용 통계: 하루에 한 번만 '오늘 열었어요'를 알림 (학교 코드·학년만) */
function sendHit() {
  if (!profile) return;
  const today = ymd(kst().date);
  if (store.get('hitDay') === today) return;
  fetch('/api/hit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ school: profile.school.code, grade: profile.grade }) })
    .then((r) => { if (r.ok) store.set('hitDay', today); })
    .catch(() => {});
}

(async function init() {
  applySeason();
  renderTop();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  await loadConfig();
  route();
  sendHit();
})();
