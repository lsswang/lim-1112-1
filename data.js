const DataManager = (function() {
    const STORAGE_KEYS = {
        QUEUE: 'cablecar_queue',
        RUN_STATUS: 'cablecar_run_status',
        REFUNDS: 'cablecar_refunds',
        CHECKED_IN: 'cablecar_checked_in'
    };

    const RUN_STATUS = {
        NORMAL: 'normal',
        WIND: 'wind',
        MAINTENANCE: 'maintenance'
    };

    const STATUS_INFO = {
        normal: { text: '正常运行', icon: '✅', weather: '晴朗', color: 'success' },
        wind: { text: '大风停运', icon: '🌬️', weather: '大风', color: 'warning' },
        maintenance: { text: '维护停运', icon: '🔧', weather: '维护中', color: 'danger' }
    };

    const TIME_SLOT_INFO = {
        morning: '上午 (08:00-12:00)',
        afternoon: '下午 (12:00-17:00)',
        evening: '傍晚 (17:00-19:00)'
    };

    const WAIT_TIME_PER_PERSON = 3;

    function loadData(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }

    function saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function getQueue() {
        return loadData(STORAGE_KEYS.QUEUE, []);
    }

    function saveQueue(queue) {
        saveData(STORAGE_KEYS.QUEUE, queue);
    }

    function getRunStatus() {
        return loadData(STORAGE_KEYS.RUN_STATUS, RUN_STATUS.NORMAL);
    }

    function setRunStatus(status) {
        saveData(STORAGE_KEYS.RUN_STATUS, status);
    }

    function getRefunds() {
        return loadData(STORAGE_KEYS.REFUNDS, []);
    }

    function saveRefunds(refunds) {
        saveData(STORAGE_KEYS.REFUNDS, refunds);
    }

    function getCheckedIn() {
        return loadData(STORAGE_KEYS.CHECKED_IN, []);
    }

    function saveCheckedIn(checkedIn) {
        saveData(STORAGE_KEYS.CHECKED_IN, checkedIn);
    }

    function isServiceRunning() {
        return getRunStatus() === RUN_STATUS.NORMAL;
    }

    function getWaitTime() {
        const queue = getQueue();
        return queue.length * WAIT_TIME_PER_PERSON;
    }

    function isPhoneInQueue(phone, timeSlot) {
        const queue = getQueue();
        return queue.some(item => item.phone === phone && item.timeSlot === timeSlot);
    }

    function isPhoneCheckedIn(phone) {
        const checkedIn = getCheckedIn();
        return checkedIn.some(item => item.phone === phone);
    }

    function isPhoneRefunded(phone) {
        const refunds = getRefunds();
        return refunds.some(item => item.phone === phone);
    }

    function addToQueue(name, phone, timeSlot) {
        if (!isServiceRunning()) {
            const statusInfo = STATUS_INFO[getRunStatus()];
            return { success: false, message: `当前${statusInfo.text}，无法加入排队` };
        }

        if (isPhoneInQueue(phone, timeSlot)) {
            return { success: false, message: '该手机号已在此时段排队，请勿重复排队' };
        }

        if (isPhoneCheckedIn(phone)) {
            return { success: false, message: '该游客已检票，无需再次排队' };
        }

        const queue = getQueue();
        const position = queue.length + 1;
        const queueItem = {
            id: generateId(),
            name,
            phone,
            timeSlot,
            position,
            joinTime: new Date().toISOString(),
            status: 'queued'
        };

        queue.push(queueItem);
        saveQueue(queue);

        return {
            success: true,
            message: '排队成功',
            data: {
                ...queueItem,
                waitTime: getWaitTime()
            }
        };
    }

    function queryQueueStatus(phone) {
        const queue = getQueue();
        const item = queue.find(q => q.phone === phone);

        if (item) {
            return {
                found: true,
                status: 'queued',
                data: {
                    ...item,
                    waitTime: item.position * WAIT_TIME_PER_PERSON,
                    timeSlotText: TIME_SLOT_INFO[item.timeSlot]
                }
            };
        }

        const checkedIn = getCheckedIn();
        const checkedItem = checkedIn.find(c => c.phone === phone);
        if (checkedItem) {
            return {
                found: true,
                status: 'checked',
                data: {
                    ...checkedItem,
                    timeSlotText: TIME_SLOT_INFO[checkedItem.timeSlot]
                }
            };
        }

        const refunds = getRefunds();
        const refundItem = refunds.find(r => r.phone === phone);
        if (refundItem) {
            return {
                found: true,
                status: 'refunded',
                data: {
                    ...refundItem,
                    timeSlotText: TIME_SLOT_INFO[refundItem.timeSlot]
                }
            };
        }

        return { found: false, status: 'none', data: null };
    }

    function checkIn(phone) {
        const queue = getQueue();
        const index = queue.findIndex(q => q.phone === phone);

        if (index === -1) {
            return { success: false, message: '该游客不在排队队列中' };
        }

        const queueItem = queue[index];
        
        queue.splice(index, 1);
        queue.forEach((item, i) => {
            item.position = i + 1;
        });
        saveQueue(queue);

        const checkedIn = getCheckedIn();
        checkedIn.push({
            ...queueItem,
            checkInTime: new Date().toISOString(),
            status: 'checked'
        });
        saveCheckedIn(checkedIn);

        return { success: true, message: '检票成功', data: queueItem };
    }

    function processRefund(phone, reason) {
        const queue = getQueue();
        const index = queue.findIndex(q => q.phone === phone);

        if (index === -1) {
            if (isPhoneCheckedIn(phone)) {
                return { success: false, message: '该游客已检票，无法办理退票' };
            }
            if (isPhoneRefunded(phone)) {
                return { success: false, message: '该游客已办理过退票' };
            }
            return { success: false, message: '未找到该游客的排队记录' };
        }

        const queueItem = queue[index];
        
        queue.splice(index, 1);
        queue.forEach((item, i) => {
            item.position = i + 1;
        });
        saveQueue(queue);

        const refunds = getRefunds();
        refunds.push({
            ...queueItem,
            refundReason: reason,
            refundTime: new Date().toISOString(),
            status: 'refunded'
        });
        saveRefunds(refunds);

        return { success: true, message: '退票成功', data: queueItem };
    }

    function getStats() {
        return {
            queueCount: getQueue().length,
            checkedCount: getCheckedIn().length,
            refundedCount: getRefunds().length
        };
    }

    function getStatusInfo(status) {
        return STATUS_INFO[status] || STATUS_INFO.normal;
    }

    function getTimeSlotText(slot) {
        return TIME_SLOT_INFO[slot] || slot;
    }

    function formatTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function initDemoData() {
        if (getQueue().length === 0 && getCheckedIn().length === 0 && getRefunds().length === 0) {
            const demoQueue = [
                { id: generateId(), name: '张三', phone: '13800138001', timeSlot: 'morning', position: 1, joinTime: new Date(Date.now() - 300000).toISOString(), status: 'queued' },
                { id: generateId(), name: '李四', phone: '13800138002', timeSlot: 'morning', position: 2, joinTime: new Date(Date.now() - 240000).toISOString(), status: 'queued' },
                { id: generateId(), name: '王五', phone: '13800138003', timeSlot: 'afternoon', position: 3, joinTime: new Date(Date.now() - 180000).toISOString(), status: 'queued' }
            ];
            saveQueue(demoQueue);

            const demoChecked = [
                { id: generateId(), name: '赵六', phone: '13800138004', timeSlot: 'morning', checkInTime: new Date(Date.now() - 600000).toISOString(), status: 'checked' }
            ];
            saveCheckedIn(demoChecked);
        }
    }

    return {
        RUN_STATUS,
        getQueue,
        getRunStatus,
        setRunStatus,
        getRefunds,
        getCheckedIn,
        isServiceRunning,
        getWaitTime,
        addToQueue,
        queryQueueStatus,
        checkIn,
        processRefund,
        getStats,
        getStatusInfo,
        getTimeSlotText,
        formatTime,
        initDemoData
    };
})();
