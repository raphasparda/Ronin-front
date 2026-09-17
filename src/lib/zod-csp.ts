import { z } from 'zod';

/**
 * Sem compilação de parsers com `new Function`: a CSP do site (`script-src 'self'`, sem
 * `'unsafe-eval'`) bloqueia, e até a sondagem do Zod gera um `securitypolicyviolation`.
 * Precisa rodar antes de qualquer schema ser criado: é o primeiro import de `main.tsx`.
 */
z.config({ jitless: true });
