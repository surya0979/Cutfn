# Fitfn Wardrobe

Photograph your clothes, let Claude tag them, and get outfits picked from what you actually own.

A phone-first rebuild of [wardrowbe](https://github.com/anyesh/wardrowbe)'s ideas (AI tagging, weather- and occasion-aware outfit picks, wear and laundry tracking) as a single page that runs on claude.ai. There's no server to host. Claude does the tagging and styling on your own claude.ai account.

## Using it

1. **Closet → Add photos.** One piece per photo: laid flat on the bed or floor, or on a hanger against a wall. Add up to 40 at once (camera, gallery, drag-and-drop or paste). Each photo is saved straight away. Claude then tags it in the background with type, colours, pattern, fabric, fit, formality (1–5), warmth (1–5) and style. Tap any piece to fix a tag, add the price, or leave a note for Claude ("only for weddings").
2. **Style me.** Pick the occasion, the temperature band (°C), rain or humidity, and the time of day. Add anything else in your own words. Claude streams back three outfits, each with reasons and a styling tip. Each one shows as a flat-lay of your own photos.
   - **Build around a piece:** pick one item (or tap *Style this piece* on it) and it's in every look.
   - **Wear today** logs the outfit, bumps each piece's wear count, and moves pieces that are due for a wash to the laundry. A t-shirt goes after 1 wear, jeans after 6, and shoes, bags and watches never go. Laundry pieces are left out of suggestions until you mark them clean.
   - Thumbs up and thumbs down (with a reason) are remembered and sent with every future request, so suggestions learn your taste.
   - **Fit check:** send a mirror selfie for a score and two concrete tweaks. The photo isn't stored.
3. **Saved.** Looks you saved from Claude, or put together yourself (*Make a look*: tap pieces, and the app swaps out clashing ones, e.g. a second shirt). Wear any of them again in one tap.
4. **History.** A month calendar of what you wore, 30-day rotation, never-worn count, your colour palette, most-worn pieces, and pieces waiting 30+ days with a *Style it* shortcut. **What to buy next** asks Claude for the 3–5 purchases that would unlock the most new outfits, plus outfit ideas for what you ignore.
5. **Style profile** (top right). Menswear, womenswear or no preference, styles and colours you like or avoid, your city, and notes such as height, fit preferences or "uniform on weekdays". Claude reads all of this every time.

Indian wear is built in: kurta, kurti, salwar/churidar, palazzo/sharara, saree, lehenga, anarkali, Nehru jacket, sherwani, dupatta, juttis/kolhapuris. The stylist knows how they pair.

## Sync and storage

The same code runs in two modes, picked automatically (`src/lib/store.js`):

- **On claude.ai (synced):** pieces, looks, wear history, your profile and feedback live in the page's database under your private `data/users/<you>/` space, live on every device. Full photos (resized to 1280 px JPEG) go to the page's asset store. Each piece also keeps a 360 px thumbnail inline so the closet grid draws instantly. *Settings → Photo storage* shows usage and clears photos left behind by deleted pieces.
- **Anywhere else** (`npm run dev`, a saved copy): everything is stored in this browser's IndexedDB. Claude features are hidden, and you tag pieces by hand.

The weather is chosen by you, not fetched: pages on claude.ai can't call outside services.

## Getting started

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # outfit slot rules, weather ranking, prompt + reply parsing, tag cleanup
npm run build:artifact   # dist/artifact.html + dist/assets/ for claude.ai
```

To republish on claude.ai: run `npm run build:artifact`, then publish `dist/artifact.html` with `dist/assets/*` and `dist/favicon.svg` alongside it. Declare the `db`, `user`, `assets` and `sample` capabilities.

## Project layout

```
src/
  App.jsx                  tabs, sheets, toasts
  components/
    Closet.jsx             grid, filters, search, upload (picker / drop / paste)
    ItemSheet.jsx          piece detail, edit form, laundry, favourite, delete with undo
    StyleMe.jsx            the plan form, streamed outfit cards, fit check
    OutfitCard.jsx         one suggestion: flat-lay, reasons, wear / save / feedback
    Looks.jsx              saved looks and the look builder
    History.jsx            calendar, stats, palette, what to buy next
    SettingsSheet.jsx      style profile, storage
    Pieces.jsx             ItemImage, ItemTile, OutfitBoard (the flat-lay)
    GarmentGlyph.jsx       garment silhouettes for missing photos and the empty closet
  lib/
    vocab.js               garment types (with body slot and wash interval), colours, scales
    outfits.js             slot de-duplication, head-to-toe order, weather ranking, stylist prompt, reply parsing
    ai.js                  Claude calls: tagging, outfits (streamed), wardrobe gaps, fit check
    store.js               claude.ai db + assets, or IndexedDB
    useUploader.js         photo → saved piece → background tagging queue
    images.js              decode, orient, resize, thumbnail
scripts/build-artifact.mjs turns the Vite build into the claude.ai page
```

Built with React 19, Vite and Tailwind CSS v4.
