// Particle Odyssey — the homepage's background. 65k GPU-simulated particles morph from form to form as you scroll.
// Each particle springs toward its target in the current chapter's shape, curl noise tears the cloud apart
// mid-transition, the cursor blows particles away (Leaf Sweeper's blower), and a click sends a sonar shell
// through the cloud (Echo Room's ping).
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStage, C, seeded, isSmall, easeInOut, clamp01, sampleText, reduceMotion } from './stage.js';
import { makeHeadset, makeGamepad } from './props.js';

// One form per chapter, in page order; `side` is where the chapter's text sits, so the cloud takes the other side
const FORMS = [
	{ id: 'hero', name: 'XR headset', cols: [C.accent2, C.accent], side: 'left' },
	{ id: 'experience', name: 'Career helix', cols: [C.accent, C.pink], side: 'right' },
	{ id: 'work', name: 'Controller', cols: [C.accent2, 0x9fe8ff], side: 'left' },
	{ id: 'personal-leaf', name: 'Leaf', cols: [0xff7a2f, 0xffd166], side: 'right' },
	{ id: 'personal-echo', name: 'Sonar room', cols: [0x2dd4ff, 0x2a5cff], side: 'left' },
	{ id: 'personal-market', name: 'Cart', cols: [C.shipped, 0xb6ffda], side: 'right' },
	{ id: 'personal-skate', name: 'Skateboard', cols: [C.pink, 0xffb36b], side: 'left' },
	{ id: 'skills', name: 'Skill network', cols: [C.accent, C.accent2], side: 'right' },
	{ id: 'contact', name: 'Hello', cols: [0xffffff, C.accent2], side: 'left' },
];

const chapters = FORMS.map(f => document.querySelector(`[data-chapter="${f.id}"]`));
document.documentElement.classList.add('odyssey-on');

const stage = createStage({ chapters, fov: 35, bloom: { strength: 0.85, radius: 0.55, threshold: 0.15 }, exposure: 1 });
const { scene, camera, renderer, clock, pointer, size } = stage;
const rand = seeded(21);

const SIZE = isSmall() ? 160 : 256;
const COUNT = SIZE * SIZE;
document.getElementById('count').textContent = COUNT.toLocaleString('en-US');

// ---------- Shape builders: each returns COUNT xyz points ----------

function fromObject(obj, scale = 1) {
	obj.updateMatrixWorld(true);
	const geos = [];
	obj.traverse(o => {
		if (!o.isMesh) return;
		let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
		g = g.index ? g.toNonIndexed() : g;
		for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
		g.computeVertexNormals();
		geos.push(g);
	});
	const merged = mergeGeometries(geos);
	const sampler = new MeshSurfaceSampler(new THREE.Mesh(merged)).setRandomGenerator(rand).build();
	const out = new Float32Array(COUNT * 3), v = new THREE.Vector3();
	for (let i = 0; i < COUNT; i++) {
		sampler.sample(v);
		out[i * 3] = v.x * scale; out[i * 3 + 1] = v.y * scale; out[i * 3 + 2] = v.z * scale;
	}
	return out;
}

// Points along line segments, a little jittered so lines read as glowing strands
function onSegments(segs, n, out, offset, jitter = 0.025) {
	const lens = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
	const total = lens.reduce((s, l) => s + l, 0);
	for (let i = 0; i < n; i++) {
		let r = rand() * total, k = 0;
		while (r > lens[k] && k < lens.length - 1) r -= lens[k++];
		const [a, b] = segs[k], t = r / lens[k];
		const j = (offset + i) * 3;
		out[j] = a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * jitter;
		out[j + 1] = a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * jitter;
		out[j + 2] = a[2] + (b[2] - a[2]) * t + (rand() - 0.5) * jitter;
	}
}
function circle(cx, cy, cz, r, axis = 'y', steps = 48) {
	const segs = [];
	for (let i = 0; i < steps; i++) {
		const a0 = (i / steps) * Math.PI * 2, a1 = ((i + 1) / steps) * Math.PI * 2;
		const p = a => axis === 'y' ? [cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]
			: axis === 'z' ? [cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]
			: [cx, cy + Math.cos(a) * r, cz + Math.sin(a) * r];
		segs.push([p(a0), p(a1)]);
	}
	return segs;
}

function headsetForm() {
	const h = makeHeadset();
	h.rotation.set(0.28, -1.0, 0.05);
	return fromObject(h, 2.9);
}

function helixForm() {
	const out = new Float32Array(COUNT * 3);
	for (let i = 0; i < COUNT; i++) {
		const r = rand(), j = i * 3;
		if (r < 0.62) {
			// two strands
			const t = rand(), strand = rand() < 0.5 ? 0 : Math.PI;
			const a = t * Math.PI * 4.2 + strand, y = (t - 0.5) * 6.4;
			out[j] = Math.cos(a) * 1.7 + (rand() - 0.5) * 0.08; out[j + 1] = y; out[j + 2] = Math.sin(a) * 1.7 + (rand() - 0.5) * 0.08;
		} else if (r < 0.85) {
			// rungs
			const t = Math.floor(rand() * 26) / 26 + 0.01, a = t * Math.PI * 4.2, s = rand() * 2 - 1;
			out[j] = Math.cos(a) * 1.7 * s; out[j + 1] = (t - 0.5) * 6.4; out[j + 2] = Math.sin(a) * 1.7 * s;
		} else {
			// four bright knots — one per job
			const k = Math.floor(rand() * 4), t = 0.12 + k * 0.25, a = t * Math.PI * 4.2;
			const d = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(rand()) * 0.42);
			out[j] = Math.cos(a) * 1.7 + d.x; out[j + 1] = (t - 0.5) * 6.4 + d.y; out[j + 2] = Math.sin(a) * 1.7 + d.z;
		}
	}
	return out;
}

function gamepadForm() {
	const g = makeGamepad();
	g.rotation.set(0.9, 0, 0);
	return fromObject(g, 2.6);
}

function leafForm() {
	const out = new Float32Array(COUNT * 3);
	const leaf = (j, s, rot, ox, oy, oz) => {
		let x, y;
		do { x = rand() * 2 - 1; y = rand() * 2.6; } while (Math.abs(x) > Math.pow(Math.sin((Math.PI * y) / 2.6), 0.85) * 1.05);
		if (rand() < 0.18) x *= 0.04; // midrib
		const z = 0.32 * x * x - 0.1 * y;
		const c = Math.cos(rot), sn = Math.sin(rot);
		const px = x * c - (y - 1.3) * sn, py = x * sn + (y - 1.3) * c;
		out[j] = px * s + ox; out[j + 1] = py * s + oy; out[j + 2] = z * s + oz;
	};
	for (let i = 0; i < COUNT; i++) {
		const r = rand(), j = i * 3;
		if (r < 0.62) leaf(j, 1.55, -0.5, 0, 0.1, 0);
		else if (r < 0.74) leaf(j, 0.55, 0.9, 2.1, 1.4, -0.6);
		else if (r < 0.84) leaf(j, 0.42, 2.4, -2.2, -1.3, 0.4);
		else {
			const a = rand() * Math.PI * 2, rr = 2.4 + rand() * 1.6;
			out[j] = Math.cos(a) * rr; out[j + 1] = (rand() - 0.5) * 4.5; out[j + 2] = Math.sin(a) * rr * 0.5;
		}
	}
	return out;
}

function echoForm() {
	const out = new Float32Array(COUNT * 3);
	const w = 2.4, h = 1.7, d = 2.4;
	const box = [];
	const P = (x, y, z) => [x * w, y * h, z * d];
	for (const y of [-1, 1]) { box.push([P(-1, y, -1), P(1, y, -1)], [P(1, y, -1), P(1, y, 1)], [P(1, y, 1), P(-1, y, 1)], [P(-1, y, 1), P(-1, y, -1)]); }
	for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box.push([P(x, -1, z), P(x, 1, z)]);
	const n1 = Math.floor(COUNT * 0.32);
	onSegments(box, n1, out, 0, 0.03);
	const rings = [...circle(0, -h + 0.02, 0, 0.8), ...circle(0, -h + 0.02, 0, 1.5), ...circle(0, -h + 0.02, 0, 2.2)];
	const n2 = Math.floor(COUNT * 0.38);
	onSegments(rings, n2, out, n1, 0.04);
	for (let i = n1 + n2; i < COUNT; i++) {
		const j = i * 3;
		if (rand() < 0.5) {
			const v = new THREE.Vector3().randomDirection().multiplyScalar(0.28 * Math.cbrt(rand()));
			out[j] = v.x; out[j + 1] = v.y - 0.6; out[j + 2] = v.z;
		} else {
			out[j] = (rand() - 0.5) * 2 * w; out[j + 1] = (rand() - 0.5) * 2 * h; out[j + 2] = (rand() - 0.5) * 2 * d;
		}
	}
	return out;
}

function cartForm() {
	const out = new Float32Array(COUNT * 3);
	const segs = [];
	const top = (x, z) => [x * 1.6, 1.0, z * 1.0], bot = (x, z) => [x * 1.25 + 0.15, -0.3, z * 0.8];
	for (const z of [-1, 1]) {
		segs.push([top(-1, z), top(1, z)], [bot(-1, z), bot(1, z)]);
		for (let k = 0; k <= 8; k++) { const x = -1 + k / 4; segs.push([top(x, z), bot(x, z)]); }
		for (let k = 1; k < 4; k++) { const f = k / 4; segs.push([lerp3(top(-1, z), bot(-1, z), f), lerp3(top(1, z), bot(1, z), f)]); }
	}
	for (const x of [-1, 1]) {
		segs.push([top(x, -1), top(x, 1)], [bot(x, -1), bot(x, 1)]);
		for (let k = 0; k <= 4; k++) { const z = -1 + k / 2; segs.push([top(x, z), bot(x, z)]); }
	}
	for (let k = 0; k <= 6; k++) { const x = -1 + k / 3; segs.push([bot(x, -1), bot(x, 1)]); }
	segs.push([top(-1, -1), [-2.3, 1.7, -1.0]], [top(-1, 1), [-2.3, 1.7, 1.0]], [[-2.3, 1.7, -1.05], [-2.3, 1.7, 1.05]]);
	segs.push([bot(-1, -1), [-1.0, -1.15, -0.8]], [bot(1, -1), [1.3, -1.15, -0.8]], [bot(-1, 1), [-1.0, -1.15, 0.8]], [bot(1, 1), [1.3, -1.15, 0.8]]);
	const n1 = Math.floor(COUNT * 0.86);
	onSegments(segs, n1, out, 0, 0.03);
	const wheels = [...circle(-1.0, -1.35, -0.8, 0.2, 'z', 24), ...circle(1.3, -1.35, -0.8, 0.2, 'z', 24), ...circle(-1.0, -1.35, 0.8, 0.2, 'z', 24), ...circle(1.3, -1.35, 0.8, 0.2, 'z', 24)];
	onSegments(wheels, COUNT - n1, out, n1, 0.05);
	return out;
}
function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function skateForm() {
	const out = new Float32Array(COUNT * 3);
	const n1 = Math.floor(COUNT * 0.74);
	for (let i = 0; i < n1; i++) {
		let x, z;
		do { x = rand() * 4.4 - 2.2; z = rand() * 1.2 - 0.6; }
		while (Math.abs(x) > 1.65 && Math.hypot(Math.abs(x) - 1.65, z) > 0.6);
		const ax = Math.abs(x), y = ax > 1.4 ? Math.pow(ax - 1.4, 2) * 0.55 : 0;
		out[i * 3] = x; out[i * 3 + 1] = y + (rand() - 0.5) * 0.04; out[i * 3 + 2] = z;
	}
	const segs = [];
	for (const x of [-1.25, 1.25]) {
		segs.push([[x, -0.05, -0.5], [x, -0.05, 0.5]], [[x, -0.05, 0], [x, -0.32, 0]], [[x - 0.12, -0.32, -0.5], [x + 0.12, -0.32, 0.5]]);
		for (const z of [-0.5, 0.5]) segs.push(...circle(x, -0.45, z, 0.17, 'z', 18), ...circle(x, -0.45, z, 0.09, 'z', 12));
	}
	onSegments(segs, COUNT - n1, out, n1, 0.04);
	for (let i = 0; i < COUNT; i++) {
		// tilt the board toward the camera
		const j = i * 3, y = out[j + 1], z = out[j + 2], a = 0.6;
		out[j + 1] = y * Math.cos(a) - z * Math.sin(a);
		out[j + 2] = y * Math.sin(a) + z * Math.cos(a);
		out[j] *= 1.2; out[j + 1] *= 1.2; out[j + 2] *= 1.2;
	}
	return out;
}

function networkForm() {
	const out = new Float32Array(COUNT * 3);
	const ico = new THREE.IcosahedronGeometry(2.7, 1);
	const edges = new THREE.EdgesGeometry(ico).attributes.position;
	const segs = [];
	for (let i = 0; i < edges.count; i += 2) segs.push([[edges.getX(i), edges.getY(i), edges.getZ(i)], [edges.getX(i + 1), edges.getY(i + 1), edges.getZ(i + 1)]]);
	const n1 = Math.floor(COUNT * 0.6);
	onSegments(segs, n1, out, 0, 0.02);
	const verts = ico.attributes.position;
	for (let i = n1; i < COUNT; i++) {
		const k = Math.floor(rand() * verts.count), j = i * 3;
		const v = new THREE.Vector3().randomDirection().multiplyScalar(0.16 * Math.cbrt(rand()));
		out[j] = verts.getX(k) + v.x; out[j + 1] = verts.getY(k) + v.y; out[j + 2] = verts.getZ(k) + v.z;
	}
	return out;
}

function helloForm() {
	return sampleText('LET\'S\nBUILD', { count: COUNT, font: '700 260px "Space Grotesk", sans-serif', width: 1400, height: 640, scale: 0.0062, rand, lineHeight: 0.92 });
}

// ---------- GPU simulation ----------

const NOISE = /* glsl */`
vec4 permute(vec4 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
	const vec2 C = vec2(1.0/6.0, 1.0/3.0);
	const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
	vec3 i = floor(v + dot(v, C.yyy));
	vec3 x0 = v - i + dot(i, C.xxx);
	vec3 g = step(x0.yzx, x0.xyz);
	vec3 l = 1.0 - g;
	vec3 i1 = min(g.xyz, l.zxy);
	vec3 i2 = max(g.xyz, l.zxy);
	vec3 x1 = x0 - i1 + C.xxx;
	vec3 x2 = x0 - i2 + 2.0 * C.xxx;
	vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
	i = mod(i, 289.0);
	vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
	float n_ = 1.0/7.0;
	vec3 ns = n_ * D.wyz - D.xzx;
	vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
	vec4 x_ = floor(j * ns.z);
	vec4 y_ = floor(j - 7.0 * x_);
	vec4 x = x_ * ns.x + ns.yyyy;
	vec4 y = y_ * ns.x + ns.yyyy;
	vec4 h = 1.0 - abs(x) - abs(y);
	vec4 b0 = vec4(x.xy, y.xy);
	vec4 b1 = vec4(x.zw, y.zw);
	vec4 s0 = floor(b0) * 2.0 + 1.0;
	vec4 s1 = floor(b1) * 2.0 + 1.0;
	vec4 sh = -step(h, vec4(0.0));
	vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
	vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
	vec3 p0 = vec3(a0.xy, h.x);
	vec3 p1 = vec3(a0.zw, h.y);
	vec3 p2 = vec3(a1.xy, h.z);
	vec3 p3 = vec3(a1.zw, h.w);
	vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
	p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
	vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
	m = m * m;
	return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
vec3 curl(vec3 p){
	const float e = 0.1;
	vec3 dx = vec3(e, 0.0, 0.0), dy = vec3(0.0, e, 0.0), dz = vec3(0.0, 0.0, e);
	vec3 a = vec3(snoise(p), snoise(p + vec3(31.4, 0.0, 0.0)), snoise(p + vec3(0.0, 47.2, 0.0)));
	float x = (snoise(p + vec3(0.0, 47.2, 0.0) + dy) - snoise(p + vec3(0.0, 47.2, 0.0) - dy)) - (snoise(p + vec3(31.4, 0.0, 0.0) + dz) - snoise(p + vec3(31.4, 0.0, 0.0) - dz));
	float y = (snoise(p + dz) - snoise(p - dz)) - (snoise(p + vec3(0.0, 47.2, 0.0) + dx) - snoise(p + vec3(0.0, 47.2, 0.0) - dx));
	float z = (snoise(p + vec3(31.4, 0.0, 0.0) + dx) - snoise(p + vec3(31.4, 0.0, 0.0) - dx)) - (snoise(p + dy) - snoise(p - dy));
	return vec3(x, y, z) / (2.0 * e);
}`;

const gpu = new GPUComputationRenderer(SIZE, SIZE, renderer);
const pos0 = gpu.createTexture();
const vel0 = gpu.createTexture();
{
	const d = pos0.image.data;
	for (let i = 0; i < COUNT; i++) {
		const v = new THREE.Vector3().randomDirection().multiplyScalar(6 + rand() * 10);
		d[i * 4] = v.x; d[i * 4 + 1] = v.y; d[i * 4 + 2] = v.z; d[i * 4 + 3] = rand();
	}
}

const posVar = gpu.addVariable('texturePosition', /* glsl */`
	uniform float uDt;
	void main() {
		vec2 uv = gl_FragCoord.xy / resolution.xy;
		vec4 p = texture2D(texturePosition, uv);
		vec4 v = texture2D(textureVelocity, uv);
		p.xyz += v.xyz * uDt;
		gl_FragColor = p;
	}`, pos0);

const velVar = gpu.addVariable('textureVelocity', NOISE + /* glsl */`
	uniform sampler2D tTargetA, tTargetB;
	uniform float uMix, uFlow, uTime, uDt, uMouseForce, uPulseRadius, uPulseStrength;
	uniform vec3 uMouse, uPulseCenter;
	void main() {
		vec2 uv = gl_FragCoord.xy / resolution.xy;
		vec4 p = texture2D(texturePosition, uv);
		vec3 vel = texture2D(textureVelocity, uv).xyz;
		vec3 target = mix(texture2D(tTargetA, uv).xyz, texture2D(tTargetB, uv).xyz, uMix);
		float seed = p.w;
		vec3 acc = (target - p.xyz) * (7.0 + seed * 5.0);
		acc += curl(p.xyz * 0.32 + vec3(0.0, uTime * 0.08, seed * 0.5)) * uFlow;
		vec3 m = p.xyz - uMouse;
		float md2 = dot(m, m);
		acc += normalize(m + vec3(1e-4)) * uMouseForce * exp(-md2 * 0.9) * 55.0;
		float pd = length(p.xyz - uPulseCenter);
		float shell = exp(-pow((pd - uPulseRadius) * 3.0, 2.0)) * uPulseStrength;
		acc += normalize(p.xyz - uPulseCenter + vec3(1e-4)) * shell * 70.0;
		vel = vel * pow(0.86, uDt * 60.0) + acc * uDt;
		gl_FragColor = vec4(vel, shell);
	}`, vel0);

gpu.setVariableDependencies(posVar, [posVar, velVar]);
gpu.setVariableDependencies(velVar, [posVar, velVar]);

function targetTexture(xyz) {
	const data = new Float32Array(COUNT * 4);
	for (let i = 0; i < COUNT; i++) {
		data[i * 4] = xyz[i * 3]; data[i * 4 + 1] = xyz[i * 3 + 1]; data[i * 4 + 2] = xyz[i * 3 + 2]; data[i * 4 + 3] = 1;
	}
	const t = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType);
	t.needsUpdate = true;
	return t;
}

// The text form is drawn in the site's font, so wait for it
await document.fonts.load('700 260px "Space Grotesk"').catch(() => {});

const builders = [headsetForm, helixForm, gamepadForm, leafForm, echoForm, cartForm, skateForm, networkForm, helloForm];
const targets = builders.map(fn => targetTexture(fn()));

const vu = velVar.material.uniforms;
Object.assign(vu, {
	tTargetA: { value: targets[0] }, tTargetB: { value: targets[0] },
	uMix: { value: 0 }, uFlow: { value: 0.4 }, uTime: { value: 0 }, uDt: { value: 1 / 60 },
	uMouse: { value: new THREE.Vector3(0, 0, 100) }, uMouseForce: { value: 0 },
	uPulseCenter: { value: new THREE.Vector3() }, uPulseRadius: { value: 0 }, uPulseStrength: { value: 0 },
});
posVar.material.uniforms.uDt = { value: 1 / 60 };
const err = gpu.init();
if (err) console.error(err);

// With reduced motion there is no animation, so settle the first form before the one still frame
if (reduceMotion) for (let k = 0; k < 240; k++) gpu.compute();

// ---------- Render the particles ----------

const refs = new Float32Array(COUNT * 2), rnd = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
	refs[i * 2] = ((i % SIZE) + 0.5) / SIZE;
	refs[i * 2 + 1] = (Math.floor(i / SIZE) + 0.5) / SIZE;
	rnd[i] = rand();
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
geo.setAttribute('ref', new THREE.BufferAttribute(refs, 2));
geo.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));

const col = c => new THREE.Color(c);
const pu = {
	tPos: { value: null }, tVel: { value: null },
	uColA: { value: col(FORMS[0].cols[0]) }, uColA2: { value: col(FORMS[0].cols[1]) },
	uColB: { value: col(FORMS[0].cols[0]) }, uColB2: { value: col(FORMS[0].cols[1]) },
	uMix: { value: 0 }, uSize: { value: isSmall() ? 2.4 : 1.9 }, uPR: { value: renderer.getPixelRatio() },
};
const points = new THREE.Points(geo, new THREE.ShaderMaterial({
	uniforms: pu,
	transparent: true,
	depthWrite: false,
	blending: THREE.AdditiveBlending,
	vertexShader: /* glsl */`
		uniform sampler2D tPos, tVel;
		uniform vec3 uColA, uColA2, uColB, uColB2;
		uniform float uMix, uSize, uPR;
		attribute vec2 ref;
		attribute float rnd;
		varying vec3 vColor;
		void main() {
			vec4 p = texture2D(tPos, ref);
			vec4 v = texture2D(tVel, ref);
			vec4 mv = modelViewMatrix * vec4(p.xyz, 1.0);
			gl_Position = projectionMatrix * mv;
			float speed = length(v.xyz);
			vec3 base = mix(mix(uColA, uColA2, rnd), mix(uColB, uColB2, rnd), uMix);
			vColor = mix(base, vec3(1.0), clamp(speed * 0.05, 0.0, 0.65)) * 0.72 + vec3(0.5, 0.9, 1.0) * v.w * 0.9;
			gl_PointSize = uSize * uPR * (0.55 + rnd * 0.9) * (12.0 / -mv.z);
		}`,
	fragmentShader: /* glsl */`
		varying vec3 vColor;
		void main() {
			float d = length(gl_PointCoord - 0.5);
			if (d > 0.5) discard;
			float a = smoothstep(0.5, 0.05, d);
			gl_FragColor = vec4(vColor * a, a);
		}`,
}));
points.frustumCulled = false;
scene.add(points);

// ---------- Input: cursor wind and click ping ----------

const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hit = new THREE.Vector3();
const local = new THREE.Vector3();
let pulseT = 99;

addEventListener('click', e => {
	if (e.target.closest('a, button')) return;
	raycaster.setFromCamera({ x: pointer.x, y: pointer.y }, camera);
	if (raycaster.ray.intersectPlane(plane, hit)) {
		vu.uPulseCenter.value.copy(points.worldToLocal(hit.clone()));
		pulseT = 0;
	}
});

// ---------- Camera and loop ----------

const formEl = document.getElementById('form');
let shownForm = -1;

stage.start((dt, t) => {
	const n = FORMS.length - 1;
	const f = Math.min(Math.max(clock.chapter, 0), n);
	const i = Math.min(Math.floor(f), n - 1);
	const localT = f - i;
	const m = easeInOut(clamp01((localT - 0.12) / 0.76));

	vu.tTargetA.value = targets[i];
	vu.tTargetB.value = targets[i + 1];
	vu.uMix.value = f >= n ? 1 : m;
	vu.uFlow.value = 0.35 + Math.sin(Math.PI * m) * 6.5;
	vu.uTime.value = t;
	vu.uDt.value = Math.max(dt, 1 / 240);
	posVar.material.uniforms.uDt.value = Math.max(dt, 1 / 240);

	pu.uColA.value.set(FORMS[i].cols[0]); pu.uColA2.value.set(FORMS[i].cols[1]);
	pu.uColB.value.set(FORMS[i + 1].cols[0]); pu.uColB2.value.set(FORMS[i + 1].cols[1]);
	pu.uMix.value = vu.uMix.value;

	// The cloud sits opposite the chapter's text, sliding across as chapters change
	const side = k => (FORMS[k].side === 'left' ? 1 : -1);
	const shift = (side(i) + (side(i + 1) - side(i)) * m) * 0.24;
	if (isSmall()) camera.setViewOffset(size.w, size.h, 0, size.h * 0.2, size.w, size.h);
	else camera.setViewOffset(size.w, size.h, -size.w * shift, 0, size.w, size.h);
	camera.position.set(pointer.sx * 0.8, pointer.sy * 0.5, isSmall() ? 17 : 13.5);
	camera.lookAt(0, 0, 0);
	points.rotation.y = Math.sin(t * 0.25) * 0.35 + pointer.sx * 0.15;
	points.rotation.x = Math.sin(t * 0.18) * 0.08;

	// Cursor wind: only while the pointer is actually moving
	raycaster.setFromCamera({ x: pointer.x, y: pointer.y }, camera);
	if (raycaster.ray.intersectPlane(plane, hit)) vu.uMouse.value.copy(points.worldToLocal(local.copy(hit)));
	vu.uMouseForce.value = reduceMotion ? 0 : Math.min(pointer.moved, 1);

	pulseT += dt;
	vu.uPulseRadius.value = pulseT * 9;
	vu.uPulseStrength.value = Math.max(0, 1 - pulseT / 1.4);

	gpu.compute();
	pu.tPos.value = gpu.getCurrentRenderTarget(posVar).texture;
	pu.tVel.value = gpu.getCurrentRenderTarget(velVar).texture;

	const current = m > 0.5 ? i + 1 : i;
	if (current !== shownForm) { shownForm = current; formEl.textContent = FORMS[current].name; }
});
