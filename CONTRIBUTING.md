# Contribuindo com o 63_ia (beta)

O 63_ia (beta) aceita contribuições que mantenham a proposta de uma plataforma Linux local, explicável e baseada exclusivamente em llama.cpp. Antes de abrir uma issue ou pull request, leia o README, `docs/PROGRAM-LOGIC.md`, `docs/TROUBLESHOOTING.md` e `SECURITY.md`.

## Ambiente local

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

Não inclua `.env`, modelos GGUF, vaults, uploads, logs, screenshots, tokens, certificados ou dados pessoais em commits.

## Tipos de contribuição

São bem-vindas correções de Linux/Fedora, testes de backend llama.cpp, documentação, acessibilidade, tratamento de erros, suporte a drivers, perfis de GPU e melhorias de observabilidade. Integrações que adicionem um runtime de modelo diferente do llama.cpp não pertencem a este projeto.

Qualquer novo parâmetro de GPU deve explicar a versão/flag do llama.cpp, o backend esperado, o comportamento quando a opção não existir e como o usuário reverte a configuração. Qualquer nova ferramenta de terminal deve incluir allowlist, limites, testes de abuso e documentação de responsabilidade.

## Pull requests

Use uma branch descritiva, descreva o problema, a solução, os riscos e os testes executados. Para alterações de comportamento, inclua uma atualização do README ou do troubleshooting. Para mudanças no contrato da API, atualize os testes e explique compatibilidade.

```bash
git checkout -b feat/minha-mudanca
python -m pytest -q
git diff --check
git commit -m "feat: descreva a mudança"
git push -u origin feat/minha-mudanca
```

O mantenedor poderá pedir validação em hardware real. A CI não substitui teste de GPU, modelo GGUF, driver ou estabilidade do desktop.
