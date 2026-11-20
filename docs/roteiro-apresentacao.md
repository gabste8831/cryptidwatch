# Roteiro da apresentação — CryptidWatch

4 apresentadores · ~15 minutos + demonstração · o texto completo de cada slide também
está nas **notas do apresentador** da apresentação.

| Quem | Slides | Assunto | Tempo |
|---|---|---|---|
| **Pessoa 1** · [Nome 1] | 1–4 e 17 | Abertura, o que é o app, requisitos, arquitetura, encerramento | ~4 min |
| **Pessoa 2** · [Nome 2] | 5–7 e 15 | Desenvolvimento seguro (SDD), pipeline, o que ela barrou, riscos aceitos | ~4 min |
| **Pessoa 3** · [Nome 3] | 8–10 | Terraform (plano de DR), achados do Learner Lab, segmentação de rede | ~3 min |
| **Pessoa 4** · [Nome 4] | 11–14 e 16 | WAF, Kubernetes, aplicação, upload seguro, demonstração | ~4 min + demo |

## Pessoa 1 — o caso

1. **Capa.** “O CryptidWatch é um site onde as pessoas registram avistamentos de criaturas
   lendárias. O tema é divertido; a segurança é séria. Essa foto é do Pé-Grande tentando
   calçar um tênis 44. Não coube.”
2. **O caso.** Funcionalidades: relato, fotos, busca, ranking, comentários, moderação,
   login com dois papéis. “Não é Hello World: 14 casos e 70 testes.”
3. **Requisitos.** Passar a tabela rápido: “os sete pedidos, e o slide onde cada um aparece”.
4. **Arquitetura.** “É o diagrama da parte 1, e foi isso que construímos.” Passa para a Pessoa 2.

## Pessoa 2 — desenvolvimento seguro e pipeline

5. **SDD.** 9 especificações, 63 requisitos SEC-xx, ameaças STRIDE; os critérios viram
   70 testes que citam o requisito no nome.
6. **Pipeline.** As 6 etapas; a `main` só aceita PR com os 8 checks verdes; actions
   fixadas por hash.
7. **A pipeline nos dedurou.** Trivy (78 CVEs), SonarCloud (senha no workflow),
   checkov (43 achados). “Encontrar, corrigir ou justificar: é o ciclo de auditoria.”

## Pessoa 3 — infraestrutura

8. **Terraform.** 88 recursos, nada criado à mão; um comando recria tudo em ~25 min;
   o ambiente foi destruído e recriado várias vezes (o DR foi testado de verdade).
9. **Learner Lab.** Os 4 achados e as soluções (bucket via CloudFormation, versão do EKS,
   acento no firewall, sem roles).
10. **Rede.** 3 camadas; dados sem rota para a internet; security groups em cadeia;
    NetworkPolicy “nega tudo”. Passa para a Pessoa 4.

## Pessoa 4 — a porta da frente e a aplicação

11. **WAF.** Regras gerenciadas + limite por IP; mostrar o 403 do SQL injection e do XSS.
12. **Kubernetes.** Pod Security restrito, containers sem privilégio, NetworkPolicy,
    nenhum segredo no cluster.
13. **Aplicação.** Stack e funcionalidades; os casos absurdos nas fotos.
14. **Upload seguro.** As 6 etapas da foto: URL de 5 min, quarentena, bytes mágicos,
    imagem refeita sem EXIF, moderação, link que expira.

## Pessoa 2 — auditoria

15. **Riscos aceitos.** checkov: 134 aprovadas, 0 falhas, 35 riscos aceitos com justificativa
    no código (laboratório, custo, chave própria).

## Pessoa 4 — demonstração

16. **Ao vivo** (deixe as abas abertas antes de começar):
    1. o site em `https://<endereço do ALB>` (aceitar o aviso do certificado autoassinado);
    2. criar conta → registrar relato → anexar foto;
    3. entrar como moderador → verificar o caso → ver no ranking;
    4. na barra do navegador: `…/api/sightings?q=' OR 1=1--` → **403**;
       `…/?busca=<script>alert(1)</script>` → **403**;
    5. mostrar no GitHub um PR com o SonarCloud reprovado.
    Se a internet falhar: “os prints estão nos slides anteriores”.

## Pessoa 1 — encerramento

17. “Os sete requisitos estão implementados e rodando na AWS, tudo documentado, e a pipeline
    já provou que funciona barrando nossos próprios erros. Caso encerrado. Perguntas?”

## Antes de apresentar (checklist)

- [ ] Iniciar o Learner Lab e subir o ambiente (~25 min antes)
- [ ] Rodar o `seed-moderator.sh` e o `seed-demo.mjs` (casos e fotos)
- [ ] Abrir as abas da demo; testar os dois 403
- [ ] Preencher os nomes nos slides
- [ ] Depois da apresentação: **Actions → Destruir infraestrutura**
