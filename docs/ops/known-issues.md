# Problemas conhecidos

Público: quem roda, testa e desenvolve o web do Ronin na própria máquina.

Última revisão: 2026-09-17, divisão do monorepo em ronin-api e ronin-web.

Pendências de produto e do deploy (bloqueio de login por e-mail, limites de requisição, bloqueios da Fatia 10) ficam no `docs/ops/known-issues.md` do **ronin-api**.

## 1. Node.exe fecha sozinho no Windows (exit 0xC0000409)

**Sintoma.** Nesta máquina Windows, processos `node.exe` caem de forma intermitente, sem erro de JavaScript. Já aconteceu com:

- workers do Vitest durante `pnpm test` (o Vitest acusa worker encerrado de forma inesperada);
- o servidor do Vite durante `pnpm test:e2e` (os testes seguintes falham por conexão recusada).

O código de saída é `0xC0000409`. No PowerShell, `$LASTEXITCODE` mostra `-1073740791`. Esse código é um encerramento forçado do próprio processo nativo, não uma falha de teste.

**Suspeita principal.** O Windhawk injeta DLLs em processos, inclusive no `node.exe`. A falha não aparece no CI (Linux) e não segue um teste específico, o que reforça a hipótese.

**Como confirmar.**

1. Abra o Windhawk e, nas configurações avançadas, adicione `node.exe` à lista de processos excluídos (ou desative os mods temporariamente).
2. Feche todos os terminais e o editor, para que nenhum `node.exe` antigo continue injetado.
3. Rode `pnpm test` e `pnpm test:e2e` algumas vezes. Se a falha sumir, a causa é a injeção.

**Contorno.** Rode de novo o comando que falhou (`pnpm test`, `pnpm test:e2e` ou `pnpm test:e2e --project=desktop`). Se o `pnpm dev` cair no meio do uso, pare com Ctrl+C e rode de novo.

## 2. Testes de componentes com timeout na primeira execução

Na primeira execução do `pnpm test` depois de um `pnpm install` (cache de transformação frio, incluindo a fonte do `@raphasparda/ronin-shared` no ronin-api), com a máquina carregada (outros `pnpm dev`, E2E em paralelo), alguns testes de tela podem estourar o tempo de espera (`Unable to find role=...` ou `Test timed out in 5000ms`). Rode de novo: com o cache quente passam. Se repetir sempre no mesmo teste, é falha real.

## 3. `@raphasparda/ronin-shared` não encontrado ou tipos estranhos

- **`Cannot find module '@raphasparda/ronin-shared'`** ou erro do Vite `The request url ... is outside of Vite serving allow list`: o ronin-api não está em `../ronin-api` ou não teve `pnpm install`. Clone/instale lá e rode `pnpm install` aqui de novo.
- **API em outra pasta**: defina `RONIN_API_DIR` no `.env` (proxy e E2E) **e** troque o `link:` do `package.json`, depois `pnpm install`.
- **Mudei o shared e o web não viu**: com `link:` a mudança é imediata; reinicie o `pnpm dev`/Vitest se o watcher não pegou. Com a versão do registro (`^0.1.0`), é preciso publicar uma versão nova e atualizar aqui (`docs/ops/shared-package.md` do ronin-api).

## 4. Portas ocupadas

| Porta       | Quem usa                     | O que fazer                                                                                     |
| ----------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| 5310        | `pnpm dev` deste repositório | feche a outra instância (`Get-NetTCPConnection -LocalPort 5310 \| Select-Object OwningProcess`) |
| 3100 / 5320 | `pnpm test:e2e` (API / web)  | outro E2E rodando; espere ou use `$env:E2E_API_PORT` / `$env:E2E_WEB_PORT`                      |
| 5173        | outro projeto da máquina     | nunca usada pelo Ronin                                                                          |
