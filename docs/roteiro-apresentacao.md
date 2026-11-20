# Roteiro da apresentação — CryptidWatch

4 apresentadores · ~12 minutos + demonstração · o texto completo de cada slide também
está nas **notas do apresentador** da apresentação. A apresentação é a versão curta:
os detalhes técnicos, as etapas e todos os prints estão no artigo
(`docs/artigo/artigo-cryptidwatch.docx`).

| Quem | Slides | Assunto | Tempo |
|---|---|---|---|
| **Pessoa 1** · [Nome 1] | 1–4 e 14 | Abertura, o que é o app, requisitos, arquitetura, encerramento | ~3 min |
| **Pessoa 2** · [Nome 2] | 5–7 | Desenvolvimento seguro (SDD), pipeline, o que ela barrou | ~3 min |
| **Pessoa 3** · [Nome 3] | 8–10 | Terraform (plano de DR), segmentação de rede, Kubernetes | ~3 min |
| **Pessoa 4** · [Nome 4] | 11–13 | WAF, aplicação, demonstração | ~3 min + demo |

## Pessoa 1 — o caso

1. **Capa.** “O CryptidWatch é um site onde as pessoas registram avistamentos de criaturas
   lendárias. O tema é divertido; a segurança é séria. Essa foto é do Pé-Grande tentando
   calçar um tênis 44. Não coube.”
2. **O caso.** Funcionalidades: relato, fotos, busca, ranking, comentários, moderação,
   login com dois papéis. “Não é Hello World: 14 casos e 70 testes.”
3. **Requisitos.** Passar a tabela rápido: “os sete pedidos, e o slide onde cada um aparece.
   O detalhe técnico está no artigo.”
4. **Arquitetura.** “É o diagrama da parte 1, e foi isso que construímos.” Passa para a Pessoa 2.

## Pessoa 2 — desenvolvimento seguro e pipeline

5. **SDD.** 9 especificações, 63 requisitos SEC-xx, ameaças STRIDE; os critérios viram
   testes que citam o requisito no nome.
6. **Pipeline.** As 6 etapas; a `main` só aceita PR com os 8 checks verdes; actions
   fixadas por hash.
7. **A pipeline nos dedurou.** Trivy (78 CVEs), SonarCloud (senha no workflow; print do
   quality gate reprovado e depois aprovado), checkov (43 achados, corrigidos ou aceitos com
   justificativa). “Encontrar, corrigir ou justificar: é o ciclo de auditoria.”

## Pessoa 3 — infraestrutura

8. **Terraform.** 88 recursos, nada criado à mão; um comando recria tudo em ~25 min;
   o ambiente foi destruído e recriado várias vezes (o DR foi testado de verdade).
9. **Rede.** 3 camadas; dados sem rota para a internet; security groups em cadeia.
   No print: o banco dá timeout quando acessado pela internet.
10. **Kubernetes.** Pod Security restrito (o print mostra o pod root recusado), containers
    sem privilégio, NetworkPolicy “nega tudo” (de dentro do site, banco e internet dão timeout),
    nenhum segredo no cluster. Passa para a Pessoa 4.

## Pessoa 4 — a porta da frente, a aplicação e a demo

11. **WAF.** Regras gerenciadas + limite por IP. No print: busca normal 200; SQL injection,
    XSS e Log4Shell 403, e a regra do WAF que bloqueou cada um.
12. **Aplicação.** Stack e funcionalidades; os casos absurdos nas fotos; uma frase sobre o
    upload seguro (quarentena, bytes mágicos, imagem refeita sem GPS).
13. **Ao vivo** (deixe as abas abertas antes de começar):
    1. o site em `https://<endereço do ALB>` (aceitar o aviso do certificado autoassinado);
    2. criar conta → registrar relato → anexar foto;
    3. entrar como moderador → verificar o caso → ver no ranking;
    4. na barra do navegador: `…/api/sightings?q=' OR 1=1--` → **403**;
       `…/?busca=<script>alert(1)</script>` → **403**;
    5. mostrar no GitHub um PR com o SonarCloud reprovado.
    Se a internet falhar: “os prints estão nos slides anteriores”.

## Pessoa 1 — encerramento

14. “Os sete requisitos estão implementados e rodando na AWS, tudo documentado no artigo, e a
    pipeline já provou que funciona barrando nossos próprios erros. Caso encerrado. Perguntas?”

## Antes de apresentar (checklist)

- [ ] Iniciar o Learner Lab, atualizar os 3 secrets da AWS no environment `aws-academy`,
      voltar a variável `AWS_DEPLOY_ENABLED` para `true` e subir o ambiente (~25 min antes)
- [ ] Rodar o `seed-moderator.sh` e o `seed-demo.mjs` (casos e fotos)
- [ ] Abrir as abas da demo; testar os dois 403
- [ ] Preencher os nomes nos slides e no artigo
- [ ] Depois da apresentação: **Actions → Destruir infraestrutura**
