# Problemas conhecidos e pendências

Público: Raphael e o time, rodando e testando o Ronin em desenvolvimento, e quem for preparar a Fatia 10 (deploy).

Última revisão: 2026-09-17, fim da entrega das Fatias 0 a 9.

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

**Contorno.** Rode de novo o comando que falhou. Para repetir só uma parte:

```powershell
pnpm --filter @kanban/api run test
pnpm --filter @kanban/web run test
pnpm test:e2e
```

Se `pnpm dev` cair no meio do uso, pare com Ctrl+C e rode `pnpm dev` de novo. O banco é assumido e parado corretamente na próxima execução ([`setup-local.md`](setup-local.md#problemas-comuns)).

## 2. Decisão pendente: bloqueio de login por e-mail

**Situação atual.** Após 5 senhas erradas para o mesmo e-mail em 15 minutos, esse e-mail fica bloqueado por 15 minutos, venha a tentativa de onde vier ([`overview.md` §6.4](../architecture/overview.md#64-limites-de-tentativa)).

**Risco.** Qualquer pessoa anônima que saiba o e-mail de alguém (por exemplo, do Admin) pode errar a senha 5 vezes a cada 15 minutos e manter essa conta fora do sistema por tempo indefinido. Não é invasão, mas é negação de acesso. Se o alvo for o único Admin, ninguém consegue gerar links de redefinição nesse período.

**Opções.**

| Opção | Como funciona | Prós | Contras |
| ----- | ------------- | ---- | ------- |
| A. Bloqueio por par e-mail + IP | Conta as falhas por e-mail e IP juntos; o bloqueio global por IP (20 falhas) continua | O atacante não bloqueia quem está em outro IP | Um atacante com muitos IPs volta a ter mais tentativas por conta |
| B. Atraso progressivo | Em vez de bloquear, cada falha aumenta a espera antes da próxima tentativa daquele e-mail | O dono da conta nunca fica totalmente fora | O atacante ainda deixa o login lento para a vítima |
| C. Dispositivo conhecido | Navegador que já fez login com sucesso recebe um cookie próprio e escapa do bloqueio por e-mail | O uso normal da equipe não é afetado | Mais complexo; não ajuda quem troca de navegador |

As opções podem ser combinadas (por exemplo, A + C). **Aguardando decisão do cliente.** Até lá, fica o comportamento atual. A decisão precisa sair antes do deploy (Fatia 10).

**Em desenvolvimento.** O bloqueio por e-mail fica gravado no banco (tabela `auth_throttle`). Reiniciar o `pnpm dev` não libera. Espere 15 minutos, use outro e-mail ou zere o banco local ([`setup-local.md`](setup-local.md#problemas-comuns)).

## 3. Limites de requisição que aparecem em testes

Ao testar à mão (várias contas, vários setups, links abertos várias vezes), estes limites podem responder `429`. A interface mostra o tempo de espera.

| Rota | Limite | Onde fica o contador | Como liberar em dev |
| ---- | ------ | -------------------- | ------------------- |
| `POST /api/setup` (tela "Configurar a equipe") | 5 req / 15 min por IP | memória da API | reiniciar o `pnpm dev` |
| `POST /api/auth/login` | 30 req / min por IP | memória da API | reiniciar ou esperar 1 min |
| Login: falhas por e-mail | 5 falhas / 15 min → bloqueio de 15 min | banco (`auth_throttle`) | esperar ou zerar o banco (seção 2) |
| Login: falhas por IP | 20 falhas / 15 min → bloqueio de 15 min | banco (`auth_throttle`) | esperar ou zerar o banco |
| Lookup e aceite de convite, lookup e uso de link de redefinição | 10 req / 15 min por IP, contados por rota | memória da API | reiniciar o `pnpm dev` |
| `POST /api/me/password` | 10 req / 15 min por usuário; senha atual errada também conta nas falhas por e-mail | memória e banco | reiniciar e, se bloqueou o e-mail, esperar |
| Demais rotas autenticadas | 600 req / min por usuário | memória da API | reiniciar |

Como tudo roda em `127.0.0.1`, todas as abas e navegadores da máquina contam como o mesmo IP. Um `429 TOO_MANY_ATTEMPTS` no login de uma conta pode vir das falhas de outra conta testada na mesma máquina (limite de 20 por IP).

Os valores e a ordem das checagens estão em [`overview.md` §6.4](../architecture/overview.md#64-limites-de-tentativa) e [`api.md` §18.5](../architecture/api.md#185-correções-da-revisão-de-segurança-v19).

## 4. Bloqueios do deploy (Fatia 10)

A revisão de segurança marcou estes itens como obrigatórios antes de colocar o Ronin na internet. Nenhum está feito, porque dependem dos arquivos da Fatia 10 (Dockerfile, Caddyfile e compose de produção), que ainda não existem. Referência: [`overview.md` §6.8](../architecture/overview.md#68-configuração-fail-closed-e-requisitos-do-deploy-fatia-10).

1. **`TRUST_PROXY` restrito.** Hoje a variável só aceita `true`/`false`. Com `true`, quem alcança a porta da API forja `X-Forwarded-For` e escapa do bloqueio por IP e dos limites de rota. A Fatia 10 precisa aceitar só o IP ou a sub-rede do Caddy, e a API deve escutar só na rede interna do compose.
2. **`NODE_ENV=production` no Dockerfile.** Definir `ENV NODE_ENV=production` na imagem da API, sem depender do compose ou do `.env` do servidor. Sem isso, o cookie perde `Secure`/`__Host-`, o `/api/docs` fica exposto e os parâmetros do Argon2 deixam de ser os de produção. A API já recusa subir com `APP_ORIGIN` em `https://` fora de produção, mas o Dockerfile é a garantia.
3. **Headers e CSP no Caddy.** Configurar `Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`, `X-Content-Type-Options` e `Permissions-Policy` conforme [`overview.md` §6.7](../architecture/overview.md#67-headers-e-demais-proteções), com HTTPS automático e HTTP redirecionando para HTTPS.
4. **Proteger a configuração inicial antes de abrir as portas.** Enquanto não existe usuário, qualquer pessoa que acessar o domínio vê a tela "Configurar a equipe" e vira Admin. Faça o setup antes de liberar 80/443 para a internet (por exemplo, por túnel SSH ou com o firewall aberto só para o seu IP) ou adote outra proteção definida na Fatia 10.

Os demais itens da Fatia 10 (backup fora da VPS com restauração testada, banco sem porta publicada, volta após reboot, documentação de instalação) estão em [`plan.md`](../architecture/plan.md#fatia-10-produção-em-vps-operação-e-fechamento-do-mvp).
