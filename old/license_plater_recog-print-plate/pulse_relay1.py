"""Pulso rele 1 da SEC 199.
Liga com B0=0x06 tempo=2, desliga com B0=0x02.
"""
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

def drain():
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

def send(cmd, desc):
    drain()
    sock.sendto(cmd, (SEC_IP, SEC_PORT))
    try:
        r, _ = sock.recvfrom(1024)
        print(f"  {desc}: {' '.join(f'{b:02X}' for b in r)}")
    except socket.timeout:
        print(f"  {desc}: timeout")

# ON: liga rele 1 (B0=0x06, tempo=2 = 200ms)
CMD_ON = bytes([0x55, 0xAA, 0x03, 0x05, 0x06, 0x00, 0x00, 0x00, 0x02])
# OFF: desliga rele 1 (B0=0x02)
CMD_OFF = bytes([0x55, 0xAA, 0x03, 0x05, 0x02, 0x00, 0x00, 0x00, 0x00])

print(">>> PULSO rele 1 <<<")
send(CMD_ON, "LIGA (200ms)")
time.sleep(0.3)
send(CMD_OFF, "DESLIGA    ")
print("Pronto!")

sock.close()
