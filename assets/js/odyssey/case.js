// Project pages: the same GPU particles as the homepage, in three acts. The page's own shape assembles beside
// the hero, melts into a dim drifting dust while you read, and re-forms as the next project's shape at the end.
// The simulation is the homepage's (odyssey.js), copied rather than shared so the homepage stays untouched.
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { createStage, seeded, isSmall, easeInOut, clamp01, reduceMotion } from './stage.js';
import { FORMS, DUST } from './forms.js';

const hero = document.querySelector('[data-chapter="hero"]');
const read = document.querySelector('[data-chapter="read"]');
const next = document.querySelector('[data-chapter="next"]');
const own = FORMS[document.body.dataset.form];
const after = FORMS[next.dataset.form];

// One act per chapter; `dim` is the brightness, `flow` the resting curl noise (the dust drifts, shapes hold still)
const ACTS = [
	{ form: own, dim: 1, flow: 0.35, side: 1 },
	{ form: DUST, dim: 0.45, flow: 1.6, side: 0 },
	{ form: after, dim: 1, flow: 0.35, side: 1 },
];

document.documentElement.classList.add('odyssey-on');

const stage = createStage({ chapters: [hero, read, next], fov: 35, bloom: { strength: 0.85, radius: 0.55, threshold: 0.15 }, exposure: 1 });
const { scene, camera, renderer, clock, pointer, size } = stage;
const rand = seeded(42);

// Fewer particles than the homepage: these pages carry long text and videos
const SIZE = isSmall() ? 128 : 192;
const COUNT = SIZE * SIZE;
document.getElementById('count').textContent = COUNT.toLocaleString('en-US');

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

function targetTexture(xyzw) {
	const t = new THREE.DataTexture(xyzw, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType);
	t.needsUpdate = true;
	return t;
}
const targets = ACTS.map(a => targetTexture(a.form.build(COUNT, rand)));

const vu = velVar.material.uniforms;
Object.assign(vu, {
	tTargetA: { value: targets[0] }, tTargetB: { value: targets[0] },
	uMix: { value: 0 }, uFlow: { value: 0.35 }, uTime: { value: 0 }, uDt: { value: 1 / 60 },
	uMouse: { value: new THREE.Vector3(0, 0, 100) }, uMouseForce: { value: 0 },
	uPulseCenter: { value: new THREE.Vector3() }, uPulseRadius: { value: 0 }, uPulseStrength: { value: 0 },
});
posVar.material.uniforms.uDt = { value: 1 / 60 };
const err = gpu.init();
if (err) console.error(err);

// With reduced motion there is no animation: settle the page's shape once and only dim it while reading
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
	tPos: { value: null }, tVel: { value: null }, tTargetA: vu.tTargetA, tTargetB: vu.tTargetB,
	uColA: { value: col(own.cols[0]) }, uColA2: { value: col(own.cols[1]) },
	uColB: { value: col(own.cols[0]) }, uColB2: { value: col(own.cols[1]) },
	uMix: { value: 0 }, uDim: { value: 1 }, uSize: { value: isSmall() ? 2.6 : 2.1 }, uPR: { value: renderer.getPixelRatio() },
};
const points = new THREE.Points(geo, new THREE.ShaderMaterial({
	uniforms: pu,
	transparent: true,
	depthWrite: false,
	blending: THREE.AdditiveBlending,
	vertexShader: /* glsl */`
		uniform sampler2D tPos, tVel, tTargetA, tTargetB;
		uniform vec3 uColA, uColA2, uColB, uColB2;
		uniform float uMix, uDim, uSize, uPR;
		attribute vec2 ref;
		attribute float rnd;
		varying vec3 vColor;
		void main() {
			vec4 p = texture2D(tPos, ref);
			vec4 v = texture2D(tVel, ref);
			vec4 mv = modelViewMatrix * vec4(p.xyz, 1.0);
			gl_Position = projectionMatrix * mv;
			float speed = length(v.xyz);
			// each shape's points carry their colour pick in w
			float wA = texture2D(tTargetA, ref).w, wB = texture2D(tTargetB, ref).w;
			vec3 base = mix(mix(uColA, uColA2, wA), mix(uColB, uColB2, wB), uMix);
			vColor = (mix(base, vec3(1.0), clamp(speed * 0.05, 0.0, 0.65)) * 0.72 + vec3(0.5, 0.9, 1.0) * v.w * 0.9) * uDim;
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
	if (e.target.closest('a, button, video')) return;
	raycaster.setFromCamera({ x: pointer.x, y: pointer.y }, camera);
	if (raycaster.ray.intersectPlane(plane, hit)) {
		vu.uPulseCenter.value.copy(points.worldToLocal(hit.clone()));
		pulseT = 0;
	}
});

// Nothing behind a playing video needs to move: stop the particles until it pauses
const videos = [...document.querySelectorAll('video')];
const syncVideos = () => { stage.paused = videos.some(v => !v.paused && !v.ended); };
videos.forEach(v => ['play', 'pause', 'ended'].forEach(ev => v.addEventListener(ev, syncVideos)));

// ---------- Camera and loop ----------

const formEl = document.getElementById('form');
const root = document.documentElement;
let shown = -1;

stage.start((dt, t) => {
	const n = ACTS.length - 1;
	const f = Math.min(Math.max(clock.chapter, 0), n);
	const i = Math.min(Math.floor(f), n - 1);
	const m = f >= n ? 1 : easeInOut(clamp01((f - i - 0.12) / 0.76));
	const A = ACTS[i], B = ACTS[i + 1];

	vu.tTargetA.value = targets[i];
	vu.tTargetB.value = targets[i + 1];
	vu.uMix.value = m;
	vu.uFlow.value = A.flow + (B.flow - A.flow) * m + Math.sin(Math.PI * m) * 6.5;
	vu.uTime.value = t;
	vu.uDt.value = Math.max(dt, 1 / 240);
	posVar.material.uniforms.uDt.value = Math.max(dt, 1 / 240);

	pu.uColA.value.set(A.form.cols[0]); pu.uColA2.value.set(A.form.cols[1]);
	pu.uColB.value.set(B.form.cols[0]); pu.uColB2.value.set(B.form.cols[1]);
	pu.uMix.value = m;
	pu.uDim.value = A.dim + (B.dim - A.dim) * m;

	// The shape sits opposite the text; the dust fills the whole view
	const shift = (A.side + (B.side - A.side) * m) * 0.24;
	if (isSmall()) camera.setViewOffset(size.w, size.h, 0, size.h * 0.2 * (A.side + (B.side - A.side) * m), size.w, size.h);
	else camera.setViewOffset(size.w, size.h, -size.w * shift, 0, size.w, size.h);
	// phones are narrow, so the camera stands further back to keep wide shapes in frame
	camera.position.set(pointer.sx * 0.8, pointer.sy * 0.5, isSmall() ? 23 : 13.5);
	camera.lookAt(0, 0, 0);
	points.rotation.y = Math.sin(t * 0.25) * 0.35 + pointer.sx * 0.15;
	points.rotation.x = Math.sin(t * 0.18) * 0.08;

	raycaster.setFromCamera({ x: pointer.x, y: pointer.y }, camera);
	if (raycaster.ray.intersectPlane(plane, hit)) vu.uMouse.value.copy(points.worldToLocal(local.copy(hit)));
	vu.uMouseForce.value = reduceMotion ? 0 : Math.min(pointer.moved, 1);

	pulseT += dt;
	vu.uPulseRadius.value = pulseT * 9;
	vu.uPulseStrength.value = Math.max(0, 1 - pulseT / 1.4);

	if (!reduceMotion) gpu.compute();
	pu.tPos.value = gpu.getCurrentRenderTarget(posVar).texture;
	pu.tVel.value = gpu.getCurrentRenderTarget(velVar).texture;

	const current = m > 0.5 ? i + 1 : i;
	if (current !== shown) {
		shown = current;
		formEl.textContent = ACTS[current].form.name;
		root.classList.toggle('case-reading', current === 1);
	}
});
