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

Perfeitamente configurado.