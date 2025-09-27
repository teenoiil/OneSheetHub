
# Deploy OneSheetHub to Firebase Hosting

## Prerequisites
- Install Node.js (LTS) from nodejs.org
- Install Firebase CLI: `npm i -g firebase-tools`
- Login: `firebase login`

## Files I prepared
- `firebase.json` — uses **OneSheetHub** as the public folder.
- `.firebaserc` — sets default project to **onesheethub** (change if needed).

## Folder layout (expected)
- OneSheetHub/
  - html/ (login.html, home.html, ...)
  - js/ (login.js, ...)
  - css/
  - pic/

## Initialize (optional)
If you run `firebase init hosting`, choose:
- **Use an existing project** → select your project (e.g., onesheethub)
- **Public directory**: `OneSheetHub`
- **Single-page app**: **No** (this is multi-page HTML)
- **Configure as GitHub Action**: up to you

## Deploy
From the folder containing `firebase.json` run:
```
firebase use onesheethub   # or your Firebase project id
firebase deploy --only hosting
```
After deploy, `/` will redirect to `/html/login.html` via a rewrite rule.

## Notes
- Asset paths in your HTML are relative (e.g., `../js/...`). Serving files under `OneSheetHub` preserves these correctly when visiting URLs like `/html/login.html`.
- If you want `/` to load a different page, change `destination` in `firebase.json` rewrites.
- If you rename the folder `OneSheetHub` to `public`, update `firebase.json` `"public": "public"`.
