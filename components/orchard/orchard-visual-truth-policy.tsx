"use client"

const ORCHARD_VISUAL_TRUTH_CSS = `
[data-orchard-image-policy] img[src*="images.unsplash.com"],
[data-orchard-image-policy] img[src*="source.unsplash.com"],
[data-orchard-image-policy] img[src*="unsplash.com/photos"],
[data-orchard-image-policy] img[src*="images.pexels.com"],
[data-orchard-image-policy] img[src*="pixabay.com"] {
  display: none !important;
}

[data-orchard-image-policy] :is(figure, picture):has(> img[src*="unsplash.com"]),
[data-orchard-image-policy] :is(figure, picture):has(> img[src*="pexels.com"]),
[data-orchard-image-policy] :is(figure, picture):has(> img[src*="pixabay.com"]) {
  display: none !important;
}

[data-orchard-image-policy] :is(div, section):has(> img[src*="images.unsplash.com"]),
[data-orchard-image-policy] :is(div, section):has(> img[src*="source.unsplash.com"]),
[data-orchard-image-policy] :is(div, section):has(> img[src*="unsplash.com/photos"]),
[data-orchard-image-policy] :is(div, section):has(> img[src*="images.pexels.com"]),
[data-orchard-image-policy] :is(div, section):has(> img[src*="pixabay.com"]) {
  background-color: var(--card) !important;
}

[data-orchard-image-policy] :is(div, section):has(> img[src*="images.unsplash.com"]) > [class*="absolute"][class*="inset-0"],
[data-orchard-image-policy] :is(div, section):has(> img[src*="source.unsplash.com"]) > [class*="absolute"][class*="inset-0"],
[data-orchard-image-policy] :is(div, section):has(> img[src*="unsplash.com/photos"]) > [class*="absolute"][class*="inset-0"],
[data-orchard-image-policy] :is(div, section):has(> img[src*="images.pexels.com"]) > [class*="absolute"][class*="inset-0"],
[data-orchard-image-policy] :is(div, section):has(> img[src*="pixabay.com"]) > [class*="absolute"][class*="inset-0"] {
  background: transparent !important;
}
`

export function OrchardVisualTruthPolicy() {
  return <style>{ORCHARD_VISUAL_TRUTH_CSS}</style>
}
