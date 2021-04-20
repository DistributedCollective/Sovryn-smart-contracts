pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../interfaces/IERC20.sol";
import "../../mixins/AdminRole.sol";
import "./VestingRegistry.sol";
import "./VestingLogic.sol";

contract VestingCreator is AdminRole {
	using SafeMath for uint;

	///@notice the SOV token contract
	IERC20 public SOV;
	VestingRegistry public vestingRegistry;

	VestingData[] public vestingDataList;

	VestingData[] public vestingDataErrorList;

	//TODO check storage slots
	struct VestingData {
		address tokenOwner;
		uint96 amount;
		uint120 cliff;
		uint120 duration;
		bool governanceControl;
	}

	//TODO add events

	event SOVTransferred(address indexed receiver, uint256 amount);

	constructor(address _SOV, address _vestingRegistry) public {
		require(_SOV != address(0), "SOV address invalid");
		require(_vestingRegistry != address(0), "Vesting registry address invalid");

		SOV = IERC20(_SOV);
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

		require(SOV.transfer(_receiver, _amount), "transfer failed");
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
			VestingData memory vestingData =
				VestingData({
					tokenOwner: _tokenOwners[i],
					amount: _amounts[i],
					cliff: _cliffs[i],
					duration: _durations[i],
					governanceControl: _governanceControls[i]
				});
			if (_validateVestingSchedule(vestingAddress, _cliffs[i], _durations[i])) {
				vestingDataList.push(vestingData);
			} else {
				//account already has vesting contract with different schedule
				//TODO do we need to save vestings with errors ?
				vestingDataErrorList.push(vestingData);
			}
		}
	}

	function getUnprocessedCount() public view returns (uint) {
		return vestingDataList.length;
	}

	function getUnprocessedAmount() public view returns (uint) {
		uint amount = 0;
		for (uint i = 0; i < vestingDataList.length; i++) {
			amount = amount.add(vestingDataList[i].amount);
		}
		return amount;
	}

	function process() onlyAuthorized public {
		if (vestingDataList.length > 0) {
			VestingData storage vestingData = vestingDataList[vestingDataList.length - 1];
			uint amount = vestingData.amount;
			require(SOV.balanceOf(address(this)) >= amount, "balance isn't enough");

			VestingLogic vesting = _createAndGetVesting(vestingData);
			SOV.approve(address(vesting), amount);
			vesting.stakeTokens(amount);

			delete vestingDataList[vestingDataList.length - 1];
		}
	}

	function clearVestingDataErrorList() onlyAuthorized public {
		delete vestingDataErrorList;
	}

	function _createAndGetVesting(VestingData storage vestingData) internal returns (VestingLogic) {
		if (vestingData.governanceControl) {
			vestingRegistry.createTeamVesting(vestingData.tokenOwner, vestingData.amount, vestingData.cliff, vestingData.duration);
		} else {
			vestingRegistry.createVesting(vestingData.tokenOwner, vestingData.amount, vestingData.cliff, vestingData.duration);
		}
		return VestingLogic(_getVesting(vestingData.tokenOwner, vestingData.governanceControl));
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

}
