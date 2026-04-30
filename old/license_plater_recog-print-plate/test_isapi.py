"""
Teste SOMENTE MNPR - sem webhook
Quando aperta botao: tenta MNPR mais vezes com delay de 1s
"""
import socket
import requests
from requests.auth import HTTPDigestAuth
import os, time, re
from datetime import datetime

CAM_IP = "192.168.1.164"
SEC_IP = "192.168.1.191"
SEC_PORT = 2000
SAVE_DIR = "entrancelprimage"
os.makedirs(SAVE_DIR, exist_ok=True)

auth = HTTPDigestAuth('admin', '1524Metropole')

def read_sec_status(sock):
    try:
        sock.setblocking(False)
        for _ in range(20):
            try: sock.recvfrom(1024)
            except: break
        sock.setblocking(True)
        sock.settimeout(1.0)
        sock.sendto(bytes([0x55, 0xAA, 0x02, 0x00]), (SEC_IP, SEC_PORT))
        resp, _ = sock.recvfrom(1024)
        if len(resp) >= 8 and resp[0:2] == bytes([0x55, 0xAA]) and resp[2] == 0x02:
            return resp[7]
    except: pass
    return None

def is_button_pressed(b7):
    return not bool(b7 & 0x02)

def open_gate(sock, tempo=1):
    tempo_decimos = min(255, max(1, int(tempo * 10)))
    cmd = bytes([0x55, 0xAA, 0x03, 0x05, 0x06, 0x00, 0x00, 0x00, tempo_decimos])
    for _ in range(3):
        try:
            sock.setblocking(False)
            for _ in range(20):
                try: sock.recvfrom(1024)
                except: break
            sock.setblocking(True)
            sock.settimeout(2.0)
            sock.sendto(cmd, (SEC_IP, SEC_PORT))
            resp, _ = sock.recvfrom(1024)
            if len(resp) >= 4 and resp[0:2] == bytes([0x55, 0xAA]) and resp[2] == 0x03:
                return True
        except: time.sleep(0.3)
    return False

def request_mnpr():
    url = f"http://{CAM_IP}/ISAPI/Traffic/MNPR/channels/1?laneNo=1&OSD=1"
    try:
        r = requests.get(url, auth=auth, timeout=10)
        if r.status_code != 200: return None
        ct = r.headers.get('Content-Type', '')
        if 'boundary=' not in ct: return None
        boundary = ct.split('boundary=')[-1].strip().encode()
        parts = r.content.split(b'--' + boundary)
        plate, confidence = None, 0
        for part in parts:
            if b'\r\n\r\n' not in part: continue
            _, body = part.split(b'\r\n\r\n', 1)
            if b'<?xml' in body[:100]:
                pm = re.search(rb'<licensePlate>([^<]+)</licensePlate>', body)
                cm = re.search(rb'<confidenceLevel>([^<]+)</confidenceLevel>', body)
                if pm: plate = pm.group(1).decode()
                if cm:
                    try: confidence = float(cm.group(1).decode())
                    except: pass
                ts = datetime.now().strftime('%Y%m%d_%H%M%S')
                with open(os.path.join(SAVE_DIR, f"mnpr_{ts}.xml"), 'wb') as f: f.write(body)
            elif body[:2] == b'\xff\xd8':
                ts = datetime.now().strftime('%Y%m%d_%H%M%S')
                with open(os.path.join(SAVE_DIR, f"mnpr_{ts}.jpg"), 'wb') as f: f.write(body.rstrip(b'\r\n'))
        if plate and plate.lower() != 'unknown':
            return {"plate": plate, "confidence": confidence}
    except: pass
    return None

# ============ LOOP ============
print("=== TESTE SOMENTE MNPR (sem webhook) ===")
print("Fluxo: laco -> MNPR x5 -> botao -> MNPR x3 mais -> abre")
print("Aguardando veiculo no laco... (Ctrl+C para parar)\n")

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.settimeout(2.0)
last_vehicle = False
count = 0

while True:
    try:
        b7 = read_sec_status(sock)
        if b7 is None:
            time.sleep(0.5)
            continue
        
        on_loop = not bool(b7 & 0x04)
        
        if on_loop and not last_vehicle:
            count += 1
            print(f"\n{'='*60}")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] VEICULO NO LACO! (#{count})")
            print(f"{'='*60}")
            
            plate_found = None
            gate_opened = False
            
            # FASE 1: Tenta MNPR 5 vezes com delay de 1s
            for attempt in range(1, 6):
                print(f"  [{attempt}/5] MNPR...", end=" ")
                mnpr = request_mnpr()
                if mnpr:
                    plate_found = mnpr
                    print(f">>> PLACA: {mnpr['plate']} (conf={mnpr['confidence']}%)")
                    break
                else:
                    print("sem placa")
                
                # Checa botao entre tentativas
                b7_check = read_sec_status(sock)
                if b7_check is not None and is_button_pressed(b7_check):
                    print(f"\n  [BOTAO] Pressionado! Tentando MNPR mais 3 vezes...")
                    
                    # FASE 2: Botao apertado - tenta mais 3 vezes com 1s delay
                    for extra in range(1, 4):
                        time.sleep(1)
                        print(f"  [EXTRA {extra}/3] MNPR...", end=" ")
                        mnpr = request_mnpr()
                        if mnpr:
                            plate_found = mnpr
                            print(f">>> PLACA: {mnpr['plate']} (conf={mnpr['confidence']}%)")
                            break
                        else:
                            print("sem placa")
                    
                    # Abre cancela (com ou sem placa)
                    if plate_found:
                        print(f"\n  +==================+")
                        print(f"  | PLACA: {plate_found['plate']:>9s} |")
                        print(f"  | CONF:  {plate_found['confidence']:>8.0f}% |")
                        print(f"  +==================+")
                        print(f"  Abrindo cancela COM placa...")
                    else:
                        print(f"\n  Abrindo cancela SEM placa (botao manual)...")
                    
                    if open_gate(sock):
                        print(f"  >>> CANCELA ABERTA!")
                        gate_opened = True
                    break
                
                time.sleep(1)  # Delay 1s entre MNPR
            
            # Se achou placa nas 5 primeiras tentativas
            if plate_found and not gate_opened:
                print(f"\n  +==================+")
                print(f"  | PLACA: {plate_found['plate']:>9s} |")
                print(f"  | CONF:  {plate_found['confidence']:>8.0f}% |")
                print(f"  +==================+")
                print(f"  Abrindo cancela COM placa...")
                if open_gate(sock):
                    print(f"  >>> CANCELA ABERTA!")
                    gate_opened = True
            
            # Se nao achou placa, abre cancela SEM placa
            if not gate_opened and not plate_found:
                print(f"\n  !! MNPR NAO DETECTOU - ABRINDO SEM PLACA !!")
                if open_gate(sock):
                    print(f"  >>> CANCELA ABERTA! (sem placa)")
                    gate_opened = True
            
            status = "ABERTA" if gate_opened else "NAO ABERTA (timeout)"
            print(f"\n  [{status}]\n")
        
        last_vehicle = on_loop
    
    except socket.timeout: pass
    except KeyboardInterrupt:
        print(f"\nParado. Total: {count}")
        break
    except Exception as e:
        print(f"Erro: {e}")
    
    time.sleep(0.2)

sock.close()
