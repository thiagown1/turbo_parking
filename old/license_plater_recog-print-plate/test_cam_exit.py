import time
import requests
from requests.auth import HTTPDigestAuth

CAM_IP = "192.168.1.182"
URL = f"http://{CAM_IP}/cgi-bin/snapshot.cgi"
USER = "admin"
PASS = "1524Metropole"

print("Testando latencia da camera de saida (5 capturas)...\n")

for i in range(5):
    start = time.time()
    r = requests.get(URL, auth=HTTPDigestAuth(USER, PASS), timeout=10)
    elapsed = time.time() - start
    print(f"Captura {i+1}: {elapsed*1000:.0f}ms | Status: {r.status_code} | Size: {len(r.content)} bytes")
    time.sleep(0.5)

print("\nDone.")
