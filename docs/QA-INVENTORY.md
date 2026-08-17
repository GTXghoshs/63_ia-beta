# Revisão de qualidade — primeiro projeto

## Escopo revisado

O primeiro projeto é uma aplicação web local para Fedora Workstation, com backend FastAPI em `app/main.py`, interface estática em `static/`, scripts Bash de operação, serviço systemd de usuário e testes Python em `tests/`. O projeto possui integração local com llama.cpp, uploads e extração de documentos, Obsidian, Tavily opcional, terminal por allowlist e autenticação opcional para acesso remoto.

A árvore também contém documentação da versão futura 2.0, scripts de demonstração em vídeo e dois vídeos MP4. Esses itens não fazem parte do runtime do dashboard; serão tratados como artefatos de documentação e devem ser excluídos de uma publicação de código caso o repositório GitHub seja destinado somente ao software.

## Estado encontrado

| Item | Estado |
|---|---|
| Repositório Git local | Ainda não inicializado |
| Arquivo `.env` | Não encontrado no projeto revisado |
| `.env.example` | Presente com llama.cpp, Vulkan, Tavily, Obsidian, terminal e acesso remoto |
| Testes existentes | 15 testes distribuídos em 6 arquivos |
| Backend | 925 linhas, rotas de saúde, status, modelos, chat, Tavily, arquivos, Obsidian, métricas, auditoria, terminal e autenticação |
| Frontend | Navegação por módulos, chat, arquivos, Obsidian, Tavily, configurações e login remoto |
| Serviço | Unit file systemd de usuário com hardening e wrapper de host/porta |
| Integração GitHub | Ainda não configurada; será documentada e preparada sem publicar automaticamente |

## Critérios de aceite da bateria

O sistema será considerado validado quando as 25 verificações cobrirem inicialização, saúde, configuração, modelos, comunicação com llama.cpp, streaming SSE, Tavily, uploads, extração, Obsidian, terminal, autenticação remota, segurança HTTP, systemd, scripts, frontend, concorrência básica e higiene de publicação. Testes que dependem de GPU real, llama-server real, vault real, Tavily real ou celular real serão separados como validação de ambiente e não serão afirmados como passados pelo sandbox.

O resultado final deverá indicar, para cada teste, `PASS`, `FAIL` ou `N/A — depende do ambiente`, com evidência técnica e ação recomendada.
