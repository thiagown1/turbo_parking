import socket
import concurrent.futures
import time

PRINTER_IP = "192.168.1.191"

# Common printer ports to check first
COMMON_PRINTER_PORTS = {
    80: "HTTP (Web config panel)",
    443: "HTTPS (Web config panel)",
    515: "LPR/LPD printing",
    631: "IPP (Internet Printing Protocol)",
    9100: "RAW / JetDirect",
    9101: "RAW alt",
    9102: "RAW alt",
    9220: "RAW alt",
    8080: "HTTP alt",
    161: "SNMP",
    23: "Telnet",
    21: "FTP",
    4000: "Custom print port",
    6101: "Backup print port",
    8000: "HTTP alt",
}


def check_port(ip, port, timeout=2):
    """Check if a single TCP port is open."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()
        return port, result == 0
    except:
        return port, False


def main():
    print("=" * 50)
    print(f"  PORT SCANNER FOR PRINTER AT {PRINTER_IP}")
    print("=" * 50)

    # Phase 1: Check common printer ports
    print(f"\n[Phase 1] Checking {len(COMMON_PRINTER_PORTS)} common printer ports...")
    open_ports = []

    for port, description in sorted(COMMON_PRINTER_PORTS.items()):
        status_char = "."
        _, is_open = check_port(PRINTER_IP, port)
        if is_open:
            status_char = "✓"
            open_ports.append((port, description))
            print(f"  {status_char} Port {port:>5} OPEN  — {description}")
        else:
            print(f"  {status_char} Port {port:>5} closed — {description}")

    # Phase 2: Scan wider range (1-1024 + common high ports)
    print(f"\n[Phase 2] Scanning ports 1-1024 (fast scan)...")
    scan_ports = [p for p in range(1, 1025) if p not in COMMON_PRINTER_PORTS]

    found_extra = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
        futures = {
            executor.submit(check_port, PRINTER_IP, port, 1): port
            for port in scan_ports
        }
        done_count = 0
        total = len(futures)
        for future in concurrent.futures.as_completed(futures):
            done_count += 1
            if done_count % 200 == 0:
                print(f"  ... scanned {done_count}/{total} ports")
            port, is_open = future.result()
            if is_open and port not in COMMON_PRINTER_PORTS:
                found_extra.append(port)
                print(f"  ✓ Port {port} OPEN")

    # Phase 3: Scan high ports (common ranges)
    print(f"\n[Phase 3] Scanning high ports (1025-15000)...")
    high_ports = [p for p in range(1025, 15001) if p not in COMMON_PRINTER_PORTS]

    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
        futures = {
            executor.submit(check_port, PRINTER_IP, port, 1): port
            for port in high_ports
        }
        done_count = 0
        total = len(futures)
        for future in concurrent.futures.as_completed(futures):
            done_count += 1
            if done_count % 2000 == 0:
                print(f"  ... scanned {done_count}/{total} ports")
            port, is_open = future.result()
            if is_open and port not in COMMON_PRINTER_PORTS:
                found_extra.append(port)
                print(f"  ✓ Port {port} OPEN")

    # Results
    all_open = open_ports + [(p, "Unknown service") for p in sorted(found_extra)]

    print("\n" + "=" * 50)
    print("  RESULTS")
    print("=" * 50)

    if all_open:
        print(f"\n  Found {len(all_open)} open port(s) on {PRINTER_IP}:\n")
        for port, desc in sorted(all_open):
            print(f"    Port {port:>5}  —  {desc}")

        print("\n  Next steps:")
        print("  → If port 80/443/8080 is open, visit it in a browser:")
        for port, desc in all_open:
            if port in (80, 443, 8080, 8000):
                proto = "https" if port == 443 else "http"
                print(f"       {proto}://{PRINTER_IP}:{port}")
        print(f"  → Try sending a test print to each open port")
        print(f"  → Update PRINTER_PORT in test_printer.py")
    else:
        print(f"\n  No open TCP ports found on {PRINTER_IP}")
        print("  The printer might only support UDP or use a proprietary protocol.")
        print("  Try checking the printer's manual or settings panel for network config.")

    print()


if __name__ == "__main__":
    main()
