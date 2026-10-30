// The selected study uses a full-window canvas and one native bottom disclosure.
export function gridlineBody(sun, moon) {
  return `<body>
<a class="skip" href="#workspace">Skip to workspace</a>
<header class="header">
  <div class="header-left"><span class="brand">Printametric</span><span>Wall art</span></div>
  <div class="viewbar"><nav aria-label="Workspace views"><a href="#design" aria-current="page">Design</a><a href="#print-layout">Print layout</a><a href="#assembly">Assembly</a></nav></div>
  <div class="actions"><div class="theme"><button class="theme-button" type="button" aria-label="Switch to dark theme">${sun}${moon}</button><span class="theme-mode">Light / System</span><button class="system" type="button" hidden>Use system</button></div><button type="button" data-panel="help">Help</button><button type="button" data-panel="about">About</button></div>
</header>
<main class="container" id="workspace" tabindex="-1">
  <div class="workspace">
    <section class="preview" aria-label="Preview">
      <header class="preview-head"><h1 tabindex="-1">Design</h1><span>Preview · No generated model</span></header>
      <div class="stage"><div class="empty"><h2>No model yet</h2><p>Model generation is not available in this version.</p></div></div>
      <p class="caption">Decorative grid — not to scale.</p>
    </section>
    <details class="inspector settings-drawer"><summary>Workspace settings</summary><div class="dock-content">
      <section class="settings-group" aria-labelledby="display-title"><h2 id="display-title">Display settings</h2>
        <label class="setting"><input id="tips" type="checkbox" checked>Show workspace tips</label>
        <p class="tip">Change the display here. Open Help for workspace guidance.</p>
        <p class="availability-note">Foundation workspace — no printable design, design saving, or downloads.</p>
      </section>
      <section class="settings-group" aria-labelledby="background-title"><h2 id="background-title" data-background-label>Preview background — Plain</h2>
        <fieldset class="backgrounds"><legend>Preview background · display only</legend><div class="segments"><label><input type="radio" name="background" value="plain" checked>Plain</label><label><input id="grid" type="radio" name="background" value="grid">Grid</label></div></fieldset>
      </section>
      <section class="settings-group" data-availability="model" aria-labelledby="model-title"><h2 id="model-title">Wall-art settings</h2>
        <p>Model editing and presets are not available yet.</p>
        <dl class="summary-strip"><div><dt>Dimensions</dt><dd>Not available</dd></div><div><dt>Parts</dt><dd>Not available</dd></div><div><dt>Plates</dt><dd>Not available</dd></div></dl>
      </section>
      <section class="settings-group" data-availability="plate" aria-labelledby="plate-title"><h2 id="plate-title">Build-plate settings</h2><p>Plate configuration is not available yet.</p></section>
    </div></details>
  </div>
</main>
</body>`;
}
