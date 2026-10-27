# Project review

A review of the 2015 Processing for Android project in `noEternity/`, and how the web version handles each point.

## What the original does

`noEternity.pde` runs at 60 fps on a black screen and never clears it, so everything accumulates:

1. It draws "no Eternity" in black at (width/7, height/3), using a bundled 48px bitmap font.
2. `one()` paints a row of 1,000 circles at the touch's height: 30px wide, 10px apart, at 40/255 opacity. Red and green are `random(10, 555)`. Anything above 255 clamps, so each channel is maxed about 55% of the time, which gives the piece its pastel and yellow cast. Blue is the touch's X position in raw pixels.
3. Processing keeps `mouseX`/`mouseY` after the finger lifts, so the band keeps building where the finger was last.
4. `CLASS.display()` blurs the whole screen and scatters snaking lines of black squares. On Android it never runs: it only fires when `thirdvalue`/`fourthvalue` are above 0. The exported Java in `bin/export` shows why: those values came from Arduino sensors 3 and 4 over a serial port in the installation version, and that code is commented out in the app.

## Findings and what changed

| # | Finding | Web version |
|---|---------|-------------|
| 1 | Android-only, and stuck on API level 10 (Android 2.3). Google Play has required much newer target APIs for years, so the listing is probably hidden or removed for current devices. (I couldn't check this from the build environment.) | Runs in any modern browser, on phone, tablet and desktop. Installable from the browser through a web manifest. |
| 2 | The dissolve effect (`CLASS.display()`) is dead code without the sensors. | Brought back as a hold gesture (the ◐ button or the space bar). Holding the button with one finger while painting with another works like the installation's separate sensors. |
| 3 | Only one touch is used. | Every finger paints its own band. |
| 4 | Sizes are raw device pixels, so the piece looks different on every screen density. The blue channel maxes out at a different point on every device. | Sizes are CSS pixels. Blue maxes out at a fixed fraction (30%) of the width, which keeps the 2015 phone feel on any screen. The title scales with the screen, matching the proportions of the promo art. |
| 5 | Always draws 1,000 circles per frame, even off screen. | Draws only enough circles to cover the width. |
| 6 | Speed depends on the device: slow phones paint more slowly, and on 120 Hz screens it would paint twice as fast. | A fixed 60 steps per second, so it builds up the same way everywhere. |
| 7 | A "screen saver" that does nothing until touched. | After 6 seconds without input, an invisible hand keeps wandering and painting. Turned off for visitors who ask their system for reduced motion. |
| 8 | Nothing can be kept. | Save to PNG (the share sheet on phones). |
| 9 | 1.9 MB of bitmap fonts (`.vlw`) just for the title. | Uses the system serif. No font download. |
| 10 | No way to start over. | A Clear button. |
| 11 | No tests or build checks. | Unit tests for the ported drawing logic, a typecheck, and a GitHub Actions workflow that runs both plus the build on every pull request. |
| 12 | macOS metadata files (`.DS_Store`, `._*`) committed. | Removed, and ignored in `.gitignore`. |
| 13 | Silent. | Optional generative sound that follows the picture: height is pitch, colour is tone, new paint rings out, fullness sets the reverb, and dissolving blurs the sound. Off until the visitor turns it on. |

The look follows the original closely: the same circle size, spacing, opacity, colour distribution and accumulation, the same title position, and the same dissolve loops, ported line by line. Resizing the window or rotating a phone keeps the picture instead of wiping it.

## Still to decide (needs the owner)

- **Signing key in the repository.** `noEternity/noEternity.bks` is the Android keystore used to sign the Play Store app, and it has been public in git history since 2015. It is password-protected, but anyone can download it and try to brute-force it offline. If you still plan to update the Android app: keep a private backup, remove the file from the repository, and consider rewriting history (for example with `git filter-repo`). If the Android app is retired, the file can simply be deleted. I left it in place because deleting it is your call.
- **Play Store link.** The README still links to the 2015 listing. Check whether it still loads; if it doesn't, remove the link or point it to the web version.
- **Build output in git.** `noEternity/bin/export` (including a 400 KB `processing-core.jar`) is generated output. It is kept for history, since the commented-out sensor code is only there, but it could be removed.
- **Artist credit.** The site doesn't name the artist anywhere. Add your name and links to the About dialog in `index.html` if you want them shown.
- **Statement wording.** In the README and the About dialog, "I combines" was corrected to "I combine". "There are no eternity." was kept as written. Change it to "There is no eternity." if that wording wasn't intentional.
