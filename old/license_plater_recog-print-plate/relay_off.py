"""Desliga o rele 1 da SEC 199 - tenta varios comandos."""
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

commands = [
    ("OFF B0=0x04", bytes([0x55, 0xAA, 0x03, 0x05, 0x04, 0x00, 0x00, 0x00, 0x00])),
    ("OFF B0=0x02", bytes([0x55, 0xAA, 0x03, 0x05, 0x02, 0x00, 0x00, 0x00, 0x00])),
    ("OFF B0=0x00", bytes([0x55, 0xAA, 0x03, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00])),
]

print("Desligando rele 1...")
for desc, cmd in commands:
    sock.sendto(cmd, (SEC_IP, SEC_PORT))
    try:
        r, _ = sock.recvfrom(1024)
        hex_str = " ".join(f"{b:02X}" for b in r)
        print(f"  {desc}: {hex_str}")
    except socket.timeout:
        print(f"  {desc}: timeout")
    time.sleep(0.3)

sock.close()
print("Pronto.")
