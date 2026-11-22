/* 양도소득세 페이지 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var T = Object.assign({ sale: '', buy: '', cost: '', share: 50, acq: '', verdict: 'unknown', pre: {}, docs: {}, h: {}, w: {} }, CM.load('tax', {}));
  var saleISO = CM.load('saleDate', '2026-11-20');

  function persist() { CM.save('tax', T); }
  function toNum(v) { var n = Number(String(v || '').replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; }
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  function manwon(n) { return Math.round(n / 10000).toLocaleString('ko-KR') + '만'; }

  /* 기한 */
  function renderDates() {
    var sd = CM.parse(saleISO);
    if (!sd) return;
    var dl = CM.prelimDeadline(sd), inst = CM.installmentDue(dl.due);
    $('due').textContent = CM.fmt(dl.due);
    $('dueS').textContent = dl.raw.getTime() !== dl.due.getTime() ? '원래 ' + CM.fmt(dl.raw) + ' → 주말이라 다음 평일' : '양도일이 속한 달 말일부터 2개월';
    $('inst').textContent = CM.fmt(inst);
  }
  $('saleDate').value = saleISO;
  $('saleDate').addEventListener('change', function () {
    if (CM.parse(this.value)) { saleISO = this.value; CM.save('saleDate', saleISO); renderDates(); calc(); }
  });

  /* 비과세 점검 */
  var pre = [
    '예전 집(이번에 판 집)을 산 날부터 1년 이상 지난 뒤 다른 집을 샀다',
    '다른 집을 산 날부터 3년 안에 예전 집을 팔았다',
    '판 집을 2년 이상 보유했다 (살 당시 조정대상지역이었다면 2년 이상 거주도)'
  ];
  (function () {
    var box = $('preChecks');
    pre.forEach(function (t, i) {
      var lab = document.createElement('label'); lab.className = 'check' + (T.pre[i] ? ' done' : '');
      var inp = document.createElement('input'); inp.type = 'checkbox'; inp.id = 'pre' + i; inp.checked = !!T.pre[i];
      inp.addEventListener('change', function () { T.pre[i] = inp.checked; persist(); lab.classList.toggle('done', inp.checked); });
      var sp = document.createElement('span'); sp.className = 'what'; sp.textContent = t;
      lab.appendChild(inp); lab.appendChild(sp); box.appendChild(lab);
    });
  })();
  var MSG = {
    unknown: ['info', '아직 확인 전입니다. 판단이 나기 전까지는 1억 원을 세금용으로 그대로 두세요.'],
    taxable: ['warn', '과세 대상입니다. 아래 계산기로 1인 세액을 확인하고 기한 안에 부부 각자 신고·납부하세요.'],
    exempt: ['ok', '비과세 대상이면 예정신고 의무가 없고 세금도 0원입니다. 1월용 1억 원은 장기예금으로 옮기는 것을 검토하세요. 판단이 애매하면 126에 한 번 더 확인하세요.'],
    review: ['info', '확인 중입니다. 결과가 나오기 전까지 1억 원은 단기예금에 그대로 둡니다.']
  };
  $('verdict').value = T.verdict;
  function renderVerdict() {
    var m = MSG[T.verdict] || MSG.unknown;
    $('verdictMsg').className = 'callout ' + m[0];
    $('verdictMsg').innerHTML = '<p class="small">' + m[1] + '</p>';
  }
  $('verdict').addEventListener('change', function () { T.verdict = this.value; persist(); renderVerdict(); calc(); });

  /* 세액 계산 */
  var BR = [[14e6, .06, 0], [50e6, .15, 1.26e6], [88e6, .24, 5.76e6], [150e6, .35, 15.44e6], [300e6, .38, 19.94e6], [500e6, .40, 25.94e6], [1e9, .42, 35.94e6], [Infinity, .45, 65.94e6]];
  function heldYears(a, b) {
    if (!a || !b) return null;
    var y = b.getFullYear() - a.getFullYear();
    var anniv = new Date(a.getFullYear() + y, a.getMonth(), a.getDate());
    if (anniv > b) y--;
    return y;
  }
  function person(shareRatio) {
    var sale = toNum(T.sale) * shareRatio, buy = toNum(T.buy) * shareRatio, cost = toNum(T.cost) * shareRatio;
    var gain = Math.max(0, sale - buy - cost);
    var yrs = heldYears(CM.parse(T.acq), CM.parse(saleISO));
    var ltRate = yrs === null || yrs < 3 ? 0 : Math.min(0.30, yrs * 0.02);
    var lt = gain * ltRate, income = gain - lt, base = Math.max(0, income - 2.5e6);
    var tax, label;
    if (yrs !== null && yrs < 1) { tax = base * 0.70; label = '단일 70% (1년 미만)'; }
    else if (yrs !== null && yrs < 2) { tax = base * 0.60; label = '단일 60% (2년 미만)'; }
    else {
      var b = BR.filter(function (x) { return base <= x[0]; })[0];
      tax = Math.max(0, base * b[1] - b[2]); label = (b[1] * 100) + '% 구간 (누진공제 ' + manwon(b[2]) + ')';
    }
    var local = tax * 0.1;
    var instMax = tax > 2e7 ? tax * 0.5 : (tax > 1e7 ? tax - 1e7 : 0);
    return { sale: sale, buy: buy, cost: cost, gain: gain, yrs: yrs, ltRate: ltRate, lt: lt, income: income, base: base, tax: tax, label: label, local: local, total: tax + local, instMax: instMax };
  }
  function calc() {
    var sh = Math.max(0, Math.min(100, +T.share || 0)) / 100;
    var H = person(sh), W = person(1 - sh), has = toNum(T.sale) > 0 && toNum(T.buy) > 0;
    var exempt = T.verdict === 'exempt';
    var rows = [
      ['지분', (sh * 100).toFixed(0) + '%', ((1 - sh) * 100).toFixed(0) + '%'],
      ['양도가액', won(H.sale), won(W.sale)],
      ['취득가액', won(H.buy), won(W.buy)],
      ['필요경비', won(H.cost), won(W.cost)],
      ['양도차익', won(H.gain), won(W.gain)],
      ['보유기간 · 장기보유특별공제', H.yrs === null ? '취득일 입력' : H.yrs + '년 · ' + Math.round(H.ltRate * 100) + '%', W.yrs === null ? '취득일 입력' : W.yrs + '년 · ' + Math.round(W.ltRate * 100) + '%'],
      ['장기보유특별공제액', won(H.lt), won(W.lt)],
      ['과세표준 (기본공제 250만 차감)', won(H.base), won(W.base)],
      ['적용 세율', H.label, W.label],
      ['양도소득세 (국세)', won(H.tax), won(W.tax)],
      ['지방소득세 (10%)', won(H.local), won(W.local)],
      ['납부 합계', '<b>' + won(H.total) + '</b>', '<b>' + won(W.total) + '</b>'],
      ['분납 가능액 (국세, 최대)', won(H.instMax), won(W.instMax)]
    ];
    $('taxRows').innerHTML = rows.map(function (r, i) {
      return '<tr' + (i === 11 ? ' class="total"' : '') + '><td>' + r[0] + '</td><td class="r">' + r[1] + '</td><td class="r">' + r[2] + '</td></tr>';
    }).join('');

    var couple = exempt ? 0 : H.total + W.total;
    if (!has && !exempt) {
      $('tCouple').textContent = '–'; $('tCoupleS').textContent = '아래 계산기에 금액 입력';
      $('vsPrep').className = 'callout info'; $('vsPrep').innerHTML = '<p class="small">양도가액과 취득가액을 넣으면, 준비한 1억 원과 비교해 드립니다.</p>';
      return;
    }
    $('tCouple').textContent = exempt ? '0원' : manwon(couple);
    $('tCoupleS').textContent = exempt ? '비과세로 표시됨' : '남편 ' + manwon(H.total) + ' + 아내 ' + manwon(W.total);
    var gap = 1e8 - couple;
    $('vsPrep').className = 'callout ' + (exempt ? 'ok' : (gap >= 0 ? 'ok' : 'bad'));
    $('vsPrep').innerHTML = exempt
      ? '<b class="t">비과세면 1억 원 전액이 남습니다</b><p class="small">단기예금 만기(1/28) 후 장기예금으로 옮기는 것을 검토하세요.</p>'
      : (gap >= 0
        ? '<b class="t">준비한 1억 원으로 충분합니다 (부부 합계 ' + manwon(gap) + ' 여유)</b><p class="small">분납을 쓰면 1월에는 최대 ' + manwon(couple - H.instMax - W.instMax) + ' 원만 내고, 나머지는 2개월 뒤에 냅니다.</p>'
        : '<b class="t">준비한 1억 원보다 ' + manwon(-gap) + ' 부족합니다</b><p class="small">분납(최대 ' + manwon(H.instMax + W.instMax) + ')을 쓰거나, 장기예금이 아닌 파킹통장에서 부족분을 준비하세요.</p>');
    CM.save('taxEstimate', { couple: couple, at: CM.iso(CM.today()) });
  }
  function money(el, key) {
    el.value = T[key] ? toNum(T[key]).toLocaleString('ko-KR') : '';
    el.addEventListener('input', function () { T[key] = String(toNum(el.value)); persist(); calc(); });
    el.addEventListener('blur', function () { el.value = toNum(el.value) ? toNum(el.value).toLocaleString('ko-KR') : ''; });
  }
  money($('sale'), 'sale'); money($('buy'), 'buy'); money($('cost'), 'cost');
  $('share').value = T.share;
  $('share').addEventListener('change', function () { var v = +this.value; if (v >= 0 && v <= 100) { T.share = v; persist(); calc(); } else { this.value = T.share; } });
  $('acq').value = T.acq;
  $('acq').addEventListener('change', function () { T.acq = this.value; persist(); calc(); });

  $('copyTax').addEventListener('click', function () {
    var sh = (+T.share || 0) / 100, H = person(sh);
    CM.copy(['양도소득세 1인 입력 검산 (지분 ' + (sh * 100) + '%)', '양도가액 ' + won(H.sale), '취득가액 ' + won(H.buy), '필요경비 ' + won(H.cost),
      '양도차익 ' + won(H.gain), '장기보유특별공제 ' + Math.round(H.ltRate * 100) + '% ' + won(H.lt), '과세표준 ' + won(H.base),
      '국세 ' + won(H.tax) + ' + 지방세 ' + won(H.local) + ' = ' + won(H.total), '※ 참고 추정치, 홈택스 금액이 기준'].join('\n'));
  });
  var armed = false;
  $('clearTax').addEventListener('click', function () {
    var b = this;
    if (!armed) { armed = true; b.textContent = '한 번 더 누르면 지웁니다'; setTimeout(function () { armed = false; b.textContent = '입력 지우기'; }, 3000); return; }
    T.sale = T.buy = T.cost = T.acq = ''; T.share = 50; persist();
    ['sale', 'buy', 'cost', 'acq'].forEach(function (k) { $(k).value = ''; }); $('share').value = 50;
    CM.save('taxEstimate', null); armed = false; b.textContent = '입력 지우기'; calc(); CM.toast('지웠습니다');
  });

  /* 서류 */
  var docs = ['살 때 매매계약서', '팔 때 매매계약서', '취득세 납부내역 (위택스)', '살 때 중개보수 영수증', '팔 때 중개보수 영수증', '법무사 비용 영수증 (해당 시)', '확장·샷시 공사계약서와 이체내역 (해당 시)', '등기사항전부증명서 (지분·취득일 확인)'];
  (function () {
    var box = $('docChecks');
    docs.forEach(function (t, i) {
      var lab = document.createElement('label'); lab.className = 'check' + (T.docs[i] ? ' done' : '');
      var inp = document.createElement('input'); inp.type = 'checkbox'; inp.id = 'doc' + i; inp.checked = !!T.docs[i];
      inp.addEventListener('change', function () { T.docs[i] = inp.checked; persist(); lab.classList.toggle('done', inp.checked); });
      var sp = document.createElement('span'); sp.className = 'what'; sp.textContent = t;
      lab.appendChild(inp); lab.appendChild(sp); box.appendChild(lab);
    });
  })();

  /* 부부 진행표 */
  var tasks = ['본인 명의로 홈택스 로그인', '양도소득세 예정신고 제출 (접수번호 확인)', '신고 접수증 저장', '계약서·경비 증빙 첨부 완료', '국세 납부 → 납부확인서 저장', '위택스 지방소득세 신고 (신고이동)', '지방소득세 납부 → 납부확인서 저장', '분납했다면 2차 납부일을 달력에 등록'];
  var who = 'h';
  function renderPeople() {
    $('pH').setAttribute('aria-pressed', who === 'h' ? 'true' : 'false');
    $('pW').setAttribute('aria-pressed', who === 'w' ? 'true' : 'false');
    var st = T[who], box = $('personChecks'), done = 0;
    box.innerHTML = '';
    tasks.forEach(function (t, i) {
      var lab = document.createElement('label'); lab.className = 'check' + (st[i] ? ' done' : '');
      var inp = document.createElement('input'); inp.type = 'checkbox'; inp.id = 'pc' + i; inp.checked = !!st[i];
      inp.addEventListener('change', function () { st[i] = inp.checked; persist(); renderPeople(); });
      var sp = document.createElement('span'); sp.className = 'what'; sp.textContent = t;
      lab.appendChild(inp); lab.appendChild(sp); box.appendChild(lab);
      if (st[i]) done++;
    });
    var count = function (o) { return tasks.filter(function (_, i) { return o[i]; }).length; };
    $('pBar').style.width = (done / tasks.length * 100) + '%';
    $('pText').textContent = (who === 'h' ? '남편 ' : '아내 ') + done + ' / ' + tasks.length + ' · (남편 ' + count(T.h) + ', 아내 ' + count(T.w) + ')';
    $('allDone').hidden = !(count(T.h) === tasks.length && count(T.w) === tasks.length);
  }
  $('pH').addEventListener('click', function () { who = 'h'; renderPeople(); });
  $('pW').addEventListener('click', function () { who = 'w'; renderPeople(); });

  renderDates(); renderVerdict(); calc(); renderPeople();
})();
