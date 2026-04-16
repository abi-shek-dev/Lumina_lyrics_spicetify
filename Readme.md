# ✦ Lumina Lyrics

> Cinematic, karaoke-style full-screen lyrics for Spotify via Spicetify

A beautiful lyrics overlay mod for Spicetify — inspired by **Beautiful Lyrics** — with auto-scrolling synced lines, word-by-word karaoke highlighting, album art–driven ambient backgrounds, and multi-source lyric fetching.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎵 Synced lyrics | Line-by-line scrolling locked to the song position |
| 🎤 Karaoke mode | Word-by-word progressive highlight within each line |
| 🌌 Ambient backgrounds | Colors extracted from album art drive the animated backdrop |
| 🔍 Multi-source fetching | Spotify native → LRCLIB → NetEase fallback chain |
| ⏭ Click to seek | Click any lyric line to jump to that moment |
| ⌨ Keyboard shortcut | Press `Esc` to close the overlay |
| 🎯 Smooth auto-scroll | Active line centers itself; pauses on manual scroll |
| 📱 Responsive | Scales from compact to ultrawide |

---

## 🛠 Installation

### Prerequisites

1. **Install Spicetify** — [spicetify.app](https://spicetify.app/)
2. Spotify must be running and Spicetify configured

### Method 1: Spicetify Marketplace (recommended)

```bash
# Open Spicetify Marketplace inside Spotify
# Search for "Lumina Lyrics" → Install
```

### Method 2: Manual install

1. **Find your Spicetify extensions folder:**

```bash
# macOS / Linux
~/.config/spicetify/Extensions/

# Windows
%APPDATA%\spicetify\Extensions\
```

2. **Copy the extension file:**

```bash
# macOS/Linux
cp lumina-lyrics.js ~/.config/spicetify/Extensions/

# Windows (PowerShell)
Copy-Item lumina-lyrics.js "$env:APPDATA\spicetify\Extensions\"
```

3. **Register and apply:**

```bash
spicetify config extensions lumina-lyrics.js
spicetify apply
```

4. Restart Spotify — you'll see a **"Lyrics"** button appear in the Now Playing bar.

---

## 🎮 Usage

1. Play any song in Spotify
2. Click the **♫ Lyrics** button in the bottom-left of the Now Playing bar
3. The full-screen overlay opens with synced lyrics
4. Toggle **✦ Karaoke** in the top-right for word-by-word highlighting
5. Click any lyric line to seek to that timestamp
6. Press **Esc** or click **✕** to close

---

## 🔧 How lyrics are fetched

Lumina Lyrics tries three sources in order:

1. **Spotify native** — `spclient.wg.spotify.com` (requires Premium; has both synced and unsynced)
2. **LRCLIB** — free open-source LRC database; best fallback for synced lyrics
3. **NetEase Cloud Music** — large Chinese lyric database; plain text fallback

Unsynced lyrics display without scrolling but still look beautiful.

---

## 🏗 Project structure

```
lumina-lyrics/
├── lumina-lyrics.js     ← The extension (copy this to Spicetify Extensions/)
├── manifest.json        ← Spicetify Marketplace metadata
└── README.md
```

---

## 🩹 Troubleshooting

| Problem | Fix |
|---|---|
| "Lyrics" button doesn't appear | Run `spicetify apply` again; restart Spotify |
| Overlay is blank | Your track may have no lyrics in any database |
| Lyrics are out of sync | Try clicking a correct line to re-anchor position |
| Extension not loading | Check `spicetify config extensions` includes `lumina-lyrics.js` |
| Background stays dark | Album art canvas extract may be blocked by CORS |

---

## 📄 License

MIT — free to use, fork, and modify.

---

*Made with 🎵 — inspired by Beautiful Lyrics by surfbryce*