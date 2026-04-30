"""Teste: TIMED abre + B0=0x04 para fechar (invertido!)."""
import socket
import time
import sys

SEC_IP = "192.168.1.199"
SEC_PORT = 2000

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.settimeout(2.0)

def clear_buffer(sock):
    try:
        sock.setblocking(False)
        for _ in range(20):
            try:
                sock.recvfrom(1024)
            except socket.error:
                break
        sock.setblocking(True)
        sock.settimeout(2.0)
    except:
        sock.setblocking(True)
        sock.settimeout(2.0)

def send(sock, cmd, desc):
    clear_buffer(sock)
    sock.sendto(cmd, (SEC_IP, SEC_PORT))
    try:
        r, _ = sock.recvfrom(1024)
        print(f"  {desc}: {' '.join(f'{b:02X}' for b in r)}", flush=True)
    except socket.timeout:
        print(f"  {desc}: timeout", flush=True)

# TIMED abre a cancela
CMD_OPEN = bytes([0x55, 0xAA, 0x03, 0x05, 0x06, 0x00, 0x00, 0x00, 10])
# B0=0x04 parece desligar (resposta mostra 00)
CMD_CLOSE_A = bytes([0x55, 0xAA, 0x03, 0x05, 0x04, 0x00, 0x00, 0x00, 0x00])
# B0=0x02 original OFF
CMD_CLOSE_B = bytes([0x55, 0xAA, 0x03, 0x05, 0x02, 0x00, 0x00, 0x00, 0x00])

print("=" * 55)
print("  TESTE - TIMED + desligar com B0=0x04")
print("  Nenhum comando ate ENTER")
print("=" * 55)

while True:
    print("\n  1 = Abrir (TIMED) + fechar com B0=0x04")
    print("  2 = Abrir (TIMED) + fechar com B0=0x02")
    print("  3 = So fechar B0=0x04")
    print("  4 = So fechar B0=0x02")
    print("  q = Sair")
    resp = input("  > ").strip().lower()
    
    if resp == 'q':
        break
    elif resp == '1':
        print("  >>> ABRINDO (TIMED)...", flush=True)
        send(sock, CMD_OPEN, "ABRIR")
        print("  Esperando 1s...", flush=True)
        time.sleep(1)
        print("  >>> FECHANDO (B0=0x04)...", flush=True)
        send(sock, CMD_CLOSE_A, "FECHAR-0x04")
    elif resp == '2':
        print("  >>> ABRINDO (TIMED)...", flush=True)
        send(sock, CMD_OPEN, "ABRIR")
        print("  Esperando 1s...", flush=True)
        time.sleep(1)
        print("  >>> FECHANDO (B0=0x02)...", flush=True)
        send(sock, CMD_CLOSE_B, "FECHAR-0x02")
    elif resp == '3':
        print("  >>> FECHANDO (B0=0x04)...", flush=True)
        send(sock, CMD_CLOSE_A, "FECHAR-0x04")
    elif resp == '4':
        print("  >>> FECHANDO (B0=0x02)...", flush=True)
        send(sock, CMD_CLOSE_B, "FECHAR-0x02")

sock.close()
print("  Encerrado.")
