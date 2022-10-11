const { ethers } = require('hardhat');
const { getOrDeployMutex } = require('./utils');

describe('SharedReentrancyGuard', async () => {
    let nonReentrantValueSetter;
    let anotherNonReentrantValueSetter;
    let reentrantValueSetter;
    let valueSetterProxy;
    let proxiedValueSetter;

    beforeEach(async () => {
        const NonReentrantValueSetter = await ethers.getContractFactory('TestNonReentrantValueSetter');
        const ValueSetter = await ethers.getContractFactory('TestValueSetter');
        const ValueSetterProxy = await ethers.getContractFactory('TestValueSetterProxy');
        nonReentrantValueSetter = await NonReentrantValueSetter.deploy();
        anotherNonReentrantValueSetter = await NonReentrantValueSetter.deploy();
        reentrantValueSetter = await ValueSetter.deploy();
        valueSetterProxy = await ValueSetterProxy.deploy();
        proxiedValueSetter = await ValueSetter.attach(valueSetterProxy.address);

        // The Mutex singleton must be deployed for SharedReentrancyGuard to work
        await getOrDeployMutex();
    });

    it('sanity check', async () => {
        expect(await nonReentrantValueSetter.value()).to.equal(0);
        expect(await anotherNonReentrantValueSetter.value()).to.equal(0);
        expect(await reentrantValueSetter.value()).to.equal(0);
        expect(await valueSetterProxy.value()).to.equal(0);
        expect(await proxiedValueSetter.value()).to.equal(0);

        await nonReentrantValueSetter.setValue(1);
        await anotherNonReentrantValueSetter.setValue(2);
        await reentrantValueSetter.setValue(3);

        await valueSetterProxy.setImplementation(reentrantValueSetter.address);
        await proxiedValueSetter.setValue(4);

        expect(await nonReentrantValueSetter.value()).to.equal(1);
        expect(await anotherNonReentrantValueSetter.value()).to.equal(2);
        expect(await reentrantValueSetter.value()).to.equal(3);
        expect(await valueSetterProxy.value()).to.equal(4);
        expect(await proxiedValueSetter.value()).to.equal(4);
    });

    it('non-globallyNonReentrant call from globallyNonReentrant call does not revert', async () => {
        await expect(
            nonReentrantValueSetter.setOtherContractValueNonReentrant(
                anotherNonReentrantValueSetter.address,
                1
            )
        ).to.be.revertedWith('reentrancy violation');
        expect(await anotherNonReentrantValueSetter.value()).to.equal(0);
    });

    it('globallyNonReentrant call from globallyNonReentrant call reverts', async () => {
        await nonReentrantValueSetter.setOtherContractValueNonReentrant(
            reentrantValueSetter.address,
            1
        );
        expect(await reentrantValueSetter.value()).to.equal(1);
    });

    it('two globallyNonReentrant calls in the same transaction work if not nested', async () => {
        await nonReentrantValueSetter.setThisAndOtherContractValue(
            anotherNonReentrantValueSetter.address,
            1337,
        );
        expect(await nonReentrantValueSetter.value()).to.equal(1337);
        expect(await anotherNonReentrantValueSetter.value()).to.equal(1337);

        // sanity check
        await nonReentrantValueSetter.setThisAndOtherContractValue(
            reentrantValueSetter.address,
            1338,
        );
        expect(await nonReentrantValueSetter.value()).to.equal(1338);
        expect(await reentrantValueSetter.value()).to.equal(1338);
        expect(await anotherNonReentrantValueSetter.value()).to.equal(1337);
    });

    it('globallyNonReentrant works with proxies', async () => {
        await valueSetterProxy.setImplementation(reentrantValueSetter.address);
        expect(await proxiedValueSetter.value()).to.equal(0);

        await nonReentrantValueSetter.setOtherContractValueNonReentrant(
            valueSetterProxy.address,
            1
        );
        expect(await proxiedValueSetter.value()).to.equal(1);

        await valueSetterProxy.setImplementation(anotherNonReentrantValueSetter.address);
        await expect(
            nonReentrantValueSetter.setOtherContractValueNonReentrant(
                valueSetterProxy.address,
                2
            )
        ).to.be.revertedWith('reentrancy violation');
        expect(await proxiedValueSetter.value()).to.equal(1);

        await proxiedValueSetter.setValue(3);
        expect(await proxiedValueSetter.value()).to.equal(3);
    });

    it('works with proxies without breaking the memory layout', async () => {
        await valueSetterProxy.setImplementation(reentrantValueSetter.address);
        expect(await proxiedValueSetter.value()).to.equal(0);


        await proxiedValueSetter.setValue(1);
        expect(await proxiedValueSetter.value()).to.equal(1);

        await valueSetterProxy.setImplementation(anotherNonReentrantValueSetter.address);
        await proxiedValueSetter.setValue(2);
        expect(await proxiedValueSetter.value()).to.equal(2);
    });
});