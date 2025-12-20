# Perguntas Frequentes (FAQ)

### Por que usar o Abix em vez de NVM, pyenv ou Docker?

*   **Simplicidade:** O Abix é uma ferramenta única com uma proposta simples: gerenciar runtimes. Ele não tem a complexidade de rede, volumes e orquestração do Docker, nem exige a instalação e o gerenciamento de scripts de shell como NVM/pyenv.
*   **Portabilidade:** Um único executável `abix.exe` é tudo que você precisa no Windows. Não há dependências de WSL ou Hyper-V.
*   **Velocidade:** O sistema de snapshots torna a restauração de ambientes de projetos existentes quase instantânea, sendo muito mais rápido que um `npm install` ou `pip install` do zero.

O Abix brilha em cenários de desenvolvimento e CI/CD onde a simplicidade e a velocidade são mais importantes que a complexa orquestração de contêineres.

### O Abix modifica meu sistema globalmente?

Muito pouco. A única modificação "global" que ele sugere é adicionar a si mesmo ao PATH do sistema para sua conveniência.

Todos os runtimes (Node, Python) e pacotes são instalados dentro da pasta `~/.abix`, **totalmente isolados** e sem interferir com quaisquer versões que você já tenha instalado no seu sistema.

### Onde os arquivos são armazenados?

Todo o cache global do Abix (runtimes, snapshots, etc.) é armazenado em `~/.abix` (ou seja, `C:\Users\SeuNome\.abix` no Windows).

### O Abix é seguro?

Sim. O Abix implementa uma verificação de integridade para cada runtime baixado. Para o Node.js, ele compara o hash do arquivo baixado com a lista oficial publicada no site `nodejs.org`. Para outros runtimes, ele adota uma política de TOFU (Trust On First Use), onde o hash do primeiro download é salvo e verificado em todas as execuções futuras. Se um arquivo for adulterado, o Abix se recusará a executá-lo.


### Como eu atualizo a versão de um runtime em um projeto?

Simplesmente edite a versão no seu arquivo `abix.json`:

**Antes:**
```json
{
  "runtimes": { "node": "20.11.0" }
}
```
**Depois:**
```json

{
  "runtimes": { "node": "20.12.0" }
}
```
Depois, rode abix testar. O Abix detectará a nova versão, fará o download (se necessário) e recriará o snapshot das dependências.
