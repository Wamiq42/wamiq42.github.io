// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');

if (toggle && links) {
	toggle.addEventListener('click', () => {
		const open = links.classList.toggle('open');
		toggle.setAttribute('aria-expanded', open);
	});

	links.querySelectorAll('a').forEach(a =>
		a.addEventListener('click', () => {
			links.classList.remove('open');
			toggle.setAttribute('aria-expanded', 'false');
		})
	);
}

// Nav gains depth once the page is scrolled
const nav = document.querySelector('.nav');
if (nav) {
	const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();
}

// Glass panels behave like a game HUD: they swing in as their chapter arrives, tilt toward the cursor with a
// glare and an edge light following it, and give a little under a click
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const panels = document.querySelectorAll('.panel.glass');

if (panels.length && !reduceMotion) {
	document.documentElement.classList.add('panels-3d');
	// The hidden starting state applies at once; only changes after the first frames animate
	requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('panels-live')));

	const entrance = new IntersectionObserver(
		entries => entries.forEach(entry => {
			if (!entry.isIntersecting) return;
			entry.target.classList.add('in');
			entrance.unobserve(entry.target);
		}),
		{ rootMargin: '0px 0px -12% 0px' }
	);

	panels.forEach(panel => {
		entrance.observe(panel);

		let pressTimer = null;
		panel.addEventListener('click', e => {
			if (e.target.closest('a, button, video')) return;
			panel.classList.remove('pressed');
			void panel.offsetWidth; // restart the flash on rapid clicks
			panel.classList.add('pressed');
			clearTimeout(pressTimer);
			pressTimer = setTimeout(() => panel.classList.remove('pressed'), 650);
		});

		if (!canHover) return;
		let rafId = null;
		let lastEvent = null;

		panel.addEventListener('pointermove', e => {
			lastEvent = e;
			if (rafId) return;
			rafId = requestAnimationFrame(() => {
				rafId = null;
				const rect = panel.getBoundingClientRect();
				// Tall panels tilt less, so long text doesn't wobble while it's being read
				const maxTilt = 5.5 - 4 * Math.min(1, Math.max(0, (rect.height - 500) / 850));
				const px = (lastEvent.clientX - rect.left) / rect.width - 0.5;
				const py = (lastEvent.clientY - rect.top) / rect.height - 0.5;
				const s = panel.style;
				s.setProperty('--px', px.toFixed(3));
				s.setProperty('--py', py.toFixed(3));
				s.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
				s.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
				s.setProperty('--rx', `${(-py * maxTilt).toFixed(2)}deg`);
				s.setProperty('--ry', `${(px * maxTilt).toFixed(2)}deg`);
			});
		});

		panel.addEventListener('pointerenter', () => panel.classList.add('hovering'));
		panel.addEventListener('pointerleave', () => {
			if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
			panel.classList.remove('hovering');
			['--px', '--py', '--rx', '--ry'].forEach(p => panel.style.removeProperty(p));
		});
	});
}

// Project pages: a quest log of the page's sections on wide screens, lit for the one being read
const reading = document.querySelector('.reading');
if (reading) {
	const sections = [...reading.querySelectorAll('.panel[id]')];
	const log = document.createElement('nav');
	log.className = 'quest-log';
	log.setAttribute('aria-label', 'Sections on this page');
	const links = sections.map((section, i) => {
		const a = document.createElement('a');
		a.href = `#${section.id}`;
		const num = document.createElement('b');
		num.textContent = String(i + 1).padStart(2, '0');
		const label = document.createElement('span');
		label.textContent = section.querySelector('h2').textContent;
		a.append(num, label);
		log.appendChild(a);
		return a;
	});
	document.body.appendChild(log);

	const current = new IntersectionObserver(
		entries => entries.forEach(entry => {
			if (entry.isIntersecting) links.forEach(a => a.classList.toggle('active', a.hash === `#${entry.target.id}`));
		}),
		{ rootMargin: '-45% 0px -50% 0px' }
	);
	sections.forEach(section => current.observe(section));
	new IntersectionObserver(([entry]) => log.classList.toggle('show', entry.isIntersecting), { rootMargin: '-40% 0px -40% 0px' }).observe(reading);
}
