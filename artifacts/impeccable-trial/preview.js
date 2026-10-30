// Local prototype wiring only. The decision sketches remain self-contained and script-free.
import { HELP_SECTIONS, ABOUT_PARAGRAPHS } from './content.js';
import license from '/LICENSE?raw';

const allowed = ['contour', 'gallery', 'gridline', 'conventional'];
const requested = new URLSearchParams(location.search).get('direction');
const direction = allowed.includes(requested) ? requested : 'contour';
if (new URLSearchParams(location.search).get('standalone') === '1') {
  document.querySelector('.trial-bar').remove();
} else {
  document.querySelector(`a[href="?direction=${direction}"]`).setAttribute('aria-current', 'page');
}
const frame = document.querySelector('iframe');
frame.src = `./${direction}.html`;
frame.addEventListener('load', () => {
  const doc = frame.contentDocument;
  const root = doc.documentElement;
  const media = matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  const theme = doc.querySelector('.theme-button');
  const system = doc.querySelector('.system');
  const mode = doc.querySelector('.theme-mode');
  function applyTheme() {
    const dark = preference === 'dark' || (preference === 'system' && media.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    theme.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    mode.textContent = `${dark ? 'Dark' : 'Light'} / ${preference === 'system' ? 'System' : 'Manual'}`;
    system.hidden = preference === 'system';
  }
  theme.onclick = () => { preference = root.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(); };
  system.onclick = () => { preference = 'system'; applyTheme(); theme.focus(); };
  media.addEventListener('change', applyTheme);
  addEventListener('pagehide', () => media.removeEventListener('change', applyTheme), { once: true });
  applyTheme();

  const views = {
    design: ['Design', 'No model yet', 'Model generation is not available in this version.'],
    'print-layout': ['Print layout', 'No print layout yet', 'Part arrangement and fit checks are not available in this version.'],
    assembly: ['Assembly', 'No assembly guidance yet', 'Assembly guidance is not available in this version.'],
  };
  doc.querySelector('.skip').onclick = event => { event.preventDefault(); doc.querySelector('main').focus(); };
  doc.querySelectorAll('.viewbar a').forEach(link => link.onclick = event => {
    event.preventDefault();
    const view = link.getAttribute('href').slice(1);
    const [title, heading, description] = views[view];
    doc.querySelectorAll('.viewbar a').forEach(item => item.removeAttribute('aria-current'));
    link.setAttribute('aria-current', 'page');
    doc.querySelector('h1').textContent = title;
    doc.querySelector('.empty h2').textContent = heading;
    doc.querySelector('.empty p').textContent = description;
    doc.querySelector('[data-availability=model]').hidden = view !== 'design';
    doc.querySelector('[data-availability=plate]').hidden = view === 'assembly';
    doc.querySelector('h1').focus();
  });
  doc.querySelectorAll('input[name=background]').forEach(radio => radio.onchange = () => {
    const background = radio.value === 'grid' ? 'Grid' : 'Plain';
    const label = doc.querySelector('[data-background-label]');
    if (label) label.textContent = `Preview background — ${background}`;
    else radio.closest('details').querySelector('summary').textContent = `Advanced — ${background} background`;
  });
  doc.querySelectorAll('[data-panel]').forEach(opener => opener.onclick = () => {
    const help = opener.dataset.panel === 'help';
    const title = help ? 'Help' : 'About';
    const dialog = doc.createElement('dialog');
    dialog.className = 'support-dialog';
    dialog.setAttribute('aria-labelledby', 'support-title');
    dialog.innerHTML = `<header><h2 id="support-title" tabindex="-1">${title}</h2><button type="button">Close ${title}</button></header>`;
    const heading = dialog.querySelector('h2');
    if (help) HELP_SECTIONS.forEach(section => {
      const element = doc.createElement('section');
      const h = doc.createElement('h3'); h.textContent = section.heading;
      const p = doc.createElement('p'); p.textContent = section.text;
      element.append(h, p); dialog.append(element);
    });
    else {
      ABOUT_PARAGRAPHS.forEach(text => { const p = doc.createElement('p'); p.textContent = text; dialog.append(p); });
      const details = doc.createElement('details');
      const summary = doc.createElement('summary'); summary.textContent = 'Read full license';
      const pre = doc.createElement('pre'); pre.textContent = license;
      details.append(summary, pre); dialog.append(details);
    }
    const close = () => { dialog.close(); dialog.remove(); opener.focus(); };
    dialog.querySelector('button').onclick = close;
    dialog.oncancel = event => { event.preventDefault(); close(); };
    dialog.onkeydown = event => {
      if (event.key !== 'Tab') return;
      const stops = dialog.querySelectorAll('button, summary');
      const first = stops[0], last = stops[stops.length - 1];
      if (event.shiftKey && [first, heading, dialog].includes(doc.activeElement)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    doc.body.append(dialog); dialog.showModal(); heading.focus();
  });
});
