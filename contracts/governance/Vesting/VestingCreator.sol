pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../interfaces/IERC20.sol";
import "../../mixins/AdminRole.sol";
import "./VestingRegistry.sol";
import "./VestingLogic.sol";

contract VestingCreator is AdminRole {
	using SafeMath for uint;

	//@notice the SOV token contract
	IERC20 public SOV;
	//@notice the vesting registry contract
	VestingRegistry public vestingRegistry;

	//@notice list of vesting to be processed
	VestingData[] public vestingDataList;
	//@notice list of vesting with errors, can't be processed
	VestingData[] public vestingDataErrorList;

	//TODO check storage slots and max values of the fields
	struct VestingData {
		address tokenOwner;
		uint96 amount;
		uint120 cliff;
		uint120 duration;
		//@dev true - tokens can be withdrawn by governance
		bool governanceControl;
	}

	event SOVTransferred(address indexed receiver, uint256 amount);
	event TokensStaked(address indexed vesting, uint256 amount);
	event VestingDataRemoved(address indexed caller, address tokenOwner);
	event DataCleared(address indexed caller);
	event ErrorDataCleared(address indexed caller);

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

	/**
	 * @notice adds vestings to be processed to the list
	 * @dev if account doesn't have another vesting of the same type (controlled or not controlled by governance), with another schedule
	 * @dev vesting data will be added to vestingDataList, otherwise it will be added to vestingDataErrorList
	 */
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

		//TODO we need to validate vestings data (cliff, duration, etc.)

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
				//we need to save it to have list with wrong vesting data
				vestingDataErrorList.push(vestingData);
			}
		}
	}

	/**
	 * @notice creates vesting contract (if it hasn't been created yet) and stakes tokens
	 */
	function processNextVesting() onlyAuthorized public {
		if (vestingDataList.length > 0) {
			VestingData storage vestingData = vestingDataList[vestingDataList.length - 1];
			uint amount = vestingData.amount;
			require(SOV.balanceOf(address(this)) >= amount, "balance isn't enough");

			VestingLogic vesting = _createAndGetVesting(vestingData);

			//TODO check if tokens can be staked after vesting creation
			SOV.approve(address(vesting), amount);
			vesting.stakeTokens(amount);
			delete vestingDataList[vestingDataList.length - 1];
			emit TokensStaked(address(vesting), amount);
		}
	}

	/**
	 * @notice creates vesting contract without staking any tokens
	 * @dev it can be the case when vesting creation and tokens staking can't be done in one transaction because of block gas limit
	 */
	function processVestingCreation() onlyAuthorized public {
		if (vestingDataList.length > 0) {
			VestingData storage vestingData = vestingDataList[vestingDataList.length - 1];
			_createAndGetVesting(vestingData);
		}
	}

	/**
	 * @notice removes next vesting data from the list
	 * @dev we process inverted list
	 * @dev we should be able to remove incorrect vesting data that can't be processed
	 */
	function removeNextVesting() onlyAuthorized public {
		if (vestingDataList.length > 0) {
			VestingData storage vestingData = vestingDataList[vestingDataList.length - 1];
			delete vestingDataList[vestingDataList.length - 1];
			emit VestingDataRemoved(msg.sender, vestingData.tokenOwner);
		}
	}

	/**
	 * @notice removes all data about unprocessed vestings to be processed
	 */
	function clearVestingDataList() onlyAuthorized public {
		delete vestingDataList;
		emit DataCleared(msg.sender);
	}

	/**
	 * @notice removes all data about unprocessed vestings with errors
	 * @dev account already has vesting contract with different schedule
	 * @dev we can't stake tokens to this vesting, because list of unlocked dates will be incorrect
	 */
	function clearVestingDataErrorList() onlyAuthorized public {
		delete vestingDataErrorList;
		emit ErrorDataCleared(msg.sender);
	}

	/**
	 * @notice returns count of vestings to be processed
	 */
	function getUnprocessedCount() public view returns (uint) {
		return vestingDataList.length;
	}

	/**
	 * @notice returns total amount of vestings to be processed
	 */
	function getUnprocessedAmount() public view returns (uint) {
		uint amount = 0;
		for (uint i = 0; i < vestingDataList.length; i++) {
			amount = amount.add(vestingDataList[i].amount);
		}
		return amount;
	}

	/**
	 * @notice checks if contract balance is enough to process all vestings
	 */
	function isEnoughBalance() public view returns (bool) {
		return SOV.balanceOf(address(this)) >= getUnprocessedAmount();
	}

	/**
	 * @notice returns missed balance to process all vestings
	 */
	function getMissingBalance() public view returns (uint) {
		if (isEnoughBalance()) {
			return 0;
		}
		return getUnprocessedAmount() - SOV.balanceOf(address(this));
	}

	/**
	 * @notice creates TeamVesting or Vesting contract
	 * @dev new contract won't be created if account already has contract of the same type
	 */
	function _createAndGetVesting(VestingData storage vestingData) internal returns (VestingLogic) {
		if (vestingData.governanceControl) {
			vestingRegistry.createTeamVesting(vestingData.tokenOwner, vestingData.amount, vestingData.cliff, vestingData.duration);
		} else {
			vestingRegistry.createVesting(vestingData.tokenOwner, vestingData.amount, vestingData.cliff, vestingData.duration);
		}
		return VestingLogic(_getVesting(vestingData.tokenOwner, vestingData.governanceControl));
	}

	/**
	 * @notice returns an address of TeamVesting or Vesting contract (depends on a governance control)
	 */
	function _getVesting(address _tokenOwner, bool _governanceControl) internal view returns (address vestingAddress) {
		if (_governanceControl) {
			vestingAddress = vestingRegistry.getTeamVesting(_tokenOwner);
		} else {
			vestingAddress = vestingRegistry.getVesting(_tokenOwner);
		}
	}

	/**
	 * @notice validates vesting schedule
	 * @dev checks whether account has vesting contract with different schedule
	 * @dev if account doesn't have vesting or schedules are the same everything is ok
	 */
	function _validateVestingSchedule(address _vestingAddress, uint256 _cliff, uint256 _duration) internal view returns (bool) {
		if (_vestingAddress == address(0)) {
			return true;
		}
		VestingLogic vesting = VestingLogic(_vestingAddress);
		return (_cliff == vesting.cliff() && _duration == vesting.duration());
	}

}
