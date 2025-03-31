const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

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

// 启动服务器
app.listen(port, () => {
    console.log(`服务器已启动，监听端口 ${port}`);
});