/* 양도소득세 페이지 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var T = Object.assign({ sale: '', buy: '', cost: '', share: 50, acq: '', verdict: 'unknown', pre: {}, docs: {}, h: {}, w: {}, expenses: {} }, CM.load('tax', {}));
  if (!T.expenses || typeof T.expenses !== 'object') T.expenses = {};
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
  $('verdict').addEventListener('change', function () { T.verdict = this.value; persist(); var ax=CM.load('taxActual',{}); ax.confirmed=false; ax.verdict=T.verdict; CM.save('taxActual',ax); renderActual(); renderVerdict(); calc(); });

  /* 사용자가 제공한 취득·매도 비용 (금액은 원, 체크 시에만 자동 포함).
     과거 기타 필요경비 필드와 분리해 중복 합산 방지. */
  var EXPENSES = [
    {id:'acqTax',name:'취득세',amount:14794450,grade:'증빙 시 인정 가능성 높음',desc:'2020년 주택 취득 당시 납부한 취득세. 위택스 납부내역 확인',evidence:'취득세 납부확인서 · 위택스',tip:'취득가액에 이미 포함했거나 홈택스 자동 반영된 경우 중복 불가'},
    {id:'agent',name:'매수·매도 중개보수 합계',amount:5000000,grade:'증빙 시 인정 가능성 높음',desc:'살 때와 팔 때 합쳐 지급한 500만 원. 양쪽 영수증을 나누어 보관',evidence:'현금영수증 · 계좌이체내역 · 중개보수 영수증',tip:'다른 신고 항목에 각각 입력했다면 이 체크는 해제'},
    {id:'radon',name:'라돈 검출에 따른 의무 보수',amount:1300000,grade:'개별 검토 · 기본 제외',desc:'라돈 검출로 보수가 필요하다는 안내를 받고 실제로 시공한 130만 원. 의무적으로 보수했더라도 일반 하자수리라면 필요경비가 아닐 수 있습니다. 환기설비 신설 등 자본적 개량인지 공사내역 확인',evidence:'라돈 검사결과 · 보수 요청/안내 문서 · 공사 세부내역 · 결제증빙 · 전후 사진',tip:'라돈 검출 사실이나 의무 보수 지시만으로 자동 공제되는 것은 아님'},
    {id:'aircon',name:'천장 매립형 시스템에어컨 설치',amount:5700000,grade:'인정 검토 우선 · 증빙 필요',desc:'아파트 천장에 고정 설치한 냉난방설비 570만 원. 일반 이동형 가전과 달리 건물의 이용편의·가치 증대를 위한 자본적 지출로 볼 근거가 있습니다. 설치 공사비와 기기 대금의 구분, 매각 시 설비 존치 여부 확인',evidence:'천장형 설치 계약서 · 기기/설치공사 세부내역 · 카드/계좌이체 증빙 · 설치 사진 · 매매 시 존치 확인',tip:'고정 설치되었다는 사실만으로 전액 자동 인정은 아닙니다. 설비의 자본적 지출 해당 여부 확인'}
  ];
  function expenseValue(e) { var v=T.expenses[e.id]; return v && isFinite(+v.amount) && +v.amount>=0 ? +v.amount : e.amount; }
  function expenseSelected(e) { var v=T.expenses[e.id]; return !!(v && v.selected === true); }
  function chosenExpenseTotal() { return EXPENSES.reduce(function(sum,e){ return sum+(expenseSelected(e)?expenseValue(e):0); },0); }
  function fullCost() { return toNum(T.cost)+chosenExpenseTotal(); }
  function renderExpenses(){
    $('expenseRows').innerHTML=EXPENSES.map(function(e){
      var checked=expenseSelected(e),money=expenseValue(e);
      return '<div class="expense-item'+(checked?' selected':'')+'"><label class="expense-main"><input type="checkbox" data-excheck="'+e.id+'" '+(checked?'checked':'')+'><span class="expense-details"><strong>'+e.name+'</strong><small>'+e.grade+'</small></span></label>'+
        '<label class="expense-amount">금액(원)<input type="text" inputmode="numeric" data-exmoney="'+e.id+'" value="'+Math.round(money).toLocaleString('ko-KR')+'" aria-label="'+e.name+' 금액"></label>'+
        '<p class="small">'+e.desc+'</p><p class="tiny muted"><b>챙길 증빙:</b> '+e.evidence+'</p><p class="tiny muted"><b>주의:</b> '+e.tip+'</p></div>';
    }).join('');
    var sh=Math.max(0,Math.min(100,+T.share||0))/100, total=fullCost();
    $('chosenExpenses').textContent=won(chosenExpenseTotal());
    $('otherExpenses').textContent=won(toNum(T.cost));
    $('allExpenses').textContent=won(total);
    $('expensePerson').textContent='지분 기준 남편 '+won(total*sh)+' · 아내 '+won(total*(1-sh))+' (양도차익 계산에 반영)';
    document.querySelectorAll('[data-excheck]').forEach(function(el){el.addEventListener('change',function(){
      var id=this.getAttribute('data-excheck'), e=EXPENSES.filter(function(x){return x.id===id;})[0];
      T.expenses[id]={selected:this.checked,amount:expenseValue(e)};persist();renderExpenses();calc();
    });});
    document.querySelectorAll('[data-exmoney]').forEach(function(el){el.addEventListener('change',function(){
      var id=this.getAttribute('data-exmoney'),e=EXPENSES.filter(function(x){return x.id===id;})[0],a=toNum(this.value);
      T.expenses[id]={selected:expenseSelected(e),amount:a};persist();renderExpenses();calc();
    });});
  }

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
    var sale = toNum(T.sale) * shareRatio, buy = toNum(T.buy) * shareRatio, cost = fullCost() * shareRatio;
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
      CM.save('taxEstimate', {valid:false, at:CM.iso(CM.today())});
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
    CM.save('taxEstimate', { valid: has && T.verdict === 'taxable' && !!T.acq, couple: couple, husband:H.total, wife:W.total, at: CM.iso(CM.today()) });
  }
  function money(el, key) {
    el.value = T[key] ? toNum(T[key]).toLocaleString('ko-KR') : '';
    el.addEventListener('input', function () { T[key] = String(toNum(el.value)); persist(); calc(); });
    el.addEventListener('blur', function () { el.value = toNum(el.value) ? toNum(el.value).toLocaleString('ko-KR') : ''; });
  }
  money($('sale'), 'sale'); money($('buy'), 'buy'); money($('cost'), 'cost');
  $('cost').addEventListener('input', renderExpenses);
  $('share').value = T.share;
  $('share').addEventListener('change', function () { var v = +this.value; if (v >= 0 && v <= 100) { T.share = v; persist(); renderExpenses(); calc(); } else { this.value = T.share; } });
  $('acq').value = T.acq;
  $('acq').addEventListener('change', function () { T.acq = this.value; persist(); calc(); });

  $('copyTax').addEventListener('click', function () {
    var sh = (+T.share || 0) / 100, H = person(sh);
    CM.copy(['양도소득세 1인 입력 검산 (지분 ' + (sh * 100) + '%)', '양도가액 ' + won(H.sale), '취득가액 ' + won(H.buy), '필요경비 ' + won(H.cost),
      '선택 비용 '+won(chosenExpenseTotal()), '기타 비용 '+won(toNum(T.cost)), '양도차익 ' + won(H.gain), '장기보유특별공제 ' + Math.round(H.ltRate * 100) + '% ' + won(H.lt), '과세표준 ' + won(H.base),
      '국세 ' + won(H.tax) + ' + 지방세 ' + won(H.local) + ' = ' + won(H.total), '※ 참고 추정치, 홈택스 금액이 기준'].join('\n'));
  });
  var armed = false;
  $('clearTax').addEventListener('click', function () {
    var b = this;
    if (!armed) { armed = true; b.textContent = '한 번 더 누르면 지웁니다'; setTimeout(function () { armed = false; b.textContent = '입력 지우기'; }, 3000); return; }
    T.sale = T.buy = T.cost = T.acq = ''; T.share = 50; T.expenses = {}; persist(); renderExpenses();
    ['sale', 'buy', 'cost', 'acq'].forEach(function (k) { $(k).value = ''; }); $('share').value = 50;
    CM.save('taxEstimate', null); armed = false; b.textContent = '입력 지우기'; calc(); CM.toast('지웠습니다');
  });

  /* 서류 */
  var docs = ['살 때 매매계약서', '팔 때 매매계약서', '취득세 납부내역 (위택스)', '살 때 중개보수 영수증', '팔 때 중개보수 영수증', '법무사 비용 영수증 (해당 시)', '라돈 검사 및 수리 공사 내역·결제증빙', '에어컨 종류·설치내역·결제증빙', '확장·샷시 공사계약서와 이체내역 (해당 시)', '등기사항전부증명서 (지분·취득일 확인)'];
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

  /* 확정 납부액을 예금 화면에 동기화. 입력 변경 시 확정 체크 자동 해제 */
  var actualKeys = [['actualHN','hNational'],['actualHL','hLocal'],['actualWN','wNational'],['actualWL','wLocal']];
  var A = Object.assign({confirmed:false, verdict:T.verdict, hNational:null,hLocal:null,wNational:null,wLocal:null},CM.load('taxActual',{}));
  function realNum(v){return Number(String(v||'').replace(/[^0-9]/g,''))||0;}
  function realReady(){return actualKeys.every(function(x){return A[x[1]]!==null && A[x[1]]!==undefined && String(A[x[1]])!=='';});}
  function renderActual(){
    $('actualConfirmed').checked=!!A.confirmed;
    var b=CM.taxBridge(), status=$('actualStatus');
    if(A.confirmed && b.mode==='actual'){
      status.className='callout '+(b.couple>100000000?'warn':'ok');
      status.innerHTML='<b class="t">연계 완료 · 부부 합계 '+won(b.couple)+'</b><p class="small">남편 '+won(b.husband)+' · 아내 '+won(b.wife)+' · 준비된 1억 원과 차이 '+won(Math.abs(100000000-b.couple))+' ('+(b.couple>100000000?'부족':'여유')+'). 예금 화면에서 부부별 부족분도 확인하세요.</p>';
    }else{
      status.className='callout info';
      status.innerHTML='<b class="t">확정 대기 · 기존 단기예금 1억 원 유지</b><p class="small">확정 체크 전까지는 예금 화면에 참고 추정액만 표시되며, 단기예금 원금이나 배분이 자동 변경되지 않습니다.</p>';
    }
  }
  actualKeys.forEach(function(pair){
    var el=$(pair[0]), key=pair[1];el.value=A[key]===null||A[key]===undefined?'':Number(A[key]).toLocaleString('ko-KR');
    el.addEventListener('input',function(){A[key]=this.value.trim()===''?null:realNum(this.value);A.confirmed=false;CM.save('taxActual',A);renderActual();});
    el.addEventListener('blur',function(){this.value=A[key]===null?'':Number(A[key]).toLocaleString('ko-KR');});
  });
  $('actualConfirmed').addEventListener('change',function(){
    if(this.checked && !(realReady() || T.verdict==='exempt')){this.checked=false;CM.toast('부부 국세·지방세 4개 금액을 모두 입력해주세요 (0원 포함)');return;}
    if(this.checked && T.verdict!=='taxable' && T.verdict!=='exempt'){this.checked=false;CM.toast('위에서 과세 대상 또는 비과세 확정 상태를 선택해주세요');return;}
    A.confirmed=this.checked;A.verdict=T.verdict;CM.save('taxActual',A);renderActual();
  });
  $('clearActual').addEventListener('click',function(){
    if(!window.confirm('실제 납부액 4개와 확정 상태를 지울까요?'))return;
    actualKeys.forEach(function(pair){A[pair[1]]=null;$(pair[0]).value='';});A.confirmed=false;CM.save('taxActual',A);renderActual();
  });

  renderDates(); renderVerdict(); renderExpenses(); calc(); renderPeople(); renderActual();
})();

