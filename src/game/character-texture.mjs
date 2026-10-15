const decoded = new WeakMap();
/** Decode the original sheet's exact color key once; no source art is modified. */
export function characterTexture(image) {
  if (!image?.complete || !image.naturalWidth) return null;
  if (decoded.has(image)) return decoded.get(image);
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return image;
  context.drawImage(image, 0, 0);
  try {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height), data = pixels.data;
    const red = data[0], green = data[1], blue = data[2];
    for (let i = 0; i < data.length; i += 4) if (data[i] === red && data[i + 1] === green && data[i + 2] === blue) data[i + 3] = 0;
    context.putImageData(pixels, 0, 0); decoded.set(image, canvas); return canvas;
  } catch { decoded.set(image, image); return image; }
}
