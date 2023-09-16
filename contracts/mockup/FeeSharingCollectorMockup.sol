pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../governance/FeeSharingCollector/FeeSharingCollector.sol";

contract FeeSharingCollectorMockup is FeeSharingCollector {
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
        address _token,
        uint32 _maxCheckpoints,
        address _receiver
    ) public {
        testData = TestData(_token, _maxCheckpoints, _receiver);
    }

    function trueWithdraw(
        address _token,
        uint32 _maxCheckpoints,
        address _receiver
    ) public {
        super.withdraw(_token, _maxCheckpoints, _receiver);
    }

    function addCheckPoint(address loanPoolToken, uint256 poolTokenAmount) public {
        uint96 amount96 =
            safe96(
                poolTokenAmount,
                "FeeSharingCollectorProxy::withdrawFees: pool token amount exceeds 96 bits"
            );
        _addCheckpoint(loanPoolToken, amount96);
    }

    function setTotalTokenCheckpoints(address _token, uint256 qty) public {
        totalTokenCheckpoints[_token] = qty;
    }

    function setUserProcessedCheckpoints(
        address _user,
        address _token,
        uint256 num
    ) public {
        processedCheckpoints[_user][_token] = num;
    }

    function getFullAccumulatedFees(
        address _user,
        address _token,
        uint32 _maxCheckpoints
    ) public view returns (uint256 amount, uint256 end) {
        (amount, end) = _getAccumulatedFees(_user, _token, 0, _maxCheckpoints);
    }

    function invalidLoanPoolWRBTC() public view returns (address) {
        return _getAndValidateLoanPoolWRBTC(address(0));
    }

    function endOfRangeWithZeroMaxCheckpoint(address _token) public view returns (uint256) {
        return _getEndOfRange(0, _token, 0);
    }

    function getRBTCBalance(
        address _token,
        address _user,
        uint32 _maxCheckpoints
    ) public view returns (uint256 _tokenAmount, uint256 _endToken) {
        return _getRBTCBalance(_token, _user, _maxCheckpoints);
    }

    function testWithdrawReentrancy(
        address _token,
        uint32 _maxCheckpoints,
        address _receiver
    ) public {
        reentrancyLock = REENTRANCY_GUARD_LOCKED;
        super.withdraw(_token, _maxCheckpoints, _receiver);
    }
}
