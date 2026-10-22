// Particle shapes for the project pages. Each page has a signature shape; the reading sections use a dim dust field.
// A builder fills n points as xyzw: w picks between the shape's two colours (0 → first, 1 → second), so parts of
// a shape can carry their own colour, like a baseball's red seams.
import { C } from './stage.js';

// ---------- Helpers ----------

function put(out, i, x, y, z, w) {
	const j = i * 4;
	out[j] = x; out[j + 1] = y; out[j + 2] = z; out[j + 3] = w;
}

// Split n points between parts by weight, returning each part's [start, end)
function share(n, weights) {
	const total = weights.reduce((s, w) => s + w, 0);
	const ranges = [];
	let at = 0;
	weights.forEach((w, k) => {
		const end = k === weights.length - 1 ? n : at + Math.round((n * w) / total);
		ranges.push([at, end]);
		at = end;
	});
	return ranges;
}

function unit(rand) {
	const z = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z);
	return [Math.cos(a) * r, Math.sin(a) * r, z];
}

// Points along line segments, a little jittered so lines read as glowing strands
function segments(out, [from, to], segs, rand, w, jitter = 0.025) {
	const lens = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
	const total = lens.reduce((s, l) => s + l, 0);
	for (let i = from; i < to; i++) {
		let r = rand() * total, k = 0;
		while (r > lens[k] && k < lens.length - 1) r -= lens[k++];
		const [a, b] = segs[k], t = r / lens[k];
		put(out, i,
			a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * jitter,
			a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * jitter,
			a[2] + (b[2] - a[2]) * t + (rand() - 0.5) * jitter,
			typeof w === 'function' ? w() : w);
	}
}

// A circle as segments; `axis` is the circle's normal
function circle(cx, cy, cz, r, axis = 'y', steps = 48) {
	const segs = [];
	const p = a => axis === 'y' ? [cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]
		: axis === 'z' ? [cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]
		: [cx, cy + Math.cos(a) * r, cz + Math.sin(a) * r];
	for (let i = 0; i < steps; i++) segs.push([p((i / steps) * Math.PI * 2), p(((i + 1) / steps) * Math.PI * 2)]);
	return segs;
}

// A surface of revolution around the segment a → b; radius(u) gives the profile along it (u in 0..1)
function revolve(out, [from, to], a, b, radius, rand, w) {
	const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
	const len = Math.hypot(...ax);
	const d = ax.map(v => v / len);
	// two unit vectors perpendicular to the axis
	const helper = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
	let p = [d[1] * helper[2] - d[2] * helper[1], d[2] * helper[0] - d[0] * helper[2], d[0] * helper[1] - d[1] * helper[0]];
	const pl = Math.hypot(...p);
	p = p.map(v => v / pl);
	const q = [d[1] * p[2] - d[2] * p[1], d[2] * p[0] - d[0] * p[2], d[0] * p[1] - d[1] * p[0]];
	let rMax = 0;
	for (let k = 0; k <= 64; k++) rMax = Math.max(rMax, radius(k / 64));
	for (let i = from; i < to; i++) {
		// wider parts of the profile have more surface, so they get more points
		let u, r;
		do { u = rand(); r = radius(u); } while (rand() * rMax > r);
		const t = rand() * Math.PI * 2, c = Math.cos(t) * r, s = Math.sin(t) * r;
		put(out, i,
			a[0] + ax[0] * u + p[0] * c + q[0] * s,
			a[1] + ax[1] * u + p[1] * c + q[1] * s,
			a[2] + ax[2] * u + p[2] * c + q[2] * s, w);
	}
}

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Points filling a flat region (inside(x, y) → bool) with a little depth
function fill(out, [from, to], inside, [x0, x1, y0, y1], rand, w, depth = 0.12) {
	for (let i = from; i < to; i++) {
		let x, y;
		do { x = x0 + rand() * (x1 - x0); y = y0 + rand() * (y1 - y0); } while (!inside(x, y));
		put(out, i, x, y, (rand() - 0.5) * depth, typeof w === 'function' ? w(x, y) : w);
	}
}

// Points on the surface of a box centred at the origin
function box(out, [from, to], size, rand, w) {
	const area = [size[1] * size[2], size[0] * size[2], size[0] * size[1]];
	const total = area[0] + area[1] + area[2];
	for (let i = from; i < to; i++) {
		let r = rand() * total, k = 0;
		while (r > area[k] && k < 2) r -= area[k++];
		const p = size.map(s => (rand() - 0.5) * s);
		p[k] = (rand() < 0.5 ? -0.5 : 0.5) * size[k];
		put(out, i, p[0], p[1], p[2], w);
	}
}

// Turn a range of points about x, then y, then z (radians), then move them
function turn(out, [from, to], ax, ay, az, [tx, ty, tz] = [0, 0, 0]) {
	const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
	for (let i = from; i < to; i++) {
		const j = i * 4;
		let x = out[j], y = out[j + 1], z = out[j + 2];
		[y, z] = [y * cx - z * sx, y * sx + z * cx];
		[x, z] = [x * cy + z * sy, -x * sy + z * cy];
		[x, y] = [x * cz - y * sz, x * sz + y * cz];
		out[j] = x + tx; out[j + 1] = y + ty; out[j + 2] = z + tz;
	}
}

// A rounded rectangle's outline as segments, at depth z
function roundRect(hw, hh, r, z, steps = 8) {
	const pts = [];
	const corners = [[hw - r, hh - r, 0], [-hw + r, hh - r, Math.PI / 2], [-hw + r, -hh + r, Math.PI], [hw - r, -hh + r, Math.PI * 1.5]];
	for (const [cx, cy, a0] of corners) {
		for (let k = 0; k <= steps; k++) {
			const a = a0 + (k / steps) * (Math.PI / 2);
			pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
		}
	}
	return pts.map((p, k) => [p, pts[(k + 1) % pts.length]]);
}

// Inside an ellipse centred at (cx, cy), turned by a
function inEllipse(x, y, cx, cy, rx, ry, a = 0) {
	const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy;
	const u = dx * c + dy * s, v = -dx * s + dy * c;
	return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
}

// ---------- Shapes ----------

// A baseball with its curved seam and V-shaped stitches, a bat crossing behind it
function baseball(n, rand) {
	const out = new Float32Array(n * 4);
	const [ball, seam, stitches, bat, spark] = share(n, [24, 13, 25, 28, 10]);
	const R = 1.85, O = [0.25, 0.15, 0.4];
	// Seam: the classic two-lobed curve that lies exactly on a sphere (a + b = 1, c = 2√ab)
	const A = 0.7, B = 0.3, Cc = 2 * Math.sqrt(A * B);
	const seamAt = t => [A * Math.cos(t) + B * Math.cos(3 * t), A * Math.sin(t) - B * Math.sin(3 * t), Cc * Math.sin(2 * t)];
	const tilt = (v) => {
		// turn the seam so both lobes show from the front
		const a = 0.9, b = 0.5;
		let [x, y, z] = v;
		[y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
		[x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
		return [O[0] + x * R, O[1] + y * R, O[2] + z * R];
	};

	for (let i = ball[0]; i < ball[1]; i++) {
		const [x, y, z] = unit(rand);
		put(out, i, O[0] + x * R, O[1] + y * R, O[2] + z * R, 0);
	}
	for (let i = seam[0]; i < seam[1]; i++) {
		const v = seamAt(rand() * Math.PI * 2);
		const [x, y, z] = tilt(v.map(c => c * 1.012));
		put(out, i, x, y, z, 1);
	}
	// Stitches: short V-shaped ticks either side of the seam
	const STITCHES = 108;
	for (let i = stitches[0]; i < stitches[1]; i++) {
		const k = Math.floor(rand() * STITCHES), t = (k / STITCHES) * Math.PI * 2;
		const c = seamAt(t), c2 = seamAt(t + 0.001);
		const tan = c2.map((v, m) => v - c[m]);
		const tl = Math.hypot(...tan);
		const tn = tan.map(v => v / tl);
		const side = [c[1] * tn[2] - c[2] * tn[1], c[2] * tn[0] - c[0] * tn[2], c[0] * tn[1] - c[1] * tn[0]];
		const s = (rand() < 0.5 ? -1 : 1), along = rand();
		const v = c.map((cv, m) => (cv + side[m] * s * (0.03 + along * 0.075) + tn[m] * along * 0.035) * 1.015);
		const [x, y, z] = tilt(v);
		put(out, i, x, y, z, 1);
	}
	// Bat: knob, thin handle, taper, barrel, rounded end
	const batR = u => u < 0.025 ? 0.17 : u < 0.42 ? 0.095 : u < 0.97 ? 0.095 + smooth(0.42, 0.78, u) * 0.19 : 0.285 * Math.sqrt(Math.max(0, 1 - ((u - 0.97) / 0.03) ** 2)) + 0.02;
	revolve(out, bat, [-3.0, -2.75, -1.6], [2.9, 2.85, -1.8], batR, rand, 0.3);
	for (let i = spark[0]; i < spark[1]; i++) {
		const [x, y, z] = unit(rand), r = 2.2 + rand() * 1.8;
		put(out, i, O[0] + x * r, O[1] + y * r, O[2] + z * r * 0.6, rand() * 0.3);
	}
	return out;
}

// A two-wheel bowling machine on a tripod, its ball arcing down the pitch into three stumps
function bowlingMachine(n, rand) {
	const out = new Float32Array(n * 4);
	const [wheels, frame, ball, path, stumps] = share(n, [34, 22, 6, 18, 20]);
	const X = -2.5, top = [X, 0.78, 0], low = [X, -0.62, 0], WR = 0.62;
	const wheelSegs = [];
	for (const c of [top, low]) {
		wheelSegs.push(...circle(c[0], c[1], c[2] + 0.12, WR, 'z', 40), ...circle(c[0], c[1], c[2] - 0.12, WR, 'z', 40));
		wheelSegs.push(...circle(c[0], c[1], c[2], WR * 0.32, 'z', 20));
		for (let k = 0; k < 6; k++) {
			const a = (k / 6) * Math.PI * 2;
			wheelSegs.push([[c[0] + Math.cos(a) * WR * 0.32, c[1] + Math.sin(a) * WR * 0.32, c[2]], [c[0] + Math.cos(a) * WR * 0.95, c[1] + Math.sin(a) * WR * 0.95, c[2]]]);
		}
		for (let k = 0; k < 24; k++) {
			// tread lines across the tyre
			const a = (k / 24) * Math.PI * 2, x = c[0] + Math.cos(a) * WR, y = c[1] + Math.sin(a) * WR;
			wheelSegs.push([[x, y, c[2] - 0.12], [x, y, c[2] + 0.12]]);
		}
	}
	segments(out, wheels, wheelSegs, rand, 0, 0.03);

	// Housing, hopper and tripod
	const hx0 = X - 0.85, hx1 = X + 0.85, hy0 = -1.4, hy1 = 1.55, hz = 0.38;
	const frameSegs = [];
	for (const z of [-hz, hz]) frameSegs.push([[hx0, hy0, z], [hx1, hy0, z]], [[hx1, hy0, z], [hx1, hy1, z]], [[hx1, hy1, z], [hx0, hy1, z]], [[hx0, hy1, z], [hx0, hy0, z]]);
	for (const [x, y] of [[hx0, hy0], [hx1, hy0], [hx1, hy1], [hx0, hy1]]) frameSegs.push([[x, y, -hz], [x, y, hz]]);
	frameSegs.push(...circle(X - 0.35, 2.15, 0, 0.42, 'y', 28), ...circle(X - 0.25, 1.6, 0, 0.18, 'y', 16));
	for (let k = 0; k < 6; k++) {
		const a = (k / 6) * Math.PI * 2;
		frameSegs.push([[X - 0.35 + Math.cos(a) * 0.42, 2.15, Math.sin(a) * 0.42], [X - 0.25 + Math.cos(a) * 0.18, 1.6, Math.sin(a) * 0.18]]);
	}
	frameSegs.push([[X, hy0, 0], [X - 0.9, -2.6, 0.7]], [[X, hy0, 0], [X + 0.9, -2.6, 0.7]], [[X, hy0, 0], [X, -2.6, -0.9]]);
	segments(out, frame, frameSegs, rand, 0.15, 0.03);

	// The ball, just released between the wheels
	const bx = X + 1.25, by = 0.08;
	for (let i = ball[0]; i < ball[1]; i++) {
		const [x, y, z] = unit(rand), r = 0.2 * Math.cbrt(0.6 + rand() * 0.4);
		put(out, i, bx + x * r, by + y * r, z * r, 1);
	}
	// Dotted flight path: out of the machine, a bounce, then up into the stumps
	const S = 2.9, ground = -2.45;
	const flight = t => {
		if (t < 0.62) { const u = t / 0.62; return [bx + (1.75 - bx) * u, by + (ground - by) * u * u, 0]; }
		const u = (t - 0.62) / 0.38;
		return [1.75 + (S - 0.15 - 1.75) * u, ground + 2.4 * u - 1.0 * u * u, 0];
	};
	const DOTS = 15;
	for (let i = path[0]; i < path[1]; i++) {
		const k = Math.floor(rand() * DOTS), [x, y, z] = flight((k + 0.5) / DOTS), [ux, uy, uz] = unit(rand);
		const r = 0.07 * Math.cbrt(rand());
		put(out, i, x + ux * r, y + uy * r, z + uz * r, 1);
	}
	// Stumps and bails, plus a crease line
	const stumpSegs = [];
	for (const z of [-0.26, 0, 0.26]) for (const dx of [-0.04, 0, 0.04]) stumpSegs.push([[S + dx, ground, z], [S + dx, -0.55, z]]);
	stumpSegs.push([[S, -0.5, -0.28], [S, -0.5, -0.01]], [[S, -0.5, 0.01], [S, -0.5, 0.28]]);
	stumpSegs.push([[S - 0.75, ground, -0.9], [S - 0.75, ground, 0.9]]);
	segments(out, stumps, stumpSegs, rand, 1, 0.035);
	// Keep the machine clear of the text panel: the whole scene sits right of centre
	for (let i = 0; i < n; i++) { out[i * 4] = out[i * 4] * 0.8 + 0.4; out[i * 4 + 1] *= 0.8; out[i * 4 + 2] *= 0.8; }
	return out;
}

// Jungle Premier League: a big animal paw print, with jungle leaves and fireflies around it
function pawPrint(n, rand) {
	const out = new Float32Array(n * 4);
	const [pads, rims, leaves, flies] = share(n, [50, 22, 14, 14]);
	const TOES = [[-1.55, 0.6, 0.48, 0.66, 0.45], [-0.55, 1.42, 0.5, 0.7, 0.12], [0.55, 1.42, 0.5, 0.7, -0.12], [1.55, 0.6, 0.48, 0.66, -0.45]];
	const PAD = [[0, -0.72, 1.3, 0.95], [-0.62, -1.3, 0.62, 0.55], [0.62, -1.3, 0.62, 0.55]];
	const inPad = (x, y) => PAD.some(([cx, cy, rx, ry]) => inEllipse(x, y, cx, cy, rx, ry));
	const inToe = (x, y) => TOES.some(([cx, cy, rx, ry, a]) => inEllipse(x, y, cx, cy, rx, ry, a));
	fill(out, pads, (x, y) => inPad(x, y) || inToe(x, y), [-2.2, 2.2, -2.0, 2.2], rand, 0, 0.2);

	// Rims trace each pad's edge so the print reads crisply
	for (let i = rims[0]; i < rims[1]; i++) {
		const t = rand() * Math.PI * 2;
		let x, y;
		if (rand() < 0.55) {
			const [cx, cy, rx, ry, a] = TOES[Math.floor(rand() * 4)];
			const u = Math.cos(t) * rx, v = Math.sin(t) * ry;
			x = cx + u * Math.cos(a) - v * Math.sin(a); y = cy + u * Math.sin(a) + v * Math.cos(a);
		} else {
			// the big pad is three overlapping ellipses: keep only the outer edge
			let k;
			do {
				k = Math.floor(rand() * 3);
				const [cx, cy, rx, ry] = PAD[k], s = rand() * Math.PI * 2;
				x = cx + Math.cos(s) * rx; y = cy + Math.sin(s) * ry;
			} while (PAD.some(([cx, cy, rx, ry], m) => m !== k && inEllipse(x, y, cx, cy, rx * 0.97, ry * 0.97)));
		}
		put(out, i, x, y, (rand() - 0.5) * 0.12, 0.3);
	}
	// Two jungle leaves behind the print
	const half = Math.floor((leaves[0] + leaves[1]) / 2);
	for (const [[from, to], s, rot, ox, oy] of [[[leaves[0], half], 0.9, 0.7, -2.5, 1.6], [[half, leaves[1]], 0.75, -2.3, 2.5, -1.4]]) {
		for (let i = from; i < to; i++) {
			let x, y;
			do { x = rand() * 2 - 1; y = rand() * 2.6; } while (Math.abs(x) > Math.pow(Math.sin((Math.PI * y) / 2.6), 0.85) * 0.9);
			if (rand() < 0.15) x *= 0.04;
			const c = Math.cos(rot), sn = Math.sin(rot);
			put(out, i, (x * c - (y - 1.3) * sn) * s + ox, (x * sn + (y - 1.3) * c) * s + oy, -0.8 + 0.25 * x * x * s, 0.15);
		}
	}
	// Fireflies
	for (let i = flies[0]; i < flies[1]; i++) {
		const a = rand() * Math.PI * 2, r = 2.6 + rand() * 1.6;
		put(out, i, Math.cos(a) * r, Math.sin(a) * r * 0.8, (rand() - 0.5) * 2.5, 1);
	}
	for (let i = 0; i < n * 4; i++) if (i % 4 !== 3) out[i] *= 0.86;
	turn(out, [0, n], -0.3, 0.3, -0.15, [0.35, 0, 0]);
	return out;
}

// Cricket X: three stumps and bails, a bat leaning on them and a ball at their feet
function stumpsAndBat(n, rand) {
	const out = new Float32Array(n * 4);
	const [stumps, bails, blade, handle, ball, seam] = share(n, [28, 5, 33, 8, 19, 7]);
	const G = -2.3, T = 0.95;
	const third = Math.round((stumps[1] - stumps[0]) / 3);
	[-0.45, 0, 0.45].forEach((x, k) => {
		const range = [stumps[0] + k * third, k === 2 ? stumps[1] : stumps[0] + (k + 1) * third];
		revolve(out, range, [x, G, 0], [x, T, 0], u => (u > 0.97 ? 0.05 : 0.085), rand, 0);
	});
	const mid = Math.round((bails[0] + bails[1]) / 2);
	revolve(out, [bails[0], mid], [-0.5, T + 0.05, 0], [-0.03, T + 0.05, 0], () => 0.05, rand, 0.2);
	revolve(out, [mid, bails[1]], [0.03, T + 0.05, 0], [0.5, T + 0.05, 0], () => 0.05, rand, 0.2);
	// The bat: a flat blade and a round handle, leaning across the stumps
	box(out, blade, [0.62, 2.7, 0.2], rand, 0.12);
	revolve(out, handle, [0, 1.35, 0], [0, 2.45, 0], () => 0.075, rand, 0.12);
	turn(out, [blade[0], handle[1]], 0.15, -0.5, -0.42, [1.25, -0.75, 0.7]);
	// The ball and its seam
	const B = [-1.55, -1.95, 0.7], R = 0.34;
	for (let i = ball[0]; i < ball[1]; i++) {
		const [x, y, z] = unit(rand);
		put(out, i, B[0] + x * R, B[1] + y * R, B[2] + z * R, 1);
	}
	for (let i = seam[0]; i < seam[1]; i++) {
		const a = rand() * Math.PI * 2, off = (rand() < 0.5 ? -1 : 1) * 0.04;
		put(out, i, B[0] + Math.cos(a) * R * 1.03, B[1] + Math.sin(a) * R * 1.03, B[2] + off, 0.35);
	}
	turn(out, [0, n], 0.08, -0.3, 0);
	return out;
}

// Breath of Estova: a pixel-art sword, one voxel per pixel, for the 2D RPG
function pixelSword(n, rand) {
	const out = new Float32Array(n * 4);
	const cells = [];
	for (let i = 5; i <= 14; i++) cells.push([i, i, 0], [i + 1, i, 0.12], [i, i + 1, 0.12]);
	cells.push([15, 15, 0]);
	for (let d = -3; d <= 3; d++) cells.push([4 + d, 4 - d, 1]); // crossguard
	cells.push([3, 3, 0.55], [2, 2, 0.55]); // grip
	cells.push([0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]); // pommel
	const S = 0.34, V = S * 0.9; // voxels a touch smaller than the grid, so the pixels show
	for (let i = 0; i < n; i++) {
		const [cx, cy, w] = cells[Math.floor(rand() * cells.length)];
		const k = Math.floor(rand() * 3), p = [(rand() - 0.5) * V, (rand() - 0.5) * V, (rand() - 0.5) * V];
		p[k] = (rand() < 0.5 ? -0.5 : 0.5) * V;
		put(out, i, (cx - 7.5) * S + p[0], (cy - 7.5) * S + p[1], p[2], w);
	}
	for (let i = 0; i < n * 4; i++) if (i % 4 !== 3) out[i] *= 0.8;
	turn(out, [0, n], 0.2, -0.45, 0, [0.55, -0.15, 0]);
	return out;
}

// Mobile games: a phone with a grid of app icons
function phone(n, rand) {
	const out = new Float32Array(n * 4);
	const [frame, screen, icons, bar] = share(n, [30, 10, 54, 6]);
	const W = 1.35, H = 2.7;
	const frameSegs = [...roundRect(W, H, 0.38, 0.14), ...roundRect(W, H, 0.38, -0.14)];
	for (const [x, y] of [[W, 0], [-W, 0], [0, H], [0, -H], [W * 0.8, H * 0.96], [-W * 0.8, -H * 0.96]]) frameSegs.push([[x, y, -0.14], [x, y, 0.14]]);
	segments(out, frame, frameSegs, rand, 0, 0.025);
	segments(out, screen, [...roundRect(W - 0.16, H - 0.16, 0.26, 0.15), [[-0.35, H - 0.34, 0.15], [0.35, H - 0.34, 0.15]]], rand, 0.2, 0.02);
	// App icons: four rows of three, plus a dock; colours vary from icon to icon
	const slots = [];
	for (const y of [1.6, 0.8, 0, -0.8]) for (const x of [-0.72, 0, 0.72]) slots.push([x, y]);
	for (const x of [-0.72, 0, 0.72]) slots.push([x, -2.0]);
	for (let i = icons[0]; i < icons[1]; i++) {
		const k = Math.floor(rand() * slots.length), [cx, cy] = slots[k], s = 0.26, r = 0.1;
		let x, y;
		// a rounded square: only the corners beyond radius r are cut away
		do { x = (rand() * 2 - 1) * s; y = (rand() * 2 - 1) * s; }
		while (Math.abs(x) > s - r && Math.abs(y) > s - r && Math.hypot(Math.abs(x) - (s - r), Math.abs(y) - (s - r)) > r);
		put(out, i, cx + x, cy + y, 0.17 + (rand() - 0.5) * 0.05, (k % 3) / 2);
	}
	segments(out, bar, [[[-0.45, -H + 0.32, 0.15], [0.45, -H + 0.32, 0.15]]], rand, 0, 0.03);
	turn(out, [0, n], 0.12, -0.4, 0.08);
	return out;
}

// The homepage's leaf, sonar room and skateboard (odyssey.js), as builders for their own pages;
// colours are picked at random per point, as on the homepage
function leaf(n, rand) {
	const out = new Float32Array(n * 4);
	const one = (i, s, rot, ox, oy, oz) => {
		let x, y;
		do { x = rand() * 2 - 1; y = rand() * 2.6; } while (Math.abs(x) > Math.pow(Math.sin((Math.PI * y) / 2.6), 0.85) * 1.05);
		if (rand() < 0.18) x *= 0.04; // midrib
		const z = 0.32 * x * x - 0.1 * y;
		const c = Math.cos(rot), sn = Math.sin(rot);
		const px = x * c - (y - 1.3) * sn, py = x * sn + (y - 1.3) * c;
		put(out, i, px * s + ox, py * s + oy, z * s + oz, rand());
	};
	for (let i = 0; i < n; i++) {
		const r = rand();
		if (r < 0.62) one(i, 1.55, -0.5, 0, 0.1, 0);
		else if (r < 0.74) one(i, 0.55, 0.9, 2.1, 1.4, -0.6);
		else if (r < 0.84) one(i, 0.42, 2.4, -2.2, -1.3, 0.4);
		else {
			const a = rand() * Math.PI * 2, rr = 2.4 + rand() * 1.6;
			put(out, i, Math.cos(a) * rr, (rand() - 0.5) * 4.5, Math.sin(a) * rr * 0.5, rand());
		}
	}
	return out;
}

function sonarRoom(n, rand) {
	const out = new Float32Array(n * 4);
	const w = 2.4, h = 1.7, d = 2.4;
	const P = (x, y, z) => [x * w, y * h, z * d];
	const edges = [];
	for (const y of [-1, 1]) edges.push([P(-1, y, -1), P(1, y, -1)], [P(1, y, -1), P(1, y, 1)], [P(1, y, 1), P(-1, y, 1)], [P(-1, y, 1), P(-1, y, -1)]);
	for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) edges.push([P(x, -1, z), P(x, 1, z)]);
	const n1 = Math.floor(n * 0.32), n2 = Math.floor(n * 0.38);
	segments(out, [0, n1], edges, rand, rand, 0.03);
	const rings = [...circle(0, -h + 0.02, 0, 0.8), ...circle(0, -h + 0.02, 0, 1.5), ...circle(0, -h + 0.02, 0, 2.2)];
	segments(out, [n1, n1 + n2], rings, rand, rand, 0.04);
	for (let i = n1 + n2; i < n; i++) {
		if (rand() < 0.5) {
			const [x, y, z] = unit(rand), r = 0.28 * Math.cbrt(rand());
			put(out, i, x * r, y * r - 0.6, z * r, rand());
		} else {
			put(out, i, (rand() - 0.5) * 2 * w, (rand() - 0.5) * 2 * h, (rand() - 0.5) * 2 * d, rand());
		}
	}
	return out;
}

function skateboard(n, rand) {
	const out = new Float32Array(n * 4);
	const n1 = Math.floor(n * 0.74);
	for (let i = 0; i < n1; i++) {
		let x, z;
		do { x = rand() * 4.4 - 2.2; z = rand() * 1.2 - 0.6; }
		while (Math.abs(x) > 1.65 && Math.hypot(Math.abs(x) - 1.65, z) > 0.6);
		const ax = Math.abs(x), y = ax > 1.4 ? Math.pow(ax - 1.4, 2) * 0.55 : 0;
		put(out, i, x, y + (rand() - 0.5) * 0.04, z, rand());
	}
	const segs = [];
	for (const x of [-1.25, 1.25]) {
		segs.push([[x, -0.05, -0.5], [x, -0.05, 0.5]], [[x, -0.05, 0], [x, -0.32, 0]], [[x - 0.12, -0.32, -0.5], [x + 0.12, -0.32, 0.5]]);
		for (const z of [-0.5, 0.5]) segs.push(...circle(x, -0.45, z, 0.17, 'z', 18), ...circle(x, -0.45, z, 0.09, 'z', 12));
	}
	segments(out, [n1, n], segs, rand, rand, 0.04);
	// tilt the board toward the camera
	for (let i = 0; i < n; i++) {
		const j = i * 4, y = out[j + 1], z = out[j + 2], a = 0.6;
		out[j + 1] = (y * Math.cos(a) - z * Math.sin(a)) * 1.2;
		out[j + 2] = (y * Math.sin(a) + z * Math.cos(a)) * 1.2;
		out[j] *= 1.2;
	}
	return out;
}

// Reading: a wide, thin slab of slowly drifting dust behind the text
function dust(n, rand) {
	const out = new Float32Array(n * 4);
	for (let i = 0; i < n; i++) put(out, i, (rand() - 0.5) * 22, (rand() - 0.5) * 13, -6 + rand() * 7, rand());
	return out;
}

// Keyed by project page; `cols` are the two colours w picks between
export const FORMS = {
	'baseball-x': { name: 'Baseball', cols: [0x93a9dc, 0xff2a40], build: baseball },
	'cricket-reborn': { name: 'Bowling machine', cols: [C.accent2, C.gold], build: bowlingMachine },
	'jungle-premier-league': { name: 'Paw print', cols: [C.shipped, C.gold], build: pawPrint },
	'cricket-x': { name: 'Stumps & bat', cols: [C.accent2, 0xff4d6d], build: stumpsAndBat },
	'breath-of-estova': { name: 'Pixel sword', cols: [0xcfe3ff, C.gold], build: pixelSword },
	'mobile-games': { name: 'Phone', cols: [C.accent2, C.pink], build: phone },
	'leaf-sweeper-vr': { name: 'Leaf', cols: [0xff7a2f, 0xffd166], build: leaf },
	'echo-room-vr': { name: 'Sonar room', cols: [0x2dd4ff, 0x2a5cff], build: sonarRoom },
	'skateboard': { name: 'Skateboard', cols: [C.pink, 0xffb36b], build: skateboard },
};
export const DUST = { name: 'Reading', cols: [C.accent, C.accent2], build: dust };
