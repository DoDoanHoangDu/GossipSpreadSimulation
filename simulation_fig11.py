import random
from tqdm import tqdm
from collections import defaultdict
def get_available_nodes(graph, source, hop=1):
    if hop == 0:
        return set(graph.keys()) - {source}
    current = {source}
    visited = {source}
    available_nodes = set()
    for _ in range(hop):
        next_level = set()
        for node in current:
            neighbors = graph[node]
            available_nodes.update(neighbors)
            for neighbor in neighbors:
                if neighbor not in visited:
                    visited.add(neighbor)
                    next_level.add(neighbor)
        current = next_level
        if not current:
            break
    available_nodes.discard(source)
    return available_nodes

def simulate(graph, victim, originator, available_nodes, p=1):
    if originator not in available_nodes:
        raise ValueError("Originator not in victim neighborhood")
    victim_neighbors = graph[victim]
    remaining = set(victim_neighbors)  # not yet infected
    current = {originator}
    visited = {originator}
    time = 0
    spread_time = 0
    if originator in remaining:
        remaining.remove(originator)

    while current:
        next_level = set()
        for node in current:
            neighbors = available_nodes & graph[node]
            for neighbor in neighbors:
                if neighbor not in visited and random.random() <= p:
                    visited.add(neighbor)
                    next_level.add(neighbor)
                    if neighbor in remaining:
                        remaining.remove(neighbor)
                        spread_time = time + 1  # last infection time updates
        current = next_level
        if current:
            time += 1
    victim_degree = len(victim_neighbors)
    infected = victim_neighbors - remaining
    spread_factor = len(infected) / victim_degree if victim_degree > 0 else 0
    total_factor = len(visited) / len(available_nodes) if available_nodes else 0

    return spread_time, spread_factor, time, total_factor

def run_simulation_by_k(graph, hop=1, p=1):
    data_by_k = defaultdict(lambda: defaultdict(list))
    for victim, victim_node in graph.items():
        available_nodes = get_available_nodes(graph, victim, hop=hop)
        for originator in victim_node:
            data = simulate(graph, victim, originator, available_nodes, p)
            spread_time, spread_factor, time, total_factor = data[0], data[1], data[2], data[3]
            k = len(victim_node)
            data_by_k[k]["spread_time"].append(spread_time)
            data_by_k[k]["spread_factor"].append(spread_factor)
            data_by_k[k]["total_factor"].append(total_factor)
            data_by_k[k]["time"].append(time)
    return to_dict(data_by_k)

import pickle
import os
def load_graphs(path):
    with open(path, "rb") as f:
        data = pickle.load(f)
    return data

def save_results(results, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(results, f)

def to_dict(obj):
    if isinstance(obj, defaultdict):
        return {k: to_dict(v) for k, v in obj.items()}
    return obj

from multiprocessing import Pool
def process_graph(graph):
    return run_simulation_by_k(graph, hop=0)

def merge_result(result, graph_result):
    for k, metrics in graph_result.items():
        for metric, values in metrics.items():
            result[k][metric].extend(values)

size = 1
if __name__ == "__main__":
    with Pool() as pool:
        for m in [3, 5, 9]:
            outfile = f"fig_data/fig11/fig11_m{m:02d}.pkl"
            if os.path.exists(outfile):
                continue
            result = defaultdict(lambda: defaultdict(list))
            BA_path = f"data/ba/ba_network_m{m:02d}_N{size:03d}K.pkl"
            BA_graphs = load_graphs(BA_path)
            print(f"Running simulation for m={m}")
            for graph_result in tqdm(
                pool.imap_unordered(
                    process_graph,
                    BA_graphs,
                    chunksize=1,
                ),
                total=len(BA_graphs),
                desc=f"m={m}",
            ):
                merge_result(result, graph_result)

            save_results(to_dict(result), outfile)
            del BA_graphs
            del result