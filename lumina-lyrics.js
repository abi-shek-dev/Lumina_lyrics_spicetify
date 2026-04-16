// ==UserScript==
// @name         Lumina Lyrics
// @description  Cinematic, karaoke-style lyrics overlay for Spotify — inspired by Beautiful Lyrics
// @version      1.0.0
// @author       lumina-lyrics
// ==/UserScript==

(async function LuminaLyrics() {
  // ─── Wait for Spicetify to be ready ───────────────────────────────────────
  while (!Spicetify?.showNotification) {
    await new Promise(r => setTimeout(r, 100));
  }

  const { Player, CosmosAsync, Platform, URI } = Spicetify;

  // ─── State ─────────────────────────────────────────────────────────────────
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

  // ─── Musixmatch token cache ─────────────────────────────────────────────────
  let mxmToken = null;

  // ─── Inject CSS ────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = 'lumina-lyrics-style';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300;0,400;0,500;0,600;0,700;0,900;1,300;1,400&display=swap');

    #lumina-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
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

    /* ── Animated background ── */
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

    /* ── Noise grain overlay ── */
    #lumina-grain {
      position: absolute;
      inset: 0;
      opacity: 0.04;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
      background-size: 256px 256px;
    }

    /* ── Top bar ── */
    #lumina-topbar {
      position: relative;
      z-index: 10;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 48px 28px 0;
      box-sizing: border-box;
    }

    #lumina-track-info {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    #lumina-album-art {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      object-fit: cover;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }

    #lumina-track-text h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: rgba(255,255,255,0.95);
      letter-spacing: -0.01em;
    }

    #lumina-track-text p {
      margin: 2px 0 0;
      font-size: 12px;
      font-weight: 400;
      color: rgba(255,255,255,0.5);
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

    /* ── Lyrics scroll area ── */
    #lumina-lyrics-wrap {
      position: relative;
      z-index: 5;
      flex: 1;
      width: 100%;
      max-width: 720px;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 60px 40px 140px;
      box-sizing: border-box;
      scroll-behavior: smooth;
      -webkit-mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 12%,
        black 78%,
        transparent 100%
      );
      mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 12%,
        black 78%,
        transparent 100%
      );
    }

    #lumina-lyrics-wrap::-webkit-scrollbar { display: none; }
    #lumina-lyrics-wrap { scrollbar-width: none; -ms-overflow-style: none; }

    /* ── Individual lyric lines ── */
    .lumina-line {
      display: block;
      font-size: clamp(22px, 3.2vw, 38px);
      font-weight: 700;
      line-height: 1.25;
      color: rgba(255,255,255,0.18);
      margin-bottom: 0.55em;
      cursor: pointer;
      transition: color 0.4s ease, transform 0.4s ease, filter 0.4s ease;
      letter-spacing: -0.02em;
      transform-origin: left center;
      will-change: color, transform;
      -webkit-user-select: none;
      user-select: none;
    }

    .lumina-line:hover {
      color: rgba(255,255,255,0.45) !important;
    }

    .lumina-line.past {
      color: rgba(255,255,255,0.25);
    }

    .lumina-line.active {
      color: rgba(255,255,255,1) !important;
      transform: scale(1.03) translateX(4px);
      filter: drop-shadow(0 0 28px rgba(255,255,255,0.25));
    }

    .lumina-line.near-active {
      color: rgba(255,255,255,0.5);
      transform: scale(1.01);
    }

    /* ── Karaoke word-by-word highlight ── */
    .lumina-word {
      display: inline;
      transition: color 0.15s ease, text-shadow 0.15s ease;
    }

    .lumina-word.lit {
      color: #fff;
      text-shadow: 0 0 20px rgba(255,255,255,0.6);
    }

    /* ── Instrumental / loading states ── */
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

    /* ── Player controls ── */
    #lumina-player-controls {
      position: absolute;
      z-index: 10;
      bottom: 68px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 20px;
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

    /* ── Progress bar ── */
    #lumina-progress {
      position: absolute;
      z-index: 10;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      width: min(480px, 80vw);
      display: flex;
      align-items: center;
      gap: 12px;
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

    /* ── Trigger button in Spotify bar ── */
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

  // ─── Build the overlay DOM ──────────────────────────────────────────────────
  function buildOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'lumina-overlay';
    overlay.innerHTML = `
      <div id="lumina-bg"></div>
      <div id="lumina-grain"></div>

      <div id="lumina-topbar">
        <div id="lumina-track-info">
          <img id="lumina-album-art" src="" alt="" />
          <div id="lumina-track-text">
            <h2 id="lumina-title">—</h2>
            <p id="lumina-artist">—</p>
          </div>
        </div>
        <div id="lumina-controls">
          <button class="lumina-btn" id="lumina-karaoke-btn">✦ Karaoke</button>
          <button class="lumina-btn" id="lumina-close">✕</button>
        </div>
      </div>

      <div id="lumina-lyrics-wrap">
        <div id="lumina-lines"></div>
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
    `;

    document.body.appendChild(overlay);
    lyricsContainer = overlay.querySelector('#lumina-lines');

    // Close button
    overlay.querySelector('#lumina-close').addEventListener('click', hideLyrics);

    // Player controls
    overlay.querySelector('#lumina-prev-btn').addEventListener('click', () => Player.back());
    overlay.querySelector('#lumina-next-btn').addEventListener('click', () => Player.next());
    overlay.querySelector('#lumina-play-btn').addEventListener('click', () => Player.togglePlay());

    // Karaoke toggle
    overlay.querySelector('#lumina-karaoke-btn').addEventListener('click', () => {
      isKaraokeMode = !isKaraokeMode;
      overlay.querySelector('#lumina-karaoke-btn').classList.toggle('active', isKaraokeMode);
    });

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

  // ─── Show / Hide ───────────────────────────────────────────────────────────
  function showLyrics() {
    buildOverlay();
    overlay.classList.add('visible');
    isVisible = true;
    updateTriggerBtn(true);
    loadLyricsForCurrentTrack();
    startLoop();
  }

  function hideLyrics() {
    if (!overlay) return;
    overlay.classList.remove('visible');
    isVisible = false;
    updateTriggerBtn(false);
    stopLoop();
  }

  // ─── Inject trigger button into Spotify now-playing bar ────────────────────
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

  // ─── Lyrics fetching ────────────────────────────────────────────────────────
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
      isInstrumental: !line.words || line.words.trim() === '♪',
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

  // ─── Render ─────────────────────────────────────────────────────────────────
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
    lyricsContainer.innerHTML = `<div class="lumina-no-lyrics">🎵<br/><br/>${msg}</div>`;
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

  // ─── Animation loop ─────────────────────────────────────────────────────────
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

    // Update line classes
    const lines = lyricsContainer.querySelectorAll('.lumina-line, .lumina-spacer');
    lines.forEach(el => {
      const idx = parseInt(el.dataset.index);
      el.classList.remove('active', 'past', 'near-active');
      if (idx === activeIdx) el.classList.add('active');
      else if (idx === activeIdx - 1 || idx === activeIdx + 1) el.classList.add('near-active');
      else if (idx < activeIdx) el.classList.add('past');
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

  // ─── Background color extraction ────────────────────────────────────────────
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
      } catch (e) {}
    };
    img.src = imgUrl;
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