import os
import sys
import time
import atexit
import json
import csv
import socket
import shutil
import re
import random
import string
import queue
import threading
import xml.etree.ElementTree as ET
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests
from datetime import datetime
from requests.auth import HTTPDigestAuth, HTTPBasicAuth
import firebase_parking

# Flag global para controle de shutdown
_shutdown_done = False

def _shutdown_set_offline():
    """Define o sistema como offline no Firebase. Chamado ao encerrar o script."""
    global _shutdown_done
    if _shutdown_done:
        return
    _shutdown_done = True
    try:
        firebase_parking.update_system_status({
            "online": False,
            "car_on_loop": False,
            "gate_open": False,
            "processing": False,
        })
        log("[FIREBASE] Sistema marcado como OFFLINE no Firebase", "SUCCESS")
    except Exception as e:
        log(f"[FIREBASE] Erro ao marcar offline: {e}", "ERROR")

# Registra handler de saída como rede de segurança
atexit.register(_shutdown_set_offline)

# Configuração de encoding para Windows
LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "sec_monitor.log")

os.makedirs(LOG_DIR, exist_ok=True)

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

def log(message, level="INFO"):
    """Função centralizada de logging com suporte a Unicode."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # Formatação visual melhorada com separadores
    if level == "SUCCESS":
        prefix = "[OK]"
    elif level == "WARNING":
        prefix = "[AVISO]"
    elif level == "ERROR":
        prefix = "[ERRO]"
    else:
        prefix = "[INFO]"
    
    log_entry = f"[{timestamp}] {prefix} {message}\n"

    try:
        with open(LOG_FILE, 'a', encoding='utf-8', errors='replace') as f:
            f.write(log_entry)
    except Exception as e:
        try:
            error_msg = f"[ERRO AO ESCREVER LOG] {e}"
            sys.stdout.buffer.write(error_msg.encode('utf-8', errors='replace'))
            sys.stdout.buffer.write(b'\n')
            sys.stdout.buffer.flush()
        except:
            pass

    try:
        print(message, flush=True)
    except UnicodeEncodeError:
        try:
            sys.stdout.buffer.write(message.encode('utf-8', errors='replace'))
            sys.stdout.buffer.write(b'\n')
            sys.stdout.buffer.flush()
        except:
            pass

def format_plate_banner(plate, confidence=None, authorized=None, source=""):
    """Formata placa com visual de placa de carro para destaque no log."""
    plate_spaced = " ".join(plate.upper())
    inner = f"  {plate_spaced}  "
    width = len(inner)
    border = "=" * width
    
    # Status
    if authorized is True:
        status = "AUTORIZADA"
        icon = "[OK]"
    elif authorized is False:
        status = "NAO AUTORIZADA"
        icon = "[!!]"
    else:
        status = ""
        icon = ""
    
    conf_str = f" | Conf: {confidence:.0f}%" if confidence else ""
    src_str = f" | Via: {source}" if source else ""
    
    lines = []
    lines.append(f"  +{border}+")
    lines.append(f"  |{inner}|")
    lines.append(f"  +{border}+")
    if status:
        lines.append(f"  {icon} {status}{conf_str}{src_str}")
    
    return "\n".join(lines)

def log_plate(plate, confidence=None, authorized=None, source=""):
    """Loga placa com visual destacado."""
    banner = format_plate_banner(plate, confidence, authorized, source)
    log(f"\n{banner}", "SUCCESS" if authorized else "WARNING" if authorized is False else "INFO")

def log_gate_result(plate=None, source=""):
    """Mostra indicador visual grande de resultado da abertura."""
    if plate:
        result = f"""
  ============================================
  ||     [OK] CANCELA ABERTA COM PLACA     ||
  ||         {plate.upper():^20}         ||
  ============================================"""
        log(result, "SUCCESS")
    else:
        result = f"""
  ############################################
  ##    [ERRO] CANCELA ABERTA SEM PLACA    ##
  ##         Placa nao detectada           ##
  ############################################"""
        log(result, "ERROR")

CAM_IP = "192.168.1.164"
CAM_USER = "admin"
CAM_PASS = "1524Metropole"
SNAP_URL = f"http://{CAM_IP}/ISAPI/Streaming/channels/1/picture"

SEC_IP = "192.168.1.191"
SEC_PORT = 2000

# ==================== MODO MOCK (teste em casa) ====================
# Use a flag --teste para ativar o modo teste:
#   - Qualquer placa identificada abre a cancela automaticamente (ignora autorizacao)
#   - Se a placa nao for reconhecida, segue o fluxo normal de retry ate identificar
MOCK_MODE = False
TEST_MODE = False  # --teste: abre cancela para QUALQUER placa identificada
MOCK_PLATE = "ABC1D23"
MOCK_CONFIDENCE = 99.8  # Confianca simulada (%)
SAVE_DIR = "captures"
RESULTS_DIR = "results"
TRAINING_DATA_DIR = "training_data"  # Dados organizados para treinamento futuro
TIMEOUT_AUTOMATIC_OPEN = 15  # Segundos para aguardar botão manual
MIN_CONFIDENCE_TO_SAVE = 99.5  # Confiança mínima (em %) para salvar fotos e dados de treinamento
COOLDOWN_AFTER_GATE_OPEN = 4  # Segundos de cooldown após abrir cancela para evitar detecções repetidas
WAIT_AFTER_GATE_OPEN = 2  # Segundos de espera após abrir cancela antes de permitir nova leitura
WAIT_BETWEEN_RECOGNITION_ATTEMPTS = 2  # Segundos de espera entre tentativas de reconhecimento
MAX_RECOGNITION_ATTEMPTS = 3  # Número máximo de tentativas para identificar placa


def generate_ticket_id():
    """Gera ticket_id no formato MTP-YYMMDDHHMMSS-XX-NN.
    Ex: MTP-260330000734-9U-44
    """
    now = datetime.now()
    timestamp = now.strftime("%y%m%d%H%M%S")
    rand_chars = ''.join(random.choices(string.ascii_uppercase + string.digits, k=2))
    rand_nums = ''.join(random.choices(string.digits, k=2))
    return f"MTP-{timestamp}-{rand_chars}-{rand_nums}"

# Placa de teste para impressao de ticket (somente esta placa imprime ticket)
# Remova ou defina como None para imprimir ticket para todos os visitantes
TEST_PRINT_PLATE = "SSG7I56"

# Configuracoes da impressora termica (mesma SEC, mas via TCP)
PRINTER_IP = "192.168.1.191"
PRINTER_PORT = 2000
PRINTER_TIMEOUT = 5
print_count = 0  # Contador de impressoes (limite 1 para teste)

# Configurações da API de Reconhecimento de Placas
API_KEYS_FILE = "api_keys.json"
PLATE_API_URL = "https://api.platerecognizer.com/v1/plate-reader/"

def load_api_keys():
    """Carrega API keys do arquivo JSON."""
    if os.path.exists(API_KEYS_FILE):
        try:
            with open(API_KEYS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                keys = data.get('api_keys', [])
                if keys:
                    log(f"[OK] Carregadas {len(keys)} API keys do arquivo {API_KEYS_FILE}", "SUCCESS")
                    return keys
                else:
                    log(f"[AVISO] Arquivo {API_KEYS_FILE} existe mas nao contem API keys validas", "WARNING")
                    return []
        except Exception as e:
            log(f"[ERRO] Erro ao carregar API keys de {API_KEYS_FILE}: {e}", "ERROR")
            log("[AVISO] Usando lista vazia - o sistema nao funcionara sem API keys", "WARNING")
            return []
    else:
        log(f"[ERRO] Arquivo {API_KEYS_FILE} nao encontrado", "ERROR")
        log("[AVISO] Crie o arquivo com a estrutura: {\"api_keys\": [\"key1\", \"key2\", ...]}", "WARNING")
        return []

# Carrega API keys do arquivo
API_KEYS = load_api_keys()

if not API_KEYS:
    log("*** [ERRO] NENHUMA API KEY CARREGADA - O SISTEMA NAO FUNCIONARA ***", "ERROR")

# Arquivo para rastreamento de uso das API keys
API_USAGE_FILE = "api_usage.json"
# Arquivo para estatísticas de cancelas abertas
STATISTICS_FILE = "statistics.json"

def load_api_usage():
    """Carrega estatísticas de uso das API keys do arquivo."""
    if os.path.exists(API_USAGE_FILE):
        try:
            with open(API_USAGE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Garante que a estrutura está atualizada com o número correto de API keys
                num_keys = len(API_KEYS)
                if 'usage' not in data:
                    data['usage'] = {}
                if 'priority_order' not in data:
                    data['priority_order'] = list(range(num_keys))
                # Adiciona keys faltantes se necessário
                for i in range(num_keys):
                    key_name = f'key_{i+1}'
                    if key_name not in data['usage']:
                        data['usage'][key_name] = 0
                # Remove keys que não existem mais
                keys_to_remove = [k for k in data['usage'].keys() if k not in [f'key_{i+1}' for i in range(num_keys)]]
                for k in keys_to_remove:
                    del data['usage'][k]
                # Atualiza priority_order se necessário
                if len(data['priority_order']) != num_keys:
                    # Mantém ordem válida e adiciona novos índices
                    existing = [x for x in data['priority_order'] if x < num_keys]
                    missing = [x for x in range(num_keys) if x not in existing]
                    data['priority_order'] = existing + missing
                return data
        except Exception as e:
            log(f"[AVISO] Erro ao carregar uso de API keys: {e}", "WARNING")
    # Retorna estrutura padrão se arquivo não existe
    return {
        'usage': {f'key_{i+1}': 0 for i in range(len(API_KEYS))},
        'last_reset': datetime.now().isoformat(),
        'priority_order': list(range(len(API_KEYS)))
    }

def save_api_usage(usage_data):
    """Salva estatísticas de uso das API keys no arquivo."""
    try:
        with open(API_USAGE_FILE, 'w', encoding='utf-8') as f:
            json.dump(usage_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        log(f"[AVISO] Erro ao salvar uso de API keys: {e}", "WARNING")

def increment_api_usage(key_index):
    """Incrementa contador de uso de uma API key."""
    usage_data = load_api_usage()
    key_name = f'key_{key_index + 1}'
    usage_data['usage'][key_name] = usage_data['usage'].get(key_name, 0) + 1
    save_api_usage(usage_data)

def get_api_key_by_priority(priority_index, usage_data):
    """Obtém a API key baseada na ordem de prioridade."""
    priority_order = usage_data.get('priority_order', list(range(len(API_KEYS))))
    if priority_index < len(priority_order):
        actual_index = priority_order[priority_index]
        return actual_index, API_KEYS[actual_index]
    return None, None

def reorder_api_keys_on_error(failed_index, usage_data):
    """Reordena API keys movendo a falhada para o final da lista de prioridade."""
    priority_order = usage_data.get('priority_order', list(range(len(API_KEYS))))
    if failed_index in priority_order:
        # Remove da posição atual e coloca no final
        priority_order.remove(failed_index)
        priority_order.append(failed_index)
        usage_data['priority_order'] = priority_order
        save_api_usage(usage_data)
        log(f"[AVISO] API Key {failed_index + 1} movida para o final da lista de prioridade (erro detectado)", "WARNING")

def log_api_usage_summary(usage_data):
    """Imprime resumo do uso das API keys."""
    log("", "INFO")
    log("=" * 80, "INFO")
    log("           ESTATISTICAS DE USO DAS API KEYS (ultimas 10 minutos)", "INFO")
    log("=" * 80, "INFO")
    priority_order = usage_data.get('priority_order', list(range(len(API_KEYS))))
    
    for i, actual_index in enumerate(priority_order):
        key_name = f'key_{actual_index + 1}'
        usage_count = usage_data['usage'].get(key_name, 0)
        key_display = f"{API_KEYS[actual_index][:8]}...{API_KEYS[actual_index][-8:]}"
        priority_marker = "[PRIORIDADE]" if i == 0 else f"   Posicao {i + 1}"
        log(f"   {priority_marker} - API Key {actual_index + 1}: {usage_count:>4} usos ({key_display})", "INFO")
    
    total_usage = sum(usage_data['usage'].values())
    log("-" * 80, "INFO")
    log(f"   [TOTAL] Total de usos: {total_usage:>6}", "INFO")
    log("=" * 80, "INFO")
    log("", "INFO")

# ==================== FUNÇÕES DE ESTATÍSTICAS ====================

def load_statistics():
    """Carrega estatísticas simplificadas."""
    if os.path.exists(STATISTICS_FILE):
        try:
            with open(STATISTICS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for key in ['com_placa', 'sem_placa']:
                    if key not in data:
                        data[key] = 0
                if 'daily_stats' not in data:
                    data['daily_stats'] = {}
                if 'plate_entries' not in data:
                    data['plate_entries'] = {}
                return data
        except Exception as e:
            log(f"[AVISO] Erro ao carregar estatisticas: {e}", "WARNING")
    return {
        'com_placa': 0,
        'sem_placa': 0,
        'daily_stats': {},
        'plate_entries': {},
        'last_update': datetime.now().isoformat()
    }

def save_statistics(statistics_data):
    """Salva estatísticas no arquivo."""
    try:
        statistics_data['last_update'] = datetime.now().isoformat()
        with open(STATISTICS_FILE, 'w', encoding='utf-8') as f:
            json.dump(statistics_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        log(f"[AVISO] Erro ao salvar estatisticas: {e}", "WARNING")

def reset_statistics():
    """Zera todas as estatísticas."""
    try:
        stats = {
            'com_placa': 0,
            'sem_placa': 0,
            'daily_stats': {},
            'plate_entries': {},
            'last_update': datetime.now().isoformat()
        }
        save_statistics(stats)
        log("[OK] Estatisticas zeradas com sucesso", "SUCCESS")
        return True
    except Exception as e:
        log(f"[ERRO] Erro ao zerar estatisticas: {e}", "ERROR")
        return False

def increment_com_placa(plate_normalized=None):
    """Registra abertura COM placa detectada."""
    stats = load_statistics()
    stats['com_placa'] = stats.get('com_placa', 0) + 1
    today = datetime.now().strftime('%Y-%m-%d')
    if today not in stats['daily_stats']:
        stats['daily_stats'][today] = {'com_placa': 0, 'sem_placa': 0}
    stats['daily_stats'][today]['com_placa'] = stats['daily_stats'][today].get('com_placa', 0) + 1
    if plate_normalized:
        stats['plate_entries'][plate_normalized] = stats['plate_entries'].get(plate_normalized, 0) + 1
    save_statistics(stats)

def increment_sem_placa():
    """Registra abertura SEM placa detectada (erro)."""
    stats = load_statistics()
    stats['sem_placa'] = stats.get('sem_placa', 0) + 1
    today = datetime.now().strftime('%Y-%m-%d')
    if today not in stats['daily_stats']:
        stats['daily_stats'][today] = {'com_placa': 0, 'sem_placa': 0}
    stats['daily_stats'][today]['sem_placa'] = stats['daily_stats'][today].get('sem_placa', 0) + 1
    save_statistics(stats)

# Compatibilidade com chamadas existentes
def increment_authorized_opening(plate_normalized=None, attempt_num=None):
    increment_com_placa(plate_normalized)

def increment_denied_opening(plate_normalized=None, attempt_num=None):
    increment_com_placa(plate_normalized)

def increment_without_recognition_opening():
    increment_sem_placa()

def increment_manual_opening():
    increment_sem_placa()

def log_statistics_summary():
    """Imprime resumo simplificado das estatísticas."""
    stats = load_statistics()
    total = stats.get('com_placa', 0) + stats.get('sem_placa', 0)
    
    log("", "INFO")
    log("=" * 60, "INFO")
    log("         ESTATISTICAS DE ABERTURAS", "INFO")
    log("=" * 60, "INFO")
    log(f"   [OK]   Com placa detectada:    {stats.get('com_placa', 0):>6}", "INFO")
    log(f"   [ERRO] Sem placa (erro):       {stats.get('sem_placa', 0):>6}", "INFO")
    log(f"   [TOTAL] Total:                 {total:>6}", "INFO")
    log("-" * 60, "INFO")
    
    today = datetime.now().strftime('%Y-%m-%d')
    if today in stats.get('daily_stats', {}):
        daily = stats['daily_stats'][today]
        log(f"         HOJE ({today})", "INFO")
        log("-" * 60, "INFO")
        log(f"   [OK]   Com placa:              {daily.get('com_placa', 0):>6}", "INFO")
        log(f"   [ERRO] Sem placa:              {daily.get('sem_placa', 0):>6}", "INFO")
        log("-" * 60, "INFO")
    
    plate_entries = stats.get('plate_entries', {})
    if plate_entries:
        log("         TOP 10 PLACAS", "INFO")
        log("-" * 60, "INFO")
        sorted_plates = sorted(plate_entries.items(), key=lambda x: x[1], reverse=True)[:10]
        for i, (plate, count) in enumerate(sorted_plates, 1):
            log(f"   {i:2d}. {plate.upper():<12} - {count:>4}x", "INFO")
        log(f"   Placas unicas: {len(plate_entries)}", "INFO")
        log("-" * 60, "INFO")
    
    log("=" * 60, "INFO")
    log("", "INFO")

AUTHORIZED_PLATES_CSV = "plates/authorized_plates.csv"

def load_authorized_plates():
    """
    Carrega placas autorizadas do arquivo CSV.
    Retorna tupla: (lista de placas normalizadas, dict com info de cada placa).
    """
    authorized_plates = []
    plate_info = {}  # {plate_normalized: {"tipo": ..., "nome": ...}}
    
    if not os.path.exists(AUTHORIZED_PLATES_CSV):
        log(f"[AVISO] Arquivo de placas autorizadas nao encontrado: {AUTHORIZED_PLATES_CSV}", "WARNING")
        log("[AVISO] Usando lista vazia - nenhuma placa sera autorizada automaticamente", "WARNING")
        return [], {}
    
    try:
        with open(AUTHORIZED_PLATES_CSV, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                plate = row.get('plate', '').strip().upper()
                if plate:
                    plate_normalized = plate.replace(' ', '').replace('-', '').upper()
                    tipo = row.get('tipo', 'visitante').strip().lower()
                    nome = row.get('nome', '').strip()
                    if plate_normalized not in authorized_plates:
                        authorized_plates.append(plate_normalized)
                    plate_info[plate_normalized] = {"tipo": tipo, "nome": nome}
        
        log(f"[OK] Carregadas {len(authorized_plates)} placas autorizadas do arquivo CSV", "SUCCESS")
        return authorized_plates, plate_info
        
    except Exception as e:
        log(f"[ERRO] Erro ao carregar placas autorizadas: {e}", "ERROR")
        log("[AVISO] Usando lista vazia - nenhuma placa sera autorizada automaticamente", "WARNING")
        return [], {}

# Lista de placas autorizadas e info (tipo/nome) para Firestore
AUTHORIZED_PLATES, PLATE_INFO = load_authorized_plates()

def is_valid_brazilian_plate(plate_normalized):
    """
    Valida se a placa segue o padrão brasileiro válido.
    
    Formatos aceitos:
    - Mercosul (novo): LLLNLNN (3 letras, 1 número, 1 letra, 2 números) - exemplo: ABC1D23
    - Antigo: LLLNNNN (3 letras, 4 números) - exemplo: ABC1234
    
    Retorna True se válida, False caso contrário.
    """
    if not plate_normalized or len(plate_normalized) < 6:
        return False
    
    plate_clean = plate_normalized.upper().strip()
    
    # Padrão Mercosul: LLLNLNN (3 letras, 1 número, 1 letra, 2 números)
    # Exemplo: ABC1D23
    pattern_mercosul = re.match(r'^[A-Z]{3}[0-9][A-Z][0-9]{2}$', plate_clean)
    if pattern_mercosul:
        return True
    
    # Padrão antigo: LLLNNNN (3 letras, 4 números)
    # Exemplo: ABC1234
    pattern_old = re.match(r'^[A-Z]{3}[0-9]{4}$', plate_clean)
    if pattern_old:
        return True
    
    return False

# ==================== LPR WEBHOOK (Câmera Hikvision ANPR) ====================

LPR_LISTEN_HOST = "0.0.0.0"
LPR_LISTEN_PORT = 8099
LPR_ENDPOINT = "/hik/lpr"
LPR_EVENTS_DIR = "lpr-events"
LPR_MAX_ISAPI_RETRIES = 2  # Tentativas extras de captura ISAPI quando placa não reconhecida

os.makedirs(LPR_EVENTS_DIR, exist_ok=True)

# Fila thread-safe para eventos LPR recebidos pela câmera
lpr_event_queue = queue.Queue()

# ── Funções de parsing (baseadas em lpr_bridge.py) ──

def _lpr_extract_multipart_parts(body: bytes, boundary: bytes):
    """Divide o body multipart em partes individuais."""
    delimiter = b"--" + boundary
    segments = body.split(delimiter)
    parts = []
    for seg in segments:
        seg = seg.strip(b"\r\n")
        if not seg or seg == b"--":
            continue
        sep_idx = seg.find(b"\r\n\r\n")
        if sep_idx == -1:
            sep_idx = seg.find(b"\n\n")
            if sep_idx == -1:
                parts.append({"headers": "", "body": seg})
                continue
            hdr = seg[:sep_idx].decode("utf-8", errors="replace")
            payload = seg[sep_idx + 2:]
        else:
            hdr = seg[:sep_idx].decode("utf-8", errors="replace")
            payload = seg[sep_idx + 4:]
        parts.append({"headers": hdr, "body": payload})
    return parts


def _lpr_find_xml_in_body(body: bytes):
    """Tenta localizar bloco XML no body."""
    patterns = [b"<EventNotificationAlert", b"<ANPR", b"<licensePlate"]
    for pat in patterns:
        idx = body.find(pat)
        if idx != -1:
            tag_name = pat[1:].split(b" ")[0].split(b">")[0]
            close_tag = b"</" + tag_name + b">"
            end_idx = body.find(close_tag, idx)
            if end_idx != -1:
                return body[idx:end_idx + len(close_tag)]
    xml_decl = body.find(b"<?xml")
    if xml_decl != -1:
        snippet = body[xml_decl:]
        for end in [b"</EventNotificationAlert>", b"</ANPR>", b"</Alert>"]:
            ei = snippet.find(end)
            if ei != -1:
                return snippet[:ei + len(end)]
        return snippet
    return None


def _lpr_parse_xml(xml_bytes: bytes):
    """Parseia XML do evento LPR e retorna dict com campos relevantes."""
    result = {}
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        result["_parse_error"] = str(e)
        m = re.search(rb"<licensePlate[^>]*>([^<]+)</licensePlate>", xml_bytes, re.IGNORECASE)
        if m:
            result["licensePlate"] = m.group(1).decode("utf-8", errors="replace")
        return result

    tag = root.tag
    ns = ""
    if "{" in tag:
        ns = tag.split("}")[0] + "}"

    def _find(parent, local_name):
        el = parent.find(f"{ns}{local_name}")
        if el is not None:
            return el
        el = parent.find(local_name)
        if el is not None:
            return el
        for child in parent.iter():
            ltag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
            if ltag == local_name:
                return child
        return None

    def _text(parent, local_name, default=""):
        el = _find(parent, local_name)
        return el.text.strip() if el is not None and el.text else default

    result["eventType"] = _text(root, "eventType")
    result["eventState"] = _text(root, "eventState")
    result["dateTime"] = _text(root, "dateTime")

    anpr = _find(root, "ANPR")
    if anpr is not None:
        result["licensePlate"] = _text(anpr, "licensePlate")
        result["plateConfidence"] = _text(anpr, "confidenceLevel",
                                          _text(anpr, "plateConfidence"))
        result["direction"] = _text(anpr, "direction")
        result["vehicleType"] = _text(anpr, "vehicleType")
    else:
        result["licensePlate"] = _text(root, "licensePlate")
        result["plateConfidence"] = _text(root, "confidenceLevel",
                                          _text(root, "plateConfidence"))

    result = {k: v for k, v in result.items() if v}
    return result


# ── HTTP Handler para webhook da câmera ──

class LPRWebhookHandler(BaseHTTPRequestHandler):
    """Recebe POSTs da câmera Hikvision LPR e coloca eventos na fila."""

    def log_message(self, fmt, *args):
        pass  # Suprime log padrão do http.server

    def do_POST(self):
        if self.path.rstrip("/") != LPR_ENDPOINT.rstrip("/"):
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        content_type = self.headers.get("Content-Type", "")
        body = self.rfile.read(content_length) if content_length else b""

        # Extrai XML do body
        xml_bytes = None
        if "boundary=" in content_type:
            boundary = content_type.split("boundary=")[-1].strip().strip('"').encode()
            parts = _lpr_extract_multipart_parts(body, boundary)
            for part in parts:
                hdrs_lower = part["headers"].lower()
                if "xml" in hdrs_lower or b"<EventNotification" in part["body"][:200]:
                    xml_bytes = part["body"]
                    break
        else:
            xml_bytes = _lpr_find_xml_in_body(body)

        # Parseia e enfileira
        plate = None
        confidence = 0
        event_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        if xml_bytes:
            info = _lpr_parse_xml(xml_bytes)
            plate = info.get("licensePlate", None)
            try:
                confidence = float(info.get("plateConfidence", "0"))
            except (ValueError, TypeError):
                confidence = 0

            # Salva XML para debug
            ts_tag = datetime.now().strftime("%Y%m%d_%H%M%S_") + f"{datetime.now().microsecond:06d}"
            xml_path = os.path.join(LPR_EVENTS_DIR, f"lpr-{ts_tag}.xml")
            try:
                with open(xml_path, "wb") as f:
                    f.write(xml_bytes)
            except Exception:
                pass

        # Filtra eventos sem placa ou com placa "unknown" — ignora completamente
        if not plate or plate.lower() == "unknown" or not plate.strip():
            log(f"[LPR-WEBHOOK] Evento ignorado (placa vazia/unknown) hora={event_time}", "INFO")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK")
            return

        # Coloca evento na fila apenas com placa válida
        event = {
            "plate": plate,
            "confidence": confidence,
            "timestamp": event_time,
            "source": "lpr_webhook",
        }
        lpr_event_queue.put(event)
        log(f"[LPR-WEBHOOK] Evento recebido: placa={plate} conf={confidence} hora={event_time}", "INFO")

        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"OK")

    def do_GET(self):
        """Health check."""
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        msg = f"LPR Webhook ativo | {datetime.now().isoformat()}\n"
        self.wfile.write(msg.encode("utf-8"))


def start_lpr_webhook_server():
    """Inicia o servidor HTTP do webhook LPR em uma thread daemon."""
    try:
        server = HTTPServer((LPR_LISTEN_HOST, LPR_LISTEN_PORT), LPRWebhookHandler)
        server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        log(f"[LPR-WEBHOOK] Servidor webhook iniciado em http://0.0.0.0:{LPR_LISTEN_PORT}{LPR_ENDPOINT}", "SUCCESS")
        return server
    except OSError as e:
        log(f"[LPR-WEBHOOK] ERRO ao iniciar servidor na porta {LPR_LISTEN_PORT}: {e}", "ERROR")
        log(f"[LPR-WEBHOOK] Verifique se lpr_bridge.py nao esta rodando ao mesmo tempo!", "WARNING")
        return None


def trigger_camera_capture_isapi():
    """
    Força a câmera Hikvision a fazer nova captura de placa via ISAPI.
    A câmera enviará o resultado via webhook automaticamente.
    Retorna True se a requisição foi bem sucedida.
    """
    # Endpoints ISAPI possíveis para captura manual (varia conforme modelo da câmera)
    isapi_urls = [
        f"http://{CAM_IP}/ISAPI/Traffic/channels/1/vehicleDetect/plates/manualCapture",
        f"http://{CAM_IP}/ISAPI/Traffic/channels/1/vehicleDetect/manualCapture",
    ]
    # NÃO usar headers de browser para ISAPI - interfere com autenticação digest
    isapi_headers = {"Content-Type": "application/xml"}
    
    for url in isapi_urls:
        for auth_type, auth_obj in [("Digest", HTTPDigestAuth(CAM_USER, CAM_PASS)),
                                     ("Basic", HTTPBasicAuth(CAM_USER, CAM_PASS))]:
            try:
                response = requests.put(
                    url,
                    auth=auth_obj,
                    headers=isapi_headers,
                    timeout=5
                )
                if response.status_code in [200, 201]:
                    log(f"[LPR-ISAPI] Captura manual solicitada com sucesso ({auth_type})", "SUCCESS")
                    return True
                elif response.status_code == 401 and auth_type == "Digest":
                    continue  # Tenta Basic sem logar (reduz spam)
                elif response.status_code == 404 and auth_type == "Digest":
                    break  # Endpoint não existe nesta câmera, tenta próximo URL
                else:
                    if auth_type == "Basic":
                        log(f"[LPR-ISAPI] Falha: HTTP {response.status_code} em {url.split('/')[-1]}", "WARNING")
            except Exception as e:
                if auth_type == "Basic":
                    log(f"[LPR-ISAPI] Erro: {e}", "ERROR")
                return False
    
    log("[LPR-ISAPI] Nenhum endpoint ISAPI respondeu - usando fallback snapshot+API", "WARNING")
    return False


def recognize_plate_snapshot_fallback():
    """
    Fallback: captura snapshot da câmera e envia para PlateRecognizer API.
    Usado quando a câmera LPR não consegue ler a placa automaticamente.
    Retorna dict com dados da placa ou None se não encontrou.
    """
    log("[FALLBACK] Capturando snapshot para reconhecimento via API...", "INFO")
    image_path = capture_camera_image()
    if not image_path:
        log("[FALLBACK] Falha ao capturar imagem da camera", "WARNING")
        return None
    
    detected_plates = recognize_plate_from_image(image_path)
    if detected_plates:
        best = detected_plates[0]
        log(f"[FALLBACK] Placa detectada via API: {best['plate']} (conf={best['confidence']:.1f}%)", "SUCCESS")
        return {
            "plate": best['plate'],
            "plate_normalized": best['plate_normalized'],
            "confidence": best['confidence'],
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "source": "snapshot_api_fallback"
        }
    else:
        log("[FALLBACK] API nao detectou placa no snapshot", "WARNING")
        # Remove imagem se não detectou nada
        try:
            if os.path.exists(image_path):
                os.remove(image_path)
        except Exception:
            pass
        return None


def request_mnpr_plate():
    """
    Solicita leitura de placa diretamente da câmera via MNPR (Manual Number Plate Recognition).
    Endpoint: GET /ISAPI/Traffic/MNPR/channels/1
    A câmera DS-TCG406-E retorna multipart com XML (dados da placa) + JPEG (imagem).
    Retorna dict com dados da placa ou None se não encontrou/unknown.
    """
    mnpr_url = f"http://{CAM_IP}/ISAPI/Traffic/MNPR/channels/1?laneNo=1&OSD=1"
    try:
        response = requests.get(
            mnpr_url,
            auth=HTTPDigestAuth(CAM_USER, CAM_PASS),
            timeout=10
        )
        
        if response.status_code != 200:
            log(f"[MNPR] Falha na solicitacao: HTTP {response.status_code}", "WARNING")
            return None
        
        ct = response.headers.get('Content-Type', '')
        
        # Parseia resposta multipart
        if 'boundary=' in ct:
            boundary = ct.split('boundary=')[-1].strip().encode()
            parts = response.content.split(b'--' + boundary)
            
            plate = None
            confidence = 0
            
            for part in parts:
                if b'\r\n\r\n' not in part:
                    continue
                headers_raw, body = part.split(b'\r\n\r\n', 1)
                
                # Procura a parte XML
                if b'<?xml' in body[:100] or b'<MNPR' in body[:200] or b'<EventNotification' in body[:200]:
                    try:
                        root = ET.fromstring(body)
                        
                        # Busca licensePlate e confidenceLevel em qualquer profundidade
                        for elem in root.iter():
                            tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                            if tag == 'licensePlate' and elem.text:
                                plate = elem.text.strip()
                            elif tag == 'confidenceLevel' and elem.text:
                                try:
                                    confidence = float(elem.text.strip())
                                except (ValueError, TypeError):
                                    confidence = 0
                    except ET.ParseError:
                        # Tenta regex como fallback
                        import re
                        m = re.search(rb'<licensePlate>([^<]+)</licensePlate>', body)
                        if m:
                            plate = m.group(1).decode('utf-8', errors='replace').strip()
                        m2 = re.search(rb'<confidenceLevel>([^<]+)</confidenceLevel>', body)
                        if m2:
                            try:
                                confidence = float(m2.group(1).decode())
                            except (ValueError, TypeError):
                                confidence = 0
            
            # Verifica se encontrou placa válida
            if plate and plate.lower() != 'unknown' and plate.strip():
                pl_norm = plate.replace(' ', '').replace('-', '').upper()
                log(f"[MNPR] Placa lida pela camera: {plate} (conf={confidence})", "SUCCESS")
                return {
                    "plate": plate,
                    "plate_normalized": pl_norm,
                    "confidence": confidence,
                    "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    "source": "mnpr_direct"
                }
            else:
                log(f"[MNPR] Camera nao identificou placa (plate={plate}, conf={confidence})", "INFO")
                return None
        else:
            log(f"[MNPR] Resposta inesperada (Content-Type: {ct})", "WARNING")
            return None
            
    except requests.exceptions.Timeout:
        log("[MNPR] Timeout ao solicitar leitura da camera", "WARNING")
        return None
    except Exception as e:
        log(f"[MNPR] Erro ao solicitar leitura: {e}", "ERROR")
        return None


# ==================== FIM LPR WEBHOOK ====================

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

os.makedirs(SAVE_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

def clear_socket_buffer(sock):
    """Limpa o buffer do socket removendo pacotes antigos."""
    try:
        sock.setblocking(False)
        count = 0
        while count < 10:  # Limita a 10 tentativas para evitar loop infinito
            try:
                sock.recvfrom(1024)
                count += 1
            except socket.error:
                break
        sock.setblocking(True)
        if count > 0:
            log(f"🧹 Buffer limpo: {count} pacote(s) antigo(s) removido(s)", "INFO")
    except:
        try:
            sock.setblocking(True)
        except:
            pass

def check_manual_button(sock):
    """
    Verifica se o botão manual (botão 1) foi pressionado.
    Drena buffer antigo antes de ler para evitar delay.
    Retorna True se pressionado, False caso contrário.
    """
    try:
        # Drena pacotes antigos do buffer
        try:
            sock.setblocking(False)
            for _ in range(20):
                try:
                    sock.recvfrom(1024)
                except socket.error:
                    break
            sock.setblocking(True)
            sock.settimeout(1.0)
        except:
            try:
                sock.setblocking(True)
                sock.settimeout(1.0)
            except:
                pass
        
        cmd = bytes([0x55, 0xAA, 0x02, 0x00])
        sock.sendto(cmd, (SEC_IP, SEC_PORT))
        try:
            resp, _ = sock.recvfrom(1024)
            if len(resp) >= 8 and resp[0:2] == bytes([0x55, 0xAA]) and resp[2] == 0x02:
                b1 = resp[7]
                button1_pressed = not bool(b1 & 0x02)
                return button1_pressed
        except socket.timeout:
            pass
    except:
        pass
    return False

def test_relay_2(sock, tempo_segundos=0.5):
    """
    Testa o relé 2 ao iniciar o script para verificar comunicação.
    Liga o relé 2 temporizado por um curto período.
    """
    try:
        tempo_decimos = min(255, max(1, int(tempo_segundos * 10)))
        # Comando: 55 AA 03 06 B0 B1 B2 B3 B4 B5
        # B0 = 0x30 = 0b00110000 (bits 5,4,3 = 1,1,0 = Liga relé 2 temporizado)
        #     bits 2,1,0 = 0,0,0 = Não altera relé 1
        # B5 = tempo_decimos (tempo do relé 2 em décimos de segundo)
        cmd = bytes([0x55, 0xAA, 0x03, 0x06, 0x30, 0x00, 0x00, 0x00, 0x00, tempo_decimos])
        
        start_time = time.time()
        sock.sendto(cmd, (SEC_IP, SEC_PORT))
        
        try:
            resp, _ = sock.recvfrom(1024)
            response_time = (time.time() - start_time) * 1000
            if len(resp) >= 4 and resp[0:2] == bytes([0x55, 0xAA]) and resp[2] == 0x03:
                log(f"[OK] TESTE RELE 2: Comando enviado com sucesso ({response_time:.0f}ms)", "SUCCESS")
                return True
            else:
                log(f"[AVISO] TESTE RELE 2: Resposta invalida", "WARNING")
                return False
        except socket.timeout:
            log(f"[AVISO] TESTE RELE 2: Timeout na resposta", "WARNING")
            return False
    except Exception as e:
        log(f"[ERRO] TESTE RELE 2: Erro ao testar rele: {e}", "ERROR")
        return False

def open_gate_timed(sock, tempo_segundos=1, plate=None):
    """
    Envia comando para abrir a cancela por tempo determinado (relé 1).
    Limpa buffer do socket antes de enviar para evitar respostas stale.
    Tenta até 3 vezes em caso de falha.
    plate: placa associada à abertura (None = sem placa/erro)
    """
    tempo_decimos = min(255, max(1, int(tempo_segundos * 10)))
    cmd = bytes([0x55, 0xAA, 0x03, 0x05, 0x06, 0x00, 0x00, 0x00, tempo_decimos])
    
    for attempt in range(3):
        try:
            # Limpa buffer antes de enviar
            clear_socket_buffer(sock)
            
            start_time = time.time()
            sock.sendto(cmd, (SEC_IP, SEC_PORT))
            
            try:
                resp, _ = sock.recvfrom(1024)
                response_time = (time.time() - start_time) * 1000
                if len(resp) >= 4 and resp[0:2] == bytes([0x55, 0xAA]) and resp[2] == 0x03:
                    log(f"[CANCELA] {time.strftime('%H:%M:%S')} - CANCELA ABERTA (rele 1) ({response_time:.0f}ms)", "SUCCESS")
                    log_gate_result(plate)
                    return True
                else:
                    log(f"[CANCELA] Resposta invalida na tentativa {attempt+1}/3 - retentando...", "WARNING")
            except socket.timeout:
                log(f"[CANCELA] Timeout na tentativa {attempt+1}/3 - retentando...", "WARNING")
        except Exception as e:
            log(f"[ERRO] Erro ao abrir cancela (tentativa {attempt+1}/3): {e}", "ERROR")
        
        time.sleep(0.2)
    
    log("[ERRO] FALHA AO ABRIR CANCELA apos 3 tentativas!", "ERROR")
    return False



def _escpos_send(sock, payload: bytes, delay: float = 0.15):
    """Envia payload ESC/POS com delay para flush do conversor serial."""
    sock.send(payload)
    time.sleep(delay)


def _escpos_qr_model2(module_size: int, ecc: str, text: str) -> bytes:
    """Gera comando ESC/POS QR Code Model 2."""
    ecc_map = {"AUTO": 0x30, "L": 0x31, "M": 0x32, "Q": 0x33, "H": 0x34}
    ecc_n = ecc_map.get(ecc.upper(), 0x32)
    ms = max(0x02, min(0x18, int(module_size)))
    data = text.encode("ascii", errors="replace")
    out = bytearray()
    # Fn165 - model 2
    out += bytes([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00])
    # Fn166 - version auto
    out += bytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x42, 0x00])
    # Fn167 - module size
    out += bytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, ms])
    # Fn169 - ECC
    out += bytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, ecc_n])
    # Fn180 - store data
    total = len(data) + 3
    pL = total & 0xFF
    pH = (total >> 8) & 0xFF
    out += bytes([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x31]) + data
    # Fn181 - print
    out += bytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x31])
    out += b"\n"
    return bytes(out)


def _escpos_barcode_code128(text: str) -> bytes:
    """Gera comando ESC/POS Code 128 barcode (aceita alfanumerico)."""
    out = bytearray()
    out += bytes([0x1D, 0x48, 0x02])  # HRI below barcode
    out += bytes([0x1D, 0x66, 0x00])  # Font A
    out += bytes([0x1D, 0x68, 0x3C])  # Height = 60 dots
    out += bytes([0x1D, 0x77, 0x02])  # Width = 2
    # Code 128 (type 73 = 0x49), formato 2 com length
    payload = text.encode("ascii", errors="ignore")
    # Usa subset B (alfanumerico): {B prefix
    data = bytes([0x7B, 0x42]) + payload  # {B + dados
    out += bytes([0x1D, 0x6B, 0x49, len(data)]) + data
    out += b"\n"
    return bytes(out)


def print_plate_receipt(plate_text):
    """Imprime apenas a placa na impressora termica via TCP ESC/POS.
    Usado para MORADORES - imprime so a placa sem ticket.
    Envia em chunks com delays para forcar flush do conversor serial."""
    global print_count
    
    # Nao imprime se placa nao foi reconhecida
    if not plate_text or plate_text.upper() == "DESCONHECIDA":
        log(f"[PRINTER] Placa desconhecida - nao imprime", "INFO")
        return False
    
    # Limite de 2 impressoes para teste
    if print_count >= 1:
        log(f"[PRINTER] Teste concluido (1/1 impressoes) - ignorando", "INFO")
        return False
    
    # MOCK: apenas loga a placa sem conectar na impressora
    if MOCK_MODE:
        print_count += 1
        log(f"[PRINTER] Placa: [{plate_text}] ({print_count}/1) - modo mock", "SUCCESS")
        return True
    
    log(f"[PRINTER] >>> ENVIANDO TICKET: [{plate_text}] <<<", "SUCCESS")
    
    # Payload do QR Code
    qr_payload = f"PLATE={plate_text}|TS={datetime.now().isoformat(timespec='seconds')}"
    barcode_digits = "123456789012"  # EAN13
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(PRINTER_TIMEOUT)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sock.connect((PRINTER_IP, PRINTER_PORT))
        
        # Drena qualquer dado antigo do conversor
        sock.setblocking(False)
        try:
            sock.recv(4096)
        except:
            pass
        sock.setblocking(True)
        sock.settimeout(PRINTER_TIMEOUT)
        
        # INIT + DENSITY
        _escpos_send(sock, b'\x1B\x40', 0.20)                         # ESC @
        _escpos_send(sock, bytes([0x1D, 0x7C, 0x08]), 0.20)           # GS | density +50%
        _escpos_send(sock, bytes([0x1D, 0x57, 0x00, 0x02]), 0.05)     # GS W = 512 dots
        
        # CABECALHO (centralizado)
        _escpos_send(sock, b'\x1B\x61\x01', 0.05)   # Center align
        _escpos_send(sock, b'METROPOLE\n', 0.05)
        
        # Data/hora
        now_str = datetime.now().strftime("%d/%m/%y %H:%M")
        _escpos_send(sock, f"{now_str}\n".encode("ascii", "replace"), 0.05)
        
        # PLACA em destaque (double size)
        _escpos_send(sock, b'\x1B\x21\x30', 0.05)   # Double height+width
        _escpos_send(sock, f"{plate_text}\n".encode("ascii", "replace"), 0.05)
        _escpos_send(sock, b'\x1B\x21\x00', 0.05)   # Normal size
        
        # QR CODE
        _escpos_send(sock, b'\n', 0.05)
        _escpos_send(sock, _escpos_qr_model2(module_size=5, ecc="M", text=qr_payload), 0.30)
        
        # BARCODE EAN13
        out = bytearray()
        out += bytes([0x1D, 0x48, 0x02])  # HRI below
        out += bytes([0x1D, 0x66, 0x00])  # Font A
        out += bytes([0x1D, 0x68, 0x3C])  # Height = 60 dots
        payload = barcode_digits.encode("ascii", errors="ignore")
        out += bytes([0x1D, 0x6B, 0x43, len(payload)]) + payload
        out += b"\n"
        _escpos_send(sock, bytes(out), 0.20)
        
        # CORTE + APRESENTACAO (Custom VKP II)
        _escpos_send(sock, b'\x1B\x69', 0.20)                         # ESC i - corte
        _escpos_send(sock, bytes([0x1D, 0x65, 0x05, 0xFF]), 0.30)     # cuspir
        _escpos_send(sock, bytes([0x1D, 0x65, 0x05, 0xFF]), 0.30)     # cuspir mais
        _escpos_send(sock, bytes([0x1D, 0x65, 0x05, 0xFF]), 0.30)     # cuspir mais
        
        time.sleep(2.0)
        sock.close()
        
        print_count += 1
        log(f"[PRINTER] >>> TICKET IMPRESSO: [{plate_text}] ({print_count}/1) <<<", "SUCCESS")
        return True
    except Exception as e:
        log(f"[PRINTER] Erro ao imprimir: {e}", "WARNING")
        return False


def print_ticket_receipt(plate_text, ticket_id):
    """Imprime ticket completo para VISITANTE na impressora termica.
    Inclui: cabecalho, data/hora, placa em destaque, QR Code e codigo de barras
    com o ticket_id (session_id do Firebase).
    
    Args:
        plate_text: placa do veiculo (ex: 'ABC1D23')
        ticket_id: ID da sessao do Firebase (ex: 'xYz123AbC')
    """
    global print_count
    
    # Nao imprime se placa nao foi reconhecida
    if not plate_text or plate_text.upper() == "DESCONHECIDA":
        log(f"[PRINTER] Placa desconhecida - nao imprime ticket", "INFO")
        return False
    
    # Limite de 2 impressoes para teste
    if print_count >= 1:
        log(f"[PRINTER] Teste concluido (2/2 impressoes) - ignorando", "INFO")
        return False
    
    # MOCK: apenas loga sem conectar na impressora
    if MOCK_MODE:
        print_count += 1
        log(f"[PRINTER] TICKET: plate=[{plate_text}] id=[{ticket_id}] ({print_count}/2) - modo mock", "SUCCESS")
        return True
    
    log(f"[PRINTER] >>> IMPRIMINDO TICKET: plate=[{plate_text}] id=[{ticket_id}] <<<", "SUCCESS")
    
    # Payload do QR Code: contem ticket_id + placa + timestamp
    qr_payload = f"TICKET={ticket_id}|PLATE={plate_text}|TS={datetime.now().isoformat(timespec='seconds')}"
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(PRINTER_TIMEOUT)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sock.connect((PRINTER_IP, PRINTER_PORT))
        
        # Drena qualquer dado antigo
        sock.setblocking(False)
        try:
            sock.recv(4096)
        except:
            pass
        sock.setblocking(True)
        sock.settimeout(PRINTER_TIMEOUT)
        
        # INIT + DENSITY
        _escpos_send(sock, b'\x1B\x40', 0.20)                         # ESC @
        _escpos_send(sock, bytes([0x1D, 0x7C, 0x08]), 0.20)           # GS | density +50%
        _escpos_send(sock, bytes([0x1D, 0x57, 0x00, 0x02]), 0.05)     # GS W = 512 dots
        
        # CABECALHO (centralizado)
        _escpos_send(sock, b'\x1B\x61\x01', 0.05)   # Center align
        _escpos_send(sock, b'METROPOLE\n', 0.05)
        
        # Data/hora
        now_str = datetime.now().strftime("%d/%m/%y %H:%M")
        _escpos_send(sock, f"{now_str}\n".encode("ascii", "replace"), 0.05)
        
        # PLACA em destaque (double size)
        _escpos_send(sock, b'\x1B\x21\x30', 0.05)   # Double height+width
        _escpos_send(sock, f"{plate_text}\n".encode("ascii", "replace"), 0.05)
        _escpos_send(sock, b'\x1B\x21\x00', 0.05)   # Normal size
        
        # QR CODE com ticket_id
        _escpos_send(sock, b'\n', 0.05)
        _escpos_send(sock, _escpos_qr_model2(module_size=5, ecc="M", text=qr_payload), 0.30)
        
        # BARCODE Code128 com ticket_id (aceita alfanumerico)
        _escpos_send(sock, _escpos_barcode_code128(ticket_id), 0.20)
        
        # CORTE + APRESENTACAO (Custom VKP II)
        _escpos_send(sock, b'\x1B\x69', 0.20)                         # ESC i - corte
        _escpos_send(sock, bytes([0x1D, 0x65, 0x05, 0xFF]), 0.30)     # GS e 5 255 - cuspir
        _escpos_send(sock, bytes([0x1D, 0x65, 0x05, 0xFF]), 0.30)     # cuspir mais
        _escpos_send(sock, bytes([0x1D, 0x65, 0x05, 0xFF]), 0.30)     # cuspir mais
        
        time.sleep(2.0)
        sock.close()
        
        print_count += 1
        log(f"[PRINTER] >>> TICKET IMPRESSO: plate=[{plate_text}] id=[{ticket_id}] ({print_count}/2) <<<", "SUCCESS")
        return True
    except Exception as e:
        log(f"[PRINTER] Erro ao imprimir ticket: {e}", "WARNING")
        return False


def capture_camera_image():
    """Captura imagem da câmera usando autenticação Digest."""
    # MOCK: cria arquivo dummy em vez de acessar camera real
    if MOCK_MODE:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"camera_capture_{timestamp}.jpg"
        filepath = os.path.join(SAVE_DIR, filename)
        with open(filepath, 'wb') as f:
            f.write(b'\xff\xd8\xff\xe0')  # Header JPEG minimo
        log(f"[MOCK] Imagem dummy criada: {filename}", "INFO")
        return filepath
    
    try:
        # Timeout reduzido para 3 segundos - resposta mais rápida
        response = requests.get(SNAP_URL, auth=HTTPDigestAuth(CAM_USER, CAM_PASS), 
                                headers=HEADERS, timeout=3)
        if response.status_code == 200:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"camera_capture_{timestamp}.jpg"
            filepath = os.path.join(SAVE_DIR, filename)
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            return filepath
        else:
            log(f"[AVISO] Status HTTP {response.status_code} ao capturar imagem", "WARNING")
            return None
    except Exception as e:
        log(f"[ERRO] Erro ao capturar imagem: {e}", "ERROR")
        return None

def save_plate_result(image_path, result_data):
    """Salva resultado do reconhecimento em JSON apenas se confiança >= 99.5%."""
    try:
        # Verifica se há placas com confiança >= 99.5%
        plates = result_data.get('plates', [])
        should_save = False
        
        if plates:
            # Verifica se pelo menos uma placa tem confiança >= 99.5%
            for plate in plates:
                confidence = plate.get('confidence', 0)
                if confidence >= MIN_CONFIDENCE_TO_SAVE:
                    should_save = True
                    break
        else:
            # Se não há placas detectadas, não salva
            should_save = False
        
        if should_save:
            image_name = os.path.splitext(os.path.basename(image_path))[0]
            result_file = os.path.join(RESULTS_DIR, f"plate_{image_name}.json")
            with open(result_file, 'w', encoding='utf-8') as f:
                json.dump(result_data, f, indent=2, ensure_ascii=False)
            save_for_training(image_path, result_data)
            log(f"[OK] Dados salvos (confianca >= {MIN_CONFIDENCE_TO_SAVE}%)", "INFO")
        else:
            if plates:
                max_confidence = max(p.get('confidence', 0) for p in plates)
                log(f"[INFO] Foto nao salva - confianca maxima: {max_confidence:.1f}% < {MIN_CONFIDENCE_TO_SAVE}%", "INFO")
            else:
                log(f"[INFO] Foto nao salva - nenhuma placa detectada", "INFO")
            
            # Remove a imagem se não atende ao critério
            try:
                if os.path.exists(image_path):
                    os.remove(image_path)
                    log(f"[REMOVIDO] Imagem removida (confianca < {MIN_CONFIDENCE_TO_SAVE}%)", "INFO")
            except Exception as e:
                log(f"[AVISO] Erro ao remover imagem: {e}", "WARNING")
    except Exception as e:
        log(f"[AVISO] Erro ao salvar resultado: {e}", "WARNING")

def save_for_training(image_path, result_data):
    """Salva imagem e dados para treinamento futuro."""
    try:
        date_str = datetime.now().strftime("%Y-%m-%d")
        training_dir = os.path.join(TRAINING_DATA_DIR, date_str)
        os.makedirs(training_dir, exist_ok=True)
        
        image_name = os.path.basename(image_path)
        training_image_path = os.path.join(training_dir, image_name)
        shutil.copy2(image_path, training_image_path)
        
        json_name = os.path.splitext(image_name)[0] + ".json"
        training_json_path = os.path.join(training_dir, json_name)
        with open(training_json_path, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        log(f"[AVISO] Erro ao salvar dados de treinamento: {e}", "WARNING")

def _load_mock_plate():
    """Carrega placa mock do arquivo mock_plate.txt se existir, senao usa MOCK_PLATE."""
    try:
        if os.path.exists("mock_plate.txt"):
            with open("mock_plate.txt", 'r') as f:
                plate = f.read().strip().upper()
                if plate:
                    return plate
    except:
        pass
    return MOCK_PLATE

def recognize_plate_from_image(image_path, auto_open_gate=False, gate_socket=None):
    """
    Reconhece placa na imagem usando API PlateRecognizer com sistema de priorização dinâmica.
    Tenta API keys em ordem de prioridade. Se uma falhar, move para o final e tenta a próxima.
    Se todas falharem, abre cancela automaticamente.
    """
    log(f"[ANALISANDO] Analisando placa em: {os.path.basename(image_path)}", "INFO")
    
    # ==================== MOCK: retorna placa fake sem chamar API ====================
    if MOCK_MODE:
        mock_plate = _load_mock_plate()
        mock_normalized = mock_plate.replace(' ', '').replace('-', '').upper()
        is_valid = is_valid_brazilian_plate(mock_normalized)
        is_authorized = mock_normalized in AUTHORIZED_PLATES
        
        log(f"[MOCK] Placa simulada: {mock_plate} (confianca: {MOCK_CONFIDENCE:.1f}%)", "SUCCESS")
        if not is_valid:
            log(f"[MOCK] AVISO: Placa {mock_plate} nao segue padrao brasileiro!", "WARNING")
            return []
        
        if is_authorized:
            log(f"[MOCK] PLACA AUTORIZADA!", "SUCCESS")
        else:
            log(f"[MOCK] Placa nao autorizada", "WARNING")
        
        return [{
            'plate': mock_plate,
            'plate_normalized': mock_normalized,
            'confidence': MOCK_CONFIDENCE,
            'region': 'br',
            'authorized': is_authorized,
            'valid_format': True
        }]
    # ==================== FIM MOCK ====================
    
    usage_data = load_api_usage()
    priority_order = usage_data.get('priority_order', list(range(len(API_KEYS))))
    
    # Tenta cada API key na ordem de prioridade
    for attempt in range(len(API_KEYS)):
        actual_index = priority_order[attempt]
        api_key = API_KEYS[actual_index]
        api_key_display = f"{api_key[:8]}...{api_key[-8:]}" if len(api_key) > 16 else f"{api_key[:8]}..."
        
        log(f"🔑 Tentativa {attempt + 1}/{len(API_KEYS)} - API Key {actual_index + 1}: {api_key_display}", "INFO")
        
        try:
            with open(image_path, 'rb') as img_file:
                files = {'upload': img_file}
                headers = {'Authorization': f'Token {api_key}'}
                response = requests.post(PLATE_API_URL, files=files, headers=headers, timeout=15)
            
            if response.status_code in [200, 201]:
                # Sucesso - incrementa contador e mantém como prioridade
                result = response.json()
                plates = result.get('results', [])
                processing_time = result.get('processing_time', 0)
                
                increment_api_usage(actual_index)
                log(f"[OK] API Key {actual_index + 1} funcionou ({processing_time:.0f}ms)", "SUCCESS")
                
                if plates:
                    log(f"[OK] {len(plates)} placa(s) detectada(s):", "SUCCESS")
                    detected_plates = []
                    authorized_found = False
                    valid_plates_found = False
                    
                    for i, plate in enumerate(plates, 1):
                        plate_text_raw = plate.get('plate', 'N/A')
                        plate_text_normalized = plate_text_raw.replace(' ', '').replace('-', '').upper()
                        confidence = plate.get('score', 0) * 100
                        region = plate.get('region', {}).get('code', 'N/A')
                        
                        # Valida padrão brasileiro
                        is_valid_format = is_valid_brazilian_plate(plate_text_normalized)
                        
                        if not is_valid_format:
                            log(f"   [AVISO] Placa {i}: {plate_text_raw.upper()} (Confianca: {confidence:.1f}%) - PADRAO INVALIDO (nao segue formato brasileiro)", "WARNING")
                            continue  # Ignora placas com padrão inválido
                        
                        # Só processa placas válidas
                        valid_plates_found = True
                        is_authorized = plate_text_normalized in AUTHORIZED_PLATES
                        if is_authorized:
                            authorized_found = True
                        
                        log(f"   [PLACA] {i}: {plate_text_raw.upper()} (Confianca: {confidence:.1f}%, Regiao: {region})", "INFO")
                        if is_authorized:
                            log(f"   [OK] PLACA AUTORIZADA!", "SUCCESS")
                        else:
                            log(f"   [X] Placa nao autorizada", "WARNING")
                        
                        detected_plates.append({
                            'plate': plate_text_raw.upper(),
                            'plate_normalized': plate_text_normalized,
                            'confidence': confidence,
                            'region': region,
                            'authorized': is_authorized,
                            'valid_format': True
                        })
                    
                    # Se não encontrou nenhuma placa válida, retorna vazio (trata como não detectado)
                    if not valid_plates_found:
                        log("🚫 Nenhuma placa válida detectada (padrão brasileiro não reconhecido)", "WARNING")
                        save_plate_result(image_path, {
                            'success': True,
                            'timestamp': datetime.now().isoformat(),
                            'processing_time': processing_time,
                            'plates': [],
                            'authorized_plates': AUTHORIZED_PLATES,
                            'access_granted': False,
                            'gate_opened': False,
                            'api_key_used': actual_index + 1,
                            'message': 'Placas detectadas não seguem padrão brasileiro válido',
                            'api_response': result
                        })
                        return []  # Retorna vazio - não abre cancela
                    
                    # ABRE CANCELA SEMPRE
                    gate_opened = False
                    if auto_open_gate and gate_socket:
                        plate_text = detected_plates[0]['plate'] if detected_plates else "N/A"
                        if authorized_found:
                            log(f"[PLACA] PLACA AUTORIZADA DETECTADA - ABRINDO CANCELA!", "SUCCESS")
                        else:
                            log(f"[PLACA] PLACA NAO AUTORIZADA DETECTADA - ABRINDO CANCELA MESMO ASSIM: {plate_text}", "WARNING")
                        
                        try:
                            success = open_gate_timed(gate_socket, 1)
                            if success:
                                gate_opened = True
                                log(f"[OK] Cancela aberta para: {plate_text}", "SUCCESS")
                        except Exception as e:
                            log(f"[ERRO] Erro ao abrir cancela: {e}", "ERROR")
                    
                    # O entry_count será adicionado no monitor_sec_continuous após incrementar
                    # Aqui apenas preparamos os dados para salvar
                    save_plate_result(image_path, {
                        'success': True,
                        'timestamp': datetime.now().isoformat(),
                        'processing_time': processing_time,
                        'plates': detected_plates,
                        'authorized_plates': AUTHORIZED_PLATES,
                        'access_granted': authorized_found,
                        'gate_opened': gate_opened,
                        'api_key_used': actual_index + 1,
                        'api_response': result
                    })
                    return detected_plates
                else:
                    log("🚫 Nenhuma placa detectada", "INFO")
                    # Não abre a cancela aqui - deixa para a função monitor_sec_continuous fazer as 3 tentativas
                    save_plate_result(image_path, {
                        'success': True,
                        'timestamp': datetime.now().isoformat(),
                        'processing_time': processing_time,
                        'plates': [],
                        'authorized_plates': AUTHORIZED_PLATES,
                        'access_granted': False,
                        'gate_opened': False,
                        'api_key_used': actual_index + 1,
                        'message': 'Nenhuma placa detectada',
                        'api_response': result
                    })
                    return []  # Retorna vazio - não abre cancela
            else:
                # Erro HTTP - reordena e tenta próxima
                status_code = response.status_code
                error_details = ""
                try:
                    error_response = response.json()
                    if isinstance(error_response, dict):
                        if 'detail' in error_response:
                            error_details = f" - {error_response['detail']}"
                        elif 'message' in error_response:
                            error_details = f" - {error_response['message']}"
                        elif 'error' in error_response:
                            error_details = f" - {error_response['error']}"
                except:
                    try:
                        error_text = response.text[:200]
                        if error_text:
                            error_details = f" - {error_text}"
                    except:
                        pass
                
                log(f"[ERRO] API Key {actual_index + 1} falhou: HTTP {status_code}{error_details}", "ERROR")
                
                # Reordena: move esta key para o final
                reorder_api_keys_on_error(actual_index, usage_data)
                
                # Se não é a última tentativa, continua
                if attempt < len(API_KEYS) - 1:
                    log(f"[INFO] Tentando proxima API key...", "INFO")
                    usage_data = load_api_usage()  # Recarrega ordem atualizada
                    priority_order = usage_data.get('priority_order', list(range(len(API_KEYS))))
                    continue
                else:
                    # Todas falharam
                    log(f"[ERRO] TODAS AS API KEYS FALHARAM - ABRINDO CANCELA AUTOMATICAMENTE", "ERROR")
                    gate_opened_due_to_failure = False
                    if auto_open_gate and gate_socket:
                        log("[AVISO] ABRINDO CANCELA POR FALHA TOTAL DAS APIs (fail-open)...", "WARNING")
                        try:
                            success = open_gate_timed(gate_socket, 1)
                            if success:
                                gate_opened_due_to_failure = True
                                log("[OK] Cancela aberta devido a falha total (fail-open)", "SUCCESS")
                        except Exception as e:
                            log(f"[ERRO] Erro ao abrir cancela: {e}", "ERROR")
                    
                    save_plate_result(image_path, {
                        'success': False,
                        'timestamp': datetime.now().isoformat(),
                        'error': f'Erro HTTP {status_code}{error_details}',
                        'status_code': status_code,
                        'api_keys_tried': len(API_KEYS),
                        'access_granted': False,
                        'gate_opened': gate_opened_due_to_failure,
                        'gate_opened_reason': 'fail_open_api_failure' if gate_opened_due_to_failure else None
                    })
                    return []
                
        except requests.exceptions.RequestException as e:
            log(f"[ERRO] API Key {actual_index + 1} falhou: Erro de conexao: {str(e)}", "ERROR")
            reorder_api_keys_on_error(actual_index, usage_data)
            
            if attempt < len(API_KEYS) - 1:
                log(f"[INFO] Tentando proxima API key...", "INFO")
                usage_data = load_api_usage()
                priority_order = usage_data.get('priority_order', list(range(len(API_KEYS))))
                continue
            else:
                log(f"[ERRO] TODAS AS API KEYS FALHARAM - ABRINDO CANCELA AUTOMATICAMENTE", "ERROR")
                gate_opened_due_to_failure = False
                if auto_open_gate and gate_socket:
                    log("[AVISO] ABRINDO CANCELA POR ERRO DE CONEXAO (fail-open)...", "WARNING")
                    try:
                        success = open_gate_timed(gate_socket, 1)
                        if success:
                            gate_opened_due_to_failure = True
                            log("[OK] Cancela aberta devido a falha de conexao (fail-open)", "SUCCESS")
                    except Exception as e:
                        log(f"[ERRO] Erro ao abrir cancela: {e}", "ERROR")
                
                save_plate_result(image_path, {
                    'success': False,
                    'timestamp': datetime.now().isoformat(),
                    'error': f'Erro de conexão: {str(e)}',
                    'api_keys_tried': len(API_KEYS),
                    'access_granted': False,
                    'gate_opened': gate_opened_due_to_failure,
                    'gate_opened_reason': 'fail_open_api_failure' if gate_opened_due_to_failure else None
                })
                return []
        except Exception as e:
            log(f"[ERRO] API Key {actual_index + 1} falhou: Erro na analise: {str(e)}", "ERROR")
            reorder_api_keys_on_error(actual_index, usage_data)
            
            if attempt < len(API_KEYS) - 1:
                log(f"[INFO] Tentando proxima API key...", "INFO")
                usage_data = load_api_usage()
                priority_order = usage_data.get('priority_order', list(range(len(API_KEYS))))
                continue
            else:
                log(f"[ERRO] TODAS AS API KEYS FALHARAM - ABRINDO CANCELA AUTOMATICAMENTE", "ERROR")
                gate_opened_due_to_failure = False
                if auto_open_gate and gate_socket:
                    log("[AVISO] ABRINDO CANCELA POR ERRO (fail-open)...", "WARNING")
                    try:
                        success = open_gate_timed(gate_socket, 1)
                        if success:
                            gate_opened_due_to_failure = True
                            log("[OK] Cancela aberta devido ao erro (fail-open)", "SUCCESS")
                    except Exception as e:
                        log(f"[ERRO] Erro ao abrir cancela: {e}", "ERROR")
                
                save_plate_result(image_path, {
                    'success': False,
                    'timestamp': datetime.now().isoformat(),
                    'error': f'Erro na análise: {str(e)}',
                    'api_keys_tried': len(API_KEYS),
                    'access_granted': False,
                    'gate_opened': gate_opened_due_to_failure,
                    'gate_opened_reason': 'fail_open_api_failure' if gate_opened_due_to_failure else None
                })
                return []
    
    # Não deveria chegar aqui, mas retorna vazio por segurança
    return []

def monitor_sec_continuous():
    """Monitora continuamente a SEC com controle de acesso por placa autorizada."""
    log("", "INFO")
    log("=" * 80, "INFO")
    log("           MONITORAMENTO COM CONTROLE DE ACESSO", "INFO")
    log("=" * 80, "INFO")
    log(f"   SEC: {SEC_IP}:{SEC_PORT} | Camera: {CAM_IP}", "INFO")
    
    if len(AUTHORIZED_PLATES) > 0:
        log(f"   Total de {len(AUTHORIZED_PLATES)} placas autorizadas cadastradas", "INFO")
        preview = ', '.join(AUTHORIZED_PLATES[:10]).upper()
        if len(AUTHORIZED_PLATES) > 10:
            preview += f"..."
        log(f"   Primeiras: {preview}", "INFO")
    else:
        log("   [AVISO] Nenhuma placa autorizada cadastrada", "WARNING")
    
    log("=" * 80, "INFO")
    log("", "INFO")
    
    # Inicializa Firestore
    firebase_parking.init_firestore()
    
    # Inicia servidor webhook LPR (câmera Hikvision ANPR)
    lpr_server = start_lpr_webhook_server()
    lpr_isapi_retry_count = 0  # Contador de retries ISAPI
    lpr_waiting_isapi_response = False  # Flag: aguardando resposta de captura ISAPI
    lpr_isapi_request_time = 0  # Timestamp do último pedido ISAPI
    LPR_ISAPI_TIMEOUT = 5  # Segundos para esperar resposta da captura ISAPI
    LPR_MIN_CONFIDENCE = 90  # Confiança mínima (%) para aceitar placa do webhook
    LPR_LOW_CONF_MAX_RETRIES = 3  # Retries ISAPI para confianca baixa
    lpr_low_conf_retries = 0  # Contador de retries por confianca baixa
    lpr_best_plate = None  # Melhor placa encontrada durante retries
    last_lpr_plate_data = None  # Último evento LPR com placa válida (para o sensor usar)
    last_lpr_plate_time = 0  # Timestamp do último evento LPR armazenado
    lpr_queue_log_time = 0  # Throttle para log de fila LPR (evitar spam)
    
    sock = None
    authorized_openings = 0
    denied_access = 0
    manual_openings = 0
    total_detections = 0
    contador_ciclos = 0
    current_plate_normalized = None  # Placa atual para registro de saída no Firestore
    current_plate_for_gate = None  # Placa para exibir no indicador visual da cancela
    
    # Timer para estatísticas de API keys (10 minutos = 600 segundos)
    API_STATS_INTERVAL = 600  # 10 minutos
    last_api_stats_time = time.time()
    
    try:
        log("[INICIANDO] Iniciando socket...", "INFO")
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(1.0)  # Timeout maior para teste inicial
        log("[TESTE] Testando comunicacao com rele 2...", "INFO")
        test_relay_2(sock, tempo_segundos=0.5)  # Testa relé 2 por 0.5 segundos
        sock.settimeout(0.2)  # Timeout reduzido para 200ms - resposta mais rápida após teste
        log("[MONITORANDO] Monitorando... Pressione Ctrl+C para parar", "INFO")
        log("[INFO] Botao 1: Abertura manual | Botao 2: Controle de acesso automatico", "INFO")
        
        last_pressed = {}
        last_cleanup_time = time.time()
        CLEANUP_INTERVAL = 300  # Limpeza a cada 5 minutos
        last_gate_opened_time = 0  # Timestamp da última abertura de cancela

        processing_vehicle = False  # Flag para evitar múltiplos processamentos simultâneos
        
        # Status do sistema para Firestore
        STATUS_HEARTBEAT = 60  # Heartbeat a cada 60s (reduzido para economizar cota Firebase)
        MIN_STATUS_INTERVAL = 5  # Mínimo 5s entre updates para evitar 429 Quota Exceeded
        last_status_update = 0
        pending_status_update = False  # Flag: há um update pendente aguardando cooldown
        uptime_since = datetime.now().isoformat()
        last_plate_detected = None
        last_plate_time = None
        car_on_loop = False
        gate_is_open = False
        pending_print_plate = None  # Placa pendente para imprimir quando botao for pressionado (teste)
        consecutive_errors = 0  # Contador de erros consecutivos de comunicação
        MAX_CONSECUTIVE_ERRORS = 10  # Após N erros, recria o socket
        last_reconnect_time = 0  # Timestamp da última reconexão
        
        # ==================== WATCHDOG: Detecção de queda da SEC ====================
        # Quando a SEC sofre pico de energia, o socket UDP não dá erro — apenas timeout.
        # O watchdog conta timeouts consecutivos e, se a SEC não responder por
        # SEC_WATCHDOG_TIMEOUT segundos, recria o socket e aguarda a SEC voltar.
        consecutive_timeouts = 0  # Contador de timeouts consecutivos (sem resposta da SEC)
        last_successful_response = time.time()  # Timestamp da última resposta OK da SEC
        SEC_WATCHDOG_TIMEOUT = 10  # Segundos sem resposta = SEC provavelmente caiu
        SEC_RECONNECT_WAIT_INITIAL = 3  # Segundos iniciais entre tentativas de reconexão
        SEC_RECONNECT_WAIT_MAX = 30  # Máximo de segundos entre tentativas (backoff)
        sec_was_offline = False  # Flag: SEC estava offline (para log de reconexão)
        SEC_HEALTH_CHECK_INTERVAL = 10  # Intervalo em segundos para health check ativo
        last_health_check_time = time.time()  # Timestamp do último health check
        
        def push_status(force=False):
            """Envia status ao Firestore com rate limiting (em thread para não bloquear).
            
            Args:
                force: Se True, ignora rate limiting (usado para status inicial/shutdown).
            """
            nonlocal last_status_update, pending_status_update
            now = time.time()
            # Rate limiting: mínimo de MIN_STATUS_INTERVAL entre envios
            if not force and (now - last_status_update) < MIN_STATUS_INTERVAL:
                pending_status_update = True  # Será enviado no próximo heartbeat
                return
            last_status_update = now
            pending_status_update = False
            data = {
                "online": True,
                "car_on_loop": car_on_loop,
                "gate_open": gate_is_open,
                "processing": processing_vehicle,
                "last_plate": last_plate_detected,
                "last_plate_time": last_plate_time,
                "authorized_openings": authorized_openings,
                "manual_openings": manual_openings,
                "total_detections": total_detections,
                "uptime_since": uptime_since,
            }
            threading.Thread(target=firebase_parking.update_system_status, args=(data,), daemon=True).start()
        
        # Envia status inicial
        push_status(force=True)
        
        while True:
            try:
                current_time = time.time()
                contador_ciclos += 1
                
                # Heartbeat periódico ou envio de update pendente
                if current_time - last_status_update >= STATUS_HEARTBEAT or (pending_status_update and current_time - last_status_update >= MIN_STATUS_INTERVAL):
                    push_status(force=True)
                
                # Limpeza periódica do buffer do socket a cada 5 minutos
                if current_time - last_cleanup_time >= CLEANUP_INTERVAL:
                    clear_socket_buffer(sock)
                    last_cleanup_time = current_time
                
                # ==================== PROCESSAR EVENTOS LPR WEBHOOK ====================
                # Verifica se há eventos na fila da câmera LPR (non-blocking)
                # IMPORTANTE: só retira da fila quando NÃO está processando veículo
                # para não perder eventos silenciosamente
                lpr_event = None
                if not processing_vehicle:
                    try:
                        lpr_event = lpr_event_queue.get_nowait()
                    except queue.Empty:
                        lpr_event = None
                elif not lpr_event_queue.empty():
                    if current_time - lpr_queue_log_time >= 5:
                        log(f"[LPR] {lpr_event_queue.qsize()} evento(s) na fila aguardando - processando veiculo atual...", "INFO")
                        lpr_queue_log_time = current_time
                
                if lpr_event:
                    lpr_plate = lpr_event.get("plate")
                    lpr_confidence = lpr_event.get("confidence", 0)
                    lpr_time = lpr_event.get("timestamp", "")
                    
                    # Verifica cooldown
                    time_since_last = current_time - last_gate_opened_time
                    if time_since_last < COOLDOWN_AFTER_GATE_OPEN:
                        log(f"[LPR] Evento ignorado - cooldown ativo ({time_since_last:.1f}s)", "INFO")
                    elif lpr_plate:
                        # Placa reconhecida pela câmera
                        plate_normalized = lpr_plate.replace(' ', '').replace('-', '').upper()
                        
                        # Valida padrão brasileiro
                        if not is_valid_brazilian_plate(plate_normalized):
                            log(f"[LPR] Placa {lpr_plate} formato nao padrao (conf={lpr_confidence}) - armazenando para uso no laco", "WARNING")
                            # Armazena mesmo com formato irregular - pode ser leitura parcial útil
                            last_lpr_plate_data = {
                                "plate": lpr_plate,
                                "plate_normalized": plate_normalized,
                                "confidence": lpr_confidence,
                                "timestamp": lpr_time
                            }
                            last_lpr_plate_time = time.time()
                        elif lpr_confidence < LPR_MIN_CONFIDENCE:
                            # Confianca baixa - pede nova captura via ISAPI
                            log(f"[LPR] Confianca baixa: {lpr_plate} ({lpr_confidence}% < {LPR_MIN_CONFIDENCE}%) - retry {lpr_low_conf_retries+1}/{LPR_LOW_CONF_MAX_RETRIES}", "WARNING")
                            # Guarda melhor placa ate agora
                            if not lpr_best_plate or lpr_confidence > lpr_best_plate.get('confidence', 0):
                                lpr_best_plate = {"plate": lpr_plate, "plate_normalized": plate_normalized, "confidence": lpr_confidence, "timestamp": lpr_time}
                            lpr_low_conf_retries += 1
                            if lpr_low_conf_retries <= LPR_LOW_CONF_MAX_RETRIES:
                                trigger_camera_capture_isapi()
                            else:
                                # Max retries - usa melhor placa encontrada
                                best = lpr_best_plate
                                log(f"[LPR] Max retries ({LPR_LOW_CONF_MAX_RETRIES}) - usando melhor placa: {best['plate']} ({best['confidence']}%)", "WARNING")
                                lpr_event_queue.put({
                                    "plate": best['plate'],
                                    "confidence": best['confidence'],
                                    "timestamp": best['timestamp'],
                                    "source": "best_retry"
                                })
                                lpr_low_conf_retries = 0
                                lpr_best_plate = None
                        elif plate_normalized in AUTHORIZED_PLATES or TEST_MODE:
                            # === PLACA AUTORIZADA VIA LPR (ou TEST_MODE) ===
                            lpr_low_conf_retries = 0
                            lpr_best_plate = None
                            processing_vehicle = True
                            total_detections += 1
                            push_status()
                            
                            # TESTE: primeiro carro - espera botao para imprimir + abrir
                            if TEST_MODE and print_count < 1 and plate_normalized not in AUTHORIZED_PLATES:
                                log(f"[LPR-TESTE] PLACA DETECTADA: {lpr_plate} (conf={lpr_confidence})", "SUCCESS")
                                log("[LPR-TESTE] AGUARDANDO BOTAO PARA IMPRIMIR + ABRIR CANCELA...", "WARNING")
                                
                                try:
                                    gate_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                    gate_sock.settimeout(1.0)
                                    
                                    # Espera botao manual (ate 60s)
                                    wait_btn_start = time.time()
                                    btn_pressed = False
                                    while time.time() - wait_btn_start < 60:
                                        if check_manual_button(gate_sock):
                                            btn_pressed = True
                                            break
                                        time.sleep(0.3)
                                    
                                    if btn_pressed:
                                        log("[LPR-TESTE] BOTAO PRESSIONADO - IMPRIMINDO + ABRINDO CANCELA", "SUCCESS")
                                        # Imprime ticket completo
                                        print_plate_receipt(lpr_plate)
                                        # Abre cancela
                                        if open_gate_timed(gate_sock, 1, plate=current_plate_for_gate):
                                            gate_is_open = True
                                            last_gate_opened_time = time.time()
                                            authorized_openings += 1
                                            push_status()
                                            increment_authorized_opening(plate_normalized, attempt_num=1)
                                        
                                        # Registra no Firebase
                                        tid = generate_ticket_id()
                                        firebase_parking.register_entry_async(
                                            plate=lpr_plate,
                                            plate_normalized=plate_normalized,
                                            is_authorized=False,
                                            vehicle_type='visitante',
                                            owner_name='',
                                            confidence=lpr_confidence,
                                            gate_opened_by='manual',
                                            ticket_id=tid
                                        )
                                        last_plate_detected = lpr_plate
                                        last_plate_time = datetime.now().isoformat()
                                        push_status()
                                        
                                        # Aguarda veiculo sair
                                        wait_start = time.time()
                                        while time.time() - wait_start < 15:
                                            try:
                                                cmd_wait = bytes([0x55, 0xAA, 0x02, 0x00])
                                                gate_sock.sendto(cmd_wait, (SEC_IP, SEC_PORT))
                                                try:
                                                    resp_wait, _ = gate_sock.recvfrom(1024)
                                                    if len(resp_wait) >= 8 and resp_wait[0:2] == bytes([0x55, 0xAA]) and resp_wait[2] == 0x02:
                                                        b2_wait = resp_wait[7]
                                                        if bool(b2_wait & 0x04):
                                                            break
                                                except socket.timeout:
                                                    pass
                                            except Exception:
                                                pass
                                            time.sleep(0.3)
                                        time.sleep(WAIT_AFTER_GATE_OPEN)
                                    else:
                                        log("[LPR-TESTE] Timeout esperando botao - nao imprimiu", "WARNING")
                                    
                                    gate_sock.close()
                                except Exception as e:
                                    log(f"[LPR-TESTE] Erro: {e}", "ERROR")
                                finally:
                                    processing_vehicle = False
                                    current_plate_for_gate = None
                                    gate_is_open = False
                                    push_status()
                                    lpr_isapi_retry_count = 0
                                    lpr_waiting_isapi_response = False
                            else:
                                # Fluxo normal: abre cancela automaticamente
                                if TEST_MODE and plate_normalized not in AUTHORIZED_PLATES:
                                    log(f"[LPR-TESTE] PLACA DETECTADA VIA CAMERA (MODO TESTE): {lpr_plate} (conf={lpr_confidence})", "SUCCESS")
                                    log("[LPR-TESTE] ABRINDO CANCELA - Modo teste ativo (qualquer placa abre)", "SUCCESS")
                                else:
                                    log_plate(lpr_plate, confidence=lpr_confidence, authorized=True, source="Camera LPR")
                                    log("[LPR-CANCELA] ABRINDO CANCELA AUTOMATICAMENTE", "SUCCESS")
                                
                                try:
                                    gate_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                    gate_sock.settimeout(1.0)
                                    if open_gate_timed(gate_sock, 1, plate=current_plate_for_gate):
                                        gate_is_open = True
                                        last_gate_opened_time = time.time()
                                        authorized_openings += 1
                                        push_status()
                                        increment_authorized_opening(plate_normalized, attempt_num=1)
                                    
                                    # Registra entrada no Firestore
                                    is_actually_authorized = plate_normalized in AUTHORIZED_PLATES
                                    info = PLATE_INFO.get(plate_normalized, {})
                                    current_plate_normalized = plate_normalized
                                    current_plate_for_gate = lpr_plate
                                    firebase_parking.register_entry_async(
                                        plate=lpr_plate,
                                        plate_normalized=plate_normalized,
                                        is_authorized=is_actually_authorized,
                                        vehicle_type=info.get('tipo', 'morador') if is_actually_authorized else 'visitante',
                                        owner_name=info.get('nome', '') if is_actually_authorized else '',
                                        confidence=lpr_confidence,
                                        gate_opened_by='auto'
                                    )
                                    last_plate_detected = lpr_plate
                                    last_plate_time = datetime.now().isoformat()
                                    push_status()
                                    
                                    # Aguarda veículo sair do laço
                                    wait_start = time.time()
                                    while time.time() - wait_start < 15:
                                        try:
                                            cmd_wait = bytes([0x55, 0xAA, 0x02, 0x00])
                                            gate_sock.sendto(cmd_wait, (SEC_IP, SEC_PORT))
                                            try:
                                                resp_wait, _ = gate_sock.recvfrom(1024)
                                                if len(resp_wait) >= 8 and resp_wait[0:2] == bytes([0x55, 0xAA]) and resp_wait[2] == 0x02:
                                                    b2_wait = resp_wait[7]
                                                    if bool(b2_wait & 0x04):
                                                        break
                                            except socket.timeout:
                                                pass
                                        except Exception:
                                            pass
                                        time.sleep(0.3)
                                    
                                    time.sleep(WAIT_AFTER_GATE_OPEN)
                                    gate_sock.close()
                                except Exception as e:
                                    log(f"[LPR] Erro ao processar placa autorizada: {e}", "ERROR")
                                finally:
                                    processing_vehicle = False
                                    current_plate_for_gate = None
                                    gate_is_open = False
                                    push_status()
                                    lpr_isapi_retry_count = 0
                                    lpr_waiting_isapi_response = False
                        else:
                            # === PLACA NAO AUTORIZADA VIA LPR ===
                            lpr_low_conf_retries = 0
                            lpr_best_plate = None
                            # Armazena a placa para o sensor usar quando o carro chegar no laço
                            last_lpr_plate_data = {
                                "plate": lpr_plate,
                                "plate_normalized": plate_normalized,
                                "confidence": lpr_confidence,
                                "timestamp": lpr_time
                            }
                            last_lpr_plate_time = time.time()
                            
                            if car_on_loop:
                                # Carro já está no laço - processa agora
                                processing_vehicle = True
                                total_detections += 1
                                denied_access += 1
                            else:
                                # Carro ainda não chegou no laço - armazena para o sensor tratar
                                log(f"[LPR] Placa nao autorizada: {lpr_plate} (conf={lpr_confidence}) - armazenada para quando carro chegar no laco", "INFO")
                            increment_denied_opening(plate_normalized, attempt_num=1)
                            push_status()
                            
                            if car_on_loop:
                                log_plate(lpr_plate, confidence=lpr_confidence, authorized=False, source="Camera LPR")
                                log("[LPR-AGUARDANDO] Aguardando botao manual para abrir cancela...", "INFO")
                            
                            if car_on_loop:
                                try:
                                    gate_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                    gate_sock.settimeout(1.0)
                                    
                                    # Espera até 30s pelo botão manual
                                    wait_manual_start = time.time()
                                    WAIT_MANUAL_TIMEOUT = 30
                                    manual_pressed = False
                                    
                                    while time.time() - wait_manual_start < WAIT_MANUAL_TIMEOUT:
                                        if check_manual_button(gate_sock):
                                            manual_pressed = True
                                            break
                                        
                                        # Verifica se veículo saiu do laço
                                        try:
                                            cmd_chk = bytes([0x55, 0xAA, 0x02, 0x00])
                                            gate_sock.sendto(cmd_chk, (SEC_IP, SEC_PORT))
                                            resp_chk, _ = gate_sock.recvfrom(1024)
                                            if len(resp_chk) >= 8 and resp_chk[0:2] == bytes([0x55, 0xAA]) and resp_chk[2] == 0x02:
                                                b2_chk = resp_chk[7]
                                                if bool(b2_chk & 0x04):  # Saiu do laço
                                                    log("[LPR] Veículo saiu do laço - cancelando espera", "INFO")
                                                    break
                                        except Exception:
                                            pass
                                        
                                        time.sleep(0.3)
                                    
                                    if manual_pressed:
                                        log("[LPR-MANUAL] BOTAO PRESSIONADO - ABRINDO CANCELA...", "SUCCESS")
                                        
                                        # ABRE CANCELA IMEDIATAMENTE
                                        if open_gate_timed(gate_sock, 1, plate=current_plate_for_gate):
                                            manual_openings += 1
                                            increment_manual_opening()
                                            last_gate_opened_time = time.time()
                                            gate_is_open = True
                                            push_status()
                                        else:
                                            log("[ERRO] CANCELA NAO ABRIU!", "ERROR")
                                        
                                        # Usa placa do webhook diretamente
                                        confirmed_plate = lpr_plate
                                        
                                        # Registra entrada visitante no Firebase
                                        current_plate_normalized = plate_normalized
                                        current_plate_for_gate = lpr_plate
                                        tid = generate_ticket_id()
                                        session_id = firebase_parking.register_entry_async(
                                            plate=confirmed_plate,
                                            plate_normalized=plate_normalized,
                                            is_authorized=False,
                                            vehicle_type='visitante',
                                            owner_name=None,
                                            confidence=lpr_confidence,
                                            gate_opened_by='manual',
                                            ticket_id=tid
                                        )
                                        
                                        # Imprime ticket SOMENTE se for placa de teste
                                        if session_id and (not TEST_PRINT_PLATE or plate_normalized == TEST_PRINT_PLATE):
                                            print_ticket_receipt(confirmed_plate, session_id)
                                        elif session_id:
                                            log(f"[PRINTER] Placa {confirmed_plate} - sem impressao (teste so para {TEST_PRINT_PLATE})", "INFO")
                                        
                                        last_plate_detected = confirmed_plate
                                        last_plate_time = datetime.now().isoformat()
                                        push_status()
                                        
                                        # Aguarda veículo sair do laço
                                        wait_start = time.time()
                                        while time.time() - wait_start < 15:
                                            try:
                                                cmd_wait = bytes([0x55, 0xAA, 0x02, 0x00])
                                                gate_sock.sendto(cmd_wait, (SEC_IP, SEC_PORT))
                                                try:
                                                    resp_wait, _ = gate_sock.recvfrom(1024)
                                                    if len(resp_wait) >= 8 and resp_wait[0:2] == bytes([0x55, 0xAA]) and resp_wait[2] == 0x02:
                                                        b2_wait = resp_wait[7]
                                                        if bool(b2_wait & 0x04):
                                                            break
                                                except socket.timeout:
                                                    pass
                                            except Exception:
                                                pass
                                            time.sleep(0.3)
                                        
                                        time.sleep(WAIT_AFTER_GATE_OPEN)
                                    else:
                                        log("[LPR] Timeout esperando botao manual - cancela NAO aberta", "WARNING")
                                    
                                    gate_sock.close()
                                except Exception as e:
                                    log(f"[LPR] Erro ao processar placa nao autorizada: {e}", "ERROR")
                                finally:
                                    processing_vehicle = False
                                    current_plate_for_gate = None
                                    gate_is_open = False
                                    push_status()
                                    lpr_isapi_retry_count = 0
                                    lpr_waiting_isapi_response = False
                    else:
                        # Placa NÃO reconhecida pela câmera — verifica se carro está no laço
                        # Se sim, pede nova captura via ISAPI (retry)
                        if car_on_loop and lpr_isapi_retry_count < LPR_MAX_ISAPI_RETRIES:
                            lpr_isapi_retry_count += 1
                            log(f"[LPR] Placa nao reconhecida - carro no laco - retry ISAPI {lpr_isapi_retry_count}/{LPR_MAX_ISAPI_RETRIES}", "WARNING")
                            trigger_camera_capture_isapi()
                            lpr_waiting_isapi_response = True
                            lpr_isapi_request_time = time.time()
                        elif car_on_loop and lpr_isapi_retry_count >= LPR_MAX_ISAPI_RETRIES:
                            # Esgotou retries ISAPI - aguarda botão manual
                            log(f"[LPR] Retries ISAPI esgotados ({LPR_MAX_ISAPI_RETRIES}) - aguardando botao manual", "WARNING")
                            lpr_isapi_retry_count = 0
                            lpr_waiting_isapi_response = False
                            
                            processing_vehicle = True
                            push_status()
                            
                            try:
                                gate_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                gate_sock.settimeout(1.0)
                                
                                wait_manual_start = time.time()
                                WAIT_MANUAL_TIMEOUT = 30
                                manual_pressed = False
                                
                                while time.time() - wait_manual_start < WAIT_MANUAL_TIMEOUT:
                                    if check_manual_button(gate_sock):
                                        manual_pressed = True
                                        break
                                    try:
                                        cmd_chk = bytes([0x55, 0xAA, 0x02, 0x00])
                                        gate_sock.sendto(cmd_chk, (SEC_IP, SEC_PORT))
                                        resp_chk, _ = gate_sock.recvfrom(1024)
                                        if len(resp_chk) >= 8 and resp_chk[0:2] == bytes([0x55, 0xAA]) and resp_chk[2] == 0x02:
                                            b2_chk = resp_chk[7]
                                            if bool(b2_chk & 0x04):
                                                log("[LPR] Veículo saiu do laço - cancelando espera", "INFO")
                                                break
                                    except Exception:
                                        pass
                                    time.sleep(0.3)
                                
                                if manual_pressed:
                                    log("[LPR-MANUAL] BOTAO PRESSIONADO - ABRINDO CANCELA SEM PLACA", "SUCCESS")
                                    if open_gate_timed(gate_sock, 1, plate=current_plate_for_gate):
                                        manual_openings += 1
                                        increment_manual_opening()
                                        increment_without_recognition_opening()
                                        last_gate_opened_time = time.time()
                                        gate_is_open = True
                                        push_status()
                                    
                                    # Registra entrada sem placa no Firebase
                                    tid = generate_ticket_id()
                                    firebase_parking.register_entry_async(
                                        plate="DESCONHECIDA",
                                        plate_normalized="DESCONHECIDA",
                                        is_authorized=False,
                                        vehicle_type='visitante',
                                        owner_name=None,
                                        confidence=0,
                                        gate_opened_by='manual',
                                        ticket_id=tid
                                    )
                                    
                                    # Aguarda veículo sair
                                    wait_start = time.time()
                                    while time.time() - wait_start < 15:
                                        try:
                                            cmd_wait = bytes([0x55, 0xAA, 0x02, 0x00])
                                            gate_sock.sendto(cmd_wait, (SEC_IP, SEC_PORT))
                                            try:
                                                resp_wait, _ = gate_sock.recvfrom(1024)
                                                if len(resp_wait) >= 8 and resp_wait[0:2] == bytes([0x55, 0xAA]) and resp_wait[2] == 0x02:
                                                    b2_wait = resp_wait[7]
                                                    if bool(b2_wait & 0x04):
                                                        break
                                            except socket.timeout:
                                                pass
                                        except Exception:
                                            pass
                                        time.sleep(0.3)
                                    
                                    time.sleep(WAIT_AFTER_GATE_OPEN)
                                else:
                                    log("[LPR] Timeout esperando botao - cancela NAO aberta", "WARNING")
                                
                                gate_sock.close()
                            except Exception as e:
                                log(f"[LPR] Erro: {e}", "ERROR")
                            finally:
                                processing_vehicle = False
                                current_plate_for_gate = None
                                gate_is_open = False
                                push_status()
                        else:
                            log("[LPR] Placa nao reconhecida e nenhum carro no laco - ignorando", "INFO")
                            lpr_isapi_retry_count = 0
                            lpr_waiting_isapi_response = False
                
                # Se aguardando resposta ISAPI e timeout, reseta
                if lpr_waiting_isapi_response and (current_time - lpr_isapi_request_time) > LPR_ISAPI_TIMEOUT:
                    log("[LPR-ISAPI] Timeout aguardando resposta da camera - resetando", "WARNING")
                    lpr_waiting_isapi_response = False
                
                # ==================== FIM PROCESSAR EVENTOS LPR ====================
                
                # Drena pacotes antigos do buffer antes de enviar novo comando
                try:
                    sock.setblocking(False)
                    drained = 0
                    while drained < 50:
                        try:
                            sock.recvfrom(1024)
                            drained += 1
                        except socket.error:
                            break
                    sock.setblocking(True)
                    sock.settimeout(0.2)
                    if drained > 5:
                        log(f"🧹 Buffer limpo: {drained} pacote(s) antigo(s) removido(s)", "INFO")
                except:
                    try:
                        sock.setblocking(True)
                        sock.settimeout(0.2)
                    except:
                        pass
                
                cmd = bytes([0x55, 0xAA, 0x02, 0x00])
                sock.sendto(cmd, (SEC_IP, SEC_PORT))
                
                try:
                    resp, addr = sock.recvfrom(1024)
                    consecutive_errors = 0  # Comunicacao OK - reseta contador
                    consecutive_timeouts = 0  # Resposta OK - SEC está viva
                    last_successful_response = time.time()
                    
                    # Se a SEC estava offline e agora respondeu, loga reconexão
                    if sec_was_offline:
                        sec_was_offline = False
                        log("[RECONEXAO] ========================================", "SUCCESS")
                        log("[RECONEXAO] SEC RECONECTADA COM SUCESSO!", "SUCCESS")
                        log("[RECONEXAO] Sistema voltou ao normal automaticamente", "SUCCESS")
                        log("[RECONEXAO] ========================================", "SUCCESS")
                        push_status(force=True)
                    
                    if len(resp) >= 8 and resp[0:2] == bytes([0x55, 0xAA]) and resp[2] == 0x02:
                        b1 = resp[7]
                        button1 = not bool(b1 & 0x02)
                        button2 = not bool(b1 & 0x04)
                        
                        botoes = {"Botão 1": button1, "Botão 2": button2}
                        pressed = {k: v for k, v in botoes.items() if v}
                        car_on_loop = button2  # Atualiza estado do laço
                        
                        # Push status imediato quando laço muda de estado
                        if car_on_loop != last_pressed.get("_car_on_loop", None):
                            last_pressed["_car_on_loop"] = car_on_loop
                            push_status()
                        
                        # Verifica se botão 2 foi pressionado (novo evento)
                        # Ignora se estiver em cooldown ou processando outro veículo
                        current_time_check = time.time()
                        time_since_last_gate = current_time_check - last_gate_opened_time
                        
                        if button2 and (not last_pressed.get("Botão 2", False)):
                            # Verifica cooldown - ignora detecções muito próximas
                            if time_since_last_gate < COOLDOWN_AFTER_GATE_OPEN:
                                last_pressed = pressed
                                time.sleep(0.05)
                                continue
                            
                            # Verifica se já está processando outro veículo
                            if processing_vehicle:
                                last_pressed = pressed
                                time.sleep(0.05)
                                continue
                            
                            processing_vehicle = True
                            log(f"[VEICULO] Veiculo detectado - {time.strftime('%H:%M:%S')}", "INFO")
                            total_detections += 1
                            push_status()  # Status imediato: processando
                            
                            gate_opened = False
                            manual_override = False
                            
                            try:
                                gate_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                gate_sock.settimeout(1.0)
                                
                                # Verifica botão manual antes de iniciar
                                if check_manual_button(gate_sock):
                                    log("[MANUAL] BOTAO MANUAL PRESSIONADO - ABRINDO CANCELA", "SUCCESS")
                                    if open_gate_timed(gate_sock, 1, plate=current_plate_for_gate):
                                        manual_openings += 1
                                        increment_manual_opening()
                                        last_gate_opened_time = time.time()
                                        gate_opened = True
                                        manual_override = True
                                
                                if not manual_override:
                                    # ======================================================================
                                    # FLUXO PRIORIDADE LPR: Verifica dados LPR armazenados e fila
                                    # A câmera LPR envia placas via webhook - priorizar sobre captura+API
                                    # ======================================================================
                                    lpr_plate_found = None
                                    
                                    # 1) Verifica se já tem placa armazenada (câmera detectou antes do laço)
                                    if last_lpr_plate_data and (time.time() - last_lpr_plate_time) < 120:
                                        lpr_plate_found = last_lpr_plate_data
                                        log(f"[SENSOR-LPR] Usando placa armazenada: {last_lpr_plate_data['plate']} (conf={last_lpr_plate_data.get('confidence', 0)}, idade={time.time() - last_lpr_plate_time:.1f}s)", "SUCCESS")
                                        last_lpr_plate_data = None  # Limpa para não reusar
                                    
                                    # 2) Se não tem armazenada, tenta MNPR direto (5x com 1s delay)
                                    if not lpr_plate_found:
                                        log("[SENSOR] Veiculo no laco - solicitando MNPR da camera...", "INFO")
                                        
                                        MNPR_ATTEMPTS = 5
                                        for attempt in range(1, MNPR_ATTEMPTS + 1):
                                            log(f"[MNPR] Tentativa {attempt}/{MNPR_ATTEMPTS}...", "INFO")
                                            mnpr_result = request_mnpr_plate()
                                            if mnpr_result:
                                                lpr_plate_found = mnpr_result
                                                log(f"[MNPR] Placa obtida: {mnpr_result['plate']} (conf={mnpr_result.get('confidence', 0)})", "SUCCESS")
                                                break
                                            
                                            # Checa webhook entre tentativas MNPR
                                            try:
                                                lpr_ev = lpr_event_queue.get_nowait()
                                                lpr_pl = lpr_ev.get("plate", "")
                                                if lpr_pl and lpr_pl.lower() != "unknown":
                                                    lpr_plate_found = lpr_ev
                                                    log(f"[SENSOR-LPR] Placa via webhook: {lpr_pl} (conf={lpr_ev.get('confidence', 0)})", "SUCCESS")
                                                    break
                                            except queue.Empty:
                                                pass
                                            
                                            # Checa botao manual entre tentativas
                                            if check_manual_button(gate_sock):
                                                log("[MANUAL] BOTAO PRESSIONADO - tentando MNPR mais 3x...", "INFO")
                                                for extra in range(1, 4):
                                                    time.sleep(1)
                                                    log(f"[MNPR-EXTRA] Tentativa {extra}/3...", "INFO")
                                                    mnpr_result = request_mnpr_plate()
                                                    if mnpr_result:
                                                        lpr_plate_found = mnpr_result
                                                        log(f"[MNPR] Placa obtida: {mnpr_result['plate']} (conf={mnpr_result.get('confidence', 0)})", "SUCCESS")
                                                        break
                                                # Abre cancela (com ou sem placa)
                                                if not lpr_plate_found:
                                                    log("[MANUAL] ABRINDO CANCELA (sem placa)", "SUCCESS")
                                                    if open_gate_timed(gate_sock, 1, plate=current_plate_for_gate):
                                                        manual_openings += 1
                                                        increment_manual_opening()
                                                        increment_sem_placa()
                                                        last_gate_opened_time = time.time()
                                                        gate_opened = True
                                                        manual_override = True
                                                        log_gate_result(plate=None, source="Manual (sem placa)")
                                                break
                                            
                                            time.sleep(1)  # Delay 1s entre tentativas MNPR
                                        
                                        # Se 5 tentativas falharam e ninguem apertou botao, abre sem placa
                                        if not lpr_plate_found and not manual_override:
                                            log("[SENSOR] MNPR nao detectou placa em 5 tentativas - abrindo sem placa", "WARNING")
                                            if open_gate_timed(gate_sock, 1, plate=current_plate_for_gate):
                                                increment_sem_placa()
                                                last_gate_opened_time = time.time()
                                                gate_opened = True
                                                manual_override = True
                                                log_gate_result(plate=None, source="MNPR falhou (sem placa)")
                                    
                                    # 2) Se encontrou placa via LPR, usa direto (sem gastar API)
                                    if lpr_plate_found and not manual_override:
                                        lpr_pl = lpr_plate_found["plate"]
                                        lpr_conf = lpr_plate_found.get("confidence", 0)
                                        pl_norm = lpr_pl.replace(' ', '').replace('-', '').upper()
                                        
                                        total_detections += 1
                                        
                                        if pl_norm in AUTHORIZED_PLATES or TEST_MODE:
                                            # === PLACA AUTORIZADA VIA LPR + SENSOR ===
                                            if TEST_MODE and pl_norm not in AUTHORIZED_PLATES:
                                                log(f"[SENSOR-LPR-TESTE] PLACA DETECTADA (MODO TESTE): {lpr_pl} (conf={lpr_conf})", "SUCCESS")
                                                log("[SENSOR-LPR-TESTE] ABRINDO CANCELA - Modo teste ativo", "SUCCESS")
                                            else:
                                                log_plate(lpr_pl, confidence=lpr_conf, authorized=True, source="Sensor+LPR")
                                                log("[SENSOR-LPR] ABRINDO CANCELA", "SUCCESS")
                                            if open_gate_timed(gate_sock, 1, plate=lpr_pl):
                                                gate_opened = True
                                                gate_is_open = True
                                                last_gate_opened_time = time.time()
                                                authorized_openings += 1
                                                push_status()
                                                increment_authorized_opening(pl_norm, attempt_num=1)
                                            
                                            # Imprime placa na impressora termica
                                            print_plate_receipt(lpr_pl)
                                            
                                            info = PLATE_INFO.get(pl_norm, {})
                                            current_plate_normalized = pl_norm
                                            current_plate_for_gate = lpr_pl
                                            firebase_parking.register_entry_async(
                                                plate=lpr_pl,
                                                plate_normalized=pl_norm,
                                                is_authorized=True,
                                                vehicle_type=info.get('tipo', 'morador'),
                                                owner_name=info.get('nome', ''),
                                                confidence=lpr_conf,
                                                gate_opened_by='auto_lpr'
                                            )
                                            last_plate_detected = lpr_pl
                                            last_plate_time = datetime.now().isoformat()
                                            push_status()
                                        else:
                                            # === PLACA NAO AUTORIZADA VIA LPR + SENSOR ===
                                            denied_access += 1
                                            increment_denied_opening(pl_norm, attempt_num=1)
                                            
                                            log_plate(lpr_pl, confidence=lpr_conf, authorized=False, source="Sensor+LPR")
                                            log("[SENSOR-LPR] PLACA NAO AUTORIZADA - ABRINDO CANCELA", "SUCCESS")
                                            
                                            # ABRE CANCELA IMEDIATAMENTE (sem esperar botao)
                                            if open_gate_timed(gate_sock, 1, plate=lpr_pl):
                                                gate_opened = True
                                                gate_is_open = True
                                                last_gate_opened_time = time.time()
                                                push_status()
                                            
                                            # Registra no Firebase como visitante
                                            current_plate_normalized = pl_norm
                                            current_plate_for_gate = lpr_pl
                                            tid = generate_ticket_id()
                                            session_id = firebase_parking.register_entry_async(
                                                plate=lpr_pl,
                                                plate_normalized=pl_norm,
                                                is_authorized=False,
                                                vehicle_type='visitante',
                                                owner_name=None,
                                                confidence=lpr_conf,
                                                gate_opened_by='auto_lpr',
                                                ticket_id=tid
                                            )
                                            
                                            # Imprime ticket
                                            if session_id and (not TEST_PRINT_PLATE or pl_norm == TEST_PRINT_PLATE):
                                                print_ticket_receipt(lpr_pl, session_id)
                                            elif session_id:
                                                log(f"[PRINTER] Placa {lpr_pl} - sem impressao (teste so para {TEST_PRINT_PLATE})", "INFO")
                                            
                                            last_plate_detected = lpr_pl
                                            last_plate_time = datetime.now().isoformat()
                                            push_status()
                                    
                                    # 3) Se NÃO encontrou placa via LPR, aguarda botão manual ou veículo sair
                                    elif not manual_override and not gate_opened:
                                        log("[SENSOR] Nenhuma placa via LPR - aguardando botao manual ou veiculo sair...", "WARNING")
                                        
                                        wait_start = time.time()
                                        manual_grace_start = None
                                        while time.time() - wait_start < TIMEOUT_AUTOMATIC_OPEN:
                                            if check_manual_button(gate_sock):
                                                log("[MANUAL] BOTAO MANUAL PRESSIONADO - ABRINDO CANCELA", "SUCCESS")
                                                if open_gate_timed(gate_sock, 1, plate=current_plate_for_gate):
                                                    manual_openings += 1
                                                    increment_manual_opening()
                                                    increment_without_recognition_opening()
                                                    last_gate_opened_time = time.time()
                                                    gate_opened = True
                                                
                                                # Registra entrada sem placa no Firebase (obtem session_id)
                                                tid = generate_ticket_id()
                                                session_id = firebase_parking.register_entry_async(
                                                    plate="DESCONHECIDA",
                                                    plate_normalized="DESCONHECIDA",
                                                    is_authorized=False,
                                                    vehicle_type='visitante',
                                                    owner_name=None,
                                                    confidence=0,
                                                    gate_opened_by='manual',
                                                    ticket_id=tid
                                                )
                                                
                                                # Placa desconhecida - nao imprime ticket
                                                log("[PRINTER] Placa desconhecida - sem impressao", "INFO")
                                                
                                                push_status()
                                                break
                                            
                                            # Verifica se chegou evento LPR enquanto espera
                                            try:
                                                lpr_ev_late = lpr_event_queue.get_nowait()
                                                lpr_pl_late = lpr_ev_late.get("plate", "")
                                                if lpr_pl_late and lpr_pl_late.lower() != "unknown":
                                                    pl_norm_late = lpr_pl_late.replace(' ', '').replace('-', '').upper()
                                                    if is_valid_brazilian_plate(pl_norm_late):
                                                        log(f"[SENSOR-LPR] Placa recebida tardiamente: {lpr_pl_late} (conf={lpr_ev_late.get('confidence', 0)})", "SUCCESS")
                                                        
                                                        if pl_norm_late in AUTHORIZED_PLATES or TEST_MODE:
                                                            if TEST_MODE and pl_norm_late not in AUTHORIZED_PLATES:
                                                                log("[SENSOR-LPR-TESTE] ABRINDO CANCELA - Modo teste ativo", "SUCCESS")
                                                            else:
                                                                log("[SENSOR-LPR] PLACA AUTORIZADA - ABRINDO CANCELA", "SUCCESS")
                                                            if open_gate_timed(gate_sock, 1, plate=current_plate_for_gate):
                                                                gate_opened = True
                                                                gate_is_open = True
                                                                last_gate_opened_time = time.time()
                                                                authorized_openings += 1
                                                                push_status()
                                                                increment_authorized_opening(pl_norm_late, attempt_num=1)
                                                            
                                                            # Imprime placa na impressora termica
                                                            print_plate_receipt(lpr_pl_late)
                                                            
                                                            info = PLATE_INFO.get(pl_norm_late, {})
                                                            current_plate_normalized = pl_norm_late
                                                            current_plate_for_gate = lpr_pl_late
                                                            firebase_parking.register_entry_async(
                                                                plate=lpr_pl_late,
                                                                plate_normalized=pl_norm_late,
                                                                is_authorized=True,
                                                                vehicle_type=info.get('tipo', 'morador'),
                                                                owner_name=info.get('nome', ''),
                                                                confidence=lpr_ev_late.get('confidence', 0),
                                                                gate_opened_by='auto_lpr'
                                                            )
                                                            last_plate_detected = lpr_pl_late
                                                            last_plate_time = datetime.now().isoformat()
                                                            push_status()
                                                            break
                                                        else:
                                                            log(f"[SENSOR-LPR] PLACA NAO AUTORIZADA: {lpr_pl_late} - aguardando botao manual", "WARNING")
                                            except queue.Empty:
                                                pass
                                            
                                            # Verifica se veiculo saiu do laco
                                            # Grace period: espera mais 5s apos sair para o porteiro apertar
                                            try:
                                                cmd_chk = bytes([0x55, 0xAA, 0x02, 0x00])
                                                gate_sock.sendto(cmd_chk, (SEC_IP, SEC_PORT))
                                                resp_chk, _ = gate_sock.recvfrom(1024)
                                                if len(resp_chk) >= 8 and resp_chk[0:2] == bytes([0x55, 0xAA]) and resp_chk[2] == 0x02:
                                                    b2_chk = resp_chk[7]
                                                    car_left = bool(b2_chk & 0x04)
                                                    if car_left:
                                                        if manual_grace_start is None:
                                                            manual_grace_start = time.time()
                                                            log("[INFO] Veiculo saiu do laco - aguardando botao por mais 5s...", "INFO")
                                                        elif (time.time() - manual_grace_start) >= 5:
                                                            log("[INFO] Grace period expirou - liberando sistema", "INFO")
                                                            break
                                                    else:
                                                        manual_grace_start = None  # Carro voltou
                                            except:
                                                pass
                                            time.sleep(0.3)
                                
                                # Aguarda veículo sair do laço (se cancela foi aberta)
                                if gate_opened:
                                    wait_start = time.time()
                                    max_wait = 15
                                    
                                    while time.time() - wait_start < max_wait:
                                        try:
                                            cmd_wait = bytes([0x55, 0xAA, 0x02, 0x00])
                                            gate_sock.sendto(cmd_wait, (SEC_IP, SEC_PORT))
                                            try:
                                                resp_wait, _ = gate_sock.recvfrom(1024)
                                                if len(resp_wait) >= 8 and resp_wait[0:2] == bytes([0x55, 0xAA]) and resp_wait[2] == 0x02:
                                                    b2_wait = resp_wait[7]
                                                    button2_still_active = not bool(b2_wait & 0x04)
                                                    
                                                    if not button2_still_active:
                                                        break
                                            except socket.timeout:
                                                pass
                                        except:
                                            pass
                                        
                                        time.sleep(0.3)
                                    
                                    last_pressed["Botão 2"] = False
                                    
                                    time.sleep(WAIT_AFTER_GATE_OPEN)
                                
                                gate_sock.close()
                                
                            except Exception as e:
                                log(f"[ERRO] Erro durante processamento: {e}", "ERROR")
                            
                            finally:
                                processing_vehicle = False
                                current_plate_for_gate = None
                                gate_is_open = False
                                push_status()  # Status imediato: fim do processamento
                        
                        elif button1 and (not last_pressed.get("Botão 1", False)):
                            log("[MANUAL] BOTAO 1 - ABERTURA MANUAL", "SUCCESS")
                            try:
                                gate_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                gate_sock.settimeout(1.0)
                                current_plate_for_gate = None
                                if open_gate_timed(gate_sock, 1, plate=None):
                                    manual_openings += 1
                                    increment_manual_opening()
                                    increment_sem_placa()
                                    last_gate_opened_time = time.time()
                                    log_gate_result(plate=None, source="Manual (botao 1)")
                                    time.sleep(WAIT_AFTER_GATE_OPEN)
                                    
                                gate_sock.close()
                            except Exception as e:
                                log(f"[ERRO] Erro ao abrir cancela: {e}", "ERROR")

                        last_pressed = pressed

                        # Verifica se passou 10 minutos para imprimir estatísticas de API keys
                        if current_time - last_api_stats_time >= API_STATS_INTERVAL:
                            usage_data = load_api_usage()
                            log_api_usage_summary(usage_data)
                            log_statistics_summary()  # Imprime estatísticas de cancelas
                            last_api_stats_time = current_time
                        
                        # Status periódico a cada 60 segundos
                        if contador_ciclos % 1200 == 0:
                            pass  # Log removido para reduzir verbosidade

                except socket.timeout:
                    # Timeout = SEC não respondeu este ciclo
                    consecutive_timeouts += 1
                    time_without_response = time.time() - last_successful_response
                    
                    # ==================== WATCHDOG: SEC CAIU? ====================
                    # Se a SEC não responde por SEC_WATCHDOG_TIMEOUT segundos,
                    # provavelmente sofreu pico de energia e reiniciou.
                    # Recria o socket e aguarda a SEC voltar.
                    if time_without_response >= SEC_WATCHDOG_TIMEOUT and not sec_was_offline:
                        sec_was_offline = True
                        log("", "WARNING")
                        log("[WATCHDOG] ================================================", "WARNING")
                        log(f"[WATCHDOG] SEC SEM RESPOSTA HA {time_without_response:.0f}s!", "WARNING")
                        log("[WATCHDOG] Possivel pico de energia - SEC pode ter reiniciado", "WARNING")
                        log("[WATCHDOG] Iniciando reconexao automatica...", "WARNING")
                        log("[WATCHDOG] ================================================", "WARNING")
                        log("", "WARNING")
                        
                        # Recria o socket
                        try:
                            if sock:
                                sock.close()
                        except Exception:
                            pass
                        
                        # Loop de reconexão: tenta INDEFINIDAMENTE até SEC responder
                        # (pode demorar minutos ou horas após pico de energia)
                        reconnect_start = time.time()
                        reconnected = False
                        attempt = 0
                        current_wait = SEC_RECONNECT_WAIT_INITIAL
                        last_log_time = time.time()
                        LOG_INTERVAL = 300  # Loga a cada 5 min durante espera longa
                        
                        while not reconnected:
                            attempt += 1
                            try:
                                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                sock.settimeout(2.0)  # Timeout mais generoso para reconexão
                                
                                # Envia comando de teste e aguarda resposta
                                test_cmd = bytes([0x55, 0xAA, 0x02, 0x00])
                                sock.sendto(test_cmd, (SEC_IP, SEC_PORT))
                                
                                try:
                                    test_resp, _ = sock.recvfrom(1024)
                                    if len(test_resp) >= 4 and test_resp[0:2] == bytes([0x55, 0xAA]):
                                        # SEC respondeu! Reconexão bem sucedida
                                        reconnected = True
                                        sock.settimeout(0.2)  # Volta timeout normal
                                        consecutive_timeouts = 0
                                        consecutive_errors = 0
                                        last_successful_response = time.time()
                                        last_reconnect_time = time.time()
                                        
                                        elapsed = time.time() - reconnect_start
                                        # Formata tempo legivel
                                        if elapsed >= 3600:
                                            elapsed_str = f"{elapsed/3600:.1f} horas"
                                        elif elapsed >= 60:
                                            elapsed_str = f"{elapsed/60:.1f} minutos"
                                        else:
                                            elapsed_str = f"{elapsed:.1f}s"
                                        
                                        log("", "SUCCESS")
                                        log("[WATCHDOG] ================================================", "SUCCESS")
                                        log(f"[WATCHDOG] SEC RESPONDEU! Reconexao apos {elapsed_str} (tentativa {attempt})", "SUCCESS")
                                        log("[WATCHDOG] Testando rele 2 para confirmar comunicacao...", "SUCCESS")
                                        
                                        # Testa relé 2 para confirmar
                                        sock.settimeout(1.0)
                                        test_relay_2(sock, tempo_segundos=0.5)
                                        sock.settimeout(0.2)
                                        
                                        log("[WATCHDOG] Sistema reconectado e operacional!", "SUCCESS")
                                        log("[WATCHDOG] ================================================", "SUCCESS")
                                        log("", "SUCCESS")
                                        break
                                except socket.timeout:
                                    pass  # SEC ainda não respondeu, tenta de novo
                                
                                if not reconnected:
                                    sock.close()
                                    
                            except Exception as re_err:
                                if attempt <= 3 or attempt % 20 == 0:
                                    log(f"[WATCHDOG] Tentativa {attempt}: Erro ao recriar socket: {re_err}", "ERROR")
                            
                            if not reconnected:
                                elapsed = time.time() - reconnect_start
                                
                                # Log nas primeiras 3 tentativas, depois a cada 5 minutos
                                if attempt <= 3 or (time.time() - last_log_time) >= LOG_INTERVAL:
                                    if elapsed >= 3600:
                                        elapsed_str = f"{elapsed/3600:.1f}h"
                                    elif elapsed >= 60:
                                        elapsed_str = f"{elapsed/60:.1f}min"
                                    else:
                                        elapsed_str = f"{elapsed:.0f}s"
                                    log(f"[WATCHDOG] Tentativa {attempt}: SEC sem resposta ({elapsed_str}) - proxima tentativa em {current_wait}s...", "WARNING")
                                    last_log_time = time.time()
                                
                                time.sleep(current_wait)
                                
                                # Backoff: aumenta intervalo gradualmente
                                # 3s -> 5s -> 8s -> 13s -> 21s -> 30s (máx)
                                if current_wait < SEC_RECONNECT_WAIT_MAX:
                                    current_wait = min(int(current_wait * 1.6), SEC_RECONNECT_WAIT_MAX)
                
                except Exception as e:
                    consecutive_errors += 1
                    if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                        log(f"[RECONEXAO] {consecutive_errors} erros consecutivos - recriando socket...", "WARNING")
                        try:
                            if sock:
                                sock.close()
                            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                            sock.settimeout(0.2)
                            consecutive_errors = 0
                            last_reconnect_time = time.time()
                            log("[RECONEXAO] Socket recriado com sucesso!", "SUCCESS")
                        except Exception as re_err:
                            log(f"[RECONEXAO] Falha ao recriar socket: {re_err}", "ERROR")
                            time.sleep(2)
                    elif consecutive_errors == 1:
                        log(f"[AVISO] Erro comunicacao: {e}", "WARNING")
                    # Loga a cada 10 erros para não spammar
                    elif consecutive_errors % 10 == 0:
                        log(f"[AVISO] {consecutive_errors} erros consecutivos: {e}", "WARNING")

                # Reduzido para 0.05s (50ms) para resposta mais rápida
                time.sleep(0.05)

            except KeyboardInterrupt:
                total_openings = authorized_openings + manual_openings
                log("", "INFO")
                log("[PARANDO] Parando sistema...", "INFO")
                log("           ESTATISTICAS DA SESSAO", "INFO")
                log(f"   Total de placas detectadas: {total_detections}", "INFO")
                log(f"   [OK] Placas autorizadas: {authorized_openings}", "INFO")
                log(f"   [X]  Placas nao autorizadas: {denied_access}", "INFO")
                log(f"   [MANUAL] Aberturas manuais: {manual_openings}", "INFO")
                log(f"   [TOTAL] Total de aberturas: {total_openings}", "INFO")
                if total_detections > 0:
                    pct_autorizadas = (authorized_openings / total_detections) * 100
                    pct_nao_autorizadas = (denied_access / total_detections) * 100
                    log(f"   % Autorizadas: {pct_autorizadas:.1f}% | % Nao autorizadas: {pct_nao_autorizadas:.1f}%", "INFO")
                
                # Imprime estatísticas finais de API keys
                usage_data = load_api_usage()
                log_api_usage_summary(usage_data)
                # Imprime estatísticas finais de cancelas
                log_statistics_summary()
                # Marca sistema como offline no Firebase
                _shutdown_set_offline()
                break
            except Exception as e:
                log(f"[ERRO] Erro: {e}", "ERROR")
                if sock:
                    sock.close()
                    sock = None
                time.sleep(0.5)

    except Exception as e:
        log(f"[ERRO] Erro geral: {e}", "ERROR")
    finally:
        _shutdown_set_offline()
        if sock:
            sock.close()
        log("[OK] Sistema encerrado.", "INFO")

if __name__ == "__main__":
    # Verifica se a flag --teste foi passada para ativar modo teste
    if "--teste" in sys.argv:
        TEST_MODE = True
        log("[TESTE] >>> MODO TESTE ATIVADO (--teste) - qualquer placa identificada abre a cancela <<<", "WARNING")
        log("[TESTE] >>> Camera e LPR ativos - bypass de autorizacao habilitado <<<", "WARNING")
    
    # Verifica se o argumento --reset-stats foi passado para zerar estatísticas
    if "--reset-stats" in sys.argv:
        log("", "INFO")
        log("=" * 80, "INFO")
        log("           ZERANDO ESTATISTICAS", "INFO")
        log("=" * 80, "INFO")
        log("", "INFO")
        if reset_statistics():
            log("", "INFO")
            log("=" * 80, "INFO")
            log("           ESTATISTICAS ZERADAS COM SUCESSO", "INFO")
            log("=" * 80, "INFO")
            log("", "INFO")
        else:
            log("", "INFO")
            log("=" * 80, "INFO")
            log("           ERRO AO ZERAR ESTATISTICAS", "INFO")
            log("=" * 80, "INFO")
            log("", "INFO")
        sys.exit(0)
    
    log("", "INFO")
    log("=" * 80, "INFO")
    log("           SISTEMA DE CONTROLE DE ACESSO - INICIANDO", "INFO")
    log("=" * 80, "INFO")
    log(f"   {len(AUTHORIZED_PLATES)} placas autorizadas carregadas do CSV", "INFO")
    log("=" * 80, "INFO")
    log("", "INFO")
    
    # Carrega e exibe estatísticas iniciais
    stats = load_statistics()
    log("           ESTATISTICAS CARREGADAS", "INFO")
    log(f"   [OK]   Com placa detectada:    {stats.get('com_placa', 0):>6}", "INFO")
    log(f"   [ERRO] Sem placa (erro):       {stats.get('sem_placa', 0):>6}", "INFO")
    total = stats.get('com_placa', 0) + stats.get('sem_placa', 0)
    log(f"   [TOTAL] Total:                 {total:>6}", "INFO")
    log("-" * 60, "INFO")
    log("", "INFO")
    
    log("[INICIANDO] Iniciando monitoramento continuo...", "INFO")
    log(f"[INFO] Log sendo salvo em: {LOG_FILE}", "INFO")
    log(f"[INFO] Estatisticas sendo salvas em: {STATISTICS_FILE}", "INFO")
    log(f"[INFO] Uso de API keys sendo salvo em: {API_USAGE_FILE}", "INFO")
    log("", "INFO")
    
    try:
        monitor_sec_continuous()
    except KeyboardInterrupt:
        log("", "INFO")
        log("[PARANDO] Sistema interrompido pelo usuario", "INFO")
    except Exception as e:
        log("", "INFO")
        log(f"[ERRO] Erro fatal: {e}", "ERROR")
        import traceback
        log(f"Traceback: {traceback.format_exc()}", "ERROR")
    finally:
        _shutdown_set_offline()
        log("", "INFO")
        log("=" * 80, "INFO")
        log("           SISTEMA DE CONTROLE DE ACESSO ENCERRADO", "INFO")
        log("=" * 80, "INFO")
        log("", "INFO")
