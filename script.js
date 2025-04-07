const qrcode = new QRCode(document.getElementById('qrcode'), {
    text: "",
    width: 200,
    height: 200
});

const generateBtn = document.getElementById('generateBtn');
const textInput = document.getElementById('textInput');
const scanTip = document.getElementById('scanTip');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const splitPanels = document.querySelectorAll('.split-panel');
const tabBtns = document.querySelectorAll('.tab-btn');

// 左右分栏切换功能
function switchPanel(panelId) {
    // 切换内容面板
    splitPanels.forEach(panel => panel.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
    
    // 切换页签按钮样式
    tabBtns.forEach(btn => btn.classList.remove('active'));
    if (panelId === 'text-panel') {
        tabBtns[0].classList.add('active');
        // 在文本面板中隐藏取件码链接
        document.querySelector('.code-link').style.display = 'none';
    } else if (panelId === 'file-panel') {
        tabBtns[1].classList.add('active');
        // 在文件面板中显示取件码链接
        document.querySelector('.code-link').style.display = 'block';
    }
}

// 默认显示文本面板
switchPanel('text-panel');

generateBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    
    if (!text) {
        alert('请输入要转换的文字');
        return;
    }
    
    // 存储文本并获取ID
    fetch('/api/store', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    })
    .then(response => response.json())
    .then(data => {
        // 生成二维码
        const url = `${window.location.origin}/view.html?t=${data.id}`;
        qrcode.clear();
        qrcode.makeCode(url);
        
        // 显示提示
        scanTip.classList.remove('hidden');
    })
    .catch(error => {
        console.error('Error:', error);
        alert('生成二维码失败');
    });
});

// 文件选择后立即显示文件名
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    
    if (file) {
        // 显示已选择的文件名
        scanTip.classList.remove('hidden');
        scanTip.textContent = `已选择文件: ${file.name}`;
    } else {
        scanTip.classList.add('hidden');
    }
});

uploadBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择文件');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    // 上传文件
    fetch('/api/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        // 生成二维码
        const url = `${window.location.origin}/view.html?f=${data.id}`;
        qrcode.clear();
        qrcode.makeCode(url);
        
        // 显示提示、文件名和取件码
        scanTip.classList.remove('hidden');
        if (data.pickupCode) {
            scanTip.innerHTML = `已上传文件: ${file.name}<br>取件码: <strong>${data.pickupCode}</strong><br>请保存此取件码用于文件下载`;
        } else {
            scanTip.textContent = `已上传文件: ${file.name}`;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        if (error.response) {
            error.response.json().then(data => {
                alert(data.error || '文件上传失败');
            });
        } else {
            alert('文件上传失败: ' + error.message);
        }
    });
});