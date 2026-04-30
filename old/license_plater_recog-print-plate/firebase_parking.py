"""
firebase_parking.py — Módulo Firestore para sistema de estacionamento.

Gerencia sessões de estacionamento (entrada/saída), cobrança e estatísticas.

Coleções:
  - parking_sessions: sessões individuais de estacionamento
  - daily_stats: estatísticas diárias consolidadas
  - pricing_config: configuração de preços
"""

import os
import math
import threading
from datetime import datetime, timedelta, timezone

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    from google.cloud.firestore_v1.base_query import FieldFilter
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("[FIREBASE] AVISO: firebase-admin nao instalado. Execute: pip install firebase-admin")

# ======================== CONFIGURAÇÃO ========================

CREDENTIALS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "metropoleparking-firebase-adminsdk-fbsvc-db525fb4b6.json")

# Fuso horário de Brasília (UTC-3)
BRT = timezone(timedelta(hours=-3))

# Preços padrão (usados se não houver config no Firestore)
DEFAULT_PRICING = {
    "tolerance_minutes": 10,    # 10 minutos gratuitos
    "first_hour": 10.00,        # R$ 10,00 primeira hora
    "additional_hour": 5.00,    # R$ 5,00 por hora adicional
    "authorized_free": True,    # Autorizados não pagam
}

# ======================== INICIALIZAÇÃO ========================

_db = None


def init_firestore():
    """Inicializa conexão com Firestore. Retorna True se sucesso."""
    global _db

    if not FIREBASE_AVAILABLE:
        print("[FIREBASE] firebase-admin nao disponivel")
        return False

    if _db is not None:
        return True  # Já inicializado

    if not os.path.exists(CREDENTIALS_FILE):
        print(f"[FIREBASE] ERRO: Arquivo {CREDENTIALS_FILE} nao encontrado")
        print("[FIREBASE] Baixe em: Firebase Console > Project Settings > Service Accounts > Generate New Private Key")
        return False

    try:
        cred = credentials.Certificate(CREDENTIALS_FILE)
        firebase_admin.initialize_app(cred)
        _db = firestore.client()
        print("[FIREBASE] Firestore inicializado com sucesso!")

        # Garante que a config de preços existe
        _ensure_pricing_config()
        return True
    except Exception as e:
        print(f"[FIREBASE] Erro ao inicializar: {e}")
        return False


def _get_db():
    """Retorna instância do Firestore ou None."""
    return _db


def _ensure_pricing_config():
    """Cria configuração de preços no Firestore se não existir."""
    db = _get_db()
    if not db:
        return

    doc_ref = db.collection("pricing_config").document("current")
    doc = doc_ref.get()

    if not doc.exists:
        config = {**DEFAULT_PRICING, "updated_at": firestore.SERVER_TIMESTAMP}
        doc_ref.set(config)
        print(f"[FIREBASE] Config de precos criada: tolerancia={DEFAULT_PRICING['tolerance_minutes']}min, "
              f"1a hora=R${DEFAULT_PRICING['first_hour']:.2f}, hora adicional=R${DEFAULT_PRICING['additional_hour']:.2f}")
    else:
        data = doc.to_dict()
        print(f"[FIREBASE] Config de precos carregada: tolerancia={data.get('tolerance_minutes', 10)}min, "
              f"1a hora=R${data.get('first_hour', 10):.2f}, hora adicional=R${data.get('additional_hour', 5):.2f}")


# ======================== PREÇOS ========================

def get_pricing():
    """Retorna configuração de preços do Firestore."""
    db = _get_db()
    if not db:
        return DEFAULT_PRICING

    try:
        doc = db.collection("pricing_config").document("current").get()
        if doc.exists:
            return doc.to_dict()
    except Exception as e:
        print(f"[FIREBASE] Erro ao ler precos: {e}")

    return DEFAULT_PRICING


def calculate_charge(entry_time, exit_time, is_authorized):
    """
    Calcula valor a cobrar.
    
    Regras:
      - Autorizados: gratuito
      - Visitantes: 10 min tolerância gratuita, depois R$10 1ª hora + R$5/hora adicional
    """
    pricing = get_pricing()

    if is_authorized and pricing.get("authorized_free", True):
        return 0.00

    # Calcula duração em minutos
    if isinstance(entry_time, datetime) and isinstance(exit_time, datetime):
        duration = exit_time - entry_time
    else:
        duration = timedelta(minutes=0)

    total_minutes = duration.total_seconds() / 60

    # Tolerância gratuita
    tolerance = pricing.get("tolerance_minutes", 10)
    if total_minutes <= tolerance:
        return 0.00

    # Calcula horas (fração de hora = hora cheia)
    billable_minutes = total_minutes - tolerance
    total_hours = math.ceil(billable_minutes / 60)

    if total_hours <= 1:
        return pricing.get("first_hour", 10.00)
    else:
        first = pricing.get("first_hour", 10.00)
        additional = pricing.get("additional_hour", 5.00)
        return first + (total_hours - 1) * additional


# ======================== ENTRADA ========================

def register_entry_async(plate, plate_normalized, is_authorized, vehicle_type,
                         owner_name, confidence, gate_opened_by, ticket_id=None):
    """Registra entrada em background (não bloqueia). Retorna ticket_id se fornecido."""
    t = threading.Thread(
        target=register_entry,
        args=(plate, plate_normalized, is_authorized, vehicle_type,
              owner_name, confidence, gate_opened_by, ticket_id),
        daemon=True
    )
    t.start()
    return ticket_id  # Retorna imediatamente

def register_entry(plate, plate_normalized, is_authorized, vehicle_type,
                   owner_name, confidence, gate_opened_by, ticket_id=None):
    """
    Registra entrada do veículo no Firestore.
    
    Args:
        plate: placa como detectada (ex: "SSG7I56")
        plate_normalized: placa normalizada (sem espaços/hifens)
        is_authorized: bool
        vehicle_type: "admin" | "morador" | "loja" | "visitante"
        owner_name: nome do dono (ou None para visitantes)
        confidence: confiança do reconhecimento (%)
        gate_opened_by: "auto" | "manual"
    
    Returns:
        session_id (str) ou None se falhar
    """
    db = _get_db()
    if not db:
        print("[FIREBASE] Firestore nao inicializado - entrada nao registrada")
        return None

    try:
        # Verifica se já existe sessão ativa para esta placa
        existing = get_active_session(plate_normalized)
        if existing:
            entry_time = existing.get('entry_time')
            session_age_hours = 0
            if entry_time:
                if hasattr(entry_time, 'timestamp'):
                    if entry_time.tzinfo is None:
                        entry_time = entry_time.replace(tzinfo=timezone.utc)
                session_age_hours = (datetime.now(timezone.utc) - entry_time).total_seconds() / 3600
            
            if session_age_hours > 24:
                # Sessão antiga (>24h) — fecha automaticamente sem erro
                try:
                    db.collection("parking_sessions").document(existing["id"]).update({
                        "status": "completed",
                        "exit_time": datetime.now(timezone.utc),
                        "auto_closed": True,
                        "auto_close_reason": f"Sessao com {session_age_hours:.0f}h fechada automaticamente",
                        "updated_at": firestore.SERVER_TIMESTAMP,
                    })
                    print(f"[FIREBASE] Sessao antiga {existing['id']} ({session_age_hours:.0f}h) fechada automaticamente")
                except Exception:
                    pass
            else:
                # Sessão recente (<24h) — loga como aviso mas continua
                print(f"[FIREBASE] [AVISO] Placa {plate_normalized} re-entrada (sessao {existing['id']} ativa ha {session_age_hours:.1f}h)")
                try:
                    db.collection("parking_sessions").document(existing["id"]).update({
                        "status": "completed",
                        "exit_time": datetime.now(timezone.utc),
                        "auto_closed": True,
                        "auto_close_reason": "Re-entrada detectada",
                        "updated_at": firestore.SERVER_TIMESTAMP,
                    })
                except Exception:
                    pass

        now = datetime.now(timezone.utc)
        session_data = {
            "plate": plate,
            "plate_normalized": plate_normalized,
            "entry_time": now,
            "exit_time": None,
            "status": "active",
            "vehicle_type": vehicle_type,
            "owner_name": owner_name,
            "is_authorized": is_authorized,
            "gate_opened_by": gate_opened_by,
            "recognition_confidence": confidence,
            "duration_minutes": None,
            "amount_charged": None,
            "payment_status": "free" if is_authorized else "pending",
            "created_at": firestore.SERVER_TIMESTAMP,
        }

        # Se ticket_id fornecido, usa como document ID e salva como campo
        if ticket_id:
            session_data["ticket_id"] = ticket_id
            db.collection("parking_sessions").document(ticket_id).set(session_data)
            session_id = ticket_id
        else:
            doc_ref = db.collection("parking_sessions").add(session_data)
            session_id = doc_ref[1].id


        print(f"[FIREBASE] Entrada registrada: {plate} | Tipo: {vehicle_type} | "
              f"Autorizado: {'Sim' if is_authorized else 'Nao'} | ID: {session_id}")

        # Atualiza estatísticas diárias (usa data local BRT)
        _increment_daily_stats(now.astimezone(BRT).strftime("%Y-%m-%d"), is_authorized, 0.0)

        return session_id

    except Exception as e:
        print(f"[FIREBASE] Erro ao registrar entrada: {e}")
        return None


# ======================== SAÍDA ========================

def register_exit_async(plate_normalized, exit_confidence=0, exit_gate_opened_by="auto"):
    """Registra saída em background (não bloqueia o loop da cancela)."""
    t = threading.Thread(
        target=register_exit,
        args=(plate_normalized, exit_confidence, exit_gate_opened_by),
        daemon=True
    )
    t.start()

def register_exit(plate_normalized, exit_confidence=0, exit_gate_opened_by="auto"):
    """
    Registra saída do veículo. Calcula duração e valor.
    
    Args:
        plate_normalized: placa normalizada
        exit_confidence: confiança do reconhecimento na saída (%)
        exit_gate_opened_by: como a cancela de saída foi aberta ("auto" | "manual")
    
    Returns:
        dict com dados da sessão atualizada ou None
    """
    db = _get_db()
    if not db:
        print("[FIREBASE] Firestore nao inicializado - saida nao registrada")
        return None

    try:
        session = get_active_session(plate_normalized)
        if not session:
            print(f"[FIREBASE] Nenhuma sessao ativa para placa {plate_normalized}")
            return None

        now = datetime.now(timezone.utc)
        entry_time = session["entry_time"]

        # Converte se for Timestamp do Firestore
        if hasattr(entry_time, 'timestamp') and entry_time.tzinfo is None:
            entry_time = entry_time.replace(tzinfo=timezone.utc)

        # Calcula duração
        duration = now - entry_time
        duration_minutes = round(duration.total_seconds() / 60, 1)

        # Calcula valor
        is_authorized = session.get("is_authorized", False)
        amount = calculate_charge(entry_time, now, is_authorized)

        # Determina status do pagamento
        allow_exit = False
        if is_authorized:
            payment_status = "free"
            allow_exit = True
        elif amount == 0:
            payment_status = "free"  # Dentro da tolerância
            allow_exit = True
        else:
            ev_granted = session.get("ev_total_parking_minutes_granted", 0)
            pricing = get_pricing()
            tolerance = pricing.get("tolerance_minutes", 10)
            coverage = ev_granted + tolerance
            
            if duration_minutes <= coverage:
                payment_status = "paid"
                allow_exit = True
            elif session.get("payment_status") == "paid" or session.get("payment_status") == "free":
                payment_status = session.get("payment_status")
                allow_exit = True
            else:
                payment_status = "pending"
                allow_exit = False

        # Atualiza documento apenas se liberar a saída
        if allow_exit:
            update_data = {
                "exit_time": now,
                "status": "completed",
                "duration_minutes": duration_minutes,
                "amount_charged": amount,
                "payment_status": payment_status,
                "exit_confidence": exit_confidence,
                "exit_gate_opened_by": exit_gate_opened_by,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
            db.collection("parking_sessions").document(session["id"]).update(update_data)

            print(f"[FIREBASE] Saida registrada: {plate_normalized} | "
                  f"Duracao: {duration_minutes:.0f}min | "
                  f"Valor: R${amount:.2f} | "
                  f"Status: {payment_status}")

            # Atualiza estatísticas diárias
            if amount > 0:
                _increment_daily_stats(now.astimezone(BRT).strftime("%Y-%m-%d"), is_authorized, amount)
        else:
            update_data = {
                "duration_minutes": duration_minutes,
                "amount_charged": amount,
                "payment_status": payment_status,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
            db.collection("parking_sessions").document(session["id"]).update(update_data)

            print(f"[FIREBASE] Saida BLOQUEADA (pgto pendente): {plate_normalized} | "
                  f"Duracao: {duration_minutes:.0f}min | "
                  f"Falta pagar: R${amount:.2f}")

        return {
            "session_id": session["id"],
            "plate": plate_normalized,
            "duration_minutes": duration_minutes,
            "amount_charged": amount,
            "payment_status": payment_status,
            "allow_exit": allow_exit
        }

    except Exception as e:
        print(f"[FIREBASE] Erro ao registrar saida: {e}")
        return None


# ======================== CONSULTAS ========================

def get_active_session(plate_normalized):
    """Retorna sessão ativa de uma placa ou None."""
    db = _get_db()
    if not db:
        return None

    try:
        query = (db.collection("parking_sessions")
                 .where(filter=FieldFilter("plate_normalized", "==", plate_normalized))
                 .where(filter=FieldFilter("status", "==", "active"))
                 .limit(1))

        results = query.get()
        for doc in results:
            data = doc.to_dict()
            data["id"] = doc.id
            return data

    except Exception as e:
        print(f"[FIREBASE] Erro ao buscar sessao ativa: {e}")

    return None


# ======================== STATUS DO SISTEMA ========================

def update_system_status(status_data):
    """
    Atualiza status do sistema no Firestore para o dashboard.
    
    Args:
        status_data: dict com campos como:
            - online: bool (sistema rodando)
            - car_on_loop: bool (veículo no laço)
            - gate_open: bool (cancela aberta)
            - processing: bool (processando veículo)
            - last_plate: str (última placa detectada)
            - last_plate_time: str (hora da última detecção)
            - authorized_openings: int
            - manual_openings: int
            - total_detections: int
            - uptime_since: str (desde quando está rodando)
    """
    db = _get_db()
    if not db:
        return

    try:
        status_data["updated_at"] = firestore.SERVER_TIMESTAMP
        status_data["timestamp"] = datetime.now(timezone.utc).isoformat()
        db.collection("system_status").document("current").set(status_data, merge=True)
    except Exception as e:
        print(f"[FIREBASE] Erro ao atualizar status: {e}")


# ======================== ERROS ========================

def _log_error(error_type, plate, message, details=None):
    """Salva erro no Firestore para investigação."""
    db = _get_db()
    if not db:
        return

    try:
        error_data = {
            "error_type": error_type,
            "plate": plate,
            "message": message,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc),
            "created_at": firestore.SERVER_TIMESTAMP,
        }
        db.collection("errors").add(error_data)
        print(f"[FIREBASE] Erro salvo na colecao 'errors': {error_type}")
    except Exception as e:
        print(f"[FIREBASE] Falha ao salvar erro no Firestore: {e}")


# ======================== ESTATÍSTICAS ========================

def _increment_daily_stats(date_str, is_authorized, amount):
    """Incrementa contadores diários usando transação atômica."""
    db = _get_db()
    if not db:
        return

    try:
        doc_ref = db.collection("daily_stats").document(date_str)

        @firestore.transactional
        def update_in_transaction(transaction, doc_ref):
            doc = doc_ref.get(transaction=transaction)
            if doc.exists:
                data = doc.to_dict()
                updates = {
                    "total_entries": data.get("total_entries", 0) + 1,
                    "total_revenue": data.get("total_revenue", 0) + amount,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                }
                if is_authorized:
                    updates["authorized_entries"] = data.get("authorized_entries", 0) + 1
                else:
                    updates["visitor_entries"] = data.get("visitor_entries", 0) + 1

                transaction.update(doc_ref, updates)
            else:
                transaction.set(doc_ref, {
                    "date": date_str,
                    "total_entries": 1,
                    "authorized_entries": 1 if is_authorized else 0,
                    "visitor_entries": 0 if is_authorized else 1,
                    "total_revenue": amount,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                })

        transaction = db.transaction()
        update_in_transaction(transaction, doc_ref)

    except Exception as e:
        print(f"[FIREBASE] Erro ao atualizar stats diarias: {e}")
