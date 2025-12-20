# Frequently Asked Questions (FAQ)

### Why use Abix instead of NVM, pyenv, or Docker?

*   **Simplicity:** Abix is a single tool with a simple purpose: managing runtimes. It doesn't have the complexity of networking, volumes, and orchestration like Docker, nor does it require installing and managing shell scripts like NVM/pyenv.
*   **Portability:** A single `abix.exe` executable is all you need on Windows. There are no dependencies on WSL or Hyper-V.
*   **Speed:** The snapshot system makes restoring existing project environments almost instantaneous, being much faster than running `npm install` or `pip install` from scratch.

Abix shines in development and CI/CD scenarios where simplicity and speed are more important than complex container orchestration.

### Does Abix modify my system globally?

Very little. The only "global" modification it suggests is adding itself to the system PATH for your convenience.

All runtimes (Node, Python) and packages are installed inside the `~/.abix` folder, **fully isolated** and without interfering with any versions you may have already installed on your system.

### Where are the files stored?

The entire global cache for Abix (runtimes, snapshots, etc.) is stored in `~/.abix` (i.e., `C:\Users\YourName\.abix` on Windows).

### Is Abix secure?

Yes. Abix implements an integrity check for every downloaded runtime. For Node.js, it compares the hash of the downloaded file with the official list published on the `nodejs.org` website. For other runtimes, it adopts a TOFU (Trust On First Use) policy, where the hash from the first download is saved and verified in all future runs. If a file has been tampered with, Abix will refuse to execute it.

### How do I update a runtime version in a project?

Simply edit the version in your `abix.json` file:

**Before:**
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
Then, run abix testar. Abix will detect the new version, download it (if necessary), and recreate the dependency snapshot.
