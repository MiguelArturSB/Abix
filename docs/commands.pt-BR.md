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
