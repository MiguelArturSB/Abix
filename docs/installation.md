# Guia de Instalação

Para obter a melhor experiência, recomendamos adicionar o executável do Abix ao `PATH` do seu sistema. Isso permite que você execute o comando `abix` de qualquer diretório no seu terminal.

### 1. Baixe o Executável

Vá até a [página de Releases](https://github.com/MiguelArturSB/Abix/releases) do nosso repositório e baixe a versão mais recente para o seu sistema operacional:
*   **Windows:** `abix.exe`
*   **macOS:** `abix-macos`
*   **Linux:** `abix-linux`

### 2. Configure o PATH

#### Para Windows

A maneira mais segura e garantida é fazer a configuração manualmente através do PowerShell.

1.  Mova o arquivo `abix.exe` para uma pasta permanente (por exemplo, `C:\Ferramentas\abix.exe`).
2.  Abra o menu Iniciar, digite "PowerShell" e execute-o.
3.  Copie o comando abaixo, **substituindo `C:\Caminho\Para\Sua\Pasta` pela localização real da pasta** onde você salvou o `abix.exe`, e pressione Enter.

    ```powershell
    [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';C:\Caminho\Para\Sua\Pasta', 'User')
    ```

4.  **Importante:** Feche e reabra todas as janelas do terminal (CMD, PowerShell, etc.) para que a mudança tenha efeito.

#### Para macOS e Linux

1.  Mova o executável baixado para um local permanente. Para facilitar, renomeie-o para `abix`.
2.  Torne o arquivo executável:
    ```bash
    chmod +x /caminho/para/abix
    ```
3.  A abordagem recomendada é criar um link simbólico em `/usr/local/bin`, que já costuma estar no seu PATH.

    ```bash
    # Substitua /caminho/para/abix pelo caminho real
    sudo ln -sf /caminho/para/abix /usr/local/bin/abix
    ```
    Alternativamente, você pode adicionar a pasta do Abix ao arquivo de configuração do seu shell (como `~/.bashrc`, `~/.zshrc`):

    ```bash
    # Adicione esta linha ao final do seu arquivo de configuração
    export PATH="/caminho/para/pasta/do/abix:$PATH"
    ```

4.  **Importante:** Reinicie seu terminal para que as mudanças tenham efeito.

### 3. Verifique a Instalação

Abra um **novo** terminal e digite:

```bash
abix --help
```
Se você vir a mensagem de ajuda do Abix, a instalação foi um sucesso!



### 4. `docs/commands.md`


### Referência de Comandos

Aqui está uma lista detalhada de todos os comandos disponíveis no Abix.

---

### `abix init [especificações...]`

Cria o arquivo de configuração `abix.json` na pasta atual.

**Uso:**
```bash
abix init [runtime:versão...] [--force]
```

**Comportamento:**
*   Se executado sem argumentos (`abix init`), ele tentará detectar se existe um `package.json` (para Node.js) ou um `requirements.txt` (para Python) e criará uma configuração padrão.
*   Você pode especificar runtimes e versões exatas.
*   A flag `--force` sobrescreverá um `abix.json` existente sem perguntar.

**Exemplos:**

### Detecção automática
```bash
abix init
```
### Especifica apenas Node.js com a versão 20.11.0
```bash
abix init node:20.11.0
```

### Especifica Node.js e Python, sem aspas
```bash
abix init node:20.11.0 python:3.11.3
```

### Força a sobrescrita do abix.json existente
```bash
abix init node:22 --force
```

---

### `abix testar`

Verifica o `abix.json`, baixa os runtimes necessários (se ainda não estiverem em cache) e instala as dependências do projeto.

**Uso:**
```bash
abix testar
```
Este é o comando ideal para executar após clonar um projeto ou após fazer alterações no `abix.json`. Ele garante que seu ambiente esteja 100% pronto para o desenvolvimento.

---

### `abix shell`

Inicia um novo sub-shell (terminal) com o ambiente do projeto ativado. Dentro deste shell, os comandos `node`, `npm`, `python`, `pip`, etc., usarão as versões especificadas no `abix.json`.

**Uso:**
```bash
abix shell
```
Para sair do ambiente, basta digitar `exit`.

---


### `abix run`

Executa o ponto de entrada (`entry`) definido no seu `abix.json`.

**Uso:**
```bash
abix run [argumentos adicionais...]
```

**Exemplo `abix.json`:**
```json
{
  "runtimes": { "node": "20.11.0" },
  "entry": "node server.js"
}
```

**Execução:**
```bash
# Executará "node server.js"
abix run

# Passará "--port 3000" para o seu script, executando "node server.js --port 3000"
abix run --port 3000
```

---
### `abix clean`

Remove arquivos e pastas gerados pelo Abix **no diretório local do projeto**.

**Uso:**
```bash
abix clean
```
Isso é útil para forçar uma reinstalação limpa das dependências. Ele apaga:
*   `node_modules`
*   `Lib` (cache de pacotes pip)
*   `.abix_state` (arquivo de estado do snapshot)

---
### `abix clean-global`

Realiza uma limpeza completa do cache global do Abix, localizado na sua pasta de usuário (`~/.abix`).

**Uso:**
```bash
abix clean-global --force
```
**Atenção:** Este comando removerá **todos os runtimes e snapshots baixados**. É um "reset de fábrica". Exige a flag `--force` para confirmação.

---

### `abix setup`

Mostra um guia com as instruções exatas para adicionar o Abix ao PATH do seu sistema, permitindo que o comando seja usado globalmente.

**Uso:**
```bash
abix setup
```
Este comando é ideal para quando você baixa o executável e quer configurá-lo manualmente.

---

### `abix del`

Mostra um guia com as instruções para remover completamente o Abix do seu sistema (remoção do PATH e limpeza do cache global).

**Uso:**
```bash
abix del
```

---

### 5. `docs/how-it-works.md`


# Como o Abix Funciona (Por Baixo dos Panos)

O Abix foi projetado para ser simples na superfície, mas seu funcionamento interno garante isolamento e velocidade através de um sistema de cache inteligente.

### 1. O Diretório de Cache Global (`~/.abix`)

Tudo que o Abix baixa e gerencia fica centralizado em uma única pasta `.abix` no diretório principal do seu usuário. Isso mantém seu sistema limpo. A estrutura é:

```markdown
~/.abix/
├── runtimes/
│ ├── node-v20.11.0-win-x64/
│ └── python-3.11.3-win32-x64/
├── packages/
│ ├── npm/
│ └── pip/
├── snapshots/
│ └── snap_abc123def456...
└── locks/
└── runtimes.lock
```
*   **`runtimes`**: Armazena as diferentes versões do Node.js e Python que você já usou. Cada um é extraído em sua própria pasta, completamente isolado.
*   **`packages`**: Contém o cache global do `npm` e `pip` para acelerar o download de pacotes.
*   **`snapshots`**: Guarda os "snapshots" de dependências de cada projeto (essencialmente, uma cópia compactada da sua pasta `node_modules`, etc.).
*   **`locks`**: Mantém um registro de segurança com os hashes de cada runtime baixado.

### 2. O Fluxo de Execução (ex: `abix run`)

Quando você executa um comando como `abix run`, acontece o seguinte:

1.  **Leitura do `abix.json`**: O Abix lê o arquivo `abix.json` no seu diretório para saber quais runtimes e versões são necessários.

2.  **Verificação do Cache de Runtimes**: Para cada runtime (ex: `node: "20.11.0"`):
    *   Ele verifica se a pasta `~/.abix/runtimes/node-v20.11.0-...` já existe.
    *   **Se sim**, ele usa a versão local.
    *   **Se não**, ele baixa o runtime do site oficial (Node.js) ou de um repositório confiável (Python).

3.  **Validação de Segurança**: Durante o primeiro download de um runtime, o Abix calcula seu hash (SHA256).
    *   Para o Node.js, ele compara esse hash com a lista oficial de hashes publicada no site `nodejs.org`.
    *   Para outros, ele salva o hash no arquivo `runtimes.lock` (confiança no primeiro uso - TOFU).
    *   Se um arquivo já baixado tiver um hash diferente do esperado, o Abix emitirá um erro de segurança e se recusará a usá-lo.

4.  **Construção do PATH Temporário**: O Abix cria uma variável de ambiente `PATH` especial, apenas para o comando que está sendo executado. Essa variável coloca os diretórios dos runtimes do projeto (`.../.abix/runtimes/node-v.../bin`) **na frente** do PATH do seu sistema. Isso garante que, ao digitar `node`, você execute a versão isolada, e não a global.

5.  **Gerenciamento de Snapshots**:
    *   O Abix calcula um hash único para o seu projeto, baseado no conteúdo do `abix.json`, `package-lock.json`, `requirements.txt`, etc.
    *   Ele procura por um snapshot correspondente em `~/.abix/snapshots/`.
    *   **Se encontra um snapshot**, ele o extrai rapidamente para o seu diretório local (restaurando `node_modules`, por exemplo). Isso é extremamente rápido.
    *   **Se não encontra**, ele executa os `init_commands` (como `npm install`), e ao final, cria um novo snapshot para uso futuro.

6.  **Execução do Comando**: Finalmente, o Abix executa o comando solicitado (`testar`, `shell`, ou o `entry` do `run`) dentro desse ambiente temporário e perfeitamente configurado.