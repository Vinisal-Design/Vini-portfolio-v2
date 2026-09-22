import './style.css';

async function loadProjects() {
  const res = await fetch('/data/portfolio-data.json');
  const data = await res.json();
  const grid = document.getElementById('projectsGrid');

  data.projects.forEach((project, index) => {
    const isReverse = index % 2 !== 0;
    const article = document.createElement('article');
    article.className = `work-case${isReverse ? ' reverse' : ''}`;

    const tagsHtml = project.tags.slice(0, 2).map(t =>
      `<span class="tag">${t.charAt(0).toUpperCase() + t.slice(1)}</span>`
    ).join('');

    article.innerHTML = `
      <a href="/projeto.html?slug=${project.slug}" class="work-case-link">
        <div class="work-case-media">
          <div class="work-case-img">
            <img src="${project.cover}" alt="${project.coverAlt}" loading="lazy">
            <div class="work-case-overlay"></div>
          </div>
        </div>
        <div class="work-case-info">
          <div class="work-case-tags">${tagsHtml}</div>
          <h3 class="work-case-title">${project.title}</h3>
          <p class="work-case-desc">${project.subtitle}</p>
          <span class="work-case-year">${project.year}</span>
        </div>
      </a>
    `;

    grid.appendChild(article);
  });
}

loadProjects();
