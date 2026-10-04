let toastEl: HTMLDivElement | null = null;

export function showToast(message: string, duration = 3000) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    toastEl.style.position = 'fixed';
    toastEl.style.top = '16px';
    toastEl.style.left = '50%';
    toastEl.style.transform = 'translateX(-50%)';
    toastEl.style.background = '#fef6e4';
    toastEl.style.border = '2px solid #2b2118';
    toastEl.style.borderRadius = '8px';
    toastEl.style.padding = '8px 16px';
    toastEl.style.fontFamily = "'Courier New', monospace";
    toastEl.style.fontSize = '13px';
    toastEl.style.color = '#2b2118';
    toastEl.style.zIndex = '80';
    toastEl.style.boxShadow = '3px 3px 0 #2b2118';
    toastEl.style.transition = 'opacity 0.3s';
    document.body.appendChild(toastEl);
  }

  toastEl.textContent = message;
  toastEl.style.opacity = '1';
  toastEl.style.display = 'block';

  window.clearTimeout((toastEl as any)._hideTimer);
  (toastEl as any)._hideTimer = window.setTimeout(() => {
    if (toastEl) toastEl.style.opacity = '0';
  }, duration);
}
