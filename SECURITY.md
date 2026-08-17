# Segurança do 63_ia (beta)

## Escopo

O 63_ia (beta) é uma aplicação local em beta. O terminal vem desabilitado, o acesso remoto vem desabilitado e o llama-server deve permanecer em loopback. A allowlist do terminal reduz comandos acidentais, mas não constitui sandbox forte.

## Segredos

Nunca envie `.env`, `TAVILY_API_KEY`, `LLAMA_API_KEY`, `REMOTE_ACCESS_TOKEN`, certificados, chaves SSH, vaults, modelos privados ou logs sensíveis. Use os exemplos de configuração apenas como modelos e mantenha permissões restritas ao usuário.

Se uma chave for exposta, revogue-a imediatamente no serviço correspondente. Remover o arquivo do último commit não apaga necessariamente o histórico; reescreva o histórico somente com entendimento das consequências e substitua a credencial.

## Terminal

Não habilite terminal para conteúdo não revisado. Não execute como root. Mantenha `TERMINAL_ENABLED=false` até revisar a allowlist e o `WORK_DIR`. A plataforma não garante isolamento de processos, arquivos, kernel ou rede.

## Acesso remoto

Mantenha `DASHBOARD_HOST=127.0.0.1` por padrão. Se precisar de celular, prefira VPN/rede privada, token forte, sessão curta e terminal desabilitado. Não exponha `llama-server` diretamente, não faça port-forward no roteador e não use um proxy público sem uma arquitetura adicional.

## Modelo e documentos

Use somente GGUF obtido de origem confiável e compatível com llama.cpp. Documentos enviados podem conter instruções maliciosas; o sistema deve tratá-los como dados e não como política. Não conceda terminal ou escrita com base no conteúdo recuperado.

## Reporte

Não publique detalhes exploráveis de uma vulnerabilidade em issue pública antes de permitir correção. Abra um contato privado do mantenedor informado no perfil do repositório, descrevendo versão, sistema Linux, passos de reprodução, impacto e mitigação conhecida. Não envie segredos ou dados pessoais no relato.
