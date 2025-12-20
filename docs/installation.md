
#  Installation Guide

For the best experience, we recommend adding the Abix executable to your system's `PATH`. This allows you to run the `abix` command from any directory in your terminal.

### 1.1. Download the Executable

Go to our repository's [Releases page](https://github.com/MiguelArturSB/Abix/releases) and download the latest version for your operating system:
*   **Windows:** `abix.exe`
*   **macOS:** `abix-macos`
*   **Linux:** `abix-linux`

### 1.2. Set up the PATH

#### For Windows

The safest and most reliable way is to configure it manually through PowerShell.

1.  Move the `abix.exe` file to a permanent folder (e.g., `C:\Tools`).
2.  Open the Start Menu, type "PowerShell", and run it.
3.  Copy the command below, **replacing `C:\Path\To\Your\Folder` with the actual location of the folder** where you saved `abix.exe`, and press Enter.

    ```powershell
    [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';C:\Path\To\Your\Folder', 'User')
    ```

4.  **Important:** Close and reopen all terminal windows (CMD, PowerShell, etc.) for the change to take effect.

#### For macOS and Linux

1.  Move the downloaded executable to a permanent location. To make it easier, rename it to `abix`.
2.  Make the file executable:
    ```bash
    chmod +x /path/to/abix
    ```
3.  The recommended approach is to create a symbolic link in `/usr/local/bin`, which is usually already in your PATH.

    ```bash
    # Replace /path/to/abix with the actual path
    sudo ln -sf /path/to/abix /usr/local/bin/abix
    ```
    Alternatively, you can add the Abix folder to your shell's configuration file (like `~/.bashrc` or `~/.zshrc`):

    ```bash
    # Add this line to the end of your configuration file
    export PATH="/path/to/your/abix/folder:$PATH"
    ```

4.  **Important:** Restart your terminal for the changes to take effect.

### 1.3. Verify the Installation

Open a **new** terminal and type:

```bash
abix --help
```
If you see the Abix help message, the installation was successful!
nvironment.