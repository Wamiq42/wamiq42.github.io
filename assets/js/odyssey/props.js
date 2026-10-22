// Low-poly game props built from primitives — no external models, so no licence questions.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C } from './stage.js';

export const std = (color, extra = {}) =>
	new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });
export const flat = (color, extra = {}) => std(color, { flatShading: true, roughness: 0.85, ...extra });

function shadowed(obj) {
	obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
	return obj;
}

export function makeGamepad() {
	const g = new THREE.Group();
	const shell = std(0xdfe5f2, { roughness: 0.45 });
	const dark = std(0x1d2436, { roughness: 0.55 });

	g.add(new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.42, 0.95, 4, 0.2), shell));
	for (const s of [-1, 1]) {
		const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.36, 6, 12), shell);
		grip.position.set(s * 0.6, -0.2, 0.36);
		grip.rotation.set(Math.PI / 2 + 0.75, 0, -s * 0.25);
		g.add(grip);
	}
	const dpadA = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.11), dark);
	const dpadB = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.34), dark);
	dpadA.position.set(-0.5, 0.23, -0.05);
	dpadB.position.copy(dpadA.position);
	g.add(dpadA, dpadB);

	const buttonColors = [C.accent2, C.accent, C.shipped, C.pink];
	[[0, -0.13], [0.13, 0], [0, 0.13], [-0.13, 0]].forEach(([dx, dz], i) => {
		const b = new THREE.Mesh(
			new THREE.CylinderGeometry(0.065, 0.065, 0.07, 16),
			std(buttonColors[i], { emissive: buttonColors[i], emissiveIntensity: 0.35, roughness: 0.3 })
		);
		b.position.set(0.5 + dx, 0.23, -0.05 + dz);
		g.add(b);
	});
	for (const s of [-1, 1]) {
		const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.14, 18), dark);
		stick.position.set(s * 0.24, 0.26, 0.2);
		g.add(stick);
	}
	const led = new THREE.Mesh(
		new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12),
		std(C.accent2, { emissive: C.accent2, emissiveIntensity: 1.5 })
	);
	led.position.set(0, 0.22, -0.28);
	g.add(led);
	return shadowed(g);
}

export function makeHeadset() {
	const g = new THREE.Group();
	const shell = std(0xf1f3f8, { roughness: 0.4 });
	const dark = std(0x1b2133, { roughness: 0.5 });

	g.add(new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.82, 0.62, 5, 0.26), shell));
	const cushion = new THREE.Mesh(new RoundedBoxGeometry(1.32, 0.66, 0.16, 3, 0.06), dark);
	cushion.position.z = -0.34;
	g.add(cushion);

	// Three sensor pills on the front, Quest-style
	[-0.42, 0, 0.42].forEach(x => {
		const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, x === 0 ? 0.06 : 0.16, 4, 10), dark);
		p.rotation.z = Math.PI / 2;
		p.position.set(x, -0.05, 0.31);
		g.add(p);
	});

	const strap = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 8, 40, Math.PI * 1.15), std(0x2b3550));
	strap.rotation.set(Math.PI / 2, 0, Math.PI + -0.075 * Math.PI);
	strap.position.z = -0.45;
	g.add(strap);
	return shadowed(g);
}

export function makeCrate(size = 0.7) {
	const g = new THREE.Group();
	const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), flat(0xc28a4e));
	const edges = new THREE.LineSegments(
		new THREE.EdgesGeometry(box.geometry),
		new THREE.LineBasicMaterial({ color: 0x6e4826 })
	);
	edges.scale.setScalar(1.002);
	// A diagonal plank on each side face, so it reads as a crate at small sizes
	const plank = flat(0xa8713b);
	for (const axis of ['x', 'z']) {
		for (const s of [-1, 1]) {
			const p = new THREE.Mesh(new THREE.BoxGeometry(size * 0.16, size * 1.25, size * 0.04), plank);
			if (axis === 'x') { p.position.x = s * (size / 2 + 0.005); p.rotation.y = Math.PI / 2; }
			else p.position.z = s * (size / 2 + 0.005);
			p.rotation.z = Math.PI / 4;
			g.add(p);
		}
	}
	g.add(box, edges);
	return shadowed(g);
}

export function makeCoin(r = 0.28) {
	const m = std(C.gold, { metalness: 0.25, roughness: 0.32, emissive: 0x8a5a00, emissiveIntensity: 0.45 });
	const g = new THREE.Group();
	const coin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.22, 28), m);
	const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.72, r * 0.06, 6, 28), m);
	rim.rotation.x = Math.PI / 2;
	rim.position.y = r * 0.11;
	g.add(coin, rim);
	return shadowed(g);
}

export function makeTree(rand, scale = 1) {
	const g = new THREE.Group();
	const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.7, 6), flat(0x6b4a33));
	trunk.position.y = 0.35;
	const shade = rand() > 0.5 ? 0x29b886 : 0x22a07a;
	const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 0), flat(shade));
	a.position.y = 1.12;
	a.rotation.set(rand() * 3, rand() * 3, 0);
	const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 0), flat(0x34cf98));
	b.position.set(0.12, 1.66, -0.05);
	g.add(trunk, a, b);
	g.scale.setScalar(scale);
	return shadowed(g);
}
