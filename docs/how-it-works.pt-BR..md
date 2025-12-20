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