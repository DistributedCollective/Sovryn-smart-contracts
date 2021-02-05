pragma solidity ^0.5.17;

import "./StakingStorage.sol";
import "../../proxy/Proxy.sol";

contract StakingProxy is StakingStorage, Proxy {
	/**
	 * @notice Construct a new staking contract
	 * @param SOV The address of the SOV token address
	 */
	constructor(address SOV) public {
		SOVToken = IERC20(SOV);
		kickoffTS = block.timestamp;
	}
}
