export function contactFormHTML(): string {
  return `
    <form class="contact-form" novalidate>
      <label>
        Name
        <input type="text" name="name" required maxlength="100" />
      </label>
      <label>
        Email
        <input type="email" name="email" required maxlength="200" />
      </label>
      <label>
        Message
        <textarea name="message" required maxlength="5000" rows="5"></textarea>
      </label>
      <!-- honeypot: hidden from real visitors via CSS, bots tend to fill every field -->
      <input type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off" />
      <button type="submit">Send Message</button>
      <div class="form-status" role="status"></div>
    </form>
  `;
}

export function wireContactForm(container: ParentNode) {
  const form = container.querySelector<HTMLFormElement>('.contact-form');
  if (!form) return;

  const status = form.querySelector<HTMLDivElement>('.form-status')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      message: formData.get('message'),
      website: formData.get('website'), // honeypot
    };

    button.disabled = true;
    status.textContent = 'Sending...';
    status.className = 'form-status';

    try {
      const res = await fetch('/contact.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({ ok: false, error: 'Unexpected response from server.' }));

      if (res.ok && json.ok) {
        status.textContent = 'Thanks! Your message is on its way.';
        status.className = 'form-status success';
        form.reset();
      } else {
        status.textContent = json.error || 'Something went wrong. Please try again.';
        status.className = 'form-status error';
      }
    } catch {
      status.textContent = 'Could not reach the server. Please try again later.';
      status.className = 'form-status error';
    } finally {
      button.disabled = false;
    }
  });
}
