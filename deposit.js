/* 예금 운용 계산기 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var RATE_KEYS = ['rFav', 'rGen', 'rJb', 'rKb', 'rRe', 'rEx', 'rShort'];
  var DEF = { scen: 'A', rFav: 4.05, rGen: 4.05, rJb: 3.98, rKb: 3.91, rRe: 3.91, rEx: 3.60, rShort: 2.80,
    tax: '0.059', start: '2026-11-25', mat: '2027-01-28', bal: {} };
  var S = Object.assign({}, DEF, CM.load('deposit', {}));
  S.bal = S.bal || {};
  RATE_KEYS.forEach(function (k) { if (!isFinite(+S[k])) S[k] = DEF[k]; });
  if (['A', 'B', 'C'].indexOf(S.scen) < 0) S.scen = 'A';
  var GEN = 0.154;
  var SHORT_BANK = { hk: '경남은행', is: '농협' };
  var EX_BANK = { hk: '경남은행', is: '국민은행' };
  var EX_PROD = { hk: 'The파트너예금 · 12개월', is: 'KB Star 정기예금 · 12개월' };
  var NAME = { A: 'A안 신협 9,500만', B: 'B안 전북 9,500만', C: 'C안 케이뱅크 선이자' };

  function plan(scen, who) {
    var fav = { grp: '신협', name: '창원늘푸른신협', prod: '세금우대 예탁금 · 12개월', p: 3000, rate: 'rFav', kind: 'fav', isNew: true };
    var ex = { grp: EX_BANK[who], name: EX_BANK[who], prod: EX_PROD[who], p: 3750, rate: 'rEx', kind: 'long', isNew: false };
    var sh = { grp: SHORT_BANK[who], name: SHORT_BANK[who], prod: '단기 정기예금 · 만기 ' + S.mat.slice(5).replace('-', '/'), p: 5000, rate: 'rShort', kind: 'short', isNew: false };
    if (scen === 'A') return [fav,
      { grp: '신협', name: '창원늘푸른신협', prod: '일반 예탁금 · 12개월', p: 6500, rate: 'rGen', kind: 'long', isNew: true },
      { grp: '전북은행', name: '전북은행', prod: 'JB 다이렉트 예금 · 12개월', p: 6750, rate: 'rJb', kind: 'long', isNew: true }, sh];
    if (scen === 'B') return [fav,
      { grp: '전북은행', name: '전북은행', prod: 'JB 다이렉트 예금 · 12개월', p: 9500, rate: 'rJb', kind: 'long', isNew: true }, ex, sh];
    return [fav,
      { grp: '케이뱅크', name: '케이뱅크', prod: '내맘대로 이자받는 정기예금 · 12개월 · 선이자 재예치', p: 9500, rate: 'rKb', kind: 'pre', isNew: true }, ex, sh];
  }
  function days() {
    var a = CM.parse(S.start), b = CM.parse(S.mat);
    return a && b ? Math.max(0, CM.daysBetween(a, b)) : 0;
  }
  function calc(scen, who) {
    var tax = parseFloat(S.tax), d = days(), out = { items: [], longNet: 0, shortNet: 0, groups: {} };
    plan(scen, who).forEach(function (x) {
      var r = +S[x.rate] || 0, gross, net;
      if (x.kind === 'short') { gross = x.p * r / 100 * d / 365; net = gross * (1 - GEN); }
      else if (x.kind === 'fav') { gross = x.p * r / 100; net = gross * (1 - tax); }
      else if (x.kind === 'pre') {
        gross = x.p * r / 100;
        var re = gross * (1 - GEN) * (+S.rRe || 0) / 100; // 먼저 받은 세후 이자를 12개월 재예치
        net = gross * (1 - GEN) + re * (1 - GEN);
        gross = gross + re;
      } else { gross = x.p * r / 100; net = gross * (1 - GEN); }
      if (x.kind === 'short') out.shortNet += net; else out.longNet += net;
      out.groups[x.grp] = (out.groups[x.grp] || 0) + x.p + gross;
      out.items.push(Object.assign({ r: r, gross: gross, net: net }, x));
    });
    return out;
  }
  function man(v, dec) {
    var n = dec ? Math.round(v * 10) / 10 : Math.round(v);
    return n.toLocaleString('ko-KR', { minimumFractionDigits: dec ? 1 : 0, maximumFractionDigits: dec ? 1 : 0 }) + '만';
  }

  function renderPerson(who, res) {
    var rows = '';
    res.items.forEach(function (x) {
      rows += '<tr><td><b>' + x.name + '</b> ' + (x.isNew ? '<span class="pill info">새로 개설</span>' : '<span class="pill ok">기존</span>') +
        '<span class="sub">' + x.prod + ' · 연 ' + x.r.toFixed(2) + '%' + (x.kind === 'fav' ? ' · 세율 ' + (parseFloat(S.tax) * 100).toFixed(1) + '%' : '') + '</span></td>' +
        '<td class="r">' + man(x.p) + '</td><td class="r">' + man(x.net, 1) + '</td></tr>';
    });
    rows += '<tr class="total"><td>장기 12개월 합계</td><td class="r">1억 6,250만</td><td class="r">' + man(res.longNet, 1) + '</td></tr>';
    $('tb-' + who).innerHTML = rows;

    var box = $('prot-' + who), html = '', w = { ok: true, max: 0 };
    Object.keys(res.groups).forEach(function (g) {
      var key = who + ':' + g, b = +S.bal[key] || 0, tot = res.groups[g] + b, room = 10000 - tot;
      var cls = room < 0 ? 'bad' : (room < 200 ? 'warn' : 'ok');
      if (room < 0) w.ok = false;
      w.max = Math.max(w.max, tot);
      var id = 'b-' + who + '-' + Object.keys(res.groups).indexOf(g);
      html += '<div class="prot-row"><label for="' + id + '"><b>' + g + '</b> <span class="tiny muted">기존</span> ' +
        '<input type="number" id="' + id + '" data-bal="' + key + '" value="' + b + '" min="0" step="10" style="width:84px" aria-label="' + g + ' 기존 잔액(만원)"></label>' +
        '<span class="bar"><i class="' + (cls === 'ok' ? '' : cls) + '" style="width:' + Math.min(100, tot / 100) + '%"></i></span>' +
        '<span class="pill ' + cls + '">' + man(tot) + (room < 0 ? ' · 초과' : '') + '</span></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('[data-bal]').forEach(function (el) {
      el.addEventListener('change', function () { S.bal[el.dataset.bal] = Math.max(0, +el.value || 0); persist(); render(); });
    });
    return w;
  }

  function renderTaxLink(){
    var b=CM.taxBridge(), label=function(n){return Math.round(n).toLocaleString('ko-KR')+'원';};
    $('linkMode').textContent=b.mode==='actual'?'확정 입력':(b.mode==='estimate'?'참고 추정':'미입력');
    $('linkSource').textContent=b.message||'양도세 페이지에서 입력하세요';
    if(b.mode==='none'){
      $('linkTotal').textContent='–';$('linkGap').textContent='–';$('linkGapS').textContent='부부 각 5,000만 원 유지';
      $('linkRows').innerHTML='<tr><td>현재 단기 준비금</td><td class="r">5,000만</td><td class="r">5,000만</td><td class="r">1억</td></tr>';
      $('linkAdvice').className='callout info';$('linkAdvice').innerHTML='<b class="t">양도세 입력을 기다리는 중입니다.</b><p class="small">예금 계획의 단기자금 1억 원은 변경하지 않습니다.</p>';return;
    }
    var gap=b.prepared-b.couple;
    $('linkTotal').textContent=label(b.couple);$('linkGap').textContent=(gap>=0?'+':'−')+label(Math.abs(gap));
    $('linkGapS').textContent=gap>=0?'준비금 여유':'추가 확보가 필요한 금액';
    var row=function(title,h,w){return '<tr><td>'+title+'</td><td class="r">'+label(h)+'</td><td class="r">'+label(w)+'</td><td class="r">'+label(h+w)+'</td></tr>';};
    $('linkRows').innerHTML=row('현재 단기예금',b.preparedH,b.preparedW)+row('세금 '+(b.mode==='actual'?'확정 입력액':'참고 추정액'),b.husband,b.wife)+row('남는 금액(양수) / 부족분(음수)',b.preparedH-b.husband,b.preparedW-b.wife);
    var detail='남편 '+(b.husband>b.preparedH?label(b.husband-b.preparedH)+' 추가 필요':label(b.preparedH-b.husband)+' 여유')+' · 아내 '+(b.wife>b.preparedW?label(b.wife-b.preparedW)+' 추가 필요':label(b.preparedW-b.wife)+' 여유');
    $('linkAdvice').className='callout '+(b.mode==='estimate'?'info':(gap<0||b.husband>b.preparedH||b.wife>b.preparedW?'warn':'ok'));
    $('linkAdvice').innerHTML='<b class="t">'+(b.mode==='estimate'?'참고값입니다. 1억 원을 그대로 유지하세요.':(gap<0?'납부자금 부족: 자금 추가 확보 필요':'납부자금 점검 완료'))+'</b><p class="small">'+detail+'. '+(b.mode==='actual'?'남는 돈은 납부 완료 후 재예치 여부를 검토하세요.':'실제 국세·지방세 입력 후 확정 체크를 해야 예금 의사결정에 이용할 수 있습니다.')+'</p>';
  }
  function render() {
    renderTaxLink();
    ['A', 'B', 'C'].forEach(function (s) { $('sc' + s).setAttribute('aria-pressed', S.scen === s ? 'true' : 'false'); });
    $('days').textContent = days() + '일';
    var R = {};
    ['A', 'B', 'C'].forEach(function (s) { R[s] = { hk: calc(s, 'hk'), is: calc(s, 'is') }; R[s].long = R[s].hk.longNet + R[s].is.longNet; });
    var cur = R[S.scen];
    var w1 = renderPerson('hk', cur.hk), w2 = renderPerson('is', cur.is);
    var shortC = cur.hk.shortNet + cur.is.shortNet;

    $('tLong').textContent = man(cur.long, 1);
    $('tLongS').textContent = NAME[S.scen] + ' · 시중은행 3.6% 일괄(989.8만) 대비 ' + (cur.long - 989.8 >= 0 ? '+' : '') + man(cur.long - 989.8, 1);
    $('tShort').textContent = man(shortC, 1);
    $('tShortS').textContent = '1억 원 · ' + days() + '일 · 연 ' + (+S.rShort).toFixed(2) + '%';

    var rank = ['A', 'B', 'C'].sort(function (a, b) { return R[b].long - R[a].long; });
    var gap = R[rank[0]].long - R[rank[1]].long;
    $('tDiff').textContent = rank[0] + '안';
    $('tDiffS').textContent = rank.map(function (s) { return s + ' ' + man(R[s].long, 1); }).join(' · ');

    var ok = w1.ok && w2.ok;
    $('tProt').textContent = ok ? '모두 안전' : '초과 있음';
    $('tProt').style.color = ok ? 'var(--mint)' : 'var(--coral)';
    $('tProtS').textContent = ok ? '가장 큰 곳 ' + man(Math.max(w1.max, w2.max)) : '빨간 곳의 원금을 다른 금융회사로';

    var reason = {
      A: '신협 일반 예탁금 금리가 전북은행·케이뱅크보다 높아서입니다. 4.05%가 일반 예탁금에도 그대로 적용되는지 꼭 확인하세요.',
      B: '조건 없이 받는 전북은행 금리가 신협 일반 예탁금·케이뱅크보다 높아서입니다. 신협은 세금우대 3,000만만 쓰세요.',
      C: '케이뱅크에서 먼저 받은 이자를 바로 다시 예금한다는 가정에서입니다. 받은 이자를 쓰면 이 효과는 사라집니다.'
    };
    var v = $('verdict');
    v.className = 'callout ' + (gap < 10 ? 'info' : 'ok');
    v.innerHTML = '<b class="t">지금 입력한 금리로는 ' + rank[0] + '안이 가장 유리하고, 2위(' + rank[1] + '안)보다 부부 합계 연 ' + man(gap, 1) + ' 원 많습니다</b>' +
      '<p class="small">' + reason[rank[0]] + (gap < 10 ? ' 다만 차이가 10만 원 미만이라 금리보다 관리 편의와 안심으로 고르셔도 됩니다. 1금융 비중을 높이려면 B안이나 C안, 한 곳에 모아 단순하게 하려면 A안입니다.' : '') + '</p>';

    renderOrder();
  }

  function renderOrder() {
    var first = { A: '신협', B: '전북은행', C: '케이뱅크' }[S.scen];
    var second = { A: '전북은행', B: '신협', C: '신협' }[S.scen];
    $('orderLead').textContent = S.scen === 'A'
      ? 'A안은 신협에 더 큰 돈이 들어가므로 신협을 먼저 엽니다. 세금우대 마감(12/30)도 자연히 맞춰집니다. 전북은행 6,750만은 12/22 이후 가입합니다.'
      : 'B·C안은 ' + first + '에 9,500만이 들어가므로 ' + first + '을(를) 먼저 엽니다. 신협 세금우대 3,000만은 12/22~12/30 사이에 가입합니다. 창구에서 예외로 받아주면 더 일찍 가입해도 됩니다.';
    var firstStep = {
      A: '부부 함께 신협 방문: 조합원 가입 → 세금우대 3,000만 + 일반 6,500만 (3,000·3,500만으로 나눠도 됨)',
      B: '부부 각자 전북은행 앱에서 통장 개설 → JB 다이렉트 9,500만 (3,000·3,000·3,500만 3계좌)',
      C: '부부 각자 케이뱅크 앱에서 통장 개설 → 내맘대로 이자받는 정기예금 9,500만, 이자 수령 시점을 "가입 즉시"로 선택 → 받은 이자는 같은 날 다시 예금 (100만 원 이상)'
    }[S.scen];
    var waitStep = S.scen === 'A'
      ? '전북 몫 6,750만은 12/22까지 기존 은행 파킹통장·단기예금에서 대기'
      : '남편 경남은행·아내 국민은행 12개월 3,750만 가입. 신협 몫 3,000만은 12/22까지 대기';
    var secondStep = S.scen === 'A'
      ? '부부 각자 전북은행 앱 개설 → JB 다이렉트 6,750만'
      : '부부 함께 신협 방문 → 세금우대 3,000만 (12/30까지, 2026년 가입분 세율)';
    var steps = [
      ['오늘', '매매대금이 한 계좌에 1억 넘게 있으면 이번 주에 나누기. 잔금 입금 내역·매매계약서 보관'],
      ['11/23~24', '신협 전화 확인 (위 04번 질문). 들은 금리를 계산기에 넣고 A·B·C안 결정'],
      ['11/23~27', firstStep],
      ['11/23~27', '남편 경남은행, 아내 농협에 단기예금 5,000만 (만기 1/28 이하). 이체한도를 세액 이상으로 올리기'],
      ['11/23~27', waitStep],
      ['12/22~30', secondStep],
      ['1/28 (목)', '단기예금 만기 → 양도세(홈택스)·지방소득세(위택스) 납부'],
      ['2027년 11월', '새로 연 통장의 한도제한 해제(재직증명서 등) → 만기 때 재판단. 자동 재예치 끄기']
    ];
    var key = 'orderChecks-' + S.scen, st = CM.load(key, {}), box = $('orderChecks'), done = 0;
    box.innerHTML = '';
    steps.forEach(function (s, i) {
      var lab = document.createElement('label'); lab.className = 'check' + (st[i] ? ' done' : '');
      var inp = document.createElement('input'); inp.type = 'checkbox'; inp.id = 'oc' + i; inp.checked = !!st[i];
      inp.addEventListener('change', function () { st[i] = inp.checked; CM.save(key, st); renderOrder(); });
      var sp = document.createElement('span');
      var w = document.createElement('span'); w.className = 'when'; w.textContent = s[0];
      var t = document.createElement('span'); t.className = 'what'; t.textContent = s[1];
      sp.appendChild(w); sp.appendChild(t);
      lab.appendChild(inp); lab.appendChild(sp); box.appendChild(lab);
      if (st[i]) done++;
    });
    $('ordBar').style.width = (done / steps.length * 100) + '%';
    void second;
  }

  var calls = [
    '광고의 12개월 4.05%가 세금우대 예탁금과 일반 예탁금 모두에 적용되나요? 특판이면 한도·마감일은?',
    '총급여 7,000만 원 초과자의 2026년 가입분 실제 세율은? (소득세 5% + 농특세 포함 몇 %)',
    '부부 각자 조합원 가입이 되나요? 출자금은 얼마인가요? 용호동 거주로 자격이 되나요?',
    '다른 은행 통장을 최근 만들었어도 매매계약서로 가입이 되나요? (20영업일 예외)',
    '이 조합의 최근 경영공시(BIS 자기자본비율, 연체율)를 볼 수 있나요?',
    '만기 자동 재예치를 끌 수 있나요? 만기 원리금을 다른 은행 계좌로 받을 수 있나요?'
  ];
  (function () {
    var st = CM.load('callChecks', {}), box = $('callChecks');
    calls.forEach(function (q, i) {
      var lab = document.createElement('label'); lab.className = 'check' + (st[i] ? ' done' : '');
      var inp = document.createElement('input'); inp.type = 'checkbox'; inp.id = 'cc' + i; inp.checked = !!st[i];
      inp.addEventListener('change', function () { st[i] = inp.checked; CM.save('callChecks', st); lab.classList.toggle('done', inp.checked); });
      var sp = document.createElement('span'); sp.className = 'what'; sp.textContent = q;
      lab.appendChild(inp); lab.appendChild(sp); box.appendChild(lab);
    });
  })();

  function persist() { CM.save('deposit', S); CM.save('shortMaturity', S.mat); }
  function fillInputs() {
    RATE_KEYS.forEach(function (k) { $(k).value = (+S[k]).toFixed(2); });
    $('tax').value = S.tax; $('start').value = S.start; $('mat').value = S.mat;
  }
  RATE_KEYS.forEach(function (k) {
    var el = $(k);
    el.addEventListener('change', function () {
      var v = parseFloat(el.value);
      if (isFinite(v) && v >= 0 && v <= 15) { S[k] = v; persist(); render(); } else { el.value = (+S[k]).toFixed(2); CM.toast('0~15 사이 숫자를 넣으세요'); }
    });
  });
  $('tax').addEventListener('change', function () { S.tax = $('tax').value; persist(); render(); });
  $('start').addEventListener('change', function () { if (CM.parse($('start').value)) { S.start = $('start').value; persist(); render(); } });
  $('mat').addEventListener('change', function () {
    var d = CM.parse($('mat').value);
    if (d) { S.mat = $('mat').value; if (d.getDay() === 0 || d.getDay() === 6) CM.toast('만기일이 주말입니다. 평일로 바꾸세요'); persist(); render(); }
  });
  ['A', 'B', 'C'].forEach(function (s) { $('sc' + s).addEventListener('click', function () { S.scen = s; persist(); render(); }); });

  var armed = false;
  $('resetBtn').addEventListener('click', function () {
    var b = this;
    if (!armed) { armed = true; b.textContent = '한 번 더 누르면 되돌립니다'; setTimeout(function () { armed = false; b.textContent = '기본값으로 되돌리기'; }, 3000); return; }
    S = JSON.parse(JSON.stringify(DEF)); persist(); fillInputs();
    armed = false; b.textContent = '기본값으로 되돌리기'; render(); CM.toast('기본값으로 되돌렸습니다');
  });
  $('copyBtn').addEventListener('click', function () {
    var lines = ['[' + NAME[S.scen] + '] 부부 예금 배분 (만원)'];
    [['hk', '남편'], ['is', '아내']].forEach(function (p) {
      lines.push(p[1] + ':');
      calc(S.scen, p[0]).items.forEach(function (x) { lines.push('- ' + x.name + ' ' + x.prod + ' ' + x.p.toLocaleString('ko-KR') + '만 @' + x.r.toFixed(2) + '% → 세후 ' + man(x.net, 1)); });
    });
    var a = calc(S.scen, 'hk'), b = calc(S.scen, 'is');
    lines.push('부부 장기 세후 ' + man(a.longNet + b.longNet, 1) + ' · 단기 세후 ' + man(a.shortNet + b.shortNet, 1));
    CM.copy(lines.join('\n'));
  });

  fillInputs();
  render();
})();
