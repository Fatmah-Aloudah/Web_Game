(() => {
  const app = document.getElementById('app');
  const CFG = window.QUIZ_CONFIG;
  const avatars = ['🦁','🐯','🐼','🦊','🐸','🐵','🐨','🦄','🐲','🦖','🐙','🦋','🐝','🐢','🚀','⭐'];

  const state = {
    page: 'landing',
    lang: 'en',
    db: null,
    teams: [],
    activeCategory: null,
    currentQuestion: null,
    timerLeft: 0,
    timerId: null,
    selected: null,
    used: new Set(loadUsed()),
    lastId: null,
    turn: 0,
    timerInit: 30
  };

  function t(en, ar) { return state.lang === 'ar' ? ar : en; }
  function escapeHtml(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function dir() { return state.lang === 'ar' ? 'rtl' : 'ltr'; }
  function setLang(lang) {
    state.lang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir();
  }
  function loadUsed() { try { return JSON.parse(localStorage.getItem('qa-used') || '[]'); } catch (_) { return []; } }
  function saveUsed() { try { localStorage.setItem('qa-used', JSON.stringify([...state.used])); } catch (_) {} }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // Shuffled, non-repeating pick. Used ids are remembered (even after refresh);
  // when a category runs dry it is reshuffled, never starting with the last question.
  function pickQuestion(cat) {
    const all = cat.questions || [];
    let pool = all.filter(q => !state.used.has(q.id));
    if (!pool.length) {
      all.forEach(q => state.used.delete(q.id));
      pool = all.filter(q => q.id !== state.lastId);
      if (!pool.length) pool = all.slice();
      showToast(t('Category reshuffled — all questions are fresh again!', 'تمت إعادة خلط التصنيف — الأسئلة جديدة من جديد!'));
    }
    return shuffle(pool.slice())[0];
  }
  function advanceTurn() { if (state.teams.length) state.turn = (state.turn + 1) % state.teams.length; }
  function turnText() {
    const tm = state.teams[state.turn];
    return tm ? `🎯 ${t('Turn:', 'الدور:')} ${tm.avatar} ${escapeHtml(tm.name)} — ${t('pick a category!', 'اختاروا تصنيفاً!')}` : '';
  }
  function wireMute() {
    const b = document.getElementById('muteBtn');
    if (b) b.onclick = () => { b.textContent = FX.toggleMute() ? '🔇' : '🔊'; };
  }
  function stopTimer() { if (state.timerId) clearInterval(state.timerId); state.timerId = null; }

  async function loadDatabase() {
    const github = CFG.githubDb?.[state.lang];
    const local = CFG.localDb?.[state.lang];
    const candidates = [github, local].filter(Boolean);
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const json = await res.json();
        if (json?.categories) return json;
      } catch (_) {}
    }
    throw new Error('Database could not be loaded.');
  }

  function resetGameData() {
    stopTimer();
    state.teams = state.teams.map(team => ({...team, score: 0}));
    state.used.clear(); state.turn = 0; saveUsed();
    state.activeCategory = null;
    state.currentQuestion = null;
    state.timerLeft = 0;
  }

  function render() {
    stopTimer();
    document.documentElement.lang = state.lang;
    document.documentElement.dir = dir();
    if (state.page === 'landing') return renderLanding();
    if (state.page === 'teams') return renderTeams();
    if (state.page === 'select') return renderSelect();
    if (state.page === 'categories') return renderCategories();
    if (state.page === 'question') return renderQuestion();
    if (state.page === 'answer') return renderAnswer();
    if (state.page === 'claim') return renderClaim();
    if (state.page === 'winner') return renderWinner();
  }

  function renderLanding() {
    app.innerHTML = `
      <div class="screen centered">
        <div class="hero">
          <div class="hero-badge">🏆 ${t('TEAM QUIZ ARENA','ساحة تحدي الفرق')}</div>
          <h1>${t('Ready, set, quiz!','هل أنتم مستعدون للتحدي؟')}</h1>
          <p>${t('A fast local quiz game for up to three teams — with Arabic + English databases and media questions.','لعبة أسئلة سريعة لثلاثة فرق كحد أقصى، مع قواعد بيانات عربية وإنجليزية وأسئلة نصية وصور وأصوات وفيديوهات.')}</p>
          <div class="input-label">🌐 Language / اللغة</div>
          <div class="toggle-row" style="justify-content:center"><button class="toggle ${state.lang==='en'?'active':''}" id="langEn">English</button><button class="toggle ${state.lang==='ar'?'active':''}" id="langAr">العربية</button></div>
          <button class="primary-btn" id="startGame">${t('Start Game','ابدأ اللعبة')} →</button>
          <div class="footer-note">${t('Local-first • GitHub-ready • No build step','تعمل محلياً • جاهزة لربط GitHub • بدون خطوات بناء')}</div>
        </div>
      </div>`;
    document.getElementById('langEn').onclick = () => { setLang('en'); render(); };
    document.getElementById('langAr').onclick = () => { setLang('ar'); render(); };
    document.getElementById('startGame').onclick = () => { state.page = 'teams'; render(); };
  }

  function renderTeams() {
    const safeTeams = state.teams.length ? state.teams : [
      {name:'', avatar:avatars[0], score:0},
      {name:'', avatar:avatars[1], score:0},
      {name:'', avatar:avatars[2], score:0}
    ];
    app.innerHTML = `
      <div class="screen">
        <div class="page">
          <div class="container">
            <div class="page-header">
              <div>
                <h2>${t('Set up your teams','إعداد الفرق')}</h2>
                <p class="footer-note">${t('Choose 1–3 teams and an avatar for each.','اختر من فريق إلى ثلاثة، ثم صورة لكل فريق.')}</p>
              </div>
              <button class="secondary-btn" id="backLanding">${t('← Back','← رجوع')}</button>
            </div>
            <div class="setup-grid">
              ${safeTeams.map((team, index) => teamSetupHtml(team, index)).join('')}
            </div>
            <div class="panel" style="margin-top:22px;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap;">
              <div><strong>${t('Tip:','ملاحظة:')}</strong> ${t('Team names can be written in Arabic or English regardless of the selected database.','يمكن كتابة أسماء الفرق بالعربية أو الإنجليزية مهما كانت لغة قاعدة الأسئلة.')}</div>
              <button class="primary-btn" id="continueTeams">${t('Continue to Categories','تابع إلى التصنيفات')} →</button>
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById('backLanding').onclick = () => { state.page = 'landing'; render(); };
    document.querySelectorAll('.avatar-choice').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.team);
        document.querySelectorAll(`.avatar-choice[data-team="${idx}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
    });
    document.getElementById('continueTeams').onclick = async () => {
      const teams = readTeamsFromForm();
      if (!teams.length) return showToast(t('Add at least one team.','أضف فريقاً واحداً على الأقل.'));
      state.teams = teams;
      try {
        state.db = await loadDatabase();
        state.page = 'select';
        render();
      } catch (_) {
        showToast(t('Could not load the question database.','تعذر تحميل قاعدة الأسئلة.'));
      }
    };
  }

  function teamSetupHtml(team, index) {
    const active = index < Math.max(1, Math.min(3, state.teams.length || 3));
    return `<div class="team-setup-card ${active?'':'inactive'}">
      <h3>${t('Team','الفريق')} ${index+1}</h3>
      <div class="field"><label class="input-label" for="team-${index}">${t('Team name','اسم الفريق')}</label><input class="text-input" id="team-${index}" value="${escapeHtml(team.name)}" placeholder="${t('Type a team name','اكتب اسم الفريق')}" maxlength="32"></div>
      <div class="field"><span class="input-label">${t('Avatar','الصورة')}</span>
        <div class="avatar-grid">${avatars.map((a, i) => `<button type="button" class="avatar-choice ${team.avatar===a?'selected':''}" data-team="${index}" data-avatar="${a}">${a}</button>`).join('')}</div>
      </div>
      <div class="field"><label style="display:flex;gap:10px;align-items:center;font-weight:800;"><input type="checkbox" id="active-${index}" ${index < (state.teams.length || 3) ? 'checked':''}> ${t('Use this team','استخدم هذا الفريق')}</label></div>
    </div>`;
  }

  function readTeamsFromForm() {
    const result = [];
    for (let i=0; i<3; i++) {
      const use = document.getElementById(`active-${i}`)?.checked;
      const name = document.getElementById(`team-${i}`)?.value.trim();
      if (!use) continue;
      if (!name) { showToast(t(`Enter a name for Team ${i+1}.`, `اكتب اسم الفريق ${i+1}.`)); return []; }
      const selected = document.querySelector(`.avatar-choice[data-team="${i}"].selected`);
      result.push({ name, avatar: selected?.dataset.avatar || avatars[i], score: 0 });
    }
    return result;
  }

  function renderTopbar(title='') {
    return `<div class="topbar"><div class="topbar-row">
      <div class="team-strip">${scoreCells(0, 1, 2)}</div>
      <div class="topbar-title">${escapeHtml(title || t('TEAM QUIZ ARENA','ساحة تحدي الفرق'))}</div>
      <div class="header-actions" style="justify-content:flex-end;"><button class="secondary-btn" id="muteBtn" title="Sound">${FX.isMuted()?'🔇':'🔊'}</button><button class="secondary-btn" id="backCategories">${t('← Categories','← التصنيفات')}</button></div>
    </div></div>`;
  }
  function scoreCells(...indices) {
    return indices.map(i => {
      const team = state.teams[i];
      if (!team) return `<div class="team-score" style="opacity:.3">—</div>`;
      return `<div class="team-score ${i===state.turn&&state.page!=='winner'?'turn':''}" data-team="${i}"><div class="name"><span class="avatar">${team.avatar}</span><span title="${escapeHtml(team.name)}">${escapeHtml(team.name)}</span></div><div class="score">${team.score}</div></div>`;
    }).join('');
  }
  function wireBack() { wireMute(); document.getElementById('backCategories')?.addEventListener('click', () => { state.activeCategory=null; state.currentQuestion=null; state.page='categories'; render(); }); }

  const visibleCategories = () => state.db.categories.filter(c => state.selected?.has(c.id));

  function renderSelect() {
    if (!state.db) { state.page = 'teams'; return render(); }
    const cats = state.db.categories;
    if (!state.selected) state.selected = new Set(cats.map(c => c.id));
    state.selected = new Set([...state.selected].filter(id => cats.some(c => c.id === id)));
    const sel = state.selected;
    app.innerHTML = `<div class="screen"><div class="page"><div class="container">
      <div class="page-header"><div><h2>${t('Pick your categories','اختاروا التصنيفات')}</h2><p class="footer-note">${t('Tick the categories you want to play.','ضعوا علامة على التصنيفات التي تريدون لعبها.')}</p></div>
        <div class="header-actions"><button class="secondary-btn" id="selAll">☑ ${t('Select all','تحديد الكل')}</button><button class="secondary-btn" id="selNone">☐ ${t('Clear','مسح')}</button></div></div>
      <div class="select-grid">${cats.map((c, i) => `<button type="button" class="select-card ${sel.has(c.id) ? 'checked' : ''}" style="--i:${i}" data-cat="${escapeHtml(c.id)}" aria-pressed="${sel.has(c.id)}"><span class="check">✓</span><span class="select-icon">${c.icon || '❓'}</span><span class="select-name">${escapeHtml(c.name)}</span><span class="select-count">${c.questions?.length || 0} ${t('question(s)','سؤال')}</span></button>`).join('')}</div>
      <div class="panel" style="display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap;">
        <strong id="selCount"></strong>
        <div class="header-actions"><button class="secondary-btn" id="backTeams">${t('← Teams','← الفرق')}</button><button class="primary-btn" id="goCategories">${t('Start Playing','ابدأ اللعب')} →</button></div>
      </div></div></div></div>`;
    const update = () => {
      document.querySelectorAll('.select-card').forEach(b => { const on = state.selected.has(b.dataset.cat); b.classList.toggle('checked', on); b.setAttribute('aria-pressed', on); });
      document.getElementById('selCount').textContent = `${state.selected.size}/${cats.length} ${t('selected','محدد')}`;
    };
    update();
    document.querySelectorAll('.select-card').forEach(b => b.onclick = () => { const id = b.dataset.cat; state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id); update(); });
    document.getElementById('selAll').onclick = () => { cats.forEach(c => state.selected.add(c.id)); update(); };
    document.getElementById('selNone').onclick = () => { state.selected.clear(); update(); };
    document.getElementById('backTeams').onclick = () => { state.page = 'teams'; render(); };
    document.getElementById('goCategories').onclick = () => {
      if (!state.selected.size) return showToast(t('Select at least one category.','اختر تصنيفاً واحداً على الأقل.'));
      state.page = 'categories'; render();
    };
  }

  function renderCategories() {
    if (!state.db) { state.page='teams'; return render(); }
    if (!state.selected?.size) { state.page='select'; return render(); }
    app.innerHTML = `<div class="screen">${renderTopbar(t('Choose a category','اختر تصنيفاً'))}<div class="page"><div class="container">
      <div class="page-header"><div><h2>${t('Categories','التصنيفات')}</h2><p class="footer-note">${turnText()}</p></div><div class="header-actions"><button class="secondary-btn" id="editCats">🗂 ${t('Change categories','تغيير التصنيفات')}</button><button class="primary-btn" id="finishGame">🏆 ${t('Finish Game','إنهاء اللعبة')}</button></div></div>
      <div class="categories-grid">${visibleCategories().map((c, i) => `<button class="category-card" style="--i:${i}" data-category="${escapeHtml(c.id)}"><div class="category-title">${escapeHtml(c.name)}</div><div class="category-box">${c.icon || '❓'}</div><div class="category-footer">${(c.questions||[]).filter(q=>!state.used.has(q.id)).length}/${c.questions?.length || 0} ${t('fresh','جديد')}</div></button>`).join('')}</div>
    </div></div></div>`;
    wireBack();
    document.querySelectorAll('[data-category]').forEach(btn => btn.onclick = () => startCategory(btn.dataset.category));
    document.getElementById('editCats').onclick = () => { state.page = 'select'; render(); };
    document.getElementById('finishGame').onclick = () => { state.page='winner'; render(); };
  }

  function startCategory(categoryId) {
    const category = state.db.categories.find(c => c.id === categoryId);
    if (!category) return;
    state.activeCategory = category;
    state.currentQuestion = pickQuestion(category);
    state.used.add(state.currentQuestion.id);
    state.lastId = state.currentQuestion.id;
    saveUsed();
    FX.sfx('pop');
    state.page='question';
    render();
  }

  function renderQuestion() {
    const q = state.currentQuestion;
    if (!q) return renderCategories();
    const initial = Number(q.timer ?? CFG.defaultTimerSeconds ?? 30);
    state.timerLeft = initial; state.timerInit = initial;
    app.innerHTML = `<div class="screen">${renderTopbar(state.activeCategory?.name || '')}<div class="page"><div class="container">
      <div class="page-header"><div><h2>${t('Question','السؤال')}</h2><p class="footer-note">${t('Press Start Timer when the host is ready.','اضغط ابدأ المؤقت عندما يكون مقدم اللعبة مستعداً.')}</p></div><div><span class="hero-badge">+${q.points} ${t('points','نقطة')}</span></div></div>
      <div class="question-wrap">
        <div class="panel question-card"><div><div class="question-number">${t('Question','السؤال')} • ${escapeHtml(q.type || 'text').toUpperCase()}</div><div class="question-text">${escapeHtml(q.question || '')}</div>${mediaHtml(q.media, q.type)}</div><div><button class="primary-btn" id="revealAnswer">${t('Reveal Answer','إظهار الإجابة')} →</button></div></div>
        <div class="panel timer-card" id="timerCard"><div style="text-align:center;font-weight:800;">${t('Timer','المؤقت')}</div><div class="timer-circle" id="timerCircle" style="--p:100">${state.timerLeft}</div><button class="primary-btn" id="startTimer">▶ ${t('Start Timer','ابدأ المؤقت')}</button><div class="footer-note" id="timerHint">${t('Timer is not running.','المؤقت غير قيد التشغيل.')}</div></div>
      </div>
    </div></div></div>`;
    wireBack();
    document.getElementById('startTimer').onclick = () => startTimer();
    document.getElementById('revealAnswer').onclick = () => { stopTimer(); state.page='answer'; render(); };
  }

  function startTimer() {
    if (state.timerId) return;
    const card = document.getElementById('timerCard');
    const btn = document.getElementById('startTimer');
    const hint = document.getElementById('timerHint');
    card.classList.add('running');
    btn.disabled = true;
    btn.style.opacity = .5;
    hint.textContent = t('Timer is running…','المؤقت يعمل…');
    state.timerId = setInterval(() => {
      state.timerLeft -= 1;
      const node = document.getElementById('timerCircle');
      if (node) {
        node.textContent = Math.max(0, state.timerLeft);
        node.style.setProperty('--p', Math.max(0, state.timerLeft) / state.timerInit * 100);
        if (state.timerLeft <= 5 && state.timerLeft > 0) { card?.classList.add('danger'); FX.sfx('warn'); } else if (state.timerLeft > 5) FX.sfx('tick');
      }
      if (state.timerLeft <= 0) {
        stopTimer();
        card?.classList.remove('running','danger'); card?.classList.add('timesup'); FX.sfx('buzzer');
        if (hint) hint.textContent = t('Time is up! Reveal the answer.','انتهى الوقت! أظهر الإجابة.');
        const reveal = document.getElementById('revealAnswer');
        if (reveal) reveal.focus();
      }
    }, 1000);
  }

  function mediaHtml(url, type) {
    if (!url) return '';
    const resolvedType = type || mediaTypeFromUrl(url);
    if (resolvedType === 'image') return `<div class="media-frame"><img src="${escapeHtml(url)}" alt=""></div>`;
    if (resolvedType === 'audio') return `<div class="media-frame audio-box"><audio controls src="${escapeHtml(url)}"></audio></div>`;
    if (resolvedType === 'video') return `<div class="media-frame"><video controls src="${escapeHtml(url)}"></video></div>`;
    return '';
  }
  function mediaTypeFromUrl(url) {
    const ext = String(url).split('?')[0].split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image';
    if (['mp3','wav','ogg','m4a'].includes(ext)) return 'audio';
    if (['mp4','webm','mov','m4v'].includes(ext)) return 'video';
    return 'text';
  }

  function renderAnswer() {
    const q = state.currentQuestion;
    app.innerHTML = `<div class="screen">${renderTopbar(state.activeCategory?.name || '')}<div class="page"><div class="container">
      <div class="page-header"><div><h2>${t('Answer','الإجابة')}</h2></div><div><span class="hero-badge">+${q.points} ${t('points','نقطة')}</span></div></div>
      <div class="panel answer-card"><div class="answer-label">${t('Correct answer','الإجابة الصحيحة')}</div><div class="answer-text">${escapeHtml(q.answer || t('See answer media','راجع وسائط الإجابة'))}</div>${mediaHtml(q.answerMedia, mediaTypeFromUrl(q.answerMedia || ''))}<button class="primary-btn" id="claimNext">${t('Go to Point Claiming','انتقل للمطالبة بالنقاط')} →</button></div>
    </div></div></div>`;
    wireBack();
    FX.sfx('pop');
    document.getElementById('claimNext').onclick = () => { state.page='claim'; render(); };
  }

  function renderClaim() {
    const q = state.currentQuestion;
    const buttons = state.teams.map((team, i) => `<button class="claim-btn" data-claim="${i}"><span class="avatar" style="width:50px;height:50px;margin:0 auto 8px;font-size:26px;">${team.avatar}</span><span class="claim-name">${escapeHtml(team.name)}</span><span class="claim-points">+${q.points} ${t('points','نقطة')}</span></button>`).join('');
    app.innerHTML = `<div class="screen">${renderTopbar(state.activeCategory?.name || '')}<div class="page"><div class="container">
      <div class="page-header"><div><h2>${t('Who answered correctly?','من أجاب بشكل صحيح؟')}</h2><p class="footer-note">${t('Choose one team, or choose “No one”.','اختر فريقاً واحداً أو اختر «لا أحد».')}</p></div></div>
      <div class="claim-grid">${buttons}<button class="claim-btn none" id="claimNone"><span class="claim-name">✖ ${t('No one','لا أحد')}</span><span class="claim-points">${t('No points added','بدون نقاط')}</span></button></div>
    </div></div></div>`;
    wireBack();
    document.querySelectorAll('[data-claim]').forEach(btn => btn.onclick = () => claim(Number(btn.dataset.claim)));
    document.getElementById('claimNone').onclick = () => { FX.sfx('buzzer'); advanceTurn(); state.page='categories'; render(); };
  }

  function claim(teamIndex) {
    const from = state.teams[teamIndex].score;
    state.teams[teamIndex].score += Number(state.currentQuestion?.points || 0);
    advanceTurn();
    state.page = 'categories';
    state.currentQuestion = null;
    render();
    FX.sfx('correct'); FX.confetti(); FX.bump(teamIndex, from, state.teams[teamIndex].score);
  }

  function renderWinner() {
    const ranked = [...state.teams].sort((a,b) => b.score-a.score);
    const groups = []; // teams with equal scores share one stand
    ranked.forEach(tm => { const g = groups[groups.length-1]; if (g && g[0].score === tm.score) g.push(tm); else groups.push([tm]); });
    app.innerHTML = `<div class="screen"><div class="topbar"><div class="topbar-row"><div class="team-strip">${scoreCells(0,1,2)}</div><div class="topbar-title">🏆 ${t('Winners','الفائزون')}</div><div class="header-actions" style="justify-content:flex-end;"><button class="secondary-btn" id="muteBtn" title="Sound">${FX.isMuted()?'🔇':'🔊'}</button><button class="secondary-btn" id="backCategories">${t('← Categories','← التصنيفات')}</button></div></div></div><div class="page"><div class="container">
      <div class="page-header"><div><h2>${t('Final Standings','الترتيب النهائي')}</h2><p class="footer-note">${t('Tied teams share the same stand.','الفرق المتعادلة تتشارك المنصة نفسها.')}</p></div></div>
      <div class="panel"><div class="podium">${podiumPlace(groups[1],1)}${podiumPlace(groups[0],0)}${podiumPlace(groups[2],2)}</div></div>
      <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:22px;"><button class="primary-btn" id="replay">↻ ${t('Same teams, start from zero','نفس الفرق، ابدأ من الصفر')}</button><button class="secondary-btn" id="newGame">🏠 ${t('Back to start (new teams)','العودة للبداية (فرق جديدة)')}</button></div>
    </div></div></div>`;
    wireBack();
    FX.sfx('fanfare'); FX.confetti(260);
    document.getElementById('replay').onclick = () => { resetGameData(); state.page='categories'; render(); };
    document.getElementById('newGame').onclick = () => { resetGameData(); state.teams = []; state.selected = null; state.page = 'landing'; render(); };
  }

  function podiumPlace(group, i) {
    if (!group) return '<div class="podium-place"></div>';
    const n = group.length, medal = ['🥇','🥈','🥉'][i];
    const people = group.map(tm => `<div class="podium-person"><div class="big-avatar">${tm.avatar}</div><div class="winner-name">${escapeHtml(tm.name)}</div></div>`).join('');
    return `<div class="podium-place place-${i+1} ${n>1?'multi multi-'+n:''}"><div class="podium-people">${people}</div><div class="podium-block"><div class="place-label">${medal}</div><div class="place-points">${group[0].score}</div>${n>1?`<div class="tie-tag">${t('Tied!','تعادل!')}</div>`:''}</div></div>`;
  }

  function showToast(message) {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className='toast';
    el.textContent=message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // Start.
  FX.bg();
  setLang('en');
  render();
})();
