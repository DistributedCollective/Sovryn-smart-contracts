pragma solidity ^0.5.17;

import "../governance/FeeSharingProxy.sol";

contract FeeSharingProxyMockup is FeeSharingProxy {
	struct TestData {
		address loanPoolToken;
		uint32 maxCheckpoints;
		address receiver;
	}

	TestData public testData;

	constructor(IProtocol _protocol, IStaking _staking, address wRBTCAddress) public FeeSharingProxy(_protocol, _staking, wRBTCAddress) {}

	function withdraw(
		address _loanPoolToken,
		uint32 _maxCheckpoints,
		address _receiver
	) public {
		testData = TestData(_loanPoolToken, _maxCheckpoints, _receiver);
	}
}
