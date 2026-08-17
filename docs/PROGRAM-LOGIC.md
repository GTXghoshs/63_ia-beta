# Lógica de funcionamento do 63_ia (beta)

## Visão geral

O 63_ia (beta) é uma aplicação local em camadas. O navegador serve apenas como interface; o backend valida e coordena; o llama-server executa o modelo; o sistema operacional fornece arquivos, processos e GPUs. Nenhuma camada deve assumir a responsabilidade de outra.

```text
UI estática
  │ fetch / SSE
FastAPI local
  ├── valida schemas e limites
  ├── monta referências de arquivos/Obsidian
  ├── protege segredos
  ├── controla terminal por allowlist
  └── encaminha chat
       │ HTTP loopback
llama-server
  ├── carrega GGUF
  ├── escolhe CPU/Vulkan/dispositivos
  ├── mantém KV cache
  └── responde streaming
```

## Inicialização

Em importação, o backend lê o `.env` local sem substituir variáveis já definidas pelo processo. A configuração é congelada após validação. O endpoint do modelo precisa estar em `127.0.0.1`, `localhost` ou `::1`; isso impede que o beta seja transformado em proxy para um serviço remoto. O backend cria somente os diretórios locais necessários para dados e uploads.

O serviço systemd chama o wrapper do dashboard. O wrapper lê somente host e porta, inicia o Uvicorn e mantém o serviço sob o usuário atual. O `llama-server` é iniciado separadamente pelo script de modelo, sempre em loopback.

## Comunicação de chat

1. O navegador envia uma lista de mensagens, parâmetros de geração, IDs de arquivos e caminhos de notas.
2. O Pydantic valida quantidade, papéis, conteúdo e limites de caracteres.
3. O backend extrai somente os dados selecionados, adiciona marcadores de referência e não trata instruções encontradas nos documentos como comandos.
4. O backend monta a requisição compatível com `POST /v1/chat/completions`, incluindo `stream=true`.
5. O `requests` recebe linhas do servidor local e o gerador traduz deltas em eventos `delta`, raciocínio em `reasoning`, uso em `stats`, fim em `done` e falha em `error`.
6. O navegador atualiza o chat sem armazenar uma chave do llama.cpp.

Se o processo do llama-server estiver offline, o backend retorna erro SSE controlado e a interface mantém o dashboard utilizável. Isso diferencia falha de infraestrutura de falha do modelo.

## Modelos e GPUs

O catálogo reúne modelos GGUF encontrados no diretório configurado e modelos publicados pelo endpoint local `/v1/models`. O dashboard não baixa modelos. O script `start-llama-linux.sh` valida extensão `.gguf`, backend, split mode, dispositivos, divisão de tensores, porta, alias, contexto e camadas de GPU antes de construir o comando.

No modo CPU, passa `--n-gpu-layers 0`. Nos modos GPU, passa `--n-gpu-layers`, `--split-mode` e, quando configurados, `--device`, `--tensor-split` e `--main-gpu`. O script não promete que a GPU existe: ele delega a enumeração a `llama-server --list-devices` e ao diagnóstico Vulkan.

## Arquivos e Obsidian

Uploads recebem um ID e um nome sanitizado. O conteúdo é gravado no diretório local, limitado por tamanho e quantidade, e nunca é executado. Extratores locais lidam com tipos suportados; formatos desconhecidos permanecem como anexo.

O caminho do Obsidian é resolvido e comparado com a raiz autorizada. Caminhos fora do vault, a pasta `.obsidian` e extensões não Markdown são bloqueados para escrita. Notas são gravadas em arquivo temporário e renomeadas, reduzindo o risco de escrita parcial.

## Tavily

Tavily é uma integração opcional fora do núcleo de inferência. Quando desativada, nenhuma chamada remota é feita. Quando habilitada, somente o backend envia a chave Bearer para o endpoint configurado, usando cache e limites de resultado. A chave não aparece em `/api/config`, no navegador ou no llama-server.

## Terminal

O endpoint de terminal primeiro verifica autenticação remota, depois a flag `TERMINAL_ENABLED`, depois a allowlist de executáveis, argumentos, caminhos e metacaracteres. A execução usa `shell=False`, ambiente mínimo, timeout, limite de saída e auditoria. O resultado é devolvido com código de saída e saída truncada.

Esse desenho não é um sandbox forte. Ele reduz acidentes em diagnósticos do proprietário, mas não deve receber scripts não revisados, conteúdo de terceiros ou permissões de root.

## Segurança HTTP

O middleware protege APIs no modo remoto e aplica `Cache-Control: no-store`, CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `SameSite=Strict` e cookie HttpOnly no login. O modo local não exige login; o modo remoto exige `REMOTE_ACCESS_TOKEN` e limita tentativas.

## Limites de projeto

O 63_ia (beta) não é um sandbox completo, não gerencia modelos remotos, não garante compatibilidade universal de GPU, não executa múltiplos modelos no mesmo processo por padrão e não trata texto do Obsidian como política soberana. Essas restrições são deliberadas para manter o beta explicável e Linux-only.
