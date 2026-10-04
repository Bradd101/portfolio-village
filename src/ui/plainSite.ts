import { siteContent } from '../content';
import { contactFormHTML, wireContactForm } from './contactForm';

export function initPlainSite() {
  const container = document.getElementById('plain-content')!;
  const { about, cv, projects, contact } = siteContent;

  container.innerHTML = `
    <h1>${siteContent.name}: ${siteContent.tagline}</h1>

    <section id="plain-about">
      <h2>${about.title}</h2>
      ${about.body.map((p) => `<p>${p}</p>`).join('')}
    </section>

    <section id="plain-cv">
      <h2>${cv.title}</h2>
      <p><a href="${cv.downloadUrl}" download>Download PDF</a></p>
      <h3>Experience</h3>
      <ul>
        ${cv.experience
          .map((e) => `<li><strong>${e.role}</strong>, ${e.company} (${e.period})<br>${e.details}</li>`)
          .join('')}
      </ul>
      <h3>Skills</h3>
      <p>${cv.skills.join(', ')}</p>
    </section>

    <section id="plain-projects">
      <h2>${projects.title}</h2>
      <ul>
        ${projects.items
          .map(
            (p) =>
              `<li><a href="${p.link}" target="_blank" rel="noopener">${p.name}</a>: ${p.description}</li>`
          )
          .join('')}
      </ul>
    </section>

    <section id="plain-contact">
      <h2>${contact.title}</h2>
      <p>Email: <a href="mailto:${contact.email}">${contact.email}</a></p>
      <ul>
        ${contact.links.map((l) => `<li><a href="${l.url}" target="_blank" rel="noopener">${l.label}</a></li>`).join('')}
      </ul>
      ${contactFormHTML()}
    </section>
  `;

  wireContactForm(container);

  const plainSiteEl = document.getElementById('plain-site')!;
  const skipLink = document.getElementById('skip-link')!;
  const closeBtn = document.getElementById('close-plain')!;

  const open = (e: Event) => {
    e.preventDefault();
    plainSiteEl.classList.remove('hidden');
    plainSiteEl.setAttribute('aria-hidden', 'false');
  };
  const close = () => {
    plainSiteEl.classList.add('hidden');
    plainSiteEl.setAttribute('aria-hidden', 'true');
  };

  skipLink.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
}
