// Minimal runnable shell; workspace composition arrives in the later UI task.
export function App() {
  return (
    <>
      <a href="#workspace">Skip to workspace</a>
      <header>Printametric</header>
      <main id="workspace" tabIndex={-1}>
        <h1>Design</h1>
        <h2>No model yet</h2>
        <p>Model generation is not available in this version.</p>
      </main>
      <footer>
        Foundation workspace — no printable design, design saving, or downloads.
      </footer>
    </>
  );
}
