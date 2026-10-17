/* 산청아이 그림 모음: 아이콘, 얼굴 있는 날씨 그림, 지리산 장면 */
'use strict';

/* ---------- 선 아이콘 (24×24, 글자색을 따라감) ---------- */
const ICON_PATHS = {
  home: '<path d="M3 20h18"/><path d="M4 20l5.5-9 3 4.5L16 10l4 10"/><circle cx="17.5" cy="5.5" r="1.8"/>',
  school: '<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M10 21v-5h4v5"/><path d="M12 5V2.5l3 1-3 1"/>',
  pencil: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/>',
  bowl: '<path d="M3 12h18a9 8 0 0 1-18 0z"/><path d="M8 8c0-1.6 1.2-1.6 1.2-3.2"/><path d="M12 8c0-1.6 1.2-1.6 1.2-3.2"/><path d="M16 8c0-1.6 1.2-1.6 1.2-3.2"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h13v14H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h13"/><path d="M8 7h7"/>',
  cloudSun: '<path d="M9 3v1.5"/><path d="M3.8 5.8l1 1"/><path d="M3 11h1.5"/><path d="M12.8 7.5A4 4 0 0 0 5.6 11"/><path d="M8 20h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.5 1.3A2.9 2.9 0 0 0 8 20z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  leaf: '<path d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15z"/><path d="M5 19l7-7"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  pin: '<path d="M12 21s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 14h15a3 3 0 1 1-3 3"/><path d="M3 19h6"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9.5a3.5 3.5 0 0 1 0 5"/><path d="M19 7a7 7 0 0 1 0 10"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  text: '<path d="M4 19l5-14 5 14"/><path d="M6 14h6"/><path d="M15 19l3-8 3 8"/><path d="M16 16.5h4"/>',
  alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4"/><path d="M12 17.2v.3"/>',
  guide: '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.5l8.5 6 8.5-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  shirt: '<path d="M8.5 3L3 6l2 4.5 3-1.2V21h8V9.3l3 1.2L21 6l-5.5-3a3.5 3.5 0 0 1-7 0z"/>',
  mountain: '<path d="M2 20l7-12 4 6 3-4 6 10z"/><path d="M7.5 10.5l1.5 1 1.5-1"/>',
};
function ic(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}
/** 카드 제목 앞 동그란 아이콘 */
const ib = (name, tone) => `<span class="ib ${tone}">${ic(name)}</span>`;

/* ---------- 얼굴 있는 날씨 그림 (64×64) ---------- */
const FACE_INK = '#4a3423';
function face(cx, cy, s = 1, sleepy = false) {
  const eye = sleepy
    ? `<path d="M${cx - 6 * s} ${cy - 1 * s}q2.5 2 5 0M${cx + 1 * s} ${cy - 1 * s}q2.5 2 5 0" stroke="${FACE_INK}" stroke-width="${1.6 * s}" fill="none" stroke-linecap="round"/>`
    : `<circle cx="${cx - 4.5 * s}" cy="${cy - 1 * s}" r="${1.8 * s}" fill="${FACE_INK}"/><circle cx="${cx + 4.5 * s}" cy="${cy - 1 * s}" r="${1.8 * s}" fill="${FACE_INK}"/>`;
  return `${eye}<path d="M${cx - 3 * s} ${cy + 3 * s}q${3 * s} ${2.6 * s} ${6 * s} 0" stroke="${FACE_INK}" stroke-width="${1.6 * s}" fill="none" stroke-linecap="round"/>`
    + `<circle cx="${cx - 8 * s}" cy="${cy + 3 * s}" r="${2.4 * s}" fill="#ff9a7a" opacity=".55"/><circle cx="${cx + 8 * s}" cy="${cy + 3 * s}" r="${2.4 * s}" fill="#ff9a7a" opacity=".55"/>`;
}
const CLOUD_D = 'M17 50h31a10 10 0 0 0 1.5-19.9A14 14 0 0 0 22.6 27 11.5 11.5 0 0 0 17 50z';
function sunShape(cx, cy, r) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const t = (a * Math.PI) / 180;
    const x1 = cx + Math.cos(t) * (r + 4), y1 = cy + Math.sin(t) * (r + 4);
    const x2 = cx + Math.cos(t) * (r + 9), y2 = cy + Math.sin(t) * (r + 9);
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  }).join('');
  return `<g stroke="#ffb21f" stroke-width="3.2" stroke-linecap="round">${rays}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffd23f"/>`;
}
function wxArt(kind) {
  let g = '';
  const cloud = (fill = '#fff', stroke = '#bcd3e4') => `<path d="${CLOUD_D}" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>`;
  if (kind === 'sun') g = sunShape(32, 32, 15) + face(32, 33);
  else if (kind === 'moon') g = '<path d="M40 12a20 20 0 1 0 12 30A16 16 0 0 1 40 12z" fill="#ffe58a"/>' + face(31, 36, 0.9, true) + '<circle cx="52" cy="14" r="1.6" fill="#ffe58a"/><circle cx="56" cy="24" r="1.1" fill="#ffe58a"/>';
  else if (kind === 'partly') g = `<g transform="translate(-6 -8) scale(.82)">${sunShape(32, 32, 14)}</g>` + cloud() + face(33, 40, 0.85);
  else if (kind === 'partlyNight') g = '<path d="M26 6a14 14 0 1 0 8 21A11 11 0 0 1 26 6z" fill="#ffe58a"/>' + cloud() + face(33, 40, 0.85, true);
  else if (kind === 'cloud') g = `<path d="M8 36h18a7 7 0 0 0 0-14 9 9 0 0 0-17 3 6 6 0 0 0-1 11z" fill="#e4edf3" stroke="#bcd3e4" stroke-width="2"/>` + cloud() + face(33, 40, 0.85);
  else if (kind === 'rain' || kind === 'shower') {
    g = cloud('#e9f1f8', '#a9c3d8') + face(33, 39, 0.85, kind === 'rain')
      + '<g fill="#3d9be0"><path d="M22 54q-2.4 3.6 0 5.2 2.4-1.6 0-5.2z"/><path d="M33 55q-2.4 3.6 0 5.2 2.4-1.6 0-5.2z"/><path d="M44 54q-2.4 3.6 0 5.2 2.4-1.6 0-5.2z"/></g>';
    if (kind === 'shower') g = `<g transform="translate(-4 -9) scale(.7)">${sunShape(32, 32, 14)}</g>` + g;
  } else if (kind === 'snow' || kind === 'sleet') {
    g = cloud('#f4f8fb', '#b9cbe0') + face(33, 39, 0.85)
      + '<g fill="#8fb6dc"><circle cx="22" cy="57" r="2.6"/><circle cx="33" cy="59" r="2.6"/><circle cx="44" cy="57" r="2.6"/></g>';
    if (kind === 'sleet') g += '<path d="M27.5 54q-2 3 0 4.4 2-1.4 0-4.4z M38.5 54q-2 3 0 4.4 2-1.4 0-4.4z" fill="#3d9be0"/>';
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${g}</svg>`;
}
/** 기상청 값 → 그림 이름 */
function wxKind(h, hour = 12) {
  if (!h) return 'partly';
  const night = hour < 6 || hour >= 19;
  if (h.pty === 1) return 'rain';
  if (h.pty === 2) return 'sleet';
  if (h.pty === 3) return 'snow';
  if (h.pty === 4) return 'shower';
  if (h.sky === 4) return 'cloud';
  if (h.sky === 3) return night ? 'partlyNight' : 'partly';
  return night ? 'moon' : 'sun';
}

/* ---------- 지리산 장면 ---------- */
function timeOfDay(h) { return h < 6 || h >= 19 ? 'night' : h < 9 ? 'morning' : h < 17 ? 'day' : 'evening'; }
function seasonOf(m) { return m >= 3 && m <= 5 ? 'spring' : m <= 8 && m >= 6 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter'; }

function jirisan({ hour = 12, month = 10, uid = 'a', sky = true } = {}) {
  const tod = timeOfDay(hour);
  const season = seasonOf(month);
  const night = tod === 'night';
  const SKY = {
    morning: ['#ffd8b5', '#d6e9f5'], day: ['#a8d8f3', '#e6f4fb'],
    evening: ['#f6b48e', '#cdbbe6'], night: ['#1b2a4d', '#3d5488'],
  }[tod];
  const far = night ? '#4b5f8f' : season === 'winter' ? '#a9bbd6' : '#9ab3d6';
  const far2 = night ? '#3c5080' : '#7f9cc8';
  const mid = night ? '#2c4767' : { spring: '#6aa38a', summer: '#4e9479', autumn: '#7a9a72', winter: '#7e98a8' }[season];
  const near = night ? '#21403a' : { spring: '#8cc58f', summer: '#4f9e68', autumn: '#c99a4e', winter: '#e9f0f3' }[season];
  const crown = { spring: ['#f6b3c8', '#fbd3df'], summer: ['#3f8c5a', '#5aa970'], autumn: ['#ef7f36', '#d9573b'], winter: ['#2f6650', '#ffffff'] }[season];
  const cloudOp = night ? 0.28 : 0.92;

  const sun = night
    ? `<path d="M372 20a18 18 0 1 0 11 27A14.5 14.5 0 0 1 372 20z" fill="#ffe58a"/>${face(364, 41, 0.8, true)}`
    : `<circle cx="366" cy="38" r="${tod === 'day' ? 16 : 18}" fill="${tod === 'evening' ? '#ffb15c' : '#ffd23f'}"/>${face(366, 39, 0.85)}`;
  const stars = night ? [[290, 22], [250, 40], [380, 70], [306, 74], [220, 18], [392, 30], [200, 62]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 1.2 : 1.8}" fill="#fff" opacity=".85"/>`).join('') : '';
  const snowcap = season === 'winter' || month === 3 || month === 11
    ? '<path d="M280 59C288 52 293 51 296 51C301 52 307 55 313 60L307 59L302 63L296 58L290 63L284 59z" fill="#fff" opacity=".95"/>' : '';
  const tree = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-1.6" y="-2" width="3.2" height="9" rx="1.4" fill="${night ? '#1a2f2a' : '#7a5236'}"/><circle cx="0" cy="-8" r="8" fill="${night ? '#1d3a33' : crown[0]}"/><circle cx="-3" cy="-11" r="4" fill="${night ? '#24463d' : crown[1]}" opacity=".9"/></g>`;
  // 가을엔 감나무에 곶감 주황 열매
  const gam = season === 'autumn' && !night
    ? '<g fill="#f2701f"><circle cx="352" cy="173" r="2.3"/><circle cx="358" cy="168" r="2.3"/><circle cx="347" cy="166" r="2.1"/></g>' : '';

  return `<svg class="scene" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="sky${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY[0]}"/><stop offset="1" stop-color="${SKY[1]}"/></linearGradient></defs>
    <rect width="400" height="220" fill="url(#sky${uid})"/>
    ${stars}${sky ? sun : ''}
    <g class="drift slow" fill="#fff" opacity="${night ? 0.35 : 0.9}"><path d="M118 92h34a8 8 0 0 0 0-16 11 11 0 0 0-21-2 7 7 0 0 0-13 7 5.5 5.5 0 0 0 0 11z"/></g>
    <g class="drift" fill="#fff" opacity="${night ? 0.3 : 0.85}"><path d="M218 66h26a6.5 6.5 0 0 0 0-13 9 9 0 0 0-17-1.5 6 6 0 0 0-9 14.5z"/></g>
    <path d="M0 120C22 110 40 104 60 108C78 112 92 100 112 98C132 96 146 106 166 100C186 94 200 84 222 82C246 80 266 66 284 56C292 51 298 51 306 56C318 64 332 78 350 81C368 84 384 80 400 86V220H0z" fill="${far}"/>
    ${snowcap}
    <path d="M0 140C30 128 56 126 80 132C104 138 120 122 146 120C172 118 186 132 212 128C238 124 256 110 280 114C304 118 318 132 344 128C366 124 384 118 400 122V220H0z" fill="${far2}" opacity=".9"/>
    <g opacity="${cloudOp}" fill="#fff">
      <path class="drift slow" d="M-20 160c22-12 44-6 64-8s34-12 60-6 42 10 70 4 50-12 80-4 56 8 78 2 44-4 88 4V184H-20z"/>
      <path d="M0 176c30-6 60 2 92-2s56-10 92-4 62 8 96 2 60-6 80-2 40 4 40 4V196H0z" opacity=".75"/>
    </g>
    <path d="M0 182c40-20 82-22 120-12s70 8 104-6 74-8 108 4 52 10 68 6V220H0z" fill="${mid}"/>
    <g>
      <circle cx="292" cy="188" r="11" fill="${night ? '#141a20' : '#2b2b33'}"/>
      <circle cx="283" cy="179" r="4.6" fill="${night ? '#141a20' : '#2b2b33'}"/><circle cx="301" cy="179" r="4.6" fill="${night ? '#141a20' : '#2b2b33'}"/>
      <ellipse cx="292" cy="192" rx="5" ry="3.8" fill="#cdb593"/><circle cx="292" cy="190.4" r="1.6" fill="#2b2b33"/>
      ${night ? '<path d="M285.5 185.5q1.6 1.4 3.2 0M295.3 185.5q1.6 1.4 3.2 0" stroke="#e8e8f0" stroke-width="1.3" fill="none" stroke-linecap="round"/>' : '<circle cx="287.6" cy="185.6" r="1.5" fill="#fff"/><circle cx="296.4" cy="185.6" r="1.5" fill="#fff"/>'}
    </g>
    <path d="M0 204c50-16 104-16 150-6s92 10 130-2 86-10 120 0V220H0z" fill="${near}"/>
    ${tree(36, 196, 1)}${tree(60, 200, 0.75)}${tree(352, 190, 1.05)}${tree(378, 196, 0.8)}${gam}
    <path d="M0 214c40-6 90-2 130 0s80 2 120-2 100-4 150 2V220H0z" fill="${night ? '#2c5a8a' : '#a9d6f0'}" opacity=".8"/>
  </svg>`;
}
