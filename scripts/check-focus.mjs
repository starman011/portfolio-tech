import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const motion = await readFile(new URL('../motion.js', import.meta.url), 'utf8');
assert(!/<script[^>]+ScrollTrigger/.test(html), 'Scroll-resetting plugin must not be loaded');
const source = motion.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
assert(!/scrollTo\s*\(|scrollIntoView\s*\(|\.focus\s*\(|ScrollTrigger/.test(source), 'Ambient motion must never move scroll or focus');
assert(html.includes('width="3024" height="1686"'), 'Reserve the Power BI image ratio');
assert(html.includes('width="712" height="467"'), 'Reserve the extraction image ratio');
for (const text of ['Interpret', 'Construct', 'Subtract', 'Webhook event', 'Version comparison', 'API investigation']) assert(html.includes(text), 'Missing restored process: ' + text);

// Exercise the entrance lifecycle without a browser or external dependencies.
const observers = [], cleanups = [], events = new Map(), tweens = [];
const node = { dataset: { playing: 'false' }, addEventListener() {}, removeEventListener() {}, querySelector() { return node; } };
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
