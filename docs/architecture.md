# Architecture

Initial target architecture:

```text
Browser
   │
   ▼
Cloudflare Workers
   │
   ├── Authentication / authorization
   ├── Admin API
   └── Application API
   │
   ▼
Cloudflare D1
   │
   └── ClassMoney 2.0 schema
```
