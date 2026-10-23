# Open Quality Guardian

A quality-planning platform for **complex products**: requirements, functions, logical and physical design, installations plans, deploments plans, CADs specification, BOMs, KiCad schemas or PCBs, tests pyramid and reports on one digital thread.

Inspired by `RFLP` methodology and `V-model` views, but aimed at product owners and program managers as much as systems engineers. 
Details stay visible; quality is the product.

This project multidisciplinary paradigms from systems engineering and support both: software and hardware enginering.
Those components are typical for complex projects, I think :-)

## Compose the product, then prove it (R-F-L-P-V kind of methodology!)

Inside this project, you can use wizard for add all records on top of V-model. 
Yes, I know that "V-model" is oldschool and i.e. "Scrum" / "Agile" is "better", of course ;-)

Here you can see, what kind of concepts are necessery to define most of complex products (please remember product, not only independent project/s or dashboard/s with availiable tickets to grab by team!):

### R - Requirements
Capture customer features and system / software / hardware requirements, then hang them on the left of the V.

### F - Functional
Describe product behaviour as functions and swimlane diagrams a program manager can read.

### L - Logical
Allocate functions to sense, compute and actuate — still independent of a specific chip or class.

### P - Physical
Name the software and hardware that will actually be built, including CAD and electronics later.

### V - Verification
Close the V: a test, a station, a verdict, linked back to what it proves.

## What you get

- **Systems engineering V-model** — stakeholder needs through software and hardware design, each station paired with verification or validation.
- **RFLP viewpoints** — Requirements, Functional, Logical, Physical, with trees a non-SysML reader can follow.
- **Functional diagrams** — swimlane activity models (React Flow) for product features.
- **Traceability** — coverage and “links missing” between needs, architecture and tests.
- **Artifact studio** — BOM, KiCad schematic/PCB metadata, CAD facts, 3D visualization, product specification.
- **Quality cockpit & reports** — score, gaps, failed tests, owners, V-station health.
- **Configuration dictionary** — variants and named SKUs filter requirements, BOM and tests together (150% vs 100%), with quality scored per configuration.

## How it's looks like - you think oldschool, I think sky is a limit :-)

![](/assets/ss1.png)
![](/assets/ss2.png)
![](/assets/ss3.png)
![](/assets/ss4.png)
![](/assets/ss5.png)
![](/assets/ss6.png)
![](/assets/ss7.png)
![](/assets/ss8.png)
![](/assets/ss9.png)


## Developer mode & how to run on Linux OS?

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

The backend is built with Python (FastAPI), and the frontend with React. To run the development environment on Linux, use: `docker compose up --build`. The core of the platform is not "just another task tracker," but rather the quality of a complex product: ensuring that requirements have supporting evidence, functions have assigned resources, and that CAD/BOM/KiCad data and tests all remain aligned with the same underlying thread.
