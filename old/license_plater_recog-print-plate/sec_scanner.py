"""
sec_scanner.py — Compara SEC ENTRADA (191) vs SEC SAIDA (199).

Le as duas SECs ao mesmo tempo com CMD 0x02.
Mostra todos os bytes lado a lado.
Quando carro passar no laco de QUALQUER uma, mostra qual mudou.
"""

import socket
import time
import sys
from datetime import datetime

SEC_ENTRADA_IP = "192.168.1.191"
SEC_SAIDA_IP = "192.168.1.199"
SEC_PORT = 2000

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass


def read_sec(sock, ip):
    """Le uma SEC e retorna resposta ou None."""
    try:
        cmd = bytes([0x55, 0xAA, 0x02, 0x00])
        sock.sendto(cmd, (ip, SEC_PORT))
        try:
            resp, _ = sock.recvfrom(1024)
            return resp
        except socket.timeout:
            return None
    except:
        return None


def main():
    print("=" * 80)
    print("  COMPARACAO SEC ENTRADA (191) vs SEC SAIDA (199)")
    print("  Apenas CMD 0x02 (leitura segura)")
    print("=" * 80)
    print()

    sock_e = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock_e.settimeout(0.3)
    sock_s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock_s.settimeout(0.3)

    # Primeira leitura de cada
    resp_e = read_sec(sock_e, SEC_ENTRADA_IP)
    resp_s = read_sec(sock_s, SEC_SAIDA_IP)

    if resp_e:
        hex_e = " ".join(f"{b:02X}" for b in resp_e)
        print(f"  ENTRADA (191): {hex_e}")
        for i, b in enumerate(resp_e):
            print(f"    byte[{i}] = 0x{b:02X} ({b:08b})")
    else:
        print("  ENTRADA (191): SEM RESPOSTA")

    print()

    if resp_s:
        hex_s = " ".join(f"{b:02X}" for b in resp_s)
        print(f"  SAIDA   (199): {hex_s}")
        for i, b in enumerate(resp_s):
            print(f"    byte[{i}] = 0x{b:02X} ({b:08b})")
    else:
        print("  SAIDA   (199): SEM RESPOSTA")

    print()
    print("=" * 80)
    print("  Monitorando as duas... coloque carro no laco")
    print("  Mostra MUDANCA quando byte muda (ignorando oscilacao conhecida)")
    print("=" * 80)
    print()

    prev_e = resp_e
    prev_s = resp_s
    baseline_e = resp_e
    baseline_s = resp_s
    reading = 0

    # Salva CSV
    f = open("scan_log.csv", "w", encoding="utf-8")
    if resp_e and resp_s:
        cols_e = [f"e_b{i}" for i in range(len(resp_e))]
        cols_s = [f"s_b{i}" for i in range(len(resp_s))]
        f.write(f"timestamp,{','.join(cols_e)},{','.join(cols_s)}\n")

    try:
        while True:
            reading += 1
            now = datetime.now().strftime("%H:%M:%S.%f")[:-3]

            resp_e = read_sec(sock_e, SEC_ENTRADA_IP)
            resp_s = read_sec(sock_s, SEC_SAIDA_IP)

            # Salva CSV
            if resp_e and resp_s:
                vals = [str(b) for b in resp_e] + [str(b) for b in resp_s]
                f.write(f"{now},{','.join(vals)}\n")

            # Mostra estado compacto
            he = " ".join(f"{b:02X}" for b in resp_e) if resp_e else "TIMEOUT"
            hs = " ".join(f"{b:02X}" for b in resp_s) if resp_s else "TIMEOUT"

            # Checa mudancas significativas (ignora nada, mostra TUDO que muda)
            changes_e = []
            changes_s = []

            if resp_e and prev_e and len(resp_e) == len(prev_e):
                for i in range(len(resp_e)):
                    if resp_e[i] != prev_e[i]:
                        changes_e.append(f"b{i}:0x{prev_e[i]:02X}->0x{resp_e[i]:02X}")

            if resp_s and prev_s and len(resp_s) == len(prev_s):
                for i in range(len(resp_s)):
                    if resp_s[i] != prev_s[i]:
                        changes_s.append(f"b{i}:0x{prev_s[i]:02X}->0x{resp_s[i]:02X}")

            if changes_e or changes_s:
                line = f"[{now}] #{reading:>5}"
                if changes_e:
                    line += f" | ENTRADA: {', '.join(changes_e)}"
                if changes_s:
                    line += f" | SAIDA: {', '.join(changes_s)}"
                print(line)
            else:
                print(f"[{now}] #{reading:>5} | E:{he} | S:{hs}", end="\r")

            prev_e = resp_e
            prev_s = resp_s
            time.sleep(0.1)

    except KeyboardInterrupt:
        print(f"\n\nTotal: {reading} leituras")
    finally:
        f.close()
        sock_e.close()
        sock_s.close()


if __name__ == "__main__":
    main()
