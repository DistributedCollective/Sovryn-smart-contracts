pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "./VestingRegistry.sol";

/**
 * @title Temp contract for checking address, creating and staking tokens.
 * @notice It casts an instance of vestingRegistry and by using createVesting
 * function it creates a vesting, gets it and stakes some tokens w/ this vesting.
 * */
contract OrigingVestingCreator is Ownable {
	VestingRegistry public vestingRegistry;

	mapping(address => bool) processedList;

	constructor(address _vestingRegistry) public {
		vestingRegistry = VestingRegistry(_vestingRegistry);
	}

	/**
	 * @notice Create a vesting, get it and stake some tokens w/ this vesting.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _amount The amount of tokens to be vested.
	 * @param _cliff The time interval to the first withdraw in seconds.
	 * @param _duration The total duration in seconds.
	 * */
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
