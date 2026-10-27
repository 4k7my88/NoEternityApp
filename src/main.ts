import './styles.css';
import { SoundEngine } from './sound/engine';
import { Stage } from './stage';
import { setupControls } from './ui/controls';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} is missing from index.html`);
  return element as T;
}

const stage = new Stage({
  art: byId('art'),
  title: byId('title'),
  viewportProbe: byId('viewport-probe'),
});

const sound = new SoundEngine();
stage.onStep = (frame) => sound.update(frame);

setupControls(stage, sound, {
  toolbar: byId('toolbar'),
  sound: byId('sound'),
  dissolve: byId('dissolve'),
  save: byId('save'),
  clear: byId('clear'),
  fullscreen: byId('fullscreen'),
  about: byId('about'),
  dialog: byId('about-dialog'),
  toast: byId('toast'),
});

stage.start();
