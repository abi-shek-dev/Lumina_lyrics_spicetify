// ==UserScript==
// @name         Lumina Lyrics
// @description  Cinematic, karaoke-style lyrics overlay for Spotify â€” inspired by Beautiful Lyrics
// @version      1.0.0
// @author       lumina-lyrics
// ==/UserScript==

(async function LuminaLyrics() {
  // â”€â”€â”€ Wait for Spicetify to be ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  while (!Spicetify?.showNotification) {
    await new Promise(r => setTimeout(r, 100));
  }

  const { Player, CosmosAsync, Platform, URI } = Spicetify;

  // â”€â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let lyrics = [];
  let currentLineIndex = -1;
  let animationFrame = null;
  let isVisible = false;
  let currentTrackId = null;
  let lyricsContainer = null;
  let overlay = null;
  let lastScrollTime = 0;
  let userScrolling = false;
  let scrollTimeout = null;
  let isKaraokeMode = false;
  let backgroundColors = ['#0d0d1a', '#0d0d1a'];

  // â”€â”€â”€ Musixmatch token cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let mxmToken = null;

  // â”€â”€â”€ Inject CSS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const style = document.createElement('style');
  style.id = 'lumina-lyrics-style';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300;0,400;0,500;0,600;0,700;0,900;1,300;1,400&display=swap');

    #lumina-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: stretch;
      font-family: 'Figtree', -apple-system, BlinkMacSystemFont, sans-serif;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.5s ease;
      overflow: hidden;
    }

    #lumina-overlay.visible {
      opacity: 1;
      pointer-events: all;
    }

    /* â”€â”€ Animated background â”€â”€ */
    #lumina-bg {
      position: absolute;
      inset: 0;
      background: #0a0a14;
      transition: background 3s ease;
    }

    #lumina-bg::before,
    #lumina-bg::after {
      content: '';
      position: absolute;
      border-radius: 50%;
      filter: blur(120px);
      opacity: 0.35;
      transition: all 3s ease;
      animation: luminaFloat 8s ease-in-out infinite alternate;
    }

    #lumina-bg::before {
      width: 60vw;
      height: 60vw;
      top: -20%;
      left: -10%;
      background: var(--lumina-color1, #1a0533);
    }

    #lumina-bg::after {
      width: 50vw;
      height: 50vw;
      bottom: -20%;
      right: -10%;
      background: var(--lumina-color2, #001a33);
      animation-delay: -4s;
    }

    @keyframes luminaFloat {
      from { transform: translate(0, 0) scale(1); }
      to   { transform: translate(4%, 3%) scale(1.08); }
    }

    /* â”€â”€ Noise grain overlay â”€â”€ */
    #lumina-grain {
      position: absolute;
      inset: 0;
      opacity: 0.04;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
      background-size: 256px 256px;
    }

    /* â”€â”€ Particle canvas â”€â”€ */
    #lumina-particles-container {
      position: absolute;
      inset: 0;
      z-index: 15;
      pointer-events: none;
    }

    /* â”€â”€ Sidebar (left pane) â”€â”€ */
    #lumina-sidebar {
      position: relative;
      z-index: 10;
      width: 45%;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 48px 48px;
      box-sizing: border-box;
      gap: 24px;
    }

    #lumina-art-container {
      position: relative;
      width: min(280px, 28vw);
      height: min(280px, 28vw);
      border-radius: 18px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 4px 20px rgba(0,0,0,0.5);
      transition: box-shadow 1.5s ease;
      flex-shrink: 0;
      overflow: hidden;
      cursor: pointer;
    }

    #lumina-album-art {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    #lumina-cover-close {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
      color: white;
      border: none;
      padding: 0;
      cursor: pointer;
    }

    #lumina-art-container:hover #lumina-cover-close {
      opacity: 1;
    }

    .lumina-close-circle {
      width: 54px;
      height: 54px;
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      transition: all 0.2s ease;
    }

    .lumina-close-circle:hover {
      background: rgba(255,255,255,0.25);
      border-color: rgba(255,255,255,0.3);
      transform: scale(1.08);
    }

    #lumina-cover-close svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }

    #lumina-track-text {
      text-align: center;
      width: 100%;
    }

    #lumina-track-text h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: rgba(255,255,255,0.95);
      letter-spacing: -0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #lumina-track-text p {
      margin: 6px 0 0;
      font-size: 14px;
      font-weight: 400;
      color: rgba(255,255,255,0.45);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* â”€â”€ Right pane top bar â”€â”€ */
    #lumina-topbar {
      position: relative;
      z-index: 10;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 48px 28px 0;
      box-sizing: border-box;
      flex-shrink: 0;
    }

    #lumina-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .lumina-btn {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.7);
      border-radius: 100px;
      padding: 7px 16px;
      font-family: 'Figtree', sans-serif;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      letter-spacing: 0.01em;
    }

    .lumina-btn:hover {
      background: rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.95);
      border-color: rgba(255,255,255,0.2);
    }

    .lumina-btn.active {
      background: rgba(255,255,255,0.18);
      color: #fff;
    }

    #lumina-close {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.5);
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 18px;
      line-height: 1;
    }

    #lumina-close:hover {
      background: rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.9);
    }

    /* â”€â”€ Right pane â”€â”€ */
    #lumina-right {
      width: 55%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }

    /* â”€â”€ Lyrics scroll area â”€â”€ */
    #lumina-lyrics-wrap {
      position: relative;
      z-index: 5;
      flex: 1;
      width: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 20px 60px 100px 20px;
      box-sizing: border-box;
      scroll-behavior: smooth;
      -webkit-mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 10%,
        black 80%,
        transparent 100%
      );
      mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 10%,
        black 80%,
        transparent 100%
      );
    }

    #lumina-lyrics-wrap::-webkit-scrollbar { display: none; }
    #lumina-lyrics-wrap { scrollbar-width: none; -ms-overflow-style: none; }

    /* â”€â”€ Individual lyric lines â”€â”€ */
    .lumina-line {
      display: block;
      font-size: clamp(22px, 3.2vw, 38px);
      font-weight: 700;
      line-height: 1.25;
      color: rgba(255,255,255,0.15);
      opacity: 0.6;
      margin-bottom: 0.55em;
      cursor: pointer;
      transition:
        color     0.55s cubic-bezier(0.4, 0, 0.2, 1),
        opacity   0.55s cubic-bezier(0.4, 0, 0.2, 1),
        transform 0.55s cubic-bezier(0.4, 0, 0.2, 1),
        filter    0.55s cubic-bezier(0.4, 0, 0.2, 1);
      letter-spacing: -0.02em;
      transform-origin: left center;
      transform: translateY(4px) scale(0.97);
      will-change: color, transform, opacity;
      -webkit-user-select: none;
      user-select: none;
    }


    .lumina-line:hover {
      color: rgba(255,255,255,0.5) !important;
      opacity: 0.85 !important;
    }

    .lumina-line.past {
      color: rgba(255,255,255,0.2);
      opacity: 0.45;
      transform: translateY(-3px) scale(0.97);
    }

    .lumina-line.active {
      color: rgba(255,255,255,1) !important;
      opacity: 1 !important;
      transform: translateY(0) scale(1.03) translateX(4px);
      filter: drop-shadow(0 0 28px rgba(255,255,255,0.3));
    }

    .lumina-line.near-active {
      color: rgba(255,255,255,0.55);
      opacity: 0.8;
      transform: translateY(2px) scale(0.99);
    }

    /* â”€â”€ Karaoke word-by-word highlight â”€â”€ */
    .lumina-word {
      display: inline;
      transition: color 0.15s ease, text-shadow 0.15s ease;
    }

    .lumina-word.lit {
      color: #fff;
      text-shadow: 0 0 20px rgba(255,255,255,0.6);
    }

    /* â”€â”€ Instrumental / loading states â”€â”€ */
    .lumina-spacer {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 80px;
      gap: 8px;
    }

    .lumina-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      animation: luminaPulse 1.4s ease-in-out infinite;
    }

    .lumina-dot:nth-child(2) { animation-delay: 0.2s; }
    .lumina-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes luminaPulse {
      0%, 100% { transform: scale(1); opacity: 0.25; }
      50% { transform: scale(1.4); opacity: 0.7; }
    }

    .lumina-no-lyrics {
      font-size: 18px;
      font-weight: 400;
      color: rgba(255,255,255,0.3);
      text-align: center;
      padding: 60px 20px;
      line-height: 1.6;
    }

    /* â”€â”€ Player controls â”€â”€ */
    #lumina-player-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      width: 100%;
    }

    .lumina-ctrl-btn {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.75);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .lumina-ctrl-btn:hover {
      background: rgba(255,255,255,0.15);
      color: #fff;
      border-color: rgba(255,255,255,0.25);
      transform: scale(1.08);
    }

    #lumina-play-btn {
      width: 54px;
      height: 54px;
      background: rgba(255,255,255,0.14);
      border-color: rgba(255,255,255,0.2);
      color: #fff;
    }

    #lumina-play-btn:hover {
      background: rgba(255,255,255,0.25);
      transform: scale(1.1);
      box-shadow: 0 0 20px rgba(255,255,255,0.15);
    }

    .lumina-ctrl-btn svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
      pointer-events: none;
    }

    #lumina-play-btn svg {
      width: 22px;
      height: 22px;
    }

    /* â”€â”€ Progress bar â”€â”€ */
    #lumina-progress {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      max-width: 360px;
    }

    #lumina-time-current,
    #lumina-time-total {
      font-size: 11px;
      font-weight: 500;
      color: rgba(255,255,255,0.4);
      min-width: 34px;
    }

    #lumina-time-total { text-align: right; }

    #lumina-progress-track {
      flex: 1;
      height: 3px;
      background: rgba(255,255,255,0.12);
      border-radius: 3px;
      cursor: pointer;
      position: relative;
      overflow: visible;
    }

    #lumina-progress-fill {
      height: 100%;
      background: rgba(255,255,255,0.7);
      border-radius: 3px;
      width: 0%;
      transition: width 0.25s linear;
      position: relative;
    }

    #lumina-progress-fill::after {
      content: '';
      position: absolute;
      right: -5px;
      top: -4px;
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 0 8px rgba(255,255,255,0.4);
      opacity: 0;
      transition: opacity 0.2s;
    }

    #lumina-progress-track:hover #lumina-progress-fill::after {
      opacity: 1;
    }

    /* â”€â”€ Trigger button in Spotify bar â”€â”€ */
    #lumina-trigger-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--spice-subtext, rgba(255,255,255,0.6));
      font-family: 'Figtree', sans-serif;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 10px;
      border-radius: 6px;
      transition: color 0.2s, background 0.2s;
      letter-spacing: 0.02em;
    }

    #lumina-trigger-btn:hover {
      color: #fff;
      background: rgba(255,255,255,0.08);
    }

    #lumina-trigger-btn.active {
      color: #1ed760;
    }

    #lumina-trigger-btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
  `;
  document.head.appendChild(style);

  // â”€â”€â”€ Build the overlay DOM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function buildOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'lumina-overlay';
    overlay.innerHTML = `
      <div id="lumina-bg"></div>
      <div id="lumina-grain"></div>
      <div id="lumina-particles-container"></div>

      <!-- Left Sidebar -->
      <div id="lumina-sidebar">
        <div id="lumina-art-container" title="Close lyrics">
          <img id="lumina-album-art" src="" alt="" />
          <div id="lumina-cover-close">
            <div class="lumina-close-circle">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </div>
          </div>
        </div>
        <div id="lumina-track-text">
          <h2 id="lumina-title">â€”</h2>
          <p id="lumina-artist">â€”</p>
        </div>
        <div id="lumina-player-controls">
          <button class="lumina-ctrl-btn" id="lumina-prev-btn" title="Previous">
            <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
          </button>
          <button class="lumina-ctrl-btn" id="lumina-play-btn" title="Play / Pause">
            <svg id="lumina-play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="lumina-ctrl-btn" id="lumina-next-btn" title="Next">
            <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.9V8.1L8.5 12zM16 6h2v12h-2z"/></svg>
          </button>
        </div>
        <div id="lumina-progress">
          <span id="lumina-time-current">0:00</span>
          <div id="lumina-progress-track">
            <div id="lumina-progress-fill"></div>
          </div>
          <span id="lumina-time-total">0:00</span>
        </div>
      </div>

      <!-- Right pane -->
      <div id="lumina-right">
        <div id="lumina-lyrics-wrap">
          <div id="lumina-lines"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    lyricsContainer = overlay.querySelector('#lumina-lines');

    // Close on album art click
    overlay.querySelector('#lumina-art-container').addEventListener('click', hideLyrics);

    // Player controls
    overlay.querySelector('#lumina-prev-btn').addEventListener('click', () => Player.back());
    overlay.querySelector('#lumina-next-btn').addEventListener('click', () => Player.next());
    overlay.querySelector('#lumina-play-btn').addEventListener('click', () => Player.togglePlay());

    // Progress bar click to seek
    overlay.querySelector('#lumina-progress-track').addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const duration = Player.getDuration();
      if (duration) Player.seek(Math.floor(ratio * duration));
    });

    // Detect user scrolling
    const wrap = overlay.querySelector('#lumina-lyrics-wrap');
    wrap.addEventListener('scroll', () => {
      userScrolling = true;
      lastScrollTime = Date.now();
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { userScrolling = false; }, 3000);
    });

    // Click a line to seek
    lyricsContainer.addEventListener('click', (e) => {
      const line = e.target.closest('.lumina-line');
      if (!line) return;
      const time = parseFloat(line.dataset.time);
      if (!isNaN(time)) Player.seek(Math.floor(time * 1000));
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isVisible) hideLyrics();
    });
  }

  // â”€â”€â”€ Show / Hide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function showLyrics() {
    buildOverlay();
    overlay.classList.add('visible');
    isVisible = true;
    updateTriggerBtn(true);
    loadLyricsForCurrentTrack();
    startLoop();
    initParticleSystem([[0.45, 0.25, 0.85], [0.2, 0.45, 0.9], [0.7, 0.3, 0.8], [1, 1, 1]]);
    startParticles();
  }

  function hideLyrics() {
    if (!overlay) return;
    overlay.classList.remove('visible');
    isVisible = false;
    updateTriggerBtn(false);
    stopLoop();
    stopParticles();
  }

  // â”€â”€â”€ Inject trigger button into Spotify now-playing bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function injectTriggerButton() {
    const existing = document.getElementById('lumina-trigger-btn');
    if (existing) return;

    const targets = [
      '.main-nowPlayingBar-nowPlayingBar',
      '.Root__now-playing-bar',
      '[data-testid="now-playing-bar"]',
    ];

    let bar = null;
    for (const sel of targets) {
      bar = document.querySelector(sel);
      if (bar) break;
    }

    if (!bar) {
      setTimeout(injectTriggerButton, 1000);
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'lumina-trigger-btn';
    btn.title = 'Lumina Lyrics';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3H9zm-2 16a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
      </svg>
      Lyrics
    `;
    btn.addEventListener('click', () => {
      isVisible ? hideLyrics() : showLyrics();
    });

    // Try to insert near the right-side controls
    const rightBar = bar.querySelector('.main-nowPlayingBar-right, [data-testid="now-playing-bar"] > div:last-child');
    if (rightBar) {
      rightBar.insertBefore(btn, rightBar.firstChild);
    } else {
      bar.appendChild(btn);
    }
  }

  function updateTriggerBtn(active) {
    const btn = document.getElementById('lumina-trigger-btn');
    if (btn) btn.classList.toggle('active', active);
  }

  // â”€â”€â”€ Lyrics fetching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function loadLyricsForCurrentTrack() {
    const meta = Player.data?.item;
    if (!meta) return;

    const trackId = meta.uri?.split(':')[2];
    if (trackId === currentTrackId) return;
    currentTrackId = trackId;

    // Update track info UI
    const title = meta.name || 'Unknown';
    const artist = meta.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
    const artUrl = meta.images?.[0]?.url || meta.album?.images?.[0]?.url || '';

    overlay.querySelector('#lumina-title').textContent = title;
    overlay.querySelector('#lumina-artist').textContent = artist;
    if (artUrl) overlay.querySelector('#lumina-album-art').src = artUrl;

    // Extract palette from album art to drive background
    if (artUrl) updateBackgroundFromArt(artUrl);

    // Show loading state
    renderLoadingState();

    // Fetch lyrics
    try {
      const result = await fetchLyrics(trackId, title, artist);
      lyrics = result;
      currentLineIndex = -1;
      renderLyrics();
    } catch (err) {
      console.error('[LuminaLyrics] Failed to fetch lyrics:', err);
      renderNoLyrics('Could not load lyrics for this track.');
    }
  }

  async function fetchLyrics(trackId, title, artist) {
    // 1) Try Spotify's internal lyrics endpoint
    try {
      const spotifyLyrics = await CosmosAsync.get(
        `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&market=from_token`
      );
      if (spotifyLyrics?.lyrics?.lines?.length) {
        return parseSyncedLyrics(spotifyLyrics.lyrics.lines, spotifyLyrics.lyrics.syncType);
      }
    } catch (e) {
      console.warn('[LuminaLyrics] Spotify lyrics unavailable, trying fallback');
    }

    // 2) Try LRCLIB (free, open LRC database)
    try {
      const q = encodeURIComponent(title);
      const a = encodeURIComponent(artist);
      const res = await fetch(`https://lrclib.net/api/get?track_name=${q}&artist_name=${a}`);
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics) {
          return parseLrcFormat(data.syncedLyrics);
        } else if (data.plainLyrics) {
          return parsePlainLyrics(data.plainLyrics);
        }
      }
    } catch (e) {
      console.warn('[LuminaLyrics] LRCLIB unavailable');
    }

    // 3) NetEase fallback
    try {
      const query = encodeURIComponent(`${title} ${artist}`);
      const searchRes = await fetch(`https://music.163.com/api/search/get?s=${query}&type=1&limit=1`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const songId = searchData?.result?.songs?.[0]?.id;
        if (songId) {
          const lrcRes = await fetch(`https://music.163.com/api/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`);
          if (lrcRes.ok) {
            const lrcData = await lrcRes.json();
            if (lrcData?.lrc?.lyric) {
              return parseLrcFormat(lrcData.lrc.lyric);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[LuminaLyrics] NetEase unavailable');
    }

    throw new Error('All lyric sources exhausted');
  }

  function parseSyncedLyrics(lines, syncType) {
    return lines.map((line, i) => ({
      time: parseFloat(line.startTimeMs) / 1000,
      text: line.words || '',
      isInstrumental: !line.words || line.words.trim() === 'â™ª',
      endTime: lines[i + 1] ? parseFloat(lines[i + 1].startTimeMs) / 1000 : Infinity,
      syncType,
    }));
  }

  function parseLrcFormat(lrc) {
    const lines = [];
    const re = /\[(\d{1,2}):(\d{2})(?:\.(\d+))?\](.*)/g;
    let match;
    while ((match = re.exec(lrc)) !== null) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt((match[3] || '0').padEnd(3, '0').slice(0, 3));
      const time = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      if (text) lines.push({ time, text, isInstrumental: false });
    }
    lines.sort((a, b) => a.time - b.time);
    return lines.map((l, i) => ({ ...l, endTime: lines[i + 1]?.time ?? Infinity }));
  }

  function parsePlainLyrics(plain) {
    return plain.split('\n')
      .filter(l => l.trim())
      .map((text, i) => ({ time: i * 4, text, isInstrumental: false, endTime: (i + 1) * 4, unsynced: true }));
  }

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderLoadingState() {
    lyricsContainer.innerHTML = `
      <div class="lumina-spacer">
        <div class="lumina-dot"></div>
        <div class="lumina-dot"></div>
        <div class="lumina-dot"></div>
      </div>
    `;
  }

  function renderNoLyrics(msg) {
    lyricsContainer.innerHTML = `<div class="lumina-no-lyrics">ðŸŽµ<br/><br/>${msg}</div>`;
  }

  function renderLyrics() {
    if (!lyrics.length) {
      renderNoLyrics('No lyrics found for this track.');
      return;
    }

    lyricsContainer.innerHTML = '';

    // Leading spacer
    const topSpacer = document.createElement('div');
    topSpacer.style.height = '20vh';
    lyricsContainer.appendChild(topSpacer);

    lyrics.forEach((line, idx) => {
      if (line.isInstrumental) {
        const spacer = document.createElement('div');
        spacer.className = 'lumina-spacer';
        spacer.dataset.index = idx;
        spacer.innerHTML = `
          <div class="lumina-dot"></div>
          <div class="lumina-dot"></div>
          <div class="lumina-dot"></div>
        `;
        lyricsContainer.appendChild(spacer);
        return;
      }

      const el = document.createElement('div');
      el.className = 'lumina-line';
      el.dataset.index = idx;
      el.dataset.time = line.time;

      if (line.unsynced) {
        el.textContent = line.text;
        el.style.cursor = 'default';
      } else {
        // Wrap words for karaoke highlighting
        el.innerHTML = line.text.split(/\s+/).map(word =>
          `<span class="lumina-word">${word}</span>`
        ).join(' ');
      }

      lyricsContainer.appendChild(el);
    });

    // Bottom spacer
    const botSpacer = document.createElement('div');
    botSpacer.style.height = '30vh';
    lyricsContainer.appendChild(botSpacer);
  }

  // â”€â”€â”€ Animation loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function startLoop() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    loop();
  }

  function stopLoop() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  function updatePlayIcon() {
    const icon = overlay?.querySelector('#lumina-play-icon');
    if (!icon) return;
    const playing = !Player.data?.isPaused;
    icon.innerHTML = playing
      ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }

  function loop() {
    animationFrame = requestAnimationFrame(loop);
    updatePlayIcon();
    if (!isVisible || !lyrics.length) return;

    const posMs = Player.getProgress();
    const duration = Player.getDuration();
    const pos = posMs / 1000;

    // Update progress bar
    if (duration) {
      const pct = Math.min((posMs / duration) * 100, 100);
      const fill = overlay.querySelector('#lumina-progress-fill');
      if (fill) fill.style.width = pct + '%';
    }

    // Update time labels
    const cur = overlay.querySelector('#lumina-time-current');
    const tot = overlay.querySelector('#lumina-time-total');
    if (cur) cur.textContent = formatTime(posMs);
    if (tot) tot.textContent = formatTime(duration);

    // Find active lyric line
    let activeIdx = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (lyrics[i].time <= pos) { activeIdx = i; break; }
    }

    if (activeIdx === currentLineIndex) return;
    currentLineIndex = activeIdx;

    // Update line classes — only change lines whose state actually changed
    // to avoid the one-frame flicker caused by remove-all → re-add
    const lines = lyricsContainer.querySelectorAll('.lumina-line, .lumina-spacer');
    lines.forEach(el => {
      const idx = parseInt(el.dataset.index);
      const desired =
        idx === activeIdx         ? 'active'      :
        idx === activeIdx - 1 ||
        idx === activeIdx + 1     ? 'near-active'  :
        idx < activeIdx           ? 'past'          : '';

      const current =
        el.classList.contains('active')      ? 'active'      :
        el.classList.contains('near-active') ? 'near-active'  :
        el.classList.contains('past')        ? 'past'          : '';

      if (current !== desired) {
        el.classList.remove('active', 'past', 'near-active');
        if (desired) el.classList.add(desired);
      }
    });


    // Auto-scroll to active line
    if (!userScrolling) {
      const activeLine = lyricsContainer.querySelector(`.lumina-line.active, .lumina-spacer[data-index="${activeIdx}"]`);
      if (activeLine) {
        const wrap = overlay.querySelector('#lumina-lyrics-wrap');
        const wrapRect = wrap.getBoundingClientRect();
        const lineRect = activeLine.getBoundingClientRect();
        const offset = lineRect.top - wrapRect.top - wrapRect.height * 0.38;
        wrap.scrollBy({ top: offset, behavior: 'smooth' });
      }
    }

    // Karaoke word-by-word animation
    if (isKaraokeMode && activeIdx >= 0) {
      const activeLine = lyricsContainer.querySelector('.lumina-line.active');
      if (activeLine) {
        const line = lyrics[activeIdx];
        const words = activeLine.querySelectorAll('.lumina-word');
        const lineDuration = (line.endTime ?? pos + 4) - line.time;
        const linePos = pos - line.time;
        const progress = Math.min(linePos / lineDuration, 1);
        const litCount = Math.floor(progress * words.length);
        words.forEach((w, i) => w.classList.toggle('lit', i < litCount));
      }
    }
  }

  // â”€â”€â”€ Background color extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function updateBackgroundFromArt(imgUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 8;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;

        // Sample corners
        const samples = [[0,0], [7,0], [0,7], [7,7], [3,3]].map(([x,y]) => {
          const i = (y * 8 + x) * 4;
          return [d[i], d[i+1], d[i+2]];
        });

        const c1 = samples[0];
        const c2 = samples[3];

        const toHex = ([r,g,b]) => {
          const darken = v => Math.max(0, Math.floor(v * 0.3));
          return `rgb(${darken(r)},${darken(g)},${darken(b)})`;
        };

        const bg = overlay.querySelector('#lumina-bg');
        if (bg) {
          bg.style.setProperty('--lumina-color1', toHex(c1));
          bg.style.setProperty('--lumina-color2', toHex(c2));
        }

        // Feed colors to OGL particle system (normalized 0â€“1 RGB)
        const toNormRgb = ([r, g, b]) => [
          Math.min(1, r / 255 * 1.3 + 0.1),
          Math.min(1, g / 255 * 1.3 + 0.1),
          Math.min(1, b / 255 * 1.3 + 0.1)
        ];
        initParticleSystem(samples.map(s => toNormRgb(s)));
        if (isVisible) startParticles();
      } catch (e) {}
    };
    img.src = imgUrl;
  }

  // â”€â”€â”€ Raw WebGL Particle system (same shaders as OGL component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const VERT_SRC = [
    'attribute vec3 position;',
    'attribute vec4 random;',
    'attribute vec3 color;',
    'uniform mat4 modelMatrix;',
    'uniform mat4 viewMatrix;',
    'uniform mat4 projectionMatrix;',
    'uniform float uTime;',
    'uniform float uSpread;',
    'uniform float uBaseSize;',
    'uniform float uSizeRandomness;',
    'varying vec4 vRandom;',
    'varying vec3 vColor;',
    'void main() {',
    '  vRandom = random; vColor = color;',
    '  vec3 pos = position * uSpread; pos.z *= 10.0;',
    '  vec4 mPos = modelMatrix * vec4(pos, 1.0);',
    '  float t = uTime;',
    '  mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);',
    '  mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);',
    '  mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);',
    '  vec4 mvPos = viewMatrix * mPos;',
    '  gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);',
    '  gl_Position = projectionMatrix * mvPos;',
    '}'
  ].join('\n');

  const FRAG_SRC = [
    'precision highp float;',
    'uniform float uTime;',
    'varying vec4 vRandom; varying vec3 vColor;',
    'void main() {',
    '  vec2 uv = gl_PointCoord.xy;',
    '  float d = length(uv - vec2(0.5));',
    '  float circle = smoothstep(0.5, 0.4, d) * 0.8;',
    '  gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);',
    '}'
  ].join('\n');

  let _pCanvas = null, _pGl = null, _pProg = null;
  let _pBufs = {}, _pUnis = {}, _pCount = 0;
  let particleRaf = null, particleElapsed = 0, particleLastTime = 0;
  let _rotX = 0, _rotY = 0, _rotZ = 0;

  function _compileSh(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[LuminaParticles]', gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null;
    }
    return sh;
  }

  function _perspMat(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([
      f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0
    ]);
  }

  function _viewMat(eyeZ) {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-eyeZ,1]);
  }

  function _mul4(a, b) {
    const o = new Float32Array(16);
    for (let c=0;c<4;c++) for (let r=0;r<4;r++) { let s=0; for (let k=0;k<4;k++) s+=a[k*4+r]*b[c*4+k]; o[c*4+r]=s; }
    return o;
  }

  function _rotMat(rx, ry, rz) {
    const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
    const Rx=new Float32Array([1,0,0,0, 0,cx,sx,0, 0,-sx,cx,0, 0,0,0,1]);
    const Ry=new Float32Array([cy,0,-sy,0, 0,1,0,0, sy,0,cy,0, 0,0,0,1]);
    const Rz=new Float32Array([cz,sz,0,0, -sz,cz,0,0, 0,0,1,0, 0,0,0,1]);
    return _mul4(_mul4(Ry,Rx),Rz);
  }

  function initParticleSystem(rgbColors) {
    if (!overlay) return;
    _destroyOGL();
    const container = overlay.querySelector('#lumina-particles-container');
    if (!container) return;

    _pCanvas = document.createElement('canvas');
    _pCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    container.appendChild(_pCanvas);

    _pGl = _pCanvas.getContext('webgl', { alpha:true, depth:false, premultipliedAlpha:false, antialias:false });
    if (!_pGl) { console.warn('[LuminaLyrics] WebGL not available'); return; }
    const gl = _pGl;

    gl.clearColor(0,0,0,0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const vs = _compileSh(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = _compileSh(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;
    _pProg = gl.createProgram();
    gl.attachShader(_pProg, vs); gl.attachShader(_pProg, fs);
    gl.linkProgram(_pProg);
    if (!gl.getProgramParameter(_pProg, gl.LINK_STATUS)) {
      console.error('[LuminaParticles] Link error:', gl.getProgramInfoLog(_pProg)); return;
    }

    const count = 200; _pCount = count;
    const palette = rgbColors && rgbColors.length ? rgbColors : [[0.8,0.6,1]];
    const pos = new Float32Array(count*3), rnd = new Float32Array(count*4), col = new Float32Array(count*3);
    for (let i=0;i<count;i++) {
      let x,y,z,len;
      do { x=Math.random()*2-1; y=Math.random()*2-1; z=Math.random()*2-1; len=x*x+y*y+z*z; } while(len>1||len===0);
      const r=Math.cbrt(Math.random());
      pos.set([x*r,y*r,z*r],i*3);
      rnd.set([Math.random(),Math.random(),Math.random(),Math.random()],i*4);
      col.set(palette[Math.floor(Math.random()*palette.length)],i*3);
    }

    function mkBuf(data, size) {
      const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW); return {b,size};
    }
    _pBufs = { position:mkBuf(pos,3), random:mkBuf(rnd,4), color:mkBuf(col,3) };

    gl.useProgram(_pProg);
    _pUnis = {
      model: gl.getUniformLocation(_pProg,'modelMatrix'),
      view:  gl.getUniformLocation(_pProg,'viewMatrix'),
      proj:  gl.getUniformLocation(_pProg,'projectionMatrix'),
      uTime: gl.getUniformLocation(_pProg,'uTime'),
      uSpread:   gl.getUniformLocation(_pProg,'uSpread'),
      uBaseSize: gl.getUniformLocation(_pProg,'uBaseSize'),
      uSizeRand: gl.getUniformLocation(_pProg,'uSizeRandomness'),
    };
    gl.uniform1f(_pUnis.uSpread, 10);
    gl.uniform1f(_pUnis.uBaseSize, 100);
    gl.uniform1f(_pUnis.uSizeRand, 1);

    _rotX=0; _rotY=0; _rotZ=0;

    const _resize = () => {
      const w = container.offsetWidth || window.innerWidth;
      const h = container.offsetHeight || window.innerHeight;
      _pCanvas.width=w; _pCanvas.height=h;
      gl.viewport(0,0,w,h);
      gl.useProgram(_pProg);
      gl.uniformMatrix4fv(_pUnis.proj, false, _perspMat(15*Math.PI/180, w/h, 0.1, 100));
      gl.uniformMatrix4fv(_pUnis.view, false, _viewMat(20));
    };
    _resize();
    window._luminaParticleResize = _resize;
    window.addEventListener('resize', _resize);
  }

  function startParticles() {
    if (particleRaf) cancelAnimationFrame(particleRaf);
    particleElapsed=0; particleLastTime=performance.now();
    _animateOGL();
  }

  function stopParticles() {
    if (particleRaf) cancelAnimationFrame(particleRaf);
    particleRaf=null;
  }

  function _animateOGL() {
    if (!isVisible) return;
    particleRaf = requestAnimationFrame(_animateOGL);
    if (!_pGl || !_pProg) return;
    const gl=_pGl;
    const now=performance.now(), delta=now-particleLastTime;
    particleLastTime=now; particleElapsed+=delta*0.1;
    _rotX=Math.sin(particleElapsed*0.00002)*0.1;
    _rotY=Math.cos(particleElapsed*0.00005)*0.15;
    _rotZ+=0.001;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(_pProg);
    gl.uniformMatrix4fv(_pUnis.model, false, _rotMat(_rotX,_rotY,_rotZ));
    gl.uniform1f(_pUnis.uTime, particleElapsed*0.001);
    for (const [name,{b,size}] of Object.entries(_pBufs)) {
      const loc=gl.getAttribLocation(_pProg,name); if(loc<0) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);
    }
    gl.drawArrays(gl.POINTS,0,_pCount);
  }

  function _destroyOGL() {
    stopParticles();
    if (_pCanvas && _pCanvas.parentNode) _pCanvas.parentNode.removeChild(_pCanvas);
    _pCanvas=null; _pGl=null; _pProg=null; _pBufs={};
    if (window._luminaParticleResize) {
      window.removeEventListener('resize', window._luminaParticleResize);
      window._luminaParticleResize=null;
    }
  }


  // ─── Helpers ────────────────────────────────────────────────────────────────
  function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ─── Player event listeners ─────────────────────────────────────────────────
  Player.addEventListener('songchange', () => {
    currentTrackId = null;
    lyrics = [];
    currentLineIndex = -1;
    userScrolling = false;
    if (isVisible) loadLyricsForCurrentTrack();
  });

  // ─── Init ───────────────────────────────────────────────────────────────────
  setTimeout(injectTriggerButton, 1500);

  console.log('[LuminaLyrics] ✦ Loaded successfully');
})();
