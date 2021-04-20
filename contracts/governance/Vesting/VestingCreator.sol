pragma solidity ^0.5.17;

import "../../interfaces/IERC20.sol";
import "../../mixins/AdminRole.sol";
import "./VestingRegistry.sol";
import "./VestingLogic.sol";


contract VestingCreator is AdminRole {
	///@notice the SOV token contract
	address public SOV;
	VestingRegistry public vestingRegistry;

	VestingData[] public vestingDataList;

	//TODO check storage slots
	struct VestingData {
		address tokenOwner;
		uint96 amount;
		uint120 cliff;
		uint120 duration;
		bool governanceControl;
	}


	event SOVTransferred(address indexed receiver, uint256 amount);

	constructor(address _SOV, address _vestingRegistry) public {
		require(_SOV != address(0), "SOV address invalid");
		require(_vestingRegistry != address(0), "invalid address");

		SOV = _SOV;
		vestingRegistry = VestingRegistry(_vestingRegistry);
	}

	/**
	 * @notice transfers SOV tokens to given address
	 * @param _receiver the address of the SOV receiver
	 * @param _amount the amount to be transferred
	 */
	function transferSOV(address _receiver, uint256 _amount) public onlyOwner {
		require(_receiver != address(0), "receiver address invalid");
		require(_amount != 0, "amount invalid");

		require(IERC20(SOV).transfer(_receiver, _amount), "transfer failed");
		emit SOVTransferred(_receiver, _amount);
	}

	function addVestings(
		address[] memory _tokenOwners,
		uint96[] memory _amounts,
		uint120[] memory _cliffs,
		uint120[] memory _durations,
		bool[] memory _governanceControls
	) public onlyAuthorized {
		require(_tokenOwners.length == _amounts.length
			&& _tokenOwners.length == _cliffs.length
			&& _tokenOwners.length == _durations.length
			&& _tokenOwners.length == _governanceControls.length,
			"arrays mismatch");

		for (uint i = 0; i < _tokenOwners.length; i++) {
			address vestingAddress = _getVesting(_tokenOwners[i], _governanceControls[i]);
			if (_validateVestingSchedule(vestingAddress, _cliffs[i], _durations[i])) {
				VestingData memory vestingData =
					VestingData({
						tokenOwner: _tokenOwners[i],
						amount: _amounts[i],
						cliff: _cliffs[i],
						duration: _durations[i],
						governanceControl: _governanceControls[i]
					});
				vestingDataList.push(vestingData);
			} else {
				//TODO save list with wrong vesting schedule ?

			}
		}
	}

	function getUnprocessedCount() public view returns (uint) {
		return vestingDataList.length;
	}

	function process() public {
		//TODO create 1 or N vestings

	}

	function _getVesting(address _tokenOwner, bool _governanceControl) internal view returns (address vestingAddress) {
		if (_governanceControl) {
			vestingAddress = vestingRegistry.getTeamVesting(_tokenOwner);
		} else {
			vestingAddress = vestingRegistry.getVesting(_tokenOwner);
		}
	}

	function _validateVestingSchedule(address _vestingAddress, uint256 _cliff, uint256 _duration) internal view returns (bool) {
		if (_vestingAddress == address(0)) {
			return true;
		}
		VestingLogic vesting = VestingLogic(_vestingAddress);
		return (_cliff == vesting.cliff() && _duration == vesting.duration());
	}


//	function createVesting(
//		address _tokenOwner,
//		uint256 _amount,
//		uint256 _cliff,
//		uint256 _duration
//	) public onlyOwner {
//		require(_tokenOwner != address(0), "Invalid address");
//		require(!processedList[_tokenOwner], "Already processed");
//
//		processedList[_tokenOwner] = true;
//
//		vestingRegistry.createVesting(_tokenOwner, _amount, _cliff, _duration);
//		address vesting = vestingRegistry.getVesting(_tokenOwner);
//		vestingRegistry.stakeTokens(vesting, _amount);
//	}
}
