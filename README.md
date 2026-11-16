# HER UNIVERSE — Beyond the Stars, Made Just for You 🌌

A cinematic, responsive birthday website built with plain HTML, CSS and JavaScript. There is no framework and nothing to install. The look is dark, premium, celestial and personal. The visible language of the website is English.

## How to run the website

1. Extract `her_universe_birthday.zip`.
2. Open `index.html` in Chrome, Edge, Firefox or Safari.
3. Click **Explore Your Universe**. Music never plays automatically.

To preview with a local server, open a terminal in the project folder and run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Personalizing the site for a client

Open **`config.js`**. It is the main personalization file. Replace the sample text with the couple's real details:

- `herName` and `fromName`
- `introLine`, `birthdayLine`, `birthdayLetter` and `finalMessage`
- `memories`: photo paths, titles, dates, categories and captions
- `timeline`: important dates and story chapters
- `littleThings`: real qualities, inside jokes and personal notes
- `letters` and `adventures`
- `vaultQuestion`, `vaultHint` and `vaultAnswer`
- `musicSrc`, if you have an audio track you are licensed to include

The memory images included in the project are original illustrated couple artwork created as sample visuals. Replace them with the client's real photos before delivery.

### Adding photos permanently

1. Copy the photos into the `assets/photos/` folder.
2. In `config.js`, update the `image` path of each memory, for example `assets/photos/first-date.jpg`.
3. Update the title, date, category and description of that photo as well.

The **Add photos** button in the Memory Gallery only gives a local preview in the current browser session. It does not upload or save photos to the website.

### Adding music

1. Place an audio file you have permission to use in `assets/audio/`, for example `assets/audio/our-song.mp3`.
2. Set `musicSrc: "assets/audio/our-song.mp3"` in `config.js`.
3. The Music Room offers play/pause, progress seeking, volume control and a local preview option. Audio plays only when the visitor presses play.

### What the website includes

- Cinematic intro: a star glows in the darkness, the birthday line slowly appears, and a constellation connects around the name
- An interactive galaxy with 9 planets, nebula clouds, orbital rings, floating stardust, shooting stars, a cursor sparkle trail and a portal-style transition
- On mobile there is no planet-card grid: the planets stay in the orbit scene and rotate with a short finger drag
- Memory gallery with category filters, a photo lightbox and temporary local photo preview
- Interactive memory timeline
- A clickable constellation of little things and compliments
- A refined birthday cake with 3 balanced tiers, frosting, trim, centered candles, a make-a-wish interaction and confetti
- 4 interactive letter envelopes and one full birthday letter
- Music Room with playback, progress and volume controls
- Future adventures list with save/unsave states
- A riddle-based Secret Vault that unlocks the Final Surprise
- A Final Surprise with an animated heart constellation, twinkling stars, a personal birthday message and replay / back-to-galaxy controls — **there is no video-message slot**
- Keyboard focus support, Escape to close overlays, reduced-motion support, mobile navigation and no forced autoplay

## Publishing online

This is a static website and can be published on any static hosting service. Upload all of the project files and keep the folder structure the same. Every file path in `config.js` must match the deployed file names exactly, including capital letters.

## Technical notes

- No framework or runtime dependency.
- A canvas draws the procedural starfield; the planets and the cake are CSS illustrations.
- The Secret Vault is a playful front-end gate, not real security. Do not put confidential information behind it.
- The photo and audio pickers do not send the selected files to a server. They use temporary browser preview URLs, so files must be added to the project folder manually to be saved.
- Google Fonts load when the internet is available, and fallback fonts are also defined.
