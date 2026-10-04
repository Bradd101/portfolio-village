export class VillagerChat {
  private el: HTMLDivElement;
  private messagesEl: HTMLDivElement;
  private input: HTMLInputElement;
  private form: HTMLFormElement;
  private sendBtn: HTMLButtonElement;
  private greeted = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'villager-chat';

    const header = document.createElement('div');
    header.className = 'vc-header';
    header.innerHTML = `<span>Villager</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'vc-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'vc-messages';

    this.form = document.createElement('form');
    this.form.className = 'vc-form';
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Ask about Bradley...';
    this.input.maxLength = 300;
    this.sendBtn = document.createElement('button');
    this.sendBtn.type = 'submit';
    this.sendBtn.textContent = 'Ask';
    this.form.append(this.input, this.sendBtn);
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.ask();
    });

    this.el.append(header, this.messagesEl, this.form);
    document.body.appendChild(this.el);
  }

  show() {
    this.el.classList.add('visible');
    if (!this.greeted) {
      this.greeted = true;
      this.addMessage(
        'villager',
        "Welcome traveller! Ask me anything about Bradley: his work, skills, or what he's been building."
      );
    }
    this.input.focus();
  }

  hide() {
    this.el.classList.remove('visible');
  }

  get isVisible() {
    return this.el.classList.contains('visible');
  }

  toggle() {
    if (this.isVisible) this.hide();
    else this.show();
  }

  private addMessage(role: 'user' | 'villager', text: string) {
    const msg = document.createElement('div');
    msg.className = `vc-msg vc-msg-${role}`;
    msg.textContent = text;
    this.messagesEl.appendChild(msg);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return msg;
  }

  private async ask() {
    const question = this.input.value.trim();
    if (!question) return;

    this.addMessage('user', question);
    this.input.value = '';
    this.sendBtn.disabled = true;
    const thinking = this.addMessage('villager', '...');

    try {
      const res = await fetch('/ask-villager.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const json = await res.json().catch(() => ({ ok: false, error: 'Unexpected response.' }));

      thinking.textContent = res.ok && json.ok ? json.reply : json.error || 'Something went wrong.';
      thinking.classList.toggle('vc-msg-error', !(res.ok && json.ok));
    } catch {
      thinking.textContent = 'Could not reach the village right now. Try again later.';
      thinking.classList.add('vc-msg-error');
    } finally {
      this.sendBtn.disabled = false;
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }
}
