# ApplyFlow AI — frontend

React + TypeScript app built with Vite, styled with Tailwind CSS.

## Setup

```powershell
cd frontend
npm install
copy .env.example .env
```

`.env` holds `VITE_API_URL`, the address of the backend API (default
`http://127.0.0.1:8765`). Every `VITE_` variable is copied into the browser code and is
public: never put a secret in it. The `.env` file is ignored by Git.

## Run

Start the backend first (see the root README), then:

```powershell
cd frontend
npm run dev
```

**Open http://localhost:5173** (not `http://127.0.0.1:5173`).

**Why?** On this machine Vite listens on `localhost`, which resolves to the IPv6 address
`::1` (`netstat` shows `[::1]:5173`). `127.0.0.1` is an IPv4 address, so connecting to it
gives `ERR_CONNECTION_REFUSED`: nothing listens on IPv4. The backend allows both origins
(CORS, see ADR 007), but only `localhost:5173` actually works with the default Vite settings.

## Other commands

```powershell
npm run build   # type-check and build for production (output in dist/, ignored by Git)
npm run lint    # check the code with Oxlint
```
