const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const app = express();
const port = 3000;

// 配置multer用于文件上传
const upload = multer({ 
    dest: 'storage/',
    limits: {
        fileSize: 500 * 1024 * 1024, // 设置最大文件大小为500MB
        fieldSize: 500 * 1024 * 1024 // 设置字段大小限制
    }
});

// 生成随机4位数字取件码
function generateRandomCode() {
    // 读取映射文件获取现有取件码
    const mappingPath = path.join(storageDir, 'mapping.json');
    let mappings = {};
    
    if (fs.existsSync(mappingPath)) {
        mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    }
    
    // 生成1000-9999之间的随机数
    let code;
    do {
        code = Math.floor(Math.random() * 9000) + 1000;
        code = code.toString();
        
        // 检查取件码是否已存在于映射文件中
        let codeExists = false;
        for (const fileId in mappings) {
            if (mappings[fileId].pickupCode === code) {
                codeExists = true;
                break;
            }
        }
        
        if (!codeExists) break;
    } while (true);
    
    return code;
}

// 计算文件的MD5哈希值
function calculateMD5(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);
        
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

// 根据文件MD5查找是否已存在相同文件
function findFileByMD5(md5Hash, mappings) {
    for (const fileId in mappings) {
        if (mappings[fileId].md5 === md5Hash) {
            return fileId;
        }
    }
    return null;
}

// 启用CORS，允许前端页面访问
app.use(cors());

// 解析JSON请求体
app.use(express.json({ limit: '10mb' }));

// 确保存储目录存在
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir);
}

// 存储文本内容并返回唯一ID
app.post('/api/store', (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: '文本内容不能为空' });
        }
        
        // 生成唯一ID
        const id = uuidv4();
        
        // 存储文本内容到文件
        const filePath = path.join(storageDir, `${id}.txt`);
        fs.writeFileSync(filePath, text);
        
        // 返回唯一ID
        res.json({ id });
    } catch (error) {
        console.error('存储文本时出错:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 根据ID获取文本内容
app.get('/api/text/:id', (req, res) => {
    const { id } = req.params;
    
    const filePath = path.join(storageDir, `${id}.txt`);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文本内容已过期或不存在' });
    }
    
    // 读取文件内容
    const text = fs.readFileSync(filePath, 'utf8');
    
    // 返回文本内容
    res.json({ text });
});



// 提供静态文件服务
app.use(express.static('.'));

// 文件上传API
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传文件' });
        }
        
        // 检查文件大小是否超过限制
        if (req.file.size > 500 * 1024 * 1024) {
            return res.status(413).json({ error: '文件大小超过500MB限制' });
        }
        
        // 处理中文文件名 - 修复中文乱码问题
        const decodedFilename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        
        // 计算上传文件的MD5哈希值
        const md5Hash = await calculateMD5(req.file.path);
        
        // 创建映射文件
        const mappingPath = path.join(storageDir, 'mapping.json');
        let mappings = {};
        
        if (fs.existsSync(mappingPath)) {
            mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        }
        
        // 检查是否已存在相同的文件（通过MD5比较）
        const existingFileId = findFileByMD5(md5Hash, mappings);
        
        if (existingFileId) {
            // 如果文件已存在，直接返回现有文件的信息
            const existingFile = mappings[existingFileId];
            
            // 删除临时上传的文件
            fs.unlinkSync(req.file.path);
            
            // 返回现有文件的信息
            return res.json({
                id: existingFileId,
                filename: existingFile.originalName,
                url: `/api/download/${existingFileId}`,
                pickupCode: existingFile.pickupCode
            });
        }
        
        // 生成唯一ID和取件码
        const id = uuidv4();
        const pickupCode = generateRandomCode();
        
        // 根据文件扩展名创建子目录
        const fileExt = path.extname(decodedFilename).slice(1).toLowerCase() || 'other';
        const extDir = path.join(storageDir, fileExt);
        
        // 确保扩展名目录存在
        if (!fs.existsSync(extDir)) {
            fs.mkdirSync(extDir, { recursive: true });
        }
        
        // 使用原始文件名
        const newPath = path.join(extDir, decodedFilename);
        
        // 如果存在同名文件，检查是否为不同文件
        if (fs.existsSync(newPath)) {
            // 使用UUID前缀避免文件名冲突
            const finalPath = path.join(extDir, `${id}_${decodedFilename}`);
            fs.renameSync(req.file.path, finalPath);
            
            // 记录映射关系
            mappings[id] = {
                originalName: decodedFilename,
                path: finalPath,
                extension: path.extname(decodedFilename),
                md5: md5Hash,
                pickupCode: pickupCode
            };
        } else {
            // 移动文件到对应扩展名目录，保持原始文件名
            fs.renameSync(req.file.path, newPath);
            
            // 记录映射关系
            mappings[id] = {
                originalName: decodedFilename,
                path: newPath,
                extension: path.extname(decodedFilename),
                md5: md5Hash,
                pickupCode: pickupCode
            };
        }
        
        // 保存映射文件
        fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2));
        
        // 返回文件信息
        res.json({ 
            id,
            filename: decodedFilename,
            url: `/api/download/${id}`,
            pickupCode
        });
    } catch (error) {
        console.error('文件上传时出错:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 获取文件信息API
app.get('/api/file-info/:id', (req, res) => {
    const { id } = req.params;
    
    // 读取映射文件
    const mappingPath = path.join(storageDir, 'mapping.json');
    
    if (!fs.existsSync(mappingPath)) {
        return res.status(404).json({ error: '映射文件不存在' });
    }
    
    const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    
    if (!mappings[id]) {
        return res.status(404).json({ error: '文件不存在或已过期' });
    }
    
    const fileInfo = mappings[id];
    
    // 返回文件信息
    res.json({
        filename: fileInfo.originalName,
        extension: fileInfo.extension
    });
});

// 文件下载API
app.get('/api/download/:id', (req, res) => {
    const { id } = req.params;
    
    // 读取映射文件
    const mappingPath = path.join(storageDir, 'mapping.json');
    
    if (!fs.existsSync(mappingPath)) {
        return res.status(404).json({ error: '映射文件不存在' });
    }
    
    const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    
    if (!mappings[id]) {
        return res.status(404).json({ error: '文件不存在或已过期' });
    }
    
    const fileInfo = mappings[id];
    
    // 设置Content-Disposition头，确保文件名正确
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.originalName)}"`); 
    res.download(fileInfo.path, fileInfo.originalName);
});

// 取件码验证API
app.get('/api/verify-code/:code', (req, res) => {
    const { code } = req.params;
    
    // 验证取件码格式
    if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) {
        return res.status(400).json({ error: '无效的取件码格式' });
    }
    
    // 从映射文件中查找取件码
    const mappingPath = path.join(storageDir, 'mapping.json');
    if (!fs.existsSync(mappingPath)) {
        return res.status(404).json({ error: '文件映射不存在' });
    }
    
    const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    
    // 查找匹配取件码的文件ID
    let fileId = null;
    let fileInfo = null;
    for (const id in mappings) {
        if (mappings[id].pickupCode === code) {
            fileId = id;
            fileInfo = mappings[id];
            break;
        }
    }
    
    if (!fileId) {
        return res.status(404).json({ error: '取件码不存在或已过期' });
    }
    
    // 返回文件ID和原始文件名
    res.json({ 
        fileId,
        filename: fileInfo.originalName
    });

});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器已启动，监听端口 ${port}`);
});