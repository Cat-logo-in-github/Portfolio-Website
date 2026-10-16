import { solveDevice } from './devices.mjs';
import { DEVICE_KEY, GARDEN_ID } from './destinations.mjs';

export function completedDeviceIds(json) {
  try {
    const value = JSON.parse(typeof json === 'string' ? json : '[]');
    return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && /^device:(routing|scheduling|debugging|sorting):[a-z0-9]{1,12}$/.test(id)))].slice(0, 100) : [];
  } catch { return []; }
}

/** Keep completion identity independent from rerolled puzzle instances. */
export function solveDeviceProgress(progress, device, submission) {
  const result = solveDevice(device, submission);
  if (!result.correct) return { ...result, state: progress, rewarded: false };
  const done = completedDeviceIds(progress.flags[DEVICE_KEY]);
  if (done.includes(device.challengeId)) return { ...result, state: progress, rewarded: false };
  const item = device.reward.item;
  return { ...result, rewarded: true, state: { ...progress, flags: { ...progress.flags, [DEVICE_KEY]: JSON.stringify([...done, device.challengeId]), ...(device.siteId === GARDEN_ID ? { 'v4:garden-restored': true } : {}) }, items: { ...progress.items, [item]: Math.min(999, (progress.items[item] || 0) + 1) } } };
}
