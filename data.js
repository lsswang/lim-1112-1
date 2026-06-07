const DataManager = (function() {
    const QUEUE_KEY = 'cablecar_queue';
    const RUN_STATUS_KEY = 'cablecar_run_status';
    const REFUNDS_KEY = 'cablecar_refunds';
    const CHECKED_KEY = 'cablecar_checked';

    const RUN_STATUS = {
        NORMAL: 'normal',
        WIND: 'wind',
        MAINTENANCE: 'maintenance'
    };

    const TIME_SLOTS = {
        morning: '上午(08:00-12:00)',
        afternoon: '下午(12:00-16:00)',
        evening: '傍晚(16:00-18:00)'
    };

    const AVG_PROCESS_MINUTES = 3;

    function initStorage() {
        if (!localStorage.getItem(QUEUE_KEY)) {
            localStorage.setItem(QUEUE_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(RUN_STATUS_KEY)) {
            localStorage.setItem(RUN_STATUS_KEY, RUN_STATUS.NORMAL);
        }
        if (!localStorage.getItem(REFUNDS_KEY)) {
            localStorage.setItem(REFUNDS_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(CHECKED_KEY)) {
            localStorage.setItem(CHECKED_KEY, JSON.stringify([]));
        }
    }

    function getQueue() {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    }

    function saveQueue(queue) {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }

    function getRunStatus() {
        return localStorage.getItem(RUN_STATUS_KEY) || RUN_STATUS.NORMAL;
    }

    function setRunStatus(status) {
        localStorage.setItem(RUN_STATUS_KEY, status);
    }

    function isServiceRunning() {
        return getRunStatus() === RUN_STATUS.NORMAL;
    }

    function getRefunds() {
        return JSON.parse(localStorage.getItem(REFUNDS_KEY) || '[]');
    }

    function saveRefunds(refunds) {
        localStorage.setItem(REFUNDS_KEY, JSON.stringify(refunds));
    }

    function getChecked() {
        return JSON.parse(localStorage.getItem(CHECKED_KEY) || '[]');
    }

    function saveChecked(checked) {
        localStorage.setItem(CHECKED_KEY, JSON.stringify(checked));
    }

    function isPhoneInQueue(phone, timeSlot) {
        const queue = getQueue();
        return queue.some(item => item.phone === phone && item.timeSlot === timeSlot);
    }

    function isPhoneCheckedIn(phone) {
        const checked = getChecked();
        return checked.some(item => item.phone === phone);
    }

    function isPhoneRefunded(phone) {
        const refunds = getRefunds();
        return refunds.some(item => item.phone === phone);
    }

    function getPosition(phone) {
        const queue = getQueue();
        const idx = queue.findIndex(item => item.phone === phone);
        return idx >= 0 ? idx + 1 : -1;
    }

    function getWaitTime() {
        const queue = getQueue();
        return queue.length * AVG_PROCESS_MINUTES;
    }

    function addToQueue(name, phone, timeSlot) {
        initStorage();
        
        if (!isServiceRunning()) {
            const status = getRunStatus();
            const msg = status === RUN_STATUS.WIND ? '当前大风停运，无法排队' : '当前维护停运，无法排队';
            return { success: false, message: msg };
        }

        if (isPhoneCheckedIn(phone)) {
            return { success: false, message: '该手机号用户已检票，不能再次排队' };
        }

        if (isPhoneInQueue(phone, timeSlot)) {
            return { success: false, message: '该手机号已在此时段排队，请勿重复排队' };
        }

        const queue = getQueue();
        const newItem = {
            name,
            phone,
            timeSlot,
            timestamp: Date.now()
        };
        queue.push(newItem);
        saveQueue(queue);

        return {
            success: true,
            message: '排队成功',
            data: {
                position: queue.length,
                waitTime: queue.length * AVG_PROCESS_MINUTES,
                ...newItem
            }
        };
    }

    function checkIn(phone) {
        initStorage();
        const queue = getQueue();
        const idx = queue.findIndex(item => item.phone === phone);
        
        if (idx === -1) {
            return { success: false, message: '该用户不在排队队列中' };
        }

        const item = queue[idx];
        queue.splice(idx, 1);
        saveQueue(queue);

        const checked = getChecked();
        checked.push({
            ...item,
            checkInTime: Date.now()
        });
        saveChecked(checked);

        return { success: true, message: '检票成功', data: item };
    }

    function processRefund(phone, reason) {
        initStorage();
        
        if (isPhoneCheckedIn(phone)) {
            return { success: false, message: '该用户已检票，不能退票' };
        }

        const queue = getQueue();
        const idx = queue.findIndex(item => item.phone === phone);
        
        if (idx === -1) {
            return { success: false, message: '该用户不在排队队列中' };
        }

        const item = queue[idx];
        queue.splice(idx, 1);
        saveQueue(queue);

        const refunds = getRefunds();
        refunds.push({
            ...item,
            reason,
            refundTime: Date.now()
        });
        saveRefunds(refunds);

        return { success: true, message: '退票成功', data: item };
    }

    function queryQueueStatus(phone) {
        initStorage();
        
        if (isPhoneCheckedIn(phone)) {
            const checked = getChecked();
            const item = checked.find(i => i.phone === phone);
            return {
                status: 'checked',
                message: '已检票上车',
                data: item
            };
        }

        if (isPhoneRefunded(phone)) {
            const refunds = getRefunds();
            const item = refunds.find(i => i.phone === phone);
            return {
                status: 'refunded',
                message: '已退票',
                data: item
            };
        }

        const pos = getPosition(phone);
        if (pos > 0) {
            const queue = getQueue();
            const item = queue[pos - 1];
            return {
                status: 'queuing',
                message: '排队中',
                data: {
                    position: pos,
                    waitTime: pos * AVG_PROCESS_MINUTES,
                    ...item
                }
            };
        }

        return {
            status: 'not_found',
            message: '未找到排队记录'
        };
    }

    function getStats() {
        initStorage();
        return {
            queueCount: getQueue().length,
            checkedCount: getChecked().length,
            refundedCount: getRefunds().length,
            runStatus: getRunStatus(),
            waitTime: getWaitTime()
        };
    }

    function resetAll() {
        localStorage.removeItem(QUEUE_KEY);
        localStorage.removeItem(RUN_STATUS_KEY);
        localStorage.removeItem(REFUNDS_KEY);
        localStorage.removeItem(CHECKED_KEY);
        initStorage();
    }

    initStorage();

    const api = {
        RUN_STATUS,
        TIME_SLOTS,
        getQueue,
        getRunStatus,
        setRunStatus,
        isServiceRunning,
        getRefunds,
        getChecked,
        addToQueue,
        checkIn,
        processRefund,
        queryQueueStatus,
        getWaitTime,
        getStats,
        resetAll
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    return api;
})();
