# Dee

**dee** is a smart dependency manager wrapper that automatically detects and uses the appropriate package manager for your project. No more remembering whether to use `npm`, `yarn`, `pnpm`, or `bun` – just use `dee` and let it figure out the rest.

## Why dee?

When working across multiple projects – whether your own or others' – it's a hassle to remember which package manager each project uses. Some use npm, others use yarn, pnpm, or bun. You constantly have to check lock files or remember project-specific conventions.

**dee** solves this by intelligently detecting the package manager and running the appropriate commands automatically. Just type `dee install`, `dee add react`, or `dee run build` and it works regardless of the underlying package manager.

The name "dee" is short for "Dependency managEr" (D-E-E) – making it easy to remember and type.

## Features

- **Automatic Package Manager Detection**: Analyzes lock files (`bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`) and `package.json` `packageManager` field
- **Monorepo Aware**: Detects monorepo structures and runs commands from the appropriate directory
- **Command Harmonization**: Maps common commands to the correct package manager syntax:
  - `dee install` → `npm install` / `yarn install` / `pnpm install` / `bun install`
  - `dee add <package>` → `npm install <package>` / `yarn add <package>` / `pnpm add <package>` / `bun add <package>`
  - `dee run <script>` → `npm run <script>` / `yarn run <script>` / `pnpm run <script>` / `bun run <script>`
  - Plus `build`, `dev`, `typecheck`, `lint` shortcuts
- **Smart Execution Context**: Install commands run from monorepo root, script commands prefer local package but fall back to root
- **Debug Mode**: Use `--debug` flag for detailed information about detection and execution

## Installation

### Recommended Method

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd dee
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Link globally:
   ```bash
   npm link
   ```

Now `d` will be available globally in your terminal.

## Usage

Once installed, use `dee` instead of your package manager commands:

```bash
# Install dependencies
d install

# Add a package
d add react typescript

# Add dev dependencies
d add -D jest @types/node

# Run scripts
d run build
d run dev
d run test

# Use shortcuts for common commands
d build
d dev
d typecheck
d lint

# Debug mode to see what's happening
d --debug install
```

## How It Works

**dee** automatically detects your project's package manager by:

1. **Lock File Analysis**: Checks for `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`
2. **Package.json Field**: Looks for the `packageManager` field in `package.json`
3. **Monorepo Detection**: Identifies monorepo structures via `pnpm-workspace.yaml`, `lerna.json`, `nx.json`, `rush.json`, or workspaces in `package.json`
4. **Smart Execution**: Runs install commands from the monorepo root, script commands from the most appropriate location

## Development

- **Build**: `npm run build` - Compiles TypeScript to JavaScript
- **Development**: `npm run dev` - Runs TypeScript compiler in watch mode
- **Prepare for publish**: `npm run prepublishOnly` - Builds before publishing

The project is a single TypeScript file that compiles to a standalone CLI tool with no runtime dependencies beyond Node.js built-ins.

## Supported Package Managers

- **npm** - Default Node.js package manager
- **yarn** - Fast, reliable package manager (v1 and v2+)
- **pnpm** - Fast, disk space efficient package manager
- **bun** - Fast all-in-one JavaScript runtime and package manager
