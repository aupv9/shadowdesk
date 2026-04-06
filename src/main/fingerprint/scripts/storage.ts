/**
 * Storage API fingerprint defense — spoofs navigator.storage.estimate()
 * to return realistic quota values that don't reveal headless/automation.
 * Headless Chrome reports different storage quotas than headed Chrome.
 */
export function buildStorageScript(): string {
  return `
(function() {
  'use strict';

  if (!navigator.storage || !navigator.storage.estimate) return;

  const origEstimate = navigator.storage.estimate.bind(navigator.storage);

  navigator.storage.estimate = async function() {
    const real = await origEstimate();

    // Headed Chrome typically reports ~60% of disk as quota
    // Headless or containerized environments report much less
    // Normalize to realistic desktop values
    const minQuota = 100 * 1024 * 1024 * 1024; // 100 GB minimum
    const quota = Math.max(real.quota || 0, minQuota);

    // Usage should be small for a fresh profile
    const usage = real.usage || Math.floor(Math.random() * 5 * 1024 * 1024); // 0–5 MB

    return {
      quota: quota,
      usage: usage,
      usageDetails: real.usageDetails || {}
    };
  };

  // Also patch navigator.storage.persisted to return false (fresh profile)
  if (navigator.storage.persisted) {
    const origPersisted = navigator.storage.persisted.bind(navigator.storage);
    navigator.storage.persisted = async function() {
      return false;
    };
  }

  if (window.__ghostRegisterNative) {
    window.__ghostRegisterNative(navigator.storage.estimate);
  }
})();
`
}
