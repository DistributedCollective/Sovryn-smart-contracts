const { ethers } = require("hardhat");
const mutexUtils = require("./utils");

describe("Mutex", function () {
    describe("special deploy utilities", function () {
        it("getOrDeployMutex", async () => {
            let mutex = await mutexUtils.getOrDeployMutex();
            expect(mutex.address).to.equal("0xba10edD6ABC7696Eae685839217BdcC42139612b");

            // Test that we can call it again, and it's basically a no-op
            mutex = await mutexUtils.getOrDeployMutex();
            expect(mutex.address).to.equal("0xba10edD6ABC7696Eae685839217BdcC42139612b");
        });

        it("createMutexDeployTransaction", async () => {
            // Test that it doesn't fail. We could test something else too, but the data returned by
            // mutexUtils.createMutexDeployTransaction will change if *anything* in Mutex.sol changes,
            // including comments and whitespace
            await mutexUtils.createMutexDeployTransaction();
        });
    });

    describe("Mutex contract", function () {
        let mutex;
        let owner;
        let anotherUser;

        beforeEach(async () => {
            const Mutex = await ethers.getContractFactory("Mutex");
            mutex = await Mutex.deploy();
            [owner, anotherUser] = await ethers.getSigners();
        });

        it("test value and incrementAndGetValue", async () => {
            expect(await mutex.value()).to.equal(0);
            expect(await mutex.callStatic.incrementAndGetValue()).to.equal(1);
            await mutex.incrementAndGetValue();
            expect(await mutex.value()).to.equal(1);

            // test from another account
            expect(await mutex.connect(anotherUser).callStatic.incrementAndGetValue()).to.equal(2);
            await mutex.connect(anotherUser).incrementAndGetValue();
            expect(await mutex.value()).to.equal(2);
        });
    });
});
