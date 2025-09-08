# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dee** is a dependency manager wrapper that automatically detects and uses the appropriate package manager (npm, yarn, pnpm, or bun). It intelligently handles both regular projects and monorepo structures by analyzing project structure, lock files, and package.json configurations.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript in the `dist/` directory
- **Development**: `npm run dev` - Runs TypeScript compiler in watch mode
- **Prepare for publish**: `npm run prepublishOnly` - Automatically runs build before publishing

## Architecture

### Core Components

- **`src/d.ts`**: Main CLI entry point with complete package manager detection and command harmonization logic
- **Project Structure Detection**: Automatically finds package.json files, git roots, and monorepo configurations by traversing upward from current directory
- **Package Manager Detection**: Uses lock files (bun.lockb, pnpm-lock.yaml, yarn.lock, package-lock.json) and package.json `packageManager` field to determine which tool to use
- **Command Harmonization**: Maps common commands (`add`, `install`, `run`, `build`, `dev`, `typecheck`, `lint`) to the appropriate package manager syntax

### Key Features

- **Monorepo Awareness**: Detects monorepo roots via workspace indicators (pnpm-workspace.yaml, lerna.json, nx.json, rush.json) or workspaces in package.json
- **Smart Execution Directory**: Install commands run from monorepo root, script commands prefer local package but fall back to monorepo root
- **Debug Mode**: `--debug` flag provides detailed information about package manager detection and execution context

### TypeScript Configuration

- Target: ES2020, CommonJS modules
- Strict mode enabled with full type checking
- Source maps and declarations generated
- Output directory: `dist/`
- Source directory: `src/`

The project is designed as a single TypeScript file that compiles to a standalone CLI tool with no runtime dependencies beyond Node.js built-ins.