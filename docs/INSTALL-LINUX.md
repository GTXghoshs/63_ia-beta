# Tutorial de instalação Linux — 63_ia (beta)

## 1. Pré-requisitos

O projeto exige Linux, Python 3, um compilador para dependências, `curl` e um `llama-server` compilado pelo projeto llama.cpp. Para GPU Vulkan, instale também os drivers e ferramentas Vulkan da sua distribuição. Fedora é o caminho oficialmente documentado neste beta.

```bash
sudo dnf install -y python3 python3-pip python3-devel gcc-c++ cmake make git openssl-devel pciutils vulkan-tools mesa-vulkan-drivers poppler-utils curl xdg-utils
```

O projeto não instala Docker, não instala modelos automaticamente e não configura `sudo` para a IA.

## 2. Obter o projeto

```bash
git clone https://github.com/SEU_USUARIO/63_ia-beta.git
cd 63_ia-beta
```

Se estiver usando um arquivo ZIP, extraia-o e entre na pasta resultante. Confirme que o arquivo `.env` ainda não existe antes de criar a configuração local.

## 3. Instalar o llama.cpp

```bash
git clone https://github.com/ggml-org/llama.cpp.git
cd llama.cpp
cmake -B build -DGGML_VULKAN=ON
cmake --build build --config Release -j"$(nproc)"
```

Para CPU, remova `-DGGML_VULKAN=ON` e compile o caminho padrão. Depois teste:

```bash
./build/bin/llama-server --version
./build/bin/llama-server --list-devices
```

Adicione o caminho do binário ao PATH ou configure `LLAMA_SERVER_BIN` com o caminho absoluto. O 63_ia (beta) só usa esse runtime e arquivos GGUF.

## 4. Instalar o dashboard

```bash
cd /caminho/para/63_ia-beta
./scripts/install-fedora-deps.sh
./install-fedora.sh
```

O instalador cria o ambiente Python do dashboard, instala dependências, copia o serviço systemd de usuário e registra o lançador do aplicativo. A execução do modelo permanece separada.

## 5. Configurar durante a instalação

O instalador pergunta os caminhos essenciais e grava o `.env` automaticamente. Não é necessário abrir `nano` ou editar o arquivo manualmente:

```bash
./install-fedora.sh
```

Durante a execução, informe:

| Pergunta | Valor recomendado |
|---|---|
| Diretório dos modelos GGUF | A pasta que contém os modelos locais, por exemplo `~/llama.cpp/models` |
| Caminho do vault do Obsidian | A pasta do vault; pressione Enter para deixar desativado |

O instalador cria o `.env` com permissões restritas, configura `WORK_DIR`, `AUDIT_LOG`, `MODEL_DIR` e `OBSIDIAN_VAULT_DIR`, cria o serviço systemd e configura a permissão do vault informado. Em uma reinstalação, os valores existentes aparecem como padrão.

O diretório pode conter vários modelos GGUF. O modelo efetivamente servido continua sendo escolhido no comando `scripts/start-llama-linux.sh`, sem necessidade de editar o `.env`:

```bash
./scripts/start-llama-linux.sh \
  "$HOME/llama.cpp/models/SEU_MODELO.gguf"
```

Para CPU, configure o backend no perfil do launcher ou use `LLAMA_BACKEND=cpu` no ambiente do comando. Para Vulkan e múltiplas GPUs, use o launcher genérico e os parâmetros documentados em `README.md` e `docs/TROUBLESHOOTING.md`.

## 6. Validar dispositivos e iniciar o modelo

```bash
./scripts/list-llama-devices.sh
./scripts/start-llama-linux.sh \
  "$HOME/llama.cpp/models/SEU_MODELO.gguf"
```

Em outra sessão:

```bash
curl -fsS http://127.0.0.1:8080/health
```

O retorno de saúde do llama.cpp deve ser válido antes de iniciar o dashboard. Se o modelo não carregar, siga `docs/TROUBLESHOOTING.md`.

## 7. Iniciar o dashboard

```bash
systemctl --user enable --now llama-dashboard.service
systemctl --user status llama-dashboard.service --no-pager
curl -fsS http://127.0.0.1:8090/api/healthz
```

Abra `http://127.0.0.1:8090`. O dashboard pode mostrar o llama.cpp offline se o processo do modelo não estiver ativo; isso não significa necessariamente que o dashboard esteja quebrado.

## 8. Testar instalação

```bash
python3 -m pytest -q
./scripts/diagnose-fedora.sh
```

Confira os logs:

```bash
journalctl --user -u llama-dashboard.service -n 100 --no-pager
```

## 9. Ativar múltiplas GPUs

Somente depois de validar uma GPU, liste os dispositivos e configure:

```dotenv
LLAMA_GPU_IDS=Vulkan0,Vulkan1
LLAMA_SPLIT_MODE=layer
LLAMA_TENSOR_SPLIT=1,1
```

Reinicie somente o `llama-server`, não o dashboard, e compare memória, latência, tokens por segundo e estabilidade. O modo `tensor` permanece experimental e deve ser usado apenas após validar o modo `layer`.

## 10. Desinstalação

```bash
systemctl --user disable --now llama-dashboard.service || true
rm -f "$HOME/.config/systemd/user/llama-dashboard.service"
systemctl --user daemon-reload
```

Os modelos, o `.env`, o vault e os dados em `data/` não são apagados automaticamente. Remova-os somente depois de fazer backup e confirmar que não são necessários.
