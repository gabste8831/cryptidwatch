# 03 — Upload de fotos

## Feature
O autor anexa até 3 fotos a um avistamento. Upload direto para o S3 por URL
pré-assinada; a API valida e reprocessa antes de a foto ir para moderação.

## Fluxo
1. `POST /api/sightings/:id/photos/upload-url` → API confere login e dono, gera
   URL pré-assinada de POST para `quarentena/<uuid>`.
2. Navegador envia o arquivo direto ao S3 (não passa pelo ALB/WAF).
3. `POST /api/photos/:uuid/confirm` → API baixa da quarentena, valida, reprocessa
   com `sharp`, grava `aprovadas/<uuid>.webp` + miniatura, apaga a quarentena.
4. Foto fica `pendente` até o moderador aprovar. Exibida por URL pré-assinada de GET (5 min).

## Requisitos
| ID | Requisito |
|---|---|
| SEC-04 | Tipo verificado pelos magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF....WEBP`), não pela extensão nem pelo `Content-Type`. SVG proibido. |
| SEC-30 | URL de POST expira em 5 min, `content-length-range` 1 B–5 MB, `Content-Type` restrito a jpeg/png/webp. |
| SEC-31 | Chave do objeto definida pela API (`quarentena/<uuid>`); o cliente não escolhe nome nem caminho (mitiga path traversal / sobrescrita). |
| SEC-32 | Só o dono do avistamento pede URL de upload e confirma; máximo de 3 fotos por relato. |
| SEC-33 | Reprocessamento com `sharp`: re-encode para WEBP, remove EXIF (GPS do usuário), limita a 4096×4096 px (mitiga decompression bomb). |
| SEC-34 | Bucket privado: Block Public Access ligado, criptografia SSE, sem ACL pública; acesso só por URL pré-assinada. |
| SEC-35 | URL de GET expira em 5 min; foto `pendente`/`rejeitada` só é vista pelo dono e por moderadores. |
| SEC-36 | Banco guarda só metadados: chave, SHA-256, tipo, tamanho, status. |
| SEC-37 | Objetos em `quarentena/` são apagados automaticamente após 1 dia (lifecycle), mesmo sem confirmação. |

## Ameaças (STRIDE)
| Ameaça | Cenário | Mitigação |
|---|---|---|
| **T**ampering | Arquivo poliglota (JPEG + HTML/JS) | SEC-04, SEC-33 |
| **T**ampering | SVG com `<script>` | SEC-04 |
| **I**nformation disclosure | EXIF revela GPS de quem tirou a foto | SEC-33 |
| **I**nformation disclosure | Bucket público / URL eterna | SEC-34, SEC-35 |
| **E**levation of privilege | Enviar foto para relato de outro usuário | SEC-32 |
| **D**enial of service | Arquivo de 2 GB / decompression bomb | SEC-30, SEC-33 |
| **R**epudiation | Não saber qual arquivo foi enviado | SEC-36 (SHA-256) |

## Critérios de aceite
- [ ] SEC-04: arquivo `.jpg` que na verdade é PNG com HTML anexado sai reprocessado como WEBP limpo.
- [ ] SEC-04: SVG renomeado para `.png` → 415.
- [ ] SEC-32: usuário B pedindo URL para relato de A → 404; 4ª foto → 409.
- [ ] SEC-33: foto com EXIF de GPS sai sem metadados.
- [ ] SEC-35: anônimo pedindo foto `pendente` → 404.
