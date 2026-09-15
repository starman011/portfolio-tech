import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const baseStyles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const focusStyles = await readFile(new URL('../focus.css', import.meta.url), 'utf8');
const heroStyles = await readFile(new URL('../hero.css', import.meta.url), 'utf8');
assert(html.includes('<meta name="color-scheme" content="only light">'), 'Opt out of auto-darkening before styles/scripts load');
assert(/:root\s*\{[^}]*color-scheme:\s*only light/.test(baseStyles), 'The authored light palette must opt out of browser recolouring');
assert(/:root\[data-theme="dark"\]\s*\{color-scheme:dark/.test(baseStyles), 'Declare the authored dark theme at the document root');
assert(!/color-scheme:\s*light\b/.test(heroStyles), 'A hero override must not re-enable automatic darkening');
assert(!/\.theme-toggle\s*>\s*span:first-child/.test(baseStyles), 'The legacy half-circle selector must not override the animated switch');
assert(/\.theme-toggle\s*>\s*\.theme-track\s*\{[^}]*width:\s*44px;[^}]*height:\s*26px;/.test(focusStyles), 'Keep the full-size animated theme track');
assert.equal((html.match(/class="theme-track"/g)||[]).length, 1, 'Render exactly one current theme switch');
const motion = await readFile(new URL('../motion.js', import.meta.url), 'utf8');
assert(!/<script[^>]+ScrollTrigger/.test(html), 'Scroll-resetting plugin must not be loaded');
const source = motion.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
assert(!/scrollTo\s*\(|scrollIntoView\s*\(|\.focus\s*\(|ScrollTrigger/.test(source), 'Ambient motion must never move scroll or focus');
assert(html.includes('width="3024" height="1686"'), 'Reserve the Power BI image ratio');
assert(html.includes('width="712" height="467"'), 'Reserve the extraction image ratio');
for (const text of ['Interpret', 'Construct', 'Subtract', 'Webhook event', 'Version comparison', 'API investigation']) assert(html.includes(text), 'Missing restored process: ' + text);
for (const text of ['Fascinated by', 'The questions I keep following', 'student of things I don’t understand yet']) assert(html.includes(text), 'Missing personal narrative: ' + text);

// Exercise the entrance lifecycle without a browser or external dependencies.
const observers = [], cleanups = [], events = new Map(), tweens = [];
const node = { dataset: { playing: 'false' }, matches: () => false, addEventListener() {}, removeEventListener() {}, querySelector() { return node; } };
const eventTarget = {
  addEventListener(name, fn) { events.set(name, fn); },
  removeEventListener(name) { events.delete(name); }
};
const gsap = {
  matchMedia: () => ({ add: (_query, setup) => cleanups.push(setup()) }),
  from() {}, quickTo: () => () => {},
  timeline: () => ({ to() { return this; }, paused() {}, pause() {} }),
  utils: { toArray: () => [node] },
  fromTo: (_node, _from, to) => {
    const tween = { done: to.onComplete, progress() { this.done(); return this; }, kill() { this.killed = true; } };
    tweens.push(tween); return tween;
  }
};
class Observer {
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe() {}
  unobserve() { this.once = true; }
  disconnect() { this.disconnected = true; }
}
const context = createContext({
  window: { gsap, ...eventTarget },
  document: { hidden: false, body: { classList: { add() {} } }, querySelector: () => node, ...eventTarget },
  IntersectionObserver: Observer
});
context.window.IntersectionObserver = Observer;
new Script(motion).runInContext(context);
observers[0].callback([{ target: node, isIntersecting: true }]);
assert(observers[0].once, 'Entrances should unobserve after first entry');
assert.equal(tweens.length, 1);
events.get('visibilitychange')?.();
events.get('pagehide')?.();
cleanups.forEach(cleanup => cleanup?.());
assert(observers[0].disconnected);
assert(tweens[0].killed);
assert.equal(events.size, 0);
console.log('OK: restored process detail, reserved image ratios, scroll-free motion and entrance cleanup.');
