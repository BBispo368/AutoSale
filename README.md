# AutoSale Desktop 🚀

Aplicativo Desktop 100% autônomo, local e independente para **Prospecção de Empresas e Automação de WhatsApp**.

> **Zero Nuvem. Zero Docker. Zero Mensalidades.**  
> O código, os dados e o WhatsApp rodam diretamente no computador do cliente, com controle total e privacidade.

## ⬇️ Download

**[Baixar o instalador do AutoSale para Windows](https://github.com/BBispo368/AutoSale/raw/main/instalador/AutoSale-Setup-1.0.0.exe)** (pasta [`instalador/`](instalador/))

1. Baixe e abra o arquivo `AutoSale-Setup-1.0.0.exe`.
2. Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo** (o instalador ainda não tem assinatura digital).
3. Ao abrir o AutoSale, conecte o WhatsApp lendo o QR Code com o celular.

---

## 🌟 O que a Aplicação Faz

1. **WhatsApp Web Integrado**:
   - Sem necessidade de Docker ou Evolution API externa.
   - Abre o WhatsApp Web oficial numa janela do próprio programa para escanear o QR Code.
   - Sessão salva no computador: ao abrir o app, a conexão é restaurada automaticamente em segundo plano.
   - Delay humanizado antes de cada envio e intervalos aleatórios anti-bloqueio.

2. **Buscador de Empresas (Prospector por Nicho & Região)**:
   - Pesquisa estabelecimentos no Google Maps, de qualquer ramo (ex: *Pizzarias, Academias, Clínicas Odontológicas, Oficinas, Imobiliárias, etc.*).
   - Filtros por Nicho, Cidade e Estado (UF).
   - Coleta nomes, telefones formatados para WhatsApp, endereços e sites.
   - Adiciona os contatos à base local em 1 clique.

3. **Banco de Dados Local (Offline)**:
   - Todos os leads e configurações ficam salvos no computador do cliente.
   - Filtros de status (Pendentes, Enviados, Falhas).
   - **Exportação para Excel (.xlsx)** em 1 clique.
   - **Importação de Planilhas (Excel / CSV)** com mapeamento inteligente de colunas.

4. **Disparador Inteligente**:
   - Mensagens com tags dinâmicas: `{nome_empresa}`, `{cidade}`, `{ramo}`, `{telefone}`.
   - Spintax para variar o texto a cada envio: `{Olá|Oi|Bom dia}` sorteia uma das opções.
   - Delays aleatórios configuráveis (ex: entre 20 e 50 segundos entre envios).
   - Limite diário de mensagens e janela de horário de envio (ex: das 8h às 20h).
   - Confirma o envio de cada mensagem e detecta números sem WhatsApp e sessão expirada.
   - Barra de progresso ao vivo, botões de Pausar, Retomar e Interromper.

---

## 🛠️ Como Executar

### Opção 1: Inicializador Rápido (1 Clique)
Dê um duplo clique no arquivo:
```
iniciar.bat
```

### Opção 2: Pelo Terminal
Para iniciar a aplicação:
```bash
npm start
```

Para desenvolvimento com Live Reload:
```bash
npm run electron:dev
```

Testes e checagem de tipos:
```bash
npm test
npm run typecheck
```

A renderização usa a CPU por padrão (evita tela preta em drivers de vídeo incompatíveis).
Em máquinas com GPU funcionando, abra com `--enable-gpu` ou defina `AUTOSALE_ENABLE_GPU=1`.

Os dados ficam em `%APPDATA%utosale-desktoputosale_database.json`. Se o arquivo for
corrompido, ele é preservado como `autosale_database.corrompido-<data>.json` e uma base nova é criada.

---

## 📦 Como Gerar o Instalador `.exe` para Vender aos Clientes

Para criar o instalador executável do Windows para distribuir para seus clientes:

```bash
npm run dist
```

O instalador pronto (`AutoSale Setup 1.0.0.exe`) será gerado na pasta:
```
release/
```
Esse instalador cria automaticamente o atalho na Área de Trabalho e no Menu Iniciar do Windows do seu cliente!
