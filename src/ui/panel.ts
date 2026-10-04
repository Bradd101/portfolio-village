import { siteContent } from '../content';
import { contactFormHTML, wireContactForm } from './contactForm';

export type PanelType = 'about' | 'cv' | 'projects' | 'contact';

export class ContentPanel {
  private overlay: HTMLDivElement;
  private box: HTMLDivElement;
  private onCloseCb: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'content-panel';

    this.box = document.createElement('div');
    this.box.className = 'panel-box';

    this.overlay.appendChild(this.box);
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  onClose(cb: () => void) {
    this.onCloseCb = cb;
  }

  get isOpen() {
    return this.overlay.classList.contains('visible');
  }

  open(type: PanelType) {
    this.box.innerHTML = this.render(type);
    this.box.querySelector('.panel-close')?.addEventListener('click', () => this.close());
    if (type === 'contact') wireContactForm(this.box);
    this.overlay.classList.add('visible');
  }

  close() {
    this.overlay.classList.remove('visible');
    this.onCloseCb?.();
  }

  private render(type: PanelType): string {
    switch (type) {
      case 'about':
        return this.renderAbout();
      case 'cv':
        return this.renderCv();
      case 'projects':
        return this.renderProjects();
      case 'contact':
        return this.renderContact();
    }
  }

  private renderAbout(): string {
    const { title, body } = siteContent.about;
    return `
      <button class="panel-close" aria-label="Close">&times;</button>
      <h2>${title}</h2>
      ${body.map((p) => `<p>${p}</p>`).join('')}
    `;
  }

  private renderCv(): string {
    const { title, downloadUrl, experience, skills } = siteContent.cv;
    return `
      <button class="panel-close" aria-label="Close">&times;</button>
      <h2>${title}</h2>
      <p><a href="${downloadUrl}" download>Download PDF</a></p>
      <h3>Experience</h3>
      ${experience
        .map(
          (e) => `
        <div class="cv-entry">
          <h3>${e.role}, ${e.company}</h3>
          <div class="cv-meta">${e.period}</div>
          <p>${e.details}</p>
        </div>`
        )
        .join('')}
      <h3>Skills</h3>
      <ul class="skills-list">
        ${skills.map((s) => `<li>${s}</li>`).join('')}
      </ul>
    `;
  }

  private renderProjects(): string {
    const { title, items } = siteContent.projects;
    return `
      <button class="panel-close" aria-label="Close">&times;</button>
      <h2>${title}</h2>
      ${items
        .map(
          (p) => `
        <div class="project-entry">
          <h3><a href="${p.link}" target="_blank" rel="noopener">${p.name}</a></h3>
          <p>${p.description}</p>
          <div>${p.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
        </div>`
        )
        .join('')}
    `;
  }

  private renderContact(): string {
    const { title, email, links } = siteContent.contact;
    return `
      <button class="panel-close" aria-label="Close">&times;</button>
      <h2>${title}</h2>
      <p>Email: <a href="mailto:${email}">${email}</a></p>
      <ul>
        ${links.map((l) => `<li><a href="${l.url}" target="_blank" rel="noopener">${l.label}</a></li>`).join('')}
      </ul>
      ${contactFormHTML()}
    `;
  }
}
