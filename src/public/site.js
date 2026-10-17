document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const dismissButton = target.closest('[data-dismiss-notice]');
  if (!dismissButton) return;

  const notice = dismissButton.closest('.status-notice');
  notice?.setAttribute('hidden', '');
});
