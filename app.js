document.addEventListener('DOMContentLoaded', function() {
    DataManager.initDemoData();
    initTabs();
    bindEvents();
    updateAllDisplays();
    
    setInterval(updateAllDisplays, 5000);
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            updateAllDisplays();
        });
    });
}

function bindEvents() {
    document.getElementById('joinQueueForm').addEventListener('submit', handleJoinQueue);
    document.getElementById('queryForm').addEventListener('submit', handleQuery);
    document.getElementById('checkInForm').addEventListener('submit', handleCheckIn);
    document.getElementById('refundForm').addEventListener('submit', handleRefund);
    document.getElementById('serviceQueryForm').addEventListener('submit', handleServiceQuery);

    document.getElementById('btnNormal').addEventListener('click', () => setStatus('normal'));
    document.getElementById('btnWind').addEventListener('click', () => setStatus('wind'));
    document.getElementById('btnMaintenance').addEventListener('click', () => setStatus('maintenance'));
}

function handleJoinQueue(e) {
    e.preventDefault();
    
    const name = document.getElementById('visitorName').value.trim();
    const phone = document.getElementById('visitorPhone').value.trim();
    const timeSlot = document.getElementById('visitorTimeSlot').value;
    const messageEl = document.getElementById('joinQueueMessage');

    if (!name || !phone || !timeSlot) {
        showMessage(messageEl, '请填写完整信息', 'error');
        return;
    }

    const result = DataManager.addToQueue(name, phone, timeSlot);
    
    if (result.success) {
        showMessage(messageEl, `${result.message}！您的排队位置是第 ${result.data.position} 位，预计等候 ${result.data.waitTime} 分钟`, 'success');
        e.target.reset();
    } else {
        showMessage(messageEl, result.message, 'error');
    }

    updateAllDisplays();
}

function handleQuery(e) {
    e.preventDefault();
    
    const phone = document.getElementById('queryPhone').value.trim();
    const resultEl = document.getElementById('queryResult');

    if (!phone) {
        resultEl.innerHTML = '<p class="empty">请输入手机号</p>';
        return;
    }

    const result = DataManager.queryQueueStatus(phone);
    displayQueryResult(resultEl, result);
}

function handleServiceQuery(e) {
    e.preventDefault();
    
    const phone = document.getElementById('serviceQueryPhone').value.trim();
    const resultEl = document.getElementById('serviceQueryResult');

    if (!phone) {
        resultEl.innerHTML = '<p class="empty">请输入手机号</p>';
        return;
    }

    const result = DataManager.queryQueueStatus(phone);
    displayQueryResult(resultEl, result, true);
}

function displayQueryResult(el, result, showActions = false) {
    if (!result.found) {
        el.innerHTML = `
            <div class="query-card">
                <div class="query-status status-none">未查询到记录</div>
                <p>该手机号暂无排队记录</p>
            </div>
        `;
        return;
    }

    const data = result.data;
    let statusHtml = '';
    let statusClass = '';

    switch (result.status) {
        case 'queued':
            statusClass = 'status-queued';
            statusHtml = `
                <div class="query-status ${statusClass}">排队中</div>
                <div class="query-info">
                    <p><strong>姓名：</strong>${data.name}</p>
                    <p><strong>手机号：</strong>${data.phone}</p>
                    <p><strong>时段：</strong>${data.timeSlotText}</p>
                    <p><strong>排队位置：</strong>第 ${data.position} 位</p>
                    <p><strong>预计等候：</strong>${data.waitTime} 分钟</p>
                    <p><strong>排队时间：</strong>${DataManager.formatTime(data.joinTime)}</p>
                </div>
            `;
            break;
        case 'checked':
            statusClass = 'status-checked';
            statusHtml = `
                <div class="query-status ${statusClass}">已检票</div>
                <div class="query-info">
                    <p><strong>姓名：</strong>${data.name}</p>
                    <p><strong>手机号：</strong>${data.phone}</p>
                    <p><strong>时段：</strong>${data.timeSlotText}</p>
                    <p><strong>检票时间：</strong>${DataManager.formatTime(data.checkInTime)}</p>
                </div>
            `;
            break;
        case 'refunded':
            statusClass = 'status-refunded';
            statusHtml = `
                <div class="query-status ${statusClass}">已退票</div>
                <div class="query-info">
                    <p><strong>姓名：</strong>${data.name}</p>
                    <p><strong>手机号：</strong>${data.phone}</p>
                    <p><strong>时段：</strong>${data.timeSlotText}</p>
                    <p><strong>退票原因：</strong>${data.refundReason}</p>
                    <p><strong>退票时间：</strong>${DataManager.formatTime(data.refundTime)}</p>
                </div>
            `;
            break;
    }

    el.innerHTML = `<div class="query-card">${statusHtml}</div>`;
}

function handleCheckIn(e) {
    e.preventDefault();
    
    const phone = document.getElementById('checkInPhone').value.trim();
    const messageEl = document.getElementById('checkInMessage');

    if (!phone) {
        showMessage(messageEl, '请输入手机号', 'error');
        return;
    }

    const result = DataManager.checkIn(phone);
    
    if (result.success) {
        showMessage(messageEl, `${result.message}！游客 ${result.data.name} 已检票上车`, 'success');
        e.target.reset();
    } else {
        showMessage(messageEl, result.message, 'error');
    }

    updateAllDisplays();
}

function handleRefund(e) {
    e.preventDefault();
    
    const phone = document.getElementById('refundPhone').value.trim();
    const reason = document.getElementById('refundReason').value;
    const messageEl = document.getElementById('refundMessage');

    if (!phone || !reason) {
        showMessage(messageEl, '请填写完整信息', 'error');
        return;
    }

    const result = DataManager.processRefund(phone, reason);
    
    if (result.success) {
        showMessage(messageEl, `${result.message}！游客 ${result.data.name} 已成功退票`, 'success');
        e.target.reset();
    } else {
        showMessage(messageEl, result.message, 'error');
    }

    updateAllDisplays();
}

function setStatus(status) {
    DataManager.setRunStatus(status);
    updateAllDisplays();
    
    const statusInfo = DataManager.getStatusInfo(status);
    showFloatingMessage(`运行状态已切换为：${statusInfo.text}`);
}

function updateAllDisplays() {
    updateStatusDisplay();
    updateVisitorTab();
    updateDispatcherTab();
    updateServiceTab();
}

function updateStatusDisplay() {
    const status = DataManager.getRunStatus();
    const statusInfo = DataManager.getStatusInfo(status);
    
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    
    indicator.className = `status-indicator status-${statusInfo.color}`;
    text.textContent = statusInfo.text;
}

function updateVisitorTab() {
    const status = DataManager.getRunStatus();
    const statusInfo = DataManager.getStatusInfo(status);
    const queue = DataManager.getQueue();
    const waitTime = DataManager.getWaitTime();

    document.getElementById('visitorRunStatus').textContent = statusInfo.text;
    document.getElementById('visitorRunStatus').className = `value text-${statusInfo.color}`;
    document.getElementById('visitorWeather').textContent = statusInfo.weather;
    document.getElementById('visitorQueueCount').textContent = queue.length;
    document.getElementById('visitorWaitTime').textContent = `${waitTime} 分钟`;

    const queueList = document.getElementById('queueList');
    if (queue.length === 0) {
        queueList.innerHTML = '<p class="empty">暂无排队数据</p>';
    } else {
        queueList.innerHTML = queue.map((item, index) => `
            <div class="queue-item">
                <span class="queue-position">${index + 1}</span>
                <span class="queue-name">${item.name}</span>
                <span class="queue-phone">${maskPhone(item.phone)}</span>
                <span class="queue-slot">${DataManager.getTimeSlotText(item.timeSlot)}</span>
            </div>
        `).join('');
    }
}

function updateDispatcherTab() {
    const status = DataManager.getRunStatus();
    const statusInfo = DataManager.getStatusInfo(status);
    
    const bigStatus = document.getElementById('bigStatus');
    bigStatus.innerHTML = `<span class="icon">${statusInfo.icon}</span><span class="text">${statusInfo.text}</span>`;
    bigStatus.className = `big-status status-${statusInfo.color}`;

    const stats = DataManager.getStats();
    document.getElementById('statQueue').textContent = stats.queueCount;
    document.getElementById('statChecked').textContent = stats.checkedCount;
    document.getElementById('statRefunded').textContent = stats.refundedCount;

    const queue = DataManager.getQueue();
    const queueList = document.getElementById('dispatcherQueueList');
    if (queue.length === 0) {
        queueList.innerHTML = '<p class="empty">暂无排队数据</p>';
    } else {
        queueList.innerHTML = queue.map((item, index) => `
            <div class="queue-item">
                <span class="queue-position">${index + 1}</span>
                <span class="queue-name">${item.name}</span>
                <span class="queue-phone">${item.phone}</span>
                <span class="queue-slot">${DataManager.getTimeSlotText(item.timeSlot)}</span>
                <span class="queue-time">${DataManager.formatTime(item.joinTime)}</span>
            </div>
        `).join('');
    }
}

function updateServiceTab() {
    const refunds = DataManager.getRefunds();
    const refundList = document.getElementById('refundList');
    
    if (refunds.length === 0) {
        refundList.innerHTML = '<p class="empty">暂无退票记录</p>';
    } else {
        refundList.innerHTML = refunds.map(item => `
            <div class="refund-item">
                <div class="refund-info">
                    <span class="refund-name">${item.name}</span>
                    <span class="refund-phone">${item.phone}</span>
                </div>
                <div class="refund-details">
                    <span>时段：${DataManager.getTimeSlotText(item.timeSlot)}</span>
                    <span>原因：${item.refundReason}</span>
                    <span>时间：${DataManager.formatTime(item.refundTime)}</span>
                </div>
            </div>
        `).join('');
    }
}

function showMessage(el, text, type = 'info') {
    el.textContent = text;
    el.className = `message message-${type}`;
    el.style.display = 'block';
    
    setTimeout(() => {
        el.style.display = 'none';
    }, 5000);
}

function showFloatingMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'floating-message';
    msg.textContent = text;
    document.body.appendChild(msg);
    
    setTimeout(() => {
        msg.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        msg.classList.remove('show');
        setTimeout(() => msg.remove(), 300);
    }, 2500);
}

function maskPhone(phone) {
    if (phone.length >= 11) {
        return phone.substr(0, 3) + '****' + phone.substr(7);
    }
    return phone;
}
