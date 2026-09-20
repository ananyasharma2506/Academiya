import express from 'express';
import { spawn } from 'child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const SANDBOX_BASE = path.resolve('storage/sandboxes');

/**
 * Ensures student's sandbox directory exists and seeds default templates if empty
 */
async function getStudentSandbox(studentId) {
  const dir = path.join(SANDBOX_BASE, studentId);
  await fs.mkdir(dir, { recursive: true });

  try {
    const files = await fs.readdir(dir);
    if (files.length === 0) {
      // Seed starter Python file
      const pyCode = `# Akademiya Python Sandbox
def solve():
    print("Hello from Akademiya Python Sandbox!")
    numbers = [1, 2, 3, 4, 5]
    print(f"Squared numbers: {[x**2 for x in numbers]}")

if __name__ == "__main__":
    solve()
`;
      await fs.writeFile(path.join(dir, 'main.py'), pyCode, 'utf-8');

      // Seed starter C++ file
      const cppCode = `// Akademiya C++ Sandbox
#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::cout << "Hello from Akademiya C++ Sandbox!" << std::endl;
    std::vector<int> nums = {10, 20, 30, 40, 50};
    int sum = std::accumulate(nums.begin(), nums.end(), 0);
    std::cout << "Vector sum: " << sum << std::endl;
    return 0;
}
`;
      await fs.writeFile(path.join(dir, 'solution.cpp'), cppCode, 'utf-8');
    }
  } catch (err) {
    console.error('Seed sandbox error:', err);
  }

  return dir;
}

/**
 * Determine editor language mode from file extension
 */
function getLanguageFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.py': return 'python';
    case '.cpp':
    case '.cc':
    case '.cxx':
    case '.h':
    case '.hpp': return 'cpp';
    case '.c': return 'c';
    case '.js': return 'javascript';
    case '.json': return 'json';
    case '.txt':
    case '.md': return 'markdown';
    case '.sh': return 'shell';
    default: return 'plaintext';
  }
}

/**
 * GET /api/sandbox/files - List files in student's sandbox
 */
router.get('/files', requireAuth, async (req, res) => {
  try {
    const studentDir = await getStudentSandbox(req.user.id);
    const entries = await fs.readdir(studentDir, { withFileTypes: true });

    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(studentDir, entry.name);
        let size = 0;
        let updatedAt = new Date();
        try {
          const stats = await fs.stat(fullPath);
          size = stats.size;
          updatedAt = stats.mtime;
        } catch {}

        return {
          name: entry.name,
          path: entry.name,
          isDirectory: entry.isDirectory(),
          size,
          language: getLanguageFromFilename(entry.name),
          updatedAt,
        };
      })
    );

    // Sort directories first, then files alphabetically
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return res.json({ files });
  } catch (err) {
    console.error('List sandbox files error:', err);
    return res.status(500).json({ error: 'Failed to list sandbox files' });
  }
});

/**
 * GET /api/sandbox/file?path=... - Read file content
 */
router.get('/file', requireAuth, async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    const studentDir = await getStudentSandbox(req.user.id);
    const resolved = path.resolve(studentDir, filePath);

    if (!resolved.startsWith(studentDir)) {
      return res.status(403).json({ error: 'Access denied: path traversal blocked' });
    }

    const content = await fs.readFile(resolved, 'utf-8');
    return res.json({
      path: filePath,
      content,
      language: getLanguageFromFilename(filePath),
    });
  } catch (err) {
    console.error('Read sandbox file error:', err);
    return res.status(404).json({ error: 'File not found' });
  }
});

/**
 * POST /api/sandbox/file - Create or update file
 */
router.post('/file', requireAuth, async (req, res) => {
  try {
    const { path: filePath, content = '' } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    const studentDir = await getStudentSandbox(req.user.id);
    const resolved = path.resolve(studentDir, filePath);

    if (!resolved.startsWith(studentDir)) {
      return res.status(403).json({ error: 'Access denied: path traversal blocked' });
    }

    // Ensure parent directories exist
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');

    return res.json({
      success: true,
      path: filePath,
      language: getLanguageFromFilename(filePath),
    });
  } catch (err) {
    console.error('Write sandbox file error:', err);
    return res.status(500).json({ error: 'Failed to write file' });
  }
});

/**
 * DELETE /api/sandbox/file?path=... - Delete file
 */
router.delete('/file', requireAuth, async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    const studentDir = await getStudentSandbox(req.user.id);
    const resolved = path.resolve(studentDir, filePath);

    if (!resolved.startsWith(studentDir)) {
      return res.status(403).json({ error: 'Access denied: path traversal blocked' });
    }

    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) {
      await fs.rm(resolved, { recursive: true, force: true });
    } else {
      await fs.unlink(resolved);
    }

    return res.json({ success: true, deleted: filePath });
  } catch (err) {
    console.error('Delete sandbox file error:', err);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
});

/**
 * POST /api/sandbox/exec - Execute terminal command in student's sandbox
 */
router.post('/exec', requireAuth, async (req, res) => {
  try {
    const { command = '', cwd = '' } = req.body;
    const trimmed = command.trim();
    if (!trimmed) {
      return res.json({ stdout: '', stderr: '', exitCode: 0, cwd });
    }

    const studentDir = await getStudentSandbox(req.user.id);

    // Resolve working directory inside sandbox
    let effectiveCwd = path.resolve(studentDir, cwd);
    if (!effectiveCwd.startsWith(studentDir)) {
      effectiveCwd = studentDir;
    }

    // Check dangerous system commands
    const DANGEROUS_PATTERNS = [
      /\bsudo\b/i,
      /\bshutdown\b/i,
      /\breboot\b/i,
      /\bmkfs\b/i,
      /\bdd\s+if=/i,
      /\brm\s+-[rf]*\s+\/\b/i,
      /:(){ :|:& };:/,
    ];

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        return res.json({
          stdout: '',
          stderr: `Security restriction: Command contains blocked operation.`,
          exitCode: 126,
          cwd: path.relative(studentDir, effectiveCwd),
        });
      }
    }

    // 1. Handle `cd` builtin directory navigation
    if (trimmed === 'cd' || trimmed.startsWith('cd ')) {
      let target = trimmed.replace(/^cd\s*/, '').trim();
      if (!target || target === '~') {
        effectiveCwd = studentDir;
      } else {
        const nextTarget = path.resolve(effectiveCwd, target);
        if (!nextTarget.startsWith(studentDir)) {
          // Clamped to sandbox root
          effectiveCwd = studentDir;
        } else {
          try {
            const stat = await fs.stat(nextTarget);
            if (stat.isDirectory()) {
              effectiveCwd = nextTarget;
            } else {
              return res.json({
                stdout: '',
                stderr: `bash: cd: ${target}: Not a directory`,
                exitCode: 1,
                cwd: path.relative(studentDir, effectiveCwd),
              });
            }
          } catch {
            return res.json({
              stdout: '',
              stderr: `bash: cd: ${target}: No such file or directory`,
              exitCode: 1,
              cwd: path.relative(studentDir, effectiveCwd),
            });
          }
        }
      }

      return res.json({
        stdout: '',
        stderr: '',
        exitCode: 0,
        cwd: path.relative(studentDir, effectiveCwd),
      });
    }

    // 2. Handle `clear`
    if (trimmed === 'clear') {
      return res.json({
        stdout: '\x1bc',
        stderr: '',
        exitCode: 0,
        cwd: path.relative(studentDir, effectiveCwd),
        clear: true,
      });
    }

    // 3. Execute command inside effectiveCwd with 10-second timeout
    const proc = spawn('bash', ['-c', trimmed], {
      cwd: effectiveCwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    });

    let stdout = '';
    let stderr = '';
    const MAX_OUTPUT = 65536; // 64KB cap to prevent terminal lag

    proc.stdout.on('data', (d) => {
      if (stdout.length < MAX_OUTPUT) {
        stdout += d.toString();
      }
    });

    proc.stderr.on('data', (d) => {
      if (stderr.length < MAX_OUTPUT) {
        stderr += d.toString();
      }
    });

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      stderr += '\n[Execution timed out (10s limit exceeded)]\n';
    }, 10000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      return res.json({
        stdout,
        stderr,
        exitCode: code ?? 0,
        cwd: path.relative(studentDir, effectiveCwd),
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      return res.json({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
        cwd: path.relative(studentDir, effectiveCwd),
      });
    });
  } catch (err) {
    console.error('Terminal exec error:', err);
    return res.status(500).json({ error: 'Execution failure' });
  }
});

export default router;
