import os
import networkx as nx
from tqdm import tqdm
import pickle

def load_graphs(path):
    with open(path, "rb") as f:
        data = pickle.load(f)
    return data

def save_results(results, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(results, f)

def compute_graph_metrics(graph):
    G = nx.Graph(graph)
    C = nx.average_clustering(G)
    L = nx.average_shortest_path_length(G)
    return C, L

from multiprocessing import Pool
def process_graph(graph):
    result = compute_graph_metrics(graph)
    return result

size = 10
if __name__ == "__main__":
    with Pool() as pool:
        for p in range(20):
            outfile = f"fig_data/fig07/fig07_p{p:02d}_CL.pkl"
            if os.path.exists(outfile):
                print(f"Skipping p={p:02d} (already exists)")
                continue

            sw_graphs = load_graphs(f"data/small_world/sw_network_p{p:02d}_N{size:03d}K.pkl")

            C = []
            L = []
            for c, l in tqdm(
                pool.imap_unordered(process_graph, sw_graphs,chunksize=1),
                total=len(sw_graphs),
                desc=f"p={p:02d}",
            ):
                C.append(c)
                L.append(l)

            result = {
                "C": C,
                "L": L,
            }

            save_results(result, outfile)
            print(f"Saved {outfile}")