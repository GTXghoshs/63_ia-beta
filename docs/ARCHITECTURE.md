# Arquitetura do dashboard local para llama.cpp

## Objetivo

O sistema será uma aplicação local para operar modelos GGUF quantizados através do `llama-server`, oferecendo uma interface de chat, gerenciamento de modelos, inspeção de saúde e métricas, além de um terminal controlado para tarefas autorizadas.

A prioridade será **estabilidade, previsibilidade e segurança local**. O sistema não dependerá de serviços externos para inferência, não enviará prompts ou arquivos para a nuvem e funcionará em modo somente CPU quando nenhuma aceleração GPU estiver disponível.

## Componentes

| Componente | Responsabilidade | Limite de confiança |
|---|---|---|
| Interface web local | Chat, modelos, métricas, configurações e terminal | Não acessa o sistema de arquivos nem executa comandos diretamente |
| Backend FastAPI | API local, validação, streaming, catálogo e auditoria | Único componente que conversa com `llama-server` e com o terminal |
| `llama-server` | Inferência GGUF quantizada | Processo separado, escutando apenas em loopback |
| Executor de terminal | Executa comandos aprovados sob usuário sem privilégios | Sem shell privilegiado, com timeout, limite de saída e bloqueios |
| Diretório de modelos | Armazena arquivos `.gguf` | Caminho configurável; leitura por padrão |
| Área de ingestão | Armazena uploads e fornece extração local limitada | Não executa arquivos; limite de tamanho e quantidade |
| Vault Obsidian | Lê e grava notas Markdown selecionadas | Bloqueia `.obsidian`, caminhos fora do vault e escritas não atômicas |
| Auditoria JSONL | Registra início, fim, status e duração dos comandos | Não registra segredos de ambiente nem conteúdo integral de prompts |
| systemd user service | Inicialização e reinício automático opcionais | Sem necessidade de root |

## Fluxo do chat

O navegador envia uma mensagem ao backend. O backend valida tamanho e campos, acrescenta o modelo selecionado e encaminha a solicitação para `POST /v1/chat/completions` no endereço configurado. O streaming é repassado ao navegador por Server-Sent Events. O backend nunca expõe a chave de API do `llama-server` ao cliente.

## Fluxo do terminal

O terminal inicia desabilitado. Quando habilitado localmente, o backend aceita somente comandos que passem por validação. O comando é executado com `shell=False`, como lista de argumentos, no diretório de trabalho configurado, com ambiente mínimo, timeout e limite de saída. Comandos perigosos ou tentativas de encadeamento, redirecionamento e substituição de comandos são bloqueados. Cada execução recebe um identificador e é registrada em JSONL.

O desenho não trata o terminal como sandbox forte. Para operações realmente não confiáveis, o usuário deverá usar uma conta Linux dedicada, toolbox/Podman ou uma VM. O dashboard indicará esse limite na própria interface.

## Configuração

A configuração será carregada de variáveis de ambiente, com valores padrão conservadores:

| Variável | Padrão | Finalidade |
|---|---|---|
| `LLAMA_BASE_URL` | `http://127.0.0.1:8080` | Endereço do `llama-server` |
| `LLAMA_API_KEY` | vazio | Chave opcional do servidor |
| `MODEL_DIR` | `~/Models` | Diretório de modelos GGUF |
| `WORK_DIR` | diretório do projeto | Diretório inicial do terminal |
| `TERMINAL_ENABLED` | `false` | Habilita execução controlada |
| `TERMINAL_TIMEOUT` | `20` | Tempo máximo por comando |
| `AUDIT_LOG` | `data/audit.jsonl` | Log de auditoria |
| `MAX_OUTPUT_BYTES` | `65536` | Limite de saída do terminal |
| `LLAMA_CONTEXT_SIZE` | `16384` | Contexto de referência do perfil inicial; pode subir até 32768 |
| `UPLOAD_DIR` | `data/uploads` | Área de ingestão local |
| `MAX_UPLOAD_BYTES` | `524288000` | Limite por arquivo |
| `OBSIDIAN_VAULT_DIR` | vazio | Caminho opcional do vault Markdown |

## Operação e estabilidade

O backend terá endpoints de saúde próprios e verificará o `/health` do `llama-server`. Falhas de conexão retornarão mensagens explícitas, sem travar a interface. O catálogo de modelos será obtido por extensão e tamanho do arquivo, com tratamento de erros de permissão. O serviço systemd usará reinício em caso de falha e permanecerá como serviço de usuário.

O projeto será entregue com script de instalação para Fedora, arquivo `.env.example`, configuração de serviço systemd, documentação de operação e testes automatizados para segurança do executor e validação da API.

## Escopo do primeiro protótipo

A versão atual inclui chat com streaming, status do servidor, lista de modelos GGUF, métricas básicas, configurações de geração, ingestão local de arquivos, seleção de contexto do Obsidian, edição atômica de notas e terminal controlado com lista de comandos seguros. RAG vetorial, embeddings, OCR, transcrição, visão multimodal, agentes autônomos e execução irrestrita ficam fora desta etapa para preservar segurança e previsibilidade.
