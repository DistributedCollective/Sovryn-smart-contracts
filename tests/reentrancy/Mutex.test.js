const mutexUtils = require("./utils");

describe('Mutex', function () {
    it('getOrDeployMutex', async () => {
        let mutex = await mutexUtils.getOrDeployMutex();
        expect(mutex.address).to.equal("0xc783106a68d2Dc47b443C20067448a9c53121207")

        // Test that we can call it again and it's basically a no-op
        mutex = await mutexUtils.getOrDeployMutex();
        expect(mutex.address).to.equal("0xc783106a68d2Dc47b443C20067448a9c53121207")
    });

    it('createMutexDeployTransaction', async () => {
        // Test that it doesn't fail. We could test something else too
        await mutexUtils.createMutexDeployTransaction();
    });
});
