# How Abix Works (Under the Hood)

Abix was designed to be simple on the surface, but its internal workings ensure isolation and speed through a smart caching system.

### 1. The Global Cache Directory (`~/.abix`)

Everything Abix downloads and manages is centralized in a single  `.abix` folder in your user's home directory. This keeps your system clean. The structure is:

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
*   **`runtimes`**: Stores the different versions of Node.js and Python you have used. Each is extracted into its own folder, completely isolated.
*   **`packages`**: Contains the global cache for `npm` and `pip` to speed up package downloads.
*   **`snapshots`**: Holds the dependency "snapshots" for each project (essentially, a compressed copy of your `node_modules`, folder, etc.).
*   **`locks`**: Keeps a security log with the hashes of each downloaded runtime.

### 2. The Execution Flow (e.g.,`abix run`)

When you run a command like `abix run`, the following happens:

1.  **Leitura do `abix.json`**: Abix reads the `abix.json` file in your directory to know which runtimes and versions are needed.

2.  **Verificação do Cache de Runtimes**: For each runtime (e.g., `node: "20.11.0"`):
    *   It checks if the `~/.abix/runtimes/node-v20.11.0-...` folder already exists.
    *   **If yes**, it uses the local version.
    *   **If not**,  it downloads the runtime from the official site (Node.js) or a trusted repository (Python).

3.  **Security Validation**: During the first download of a runtime, Abix calculates its hash (SHA256).
    *   For Node.js, it compares this hash with the official list of hashes published on the `nodejs.org` website.
    *   For others, it saves the hash in the `runtimes.lock` file (Trust On First Use - TOFU).
    *   If an already downloaded file has a different hash than expected, Abix will issue a security error and refuse to use it.

4.  **Building the Temporary PATH**: Abix creates a special `PATH` environment variable just for the command being executed. This variable places the project's runtime directories (`.../.abix/runtimes/node-v.../bin`) **nat the front** of your system's PATH. This ensures that when you type `node`, you execute the isolated version, not a global one.

5.  **Snapshot Management**:
    *   Abix calculates a unique hash for your project based on the contents of  `abix.json`, `package-lock.json`, `requirements.txt`, etc.
    *   It looks for a corresponding snapshot in `~/.abix/snapshots/`.
    *   **If a snapshot is found**, it is quickly extracted to your local directory (restoring `node_modules`, for example). This is extremely fast.
    *   **If not found**,  it runs the `init_commands` (like `npm install`), and at the end, creates a new snapshot for future use.

6.  **Command Execution**: Finally, Abix executes the requested command (`testar`, `shell`, or the `entry` from `run`)  within this temporary and perfectly configured environment.