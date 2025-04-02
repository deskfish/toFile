const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
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
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传文件' });
        }
        
        // 检查文件大小是否超过限制
        if (req.file.size > 500 * 1024 * 1024) {
            return res.status(413).json({ error: '文件大小超过500MB限制' });
        }
        
        // 生成唯一ID
        const id = uuidv4();
        
        // 处理中文文件名 - 修复中文乱码问题
        const decodedFilename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        
        // 根据文件扩展名创建子目录
        const fileExt = path.extname(decodedFilename).slice(1).toLowerCase() || 'other';
        const extDir = path.join(storageDir, fileExt);
        
        // 确保扩展名目录存在
        if (!fs.existsSync(extDir)) {
            fs.mkdirSync(extDir, { recursive: true });
        }
        
        // 保留原始文件名，但检查是否存在同名文件，如果存在则在文件名前添加UUID
        let finalFilename = decodedFilename;
        let newPath = path.join(extDir, finalFilename);
        
        // 如果文件已存在，则在文件名前添加UUID前缀
        if (fs.existsSync(newPath)) {
            finalFilename = `${id}_${decodedFilename}`;
            newPath = path.join(extDir, finalFilename);
        }
        
        // 移动文件到对应扩展名目录
        fs.renameSync(req.file.path, newPath);

        
        // 创建映射文件
        const mappingPath = path.join(storageDir, 'mapping.json');
        let mappings = {};
        
        if (fs.existsSync(mappingPath)) {
            mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        }
        
        // 记录映射关系
        mappings[id] = {
            originalName: decodedFilename,
            path: newPath,
            extension: path.extname(decodedFilename)
        };
        
        // 保存映射文件
        fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2));
        
        // 返回文件信息
        res.json({ 
            id,
            filename: decodedFilename, // 使用解码后的文件名
            url: `/api/download/${id}`
        });
    } catch (error) {
        console.error('文件上传时出错:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
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
    
    res.download(fileInfo.path, fileInfo.originalName);
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器已启动，监听端口 ${port}`);
});