# Open Quality Guardian

A quality-planning platform for **complex products**: requirements, functions, logical and physical design, CAD, BOMs, KiCad, tests and reports on one digital thread.

The reference product in the seed data is an autonomous vacuum (AuroraVac) — the same class of system as a Roomba. The data model is generic: any cyber-physical product can sit on the same multi-V / RFLP spine.

Inspired by Vector PREEvision’s RFLP and V-model views, but aimed at product owners and program managers as much as systems engineers. Details stay visible; quality is the product.

## What you get

- **Systems engineering V-model** — stakeholder needs through software and hardware design, each station paired with verification or validation.
- **RFLP viewpoints** — Requirements, Functional, Logical, Physical, with trees a non-SysML reader can follow.
- **Functional diagrams** — swimlane activity models (React Flow) for product features.
- **Traceability** — coverage and “links missing” between needs, architecture and tests.
- **Artifact studio** — BOM, KiCad schematic/PCB metadata, CAD facts, 3D visualization, product specification.
- **Quality cockpit & reports** — score, gaps, failed tests, owners, V-station health.
- **Configuration dictionary** — variants and named SKUs filter requirements, BOM and tests together (150% vs 100%), with quality scored per configuration.

## Developer mode (Linux)

```bash
docker compose up --build
```

- UI: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- OpenAPI: [http://localhost:8000/docs](http://localhost:8000/docs)

Hot reload is on for both FastAPI (`--reload`) and Vite. Postgres data lives in a compose volume.

## Stack

| Layer | Choice |
| --- | --- |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic, PostgreSQL |
| Frontend | React 18, Vite, TanStack Query, React Router, React Flow, Recharts, React Three Fiber |
| Dev runtime | Docker Compose |

## Domain (short)

Every program is a **project**. Quality work items are **artifacts** (requirement, function, logical block, software/hardware component, test, CAD, KiCad, BOM, specification). **Trace links** (`satisfies`, `allocates`, `implements`, `verifies`, `validates`…) stitch the V. Quality rules emit **findings** when a requirement has no verification, a function has no allocation, a test failed, or schematic parts drift from the BOM.

## Polski

Backend jest w Pythonie (FastAPI), frontend w React. Uruchomienie deweloperskie na Linuxie: `docker compose up --build`. Rdzeniem platformy nie jest „kolejny tracker zadań”, tylko **jakość złożonego wyrobu**: czy wymaganie ma dowód, czy funkcja ma alokację, czy CAD/BOM/KiCad i testy trzymają się tego samego wątku.
