# AutoSale Desktop 🚀

Aplicativo Desktop 100% autônomo, local e independente para **Prospecção de Empresas e Automação de WhatsApp**.

> **Zero Nuvem. Zero Docker. Zero Mensalidades.**  
> O código, os dados e o WhatsApp rodam diretamente no computador do cliente, com controle total e privacidade.

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
   - Delays aleatórios configuráveis (ex: entre 20 e 50 segundos entre envios).
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
