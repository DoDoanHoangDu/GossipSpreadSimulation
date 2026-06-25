Download link for graph data and simulation data:
[Google Drive](https://drive.google.com/drive/folders/1ycl2PFMzuPCCyr5JOb1ptD4NaBN_UfUi?usp=drive_link)

## Interactive demo

The browser demo visualizes the same victim, originator, hop-limited neighborhood,
and probabilistic sharing model used by the simulation scripts.

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000/demo/](http://localhost:8000/demo/).

Run the simulation unit tests with:

```bash
node --test tests/simulation.test.mjs
```
