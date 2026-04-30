# SEC Monitor - Controle de Acesso com Reconhecimento de Placas

Sistema de controle de acesso automático usando reconhecimento de placas via API PlateRecognizer, gerenciado com PM2.

## 🚀 Instalação Rápida

### 1. Instalar PM2 (se ainda não tiver)

```bash
npm install -g pm2
```

Se não tiver Node.js, instale primeiro: https://nodejs.org/

### 2. Iniciar o Monitor

```batch
iniciar.bat
```

### 3. Configurar Auto-Start

**CRÍTICO:** Execute este script para iniciar automaticamente quando o Windows reiniciar:

```batch
configurar_autostart.bat
```

**IMPORTANTE:** 
- O script mostrará um comando como: `pm2 startup system -u seu_usuario --hp C:\Users\seu_usuario`
- **COPIE esse comando EXATAMENTE**
- Abra um **CMD como Administrador** (Win+X → Terminal Admin)
- **Execute o comando copiado**
- Só depois disso o auto-start funcionará!

## 📋 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `iniciar.bat` | Inicia o SEC Monitor com PM2 |
| `parar.bat` | Para o SEC Monitor |
| `status.bat` | Ver status e logs |
| `configurar_autostart.bat` | Configura auto-start no Windows |

## ✅ Verificar Status

```batch
status.bat
```

Ou via linha de comando:
```bash
pm2 status
pm2 logs sec-monitor
```

## 🎯 Comandos PM2 Úteis

```bash
# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs sec-monitor

# Ver últimas 50 linhas
pm2 logs sec-monitor --lines 50 --nostream

# Reiniciar
pm2 restart sec-monitor

# Parar
pm2 stop sec-monitor

# Salvar configuração
pm2 save

# Ver processos salvos
pm2 list
```

## 🔧 Configuração

### Placas Autorizadas

Edite: `plates/authorized_plates.csv`

### Configurações do Script

Edite: `sec_monitor.py`
- Linhas 23-25: IP e credenciais da câmera
- Linhas 28-29: IP e porta do SEC
- Linhas 36-39: API Keys do PlateRecognizer

### Configuração PM2

Edite: `ecosystem.config.js`

## 📁 Estrutura de Arquivos

```
license_plater_recog/
├── sec_monitor.py              # Script principal
├── ecosystem.config.js         # Configuração PM2
├── plates/
│   └── authorized_plates.csv   # Placas autorizadas
├── logs/
│   ├── sec_monitor.log         # Log completo do script (todos eventos)
│   ├── pm2-out.log            # Log PM2 (saída)
│   ├── pm2-error.log          # Log PM2 (erros)
│   └── pm2-combined.log       # Log PM2 (combinado)
├── captures/                   # Imagens capturadas
├── results/                    # Resultados JSON
└── training_data/             # Dados para treinamento
```

## 📝 Sistema de Logs

O sistema utiliza logging centralizado com níveis:

- **INFO**: Informações gerais (inicialização, eventos normais)
- **SUCCESS**: Operações bem-sucedidas (cancela aberta, acesso autorizado)
- **WARNING**: Avisos (acesso negado, timeout, tentativas de API)
- **ERROR**: Erros (falhas de comunicação, erros de API)

Todos os logs são salvos em `logs/sec_monitor.log` com timestamp e nível.

## 🔍 Verificar se Está Funcionando

### Método 1: Script
```batch
status.bat
```

### Método 2: PM2
```bash
pm2 status
pm2 logs sec-monitor
```

### Método 3: Arquivos
Verifique se há arquivos novos em:
- `logs/sec_monitor.log` - Log do script
- `captures/` - Imagens capturadas
- `results/` - Resultados JSON

### Método 4: Gerenciador de Tarefas
Procure por processos `node.exe` (PM2) e `python.exe` (script)

## 🐛 Solução de Problemas

### PM2 não inicia
```bash
pm2 kill
pm2 ping
```

### Processo não aparece
```bash
pm2 status
pm2 list
```

### Auto-start não funciona
1. Verifique se executou `pm2 save`
2. Verifique se executou o comando de startup como Admin
3. Execute `pm2 startup` novamente e siga as instruções

### Logs não aparecem
Verifique:
- `logs/sec_monitor.log` - Log completo do script (todos os eventos com timestamps)
- `logs/pm2-out.log` - Saída padrão do PM2
- `logs/pm2-error.log` - Erros do PM2

**Ver log em tempo real:**
```bash
# Windows PowerShell
Get-Content logs\sec_monitor.log -Wait -Tail 50

# Ou via PM2
pm2 logs sec-monitor
```

## ⚙️ Requisitos

- Python 3.x
- Node.js (para PM2)
- Conexão de rede (para API PlateRecognizer)
- Acesso à câmera IP (configurada no script)
- Acesso ao dispositivo SEC (configurado no script)
