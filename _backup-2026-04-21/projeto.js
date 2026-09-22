import './style.css';

async function loadProject() {
  const slug = new URLSearchParams(window.location.search).get('slug');

  if (!slug) {
    window.location.href = '/projetos.html';
    return;
  }

  const res = await fetch('/data/portfolio-data.json');
  const data = await res.json();
  const project = data.projects.find(p => p.slug === slug);

  if (!project) {
    document.getElementById('projectDetail').innerHTML = `
      <div class="container" style="padding-top: 8rem;">
        <a href="/" class="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>
          <span>Home</span>
        </a>
        <h1 class="section-title" style="margin-top: 2rem;">Projeto n\u00e3o encontrado</h1>
        <p style="color: var(--c-text-muted); margin-top: 1rem;">O projeto que voc\u00ea procura n\u00e3o existe ou foi removido.</p>
      </div>
    `;
    return;
  }

  document.title = `${project.title} | Vinicius Gayer`;
  document.querySelector('meta[name="description"]').content = project.subtitle;

  const tagsHtml = project.tags.slice(0, 3).map(t =>
    `<span class="tag">${t.charAt(0).toUpperCase() + t.slice(1)}</span>`
  ).join('');

  const coverHtml = project.cover
    ? `<div class="project-cover"><img src="${project.cover}" alt="${project.coverAlt}" loading="lazy"></div>`
    : '<div class="project-cover project-placeholder"><span>Imagem em breve</span></div>';

  const mediaItems = [];
  const videos = (project.videos || []).map(vid =>
    `<div class="project-gallery-item project-gallery-video">
       <video src="${vid}" loop muted playsinline preload="metadata"></video>
       <button class="video-mute-btn" aria-label="Ativar som">
         <svg class="icon-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
         <svg class="icon-unmuted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
       </button>
     </div>`
  );
  const images = (project.images || []).map(img =>
    `<div class="project-gallery-item"><img src="${img}" alt="${project.title}" loading="lazy"></div>`
  );

  // Intercalate: video at position 0, then images, video at position 3
  if (videos.length > 0) {
    let imgIdx = 0;
    mediaItems.push(videos[0]);
    while (imgIdx < images.length) {
      mediaItems.push(images[imgIdx++]);
      if (mediaItems.length === 3 && videos.length > 1) {
        mediaItems.push(videos[1]);
      }
    }
    for (let v = 2; v < videos.length; v++) {
      mediaItems.push(videos[v]);
    }
  } else {
    mediaItems.push(...images);
  }

  const galleryHtml = mediaItems.length > 0
    ? mediaItems.join('')
    : `<div class="project-gallery-item project-placeholder"><span>Imagem em breve</span></div>
       <div class="project-gallery-item project-placeholder"><span>Imagem em breve</span></div>
       <div class="project-gallery-item project-placeholder"><span>Imagem em breve</span></div>`;

  document.getElementById('projectDetail').innerHTML = `
    <div class="container project-detail-container">

      <a href="javascript:void(0)" class="back-link" id="backBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>
        <span>Voltar</span>
      </a>

      <div class="project-hero">
        <div class="project-hero-info">
          <div class="project-tags">${tagsHtml}</div>
          <h1 class="project-detail-title">${project.title}</h1>
          <p class="project-detail-subtitle">${project.subtitle}</p>
          <span class="project-detail-year">${project.year}</span>
        </div>
      </div>

      ${coverHtml}

      <div class="project-meta">
        <div class="project-meta-item">
          <span class="project-meta-label">Cliente</span>
          <span class="project-meta-value">${project.client}</span>
        </div>
        <div class="project-meta-item">
          <span class="project-meta-label">Fun\u00e7\u00e3o</span>
          <span class="project-meta-value">${project.role}</span>
        </div>
      </div>

      <div class="project-gallery">
        ${galleryHtml}
      </div>

      <div class="project-lightbox" id="projectLightbox">
        <button class="project-lightbox-close" aria-label="Fechar">&times;</button>
        <img src="" alt="">
      </div>

    </div>
  `;

  // ── Reorder gallery items for CSS columns (reading order: 1-2, 3-4) ──
  const gallery = document.querySelector('.project-gallery');
  const items = Array.from(gallery.children);
  if (items.length > 1) {
    const col1 = items.filter((_, i) => i % 2 === 0);
    const col2 = items.filter((_, i) => i % 2 === 1);
    gallery.innerHTML = '';
    col1.forEach(el => gallery.appendChild(el));
    col2.forEach(el => gallery.appendChild(el));
  }

  // ── Autoplay videos when visible ──
  const videoEls = document.querySelectorAll('.project-gallery-video video');
  if (videoEls.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.play().catch(() => {});
        } else {
          entry.target.pause();
        }
      });
    }, { threshold: 0.3 });
    videoEls.forEach(v => observer.observe(v));
  }

  // ── Mute toggle ──
  document.querySelectorAll('.video-mute-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const video = btn.parentElement.querySelector('video');
      video.muted = !video.muted;
      btn.classList.toggle('unmuted', !video.muted);
      btn.setAttribute('aria-label', video.muted ? 'Ativar som' : 'Desativar som');
    });
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  });

  // ── Lightbox ──
  const lightbox = document.getElementById('projectLightbox');
  const lightboxImg = lightbox.querySelector('img');
  const lightboxClose = lightbox.querySelector('.project-lightbox-close');

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.project-gallery-item img').forEach(img => {
    img.addEventListener('click', () => {
      openLightbox(img.src, img.alt);
    });
  });

  lightboxClose.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });

  requestAnimationFrame(() => {
    document.querySelector('.project-detail-container').classList.add('visible');
  });
}

loadProject();
