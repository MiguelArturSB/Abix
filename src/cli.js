const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const readline = require('readline');


const APP_VERSION = '1.0.0-mvp';
const PLATFORM = process.platform;
const ARCH = process.arch;
const IS_WIN = PLATFORM === 'win32';
const PATH_SEP = path.delimiter;
const APP_NAME = 'abix';
const IS_CI = process.env.CI || process.env.GITHUB_ACTIONS;


const IS_GUI_EXECUTION = IS_WIN && 
  (!process.env.TERM && !process.env.WT_SESSION) &&
  (!process.stdin.isTTY || !process.stdout.isTTY);

const tar = require('tar');
const AdmZip = require('adm-zip');
const baseDir = process.cwd();


function resolveAbixRoot() {
    const rootIdx = process.argv.indexOf('--root');
    if (rootIdx !== -1 && process.argv[rootIdx + 1]) {
        const customPath = path.resolve(process.argv[rootIdx + 1]);
        process.argv.splice(rootIdx, 2);
        return customPath;
    }
    if (process.env.ABIX_ROOT) return path.resolve(process.env.ABIX_ROOT);
    const defaultRoot = path.join(os.homedir(), '.abix');
    const configFile = path.join(defaultRoot, 'config.json');
    if (fs.existsSync(configFile)) {
        try {
            const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            if (cfg.root) return path.resolve(cfg.root);
        } catch (e) {}
    }
    return defaultRoot;
}

const ABIX_ROOT = resolveAbixRoot();
const runtimesCache = path.join(ABIX_ROOT, 'runtimes');
const npmCache = path.join(ABIX_ROOT, 'packages', 'npm');
const pipCache = path.join(ABIX_ROOT, 'packages', 'pip');
const snapshotsCache = path.join(ABIX_ROOT, 'snapshots');
const globalLockPath = path.join(ABIX_ROOT, 'locks', 'runtimes.lock');
const configPath = path.join(baseDir, 'abix.json');


let globalLockData = {};
if (fs.existsSync(globalLockPath)) {
    try { globalLockData = JSON.parse(fs.readFileSync(globalLockPath, 'utf8')); } catch(e) {}
}
function salvarGlobalLock() {
    const dir = path.dirname(globalLockPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(globalLockPath, JSON.stringify(globalLockData, null, 2), 'utf8');
}


const startTimeGlobal = Date.now();
function formatTime(ms) { return (ms / 1000).toFixed(2) + 's'; }

function forceDelete(targetPath) {
    if (fs.existsSync(targetPath)) {
        try { fs.rmSync(targetPath, { recursive: true, force: true }); } catch(e) {}
    }
}

function showHelp() {
    console.log(`
${APP_NAME.toUpperCase()} - Gerenciador de Ambientes Isolados v${APP_VERSION}

Uso:
  abix <comando> [argumentos]

Comandos:
  init [especificação]  Cria arquivo abix.json (ex: abix init node:22 python:3.12)
  setup                 Configura o Abix no PATH do sistema.
  testar                Verifica runtimes e testa versões instaladas.
  shell                 Entra no terminal isolado com PATH configurado.
  clean                 Limpa arquivos locais (.node_modules, .abix_state, abix.lock).
  clean-global          Apaga todo o diretório de cache do Abix ("reset de fábrica").
  del                   Desinstala completamente o Abix do sistema.
  run                   Executa o projeto usando a configuração do abix.json.

Opções:
  --root <path>         Define diretório customizado para cache.
  --force               Ignora confirmações (para clean-global e del).

Exemplos:
  abix init                    # Detecta automaticamente
  abix init node:22            # Especifica Node.js 22
  abix init python:3.12        # Especifica Python 3.12
  abix init node:20 python:3.11 # Ambos com versões específicas
    `);
}

async function extrairArquivo(source, dest, isZip) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, {recursive: true});
    if (isZip) {
        const zip = new AdmZip(source);
        zip.extractAllTo(dest, true);
    } else {
        await tar.x({ file: source, cwd: dest });
    }
}

function calcularHashArquivo(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (d) => hash.update(d));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

function spawnSeguro(bin, args, envPath) {
    return new Promise((resolve, reject) => {
        let finalBin = bin;
        if (IS_WIN && !path.extname(bin)) {
            if (['npm', 'pip'].includes(bin)) finalBin += '.cmd';
            else if (['python', 'node'].includes(bin)) finalBin += '.exe';
        }
        const proc = spawn(finalBin, args, {
            shell: false,
            stdio: 'inherit',
            env: { ...process.env, PATH: envPath, ABIX_ROOT, npm_config_cache: npmCache, PIP_CACHE_DIR: pipCache }
        });
        proc.on('error', reject);
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Falha (Exit ${code})`)));
    });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const req = https.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                downloadFile(res.headers.location, dest).then(resolve).catch(reject); return;
            }
            if (res.statusCode !== 200) { fs.unlink(dest, ()=>{}); reject(new Error(`HTTP ${res.statusCode}`)); return; }
            res.pipe(file);
            file.on('finish', () => { file.close(resolve); });
        });
        req.setTimeout(30000, () => { req.destroy(); fs.unlink(dest, ()=>{}); reject(new Error('Timeout (30s)')); });
        req.on('error', (err) => { fs.unlink(dest, ()=>{}); reject(err); });
    });
}

async function validarSegurancaRuntime(url, dest, lockKey, runtimeName, version, filename) {
    const fileHash = await calcularHashArquivo(dest);
    let expectedHash = globalLockData[lockKey] ? globalLockData[lockKey].integrity : null;
    let source = 'GLOBAL_LOCK';

    if (!expectedHash && runtimeName === 'node') {
        try {
            const data = await new Promise((res, rej) => {
                https.get(`https://nodejs.org/dist/v${version}/SHASUMS256.txt`, r => {
                    let d = ''; r.on('data', c => d+=c); r.on('end', () => res(d));
                }).on('error', rej);
            });
            const match = data.split('\n').find(l => l.includes(filename));
            if (match) { expectedHash = match.split(/\s+/)[0].trim(); source = 'OFICIAL_NODE'; }
        } catch (e) {}
    }

    if (expectedHash && fileHash !== expectedHash) {
        fs.unlinkSync(dest);
        throw new Error(`🚨 SEGURANÇA: Hash Inválido para ${filename}`);
    }
    
    if (!expectedHash) {
        console.log(`   ⚠️  Novo Runtime detectado: ${filename}`);
        console.log(`      ↳ Hash assinado em: ${globalLockPath}`);
        globalLockData[lockKey] = { url, integrity: fileHash, source: 'TOFU' };
        salvarGlobalLock();
    } else {
        console.log(`   🛡️  Integridade confirmada (${source}).`);
    }
}


const Managers = {
    async node(version) {
        const start = Date.now();
        const osName = IS_WIN ? 'win' : (PLATFORM === 'darwin' ? 'darwin' : 'linux');
        const archName = ARCH === 'x64' ? 'x64' : (ARCH === 'arm64' ? 'arm64' : 'x64');
        const folderName = `node-v${version}-${osName}-${archName}`;
        const ext = IS_WIN ? 'zip' : 'tar.gz';
        const filename = `${folderName}.${ext}`;
        const installPath = path.join(runtimesCache, folderName);
        const exePath = path.join(installPath, IS_WIN ? 'node.exe' : 'bin/node');

        if (fs.existsSync(exePath)) return { installPath, exePath };

        console.log(`⬇️  (Node) Baixando v${version}...`);
        const url = `https://nodejs.org/dist/v${version}/${filename}`;
        const archivePath = path.join(ABIX_ROOT, `temp_node.${ext}`);
        if (!fs.existsSync(ABIX_ROOT)) fs.mkdirSync(ABIX_ROOT, {recursive: true});
        
        await downloadFile(url, archivePath);
        await validarSegurancaRuntime(url, archivePath, `node-${version}-${osName}-${archName}`, 'node', version, filename);
        await extrairArquivo(archivePath, runtimesCache, IS_WIN);
        if (!IS_WIN) fs.chmodSync(exePath, 0o755);
        fs.unlinkSync(archivePath);
        console.log(`   ✅ Node pronto em ${formatTime(Date.now() - start)}`);
        return { installPath, exePath };
    },

    async python(version) {
        const start = Date.now();
        const folderName = `python-${version}-${PLATFORM}-${ARCH}`;
        const installPath = path.join(runtimesCache, folderName);
        const exePath = path.join(installPath, IS_WIN ? 'python.exe' : 'bin/python3');
        const pipExe = IS_WIN ? path.join(installPath, 'Scripts', 'pip.exe') : path.join(installPath, 'bin', 'pip3');

        if (fs.existsSync(exePath) && fs.existsSync(pipExe)) return { installPath, exePath, pipExe };

        console.log(`⬇️  (Python) Baixando v${version}...`);
        let url = '', filename = '', ext = IS_WIN ? 'zip' : 'tar.gz';
        if (IS_WIN) {
            filename = `python-${version}-embed-amd64.zip`;
            url = `https://www.python.org/ftp/python/${version}/${filename}`;
        } else {
            const archTag = ARCH === 'arm64' ? 'aarch64' : 'x86_64';
            const osTag = PLATFORM === 'darwin' ? 'apple-darwin' : 'unknown-linux-gnu';
            filename = `cpython-${version}+20230507-${archTag}-${osTag}-install_only.tar.gz`;
            url = `https://github.com/indygreg/python-build-standalone/releases/download/20230507/${filename}`;
        }

        const archivePath = path.join(ABIX_ROOT, `temp_py.${ext}`);
        if (!fs.existsSync(ABIX_ROOT)) fs.mkdirSync(ABIX_ROOT, {recursive: true});

        await downloadFile(url, archivePath);
        await validarSegurancaRuntime(url, archivePath, `python-${version}-${PLATFORM}-${ARCH}`, 'python', version, filename);
        await extrairArquivo(archivePath, IS_WIN ? installPath : runtimesCache, IS_WIN);
        
        if (IS_WIN) {
            const pth = fs.readdirSync(installPath).find(f => f.endsWith('._pth'));
            if (pth) fs.writeFileSync(path.join(installPath, pth), fs.readFileSync(path.join(installPath, pth), 'utf8').replace('#import site', 'import site'));
            console.log(`   ⚙️  Instalando PIP no ambiente isolado...`);
            const getPip = path.join(ABIX_ROOT, 'get-pip.py');
            if (!fs.existsSync(getPip)) await downloadFile('https://bootstrap.pypa.io/get-pip.py', getPip);
            await spawnSeguro(exePath, [getPip, '--quiet', '--no-warn-script-location'], installPath);
        } else {
            const extracted = path.join(runtimesCache, 'python');
            if (fs.existsSync(installPath)) fs.rmSync(installPath, {recursive: true});
            fs.renameSync(extracted, installPath);
            fs.chmodSync(exePath, 0o755);
        }
        fs.unlinkSync(archivePath);
        console.log(`   ✅ Python pronto em ${formatTime(Date.now() - start)}`);
        return { installPath, exePath, pipExe };
    }
};


async function gerenciarDependencias(commandsList, envPath, pythonRuntime) {
    if (!commandsList || !commandsList.length) return;
    const start = Date.now();
    
    let hashBase = fs.readFileSync(configPath, 'utf8') + PLATFORM + ARCH + APP_VERSION;
    ['package-lock.json', 'requirements.txt'].forEach(f => {
        if (fs.existsSync(path.join(baseDir, f))) hashBase += fs.readFileSync(path.join(baseDir, f), 'utf8');
    });
    const projectHash = crypto.createHash('sha256').update(hashBase).digest('hex');
    const snapshotPath = path.join(snapshotsCache, `snap_${projectHash}.tar`);
    const snapshotHashPath = snapshotPath + '.sha256';
    const stateFile = path.join(baseDir, '.abix_state');

    const currentState = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : '';
    if (currentState === projectHash && (fs.existsSync(path.join(baseDir, 'node_modules')) || fs.existsSync(path.join(baseDir, 'Lib')))) {
        return;
    }

    if (fs.existsSync(snapshotPath) && fs.existsSync(snapshotHashPath)) {
        const currentHash = await calcularHashArquivo(snapshotPath);
        if (currentHash === fs.readFileSync(snapshotHashPath, 'utf8')) {
            console.log(`⚡ Restaurando Snapshot de bibliotecas...`);
            await tar.x({ file: snapshotPath, cwd: baseDir });
            fs.writeFileSync(stateFile, projectHash);
            console.log(`   ✅ Restaurado em ${formatTime(Date.now() - start)}`);
            return;
        }
    }

    console.log(`📦 Instalando bibliotecas do zero...`);
    for (const cmd of commandsList) {
        const p = cmd.split(' ');
        
        if (p[0] === 'pip' && pythonRuntime && pythonRuntime.pipExe) {
            await spawnSeguro(pythonRuntime.pipExe, p.slice(1), envPath);
        } 
        else {
            if (p[0] === 'npm' && p[1] === 'install' && fs.existsSync('package-lock.json')) p[1] = 'ci';
            await spawnSeguro(p[0], p.slice(1), envPath);
        }
    }

    if (!fs.existsSync(snapshotsCache)) fs.mkdirSync(snapshotsCache, {recursive: true});
    const pastas = ['node_modules', 'Lib'].filter(f => fs.existsSync(path.join(baseDir, f)));
    if (pastas.length > 0) {
        await tar.c({ file: snapshotPath, cwd: baseDir }, pastas);
        fs.writeFileSync(snapshotHashPath, await calcularHashArquivo(snapshotPath));
    }
    fs.writeFileSync(stateFile, projectHash);
    console.log(`   ✅ Concluído em ${formatTime(Date.now() - start)}`);
}


function pauseForExit(message = "Pressione ENTER para sair.") {
    if (IS_GUI_EXECUTION || !process.stdin.isTTY) {
        console.log("\n" + "=".repeat(50));
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(message, () => {
            rl.close();
            process.exit(0);
        });
    }
}


function checkIfInPath(exeDir) {
    try {
        if (IS_WIN) {
            const currentPath = process.env.PATH || '';
            const userPath = execSync('powershell.exe -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'User\')"', { encoding: 'utf8' }).trim();
            return currentPath.includes(exeDir) || userPath.includes(exeDir);
        } else {
            const currentPath = process.env.PATH || '';
            return currentPath.includes(exeDir);
        }
    } catch (e) {
        return false;
    }
}


// --- CORREÇÃO APLICADA AQUI ---
function parseRuntimeSpecs(argsArray) {
    const specs = {};
    if (!argsArray) return specs;
    
    for (const arg of argsArray) {
        const [runtime, version] = arg.split(':');
        if (['node', 'python'].includes(runtime) && version) {
          specs[runtime] = version;
        }
    }
    return specs;
}


function initProject(specsArray = []) {
    const specs = parseRuntimeSpecs(specsArray);
    const config = {
        runtimes: {},
        init_commands: []
    };
    
    
    const DEFAULT_NODE_VERSION = "20.18.0"; 
    const DEFAULT_PYTHON_VERSION = "3.12.0"; 
 
    const packageJsonPath = path.join(baseDir, 'package.json');
    let hasNodeProject = false;
    let projectName = 'sem nome';
    
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            projectName = pkg.name || 'sem nome';
            hasNodeProject = true;
        } catch (e) {
            hasNodeProject = true; 
        }
    }
    
    
    const requirementsPath = path.join(baseDir, 'requirements.txt');
    const pyProjectPath = path.join(baseDir, 'pyproject.toml');
    const hasPythonProject = fs.existsSync(requirementsPath) || fs.existsSync(pyProjectPath);
    
    console.log("=".repeat(60));
    console.log("🚀 Configurando projeto Abix");
    console.log("=".repeat(60));
    
   
    if (Object.keys(specs).length > 0) {
        console.log("\n📋 Especificações recebidas:");
        for (const [runtime, version] of Object.entries(specs)) {
            console.log(`   ${runtime}: v${version}`);
            config.runtimes[runtime] = version;
            
            if (runtime === 'node') {
                config.init_commands.push("npm install");
            } else if (runtime === 'python') {
                config.init_commands.push("pip install -r requirements.txt");
            }
        }
    } 
  
    else if (hasNodeProject || hasPythonProject) {
        console.log("\n🔍 Projeto detectado automaticamente:");
        
        if (hasNodeProject) {
            console.log(`   📦 Node.js (${projectName})`);
            config.runtimes.node = specs.node || DEFAULT_NODE_VERSION;
            config.init_commands.push("npm install");
        }
        
        if (hasPythonProject) {
            console.log(`   🐍 Python`);
            config.runtimes.python = specs.python || DEFAULT_PYTHON_VERSION;
            config.init_commands.push("pip install -r requirements.txt");
        }
    }
  
    else {
        console.log("\n🤔 Nenhum projeto detectado automaticamente.");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question("Qual runtime você quer usar? (node/python/ambos): ", (answer) => {
            const normalized = answer.toLowerCase().trim();
            if (normalized === 'node' || normalized === 'ambos') {
                config.runtimes.node = DEFAULT_NODE_VERSION;
                config.init_commands.push("npm init -y");
                console.log("✅ Adicionado Node.js");
            }
            if (normalized === 'python' || normalized === 'ambos') {
                config.runtimes.python = DEFAULT_PYTHON_VERSION;
                config.init_commands.push("pip install");
                console.log("✅ Adicionado Python");
            }
            
           
            if (config.runtimes.node) {
                rl.question(`Versão do Node.js [padrão: ${DEFAULT_NODE_VERSION}]: `, (nodeVersion) => {
                    if (nodeVersion.trim()) {
                        config.runtimes.node = nodeVersion.trim();
                    }
                    
                   
                    if (config.runtimes.python) {
                        rl.question(`Versão do Python [padrão: ${DEFAULT_PYTHON_VERSION}]: `, (pyVersion) => {
                            if (pyVersion.trim()) {
                                config.runtimes.python = pyVersion.trim();
                            }
                            
                            saveConfigAndExit(config, rl);
                        });
                    } else {
                        saveConfigAndExit(config, rl);
                    }
                });
            } else if (config.runtimes.python) {
                rl.question(`Versão do Python [padrão: ${DEFAULT_PYTHON_VERSION}]: `, (pyVersion) => {
                    if (pyVersion.trim()) {
                        config.runtimes.python = pyVersion.trim();
                    }
                    
                    saveConfigAndExit(config, rl);
                });
            } else {
                console.log("⚠️  Nenhum runtime selecionado. Criando configuração vazia.");
                saveConfigAndExit(config, rl);
            }
        });
        return;
    }
    
    
    saveConfigAndExit(config);
}


function saveConfigAndExit(config, rl = null) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ Arquivo 'abix.json' criado com sucesso!");
    console.log(`📁 Local: ${configPath}`);
    console.log("\n📋 Conteúdo:");
    console.log(JSON.stringify(config, null, 2));
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Próximos passos:");
    console.log("   1. Edite o campo 'entry' no abix.json (ex: \"node app.js\")");
    console.log("   2. Execute: abix testar  # para verificar os runtimes");
    console.log("   3. Execute: abix run     # para executar o projeto");
    
    if (rl) {
        rl.close();
    }
    pauseForExit();
}


async function run() {
    const userArgs = process.argv.slice(2);
    const command = userArgs.find(arg => !arg.startsWith('--'));

    if (userArgs.length === 0) {
        console.log(`\n🚀 ${APP_NAME.toUpperCase()} - Gerenciador de Ambientes Isolados v${APP_VERSION}`);
        console.log("=".repeat(60));
        
        if (IS_GUI_EXECUTION) {
            console.log("\n🔍 Modo de instalação detectado (execução direta)");
            console.log("   Esta janela permanecerá aberta até você interagir.\n");
        }
        
        const exeDir = path.dirname(process.execPath);
        const isAlreadyInPath = checkIfInPath(exeDir);
        
        if (isAlreadyInPath) {
            console.log("✅ Abix já está configurado no seu PATH!");
            console.log("\nPara usar, abra um NOVO terminal e digite:");
            console.log("  abix --help");
            console.log("\nSe ainda não funcionar, tente:");
            console.log(`  1. Reinicie o computador`);
            console.log(`  2. Ou execute manualmente: "${process.execPath}" setup`);
        } else {
            console.log("Comandos disponíveis:");
            console.log("  • init [spec]   - Cria abix.json (ex: init node:22 python:3.12)");
            console.log("  • setup          - Adiciona ao PATH do sistema");
            console.log("  • testar         - Testa runtimes instalados");
            console.log("  • shell          - Abre terminal isolado");
            console.log("  • run            - Executa o projeto");
            console.log("  • clean          - Limpa arquivos locais");
            console.log("\nPara ver todos os comandos: abix --help");
        }
        console.log("=".repeat(60));
        
        const rl = readline.createInterface({ 
            input: process.stdin, 
            output: process.stdout 
        });
        
        rl.question("\nDeseja configurar o Abix no PATH do sistema agora? [S/N]: ", (answer) => {
            const upperAnswer = answer.toUpperCase().trim();
            if (upperAnswer === 'S' || upperAnswer === 'SIM' || upperAnswer === 'Y' || upperAnswer === 'YES') {
                console.log("\n🛠️  Configurando...");
                try {
                    console.log(`   Diretório do executável: ${exeDir}`);
                    
                    if (IS_WIN) {
                        
                        console.log(`\n📝 Adicionando ao PATH do usuário...`);
                        const psCommand = `
                            $exeDir = '${exeDir}'
                            $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
                            
                            if ($userPath -notlike "*$exeDir*") {
                                $newPath = $userPath + ';' + $exeDir
                                [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
                                Write-Host '✅ Adicionado ao PATH do usuário!' -ForegroundColor Green
                                Write-Host '   Diretório: $exeDir' -ForegroundColor Yellow
                            } else {
                                Write-Host 'ℹ️  Já estava no PATH do usuário.' -ForegroundColor Yellow
                            }
                            
                            # Também adicionar ao PATH da sessão atual (funciona imediatamente)
                            $sessionPath = [Environment]::GetEnvironmentVariable('Path', 'Process')
                            if ($sessionPath -notlike "*$exeDir*") {
                                $newSessionPath = $sessionPath + ';' + $exeDir
                                [Environment]::SetEnvironmentVariable('Path', $newSessionPath, 'Process')
                                Write-Host '✅ Adicionado ao PATH da sessão atual!' -ForegroundColor Green
                            }
                        `;
                        
                        try {
                            execSync(`powershell.exe -Command "${psCommand}"`, { stdio: 'inherit' });
                            
                            console.log("\n🎉 CONFIGURAÇÃO CONCLUÍDA!");
                            console.log("\n⚠️  IMPORTANTE: As mudanças no PATH exigem:");
                            console.log("   1. Feche TODOS os terminais abertos");
                            console.log("   2. Abra um NOVO terminal");
                            console.log("   3. Teste com: abix --help");
                            
                            console.log("\n💡 Solução alternativa imediata:");
                            console.log(`   Use o caminho completo: "${process.execPath}" --help`);
                            
                        } catch (e) {
                            console.error(`\n❌ Erro na configuração automática: ${e.message}`);
                            console.log("\n📋 Configure manualmente:");
                            console.log(`   1. Pressione Win + R, digite 'sysdm.cpl'`);
                            console.log(`   2. Vá em 'Avançado' → 'Variáveis de Ambiente'`);
                            console.log(`   3. Em 'Variáveis do usuário', selecione 'Path' → 'Editar'`);
                            console.log(`   4. Adicione: ${exeDir}`);
                        }
                    } else {
                        console.log("\n📝 Para Linux/macOS:");
                        console.log(`   Execute: sudo ln -sf "${process.execPath}" /usr/local/bin/${APP_NAME}`);
                        console.log(`   Ou adicione manualmente ao PATH:`);
                        console.log(`   export PATH="${exeDir}:\\$PATH" (adicione ao ~/.bashrc ou ~/.zshrc)`);
                    }
                } catch (e) {
                    console.error(`\n❌ Erro: ${e.message}`);
                }
            } else {
                console.log("\nℹ️  Configuração cancelada.");
                console.log(`   Você pode executar manualmente depois:`);
                console.log(`   "${process.execPath}" setup`);
            }
            
            console.log("\n" + "=".repeat(60));
            rl.question("Pressione ENTER para fechar... ", () => {
                rl.close();
                process.exit(0);
            });
        });
        
        return;
    }

    try {
        if (!command || command === '--help' || command === '-h') {
            showHelp();
            pauseForExit();
            return;
        }

        
        if (command === 'init') {
            const initIndex = userArgs.indexOf('init');
            // --- CORREÇÃO APLICADA AQUI ---
            const specsArray = userArgs.slice(initIndex + 1).filter(a => !a.startsWith('--'));
            const forceOverwrite = userArgs.includes('--force');
            
            if (fs.existsSync(configPath) && !forceOverwrite) {
                console.log(`\n⚠️  Arquivo 'abix.json' já existe neste diretório.`);
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question("Deseja sobrescrever? [S/N]: ", (answer) => {
                    if (answer.toUpperCase().trim() === 'S') {
                        initProject(specsArray);
                    } else {
                        console.log("Operação cancelada.");
                        rl.close();
                        pauseForExit();
                    }
                });
            } else {
                initProject(specsArray);
            }
            return;
        }

        const commandsThatNeedConfig = ['testar', 'shell', 'run'];
        if (commandsThatNeedConfig.includes(command) && !fs.existsSync(configPath)) {
            console.error(`\n⚠️  Arquivo '${path.basename(configPath)}' não encontrado no diretório atual.`);
            console.error(`   Este comando requer um projeto Abix.`);
            console.error(`   Execute 'abix init' para criar o arquivo de configuração.`);
            pauseForExit();
            return;
        }

        switch (command) {
            case 'setup': {
                console.log(`\n🛠️  Configurando ${APP_NAME} no seu sistema...`);
                const exeDir = path.dirname(process.execPath);
                
               
                const isAlreadyInPath = checkIfInPath(exeDir);
                if (isAlreadyInPath) {
                    console.log(`✅ ${APP_NAME} já está configurado no PATH!`);
                    console.log(`   Diretório: ${exeDir}`);
                    console.log(`\n💡 Se não funciona em alguns terminais:`);
                    console.log(`   1. Feche e reabra o terminal`);
                    console.log(`   2. Ou reinicie o computador`);
                    pauseForExit();
                    return;
                }
                
                try {
                    if (IS_WIN) {
                        console.log(`   Diretório: ${exeDir}`);
                        
                      
                        console.log(`\n📝 Configurando com PowerShell...`);
                        const psCommand = `
                            $exeDir = '${exeDir}'
                            
                            # Adicionar ao PATH do usuário
                            $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
                            if ($userPath -notlike "*$exeDir*") {
                                $newUserPath = $userPath + ';' + $exeDir
                                [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
                                Write-Host '✅ Adicionado ao PATH do usuário' -ForegroundColor Green
                            } else {
                                Write-Host 'ℹ️  Já estava no PATH do usuário' -ForegroundColor Yellow
                            }
                            
                            # Adicionar ao PATH da sessão atual
                            $processPath = $env:PATH
                            if ($processPath -notlike "*$exeDir*") {
                                $env:PATH = $processPath + ';' + $exeDir
                                Write-Host '✅ Adicionado ao PATH atual' -ForegroundColor Green
                            }
                            
                            Write-Host ''
                            Write-Host '🎉 Configuração concluída!' -ForegroundColor Cyan
                            Write-Host ''
                            Write-Host '⚠️  IMPORTANTE:' -ForegroundColor Yellow
                            Write-Host '   - Feche TODOS os terminais' -ForegroundColor Yellow
                            Write-Host '   - Abra um NOVO terminal' -ForegroundColor Yellow
                            Write-Host '   - Teste: abix --help' -ForegroundColor Yellow
                        `;
                        
                        execSync(`powershell.exe -Command "${psCommand}"`, { stdio: 'inherit' });
                        
                    } else {
                        // Linux/macOS
                        const target = `/usr/local/bin/${APP_NAME}`;
                        try {
                            if (fs.existsSync(target)) {
                                fs.unlinkSync(target);
                                console.log(`   Removido link antigo: ${target}`);
                            }
                            fs.symlinkSync(process.execPath, target);
                            console.log(`✅ Link simbólico criado em ${target}`);
                            console.log(`🚀 Agora você pode usar '${APP_NAME}' de qualquer lugar!`);
                        } catch (e) {
                            console.error(`❌ Permissão negada. Execute com sudo:`);
                            console.log(`   sudo "${process.execPath}" setup`);
                        }
                    }
                } catch (e) { 
                    console.error(`❌ Erro: ${e.message}`);
                    console.log(`\n📋 Configure manualmente:`);
                    console.log(`   1. Adicione este diretório ao seu PATH:`);
                    console.log(`      ${exeDir}`);
                    console.log(`\n   2. Ou use sempre o caminho completo:`);
                    console.log(`      "${process.execPath}" [comando]`);
                }
                pauseForExit();
                break;
            }

            case 'del': {
                if (!userArgs.includes('--force') && !IS_CI) {
                    console.log(`\n⚠️  AVISO: Isso DESINSTALARÁ completamente o ${APP_NAME} do seu sistema.`);
                    console.log(`   Use 'abix del --force' para confirmar.`);
                    pauseForExit();
                    return;
                }
                console.log(`\n🗑️  Removendo integração com o sistema...`);
                try {
                    const exeDir = path.dirname(process.execPath);
                    if (IS_WIN) {
                        const psCommand = `
                            $exeDir = '${exeDir}'
                            $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
                            $newPath = ($userPath.Split(';') | Where-Object { $_ -ne $exeDir }) -join ';'
                            [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
                            Write-Host '✅ Removido do PATH do usuário.' -ForegroundColor Green
                        `;
                        execSync(`powershell.exe -Command "${psCommand}"`, { stdio: 'pipe' });
                        console.log(`   ✅ Integração removida do PATH.`);
                    } else {
                        const target = `/usr/local/bin/${APP_NAME}`;
                        if (fs.existsSync(target)) {
                            fs.unlinkSync(target);
                            console.log(`   ✅ Link simbólico removido.`);
                        }
                    }
                } catch (e) {
                    console.error(`   ❌ Falha ao remover do PATH: ${e.message}`);
                }
                forceDelete(ABIX_ROOT);
                console.log(`\n✅ ${APP_NAME} desinstalado completamente.`);
                pauseForExit();
                break;
            }

            case 'clean-global': {
                if (!userArgs.includes('--force') && !IS_CI) {
                    console.log(`\n⚠️  AVISO: Isso apagará TODO o cache global:`);
                    console.log(`   ${ABIX_ROOT}`);
                    console.log(`\n   Use 'abix clean-global --force' para confirmar.`);
                    pauseForExit();
                    return;
                }
                forceDelete(ABIX_ROOT);
                console.log(`\n✅ Cache global do ${APP_NAME} removido.`);
                pauseForExit();
                break;
            }

            case 'clean': {
                ['node_modules', 'Lib', '.venv', 'abix.lock', '.abix_state'].forEach(f => {
                    const target = path.join(baseDir, f);
                    if (fs.existsSync(target)) {
                        console.log(`   Removendo: ${f}`);
                        forceDelete(target);
                    }
                });
                console.log(`\n🗑️  Limpeza local concluída.`);
                pauseForExit();
                break;
            }

            case 'testar':
            case 'shell':
            case 'run': {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                
               
                if (command === 'run' && !config.entry) {
                    console.error(`\n⚠️  O comando 'run' requer o campo 'entry' no arquivo abix.json.`);
                    console.error(`   Adicione em abix.json:`);
                    console.error(`   "entry": "node app.js" // ou "python script.py"`);
                    console.error(`\n   Ou execute com o runtime explícito:`);
                    console.error(`   abix shell  # e execute manualmente dentro do shell`);
                    pauseForExit();
                    return;
                }
                
                console.log(`\n🚀 Abix (${PLATFORM}-${ARCH}) | Root: ${ABIX_ROOT}`);

                const runtimes = {};
                for (const [r, v] of Object.entries(config.runtimes)) {
                    runtimes[r] = await Managers[r](v);
                }

                let vPath = [
                    runtimes.node ? (IS_WIN ? runtimes.node.installPath : path.join(runtimes.node.installPath, 'bin')) : null,
                    runtimes.python ? (IS_WIN ? runtimes.python.installPath + PATH_SEP + path.join(runtimes.python.installPath, 'Scripts') : path.join(runtimes.python.installPath, 'bin')) : null,
                    process.env.PATH
                ].filter(Boolean).join(PATH_SEP);

                if (config.init_commands) {
                    await gerenciarDependencias(config.init_commands, vPath, runtimes.python);
                }

                if (command === 'testar') {
                    console.log(`\n` + "-".repeat(40));
                    if (runtimes.node) {
                        console.log(`📦 Node.js:`);
                        await spawnSeguro(runtimes.node.exePath, ['-v'], vPath);
                    }
                    if (runtimes.python) {
                        console.log(`🐍 Python:`);
                        await spawnSeguro(runtimes.python.exePath, ['--version'], vPath);
                    }
                    console.log("-".repeat(40));
                    console.log(`✨ Tempo total: ${formatTime(Date.now() - startTimeGlobal)}`);
                    pauseForExit();
                } else if (command === 'shell') {
                    const shell = IS_WIN ? (process.env.COMSPEC || 'cmd.exe') : (process.env.SHELL || '/bin/bash');
                    console.log(`\n🐚 Terminal Abix Ativo`);
                    console.log(`   Digite 'exit' para sair`);
                    console.log("-".repeat(40));
                    spawn(shell, [], { stdio: 'inherit', env: { ...process.env, PATH: vPath, ABIX_ROOT } });
                } else if (command === 'run') {
                    
                    const entryParts = config.entry.split(' ');
                    const runtime = entryParts[0]; // "node" ou "python"
                    const script = entryParts.slice(1).join(' ');
                    
                    let bin;
                    if (runtime === 'node' && runtimes.node) {
                        bin = runtimes.node.exePath;
                    } else if ((runtime === 'python' || runtime === 'python3') && runtimes.python) {
                        bin = runtimes.python.exePath;
                    } else {
                        console.error(`\n⛔ ERRO: Runtime '${runtime}' não configurado em abix.json`);
                        console.error(`   Configure o runtime correto no campo 'runtimes' do abix.json`);
                        pauseForExit();
                        return;
                    }
                    
                    const execArgs = [script, ...userArgs.slice(userArgs.indexOf('run') + 1)];
                    console.log(`▶️  Executando: ${config.entry}`);
                    spawn(bin, execArgs.filter(arg => arg), { 
                        stdio: 'inherit', 
                        env: { ...process.env, PATH: vPath } 
                    });
                }
                break;
            }

            default: {
                console.error(`\n⛔ ERRO: Comando desconhecido '${command}'.`);
                showHelp();
                pauseForExit();
                break;
            }
        }
    } catch (e) {
        console.error("\n⛔ ERRO GERAL:", e.message);
        if (e.stack) console.error(e.stack);
        pauseForExit("Pressione ENTER para sair...");
        process.exit(1);
    }
}

run();