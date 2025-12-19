# Abix

**Seu Gerenciador de Ambientes de Desenvolvimento, Simples e Universal.**



[![Status do Workflow](https://github.com/MiguelArturSB/Abix/actions/workflows/teste-universal.yml/badge.svg)](https://github.com/MiguelArturSB/Abix/actions)
[![Licença](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

### O que é o Abix?

Abix é uma ferramenta de linha de comando (CLI) de **dependência zero** que gerencia ambientes de desenvolvimento Node.js e Python de forma rápida e isolada. Cansado de NVM, pyenv, Conda ou da complexidade do Docker para projetos simples? O Abix é a solução.

Com um único arquivo executável e um simples `abix.json`, você garante que qualquer pessoa em qualquer sistema operacional (Windows, macOS, Linux) rode seu projeto com as versões corretas das ferramentas, sem precisar instalar mais nada.

### ✨ Principais Funcionalidades

*   📦 **Zero Dependência:** Apenas um arquivo executável. Não requer Node.js, Python ou qualquer outra ferramenta pré-instalada no sistema.
*   🖥️ **Multiplataforma Universal:** Funciona de forma idêntica no Windows, macOS e Linux.
*   ⚡ **Rápido com Cache Inteligente:** Runtimes são baixados apenas uma vez e armazenados em cache global. Dependências de projetos são salvas em "snapshots", tornando instalações futuras quase instantâneas.
*   📄 **Configuração Declarativa:** Defina tudo que seu projeto precisa em um único arquivo `abix.json`.
*   🤖 **Detecção Automática:** O comando `abix init` pode detectar se seu projeto usa Node.js (`package.json`) ou Python (`requirements.txt`) e criar uma configuração inicial para você.
*   🛡️ **Seguro:** Verifica a integridade (hash) dos runtimes baixados para garantir que não foram adulterados.

### 🚀 Início Rápido

1.  **Baixe o Abix:** Vá para a [página de Releases](https://github.com/MiguelArturSB/Abix/releases) e baixe o executável para o seu sistema.

2.  **Configure o PATH (Recomendado):** Para usar o comando `abix` de qualquer lugar, siga nosso [**Guia de Instalação**](./docs/installation.md).

3.  **Inicie um Projeto:** Navegue até a pasta do seu projeto e execute:
    
    #### O Abix tentará detectar seu projeto (Node/Python)
    ```bash
    abix init
    ```

    #### Ou especifique as versões que você quer
    ```bash
    abix init node:20.11.0 python:3.11.3
    ```
    Isso criará um arquivo `abix.json`.

4.  **Execute:** Agora, instale as dependências e rode seu projeto.
    
    #### Instala os runtimes e dependências, e testa as versões
    ```bash
    abix testar
    ```
    #### Entra em um shell com o ambiente configurado
    ```bash
    abix shell
    ```

    #### Ou, se configurado no abix.json, roda o ponto de entrada do projeto
    ```bash
    abix run
    ```

### Comandos Principais

| Comando          | Descrição                                                 |
| ---------------- | --------------------------------------------------------- |
| `abix init`      | Cria o arquivo de configuração `abix.json` no projeto.    |
| `abix testar`    | Baixa runtimes e instala dependências listadas.           |
| `abix shell`     | Inicia um novo terminal com o ambiente do projeto ativado.  |
| `abix run`       | Executa o ponto de entrada (`entry`) definido no `abix.json`. |
| `abix clean`     | Remove arquivos e pastas locais gerados pelo Abix.        |
| `abix setup`     | Mostra instruções para adicionar o Abix ao PATH.          |

➡️ Para uma explicação detalhada de cada comando, confira a [**Referência de Comandos**](./docs/installation.md).

### 💡 Como Funciona?

O Abix centraliza todos os downloads em um diretório `.abix` na sua pasta de usuário. Quando você executa um comando, ele lê o `abix.json`, constrói um `PATH` temporário que prioriza os runtimes isolados e executa seu comando nesse ambiente seguro.

➡️ Quer saber mais? Leia nosso guia [**Como o Abix Funciona**](./docs/installation.md).

### 🤝 Contribuindo

Contribuições são muito bem-vindas! Se você tem ideias, sugestões ou encontrou um bug, sinta-se à vontade para abrir uma [Issue](https://github.com/MiguelArturSB/Abix/issues) ou enviar um [Pull Request](https://github.com/MiguelArturSB/Abix/pulls).

### 📝 Licença

Este projeto é distribuído sob a licença MIT. Veja o arquivo [LICENSE](./LICENSE) para mais detalhes.