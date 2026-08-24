# Softcom v4

Sistema separado em cinco módulos.

## 1. Conhecimento

Arquivo: `conhecimento.html`

Coleção MongoDB: `memories`

Rotas:
- `GET /api/memories`
- `POST /api/memories`
- `PUT /api/memories/:id`
- `DELETE /api/memories/:id`

Campos:
- título / palavra-chave;
- conteúdo detalhado;
- URL de imagem opcional.

**É a única base que alimenta o Chat Softcom.**

## 2. Documentação

Arquivos:
- `documentacao.html`
- `cadastro_documento.html`

Coleções:
- `document_folders`
- `documents`

Tipos aceitos:
- TEXTO
- PDF
- HTML
- VIDEO
- IMAGEM
- AUDIO
- LINK
- ARQUIVO

A Documentação é independente e **não alimenta nenhum chatbot**.

Recursos:
- criar, renomear e excluir pastas vazias;
- cadastrar, editar e excluir itens;
- visualizar texto, PDF e HTML;
- vídeo por YouTube, Vimeo, URL direta ou arquivo pequeno;
- visualizar imagem e áudio;
- abrir links externos;
- baixar arquivos genéricos.

Arquivos locais têm limite de 2,5 MB para manter a implantação simples em Vercel serverless e Base64 no MongoDB. Para vídeos maiores, use URL. Para armazenamento grande, migre o binário para Vercel Blob/S3 e guarde apenas a URL no MongoDB.

HTML é exibido em `iframe` com `sandbox` para reduzir risco de scripts do arquivo afetarem a aplicação.

## 3. Chat Softcom

Arquivo: `chat.html`

Rota: `POST /api/chat`

Pesquisa exclusivamente a coleção `memories` da aba Conhecimento.

Integração opcional com n8n:
- `N8N_SOFTCOM_WEBHOOK_URL`

## 4. Chat Contabilidade

Arquivo: `chat_contabilidade.html`

Rota: `POST /api/chat-contabilidade`

Base inicial: `data/contabilidade.js`

Tópicos iniciais:
- IRPJ;
- CSLL;
- Lucro Real;
- Lucro Presumido;
- Simples Nacional;
- MEI;
- PIS/Cofins;
- ICMS;
- ISS;
- IPI;
- ECD;
- ECF;
- EFD-Reinf;
- eSocial/DCTFWeb;
- retenções;
- IRRF;
- documentos fiscais;
- tributos estaduais e municipais;
- comércio exterior/IOF;
- ITR;
- compliance fiscal;
- impactos da Reforma em 2026.

Atualização declarada da base: **24/08/2026**.

Integração opcional:
- `N8N_CONTABILIDADE_WEBHOOK_URL`

## 5. Chat Reforma Tributária

Arquivo: `chat_reforma_tributaria.html`

Rota: `POST /api/chat-reforma`

Base inicial: `data/reforma-tributaria.js`

Inclui:
- EC 132/2023;
- LC 214/2025;
- LC 227/2026;
- Decreto 12.955/2026;
- CBS;
- IBS;
- Imposto Seletivo;
- 2026 como ano de teste;
- transição 2027-2028;
- transição ICMS/ISS 2029-2032;
- vigência integral em 2033;
- reduções de 30% e 60%;
- hipóteses de alíquota zero;
- cashback;
- split payment;
- DeRE;
- Simples Nacional;
- pessoas físicas/CNPJ;
- conformidade e notas técnicas.

Atualização declarada da base: **24/08/2026**.

Integração opcional:
- `N8N_REFORMA_WEBHOOK_URL`

## Variáveis de ambiente na Vercel

Obrigatórias:
- `MONGODB_URI`
- `JWT_SECRET`

Recomendada:
- `REGISTER_ACCESS_PASSWORD`

Se `REGISTER_ACCESS_PASSWORD` não estiver configurada, o fallback é `otimus32`.

Opcionais:
- `N8N_SOFTCOM_WEBHOOK_URL`
- `N8N_CONTABILIDADE_WEBHOOK_URL`
- `N8N_REFORMA_WEBHOOK_URL`
- `N8N_SHARED_SECRET`

## MongoDB Atlas

Confira:
- Database Access: usuário com leitura/escrita;
- Network Access: permitir acesso da Vercel;
- para teste, `0.0.0.0/0`.

## Fontes principais das bases tributárias

As bases especiais foram montadas com referências oficiais, principalmente:
- Receita Federal - Reforma Tributária do Consumo;
- Receita Federal - legislação e orientações para 2026;
- Planalto - EC 132/2023, LC 214/2025 e LC 227/2026;
- Receita Federal - ECD, ECF, EFD-Reinf e DCTFWeb;
- Receita Federal - IRPJ e CSLL;
- Receita Federal - atualizações do Simples Nacional em 2026.

Os links completos ficam dentro de cada item nos arquivos `data/contabilidade.js` e `data/reforma-tributaria.js` e aparecem como fontes nos chats.

## Observação tributária

Chat Contabilidade e Chat Reforma Tributária são bases informativas e não substituem análise profissional do caso concreto. Regras tributárias podem mudar por lei, decreto, ato conjunto, resolução, nota técnica, norma estadual ou norma municipal.
