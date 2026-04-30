"""
exit_monitor.py — Monitor da SEC de saída com LPR e abertura automatica.

Fluxo:
1. Detecta carro no laço (byte[4]: 0x20=livre, 0x01=carro)
2. Captura foto da câmera de saída (192.168.1.182)
3. Envia para PlateRecognizer para detectar placa
4. Loga a placa detectada
5. Abre a cancela (relé 1)
"""

import os
import sys
import time
import json
import socket
import threading
import requests
import firebase_parking
from datetime import datetime
from requests.auth import HTTPDigestAuth

# ==================== CONFIGURAÇÃO ====================

# Flag de modo de teste: Se True, abre a cancela para todos os veículos 
# ignorando o status de pagamento (mas ainda registra a saída no Firebase).
ALWAYS_OPEN_GATE = True

# SEC de saída
SEC_IP = "192.168.1.199"
SEC_PORT = 2000

# Câmera de saída
CAM_IP = "192.168.1.182"
CAM_USER = "admin"
CAM_PASS = "1524Metropole"
SNAP_URL = f"http://{CAM_IP}/cgi-bin/snapshot.cgi"

# Diretórios
LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "exit_monitor.log")
SAVE_DIR = "captures_exit"
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(SAVE_DIR, exist_ok=True)

# API PlateRecognizer
API_KEYS_FILE = "api_keys.json"
PLATE_API_URL = "https://api.platerecognizer.com/v1/plate-reader/"
WORKING_KEY_FILE = "working_exit_key.json"  # Salva índice da última key que funcionou

SEC_WATCHDOG_TIMEOUT = 10
SEC_RECONNECT_WAIT_INITIAL = 3
SEC_RECONNECT_WAIT_MAX = 30

# Detecção: byte[4] muda de 0x20 (livre) para 0x01 (carro)
ABSENCE_TIMEOUT = 3  # Segundos sem pulso para declarar "carro saiu"
MIN_GATE_OPEN_TIME = 5  # Tempo MINIMO que a cancela fica aberta (segundos) antes de verificar sensor

POLL_INTERVAL = 0.1  # 100ms entre leituras
MAX_RECOGNITION_ATTEMPTS = 3  # Tentativas de captura+reconhecimento
CONFIDENCE_THRESHOLD = 80  # Confiança mínima para considerar placa válida (%)

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

def load_api_keys():
    """Carrega API keys do arquivo JSON."""
    if os.path.exists(API_KEYS_FILE):
        try:
            with open(API_KEYS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                keys = data.get('api_keys', [])
                if keys:
                    return keys
        except Exception as e:
            pass
    return []

def load_working_key_index():
    """Carrega o índice da última API key que funcionou."""
    if os.path.exists(WORKING_KEY_FILE):
        try:
            with open(WORKING_KEY_FILE, 'r') as f:
                data = json.load(f)
                idx = data.get('working_index', 0)
                return idx
        except:
            pass
    return 0

def save_working_key_index(idx):
    """Salva o índice da API key que está funcionando."""
    try:
        with open(WORKING_KEY_FILE, 'w') as f:
            json.dump({'working_index': idx, 'updated': datetime.now().isoformat()}, f)
    except:
        pass

API_KEYS = load_api_keys()
working_key_index = load_working_key_index()

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"{timestamp}: {message}\n"
    try:
        with open(LOG_FILE, 'a', encoding='utf-8', errors='replace') as f:
            f.write(entry)
    except:
        pass
    try:
        print(f"{timestamp}: {message}", flush=True)
    except:
        pass

def clear_socket_buffer(sock):
    """Limpa o buffer do socket removendo pacotes antigos."""
    try:
        sock.setblocking(False)
        count = 0
        while count < 10:
            try:
                sock.recvfrom(1024)
                count += 1
            except socket.error:
                break
        sock.setblocking(True)
    except:
        try:
            sock.setblocking(True)
        except:
            pass

def read_loop_sensor(sock):
    """Lê o sensor do laço de saída. Retorna: True=carro, False=livre, None=erro."""
    try:
        cmd = bytes([0x55, 0xAA, 0x02, 0x00])
        sock.sendto(cmd, (SEC_IP, SEC_PORT))
        try:
            resp, _ = sock.recvfrom(1024)
            if len(resp) >= 5 and resp[0:2] == bytes([0x55, 0xAA]) and resp[2] == 0x02:
                # byte[4]: 0x20 = sem carro, 0x01 = carro no laço
                return resp[4] != 0x20
        except socket.timeout:
            return None
    except:
        return None
    return None


class LoopSensorThread:
    """
    Thread que lê o sensor do laço de saída continuamente.
    Mantém estado atualizado que pode ser consultado pelo main loop
    a qualquer momento, sem bloquear.
    """
    def __init__(self):
        self._car_on_loop = False
        self._last_pulse_time = 0.0  # Último momento que carro foi detectado
        self._last_read_time = 0.0   # Último momento que o sensor respondeu
        self._sec_online = False
        self._lock = threading.Lock()
        self._running = False
        self._thread = None
        self._sock = None
    
    def start(self):
        """Inicia a thread de leitura do sensor."""
        self._running = True
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.settimeout(0.3)
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        log("[SENSOR-THREAD] Thread do sensor de saida iniciada")
    
    def stop(self):
        """Para a thread de leitura."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
        if self._sock:
            try:
                self._sock.close()
            except:
                pass
        log("[SENSOR-THREAD] Thread do sensor parada")
    
    def _loop(self):
        """Loop principal da thread — lê sensor continuamente."""
        while self._running:
            try:
                state = read_loop_sensor(self._sock)
                with self._lock:
                    if state is not None:
                        self._sec_online = True
                        self._last_read_time = time.time()
                        self._car_on_loop = state
                        if state:
                            self._last_pulse_time = time.time()
                    else:
                        # Timeout — SEC pode estar offline
                        if time.time() - self._last_read_time > SEC_WATCHDOG_TIMEOUT:
                            self._sec_online = False
            except Exception:
                pass
            time.sleep(POLL_INTERVAL)
    
    @property
    def car_on_loop(self):
        """Retorna True se carro está no laço agora."""
        with self._lock:
            return self._car_on_loop
    
    @property
    def last_pulse_time(self):
        """Retorna timestamp da última detecção de carro."""
        with self._lock:
            return self._last_pulse_time
    
    @property
    def sec_online(self):
        """Retorna True se a SEC está respondendo."""
        with self._lock:
            return self._sec_online
    
    @property
    def time_since_last_pulse(self):
        """Retorna segundos desde o último pulso de carro."""
        with self._lock:
            if self._last_pulse_time == 0:
                return 999
            return time.time() - self._last_pulse_time

def capture_camera_image():
    """Captura imagem da câmera de saída usando autenticação Digest."""
    try:
        response = requests.get(SNAP_URL, auth=HTTPDigestAuth(CAM_USER, CAM_PASS), timeout=3)
        if response.status_code == 200:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"exit_capture_{timestamp}.jpg"
            filepath = os.path.join(SAVE_DIR, filename)
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            log(f"[CAM-SAIDA] Foto capturada: {filename} ({len(response.content)} bytes)")
            return filepath
        else:
            log(f"[CAM-SAIDA] Erro HTTP {response.status_code} ao capturar foto")
            return None
    except Exception as e:
        log(f"[CAM-SAIDA] Erro ao capturar foto: {e}")
        return None

def recognize_plate(image_path):
    """Envia imagem para PlateRecognizer. Começa pela última key que funcionou.
    Retorna (placa, confianca%) ou (None, 0)."""
    global working_key_index
    
    if not API_KEYS:
        log("[LPR-SAIDA] Sem API keys - nao pode reconhecer placa")
        return None, 0
    
    n_keys = len(API_KEYS)
    # Começa pela key que estava funcionando
    start_idx = working_key_index if working_key_index < n_keys else 0
    
    for i in range(n_keys):
        key_idx = (start_idx + i) % n_keys
        api_key = API_KEYS[key_idx]
        
        try:
            with open(image_path, 'rb') as img_file:
                files = {'upload': img_file}
                headers = {'Authorization': f'Token {api_key}'}
                response = requests.post(PLATE_API_URL, files=files, headers=headers, timeout=15)
            
            if response.status_code in [200, 201]:
                # Key funcionou! Salva como a key ativa
                if key_idx != working_key_index:
                    working_key_index = key_idx
                    save_working_key_index(key_idx)
                    log(f"[LPR-SAIDA] API key {key_idx+1} funcionando - salva como padrao")
                
                result = response.json()
                plates = result.get('results', [])
                
                if plates:
                    best = max(plates, key=lambda p: p.get('score', 0))
                    plate_text = best.get('plate', '').upper()
                    confidence = best.get('score', 0) * 100
                    log(f"[LPR-SAIDA] Placa detectada: {plate_text} (confianca: {confidence:.1f}%)")
                    return plate_text, confidence
                else:
                    log("[LPR-SAIDA] Nenhuma placa detectada na imagem")
                    return None, 0
            elif response.status_code == 403:
                log(f"[LPR-SAIDA] API key {key_idx+1} esgotada, tentando proxima...")
                continue
            else:
                log(f"[LPR-SAIDA] Erro API HTTP {response.status_code}")
                return None, 0
        except Exception as e:
            log(f"[LPR-SAIDA] Erro na API (key {key_idx+1}): {e}")
            continue
    
    log("[LPR-SAIDA] Todas as API keys falharam")
    return None, 0

def check_firebase_session(plate_text, confidence=0, gate_opened_by="auto"):
    """
    Verifica sessão ativa no Firebase para a placa.
    Se encontrar, registra a saída de forma assíncrona (não bloqueia a cancela).
    Retorna dict com dados da sessão ou None.
    
    Args:
        plate_text: texto da placa detectada
        confidence: confiança do reconhecimento na saída (%)
        gate_opened_by: como a cancela foi aberta ("auto" | "manual")
    """
    try:
        # Normaliza a placa (sem espaços/hifens)
        plate_normalized = plate_text.replace(' ', '').replace('-', '').upper()
        
        # Busca sessão ativa
        session = firebase_parking.get_active_session(plate_normalized)
        if session:
            entry_time = session.get('entry_time')
            session_id = session.get('id', '?')
            vehicle_type = session.get('vehicle_type', 'desconhecido')
            is_authorized = session.get('is_authorized', False)
            
            log(f"[FIREBASE-SAIDA] Sessao encontrada: {session_id} | Placa: {plate_normalized} | Tipo: {vehicle_type}")
            
            # Registra saída de forma SÍNCRONA
            exit_result = firebase_parking.register_exit(
                plate_normalized,
                exit_confidence=confidence,
                exit_gate_opened_by=gate_opened_by
            )
            
            if exit_result:
                session["allow_exit"] = exit_result.get("allow_exit", False)
                session["payment_status"] = exit_result.get("payment_status", "pending")
            else:
                session["allow_exit"] = False

            log(f"[FIREBASE-SAIDA] Verificacao concluida | Placa: {plate_normalized} | Liberado: {session['allow_exit']}")
            return session
        else:
            log(f"[FIREBASE-SAIDA] Nenhuma sessao ativa para placa {plate_normalized}")
            return None
    except Exception as e:
        log(f"[FIREBASE-SAIDA] Erro ao verificar sessao: {e}")
        return None

def capture_recognize_and_verify(sock=None, sensor_thread=None):
    """
    Fluxo completo de saída:
    1. Captura foto e reconhece placa
    2. Se confiança alta (>= CONFIDENCE_THRESHOLD):
       - Verifica sessão no Firebase
       - Abre cancela (com ou sem sessão)
    3. Se confiança baixa:
       - Verifica se laço ainda ativo antes de tentar novamente
       - Tenta novamente (até MAX_RECOGNITION_ATTEMPTS)
    4. Após todas tentativas falharem:
       - Abre cancela mesmo assim
    
    Args:
        sock: Socket UDP (não usado para sensor, mantido por compatibilidade).
        sensor_thread: LoopSensorThread para verificar se o carro saiu entre tentativas.
    
    Retorna (plate_text, confidence, session) ou (None, 0, None)
    """
    for attempt in range(MAX_RECOGNITION_ATTEMPTS):
        if attempt > 0:
            # Verifica se o carro ainda está no laço antes de nova tentativa
            if sensor_thread and not sensor_thread.car_on_loop:
                log(f"[SAIDA] Carro saiu do laco antes da tentativa {attempt+1} - cancelando reconhecimento")
                return None, 0, None
            
            log(f"[SAIDA] Tentativa {attempt+1}/{MAX_RECOGNITION_ATTEMPTS} de reconhecimento...")
            time.sleep(1)
        
        image_path = capture_camera_image()
        if not image_path:
            log(f"[SAIDA] Falha na captura da foto (tentativa {attempt+1}/{MAX_RECOGNITION_ATTEMPTS})")
            continue
        
        plate_text, confidence = recognize_plate(image_path)
        
        if plate_text and confidence >= CONFIDENCE_THRESHOLD:
            # Confiança alta — verifica Firebase e fecha sessão
            log(f"[SAIDA] Confianca alta ({confidence:.1f}%) - verificando Firebase...")
            session = check_firebase_session(plate_text, confidence=confidence, gate_opened_by="auto")
            return plate_text, confidence, session
        
        elif plate_text:
            # Placa detectada mas confiança baixa — tenta novamente
            log(f"[SAIDA] Confianca baixa ({confidence:.1f}%) - tentando novamente...")
            continue
        else:
            # Nenhuma placa detectada
            log(f"[SAIDA] Nenhuma placa detectada (tentativa {attempt+1}/{MAX_RECOGNITION_ATTEMPTS})")
            continue
    
    # Após todas as tentativas: abre mesmo assim
    log(f"[SAIDA] {MAX_RECOGNITION_ATTEMPTS} tentativas esgotadas - abrindo cancela mesmo assim")
    return None, 0, None

def ensure_relay_off(sock):
    """
    Garante que o relé 1 está DESLIGADO.
    Envia comando OFF para resetar o estado do relé.
    """
    try:
        clear_socket_buffer(sock)
        sock.settimeout(1.0)
        # Relé 1 OFF: B0 bits 2,1,0 = 0,1,0 (desliga relé 1)
        cmd_off = bytes([0x55, 0xAA, 0x03, 0x05, 0x02, 0x00, 0x00, 0x00, 0x00])
        sock.sendto(cmd_off, (SEC_IP, SEC_PORT))
        try:
            resp, _ = sock.recvfrom(1024)
            if len(resp) >= 4 and resp[0:2] == bytes([0x55, 0xAA]):
                log("[SAIDA] Rele 1 garantido como DESLIGADO")
        except socket.timeout:
            log("[SAIDA] Timeout ao desligar rele 1 (pode ja estar desligado)")
        sock.settimeout(0.3)
    except Exception as e:
        log(f"[SAIDA] Erro ao desligar rele 1: {e}")
        try:
            sock.settimeout(0.3)
        except:
            pass

def open_gate(sock):
    """
    Abre a cancela de saída (relé 1) — apenas LIGA o relé.
    O relé fica ligado até close_gate() ser chamado.
    
    Retorna True se o relé foi ativado com sucesso.
    """
    cmd_open = bytes([0x55, 0xAA, 0x03, 0x05, 0x06, 0x00, 0x00, 0x00, 0x02])
    
    for attempt in range(3):
        try:
            clear_socket_buffer(sock)
            sock.settimeout(2.0)
            
            start_time = time.time()
            sock.sendto(cmd_open, (SEC_IP, SEC_PORT))
            
            try:
                resp, _ = sock.recvfrom(1024)
                response_time = (time.time() - start_time) * 1000
                if len(resp) >= 4 and resp[0:2] == bytes([0x55, 0xAA]) and resp[2] == 0x03:
                    log(f"[CANCELA-SAIDA] RELE LIGADO - CANCELA ABERTA ({response_time:.0f}ms)")
                    sock.settimeout(0.3)
                    return True
                else:
                    log(f"[CANCELA-SAIDA] Resposta invalida tentativa {attempt+1}/3")
            except socket.timeout:
                log(f"[CANCELA-SAIDA] Timeout tentativa {attempt+1}/3")
        except Exception as e:
            log(f"[CANCELA-SAIDA] Erro tentativa {attempt+1}/3: {e}")
        
        time.sleep(0.2)
    
    sock.settimeout(0.3)
    log("[CANCELA-SAIDA] FALHA ao abrir cancela apos 3 tentativas!")
    return False


def close_gate(sock):
    """
    Fecha a cancela de saída — desliga o relé 1.
    Envia o comando OFF múltiplas vezes para garantir que o relé realmente desligou.
    """
    cmd_off = bytes([0x55, 0xAA, 0x03, 0x05, 0x02, 0x00, 0x00, 0x00, 0x00])
    MAX_OFF_ATTEMPTS = 5
    confirmed = False
    
    for attempt in range(MAX_OFF_ATTEMPTS):
        try:
            clear_socket_buffer(sock)
            sock.settimeout(1.0)
            sock.sendto(cmd_off, (SEC_IP, SEC_PORT))
            try:
                resp, _ = sock.recvfrom(1024)
                if len(resp) >= 4 and resp[0:2] == bytes([0x55, 0xAA]) and resp[2] == 0x03:
                    confirmed = True
                    log(f"[CANCELA-SAIDA] RELE DESLIGADO - CANCELA FECHANDO (tentativa {attempt+1})")
                    break
            except socket.timeout:
                log(f"[CANCELA-SAIDA] Timeout ao desligar rele (tentativa {attempt+1}/{MAX_OFF_ATTEMPTS})")
        except Exception as e:
            log(f"[CANCELA-SAIDA] Erro ao desligar rele (tentativa {attempt+1}): {e}")
        time.sleep(0.2)
    
    if not confirmed:
        # Última tentativa de emergência: envia 3 vezes seguidas sem esperar resposta
        log("[CANCELA-SAIDA] ALERTA: Rele nao confirmou desligamento - enviando comandos de emergencia")
        for _ in range(3):
            try:
                sock.sendto(cmd_off, (SEC_IP, SEC_PORT))
                time.sleep(0.1)
            except:
                pass
    
    try:
        sock.settimeout(0.3)
    except:
        pass

def monitor_exit():
    log("[SAIDA] Monitor de saida iniciado")
    log(f"[SAIDA] SEC: {SEC_IP}:{SEC_PORT} | Sensor: byte[4] (0x20=livre, 0x01=carro)")
    log(f"[SAIDA] Abertura automatica: rele 1 (ligado ate carro sair do laco)")
    log(f"[SAIDA] Confianca minima: {CONFIDENCE_THRESHOLD}% | Tentativas: {MAX_RECOGNITION_ATTEMPTS}")
    
    # Inicializa Firebase
    try:
        firebase_parking.init_firestore()
        log("[SAIDA] Firebase inicializado para verificacao de sessoes")
    except Exception as e:
        log(f"[SAIDA] AVISO: Firebase nao inicializado: {e}")
    log(f"[SAIDA] Timeout de ausencia: {ABSENCE_TIMEOUT}s")
    
    # Inicia thread do sensor (socket dedicado, lê continuamente)
    sensor = LoopSensorThread()
    sensor.start()
    
    # Socket separado para comandos de relé
    cmd_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    cmd_sock.settimeout(0.3)
    
    confirmed_on_loop = False
    car_enter_time = None
    total_detections = 0
    last_gate_open_time = 0
    gate_is_open = False
    
    try:
        log("[SAIDA] Monitorando laco de saida (sensor em thread separada)...")
        
        while True:
            try:
                car_present = sensor.car_on_loop
                sec_ok = sensor.sec_online
                
                if not sec_ok:
                    time.sleep(0.5)
                    continue
                
                if car_present:
                    if not confirmed_on_loop:
                        confirmed_on_loop = True
                        car_enter_time = time.time()
                        total_detections += 1
                        gate_is_open = False
                        log(f"[SAIDA] >>> VEICULO NO LACO DE SAIDA <<< (deteccao #{total_detections})")
                        
                        # 1) Captura foto e reconhece placa
                        # (sensor continua lendo em background durante todo este processo)
                        plate_text, confidence, session = capture_recognize_and_verify(cmd_sock, sensor_thread=sensor)
                        
                        # 2) Determina tipo do veículo
                        if plate_text:
                            if session:
                                vtype = session.get('vehicle_type', 'desconhecido').upper()
                                owner = session.get('owner_name', '')
                                is_auth = session.get('is_authorized', False)
                                tipo_label = f"{vtype}" + (f" ({owner})" if owner else "")
                                cadastro = "CADASTRADO" if is_auth else "VISITANTE"
                            else:
                                tipo_label = "---"
                                cadastro = "SEM CADASTRO"
                        
                        # 3) Abre cancela
                        allow_gate = False
                        status_label = "SEM SESSAO"
                        if session:
                            allow_gate = session.get("allow_exit", False)
                            status_label = session.get("payment_status", "pending")
                        else:
                            # Tenta abrir fallback? Não, bloqueia sem sessão para forçar cadastro
                            allow_gate = False
                        
                        # OVERRIDE: Modo de teste
                        if ALWAYS_OPEN_GATE:
                            allow_gate = True
                            status_label += " (FORCED OPEN)"
                        
                        if allow_gate:
                            log(f"[SAIDA] Abrindo cancela de saida... (Pagamento: {status_label})")
                            if open_gate(cmd_sock):
                                gate_is_open = True
                                last_gate_open_time = time.time()
                                if plate_text:
                                    log(f"")
                                    log(f"╔══════════════════════════════════════════════╗")
                                    log(f"║   PLACA SAIDA:  {plate_text:^20s}       ║")
                                    log(f"║   CONFIANCA:    {confidence:>5.1f}%                    ║")
                                    log(f"║   TIPO:         {cadastro:<28s} ║")
                                    if session:
                                        log(f"║   VEICULO:      {tipo_label:<28s} ║")
                                        log(f"║   SESSAO:       FINALIZADA                ║")
                                    else:
                                        log(f"║   SESSAO:       NAO ENCONTRADA            ║")
                                    log(f"╚══════════════════════════════════════════════╝")
                                    log(f"")
                                else:
                                    log(f"[SAIDA] Cancela aberta (placa nao identificada)")
                            else:
                                log(f"[SAIDA] ERRO: Falha ao abrir cancela de saida!")
                        else:
                            log(f"[SAIDA] BLOQUEADO: Veiculo nao liberado (Status: {status_label}). Aguardando pagamento.")
                            time.sleep(2) # Pequeno atraso para não floodar LPR enquanto o carro está parado
                
                else:  # Sensor livre
                    if confirmed_on_loop:
                        time_since_gate = time.time() - last_gate_open_time if gate_is_open else 999
                        time_since_pulse = sensor.time_since_last_pulse
                        
                        # Proteção mínima contra falso negativo logo após abrir
                        if gate_is_open and time_since_gate < MIN_GATE_OPEN_TIME:
                            pass
                        elif time_since_pulse >= ABSENCE_TIMEOUT:
                            # Carro confirmado como ausente pelo sensor thread
                            confirmed_on_loop = False
                            duration = time.time() - car_enter_time if car_enter_time else 0
                            log(f"[SAIDA] Veiculo saiu do laco ({duration:.1f}s no laco)")
                            
                            if gate_is_open:
                                close_gate(cmd_sock)
                                gate_is_open = False
                                log(f"[SAIDA] Cancela fechada - veiculo passou")
                
                time.sleep(POLL_INTERVAL)
            
            except KeyboardInterrupt:
                log(f"[SAIDA] Parando... Total deteccoes: {total_detections}")
                break
            except Exception as e:
                log(f"[SAIDA] Erro: {e}")
                time.sleep(1)
    finally:
        # Para a thread do sensor
        sensor.stop()
        
        # Garante que o relé é desligado ao encerrar
        for shutdown_attempt in range(3):
            try:
                try:
                    cmd_sock.fileno()
                except:
                    cmd_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    cmd_sock.settimeout(1.0)
                
                close_gate(cmd_sock)
                log(f"[SAIDA] Rele desligado no encerramento (tentativa {shutdown_attempt+1})")
                break
            except Exception as e:
                log(f"[SAIDA] Erro ao desligar rele no encerramento (tentativa {shutdown_attempt+1}): {e}")
                try:
                    cmd_sock.close()
                except:
                    pass
                cmd_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                cmd_sock.settimeout(1.0)
                time.sleep(0.3)
        
        try:
            cmd_sock.close()
        except:
            pass
        log("[SAIDA] Encerrado.")


if __name__ == "__main__":
    try:
        monitor_exit()
    except KeyboardInterrupt:
        log("[SAIDA] Interrompido")
    except Exception as e:
        log(f"[FATAL] {e}")
