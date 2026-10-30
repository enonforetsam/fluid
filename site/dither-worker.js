import { ditherImage } from './dither-core.js';

self.onmessage = ({ data: { id, image, options } }) => {
  try {
    const result = ditherImage(image, options);
    self.postMessage({ id, result }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error.message || 'The image could not be dithered.' });
  }
};
