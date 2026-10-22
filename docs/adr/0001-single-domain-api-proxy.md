# ADR 0001: Single-domain API proxy

The public nginx frontend serves the SPA and reverse-proxies /api to a private backend service. Browser requests remain same-origin, reducing CORS and cookie complexity. The backend and database publish no host ports.

Dokploy's Traefik is the public trust boundary. It terminates TLS, rejects untrusted
forwarded-header assertions by default, and rebuilds `X-Forwarded-Proto` and
`X-Forwarded-For` from the client connection. The private frontend forwards these
canonical headers; `CF-Visitor` is ignored. Neither application container publishes
a host port. The Compose configuration disables Traefik discovery for backend and
migrations and fixes backend proxy trust to the two application proxy hops.

Use Dokploy's HTTPS domain on frontend port 8080 with HTTP-to-HTTPS redirection.
Keep Traefik's `forwardedHeaders.insecure` disabled and do not publish origin ports.
No ingress address/CIDR environment variable is needed. Docker-network access is
trusted infrastructure access; this topology does not treat other containers on
that network as untrusted public clients.
