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

// Scroll-reveal animation, staggered within each container
const observer = new IntersectionObserver(
	entries => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('visible');
				observer.unobserve(entry.target);
			}
		});
	},
	{ threshold: 0.12 }
);

const groupCounts = new Map();
document.querySelectorAll('.reveal').forEach(el => {
	const group = el.parentElement;
	const index = groupCounts.get(group) || 0;
	el.style.setProperty('--reveal-delay', `${Math.min(index * 90, 450)}ms`);
	groupCounts.set(group, index + 1);
	observer.observe(el);
});

// 3D tilt on cards — they rotate toward the cursor
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (!reduceMotion && canHover) {
	document.querySelectorAll('.card, .featured').forEach(el => {
		const maxTilt = el.classList.contains('featured') ? 3 : 8;
		let rafId = null;
		let lastEvent = null;

		el.addEventListener('mousemove', e => {
			lastEvent = e;
			if (rafId) return;
			rafId = requestAnimationFrame(() => {
				rafId = null;
				const rect = el.getBoundingClientRect();
				const px = (lastEvent.clientX - rect.left) / rect.width - 0.5;
				const py = (lastEvent.clientY - rect.top) / rect.height - 0.5;
				el.style.transition = 'transform 0.1s ease-out';
				el.style.transform =
					`perspective(900px) rotateX(${(-py * maxTilt).toFixed(2)}deg) rotateY(${(px * maxTilt).toFixed(2)}deg) translateY(-4px)`;
			});
		});

		el.addEventListener('mouseleave', () => {
			if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
			el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
			el.style.transform = '';
		});
	});
}
