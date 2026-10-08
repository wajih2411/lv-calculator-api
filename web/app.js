// API base URL (ends with "/") comes from config.js, which Terraform generates.
const API = window.LV_API_URL;
const UNAVAILABLE = 'Calculator unavailable. Try again in a moment.';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

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
    bitrate: [r.bitratePerCameraMbps, `${i.resolution} preset, H.264 at 15 fps`],
    bandwidth: [r.totalBandwidthMbps, `${fmt(i.cameraCount)} × ${fmt(r.bitratePerCameraMbps)} Mbps`],
    storage: [r.storageTB, `${fmt(r.totalBandwidthMbps)} Mbps × ${fmt(i.recordingHoursPerDay)} h/day × ${fmt(i.retentionDays)} days`],
    load: [r.totalLoadWatts, `${fmt(i.cameraCount)} × ${fmt(i.wattsPerCamera)} W + ${fmt(i.additionalLoadWatts)} W`],
    heat: [r.heatLoadBtuPerHour, `${fmt(r.totalLoadWatts)} W × 3.412`],
    ups: r.upsRuntimeMinutes === null
      ? [null, 'Add a UPS battery size to estimate runtime.']
      : [r.upsRuntimeMinutes, `${fmt(i.upsBatteryWh)} Wh × ${fmt(i.upsEfficiency)} ÷ ${fmt(r.totalLoadWatts)} W × 60`],
  };
  for (const [key, [value, basis]] of Object.entries(rows)) {
    $(`v-${key}`).textContent = value === null ? '–' : fmt(value);
    $(`b-${key}`).textContent = basis;
  }
  $('b-ups').classList.toggle('prompt', r.upsRuntimeMinutes === null);
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
    $('history-body').replaceChildren(...rows);
    status.textContent = rows.length ? '' : 'No calculations yet. Run one above and it appears here.';
  } catch {
    status.textContent = 'Recent calculations unavailable. Reload the page to try again.';
  }
}

loadHistory();
