let sections = [];
let currentSection = null;
let currentIndex = null;

async function init() {
  const res = await fetch('content.json');
  const data = await res.json();
  sections = data.sections;
  renderSections();
  setupFadeIn();
  setupScrollSpy();
  setupLightbox();
  setupVideoModal();
}

// Simple deterministic PRNG so spacer placement and alignment are consistent across loads
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function createSeededRandom(seed) {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function renderSections() {
  const main = document.getElementById('sections');
  sections.forEach(section => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'section';
    sectionEl.id = section.id;

    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = section.title;
    sectionEl.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'grid';

    const seededRandom = createSeededRandom(hashString(section.id));
    let nextSpacerAt = randomSpacerInterval(seededRandom);

    section.items.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = `media-item tier-${item.size}`;
      el.dataset.section = section.id;
      el.dataset.index = index;

      if (item.size === 'small' || item.size === 'medium' || item.size === 'large') {
        el.classList.add(seededRandom() < 0.5 ? 'align-top' : 'align-bottom');
      }

      if (item.type === 'photo') {
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.note || 'Photograph';
        el.appendChild(img);
        el.addEventListener('click', () => openLightbox(section.id, index));
      } else if (item.type === 'video') {
        el.classList.add('video-item');
        const img = document.createElement('img');
        img.src = item.poster;
        img.alt = item.note || 'Video';
        el.appendChild(img);
        const play = document.createElement('div');
        play.className = 'play-icon';
        el.appendChild(play);
        el.addEventListener('click', () => openVideoModal(item));
      }

      grid.appendChild(el);

      if (index + 1 === nextSpacerAt) {
        grid.appendChild(createSpacer(seededRandom));
        nextSpacerAt = index + 1 + randomSpacerInterval(seededRandom);
      }
    });

    sectionEl.appendChild(grid);
    main.appendChild(sectionEl);
  });
}

function randomSpacerInterval(rand) {
  // spacer every 3-7 items
  return 2 + Math.floor(rand() * 3);
}

function createSpacer(rand) {
  const tiers = ['tier-small', 'tier-medium', 'tier-large'];
  const randomTier = tiers[Math.floor(rand() * tiers.length)];
  const spacer = document.createElement('div');
  spacer.className = `media-item ${randomTier} spacer`;
  spacer.style.visibility = 'hidden';
  spacer.style.height = `${150 + rand() * 200}px`;
  spacer.style.opacity = '0';
  return spacer;
}

function setupFadeIn() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.media-item:not(.spacer)').forEach(el => observer.observe(el));
}

function setupScrollSpy() {
  const links = document.querySelectorAll('.nav-link');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[data-section="${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.section').forEach(el => observer.observe(el));
}

/* Lightbox: photos only, looping constrained to current section */
function getPhotoItems(sectionId) {
  const section = sections.find(s => s.id === sectionId);
  return section.items
    .map((item, i) => ({ ...item, index: i }))
    .filter(item => item.type === 'photo');
}

function openLightbox(sectionId, index) {
  currentSection = sectionId;
  currentIndex = index;
  showLightboxImage();
  document.getElementById('lightbox').hidden = false;
}

function showLightboxImage() {
  const photos = getPhotoItems(currentSection);
  const item = photos.find(p => p.index === currentIndex);
  const img = document.getElementById('lightbox-image');
  img.src = item.src;
  img.alt = item.note || 'Photograph';
  preloadNeighbors(photos);
}

function preloadNeighbors(photos) {
  const currentPos = photos.findIndex(p => p.index === currentIndex);
  [1, -1].forEach(offset => {
    const neighbor = photos[(currentPos + offset + photos.length) % photos.length];
    if (neighbor) {
      const preload = new Image();
      preload.src = neighbor.src;
    }
  });
}

function navigateLightbox(direction) {
  const photos = getPhotoItems(currentSection);
  const currentPos = photos.findIndex(p => p.index === currentIndex);
  const nextPos = (currentPos + direction + photos.length) % photos.length;
  currentIndex = photos[nextPos].index;
  showLightboxImage();
}

function closeLightbox() {
  document.getElementById('lightbox').hidden = true;
}

function setupLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-prev').addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lightbox-next').addEventListener('click', () => navigateLightbox(1));

  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') closeLightbox();
  });

  document.addEventListener('keydown', e => {
    const lightbox = document.getElementById('lightbox');
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });
}

/* Video modal */
function openVideoModal(item) {
  const player = document.getElementById('video-player');
  player.src = item.src;
  player.autoplay = true;
  document.getElementById('video-note').textContent = item.note || '';
  document.getElementById('video-modal').hidden = false;
}

function closeVideoModal() {
  const player = document.getElementById('video-player');
  player.pause();
  player.src = '';
  document.getElementById('video-modal').hidden = true;
}

function setupVideoModal() {
  document.getElementById('video-close').addEventListener('click', closeVideoModal);
  document.getElementById('video-modal').addEventListener('click', e => {
    if (e.target.id === 'video-modal') closeVideoModal();
  });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('video-modal').hidden && e.key === 'Escape') {
      closeVideoModal();
    }
  });
}

init();