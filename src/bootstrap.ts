void import('./main.ts').catch((error: unknown) => {
  document.getElementById('message')!.textContent = 'The workbench could not load. Reload to retry; saved work is retained.';
  document.getElementById('error')!.textContent = error instanceof Error ? error.message : String(error);
  const retry = document.getElementById('retry') as HTMLButtonElement;
  retry.hidden = false;
  retry.onclick = () => location.reload();
  document.getElementById('nox-loading-status')!.textContent = 'Nox could not start';
  const startupError = document.getElementById('nox-loading-error')!;
  startupError.textContent = error instanceof Error ? error.message : String(error); startupError.hidden = false;
  const startupRetry = document.getElementById('nox-loading-retry') as HTMLButtonElement;
  startupRetry.hidden = false; startupRetry.onclick = () => location.reload();
});
