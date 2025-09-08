#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const SUPPORTED_COMMANDS = ['add', 'install', 'run', 'build', 'dev', 'typecheck', 'lint'] as const;

type SupportedCommand = typeof SUPPORTED_COMMANDS[number];
type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

interface PackageJson {
  packageManager?: string;
  workspaces?: string[] | { packages: string[] };
  [key: string]: any;
}

interface ProjectStructure {
  localRoot: string;
  monorepoRoot: string | null;
  gitRoot: string | null;
}

function findProjectStructure(startDir: string = process.cwd()): ProjectStructure | null {
  let currentDir = startDir;
  let localRoot: string | null = null;
  let gitRoot: string | null = null;
  const packageJsonDirs: string[] = [];
  
  // Traverse upward until we hit the filesystem root
  while (currentDir !== path.parse(currentDir).root) {
    // Check for .git directory (project boundary)
    if (fs.existsSync(path.join(currentDir, '.git'))) {
      gitRoot = currentDir;
    }
    
    // Check for package.json
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      packageJsonDirs.push(currentDir);
      if (!localRoot) {
        localRoot = currentDir; // First package.json found (closest to startDir)
      }
    }
    
    // Stop if we found git root and have at least one package.json
    if (gitRoot && packageJsonDirs.length > 0) {
      break;
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  if (!localRoot) {
    return null; // No package.json found
  }
  
  // Determine monorepo root by looking for workspace indicators
  let monorepoRoot: string | null = null;
  const searchBoundary = gitRoot || path.parse(startDir).root;
  
  for (const dir of packageJsonDirs) {
    // Stop searching beyond git boundary
    if (gitRoot && !dir.startsWith(gitRoot)) {
      continue;
    }
    
    if (isMonorepoRoot(dir)) {
      monorepoRoot = dir;
      break; // Take the first (highest) monorepo root found
    }
  }
  
  return {
    localRoot,
    monorepoRoot,
    gitRoot
  };
}

function isMonorepoRoot(dir: string): boolean {
  // Check for monorepo indicator files
  const monorepoFiles = [
    'pnpm-workspace.yaml',
    'lerna.json', 
    'nx.json',
    'rush.json'
  ];
  
  for (const file of monorepoFiles) {
    if (fs.existsSync(path.join(dir, file))) {
      return true;
    }
  }
  
  // Check for lock files with workspaces in package.json
  const lockFiles = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lockb', 'bun.lock'];
  const hasLockFile = lockFiles.some(file => fs.existsSync(path.join(dir, file)));
  
  if (hasLockFile) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.workspaces) {
          return true;
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
  }
  
  return false;
}

function detectPackageManager(structure: ProjectStructure): { manager: PackageManager; reason: string } {
  const lockFiles: Record<string, PackageManager> = {
    'bun.lockb': 'bun',
    'bun.lock': 'bun',
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'package-lock.json': 'npm'
  };
  
  // Priority order: monorepo root > local root
  const searchDirs = [structure.monorepoRoot, structure.localRoot].filter(Boolean) as string[];
  
  for (const dir of searchDirs) {
    for (const [lockFile, manager] of Object.entries(lockFiles)) {
      const lockPath = path.join(dir, lockFile);
      if (fs.existsSync(lockPath)) {
        const location = dir === structure.monorepoRoot ? 'monorepo root' : 'local';
        return { manager, reason: `${lockFile} at ${location} (${lockPath})` };
      }
    }
  }
  
  // If no lock file found, check package.json for packageManager field
  for (const dir of searchDirs) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.packageManager) {
          const manager = packageJson.packageManager.split('@')[0] as PackageManager;
          if (['bun', 'pnpm', 'yarn', 'npm'].includes(manager)) {
            const location = dir === structure.monorepoRoot ? 'monorepo root' : 'local';
            return { manager, reason: `packageManager field at ${location} (${packageJsonPath})` };
          }
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
  }
  
  // Default to npm
  return { manager: 'npm', reason: 'fallback' };
}

function getExecutionDirectory(command: SupportedCommand, structure: ProjectStructure): string {
  // Commands that should always run from monorepo root
  const rootCommands = ['add', 'install'];
  
  if (rootCommands.includes(command)) {
    return structure.monorepoRoot || structure.localRoot;
  }
  
  // For script commands, check if the script exists locally first
  const scriptCommands = ['run', 'build', 'dev', 'typecheck', 'lint'];
  
  if (scriptCommands.includes(command)) {
    // Check if script exists in local package.json
    if (hasScript(command, structure.localRoot)) {
      return structure.localRoot;
    }
    
    // Fall back to monorepo root if script exists there
    if (structure.monorepoRoot && hasScript(command, structure.monorepoRoot)) {
      return structure.monorepoRoot;
    }
    
    // Default to local root for script commands
    return structure.localRoot;
  }
  
  // Default to local root
  return structure.localRoot;
}

function hasScript(scriptName: string, dir: string): boolean {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.scripts && packageJson.scripts[scriptName];
  } catch (e) {
    return false;
  }
}

function harmonizeCommand(command: SupportedCommand, args: string[], packageManager: PackageManager): string[] {
  const firstArg = args[0];
  
  switch (command) {
    case 'add':
      if (packageManager === 'npm') {
        return ['npm', 'install', ...args];
      } else if (packageManager === 'yarn') {
        return ['yarn', 'add', ...args];
      } else if (packageManager === 'pnpm') {
        return ['pnpm', 'add', ...args];
      } else if (packageManager === 'bun') {
        return ['bun', 'add', ...args];
      }
      break;
      
    case 'install':
      if (packageManager === 'bun' && args.length > 0) {
        // bun install with args means add
        return ['bun', 'add', ...args];
      } else {
        return [packageManager, 'install', ...args];
      }
      
    case 'run':
      if (!firstArg) {
        console.error('Error: "run" command requires a script name');
        process.exit(1);
      }
      return [packageManager, 'run', ...args];
      
    case 'build':
      return [packageManager, 'run', 'build'];
      
    case 'dev':
      return [packageManager, 'run', 'dev'];
      
    case 'typecheck':
      return [packageManager, 'run', 'typecheck'];
      
    case 'lint':
      return [packageManager, 'run', 'lint'];
      
    default:
      console.error(`Error: "${command}" is not a supported command.`);
      console.error('Supported commands: ' + SUPPORTED_COMMANDS.join(', '));
      process.exit(1);
  }
  
  // This should never be reached, but TypeScript requires it
  return [];
}

function main(): void {
  const args = process.argv.slice(2);
  
  // Check for debug flag
  const debugIndex = args.indexOf('--debug');
  const isDebug = debugIndex !== -1;
  
  // Remove debug flag from args
  const cleanArgs = args.filter(arg => arg !== '--debug');
  
  // If no arguments provided (or only --debug), run default package manager command
  if (cleanArgs.length === 0) {
    const structure = findProjectStructure();
    if (!structure) {
      console.error('Error: No package.json found in current directory or parent directories.');
      process.exit(1);
    }
    
    const { manager: packageManager, reason } = detectPackageManager(structure);
    const executionDir = structure.localRoot;
    
    if (isDebug) {
      let contextInfo = `Using ${packageManager} (${reason})`;
      if (structure.monorepoRoot && structure.monorepoRoot !== structure.localRoot) {
        contextInfo += `\nMonorepo detected: ${structure.monorepoRoot}`;
        contextInfo += `\nLocal package: ${structure.localRoot}`;
        contextInfo += `\nExecuting from: ${executionDir}`;
      }
      if (structure.gitRoot) {
        contextInfo += `\nGit root: ${structure.gitRoot}`;
      }
      
      console.log(`${contextInfo}\nCommand: ${packageManager}`);
    } else {
      console.log(`Using ${packageManager}: ${packageManager}`);
    }
    
    try {
      execSync(packageManager, { 
        stdio: 'inherit',
        cwd: executionDir
      });
    } catch (error: any) {
      process.exit(error.status || 1);
    }
    return;
  }
  
  if (cleanArgs.length === 0) {
    console.error('Usage: d [--debug] <command> [args...]');
    console.error('Supported commands: ' + SUPPORTED_COMMANDS.join(', '));
    process.exit(1);
  }
  
  const command = cleanArgs[0] as SupportedCommand;
  const commandArgs = cleanArgs.slice(1);
  
  if (!SUPPORTED_COMMANDS.includes(command)) {
    console.error(`Error: "${command}" is not a supported command.`);
    console.error('Supported commands: ' + SUPPORTED_COMMANDS.join(', '));
    process.exit(1);
  }
  
  const structure = findProjectStructure();
  if (!structure) {
    console.error('Error: No package.json found in current directory or parent directories.');
    process.exit(1);
  }
  
  const { manager: packageManager, reason } = detectPackageManager(structure);
  const executionDir = getExecutionDirectory(command, structure);
  const finalCommand = harmonizeCommand(command, commandArgs, packageManager);
  
  if (isDebug) {
    // Enhanced logging to show monorepo context
    let contextInfo = `Using ${packageManager} (${reason})`;
    if (structure.monorepoRoot && structure.monorepoRoot !== structure.localRoot) {
      contextInfo += `\nMonorepo detected: ${structure.monorepoRoot}`;
      contextInfo += `\nLocal package: ${structure.localRoot}`;
      contextInfo += `\nExecuting from: ${executionDir}`;
    }
    if (structure.gitRoot) {
      contextInfo += `\nGit root: ${structure.gitRoot}`;
    }
    
    console.log(`${contextInfo}\nCommand: ${finalCommand.join(' ')}`);
  } else {
    // Minimal output - just package manager
    console.log(`Using ${packageManager}: ${finalCommand.join(' ')}`);
  }
  
  try {
    execSync(finalCommand.join(' '), { 
      stdio: 'inherit',
      cwd: executionDir
    });
  } catch (error: any) {
    process.exit(error.status || 1);
  }
}

main();