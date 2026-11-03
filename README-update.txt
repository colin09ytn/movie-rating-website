OUR NEXT MOVIE — SUPABASE UPDATE

Files in this package:
- index.html: updated login UI and Supabase SDK reference
- app.js: Supabase Auth + shared database integration
- auth.css: styling for the login screen and account controls
- supabase-migration.sql: adds metadata columns and enables realtime publication entries

IMPORTANT: Keep your existing style.css unchanged. The updated index.html loads both style.css and auth.css.

SETUP ORDER
1. In Supabase Dashboard > SQL Editor, run supabase-migration.sql.
2. In your GitHub repository movie-rating-website, replace index.html and app.js with the files in this package, and upload auth.css.
3. Commit the changes and wait for GitHub Pages deployment.
4. Open https://colin09ytn.github.io/movie-rating-website/ and sign in with Colin's or Erica's existing email/password account.

The app expects the existing tables and policies described in the project setup: movie_groups, group_members, titles, ratings, and group_settings. Both accounts must be members of the same group. The configured user IDs are embedded in app.js to map the two accounts to Colin and Erica.

If the login shows an error about not being assigned to the group, verify each account's UUID in public.group_members and ensure both group_members rows share the same group_id. Never put a Supabase service-role key in frontend code; this app uses the publishable key.
