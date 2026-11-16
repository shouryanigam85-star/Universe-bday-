(() => {
  'use strict';
  const CFG = window.BIRTHDAY_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = {
    entered: false,
    discovered: new Set(),
    vaultUnlocked: false,
    soundOn: false,
    activePage: null,
    activeGalleryFilter: 'All Moments',
    extraMemories: [],
    openedStars: new Set(),
    savedAdventures: new Set(),
    openedLetters: new Set(),
    audioUrl: CFG.musicSrc || '',
    audioFromUpload: false,
    audioObjectUrl: null,
    audioContext: null,
    toastTimer: null,
    orbitSuppressUntil: 0
  };

  const pageMeta = {
    memories: { index: '01 / SWEET MEMORIES', title: 'Our <em>memories.</em>', intro: 'A gallery of moments worth keeping forever. Add real photos, the stories behind them and the little details only the two of you understand.', footer: 'Every photo is a tiny time machine.' },
    timeline: { index: '02 / OUR STORY', title: 'The story <em>so far.</em>', intro: 'Not every important moment is a big milestone. This timeline holds the big chapters and the beautiful ordinary moments in between.', footer: 'Our best stories are still being written.' },
    'little-things': { index: '03 / SMALL JOYS', title: 'The little things that make you <em>who you are.</em>', intro: 'Tap a star to discover one small reason why this universe shines brighter because of you. Each note can be personalized with real qualities and inside jokes.', footer: 'Sometimes the little things mean the most.' },
    'birthday-cake': { index: '04 / MAKE A WISH', title: 'A birthday ritual, <em>just for you.</em>', intro: 'Light all the candles, make a wish and leave the confetti to the universe. Keep your wish to yourself — there is no need to tell anyone.', footer: 'May this year bring something beautiful into your life.' },
    'letter-vault': { index: '05 / WORDS FROM THE HEART', title: 'Little letters, <em>to read whenever you need them.</em>', intro: 'Some words deserve their own envelope. Open whichever letter you need, whenever you need it. The birthday letter is waiting here for you too.', footer: 'Whenever you need a little starlight, read these words again.' },
    'music-room': { index: '06 / OUR SOUNDTRACK', title: 'One song, <em>a world of feelings.</em>', intro: 'A single song can bring back an entire memory. Add the track that is special to both of you and give it a place in this little universe.', footer: 'Some memories have a soundtrack of their own.' },
    dreams: { index: '07 / CHAPTERS AHEAD', title: 'Everything still <em>waiting to be done.</em>', intro: 'A list of places, plans, new experiences and a few crazy adventures waiting for you in the future.', footer: 'One day these plans will become memories too.' },
    'secret-vault': { index: '08 / A LITTLE RIDDLE', title: 'One star is still <em>hiding.</em>', intro: 'Before you reach the final surprise, there is one little riddle to solve. Think about what makes something truly personal.', footer: 'The secret was never that far away.' },
    'final-surprise': { index: '09 / THE FINAL STAR', title: 'The universe saved this <em>just for you.</em>', intro: 'One last message from the heart. Take a moment here — beyond the stars and animations, this is what matters most.', footer: 'A new orbit begins. Happy Birthday.' }
  };

  const titles = Object.fromEntries((CFG.navigation || []).map(item => [item.id, item.name]));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const normalize = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3100);
  }

  function playSfx(kind = 'tap') {
    if (!state.soundOn) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!state.audioContext) state.audioContext = new AudioContextClass();
      const ctx = state.audioContext;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const tones = kind === 'success' ? [659.25, 783.99, 987.77] : kind === 'open' ? [587.33, 739.99] : [659.25];
      tones.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, now + index * .075);
        gain.gain.setValueAtTime(.0001, now + index * .075);
        gain.gain.exponentialRampToValueAtTime(kind === 'success' ? .035 : .018, now + index * .075 + .018);
        gain.gain.exponentialRampToValueAtTime(.0001, now + index * .075 + .24);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now + index * .075); osc.stop(now + index * .075 + .26);
      });
    } catch (_) { /* Sound effects are optional; never block the experience. */ }
  }

  function updateProgress() {
    $('#discovery-count').textContent = String(state.discovered.size);
    $$('.planet[data-page]').forEach(button => {
      const id = button.dataset.page;
      button.classList.toggle('is-discovered', state.discovered.has(id));
      if (id === 'final-surprise') {
        button.classList.toggle('is-locked', !state.vaultUnlocked);
        button.setAttribute('aria-label', state.vaultUnlocked ? 'Explore the final surprise' : 'Final surprise — unlocks after solving the Secret Vault');
      }
    });
    $('#final-planet-meta').textContent = state.vaultUnlocked ? '09 · your final star' : '09 · unlock the magic';
  }

  function renderPlanetNavigation() {
    const navigation = CFG.navigation || [];
    $('#quick-menu-links').innerHTML = navigation.map(item => `
      <button class="quick-menu-link" type="button" data-page="${esc(item.id)}"><span class="quick-menu-number">${esc(item.number)}</span><span class="quick-menu-text">${esc(item.name)}</span>${item.id === 'final-surprise' && !state.vaultUnlocked ? '<span class="lock-symbol">⌑</span>' : ''}</button>`).join('');
  }

  function playIntroShimmer() {
    // A single, very soft chime after the visitor's explicit Enter / Skip action.
    // No audio is created during page load and there is no looping ambient bed.
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!state.audioContext) state.audioContext = new AudioContextClass();
      const ctx = state.audioContext;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      [784, 1174.66, 1567.98].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = index === 0 ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(frequency * .96, now);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.025, now + .42 + index * .06);
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.exponentialRampToValueAtTime(index === 2 ? .003 : .006, now + .035 + index * .025);
        gain.gain.exponentialRampToValueAtTime(.0001, now + .82 + index * .08);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.start(now); oscillator.stop(now + .92 + index * .08);
      });
    } catch (_) { /* Audio is an enhancement, never a blocker. */ }
  }

  function enterUniverse() {
    if (state.entered) return;
    state.entered = true;
    playIntroShimmer();
    $('#app').classList.remove('is-hidden');
    $('#intro').classList.add('is-leaving');
    document.body.classList.add('has-entered', 'is-entering-universe');
    const galaxy = $('#galaxy-home');
    galaxy.classList.remove('portal-arrival');
    void galaxy.offsetWidth;
    galaxy.classList.add('portal-arrival');
    setTimeout(() => { $('#intro').hidden = true; document.body.classList.remove('is-entering-universe'); }, 1250);
    setTimeout(() => galaxy.classList.remove('portal-arrival'), 1900);
    playSfx('open');
  }

  function openHome() {
    state.activePage = null;
    $('#page-view').hidden = true;
    $('#galaxy-home').hidden = false;
    $('#quick-menu').hidden = true;
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function openPage(id) {
    if (!pageMeta[id]) return;
    if (id === 'final-surprise' && !state.vaultUnlocked) {
      showToast('Just one little riddle left. The Secret Vault is waiting for you.');
      openPage('secret-vault');
      return;
    }
    state.activePage = id;
    const wasDiscovered = state.discovered.has(id);
    state.discovered.add(id);
    updateProgress();
    if (!wasDiscovered) {
      const total = state.discovered.size;
      if (total === 3) { showToast('Badge unlocked: Star Seeker ✦ You have explored 3 worlds!'); playSfx('success'); }
      else if (total === 6) { showToast('Badge unlocked: Constellation Keeper ✧ Half the universe explored!'); playSfx('success'); }
      else if (total === 9) { showToast('Badge unlocked: Galaxy Explorer ✨ You have explored the whole universe!'); playSfx('success'); }
    }
    const meta = pageMeta[id];
    $('#page-index').textContent = meta.index;
    $('#page-footer-text').textContent = meta.footer;
    $('#galaxy-home').hidden = true;
    const view = $('#page-view');
    view.hidden = false;
    view.classList.remove('page-view');
    void view.offsetWidth;
    view.classList.add('page-view');
    $('#page-content').innerHTML = pageMarkup(id);
    $('#quick-menu').hidden = true;
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    playSfx('open');
    if (id === 'music-room') initializeAudioRoom();
    if (id === 'little-things') wireConstellationStars();
    if (id === 'birthday-cake') wireCake();
    if (id === 'memories') applyGalleryFilter();
  }

  function pageHero(id) {
    const meta = pageMeta[id];
    return `<header class="page-hero"><p class="section-eyebrow">${esc(meta.index)}</p><h2>${meta.title}</h2><p>${esc(meta.intro)}</p></header>`;
  }

  function pageMarkup(id) {
    switch (id) {
      case 'memories': return pageHero(id) + memoriesMarkup();
      case 'timeline': return pageHero(id) + timelineMarkup();
      case 'little-things': return pageHero(id) + littleThingsMarkup();
      case 'birthday-cake': return pageHero(id) + cakeMarkup();
      case 'letter-vault': return pageHero(id) + lettersMarkup();
      case 'music-room': return pageHero(id) + musicMarkup();
      case 'dreams': return pageHero(id) + dreamsMarkup();
      case 'secret-vault': return pageHero(id) + vaultMarkup();
      case 'final-surprise': return pageHero(id) + finalMarkup();
      default: return '';
    }
  }

  function memoriesMarkup() {
    const items = [...(CFG.memories || []), ...state.extraMemories];
    const categories = ['All Moments', ...new Set(items.map(item => item.category || 'Favorites'))];
    return `<div class="content-shell">
      <div class="gallery-toolbar"><div class="filter-row" role="group" aria-label="Filter memories">${categories.map(category => `<button type="button" class="filter-chip ${category === state.activeGalleryFilter ? 'is-active' : ''}" data-filter="${esc(category)}">${esc(category)}</button>`).join('')}</div><button class="secondary-button" type="button" data-action="upload-photos">＋ Add photos</button></div>
      <div id="memory-grid" class="memory-grid">${items.map((item, index) => memoryCard(item, index)).join('')}</div>
    </div>`;
  }

  function memoryCard(item, index) {
    return `<button class="memory-card" type="button" data-memory-index="${index}" data-category="${esc(item.category || 'Favorites')}" aria-label="Open memory: ${esc(item.title)}">
      <span class="card-arrow" aria-hidden="true">↗</span>
      <span class="memory-image-frame"><img src="${esc(item.image || '')}" alt="${esc(item.title)}" loading="lazy" data-memory-image></span>
      <span class="memory-card-content"><span class="memory-card-date">${esc(item.date || 'A memorable day')}</span><h3>${esc(item.title || 'A sweet little moment')}</h3><p>${esc(item.description || '')}</p></span>
    </button>`;
  }

  function applyGalleryFilter() {
    const selected = state.activeGalleryFilter;
    $$('.filter-chip', $('#page-content')).forEach(button => button.classList.toggle('is-active', button.dataset.filter === selected));
    $$('.memory-card', $('#page-content')).forEach(button => {
      button.hidden = selected !== 'All Moments' && button.dataset.category !== selected;
    });
  }

  function timelineMarkup() {
    return `<div class="content-shell"><div class="timeline">${(CFG.timeline || []).map((item, index) => `
      <article class="timeline-item"><div class="timeline-marker"><span>${index === (CFG.timeline || []).length - 1 ? '✦' : ''}</span></div><div class="timeline-card"><span class="small-label">${esc(item.marker || `CHAPTER ${String(index + 1).padStart(2, '0')}`)}</span><h3>${esc(item.title)}</h3><span class="timeline-date">${esc(item.date || 'A day worth keeping')}</span><p>${esc(item.description || '')}</p></div></article>`).join('')}</div><div class="adventure-summary"><span>✧ &nbsp; </span><span>${(CFG.timeline || []).length} chapters</span></div></div>`;
  }

  const starPositions = [ [15,22],[37,14],[63,18],[82,32],[72,58],[51,77],[28,69],[18,48],[47,44] ];
  function littleThingsMarkup() {
    const items = CFG.littleThings || [];
    return `<div class="content-shell constellation-layout"><div class="constellation-map" aria-label="Interactive constellation of little things">${items.map((item,index) => {
      const [x,y] = starPositions[index % starPositions.length];
      return `<button type="button" class="constellation-star" style="left:${x}%;top:${y}%" data-star-index="${index}" aria-label="Tap to view: ${esc(item.title)}"><span>${esc(item.title)}</span>✦</button>`;
    }).join('')}<p class="constellation-caption">The constellation of little things</p></div><div><p class="small-label">A FEW REASONS YOU SHINE</p><div class="little-things-list">${items.map((item,index) => `<button type="button" class="little-thing-card" data-star-index="${index}"><span class="thing-star">✧</span><span class="thing-title">${esc(item.title)}</span><span class="thing-count">${String(index+1).padStart(2,'0')}</span><span class="thing-note">${esc(item.note)}</span></button>`).join('')}</div></div>`;
  }

  function wireConstellationStars() {
    $$('#page-content [data-star-index]').forEach(element => element.addEventListener('click', () => {
      const index = Number(element.dataset.starIndex);
      const wasFound = state.openedStars.has(index);
      state.openedStars.add(index);
      $$('.constellation-star[data-star-index]').forEach(star => star.classList.toggle('is-found', state.openedStars.has(Number(star.dataset.starIndex))));
      $$('.little-thing-card[data-star-index]').forEach(card => card.classList.toggle('is-open', Number(card.dataset.starIndex) === index));
      if (!wasFound) playSfx('tap');
    }));
  }

  function cakeMarkup() {
    const candleMarkup = Array.from({ length: 5 }, (_, i) => `<button class="candle" type="button" data-candle-index="${i}" aria-label="Light candle ${i + 1}" aria-pressed="false"><span class="candle-wick"></span><span class="candle-flame"></span></button>`).join('');
    const tier = (name, decoration) => `<div class="cake-tier ${name}"><span class="cake-frosting" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="cake-tier-trim" aria-hidden="true"></span><span class="cake-sprinkles" aria-hidden="true">${decoration}</span></div>`;
    return `<div class="content-shell"><div class="cake-stage"><div class="cake-moon" aria-hidden="true"></div><div class="cake-nebula" aria-hidden="true"></div><span class="cake-sparkle s1" aria-hidden="true">✧</span><span class="cake-sparkle s2" aria-hidden="true">✦</span><span class="cake-sparkle s3" aria-hidden="true">✧</span><span class="cake-sparkle s4" aria-hidden="true">✦</span><div class="cake" role="group" aria-label="Birthday cake with five candles to light"><div class="cake-topper" aria-hidden="true"><span>HAPPY</span><i>✦</i></div><div class="cake-candles">${candleMarkup}</div>${tier('tier-top','✦　·　✧　·　✦')}${tier('tier-middle','·　✦　·　✦　·')}${tier('tier-bottom','✧　·　✦　·　✧')}<div class="cake-plate"><span></span></div><div class="cake-plate-shadow"></div></div><div class="cake-message"><h3>One wish, a thousand possibilities.</h3><p>Light every candle, then make a wish that stays yours alone.</p></div></div><div class="cake-controls"><button class="primary-button" id="make-wish" type="button" disabled><span>Make a Wish</span><span class="button-arrow">✧</span></button><button class="secondary-button" type="button" data-action="reset-cake">Start over</button></div><div id="wish-result" aria-live="polite"></div></div>`;
  }

  function wireCake() {
    const candles = $$('.candle', $('#page-content'));
    candles.forEach(candle => candle.addEventListener('click', () => {
      candle.classList.toggle('is-lit');
      const isLit = candle.classList.contains('is-lit');
      candle.setAttribute('aria-pressed', String(isLit));
      candle.setAttribute('aria-label', `${isLit ? 'Blow out candle' : 'Light candle'} ${Number(candle.dataset.candleIndex) + 1}`);
      $('#make-wish').disabled = !candles.every(item => item.classList.contains('is-lit'));
      $('#wish-result').innerHTML = '';
      playSfx('tap');
    }));
    $('#make-wish').addEventListener('click', () => {
      candles.forEach(candle => { candle.classList.remove('is-lit'); candle.setAttribute('aria-pressed','false'); candle.setAttribute('aria-label',`Light candle ${Number(candle.dataset.candleIndex) + 1}`); });
      $('#make-wish').disabled = true;
      $('#wish-result').innerHTML = `<div class="wish-result">May your story ahead bring the kind of magic that gives you a reason to smile again and again. ✧</div>`;
      burstConfetti(); playSfx('success');
    });
  }

  function lettersMarkup() {
    const letters = CFG.letters || [];
    return `<div class="content-shell"><div class="envelope-grid">${letters.map((letter,index) => `<button class="envelope-card" type="button" data-letter-index="${index}" aria-expanded="false"><span class="envelope-illustration" aria-hidden="true"><span class="envelope-back"></span><span class="envelope-flap"></span><span class="envelope-seal">✦</span></span><span class="small-label">${esc(letter.label || 'A LITTLE NOTE')}</span><h3>${esc(letter.title)}</h3><p>${state.openedLetters.has(index) ? 'Opened · read it again anytime' : 'Sealed with a little stardust'}</p></button>`).join('')}</div><div id="letter-reading-slot"></div></div>`;
  }

  function openLetter(index) {
    const letter = (CFG.letters || [])[index];
    if (!letter) return;
    state.openedLetters.add(index);
    $$('.envelope-card').forEach(card => {
      const selected = Number(card.dataset.letterIndex) === index;
      card.classList.toggle('is-open', selected);
      card.setAttribute('aria-expanded', String(selected));
      const hint = $('p', card);
      if (hint) hint.textContent = selected ? 'Opened just for you' : (state.openedLetters.has(Number(card.dataset.letterIndex)) ? 'Opened · read it again anytime' : 'Sealed with a little stardust');
    });
    const isMainLetter = index === (CFG.letters || []).length - 1;
    const body = isMainLetter ? (CFG.birthdayLetter || letter.body) : letter.body;
    $('#letter-reading-slot').innerHTML = `<article class="letter-reading"><span class="small-label">${esc(letter.label || 'A LITTLE NOTE')}</span><h3>${esc(letter.title)}</h3><p>${esc(body)}</p><span class="letter-signature">With lots of warmth, ${esc(CFG.fromName || 'Someone who cares about you')} ✧</span></article>`;
    playSfx('open');
    $('#letter-reading-slot').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  function musicMarkup() {
    return `<div class="content-shell music-room-layout"><div id="album-art" class="album-art"><span class="album-art-label">THE SONG OF THIS CHAPTER</span></div><section class="glass-panel music-player-card"><span class="small-label">YOUR PERSONAL SOUNDTRACK</span><h3>${esc(CFG.musicTitle || 'Your soundtrack')}</h3><p>${esc(CFG.musicDescription || 'Choose the song that means something special to both of you.')}</p><div class="track-status"><span class="track-status-dot"></span><span id="track-status-text">${state.audioUrl ? 'Song is ready' : 'Waiting for your song'}</span></div><audio id="room-audio" preload="metadata" ${state.audioUrl ? `src="${esc(state.audioUrl)}"` : ''}></audio><input class="audio-progress" id="audio-progress" type="range" min="0" max="100" value="0" aria-label="Seek through the song"><div class="audio-time-row"><span id="audio-current-time">0:00</span><span id="audio-duration">0:00</span></div><div class="music-controls"><button id="audio-play" class="play-button" type="button" aria-label="Play song">▶</button><label class="volume-control" for="audio-volume">♫ <input id="audio-volume" type="range" min="0" max="1" step="0.05" value="0.8" aria-label="Song volume"></label></div><button class="secondary-button" type="button" data-action="upload-audio">＋ Choose audio file</button>`;
  }

  function initializeAudioRoom() {
    const audio = $('#room-audio');
    const progress = $('#audio-progress');
    const playButton = $('#audio-play');
    const status = $('#track-status-text');
    const setTime = (value) => {
      if (!Number.isFinite(value)) return '0:00';
      const mins = Math.floor(value / 60);
      const secs = Math.floor(value % 60).toString().padStart(2,'0');
      return `${mins}:${secs}`;
    };
    audio.volume = Number($('#audio-volume').value);
    if (state.audioUrl && !state.audioFromUpload) status.textContent = 'Song is ready · loaded from config';
    if (!state.audioUrl) status.textContent = 'Choose an audio file to begin';
    audio.addEventListener('loadedmetadata', () => { $('#audio-duration').textContent = setTime(audio.duration); });
    audio.addEventListener('timeupdate', () => {
      $('#audio-current-time').textContent = setTime(audio.currentTime);
      if (Number.isFinite(audio.duration) && audio.duration > 0) progress.value = String((audio.currentTime / audio.duration) * 100);
    });
    audio.addEventListener('play', () => {
      playButton.textContent = 'Ⅱ'; playButton.setAttribute('aria-label','Pause song');
      $('#album-art').classList.add('album-art-playing'); status.textContent = 'Now playing';
    });
    audio.addEventListener('pause', () => {
      playButton.textContent = '▶'; playButton.setAttribute('aria-label','Play song');
      $('#album-art').classList.remove('album-art-playing');
      if (audio.currentTime > 0) status.textContent = 'Paused';
    });
    audio.addEventListener('ended', () => { status.textContent = 'Song finished · play again'; });
    audio.addEventListener('error', () => { if (state.audioUrl) { status.textContent = 'This track could not be loaded'; showToast('Check the audio path in config.js or choose a local audio file.'); } });
    playButton.addEventListener('click', async () => {
      if (!state.audioUrl) { $('#audio-upload').click(); return; }
      if (audio.paused) {
        try { await audio.play(); } catch (_) { showToast('This track could not be played. Try choosing an audio file from your device.'); }
      } else audio.pause();
    });
    $('#audio-volume').addEventListener('input', event => { audio.volume = Number(event.target.value); });
    progress.addEventListener('input', event => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = audio.duration * (Number(event.target.value) / 100);
    });
    if (state.audioUrl) { audio.load(); }
  }

  function dreamsMarkup() {
    const adventures = CFG.adventures || [];
    return `<div class="content-shell"><div class="adventure-grid">${adventures.map((item,index) => `<button class="adventure-card ${state.savedAdventures.has(index) ? 'is-saved' : ''}" type="button" data-adventure-index="${index}" aria-pressed="${state.savedAdventures.has(index)}"><span class="adventure-tag">${esc(item.tag || 'SOMEDAY')}</span><h3>${esc(item.title)}</h3><p>${esc(item.description || '')}</p><span class="adventure-save">${state.savedAdventures.has(index) ? 'Saved to our list' : '＋ Save this idea'}</span></button>`).join('')}</div><div class="adventure-summary"><span id="saved-adventure-count">${state.savedAdventures.size} ideas saved for the future</span><button class="text-button" type="button" data-action="clear-adventures">Clear saved ideas</button`;
  }

  function vaultMarkup() {
    return `<div class="content-shell"><section class="glass-panel vault-panel"><div class="vault-art"><div class="vault-sparkles" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div><div class="vault-chest" aria-hidden="true"><div class="vault-chest-lid"></div><div class="vault-chest-base"></div><div class="vault-lock">✦</div></div></div><div class="vault-body"><span class="small-label">ONE LAST LITTLE RIDDLE</span><h3>${esc(CFG.vaultQuestion || 'What makes a universe unforgettable?')}</h3><p>One small question before the final star shines. There is no timer, and you are free to try as many times as you like.</p><div class="vault-hint">${esc(CFG.vaultHint || 'Think about the little things that make this place yours.')}</div><form id="vault-form" class="vault-form"><input class="vault-input" id="vault-answer" type="text" autocomplete="off" placeholder="Type your answer here…" aria-label="Answer to the secret vault riddle" required><button class="primary-button" type="submit"><span>Open the Vault</span><span class="button-arrow">↗</span></button></form><p id="vault-feedback" class="vault-feedback" aria-live="polite"></p><div id="vault-reveal" class="vault-reveal ${state.vaultUnlocked ? 'is-visible' : ''}"><h4>${esc(CFG.vaultSuccessTitle || 'You found its heart.')}</h4><p>${esc(CFG.vaultSuccessMessage || 'The final star is waiting for you.')}</p><button class="primary-button" type="button" data-page="final-surprise"><span>See the Final Surprise</span><span class="button-arrow">✦</span></button></div></div></section></div>`;
  }

  function finalMarkup() {
    return `<div class="content-shell final-stage"><div class="final-starfield"><div class="final-nebula final-nebula-one"></div><div class="final-nebula final-nebula-two"></div><div class="final-glow"></div><div class="final-constellation" aria-hidden="true"><svg viewBox="0 0 700 300" role="img" aria-label="A glowing heart-shaped constellation"><defs><linearGradient id="heartGlowLine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c7b6ff"/><stop offset=".52" stop-color="#f4d5a0"/><stop offset="1" stop-color="#e8a3bd"/></linearGradient><radialGradient id="heartStarCore"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#fff0c7"/><stop offset="1" stop-color="#f4d5a0" stop-opacity=".15"/></radialGradient></defs><path class="heart-outline" d="M350 244 C303 213 182 143 182 83 C182 25 258 10 350 92 C442 10 518 25 518 83 C518 143 397 213 350 244 Z"/><path class="heart-crossline" d="M182 83 L266 109 L350 92 L432 111 L518 83 M266 109 L281 169 L350 244 L418 168 L432 111 M281 169 L350 143 L418 168 M350 92 L350 143"/><path class="heart-orbit-line" d="M132 163 C188 256 270 275 350 273 C456 271 521 218 558 148"/><g class="heart-stars"><circle cx="182" cy="83" r="5"/><circle cx="226" cy="42" r="3.5"/><circle cx="266" cy="109" r="4"/><circle cx="303" cy="54" r="3"/><circle cx="350" cy="92" r="6"/><circle cx="350" cy="143" r="3.6"/><circle cx="397" cy="54" r="3"/><circle cx="432" cy="111" r="4"/><circle cx="474" cy="42" r="3.5"/><circle cx="518" cy="83" r="5"/><circle cx="281" cy="169" r="3.5"/><circle cx="350" cy="244" r="5"/><circle cx="418" cy="168" r="3.5"/><circle cx="132" cy="163" r="2.5"/><circle cx="558" cy="148" r="2.5"/></g><g class="heart-sparkles"><path d="M147 54 v14 M140 61 h14"/><path d="M551 55 v17 M542.5 63.5 h17"/><path d="M230 202 v12 M224 208 h12"/><path d="M480 211 v12 M474 217 h12"/><path d="M350 23 v18 M341 32 h18"/></g><text x="350" y="137" class="heart-name">${esc(CFG.herName || 'FOR YOU')}</text><text x="350" y="158" class="heart-caption">WRITTEN IN THE STARS</text></svg></div><div class="constellation-caption-top"><span class="constellation-star-icon">✦</span> ONE CONSTELLATION. A THOUSAND REASONS TO CHERISH YOU. <span class="constellation-star-icon">✦</span></div></div><div class="final-copy"><span class="section-eyebrow">TO ANOTHER BEAUTIFUL YEAR OF YOURS</span><h2>Keep shining, <em>${esc(CFG.herName || 'star')}.</em></h2><p>${esc(CFG.finalMessage || 'May your story ahead be full of small joys and sweet surprises.')}</p><div class="final-actions"><button class="primary-button" type="button" data-action="replay-intro"><span>Watch the beginning again</span><span class="button-arrow">↻</span></button><button class="secondary-button" type="button" data-go-home>Explore the universe again</button></div><div class="final-signature">With lots of love and a little stardust, ${esc(CFG.fromName || 'Someone who cares about you')} ✧</div></div></div>`;
  }

  function burstConfetti() {
    const colors = ['#f4d5a0','#c7b6ff','#e8a3bd','#a9e4d1','#8faaf8'];
    for (let i=0;i<46;i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-particle';
      piece.style.left = `${Math.random()*100}%`;
      piece.style.setProperty('--confetti-color', colors[i % colors.length]);
      piece.style.setProperty('--confetti-x', `${(Math.random()-.5)*240}px`);
      piece.style.setProperty('--confetti-y', `${70 + Math.random()*190}px`);
      piece.style.setProperty('--confetti-rotate', `${Math.random()*700-350}deg`);
      piece.style.animationDelay = `${Math.random()*.2}s`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1900);
    }
  }

  function replayIntro() {
    openHome();
    $('#app').classList.add('is-hidden');
    $('#intro').hidden = false;
    $('#intro').classList.remove('is-leaving');
    state.entered = false;
    document.body.classList.remove('is-entering-universe');
    void $('#intro').offsetWidth;
    $('#intro .intro-copy').style.animation = 'none';
    void $('#intro .intro-copy').offsetWidth;
    $('#intro .intro-copy').style.animation = '';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function chooseMedia(type) {
    const input = type === 'photos' ? $('#photo-upload') : $('#audio-upload');
    if (input) input.click();
  }

  function loadPhotos(files) {
    const imageFiles = [...files].filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) { showToast('Please choose one or more image files.'); return; }
    imageFiles.forEach(file => state.extraMemories.push({
      title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g,' '),
      date: 'Added for this preview', category: 'Added by you', image: URL.createObjectURL(file),
      description: 'A personal photo added from this device. To keep it on the published website, add its date and story in config.js.'
    }));
    state.activeGalleryFilter = 'All Moments';
    $('#page-content').innerHTML = pageMarkup('memories');
    applyGalleryFilter();
    showToast(`${imageFiles.length} photo(s) added to the preview.`);
  }

  function loadAudio(file) {
    if (!file || !file.type.startsWith('audio/')) { showToast('Please choose an audio file.'); return; }
    if (state.audioObjectUrl) URL.revokeObjectURL(state.audioObjectUrl);
    state.audioObjectUrl = URL.createObjectURL(file);
    state.audioUrl = state.audioObjectUrl;
    state.audioFromUpload = true;
    if (state.activePage === 'music-room') {
      $('#page-content').innerHTML = pageMarkup('music-room');
      initializeAudioRoom();
      $('#track-status-text').textContent = `Ready · ${file.name}`;
    }
    showToast('Your song is ready. Press play whenever you like.');
  }

  function submitVault(event) {
    event.preventDefault();
    const given = normalize($('#vault-answer').value);
    const correct = normalize(CFG.vaultAnswer || 'little things');
    const feedback = $('#vault-feedback');
    if (given && given === correct) {
      state.vaultUnlocked = true;
      feedback.textContent = 'The vault is open! The final star is ready to shine. ✧';
      feedback.classList.add('success');
      $('#vault-reveal').classList.add('is-visible');
      $('#vault-answer').blur();
      updateProgress();
      playSfx('success'); burstConfetti();
    } else {
      feedback.textContent = 'Not yet — think again. The hint might help.';
      feedback.classList.remove('success');
      playSfx('tap');
    }
  }

  function handleAction(action, element) {
    switch (action) {
      case 'upload-photos': chooseMedia('photos'); break;
      case 'upload-audio': chooseMedia('audio'); break;
      case 'reset-cake': {
        $$('.candle', $('#page-content')).forEach(candle => { candle.classList.remove('is-lit'); candle.setAttribute('aria-pressed','false'); candle.setAttribute('aria-label',`Light candle ${Number(candle.dataset.candleIndex)+1}`); });
        $('#make-wish').disabled = true; $('#wish-result').innerHTML = ''; showToast('The cake is ready for a brand-new wish.'); break;
      }
      case 'clear-adventures':
        state.savedAdventures.clear();
        if (state.activePage === 'dreams') $('#page-content').innerHTML = pageMarkup('dreams');
        showToast('Your someday list is clear — room for new ideas.'); break;
      case 'replay-intro': replayIntro(); break;
    }
  }

  function wireGlobalEvents() {
    $('#enter-universe').addEventListener('click', enterUniverse);
    $('#skip-intro').addEventListener('click', enterUniverse);
    $('#back-to-galaxy').addEventListener('click', openHome);
    $('#page-menu-button').addEventListener('click', () => {
      $('#quick-menu').hidden = !$('#quick-menu').hidden;
      $('#menu-toggle').setAttribute('aria-expanded', String(!$('#quick-menu').hidden));
    });
    $('#menu-toggle').addEventListener('click', () => {
      $('#quick-menu').hidden = !$('#quick-menu').hidden;
      $('#menu-toggle').setAttribute('aria-expanded', String(!$('#quick-menu').hidden));
    });
    $('#menu-close').addEventListener('click', () => { $('#quick-menu').hidden = true; $('#menu-toggle').setAttribute('aria-expanded','false'); });
    $('#sound-toggle').addEventListener('click', () => {
      state.soundOn = !state.soundOn;
      $('#sound-toggle').setAttribute('aria-pressed', String(state.soundOn));
      $('.sound-label', $('#sound-toggle')).textContent = state.soundOn ? 'SFX on' : 'SFX off';
      if (state.soundOn) playSfx('success');
      showToast(state.soundOn ? 'Small interface sounds are on.' : 'Interface sounds are muted.');
    });
    $('#how-to-explore').addEventListener('click', () => {
      $('#quick-menu').hidden = false;
      $('#menu-toggle').setAttribute('aria-expanded','true');
      showToast('Choose any planet to open a chapter. The Final Surprise unlocks when you solve the Secret Vault riddle.');
    });
    document.addEventListener('click', event => {
      const pageTarget = event.target.closest('[data-page]');
      if (pageTarget && pageTarget.closest('#orbit-stage') && performance.now() < state.orbitSuppressUntil) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (pageTarget) {
        event.preventDefault();
        openPage(pageTarget.dataset.page);
        return;
      }
      const homeTarget = event.target.closest('[data-go-home]');
      if (homeTarget) { event.preventDefault(); openHome(); return; }
      const actionTarget = event.target.closest('[data-action]');
      if (actionTarget) { handleAction(actionTarget.dataset.action, actionTarget); return; }
      const filter = event.target.closest('[data-filter]');
      if (filter && $('#page-content').contains(filter)) {
        state.activeGalleryFilter = filter.dataset.filter;
        applyGalleryFilter();
        playSfx('tap');
        return;
      }
      const memory = event.target.closest('[data-memory-index]');
      if (memory && $('#page-content').contains(memory)) {
        const all = [...(CFG.memories || []), ...state.extraMemories];
        const item = all[Number(memory.dataset.memoryIndex)];
        if (item) openMemory(item);
        return;
      }
      const letter = event.target.closest('[data-letter-index]');
      if (letter && $('#page-content').contains(letter)) { openLetter(Number(letter.dataset.letterIndex)); return; }
      const adventure = event.target.closest('[data-adventure-index]');
      if (adventure && $('#page-content').contains(adventure)) {
        const index = Number(adventure.dataset.adventureIndex);
        if (state.savedAdventures.has(index)) state.savedAdventures.delete(index); else state.savedAdventures.add(index);
        if (state.activePage === 'dreams') $('#page-content').innerHTML = pageMarkup('dreams');
        playSfx('tap');
        return;
      }
    });
    document.addEventListener('submit', event => { if (event.target && event.target.id === 'vault-form') submitVault(event); });
    $('#photo-upload').addEventListener('change', event => { loadPhotos(event.target.files || []); event.target.value = ''; });
    $('#audio-upload').addEventListener('change', event => { loadAudio(event.target.files && event.target.files[0]); event.target.value = ''; });
    $('#lightbox-close').addEventListener('click', () => $('#lightbox').close());
    $('#lightbox').addEventListener('click', event => { if (event.target === $('#lightbox')) $('#lightbox').close(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if ($('#quick-menu') && !$('#quick-menu').hidden) { $('#quick-menu').hidden = true; $('#menu-toggle').setAttribute('aria-expanded','false'); }
        if ($('#lightbox').open) $('#lightbox').close();
      }
    });
  }

  function openMemory(item) {
    const dialog = $('#lightbox');
    const image = $('#lightbox-image');
    const placeholder = $('#lightbox-placeholder');
    image.hidden = false; placeholder.hidden = true;
    image.onerror = () => { image.hidden = true; placeholder.hidden = false; };
    image.src = item.image || '';
    image.alt = item.title || 'Memory photo';
    $('#lightbox-title').textContent = item.title || 'A sweet little moment';
    $('#lightbox-description').textContent = item.description || '';
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open','');
    playSfx('open');
  }

  function setPersonalNames() {
    const herName = CFG.herName || 'Her Name Here';
    $('#intro-name').textContent = herName;
    $('#center-name').textContent = herName;
    const description = $('.intro-description');
    if (description) description.innerHTML = `${esc(CFG.introLine || 'Among billions of stars, there is no one quite like you.')}<br>${esc(CFG.introMessage || 'This little universe was made just for you.')}`;
    const subtitle = $('.home-subtitle');
    if (subtitle && CFG.homeSubtitle) subtitle.textContent = CFG.homeSubtitle;
    const centerCaption = $('.center-caption');
    if (centerCaption && CFG.birthdayLine) centerCaption.textContent = CFG.birthdayLine;
  }

  /* Drag-to-rotate orbital navigation. Buttons remain real destinations; there are no mobile cards. */
  function initOrbitControls() {
    const stage = $('#orbit-stage');
    if (!stage) return;
    const nodes = $$('.planet[data-page]', stage).map((element, index) => ({
      element,
      angle: [-155, -126, -89, -52, -20, 42, 89, 132, 158][index] ?? index * 40,
      phase: Math.random() * Math.PI * 2
    }));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rotation = 0;
    let inertia = 0;
    let pointer = null;
    let captureTarget = stage;
    let startX = 0;
    let lastX = 0;
    let moved = false;
    let lastTime = 0;
    let layoutWidth = 0;
    let layoutHeight = 0;

    function layout(time = 0) {
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      layoutWidth = rect.width; layoutHeight = rect.height;
      const mobile = matchMedia('(max-width: 760px)').matches;
      const radiusX = rect.width * (mobile ? .345 : .425);
      const radiusY = rect.height * (mobile ? .365 : .405);
      nodes.forEach((node, index) => {
        const angle = (node.angle + rotation) * Math.PI / 180;
        const x = rect.width / 2 + Math.cos(angle) * radiusX;
        const y = rect.height / 2 + Math.sin(angle) * radiusY;
        node.element.style.left = `${x}px`;
        node.element.style.top = `${y}px`;
        const depth = (Math.sin(angle) + 1) / 2;
        node.element.style.setProperty('--planet-depth', (0.93 + depth * .1).toFixed(3));
        node.element.style.opacity = (.86 + depth * .14).toFixed(3);
        node.element.style.zIndex = String(5 + Math.round(depth * 4));
      });
    }

    stage.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointer = event.pointerId; startX = lastX = event.clientX; moved = false; lastTime = performance.now(); inertia = 0;
      captureTarget = event.target.closest('.planet') || stage;
      stage.classList.add('is-dragging');
      try { captureTarget.setPointerCapture(pointer); } catch (_) {}
    });
    stage.addEventListener('pointermove', event => {
      if (pointer !== event.pointerId) return;
      const dx = event.clientX - lastX;
      if (Math.abs(event.clientX - startX) > 4) moved = true;
      if (moved) {
        const sensitivity = matchMedia('(max-width: 760px)').matches ? 1.08 : .72;
        rotation += dx * sensitivity;
        inertia = Math.max(-2.8, Math.min(2.8, dx * sensitivity * .18));
        if (event.cancelable) event.preventDefault();
        layout(performance.now());
      }
      lastX = event.clientX; lastTime = performance.now();
    }, { passive: false });
    const release = event => {
      if (pointer !== event.pointerId) return;
      if (moved) state.orbitSuppressUntil = performance.now() + 260;
      pointer = null;
      stage.classList.remove('is-dragging');
      try { captureTarget.releasePointerCapture(event.pointerId); } catch (_) {}
      captureTarget = stage;
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('lostpointercapture', release);
    stage.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); rotation += event.key === 'ArrowRight' ? 18 : -18; inertia = 0; layout(performance.now());
      }
    });
    window.addEventListener('resize', () => layout(performance.now()), { passive: true });

    const dust = $('#orbit-dust');
    if (dust && !dust.children.length) {
      for (let i = 0; i < 36; i++) {
        const point = document.createElement('i');
        point.className = 'orbit-dust-point';
        point.style.left = `${Math.random() * 100}%`;
        point.style.top = `${Math.random() * 100}%`;
        point.style.setProperty('--dust-size', `${Math.random() * 2 + .7}px`);
        point.style.setProperty('--dust-delay', `${Math.random() * -8}s`);
        point.style.setProperty('--dust-duration', `${5 + Math.random() * 8}s`);
        dust.appendChild(point);
      }
    }
    layout();
    function animate(time) {
      const visible = !document.hidden && state.entered && !$('#galaxy-home').hidden;
      if (visible && pointer === null && Math.abs(inertia) > .025) {
        rotation += inertia;
        inertia *= .935;
        layout(time);
      } else if (Math.abs(inertia) <= .025) {
        inertia = 0;
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  /* A small, short-lived stardust trail follows mouse movement, never touch input. */
  function initCursorTrail() {
    if (matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches) return;
    let last = 0;
    document.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' || performance.now() - last < 38) return;
      const insideExperience = event.target.closest('#intro, #orbit-stage');
      if (!insideExperience) return;
      last = performance.now();
      const spark = document.createElement('span');
      spark.className = 'cursor-trail-spark';
      spark.style.left = `${event.clientX}px`;
      spark.style.top = `${event.clientY}px`;
      spark.style.setProperty('--spark-drift', `${(Math.random() - .5) * 24}px`);
      spark.style.setProperty('--spark-size', `${Math.random() * 3 + 1.5}px`);
      document.body.appendChild(spark);
      spark.addEventListener('animationend', () => spark.remove(), { once: true });
    }, { passive: true });
  }

  /* A light procedural starfield: no image or external rendering library required. */
  function initStarfield() {
    const canvas = $('#starfield');
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0, height = 0, ratio = 1, stars = [], shooters = [], frame = 0, nextShooter = 0;
    function resize() {
      ratio = Math.min(window.devicePixelRatio || 1, 1.7);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      ctx.setTransform(ratio,0,0,ratio,0,0);
      const count = Math.min(310, Math.floor(width * height / 3600));
      stars = Array.from({length: count}, () => ({ x: Math.random()*width, y: Math.random()*height, r: Math.random()*1.55+.2, alpha: Math.random()*.62+.12, drift: (Math.random()-.5)*.12, phase: Math.random()*Math.PI*2, gold: Math.random()>.88, flare: Math.random()>.94 }));
      shooters = []; nextShooter = performance.now() + 1600 + Math.random() * 2600;
      draw(0);
    }
    function draw(time) {
      ctx.clearRect(0,0,width,height);
      const t = time * .00035;
      stars.forEach(star => {
        const twinkle = reduced ? 0 : Math.sin(t + star.phase) * (star.flare ? .33 : .17);
        const alpha = Math.max(.05, Math.min(1, star.alpha + twinkle));
        const radius = star.r * (star.flare && !reduced ? 1 + Math.max(0, twinkle) * .7 : 1);
        ctx.beginPath(); ctx.arc(star.x, star.y, radius, 0, Math.PI*2);
        ctx.fillStyle = star.gold ? `rgba(255,224,177,${alpha})` : `rgba(222,225,255,${alpha})`;
        ctx.fill();
        if (star.flare && alpha > .72) {
          ctx.strokeStyle = `rgba(244,213,160,${alpha*.38})`; ctx.lineWidth = .55;
          ctx.beginPath(); ctx.moveTo(star.x-radius*4,star.y); ctx.lineTo(star.x+radius*4,star.y); ctx.moveTo(star.x,star.y-radius*4); ctx.lineTo(star.x,star.y+radius*4); ctx.stroke();
        }
        if (!reduced) { star.y += .025; star.x += star.drift; if (star.y > height+4) { star.y = -4; star.x = Math.random()*width; } if (star.x < -4) star.x = width+4; if (star.x > width+4) star.x = -4; }
      });
      if (!reduced && time > nextShooter) {
        shooters.push({ x: Math.random()*width*.78 + width*.1, y: Math.random()*height*.38, vx: 4.8 + Math.random()*3.8, vy: 2.1 + Math.random()*2.5, life: 0, max: 36 + Math.random()*18 });
        nextShooter = time + 2800 + Math.random()*5200;
      }
      shooters = shooters.filter(s => s.life < s.max);
      shooters.forEach(s => {
        const alpha = Math.sin((s.life / s.max) * Math.PI) * .72;
        const tail = 46 + s.life * .25;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x-tail, s.y-tail*.45);
        grad.addColorStop(0, `rgba(255,242,214,${alpha})`); grad.addColorStop(1, 'rgba(199,182,255,0)');
        ctx.strokeStyle = grad; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-tail,s.y-tail*.45); ctx.stroke();
        s.x += s.vx; s.y += s.vy; s.life++;
      });
      if (!reduced) frame = requestAnimationFrame(draw);
    }
    resize();
    if (!reduced) frame = requestAnimationFrame(draw);
    window.addEventListener('resize', () => { cancelAnimationFrame(frame); resize(); if (!reduced) frame = requestAnimationFrame(draw); }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else if (!reduced) frame = requestAnimationFrame(draw);
    });
  }

  function init() {
    setPersonalNames();
    renderPlanetNavigation();
    updateProgress();
    wireGlobalEvents();
    initStarfield();
    initOrbitControls();
    initCursorTrail();
    // Keep the intro as the first meaningful action; no autoplay audio or forced sequence.
    window.addEventListener('beforeunload', () => {
      if (state.audioObjectUrl) URL.revokeObjectURL(state.audioObjectUrl);
      state.extraMemories.forEach(item => { if (item.image && item.image.startsWith('blob:')) URL.revokeObjectURL(item.image); });
    });
  }

  init();
})();
