/* ============ Dashboard interactivity ============ */

// Toggle switch accessibility
document.querySelectorAll('.toggle input').forEach((checkbox) => {
  checkbox.addEventListener('change', (e) => {
    const toggle = e.target.closest('.toggle');
    const slider = toggle.querySelector('.toggle-slider');
    if (e.target.checked) {
      slider.style.background = 'var(--accent)';
      slider.style.borderColor = 'var(--accent)';
    } else {
      slider.style.background = 'var(--surface-raised)';
      slider.style.borderColor = 'var(--line)';
    }
  });
});

// Form validation and AJAX save for module settings
document.querySelectorAll('.settings-form').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    const originalText = submitBtn.textContent;

    submitBtn.textContent = 'Saving…';
    submitBtn.disabled = true;

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)),
      });

      if (response.ok) {
        submitBtn.textContent = 'Saved!';
        submitBtn.classList.add('button--success');
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.classList.remove('button--success');
          submitBtn.disabled = false;
        }, 1500);
      } else {
        throw new Error('Save failed');
      }
    } catch {
      submitBtn.textContent = 'Save failed';
      submitBtn.disabled = false;
      setTimeout(() => {
        submitBtn.textContent = originalText;
      }, 1500);
    }
  });
});

// Show saved indicator from URL query
const params = new URLSearchParams(window.location.search);
if (params.get('saved') === '1') {
  const flash = document.createElement('div');
  flash.className = 'flash flash--success';
  flash.setAttribute('role', 'status');
  flash.textContent = 'Settings saved successfully.';
  const main = document.querySelector('.dashboard-content');
  if (main) {
    main.insertBefore(flash, main.firstChild);
    setTimeout(() => flash.remove(), 3000);
  }
}
