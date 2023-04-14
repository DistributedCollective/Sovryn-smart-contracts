pragma solidity ^0.5.17;

import "../governance/FeeSharingCollector/FeeSharingCollector.sol";

contract FeeSharingCollectorProxyMockup is FeeSharingCollector {
    struct TestData {
        address loanPoolToken;
        uint32 maxCheckpoints;
        address receiver;
    }

    TestData public testData;

    constructor(IProtocol _protocol, IStaking _staking) public {
        protocol = _protocol;
        staking = _staking;
    }

    function withdraw(
        address _loanPoolToken,
        uint32 _maxCheckpoints,
        address _receiver
    ) public {
        testData = TestData(_loanPoolToken, _maxCheckpoints, _receiver);
    }

    function trueWithdraw(
        address _loanPoolToken,
        uint32 _maxCheckpoints,
        address _receiver
    ) public {
        super.withdraw(_loanPoolToken, _maxCheckpoints, _receiver);
    }

    function addCheckPoint(address loanPoolToken, uint256 poolTokenAmount) public {
        uint96 amount96 =
            safe96(
                poolTokenAmount,
                "FeeSharingCollectorProxy::withdrawFees: pool token amount exceeds 96 bits"
            );
        _addCheckpoint(loanPoolToken, amount96);
    }

    function setUserProcessedCheckpoints(
        address _user,
        address _loanPoolToken,
        uint256 num
    ) public {
        processedCheckpoints[_user][_loanPoolToken] = num;
    }
}
