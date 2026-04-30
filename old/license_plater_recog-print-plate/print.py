import socket
import time
import sys
from datetime import datetime

# Configuração de encoding para Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

PRINTER_IP = "192.168.1.191"
PRINTER_PORT = 2000
PRINTER_TIMEOUT = 5

def log(message, level="INFO"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    prefix = {"SUCCESS": "[OK]", "WARNING": "[AVISO]", "ERROR": "[ERRO]"}.get(level, "[INFO]")
    print(f"[{timestamp}] {prefix} {message}", flush=True)

def _send(sock, payload: bytes, delay: float = 0.15):
    sock.send(payload)
    time.sleep(delay)

def escpos_set_density(n: int = 0x06) -> bytes:
    # 0x1D 0x7C n  (GS | n)  -> +25% = 0x06
    return bytes([0x1D, 0x7C, n])

def escpos_align_center() -> bytes:
    return b"\x1B\x61\x01"  # ESC a 1

def escpos_align_left() -> bytes:
    return b"\x1B\x61\x00"  # ESC a 0

def escpos_text_double() -> bytes:
    return b"\x1B\x21\x30"  # ESC ! (double height+width)

def escpos_text_normal() -> bytes:
    return b"\x1B\x21\x00"  # ESC ! 0

def escpos_barcode_ean13(data12_or_13digits: str) -> bytes:
    # HRI abaixo + Font A + altura 120 dots (~15mm) + imprime EAN13 (Format 2, m=0x43)
    # GS H n
    out = bytearray()
    out += bytes([0x1D, 0x48, 0x02])  # HRI below
    out += bytes([0x1D, 0x66, 0x00])  # Font A
    out += bytes([0x1D, 0x68, 0x3C])  # Height = 0x3C (60 dots)
    # GS k m n [d...]
    digits = data12_or_13digits.strip()
    payload = digits.encode("ascii", errors="ignore")
    out += bytes([0x1D, 0x6B, 0x43, len(payload)]) + payload
    out += b"\n"
    return bytes(out)

def escpos_qr_model2(module_size: int, ecc: str, text: str) -> bytes:
    """
    QR Model 2:
      Fn165: 1D 28 6B 04 00 31 41 n1 n2  (n1=0x32 model2, n2=0x00)
      Fn166: auto version (n=0x00)
      Fn167: module size (n=0x02..0x18)
      Fn169: ECC (AUTO=0x30, L=0x31, M=0x32, Q=0x33, H=0x34)
      Fn180: store data
      Fn181: print
    """
    ecc_map = {"AUTO": 0x30, "L": 0x31, "M": 0x32, "Q": 0x33, "H": 0x34}
    ecc_n = ecc_map.get(ecc.upper(), 0x32)

    ms = max(0x02, min(0x18, int(module_size)))
    data = text.encode("ascii", errors="replace")

    out = bytearray()

    # Fn165 - encoding scheme: model 2
    out += bytes([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00])

    # Fn166 - version auto
    out += bytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x42, 0x00])

    # Fn167 - module size
    out += bytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, ms])

    # Fn169 - error correction level
    out += bytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, ecc_n])

    # Fn180 - store
    # pL pH = len(data) + 3 (porque "31 50 31" conta 3 bytes)
    total = len(data) + 3
    pL = total & 0xFF
    pH = (total >> 8) & 0xFF
    out += bytes([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x31]) + data

    # Fn181 - print
    out += bytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x31])

    out += b"\n"
    return bytes(out)

def print_test_ticket(plate_text: str):
    ticket_id = "TS-TEST-0001"
    barcode_digits = "123456789012"  # EAN13: 12 ou 13 dígitos
    qr_payload = f"TICKET={ticket_id}|PLATE={plate_text}|TS={datetime.now().isoformat(timespec='seconds')}"

    log(f"[PRINTER] Ticket teste: plate={plate_text}", "SUCCESS")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(PRINTER_TIMEOUT)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sock.connect((PRINTER_IP, PRINTER_PORT))

        # (opcional) drenar lixo do conversor
        sock.setblocking(False)
        try:
            sock.recv(4096)
        except:
            pass
        sock.setblocking(True)

        # INIT + DENSITY (+25%)
        _send(sock, b"\x1B\x40", 0.20)               # ESC @
        _send(sock, escpos_set_density(0x08), 0.20)  # GS | 0x08  (+50% max)
        # Aumenta area de impressao para puxar conteudo pra esquerda
        _send(sock, bytes([0x1D, 0x57, 0x00, 0x02]), 0.05)  # GS W = 512 dots

        # CABECALHO
        _send(sock, escpos_align_center(), 0.05)
        _send(sock, b"METROPOLE\n", 0.05)

        # DADOS (centralizado)
        now_str = datetime.now().strftime("%d/%m/%y %H:%M")
        _send(sock, f"{now_str}\n".encode("ascii", "replace"), 0.05)
        _send(sock, escpos_text_double(), 0.05)
        _send(sock, f"{plate_text}\n".encode("ascii", "replace"), 0.05)
        _send(sock, escpos_text_normal(), 0.05)

        # QR CODE
        _send(sock, b"\n", 0.05)
        _send(sock, escpos_qr_model2(module_size=5, ecc="M", text=qr_payload), 0.30)

        # BARCODE (compacto)
        _send(sock, escpos_barcode_ean13(barcode_digits), 0.20)

        # CORTE + APRESENTACAO (Custom VKP II)
        _send(sock, b"\x1B\x69", 0.20)                # ESC i - corte do papel
        # Ejetar papel cortado (envia varias vezes para cuspir mais)
        _send(sock, bytes([0x1D, 0x65, 0x05, 0xFF]), 0.30)  # GS e 5 255 - ejetar
        _send(sock, bytes([0x1D, 0x65, 0x05, 0xFF]), 0.30)  # GS e 5 255 - ejetar mais
        _send(sock, bytes([0x1D, 0x65, 0x05, 0xFF]), 0.30)  # GS e 5 255 - ejetar mais

        time.sleep(2.0)
        sock.close()

        log("[PRINTER] Ticket teste impresso com sucesso.", "SUCCESS")
        return True

    except Exception as e:
        log(f"[PRINTER] Erro ao imprimir: {e}", "WARNING")
        return False

if __name__ == "__main__":
    plate = sys.argv[1] if len(sys.argv) > 1 else "TEST-1234"
    print_test_ticket(plate)