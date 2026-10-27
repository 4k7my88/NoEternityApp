import type { SoundEngine } from '../sound/engine';
import type { Stage } from '../stage';
import { artworkFileName, saveImage } from './save';

export interface ControlElements {
  toolbar: HTMLElement;
  sound: HTMLButtonElement;
  dissolve: HTMLButtonElement;
  save: HTMLButtonElement;
  clear: HTMLButtonElement;
  fullscreen: HTMLButtonElement;
  about: HTMLButtonElement;
  dialog: HTMLDialogElement;
  toast: HTMLElement;
}

/** Controls fade out after this long without input, leaving only the artwork. */
const HIDE_AFTER_MS = 3000;
const TOAST_MS = 2400;
const NUDGE_PX = 10;
const NUDGE_FAST_PX = 50;
const SOUND_PREFERENCE = 'no-eternity:sound';

export function setupControls(stage: Stage, sound: SoundEngine, el: ControlElements): void {
  const body = document.body;
  // Touch screens keep `:hover` on the last tapped button, so only trust it with a real pointer.
  const canHover = window.matchMedia('(hover: hover)');
  let hideTimer = 0;
  let toastTimer = 0;
  let touched = false;

  function showControls(): void {
    body.dataset.ui = 'shown';
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideControls, HIDE_AFTER_MS);
  }

  function hideControls(): void {
    const busy =
      el.dialog.open ||
      (canHover.matches && el.toolbar.matches(':hover')) ||
      el.toolbar.querySelector(':focus-visible') !== null ||
      el.dissolve.getAttribute('aria-pressed') === 'true';
    if (busy) {
      showControls();
      return;
    }
    body.dataset.ui = 'hidden';
    // The first-visit hint goes for good once the visitor has tried painting.
    if (touched) body.dataset.hint = 'off';
  }

  function toast(message: string): void {
    el.toast.textContent = message;
    el.toast.dataset.visible = 'true';
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => delete el.toast.dataset.visible, TOAST_MS);
  }

  stage.onInput = () => {
    touched = true;
    showControls();
  };

  // Dissolve: held down, like the pressure sensors of the original installation.
  function dissolve(on: boolean): void {
    if ((el.dissolve.getAttribute('aria-pressed') === 'true') === on) return;
    el.dissolve.setAttribute('aria-pressed', String(on));
    stage.setDissolving(on);
  }
  el.dissolve.addEventListener('pointerdown', (event) => {
    el.dissolve.setPointerCapture(event.pointerId);
    dissolve(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    el.dissolve.addEventListener(type, () => dissolve(false));
  }
  el.dissolve.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      dissolve(true);
    }
  });
  el.dissolve.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') dissolve(false);
  });
  window.addEventListener('blur', () => dissolve(false));

  async function save(): Promise<void> {
    try {
      const name = artworkFileName(new Date());
      const outcome = await saveImage(await stage.toBlob(), name);
      if (outcome === 'downloaded') toast(`Saved ${name}`);
      else if (outcome === 'shared') toast('Shared');
    } catch {
      toast('Could not save the image');
    }
  }
  el.save.addEventListener('click', () => void save());

  // Sound starts off: browsers block it until a gesture, and it should be the visitor's choice.
  let wantSound = readSoundPreference();
  el.sound.setAttribute('aria-pressed', String(wantSound));
  function setSound(on: boolean): void {
    wantSound = on;
    el.sound.setAttribute('aria-pressed', String(on));
    writeSoundPreference(on);
    if (on) sound.start();
    else sound.stop();
    toast(on ? 'Sound on' : 'Sound off');
  }
  el.sound.addEventListener('click', () => setSound(!wantSound));
  // A visitor who chose sound before hears it again from their first touch or key press,
  // which is also what brings it back if the system interrupted it.
  const resumeSound = (event: Event) => {
    const toggling =
      (event.target instanceof Node && el.sound.contains(event.target)) ||
      (event instanceof KeyboardEvent && event.key.toLowerCase() === 'm');
    if (wantSound && !toggling) sound.start();
  };
  // Which events count as a gesture differs: a touch counts when it ends, a mouse when pressed.
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const) {
    window.addEventListener(type, resumeSound, true);
  }

  el.clear.addEventListener('click', () => {
    stage.clear();
    toast('Cleared. There is no eternity.');
  });

  // Full screen, keeping the display awake like a screen saver should.
  if (document.fullscreenEnabled) {
    el.fullscreen.hidden = false;
    el.fullscreen.addEventListener('click', () => void toggleFullscreen());
    document.addEventListener('fullscreenchange', () => {
      const on = document.fullscreenElement !== null;
      el.fullscreen.setAttribute('aria-pressed', String(on));
      el.fullscreen.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
      el.fullscreen.title = on ? 'Exit full screen (F)' : 'Full screen (F)';
      void keepAwake(on);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && document.fullscreenElement) void keepAwake(true);
    });
  }

  el.about.addEventListener('click', openAbout);
  el.dialog.addEventListener('click', (event) => {
    // A click outside the content lands on the dialog element itself: close.
    if (event.target === el.dialog) el.dialog.close();
  });
  el.dialog.addEventListener('close', showControls);

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || el.dialog.open) return;
    const onControl = event.target instanceof Element && event.target.closest('button, a') !== null;
    // Holding a key down repeats it: only moving and dissolving should, not saving or toggling.
    if (event.repeat && event.key !== ' ' && !event.key.startsWith('Arrow')) return;
    const step = event.shiftKey ? NUDGE_FAST_PX : NUDGE_PX;

    switch (event.key) {
      case ' ':
        if (onControl) return;
        event.preventDefault();
        if (!event.repeat) dissolve(true);
        break;
      case 'ArrowUp':
        stage.nudge(0, -step);
        break;
      case 'ArrowDown':
        stage.nudge(0, step);
        break;
      case 'ArrowLeft':
        stage.nudge(-step, 0);
        break;
      case 'ArrowRight':
        stage.nudge(step, 0);
        break;
      case 's':
      case 'S':
        void save();
        break;
      case 'm':
      case 'M':
        setSound(!wantSound);
        break;
      case 'f':
      case 'F':
        if (document.fullscreenEnabled) void toggleFullscreen();
        break;
      case 'i':
      case 'I':
      case '?':
        openAbout();
        break;
      default:
        return;
    }
    showControls();
  });
  window.addEventListener('keyup', (event) => {
    if (event.key === ' ') dissolve(false);
  });

  el.toolbar.addEventListener('focusin', showControls);
  // A tapped or clicked button lets go of focus, so Space dissolves next instead of pressing
  // it again (say, clearing twice). Keyboard users keep their place: their clicks have no detail.
  el.toolbar.addEventListener('click', (event) => {
    if (event.detail > 0 && event.target instanceof Element) event.target.closest('button')?.blur();
  });
  el.toolbar.addEventListener('contextmenu', (event) => event.preventDefault());

  function openAbout(): void {
    dissolve(false);
    if (!el.dialog.open) el.dialog.showModal();
  }

  showControls();
}

function readSoundPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_PREFERENCE) === 'on';
  } catch {
    return false;
  }
}

function writeSoundPreference(on: boolean): void {
  try {
    localStorage.setItem(SOUND_PREFERENCE, on ? 'on' : 'off');
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    // Refused (for example inside an iframe without permission): nothing to do.
  }
}

let wakeLock: WakeLockSentinel | null = null;

async function keepAwake(on: boolean): Promise<void> {
  if (!('wakeLock' in navigator)) return;
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
    }
  } catch {
    // Battery saver or permissions policy can refuse; the artwork works without it.
  }
}
