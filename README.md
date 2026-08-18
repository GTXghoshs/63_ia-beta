# 63_ia (beta)

**63_ia (beta)** é uma plataforma Linux-only para operar modelos de linguagem locais pelo ecossistema **llama.cpp**. A proposta é oferecer um ambiente semelhante a um copiloto de desenvolvimento local: o usuário conversa com a IA, trabalha em um workspace, analisa documentos, consulta o Obsidian, executa verificações controladas e acompanha o resultado por uma interface web local.

> **Intenção do projeto:** colocar o modelo, os arquivos, as ferramentas e a responsabilidade operacional nas mãos do proprietário da máquina. O projeto não é um provedor de modelos remoto, não é um wrapper de OpenAI/Claude/Ollama e não envia código ou documentos para a nuvem por padrão.

O projeto está em beta. Ele foi derivado de um dashboard privado, mas a distribuição pública não contém modelos, vaults, tokens, uploads, caminhos pessoais ou otimizações exclusivas de uma máquina.

## Escopo de compatibilidade

| Item | Suporte |
|---|---|
| Sistema operacional | Linux; Fedora Workstation é o caminho documentado e testado |
| Runtime de IA | Exclusivamente `llama-server`/llama.cpp local |
| Formato de modelo | GGUF local |
| CPU | Fallback quando o llama.cpp foi compilado para CPU |
| GPU | Vulkan quando o build do llama.cpp e os drivers Linux oferecerem suporte |
| Multi-GPU | `split-mode`, `tensor-split`, `main-gpu` e `device`, conforme suporte do build |
| Interface | Web local em loopback |
| Terminal | Allowlist desabilitada por padrão |
| Rede | Nenhuma para inferência; Tavily é opcional e separado |
| Windows/macOS | Fora do escopo do projeto beta |
| Runtimes alternativos | Fora do escopo: não há Ollama, LM Studio, OpenAI ou Claude como runtime de modelo |

A compatibilidade Linux-only não significa que todo hardware Linux funcionará da mesma forma. Driver, backend, versão do llama.cpp, memória, quantização e modelo devem ser validados na máquina real.

## Arquitetura e lógica de funcionamento

O fluxo de execução é deliberadamente separado em processos:

```text
Navegador local
      │ HTTP loopback
      ▼
63_ia backend ── arquivos / Obsidian / políticas / uploads / auditoria
      │ HTTP local compatível com llama.cpp
      ▼
llama-server ── modelo GGUF ativo ── CPU/Vulkan/múltiplas GPUs
```

O navegador não conversa diretamente com a GPU nem com o modelo. O backend controla o endereço local do llama-server, constrói o payload de chat, trata streaming SSE, aplica limites, protege chaves e converte respostas em eventos da interface. O `llama-server` é um processo separado para que o usuário possa trocar o modelo, backend ou perfil de GPU sem reescrever o dashboard.

O chat usa `POST /v1/chat/completions` no servidor local. Status, modelos e métricas são consultados em endpoints locais do llama.cpp quando estiverem disponíveis.[1]

A sequência interna de uma conversa é:

| Etapa | Componente | Resultado |
|---|---|---|
| 1 | Navegador | Envia mensagens, parâmetros e referências selecionadas ao backend |
| 2 | Validação | Confere papéis, tamanho de contexto, modelo e limites |
| 3 | Contexto | Acrescenta arquivos ou notas autorizadas como referência delimitada |
| 4 | Proxy local | Envia a requisição ao `llama-server` em loopback |
| 5 | Streaming | Converte deltas do llama.cpp em eventos SSE para a interface |
| 6 | Auditoria | Registra ações de terminal e eventos relevantes sem gravar segredos |
| 7 | Interface | Mostra resposta, erro, métricas e estado operacional |

O terminal segue um caminho separado: a requisição passa pela allowlist, validação de argumentos, limite de tempo, limite de saída e auditoria. O modelo não recebe um shell livre.

## Instalação rápida no Fedora

A instalação não usa Docker. Primeiro instale ferramentas do sistema, clone ou extraia o projeto e execute o instalador guiado:

```bash
sudo dnf install -y python3 python3-pip python3-devel gcc-c++ cmake make git openssl-devel pciutils vulkan-tools mesa-vulkan-drivers poppler-utils curl xdg-utils unzip

git clone https://github.com/SEU_USUARIO/63_ia-beta.git
cd 63_ia-beta
./scripts/install-fedora-deps.sh
./install-fedora.sh
systemctl --user enable --now llama-dashboard.service
./bin/llama-dashboard-open
```

Durante `./install-fedora.sh`, informe o diretório que contém os modelos GGUF e, opcionalmente, o caminho do vault do Obsidian. O instalador cria o `.env`, configura `MODEL_DIR` e `OBSIDIAN_VAULT_DIR`, protege o arquivo e prepara o serviço. Não é necessário abrir um editor para os caminhos básicos. O serviço abre em `http://127.0.0.1:8090`; a configuração padrão mantém dashboard e llama-server em loopback, desabilita o terminal e não ativa Tavily.

Para Linux não-Fedora, instale manualmente Python 3, `python3-venv`, compilador, CMake, `curl`, ferramentas Vulkan/Mesa quando aplicável e `poppler-utils`. O script `install-fedora-deps.sh` é específico do DNF e não deve ser executado em Debian, Ubuntu, Arch ou outras distribuições sem adaptação.

## Instalação do llama.cpp

O projeto público não baixa nem instala modelos automaticamente. Instale o llama.cpp conforme a documentação oficial e construa o backend desejado. Um exemplo de build Vulkan no Linux é:

```bash
git clone https://github.com/ggml-org/llama.cpp.git
cd llama.cpp
cmake -B build -DGGML_VULKAN=ON
cmake --build build --config Release -j"$(nproc)"
```

Depois disponibilize `llama-server` no PATH ou defina um caminho explícito em `LLAMA_SERVER_BIN`. A opção CPU também é válida quando a máquina não tiver Vulkan funcional. A configuração do backend é definida pelo build do llama.cpp; o dashboard não transforma uma build CPU em Vulkan automaticamente.[2]

Confirme a instalação:

```bash
which llama-server
llama-server --version
./scripts/list-llama-devices.sh
```

## Configuração local

O instalador já configura `MODEL_DIR` e, opcionalmente, `OBSIDIAN_VAULT_DIR`. O arquivo `.env` não precisa ser editado para os caminhos básicos. Os parâmetros abaixo são ajustes avançados opcionais para o perfil de execução e múltiplas GPUs:

```dotenv
LLAMA_BASE_URL=http://127.0.0.1:8080
LLAMA_CPP_ONLY=true
LLAMA_BACKEND=vulkan
# O modelo ativo é informado ao iniciar scripts/start-llama-linux.sh
LLAMA_MODEL_ALIAS=63-ia-local
LLAMA_CONTEXT_SIZE=16384
LLAMA_N_GPU_LAYERS=999
LLAMA_GPU_IDS=
LLAMA_MAIN_GPU=0
LLAMA_TENSOR_SPLIT=
LLAMA_SPLIT_MODE=layer
```

A variável `LLAMA_BASE_URL` deve permanecer em loopback. O backend público rejeita endpoints remotos para impedir que o projeto seja apontado para um provedor de modelo externo. Para trocar o modelo ativo, informe um arquivo `.gguf` ao launcher; não é necessário alterar `MODEL_DIR` ou editar o `.env`.

## Instalação de múltiplos modelos locais

A plataforma pode manter vários arquivos GGUF no diretório `MODEL_DIR` e exibi-los no catálogo de modelos locais. O script de inicialização aceita um arquivo explícito:

```bash
./scripts/start-llama-linux.sh /home/seu-usuario/Models/modelo-a.Q5_K_M.gguf
```

Para trocar o modelo ativo, encerre o processo atual e inicie outro arquivo GGUF:

```bash
pkill -f 'llama-server.*--port 8080' || true
./scripts/start-llama-linux.sh /home/seu-usuario/Models/modelo-b.Q4_K_M.gguf
```

O comportamento padrão é **um modelo ativo por processo/dashboard**. Isso evita consumo inesperado de memória. Usuários avançados podem executar instâncias separadas do `llama-server` em portas diferentes, cada uma com seu próprio `.env` e dashboard, mas cada instância deve continuar em loopback e ser dimensionada conforme a RAM/VRAM disponível.

Todos os modelos devem ser arquivos `.gguf` locais e ser carregados pelo llama.cpp. O projeto não instala, converte, baixa ou executa modelos em outro runtime.

## Múltiplas GPUs

Liste os dispositivos reconhecidos pelo próprio llama.cpp:

```bash
./scripts/list-llama-devices.sh
```

Use o modo padrão de pipeline por camadas:

```dotenv
LLAMA_BACKEND=vulkan
LLAMA_GPU_IDS=Vulkan0,Vulkan1
LLAMA_SPLIT_MODE=layer
LLAMA_TENSOR_SPLIT=1,1
LLAMA_MAIN_GPU=0
```

O comando equivalente será construído pelo script com `--split-mode layer`, `--tensor-split`, `--device` e os demais parâmetros aplicáveis. A documentação oficial confirma `layer`, `row`, `tensor` e `none`; `row` é legado e `tensor` é experimental, portanto o beta recomenda começar por `layer`.[10]

Para restringir a uma GPU, use `LLAMA_SPLIT_MODE=none` e `LLAMA_MAIN_GPU` conforme a enumeração do llama.cpp. Para usar CPU, configure:

```dotenv
LLAMA_BACKEND=cpu
LLAMA_SPLIT_MODE=none
LLAMA_N_GPU_LAYERS=0
```

Múltiplas GPUs não garantem ganho de velocidade. A validação depende de memória, interconexão, driver, modelo, quantização, contexto e suporte efetivo do backend. O projeto registra a configuração escolhida, mas não declara compatibilidade universal.

## Documentos e Obsidian

A área de arquivos aceita uploads locais e extração de formatos comuns. O Obsidian é integrado por arquivos Markdown; a pasta `.obsidian` é protegida e o conteúdo recuperado é tratado como referência, não como política de execução.

```dotenv
OBSIDIAN_VAULT_DIR=/home/seu-usuario/Documentos/MeuVault
```

O projeto não exige plugin do Obsidian para ler e gravar Markdown. Plugins são opcionais e não são instalados automaticamente.

## Terminal e responsabilidade

O terminal fica desligado por padrão. Quando ativado, aceita somente comandos definidos na allowlist, sem shell livre, pipes, redirecionamentos, `sudo` ou comandos arbitrários. A allowlist não é um sandbox forte; para executar código não revisado, use uma conta Linux dedicada ou outra camada de isolamento.

O proprietário é responsável pelas ações que decidir habilitar. O sistema registra ferramenta, tarefa, código de saída e resumo, mas a decisão de permitir alteração de arquivo, instalação de pacote, uso de rede, publicação ou exclusão continua sendo do operador.

## Tavily opcional

A Tavily não é um runtime de modelo. Ela pode ser habilitada somente para pesquisa web e permanece desligada por padrão:

```dotenv
TAVILY_ENABLED=true
TAVILY_API_KEY=tvly-sua-chave
```

A chave fica no backend, não no navegador e não no llama.cpp. Para uma distribuição estritamente offline, mantenha `TAVILY_ENABLED=false`.

## Troubleshooting rápido

| Sintoma | Causa provável | Correção |
|---|---|---|
| `llama-server não encontrado` | Binário fora do PATH | Execute `which llama-server` ou defina um caminho explícito em `LLAMA_SERVER_BIN` |
| `Modelo não encontrado` | Caminho GGUF errado | Verifique `LLAMA_MODEL_PATH`, permissões e extensão `.gguf` |
| `modelo não carrega` | GGUF incompatível com build/modelo | Confirme a versão do llama.cpp e teste outro GGUF compatível |
| Dashboard mostra llama.cpp offline | Servidor não iniciado ou porta diferente | Inicie o script, confira `LLAMA_PORT` e `curl http://127.0.0.1:8080/health` |
| Erro de endpoint remoto | `LLAMA_BASE_URL` não está em loopback | Use `http://127.0.0.1:8080` ou `http://localhost:8080` |
| Vulkan não lista GPU | Driver/Mesa/Vulkan ausente | Execute `vulkaninfo --summary`, instale ferramentas e revise a build Vulkan |
| Multi-GPU falha ao alocar | Divisão ou contexto excessivos | Comece com `layer`, reduza contexto, ajuste `LLAMA_TENSOR_SPLIT` e valide uma GPU |
| `--device` rejeitado | Nome não corresponde ao `--list-devices` | Copie os nomes exatamente do diagnóstico |
| `tensor` falha | Suporte experimental ou backend incompatível | Volte para `LLAMA_SPLIT_MODE=layer` |
| Respostas lentas | Modelo grande, Q5/Q8, CPU ou interconexão | Teste Q4_K_M, reduza contexto, confirme offload e meça cada GPU |
| Upload retorna 413 | Limite de arquivo ou quantidade | Ajuste `MAX_UPLOAD_BYTES`/`MAX_UPLOAD_FILES` conscientemente |
| Obsidian não aparece | Vault ausente ou caminho incorreto | Use caminho absoluto e reinicie o serviço |
| Serviço systemd falha | `.env`, wrapper ou permissão | Rode `journalctl --user -u llama-dashboard.service -n 100 --no-pager` |
| CI falha no GitHub | Dependência, sintaxe ou teste quebrado | Reproduza `python -m pytest -q` localmente antes do push |

Para troubleshooting detalhado, consulte [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md). Para a lógica completa do programa, consulte [`docs/PROGRAM-LOGIC.md`](docs/PROGRAM-LOGIC.md).

## Desenvolvimento

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pytest -q
python -m compileall -q app
node --check static/app.js
node --check static/login.js
bash -n install-fedora.sh bin/*.sh scripts/*.sh
```

O workflow de GitHub Actions repete os testes sem GPU, modelo GGUF ou chave externa. Testes de hardware devem ser executados manualmente em Linux.

## Contribuição

Leia [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md) e [`docs/PROJECT-SPLIT.md`](docs/PROJECT-SPLIT.md). Pull requests devem manter Linux-only, llama.cpp-only, ausência de segredos, testes reproduzíveis e documentação de qualquer novo parâmetro de GPU ou modelo.

## Licença

O projeto será publicado sob a licença definida no arquivo `LICENSE` no momento do primeiro commit público. A escolha da licença deve ser revisada pelo mantenedor antes da publicação.

## Referências

[1]: https://llama.app/docs/api — API server do llama.cpp.
[2]: https://raw.githubusercontent.com/ggml-org/llama.cpp/master/docs/build.md — Build e backends do llama.cpp.
[10]: https://github.com/ggml-org/llama.cpp/blob/master/docs/multi-gpu.md — Multi-GPU no llama.cpp.
