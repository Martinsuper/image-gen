self.importScripts("./vendor/imagetracer_v1.2.6.js");

self.addEventListener("message", (event) => {
  const { id, imageData, options } = event.data;

  try {
    const svg = self.ImageTracer.imagedataToSVG(imageData, options);
    self.postMessage({ id, svg });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "Vector tracing failed.",
    });
  }
});
