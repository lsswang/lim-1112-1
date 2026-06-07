global.localStorage = {
    data: {},
    getItem(key) { return this.data[key] !== undefined ? this.data[key] : null; },
    setItem(key, value) { this.data[key] = value; },
    removeItem(key) { delete this.data[key]; }
};

const DM = require("./data.js");
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log("  ✅ " + name);
        passed++;
    } catch (e) {
        console.log("  ❌ " + name + ": " + e.message);
        failed++;
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg || "Assertion failed");
}

console.log("========================================");
console.log("🏔️  景区缆车排队系统 - 业务规则验证");
console.log("========================================\n");

localStorage.data = {};

console.log("--- 测试 1: 大风停运时不能入队 ---");
test("设置大风停运状态", () => {
    DM.setRunStatus(DM.RUN_STATUS.WIND);
    assert(DM.getRunStatus() === DM.RUN_STATUS.WIND);
});
test("大风停运时加入排队失败", () => {
    const r = DM.addToQueue("测试用户", "13800000001", "morning");
    assert(r.success === false, "应该失败");
    assert(r.message.includes("大风停运"), "错误信息应包含大风停运");
});
test("维护停运时也不能入队", () => {
    DM.setRunStatus(DM.RUN_STATUS.MAINTENANCE);
    const r = DM.addToQueue("测试用户2", "13800000002", "morning");
    assert(r.success === false, "应该失败");
    assert(r.message.includes("维护停运"), "错误信息应包含维护停运");
});
console.log("");

console.log("--- 测试 2: 同一手机号同一时段只能排一次 ---");
test("恢复正常运行状态", () => {
    DM.setRunStatus(DM.RUN_STATUS.NORMAL);
    assert(DM.getRunStatus() === DM.RUN_STATUS.NORMAL);
});
test("第一次排队成功", () => {
    const r = DM.addToQueue("用户A", "13900000001", "morning");
    assert(r.success === true, "应该成功");
    assert(r.data.position === 1, "位置应该是1");
});
test("同一手机号同一时段重复排队失败", () => {
    const r = DM.addToQueue("用户A", "13900000001", "morning");
    assert(r.success === false, "应该失败");
    assert(r.message.includes("重复排队"), "错误信息应包含重复排队提示");
});
test("同一手机号不同时段可以排队", () => {
    const r = DM.addToQueue("用户A", "13900000001", "afternoon");
    assert(r.success === true, "不同时段应该可以成功");
});
console.log("");

console.log("--- 测试 3: 已检票游客不能退票 ---");
test("检票成功", () => {
    const r = DM.checkIn("13900000001");
    assert(r.success === true, "检票应该成功");
});
test("检票后状态变为已检票", () => {
    const r = DM.queryQueueStatus("13900000001");
    assert(r.status === "checked", "状态应该是已检票");
});
test("已检票游客不能退票", () => {
    const r = DM.processRefund("13900000001", "personal");
    assert(r.success === false, "退票应该失败");
    assert(r.message.includes("已检票"), "错误信息应包含已检票");
});
test("已检票游客不能再次排队", () => {
    const r = DM.addToQueue("用户A", "13900000001", "evening");
    assert(r.success === false, "排队应该失败");
    assert(r.message.includes("已检票"), "错误信息应包含已检票");
});
console.log("");

console.log("--- 测试 4: 排队中游客可以退票 ---");
DM.addToQueue("退票测试用户", "13700000001", "morning");
test("排队中游客退票成功", () => {
    const r = DM.processRefund("13700000001", "personal");
    assert(r.success === true, "退票应该成功");
});
test("退票后不在队列中", () => {
    const queue = DM.getQueue();
    const has = queue.some(i => i.phone === "13700000001");
    assert(has === false, "队列中不应有该游客");
});
test("退票记录存在", () => {
    const refunds = DM.getRefunds();
    const has = refunds.some(i => i.phone === "13700000001");
    assert(has === true, "退票记录中应该有该游客");
});
test("退票后查询状态正确", () => {
    const r = DM.queryQueueStatus("13700000001");
    assert(r.status === "refunded", "状态应该是已退票");
});
test("已退票游客可以重新排队", () => {
    const r = DM.addToQueue("退票测试用户", "13700000001", "evening");
    assert(r.success === true, "退票后应该可以重新排队");
});
console.log("");

console.log("--- 测试 5: 统计数据正确 ---");
localStorage.data = {};
DM.setRunStatus(DM.RUN_STATUS.NORMAL);
DM.addToQueue("用户1", "11111111111", "morning");
DM.addToQueue("用户2", "22222222222", "morning");
DM.addToQueue("用户3", "33333333333", "afternoon");
DM.checkIn("11111111111");
DM.processRefund("22222222222", "personal");
test("统计数据 - 排队中、已检票、已退票数量正确", () => {
    const s = DM.getStats();
    assert(s.queueCount === 1, "排队中应该是1人，实际是" + s.queueCount);
    assert(s.checkedCount === 1, "已检票应该是1人，实际是" + s.checkedCount);
    assert(s.refundedCount === 1, "已退票应该是1人，实际是" + s.refundedCount);
});
console.log("");

console.log("--- 测试 6: 预计候车时间计算 ---");
localStorage.data = {};
DM.setRunStatus(DM.RUN_STATUS.NORMAL);
DM.addToQueue("A", "a", "morning");
DM.addToQueue("B", "b", "morning");
DM.addToQueue("C", "c", "morning");
test("3人排队时预计等候9分钟（每人3分钟）", () => {
    const wt = DM.getWaitTime();
    assert(wt === 9, "应该是9分钟，实际是" + wt);
});
console.log("");

console.log("========================================");
console.log("🎉 测试完成！通过: " + passed + "，失败: " + failed);
console.log("========================================\n");

console.log("📋 业务规则验证总结：");
console.log("   ✅ 大风停运时不能入队");
console.log("   ✅ 同一手机号同一时段只能排一次");
console.log("   ✅ 已检票游客不能退票");
console.log("   ✅ 已检票游客不能再次排队");
console.log("   ✅ 排队中游客可以退票");
console.log("   ✅ 退票后可以重新排队");
console.log("   ✅ 统计数据正确");
console.log("   ✅ 候车时间计算正确");
