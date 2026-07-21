# ADR 0001: Single-domain API proxy

The public nginx frontend serves the SPA and reverse-proxies /api to a private backend service. Browser requests remain same-origin, reducing CORS and cookie complexity. The backend and database publish no host ports.
