// Stage for the particle homepage: one fixed renderer behind the whole page, a chapter clock driven by scroll,
// a smoothed pointer, optional bloom, and the pause rules.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const C = {
	bg: 0x0b0f17, surface: 0x131a2a, surface2: 0x1a2236, border: 0x222c44,
	text: 0xe8edf7, muted: 0x9aa7bd, accent: 0x7c5cff, accent2: 0x2dd4ff, shipped: 0x3ddc97, pink: 0xff5c8a, gold: 0xffc94d,
};
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isSmall = () => innerWidth < 760;
export const clamp01 = v => Math.min(1, Math.max(0, v));
export const ease = t => t * t * (3 - 2 * t);
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function seeded(seed = 7) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function createStage({ chapters, fov = 35, bloom = null, clear = C.bg, dprMax = 2, toneMapping = THREE.ACESFilmicToneMapping, exposure = 1 } = {}) {
	const host = document.querySelector('.stage');
	const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
	renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall() ? 1.5 : dprMax));
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = toneMapping;
	renderer.toneMappingExposure = exposure;
	renderer.setClearColor(clear, 1);
	host.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(fov, innerWidth / innerHeight, 0.1, 500);
	const size = { w: innerWidth, h: innerHeight };

	let composer = null, bloomPass = null;
	if (bloom) {
		composer = new EffectComposer(renderer);
		composer.addPass(new RenderPass(scene, camera));
		bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), bloom.strength ?? 0.6, bloom.radius ?? 0.5, bloom.threshold ?? 0.8);
		composer.addPass(bloomPass);
		composer.addPass(new OutputPass());
	}

	// ---- Chapter clock: a fractional index. A chapter taller than the screen holds its whole index while it
	// fills the view; i + t only moves through the gap between one chapter's hold zone and the next ----
	const chapterEls = chapters || [];
	let zones = [];
	function measureChapters() {
		zones = chapterEls.map(el => {
			const r = el.getBoundingClientRect();
			const top = r.top + scrollY, half = Math.min(r.height, innerHeight) / 2;
			return [top + half, top + r.height - half];
		});
	}
	function rawChapter() {
		if (!zones.length) return 0;
		const c = scrollY + innerHeight / 2;
		if (c <= zones[0][1]) return 0;
		for (let i = 0; i < zones.length - 1; i++) {
			const end = zones[i][1], next = zones[i + 1][0];
			if (c < next) return i + Math.max(0, c - end) / Math.max(1, next - end);
			if (c <= zones[i + 1][1]) return i + 1;
		}
		return zones.length - 1;
	}
	const clock = {
		chapter: 0,           // smoothed fractional chapter index
		page: 0,              // smoothed 0..1 page progress
		velocity: 0,          // smoothed scroll speed, chapters per second
		index: () => Math.floor(clock.chapter + 1e-4),
		local: () => clock.chapter - Math.floor(clock.chapter + 1e-4),
		ids: chapterEls.map(el => el.dataset.chapter),
	};

	const pointer = { x: 0, y: 0, sx: 0, sy: 0, px: -1, py: -1, down: false, moved: 0 };
	addEventListener('pointermove', e => {
		pointer.px = e.clientX; pointer.py = e.clientY;
		pointer.x = (e.clientX / innerWidth) * 2 - 1;
		pointer.y = -(e.clientY / innerHeight) * 2 + 1;
		pointer.moved = 1;
	}, { passive: true });
	addEventListener('pointerdown', () => { pointer.down = true; });
	addEventListener('pointerup', () => { pointer.down = false; });

	const resizers = [];
	function resize() {
		size.w = innerWidth; size.h = innerHeight;
		renderer.setSize(size.w, size.h);
		camera.aspect = size.w / size.h;
		camera.updateProjectionMatrix();
		if (composer) composer.setSize(size.w, size.h);
		measureChapters();
		resizers.forEach(fn => fn(size));
	}
	addEventListener('resize', resize);
	new ResizeObserver(measureChapters).observe(document.body);

	let update = () => {}, render = null, elapsed = 0, running = false;
	const afterRender = [];
	function frame(dt) {
		const target = rawChapter();
		const k = dt > 0 ? 1 - Math.exp(-dt * 5) : 1;
		const prev = clock.chapter;
		clock.chapter += (target - clock.chapter) * k;
		clock.velocity += ((dt > 0 ? (clock.chapter - prev) / dt : 0) - clock.velocity) * (dt > 0 ? 1 - Math.exp(-dt * 8) : 1);
		const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
		clock.page += (scrollY / max - clock.page) * k;
		const kp = dt > 0 ? 1 - Math.exp(-dt * 4) : 1;
		pointer.sx += (pointer.x - pointer.sx) * kp;
		pointer.sy += (pointer.y - pointer.sy) * kp;
		pointer.moved *= dt > 0 ? Math.exp(-dt * 3) : 1;
		update(dt, elapsed);
		if (render) render(dt, elapsed);
		else if (composer) composer.render(dt);
		else renderer.render(scene, camera);
		afterRender.forEach(fn => fn(dt, elapsed));
	}

	const timer = new THREE.Clock();
	function loop() {
		const dt = Math.min(timer.getDelta(), 1 / 20);
		if (document.hidden || api.paused) return;
		elapsed += dt;
		frame(dt);
	}

	const api = {
		renderer, scene, camera, size, clock, pointer, composer, bloomPass,
		paused: false,        // a page can stop the loop, e.g. while one of its videos plays
		onResize: fn => resizers.push(fn),
		afterRender: fn => afterRender.push(fn),
		setRender: fn => { render = fn; },
		get elapsed() { return elapsed; },
		start(fn) {
			update = fn;
			resize();
			clock.chapter = rawChapter();
			if (reduceMotion) { frame(0); addEventListener('scroll', () => frame(0), { passive: true }); return; }
			running = true;
			renderer.setAnimationLoop(loop);
		},
		// Debug only: advance frames by hand, for screenshots in a throttled background tab
		step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { elapsed += dt; frame(dt); } },
	};
	if (location.hostname === 'localhost') window.__exp = api; // debug handle for local testing only
	return api;
}

// Text drawn to a canvas and sampled into points — lets particles and sprites spell words in the site's font
export function sampleText(text, { count = 4000, font = '700 220px "Space Grotesk", sans-serif', width = 1600, height = 420, scale = 0.01, rand = Math.random, lineHeight = 1 } = {}) {
	const c = document.createElement('canvas');
	c.width = width; c.height = height;
	const g = c.getContext('2d');
	g.fillStyle = '#fff';
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.font = font;
	const lines = text.split('\n');
	const lh = (height / lines.length) * lineHeight;
	lines.forEach((line, i) => g.fillText(line, width / 2, height / 2 + (i - (lines.length - 1) / 2) * lh));
	const data = g.getImageData(0, 0, width, height).data;
	const filled = [];
	for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) if (data[(y * width + x) * 4 + 3] > 128) filled.push(x, y);
	const out = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		const j = Math.floor(rand() * (filled.length / 2)) * 2;
		out[i * 3] = (filled[j] - width / 2 + (rand() - 0.5) * 2) * scale;
		out[i * 3 + 1] = -(filled[j + 1] - height / 2 + (rand() - 0.5) * 2) * scale;
		out[i * 3 + 2] = (rand() - 0.5) * 0.15;
	}
	return out;
}
