"""Analisa scan_log.csv mostrando a media de CADA byte por segundo."""
import csv

data = {}  # {segundo: {byte_idx: [valores]}}

with open("scan_log.csv", "r") as f:
    reader = csv.reader(f)
    next(reader)  # skip header
    for row in reader:
        if len(row) < 9:
            continue
        ts = row[0][:8]  # HH:MM:SS
        if ts not in data:
            data[ts] = {i: [] for i in range(8)}
        for i in range(8):
            data[ts][i].append(int(row[1 + i]))

print(f"{'Segundo':<10} | {'b3':>5} | {'b4':>5} | {'b5':>5} | {'b6':>5} | {'b7':>5} | {'N':>3} | Nota")
print("-" * 75)

prev_avgs = None
for ts in sorted(data.keys()):
    n = len(data[ts][0])
    avgs = {i: sum(data[ts][i]) / n for i in range(8)}
    
    nota = ""
    if prev_avgs:
        for i in [3, 4, 5, 6, 7]:
            diff = abs(avgs[i] - prev_avgs[i])
            if diff > 5:
                nota += f" b{i}:{prev_avgs[i]:.0f}->{avgs[i]:.0f}"
    
    if nota:
        nota = " *** MUDOU:" + nota + " ***"
    
    prev_avgs = avgs
    print(f"{ts:<10} | {avgs[3]:>5.1f} | {avgs[4]:>5.1f} | {avgs[5]:>5.1f} | {avgs[6]:>5.1f} | {avgs[7]:>5.1f} | {n:>3} |{nota}")
