const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { execFile } = require('child_process');

const app = express();
const PORT = 3001;
const STATIC_DIR = path.resolve(__dirname, 'storage');

if (!fs.existsSync(STATIC_DIR)) {
  fs.mkdirSync(STATIC_DIR, { recursive: true });
  console.log(`Created storage directory: ${STATIC_DIR}`);
}

app.use(cors({
    origin: 'https://client',
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS']
}));

app.use(express.json({ limit: '50mb' }));

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

function normalizeRelativePath(input = '') {
  if (!input) return '';
  return decodeURIComponent(input)
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\\/g, '/');
}

function createNodeResponse(absPath) {
  if (!fs.existsSync(absPath)) return null;

  const stat = fs.statSync(absPath);

  let rel = path.relative(STATIC_DIR, absPath).split(path.sep).join('/');
  
  return {
    id: rel,
    path: rel,
    name: path.basename(absPath),
    isFolder: stat.isDirectory(),
    size: stat.isDirectory() ? undefined : stat.size
  };
}

function resolveInStorage(rel) {
  if (!rel) return STATIC_DIR;

  let normalized = normalizeRelativePath(rel);
  
  normalized = normalized.replace(/^\/+/, '').replace(/\/+$/, '');
  
  const segments = normalized.split('/').filter(segment => segment !== '..');
  const cleanPath = segments.join('/');

  const abs = path.join(STATIC_DIR, cleanPath);
  const resolved = path.resolve(abs);

  if (!resolved.startsWith(STATIC_DIR + path.sep) && resolved !== STATIC_DIR) {
    throw new Error('Access denied: Path traversal attempt detected');
  }
  
  return resolved;
}

function getFolderChildren(absFolder) {
  if (!fs.existsSync(absFolder)) return [];

  const entries = fs.readdirSync(absFolder, { withFileTypes: true });
  return entries.map(entry => {
    const full = path.join(absFolder, entry.name);
    return createNodeResponse(full);
  }).filter(node => node !== null);
}

function createItemAt(relativeFullPath, content = '', isFolder = false, overwrite = false) {
  if (!relativeFullPath) throw new Error('Path is required');
  
  const dir = path.dirname(relativeFullPath);
  const name = path.basename(relativeFullPath);
  
  const targetDir = dir === '.' ? STATIC_DIR : resolveInStorage(dir);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const fileAbs = path.join(targetDir, name);
  
  if (fs.existsSync(fileAbs)) {
    const stat = fs.statSync(fileAbs);
    
    if (isFolder) {
      if (stat.isDirectory()) {
        if (overwrite) {
          throw new Error('Cannot overwrite existing folder');
        }
        throw new Error('Folder already exists');
      } 
      if (overwrite) {
        fs.rmdirSync(fileAbs);
      } else {
        throw new Error('Path occupied by a file');
      }
    } else {
      if (stat.isFile()) {
        if (overwrite) {
          fs.unlinkSync(fileAbs); 
        } else {
          throw new Error('File already exists');
        }
      }
    }
  }

  if (isFolder) {
    fs.mkdirSync(fileAbs, { recursive: true });
    return { 
      fullPath: fileAbs, 
      relativePath: path.relative(STATIC_DIR, fileAbs).split(path.sep).join('/') 
    };
  } else {
    fs.writeFileSync(fileAbs, content, 'utf8');
    return { 
      fullPath: fileAbs, 
      relativePath: path.relative(STATIC_DIR, fileAbs).split(path.sep).join('/') 
    };
  }
}


function deleteItemAbs(absPath) {
  if (!fs.existsSync(absPath)) return;
  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    fs.rmSync(absPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(absPath);
  }
}

function renameItemAbs(absPath, newName) {
  if (!fs.existsSync(absPath)) throw new Error('Item not found');
  
  const dir = path.dirname(absPath);
  const ext = path.extname(absPath);
  if (!ext && newName.includes('.')) {
    newName = newName + ext;
  }

  const newAbsPath = path.join(dir, newName);
  
  if (fs.existsSync(newAbsPath)) {
    if (path.basename(absPath) === newName) return absPath;
    throw new Error('Target name already exists');
  }
  
  fs.renameSync(absPath, newAbsPath);
  return newAbsPath;
}

function scanDirRecursive(dir) {
  if (!fs.existsSync(dir)) return { folders: [], files: [] };
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const folders = [];
  const files = [];

  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    const rel = path.relative(STATIC_DIR, fullPath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      folders.push({
        id: rel,
        name: entry.name,
        path: rel,
        isFolder: true,
        children: scanDirRecursive(fullPath)
      });
    } else {
      files.push({
        id: rel,
        name: entry.name,
        path: rel,
        isFolder: false
      });
    }
  });

  return { folders, files };
}

app.get('/api/tree', (req, res) => {
  try {
    if (!fs.existsSync(STATIC_DIR)) {
      return res.json({ id: '', name: 'root', path: '', isFolder: true, children: { folders: [], files: [] } });
    }
    const root = scanDirRecursive(STATIC_DIR);

    res.json({ 
      id: '', 
      name: 'root', 
      path: '', 
      isFolder: true, 
      children: root 
    });
  } catch (err) {
    console.error('Tree error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files', (req, res) => {
  try {
    const allFiles = [];
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).forEach(name => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else {
          const rel = path.relative(STATIC_DIR, full).split(path.sep).join('/');
          allFiles.push({ id: rel, path: rel, name, isFile: true });
        }
      });
    };
    walk(STATIC_DIR);
    res.json(allFiles);
  } catch (err) {
    console.error('Files error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/node', (req, res) => {
  try {
    const rel = normalizeRelativePath(req.query.path || '');

    if (!rel) {
      return res.json({
        type: 'folder',
        ...createNodeResponse(STATIC_DIR),
        children: getFolderChildren(STATIC_DIR)
      });
    }

    const abs = resolveInStorage(rel);

    if (!fs.existsSync(abs)) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const stat = fs.statSync(abs);
    const nodeInfo = createNodeResponse(abs);

    if (stat.isDirectory()) {
      const children = getFolderChildren(abs);
      return res.json({
        type: 'folder',
        ...nodeInfo,
        children
      });
    }

    const content = path.extname(abs).toLowerCase() === '.md'
      ? fs.readFileSync(abs, 'utf8')
      : null;

    return res.json({
      type: 'file',
      ...nodeInfo,
      content
    });
  } catch (err) {
    console.error('Node error:', err);
    res.status(500).json({
      error: err.message
    });
  }
});

app.get('/api/media', (req, res) => {
  try {
    const rel = normalizeRelativePath(req.query.path || '');

    if (!rel) {
      return res.status(400).json({ error: 'path required' });
    }

    const abs = resolveInStorage(rel);

    if (!fs.existsSync(abs)) {
      return res.status(404).end();
    }

    const stat = fs.statSync(abs);

    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot serve directory' });
    }

    res.sendFile(abs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/file', (req, res) => {
  try {
    const { path: relPath, content = '' } = req.body;
    if (!relPath) return res.status(400).json({ error: 'path is required in request body' });
    
    const abs = resolveInStorage(relPath);
    
    const result = createItemAt(relPath, content, false, true);
    
    res.json({ 
      success: true, 
      ...createNodeResponse(result.fullPath) 
    });
  } catch (err) {
    console.error('Save file error:', err);
    if (err.message === 'Access denied') return res.status(403).json({ error: 'Access denied' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/create-folder', (req, res) => {
  try {
    const { path: relPath } = req.body;
    if (!relPath) return res.status(400).json({ error: 'path is required' });
    
    const abs = resolveInStorage(relPath);
    if (fs.existsSync(abs)) return res.status(409).json({ error: 'Path already occupied' });
    
    const result = createItemAt(relPath, '', true, false);
    
    res.status(201).json({ 
      success: true, 
      ...createNodeResponse(result.fullPath) 
    });
  } catch (err) {
    console.error('Create folder error:', err);
    if (err.message === 'Access denied') return res.status(403).json({ error: 'Access denied' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { path: relPath } = req.body;
    
    if (!relPath) {
      return res.status(400).json({ error: 'path is required in request body' });
    }

    const targetFolder = normalizeRelativePath(relPath);
    const absFolder = resolveInStorage(targetFolder);

    if (!fs.existsSync(absFolder)) {
      fs.mkdirSync(absFolder, { recursive: true });
    }

    const originalName = req.file.originalname;
    const ext = path.extname(originalName);
    const safeName = path.basename(originalName, ext) + ext;
    
    const destination = path.join(absFolder, safeName);

    fs.writeFileSync(destination, req.file.buffer);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      filename: safeName,
      path: path.relative(STATIC_DIR, destination).split(path.sep).join('/')
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({
      error: err.message
    });
  }
});

app.put('/api/rename', (req, res) => {
  try {
    const { path: relPath, newName } = req.body;
    if (!relPath) return res.status(400).json({ error: 'path is required' });
    if (!newName) return res.status(400).json({ error: 'newName is required' });
    
    if (path.basename(relPath) === newName) {
      const abs = resolveInStorage(relPath);
      const stat = fs.statSync(abs);
      return res.json({ 
        success: true, 
        oldPath: relPath, 
        path: relPath, 
        ...createNodeResponse(abs) 
      });
    }

    const abs = resolveInStorage(relPath);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Item not found' });
    
    const newAbsPath = renameItemAbs(abs, newName);
    const relOut = path.relative(STATIC_DIR, newAbsPath).split(path.sep).join('/');
    
    const stat = fs.statSync(newAbsPath);
    
    res.json({ 
      success: true, 
      oldPath: relPath,
      ...createNodeResponse(newAbsPath) 
    });
  } catch (err) {
    console.error('Rename error:', err);
    if (err.message === 'Access denied') return res.status(403).json({ error: 'Access denied' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/item', (req, res) => {
  try {
    const rel = normalizeRelativePath(req.query.path || '');
    if (!rel) return res.status(400).json({ error: 'path query parameter required' });
    
    const abs = resolveInStorage(rel);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Item not found' });
    
    deleteItemAbs(abs);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    if (err.message === 'Access denied') return res.status(403).json({ error: 'Access denied' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deploy', (req, res) => {
  const scriptPath = path.join(__dirname, 'deploy.sh');

  fs.access(scriptPath, fs.constants.X_OK, (err) => {
    if (err) {
      return res.status(500).json({ error: 'There was a fatal error with the deployment step.' });
    }

    execFile(scriptPath, { cwd: path.join(__dirname, 'storage') }, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({
          error: 'Deployment failed',
        });
      }

      res.json({
        message: 'Deployment completed',
      });
    });
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
  console.log(`Storage located at: ${STATIC_DIR}`);
});
 
