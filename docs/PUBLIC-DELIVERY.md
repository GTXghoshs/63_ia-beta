# Entrega pública — 63_ia (beta)

## Intenção

A 63_ia (beta) é uma plataforma Linux-only para operar modelos GGUF locais exclusivamente pelo llama.cpp. O objetivo é permitir conversa, programação, análise de documentos, integração com Obsidian, pesquisa web opcional e desenvolvimento assistido em um ambiente local, transparente e contribuível.

## Estado beta

O beta inclui backend FastAPI, interface web responsiva, streaming de chat, catálogo GGUF, uploads, extração local, notas Markdown, Tavily opcional, terminal por allowlist, autenticação remota opcional, serviço systemd e scripts de operação Linux. A plataforma não contém modelos nem baixa modelos automaticamente.

## Compatibilidade

A configuração pública usa loopback, CPU ou Vulkan conforme o build do llama.cpp, e perfis multi-GPU baseados em `split-mode`, `tensor-split`, `main-gpu` e `device`. O modo `layer` é o ponto de partida; `tensor` é experimental. Nenhum resultado universal de performance é declarado sem hardware real.

## Validação

A suíte herdada do primeiro projeto e os contratos públicos de Linux/llama.cpp devem passar na CI. A validação automatizada não substitui teste com `llama-server`, GGUF, driver Vulkan ou múltiplas GPUs reais.

## Limitações conhecidas

O beta não é sandbox forte, não oferece autonomia irrestrita, não possui OCR, transcrição, visão multimodal, RAG vetorial completo, download automático ou suporte a runtimes de modelo alternativos. A Tavily é a única integração externa opcional e fica desligada por padrão.

## Responsabilidade

A plataforma executa ações na máquina do proprietário conforme as permissões habilitadas. O usuário deve revisar modelos, comandos, documentos, tokens, plugins e alterações de sistema. A distribuição pública não promete segurança absoluta nem compatibilidade universal.
