// API base URL (ends with "/") comes from config.js, which Terraform generates.
const API = window.LV_API_URL;
const UNAVAILABLE = 'Calculator unavailable. Try again in a moment.';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

// Motion (motion.dev) is an enhancement: if the CDN fails or the user prefers
// reduced motion, results simply appear with no animation.
const MOTION_URL = 'https://cdn.jsdelivr.net/npm/motion@14.0.0/+esm';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const EASE = [0.22, 1, 0.36, 1];
let motion = null;
// Settles when Motion has loaded or failed, or after 400 ms, so a slow CDN never holds the page up.
const motionReady = reducedMotion.matches ? Promise.resolve() : Promise.race([
  import(MOTION_URL).then((m) => { motion = m; }).catch(() => {}),
  new Promise((resolve) => setTimeout(resolve, 400)),
]);
const canAnimate = () => motion && !reducedMotion.matches;

const form = $('calc-form');
const errorBox = $('form-error');

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

// Empty fields are left out so the API applies its own defaults.
function readForm() {
  const body = {};
  for (const el of form.elements) {
    if (!el.name || el.value === '') continue;
    body[el.name] = el.name === 'resolution' ? el.value : Number(el.value);
  }
  return body;
}

function renderResult(r) {
  const i = r.inputs;
  const rows = {
    bandwidth: [r.totalBandwidthMbps, `${fmt(i.cameraCount)} × ${fmt(r.bitratePerCameraMbps)} Mbps, ${i.resolution}`],
    storage: [r.storageTB, `${fmt(r.totalBandwidthMbps)} Mbps × ${fmt(i.recordingHoursPerDay)} h/day × ${fmt(i.retentionDays)} days`],
    load: [r.totalLoadWatts, `${fmt(i.cameraCount)} × ${fmt(i.wattsPerCamera)} W + ${fmt(i.additionalLoadWatts)} W`],
    heat: [r.heatLoadBtuPerHour, `${fmt(r.totalLoadWatts)} W × 3.412`],
    ups: r.upsRuntimeMinutes === null
      ? [null, 'Add a UPS battery size to estimate runtime.']
      : [r.upsRuntimeMinutes, `${fmt(i.upsBatteryWh)} Wh × ${fmt(i.upsEfficiency)} ÷ ${fmt(r.totalLoadWatts)} W × 60`],
  };
  // Final values go in first, so an interrupted or skipped animation still leaves correct numbers.
  for (const a of running) a.stop();
  const counts = [];
  for (const [key, [value, basis]] of Object.entries(rows)) {
    const el = $(`v-${key}`);
    el.textContent = value === null ? '–' : fmt(value);
    el.closest('.readout').classList.toggle('empty', value === null);
    $(`b-${key}`).textContent = basis;
    if (value !== null) counts.push([el, value]);
  }
  $('b-ups').classList.toggle('prompt', r.upsRuntimeMinutes === null);
  $('results').classList.add('live');
  $('results-status').textContent =
    `Results updated. Total bandwidth ${fmt(r.totalBandwidthMbps)} Mbps, storage ${fmt(r.storageTB)} TB, total load ${fmt(r.totalLoadWatts)} W.`;
  running = canAnimate() ? revealResults(counts) : [];
}

// One orchestrated reveal: a scan line crosses the panel, the readouts rise in
// sequence and each number counts up to its value.
let running = [];
function revealResults(counts) {
  const { animate, stagger } = motion;
  return [
    animate($('scan'), { scaleX: [0, 1], opacity: [1, 1, 0] }, { duration: 0.8, ease: EASE }),
    animate('.readout', { opacity: [0, 1], y: [8, 0] }, { duration: 0.4, delay: stagger(0.05), ease: EASE }),
    ...counts.map(([el, value], n) => {
      // Hold the decimal places steady while counting so the digits don't jitter.
      const digits = Math.min(2, (String(value).split('.')[1] || '').length);
      const opts = { minimumFractionDigits: digits, maximumFractionDigits: digits };
      return animate(0, value, {
        duration: 0.7,
        delay: n * 0.05,
        ease: EASE,
        onUpdate: (v) => { el.textContent = v.toLocaleString('en-US', opts); },
      });
    }),
  ];
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  $('submit').disabled = true;
  try {
    const res = await fetch(`${API}calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readForm()),
    });
    if (res.status === 400) {
      showError((await res.json()).error);
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderResult(await res.json());
    loadHistory();
  } catch {
    showError(UNAVAILABLE);
  } finally {
    $('submit').disabled = false;
  }
});

// History is public input: values only ever go in via textContent.
let historyLoaded = false;
async function loadHistory() {
  const status = $('history-status');
  try {
    const res = await fetch(`${API}history?limit=10`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { items } = await res.json();
    const rows = items.map(({ createdAt, result }) => {
      const i = result?.inputs ?? {};
      const tr = document.createElement('tr');
      const cells = [
        [new Date(createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })],
        [i.cameraCount, 'num'],
        [i.resolution],
        [`${i.retentionDays} days`, 'num'],
        [`${result?.storageTB} TB`, 'num'],
        [`${result?.totalLoadWatts} W`, 'num'],
      ];
      for (const [text, className] of cells) {
        const td = tr.insertCell();
        td.textContent = text;
        if (className) td.className = className;
      }
      return tr;
    });
    await motionReady;
    $('history-body').replaceChildren(...rows);
    // First load fades every row in; after that only the newest row does.
    const fresh = historyLoaded ? rows.slice(0, 1) : rows;
    historyLoaded = true;
    if (canAnimate() && fresh.length) {
      const { animate, stagger } = motion;
      animate(fresh, { opacity: [0, 1], y: [4, 0] }, { duration: 0.3, delay: stagger(0.03), ease: EASE });
    }
    status.textContent = rows.length ? '' : 'No calculations yet. Run one above and it appears here.';
  } catch {
    status.textContent = 'Recent calculations unavailable. Reload the page to try again.';
  }
}

loadHistory();
