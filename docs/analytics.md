# Analytics

GA4 is enabled via gtag.js in the App Router root layout.

## Environment

Set this in Netlify (or your local `.env`):

```
NEXT_PUBLIC_GA_ID=G-4WCN580TG8
```

## How it works

- GA is loaded once in `app/layout.tsx`.
- Client-side route changes send `page_view` events.
- A simple consent scaffold exists (`analytics_consent` in localStorage), defaulting to granted.

## Verify

1) Open the site and navigate between pages.
2) Check GA Realtime to see active users and page views.
3) In browser devtools, confirm network calls to `https://www.google-analytics.com/g/collect`.
