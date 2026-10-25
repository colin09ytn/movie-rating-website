# Our Next Movie — starter project

A responsive two-person movie and TV recommendation prototype built with plain HTML, CSS, and JavaScript. It is designed to be edited in VS Code and eventually published with GitHub Desktop / GitHub Pages.

## Important: local prototype vs. two-device production

This starter currently saves ratings, custom images, names, and titles in **the current browser's localStorage**. That is useful for testing the interface on one computer, but it does **not** synchronize across devices and the profile selector is not secure authentication.

For a secure shared version, use Supabase Auth + a shared database with Row Level Security (RLS). The file `supabase/schema.sql` is a starting point for that database design. Do not deploy a public site while relying on a hidden URL, a user dropdown, or a PIN checked only in JavaScript as access control.

## Run locally

1. Download and unzip this project.
2. Open the `our-next-movie` folder in VS Code.
3. Install the **Live Server** extension, if you do not already have it.
4. Right-click `index.html` and choose **Open with Live Server**.
5. Open **Settings** in the site.
6. Create a TMDB account and follow [TMDB's developer setup guide](https://developer.themoviedb.org/docs/getting-started). Paste your API Read Access Token into the TMDB field and save.
7. Go to Discover → **Add a title** to search movies and shows, or add one manually.
8. Switch between the two profile labels and rate titles. Shared scores appear after both profiles have rated the same title.

A local `file://` open may work for basic interface testing, but Live Server is recommended for API calls.

## TMDB recommendations

The app uses TMDB's API for multi-search and its movie/TV recommendation endpoints. It gathers candidates based on rated TMDB titles, excludes titles already in the list, and ranks candidates using TMDB's vote average and vote count as a lightweight quality heuristic. If no similar candidates are available, it falls back to trending titles.

This is a starter recommendation strategy, not a trained collaborative-filtering model. The app's shared voting score ranks titles after both users rate them; it does not claim to predict preferences with machine learning.

TMDB API use is subject to TMDB's current terms, attribution rules, and applicable non-commercial/commercial use requirements. See:
- https://developer.themoviedb.org/docs/getting-started
- https://developer.themoviedb.org/docs/search-and-query-for-details
- https://www.themoviedb.org/terms-of-use

## Shared score formula

Each person enters:
- `own`: how much they personally want to watch the title (0–10)
- `partner`: how much they estimate the other person wants to watch it (0–10)

When both users have rated:
`score = (A_own * B_own) + (A_partner * B_partner)`

Maximum = 200. Partner estimates are not the other person's actual vote. The interface stores each user's personal ratings independently. Scores are only shown as shared scores after both have submitted.

## Custom posters and storage

You can upload a custom image when manually adding a title or from a title's Details panel. Images are stored as data URLs in localStorage and limited to 2 MB per image. Browser storage quotas vary. For a multi-device production site, store images in Supabase Storage and keep the resulting path/URL in the database instead of storing base64 data in a database row.

## Publish through GitHub Pages

1. Create a new GitHub repository, e.g. `our-next-movie`.
2. Open GitHub Desktop → **Add an Existing Repository** and select this folder (or choose **Create a Repository** from this folder).
3. Commit the files and publish the repository.
4. In GitHub on the repository, open **Settings → Pages** and publish from the `main` branch, root folder.
5. The static frontend will be hosted online.

**Do not put a Supabase service-role key or other server secret in this repository.** GitHub Pages is static hosting. A public frontend cannot keep a secret API key confidential. For a production TMDB integration, put calls that need a private TMDB credential behind a server-side function/proxy, or use a suitable client-side approach only after reviewing the provider's credential and usage requirements.

## Next step for secure two-device use

1. Create a Supabase project.
2. Enable Supabase Auth for two individual accounts.
3. Apply the schema in `supabase/schema.sql`.
4. Add the Supabase URL and anon/publishable key to the frontend.
5. Replace localStorage operations in `js/app.js` with database reads/writes.
6. Test RLS policies with both accounts, including attempts to read or write unauthorized rows.

The schema is a starting point, not a complete drop-in integration. The frontend is intentionally local-first so you can explore and adjust the experience before wiring up the shared backend.
