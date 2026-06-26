Download link for graph data and simulation data:
[Google Drive](https://drive.google.com/drive/folders/1ycl2PFMzuPCCyr5JOb1ptD4NaBN_UfUi?usp=drive_link)

## Interactive demo

The browser demo visualizes the same victim, originator, hop-limited neighborhood,
and probabilistic sharing model used by the simulation scripts.

Supported demo networks:

- Small-world
- Scale-free
- Apollonian
- Erdős–Rényi random
- School community 01

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000/demo/](http://localhost:8000/demo/).

The demo starts automatically when the `Auto-run` toggle is enabled. Turn it off
or press `Pause` if you want to inspect the network round by round.

Run the simulation unit tests with:

```bash
node --test tests/simulation.test.mjs
```
