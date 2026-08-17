# Pesquisa técnica — dashboard local com llama.cpp

## API do llama.cpp

A documentação oficial consultada em 17/08/2026 indica que `llama serve` expõe uma API REST local, normalmente em `http://localhost:8080`, com endpoints compatíveis com OpenAI em `/v1/...`, endpoint compatível com Anthropic em `/v1/messages` e endpoints nativos do llama.cpp.[1]

O endpoint principal para o dashboard será `POST /v1/chat/completions`, com suporte a streaming usando `"stream": true`. A API também oferece `GET /v1/models`, `GET /health`, `GET /props`, `GET /slots` e `GET /metrics` quando métricas estão habilitadas. A resposta pode incluir `usage` e `timings`, úteis para exibir tokens por segundo, tempo de geração e uso de contexto.[1]

A documentação também registra suporte a saída estruturada via `response_format`, chamada de ferramentas via `tools`, entrada multimodal para modelos compatíveis e modelos de raciocínio com `reasoning_content`. O servidor pode exigir chave via `--api-key`; o dashboard deve manter essa chave apenas no backend e nunca no navegador.[1]

## Compilação no Linux/Fedora

As instruções oficiais de build indicam compilação CPU com `cmake -B build` e `cmake --build build --config Release`. Para Fedora/RHEL, a dependência de desenvolvimento para TLS é `openssl-devel`.[2]

A documentação lista backends para CPU, OpenBLAS, CUDA, Vulkan, HIP, SYCL, OpenCL e outros. O instalador do projeto deve detectar a GPU e permitir configurar o backend adequado, sem assumir CUDA. Quando não houver aceleração disponível, deve usar o binário CPU.[2]

## Decisões preliminares

O produto será tratado como uma aplicação web local com um serviço backend local. O backend será o único componente autorizado a acessar o processo do `llama-server`, arquivos de modelos e terminal. A execução de comandos será desabilitada por padrão, restrita ao usuário sem privilégios, com timeout, limite de saída, bloqueio de comandos destrutivos e registro de auditoria.

O dashboard inicial terá: status do llama.cpp, catálogo de modelos GGUF, seleção de modelo, chat com streaming, métricas de inferência, configurações de contexto/temperatura e terminal controlado. A instalação deverá ser reproduzível no Fedora por script, com arquivo de configuração, verificação de dependências e serviço systemd opcional.

## Acesso remoto pelo celular

O smoke test em uma porta isolada confirmou o comportamento real do navegador: sem sessão, `http://127.0.0.1:8091` redirecionou para `/login`; a tela de login carregou com layout próprio para celular; um token temporário correto criou a sessão HttpOnly e redirecionou para a visão geral. A visão geral continuou carregando com o llama.cpp offline e terminal desabilitado, como esperado no ambiente de teste.


A documentação oficial do Tailscale descreve o Serve como um encaminhamento de um serviço local para dispositivos da mesma tailnet, com regras de acesso aplicadas ao serviço; o exemplo usa `tailscale serve 3000` para um processo local. A mesma documentação recomenda manter o backend escutando somente em localhost quando o proxy é usado, evitando falsificação de cabeçalhos de identidade por chamadas diretas.[10] O dashboard será reforçado com autenticação própria por token e manterá `llama-server` em loopback.

## Obsidian no Fedora

A página oficial de download do Obsidian apresenta AppImage, Snap, Deb e uma opção Flatpak marcada como mantida pela comunidade, com o identificador `md.obsidian.Obsidian`.[9] O dashboard não depende de plugin para ler e gravar o vault: a integração usa arquivos Markdown locais, mantendo o plugin opcional e sob revisão do usuário.

## Verificação visual da Tavily e estética

A seção **Pesquisa web** carregou com navegação própria, estado `SEM CHAVE`, campo de consulta, profundidade, tópico, solicitação de resposta resumida, painel de controle local da chave e área de resultados. A tela manteve o mesmo sistema visual de fundo azul-marinho, acentos violeta/ciano, cartões de baixa saturação e hierarquia compacta do restante do dashboard. O botão de pesquisa permaneceu desabilitado sem configuração, evitando chamadas externas acidentais.

## Tavily Search API

A documentação oficial da Tavily informa que é possível obter uma chave gratuita pelo painel da plataforma, com **1.000 créditos de API por mês e sem cartão de crédito**.[5] O quickstart mostra o SDK Python `tavily-python` e uma chamada de busca com `TavilyClient`; para reduzir dependências e manter o controle no backend, a primeira integração usará HTTP direto no endpoint oficial de busca, com a chave em `TAVILY_API_KEY` e nunca no navegador.

O índice oficial atual aponta o endpoint `POST https://api.tavily.com/search`, com autenticação por chave de API e corpo JSON contendo `query`, `search_depth`, `max_results`, `topic`, filtros de domínio e opções de resposta. A documentação descreve `basic`, `fast`, `ultra-fast` e `advanced`, além de resultados com título, URL e conteúdo; a integração local começará com `basic`, até 5 resultados e sem conteúdo bruto para controlar latência e créditos.[7] A rota consultada anteriormente estava desatualizada, mas o índice e o endpoint atual foram confirmados.

A referência oficial confirma autenticação HTTP Bearer no formato `Authorization: Bearer tvly-...`, endpoint `POST https://api.tavily.com/search`, `max_results` entre 0 e 20, `search_depth` com custo de 1 crédito para `basic`, `fast` e `ultra-fast`, e 2 créditos para `advanced`. A resposta contém `results`, títulos, URLs, conteúdo curto, score e metadados de uso. A API documenta respostas `401` para chave ausente/inválida, `429` para limite de requisições e `432` para limite do plano.[8]

A implementação será protegida por timeout, limite de resultados, opção explícita de habilitar busca web e tratamento de erros/limite de créditos.

[5]: https://docs.tavily.com/documentation/quickstart — Quickstart — documentação oficial da Tavily.
[6]: https://www.tavily.com/pricing — Pricing — página oficial da Tavily.
[7]: https://docs.tavily.com/documentation/api-reference/endpoint/search.md — Tavily Search — referência oficial atual do endpoint.
[8]: https://docs.tavily.com/documentation/api-reference/endpoint/search.md — OpenAPI Search, autenticação e erros — referência oficial da Tavily.

## Referências

[1]: https://llama.app/docs/api — API server — llama.app, documentação oficial do llama.cpp.

[2]: https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md — Build llama.cpp locally — repositório oficial ggml-org/llama.cpp.
[10]: https://tailscale.com/docs/features/tailscale-serve — Tailscale Serve — documentação oficial de acesso a serviços locais na tailnet.
[11]: https://github.com/ggml-org/llama.cpp/blob/master/docs/multi-gpu.md — Using multiple GPUs with llama.cpp — documentação oficial.

## Múltiplas GPUs no llama.cpp

A documentação oficial de multi-GPU do llama.cpp confirma `--split-mode`/`-sm`, `--tensor-split`/`-ts`, `--main-gpu`/`-mg`, `--device` e `--list-devices`. O modo `layer` é o caminho padrão de pipeline parallelism; `row` é legado/depreciado; `tensor` é experimental e requer validação cuidadosa, especialmente fora do CUDA.[11]

O projeto público deverá expor esses parâmetros somente como configuração explícita, registrar a versão do llama.cpp e não afirmar que todas as combinações de GPUs são compatíveis. O diagnóstico deverá listar dispositivos e memória antes de iniciar o modelo.

## Backend Vulkan e compatibilidade de GPU

A documentação oficial atual do llama.cpp confirma que o projeto oferece um backend Vulkan para Linux, além de CPU, CUDA, HIP e outros backends. O build CPU usa CMake; a mesma documentação lista Vulkan como um caminho separado de aceleração.[4]

Decisão: o projeto público deve tratar Vulkan como caminho preferencial para GPUs Linux compatíveis, sem assumir fabricante, modelo, driver ou quantidade de memória. O diagnóstico deve confirmar `vulkaninfo --summary`, os dispositivos reportados por `llama-server --list-devices` e a configuração efetivamente usada antes de iniciar o servidor. Cada combinação de GPU deve ser validada com contexto conservador antes de aumentar a janela ou ativar divisão de tensores.

[4]: https://raw.githubusercontent.com/ggml-org/llama.cpp/master/docs/build.md — Build llama.cpp locally — documentação raw oficial de compilação.

## Verificação visual do protótipo

O dashboard foi iniciado em `127.0.0.1:8090` e carregou corretamente. A visão geral exibiu a arquitetura local, status `Offline` para o llama.cpp quando o servidor não está em execução, zero modelos detectados e terminal desabilitado. A navegação para o módulo de chat carregou o seletor de modelo, os parâmetros de temperatura/top-p/tokens, os atalhos de prompt e o composer com streaming preparado. A interface permaneceu legível em viewport desktop e deixou claro que os dados ficam locais.

## Verificação visual da expansão

A versão atual carregou a nova navegação **Arquivos & Obsidian**. O módulo exibiu a área de upload com limite de 500 MB por arquivo, a lista vazia de ingestão, o estado `NÃO CONFIGURADO` do Obsidian, busca de notas e editor desabilitado até uma nota ser selecionada. A tela explicou que documentos marcados podem ser usados no contexto do chat e que seu conteúdo é tratado como referência, não como comando.

## Verificação visual adicional

O módulo Terminal seguro exibiu o estado `DESABILITADO`, a instrução para manter `TERMINAL_ENABLED=false` por padrão e a lista explícita de comandos permitidos. O módulo Configurações exibiu o endpoint loopback, diretórios, timeout, limite de saída e o procedimento para alterar o `.env` e reiniciar o serviço. A interface também mostrou o aviso de que o terminal controlado não é um sandbox forte.

## Verificação técnica final

A suíte automatizada terminou com **51 testes aprovados**. A compilação Python e a checagem de sintaxe do JavaScript também passaram. O endpoint `/api/healthz` respondeu `200`, a configuração pública não incluiu `LLAMA_API_KEY`, o terminal desabilitado respondeu `403` e a resposta HTTP incluiu `Content-Security-Policy`, `X-Content-Type-Options` e `X-Frame-Options`.

## Requisitos confirmados para Obsidian

A documentação oficial do Obsidian informa que as notas são arquivos de texto simples em Markdown dentro de uma pasta chamada vault, incluindo subpastas. O Obsidian acompanha alterações externas e atualiza o vault. A pasta `.obsidian` na raiz contém configurações do vault e não deve ser manipulada pelo dashboard, exceto quando o usuário autorizar explicitamente.[3]

Decisão: a integração inicial será baseada em leitura e escrita atômica de arquivos Markdown dentro de um `OBSIDIAN_VAULT_DIR` configurado pelo usuário, com bloqueio da pasta `.obsidian`, prevenção de caminhos fora do vault e atualização de notas por arquivos temporários + renomeação. PDFs, imagens e outros anexos serão mantidos em uma área de ingestão separada; o dashboard não deverá alterar anexos originais sem confirmação.

[3]: https://obsidian.md/help/data-storage — How Obsidian stores data — documentação oficial do Obsidian.
