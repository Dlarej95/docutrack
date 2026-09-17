# DocuTrack — Standalone Web App

This is the independent, deployable version of DocuTrack (the version that
lived inside a Claude artifact, now converted to a normal React project you
can host anywhere). Same app, same features — Firebase now handles data
storage instead of the artifact's built-in storage.

## What changed from the artifact version

- `window.storage.get/set` calls were replaced with Firebase Firestore
  (see `src/firebase.js`). Everything else — every screen, every feature,
  the email/SMS notification logic — is identical.
- Data now updates **live** across every open tab/device (Firestore
  real-time subscriptions), which is actually an upgrade over the artifact
  version.

## 1. Set up Firebase (free)

1. Go to **console.firebase.google.com** → **Add project** → name it
   `docutrack` (or anything) → skip Google Analytics if you don't need it.
2. In the project, go to **Build → Firestore Database → Create database**.
   Choose a region close to the Philippines (e.g. `asia-southeast1`), and
   start in **test mode** for now.
3. Go to **Project Settings** (gear icon) → **General** → scroll to
   **Your apps** → click the **Web** icon (`</>`) → register the app
   (nickname it `docutrack-web`).
4. Firebase shows you a config object with values like `apiKey`,
   `authDomain`, etc. — copy each one into your `.env` file (see step 2).

## 2. Run it locally

```bash
npm install
cp .env.example .env
```

Paste your Firebase values into `.env`, then:

```bash
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). You should see
the DocuTrack landing page, and submitting a request should show up
instantly in your Firebase Console under **Firestore Database** →
`docutrack_requests`.

## 3. Lock down Firestore before going live

While testing, "test mode" allows anyone to read/write your database —
fine for development, not fine once real student data is involved. Go to
**Firestore Database → Rules** and paste in the rules shown as a comment
at the bottom of `src/firebase.js`. This restricts staff data and
notification settings from public access while still letting students
track their own requests by reference number.

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Initial DocuTrack web app"
```

Create a new repository on GitHub, then follow its instructions to push
(`git remote add origin ...` and `git push`).

**Important:** `.env` is already in `.gitignore` so your Firebase keys
won't accidentally get committed. You'll re-enter them as environment
variables on your hosting platform instead (next step).

## 5. Deploy for free — Netlify

1. Go to **netlify.com** → sign in with GitHub → **Add new site** →
   **Import an existing project**.
2. Choose **GitHub**, authorize Netlify if asked, then select your
   `docutrack` repository.
3. Netlify auto-detects some settings, but confirm these are set:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Before deploying, click **Add environment variables** and add all six
   `VITE_FIREBASE_...` values from your `.env` file (name and value for
   each, one at a time).
5. Click **Deploy site**. In under a minute you'll get a live URL like
   `https://docutrack-123abc.netlify.app`.
6. (Optional) Go to **Site settings → Domain management → Options →
   Edit site name** to pick a nicer subdomain, e.g. `docutrack-udd`,
   giving you `https://docutrack-udd.netlify.app`.

Every time you `git push` after this, Netlify automatically rebuilds and
redeploys your live site — no need to repeat these steps.

### Alternative: Vercel
Same idea in reverse — connect the GitHub repo, leave the default Vite
build settings, add the same environment variables, deploy.

## 6. Point a real domain at it (optional)

If UdD is open to it, you can later attach a domain like
`docutrack.udd.edu.ph` under Netlify's **Domain management** settings —
otherwise the free `.netlify.app` URL works perfectly fine for your
thesis pilot and defense.

## 7. SMS backend

The `docutrack-sms-backend` project (built separately) still deploys the
same way — Render or Railway — and you connect it the same way, by
pasting its URL and shared secret into DocuTrack's **Notification setup**
admin tab. Nothing about that part changes with this web conversion.

## Local dev checklist

- [ ] Firebase project created, Firestore enabled
- [ ] `.env` filled in with real Firebase config
- [ ] `npm run dev` shows the app and requests save to Firestore
- [ ] Firestore security rules updated before any real student data is used
- [ ] Pushed to GitHub
- [ ] Deployed on Netlify with environment variables set
- [ ] (Optional) SMS backend deployed and connected
