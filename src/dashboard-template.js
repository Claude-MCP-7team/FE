// Reference: docs/assets/iamges. Demo values are not live eligibility results.
export const dashboardTemplate = `<div class="reference-dashboard">
    <section class="hero">
      <div>
        <div class="eyebrow">My policy dashboard</div>
        <h1>김유진님, 받을 수 있는 정책을<br>실행 계획으로 만들었어요.</h1>
        <p>입력한 조건과 공고문 원문을 대조한 결과입니다. 기준일 2026. 09. 04</p>
      </div>
      <div class="hero-actions">
        <button class="btn ghost" id="editProfile">조건 수정</button>
        <button class="btn primary" id="rerun">AI 다시 분석</button>
      </div>
    </section>

    <section class="summary" aria-label="분석 결과 요약">
      <article class="summary-card main">
        <div class="label">총 분석 정책</div><div class="value">128개</div>
        <div class="note">경기도 · 용인시 · 중앙부처 공고 기준</div>
      </article>
      <article class="summary-card"><div class="label">지금 신청 가능</div><div class="value">12</div><div class="note">지난 분석보다 2개 증가</div></article>
      <article class="summary-card"><div class="label">곧 신청 가능</div><div class="value">7</div><div class="note">가장 빠른 조건 충족까지 2개월</div></article>
      <article class="summary-card"><div class="label">추가 확인 필요</div><div class="value" id="askCount">3</div><div class="note">답변하면 즉시 다시 판정해요</div></article>
    </section>

    <section class="question" id="questionBanner">
      <div class="question-icon">?</div>
      <div><strong>AI가 정확한 판정을 위해 한 가지를 물어봐요.</strong><span>최근 2년 이내 청년 취업지원사업 참여 이력을 확인해 주세요.</span></div>
      <button class="btn small" id="openQuestion">답변하고 1개 더 판정하기</button>
    </section>

    <div class="layout">
      <section class="panel">
        <div class="panel-head"><div><h2>나에게 맞는 정책</h2><div class="count" id="resultCount">우선순위가 높은 4개 정책</div></div><button class="btn small ghost">전체 결과 보기</button></div>
        <div class="filters" role="group" aria-label="정책 상태 필터">
          <button class="filter active" data-reference-filter="all">전체 22</button>
          <button class="filter" data-reference-filter="pass">신청 가능 12</button>
          <button class="filter" data-reference-filter="future">곧 가능 7</button>
          <button class="filter" data-reference-filter="ask">확인 필요 3</button>
        </div>
        <div class="policy-list" id="policyList">
          <article class="policy" data-status="pass" data-name="경기 청년 면접수당">
            <div><div class="policy-top"><span class="badge pass">✓ 신청 가능</span><span class="category">경기도 · 취업지원</span></div><h3>경기 청년 면접수당</h3><div class="meta"><span>면접 1회당 5만원</span><span>연 최대 10회</span><span>조건 일치 100%</span></div></div>
            <div class="policy-side"><div class="amount">최대 50만원</div><div class="deadline">D-12 · 9월 16일 마감</div><button class="detail-btn">판정 근거 보기 →</button></div>
          </article>
          <article class="policy" data-status="pass" data-name="국민취업지원제도 Ⅰ유형">
            <div><div class="policy-top"><span class="badge pass">✓ 신청 가능</span><span class="category">고용노동부 · 취업지원</span></div><h3>국민취업지원제도 Ⅰ유형</h3><div class="meta"><span>월 50만원 × 6개월</span><span>취업지원 서비스</span><span>조건 일치 96%</span></div></div>
            <div class="policy-side"><div class="amount">최대 300만원</div><div class="deadline">상시 신청</div><button class="detail-btn">판정 근거 보기 →</button></div>
          </article>
          <article class="policy" data-status="future" data-name="용인 청년 전월세 보증금 이자지원">
            <div><div class="policy-top"><span class="badge future">◷ 2개월 후 가능</span><span class="category">용인시 · 주거지원</span></div><h3>용인 청년 전월세 보증금 이자지원</h3><div class="meta"><span>거주 4개월 / 필요 6개월</span><span>나머지 5개 조건 충족</span></div></div>
            <div class="policy-side"><div class="amount">연 최대 100만원</div><div class="deadline">11월 조건 충족 예상</div><button class="detail-btn">부적격 이유 보기 →</button></div>
          </article>
          <article class="policy" data-status="ask" data-name="청년도전지원사업">
            <div><div class="policy-top"><span class="badge ask">? 추가 확인 필요</span><span class="category">고용노동부 · 역량강화</span></div><h3>청년도전지원사업</h3><div class="meta"><span>참여수당 + 인센티브</span><span>1개 조건 확인 필요</span></div></div>
            <div class="policy-side"><div class="amount">최대 350만원</div><div class="deadline">기관별 상이</div><button class="detail-btn ask-detail">질문에 답하기 →</button></div>
          </article>
        </div>
      </section>

      <aside class="side">
        <section class="panel combo" id="combination">
          <div class="panel-head"><h2>AI 추천 조합</h2><span class="count">최대 혜택 기준</span></div>
          <div class="combo-label">함께 받을 수 있는 최적 조합</div><div class="combo-amount">최대 420만원</div>
          <div class="combo-policies"><span>국민취업지원</span><b>+</b><span>면접수당</span><b>+</b><span>생활지원</span></div>
          <button class="btn" id="comboBtn">중복수혜 분석 보기</button>
        </section>

        <section class="panel" id="documents">
          <div class="panel-head"><div><h2>준비 서류</h2><span class="count" id="docProgress">3개 중 1개 준비</span></div><div class="progress-ring"><span id="ringValue">33%</span></div></div>
          <div class="checklist">
            <div class="check-row checked"><input type="checkbox" id="doc1" checked><label for="doc1">주민등록등본</label><span class="doc-note">정부24 · 즉시</span></div>
            <div class="check-row"><input type="checkbox" id="doc2"><label for="doc2">소득금액증명원</label><span class="doc-note">홈택스 · 1일</span></div>
            <div class="check-row"><input type="checkbox" id="doc3"><label for="doc3">재학증명서</label><span class="doc-note">학교 · 즉시</span></div>
          </div>
        </section>

        <section class="panel" id="schedule">
          <div class="panel-head"><div><h2>다가오는 일정</h2><span class="count">마감일에서 역산했어요</span></div></div>
          <ol class="timeline">
            <li><div class="date">9/08</div><div><strong>소득금액증명원 발급</strong><span>발급 소요일 1일 + 안전 여유 2일</span></div></li>
            <li><div class="date">9/11</div><div><strong>제출 서류 최종 확인</strong><span>누락·유효기간 확인</span></div></li>
            <li><div class="date">9/13</div><div><strong>온라인 신청 권장</strong><span>마감 3일 전 제출</span></div></li>
            <li><div class="date">9/16</div><div><strong>면접수당 신청 마감</strong><span>18:00 접수 종료</span></div></li>
          </ol>
        </section>
      </aside>
    </div>
    <div class="overlay" id="detailOverlay" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
    <div class="modal"><div class="modal-head"><div><span class="badge pass" id="detailBadge">✓ 신청 가능</span><h2 id="detailTitle">경기 청년 면접수당</h2></div><button class="close" data-close aria-label="닫기">×</button></div>
      <div class="detail-summary"><div><span>지원 혜택</span><strong id="detailBenefit">최대 50만원</strong></div><div><span>신청 기간</span><strong>09. 01 ~ 09. 16</strong></div><div><span>판정 신뢰도</span><strong>원문 근거 6개 연결</strong></div></div>
      <h3>나의 자격 조건</h3>
      <div class="conditions">
        <div class="condition"><b>나이</b><span class="ok">✓ 충족</span><span>만 24세 / 기준 만 18~39세</span></div>
        <div class="condition"><b>지역</b><span class="ok">✓ 충족</span><span>경기도 용인시 거주</span></div>
        <div class="condition"><b>취업 상태</b><span class="ok">✓ 충족</span><span>현재 미취업 상태</span></div>
        <div class="condition"><b>면접 이력</b><span class="ok">✓ 충족</span><span>2026년 경기도 소재 기업 면접</span></div>
      </div>
      <div class="source"><b>공고문 근거</b><br>“신청일 기준 주민등록상 경기도 내 거주하는 만 18세 이상 만 39세 이하 청년으로, 2026년 취업 면접에 참여한 자” — 모집공고 p.2</div>
      <button class="btn primary" style="width:100%;margin-top:18px" id="prepareBtn">이 정책 신청 준비 시작</button>
    </div>
  </div>

  <div class="overlay" id="questionOverlay" role="dialog" aria-modal="true" aria-labelledby="questionTitle">
    <div class="modal"><div class="modal-head"><div><span class="badge ask">AI 역질문</span><h2 id="questionTitle">자격 판정을 위해 확인이 필요해요</h2></div><button class="close" data-close aria-label="닫기">×</button></div>
      <p id="questionText">최근 2년 동안 정부나 지자체의 청년 취업지원사업에 참여한 적이 있나요?</p>
      <div class="answer-options" id="answerOptions"><button class="answer">참여한 적 없음</button><button class="answer">참여한 적 있음</button><button class="answer">잘 모르겠음</button></div>
      <div class="source" id="questionSource">이 질문은 공고문의 “최근 2년 내 유사 청년취업지원사업 참여자 제외” 조건을 판정하기 위해 필요합니다.</div>
    </div>
  </div>

  <div class="overlay" id="comboOverlay" role="dialog" aria-modal="true" aria-labelledby="comboTitle">
    <div class="modal"><div class="modal-head"><div><span class="badge pass">✓ 동시 수혜 가능</span><h2 id="comboTitle">최대 혜택 조합 분석</h2></div><button class="close" data-close aria-label="닫기">×</button></div>
      <div class="detail-summary"><div><span>예상 총 혜택</span><strong>최대 420만원</strong></div><div><span>조합 정책</span><strong>3개</strong></div><div><span>충돌 조건</span><strong>없음</strong></div></div>
      <div class="conditions"><div class="condition"><b>국민취업</b><span class="ok">300만원</span><span>구직촉진수당</span></div><div class="condition"><b>면접수당</b><span class="ok">50만원</span><span>실비성 지원으로 병행 가능</span></div><div class="condition"><b>생활지원</b><span class="ok">70만원</span><span>취업지원사업 중복 제한 없음</span></div></div>
      <div class="source"><b>교차 판정 결과</b><br>세 정책의 중복수혜 제한 조항을 대조한 결과 직접 충돌하는 조항이 없습니다. 최종 신청 전 각 운영기관 확인을 권장합니다.</div>
    </div>
  </div>

  <div class="overlay" id="profileOverlay" role="dialog" aria-modal="true" aria-labelledby="profileTitle">
    <div class="modal">
      <div class="modal-head"><div><span class="badge pass">내 조건 관리</span><h2 id="profileTitle">정책 판정 조건 수정</h2></div><button class="close" data-close aria-label="닫기">×</button></div>
      <p class="form-hint">공통 정보만 먼저 입력합니다. 정책마다 필요한 추가 조건은 AI가 다시 질문해요.</p>
      <form class="profile-form" id="profileForm">
        <section class="form-section">
          <h3>기본 정보</h3>
          <div class="form-grid">
            <div class="field"><label for="userName">이름</label><input id="userName" name="userName" value="김유진" required></div>
            <div class="field"><label for="birthDate">생년월일</label><input id="birthDate" name="birthDate" type="date" value="2002-05-12" required></div>
            <div class="field"><label for="region">현재 거주지역<span class="required">*</span></label><select id="region" name="region" required><option>경기도 용인시</option><option>경기도 수원시</option><option>경기도 성남시</option><option>서울특별시</option><option>기타 지역</option></select></div>
            <div class="field"><label for="residenceStart">연속 거주 시작일<span class="required">*</span></label><input id="residenceStart" name="residenceStart" type="month" value="2026-05" required><span class="duration-preview" id="residenceDuration">현재 기준 약 4개월 거주</span></div>
          </div>
        </section>
        <section class="form-section">
          <h3>학업 및 취업</h3>
          <div class="form-grid">
            <div class="field"><label for="education">학력 상태</label><select id="education" name="education"><option>대학교 재학</option><option>대학교 휴학</option><option>대학교 졸업</option><option>고등학교 졸업</option><option>대학원 재학</option></select></div>
            <div class="field"><label for="employment">취업 상태</label><select id="employment" name="employment"><option>미취업</option><option>재직 중</option><option>자영업</option><option>단기 근로</option></select></div>
            <div class="field"><label for="workType">근로 형태</label><select id="workType" name="workType"><option>해당 없음</option><option>정규직</option><option>계약직</option><option>아르바이트</option><option>프리랜서</option></select></div>
            <div class="field"><label for="monthlyIncome">개인 월 소득</label><input id="monthlyIncome" name="monthlyIncome" type="number" min="0" step="10000" value="0"><span class="form-hint">원 단위로 입력</span></div>
          </div>
        </section>
        <section class="form-section">
          <h3>가구 및 수혜 정보</h3>
          <div class="form-grid">
            <div class="field"><label for="householdIncome">가구 월 소득</label><input id="householdIncome" name="householdIncome" type="number" min="0" step="10000" placeholder="모르면 비워두세요"></div>
            <div class="field"><label for="householdSize">가구원 수<span class="required">*</span></label><input id="householdSize" name="householdSize" type="number" min="1" max="20" value="3" required></div>
            <div class="field"><label for="householder">세대주 여부<span class="required">*</span></label><select id="householder" name="householder" required><option value="no">세대원</option><option value="yes">세대주</option><option value="separated">분리 세대주</option></select></div>
            <div class="field"><label for="marital">혼인 상태</label><select id="marital" name="marital"><option>미혼</option><option>기혼</option><option>기타</option></select></div>
            <div class="field"><label for="withParents">부모와 동거 여부</label><select id="withParents" name="withParents"><option>동거</option><option>별도 거주</option></select></div>
            <div class="field"><label for="policyHistory">기존 정책 참여 이력<span class="required">*</span></label><select id="policyHistory" name="policyHistory" required><option value="none">없음</option><option value="yes">있음</option><option value="unknown">잘 모르겠음</option></select></div>
            <div class="field full conditional-field" id="policyHistoryDetailField"><label for="policyHistoryDetail">참여 이력 상세<span class="required">*</span></label><input id="policyHistoryDetail" name="policyHistoryDetail" placeholder="사업명, 참여기간, 지원 내용 입력"></div>
            <div class="field full"><label for="benefitHistory">현재 받고 있는 지원금</label><input id="benefitHistory" name="benefitHistory" placeholder="예: 국가장학금, 주거급여 (없으면 비워두세요)"></div>
          </div>
        </section>
        <section class="form-section">
          <h3>AI가 필요할 때만 확인하는 조건</h3>
          <p class="form-hint">취약계층·병역·재산은 모든 정책에 필요하지 않아 지금 입력하지 않습니다. 관련 조건이 있는 정책을 발견하면 아래와 같은 질문으로 확정합니다.</p>
          <div class="ai-question-list">
            <div class="ai-question-item"><div class="question-icon">?</div><div><strong>취약계층 해당 여부</strong><span>기초생활수급·차상위·한부모 등 우대 및 별도 기준 판정</span></div><button class="btn small ghost optional-question" type="button" data-topic="vulnerable">미리 답변</button></div>
            <div class="ai-question-item"><div class="question-icon">?</div><div><strong>병역 상태</strong><span>복무기간에 따른 연령 상한 연장 정책에만 사용</span></div><button class="btn small ghost optional-question" type="button" data-topic="military">미리 답변</button></div>
            <div class="ai-question-item"><div class="question-icon">?</div><div><strong>가구 재산 기준</strong><span>재산 한도가 명시된 주거·자산형성 정책에만 사용</span></div><button class="btn small ghost optional-question" type="button" data-topic="assets">미리 답변</button></div>
          </div>
        </section>
        <div class="form-actions"><button class="btn ghost" type="button" data-close>취소</button><button class="btn primary" type="submit">저장하고 다시 분석</button></div>
      </form>
    </div>
  </div>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>

</div>`;
