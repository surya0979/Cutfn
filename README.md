# Cutfn

A fast, mobile-first tracker for a fitness cut: calories in, calories burned, and the weight trend. It runs entirely in the browser. There's no backend and no account; everything is saved to `localStorage`.

Built with React 19, Vite, Tailwind CSS v4, Recharts and Tesseract.js.

## Features

### Daily calorie dashboard
- A ring shows **Net calories = Eaten − Burned** against your daily target. It turns red if you go over.
- The equation row shows Eaten, Burned, Net, an editable **Daily target** (default 2,000 kcal) and **Remaining**.
- A protein / carbs / fat split for the day.
- The ‹ › day switcher lets you review or back-fill earlier days. The app rolls over to the new day at midnight.

### Log a meal
- **Manual:** food name and calories, with optional macros. Leave calories blank and they're calculated from the macros (4/4/9). Recent foods can be re-added in one tap.
- **Scan menu:** photograph, upload, drop or paste (Ctrl/⌘+V) a school menu.
  - OCR runs **on your device** with Tesseract.js. The recognized text lands in an editable box, so you can fix any misreads and the estimates update as you type. You can also just type or paste a menu.
  - Dishes are matched against a built-in database of ~150 typical school-cafeteria portions, with calories and protein/carbs/fat for each.
  - Matching handles menu shorthand (`w/`, `&`), plurals, several dishes on one line ("Cheeseburger w/ Fries & Milk"), and OCR typos ("Chiken Nugets" → Chicken nuggets).
  - Adjust servings (½× steps), then hit **Add to Log**.
  - Lines it can't identify are listed. Tap one to log it manually.
  - **Try sample** loads a demo menu, so you can try it without a photo.
- Today's meals are listed with a delete button on each.

### Calorie burn & cardio
All burns use the standard MET equation:

```
kcal = MET × body weight (kg) × duration (hours)
```

- **Weight-based:** burns always use your **most recent weigh-in** (on or before that day). A new weigh-in updates that day's burns straight away. Until you log a weight, a 154 lb (70 kg) default is used and flagged.
- **Distance → calories (walking / running):** enter the distance in mi or km. Adding a time works out your actual speed, and the MET is interpolated from the 2011 Compendium of Physical Activities. Without a time, a typical pace is assumed (walking 3 mph ≈ 3.5 MET, running 6 mph / 10:00 per mile ≈ 9.8 MET). Unrealistic paces are flagged.
- **Skips → calories (jump rope):** enter a skip count or minutes. The default pace is ~110 skips/min at **11.8 MET** (Compendium, 100–120 skips/min). Slow (8.8 MET) and fast (12.3 MET) are options.
- Each workout shows its duration, pace, MET and kcal. Workouts are stored as raw inputs, so the calories are always recomputed from the current weight.

### Weight trend
- Log today's weight (or back-fill a date) in lb or kg. There's one entry per day, and saving again replaces it.
- An interactive line chart shows your weigh-ins plus a **7-day moving average** to smooth out water swings. The axes rescale automatically as data is added, so the downward trend stays easy to read. You can switch between 30D, 90D and All.
- Stats: start, current, total change, and rate over the last 4 weeks (least-squares fit).
- There's a full weigh-in table with delete buttons.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (MET math, menu parser, weight trend)
npm run build      # static site in dist/
npm run preview    # serve the production build
```

To try it on your phone, run `npm run dev -- --host` and open the "Network" URL on the same Wi-Fi.

`dist/` is a plain static site with relative paths, so it can be deployed to GitHub Pages, Netlify, Vercel, or any static host.

## Notes

- **Data** lives only in this browser's `localStorage` (keys `cutfn.v1.*`). Clearing site data erases it, and it doesn't sync across devices.
- **OCR** downloads the Tesseract engine and English model (~10 MB) from the jsDelivr CDN the first time you scan. After that the browser caches them. If a network blocks the CDN, typing or pasting the menu still works.
- **Estimates:** nutrition values are typical portions based on USDA data. Burn figures use gross METs, which is the standard formula and includes your resting burn during the activity. Treat both as guides, not lab measurements.

## Project layout

```
src/
  App.jsx                 state, persistence, daily totals
  components/             Dashboard, CalorieRing, LogMeal, ManualEntry, MenuScanner,
                          MealList, CardioLog, WeightSection, WeightChart, ui primitives
  lib/
    exercise.js           MET tables + distance / jump-rope burn formulas
    foodDb.js             school-menu nutrition database
    menuParser.js         text → dishes matcher (aliases, plurals, OCR fuzziness)
    ocr.js                lazy-loaded Tesseract.js wrapper
    weight.js             latest-weight lookup, moving average, weekly rate
    chartScale.js         nice axis ticks for the weight chart
    storage.js            localStorage-backed state hook
```
