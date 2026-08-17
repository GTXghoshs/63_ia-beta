# Separação dos projetos

## Projeto privado do proprietário

O projeto privado atende a um ambiente Fedora Workstation e a um perfil de hardware específico do proprietário, incluindo diretórios pessoais, vault Obsidian, modelos GGUF escolhidos, calibração de contexto e políticas de acesso remoto. Ele pode conter otimizações experimentais, caminhos locais, benchmarks, vídeos e decisões específicas que não devem ser publicados.

## 63_ia (beta) público

O projeto público fica em `63_ia-beta` e será publicado como **63_ia (beta)**. Ele não poderá depender de caminhos pessoais, GPU específica, modelo específico, vault privado, credenciais ou conteúdo do primeiro projeto. Sua compatibilidade será Linux-only e o único runtime de modelos será o ecossistema llama.cpp, com modelos GGUF locais.

| Aspecto | Privado | 63_ia (beta) público |
|---|---|---|
| Objetivo | Operação otimizada para o proprietário | Plataforma comunitária Linux-only |
| Hardware | Perfil Fedora/Vulkan específico do proprietário | CPU, uma ou várias GPUs conforme suporte do build |
| Modelos | Perfil e modelos do proprietário | Vários GGUF locais via llama.cpp |
| GPUs | Perfil Vulkan calibrado para a máquina | Detecção, seleção e perfis multi-GPU |
| Dados | Vault, diretórios e modelos pessoais | Somente exemplos e configuração vazia |
| Acesso | Pode usar configuração privada/remota | Loopback e terminal desabilitados por padrão |
| Documentação | Operação específica do Fedora do proprietário | Instalação Linux, arquitetura, troubleshooting e contribuição |
| Publicação | Privado | Público no GitHub como `63_ia-beta` |

O projeto público poderá receber melhorias derivadas do privado somente depois de revisão, remoção de dados pessoais, generalização de configurações e aprovação dos testes Linux. Mudanças feitas para um hardware específico não serão apresentadas como comportamento universal.
