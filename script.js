document.addEventListener('DOMContentLoaded', function() {
    const textInput = document.getElementById('textInput');
    const generateBtn = document.getElementById('generateBtn');
    const qrcodeDiv = document.getElementById('qrcode');
    const scanTip = document.getElementById('scanTip');
    
    // 服务器API地址
    const API_BASE_URL = `http://${window.location.hostname}:3000/api`;
    generateBtn.addEventListener('click', async function() {
        const text = textInput.value.trim();
        
        if (!text) {
            alert('请输入要转换的文字');
            return;
        }
        
        // 清空之前的二维码
        qrcodeDiv.innerHTML = '';
        
        // 添加加载提示
        const loadingElement = document.createElement('div');
        loadingElement.textContent = '正在生成二维码...';
        loadingElement.style.color = '#1890ff';
        loadingElement.style.textAlign = 'center';
        loadingElement.style.margin = '20px 0';
        qrcodeDiv.appendChild(loadingElement);
        
        try {
            // 使用固定IP地址，确保手机可以通过扫描二维码访问
            const fixedIP = window.location.hostname || '10.10.41.151'; // 使用当前主机名或固定IP
            const currentPort = window.location.port || '8000';
            const baseUrl = `http://${fixedIP}:${currentPort}`;
            
            // 处理JSON格式的文本
            let processedText = text;
            try {
                // 尝试解析文本，看是否为JSON字符串
                const jsonObj = JSON.parse(text);
                // 如果成功解析为JSON对象，则将其转换回字符串并格式化
                processedText = JSON.stringify(jsonObj, null, 2);
                console.log('成功解析JSON格式');
            } catch (e) {
                // 如果解析失败，说明不是有效的JSON，使用原始文本
                console.log('文本不是有效的JSON格式，使用原始文本');
            }
            
            // 发送文本到服务器并获取ID
            const response = await fetch(`${API_BASE_URL}/store`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: processedText })
            });
            
            if (!response.ok) {
                throw new Error('服务器存储文本失败');
            }
            
            const data = await response.json();
            const id = data.id;
            
            // 生成包含ID的URL
            const qrcodeText = `${baseUrl}/view.html?id=${id}`;
            console.log('使用缓存ID生成二维码:', id);
            
            // 清除加载提示
            qrcodeDiv.innerHTML = '';
            
            // 生成二维码
            new QRCode(qrcodeDiv, {
                text: qrcodeText,
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H // 高级别纠错
            });
            
            // 显示提示
            scanTip.classList.remove('hidden');
            
            // 添加成功提示
            console.log('二维码生成成功，URL长度:', qrcodeText.length);
            
        } catch (error) {
            console.error('生成二维码时出错:', error);
            // 提供更详细的错误信息
            qrcodeDiv.innerHTML = `
                <p style="color: red;">生成二维码失败</p>
                <p style="color: red; font-size: 14px;">原因: ${error.message || '未知错误'}</p>
                <p style="color: red; font-size: 14px;">请稍后重试或联系管理员</p>
            `;
        }
    });
});