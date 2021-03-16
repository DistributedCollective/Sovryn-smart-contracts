pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "./VestingRegistry.sol";

/**
 * @title Temp contract for checking address, creating and staking tokens
 *
 */
contract OrigingVestingCreator is Ownable {
	VestingRegistry public vestingRegistry;

	mapping(address => bool) processedList;

	constructor(address _vestingRegistry) public {
		vestingRegistry = VestingRegistry(_vestingRegistry);
	}

	function createVesting(
		address _tokenOwner,
		uint256 _amount,
		uint256 _cliff,
		uint256 _duration
	) public onlyOwner {
		require(_tokenOwner != address(0), "Invalid address");
		require(!processedList[_tokenOwner], "Already processed");

		processedList[_tokenOwner] = true;

		vestingRegistry.createVesting(_tokenOwner, _amount, _cliff, _duration);
		address vesting = vestingRegistry.getVesting(_tokenOwner);
		vestingRegistry.stakeTokens(vesting, _amount);
	}
}
