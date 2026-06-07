const fs = require('fs');
const path = require('path');

global.localStorage = {
    data: {},
    getItem(key) { return this.data[key] || null; },
    setItem(key, value) { this.data[key] = value; },
    removeItem(key) { delete this.data[key]; }
};

const dataCode = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
eval(dataCode);

console.log('========================================');
console.log('景区缆车排队系统 - 业务规则验证');
console.log('========================================\n');

function test(name, fn) {
    try {
        fn();
        console.log(`  ${name}`);
    } catch (e) {
        console.log(`  ${name}: ${e.message}`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || '断言失败');
}

localStorage.data = {};

console.log('--- 测试 1: 大风停运时不能入队 ---');
DataManager.setRunStatus(DataManager.RUN_STATUS.WIND);
test('设置大风停运状态', () => {
    assert(DataManager.getRunStatus() === DataManager.RUN_STATUS.WIND);
});
test('大风停运时加入排队失败', () => {
    const r = DataManager.addToQueue('用户', '13800000001', 'morning');
    assert(r.success === false && r.message.includes('大风停运'));
});
console.log('');

console.log('--- 测试 2: 同一手机号同一时段只能排一次 ---');
DataManager.setRunStatus(DataManager.RUN_STATUS.NORMAL);
test('正常运行状态', () => {
    assert(DataManager.getRunStatus() === DataManager.RUN_STATUS.NORMAL);
});
test('第一次排队成功', () => {
    const r = DataManager.addToQueue('用户A', '13900000001', 'morning');
    assert(r.success === true);
});
test('同一手机号同一时段重复排队失败', () => {
    const r = DataManager.addToQueue('用户A', '13900000001', 'morning');
    assert(r.success === false && r.message.includes('重复排队'));
});
test('同一手机号不同时段可以排队', () => {
    const r = DataManager.addToQueue('用户A', '13900000001', 'afternoon');
    assert(r.success === true);
});
console.log('');

console.log('--- 测试 3: 已检票游客不能退票 ---');
test('检票成功', () => {
    const r = DataManager.checkIn('13900000001');
    assert(r.success === true);
});
test('已检票游客不能退票', () => {
    const r = DataManager.processRefund('13900000001', 'personal');
    assert(r.success === false && r.message.includes('已检票'));
});
console.log('');

console.log('--- 测试 4: 排队中游客可以退票 ---');
DataManager.addToQueue('用户B', '13700000001', 'morning');
test('退票成功', () => {
    const r = DataManager.processRefund('13700000001', 'personal');
    assert(r.success === true);
});
test('退票后不在队列中', () => {
    const q = DataManager.getQueue();
    const has = q.some(i => i.phone === '13700000001');
    assert(has === false);
});
test('退票记录存在', () => {
    const refunds = DataManager.getRefunds();
    const has = refunds.some(i => i.phone === '13700000001');
    assert(has === true);
});
console.log('');

console.log('--- 测试 5: 数据统计 ---');
localStorage.data = {};
DataManager.setRunStatus(DataManager.RUN_STATUS.NORMAL);
DataManager.addToQueue('A', '111', 'morning');
DataManager.addToQueue('B', '222', 'morning');
DataManager.addToQueue('C', '333', 'afternoon');
DataManager.checkIn('111');
DataManager.processRefund('222', 'personal');
test('统计数据正确', () => {
    const s = DataManager.getStats();
    assert(s.queueCount === 1 && s.checkedCount === 1 && s.refundedCount === 1);
});
console.log('');

console.log('========================================');
console.log('所有业务规则验证完成！');
console.log('========================================');
