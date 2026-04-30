import socket
import threading
import time
import argparse

# Bits (no seu código):
# button1_pressed = not bool(b1 & 0x02)
# button2_pressed = not bool(b1 & 0x04)
# Ou seja: ACTIVE-LOW -> bit = 0 => pressionado / ativo
BTN1_MASK = 0x02
BTN2_MASK = 0x04

class SecSim:
    def __init__(self):
        self._lock = threading.Lock()
        self.btn1_pressed = False
        self.btn2_pressed = False

    def _make_b1_byte(self) -> int:
        # Começa com bits "soltos" (1 = não pressionado)
        b1 = 0xFF
        if self.btn1_pressed:
            b1 &= ~BTN1_MASK  # bit 0 => pressionado
        else:
            b1 |= BTN1_MASK

        if self.btn2_pressed:
            b1 &= ~BTN2_MASK
        else:
            b1 |= BTN2_MASK

        return b1 & 0xFF

    def pulse_btn1(self, seconds: float = 0.2):
        with self._lock:
            self.btn1_pressed = True
        time.sleep(seconds)
        with self._lock:
            self.btn1_pressed = False

    def hold_btn2(self, seconds: float):
        with self._lock:
            self.btn2_pressed = True
        time.sleep(seconds)
        with self._lock:
            self.btn2_pressed = False


def stdin_controller(sim: SecSim):
    """
    Comandos:
      1            -> pulsa botão 1 (manual) ~0.2s
      2 <segundos> -> segura botão 2 (laço/veículo) por N segundos (ex: '2 10')
      2on / 2off   -> liga/desliga botão 2 (hold contínuo)
      status       -> mostra estado atual
      q            -> sair
    """
    print("\n[SEC SIM] Controles:")
    print("  carro           -> carro AUTORIZADO no laco (placa SSG7I56)")
    print("  visitante       -> carro NAO AUTORIZADO no laco (placa XYZ9W87)")
    print("  saiu            -> carro saiu do laco")
    print("  1               -> pulso botão 1 (manual / liberar visitante)")
    print("  plate <PLACA>   -> muda placa mock (ex: plate ABC1D23)")
    print("  status          -> estado atual")
    print("  q               -> sair\n")

    while True:
        try:
            cmd = input("> ").strip().lower()
        except EOFError:
            return

        if cmd in ("q", "quit", "exit"):
            return

        if cmd == "status":
            with sim._lock:
                print(f"BTN1={sim.btn1_pressed}  BTN2={sim.btn2_pressed}")
            continue

        if cmd == "1":
            threading.Thread(target=sim.pulse_btn1, daemon=True).start()
            print("[SEC SIM] BTN1 pulso (botão manual)")
            continue

        if cmd == "carro":
            # Seta placa autorizada e ativa laco
            try:
                with open("mock_plate.txt", "w") as f:
                    f.write("SSG7I56")
            except:
                pass
            with sim._lock:
                sim.btn2_pressed = True
            print("[SEC SIM] >>> CARRO AUTORIZADO NO LACO (placa: SSG7I56) <<<")
            continue

        if cmd == "visitante":
            # Seta placa NAO autorizada e ativa laco
            try:
                with open("mock_plate.txt", "w") as f:
                    f.write("XYZ9W87")
            except:
                pass
            with sim._lock:
                sim.btn2_pressed = True
            print("[SEC SIM] >>> VISITANTE NO LACO (placa: XYZ9W87) <<<")
            print("[SEC SIM] Cancela NAO vai abrir. Pressione '1' para liberar.")
            continue

        if cmd in ("saiu", "2off"):
            with sim._lock:
                sim.btn2_pressed = False
            print("[SEC SIM] >>> CARRO SAIU DO LACO <<<")
            continue

        if cmd.startswith("2 "):
            parts = cmd.split()
            try:
                sec = float(parts[1])
            except Exception:
                print("[SEC SIM] Use: 2 <segundos>  (ex: 2 5)")
                continue
            threading.Thread(target=sim.hold_btn2, args=(sec,), daemon=True).start()
            print(f"[SEC SIM] BTN2 ON por {sec}s")
            continue

        if cmd.startswith("plate "):
            parts = cmd.split(None, 1)
            if len(parts) == 2:
                new_plate = parts[1].strip().upper()
                try:
                    with open("mock_plate.txt", "w") as f:
                        f.write(new_plate)
                    print(f"[SEC SIM] Placa alterada para: {new_plate}")
                except Exception as e:
                    print(f"[SEC SIM] Erro ao salvar placa: {e}")
            else:
                print("[SEC SIM] Use: plate <PLACA>  (ex: plate ABC1D23)")
            continue

        print("[SEC SIM] Comando inválido. Digite: 1 | 2 <seg> | 2on | 2off | plate <PLACA> | status | q")


def run_udp_server(bind_ip: str, port: int, sim: SecSim):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((bind_ip, port))
    print(f"[SEC SIM] Escutando UDP em {bind_ip}:{port}")

    while True:
        data, addr = sock.recvfrom(4096)
        # Espera comandos começando por 55 AA
        if len(data) < 4 or data[0] != 0x55 or data[1] != 0xAA:
            continue

        cmd_type = data[2]

        # 0x02: leitura de status (seu código manda: 55 AA 02 00)
        if cmd_type == 0x02:
            with sim._lock:
                b1 = sim._make_b1_byte()

            # Monta uma resposta mínima com 8 bytes (você usa resp[7])
            # Estrutura simples: 55 AA 02 00 00 00 00 <b1>
            resp = bytes([0x55, 0xAA, 0x02, 0x00, 0x00, 0x00, 0x00, b1])
            sock.sendto(resp, addr)
            continue

        # 0x03: comando de relé (abrir/fechar). Seu código só valida header e byte[2]==0x03.
        if cmd_type == 0x03:
            # ACK mínimo: 55 AA 03 00
            resp = bytes([0x55, 0xAA, 0x03, 0x00])
            sock.sendto(resp, addr)
            # Log de qual relé foi acionado
            if len(data) >= 5:
                relay_byte = data[4]
                if relay_byte & 0x06:
                    print("[SEC SIM] >>> CANCELA ABERTA (relé 1) <<<")
                if relay_byte & 0x30:
                    print("[SEC SIM] >>> CANCELA FECHADA (relé 2) <<<")
            continue

        # Outros: responde ACK genérico
        resp = bytes([0x55, 0xAA, cmd_type, 0x00])
        sock.sendto(resp, addr)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bind", default="0.0.0.0", help="IP para bind (ex: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=2000, help="Porta UDP (default 2000)")
    args = parser.parse_args()

    sim = SecSim()

    t = threading.Thread(target=stdin_controller, args=(sim,), daemon=True)
    t.start()

    try:
        run_udp_server(args.bind, args.port, sim)
    except KeyboardInterrupt:
        print("\n[SEC SIM] Encerrando...")


if __name__ == "__main__":
    main()
