pragma solidity ^0.5.17;

import "../governance/FeeSharingCollector/FeeSharingCollectorMultipleToken.sol";

contract FeeSharingCollectorMultipleTokenMockup is FeeSharingCollectorMultipleToken {
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

    function withdraw(address _token, uint32 _maxCheckpoint, address _receiver) public {
        testData = TestData(_token, _maxCheckpoint, _receiver);
    }

    function trueWithdraw(address _token, uint32 _maxCheckpoint, address _receiver) public {
        super.withdraw(_token, _maxCheckpoint, _receiver);
    }

    function trueWithdrawTokens(
        address[] memory _tokens,
        uint32[] memory _maxCheckpoints,
        address _receiver
    ) public {
        super.withdrawTokens(_tokens, _maxCheckpoints, _receiver);
    }

    function addCheckPoint(address loanPoolToken, uint256 poolTokenAmount) public {
        uint96 amount96 = safe96(
            poolTokenAmount,
            "FeeSharingProxy::withdrawFees: pool token amount exceeds 96 bits"
        );
        _addCheckpoint(loanPoolToken, amount96);
    }
}
