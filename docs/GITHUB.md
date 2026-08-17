# Publicação e colaboração no GitHub — 63_ia (beta)

## Higiene antes do primeiro commit

O repositório público deve conter somente código, testes, documentação, scripts Linux, configuração de exemplo e workflow de CI. Não envie `.env`, modelos GGUF, uploads, vaults, logs, caches, vídeos, screenshots, chaves ou caminhos pessoais.

```bash
git status --short
git diff --check
find . -maxdepth 4 -type f \( -name '.env' -o -name '*.key' -o -name '*.pem' -o -name '*.gguf' \) -print
python3 -m pytest -q
```

A busca por segredos e modelos deve retornar vazia. A configuração pública `.env.example` é permitida; o `.env` real não é.

## Criar o repositório público

O plano aprovado usa o slug público `63_ia-beta` e o nome exibido **63_ia (beta)**. Antes de criar, confirme se o nome está livre:

```bash
gh auth status
gh repo view SEU_USUARIO/63_ia-beta
```

Se o comando indicar que o repositório não existe, inicialize e publique:

```bash
git init
git branch -M main
git add .
git diff --cached --check
git commit -m "feat: 63_ia beta Linux llama.cpp platform"
gh repo create 63_ia-beta --public --source=. --remote=origin --push
```

Se `63_ia-beta` já existir, pare e confirme o destino antes de usar outro nome. Não sobrescreva um repositório existente.

## Verificação depois do push

Abra a aba **Actions** e aguarde o workflow `quality`. Ele executa testes Python, compilação, JavaScript e sintaxe Bash sem GPU, modelo GGUF ou chave externa. Depois confira:

```bash
git remote -v
gh repo view --web
gh run list --limit 5
```

Verifique a árvore pública no GitHub e confirme que não há `.env`, modelo, upload, log, vídeo, cache ou token. Se um segredo for exposto, revogue-o imediatamente e trate o histórico como comprometido.

## Clonar e instalar

```bash
git clone https://github.com/SEU_USUARIO/63_ia-beta.git
cd 63_ia-beta
cp .env.example .env
nano .env
./scripts/install-fedora-deps.sh
./install-fedora.sh
systemctl --user enable --now llama-dashboard.service
```

O `README.md` e `docs/INSTALL-LINUX.md` explicam a instalação do llama.cpp, modelos GGUF, CPU, Vulkan e múltiplas GPUs. O `.env` é local e nunca deve ser commitado.

## Contribuir

```bash
git checkout -b feat/minha-capacidade
python3 -m pytest -q
git diff --check
git add .
git commit -m "feat: descreva a mudança"
git push -u origin feat/minha-capacidade
```

Abra um pull request descrevendo sistema Linux, versão do llama.cpp, backend, GPU, modelo/quantização, testes e limitações. Alterações de GPU devem indicar as flags do llama.cpp usadas e incluir fallback quando o recurso não estiver disponível.

## Política do projeto público

O 63_ia (beta) aceita apenas Linux, llama.cpp/llama-server local e modelos GGUF locais. Integrações de modelo remoto ou runtimes alternativos não devem ser adicionadas sem uma mudança explícita de escopo. Tavily, quando usada, é somente uma busca web opcional e separada do runtime de inferência.
