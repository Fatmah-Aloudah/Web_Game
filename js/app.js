(() => {
  const app = document.getElementById('app');
  const CFG = window.QUIZ_CONFIG;
  const avatars = [...new Set([
    '🦁','🐯','🐼','🦊','🐸','🐵','🐨','🦄','🐲','🦖','🐙','🦋','🐝','🐢','🚀','⭐',
    '🐶','🐱','🐰','🐻','🐼','🐨','🐮','🐷','🐵','🐔','🐧','🐦','🦉','🦅','🦆','🦇',
    '🐺','🐗','🐴','🦄','🦓','🦒','🐘','🦏','🦛','🐪','🐫','🦘','🦬','🦣','🐊','🐢',
    '🐍','🦎','🦕','🦖','🐳','🐬','🦈','🐟','🐠','🦀','🦞','🦐','🦑','🐌','🦋','🐞',
    '🌟','🔥','⚡','💎','👑','🏆','🎯','🎮','🚀','🛸','⚽','🏀','🏈','⚾','🎾','🏐',
    '🎸','🎧','🎤','🎨','🧩','🎲','🍕','🍔','🍉','🍓','🌈','🌙','☀️','🌻','🍀','💥'
  ])];
  const teamColors = [
    '#e11d48','#2563eb','#16a34a','#d97706','#7c3aed','#db2777','#0891b2','#65a30d',
    '#dc2626','#9333ea','#0f766e','#c2410c','#1d4ed8','#be123c','#475569','#a16207',
    '#4f46e5','#0d9488','#ca8a04','#7e22ce'
  ];
  function hueToHex(hue) {
    const h = ((hue % 360) + 360) % 360 / 60;
    const c = 0.72 * (1 - Math.abs(2 * 0.48 - 1));
    const x = c * (1 - Math.abs(h % 2 - 1));
    const m = 0.48 - c / 2;
    const [r,g,b] = h < 1 ? [c,x,0] : h < 2 ? [x,c,0] : h < 3 ? [0,c,x] : h < 4 ? [0,x,c] : h < 5 ? [x,0,c] : [c,0,x];
    return '#' + [r,g,b].map(v => Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
  }
  function teamColorAt(index) { return teamColors[index] || hueToHex(index * 137.508); }
  function nextAvailableTeamColor(index, existing=[]) {
    let color=teamColorAt(index), attempt=0;
    while(existing.some(team=>String(team.color||'').toLowerCase()===color.toLowerCase()) && attempt<360) {
      attempt++;
      color=hueToHex(index*137.508 + attempt*13.7);
    }
    return color;
  }
  function avatarText(team) { return escapeHtml(team?.avatar || '😀'); }
  function syncTeamDraftFromDOM(skipColors=false) {
    document.querySelectorAll('[data-team-name]').forEach((el,i) => { if (state.teamDraft[i]) state.teamDraft[i].name = el.value.trim(); });
    document.querySelectorAll('[data-team-avatar-input]').forEach((el,i) => { if (state.teamDraft[i]) state.teamDraft[i].avatar = el.value || '😀'; });
    if (!skipColors) document.querySelectorAll('[data-team-color-custom]').forEach((el,i) => { if (state.teamDraft[i]) state.teamDraft[i].color = el.value; });
  }
  function hasDuplicateTeamColor(index, color) {
    const normalized = String(color).toLowerCase();
    return state.teamDraft.some((team,i) => i !== index && String(team.color || '').toLowerCase() === normalized);
  }
  function updateTeamColorUI(index) {
    const team = state.teamDraft[index];
    const card = document.querySelector(`[data-team-card="${index}"]`);
    if (!team || !card) return;
    card.style.setProperty('--team-color', team.color || teamColorAt(index));
    card.querySelectorAll('.team-color-choice').forEach(btn => btn.classList.toggle('selected', btn.dataset.color.toLowerCase() === String(team.color).toLowerCase()));
    const custom = card.querySelector('[data-team-color-custom]');
    if (custom) custom.value = team.color || teamColorAt(index);
  }

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
    timerInit: 30,
    teamDraft: [],
    progress: {},
    currentTurnForQuestion: null
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
  function turnBannerHtml() {
    const tm = state.teams[state.turn];
    if (!tm) return '';
    const color = tm.color || teamColorAt(state.turn);
    return `<section class="turn-stage" style="--team-color:${escapeHtml(color)}" aria-live="polite">
      <div class="turn-stage-kicker">${t('NOW IT’S YOUR TURN','حان دوركم الآن')}</div>
      <div class="turn-stage-name"><span class="turn-stage-avatar">${avatarText(tm)}</span><strong>${escapeHtml(tm.name)}</strong></div>
      <div class="turn-stage-instruction">${t('Choose your next category!','اختاروا التصنيف التالي!')}</div>
    </section>`;
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
    state.used.clear(); state.turn = 0; state.progress={}; saveUsed();
    state.activeCategory = null;
    state.currentQuestion = null;
    state.currentTurnForQuestion = null;
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
          <p>${t('A bilingual quiz arena for as many teams as you need, with original picture, sound and video challenges.','لعبة تحدٍ ثنائية اللغة لعدد الفرق الذي تحتاجه، مع أسئلة نصية وصور وأصوات ومقاطع فيديو أصلية.')}</p>
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
    if (!state.teamDraft.length) state.teamDraft = state.teams.length
      ? state.teams.map((x,i)=>({...x, avatar:x.avatar||avatars[i%avatars.length], color:x.color||teamColorAt(i)}))
      : [{name:'',avatar:avatars[0],color:teamColorAt(0)},{name:'',avatar:avatars[1],color:teamColorAt(1)}];
    state.teamDraft.forEach((team,index) => {
      if (!team.avatar) team.avatar = avatars[index % avatars.length];
      if (!team.color) team.color = teamColorAt(index);
    });
    app.innerHTML = `<div class="screen"><div class="page"><div class="container">
      <div class="page-header"><div><h2>${t('Set up your teams','إعداد الفرق')}</h2><p class="footer-note">${t('Add as many teams as you need.','أضف العدد الذي تحتاجه من الفرق.')}<br>${t('Choose a unique color and an emoji for every team.','اختر لوناً ورمزاً تعبيرياً مختلفاً لكل فريق.')}</p></div><button class="secondary-btn" id="backLanding">${t('← Back','← رجوع')}</button></div>
      <div class="setup-grid" id="teamEditor">${state.teamDraft.map((team,index)=>teamSetupHtml(team,index)).join('')}</div>
      <div class="panel team-actions"><button class="secondary-btn" id="addTeam">＋ ${t('Add team','إضافة فريق')}</button><button class="primary-btn" id="continueTeams">${t('Continue to Categories','تابع إلى التصنيفات')} →</button></div>
    </div></div></div>`;
    document.getElementById('backLanding').onclick=()=>{syncTeamDraftFromDOM();state.page='landing';render();};
    document.getElementById('addTeam').onclick=()=>{
      syncTeamDraftFromDOM();
      const next=state.teamDraft.length;
      state.teamDraft.push({name:'',avatar:avatars[next%avatars.length],color:nextAvailableTeamColor(next,state.teamDraft)});
      render();
    };
    document.querySelectorAll('.avatar-choice').forEach(btn=>btn.onclick=()=>{
      const idx=Number(btn.dataset.team);
      syncTeamDraftFromDOM();
      state.teamDraft[idx].avatar=btn.dataset.avatar;
      const input=document.querySelector(`[data-team-avatar-input="${idx}"]`);
      const preview=document.querySelector(`[data-avatar-preview="${idx}"]`);
      if(input) input.value=btn.dataset.avatar;
      if(preview) preview.textContent=btn.dataset.avatar;
      document.querySelectorAll(`.avatar-choice[data-team="${idx}"]`).forEach(x=>x.classList.toggle('selected',x.dataset.avatar===btn.dataset.avatar));
    });
    document.querySelectorAll('[data-team-avatar-input]').forEach(input=>input.addEventListener('input',()=>{
      const idx=Number(input.dataset.teamAvatarInput);
      state.teamDraft[idx].avatar=input.value || '😀';
      const preview=document.querySelector(`[data-avatar-preview="${idx}"]`);
      if(preview) preview.textContent=input.value || '😀';
      document.querySelectorAll(`.avatar-choice[data-team="${idx}"]`).forEach(x=>x.classList.toggle('selected',x.dataset.avatar===input.value));
    }));
    document.querySelectorAll('.team-color-choice').forEach(btn=>btn.onclick=()=>{
      const idx=Number(btn.dataset.team);
      syncTeamDraftFromDOM();
      const color=btn.dataset.color;
      if(hasDuplicateTeamColor(idx,color)) return showToast(t('Each team needs a different color.','يجب اختيار لون مختلف لكل فريق.'));
      state.teamDraft[idx].color=color;
      updateTeamColorUI(idx);
    });
    document.querySelectorAll('[data-team-color-custom]').forEach(input=>input.addEventListener('input',()=>{
      const idx=Number(input.dataset.teamColorCustom);
      syncTeamDraftFromDOM(true);
      const color=input.value;
      if(hasDuplicateTeamColor(idx,color)) {
        input.value=state.teamDraft[idx].color || teamColorAt(idx);
        return showToast(t('That color is already used by another team. Choose a different shade.','هذا اللون مستخدم لفريق آخر. اختر درجة مختلفة.'));
      }
      state.teamDraft[idx].color=color;
      updateTeamColorUI(idx);
    }));
    document.querySelectorAll('[data-remove-team]').forEach(btn=>btn.onclick=()=>{
      if(state.teamDraft.length<=1)return showToast(t('At least one team is required.','يجب إضافة فريق واحد على الأقل.'));
      syncTeamDraftFromDOM();
      state.teamDraft.splice(Number(btn.dataset.removeTeam),1);
      render();
    });
    document.getElementById('continueTeams').onclick=async()=>{
      syncTeamDraftFromDOM();
      const names=state.teamDraft.map(team=>team.name);
      if(!names.length||names.some(x=>!x))return showToast(t('Enter a name for every team.','اكتب اسماً لكل فريق.'));
      const colors=state.teamDraft.map(team=>String(team.color||'').toLowerCase());
      if(new Set(colors).size!==colors.length)return showToast(t('Choose a different color for every team.','اختر لوناً مختلفاً لكل فريق.'));
      state.teams=state.teamDraft.map((team,i)=>({name:team.name,avatar:team.avatar||'😀',color:team.color||teamColorAt(i),score:0}));
      state.teamDraft=state.teams.map(x=>({...x}));state.progress={};state.turn=0;
      try{state.db=await loadDatabase();state.page='select';render();}
      catch(_){showToast(t('Could not load the question database.','تعذر تحميل قاعدة الأسئلة.'));}
    };
  }
  function teamSetupHtml(team,index) {
    const color=team.color||teamColorAt(index);
    return `<div class="team-setup-card" data-team-card="${index}" style="--team-color:${escapeHtml(color)}">
      <div class="team-card-heading"><h3>${t('Team','الفريق')} ${index+1}</h3><button class="danger-btn" data-remove-team="${index}" type="button">✕ ${t('Remove','حذف')}</button></div>
      <div class="field"><label class="input-label" for="team-${index}">${t('Team name','اسم الفريق')}</label><input data-team-name class="text-input" id="team-${index}" value="${escapeHtml(team.name)}" placeholder="${t('Type a team name','اكتب اسم الفريق')}" maxlength="32"></div>
      <div class="field"><span class="input-label">${t('Choose a team color','اختر لون الفريق')}</span><div class="team-color-grid">${teamColors.map(c=>`<button type="button" class="team-color-choice ${c===color?'selected':''}" data-team="${index}" data-color="${c}" style="--swatch:${c}" title="${c}" aria-label="${t('Choose color','اختر اللون')} ${c}"></button>`).join('')}</div>
        <label class="custom-color-label" for="team-color-${index}">${t('Custom color','لون مخصص')} <input type="color" id="team-color-${index}" data-team-color-custom="${index}" value="${escapeHtml(color)}" aria-label="${t('Choose a custom team color','اختر لوناً مخصصاً للفريق')}"></label>
      </div>
      <div class="field"><span class="input-label">${t('Team emoji','رمز الفريق')}</span><div class="avatar-entry"><span class="avatar-preview" data-avatar-preview="${index}">${avatarText(team)}</span><input data-team-avatar-input="${index}" class="text-input emoji-text-input" value="${escapeHtml(team.avatar||'😀')}" maxlength="8" autocomplete="off" spellcheck="false" placeholder="😀" aria-label="${t('Type an emoji from your keyboard','اكتب رمزاً تعبيرياً من لوحة المفاتيح')}"></div><p class="emoji-hint">${t('Pick one below or type/paste an emoji using your keyboard.','اختر رمزاً أدناه أو اكتبه/الصقه مباشرة من لوحة المفاتيح.')}</p>
        <div class="avatar-grid">${avatars.map(a=>`<button type="button" class="avatar-choice ${team.avatar===a?'selected':''}" data-team="${index}" data-avatar="${a}" aria-label="${t('Choose emoji','اختر الرمز')} ${a}">${a}</button>`).join('')}</div>
      </div>
    </div>`;
  }

  function renderTopbar(title='') {
    return `<div class="topbar"><div class="topbar-row">
      <div class="team-strip">${scoreCells(...state.teams.map((_,i)=>i))}</div>
      <div class="topbar-title">${escapeHtml(title || t('TEAM QUIZ ARENA','ساحة تحدي الفرق'))}</div>
      <div class="header-actions" style="justify-content:flex-end;"><button class="secondary-btn" id="muteBtn" title="Sound">${FX.isMuted()?'🔇':'🔊'}</button><button class="secondary-btn" id="backCategories">${t('← Categories','← التصنيفات')}</button></div>
    </div></div>`;
  }
  function scoreCells(...indices) {
    return indices.map(i => {
      const team = state.teams[i];
      if (!team) return `<div class="team-score" style="opacity:.3">—</div>`;
      return `<div class="team-score ${i===state.turn&&state.page!=='winner'?'turn':''}" data-team="${i}" style="--team-color:${escapeHtml(team.color||teamColorAt(i))}"><div class="name"><span class="avatar">${avatarText(team)}</span><span title="${escapeHtml(team.name)}">${escapeHtml(team.name)}</span></div><div class="score">${team.score}</div></div>`;
    }).join('');
  }
  function wireBack() {
    wireMute();
    document.getElementById('backCategories')?.addEventListener('click', () => {
      if (state.currentQuestion?.id) { state.used.delete(state.currentQuestion.id); saveUsed(); }
      stopTimer();
      state.activeCategory=null; state.currentQuestion=null; state.currentTurnForQuestion=null;
      state.page='categories'; render();
    });
  }

  const visibleCategories = () => state.db.categories.filter(c => state.selected?.has(c.id));
  const requiredPerCategory = 4;
  function teamCategoryCount(teamIndex,categoryId){return Number(state.progress[`${teamIndex}:${categoryId}`]||0);}
  function allRoundsComplete(){return state.teams.every((_,ti)=>[...state.selected].every(cid=>teamCategoryCount(ti,cid)>=requiredPerCategory));}

  function renderSelect() {
    if (!state.db) { state.page = 'teams'; return render(); }
    const cats = state.db.categories;
    if (!state.selected) state.selected = new Set(cats.slice(0,6).map(c => c.id));
    state.selected = new Set([...state.selected].filter(id => cats.some(c => c.id === id)));
    const sel = state.selected;
    app.innerHTML = `<div class="screen"><div class="page"><div class="container">
      <div class="page-header"><div><h2>${t('Pick your categories','اختاروا التصنيفات')}</h2><p class="footer-note">${t('Tick the categories you want to play.','ضعوا علامة على التصنيفات التي تريدون لعبها.')}</p></div>
        <div class="header-actions"><button class="secondary-btn" id="selAll">☑ ${t('Select first 6','اختيار أول 6')}</button><button class="secondary-btn" id="selNone">☐ ${t('Clear','مسح')}</button></div></div>
      <div class="select-grid">${cats.map((c, i) => `<button type="button" class="select-card ${sel.has(c.id) ? 'checked' : ''}" style="--i:${i}" data-cat="${escapeHtml(c.id)}" aria-pressed="${sel.has(c.id)}"><span class="check">✓</span><span class="select-icon">${c.icon || '❓'}</span><span class="select-name">${escapeHtml(c.name)}</span><span class="select-count">${c.questions?.length || 0} ${t('question(s)','سؤال')}</span></button>`).join('')}</div>
      <div class="panel" style="display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap;">
        <strong id="selCount"></strong>
        <div class="header-actions"><button class="secondary-btn" id="backTeams">${t('← Teams','← الفرق')}</button><button class="primary-btn" id="goCategories">${t('Start Playing','ابدأ اللعب')} →</button></div>
      </div></div></div></div>`;
    const update = () => {
      document.querySelectorAll('.select-card').forEach(b => { const on = state.selected.has(b.dataset.cat); b.classList.toggle('checked', on); b.setAttribute('aria-pressed', on); });
      document.getElementById('selCount').textContent = `${state.selected.size}/6 ${t('selected','محدد')}`;
    };
    update();
    document.querySelectorAll('.select-card').forEach(b => b.onclick = () => { const id = b.dataset.cat; if(state.selected.has(id))state.selected.delete(id);else{if(state.selected.size>=6)return showToast(t('Choose up to 6 categories only.','يمكن اختيار 6 تصنيفات كحد أقصى.'));state.selected.add(id);}update(); });
    document.getElementById('selAll').onclick = () => { state.selected=new Set(cats.slice(0,6).map(c=>c.id)); update(); };
    document.getElementById('selNone').onclick = () => { state.selected.clear(); update(); };
    document.getElementById('backTeams').onclick = () => { state.page = 'teams'; render(); };
    document.getElementById('goCategories').onclick = () => {
      if (!state.selected.size) return showToast(t('Select at least one category.','اختر تصنيفاً واحداً على الأقل.')); if(state.selected.size>6)return showToast(t('Choose up to 6 categories only.','يمكن اختيار 6 تصنيفات كحد أقصى.'));
      state.page = 'categories'; render();
    };
  }

  function renderCategories() {
    if (!state.db) { state.page='teams'; return render(); }
    if (!state.selected?.size) { state.page='select'; return render(); }
    app.innerHTML = `<div class="screen">${renderTopbar(t('Choose a category','اختر تصنيفاً'))}<div class="page"><div class="container">
      ${turnBannerHtml()}<div class="page-header"><div><h2>${t('Categories','التصنيفات')}</h2><p class="footer-note">${t('Each team answers 4 questions per selected category.','لكل فريق 4 أسئلة من كل تصنيف مختار.')}</p></div><div class="header-actions"><button class="secondary-btn" id="editCats">🗂 ${t('Change categories','تغيير التصنيفات')}</button><button class="primary-btn" id="finishGame">🏆 ${t('Finish Game','إنهاء اللعبة')}</button></div></div>
      <div class="categories-grid">${visibleCategories().map((c,i)=>{const done=teamCategoryCount(state.turn,c.id)>=requiredPerCategory;return `<button class="category-card ${done?'category-done':''}" style="--i:${i}" data-category="${escapeHtml(c.id)}" ${done?'disabled':''}><div class="category-title">${escapeHtml(c.name)}</div><div class="category-box">${c.icon||'❓'}</div><div class="category-footer">${teamCategoryCount(state.turn,c.id)}/${requiredPerCategory} ${t('questions for this team','أسئلة لهذا الفريق')} ${done?'✓':''}</div></button>`}).join('')}</div>
    </div></div></div>`;
    wireBack();
    document.querySelectorAll('[data-category]').forEach(btn => btn.onclick = () => startCategory(btn.dataset.category));
    document.getElementById('editCats').onclick = () => { state.page = 'select'; render(); };
    document.getElementById('finishGame').onclick = () => { if(!allRoundsComplete())return showToast(t('Finish all team rounds before showing the winners.','أكمل جولات جميع الفرق قبل عرض الفائزين.'));state.page='winner';render(); };
  }

  function startCategory(categoryId) {
    const category = state.db.categories.find(c => c.id === categoryId);
    if (!category) return;
    if(teamCategoryCount(state.turn,categoryId)>=requiredPerCategory)return showToast(t('This team has finished this category.','أنهى هذا الفريق أسئلة هذا التصنيف.'));
    state.currentTurnForQuestion = state.turn;
    state.activeCategory = category;
    state.currentQuestion = pickQuestion(category);
    state.used.add(state.currentQuestion.id);
    state.lastId = state.currentQuestion.id;
    saveUsed();
    FX.sfx('pop');
    state.page='question';
    render();
  }

  function crosswordHtml(puzzle) {
    if (!puzzle) return '';
    const w = Number(puzzle.width || 0), h = Number(puzzle.height || 0);
    if (!w || !h || w > 16 || h > 16) return '';
    const occupied = new Set((puzzle.cells || []).map(([r,c]) => `${r}:${c}`));
    const across = (puzzle.acrossStart || []).join(':');
    const down = (puzzle.downStart || []).join(':');
    let cells = '';
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const key = `${r}:${c}`;
      if (occupied.has(key)) {
        const number = `${key === across ? '1' : ''}${key === down ? '2' : ''}`;
        cells += `<div class="crossword-cell" aria-label="${t('Blank crossword square','مربع فارغ للكلمات المتقاطعة')}">${number ? `<small>${number}</small>` : ''}</div>`;
      } else cells += '<div class="crossword-empty"></div>';
    }
    return `<div class="crossword-wrap"><div class="crossword-grid" style="grid-template-columns:repeat(${w},minmax(26px,42px));grid-template-rows:repeat(${h},minmax(26px,42px))">${cells}</div><p class="crossword-hint">${t('Fill the numbered across and down entries.','أكمل الكلمات الأفقية والرأسية المرقمة.')}</p></div>`;
  }

  function renderQuestion() {
    const q = state.currentQuestion;
    if (!q) return renderCategories();
    const initial = Number(q.timer ?? CFG.defaultTimerSeconds ?? 30);
    state.timerLeft = initial; state.timerInit = initial;
    app.innerHTML = `<div class="screen">${renderTopbar(state.activeCategory?.name || '')}<div class="page"><div class="container">
      <div class="page-header"><div><h2>${t('Question','السؤال')}</h2><p class="footer-note">${t('Press Start Timer when the host is ready.','اضغط ابدأ المؤقت عندما يكون مقدم اللعبة مستعداً.')}</p></div><div><span class="hero-badge">+${q.points} ${t('points','نقطة')}</span></div></div>
      <div class="question-wrap">
        <div class="panel timer-card" id="timerCard"><div style="text-align:center;font-weight:800;">${t('Timer','المؤقت')}</div><div class="timer-circle" id="timerCircle" style="--p:100">${state.timerLeft}</div><button class="primary-btn" id="startTimer">▶ ${t('Start Timer','ابدأ المؤقت')}</button><div class="footer-note" id="timerHint">${t('Timer is not running.','المؤقت غير قيد التشغيل.')}</div></div>
        <div class="panel question-card"><div><div class="question-number">${t('Question','السؤال')} • ${escapeHtml(q.crossword ? 'CROSSWORD' : (q.type || 'text').toUpperCase())}</div><div class="question-text">${escapeHtml(q.question || '')}</div>${crosswordHtml(q.crossword)}${mediaHtml(q.media,q.type)}</div><div><button class="primary-btn" id="revealAnswer">${t('Reveal Answer','إظهار الإجابة')} →</button></div></div>
      </div>
    </div></div></div>`;
    wireBack();
    document.getElementById('startTimer').onclick=()=>startTimer();
    document.getElementById('revealAnswer').onclick=()=>{stopTimer();state.page='answer';render();};
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
    if (resolvedType === 'image') return `<div class="media-frame image-frame"><img src="${escapeHtml(url)}" alt="${t('Quiz picture','صورة السؤال')}" decoding="async"></div>`;
    if (resolvedType === 'audio') return `<div class="media-frame audio-box"><div class="media-caption">♫ ${t('Listen to the clip','استمع إلى المقطع')}</div><audio controls preload="none" src="${escapeHtml(url)}">${t('Your browser does not support audio playback.','متصفحك لا يدعم تشغيل الصوت.')}</audio></div>`;
    if (resolvedType === 'video') return `<div class="media-frame video-frame"><video controls playsinline preload="metadata"><source src="${escapeHtml(url)}" type="video/mp4">${t('Your browser does not support video playback.','متصفحك لا يدعم تشغيل الفيديو.')}</video></div>`;
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
    const buttons = state.teams.map((team, i) => `<button class="claim-btn" data-claim="${i}"><span class="avatar" style="width:50px;height:50px;margin:0 auto 8px;font-size:26px;">${avatarText(team)}</span><span class="claim-name">${escapeHtml(team.name)}</span><span class="claim-points">+${q.points} ${t('points','نقطة')}</span></button>`).join('');
    app.innerHTML = `<div class="screen">${renderTopbar(state.activeCategory?.name || '')}<div class="page"><div class="container">
      <div class="page-header"><div><h2>${t('Who answered correctly?','من أجاب بشكل صحيح؟')}</h2><p class="footer-note">${t('Choose one team, or choose “No one”.','اختر فريقاً واحداً أو اختر «لا أحد».')}</p></div></div>
      <div class="claim-grid">${buttons}<button class="claim-btn none" id="claimNone"><span class="claim-name">✖ ${t('No one','لا أحد')}</span><span class="claim-points">${t('No points added','بدون نقاط')}</span></button></div>
    </div></div></div>`;
    wireBack();
    document.querySelectorAll('[data-claim]').forEach(btn => btn.onclick = () => claim(Number(btn.dataset.claim)));
    document.getElementById('claimNone').onclick = () => { const owner=state.currentTurnForQuestion ?? state.turn; const cid=state.activeCategory?.id; if(cid)state.progress[`${owner}:${cid}`]=teamCategoryCount(owner,cid)+1; FX.sfx('buzzer'); advanceTurn(); state.currentQuestion=null; state.currentTurnForQuestion=null; state.page=allRoundsComplete()?'winner':'categories';render();};
  }

  function claim(teamIndex) {
    const from = state.teams[teamIndex].score;
    const owner = state.currentTurnForQuestion ?? state.turn;
    const categoryId = state.activeCategory?.id;
    if (categoryId) state.progress[`${owner}:${categoryId}`] = teamCategoryCount(owner,categoryId) + 1;
    state.teams[teamIndex].score += Number(state.currentQuestion?.points || 0);
    advanceTurn();
    state.page = allRoundsComplete() ? 'winner' : 'categories';
    state.currentQuestion = null;
    state.currentTurnForQuestion = null;
    render();
    FX.sfx('correct'); FX.confetti(); FX.bump(teamIndex, from, state.teams[teamIndex].score);
  }

  function renderWinner() {
    const ranked = [...state.teams].sort((a,b) => b.score-a.score);
    const groups = []; // teams with equal scores share one stand
    ranked.forEach(tm => { const g = groups[groups.length-1]; if (g && g[0].score === tm.score) g.push(tm); else groups.push([tm]); });
    app.innerHTML = `<div class="screen"><div class="topbar"><div class="topbar-row"><div class="team-strip">${scoreCells(...state.teams.map((_,i)=>i))}</div><div class="topbar-title">🏆 ${t('Winners','الفائزون')}</div><div class="header-actions" style="justify-content:flex-end;"><button class="secondary-btn" id="muteBtn" title="Sound">${FX.isMuted()?'🔇':'🔊'}</button><button class="secondary-btn" id="backCategories">${t('← Categories','← التصنيفات')}</button></div></div></div><div class="page"><div class="container">
      <div class="winner-banner"><div class="party-cones party-cones-left">🎉　🎊　🎉　🎊　🎉</div><div class="winner-ribbon">🏆 ${t('CHAMPIONS!','الأبطال!')} 🏆</div><div class="party-cones party-cones-right">🎊　🎉　🎊　🎉　🎊</div></div><div class="page-header"><div><h2>${t('Final Standings','الترتيب النهائي')}</h2><p class="footer-note">${t('Tied teams share the same stand.','الفرق المتعادلة تتشارك المنصة نفسها.')}</p></div></div>
      <div class="panel"><div class="podium">${podiumPlace(groups[1],1)}${podiumPlace(groups[0],0)}${podiumPlace(groups[2],2)}</div></div>
      <div class="panel standings-panel"><h3>${t('All team results','نتائج جميع الفرق')}</h3><div class="standings-list">${ranked.map((tm,i)=>`<div class="standing-row" style="--team-color:${escapeHtml(tm.color||teamColorAt(i))}"><span class="standing-rank">${i+1}</span><span class="standing-avatar">${avatarText(tm)}</span><strong class="standing-name">${escapeHtml(tm.name)}</strong><span class="standing-score">${tm.score} ${t('pts','نقطة')}</span></div>`).join('')}</div></div>
      <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:22px;"><button class="primary-btn" id="replay">↻ ${t('Same teams, start from zero','نفس الفرق، ابدأ من الصفر')}</button><button class="secondary-btn" id="newGame">🏠 ${t('Back to start (new teams)','العودة للبداية (فرق جديدة)')}</button></div>
    </div></div></div>`;
    wireBack();
    FX.sfx('fanfare'); FX.confetti(260);
    document.getElementById('replay').onclick = () => { resetGameData(); state.page='categories';render();};
    document.getElementById('newGame').onclick = () => { resetGameData(); state.teams = []; state.teamDraft=[]; state.selected = null; state.page = 'landing'; render(); };
  }

  function podiumPlace(group, i) {
    if (!group) return '<div class="podium-place"></div>';
    const n = group.length, medal = ['🥇','🥈','🥉'][i];
    const people = group.map(tm => `<div class="podium-person" style="--team-color:${escapeHtml(tm.color||teamColorAt(state.teams.indexOf(tm)))}"><div class="big-avatar">${avatarText(tm)}</div><div class="winner-name">${escapeHtml(tm.name)}</div></div>`).join('');
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
