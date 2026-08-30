(() => {
  const parts = ['02','03','04','05','06'];
  const root = document.documentElement;

  async function loadBackground() {
    try {
      const chunks = await Promise.all(
        parts.map(part =>
          fetch(`/assets/home-bg-parts/${part}.txt`, { cache: 'force-cache' })
            .then(r => {
              if (!r.ok) throw new Error(`Background part ${part} unavailable`);
              return r.text();
            })
        )
      );

      const base64 = chunks.join('');
      root.style.setProperty('--capital-home-bg', `url("data:image/webp;base64,${base64}")`);
      document.body.classList.add('home-bg-ready');
    } catch (error) {
      console.error('[The Capital] Homepage background failed to load.', error);
      document.body.classList.add('home-bg-fallback');
    }
  }

  loadBackground();
})();
