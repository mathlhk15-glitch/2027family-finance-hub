/* 공통 도우미: 이 기기 저장, 알림, 복사, 날짜 계산 */
(function () {
  'use strict';
  var PREFIX = 'couple-money-v4:';

  function load(key, fallback) {
    try {
      var v = localStorage.getItem(PREFIX + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* 저장 불가 환경 */ }
  }
  function clearAll() {
    try {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k); });
    } catch (e) {}
  }

  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  function copy(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('복사했습니다'); } catch (e) { toast('복사하지 못했습니다'); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('복사했습니다'); }, fallback);
    } else { fallback(); }
  }

  /* 날짜: 'YYYY-MM-DD' ↔ 로컬 Date */
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function fmt(d) {
    var w = '일월화수목금토'[d.getDay()];
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.(' + w + ')';
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function nextWeekday(d) {
    var x = new Date(d);
    while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
    return x;
  }
  /* 양도소득세 예정신고 기한: 양도일이 속한 달의 말일부터 2개월 → 그 달 말일, 주말이면 다음 평일 (공휴일은 직접 확인) */
  function prelimDeadline(saleDate) {
    var end = new Date(saleDate.getFullYear(), saleDate.getMonth() + 3, 0);
    return { raw: end, due: nextWeekday(end) };
  }
  /* 분납 기한: 납부기한 경과 후 2개월 */
  function installmentDue(due) {
    var x = new Date(due.getFullYear(), due.getMonth() + 2, due.getDate());
    return nextWeekday(x);
  }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }

  /* 양도세 -> 예금 연결: 같은 origin(GitHub Pages)에서만 기기별 공유 */
  function taxBridge() {
    var actual = load('taxActual', null);
    var est = load('taxEstimate', null);
    var tax = load('tax', {});
    var fmtNum = function(x) { var n = Number(x); return Number.isFinite(n) && n >= 0 ? n : 0; };
    var mode = 'none', husband = 0, wife = 0, message = '';
    if (actual && actual.confirmed === true && ['taxable','exempt'].indexOf(actual.verdict) >= 0) {
      mode = 'actual';
      husband = actual.verdict === 'exempt' ? 0 : fmtNum(actual.hNational) + fmtNum(actual.hLocal);
      wife = actual.verdict === 'exempt' ? 0 : fmtNum(actual.wNational) + fmtNum(actual.wLocal);
      message = actual.verdict === 'exempt' ? '비과세 최종 확인 입력' : '사용자가 입력한 국세·지방세 납부액';
    } else if (est && est.valid === true && tax && tax.verdict === 'taxable') {
      mode = 'estimate'; husband = fmtNum(est.husband); wife = fmtNum(est.wife);
      message = '참고 추정액: 실제 신고 납부액이 아닙니다';
    }
    return { mode:mode, husband:husband, wife:wife, couple:husband+wife,
      preparedH:50000000, preparedW:50000000, prepared:100000000, message:message };
  }
  window.CM = { load: load, save: save, clearAll: clearAll, toast: toast, copy: copy,
    parse: parse, fmt: fmt, iso: iso, prelimDeadline: prelimDeadline, installmentDue: installmentDue,
    daysBetween: daysBetween, today: today, taxBridge: taxBridge };
})();
