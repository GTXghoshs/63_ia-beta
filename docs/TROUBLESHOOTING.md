# Troubleshooting — 63_ia (beta)

## Método geral

Diagnostique em ordem: sistema Linux, dependências, binário do llama.cpp, modelo GGUF, dispositivos, servidor, dashboard e, por último, integrações opcionais. Não altere várias variáveis ao mesmo tempo; registre a saída antes de tentar a próxima correção.

```bash
./scripts/diagnose-fedora.sh | tee /tmp/63-ia-diagnose.txt
which llama-server
llama-server --version
./scripts/list-llama-devices.sh
curl -i http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8090/api/healthz
```

## O dashboard não inicia

Confira o log do serviço:

```bash
systemctl --user status llama-dashboard.service --no-pager
journalctl --user -u llama-dashboard.service -n 100 --no-pager
```

Se aparecer `ModuleNotFoundError`, confirme se o instalador criou `.venv` e se o serviço aponta para o caminho correto do projeto. Se aparecer erro de porta, confira `DASHBOARD_PORT` e processos ativos com `ss -ltnp | grep -E '8090|8080'`.

Se aparecer `endpoint llama.cpp local`, o `LLAMA_BASE_URL` não está em loopback. Use `http://127.0.0.1:8080` ou `http://localhost:8080`; o projeto público não aceita endpoints remotos.

## O llama-server não é encontrado

```bash
command -v llama-server
llama-server --version
```

Se o binário estiver em uma pasta de build, não copie um modelo para substituir o binário. Defina o caminho real em `LLAMA_SERVER_BIN` ou adicione o diretório `bin` do llama.cpp ao PATH do usuário. Verifique também se a build possui o backend esperado.

## O modelo não carrega

O beta aceita somente arquivos `.gguf` locais. Confira:

```bash
file /caminho/modelo.gguf
ls -lh /caminho/modelo.gguf
```

Se o arquivo for incompleto, inválido ou não compatível com a versão instalada, obtenha uma cópia legítima e compatível. O dashboard não corrige modelos corrompidos nem converte formatos. Teste primeiro com contexto 4096 ou 8192 e uma única GPU; só depois suba para 16K, 24K ou 32K.

## O llama.cpp está offline

Inicie o servidor separado:

```bash
./scripts/start-llama-linux.sh /caminho/modelo.gguf
```

Em outra janela:

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/v1/models
```

Se o `health` falhar, o problema está no llama.cpp, no modelo, na porta ou no backend, não no dashboard. Confira a saída do processo e não oculte erros de alocação.

## Vulkan não aparece

```bash
vulkaninfo --summary
lspci -k
```

Instale os pacotes Vulkan/Mesa da sua distribuição e confirme que o driver ativo é o esperado. Uma build CPU do llama.cpp não habilita Vulkan apenas porque a máquina possui GPU. Recompile o llama.cpp com o backend Vulkan e repita `llama-server --list-devices`.

## Múltiplas GPUs

Comece listando os nomes reais:

```bash
./scripts/list-llama-devices.sh
```

Use primeiro uma configuração simples:

```dotenv
LLAMA_BACKEND=vulkan
LLAMA_GPU_IDS=
LLAMA_SPLIT_MODE=layer
LLAMA_TENSOR_SPLIT=
LLAMA_CONTEXT_SIZE=8192
```

Se funcionar, restrinja os dispositivos pelos nomes retornados:

```dotenv
LLAMA_GPU_IDS=Vulkan0,Vulkan1
LLAMA_SPLIT_MODE=layer
LLAMA_TENSOR_SPLIT=1,1
```

Se falhar com falta de memória, reduza contexto e divisão. Se falhar com `device` desconhecido, os nomes não correspondem ao diagnóstico. Se `tensor` falhar, volte para `layer`: o modo tensor é experimental no llama.cpp e não deve ser tratado como padrão universal.[1]

Múltiplas GPUs diferentes podem ter memórias, drivers, clocks e interconexões incompatíveis. Não misture uma placa instável no perfil padrão. Valide cada combinação com o mesmo modelo e prompt.

## Respostas lentas ou desktop instável

Compare CPU, uma GPU e multi-GPU com o mesmo modelo, contexto e número de tokens. Q5/Q8 melhora qualidade em alguns casos, mas aumenta memória. Q4_K_M costuma ser um primeiro perfil de capacidade, não uma promessa de qualidade superior.

Reduza `LLAMA_CONTEXT_SIZE`, `LLAMA_N_GPU_LAYERS` e o número de GPUs participantes. Evite habilitar várias sessões simultâneas na mesma memória. Use métricas do llama.cpp e observe a responsividade do desktop antes de declarar um perfil estável.

## Upload e documentos

Um erro HTTP 413 significa que o arquivo ou a quantidade excedeu os limites de `.env`. Um erro de extração significa que o formato não está instalado ou não é suportado. O arquivo original deve permanecer na área de upload e não ser executado pelo dashboard.

Para PDFs, confirme `pdftotext --version`. Para DOCX/ODT/PPTX, confirme as dependências Python e teste um arquivo pequeno. Imagens, áudio e vídeo podem ser armazenados, mas não serão compreendidos automaticamente pelo beta.

## Obsidian

Confirme que `OBSIDIAN_VAULT_DIR` é um caminho absoluto, que existe e que o usuário do serviço tem permissão de leitura. Para escrita com systemd endurecido, o caminho precisa aparecer em `ReadWritePaths`. A pasta `.obsidian` permanece protegida.

```bash
ls -ld /caminho/do/vault
find /caminho/do/vault -maxdepth 2 -name '*.md' | head
systemctl --user cat llama-dashboard.service
```

## Tavily

A pesquisa web é opcional. Se estiver desligada, o endpoint retorna bloqueio e nenhuma chamada externa ocorre. Se estiver habilitada e retornar 401, revise a chave; 429/432 indicam limite de uso/plano. Nunca coloque a chave na interface, no Git ou em uma issue pública.

## Terminal

O terminal responde 403 quando desabilitado. Isso é o comportamento esperado. Quando habilitado, comandos fora da allowlist, metacaracteres, caminhos fora do workspace e flags não permitidas devem falhar. A allowlist não oferece isolamento completo; nunca a trate como substituto de sandbox ou usuário separado para código não confiável.

## Recuperação

Antes de atualizar:

```bash
cp .env .env.backup
python -m pytest -q
git status --short
```

Se a atualização falhar, volte ao commit anterior, restaure `.env`, reinicie o serviço e confirme `/api/healthz`. Não apague `data/audit.jsonl` antes de guardar o log necessário para diagnóstico.

## Referências

[1]: https://github.com/ggml-org/llama.cpp/blob/master/docs/multi-gpu.md — Multi-GPU no llama.cpp.
