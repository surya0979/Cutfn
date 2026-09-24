// Web Worker entry for Tesseract.js.
// Tesseract downloads its language model from a CDN by default, and some hosts
// (claude.ai among them) block data requests to CDNs. This entry answers that
// request with the model bundled next to the app, then starts Tesseract's own
// worker script, which is also bundled. Both URLs arrive as query parameters.
const params = new URLSearchParams(self.location.search)
const model = params.get('model')
const realFetch = self.fetch.bind(self)

self.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input.url
  return /\/eng\.traineddata(\.gz)?$/.test(url) ? realFetch(model, init) : realFetch(input, init)
}

importScripts(params.get('engine'))
